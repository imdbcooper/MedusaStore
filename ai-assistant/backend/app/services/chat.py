import asyncio
import json
import re
import time
from collections.abc import AsyncGenerator
from typing import Any
from uuid import UUID

from app.core.config import Settings
from app.schemas.chat import ChatRequest, ChatResponse, Safety

POLICY_WORDS = {"доставка", "оплата", "возврат", "гарантия", "delivery", "payment", "return", "warranty"}
COMPARE_WORDS = {"сравни", "compare", "versus", "vs", "лучше"}
PRODUCT_WORDS = {
    "товар",
    "товары",
    "купить",
    "подбери",
    "подобрать",
    "посоветуй",
    "рекомендация",
    "recommend",
    "product",
    "choose",
    "выбрать",
}
PRODUCT_INTENTS = {"product_discovery", "product_search", "product_compare", "product_detail"}
LIVE_DATA_NOTE = "Цена и наличие не проверялись live; карточки содержат только индексированные кандидаты."


class ChatService:
    def __init__(self, *, repository, retriever, settings: Settings):
        self.repository = repository
        self.retriever = retriever
        self.settings = settings

    async def answer(self, request: ChatRequest) -> ChatResponse:
        started = time.perf_counter()
        session = await self.repository.ensure_session(
            session_id=request.session_id,
            store_id=request.store_id,
            locale=request.locale,
            customer_id=request.customer_id,
            cart_id=request.cart_id,
            region_id=request.region_id,
            metadata={"page_context": request.page_context.model_dump() if request.page_context else None},
        )
        session_id: UUID = session["id"]
        await self.repository.add_message(
            session_id=session_id,
            role="user",
            content=request.message,
        )
        intent = classify_intent(request.message)
        chunks, citations = await self.retriever.search(
            query=request.message,
            store_id=request.store_id,
            locale=request.locale,
            limit=5,
        )
        product_cards = []
        tool_calls = []
        if intent in PRODUCT_INTENTS:
            product_cards = await self.retriever.product_cards(
                store_id=request.store_id,
                locale=request.locale,
                chunks=chunks,
                limit=3,
            )
            if product_cards:
                tool_calls.append(
                    {
                        "name": "search_products",
                        "arguments": {"query": request.message, "limit": 3},
                        "result": {
                            "count": len(product_cards),
                            "live_data_checked": False,
                            "note": LIVE_DATA_NOTE,
                        },
                    }
                )
        answer = build_grounded_answer(request.message, chunks, products=product_cards)
        latency_ms = int((time.perf_counter() - started) * 1000)
        assistant_message = await self.repository.add_message(
            session_id=session_id,
            role="assistant",
            content=answer,
            intent=intent,
            citations=[citation.model_dump() for citation in citations],
            products=product_cards,
            actions=[],
            tool_calls=tool_calls,
            latency_ms=latency_ms,
        )
        return ChatResponse(
            session_id=session_id,
            message_id=assistant_message["id"],
            answer=answer,
            intent=intent,
            citations=citations,
            products=product_cards,
            actions=[],
            tool_calls=tool_calls,
            safety=Safety(grounded=bool(citations or product_cards), live_data_checked=False, needs_human=False),
        )

    async def stream_events(self, request: ChatRequest) -> AsyncGenerator[str, None]:
        response = await self.answer(request)
        yield sse_event(
            "session",
            {"session_id": str(response.session_id), "message_id": str(response.message_id)},
        )
        for token in tokenize_for_stream(response.answer):
            yield sse_event("token", {"chunk": token})
            await asyncio.sleep(0)
        if response.products:
            yield sse_event("products", {"products": [item.model_dump() for item in response.products]})
        if response.citations:
            yield sse_event("citations", {"citations": [item.model_dump() for item in response.citations]})
        if response.actions:
            yield sse_event("actions", {"actions": [item.model_dump() for item in response.actions]})
        yield sse_event("done", {"done": True})

    async def history(self, session_id: UUID) -> list[dict[str, Any]]:
        return await self.repository.list_messages(session_id)


def classify_intent(message: str) -> str:
    normalized = message.lower()
    words = set(re.findall(r"[\wа-яА-ЯёЁ-]+", normalized))
    if words & POLICY_WORDS:
        return "policy"
    if words & COMPARE_WORDS:
        return "product_compare"
    if "найди" in words or "поиск" in words or "search" in words:
        return "product_search"
    if words & PRODUCT_WORDS:
        return "product_discovery"
    if len(normalized.strip()) < 20 and any(greeting in normalized for greeting in ("привет", "hello", "hi")):
        return "smalltalk"
    return "product_discovery"


def build_grounded_answer(
    message: str,
    chunks: list[dict[str, Any]],
    *,
    products: list[dict[str, Any]] | None = None,
) -> str:
    products = products or []
    if not chunks and not products:
        return (
            "Пока в базе знаний нет подходящего фрагмента для ответа. "
            "Я могу подсказать общие критерии выбора, но цены, наличие и условия нужно проверять "
            "через Medusa перед показом покупателю."
        )

    snippets = []
    for chunk in chunks[:3]:
        content = chunk.get("content", "").strip()
        if len(content) > 500:
            content = content[:497].rstrip() + "..."
        title = chunk.get("source", {}).get("title") or chunk.get("title") or "Источник"
        snippets.append(f"Из «{title}»: {content}")
    product_text = ""
    if products:
        product_lines = [f"- {item['title']}: {item.get('reason') or 'подходит по запросу'}" for item in products]
        product_text = (
            "\n\nПодходящие товары из индекса Medusa:\n"
            + "\n".join(product_lines)
            + f"\n\n{LIVE_DATA_NOTE}"
        )

    prefix = "Нашёл релевантную информацию в базе знаний." if snippets else "Нашёл подходящие товары в индексе Medusa."
    body = "\n\n".join(snippets) if snippets else "Каталог уже проиндексирован, поэтому могу показать карточки товаров."
    return (
        f"{prefix}\n\n"
        + body
        + product_text
        + "\n\nВажно: точные цены, наличие, сроки доставки и акции должны проверяться live через Medusa."
    )


def tokenize_for_stream(text: str, *, chunk_size: int = 80) -> list[str]:
    return [text[index : index + chunk_size] for index in range(0, len(text), chunk_size)] or [""]


def sse_event(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
