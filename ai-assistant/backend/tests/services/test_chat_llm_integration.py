"""Integration tests covering :class:`ChatService` + :class:`LlmRouter`."""

from __future__ import annotations

from typing import Any

import pytest

from app.core.config import Settings
from app.repositories.memory import InMemoryAssistantRepository
from app.schemas.chat import ChatRequest
from app.services.chat import (
    ANSWER_SOURCE_AFTER_LLM_FAILURE,
    ANSWER_SOURCE_DETERMINISTIC,
    ChatService,
)
from app.services.llm import LlmCallRequest, LlmResult, LlmRoutingError, LlmUsage
from app.services.retrieval import ModeAwareRetriever, SimpleMarkdownRetriever
from app.services.settings_provider import (
    AssistantRuntimeSettings,
    GlobalAssistantSettings,
    ProviderRuntime,
)
from app.tools.commerce import LiveCommerceTools


# --------------------------------------------------------------------------- #
# Test doubles
# --------------------------------------------------------------------------- #


class _FakeProductClient:
    def __init__(self) -> None:
        self.products: list[dict[str, Any]] = []

    async def list_products(self, **kwargs):  # noqa: ANN003
        return list(self.products)

    async def get_cart(self, **kwargs):  # noqa: ANN003
        return {"id": kwargs.get("cart_id"), "items": [], "currency_code": "rub"}

    async def add_to_cart(self, **kwargs):  # noqa: ANN003
        return {"id": kwargs.get("cart_id"), "items": [], "currency_code": "rub"}


class _StubSettingsProvider:
    def __init__(self, runtime: AssistantRuntimeSettings | None) -> None:
        self._runtime = runtime
        self.calls = 0

    async def get(self) -> AssistantRuntimeSettings:
        self.calls += 1
        if self._runtime is None:
            from app.services.settings_provider import SettingsFetchError

            raise SettingsFetchError("no settings")
        return self._runtime


class _StubLlmRouter:
    def __init__(
        self,
        *,
        result: LlmResult | None = None,
        exc: BaseException | None = None,
    ) -> None:
        self.result = result
        self.exc = exc
        self.calls: list[LlmCallRequest] = []

    async def complete(self, req: LlmCallRequest) -> LlmResult:
        self.calls.append(req)
        if self.exc is not None:
            raise self.exc
        assert self.result is not None
        return self.result

    async def aclose(self) -> None:
        return None


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _provider(*, id: str = "p1", name: str = "active") -> ProviderRuntime:
    return ProviderRuntime(
        id=id,
        name=name,
        api_key="sk-secret-AAA",
        base_url="https://api.example.com/v1",
        model="gpt-4o-mini",
        timeout_ms=5_000,
        request_headers={},
        temperature=0.4,
        top_p=0.9,
    )


def _runtime(active: ProviderRuntime | None) -> AssistantRuntimeSettings:
    return AssistantRuntimeSettings(
        version="2026-05-18T00:00:00.000Z",
        active=active,
        fallback=[],
        global_settings=GlobalAssistantSettings(
            system_prompt="You are an assistant. Be helpful.",
            max_history_messages=4,
            max_output_tokens=256,
        ),
    )


def _llm_result(content: str, *, provider_id: str = "p1", attempts: int = 1) -> LlmResult:
    return LlmResult(
        content=content,
        finish_reason="stop",
        usage=LlmUsage(prompt_tokens=10, completion_tokens=20, total_tokens=30),
        provider_id=provider_id,
        provider_name="active",
        model="gpt-4o-mini",
        latency_ms=80,
        attempts=attempts,
    )


def _build_service(
    *,
    settings_provider=None,
    llm_router=None,
) -> ChatService:
    repository = InMemoryAssistantRepository()
    settings = Settings(
        ASSISTANT_POSTGRES_URI=None,
        MEDUSA_BACKEND_URL="http://medusa.test",
    )
    retriever = ModeAwareRetriever(
        markdown_retriever=SimpleMarkdownRetriever(repository=repository),
        vector_retriever=None,
        settings=settings,
    )
    commerce_tools = LiveCommerceTools(product_client=_FakeProductClient())
    return ChatService(
        repository=repository,
        retriever=retriever,
        commerce_tools=commerce_tools,
        settings=settings,
        settings_provider=settings_provider,
        llm_router=llm_router,
    )


def _request(message: str = "Расскажи про доставку", **overrides) -> ChatRequest:
    payload = {
        "message": message,
        "store_id": "default",
        "locale": "ru",
        **overrides,
    }
    return ChatRequest(**payload)


