from __future__ import annotations

from urllib.parse import parse_qs
from uuid import UUID

import httpx

from app.services.settings_provider import (
    AssistantRuntimeSettings,
    GlobalAssistantSettings,
    TelegramHandoffRuntimeSettings,
    VkHandoffRuntimeSettings,
)
from app.services.vk_handoff import VkApiClient, VkHandoffService
from tests.conftest import portal_call


def _snapshot(**vk_overrides) -> AssistantRuntimeSettings:
    vk_payload = {
        "enabled": True,
        "environment_mode": "test",
        "group_id": "123456",
        "support_peer_id": "2000000001",
        "webhook_url": "https://example.com/api/vk/webhook",
        "community_access_token": "vk-community-token-1234",
        "secret_key": "vk-secret-5678",
        "confirmation_code": "vk-confirm-9012",
        "allowed_operator_ids": ["7001"],
        "allowed_admin_ids": ["9001"],
        "diagnostics": {
            "status": "ready_for_connection_test",
            "missing_fields": [],
            "can_test": True,
        },
    }
    vk_payload.update(vk_overrides)
    return AssistantRuntimeSettings(
        version="2026-05-23T12:00:00.000Z",
        active=None,
        fallback=[],
        active_handoff_channel="vk",
        global_settings=GlobalAssistantSettings(system_prompt="You are an assistant."),
        telegram_handoff=TelegramHandoffRuntimeSettings(),
        vk_handoff=VkHandoffRuntimeSettings.model_validate(vk_payload),
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


def _transport_service(handler) -> VkHandoffService:
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return VkHandoffService(api_client=VkApiClient(client=client))


def _create_chat(client):
    response = client.post(
        "/api/v1/chat",
        json={"message": "Нужен специалист по внедрению", "store_id": "default", "locale": "ru"},
    )
    assert response.status_code == 200
    return response.json()


def _ticket_token(value) -> str:
    return str(value).replace("-", "").upper()[:8]


def test_vk_webhook_returns_confirmation_code(client):
    client.app.state.settings_provider = _StubSettingsProvider(_snapshot())

    response = client.post(
        "/api/v1/vk/webhook",
        json={"type": "confirmation", "group_id": 123456, "secret": "vk-secret-5678"},
    )

    assert response.status_code == 200
    assert response.text == "vk-confirm-9012"


def test_vk_webhook_does_not_leak_confirmation_code_when_group_id_mismatches(client):
    client.app.state.settings_provider = _StubSettingsProvider(_snapshot())

    response = client.post(
        "/api/v1/vk/webhook",
        json={"type": "confirmation", "group_id": 999999, "secret": "vk-secret-5678"},
    )

    assert response.status_code == 200
    assert response.text == "ok"


def test_vk_webhook_requires_valid_secret(client):
    client.app.state.settings_provider = _StubSettingsProvider(_snapshot())

    response = client.post(
        "/api/v1/vk/webhook",
        json={
            "type": "message_new",
            "secret": "wrong-secret",
            "object": {
                "message": {
                    "id": 1,
                    "peer_id": 2000000001,
                    "from_id": 7001,
                    "text": "/status ABCD1234",
                }
            },
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"]["error"]["code"] == "VK_WEBHOOK_SECRET_INVALID"


def test_vk_webhook_returns_503_when_runtime_settings_cannot_be_loaded(client):
    client.app.state.settings_provider = _BrokenSettingsProvider()

    response = client.post(
        "/api/v1/vk/webhook",
        json={"type": "message_new", "secret": "vk-secret-5678"},
    )

    assert response.status_code == 503
    assert response.json()["detail"]["error"]["code"] == "VK_SETTINGS_UNAVAILABLE"


def test_vk_webhook_duplicate_plain_message_sends_help_hint_only_once(client):
    sent_messages: list[dict[str, str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/messages.send"):
            payload = {
                key: values[-1]
                for key, values in parse_qs(request.content.decode("utf-8")).items()
            }
            sent_messages.append(payload)
            return httpx.Response(200, json={"response": 778})
        raise AssertionError(f"Unexpected VK API call: {request.url}")

    client.app.state.settings_provider = _StubSettingsProvider(_snapshot())
    service = _transport_service(handler)
    client.app.state.vk_handoff_service = service

    try:
        payload = {
            "type": "message_new",
            "secret": "vk-secret-5678",
            "group_id": 123456,
            "object": {
                "message": {
                    "id": 101,
                    "peer_id": 2000000001,
                    "from_id": 7001,
                    "text": "Привет, нужен человек",
                }
            },
        }
        response = client.post("/api/v1/vk/webhook", json=payload)
        duplicate = client.post("/api/v1/vk/webhook", json=payload)
    finally:
        client.portal.call(service.aclose)

    assert response.status_code == 200
    assert response.text == "ok"
    assert duplicate.status_code == 200
    assert duplicate.text == "ok"
    assert len(sent_messages) == 1
    assert "Используйте /status <ticket_id>" in sent_messages[0]["message"]
    assert len(client.app.state.repository.external_webhook_receipts) == 1


def test_vk_webhook_duplicate_command_without_ticket_id_sends_hint_only_once(client):
    sent_messages: list[dict[str, str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/messages.send"):
            payload = {
                key: values[-1]
                for key, values in parse_qs(request.content.decode("utf-8")).items()
            }
            sent_messages.append(payload)
            return httpx.Response(200, json={"response": 779})
        raise AssertionError(f"Unexpected VK API call: {request.url}")

    client.app.state.settings_provider = _StubSettingsProvider(_snapshot())
    service = _transport_service(handler)
    client.app.state.vk_handoff_service = service

    try:
        payload = {
            "type": "message_new",
            "secret": "vk-secret-5678",
            "group_id": 123456,
            "object": {
                "message": {
                    "id": 102,
                    "peer_id": 2000000001,
                    "from_id": 7001,
                    "text": "/reply",
                }
            },
        }
        response = client.post("/api/v1/vk/webhook", json=payload)
        duplicate = client.post("/api/v1/vk/webhook", json=payload)
    finally:
        client.portal.call(service.aclose)

    assert response.status_code == 200
    assert response.text == "ok"
    assert duplicate.status_code == 200
    assert duplicate.text == "ok"
    assert len(sent_messages) == 1
    assert "Укажите ticket id после команды" in sent_messages[0]["message"]
    assert len(client.app.state.repository.external_webhook_receipts) == 1


def test_vk_webhook_delivers_operator_reply_into_scoped_history_without_leaking_internal_ids(
    client,
):
    sent_messages: list[dict[str, str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/messages.send"):
            payload = {
                key: values[-1]
                for key, values in parse_qs(request.content.decode("utf-8")).items()
            }
            sent_messages.append(payload)
            return httpx.Response(200, json={"response": 778})
        raise AssertionError(f"Unexpected VK API call: {request.url}")

    client.app.state.settings_provider = _StubSettingsProvider(_snapshot())
    service = _transport_service(handler)
    client.app.state.vk_handoff_service = service

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
        ticket_token = _ticket_token(handoff["id"])
        portal_call(
            client,
            client.app.state.repository.upsert_handoff_ticket,
            handoff_id=handoff["id"],
            channel="vk",
            ticket_status="open",
            external_chat_id="2000000001",
            external_thread_id=ticket_token,
            external_thread_title=f"#{ticket_token}",
            external_root_message_id="654",
            created_at=handoff["created_at"],
            opened_at=handoff["created_at"],
            last_sync_at=handoff["created_at"],
        )

        payload = {
            "type": "message_new",
            "secret": "vk-secret-5678",
            "group_id": 123456,
            "object": {
                "message": {
                    "id": 777,
                    "peer_id": 2000000001,
                    "from_id": 7001,
                    "text": f"/reply {ticket_token} Мы подготовили предложение и пришлём детали сегодня.",
                }
            },
        }
        response = client.post("/api/v1/vk/webhook", json=payload)
        duplicate = client.post("/api/v1/vk/webhook", json=payload)
    finally:
        client.portal.call(service.aclose)

    assert response.status_code == 200
    assert response.text == "ok"
    assert duplicate.status_code == 200
    assert duplicate.text == "ok"

    assert len(sent_messages) == 1
    assert "Ответ оператора добавлен в сессию ассистента." in sent_messages[0]["message"]

    history = client.get(
        (
            "/api/v1/chat/history/scoped"
            f"?session_id={chat['session_id']}&store_id=default&locale=ru&limit=50"
        ),
        headers={"Authorization": "Bearer test-token"},
    )

    assert history.status_code == 200
    payload = history.json()
    assert payload["handoff_ticket"]["channel"] == "vk"
    assert payload["handoff_ticket"]["status"] == "waiting_customer"
    assert payload["messages"][-1]["content"] == "Мы подготовили предложение и пришлём детали сегодня."
    assert payload["messages"][-1]["intent"] == "vk_operator_reply"
    assert payload["messages"][-1]["metadata"] == {"source": "vk_operator"}
    assert "7001" not in history.text

    audit = portal_call(
        client,
        client.app.state.repository.get_handoff_message_by_external_event_id,
        channel="vk",
        external_event_id="777",
    )
    assert audit is not None
    assert audit["operator_external_user_id"] == "7001"
