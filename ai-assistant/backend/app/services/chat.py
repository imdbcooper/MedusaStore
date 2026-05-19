import asyncio
import json
import logging
import re
import time
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from app.core.config import Settings
from app.core.security import detect_prompt_injection, redact_pii, sellable_fact_requested, structured_log
from app.schemas.chat import ChatRequest, ChatResponse, Safety, ToolCall
from app.services.llm import ChatMessage, LlmCallRequest, LlmRouter, LlmRoutingError
from app.services.settings_provider import AssistantRuntimeSettings, SettingsFetchError, SettingsProvider
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

ANSWER_SOURCE_DETERMINISTIC = "deterministic_fallback"
ANSWER_SOURCE_AFTER_LLM_FAILURE = "deterministic_fallback_after_llm_failure"

logger = logging.getLogger("assistant.chat")


@dataclass(slots=True)
class GroundedContext:
    request: ChatRequest
    session_id: UUID
    prior_messages: list[dict[str, Any]]
    redacted_message: str
    intent: str
    chunks: list[dict[str, Any]]
    citations: list
    product_cards: list = field(default_factory=list)
    actions: list = field(default_factory=list)
    tool_calls: list[ToolCall] = field(default_factory=list)
    commerce_result: CommerceToolResult = field(default_factory=CommerceToolResult)
    safety_notes: list[str] = field(default_factory=list)
    safety_status: str = "ok"
    retrieval_error: str | None = None
    sellable_requested: bool = False


