from __future__ import annotations

from functools import partial

import httpx

from app.api.handoff import _sync_telegram_ticket
from app.services.settings_provider import (
    AssistantRuntimeSettings,
    GlobalAssistantSettings,
    TelegramHandoffRuntimeSettings,
)
from app.services.telegram_handoff import TelegramHandoffService


def _snapshot(**telegram_overrides) -> AssistantRuntimeSettings:
    telegram_payload = {
        "enabled": True,
        "environment_mode": "test",
        "bot_username": "shop_support_bot",
        "bot_token": "123456:telegram-bot-1234",
        "support_chat_id": "-1001234567890",
        "topics_required": True,
        "webhook_url": "https://example.com/api/telegram/webhook",
        "webhook_secret": "webhook-secret-5678",
        "diagnostics": {
            "status": "ready_for_connection_test",
            "missing_fields": [],
            "can_test": True,
        },
    }
    telegram_payload.update(telegram_overrides)
    return AssistantRuntimeSettings(
        version="2026-05-22T12:00:00.000Z",
        active=None,
        fallback=[],
        global_settings=GlobalAssistantSettings(system_prompt="You are an assistant."),
        telegram_handoff=TelegramHandoffRuntimeSettings.model_validate(telegram_payload),
    )


class _StubSettingsProvider:
    def __init__(self, snapshot: AssistantRuntimeSettings) -> None:
        self.snapshot = snapshot
        self.get_calls = 0

    async def get(self) -> AssistantRuntimeSettings:
        self.get_calls += 1
        return self.snapshot

    async def aclose(self) -> None:
        return None

def _transport_service(handler) -> TelegramHandoffService:
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    from app.services.telegram_handoff import TelegramBotApiClient

    return TelegramHandoffService(api_client=TelegramBotApiClient(client=client))


def _create_chat(client):
    response = client.post(
        "/api/v1/chat",
        json={"message": "Привет, нужен специалист", "store_id": "default", "locale": "ru"},
    )
    assert response.status_code == 200
    return response.json()


def test_handoff_keeps_working_when_telegram_is_disabled(client):
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        raise AssertionError("Telegram API should not be called when disabled")

    client.app.state.settings_provider = _StubSettingsProvider(
        _snapshot(
            enabled=False,
            diagnostics={"status": "disabled", "missing_fields": [], "can_test": False},
        )
    )
    service = _transport_service(handler)
    client.app.state.telegram_handoff_service = service

    try:
        chat = _create_chat(client)
        response = client.post(
            "/api/v1/handoff",
            json={
                "session_id": chat["session_id"],
                "message_id": chat["message_id"],
                "store_id": "default",
                "locale": "ru",
                "source": "assistant_widget",
                "name": "Алексей",
                "email": "lead@example.com",
                "summary": "Нужен созвон по интеграциям и SLA",
            },
        )
    finally:
        client.portal.call(service.aclose)

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "submitted"
    assert payload["ticket"]["status"] == "submitted"
    assert "disabled" in payload["ticket"]["message"].lower()
    assert calls == []
    ticket = next(iter(client.app.state.repository.handoff_tickets.values()))
    assert ticket["ticket_status"] == "submitted"


def test_handoff_keeps_working_when_telegram_is_incomplete(client):
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        raise AssertionError("Telegram API should not be called when config is incomplete")

    client.app.state.settings_provider = _StubSettingsProvider(
        _snapshot(
            support_chat_id=None,
            diagnostics={
                "status": "partially_configured",
                "missing_fields": ["support_chat_id"],
                "can_test": False,
            },
        )
    )
    service = _transport_service(handler)
    client.app.state.telegram_handoff_service = service

    try:
        chat = _create_chat(client)
        response = client.post(
            "/api/v1/handoff",
            json={
                "session_id": chat["session_id"],
                "message_id": chat["message_id"],
                "store_id": "default",
                "locale": "ru",
                "source": "assistant_widget",
                "email": "lead@example.com",
                "summary": "Нужен созвон по интеграциям и SLA",
            },
        )
    finally:
        client.portal.call(service.aclose)

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "submitted"
    assert payload["ticket"]["status"] == "submitted"
    assert "incomplete" in payload["ticket"]["message"].lower()
    assert calls == []
    ticket = next(iter(client.app.state.repository.handoff_tickets.values()))
    assert ticket["ticket_status"] == "submitted"


def test_handoff_creates_telegram_topic_and_persists_ticket_metadata(client):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/createForumTopic"):
            return httpx.Response(
                200,
                json={"ok": True, "result": {"message_thread_id": 321, "name": "#11111111 · Алексей"}},
            )
        if request.url.path.endswith("/sendMessage"):
            return httpx.Response(
                200,
                json={"ok": True, "result": {"message_id": 654, "message_thread_id": 321}},
            )
        raise AssertionError(f"Unexpected Telegram API call: {request.url}")

    client.app.state.settings_provider = _StubSettingsProvider(_snapshot())
    service = _transport_service(handler)
    client.app.state.telegram_handoff_service = service

    try:
        chat = _create_chat(client)
        response = client.post(
            "/api/v1/handoff",
            json={
                "session_id": chat["session_id"],
                "message_id": chat["message_id"],
                "store_id": "default",
                "locale": "ru",
                "source": "assistant_widget",
                "name": "Алексей",
                "email": "lead@example.com",
                "summary": "Нужен созвон по интеграциям и SLA",
                "reason": "enterprise_consultation",
                "note": "Хотим обсудить внедрение.",
            },
        )
    finally:
        client.portal.call(service.aclose)

    assert response.status_code == 200
    payload = response.json()
    assert payload["ticket"]["status"] == "open"
    assert "telegram_topic_id" not in response.text
    assert "telegram_root_message_id" not in response.text
    assert "-1001234567890" not in response.text
    ticket = next(iter(client.app.state.repository.handoff_tickets.values()))
    assert ticket["ticket_status"] == "open"
    assert ticket["telegram_chat_id"] == "-1001234567890"
    assert ticket["telegram_topic_id"] == 321
    assert ticket["telegram_root_message_id"] == 654
    assert ticket["failure_reason"] is None


