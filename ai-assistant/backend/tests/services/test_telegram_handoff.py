from __future__ import annotations

import asyncio
import json
import logging

import httpx
import pytest

from app.services.settings_provider import TelegramHandoffRuntimeSettings
from app.services.telegram_handoff import (
    TelegramBotApiClient,
    TelegramBotApiError,
    TelegramHandoffService,
)


def _settings(**overrides) -> TelegramHandoffRuntimeSettings:
    payload = {
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
    payload.update(overrides)
    return TelegramHandoffRuntimeSettings.model_validate(payload)


def _client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def _handoff(**overrides):
    payload = {
        "id": "11111111-1111-4111-8111-111111111111",
        "session_id": "22222222-2222-4222-8222-222222222222",
        "store_id": "default",
        "tenant_id": "tenant-a",
        "locale": "ru",
        "source": "assistant_widget",
        "name": "Алексей",
        "email": "lead@example.com",
        "phone": "+7 999 123-45-67",
        "summary": "Нужен созвон по интеграциям и SLA",
        "reason": "enterprise_consultation",
        "note": "Хотим обсудить внедрение и сроки.",
        "metadata": {"telegram_username": "alex_support"},
    }
    payload.update(overrides)
    return payload


def _session(**overrides):
    payload = {
        "id": "22222222-2222-4222-8222-222222222222",
        "customer_id": "cus_123",
        "store_id": "default",
        "tenant_id": "tenant-a",
        "locale": "ru",
    }
    payload.update(overrides)
    return payload


async def _seed_repository_ticket(
    repository,
    *,
    ticket_status: str = "open",
    assigned_operator_id: str | None = None,
    assigned_operator_username: str | None = None,
):
    session = await repository.ensure_session(
        session_id=None,
        store_id="default",
        locale="ru",
    )
    assistant_message = await repository.add_message(
        session_id=session["id"],
        role="assistant",
        content="Могу передать запрос специалисту.",
    )
    handoff = await repository.create_handoff(
        session_id=session["id"],
        message_id=assistant_message["id"],
        store_id="default",
        tenant_id="tenant-a",
        locale="ru",
        source="assistant_widget",
        name="Алексей",
        email="lead@example.com",
        summary="Нужен созвон по интеграциям и SLA",
        reason="enterprise_consultation",
    )
    await repository.upsert_handoff_ticket(
        handoff_id=handoff["id"],
        channel="telegram",
        ticket_status=ticket_status,
        telegram_chat_id="-1001234567890",
        telegram_topic_id=321,
        telegram_topic_title="#11111111 · Алексей",
        telegram_root_message_id=654,
        assigned_operator_id=assigned_operator_id,
        assigned_operator_username=assigned_operator_username,
        assigned_at=handoff["created_at"] if assigned_operator_id else None,
        created_at=handoff["created_at"],
        opened_at=handoff["created_at"],
        last_sync_at=handoff["created_at"],
    )
    return session, handoff


@pytest.mark.asyncio
async def test_service_returns_missing_credentials_without_contacting_telegram():
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        return httpx.Response(500, json={"ok": False})

    service = TelegramHandoffService(api_client=service_api_client(handler))
    try:
        result = await service.test_connection(
            _settings(
                bot_token=None,
                diagnostics={
                    "status": "partially_configured",
                    "missing_fields": ["bot_token"],
                    "can_test": False,
                },
            )
        )
    finally:
        await service.aclose()

    assert result.ok is False
    assert result.status == "missing_credentials"
    assert result.missing_fields == ["bot_token"]
    assert calls == []


@pytest.mark.asyncio
async def test_service_returns_connection_ok_for_forum_supergroup():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/getMe"):
            return httpx.Response(
                200,
                json={
                    "ok": True,
                    "result": {
                        "id": 777000,
                        "is_bot": True,
                        "username": "shop_support_bot",
                        "first_name": "Shop Support",
                    },
                },
            )
        if request.url.path.endswith("/getChat"):
            return httpx.Response(
                200,
                json={
                    "ok": True,
                    "result": {
                        "id": -1001234567890,
                        "type": "supergroup",
                        "title": "Support Operators",
                        "is_forum": True,
                    },
                },
            )
        if request.url.path.endswith("/getChatMember"):
            return httpx.Response(
                200,
                json={
                    "ok": True,
                    "result": {
                        "status": "administrator",
                        "can_manage_topics": True,
                        "can_delete_messages": True,
                    },
                },
            )
        if request.url.path.endswith("/getWebhookInfo"):
            return httpx.Response(
                200,
                json={
                    "ok": True,
                    "result": {
                        "url": "https://example.com/api/telegram/webhook",
                        "pending_update_count": 0,
                    },
                },
            )
        if request.url.path.endswith("/createForumTopic"):
            return httpx.Response(
                200,
                json={
                    "ok": True,
                    "result": {
                        "message_thread_id": 321,
                        "name": "[TEST] Handoff smoke",
                    },
                },
            )
        if request.url.path.endswith("/sendMessage"):
            return httpx.Response(
                200,
                json={
                    "ok": True,
                    "result": {
                        "message_id": 654,
                        "message_thread_id": 321,
                    },
                },
            )
        if request.url.path.endswith("/deleteForumTopic"):
            return httpx.Response(200, json={"ok": True, "result": True})
        raise AssertionError(f"Unexpected Telegram API call: {request.url}")

    service = TelegramHandoffService(api_client=service_api_client(handler))
    try:
        result = await service.test_connection(_settings())
    finally:
        await service.aclose()

    assert result.ok is True
    assert result.status == "connection_ok"
    assert result.bot is not None
    assert result.bot.username == "shop_support_bot"
    assert result.support_chat is not None
    assert result.support_chat.type == "supergroup"
    assert result.support_chat.is_forum is True
    assert result.bot_membership is not None
    assert result.bot_membership.can_manage_topics is True
    assert result.webhook is not None
    assert result.webhook.actual_url == "https://example.com/api/telegram/webhook"
    assert result.warnings == []


@pytest.mark.asyncio
async def test_service_fails_when_support_chat_is_not_a_forum():
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        if request.url.path.endswith("/getMe"):
            return httpx.Response(
                200,
                json={"ok": True, "result": {"id": 777000, "username": "shop_support_bot"}},
            )
        if request.url.path.endswith("/getChat"):
            return httpx.Response(
                200,
                json={
                    "ok": True,
                    "result": {
                        "id": -1001234567890,
                        "type": "supergroup",
                        "title": "Support Operators",
                        "is_forum": False,
                    },
                },
            )
        raise AssertionError(f"Unexpected Telegram API call: {request.url}")

    service = TelegramHandoffService(api_client=service_api_client(handler))
    try:
        result = await service.test_connection(_settings())
    finally:
        await service.aclose()

    assert result.ok is False
    assert result.status == "connection_failed"
    assert "Topics / Forum enabled" in result.message
    assert calls == ["/bot123456:telegram-bot-1234/getMe", "/bot123456:telegram-bot-1234/getChat"]


@pytest.mark.asyncio
async def test_service_redacts_bot_token_from_logs_on_network_error(
    caplog: pytest.LogCaptureFixture,
):
    token = "123456:telegram-bot-1234"

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError(f"boom {request.url}", request=request)

    logger = logging.getLogger("assistant.telegram_handoff.test_redaction")
    service = TelegramHandoffService(
        api_client=service_api_client(handler),
        logger=logger,
    )
    caplog.set_level(logging.WARNING, logger=logger.name)
    try:
        result = await service.test_connection(_settings(bot_token=token))
    finally:
        await service.aclose()

    assert result.ok is False
    assert result.status == "connection_failed"
    assert result.message == "Could not reach the Telegram Bot API."
    assert token not in caplog.text
    assert "[REDACTED]" in caplog.text


@pytest.mark.asyncio
async def test_bot_api_client_creates_forum_topic():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/createForumTopic")
        assert json.loads(request.content.decode("utf-8")) == {
            "chat_id": "-1001234567890",
            "name": "Topic title",
        }
        return httpx.Response(
            200,
            json={
                "ok": True,
                "result": {"message_thread_id": 9001, "name": "Topic title"},
            },
        )

    client = service_api_client(handler)
    try:
        result = await client.create_forum_topic(
            "123456:telegram-bot-1234",
            "-1001234567890",
            "Topic title",
        )
    finally:
        await client.aclose()

    assert result["message_thread_id"] == 9001
    assert result["name"] == "Topic title"


@pytest.mark.asyncio
async def test_bot_api_client_sends_message_to_topic():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/sendMessage")
        assert json.loads(request.content.decode("utf-8")) == {
            "chat_id": "-1001234567890",
            "text": "hello",
            "message_thread_id": 321,
            "reply_markup": {
                "inline_keyboard": [[{"text": "Status", "callback_data": "ht:status:abc"}]]
            },
        }
        return httpx.Response(
            200,
            json={
                "ok": True,
                "result": {"message_id": 42, "message_thread_id": 321},
            },
        )

    client = service_api_client(handler)
    try:
        result = await client.send_message(
            "123456:telegram-bot-1234",
            "-1001234567890",
            "hello",
            message_thread_id=321,
            reply_markup={
                "inline_keyboard": [[{"text": "Status", "callback_data": "ht:status:abc"}]]
            },
        )
    finally:
        await client.aclose()

    assert result["message_id"] == 42


@pytest.mark.asyncio
async def test_bot_api_client_redacts_token_from_network_error():
    token = "123456:telegram-bot-1234"

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError(f"boom {request.url}", request=request)

    client = service_api_client(handler)
    try:
        with pytest.raises(TelegramBotApiError) as exc_info:
            await client.create_forum_topic(
                token,
                "-1001234567890",
                "Topic title",
            )
    finally:
        await client.aclose()

    assert token not in (exc_info.value.detail or "")
    assert "[REDACTED]" in (exc_info.value.detail or "")


@pytest.mark.asyncio
async def test_service_connection_test_warns_when_smoke_cleanup_is_skipped():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/getMe"):
            return httpx.Response(
                200,
                json={"ok": True, "result": {"id": 777000, "username": "shop_support_bot"}},
            )
        if request.url.path.endswith("/getChat"):
            return httpx.Response(
                200,
                json={
                    "ok": True,
                    "result": {
                        "id": -1001234567890,
                        "type": "supergroup",
                        "title": "Support Operators",
                        "is_forum": True,
                    },
                },
            )
        if request.url.path.endswith("/getChatMember"):
            return httpx.Response(
                200,
                json={
                    "ok": True,
                    "result": {
                        "status": "administrator",
                        "can_manage_topics": True,
                        "can_delete_messages": False,
                    },
                },
            )
        if request.url.path.endswith("/getWebhookInfo"):
            return httpx.Response(
                200,
                json={
                    "ok": True,
                    "result": {"url": "https://example.com/api/telegram/webhook"},
                },
            )
        raise AssertionError(f"Unexpected Telegram API call: {request.url}")

    service = TelegramHandoffService(api_client=service_api_client(handler))
    try:
        result = await service.test_connection(_settings())
    finally:
        await service.aclose()

    assert result.ok is True
    assert result.status == "connection_ok"
    assert result.message == "Telegram connection test passed with warnings."
    assert result.warnings == [
        "Topic-specific smoke test was skipped because the bot cannot delete forum topics for cleanup."
    ]


@pytest.mark.asyncio
async def test_service_dispatch_opens_new_topic_and_sends_card():
    send_payloads: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content.decode("utf-8")) if request.content else {}
        if request.url.path.endswith("/createForumTopic"):
            assert body["chat_id"] == "-1001234567890"
            assert isinstance(body["name"], str)
            assert body["name"].startswith("#11111111")
            return httpx.Response(
                200,
                json={"ok": True, "result": {"message_thread_id": 321, "name": body["name"]}},
            )
        if request.url.path.endswith("/sendMessage"):
            send_payloads.append(body)
            return httpx.Response(
                200,
                json={"ok": True, "result": {"message_id": 654, "message_thread_id": 321}},
            )
        raise AssertionError(f"Unexpected Telegram API call: {request.url}")

    service = TelegramHandoffService(api_client=service_api_client(handler))
    try:
        result = await service.dispatch_handoff(
            settings=_settings(),
            handoff=_handoff(),
            session=_session(),
            transcript=[
                {"role": "user", "content": "Нам нужна помощь с интеграцией ERP."},
                {"role": "assistant", "content": "Могу передать запрос специалисту."},
            ],
            existing_ticket=None,
        )
    finally:
        await service.aclose()

    assert result.ticket_status == "open"
    assert result.telegram_topic_id == 321
    assert result.telegram_root_message_id == 654
    assert result.failure_reason is None
    assert send_payloads
    payload = send_payloads[0]
    assert payload["message_thread_id"] == 321
    assert "New support handoff #11111111" in str(payload["text"])
    assert "Recent assistant session messages:" in str(payload["text"])
    assert payload["reply_markup"]["inline_keyboard"][0][0]["callback_data"].startswith("ht:take:")
    assert len(payload["reply_markup"]["inline_keyboard"][0][0]["callback_data"]) <= 64


