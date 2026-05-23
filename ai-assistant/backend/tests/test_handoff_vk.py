from __future__ import annotations

from urllib.parse import parse_qs

import httpx

from app.services.settings_provider import (
    AssistantRuntimeSettings,
    GlobalAssistantSettings,
    TelegramHandoffRuntimeSettings,
    VkHandoffRuntimeSettings,
)
from app.services.vk_handoff import VkApiClient, VkHandoffService


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


def _transport_service(handler) -> VkHandoffService:
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return VkHandoffService(api_client=VkApiClient(client=client))


def _create_chat(client):
    response = client.post(
        "/api/v1/chat",
        json={"message": "Привет, нужен специалист по внедрению", "store_id": "default", "locale": "ru"},
    )
    assert response.status_code == 200
    return response.json()


def test_handoff_creates_vk_ticket_and_persists_ticket_metadata(client):
    sent_messages: list[dict[str, str]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/messages.send"):
            payload = {
                key: values[-1]
                for key, values in parse_qs(request.content.decode("utf-8")).items()
            }
            sent_messages.append(payload)
            return httpx.Response(200, json={"response": 654})
        raise AssertionError(f"Unexpected VK API call: {request.url}")

    client.app.state.settings_provider = _StubSettingsProvider(_snapshot())
    service = _transport_service(handler)
    client.app.state.vk_handoff_service = service

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
    assert payload["ticket"]["channel"] == "vk"
    assert payload["ticket"]["status"] == "open"
    assert "external_thread_id" not in response.text
    assert "external_root_message_id" not in response.text
    assert "2000000001" not in response.text
    assert sent_messages
    assert sent_messages[0]["peer_id"] == "2000000001"
    assert "New VK support handoff" in sent_messages[0]["message"]

    ticket = next(iter(client.app.state.repository.handoff_tickets.values()))
    ticket_token = str(ticket["handoff_id"]).replace("-", "").upper()[:8]
    assert ticket["channel"] == "vk"
    assert ticket["ticket_status"] == "open"
    assert ticket["external_chat_id"] == "2000000001"
    assert ticket["external_thread_id"] == ticket_token
    assert ticket["external_thread_title"] == f"#{ticket_token}"
    assert ticket["external_root_message_id"] == "654"
    assert ticket["failure_reason"] is None
