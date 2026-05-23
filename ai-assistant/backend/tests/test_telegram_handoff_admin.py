from __future__ import annotations

from app.services.settings_provider import AssistantRuntimeSettings, GlobalAssistantSettings
from app.services.telegram_handoff import TelegramHandoffConnectionTestResult


def _snapshot():
    from app.services.settings_provider import TelegramHandoffRuntimeSettings

    return AssistantRuntimeSettings(
        version="2026-05-22T12:00:00.000Z",
        active=None,
        fallback=[],
        global_settings=GlobalAssistantSettings(system_prompt="You are an assistant."),
        telegram_handoff=TelegramHandoffRuntimeSettings(
            enabled=True,
            environment_mode="test",
            bot_username="shop_support_bot",
            bot_token="123456:telegram-bot-1234",
            support_chat_id="-1001234567890",
            topics_required=True,
            webhook_url="https://example.com/api/telegram/webhook",
            webhook_secret="webhook-secret-5678",
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


class _StubTelegramHandoffService:
    def __init__(self) -> None:
        self.calls = 0
        self.last_settings = None

    async def test_connection(self, settings):
        self.calls += 1
        self.last_settings = settings
        return TelegramHandoffConnectionTestResult(
            ok=True,
            status="connection_ok",
            message="Telegram connection test passed.",
            tested_at="2026-05-22T12:01:00.000Z",
            diagnostics=settings.diagnostics,
            bot={"id": 777000, "username": "shop_support_bot"},
            support_chat={
                "id": "-1001234567890",
                "type": "supergroup",
                "title": "Support Operators",
                "is_forum": True,
            },
            bot_membership={
                "status": "administrator",
                "can_manage_topics": True,
                "can_delete_messages": True,
            },
            webhook={
                "configured_url": "https://example.com/api/telegram/webhook",
                "actual_url": "https://example.com/api/telegram/webhook",
                "pending_update_count": 0,
            },
        )

    async def aclose(self) -> None:
        return None


def test_telegram_handoff_admin_route_requires_server_side_auth(client):
    no_token = client.post("/api/v1/admin/telegram/handoff/test-connection")
    assert no_token.status_code == 401

    browser = client.post(
        "/api/v1/admin/telegram/handoff/test-connection",
        headers={"Authorization": "Bearer test-token", "Origin": "http://localhost:3000"},
    )
    assert browser.status_code == 403
    assert browser.json()["detail"]["error"]["code"] == "BROWSER_FORBIDDEN"


def test_telegram_handoff_admin_route_refreshes_settings_and_returns_sanitized_result(client):
    provider = _StubSettingsProvider(_snapshot())
    service = _StubTelegramHandoffService()
    client.app.state.settings_provider = provider
    client.app.state.telegram_handoff_service = service

    response = client.post(
        "/api/v1/admin/telegram/handoff/test-connection",
        headers={"Authorization": "Bearer test-token"},
    )

    assert response.status_code == 200
    assert provider.invalidate_calls == 1
    assert provider.get_calls == 1
    assert service.calls == 1
    assert service.last_settings.bot_token == "123456:telegram-bot-1234"
    assert "123456:telegram-bot-1234" not in response.text
    assert "webhook-secret-5678" not in response.text
    payload = response.json()
    assert payload["status"] == "connection_ok"
    assert payload["webhook"]["actual_url"] == "https://example.com/api/telegram/webhook"


def test_telegram_handoff_admin_route_accepts_server_token_fallback(client):
    client.app.state.settings.api_token = None
    client.app.state.settings.ai_assistant_server_token = "bridge-token"
    client.app.state.settings_provider = _StubSettingsProvider(_snapshot())
    client.app.state.telegram_handoff_service = _StubTelegramHandoffService()

    response = client.post(
        "/api/v1/admin/telegram/handoff/test-connection",
        headers={"Authorization": "Bearer bridge-token"},
    )

    assert response.status_code == 200