@pytest.mark.asyncio
async def test_service_dispatch_reuses_existing_open_ticket_without_creating_duplicates():
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        raise AssertionError("Telegram API should not be called for an existing open ticket")

    service = TelegramHandoffService(api_client=service_api_client(handler))
    try:
        result = await service.dispatch_handoff(
            settings=_settings(),
            handoff=_handoff(),
            session=_session(),
            transcript=[],
            existing_ticket={
                "ticket_status": "open",
                "telegram_chat_id": "-1001234567890",
                "telegram_topic_id": 321,
                "telegram_topic_title": "#11111111 · Алексей · enterprise_consultation",
                "telegram_root_message_id": 654,
                "opened_at": "2026-05-22T12:00:00.000Z",
            },
        )
    finally:
        await service.aclose()

    assert calls == []
    assert result.ticket_status == "open"
    assert result.telegram_topic_id == 321
    assert result.telegram_root_message_id == 654
    assert result.message == "Telegram ticket already exists for this handoff."


@pytest.mark.asyncio
async def test_service_dispatch_retries_partial_failed_ticket_without_creating_new_topic():
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        if request.url.path.endswith("/sendMessage"):
            return httpx.Response(
                200,
                json={"ok": True, "result": {"message_id": 654, "message_thread_id": 321}},
            )
        raise AssertionError(f"Unexpected Telegram API call: {request.url}")

    service = TelegramHandoffService(api_client=service_api_client(handler))
    try:
        result = await service.dispatch_handoff(
            settings=_settings(),
            handoff=_handoff(),
            session=_session(),
            transcript=[],
            existing_ticket={
                "ticket_status": "failed",
                "telegram_chat_id": "-1001234567890",
                "telegram_topic_id": 321,
                "telegram_topic_title": "#11111111 · Алексей · enterprise_consultation",
                "telegram_root_message_id": None,
            },
        )
    finally:
        await service.aclose()

    assert calls == ["/bot123456:telegram-bot-1234/sendMessage"]
    assert result.ticket_status == "open"
    assert result.telegram_topic_id == 321
    assert result.telegram_root_message_id == 654


