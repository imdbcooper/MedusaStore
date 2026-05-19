"""Unit tests for the OpenAI-compatible LLM client and router."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import httpx
import pytest

from app.services.llm import (
    ChatMessage,
    LlmCallRequest,
    LlmRouter,
    LlmRoutingError,
    OpenAICompatibleClient,
)
from app.services.settings_provider import (
    AssistantRuntimeSettings,
    GlobalAssistantSettings,
    ProviderRuntime,
    SettingsFetchError,
    SettingsProvider,
)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _provider(
    *,
    id: str = "p1",
    name: str = "openai-prod",
    api_key: str = "sk-secret-XYZ123",
    base_url: str = "https://api.example.com/v1",
    model: str = "gpt-4o-mini",
    timeout_ms: int = 5_000,
    request_headers: dict[str, str] | None = None,
    fallback_priority: int | None = None,
    temperature: float = 0.2,
    top_p: float | None = None,
) -> ProviderRuntime:
    return ProviderRuntime(
        id=id,
        name=name,
        api_key=api_key,
        base_url=base_url,
        model=model,
        timeout_ms=timeout_ms,
        request_headers=request_headers or {},
        temperature=temperature,
        top_p=top_p,
        fallback_priority=fallback_priority,
    )


def _success_response(content: str = "Hello world", *, prompt: int = 5, comp: int = 7) -> dict[str, Any]:
    return {
        "id": "chatcmpl-1",
        "object": "chat.completion",
        "created": 0,
        "model": "gpt-4o-mini",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": prompt,
            "completion_tokens": comp,
            "total_tokens": prompt + comp,
        },
    }


class _Sleeper:
    """Records sleeps so tests can assert on backoff durations."""

    def __init__(self) -> None:
        self.calls: list[float] = []

    async def __call__(self, delay: float) -> None:
        self.calls.append(delay)


class _Clock:
    def __init__(self, start: float = 1_000.0, step: float = 0.123) -> None:
        self.now = start
        self.step = step

    def __call__(self) -> float:
        value = self.now
        self.now += self.step
        return value


def _build_client(handler) -> httpx.AsyncClient:
    transport = httpx.MockTransport(handler)
    return httpx.AsyncClient(transport=transport)


def _basic_request() -> LlmCallRequest:
    return LlmCallRequest(
        system_prompt="You are an assistant.",
        messages=[ChatMessage(role="user", content="Hi")],
        max_tokens=128,
        temperature=0.4,
        top_p=None,
        stream=False,
    )


def _runtime_settings(
    *,
    active: ProviderRuntime | None,
    fallback: list[ProviderRuntime] | None = None,
) -> AssistantRuntimeSettings:
    return AssistantRuntimeSettings(
        version="2026-05-18T00:00:00.000Z",
        active=active,
        fallback=fallback or [],
        global_settings=GlobalAssistantSettings(system_prompt="You are an assistant."),
    )


class _StubSettingsProvider:
    """Implements the bits of :class:`SettingsProvider` the router needs."""

    def __init__(self, runtime: AssistantRuntimeSettings | None = None, *, exc: Exception | None = None) -> None:
        self._runtime = runtime
        self._exc = exc
        self.calls = 0

    async def get(self) -> AssistantRuntimeSettings:
        self.calls += 1
        if self._exc is not None:
            raise self._exc
        assert self._runtime is not None
        return self._runtime


# --------------------------------------------------------------------------- #
# OpenAICompatibleClient.complete
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_complete_returns_parsed_result_for_200_response():
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["request"] = request
        return httpx.Response(200, json=_success_response("Привет"))

    transport_client = _build_client(handler)
    sleeper = _Sleeper()
    clock = _Clock(start=10.0, step=0.05)

    client = OpenAICompatibleClient(
        _provider(),
        client=transport_client,
        sleeper=sleeper,
        clock=clock,
    )
    try:
        result = await client.complete(_basic_request())
    finally:
        await client.aclose()

    assert result.content == "Привет"
    assert result.finish_reason == "stop"
    assert result.usage.prompt_tokens == 5
    assert result.usage.completion_tokens == 7
    assert result.usage.total_tokens == 12
    assert result.provider_id == "p1"
    assert result.provider_name == "openai-prod"
    assert result.model == "gpt-4o-mini"
    assert result.attempts == 1
    assert result.latency_ms >= 0
    assert sleeper.calls == []


@pytest.mark.asyncio
async def test_complete_sends_authorization_and_extra_request_headers():
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["headers"] = dict(request.headers)
        return httpx.Response(200, json=_success_response())

    transport_client = _build_client(handler)
    client = OpenAICompatibleClient(
        _provider(request_headers={"X-Org": "acme"}),
        client=transport_client,
    )
    try:
        await client.complete(_basic_request())
    finally:
        await client.aclose()

    headers = captured["headers"]
    assert headers["authorization"] == "Bearer sk-secret-XYZ123"
    assert headers["content-type"].startswith("application/json")
    assert headers["x-org"] == "acme"


@pytest.mark.asyncio
async def test_complete_body_includes_system_prompt_and_messages_in_order():
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json=_success_response())

    transport_client = _build_client(handler)
    client = OpenAICompatibleClient(_provider(), client=transport_client)
    try:
        await client.complete(
            LlmCallRequest(
                system_prompt="System rules.",
                messages=[
                    ChatMessage(role="user", content="первый"),
                    ChatMessage(role="assistant", content="ответ"),
                    ChatMessage(role="user", content="второй"),
                ],
                max_tokens=42,
                temperature=0.5,
            )
        )
    finally:
        await client.aclose()

    body = captured["body"]
    assert body["model"] == "gpt-4o-mini"
    assert body["max_tokens"] == 42
    assert body["temperature"] == 0.5
    assert body["stream"] is False
    assert body["messages"][0] == {"role": "system", "content": "System rules."}
    assert body["messages"][1] == {"role": "user", "content": "первый"}
    assert body["messages"][2] == {"role": "assistant", "content": "ответ"}
    assert body["messages"][3] == {"role": "user", "content": "второй"}


@pytest.mark.asyncio
async def test_complete_omits_top_p_when_none():
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json=_success_response())

    transport_client = _build_client(handler)
    client = OpenAICompatibleClient(_provider(), client=transport_client)
    try:
        await client.complete(_basic_request())
    finally:
        await client.aclose()

    assert "top_p" not in captured["body"]


@pytest.mark.asyncio
async def test_complete_includes_top_p_when_provided():
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json=_success_response())

    transport_client = _build_client(handler)
    client = OpenAICompatibleClient(_provider(), client=transport_client)
    try:
        req = _basic_request()
        await client.complete(req.model_copy(update={"top_p": 0.9}))
    finally:
        await client.aclose()

    assert captured["body"]["top_p"] == 0.9


@pytest.mark.asyncio
async def test_complete_retries_once_on_5xx_then_succeeds():
    responses = iter(
        [
            httpx.Response(503, json={"error": "unavailable"}),
            httpx.Response(200, json=_success_response("ok")),
        ]
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return next(responses)

    transport_client = _build_client(handler)
    sleeper = _Sleeper()
    client = OpenAICompatibleClient(
        _provider(),
        client=transport_client,
        sleeper=sleeper,
    )
    try:
        result = await client.complete(_basic_request())
    finally:
        await client.aclose()

    assert result.content == "ok"
    assert result.attempts == 2
    assert sleeper.calls == [0.5]


@pytest.mark.asyncio
async def test_complete_raises_after_retries_exhausted_on_5xx():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(502, json={"error": "bad gateway"})

    transport_client = _build_client(handler)
    sleeper = _Sleeper()
    client = OpenAICompatibleClient(
        _provider(),
        client=transport_client,
        sleeper=sleeper,
    )
    try:
        with pytest.raises(httpx.HTTPStatusError) as exc_info:
            await client.complete(_basic_request())
    finally:
        await client.aclose()

    assert exc_info.value.response.status_code == 502
    assert sleeper.calls == [0.5]


@pytest.mark.asyncio
async def test_complete_honors_retry_after_on_429():
    responses = iter(
        [
            httpx.Response(429, headers={"retry-after": "2.5"}, json={"error": "slow"}),
            httpx.Response(200, json=_success_response("after rate limit")),
        ]
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return next(responses)

    transport_client = _build_client(handler)
    sleeper = _Sleeper()
    client = OpenAICompatibleClient(
        _provider(),
        client=transport_client,
        sleeper=sleeper,
    )
    try:
        result = await client.complete(_basic_request())
    finally:
        await client.aclose()

    assert result.content == "after rate limit"
    assert sleeper.calls == [2.5]


@pytest.mark.asyncio
async def test_complete_retries_once_on_network_timeout_then_succeeds():
    state = {"first": True}

    def handler(request: httpx.Request) -> httpx.Response:
        if state["first"]:
            state["first"] = False
            raise httpx.ConnectTimeout("timed out")
        return httpx.Response(200, json=_success_response("late"))

    transport_client = _build_client(handler)
    sleeper = _Sleeper()
    client = OpenAICompatibleClient(
        _provider(),
        client=transport_client,
        sleeper=sleeper,
    )
    try:
        result = await client.complete(_basic_request())
    finally:
        await client.aclose()

    assert result.content == "late"
    assert result.attempts == 2
    assert sleeper.calls == [0.5]


@pytest.mark.asyncio
async def test_complete_does_not_retry_4xx_other_than_429():
    calls = {"count": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["count"] += 1
        return httpx.Response(401, json={"error": "unauthorized"})

    transport_client = _build_client(handler)
    sleeper = _Sleeper()
    client = OpenAICompatibleClient(
        _provider(),
        client=transport_client,
        sleeper=sleeper,
    )
    try:
        with pytest.raises(httpx.HTTPStatusError) as exc_info:
            await client.complete(_basic_request())
    finally:
        await client.aclose()

    assert exc_info.value.response.status_code == 401
    assert calls["count"] == 1
    assert sleeper.calls == []


@pytest.mark.asyncio
async def test_complete_does_not_log_api_key(caplog: pytest.LogCaptureFixture):
    state = {"first": True}

    def handler(request: httpx.Request) -> httpx.Response:
        if state["first"]:
            state["first"] = False
            return httpx.Response(503, json={"error": "x"})
        return httpx.Response(200, json=_success_response())

    transport_client = _build_client(handler)
    sleeper = _Sleeper()
    test_logger = logging.getLogger("assistant.llm.test_no_leak")
    client = OpenAICompatibleClient(
        _provider(api_key="sk-very-secret-AAA"),
        client=transport_client,
        sleeper=sleeper,
        logger=test_logger,
    )

    with caplog.at_level(logging.WARNING, logger=test_logger.name):
        try:
            await client.complete(_basic_request())
        finally:
            await client.aclose()

    aggregated = "\n".join(record.getMessage() for record in caplog.records)
    assert "sk-very-secret-AAA" not in aggregated


# --------------------------------------------------------------------------- #
# OpenAICompatibleClient.stream
# --------------------------------------------------------------------------- #


def _sse_payload(*chunks: str) -> str:
    parts = []
    for chunk in chunks:
        parts.append(chunk)
    return "".join(parts)


def _delta_chunk(content: str) -> str:
    payload = json.dumps(
        {
            "choices": [
                {"index": 0, "delta": {"content": content}, "finish_reason": None}
            ]
        }
    )
    return f"data: {payload}\n\n"


def _empty_delta_chunk() -> str:
    payload = json.dumps({"choices": [{"index": 0, "delta": {}, "finish_reason": None}]})
    return f"data: {payload}\n\n"


def _done_chunk() -> str:
    return "data: [DONE]\n\n"


@pytest.mark.asyncio
async def test_stream_yields_content_deltas_in_order():
    body = _sse_payload(_delta_chunk("Hello"), _delta_chunk(" "), _delta_chunk("world"), _done_chunk())

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"content-type": "text/event-stream"},
            content=body,
        )

    transport_client = _build_client(handler)
    client = OpenAICompatibleClient(_provider(), client=transport_client)
    try:
        iterator = await client.stream(_basic_request())
        deltas = [chunk async for chunk in iterator]
    finally:
        await client.aclose()

    assert deltas == ["Hello", " ", "world"]


@pytest.mark.asyncio
async def test_stream_terminates_cleanly_on_done():
    body = _sse_payload(_delta_chunk("only"), _done_chunk(), _delta_chunk("ignored"))

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"content-type": "text/event-stream"},
            content=body,
        )

    transport_client = _build_client(handler)
    client = OpenAICompatibleClient(_provider(), client=transport_client)
    try:
        iterator = await client.stream(_basic_request())
        deltas = [chunk async for chunk in iterator]
    finally:
        await client.aclose()

    assert deltas == ["only"]


@pytest.mark.asyncio
async def test_stream_skips_empty_delta_pings():
    body = _sse_payload(
        _empty_delta_chunk(),
        _delta_chunk("x"),
        _empty_delta_chunk(),
        _delta_chunk("y"),
        _done_chunk(),
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers={"content-type": "text/event-stream"},
            content=body,
        )

    transport_client = _build_client(handler)
    client = OpenAICompatibleClient(_provider(), client=transport_client)
    try:
        iterator = await client.stream(_basic_request())
        deltas = [chunk async for chunk in iterator]
    finally:
        await client.aclose()

    assert deltas == ["x", "y"]


# --------------------------------------------------------------------------- #
# LlmRouter.complete
# --------------------------------------------------------------------------- #


class _StubClient:
    def __init__(self, *, complete_result=None, complete_exc=None, stream_chunks=None, stream_exc=None) -> None:
        self.complete_result = complete_result
        self.complete_exc = complete_exc
        self.stream_chunks = stream_chunks
        self.stream_exc = stream_exc
        self.complete_calls = 0
        self.stream_calls = 0
        self.closed = False

    async def complete(self, req):  # noqa: ANN001
        self.complete_calls += 1
        if self.complete_exc is not None:
            raise self.complete_exc
        return self.complete_result

    async def stream(self, req):  # noqa: ANN001
        self.stream_calls += 1
        if self.stream_exc is not None:
            raise self.stream_exc

        async def gen():
            chunks = self.stream_chunks or []
            for chunk in chunks:
                if isinstance(chunk, BaseException):
                    raise chunk
                yield chunk

        return gen()

    async def aclose(self) -> None:
        self.closed = True


def _result_for(provider: ProviderRuntime, content: str = "ok", attempts: int = 1):
    from app.services.llm import LlmResult, LlmUsage

    return LlmResult(
        content=content,
        finish_reason="stop",
        usage=LlmUsage(prompt_tokens=1, completion_tokens=1, total_tokens=2),
        provider_id=provider.id,
        provider_name=provider.name,
        model=provider.model,
        latency_ms=42,
        attempts=attempts,
    )


@pytest.mark.asyncio
async def test_router_complete_uses_active_when_active_succeeds():
    active = _provider(id="active", name="active-prov")
    fallback = _provider(id="fb1", name="fb1", fallback_priority=10)
    runtime = _runtime_settings(active=active, fallback=[fallback])
    settings_provider = _StubSettingsProvider(runtime)

    factory_calls: list[ProviderRuntime] = []

    def factory(prov):
        factory_calls.append(prov)
        return _StubClient(complete_result=_result_for(prov, "primary"))

    router = LlmRouter(settings_provider, client_factory=factory)
    result = await router.complete(_basic_request())

    assert result.provider_id == "active"
    assert result.content == "primary"
    assert factory_calls == [active]


@pytest.mark.asyncio
async def test_router_complete_falls_back_when_active_fails():
    active = _provider(id="active", name="active-prov")
    fallback = _provider(id="fb1", name="fb1", fallback_priority=10)
    runtime = _runtime_settings(active=active, fallback=[fallback])
    settings_provider = _StubSettingsProvider(runtime)

    clients: list[_StubClient] = []

    def factory(prov):
        if prov.id == "active":
            client = _StubClient(complete_exc=httpx.ConnectError("dead"))
        else:
            client = _StubClient(complete_result=_result_for(prov, "secondary", attempts=2))
        clients.append(client)
        return client

    router = LlmRouter(settings_provider, client_factory=factory)
    result = await router.complete(_basic_request())

    assert result.provider_id == "fb1"
    assert result.content == "secondary"
    # Active had 1 attempt (failed), fallback had 2 → total 3.
    assert result.attempts == 3
    assert all(client.closed for client in clients)


@pytest.mark.asyncio
async def test_router_complete_raises_all_providers_failed_when_chain_exhausted():
    active = _provider(id="active", name="active-prov")
    fallback_a = _provider(id="fb1", name="fb1", fallback_priority=10)
    fallback_b = _provider(id="fb2", name="fb2", fallback_priority=20)
    runtime = _runtime_settings(active=active, fallback=[fallback_a, fallback_b])
    settings_provider = _StubSettingsProvider(runtime)

    def factory(prov):
        return _StubClient(complete_exc=httpx.ConnectError(f"down-{prov.id}"))

    router = LlmRouter(settings_provider, client_factory=factory)

    with pytest.raises(LlmRoutingError) as exc_info:
        await router.complete(_basic_request())

    err = exc_info.value
    assert err.message == "all_providers_failed"
    assert [item["provider_id"] for item in err.attempts] == ["active", "fb1", "fb2"]
    assert all("error" in item for item in err.attempts)


@pytest.mark.asyncio
async def test_router_complete_raises_settings_unavailable_on_settings_fetch_error():
    settings_provider = _StubSettingsProvider(exc=SettingsFetchError("upstream broken"))

    def factory(prov):  # pragma: no cover - never called
        raise AssertionError("factory must not be invoked when settings fail")

    router = LlmRouter(settings_provider, client_factory=factory)

    with pytest.raises(LlmRoutingError) as exc_info:
        await router.complete(_basic_request())
    assert exc_info.value.message == "settings_unavailable"
    assert exc_info.value.attempts == []


@pytest.mark.asyncio
async def test_router_complete_raises_no_providers_configured_when_chain_empty():
    runtime = _runtime_settings(active=None, fallback=[])
    settings_provider = _StubSettingsProvider(runtime)

    def factory(prov):  # pragma: no cover
        raise AssertionError("factory must not be invoked when no providers")

    router = LlmRouter(settings_provider, client_factory=factory)

    with pytest.raises(LlmRoutingError) as exc_info:
        await router.complete(_basic_request())
    assert exc_info.value.message == "no_providers_configured"


@pytest.mark.asyncio
async def test_router_complete_walks_fallback_in_provided_order():
    active = _provider(id="active", name="active-prov")
    fb_low = _provider(id="fb-low", name="fb-low", fallback_priority=10)
    fb_high = _provider(id="fb-high", name="fb-high", fallback_priority=20)
    # The settings provider already sorts fallback by priority before handing
    # the chain to the router; we mirror the post-sort order here.
    runtime = _runtime_settings(active=active, fallback=[fb_low, fb_high])
    settings_provider = _StubSettingsProvider(runtime)

    visited: list[str] = []

    def factory(prov):
        visited.append(prov.id)
        if prov.id != "fb-high":
            return _StubClient(complete_exc=httpx.ConnectError(f"x-{prov.id}"))
        return _StubClient(complete_result=_result_for(prov, "won"))

    router = LlmRouter(settings_provider, client_factory=factory)
    result = await router.complete(_basic_request())

    assert visited == ["active", "fb-low", "fb-high"]
    assert result.provider_id == "fb-high"


# --------------------------------------------------------------------------- #
# LlmRouter.stream
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_router_stream_returns_active_provider_and_iterator():
    active = _provider(id="active", name="active-prov")
    runtime = _runtime_settings(active=active, fallback=[])
    settings_provider = _StubSettingsProvider(runtime)

    def factory(prov):
        return _StubClient(stream_chunks=["a", "b", "c"])

    router = LlmRouter(settings_provider, client_factory=factory)
    chosen, iterator = await router.stream(_basic_request())
    deltas = [chunk async for chunk in iterator]

    assert chosen.id == "active"
    assert deltas == ["a", "b", "c"]


@pytest.mark.asyncio
async def test_router_stream_falls_back_when_active_fails_on_connect():
    active = _provider(id="active", name="active-prov")
    fb = _provider(id="fb1", name="fb1", fallback_priority=10)
    runtime = _runtime_settings(active=active, fallback=[fb])
    settings_provider = _StubSettingsProvider(runtime)

    def factory(prov):
        if prov.id == "active":
            return _StubClient(stream_exc=httpx.ConnectError("dead"))
        return _StubClient(stream_chunks=["from-fb"])

    router = LlmRouter(settings_provider, client_factory=factory)
    chosen, iterator = await router.stream(_basic_request())
    deltas = [chunk async for chunk in iterator]

    assert chosen.id == "fb1"
    assert deltas == ["from-fb"]


@pytest.mark.asyncio
async def test_router_stream_does_not_fallback_after_first_chunk():
    active = _provider(id="active", name="active-prov")
    fb = _provider(id="fb1", name="fb1", fallback_priority=10)
    runtime = _runtime_settings(active=active, fallback=[fb])
    settings_provider = _StubSettingsProvider(runtime)

    def factory(prov):
        if prov.id == "active":
            return _StubClient(stream_chunks=["partial", httpx.ReadError("dropped")])
        # If router incorrectly falls back, this iterator would be reached.
        return _StubClient(stream_chunks=["should-not-appear"])

    router = LlmRouter(settings_provider, client_factory=factory)
    chosen, iterator = await router.stream(_basic_request())

    collected: list[str] = []
    with pytest.raises(httpx.ReadError):
        async for chunk in iterator:
            collected.append(chunk)

    assert chosen.id == "active"
    assert collected == ["partial"]