# --------------------------------------------------------------------------- #
# Tests
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_default_path_uses_deterministic_answer_when_no_llm_or_settings_wired():
    service = _build_service()
    response = await service.answer(_request())

    assert response.answer
    assert response.observability["answer_source"] == ANSWER_SOURCE_DETERMINISTIC
    assert "llm" not in response.observability


@pytest.mark.asyncio
async def test_settings_with_no_active_provider_keeps_deterministic_answer():
    settings_provider = _StubSettingsProvider(_runtime(active=None))
    router = _StubLlmRouter(result=_llm_result("never used"))
    service = _build_service(settings_provider=settings_provider, llm_router=router)

    response = await service.answer(_request())

    assert response.observability["answer_source"] == ANSWER_SOURCE_DETERMINISTIC
    assert router.calls == []


@pytest.mark.asyncio
async def test_llm_success_replaces_deterministic_answer_and_marks_source():
    settings_provider = _StubSettingsProvider(_runtime(active=_provider()))
    router = _StubLlmRouter(result=_llm_result("Это ответ от LLM."))
    service = _build_service(settings_provider=settings_provider, llm_router=router)

    response = await service.answer(_request())

    assert response.observability["answer_source"] == "llm:p1"
    assert response.answer == "Это ответ от LLM."
    assert len(router.calls) == 1
    call = router.calls[0]
    assert call.system_prompt.startswith("You are an assistant. Be helpful.")
    # The user message must be the most recent message in the chat history.
    assert call.messages[-1].role == "user"
    assert call.messages[-1].content == "Расскажи про доставку"
    # max_tokens should come from runtime.global_settings; temperature/top_p from active provider.
    assert call.max_tokens == 256
    assert call.temperature == 0.4
    assert call.top_p == 0.9
    assert response.observability["llm"]["provider_id"] == "p1"


@pytest.mark.asyncio
async def test_llm_routing_error_falls_back_to_deterministic_answer():
    settings_provider = _StubSettingsProvider(_runtime(active=_provider()))
    router = _StubLlmRouter(exc=LlmRoutingError("all_providers_failed", attempts=[{"provider_id": "p1"}]))
    service = _build_service(settings_provider=settings_provider, llm_router=router)

    response = await service.answer(_request())

    assert response.observability["answer_source"] == ANSWER_SOURCE_AFTER_LLM_FAILURE
    assert response.answer  # deterministic answer body, non-empty
    assert "llm" not in response.observability


@pytest.mark.asyncio
async def test_sellable_fact_disclaimer_is_appended_when_live_data_unavailable():
    settings_provider = _StubSettingsProvider(_runtime(active=_provider()))
    # LLM returns text that mentions price but live commerce is unavailable.
    router = _StubLlmRouter(result=_llm_result("Цена 100 руб., доступно к заказу."))
    service = _build_service(settings_provider=settings_provider, llm_router=router)

    response = await service.answer(
        _request(message="Сколько стоит кофемашина? Подбери и покажи цену.")
    )

    assert response.observability["answer_source"] == "llm:p1"
    # Even when LLM speaks about price, the safety disclaimer must be added
    # because we did not verify live data through Medusa.
    assert (
        "Цена и наличие не проверялись live; карточки содержат только индексированные кандидаты."
        in response.answer
    )


@pytest.mark.asyncio
async def test_pii_redaction_is_applied_on_top_of_llm_answer():
    settings_provider = _StubSettingsProvider(_runtime(active=_provider()))
    router = _StubLlmRouter(
        result=_llm_result("Свяжись со мной по test@example.com если что.")
    )
    service = _build_service(settings_provider=settings_provider, llm_router=router)

    response = await service.answer(_request(message="Что нового?"))

    assert response.observability["answer_source"] == "llm:p1"
    assert "test@example.com" not in response.answer
    assert "[REDACTED_EMAIL]" in response.answer


@pytest.mark.asyncio
async def test_llm_system_prompt_includes_compressed_dialogue_memory():
    settings_provider = _StubSettingsProvider(_runtime(active=_provider()))
    router = _StubLlmRouter(result=_llm_result("LLM answer."))
    service = _build_service(settings_provider=settings_provider, llm_router=router)

    first = await service.answer(_request(message="Расскажи про доставку"))
    router.calls.clear()

    response = await service.answer(
        _request(message="А как с оплатой?", session_id=first.session_id)
    )

    assert response.observability["answer_source"] == "llm:p1"
    assert len(router.calls) == 1
    call = router.calls[0]
    assert "Сжатая память диалога" in call.system_prompt
    assert "Расскажи про доставку" in call.system_prompt