@pytest.mark.asyncio
async def test_service_dispatch_returns_failed_with_sanitized_reason_on_network_error(
    caplog: pytest.LogCaptureFixture,
):
    token = "123456:telegram-bot-1234"

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError(f"boom {request.url}", request=request)

    logger = logging.getLogger("assistant.telegram_handoff.dispatch_redaction")
    service = TelegramHandoffService(
        api_client=service_api_client(handler),
        logger=logger,
    )
    caplog.set_level(logging.WARNING, logger=logger.name)
    try:
        result = await service.dispatch_handoff(
            settings=_settings(bot_token=token),
            handoff=_handoff(),
            session=_session(),
            transcript=[],
            existing_ticket=None,
        )
    finally:
        await service.aclose()

    assert result.ticket_status == "failed"
    assert result.failure_reason == "Could not reach the Telegram Bot API."
    assert token not in caplog.text
    assert "[REDACTED]" in caplog.text


@pytest.mark.asyncio
async def test_service_dispatch_sanitizes_unknown_upstream_error_without_leaking_token(
    caplog: pytest.LogCaptureFixture,
):
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

    logger = logging.getLogger("assistant.telegram_handoff.dispatch_unknown_redaction")
    service = TelegramHandoffService(
        api_client=service_api_client(handler),
        logger=logger,
    )
    caplog.set_level(logging.WARNING, logger=logger.name)
    try:
        result = await service.dispatch_handoff(
            settings=_settings(bot_token=token),
            handoff=_handoff(),
            session=_session(),
            transcript=[],
            existing_ticket=None,
        )
    finally:
        await service.aclose()

    assert result.ticket_status == "failed"
    assert result.failure_reason == "Telegram API error during createForumTopic."
    assert token not in caplog.text
    assert "top-secret" not in caplog.text
    assert "Authorization: Bearer" not in caplog.text
    assert "[REDACTED_AUTH]" in caplog.text
    assert "/bot[REDACTED]/createForumTopic?secret=[REDACTED]" in caplog.text


