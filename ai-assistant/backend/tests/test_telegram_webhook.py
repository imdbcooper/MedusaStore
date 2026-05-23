from __future__ import annotations

import json
from uuid import UUID

import httpx

from app.services.settings_provider import (
    AssistantRuntimeSettings,
    GlobalAssistantSettings,
    TelegramHandoffRuntimeSettings,
)
from app.services.telegram_handoff import TelegramBotApiClient, TelegramHandoffService
from tests.conftest import portal_call


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
        "allowed_operator_ids": ["7001"],
        "allowed_admin_ids": ["9001"],
        "diagnostics": {
            "status": "ready_for_connection_test",
            "missing_fields": [],
            "can_test": True,
        },
    }
    telegram_payload.update(telegram_overrides)
    return AssistantRuntimeSettings(
        version="2026-05-23T12:00:00.000Z",
        active=None,
        fallback=[],
        global_settings=GlobalAssistantSettings(system_prompt="You are an assistant."),
        telegram_handoff=TelegramHandoffRuntimeSettings.model_validate(telegram_payload),
    )


class _StubSettingsProvider:
    def __init__(self, snapshot: AssistantRuntimeSettings) -> None:
        self.snapshot = snapshot

    async def get(self) -> AssistantRuntimeSettings:
        return self.snapshot

    async def aclose(self) -> None:
        return None


class _BrokenSettingsProvider:
    async def get(self) -> AssistantRuntimeSettings:
        raise RuntimeError("settings_unavailable")

    async def aclose(self) -> None:
        return None


def _transport_service(handler) -> TelegramHandoffService:
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return TelegramHandoffService(api_client=TelegramBotApiClient(client=client))


def _create_chat(client):
    response = client.post(
        "/api/v1/chat",
        json={"message": "Нужен специалист по внедрению", "store_id": "default", "locale": "ru"},
    )
    assert response.status_code == 200
    return response.json()


def test_telegram_webhook_requires_valid_secret(client):
    client.app.state.settings_provider = _StubSettingsProvider(_snapshot())

    response = client.post(
        "/api/v1/telegram/webhook",
        json={"update_id": 1},
        headers={"X-Telegram-Bot-Api-Secret-Token": "wrong-secret"},
    )

    assert response.status_code == 401
    assert response.json()["detail"]["error"]["code"] == "TELEGRAM_WEBHOOK_SECRET_INVALID"


def test_telegram_webhook_returns_503_when_runtime_settings_cannot_be_loaded(client):
    client.app.state.settings_provider = _BrokenSettingsProvider()

    response = client.post(
        "/api/v1/telegram/webhook",
        json={"update_id": 1},
        headers={"X-Telegram-Bot-Api-Secret-Token": "webhook-secret-5678"},
    )

    assert response.status_code == 503
    assert response.json()["detail"]["error"]["code"] == "TELEGRAM_SETTINGS_UNAVAILABLE"


def test_telegram_webhook_is_safely_ignored_when_integration_is_disabled(client):
    client.app.state.settings_provider = _StubSettingsProvider(
        _snapshot(
            enabled=False,
            diagnostics={"status": "disabled", "missing_fields": [], "can_test": False},
        )
    )

    response = client.post(
        "/api/v1/telegram/webhook",
        json={"update_id": 1},
    )

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "status": "ignored",
        "action": None,
        "handoff_id": None,
        "ticket_status": None,
        "message": "Telegram webhook ignored because the handoff integration is disabled or incomplete.",
        "reason": "disabled_or_incomplete",
        "duplicate": False,
    }


def test_telegram_webhook_delivers_operator_reply_into_scoped_history_without_leaking_internal_ids(
    client,
):
    sent_topic_messages: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content.decode("utf-8")) if request.content else {}
        if request.url.path.endswith("/sendMessage"):
            sent_topic_messages.append(body)
            return httpx.Response(
                200,
                json={"ok": True, "result": {"message_id": 778, "message_thread_id": 321}},
            )
        raise AssertionError(f"Unexpected Telegram API call: {request.url}")

    client.app.state.settings_provider = _StubSettingsProvider(_snapshot())
    service = _transport_service(handler)
    client.app.state.telegram_handoff_service = service

    try:
        chat = _create_chat(client)
        handoff = portal_call(
            client,
            client.app.state.repository.create_handoff,
            session_id=UUID(chat["session_id"]),
            message_id=UUID(chat["message_id"]),
            store_id="default",
            tenant_id=None,
            locale="ru",
            source="assistant_widget",
            email="lead@example.com",
            summary="Нужен созвон по интеграциям и SLA",
            reason="enterprise_consultation",
        )
        portal_call(
            client,
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

        payload = {
            "update_id": 9101,
            "message": {
                "message_id": 777,
                "message_thread_id": 321,
                "chat": {"id": -1001234567890},
                "from": {
                    "id": 7001,
                    "username": "operator_alex",
                    "is_bot": False,
                },
                "text": "/reply Мы подготовили предложение и пришлём детали сегодня.",
            },
        }
        response = client.post(
            "/api/v1/telegram/webhook",
            json=payload,
            headers={"X-Telegram-Bot-Api-Secret-Token": "webhook-secret-5678"},
        )
        duplicate = client.post(
            "/api/v1/telegram/webhook",
            json=payload,
            headers={"X-Telegram-Bot-Api-Secret-Token": "webhook-secret-5678"},
        )
    finally:
        client.portal.call(service.aclose)

    assert response.status_code == 200
    assert response.json()["status"] == "processed"
    assert response.json()["action"] == "reply"
    assert response.json()["ticket_status"] == "waiting_customer"

    assert duplicate.status_code == 200
    assert duplicate.json()["status"] == "duplicate"
    assert duplicate.json()["reason"] == "duplicate_update"
    assert duplicate.json()["duplicate"] is True

    assert sent_topic_messages
    assert "Ответ оператора добавлен в сессию ассистента." in str(sent_topic_messages[0]["text"])

    history = client.get(
        (
            "/api/v1/chat/history/scoped"
            f"?session_id={chat['session_id']}&store_id=default&locale=ru&limit=50"
        ),
        headers={"Authorization": "Bearer test-token"},
    )

    assert history.status_code == 200
    payload = history.json()
    assert payload["handoff_ticket"]["status"] == "waiting_customer"
    assert payload["messages"][-1]["content"] == "Мы подготовили предложение и пришлём детали сегодня."
    assert payload["messages"][-1]["intent"] == "telegram_operator_reply"
    assert payload["messages"][-1]["metadata"] == {"source": "telegram_operator"}
    assert "operator_alex" not in history.text
    assert "7001" not in history.text

    audit = portal_call(
        client,
        client.app.state.repository.get_handoff_message_by_update_id,
        telegram_update_id=9101,
    )
    assert audit is not None
    assert audit["operator_telegram_user_id"] == "7001"
    assert audit["operator_username"] == "operator_alex"
