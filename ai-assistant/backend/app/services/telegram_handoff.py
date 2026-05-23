from __future__ import annotations

import logging
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import httpx
from pydantic import BaseModel, ConfigDict, Field

from app.core.security import structured_log
from app.services.settings_provider import (
    TelegramHandoffDiagnostics,
    TelegramHandoffRuntimeSettings,
)


class TelegramBotApiError(RuntimeError):
    def __init__(
        self,
        *,
        method: str,
        message: str,
        status_code: int | None = None,
        error_code: int | None = None,
        detail: str | None = None,
    ) -> None:
        super().__init__(message)
        self.method = method
        self.status_code = status_code
        self.error_code = error_code
        self.detail = detail


class TelegramBotIdentity(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int | None = None
    username: str | None = None
    first_name: str | None = None


class TelegramChatIdentity(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str | None = None
    type: str | None = None
    title: str | None = None
    username: str | None = None
    is_forum: bool = False


class TelegramChatMembership(BaseModel):
    model_config = ConfigDict(extra="ignore")

    status: str | None = None
    can_manage_topics: bool = False
    can_delete_messages: bool = False


class TelegramWebhookState(BaseModel):
    model_config = ConfigDict(extra="ignore")

    configured_url: str | None = None
    actual_url: str | None = None
    pending_update_count: int = 0
    last_error_message: str | None = None


class TelegramHandoffConnectionTestResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    ok: bool
    status: str
    message: str
    warnings: list[str] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)
    tested_at: datetime
    diagnostics: TelegramHandoffDiagnostics = Field(
        default_factory=TelegramHandoffDiagnostics
    )
    bot: TelegramBotIdentity | None = None
    support_chat: TelegramChatIdentity | None = None
    bot_membership: TelegramChatMembership | None = None
    webhook: TelegramWebhookState | None = None


class TelegramForumTopic(BaseModel):
    model_config = ConfigDict(extra="ignore")

    message_thread_id: int | None = None
    name: str | None = None


class TelegramMessageReference(BaseModel):
    model_config = ConfigDict(extra="ignore")

    message_id: int | None = None
    message_thread_id: int | None = None


class TelegramHandoffDispatchResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    channel: str = "telegram"
    ticket_status: str
    message: str | None = None
    failure_reason: str | None = None
    telegram_chat_id: str | None = None
    telegram_topic_id: int | None = None
    telegram_topic_title: str | None = None
    telegram_root_message_id: int | None = None
    opened_at: datetime | None = None
    last_sync_at: datetime


class TelegramWebhookProcessResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    ok: bool = True
    status: str
    action: str | None = None
    handoff_id: str | None = None
    ticket_status: str | None = None
    message: str | None = None
    reason: str | None = None
    duplicate: bool = False


@dataclass(slots=True)
class TelegramIncomingUpdate:
    kind: str
    update_id: int | None
    chat_id: str | None
    topic_id: int | None
    message_id: int | None
    user_id: str | None
    username: str | None
    text: str | None = None
    callback_query_id: str | None = None
    callback_data: str | None = None
    has_attachment: bool = False


@dataclass(slots=True)
class TelegramActionOutcome:
    action: str
    delivery_status: str
    ticket_status: str
    message_kind: str
    operator_message: str | None = None
    callback_message: str | None = None
    reason: str | None = None
    assistant_message_id: Any = None
    content: str | None = None


class TelegramBotApiClient:
    def __init__(
        self,
        *,
        base_url: str = "https://api.telegram.org",
        timeout_seconds: float = 10.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout_seconds = timeout_seconds
        self._client = client
        self._owns_client = client is None
        self._closed = False

    async def get_me(self, token: str) -> dict[str, Any]:
        return self._expect_dict(await self._call(token, "getMe"), method="getMe")

    async def get_chat(self, token: str, chat_id: str) -> dict[str, Any]:
        return self._expect_dict(
            await self._call(token, "getChat", {"chat_id": chat_id}),
            method="getChat",
        )

    async def get_chat_member(
        self,
        token: str,
        chat_id: str,
        user_id: int,
    ) -> dict[str, Any]:
        return self._expect_dict(
            await self._call(
                token,
                "getChatMember",
                {"chat_id": chat_id, "user_id": user_id},
            ),
            method="getChatMember",
        )

    async def get_webhook_info(self, token: str) -> dict[str, Any]:
        return self._expect_dict(
            await self._call(token, "getWebhookInfo"),
            method="getWebhookInfo",
        )

    async def create_forum_topic(
        self,
        token: str,
        chat_id: str,
        name: str,
    ) -> dict[str, Any]:
        return self._expect_dict(
            await self._call(
                token,
                "createForumTopic",
                {"chat_id": chat_id, "name": name},
            ),
            method="createForumTopic",
        )

    async def send_message(
        self,
        token: str,
        chat_id: str,
        text: str,
        *,
        message_thread_id: int | None = None,
        reply_markup: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "chat_id": chat_id,
            "text": text,
        }
        if message_thread_id is not None:
            payload["message_thread_id"] = message_thread_id
        if reply_markup is not None:
            payload["reply_markup"] = reply_markup
        return self._expect_dict(
            await self._call(token, "sendMessage", payload),
            method="sendMessage",
        )

    async def answer_callback_query(
        self,
        token: str,
        callback_query_id: str,
        *,
        text: str | None = None,
        show_alert: bool = False,
    ) -> bool:
        payload: dict[str, Any] = {"callback_query_id": callback_query_id}
        if text:
            payload["text"] = text
        if show_alert:
            payload["show_alert"] = True
        return self._expect_bool(
            await self._call(token, "answerCallbackQuery", payload),
            method="answerCallbackQuery",
        )

    async def delete_forum_topic(
        self,
        token: str,
        chat_id: str,
        message_thread_id: int,
    ) -> bool:
        return self._expect_bool(
            await self._call(
                token,
                "deleteForumTopic",
                {
                    "chat_id": chat_id,
                    "message_thread_id": message_thread_id,
                },
            ),
            method="deleteForumTopic",
        )

    async def close_forum_topic(
        self,
        token: str,
        chat_id: str,
        message_thread_id: int,
    ) -> bool:
        return self._expect_bool(
            await self._call(
                token,
                "closeForumTopic",
                {
                    "chat_id": chat_id,
                    "message_thread_id": message_thread_id,
                },
            ),
            method="closeForumTopic",
        )

    async def aclose(self) -> None:
        if self._closed:
            return
        self._closed = True
        if self._owns_client and self._client is not None:
            await self._client.aclose()
            self._client = None

    def _ensure_client(self) -> httpx.AsyncClient:
        if self._closed:
            raise RuntimeError("TelegramBotApiClient has been closed")
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self._timeout_seconds)
        return self._client

    async def _call(
        self,
        token: str,
        method: str,
        payload: dict[str, Any] | None = None,
    ) -> Any:
        client = self._ensure_client()
        url = f"{self._base_url}/bot{token}/{method}"
        try:
            if payload is None:
                response = await client.get(url, headers={"accept": "application/json"})
            else:
                response = await client.post(
                    url,
                    json=payload,
                    headers={"accept": "application/json"},
                )
        except httpx.RequestError as exc:
            raise TelegramBotApiError(
                method=method,
                message="Network error while contacting Telegram.",
                detail=self._sanitize_text(str(exc), token),
            ) from exc

        try:
            body = response.json()
        except ValueError as exc:
            raise TelegramBotApiError(
                method=method,
                message="Telegram returned an invalid JSON response.",
                status_code=response.status_code,
                detail=self._sanitize_text(str(exc), token),
            ) from exc

        if not isinstance(body, dict):
            raise TelegramBotApiError(
                method=method,
                message="Telegram returned an invalid response payload.",
                status_code=response.status_code,
            )

        if body.get("ok") is True:
            return body.get("result")

        description = str(body.get("description") or f"Telegram {method} failed").strip()
        raise TelegramBotApiError(
            method=method,
            message=description,
            status_code=response.status_code,
            error_code=_as_int(body.get("error_code")),
        )

    def _sanitize_text(self, value: str, token: str) -> str:
        return value.replace(token, "[REDACTED]")

    def _expect_dict(self, result: Any, *, method: str) -> dict[str, Any]:
        if isinstance(result, dict):
            return result
        raise TelegramBotApiError(
            method=method,
            message="Telegram returned an unexpected result payload.",
        )

    def _expect_bool(self, result: Any, *, method: str) -> bool:
        if isinstance(result, bool):
            return result
        raise TelegramBotApiError(
            method=method,
            message="Telegram returned an unexpected result payload.",
        )


class TelegramHandoffService:
    def __init__(
        self,
        *,
        api_client: TelegramBotApiClient | None = None,
        logger: logging.Logger | None = None,
    ) -> None:
        self._api_client = api_client or TelegramBotApiClient()
        self._logger = logger or logging.getLogger("assistant.telegram_handoff")

    async def aclose(self) -> None:
        await self._api_client.aclose()

    async def test_connection(
        self,
        settings: TelegramHandoffRuntimeSettings,
    ) -> TelegramHandoffConnectionTestResult:
        tested_at = datetime.now(timezone.utc)
        diagnostics = settings.diagnostics

        if not settings.enabled:
            result = TelegramHandoffConnectionTestResult(
                ok=False,
                status="disabled",
                message="Telegram handoff is disabled.",
                tested_at=tested_at,
                diagnostics=diagnostics,
            )
            self._log_result(logging.INFO, "assistant.telegram_handoff.test_skipped", settings, result)
            return result

        if not settings.is_ready_for_connection_test:
            missing_fields = list(diagnostics.missing_fields) or _missing_connection_fields(
                settings
            )
            result = TelegramHandoffConnectionTestResult(
                ok=False,
                status="missing_credentials",
                message=(
                    "Missing required Telegram handoff configuration: "
                    f"{', '.join(missing_fields)}"
                ),
                missing_fields=missing_fields,
                tested_at=tested_at,
                diagnostics=diagnostics,
            )
            self._log_result(
                logging.WARNING,
                "assistant.telegram_handoff.test_failed",
                settings,
                result,
                reason="missing_credentials",
            )
            return result

        bot: TelegramBotIdentity | None = None
        support_chat: TelegramChatIdentity | None = None
        bot_membership: TelegramChatMembership | None = None
        webhook: TelegramWebhookState | None = None
        warnings: list[str] = []
        token = settings.bot_token or ""
        support_chat_id = settings.support_chat_id or ""
        configured_webhook_url = settings.webhook_url or ""

        try:
            bot = _bot_identity(
                await self._api_client.get_me(token),
            )
            support_chat = _chat_identity(
                await self._api_client.get_chat(token, support_chat_id),
            )
            if support_chat.type != "supergroup":
                return self._failure(
                    settings,
                    tested_at,
                    "Configured support chat must be a Telegram supergroup.",
                    bot=bot,
                    support_chat=support_chat,
                    webhook=webhook,
                    bot_membership=bot_membership,
                )
            if settings.topics_required and not support_chat.is_forum:
                return self._failure(
                    settings,
                    tested_at,
                    "Support chat must have Topics / Forum enabled.",
                    bot=bot,
                    support_chat=support_chat,
                    webhook=webhook,
                    bot_membership=bot_membership,
                )
            if bot.id is None:
                return self._failure(
                    settings,
                    tested_at,
                    "Telegram did not return the bot identifier.",
                    bot=bot,
                    support_chat=support_chat,
                    webhook=webhook,
                    bot_membership=bot_membership,
                )

            bot_membership = _chat_membership(
                await self._api_client.get_chat_member(
                    token,
                    support_chat_id,
                    bot.id,
                ),
            )
            if bot_membership.status not in {"administrator", "creator"}:
                return self._failure(
                    settings,
                    tested_at,
                    "Telegram bot must be an administrator in the support chat.",
                    bot=bot,
                    support_chat=support_chat,
                    webhook=webhook,
                    bot_membership=bot_membership,
                )
            if (
                settings.topics_required
                and bot_membership.status != "creator"
                and not bot_membership.can_manage_topics
            ):
                return self._failure(
                    settings,
                    tested_at,
                    "Telegram bot must have can_manage_topics in the support chat.",
                    bot=bot,
                    support_chat=support_chat,
                    webhook=webhook,
                    bot_membership=bot_membership,
                )

            webhook = _webhook_state(
                await self._api_client.get_webhook_info(token),
                configured_url=configured_webhook_url,
            )
            if (webhook.actual_url or "") != configured_webhook_url:
                return self._failure(
                    settings,
                    tested_at,
                    "Telegram webhook URL does not match the saved webhook_url.",
                    bot=bot,
                    support_chat=support_chat,
                    webhook=webhook,
                    bot_membership=bot_membership,
                )

            warnings = await self._run_connection_smoke_test(
                token=token,
                support_chat_id=support_chat_id,
                bot_membership=bot_membership,
            )

            result = TelegramHandoffConnectionTestResult(
                ok=True,
                status="connection_ok",
                message=self._success_message(warnings),
                warnings=warnings,
                tested_at=tested_at,
                diagnostics=diagnostics,
                bot=bot,
                support_chat=support_chat,
                bot_membership=bot_membership,
                webhook=webhook,
            )
            self._log_result(
                logging.INFO,
                "assistant.telegram_handoff.test_passed",
                settings,
                result,
            )
            return result
        except TelegramBotApiError as exc:
            return self._failure(
                settings,
                tested_at,
                self._error_message(exc),
                bot=bot,
                support_chat=support_chat,
                webhook=webhook,
                bot_membership=bot_membership,
                error_detail=self._error_detail(exc),
                reason=exc.method,
            )
        except Exception as exc:
            return self._failure(
                settings,
                tested_at,
                "Unexpected error while testing the Telegram handoff connection.",
                bot=bot,
                support_chat=support_chat,
                webhook=webhook,
                bot_membership=bot_membership,
                error_detail=exc.__class__.__name__,
                reason="unexpected_error",
            )

    async def dispatch_handoff(
        self,
        *,
        settings: TelegramHandoffRuntimeSettings,
        handoff: dict[str, Any],
        session: dict[str, Any] | None,
        transcript: list[dict[str, Any]] | None = None,
        existing_ticket: dict[str, Any] | None = None,
    ) -> TelegramHandoffDispatchResult:
        synced_at = datetime.now(timezone.utc)
        handoff_id = str(handoff.get("id") or "")
        session_id = str(handoff.get("session_id") or "")

        if not settings.enabled:
            result = TelegramHandoffDispatchResult(
                ticket_status="submitted",
                message="Handoff was saved without Telegram delivery because Telegram handoff is disabled.",
                last_sync_at=synced_at,
            )
            self._log_dispatch_result(
                logging.INFO,
                "assistant.telegram_handoff.dispatch_skipped",
                handoff_id=handoff_id,
                session_id=session_id,
                result=result,
                reason="disabled",
            )
            return result

        if not settings.is_ready_for_connection_test:
            missing_fields = list(settings.diagnostics.missing_fields) or _missing_connection_fields(
                settings
            )
            result = TelegramHandoffDispatchResult(
                ticket_status="submitted",
                message=(
                    "Handoff was saved without Telegram delivery because the Telegram handoff "
                    f"configuration is incomplete: {', '.join(missing_fields)}"
                ),
                last_sync_at=synced_at,
            )
            self._log_dispatch_result(
                logging.WARNING,
                "assistant.telegram_handoff.dispatch_skipped",
                handoff_id=handoff_id,
                session_id=session_id,
                result=result,
                reason="missing_credentials",
            )
            return result

        if existing_ticket:
            existing_topic_id = _as_int(existing_ticket.get("telegram_topic_id"))
            existing_root_message_id = _as_int(existing_ticket.get("telegram_root_message_id"))
            if existing_topic_id is not None and existing_root_message_id is not None:
                result = TelegramHandoffDispatchResult(
                    ticket_status="open",
                    message="Telegram ticket already exists for this handoff.",
                    telegram_chat_id=_as_str(existing_ticket.get("telegram_chat_id"))
                    or settings.support_chat_id,
                    telegram_topic_id=existing_topic_id,
                    telegram_topic_title=_as_str(existing_ticket.get("telegram_topic_title")),
                    telegram_root_message_id=existing_root_message_id,
                    opened_at=_as_datetime(existing_ticket.get("opened_at")) or synced_at,
                    last_sync_at=synced_at,
                )
                self._log_dispatch_result(
                    logging.INFO,
                    "assistant.telegram_handoff.dispatch_reused",
                    handoff_id=handoff_id,
                    session_id=session_id,
                    result=result,
                    reason="existing_ticket",
                )
                return result

        token = settings.bot_token or ""
        chat_id = (
            _as_str((existing_ticket or {}).get("telegram_chat_id"))
            or settings.support_chat_id
            or ""
        )
        topic_id = _as_int((existing_ticket or {}).get("telegram_topic_id"))
        topic_title = _as_str((existing_ticket or {}).get("telegram_topic_title"))
        root_message_id = _as_int((existing_ticket or {}).get("telegram_root_message_id"))

        try:
            if topic_id is None:
                topic_title = _topic_title(handoff)
                topic = _forum_topic(
                    await self._api_client.create_forum_topic(
                        token,
                        chat_id,
                        topic_title,
                    )
                )
                if topic.message_thread_id is None:
                    raise TelegramBotApiError(
                        method="createForumTopic",
                        message="Telegram did not return the forum topic identifier.",
                    )
                topic_id = topic.message_thread_id
                topic_title = topic.name or topic_title

            if root_message_id is None:
                message = _message_reference(
                    await self._api_client.send_message(
                        token,
                        chat_id,
                        _handoff_card_text(
                            handoff=handoff,
                            session=session,
                            transcript=transcript or [],
                            ticket_status="open",
                        ),
                        message_thread_id=topic_id,
                        reply_markup=_handoff_reply_markup(handoff.get("id")),
                    )
                )
                if message.message_id is None:
                    raise TelegramBotApiError(
                        method="sendMessage",
                        message="Telegram did not return the ticket message identifier.",
                    )
                root_message_id = message.message_id

            result = TelegramHandoffDispatchResult(
                ticket_status="open",
                message="Handoff was saved and routed to Telegram.",
                telegram_chat_id=chat_id,
                telegram_topic_id=topic_id,
                telegram_topic_title=topic_title,
                telegram_root_message_id=root_message_id,
                opened_at=_as_datetime((existing_ticket or {}).get("opened_at")) or synced_at,
                last_sync_at=synced_at,
            )
            self._log_dispatch_result(
                logging.INFO,
                "assistant.telegram_handoff.dispatch_opened",
                handoff_id=handoff_id,
                session_id=session_id,
                result=result,
            )
            return result
        except TelegramBotApiError as exc:
            result = TelegramHandoffDispatchResult(
                ticket_status="failed",
                message="Handoff was saved, but Telegram ticket creation failed.",
                failure_reason=self._error_message(exc),
                telegram_chat_id=chat_id,
                telegram_topic_id=topic_id,
                telegram_topic_title=topic_title,
                telegram_root_message_id=root_message_id,
                last_sync_at=synced_at,
            )
            self._log_dispatch_result(
                logging.WARNING,
                "assistant.telegram_handoff.dispatch_failed",
                handoff_id=handoff_id,
                session_id=session_id,
                result=result,
                reason=exc.method,
                error_detail=self._error_detail(exc),
            )
            return result
        except Exception as exc:
            result = TelegramHandoffDispatchResult(
                ticket_status="failed",
                message="Handoff was saved, but Telegram ticket creation failed.",
                failure_reason="Unexpected error while opening the Telegram handoff ticket.",
                telegram_chat_id=chat_id,
                telegram_topic_id=topic_id,
                telegram_topic_title=topic_title,
                telegram_root_message_id=root_message_id,
                last_sync_at=synced_at,
            )
            self._log_dispatch_result(
                logging.WARNING,
                "assistant.telegram_handoff.dispatch_failed",
                handoff_id=handoff_id,
                session_id=session_id,
                result=result,
                reason="unexpected_error",
                error_detail=exc.__class__.__name__,
            )
            return result

    async def process_webhook_update(
        self,
        *,
        settings: TelegramHandoffRuntimeSettings,
        repository,
        update: dict[str, Any],
    ) -> TelegramWebhookProcessResult:
        incoming = _parse_telegram_update(update)
        if incoming is None:
            return TelegramWebhookProcessResult(
                status="ignored",
                reason="unsupported_update",
                message="Unsupported Telegram update payload was ignored.",
            )

        if incoming.chat_id != settings.support_chat_id:
            return TelegramWebhookProcessResult(
                status="ignored",
                reason="unexpected_chat",
                message="Telegram update was ignored because the support chat does not match.",
            )

        if incoming.topic_id is None:
            return TelegramWebhookProcessResult(
                status="ignored",
                reason="missing_topic",
                message="Telegram update was ignored because it is not tied to a known topic.",
            )

        if not hasattr(repository, "find_handoff_ticket_by_telegram_thread"):
            return TelegramWebhookProcessResult(
                status="ignored",
                reason="repository_unsupported",
                message="Repository does not support Telegram webhook routing.",
            )

        ticket = await repository.find_handoff_ticket_by_telegram_thread(
            telegram_chat_id=incoming.chat_id,
            telegram_topic_id=incoming.topic_id,
            channel="telegram",
        )
        if not ticket:
            return TelegramWebhookProcessResult(
                status="ignored",
                reason="unknown_topic",
                message="Telegram update was ignored because the topic is not mapped to a handoff ticket.",
            )

        if not hasattr(repository, "get_handoff"):
            return TelegramWebhookProcessResult(
                status="ignored",
                reason="repository_unsupported",
                message="Repository does not support Telegram handoff lookup.",
            )

        handoff = await repository.get_handoff(ticket["handoff_id"])
        if not handoff:
            return TelegramWebhookProcessResult(
                status="ignored",
                reason="handoff_not_found",
                message="Telegram update was ignored because the handoff record no longer exists.",
            )

        reservation, duplicate = await self._reserve_webhook_update(
            repository=repository,
            handoff=handoff,
            ticket=ticket,
            incoming=incoming,
        )
        if duplicate is not None:
            return duplicate

        user_role: str | None = None
        try:
            user_role = _telegram_operator_role(
                settings,
                telegram_user_id=incoming.user_id,
            )
            if not user_role:
                if incoming.callback_query_id:
                    await self._safe_answer_callback_query(
                        token=settings.bot_token or "",
                        callback_query_id=incoming.callback_query_id,
                        text="Действие недоступно для этого оператора.",
                    )
                await self._record_webhook_update(
                    repository=repository,
                    handoff=handoff,
                    incoming=incoming,
                    delivery_status="ignored",
                    message_kind=f"{incoming.kind}_unauthorized",
                    content=incoming.text,
                    operator_role=None,
                    reason="unauthorized_operator",
                    reservation=reservation,
                )
                return TelegramWebhookProcessResult(
                    status="ignored",
                    handoff_id=str(handoff.get("id") or ""),
                    ticket_status=str(ticket.get("ticket_status") or "submitted"),
                    message="Telegram update was ignored because the operator is not authorized.",
                    reason="unauthorized_operator",
                )

            if incoming.kind == "callback":
                return await self._process_callback_update(
                    settings=settings,
                    repository=repository,
                    handoff=handoff,
                    ticket=ticket,
                    incoming=incoming,
                    operator_role=user_role,
                    reservation=reservation,
                )

            return await self._process_message_update(
                settings=settings,
                repository=repository,
                handoff=handoff,
                ticket=ticket,
                incoming=incoming,
                operator_role=user_role,
                reservation=reservation,
            )
        except Exception as exc:
            await self._record_webhook_failure(
                repository=repository,
                handoff=handoff,
                incoming=incoming,
                reservation=reservation,
                operator_role=user_role,
                error=exc,
            )
            raise

    async def _process_message_update(
        self,
        *,
        settings: TelegramHandoffRuntimeSettings,
        repository,
        handoff: dict[str, Any],
        ticket: dict[str, Any],
        incoming: TelegramIncomingUpdate,
        operator_role: str,
        reservation: dict[str, Any] | None,
    ) -> TelegramWebhookProcessResult:
        if not incoming.text:
            if incoming.has_attachment:
                await self._safe_send_topic_message(
                    token=settings.bot_token or "",
                    chat_id=incoming.chat_id or "",
                    topic_id=incoming.topic_id,
                    text=(
                        "Вложения пока не поддерживаются. "
                        "Используйте /reply <текст> для ответа клиенту или /note <текст> для внутренней заметки."
                    ),
                )
            await self._record_webhook_update(
                repository=repository,
                handoff=handoff,
                incoming=incoming,
                delivery_status="ignored",
                message_kind="message_unsupported",
                content=None,
                operator_role=operator_role,
                reason="unsupported_message",
                reservation=reservation,
            )
            return TelegramWebhookProcessResult(
                status="ignored",
                action="unsupported",
                handoff_id=str(handoff.get("id") or ""),
                ticket_status=str(ticket.get("ticket_status") or "submitted"),
                message="Unsupported Telegram message was ignored.",
                reason="unsupported_message",
            )

        command_name, command_argument = _parse_telegram_command(incoming.text)
        outcome: TelegramActionOutcome
        if command_name is not None:
            outcome = await self._execute_ticket_action(
                repository=repository,
                handoff=handoff,
                ticket=ticket,
                incoming=incoming,
                operator_role=operator_role,
                action=command_name,
                argument=command_argument,
                callback=False,
                reservation=reservation,
            )
        elif settings.operator_reply_mode == "all_topic_messages":
            outcome = await self._execute_ticket_action(
                repository=repository,
                handoff=handoff,
                ticket=ticket,
                incoming=incoming,
                operator_role=operator_role,
                action="reply",
                argument=incoming.text,
                callback=False,
                message_kind="message_reply",
                reservation=reservation,
            )
        else:
            hint = (
                "Используйте /reply <текст>, чтобы ответить клиенту, "
                "или /note <текст>, чтобы сохранить внутреннюю заметку."
            )
            await self._safe_send_topic_message(
                token=settings.bot_token or "",
                chat_id=incoming.chat_id or "",
                topic_id=incoming.topic_id,
                text=hint,
            )
            await self._record_webhook_update(
                repository=repository,
                handoff=handoff,
                incoming=incoming,
                delivery_status="ignored",
                message_kind="message_reply_required",
                content=incoming.text,
                operator_role=operator_role,
                reason="reply_command_required",
                reservation=reservation,
            )
            return TelegramWebhookProcessResult(
                status="ignored",
                handoff_id=str(handoff.get("id") or ""),
                ticket_status=str(ticket.get("ticket_status") or "submitted"),
                message="Plain Telegram message was ignored until /reply is used.",
                reason="reply_command_required",
            )

        if outcome.operator_message:
            await self._safe_send_topic_message(
                token=settings.bot_token or "",
                chat_id=incoming.chat_id or "",
                topic_id=incoming.topic_id,
                text=outcome.operator_message,
            )
        await self._record_webhook_update(
            repository=repository,
            handoff=handoff,
            incoming=incoming,
            delivery_status=outcome.delivery_status,
            message_kind=outcome.message_kind,
            content=outcome.content,
            assistant_message_id=outcome.assistant_message_id,
            operator_role=operator_role,
            reason=outcome.reason,
            reservation=reservation,
        )
        return TelegramWebhookProcessResult(
            status="processed",
            action=outcome.action,
            handoff_id=str(handoff.get("id") or ""),
            ticket_status=outcome.ticket_status,
            message=outcome.reason or outcome.operator_message,
            reason=outcome.reason,
        )

    async def _process_callback_update(
        self,
        *,
        settings: TelegramHandoffRuntimeSettings,
        repository,
        handoff: dict[str, Any],
        ticket: dict[str, Any],
        incoming: TelegramIncomingUpdate,
        operator_role: str,
        reservation: dict[str, Any] | None,
    ) -> TelegramWebhookProcessResult:
        action_name, action_token = _parse_callback_action(incoming.callback_data)
        if action_name is None:
            await self._safe_answer_callback_query(
                token=settings.bot_token or "",
                callback_query_id=incoming.callback_query_id or "",
                text="Неизвестное действие.",
            )
            await self._record_webhook_update(
                repository=repository,
                handoff=handoff,
                incoming=incoming,
                delivery_status="ignored",
                message_kind="callback_unsupported",
                content=None,
                operator_role=operator_role,
                reason="unsupported_callback",
                reservation=reservation,
            )
            return TelegramWebhookProcessResult(
                status="ignored",
                handoff_id=str(handoff.get("id") or ""),
                ticket_status=str(ticket.get("ticket_status") or "submitted"),
                message="Unsupported Telegram callback was ignored.",
                reason="unsupported_callback",
            )

        if action_token and not _callback_token_matches_handoff(
            callback_token=action_token,
            handoff_id=handoff.get("id"),
        ):
            await self._safe_answer_callback_query(
                token=settings.bot_token or "",
                callback_query_id=incoming.callback_query_id or "",
                text="Кнопка больше не относится к этому обращению.",
            )
            await self._record_webhook_update(
                repository=repository,
                handoff=handoff,
                incoming=incoming,
                delivery_status="ignored",
                message_kind="callback_ticket_mismatch",
                content=None,
                operator_role=operator_role,
                reason="callback_ticket_mismatch",
                reservation=reservation,
            )
            return TelegramWebhookProcessResult(
                status="ignored",
                handoff_id=str(handoff.get("id") or ""),
                ticket_status=str(ticket.get("ticket_status") or "submitted"),
                message="Telegram callback was ignored because the ticket token does not match.",
                reason="callback_ticket_mismatch",
            )

        outcome = await self._execute_ticket_action(
            repository=repository,
            handoff=handoff,
            ticket=ticket,
            incoming=incoming,
            operator_role=operator_role,
            action=action_name,
            argument=None,
            callback=True,
            message_kind=f"callback_{action_name}",
            reservation=reservation,
        )
        if outcome.operator_message:
            await self._safe_send_topic_message(
                token=settings.bot_token or "",
                chat_id=incoming.chat_id or "",
                topic_id=incoming.topic_id,
                text=outcome.operator_message,
            )
        await self._safe_answer_callback_query(
            token=settings.bot_token or "",
            callback_query_id=incoming.callback_query_id or "",
            text=outcome.callback_message or outcome.reason or "Готово.",
        )
        await self._record_webhook_update(
            repository=repository,
            handoff=handoff,
            incoming=incoming,
            delivery_status=outcome.delivery_status,
            message_kind=outcome.message_kind,
            content=outcome.content,
            assistant_message_id=outcome.assistant_message_id,
            operator_role=operator_role,
            reason=outcome.reason,
            reservation=reservation,
        )
        return TelegramWebhookProcessResult(
            status="processed",
            action=outcome.action,
            handoff_id=str(handoff.get("id") or ""),
            ticket_status=outcome.ticket_status,
            message=outcome.reason or outcome.callback_message,
            reason=outcome.reason,
        )

    async def _execute_ticket_action(
        self,
        *,
        repository,
        handoff: dict[str, Any],
        ticket: dict[str, Any],
        incoming: TelegramIncomingUpdate,
        operator_role: str,
        action: str,
        argument: str | None,
        callback: bool,
        message_kind: str | None = None,
        reservation: dict[str, Any] | None = None,
    ) -> TelegramActionOutcome:
        normalized_action = {"take": "claim"}.get(action, action)
        if normalized_action == "status":
            return TelegramActionOutcome(
                action="status",
                delivery_status="reported",
                ticket_status=str(ticket.get("ticket_status") or "submitted"),
                message_kind=message_kind or "command_status",
                operator_message=_ticket_status_text(ticket=ticket, handoff=handoff),
                callback_message="Статус отправлен в топик." if callback else None,
                reason="status_reported",
            )
        if normalized_action == "claim":
            return await self._claim_ticket(
                repository=repository,
                ticket=ticket,
                handoff=handoff,
                incoming=incoming,
                operator_role=operator_role,
                callback=callback,
                message_kind=message_kind or "command_claim",
            )
        if normalized_action == "close":
            return await self._close_ticket(
                repository=repository,
                ticket=ticket,
                handoff=handoff,
                incoming=incoming,
                operator_role=operator_role,
                callback=callback,
                message_kind=message_kind or "command_close",
            )
        if normalized_action == "reopen":
            return await self._reopen_ticket(
                repository=repository,
                ticket=ticket,
                handoff=handoff,
                incoming=incoming,
                operator_role=operator_role,
                callback=callback,
                message_kind=message_kind or "command_reopen",
            )
        if normalized_action == "note":
            return await self._save_internal_note(
                repository=repository,
                ticket=ticket,
                handoff=handoff,
                incoming=incoming,
                operator_role=operator_role,
                note_text=argument,
                callback=callback,
                message_kind=message_kind or "command_note",
            )
        if normalized_action == "reply":
            return await self._deliver_operator_reply(
                repository=repository,
                ticket=ticket,
                handoff=handoff,
                incoming=incoming,
                operator_role=operator_role,
                reply_text=argument,
                callback=callback,
                message_kind=message_kind or "command_reply",
                reservation=reservation,
            )
        return TelegramActionOutcome(
            action=normalized_action,
            delivery_status="ignored",
            ticket_status=str(ticket.get("ticket_status") or "submitted"),
            message_kind=message_kind or "command_unsupported",
            operator_message="Неизвестная команда Telegram была проигнорирована.",
            callback_message="Неизвестная команда.",
            reason="unsupported_action",
        )

    async def _claim_ticket(
        self,
        *,
        repository,
        ticket: dict[str, Any],
        handoff: dict[str, Any],
        incoming: TelegramIncomingUpdate,
        operator_role: str,
        callback: bool,
        message_kind: str,
    ) -> TelegramActionOutcome:
        current_status = str(ticket.get("ticket_status") or "submitted")
        assigned_operator_id = _as_str(ticket.get("assigned_operator_id"))
        if current_status == "closed":
            return TelegramActionOutcome(
                action="claim",
                delivery_status="rejected",
                ticket_status=current_status,
                message_kind=message_kind,
                operator_message="Обращение закрыто. Используйте /reopen перед /claim.",
                callback_message="Сначала переоткройте обращение.",
                reason="ticket_closed",
            )
        if assigned_operator_id and assigned_operator_id != incoming.user_id:
            return TelegramActionOutcome(
                action="claim",
                delivery_status="rejected",
                ticket_status=current_status,
                message_kind=message_kind,
                operator_message="Обращение уже назначено другому оператору.",
                callback_message="Уже назначено другому оператору.",
                reason="ticket_assigned_to_other_operator",
            )
        if assigned_operator_id == incoming.user_id:
            return TelegramActionOutcome(
                action="claim",
                delivery_status="noop",
                ticket_status=current_status,
                message_kind=message_kind,
                operator_message="Обращение уже назначено вам.",
                callback_message="Обращение уже у вас.",
                reason="ticket_already_claimed",
            )
        if current_status not in {"open", "waiting_operator"}:
            return TelegramActionOutcome(
                action="claim",
                delivery_status="rejected",
                ticket_status=current_status,
                message_kind=message_kind,
                operator_message="Взять в работу можно только открытое обращение.",
                callback_message="Статус не позволяет взять обращение.",
                reason="claim_not_allowed_for_status",
            )
        now = datetime.now(timezone.utc)
        updated = await repository.update_handoff_ticket(
            handoff_id=handoff["id"],
            channel="telegram",
            ticket_status="assigned",
            assigned_operator_id=incoming.user_id,
            assigned_operator_username=incoming.username,
            assigned_at=ticket.get("assigned_at") or now,
            last_telegram_update_id=incoming.update_id,
            last_sync_at=now,
        )
        return TelegramActionOutcome(
            action="claim",
            delivery_status="updated",
            ticket_status=str(updated.get("ticket_status") or "assigned"),
            message_kind=message_kind,
            operator_message=None if callback else "Обращение назначено текущему оператору.",
            callback_message="Обращение назначено вам.",
            reason="ticket_assigned",
        )

    async def _close_ticket(
        self,
        *,
        repository,
        ticket: dict[str, Any],
        handoff: dict[str, Any],
        incoming: TelegramIncomingUpdate,
        operator_role: str,
        callback: bool,
        message_kind: str,
    ) -> TelegramActionOutcome:
        current_status = str(ticket.get("ticket_status") or "submitted")
        if current_status == "closed":
            return TelegramActionOutcome(
                action="close",
                delivery_status="noop",
                ticket_status="closed",
                message_kind=message_kind,
                operator_message="Обращение уже закрыто.",
                callback_message="Обращение уже закрыто.",
                reason="ticket_already_closed",
            )
        permission_error = _ticket_assignment_permission_error(
            ticket=ticket,
            telegram_user_id=incoming.user_id,
            operator_role=operator_role,
            allow_admin_override=True,
        )
        if permission_error:
            return TelegramActionOutcome(
                action="close",
                delivery_status="rejected",
                ticket_status=current_status,
                message_kind=message_kind,
                operator_message=permission_error,
                callback_message="Закрытие недоступно.",
                reason="ticket_assignment_mismatch",
            )
        now = datetime.now(timezone.utc)
        updated = await repository.update_handoff_ticket(
            handoff_id=handoff["id"],
            channel="telegram",
            ticket_status="closed",
            closed_at=now,
            last_telegram_update_id=incoming.update_id,
            last_sync_at=now,
        )
        return TelegramActionOutcome(
            action="close",
            delivery_status="updated",
            ticket_status=str(updated.get("ticket_status") or "closed"),
            message_kind=message_kind,
            operator_message=None if callback else "Обращение закрыто.",
            callback_message="Обращение закрыто.",
            reason="ticket_closed",
        )

    async def _reopen_ticket(
        self,
        *,
        repository,
        ticket: dict[str, Any],
        handoff: dict[str, Any],
        incoming: TelegramIncomingUpdate,
        operator_role: str,
        callback: bool,
        message_kind: str,
    ) -> TelegramActionOutcome:
        current_status = str(ticket.get("ticket_status") or "submitted")
        if current_status != "closed":
            return TelegramActionOutcome(
                action="reopen",
                delivery_status="noop",
                ticket_status=current_status,
                message_kind=message_kind,
                operator_message="Обращение уже открыто.",
                callback_message="Обращение уже открыто.",
                reason="ticket_not_closed",
            )
        permission_error = _ticket_assignment_permission_error(
            ticket=ticket,
            telegram_user_id=incoming.user_id,
            operator_role=operator_role,
            allow_admin_override=True,
        )
        if permission_error:
            return TelegramActionOutcome(
                action="reopen",
                delivery_status="rejected",
                ticket_status=current_status,
                message_kind=message_kind,
                operator_message=permission_error,
                callback_message="Переоткрытие недоступно.",
                reason="ticket_assignment_mismatch",
            )
        now = datetime.now(timezone.utc)
        next_status = "waiting_operator" if ticket.get("assigned_operator_id") else "open"
        updated = await repository.update_handoff_ticket(
            handoff_id=handoff["id"],
            channel="telegram",
            ticket_status=next_status,
            closed_at=None,
            last_telegram_update_id=incoming.update_id,
            last_sync_at=now,
        )
        return TelegramActionOutcome(
            action="reopen",
            delivery_status="updated",
            ticket_status=str(updated.get("ticket_status") or next_status),
            message_kind=message_kind,
            operator_message=None if callback else "Обращение переоткрыто.",
            callback_message="Обращение переоткрыто.",
            reason="ticket_reopened",
        )

    async def _save_internal_note(
        self,
        *,
        repository,
        ticket: dict[str, Any],
        handoff: dict[str, Any],
        incoming: TelegramIncomingUpdate,
        operator_role: str,
        note_text: str | None,
        callback: bool,
        message_kind: str,
    ) -> TelegramActionOutcome:
        normalized_note = _clean_multiline(note_text, max_length=_MAX_INTERNAL_NOTE_CHARS)
        if not normalized_note:
            return TelegramActionOutcome(
                action="note",
                delivery_status="rejected",
                ticket_status=str(ticket.get("ticket_status") or "submitted"),
                message_kind=message_kind,
                operator_message="Используйте /note <текст>, чтобы сохранить заметку.",
                callback_message="Нужен текст заметки.",
                reason="note_text_required",
            )
        permission_error = _ticket_assignment_permission_error(
            ticket=ticket,
            telegram_user_id=incoming.user_id,
            operator_role=operator_role,
            allow_admin_override=False,
        )
        if permission_error:
            return TelegramActionOutcome(
                action="note",
                delivery_status="rejected",
                ticket_status=str(ticket.get("ticket_status") or "submitted"),
                message_kind=message_kind,
                operator_message=permission_error,
                callback_message="Заметка недоступна.",
                reason="ticket_assignment_mismatch",
                content=normalized_note,
            )
        now = datetime.now(timezone.utc)
        await repository.update_handoff_ticket(
            handoff_id=handoff["id"],
            channel="telegram",
            last_telegram_update_id=incoming.update_id,
            last_sync_at=now,
        )
        return TelegramActionOutcome(
            action="note",
            delivery_status="saved",
            ticket_status=str((await repository.get_handoff_ticket(handoff_id=handoff["id"], channel="telegram")).get("ticket_status") or ticket.get("ticket_status") or "submitted"),
            message_kind=message_kind,
            operator_message="Внутренняя заметка сохранена и не отправлена клиенту.",
            callback_message="Заметка сохранена.",
            reason="note_saved",
            content=normalized_note,
        )

    async def _deliver_operator_reply(
        self,
        *,
        repository,
        ticket: dict[str, Any],
        handoff: dict[str, Any],
        incoming: TelegramIncomingUpdate,
        operator_role: str,
        reply_text: str | None,
        callback: bool,
        message_kind: str,
        reservation: dict[str, Any] | None = None,
    ) -> TelegramActionOutcome:
        current_status = str(ticket.get("ticket_status") or "submitted")
        if current_status == "closed":
            return TelegramActionOutcome(
                action="reply",
                delivery_status="rejected",
                ticket_status=current_status,
                message_kind=message_kind,
                operator_message="Обращение закрыто. Используйте /reopen перед /reply.",
                callback_message="Сначала переоткройте обращение.",
                reason="ticket_closed",
            )
        if current_status in {"submitted", "failed"}:
            return TelegramActionOutcome(
                action="reply",
                delivery_status="rejected",
                ticket_status=current_status,
                message_kind=message_kind,
                operator_message="Обращение ещё не готово для ответа клиенту.",
                callback_message="Обращение ещё не готово.",
                reason="ticket_not_ready",
            )
        permission_error = _ticket_assignment_permission_error(
            ticket=ticket,
            telegram_user_id=incoming.user_id,
            operator_role=operator_role,
            allow_admin_override=False,
        )
        if permission_error:
            return TelegramActionOutcome(
                action="reply",
                delivery_status="rejected",
                ticket_status=current_status,
                message_kind=message_kind,
                operator_message=permission_error,
                callback_message="Ответ недоступен.",
                reason="ticket_assignment_mismatch",
            )
        normalized_reply = _clean_multiline(reply_text, max_length=_MAX_OPERATOR_REPLY_CHARS)
        if not normalized_reply:
            return TelegramActionOutcome(
                action="reply",
                delivery_status="rejected",
                ticket_status=current_status,
                message_kind=message_kind,
                operator_message="Используйте /reply <текст>, чтобы отправить ответ клиенту.",
                callback_message="Нужен текст ответа.",
                reason="reply_text_required",
            )
        if len(str(reply_text or "")) > _MAX_OPERATOR_REPLY_CHARS:
            return TelegramActionOutcome(
                action="reply",
                delivery_status="rejected",
                ticket_status=current_status,
                message_kind=message_kind,
                operator_message=(
                    f"Ответ слишком длинный. Ограничение — {_MAX_OPERATOR_REPLY_CHARS} символов."
                ),
                callback_message="Ответ слишком длинный.",
                reason="reply_too_long",
                content=normalized_reply,
            )
        now = datetime.now(timezone.utc)
        assigned_at = ticket.get("assigned_at") or now
        assistant_message_id = reservation.get("assistant_message_id") if reservation else None
        if assistant_message_id is None:
            assistant_message = await repository.add_message(
                session_id=handoff["session_id"],
                role="assistant",
                content=normalized_reply,
                intent="telegram_operator_reply",
                metadata={
                    "source": "telegram_operator",
                },
            )
            assistant_message_id = assistant_message.get("id")
            if reservation is not None:
                reservation = await self._record_webhook_update(
                    repository=repository,
                    handoff=handoff,
                    incoming=incoming,
                    delivery_status="processing",
                    message_kind=message_kind,
                    content=normalized_reply,
                    assistant_message_id=assistant_message_id,
                    operator_role=operator_role,
                    reason="operator_reply_pending",
                    reservation=reservation,
                )
        updated = await repository.update_handoff_ticket(
            handoff_id=handoff["id"],
            channel="telegram",
            ticket_status="waiting_customer",
            assigned_operator_id=ticket.get("assigned_operator_id") or incoming.user_id,
            assigned_operator_username=ticket.get("assigned_operator_username") or incoming.username,
            assigned_at=assigned_at,
            last_operator_message_at=now,
            last_telegram_update_id=incoming.update_id,
            last_sync_at=now,
        )
        return TelegramActionOutcome(
            action="reply",
            delivery_status="delivered",
            ticket_status=str(updated.get("ticket_status") or "waiting_customer"),
            message_kind=message_kind,
            operator_message="Ответ оператора добавлен в сессию ассистента.",
            callback_message="Ответ отправлен клиенту.",
            reason="operator_reply_delivered",
            assistant_message_id=assistant_message_id,
            content=normalized_reply,
        )

    async def _record_webhook_update(
        self,
        *,
        repository,
        handoff: dict[str, Any],
        incoming: TelegramIncomingUpdate,
        delivery_status: str,
        message_kind: str,
        content: str | None,
        operator_role: str | None,
        reason: str | None,
        assistant_message_id: Any = None,
        reservation: dict[str, Any] | None = None,
        extra_metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        metadata = self._handoff_message_metadata(
            incoming=incoming,
            operator_role=operator_role,
            reason=reason,
            extra_metadata=extra_metadata,
        )
        if reservation is not None and hasattr(repository, "update_handoff_message"):
            update_kwargs: dict[str, Any] = {
                "handoff_message_id": reservation["id"],
                "delivery_status": delivery_status,
                "message_kind": message_kind,
                "metadata": metadata,
            }
            if assistant_message_id is not None:
                update_kwargs["assistant_message_id"] = assistant_message_id
            if content is not None:
                update_kwargs["content"] = content
            return await repository.update_handoff_message(**update_kwargs)
        if not hasattr(repository, "create_handoff_message"):
            return reservation
        return await repository.create_handoff_message(
            handoff_id=handoff["id"],
            session_id=handoff["session_id"],
            telegram_chat_id=incoming.chat_id or "",
            telegram_topic_id=incoming.topic_id,
            telegram_message_id=incoming.message_id,
            telegram_update_id=incoming.update_id,
            direction="telegram_inbound",
            delivery_status=delivery_status,
            message_kind=message_kind,
            assistant_message_id=assistant_message_id,
            operator_telegram_user_id=incoming.user_id,
            operator_username=incoming.username,
            content=content,
            metadata=metadata,
        )

    async def _reserve_webhook_update(
        self,
        *,
        repository,
        handoff: dict[str, Any],
        ticket: dict[str, Any],
        incoming: TelegramIncomingUpdate,
    ) -> tuple[dict[str, Any] | None, TelegramWebhookProcessResult | None]:
        if hasattr(repository, "reserve_handoff_message"):
            record, reserved = await repository.reserve_handoff_message(
                handoff_id=handoff["id"],
                session_id=handoff["session_id"],
                telegram_chat_id=incoming.chat_id or "",
                telegram_topic_id=incoming.topic_id,
                telegram_message_id=incoming.message_id,
                telegram_update_id=incoming.update_id,
                direction="telegram_inbound",
                message_kind=f"{incoming.kind}_processing",
                operator_telegram_user_id=incoming.user_id,
                operator_username=incoming.username,
                content=incoming.text,
                metadata=self._handoff_message_metadata(
                    incoming=incoming,
                    operator_role=None,
                    reason="processing",
                ),
            )
            if reserved:
                return record, None
            return None, self._duplicate_webhook_result(
                ticket=ticket,
                handoff=handoff,
                incoming=incoming,
                existing=record,
            )

        if incoming.update_id is not None and hasattr(repository, "get_handoff_message_by_update_id"):
            existing = await repository.get_handoff_message_by_update_id(
                telegram_update_id=incoming.update_id,
            )
            if existing:
                return None, self._duplicate_webhook_result(
                    ticket=ticket,
                    handoff=handoff,
                    incoming=incoming,
                    existing=existing,
                )

        if (
            incoming.kind == "message"
            and incoming.message_id is not None
            and hasattr(repository, "get_handoff_message_by_message")
        ):
            existing_message = await repository.get_handoff_message_by_message(
                telegram_chat_id=incoming.chat_id,
                telegram_topic_id=incoming.topic_id,
                telegram_message_id=incoming.message_id,
                direction="telegram_inbound",
            )
            if existing_message:
                return None, self._duplicate_webhook_result(
                    ticket=ticket,
                    handoff=handoff,
                    incoming=incoming,
                    existing=existing_message,
                )

        return None, None

    async def _record_webhook_failure(
        self,
        *,
        repository,
        handoff: dict[str, Any],
        incoming: TelegramIncomingUpdate,
        reservation: dict[str, Any] | None,
        operator_role: str | None,
        error: Exception,
    ) -> None:
        error_detail = (
            self._error_detail(error)
            if isinstance(error, TelegramBotApiError)
            else error.__class__.__name__
        )
        await self._record_webhook_update(
            repository=repository,
            handoff=handoff,
            incoming=incoming,
            delivery_status="failed",
            message_kind=_as_str((reservation or {}).get("message_kind"))
            or f"{incoming.kind}_failed",
            content=None,
            operator_role=operator_role,
            reason="unexpected_error",
            reservation=reservation,
            extra_metadata={"error_detail": error_detail},
        )

    def _handoff_message_metadata(
        self,
        *,
        incoming: TelegramIncomingUpdate,
        operator_role: str | None,
        reason: str | None,
        extra_metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        metadata = {
            "reason": reason,
            "source": "telegram_operator",
            "operator_role": operator_role,
            "update_kind": incoming.kind,
            "callback_action": _parse_callback_action(incoming.callback_data)[0]
            if incoming.callback_data
            else None,
        }
        if extra_metadata:
            metadata.update(extra_metadata)
        return metadata

    def _duplicate_webhook_result(
        self,
        *,
        ticket: dict[str, Any],
        handoff: dict[str, Any],
        incoming: TelegramIncomingUpdate,
        existing: dict[str, Any],
    ) -> TelegramWebhookProcessResult:
        is_update_duplicate = incoming.update_id is not None
        return TelegramWebhookProcessResult(
            status="duplicate",
            action=_as_str(existing.get("message_kind")),
            handoff_id=str(ticket.get("handoff_id") or handoff.get("id") or ""),
            ticket_status=str(ticket.get("ticket_status") or "submitted"),
            message=(
                "Telegram update was already processed."
                if is_update_duplicate
                else "Telegram message was already processed."
            ),
            reason="duplicate_update" if is_update_duplicate else "duplicate_message",
            duplicate=True,
        )

    async def _safe_send_topic_message(
        self,
        *,
        token: str,
        chat_id: str,
        topic_id: int | None,
        text: str,
    ) -> None:
        if not token or not chat_id or topic_id is None or not text:
            return
        try:
            await self._api_client.send_message(
                token,
                chat_id,
                text,
                message_thread_id=topic_id,
            )
        except TelegramBotApiError as exc:
            structured_log(
                self._logger,
                logging.WARNING,
                "assistant.telegram_handoff.webhook_send_failed",
                reason="sendMessage",
                error_detail=self._error_detail(exc),
            )

    async def _safe_answer_callback_query(
        self,
        *,
        token: str,
        callback_query_id: str,
        text: str,
    ) -> None:
        if not token or not callback_query_id:
            return
        try:
            await self._api_client.answer_callback_query(
                token,
                callback_query_id,
                text=_truncate_text(text, max_length=_MAX_CALLBACK_ANSWER_CHARS),
            )
        except TelegramBotApiError as exc:
            structured_log(
                self._logger,
                logging.WARNING,
                "assistant.telegram_handoff.webhook_callback_failed",
                reason="answerCallbackQuery",
                error_detail=self._error_detail(exc),
            )

    async def _run_connection_smoke_test(
        self,
        *,
        token: str,
        support_chat_id: str,
        bot_membership: TelegramChatMembership,
    ) -> list[str]:
        if not bot_membership.can_delete_messages:
            return [
                "Topic-specific smoke test was skipped because the bot cannot delete forum topics for cleanup."
            ]

        topic = _forum_topic(
            await self._api_client.create_forum_topic(
                token,
                support_chat_id,
                _smoke_topic_title(),
            )
        )
        if topic.message_thread_id is None:
            raise TelegramBotApiError(
                method="createForumTopic",
                message="Telegram did not return the smoke-test topic identifier.",
            )

        try:
            await self._api_client.send_message(
                token,
                support_chat_id,
                _smoke_message_text(),
                message_thread_id=topic.message_thread_id,
            )
        except Exception:
            await self._cleanup_smoke_topic(
                token=token,
                support_chat_id=support_chat_id,
                topic_id=topic.message_thread_id,
            )
            raise

        return await self._cleanup_smoke_topic(
            token=token,
            support_chat_id=support_chat_id,
            topic_id=topic.message_thread_id,
        )

    async def _cleanup_smoke_topic(
        self,
        *,
        token: str,
        support_chat_id: str,
        topic_id: int,
    ) -> list[str]:
        try:
            await self._api_client.delete_forum_topic(
                token,
                support_chat_id,
                topic_id,
            )
            return []
        except TelegramBotApiError as delete_exc:
            try:
                await self._api_client.close_forum_topic(
                    token,
                    support_chat_id,
                    topic_id,
                )
                return [
                    "Smoke topic was created and verified, but cleanup could only close it instead of deleting it."
                ]
            except TelegramBotApiError:
                return [
                    "Smoke topic was created and verified, but cleanup failed: "
                    f"{self._error_message(delete_exc)}"
                ]

    def _success_message(self, warnings: list[str]) -> str:
        if warnings:
            return "Telegram connection test passed with warnings."
        return "Telegram connection test passed."

    def _failure(
        self,
        settings: TelegramHandoffRuntimeSettings,
        tested_at: datetime,
        message: str,
        *,
        bot: TelegramBotIdentity | None,
        support_chat: TelegramChatIdentity | None,
        webhook: TelegramWebhookState | None,
        bot_membership: TelegramChatMembership | None,
        reason: str = "validation_failed",
        error_detail: str | None = None,
    ) -> TelegramHandoffConnectionTestResult:
        result = TelegramHandoffConnectionTestResult(
            ok=False,
            status="connection_failed",
            message=message,
            tested_at=tested_at,
            diagnostics=settings.diagnostics,
            bot=bot,
            support_chat=support_chat,
            bot_membership=bot_membership,
            webhook=webhook,
        )
        self._log_result(
            logging.WARNING,
            "assistant.telegram_handoff.test_failed",
            settings,
            result,
            reason=reason,
            error_detail=error_detail,
        )
        return result

    def _log_result(
        self,
        level: int,
        event: str,
        settings: TelegramHandoffRuntimeSettings,
        result: TelegramHandoffConnectionTestResult,
        *,
        reason: str | None = None,
        error_detail: str | None = None,
    ) -> None:
        structured_log(
            self._logger,
            level,
            event,
            status=result.status,
            ok=result.ok,
            message=result.message,
            warnings=result.warnings,
            settings=settings.safe_repr(),
            bot=result.bot.model_dump(mode="json") if result.bot else None,
            support_chat=(
                result.support_chat.model_dump(mode="json")
                if result.support_chat
                else None
            ),
            bot_membership=(
                result.bot_membership.model_dump(mode="json")
                if result.bot_membership
                else None
            ),
            webhook=result.webhook.model_dump(mode="json") if result.webhook else None,
            reason=reason,
            error_detail=error_detail,
        )

    def _log_dispatch_result(
        self,
        level: int,
        event: str,
        *,
        handoff_id: str,
        session_id: str,
        result: TelegramHandoffDispatchResult,
        reason: str | None = None,
        error_detail: str | None = None,
    ) -> None:
        structured_log(
            self._logger,
            level,
            event,
            handoff_id=handoff_id,
            session_id=session_id,
            ticket_status=result.ticket_status,
            message=result.message,
            failure_reason=result.failure_reason,
            telegram_chat_id=result.telegram_chat_id,
            telegram_topic_id=result.telegram_topic_id,
            telegram_topic_title=result.telegram_topic_title,
            telegram_root_message_id=result.telegram_root_message_id,
            reason=reason,
            error_detail=error_detail,
        )

    def _error_message(self, exc: TelegramBotApiError) -> str:
        message = str(exc).strip()
        normalized = message.lower()
        if exc.error_code == 401 or "unauthorized" in normalized:
            return "Telegram bot token is invalid or revoked."
        if "chat not found" in normalized:
            return "Support chat was not found or the bot cannot access it."
        if "user not found" in normalized:
            return "Telegram bot is not a member of the configured support chat."
        if (
            "administrator rights" in normalized
            or "not enough rights" in normalized
            or "have no rights" in normalized
            or "member list is inaccessible" in normalized
        ):
            return "Telegram bot lacks the administrator rights required for handoff."
        if "network error" in normalized:
            return "Could not reach the Telegram Bot API."
        return f"Telegram API error during {exc.method}."

    def _error_detail(self, exc: TelegramBotApiError) -> str | None:
        detail = exc.detail or str(exc)
        sanitized = _sanitize_error_detail(detail)
        return sanitized or None


def _as_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        raw = value.strip()
        if raw.lstrip("-").isdigit():
            return int(raw)
    return None


def _as_str(value: Any) -> str | None:
    if value is None:
        return None
    raw = str(value).strip()
    return raw or None


def _bot_identity(raw: dict[str, Any]) -> TelegramBotIdentity:
    return TelegramBotIdentity(
        id=_as_int(raw.get("id")),
        username=_as_str(raw.get("username")),
        first_name=_as_str(raw.get("first_name")),
    )


def _chat_identity(raw: dict[str, Any]) -> TelegramChatIdentity:
    return TelegramChatIdentity(
        id=_as_str(raw.get("id")),
        type=_as_str(raw.get("type")),
        title=_as_str(raw.get("title")),
        username=_as_str(raw.get("username")),
        is_forum=bool(raw.get("is_forum")),
    )


def _chat_membership(raw: dict[str, Any]) -> TelegramChatMembership:
    return TelegramChatMembership(
        status=_as_str(raw.get("status")),
        can_manage_topics=bool(raw.get("can_manage_topics")),
        can_delete_messages=bool(raw.get("can_delete_messages")),
    )


def _webhook_state(
    raw: dict[str, Any],
    *,
    configured_url: str,
) -> TelegramWebhookState:
    return TelegramWebhookState(
        configured_url=configured_url,
        actual_url=_as_str(raw.get("url")),
        pending_update_count=_as_int(raw.get("pending_update_count")) or 0,
        last_error_message=_as_str(raw.get("last_error_message")),
    )


def _forum_topic(raw: dict[str, Any]) -> TelegramForumTopic:
    from_message = raw.get("from_message")
    from_message = from_message if isinstance(from_message, dict) else {}
    return TelegramForumTopic(
        message_thread_id=_as_int(raw.get("message_thread_id"))
        or _as_int(from_message.get("message_thread_id")),
        name=_as_str(raw.get("name")) or _as_str(from_message.get("name")),
    )


def _message_reference(raw: dict[str, Any]) -> TelegramMessageReference:
    return TelegramMessageReference(
        message_id=_as_int(raw.get("message_id")),
        message_thread_id=_as_int(raw.get("message_thread_id")),
    )


def _as_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        normalized = raw[:-1] + "+00:00" if raw.endswith("Z") else raw
        try:
            return datetime.fromisoformat(normalized)
        except ValueError:
            return None
    return None


_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")
_SENSITIVE_QUERY_RE = re.compile(
    r"([?&](?:token|secret|api[_-]?key|authorization)=)[^&\s]+",
    re.IGNORECASE,
)
_SENSITIVE_KV_RE = re.compile(
    r"\b(token|secret|api[_-]?key)\b(\s*[:=]\s*)[^\s,;]+",
    re.IGNORECASE,
)
_AUTH_BEARER_RE = re.compile(
    r"(authorization\s*:\s*bearer\s+|bearer\s+)[^\s,;]+",
    re.IGNORECASE,
)
_BOT_PATH_RE = re.compile(r"/bot[^/\s]+/", re.IGNORECASE)
_MAX_TOPIC_TITLE_CHARS = 128
_MAX_CARD_TEXT_CHARS = 3800
_MAX_TRANSCRIPT_MESSAGES = 6
_MAX_TRANSCRIPT_CHARS = 1200
_MAX_ERROR_DETAIL_CHARS = 240
_MAX_OPERATOR_REPLY_CHARS = 2000
_MAX_INTERNAL_NOTE_CHARS = 2000
_MAX_CALLBACK_ANSWER_CHARS = 180
_CALLBACK_RE = re.compile(r"^ht:([a-z_]+):([a-fA-F0-9]{1,32}|unknown)$")
_COMMAND_RE = re.compile(r"^/([a-z_]+)(?:@[A-Za-z0-9_]+)?(?:\s+(.*))?$", re.IGNORECASE)
_ATTACHMENT_FIELDS = (
    "photo",
    "document",
    "video",
    "audio",
    "voice",
    "sticker",
    "animation",
    "contact",
    "location",
    "poll",
    "venue",
)


def _handoff_short_id(value: Any) -> str:
    normalized = re.sub(r"[^A-Za-z0-9]", "", str(value or ""))
    return (normalized[:8] or "UNKNOWN").upper()


def _topic_title(handoff: dict[str, Any]) -> str:
    short_id = _handoff_short_id(handoff.get("id"))
    parts = [f"#{short_id}"]
    contact = _first_present(
        _clean_single_line(handoff.get("name"), max_length=40),
        _clean_single_line(handoff.get("email"), max_length=48),
        _clean_single_line(handoff.get("phone"), max_length=32),
    )
    if contact:
        parts.append(contact)
    reason = _first_present(
        _clean_single_line(handoff.get("reason"), max_length=36),
        _clean_single_line(handoff.get("summary"), max_length=48),
    )
    if reason:
        parts.append(reason)
    return _clean_single_line(
        " · ".join(parts),
        max_length=_MAX_TOPIC_TITLE_CHARS,
    ) or f"#{short_id}"


def _handoff_card_text(
    *,
    handoff: dict[str, Any],
    session: dict[str, Any] | None,
    transcript: list[dict[str, Any]],
    ticket_status: str,
) -> str:
    lines = [
        f"New support handoff #{_handoff_short_id(handoff.get('id'))}",
        f"Ticket status: {ticket_status}",
        f"Handoff ID: {handoff.get('id')}",
    ]
    _append_field(lines, "Name", handoff.get("name"))
    _append_field(lines, "Email", handoff.get("email"))
    _append_field(lines, "Phone", handoff.get("phone"))
    _append_field(lines, "Telegram contact", _telegram_contact(handoff.get("metadata")))
    _append_field(lines, "Store ID", handoff.get("store_id"))
    _append_field(lines, "Tenant ID", handoff.get("tenant_id"))
    _append_field(lines, "Locale", handoff.get("locale"))
    _append_field(lines, "Reason", handoff.get("reason"), multiline=False, max_length=240)
    _append_field(lines, "Summary", handoff.get("summary"), multiline=True, max_length=700)
    _append_field(lines, "Customer note", handoff.get("note"), multiline=True, max_length=700)

    session_customer_id = session.get("customer_id") if isinstance(session, dict) else None
    _append_field(lines, "Customer ID", session_customer_id, multiline=False, max_length=128)

    transcript_lines = _transcript_lines(transcript)
    if transcript_lines:
        lines.append("")
        lines.append("Recent assistant session messages:")
        lines.extend(transcript_lines)

    lines.append("")
    lines.extend(
        [
            "Operator commands:",
            "/status — show ticket state",
            "/claim — assign the ticket to yourself",
            "/reply <text> — send a customer-visible reply",
            "/note <text> — save an internal note only",
            "/close — close the ticket",
            "/reopen — reopen a closed ticket",
        ]
    )
    return _truncate_text("\n".join(lines), max_length=_MAX_CARD_TEXT_CHARS)


def _handoff_reply_markup(handoff_id: Any) -> dict[str, Any]:
    raw_id = re.sub(r"[^a-fA-F0-9]", "", str(handoff_id or ""))[:32] or "unknown"

    def callback(action: str) -> str:
        return f"ht:{action}:{raw_id}"[:64]

    return {
        "inline_keyboard": [
            [
                {"text": "Взять в работу", "callback_data": callback("take")},
                {"text": "Закрыть", "callback_data": callback("close")},
                {"text": "Статус", "callback_data": callback("status")},
            ]
        ]
    }


def _smoke_topic_title() -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return _clean_single_line(
        f"[TEST] Handoff smoke {timestamp}",
        max_length=_MAX_TOPIC_TITLE_CHARS,
    ) or "[TEST] Handoff smoke"


def _smoke_message_text() -> str:
    return (
        "Telegram handoff smoke test.\n"
        "This topic and message were created only to verify forum-topic delivery.\n"
        "Operator replies back to the storefront are not wired yet."
    )


def _append_field(
    lines: list[str],
    label: str,
    value: Any,
    *,
    multiline: bool = False,
    max_length: int = 400,
) -> None:
    cleaned = (
        _clean_multiline(value, max_length=max_length)
        if multiline
        else _clean_single_line(value, max_length=max_length)
    )
    if not cleaned:
        return
    if multiline and "\n" in cleaned:
        lines.append(f"{label}:")
        lines.extend(cleaned.splitlines())
        return
    lines.append(f"{label}: {cleaned}")


def _telegram_contact(metadata: Any) -> str | None:
    if not isinstance(metadata, dict):
        return None
    for key in (
        "telegram_contact",
        "telegram_username",
        "telegram_handle",
        "telegram",
    ):
        raw = metadata.get(key)
        value = _clean_single_line(raw, max_length=128)
        if not value:
            continue
        if "username" in key or "handle" in key:
            return value if value.startswith("@") else f"@{value}"
        return value
    return None


def _transcript_lines(messages: list[dict[str, Any]]) -> list[str]:
    if not messages:
        return []
    lines: list[str] = []
    remaining = _MAX_TRANSCRIPT_CHARS
    for message in messages[-_MAX_TRANSCRIPT_MESSAGES:]:
        if remaining <= 0:
            break
        role = _role_label(message.get("role"))
        content = _clean_multiline(message.get("content"), max_length=min(320, remaining))
        if not content:
            continue
        line = f"- {role}: {content.replace(chr(10), ' / ')}"
        line = _truncate_text(line, max_length=remaining)
        lines.append(line)
        remaining -= len(line) + 1
    return lines


def _role_label(value: Any) -> str:
    normalized = _as_str(value) or "message"
    return {
        "user": "Customer",
        "assistant": "Assistant",
        "tool": "Tool",
        "system": "System",
    }.get(normalized, normalized.capitalize())


def _clean_single_line(value: Any, *, max_length: int) -> str | None:
    if value is None:
        return None
    raw = _CONTROL_CHARS_RE.sub(" ", str(value))
    normalized = " ".join(raw.split())
    if not normalized:
        return None
    return _truncate_text(normalized, max_length=max_length)


def _clean_multiline(value: Any, *, max_length: int) -> str | None:
    if value is None:
        return None
    raw = _CONTROL_CHARS_RE.sub(" ", str(value).replace("\r\n", "\n").replace("\r", "\n"))
    normalized_lines = [" ".join(line.split()) for line in raw.split("\n")]
    normalized = "\n".join(line for line in normalized_lines if line)
    if not normalized:
        return None
    return _truncate_text(normalized, max_length=max_length)


def _truncate_text(value: str, *, max_length: int) -> str:
    if len(value) <= max_length:
        return value
    if max_length <= 1:
        return value[:max_length]
    return value[: max_length - 1].rstrip() + "…"


def _first_present(*values: str | None) -> str | None:
    for value in values:
        if value:
            return value
    return None


def _sanitize_error_detail(value: Any) -> str | None:
    if value is None:
        return None
    text = _CONTROL_CHARS_RE.sub(" ", str(value))
    text = _AUTH_BEARER_RE.sub("[REDACTED_AUTH]", text)
    text = _SENSITIVE_QUERY_RE.sub(
        lambda match: f"{match.group(1)}[REDACTED]",
        text,
    )
    text = _SENSITIVE_KV_RE.sub(
        lambda match: f"{match.group(1)}{match.group(2)}[REDACTED]",
        text,
    )
    text = _BOT_PATH_RE.sub("/bot[REDACTED]/", text)
    normalized = " ".join(text.split())
    if not normalized:
        return None
    return _truncate_text(normalized, max_length=_MAX_ERROR_DETAIL_CHARS)


def _missing_connection_fields(
    settings: TelegramHandoffRuntimeSettings,
) -> list[str]:
    missing_fields: list[str] = []
    if not settings.has_bot_token:
        missing_fields.append("bot_token")
    if not settings.has_webhook_secret:
        missing_fields.append("webhook_secret")
    if not settings.support_chat_id:
        missing_fields.append("support_chat_id")
    if not settings.topics_required:
        missing_fields.append("topics_required")
    if not settings.webhook_url:
        missing_fields.append("webhook_url")
    if settings.environment_mode == "production" and not settings.has_operator_acl:
        missing_fields.append("allowed_operator_ids_or_allowed_admin_ids")
    return missing_fields


def constant_time_secret_matches(expected: str | None, actual: str | None) -> bool:
    if not expected or not actual:
        return False
    return secrets.compare_digest(str(actual), str(expected))


def _parse_telegram_update(update: dict[str, Any] | None) -> TelegramIncomingUpdate | None:
    if not isinstance(update, dict):
        return None
    update_id = _as_int(update.get("update_id"))
    callback = update.get("callback_query")
    if isinstance(callback, dict):
        message = callback.get("message")
        message = message if isinstance(message, dict) else {}
        chat = message.get("chat")
        chat = chat if isinstance(chat, dict) else {}
        from_user = callback.get("from")
        from_user = from_user if isinstance(from_user, dict) else {}
        return TelegramIncomingUpdate(
            kind="callback",
            update_id=update_id,
            chat_id=_as_str(chat.get("id")),
            topic_id=_as_int(message.get("message_thread_id")),
            message_id=_as_int(message.get("message_id")),
            user_id=_as_str(from_user.get("id")),
            username=_as_str(from_user.get("username")),
            callback_query_id=_as_str(callback.get("id")),
            callback_data=_as_str(callback.get("data")),
        )
    message = update.get("message")
    if not isinstance(message, dict):
        return None
    chat = message.get("chat")
    chat = chat if isinstance(chat, dict) else {}
    from_user = message.get("from")
    from_user = from_user if isinstance(from_user, dict) else {}
    if bool(from_user.get("is_bot")):
        return None
    return TelegramIncomingUpdate(
        kind="message",
        update_id=update_id,
        chat_id=_as_str(chat.get("id")),
        topic_id=_as_int(message.get("message_thread_id")),
        message_id=_as_int(message.get("message_id")),
        user_id=_as_str(from_user.get("id")),
        username=_as_str(from_user.get("username")),
        text=_as_str(message.get("text")),
        has_attachment=any(message.get(field) for field in _ATTACHMENT_FIELDS),
    )


def _parse_telegram_command(text: str | None) -> tuple[str | None, str | None]:
    raw = _as_str(text)
    if not raw:
        return None, None
    match = _COMMAND_RE.match(raw)
    if not match:
        return None, None
    command = (match.group(1) or "").strip().lower()
    argument = match.group(2)
    return command or None, argument.strip() if isinstance(argument, str) else None


def _parse_callback_action(callback_data: str | None) -> tuple[str | None, str | None]:
    raw = _as_str(callback_data)
    if not raw:
        return None, None
    match = _CALLBACK_RE.match(raw)
    if not match:
        return None, None
    action = (match.group(1) or "").strip().lower()
    if action == "take":
        action = "claim"
    token = (match.group(2) or "").strip().lower() or None
    return action or None, token


def _callback_token_matches_handoff(*, callback_token: str, handoff_id: Any) -> bool:
    normalized_handoff = re.sub(r"[^a-fA-F0-9]", "", str(handoff_id or "")).lower()
    normalized_token = re.sub(r"[^a-fA-F0-9]", "", str(callback_token or "")).lower()
    if not normalized_token or not normalized_handoff:
        return False
    return normalized_handoff.startswith(normalized_token)


def _telegram_operator_role(
    settings: TelegramHandoffRuntimeSettings,
    *,
    telegram_user_id: str | None,
) -> str | None:
    if not telegram_user_id:
        return None
    if telegram_user_id in settings.allowed_admin_user_ids:
        return "admin"
    if telegram_user_id in settings.allowed_operator_user_ids:
        return "operator"
    return None


def _ticket_assignment_permission_error(
    *,
    ticket: dict[str, Any],
    telegram_user_id: str | None,
    operator_role: str,
    allow_admin_override: bool,
) -> str | None:
    assigned_operator_id = _as_str(ticket.get("assigned_operator_id"))
    if not assigned_operator_id or assigned_operator_id == telegram_user_id:
        return None
    if allow_admin_override and operator_role == "admin":
        return None
    return "Обращение уже назначено другому оператору."


def _ticket_status_text(*, ticket: dict[str, Any], handoff: dict[str, Any]) -> str:
    assigned_operator_id = _as_str(ticket.get("assigned_operator_id"))
    assigned_operator_username = _as_str(ticket.get("assigned_operator_username"))
    assigned_label = (
        f"@{assigned_operator_username}"
        if assigned_operator_username
        else f"ID {assigned_operator_id}"
        if assigned_operator_id
        else "unassigned"
    )
    last_activity = _first_present_datetime(
        ticket.get("last_operator_message_at"),
        ticket.get("last_customer_message_at"),
        ticket.get("last_sync_at"),
        ticket.get("closed_at"),
        ticket.get("assigned_at"),
        ticket.get("opened_at"),
        handoff.get("created_at"),
    )
    lines = [
        f"Ticket status: {ticket.get('ticket_status') or 'submitted'}",
        f"Assigned operator: {assigned_label}",
        f"Handoff ID: {handoff.get('id')}",
        f"Session ID: {handoff.get('session_id')}",
    ]
    if handoff.get("created_at"):
        lines.append(f"Opened at: {_format_datetime(handoff.get('created_at'))}")
    if last_activity is not None:
        lines.append(f"Last activity: {_format_datetime(last_activity)}")
    return "\n".join(lines)


def _first_present_datetime(*values: Any) -> datetime | None:
    for value in values:
        candidate = _as_datetime(value)
        if candidate is not None:
            return candidate
    return None


def _format_datetime(value: Any) -> str:
    timestamp = _as_datetime(value)
    if timestamp is None:
        return "unknown"
    return timestamp.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


__all__ = [
    "TelegramBotApiClient",
    "TelegramBotApiError",
    "TelegramBotIdentity",
    "TelegramChatIdentity",
    "TelegramChatMembership",
    "TelegramHandoffConnectionTestResult",
    "TelegramHandoffDispatchResult",
    "TelegramForumTopic",
    "TelegramMessageReference",
    "TelegramHandoffService",
    "TelegramWebhookProcessResult",
    "TelegramWebhookState",
    "constant_time_secret_matches",
]
