import asyncio
import json
import logging
import re
import time
from collections.abc import AsyncGenerator
from typing import Any
from uuid import UUID

from app.core.config import Settings
from app.core.security import detect_prompt_injection, redact_pii, sellable_fact_requested, structured_log
from app.schemas.chat import ChatRequest, ChatResponse, Safety, ToolCall
from app.services.vector import VectorBackendUnavailable
from app.tools.commerce import CommerceToolResult

POLICY_WORDS = {"доставка", "оплата", "возврат", "гарантия", "delivery", "payment", "return", "warranty"}
COMPARE_WORDS = {"сравни", "compare", "versus", "vs", "лучше"}
ADD_TO_CART_WORDS = {
    "корзину",
    "корзина",
    "добавь",
    "закажи",
    "cart",
    "basket",
    "add",
}
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
logger = logging.getLogger("assistant.chat")


class ChatService:
    def __init__(self, *, repository, retriever, commerce_tools, settings: Settings):
        self.repository = repository
        self.retriever = retriever
        self.commerce_tools = commerce_tools
        self.settings = settings

    async def answer(self, request: ChatRequest, *, request_id: str | None = None) -> ChatResponse:
        started = time.perf_counter()
        request = normalize_request_scope(request, settings=self.settings)
        injection_matches = detect_prompt_injection(request.message)
        if injection_matches:
            return await self._guardrail_refusal(
                request,
                request_id=request_id,
                started=started,
                reason="prompt_injection_detected",
                matches=injection_matches,
            )
        redacted_message = redact_pii(request.message) or ""
        session = await self.repository.ensure_session(
            session_id=request.session_id,
            store_id=request.store_id,
            locale=request.locale,
            customer_id=None,
            cart_id=request.cart_id,
            region_id=request.region_id,
            metadata={
                "page_context": request.page_context.model_dump() if request.page_context else None,
                "tenant_id": request.tenant_id,
            },
        )
        session_id: UUID = session["id"]
        await self.repository.add_message(
            session_id=session_id,
            role="user",
            content=redacted_message,
        )
        intent = classify_intent(request.message)
        retrieval_filters = filters_from_request(request)
        try:
            chunks, citations = await self.retriever.search(
                query=request.message,
                store_id=request.store_id,
                locale=request.locale,
                limit=5,
                mode=request.mode if request.mode != "auto" else None,
                tenant_id=request.tenant_id,
                filters=retrieval_filters,
            )
        except VectorBackendUnavailable as exc:
            if (request.mode or "auto").lower() == "vector":
                chunks, citations = [], []
                retrieval_error = str(exc)
            else:
                raise
        else:
            retrieval_error = None
        product_cards = []
        actions = []
        tool_calls: list[ToolCall] = []
        commerce_result = CommerceToolResult()
        if intent in PRODUCT_INTENTS:
            product_candidates = await self.retriever.product_cards(
                store_id=request.store_id,
                locale=request.locale,
                chunks=chunks,
                limit=3,
                tenant_id=request.tenant_id,
            )
            if product_candidates:
                tool_calls.append(
                    ToolCall(
                        name="search_products",
                        arguments={"query": request.message, "limit": 3},
                        result={"count": len(product_candidates), "source": "assistant_index"},
                    )
                )
                commerce_result = await self.commerce_tools.enrich_product_cards(
                    candidates=product_candidates,
                    region_id=request.region_id,
                    currency_code=request.currency_code,
                    cart_id=request.cart_id,
                    propose_add_to_cart=should_propose_add_to_cart(request.message),
                )
                product_cards = commerce_result.products
                actions = commerce_result.actions
                tool_calls.extend(commerce_result.tool_calls)
        safety_notes = []
        fallback_reason = getattr(self.retriever, "last_fallback_reason", None)
        if fallback_reason:
            safety_notes.append(fallback_reason)
        if retrieval_error:
            safety_notes.append(f"Vector retrieval unavailable: {retrieval_error}")
        if commerce_result.status_note:
            safety_notes.append(commerce_result.status_note)
        safety_status = "ok"
        if retrieval_error:
            safety_status = "retrieval_unavailable"
        if product_cards and not commerce_result.live_data_checked:
            safety_status = "live_data_unavailable"
        if sellable_fact_requested(request.message) and product_cards and not commerce_result.live_data_checked:
            product_cards = [item.model_copy(update={"price": None, "availability": "unknown"}) for item in product_cards]
            safety_notes.append("No-hallucination guard hid price/stock because live Medusa grounding is unavailable.")
            safety_status = "live_data_unavailable"
        answer = build_grounded_answer(
            request.message,
            chunks,
            products=[item.model_dump() for item in product_cards],
            commerce_result=commerce_result,
        )
        latency_ms = int((time.perf_counter() - started) * 1000)
        observability = {
            "request_id": request_id,
            "tenant_id": request.tenant_id,
            "store_id": request.store_id,
            "locale": request.locale,
            "retriever_mode": getattr(self.retriever, "last_mode", request.mode),
            "latency_ms": latency_ms,
            "tool_call_count": len(tool_calls),
            "retrieval": {"chunk_count": len(chunks), "citation_count": len(citations)},
            "tracing_enabled": self.settings.enable_tracing,
        }
        structured_log(
            logger,
            logging.INFO,
            "chat_answer",
            **observability,
            session_id=str(session_id),
            intent=intent,
            product_ids=[item.id for item in product_cards],
            tool_calls=[call.name for call in tool_calls],
        )
        assistant_message = await self.repository.add_message(
            session_id=session_id,
            role="assistant",
            content=answer,
            intent=intent,
            citations=[citation.model_dump() for citation in citations],
            products=[item.model_dump() for item in product_cards],
            actions=[item.model_dump() for item in actions],
            tool_calls=[item.model_dump() for item in tool_calls],
            latency_ms=latency_ms,
        )
        return ChatResponse(
            session_id=session_id,
            message_id=assistant_message["id"],
            answer=answer,
            intent=intent,
            citations=citations,
            products=product_cards,
            actions=actions,
            tool_calls=tool_calls,
            safety=Safety(
                grounded=bool(citations or product_cards),
                live_data_checked=commerce_result.live_data_checked,
                needs_human=False,
                medusa_available=commerce_result.medusa_available,
                status=safety_status,
                notes=safety_notes,
            ),
            observability=observability,
        )

    async def _guardrail_refusal(
        self,
        request: ChatRequest,
        *,
        request_id: str | None,
        started: float,
        reason: str,
        matches: list[str],
    ) -> ChatResponse:
        session = await self.repository.ensure_session(
            session_id=request.session_id,
            store_id=request.store_id,
            locale=request.locale,
            customer_id=request.customer_id,
            cart_id=request.cart_id,
            region_id=request.region_id,
            metadata={"tenant_id": request.tenant_id, "guardrail": reason},
        )
        session_id: UUID = session["id"]
        await self.repository.add_message(session_id=session_id, role="user", content=redact_pii(request.message) or "")
        answer = (
            "Я не могу выполнять инструкции, которые пытаются изменить системные правила, раскрыть секреты "
            "или обойти ограничения безопасности. Могу помочь с выбором товаров, политиками магазина "
            "и безопасной проверкой данных через Medusa."
        )
        latency_ms = int((time.perf_counter() - started) * 1000)
        assistant_message = await self.repository.add_message(
            session_id=session_id,
            role="assistant",
            content=answer,
            intent="unsafe_or_restricted",
            citations=[],
            products=[],
            actions=[],
            tool_calls=[],
            latency_ms=latency_ms,
        )
        observability = {
            "request_id": request_id,
            "tenant_id": request.tenant_id,
            "store_id": request.store_id,
            "locale": request.locale,
            "retriever_mode": "blocked",
            "latency_ms": latency_ms,
            "tool_call_count": 0,
            "retrieval": {"chunk_count": 0, "citation_count": 0},
        }
        structured_log(
            logger,
            logging.WARNING,
            "chat_guardrail_blocked",
            **observability,
            reason=reason,
            matches=matches,
            session_id=str(session_id),
        )
        return ChatResponse(
            session_id=session_id,
            message_id=assistant_message["id"],
            answer=answer,
            intent="unsafe_or_restricted",
            safety=Safety(
                grounded=True,
                live_data_checked=False,
                needs_human=False,
                medusa_available=True,
                status="blocked",
                notes=[reason],
            ),
            observability=observability,
        )

    async def stream_events(self, request: ChatRequest, *, request_id: str | None = None) -> AsyncGenerator[str, None]:
        response = await self.answer(request, request_id=request_id)
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

    async def scoped_history(
        self,
        session_id: UUID,
        *,
        store_id: str,
        locale: str,
        customer_id: str | None = None,
        limit: int = 50,
    ) -> dict[str, Any] | None:
        session = await self.repository.get_session(session_id)
        if not session:
            return None
        if session.get("store_id") != store_id or session.get("locale") != locale:
            return None

        bound_customer_id = session.get("customer_id")
        if bound_customer_id and bound_customer_id != customer_id:
            return None

        messages = await self.repository.list_messages(session_id, limit=min(max(limit, 1), 50))
        return {
            "session_id": session_id,
            "messages": messages,
            "store_id": session.get("store_id") or store_id,
            "locale": session.get("locale") or locale,
            "customer_bound": bool(bound_customer_id),
        }