@pytest.mark.asyncio
async def test_service_process_webhook_claims_ticket_via_callback(repository):
    callback_payloads: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content.decode("utf-8")) if request.content else {}
        if request.url.path.endswith("/answerCallbackQuery"):
            callback_payloads.append(body)
            return httpx.Response(200, json={"ok": True, "result": True})
        raise AssertionError(f"Unexpected Telegram API call: {request.url}")

    service = TelegramHandoffService(api_client=service_api_client(handler))
    try:
        _session_record, handoff = await _seed_repository_ticket(repository)
        callback_token = str(handoff["id"]).replace("-", "")[:32]
        result = await service.process_webhook_update(
            settings=_settings(
                allowed_operator_ids=["7001"],
                allowed_admin_ids=["9001"],
            ),
            repository=repository,
            update={
                "update_id": 9001,
                "callback_query": {
                    "id": "callback-1",
                    "data": f"ht:take:{callback_token}",
                    "from": {
                        "id": 7001,
                        "username": "operator_alex",
                    },
                    "message": {
                        "message_id": 654,
                        "message_thread_id": 321,
                        "chat": {"id": -1001234567890},
                    },
                },
            },
        )
    finally:
        await service.aclose()

    assert result.status == "processed"
    assert result.action == "claim"
    assert result.ticket_status == "assigned"
    assert result.reason == "ticket_assigned"
    assert callback_payloads == [
        {
            "callback_query_id": "callback-1",
            "text": "Обращение назначено вам.",
        }
    ]

    ticket = await repository.get_handoff_ticket(handoff_id=handoff["id"], channel="telegram")
    assert ticket is not None
    assert ticket["ticket_status"] == "assigned"
    assert ticket["assigned_operator_id"] == "7001"
    assert ticket["assigned_operator_username"] == "operator_alex"

    audit = await repository.get_handoff_message_by_update_id(telegram_update_id=9001)
    assert audit is not None
    assert audit["message_kind"] == "callback_claim"
    assert audit["delivery_status"] == "updated"
    assert audit["metadata"]["reason"] == "ticket_assigned"
    assert audit["metadata"]["operator_role"] == "operator"


