from __future__ import annotations

from app.services.settings_provider import (
    AssistantRuntimeSettings,
    GlobalAssistantSettings,
    TelegramHandoffRuntimeSettings,
    VkHandoffRuntimeSettings,
)
from app.services.vk_handoff import VkHandoffConnectionTestResult


def _snapshot():
    return AssistantRuntimeSettings(
        version="2026-05-23T12:00:00.000Z",
        active=None,
        fallback=[],
        active_handoff_channel="vk",
        global_settings=GlobalAssistantSettings(system_prompt="You are an assistant."),
        telegram_handoff=TelegramHandoffRuntimeSettings(),
        vk_handoff=VkHandoffRuntimeSettings(
            enabled=True,
            environment_mode="test",
            group_id="123456",
            support_peer_id="2000000001",
            webhook_url="https://example.com/api/vk/webhook",
            community_access_token="vk-community-token-1234",
            secret_key="vk-secret-5678",
            confirmation_code="vk-confirm-9012",
            diagnostics={
                "status": "ready_for_connection_test",
                "missing_fields": [],
                "can_test": True,
            },
        ),
    )


class _StubSettingsProvider:
    def __init__(self, snapshot: AssistantRuntimeSettings) -> None:
        self.snapshot = snapshot
        self.invalidate_calls = 0
        self.get_calls = 0

    async def invalidate(self) -> None:
        self.invalidate_calls += 1

    async def get(self) -> AssistantRuntimeSettings:
        self.get_calls += 1
        return self.snapshot

    async def aclose(self) -> None:
        return None


class _StubVkHandoffService:
    def __init__(self) -> None:
        self.calls = 0
        self.last_settings = None

    async def test_connection(self, settings):
        self.calls += 1
        self.last_settings = settings
        return VkHandoffConnectionTestResult(
            ok=True,
            status="dry_run_passed",
            message="VK handoff dry-run passed.",
            tested_at="2026-05-23T12:01:00.000Z",
            diagnostics=settings.diagnostics,
            group={"id": "123456", "name": "Support Group", "screen_name": "support_group"},
            webhook={
                "configured_url": "https://example.com/api/vk/webhook",
                "confirmation_code_matches": True,
            },
        )

    async def aclose(self) -> None:
        return None


def test_vk_handoff_admin_route_requires_server_side_auth(client):
    no_token = client.post("/api/v1/admin/vk/handoff/test-connection")
    assert no_token.status_code == 401

    browser = client.post(
        "/api/v1/admin/vk/handoff/test-connection",
        headers={"Authorization": "Bearer test-token", "Origin": "http://localhost:3000"},
    )
    assert browser.status_code == 403
    assert browser.json()["detail"]["error"]["code"] == "BROWSER_FORBIDDEN"


def test_vk_handoff_admin_route_refreshes_settings_and_returns_sanitized_result(client):
    provider = _StubSettingsProvider(_snapshot())
    service = _StubVkHandoffService()
    client.app.state.settings_provider = provider
    client.app.state.vk_handoff_service = service

    response = client.post(
        "/api/v1/admin/vk/handoff/test-connection",
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 200
    assert provider.invalidate_calls == 1
    assert provider.get_calls == 1
    assert service.calls == 1
    assert service.last_settings.community_access_token == "vk-community-token-1234"
    assert "vk-community-token-1234" not in response.text
    assert "vk-secret-5678" not in response.text
    assert "vk-confirm-9012" not in response.text
    payload = response.json()
    assert payload["status"] == "dry_run_passed"
    assert payload["webhook"]["configured_url"] == "https://example.com/api/vk/webhook"