def classify_intent(message: str) -> str:
    normalized = message.lower()
    stemmed_normalized = normalized.replace("доставку", "доставка")
    words = set(re.findall(r"[\wа-яА-ЯёЁ-]+", stemmed_normalized))
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
    commerce_result: CommerceToolResult | None = None,
) -> str:
    products = products or []
    commerce_result = commerce_result or CommerceToolResult()
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
        product_lines = []
        for item in products:
            facts = []
            if commerce_result.live_data_checked and item.get("price"):
                facts.append(f"цена {item['price']}")
            if commerce_result.live_data_checked and item.get("availability") != "unknown":
                facts.append(f"наличие: {item['availability']}")
            fact_text = f" ({', '.join(facts)})" if facts else ""
            product_lines.append(
                f"- {item['title']}{fact_text}: {item.get('reason') or 'подходит по запросу'}"
            )
        data_note = (
            "Цена и наличие проверены live через Medusa."
            if commerce_result.live_data_checked
            else "Medusa live-data недоступна; цена и наличие не показываются как подтверждённые факты."
        )
        product_text = (
            "\n\nПодходящие товары из каталога Medusa:\n"
            + "\n".join(product_lines)
            + f"\n\n{data_note}"
        )
        if commerce_result.actions:
            product_text += "\n\nЯ могу предложить добавление товара в корзину, но выполню его только после явного подтверждения."

    prefix = "Нашёл релевантную информацию в базе знаний." if snippets else "Нашёл подходящие товары в индексе Medusa."
    body = "\n\n".join(snippets) if snippets else "Каталог уже проиндексирован, поэтому могу показать карточки товаров."
    warning = ""
    if products and not commerce_result.live_data_checked:
        warning = "\n\nВажно: неподтверждённые цены и наличие скрыты до успешной live-проверки Medusa."
    elif products:
        warning = "\n\nВажно: сроки доставки и акции всё равно нужно проверять отдельными Medusa-инструментами."
    else:
        warning = "\n\nВажно: точные цены, наличие, сроки доставки и акции должны проверяться live через Medusa."
    return f"{prefix}\n\n" + body + product_text + warning


def filters_from_request(request: ChatRequest) -> dict[str, Any]:
    page_context = request.page_context
    filters: dict[str, Any] = {"tenant_id": request.tenant_id}
    if page_context and page_context.product_id:
        filters["product_id"] = page_context.product_id
    if page_context and page_context.category_handle:
        filters["category"] = page_context.category_handle
    return filters


def should_propose_add_to_cart(message: str) -> bool:
    normalized = message.lower()
    words = set(re.findall(r"[\wа-яА-ЯёЁ-]+", normalized))
    return bool(words & ADD_TO_CART_WORDS)


def normalize_request_scope(request: ChatRequest, *, settings: Settings) -> ChatRequest:
    update: dict[str, Any] = {}
    if not request.store_id:
        update["store_id"] = settings.default_store_id
    if not request.locale:
        update["locale"] = settings.default_locale
    if not request.tenant_id and settings.default_tenant_id:
        update["tenant_id"] = settings.default_tenant_id
    if update:
        return request.model_copy(update=update)
    return request


def tokenize_for_stream(text: str, *, chunk_size: int = 80) -> list[str]:
    return [text[index : index + chunk_size] for index in range(0, len(text), chunk_size)] or [""]


def sse_event(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