@pytest.mark.asyncio
async def test_service_process_webhook_delivers_operator_reply_with_safe_history_metadata(
    repository,
):
    topic_messages: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content.decode("utf-8")) if request.content else {}
        if request.url.path.endswith("/sendMessage"):
            topic_messages.append(body)
            return httpx.Response(
                200,
                json={"ok": True, "result": {"message_id": 778, "message_thread_id": 321}},
            )
        raise AssertionError(f"Unexpected Telegram API call: {request.url}")

    service = TelegramHandoffService(api_client=service_api_client(handler))
    try:
        session, handoff = await _seed_repository_ticket(repository)
        settings = _settings(
            allowed_operator_ids=["7001"],
            allowed_admin_ids=["9001"],
        )
        update = {
            "update_id": 9002,
            "message": {
                "message_id": 777,
                "message_thread_id": 321,
                "chat": {"id": -1001234567890},
                "from": {
                    "id": 7001,
                    "username": "operator_alex",
                    "is_bot": False,
                },
                "text": "/reply Мы уже готовим предложение и вернёмся с деталями сегодня.",
            },
        }
        result = await service.process_webhook_update(
            settings=settings,
            repository=repository,
            update=update,
        )
        duplicate = await service.process_webhook_update(
            settings=settings,
            repository=repository,
            update=update,
        )
    finally:
        await service.aclose()

    assert result.status == "processed"
    assert result.action == "reply"
    assert result.ticket_status == "waiting_customer"
    assert result.reason == "operator_reply_delivered"
    assert duplicate.status == "duplicate"
    assert duplicate.reason == "duplicate_update"
    assert duplicate.duplicate is True
    assert topic_messages
    assert "Ответ оператора добавлен в сессию ассистента." in str(topic_messages[0]["text"])

    messages = await repository.list_messages(session["id"])
    operator_message = messages[-1]
    assert operator_message["role"] == "assistant"
    assert operator_message["intent"] == "telegram_operator_reply"
    assert operator_message["content"] == "Мы уже готовим предложение и вернёмся с деталями сегодня."
    assert operator_message["metadata"] == {"source": "telegram_operator"}
    assert "operator_username" not in operator_message["metadata"]
    assert "operator_telegram_user_id" not in operator_message["metadata"]

    ticket = await repository.get_handoff_ticket(handoff_id=handoff["id"], channel="telegram")
    assert ticket is not None
    assert ticket["ticket_status"] == "waiting_customer"
    assert ticket["assigned_operator_id"] == "7001"
    assert ticket["assigned_operator_username"] == "operator_alex"

    audit = await repository.get_handoff_message_by_update_id(telegram_update_id=9002)
    assert audit is not None
    assert audit["assistant_message_id"] == operator_message["id"]
    assert audit["operator_telegram_user_id"] == "7001"
    assert audit["operator_username"] == "operator_alex"
    assert audit["content"] == operator_message["content"]
    assert audit["metadata"]["reason"] == "operator_reply_delivered"