class ChatService:
    def __init__(
        self,
        *,
        repository,
        retriever,
        commerce_tools,
        settings: Settings,
        settings_provider: SettingsProvider | None = None,
        llm_router: LlmRouter | None = None,
    ):
        self.repository = repository
        self.retriever = retriever
        self.commerce_tools = commerce_tools
        self.settings = settings
        self.settings_provider = settings_provider
        if llm_router is None and settings_provider is not None:
            llm_router = LlmRouter(settings_provider)
        self.llm_router = llm_router

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

        context = await self._prepare_grounded_context(request)
        runtime = await self._safe_get_runtime()
        answer, answer_source, llm_meta = await self._produce_answer(
            request=context.request,
            redacted_message=context.redacted_message,
            chunks=context.chunks,
            product_cards=context.product_cards,
            commerce_result=context.commerce_result,
            runtime=runtime,
            prior_messages=context.prior_messages,
        )
        answer = self._apply_answer_guardrails(
            answer,
            answer_source=answer_source,
            sellable_requested=context.sellable_requested,
            commerce_result=context.commerce_result,
        )
        latency_ms = int((time.perf_counter() - started) * 1000)
        observability = self._build_observability(
            request=context.request,
            request_id=request_id,
            latency_ms=latency_ms,
            chunks=context.chunks,
            citations=context.citations,
            tool_calls=context.tool_calls,
            answer_source=answer_source,
            llm_meta=llm_meta,
        )
        self._log_answer(
            context=context,
            observability=observability,
            llm_meta=llm_meta,
            answer_source=answer_source,
        )
        assistant_message = await self.repository.add_message(
            session_id=context.session_id,
            role="assistant",
            content=answer,
            intent=context.intent,
            citations=[citation.model_dump() for citation in context.citations],
            products=[item.model_dump() for item in context.product_cards],
            actions=[item.model_dump() for item in context.actions],
            tool_calls=[item.model_dump() for item in context.tool_calls],
            latency_ms=latency_ms,
        )
        return self._build_response(
            context=context,
            message_id=assistant_message["id"],
            answer=answer,
            observability=observability,
        )

    async def _prepare_grounded_context(self, request: ChatRequest) -> GroundedContext:
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
        prior_messages = list(await self.repository.list_messages(session_id))
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
        sellable_requested = sellable_fact_requested(request.message)
        if sellable_requested and product_cards and not commerce_result.live_data_checked:
            product_cards = [item.model_copy(update={"price": None, "availability": "unknown"}) for item in product_cards]
            safety_notes.append("No-hallucination guard hid price/stock because live Medusa grounding is unavailable.")
            safety_status = "live_data_unavailable"

        return GroundedContext(
            request=request,
            session_id=session_id,
            prior_messages=prior_messages,
            redacted_message=redacted_message,
            intent=intent,
            chunks=chunks,
            citations=citations,
            product_cards=product_cards,
            actions=actions,
            tool_calls=tool_calls,
            commerce_result=commerce_result,
            safety_notes=safety_notes,
            safety_status=safety_status,
            retrieval_error=retrieval_error,
            sellable_requested=sellable_requested,
        )

    async def _safe_get_runtime(self) -> AssistantRuntimeSettings | None:
        if self.settings_provider is None:
            return None
        try:
            return await self.settings_provider.get()
        except SettingsFetchError as exc:
            structured_log(
                logger,
                logging.WARNING,
                "chat.answer.settings_unavailable",
                error=str(exc),
            )
            return None

    async def _produce_answer(
        self,
        *,
        request: ChatRequest,
        redacted_message: str,
        chunks: list[dict[str, Any]],
        product_cards: list,
        commerce_result: CommerceToolResult,
        runtime: AssistantRuntimeSettings | None,
        prior_messages: list[dict[str, Any]],
    ) -> tuple[str, str, dict[str, Any] | None]:
        deterministic_answer = self._deterministic_answer(request, chunks, product_cards, commerce_result)

        if self.llm_router is None or runtime is None or runtime.active is None:
            return deterministic_answer, ANSWER_SOURCE_DETERMINISTIC, None

        try:
            req = self._build_llm_request(
                runtime=runtime,
                redacted_message=redacted_message,
                chunks=chunks,
                product_cards=product_cards,
                commerce_result=commerce_result,
                prior_messages=prior_messages,
                stream=False,
            )
            result = await self.llm_router.complete(req)
        except LlmRoutingError as exc:
            structured_log(
                logger,
                logging.WARNING,
                "chat.answer.llm_failed",
                reason=exc.message,
                attempts=exc.attempts,
            )
            return deterministic_answer, ANSWER_SOURCE_AFTER_LLM_FAILURE, None
        except Exception as exc:  # noqa: BLE001 — degrade gracefully on unexpected LLM errors
            structured_log(
                logger,
                logging.WARNING,
                "chat.answer.llm_failed",
                reason="unexpected_error",
                error=str(exc),
            )
            return deterministic_answer, ANSWER_SOURCE_AFTER_LLM_FAILURE, None

        answer_text = result.content.strip() or deterministic_answer
        meta = result.model_dump(exclude={"content"})
        return answer_text, f"llm:{result.provider_id}", meta

    def _build_llm_request(
        self,
        *,
        runtime: AssistantRuntimeSettings,
        redacted_message: str,
        chunks: list[dict[str, Any]],
        product_cards: list,
        commerce_result: CommerceToolResult,
        prior_messages: list[dict[str, Any]],
        stream: bool,
    ) -> LlmCallRequest:
        global_settings = runtime.global_settings
        active = runtime.active
        assert active is not None
        history = _build_chat_history(
            prior_messages,
            redacted_user_message=redacted_message,
            limit=max(0, int(global_settings.max_history_messages)),
        )
        system_prompt = _compose_system_prompt(
            base_prompt=global_settings.system_prompt,
            chunks=chunks,
            product_cards=product_cards,
            commerce_result=commerce_result,
        )
        return LlmCallRequest(
            system_prompt=system_prompt,
            messages=history,
            max_tokens=int(global_settings.max_output_tokens),
            temperature=float(active.temperature),
            top_p=active.top_p,
            stream=stream,
        )

    def _deterministic_answer(
        self,
        request: ChatRequest,
        chunks: list[dict[str, Any]],
        product_cards: list,
        commerce_result: CommerceToolResult,
    ) -> str:
        return build_grounded_answer(
            request.message,
            chunks,
            products=[item.model_dump() for item in product_cards],
            commerce_result=commerce_result,
        )

    def _apply_answer_guardrails(
        self,
        answer: str,
        *,
        answer_source: str,
        sellable_requested: bool,
        commerce_result: CommerceToolResult,
    ) -> str:
        safe_answer = redact_pii(answer) or ""
        if (
            sellable_requested
            and not commerce_result.live_data_checked
            and answer_source != ANSWER_SOURCE_DETERMINISTIC
            and answer_source != ANSWER_SOURCE_AFTER_LLM_FAILURE
        ):
            safe_answer = self._append_live_data_disclaimer(safe_answer)
        return safe_answer

    @staticmethod
    def _append_live_data_disclaimer(answer: str) -> str:
        if LIVE_DATA_NOTE in answer:
            return answer
        return f"{answer.rstrip()}\n\n{LIVE_DATA_NOTE}"

    def _build_observability(
        self,
        *,
        request: ChatRequest,
        request_id: str | None,
        latency_ms: int,
        chunks: list[dict[str, Any]],
        citations: list,
        tool_calls: list[ToolCall],
        answer_source: str,
        llm_meta: dict[str, Any] | None,
    ) -> dict[str, Any]:
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
            "answer_source": answer_source,
        }
        if llm_meta:
            observability["llm"] = llm_meta
        return observability

    def _log_answer(
        self,
        *,
        context: GroundedContext,
        observability: dict[str, Any],
        llm_meta: dict[str, Any] | None,
        answer_source: str,
    ) -> None:
        log_payload: dict[str, Any] = {
            **observability,
            "session_id": str(context.session_id),
            "intent": context.intent,
            "product_ids": [item.id for item in context.product_cards],
            "tool_calls": [call.name for call in context.tool_calls],
            "live_data_checked": context.commerce_result.live_data_checked,
            "sellable_fact_requested": context.sellable_requested,
        }
        if llm_meta:
            structured_log(
                logger,
                logging.INFO,
                "chat.answer.completed",
                provider_id=llm_meta.get("provider_id"),
                provider_name=llm_meta.get("provider_name"),
                model=llm_meta.get("model"),
                attempts=llm_meta.get("attempts"),
                llm_latency_ms=llm_meta.get("latency_ms"),
                prompt_tokens=(llm_meta.get("usage") or {}).get("prompt_tokens"),
                completion_tokens=(llm_meta.get("usage") or {}).get("completion_tokens"),
                total_tokens=(llm_meta.get("usage") or {}).get("total_tokens"),
                **log_payload,
            )
        else:
            structured_log(
                logger,
                logging.INFO,
                "chat.answer.fallback",
                reason=answer_source,
                **log_payload,
            )
        structured_log(logger, logging.INFO, "chat_answer", **log_payload)

    def _build_response(
        self,
        *,
        context: GroundedContext,
        message_id: UUID,
        answer: str,
        observability: dict[str, Any],
    ) -> ChatResponse:
        return ChatResponse(
            session_id=context.session_id,
            message_id=message_id,
            answer=answer,
            intent=context.intent,
            citations=context.citations,
            products=context.product_cards,
            actions=context.actions,
            tool_calls=context.tool_calls,
            safety=Safety(
                grounded=bool(context.citations or context.product_cards),
                live_data_checked=context.commerce_result.live_data_checked,
                needs_human=False,
                medusa_available=context.commerce_result.medusa_available,
                status=context.safety_status,
                notes=context.safety_notes,
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
        started = time.perf_counter()
        request = normalize_request_scope(request, settings=self.settings)
        injection_matches = detect_prompt_injection(request.message)
        if injection_matches:
            response = await self._guardrail_refusal(
                request,
                request_id=request_id,
                started=started,
                reason="prompt_injection_detected",
                matches=injection_matches,
            )
            async for event in _stream_response_as_events(response):
                yield event
            return

        context = await self._prepare_grounded_context(request)
        runtime = await self._safe_get_runtime()
        should_stream_llm = (
            self.llm_router is not None
            and runtime is not None
            and runtime.active is not None
            and runtime.global_settings.streaming_enabled is not False
        )
        if not should_stream_llm:
            response = await self._finish_deterministic_stream_context(
                context,
                started=started,
                request_id=request_id,
                answer_source=ANSWER_SOURCE_DETERMINISTIC,
            )
            async for event in _stream_response_as_events(response):
                yield event
            return

        assert runtime is not None
        assert self.llm_router is not None
        try:
            req = self._build_llm_request(
                runtime=runtime,
                redacted_message=context.redacted_message,
                chunks=context.chunks,
                product_cards=context.product_cards,
                commerce_result=context.commerce_result,
                prior_messages=context.prior_messages,
                stream=True,
            )
            provider, iterator = await self.llm_router.stream(req)
        except LlmRoutingError as exc:
            structured_log(
                logger,
                logging.WARNING,
                "chat.stream.llm_failed_before_first_chunk",
                reason=exc.message,
                attempts=exc.attempts,
            )
            response = await self._finish_deterministic_stream_context(
                context,
                started=started,
                request_id=request_id,
                answer_source=ANSWER_SOURCE_AFTER_LLM_FAILURE,
            )
            async for event in _stream_response_as_events(response):
                yield event
            return
        except Exception as exc:  # noqa: BLE001 — fallback before first chunk
            structured_log(
                logger,
                logging.WARNING,
                "chat.stream.llm_failed_before_first_chunk",
                reason="unexpected_error",
                error=str(exc),
            )
            response = await self._finish_deterministic_stream_context(
                context,
                started=started,
                request_id=request_id,
                answer_source=ANSWER_SOURCE_AFTER_LLM_FAILURE,
            )
            async for event in _stream_response_as_events(response):
                yield event
            return

        yield sse_event("session", {"session_id": str(context.session_id), "message_id": None})
        parts: list[str] = []
        emitted_any = False
        try:
            async for delta in iterator:
                if not delta:
                    continue
                emitted_any = True
                parts.append(delta)
                yield sse_event("token", {"chunk": delta})
                await asyncio.sleep(0)
        except Exception as exc:  # noqa: BLE001 — no fallback after partial stream
            structured_log(
                logger,
                logging.ERROR,
                "chat.stream.llm_failed_after_first_chunk",
                provider_id=provider.id,
                provider_name=provider.name,
                model=provider.model,
                emitted_any=emitted_any,
                error=str(exc),
            )
            yield sse_event("error", {"message": "LLM stream interrupted", "retryable": True})
            yield sse_event("done", {"done": True, "provider_id": provider.id, "model": provider.model})
            return

        answer = self._apply_answer_guardrails(
            "".join(parts),
            answer_source=f"llm:{provider.id}",
            sellable_requested=context.sellable_requested,
            commerce_result=context.commerce_result,
        )
        if answer != "".join(parts):
            suffix = answer[len("".join(parts)) :]
            if suffix:
                yield sse_event("token", {"chunk": suffix})
        if not answer:
            response = await self._finish_deterministic_stream_context(
                context,
                started=started,
                request_id=request_id,
                answer_source=ANSWER_SOURCE_AFTER_LLM_FAILURE,
            )
            async for event in _stream_response_as_events(response, include_session=False):
                yield event
            return

        latency_ms = int((time.perf_counter() - started) * 1000)
        llm_meta = {
            "provider_id": provider.id,
            "provider_name": provider.name,
            "model": provider.model,
            "latency_ms": latency_ms,
            "attempts": 1,
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
        }
        observability = self._build_observability(
            request=context.request,
            request_id=request_id,
            latency_ms=latency_ms,
            chunks=context.chunks,
            citations=context.citations,
            tool_calls=context.tool_calls,
            answer_source=f"llm:{provider.id}",
            llm_meta=llm_meta,
        )
        self._log_answer(
            context=context,
            observability=observability,
            llm_meta=llm_meta,
            answer_source=f"llm:{provider.id}",
        )
        assistant_message = await self.repository.add_message(
            session_id=context.session_id,
            role="assistant",
            content=answer,
            intent=context.intent,
            citations=[citation.model_dump() for citation in context.citations],
            products=[item.model_dump() for item in context.product_cards],
            actions=[item.model_dump() for item in context.actions],
            tool_calls=[item.model_dump() for item in context.tool_calls],
            latency_ms=latency_ms,
        )
        if context.product_cards:
            yield sse_event("products", {"products": [item.model_dump() for item in context.product_cards]})
        if context.citations:
            yield sse_event("citations", {"citations": [item.model_dump() for item in context.citations]})
        if context.actions:
            yield sse_event("actions", {"actions": [item.model_dump() for item in context.actions]})
        yield sse_event(
            "done",
            {
                "done": True,
                "message_id": str(assistant_message["id"]),
                "provider_id": provider.id,
                "model": provider.model,
            },
        )

    async def _finish_deterministic_stream_context(
        self,
        context: GroundedContext,
        *,
        started: float,
        request_id: str | None,
        answer_source: str,
    ) -> ChatResponse:
        answer = self._deterministic_answer(
            context.request,
            context.chunks,
            context.product_cards,
            context.commerce_result,
        )
        answer = self._apply_answer_guardrails(
            answer,
            answer_source=answer_source,
            sellable_requested=context.sellable_requested,
            commerce_result=context.commerce_result,
        )
        latency_ms = int((time.perf_counter() - started) * 1000)
        observability = self._build_observability(
            request=context.request,
            request_id=request_id,
            latency_ms=latency_ms,
            chunks=context.chunks,
            citations=context.citations,
            tool_calls=context.tool_calls,
            answer_source=answer_source,
            llm_meta=None,
        )
        self._log_answer(
            context=context,
            observability=observability,
            llm_meta=None,
            answer_source=answer_source,
        )
        assistant_message = await self.repository.add_message(
            session_id=context.session_id,
            role="assistant",
            content=answer,
            intent=context.intent,
            citations=[citation.model_dump() for citation in context.citations],
            products=[item.model_dump() for item in context.product_cards],
            actions=[item.model_dump() for item in context.actions],
            tool_calls=[item.model_dump() for item in context.tool_calls],
            latency_ms=latency_ms,
        )
        return self._build_response(
            context=context,
            message_id=assistant_message["id"],
            answer=answer,
            observability=observability,
        )

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


async def _stream_response_as_events(
    response: ChatResponse,
    *,
    include_session: bool = True,
) -> AsyncGenerator[str, None]:
    if include_session:
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


def _build_chat_history(
    prior_messages: list[dict[str, Any]],
    *,
    redacted_user_message: str,
    limit: int,
) -> list[ChatMessage]:
    """Render the recent dialog tail plus the new user message as ChatMessages."""

    history: list[ChatMessage] = []
    if limit > 0 and prior_messages:
        recent = prior_messages[-limit:]
        for record in recent:
            role = record.get("role")
            content = record.get("content")
            if not isinstance(role, str) or not isinstance(content, str):
                continue
            if role not in {"user", "assistant", "system"}:
                continue
            if not content:
                continue
            history.append(ChatMessage(role=role, content=content))
    history.append(ChatMessage(role="user", content=redacted_user_message))
    return history


def _compose_system_prompt(
    *,
    base_prompt: str,
    chunks: list[dict[str, Any]],
    product_cards: list,
    commerce_result: CommerceToolResult,
) -> str:
    base = (base_prompt or "").rstrip()
    context_block = _render_context_block(chunks, product_cards, commerce_result)
    if not context_block:
        return base
    if not base:
        return context_block
    return f"{base}\n\n{context_block}"


def _render_context_block(
    chunks: list[dict[str, Any]],
    product_cards: list,
    commerce_result: CommerceToolResult,
) -> str:
    sections: list[str] = []
    if chunks:
        rendered_chunks: list[str] = []
        for index, chunk in enumerate(chunks[:5], start=1):
            content = (chunk.get("content") or "").strip()
            if not content:
                continue
            if len(content) > 800:
                content = content[:797].rstrip() + "..."
            source_block = chunk.get("source") or {}
            title = source_block.get("title") or chunk.get("title") or "Источник"
            rendered_chunks.append(f"[{index}] {title}\n{content}")
        if rendered_chunks:
            sections.append("Чанки базы знаний:\n" + "\n\n".join(rendered_chunks))

    if product_cards:
        product_lines: list[str] = []
        for item in product_cards:
            data = item.model_dump() if hasattr(item, "model_dump") else dict(item)
            facts: list[str] = []
            if commerce_result.live_data_checked and data.get("price"):
                facts.append(f"цена {data['price']}")
            if commerce_result.live_data_checked and data.get("availability") not in (None, "unknown"):
                facts.append(f"наличие: {data['availability']}")
            fact_text = f" ({', '.join(facts)})" if facts else ""
            reason = data.get("reason") or "подходит по запросу"
            product_lines.append(f"- {data.get('title')}{fact_text}: {reason}")
        sections.append("Подходящие товары из каталога Medusa:\n" + "\n".join(product_lines))

    if commerce_result.status_note:
        sections.append(f"Live-данные: {commerce_result.status_note}")
    elif product_cards and commerce_result.live_data_checked:
        sections.append("Live-данные: цена и наличие подтверждены через Medusa.")

    if not sections:
        return ""
    return "Контекст для ответа:\n\n" + "\n\n".join(sections)


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