def test_handoff_persists_failed_ticket_without_losing_request(client):
    token = "123456:telegram-bot-1234"

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError(f"boom {request.url}", request=request)

    client.app.state.settings_provider = _StubSettingsProvider(
        _snapshot(bot_token=token)
    )
    service = _transport_service(handler)
    client.app.state.telegram_handoff_service = service

    try:
        chat = _create_chat(client)
        response = client.post(
            "/api/v1/handoff",
            json={
                "session_id": chat["session_id"],
                "message_id": chat["message_id"],
                "store_id": "default",
                "locale": "ru",
                "source": "assistant_widget",
                "email": "lead@example.com",
                "summary": "Нужен созвон по интеграциям и SLA",
            },
        )
    finally:
        client.portal.call(service.aclose)

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "submitted"
    assert payload["ticket"]["status"] == "failed"
    assert token not in response.text
    ticket = next(iter(client.app.state.repository.handoff_tickets.values()))
    assert ticket["ticket_status"] == "failed"
    assert ticket["failure_reason"] == "Could not reach the Telegram Bot API."
    assert len(client.app.state.repository.handoffs) == 1


def test_sync_existing_open_ticket_reuses_safe_response_without_telegram_api(client):
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        raise AssertionError("Telegram API should not be called for an existing open ticket")

    provider = _StubSettingsProvider(_snapshot())
    service = _transport_service(handler)
    client.app.state.settings_provider = provider
    client.app.state.telegram_handoff_service = service

    try:
        chat = _create_chat(client)
        handoff = client.portal.call(
            partial(
                client.app.state.repository.create_handoff,
                session_id=chat["session_id"],
                message_id=chat["message_id"],
                store_id="default",
                locale="ru",
                source="assistant_widget",
                email="lead@example.com",
                summary="Нужен созвон по интеграциям и SLA",
            )
        )
        session = client.portal.call(
            partial(
                client.app.state.repository.get_session,
                session_id=handoff["session_id"],
            )
        )
        client.portal.call(
            partial(
                client.app.state.repository.upsert_handoff_ticket,
                handoff_id=handoff["id"],
                channel="telegram",
                ticket_status="open",
                telegram_chat_id="-1001234567890",
                telegram_topic_id=321,
                telegram_topic_title="#11111111 · Алексей",
                telegram_root_message_id=654,
                created_at=handoff["created_at"],
                opened_at=handoff["created_at"],
                last_sync_at=handoff["created_at"],
            )
        )

        result = client.portal.call(
            partial(
                _sync_telegram_ticket,
                repository=client.app.state.repository,
                settings_provider=provider,
                telegram_handoff_service=service,
                handoff_record=handoff,
                session=session,
            )
        )
    finally:
        client.portal.call(service.aclose)

    assert calls == []
    assert provider.get_calls == 0
    assert result.status == "open"
    assert result.channel == "telegram"
    assert result.message == "Telegram ticket already exists for this handoff."
    assert "telegram_topic_id" not in result.model_dump_json()
    ticket = next(iter(client.app.state.repository.handoff_tickets.values()))
    assert ticket["ticket_status"] == "open"
    assert ticket["telegram_chat_id"] == "-1001234567890"
    assert ticket["telegram_topic_id"] == 321
    assert ticket["telegram_root_message_id"] == 654


def test_handoff_sanitizes_unknown_telegram_failure_reason_in_storage_and_response(client):
    token = "123456:telegram-bot-1234"

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            400,
            json={
                "ok": False,
                "error_code": 400,
                "description": (
                    "Bad Request: see "
                    f"https://api.telegram.org/bot{token}/createForumTopic?secret=top-secret "
                    f"Authorization: Bearer {token}"
                ),
            },
        )

    client.app.state.settings_provider = _StubSettingsProvider(
        _snapshot(bot_token=token)
    )
    service = _transport_service(handler)
    client.app.state.telegram_handoff_service = service

    try:
        chat = _create_chat(client)
        response = client.post(
            "/api/v1/handoff",
            json={
                "session_id": chat["session_id"],
                "message_id": chat["message_id"],
                "store_id": "default",
                "locale": "ru",
                "source": "assistant_widget",
                "email": "lead@example.com",
                "summary": "Нужен созвон по интеграциям и SLA",
            },
        )
    finally:
        client.portal.call(service.aclose)

    assert response.status_code == 200
    payload = response.json()
    assert payload["ticket"]["status"] == "failed"
    assert token not in response.text
    assert "top-secret" not in response.text
    ticket = next(iter(client.app.state.repository.handoff_tickets.values()))
    assert ticket["ticket_status"] == "failed"
    assert ticket["failure_reason"] == "Telegram API error during createForumTopic."
    assert token not in str(ticket)
