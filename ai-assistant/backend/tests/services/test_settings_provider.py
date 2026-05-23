"""Tests for the assistant settings provider (PR 5).

The provider talks to Medusa over HTTP, so all tests inject an
``httpx.AsyncClient`` backed by ``httpx.MockTransport``. Time is controlled
through a deterministic clock callable to keep tests fast and deterministic.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Callable

import httpx
import pytest

from app.services.settings_provider import (
    AssistantRuntimeSettings,
    ProviderRuntime,
    SettingsFetchError,
    SettingsProvider,
    TelegramHandoffRuntimeSettings,
    VkHandoffRuntimeSettings,
)


ENDPOINT = "http://medusa.test/internal/assistant/settings/effective"
TOKEN = "test-token"


_DEFAULT_ACTIVE: dict[str, Any] = {
    "id": "als_active",
    "name": "openai-prod",
    "base_url": "https://api.openai.com/v1",
    "api_key": "sk-real-key-1234",
    "model": "gpt-4o-mini",
    "temperature": 0.2,
    "max_tokens": 1024,
    "top_p": None,
    "timeout_ms": 30000,
    "request_headers": {"x-org": "acme"},
    "is_enabled": True,
    "is_active": True,
    "fallback_priority": None,
    "last_test_at": None,
    "last_test_ok": None,
    "last_test_latency_ms": None,
    "last_test_error": None,
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-01T00:00:00.000Z",
}

# Sentinel that lets callers explicitly request ``active: null`` while still
# defaulting to the canonical provider when the kwarg is omitted.
_UNSET: Any = object()


def _effective_payload(
    *,
    version: str = "2026-05-18T05:30:00.000Z",
    active: Any = _UNSET,
    fallback: list[dict[str, Any]] | None = None,
    global_overrides: dict[str, Any] | None = None,
    active_handoff_channel: Any = _UNSET,
    telegram_handoff: Any = _UNSET,
    vk_handoff: Any = _UNSET,
) -> dict[str, Any]:
    if active is _UNSET:
        active = dict(_DEFAULT_ACTIVE)
    if fallback is None:
        fallback = []
    global_block = {
        "id": "singleton",
        "system_prompt": "You are an assistant.",
        "retrieval_mode": "auto",
        "retrieval_top_k": 5,
        "retrieval_min_score": 0.0,
        "embedding_provider": "hashing",
        "embedding_model": None,
        "embedding_dimension": 384,
        "max_history_messages": 10,
        "max_input_chars": 4000,
        "max_output_tokens": 1024,
        "streaming_enabled": True,
        "default_locale": "ru",
        "allowed_models": [],
        "tools_enabled": {"price_lookup": True},
        "guardrails": {"prompt_injection": True},
        "rate_limits": {"chat_per_minute": 60, "chat_per_day": 1000},
        "usage_tracking_enabled": True,
        "observability": {"sentry": False, "langsmith": False},
        "active_handoff_channel": "telegram",
        "version": 1,
        "updated_by": None,
        "updated_at": "2026-01-01T00:00:00.000Z",
    }
    if global_overrides:
        global_block.update(global_overrides)
    effective: dict[str, Any] = {
        "version": version,
        "active": active,
        "fallback": fallback,
        "active_handoff_channel": (
            active_handoff_channel
            if active_handoff_channel is not _UNSET
            else global_block.get("active_handoff_channel", "telegram")
        ),
        "global": global_block,
    }
    if telegram_handoff is not _UNSET:
        effective["telegram_handoff"] = telegram_handoff
    if vk_handoff is not _UNSET:
        effective["vk_handoff"] = vk_handoff
    return {"effective": effective}


def _telegram_handoff_payload(
    **overrides: Any,
) -> dict[str, Any]:
    payload = {
        "id": "singleton",
        "enabled": False,
        "environment_mode": "test",
        "bot_username": None,
        "bot_token": None,
        "support_chat_id": None,
        "topics_required": True,
        "webhook_url": None,
        "webhook_secret": None,
        "allowed_operator_ids": [],
        "allowed_admin_ids": [],
        "operator_reply_mode": "explicit_reply_command",
        "fallback_message": "fallback",
        "diagnostics": {
            "status": "disabled",
            "missing_fields": [],
            "can_test": False,
        },
        "version": 1,
        "updated_at": "2026-01-01T00:00:00.000Z",
        "last_test_status": None,
        "last_test_error": None,
        "last_test_at": None,
    }
    payload.update(overrides)
    return payload


def _vk_handoff_payload(
    **overrides: Any,
) -> dict[str, Any]:
    payload = {
        "id": "singleton",
        "enabled": False,
        "environment_mode": "test",
        "group_id": None,
        "support_peer_id": None,
        "webhook_url": None,
        "community_access_token": None,
        "secret_key": None,
        "confirmation_code": None,
        "allowed_operator_ids": [],
        "allowed_admin_ids": [],
        "operator_reply_mode": "explicit_ticket_command",
        "fallback_message": "fallback",
        "diagnostics": {
            "status": "disabled",
            "missing_fields": [],
            "can_test": False,
        },
        "version": 1,
        "updated_at": "2026-01-01T00:00:00.000Z",
        "last_test_status": None,
        "last_test_error": None,
        "last_test_at": None,
    }
    payload.update(overrides)
    return payload


class _Counter:
    """Mutable container for counting requests inside MockTransport handlers."""

    def __init__(self) -> None:
        self.calls: int = 0
        self.requests: list[httpx.Request] = []


def _build_client(
    handler: Callable[[httpx.Request], httpx.Response],
    counter: _Counter,
) -> httpx.AsyncClient:
    def wrapped(request: httpx.Request) -> httpx.Response:
        counter.calls += 1
        counter.requests.append(request)
        return handler(request)

    transport = httpx.MockTransport(wrapped)
    return httpx.AsyncClient(transport=transport)


class _MutableClock:
    """Simple mutable clock used in place of ``time.monotonic``."""

    def __init__(self, start: float = 1000.0) -> None:
        self.now = start

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


def _make_provider(
    client: httpx.AsyncClient,
    *,
    ttl_seconds: float = 30.0,
    stale_after_seconds: float = 600.0,
    retries: int = 3,
    retry_backoff_seconds: float = 0.0,
    clock: Callable[[], float] | None = None,
    logger: logging.Logger | None = None,
) -> SettingsProvider:
    return SettingsProvider(
        endpoint=ENDPOINT,
        server_token=TOKEN,
        ttl_seconds=ttl_seconds,
        stale_after_seconds=stale_after_seconds,
        timeout_seconds=2.0,
        retries=retries,
        retry_backoff_seconds=retry_backoff_seconds,
        client=client,
        logger=logger,
        clock=clock or _MutableClock(),
    )


# ---------------------------------------------------------------------- tests


@pytest.mark.asyncio
async def test_get_first_call_performs_http_with_token_and_parses_response():
    counter = _Counter()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_effective_payload())

    client = _build_client(handler, counter)
    provider = _make_provider(client)
    try:
        snapshot = await provider.get()
    finally:
        await provider.aclose()

    assert counter.calls == 1
    request = counter.requests[0]
    assert request.headers.get("X-Assistant-Server-Token") == TOKEN
    assert request.url.path.endswith("/internal/assistant/settings/effective")

    assert isinstance(snapshot, AssistantRuntimeSettings)
    assert snapshot.version == "2026-05-18T05:30:00.000Z"
    assert snapshot.active is not None
    assert snapshot.active.id == "als_active"
    assert snapshot.active.api_key == "sk-real-key-1234"
    assert snapshot.global_settings.system_prompt == "You are an assistant."
    assert snapshot.global_settings.active_handoff_channel == "telegram"
    assert snapshot.active_handoff_channel == "telegram"
    assert snapshot.fallback == []
    assert isinstance(snapshot.telegram_handoff, TelegramHandoffRuntimeSettings)
    assert snapshot.telegram_handoff.enabled is False
    assert snapshot.telegram_handoff.diagnostics.status == "disabled"
    assert isinstance(snapshot.vk_handoff, VkHandoffRuntimeSettings)
    assert snapshot.vk_handoff.enabled is False
    assert snapshot.vk_handoff.diagnostics.status == "disabled"


@pytest.mark.asyncio
async def test_get_within_ttl_returns_cached_snapshot_without_http():
    counter = _Counter()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_effective_payload())

    client = _build_client(handler, counter)
    clock = _MutableClock()
    provider = _make_provider(client, ttl_seconds=30.0, clock=clock)
    try:
        first = await provider.get()
        clock.advance(5.0)
        second = await provider.get()
    finally:
        await provider.aclose()

    assert counter.calls == 1
    assert first.version == second.version


@pytest.mark.asyncio
async def test_get_after_ttl_expiration_triggers_new_http_call():
    counter = _Counter()
    versions = iter(["2026-05-18T05:30:00.000Z", "2026-05-18T06:30:00.000Z"])

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_effective_payload(version=next(versions)))

    client = _build_client(handler, counter)
    clock = _MutableClock()
    provider = _make_provider(client, ttl_seconds=30.0, clock=clock)
    try:
        first = await provider.get()
        clock.advance(31.0)
        second = await provider.get()
    finally:
        await provider.aclose()

    assert counter.calls == 2
    assert first.version != second.version


@pytest.mark.asyncio
async def test_concurrent_get_results_in_single_http_request():
    counter = _Counter()
    gate = asyncio.Event()
    completed = asyncio.Event()

    async def waiter() -> None:
        # Wait until the test signals that both get() calls have been queued
        # before allowing the HTTP "response" to be produced. This forces the
        # second caller to actually wait on the refresh lock instead of just
        # racing to a free transport.
        await gate.wait()

    def handler(request: httpx.Request) -> httpx.Response:
        completed.set()
        return httpx.Response(200, json=_effective_payload())

    client = _build_client(handler, counter)
    provider = _make_provider(client)

    async def call_get() -> AssistantRuntimeSettings:
        await waiter()
        return await provider.get()

    try:
        task_a = asyncio.create_task(call_get())
        task_b = asyncio.create_task(call_get())
        await asyncio.sleep(0)  # let both tasks reach the gate
        gate.set()
        results = await asyncio.gather(task_a, task_b)
    finally:
        await provider.aclose()

    assert completed.is_set()
    assert counter.calls == 1
    assert results[0].version == results[1].version


@pytest.mark.asyncio
async def test_first_fetch_network_error_raises_settings_fetch_error():
    counter = _Counter()

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    client = _build_client(handler, counter)
    provider = _make_provider(client, retries=1, retry_backoff_seconds=0.0)
    try:
        with pytest.raises(SettingsFetchError):
            await provider.get()
    finally:
        await provider.aclose()

    # Initial attempt + retries=1 -> 2 calls before giving up.
    assert counter.calls == 2


@pytest.mark.asyncio
async def test_stale_snapshot_returned_when_refresh_fails_within_window(
    caplog: pytest.LogCaptureFixture,
):
    counter = _Counter()
    behaviour: dict[str, bool] = {"fail": False}

    def handler(request: httpx.Request) -> httpx.Response:
        if behaviour["fail"]:
            raise httpx.ConnectError("upstream down")
        return httpx.Response(200, json=_effective_payload())

    client = _build_client(handler, counter)
    clock = _MutableClock()
    logger = logging.getLogger("assistant.settings.test_stale_window")
    provider = _make_provider(
        client,
        ttl_seconds=10.0,
        stale_after_seconds=120.0,
        retries=0,
        retry_backoff_seconds=0.0,
        clock=clock,
        logger=logger,
    )
    try:
        first = await provider.get()
        # TTL expired but still within the stale window.
        clock.advance(30.0)
        behaviour["fail"] = True
        with caplog.at_level(logging.WARNING, logger=logger.name):
            second = await provider.get()
    finally:
        await provider.aclose()

    assert second.version == first.version
    stale_logs = [record for record in caplog.records if "stale_used" in record.getMessage()]
    assert stale_logs, "expected at least one stale_used warning"
    assert any(record.levelno == logging.WARNING for record in stale_logs)


@pytest.mark.asyncio
async def test_stale_snapshot_dropped_after_stale_window():
    counter = _Counter()
    behaviour: dict[str, bool] = {"fail": False}

    def handler(request: httpx.Request) -> httpx.Response:
        if behaviour["fail"]:
            raise httpx.ConnectError("upstream down")
        return httpx.Response(200, json=_effective_payload())

    client = _build_client(handler, counter)
    clock = _MutableClock()
    provider = _make_provider(
        client,
        ttl_seconds=10.0,
        stale_after_seconds=60.0,
        retries=0,
        retry_backoff_seconds=0.0,
        clock=clock,
    )
    try:
        await provider.get()
        clock.advance(120.0)  # exceeds stale window
        behaviour["fail"] = True
        with pytest.raises(SettingsFetchError):
            await provider.get()
    finally:
        await provider.aclose()


@pytest.mark.asyncio
async def test_http_401_raises_without_retry():
    counter = _Counter()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "unauthorized"})

    client = _build_client(handler, counter)
    provider = _make_provider(client, retries=3, retry_backoff_seconds=0.0)
    try:
        with pytest.raises(SettingsFetchError):
            await provider.get()
    finally:
        await provider.aclose()

    assert counter.calls == 1


@pytest.mark.asyncio
async def test_http_502_then_200_succeeds_with_retry():
    counter = _Counter()
    responses = iter(
        [
            httpx.Response(502, json={"error": "bad gateway"}),
            httpx.Response(200, json=_effective_payload()),
        ]
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return next(responses)

    client = _build_client(handler, counter)
    provider = _make_provider(client, retries=3, retry_backoff_seconds=0.0)
    try:
        snapshot = await provider.get()
    finally:
        await provider.aclose()

    assert counter.calls == 2
    assert snapshot.active is not None
    assert snapshot.active.id == "als_active"


@pytest.mark.asyncio
async def test_invalidate_forces_next_get_to_perform_http():
    counter = _Counter()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_effective_payload())

    client = _build_client(handler, counter)
    clock = _MutableClock()
    provider = _make_provider(client, ttl_seconds=120.0, clock=clock)
    try:
        await provider.get()
        clock.advance(1.0)  # still inside TTL
        await provider.invalidate()
        await provider.get()
    finally:
        await provider.aclose()

    assert counter.calls == 2


@pytest.mark.asyncio
async def test_parsing_handles_active_null():
    counter = _Counter()
    payload = _effective_payload(active=None, fallback=[])

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload)

    client = _build_client(handler, counter)
    provider = _make_provider(client)
    try:
        snapshot = await provider.get()
    finally:
        await provider.aclose()

    assert snapshot.active is None
    assert snapshot.fallback == []


@pytest.mark.asyncio
async def test_fallback_resorted_by_priority_even_if_backend_shuffled():
    counter = _Counter()

    def fallback_entry(idx: int, priority: int | None) -> dict[str, Any]:
        return {
            "id": f"als_fb_{idx}",
            "name": f"fb-{idx}",
            "base_url": "https://fb.test/v1",
            "api_key": f"sk-fb-{idx}",
            "model": "gpt-4o-mini",
            "temperature": 0.2,
            "max_tokens": 1024,
            "top_p": None,
            "timeout_ms": 30000,
            "request_headers": {},
            "is_enabled": True,
            "is_active": False,
            "fallback_priority": priority,
            "last_test_at": None,
            "last_test_ok": None,
            "last_test_latency_ms": None,
            "last_test_error": None,
            "created_at": "2026-01-01T00:00:00.000Z",
            "updated_at": "2026-01-01T00:00:00.000Z",
        }

    fallback = [
        fallback_entry(3, 30),
        fallback_entry(1, 10),
        fallback_entry(4, None),  # None must end up last
        fallback_entry(2, 20),
    ]
    payload = _effective_payload(fallback=fallback)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload)

    client = _build_client(handler, counter)
    provider = _make_provider(client)
    try:
        snapshot = await provider.get()
    finally:
        await provider.aclose()

    ids = [item.id for item in snapshot.fallback]
    assert ids == ["als_fb_1", "als_fb_2", "als_fb_3", "als_fb_4"]


@pytest.mark.asyncio
async def test_safe_repr_does_not_leak_api_key():
    provider_runtime = ProviderRuntime(
        id="als_x",
        name="prod",
        base_url="https://api.openai.com/v1",
        api_key="sk-very-secret-1234",
        model="gpt-4o-mini",
    )
    rendered = provider_runtime.safe_repr()
    assert "sk-very-secret-1234" not in rendered
    assert rendered == repr(provider_runtime)
    assert rendered.endswith("key=***1234>")


@pytest.mark.asyncio
async def test_missing_telegram_handoff_section_defaults_to_disabled_runtime_settings():
    counter = _Counter()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_effective_payload())

    client = _build_client(handler, counter)
    provider = _make_provider(client)
    try:
        snapshot = await provider.get()
    finally:
        await provider.aclose()

    assert isinstance(snapshot.telegram_handoff, TelegramHandoffRuntimeSettings)
    assert snapshot.telegram_handoff.enabled is False
    assert snapshot.telegram_handoff.bot_token is None
    assert snapshot.telegram_handoff.webhook_secret is None
    assert snapshot.telegram_handoff.diagnostics.status == "disabled"
    assert snapshot.telegram_handoff.is_ready_for_connection_test is False


@pytest.mark.asyncio
async def test_missing_vk_handoff_section_defaults_to_disabled_runtime_settings():
    counter = _Counter()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_effective_payload())

    client = _build_client(handler, counter)
    provider = _make_provider(client)
    try:
        snapshot = await provider.get()
    finally:
        await provider.aclose()

    assert isinstance(snapshot.vk_handoff, VkHandoffRuntimeSettings)
    assert snapshot.vk_handoff.enabled is False
    assert snapshot.vk_handoff.group_id is None
    assert snapshot.vk_handoff.community_access_token is None
    assert snapshot.vk_handoff.secret_key is None
    assert snapshot.vk_handoff.confirmation_code is None
    assert snapshot.vk_handoff.diagnostics.status == "disabled"
    assert snapshot.vk_handoff.is_ready_for_connection_test is False


@pytest.mark.asyncio
async def test_active_handoff_channel_falls_back_to_global_setting_when_root_is_missing():
    counter = _Counter()
    payload = _effective_payload(global_overrides={"active_handoff_channel": "vk"})
    del payload["effective"]["active_handoff_channel"]

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload)

    client = _build_client(handler, counter)
    provider = _make_provider(client)
    try:
        snapshot = await provider.get()
    finally:
        await provider.aclose()

    assert snapshot.global_settings.active_handoff_channel == "vk"
    assert snapshot.active_handoff_channel == "vk"


@pytest.mark.asyncio
async def test_telegram_handoff_runtime_parses_internal_secrets_when_present():
    counter = _Counter()
    payload = _effective_payload(
        telegram_handoff=_telegram_handoff_payload(
            enabled=True,
            environment_mode="test",
            bot_username="shop_support_bot",
            bot_token="123456:telegram-bot-1234",
            support_chat_id="-1001234567890",
            topics_required=True,
            webhook_url="https://example.com/telegram/webhook",
            webhook_secret="webhook-secret-5678",
            diagnostics={
                "status": "ready_for_connection_test",
                "missing_fields": [],
                "can_test": True,
            },
            version=3,
            last_test_status="dry_run_passed",
        )
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload)

    client = _build_client(handler, counter)
    provider = _make_provider(client)
    try:
        snapshot = await provider.get()
    finally:
        await provider.aclose()

    telegram = snapshot.telegram_handoff
    assert telegram.enabled is True
    assert telegram.bot_token == "123456:telegram-bot-1234"
    assert telegram.webhook_secret == "webhook-secret-5678"
    assert telegram.is_ready_for_connection_test is True
    assert telegram.is_configured is True


@pytest.mark.asyncio
async def test_vk_handoff_runtime_parses_internal_secrets_when_present():
    counter = _Counter()
    payload = _effective_payload(
        global_overrides={"active_handoff_channel": "vk"},
        active_handoff_channel="vk",
        vk_handoff=_vk_handoff_payload(
            enabled=True,
            environment_mode="test",
            group_id="123456789",
            support_peer_id="2000000007",
            webhook_url="https://example.com/vk/webhook",
            community_access_token="vk-access-token-1234",
            secret_key="vk-secret-key-5678",
            confirmation_code="vk-confirmation-9012",
            diagnostics={
                "status": "ready_for_connection_test",
                "missing_fields": [],
                "can_test": True,
            },
            version=3,
            last_test_status="dry_run_passed",
        ),
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload)

    client = _build_client(handler, counter)
    provider = _make_provider(client)
    try:
        snapshot = await provider.get()
    finally:
        await provider.aclose()

    vk = snapshot.vk_handoff
    assert snapshot.active_handoff_channel == "vk"
    assert vk.enabled is True
    assert vk.community_access_token == "vk-access-token-1234"
    assert vk.secret_key == "vk-secret-key-5678"
    assert vk.confirmation_code == "vk-confirmation-9012"
    assert vk.is_ready_for_connection_test is True
    assert vk.is_configured is True


@pytest.mark.asyncio
async def test_telegram_handoff_runtime_handles_incomplete_config_without_failing():
    counter = _Counter()
    payload = _effective_payload(
        telegram_handoff=_telegram_handoff_payload(
            enabled=True,
            environment_mode="production",
            diagnostics={
                "status": "partially_configured",
                "missing_fields": [
                    "bot_token",
                    "webhook_secret",
                    "support_chat_id",
                    "webhook_url",
                    "allowed_operator_ids_or_allowed_admin_ids",
                ],
                "can_test": False,
            },
            version=4,
            last_test_status="missing_credentials",
            last_test_error="Missing required Telegram handoff configuration",
        )
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload)

    client = _build_client(handler, counter)
    provider = _make_provider(client)
    try:
        snapshot = await provider.get()
    finally:
        await provider.aclose()

    telegram = snapshot.telegram_handoff
    assert telegram.enabled is True
    assert telegram.bot_token is None
    assert telegram.support_chat_id is None
    assert telegram.diagnostics.status == "partially_configured"
    assert telegram.diagnostics.can_test is False
    assert telegram.is_ready_for_connection_test is False
    assert telegram.is_configured is False
    assert telegram.allowed_operator_user_ids == ()


@pytest.mark.asyncio
async def test_vk_handoff_runtime_handles_incomplete_config_without_failing():
    counter = _Counter()
    payload = _effective_payload(
        global_overrides={"active_handoff_channel": "vk"},
        active_handoff_channel="vk",
        vk_handoff=_vk_handoff_payload(
            enabled=True,
            environment_mode="production",
            group_id="123456789",
            diagnostics={
                "status": "partially_configured",
                "missing_fields": [
                    "community_access_token",
                    "secret_key",
                    "confirmation_code",
                    "support_peer_id",
                    "webhook_url",
                    "allowed_operator_ids_or_allowed_admin_ids",
                ],
                "can_test": False,
            },
            version=4,
            last_test_status="missing_credentials",
            last_test_error="Missing required VK handoff configuration",
        ),
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload)

    client = _build_client(handler, counter)
    provider = _make_provider(client)
    try:
        snapshot = await provider.get()
    finally:
        await provider.aclose()

    vk = snapshot.vk_handoff
    assert vk.enabled is True
    assert vk.community_access_token is None
    assert vk.secret_key is None
    assert vk.confirmation_code is None
    assert vk.support_peer_id is None
    assert vk.diagnostics.status == "partially_configured"
    assert vk.diagnostics.can_test is False
    assert vk.is_ready_for_connection_test is False
    assert vk.is_configured is False
    assert vk.allowed_operator_user_ids == ()


@pytest.mark.asyncio
async def test_telegram_handoff_safe_repr_does_not_leak_internal_secrets():
    telegram = TelegramHandoffRuntimeSettings(
        enabled=True,
        environment_mode="test",
        bot_username="shop_support_bot",
        bot_token="123456:telegram-bot-1234",
        support_chat_id="-1001234567890",
        topics_required=True,
        webhook_url="https://example.com/telegram/webhook",
        webhook_secret="webhook-secret-5678",
        diagnostics={
            "status": "ready_for_connection_test",
            "missing_fields": [],
            "can_test": True,
        },
    )

    rendered = telegram.safe_repr()
    assert "123456:telegram-bot-1234" not in rendered
    assert "webhook-secret-5678" not in rendered
    assert rendered == repr(telegram)
    assert "***1234" in rendered
    assert "***5678" in rendered


@pytest.mark.asyncio
async def test_vk_handoff_safe_repr_does_not_leak_internal_secrets():
    vk = VkHandoffRuntimeSettings(
        enabled=True,
        environment_mode="test",
        group_id="123456789",
        support_peer_id="2000000007",
        webhook_url="https://example.com/vk/webhook",
        community_access_token="vk-access-token-1234",
        secret_key="vk-secret-key-5678",
        confirmation_code="vk-confirmation-9012",
        diagnostics={
            "status": "ready_for_connection_test",
            "missing_fields": [],
            "can_test": True,
        },
    )

    rendered = vk.safe_repr()
    assert "vk-access-token-1234" not in rendered
    assert "vk-secret-key-5678" not in rendered
    assert "vk-confirmation-9012" not in rendered
    assert rendered == repr(vk)
    assert "***1234" in rendered
    assert "***5678" in rendered
    assert "***9012" in rendered


@pytest.mark.asyncio
async def test_stale_used_warning_is_structured(
    caplog: pytest.LogCaptureFixture,
):
    counter = _Counter()
    behaviour: dict[str, bool] = {"fail": False}

    def handler(request: httpx.Request) -> httpx.Response:
        if behaviour["fail"]:
            raise httpx.ConnectError("upstream down")
        return httpx.Response(200, json=_effective_payload())

    client = _build_client(handler, counter)
    clock = _MutableClock()
    logger = logging.getLogger("assistant.settings.test_warning_payload")
    provider = _make_provider(
        client,
        ttl_seconds=5.0,
        stale_after_seconds=600.0,
        retries=0,
        retry_backoff_seconds=0.0,
        clock=clock,
        logger=logger,
    )
    try:
        await provider.get()
        clock.advance(30.0)
        behaviour["fail"] = True
        with caplog.at_level(logging.WARNING, logger=logger.name):
            await provider.get()
    finally:
        await provider.aclose()

    warning_payloads: list[dict[str, Any]] = []
    for record in caplog.records:
        if record.name != logger.name or record.levelno != logging.WARNING:
            continue
        try:
            parsed = json.loads(record.getMessage())
        except json.JSONDecodeError:
            continue
        if parsed.get("event") == "assistant.settings.stale_used":
            warning_payloads.append(parsed)

    assert warning_payloads, "structured stale_used warning was not emitted"
    payload = warning_payloads[-1]
    assert payload["active_provider_id"] == "als_active"
    assert "version" in payload
    # No raw api_key keys must appear anywhere in the structured payload.
    flattened = json.dumps(payload)
    assert "sk-real-key-1234" not in flattened


@pytest.mark.asyncio
async def test_aclose_is_idempotent_for_owned_client():
    counter = _Counter()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_effective_payload())

    client = _build_client(handler, counter)
    provider = _make_provider(client)
    await provider.get()
    await provider.aclose()
    await provider.aclose()  # must not raise