@pytest.mark.asyncio
async def test_service_process_webhook_reply_reserves_update_before_creating_customer_message(
    repository,
):
    topic_messages: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content.decode("utf-8")) if request.content else {}
        if request.url.path.endswith("/sendMessage"):
            topic_messages.append(body)
            return httpx.Response(
                200,
                json={"ok": True, "result": {"message_id": 778, "message_thread_id": 321}},
            )
        raise AssertionError(f"Unexpected Telegram API call: {request.url}")

    service = TelegramHandoffService(api_client=service_api_client(handler))
    original_add_message = repository.add_message
    add_message_started = asyncio.Event()
    allow_add_message = asyncio.Event()

    async def delayed_add_message(**kwargs):
        if kwargs.get("intent") == "telegram_operator_reply":
            add_message_started.set()
            await allow_add_message.wait()
        return await original_add_message(**kwargs)

    repository.add_message = delayed_add_message
    try:
        session, handoff = await _seed_repository_ticket(repository)
        settings = _settings(
            allowed_operator_ids=["7001"],
            allowed_admin_ids=["9001"],
        )
        update = {
            "update_id": 9003,
            "message": {
                "message_id": 777,
                "message_thread_id": 321,
                "chat": {"id": -1001234567890},
                "from": {
                    "id": 7001,
                    "username": "operator_alex",
                    "is_bot": False,
                },
                "text": "/reply Подтверждаю, мы вернёмся с деталями в ближайшее время.",
            },
        }
        first_task = asyncio.create_task(
            service.process_webhook_update(
                settings=settings,
                repository=repository,
                update=update,
            )
        )
        await asyncio.wait_for(add_message_started.wait(), timeout=1)
        duplicate = await service.process_webhook_update(
            settings=settings,
            repository=repository,
            update=update,
        )
        allow_add_message.set()
        result = await first_task
    finally:
        repository.add_message = original_add_message
        await service.aclose()

    assert result.status == "processed"
    assert duplicate.status == "duplicate"
    assert duplicate.reason == "duplicate_update"
    assert duplicate.duplicate is True
    assert len(topic_messages) == 1

    messages = await repository.list_messages(session["id"])
    operator_messages = [
        message
        for message in messages
        if message.get("intent") == "telegram_operator_reply"
    ]
    assert len(operator_messages) == 1

    audit = await repository.get_handoff_message_by_update_id(telegram_update_id=9003)
    assert audit is not None
    assert audit["delivery_status"] == "delivered"
    assert audit["assistant_message_id"] == operator_messages[0]["id"]
    assert audit["metadata"]["reason"] == "operator_reply_delivered"


@pytest.mark.asyncio
async def test_service_process_webhook_reply_retry_reuses_checkpointed_assistant_message(
    repository,
):
    service = TelegramHandoffService(api_client=service_api_client(lambda request: httpx.Response(200, json={"ok": True, "result": {"message_id": 778, "message_thread_id": 321}})))
    original_update_handoff_ticket = repository.update_handoff_ticket
    failed_once = False

    async def flaky_update_handoff_ticket(**kwargs):
        nonlocal failed_once
        if kwargs.get("ticket_status") == "waiting_customer" and not failed_once:
            failed_once = True
            raise RuntimeError("ticket_update_failed webhook-secret-5678")
        return await original_update_handoff_ticket(**kwargs)

    repository.update_handoff_ticket = flaky_update_handoff_ticket
    try:
        session, handoff = await _seed_repository_ticket(repository)
        settings = _settings(
            allowed_operator_ids=["7001"],
            allowed_admin_ids=["9001"],
        )
        update = {
            "update_id": 9004,
            "message": {
                "message_id": 778,
                "message_thread_id": 321,
                "chat": {"id": -1001234567890},
                "from": {
                    "id": 7001,
                    "username": "operator_alex",
                    "is_bot": False,
                },
                "text": "/reply Готовим персональное предложение и скоро вернёмся.",
            },
        }

        with pytest.raises(RuntimeError):
            await service.process_webhook_update(
                settings=settings,
                repository=repository,
                update=update,
            )

        failed_audit = await repository.get_handoff_message_by_update_id(
            telegram_update_id=9004
        )
        assert failed_audit is not None
        assert failed_audit["delivery_status"] == "failed"
        assert failed_audit["assistant_message_id"] is not None
        assert "webhook-secret-5678" not in json.dumps(failed_audit, default=str)

        failed_messages = await repository.list_messages(session["id"])
        failed_operator_messages = [
            message
            for message in failed_messages
            if message.get("intent") == "telegram_operator_reply"
        ]
        assert len(failed_operator_messages) == 1

        repository.update_handoff_ticket = original_update_handoff_ticket
        result = await service.process_webhook_update(
            settings=settings,
            repository=repository,
            update=update,
        )
    finally:
        repository.update_handoff_ticket = original_update_handoff_ticket
        await service.aclose()

    assert result.status == "processed"
    assert result.reason == "operator_reply_delivered"

    final_messages = await repository.list_messages(session["id"])
    final_operator_messages = [
        message
        for message in final_messages
        if message.get("intent") == "telegram_operator_reply"
    ]
    assert len(final_operator_messages) == 1

    final_audit = await repository.get_handoff_message_by_update_id(telegram_update_id=9004)
    assert final_audit is not None
    assert final_audit["delivery_status"] == "delivered"
    assert final_audit["assistant_message_id"] == failed_audit["assistant_message_id"]

    ticket = await repository.get_handoff_ticket(handoff_id=handoff["id"], channel="telegram")
    assert ticket is not None
    assert ticket["ticket_status"] == "waiting_customer"


def service_api_client(handler) -> TelegramBotApiClient:
    return TelegramBotApiClient(client=_client(handler))
