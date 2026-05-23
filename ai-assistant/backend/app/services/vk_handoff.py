from __future__ import annotations

import logging
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import httpx
from pydantic import BaseModel, ConfigDict, Field

from app.services.settings_provider import VkHandoffDiagnostics, VkHandoffRuntimeSettings


class VkApiError(RuntimeError):
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


class VkGroupIdentity(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str | None = None
    name: str | None = None
    screen_name: str | None = None


class VkWebhookState(BaseModel):
    model_config = ConfigDict(extra="ignore")

    configured_url: str | None = None
    confirmation_code_matches: bool | None = None


class VkHandoffConnectionTestResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    ok: bool
    status: str
    message: str
    warnings: list[str] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)
    tested_at: datetime
    diagnostics: VkHandoffDiagnostics = Field(default_factory=VkHandoffDiagnostics)
    group: VkGroupIdentity | None = None
    webhook: VkWebhookState | None = None


class VkHandoffDispatchResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    channel: str = "vk"
    ticket_status: str
    message: str | None = None
    failure_reason: str | None = None
    external_chat_id: str | None = None
    external_thread_id: str | None = None
    external_thread_title: str | None = None
    external_root_message_id: str | None = None
    opened_at: datetime | None = None
    last_sync_at: datetime


class VkWebhookProcessResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    response_text: str = "ok"
    status: str
    action: str | None = None
    handoff_id: str | None = None
    ticket_status: str | None = None
    message: str | None = None
    reason: str | None = None
    duplicate: bool = False


@dataclass(slots=True)
class VkIncomingMessage:
    event_type: str
    peer_id: str | None
    message_id: str | None
    user_id: str | None
    username: str | None
    text: str | None = None
    has_attachment: bool = False


@dataclass(slots=True)
class VkActionOutcome:
    action: str
    delivery_status: str
    ticket_status: str
    message_kind: str
    operator_message: str | None = None
    reason: str | None = None
    assistant_message_id: Any = None
    content: str | None = None


class VkApiClient:
    def __init__(
        self,
        *,
        base_url: str = "https://api.vk.com",
        api_version: str = "5.199",
        timeout_seconds: float = 10.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_version = api_version
        self._timeout_seconds = timeout_seconds
        self._client = client
        self._owns_client = client is None
        self._closed = False

    async def get_group(self, token: str, group_id: str) -> dict[str, Any]:
        payload = await self._call(
            token,
            "groups.getById",
            {"group_id": group_id},
        )
        if isinstance(payload, dict):
            groups = payload.get("groups")
            if isinstance(groups, list) and groups and isinstance(groups[0], dict):
                return groups[0]
            if "id" in payload:
                return payload
        if isinstance(payload, list) and payload and isinstance(payload[0], dict):
            return payload[0]
        raise VkApiError(
            method="groups.getById",
            message="VK did not return the target group.",
        )

    async def get_callback_confirmation_code(self, token: str, group_id: str) -> str:
        payload = await self._call(
            token,
            "groups.getCallbackConfirmationCode",
            {"group_id": group_id},
        )
        if isinstance(payload, str):
            return payload.strip()
        if isinstance(payload, dict):
            value = payload.get("code") or payload.get("confirmation_code")
            if isinstance(value, str):
                return value.strip()
        raise VkApiError(
            method="groups.getCallbackConfirmationCode",
            message="VK did not return a callback confirmation code.",
        )

    async def send_message(
        self,
        token: str,
        *,
        group_id: str,
        peer_id: str,
        message: str,
        random_id: str,
    ) -> str:
        payload = await self._call(
            token,
            "messages.send",
            {
                "group_id": group_id,
                "peer_id": peer_id,
                "random_id": random_id,
                "message": message,
            },
        )
        if isinstance(payload, (int, str)):
            return str(payload)
        if isinstance(payload, dict):
            for key in ("message_id", "conversation_message_id", "id"):
                value = payload.get(key)
                if value is not None:
                    return str(value)
        raise VkApiError(
            method="messages.send",
            message="VK did not return a message identifier.",
        )

    async def aclose(self) -> None:
        if self._closed:
            return
        self._closed = True
        if self._owns_client and self._client is not None:
            await self._client.aclose()

    async def _call(
        self,
        token: str,
        method: str,
        params: dict[str, Any] | None = None,
    ) -> Any:
        client = self._client
        if client is None:
            client = httpx.AsyncClient(timeout=self._timeout_seconds)
            self._client = client

        data = {
            "access_token": token,
            "v": self._api_version,
        }
        for key, value in (params or {}).items():
            if value is None:
                continue
            data[key] = str(value)

        try:
            response = await client.post(
                f"{self._base_url}/method/{method}",
                data=data,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                },
            )
        except httpx.HTTPError as exc:
            raise VkApiError(
                method=method,
                message="Could not reach the VK API.",
                detail=exc.__class__.__name__,
            ) from exc

        try:
            payload = response.json()
        except ValueError as exc:
            raise VkApiError(
                method=method,
                message="VK API response is not valid JSON.",
                status_code=response.status_code,
                detail=response.text[:200],
            ) from exc

        if not response.is_success:
            raise VkApiError(
                method=method,
                message=f"VK API returned HTTP {response.status_code}.",
                status_code=response.status_code,
                detail=response.text[:200],
            )

        if not isinstance(payload, dict):
            raise VkApiError(
                method=method,
                message="VK API response root is not an object.",
                status_code=response.status_code,
            )

        error = payload.get("error")
        if isinstance(error, dict):
            error_msg = _as_str(error.get("error_msg")) or "Unknown VK API error."
            raise VkApiError(
                method=method,
                message=error_msg,
                status_code=response.status_code,
                error_code=_as_int(error.get("error_code")),
                detail=error_msg,
            )

        if "response" not in payload:
            raise VkApiError(
                method=method,
                message="VK API response does not include a response payload.",
                status_code=response.status_code,
            )
        return payload["response"]


class VkHandoffService:
    def __init__(
        self,
        *,
        api_client: VkApiClient | None = None,
    ) -> None:
        self._api_client = api_client or VkApiClient()
        self._logger = logging.getLogger("assistant.vk_handoff")

    async def aclose(self) -> None:
        await self._api_client.aclose()

    async def test_connection(
        self,
        settings: VkHandoffRuntimeSettings,
    ) -> VkHandoffConnectionTestResult:
        tested_at = datetime.now(timezone.utc)
        diagnostics = settings.diagnostics
        webhook = VkWebhookState(configured_url=settings.webhook_url)

        if not settings.enabled:
            return VkHandoffConnectionTestResult(
                ok=False,
                status="disabled",
                message="VK handoff is disabled.",
                tested_at=tested_at,
                diagnostics=diagnostics,
                webhook=webhook,
            )

        if not settings.is_ready_for_connection_test:
            missing_fields = list(diagnostics.missing_fields) or _missing_connection_fields(
                settings
            )
            return VkHandoffConnectionTestResult(
                ok=False,
                status="missing_credentials",
                message=(
                    "Missing required VK handoff configuration: "
                    f"{', '.join(missing_fields)}"
                ),
                missing_fields=missing_fields,
                tested_at=tested_at,
                diagnostics=diagnostics,
                webhook=webhook,
            )

        token = settings.community_access_token or ""
        group_id = settings.group_id or ""
        support_peer_id = settings.support_peer_id or ""
        group: VkGroupIdentity | None = None
        warnings: list[str] = []

        try:
            group = _group_identity(await self._api_client.get_group(token, group_id))
            confirmation_code = await self._api_client.get_callback_confirmation_code(
                token,
                group_id,
            )
            webhook.confirmation_code_matches = constant_time_secret_matches(
                settings.confirmation_code,
                confirmation_code,
            )
            if webhook.confirmation_code_matches is not True:
                return VkHandoffConnectionTestResult(
                    ok=False,
                    status="connection_failed",
                    message="Saved VK confirmation_code does not match the current callback confirmation code.",
                    tested_at=tested_at,
                    diagnostics=diagnostics,
                    group=group,
                    webhook=webhook,
                )

            if settings.environment_mode == "production":
                await self._api_client.send_message(
                    token,
                    group_id=group_id,
                    peer_id=support_peer_id,
                    message=_smoke_message_text(),
                    random_id=_random_id(),
                )
                status = "connection_ok"
                message = "VK handoff connection test passed."
            else:
                status = "dry_run_passed"
                message = "VK handoff dry-run passed."

            return VkHandoffConnectionTestResult(
                ok=True,
                status=status,
                message=message,
                warnings=warnings,
                tested_at=tested_at,
                diagnostics=diagnostics,
                group=group,
                webhook=webhook,
            )
        except VkApiError as exc:
            return VkHandoffConnectionTestResult(
                ok=False,
                status="connection_failed",
                message=str(exc),
                tested_at=tested_at,
                diagnostics=diagnostics,
                group=group,
                webhook=webhook,
            )
        except Exception:
            return VkHandoffConnectionTestResult(
                ok=False,
                status="connection_failed",
                message="Unexpected error while testing the VK handoff connection.",
                tested_at=tested_at,
                diagnostics=diagnostics,
                group=group,
                webhook=webhook,
            )

    async def dispatch_handoff(
        self,
        *,
        settings: VkHandoffRuntimeSettings,
        handoff: dict[str, Any],
        session: dict[str, Any] | None,
        transcript: list[dict[str, Any]] | None = None,
        existing_ticket: dict[str, Any] | None = None,
    ) -> VkHandoffDispatchResult:
        synced_at = datetime.now(timezone.utc)
        short_id = _handoff_short_id(handoff.get("id"))

        if not settings.enabled:
            return VkHandoffDispatchResult(
                ticket_status="submitted",
                message="Handoff was saved without VK delivery because VK is disabled.",
                last_sync_at=synced_at,
            )

        if not settings.is_configured:
            return VkHandoffDispatchResult(
                ticket_status="submitted",
                message=(
                    "Handoff was saved without VK delivery because VK settings are incomplete."
                ),
                last_sync_at=synced_at,
            )

        if _ticket_has_open_link(existing_ticket):
            return VkHandoffDispatchResult(
                ticket_status="open",
                message="VK ticket already exists for this handoff.",
                external_chat_id=_as_str((existing_ticket or {}).get("external_chat_id"))
                or settings.support_peer_id,
                external_thread_id=_as_str((existing_ticket or {}).get("external_thread_id"))
                or short_id,
                external_thread_title=_as_str((existing_ticket or {}).get("external_thread_title"))
                or f"#{short_id}",
                external_root_message_id=_as_str(
                    (existing_ticket or {}).get("external_root_message_id")
                ),
                opened_at=_as_datetime((existing_ticket or {}).get("opened_at")),
                last_sync_at=_as_datetime((existing_ticket or {}).get("last_sync_at"))
                or synced_at,
            )

        try:
            root_message_id = await self._api_client.send_message(
                settings.community_access_token or "",
                group_id=settings.group_id or "",
                peer_id=settings.support_peer_id or "",
                message=_handoff_card_text(
                    handoff=handoff,
                    session=session,
                    transcript=transcript or [],
                    ticket_status="open",
                ),
                random_id=_random_id(),
            )
            return VkHandoffDispatchResult(
                ticket_status="open",
                message="VK ticket created for this handoff.",
                external_chat_id=settings.support_peer_id,
                external_thread_id=short_id,
                external_thread_title=f"#{short_id}",
                external_root_message_id=root_message_id,
                opened_at=synced_at,
                last_sync_at=synced_at,
            )
        except VkApiError as exc:
            return VkHandoffDispatchResult(
                ticket_status="failed",
                message="VK handoff ticket creation failed.",
                failure_reason=str(exc),
                last_sync_at=synced_at,
            )
        except Exception:
            return VkHandoffDispatchResult(
                ticket_status="failed",
                message="VK handoff ticket creation failed.",
                failure_reason="Unexpected error while contacting the VK API.",
                last_sync_at=synced_at,
            )

    async def process_webhook_event(
        self,
        *,
        settings: VkHandoffRuntimeSettings,
        repository,
        event: dict[str, Any],
    ) -> VkWebhookProcessResult:
        event_type = _as_str((event or {}).get("type"))
        if _payload_group_id(event) != _as_str(settings.group_id):
            return VkWebhookProcessResult(
                status="ignored",
                reason="group_mismatch",
            )
        if event_type == "confirmation":
            return VkWebhookProcessResult(
                response_text=settings.confirmation_code or "",
                status="confirmation",
            )

        if event_type != "message_new":
            return VkWebhookProcessResult(
                status="ignored",
                reason="unsupported_event",
            )

        incoming = _parse_vk_message(event)
        if incoming is None:
            return VkWebhookProcessResult(
                status="ignored",
                reason="unsupported_message",
            )

        if incoming.peer_id != settings.support_peer_id:
            return VkWebhookProcessResult(
                status="ignored",
                reason="peer_mismatch",
            )

        command_name, ticket_token, argument = _parse_vk_command(incoming.text)
        webhook_receipt, reserved = await self._reserve_webhook_receipt(
            repository=repository,
            incoming=incoming,
            command_name=command_name,
            ticket_token=ticket_token,
        )
        if not reserved:
            return VkWebhookProcessResult(
                status="duplicate",
                action=command_name,
                reason="duplicate_update",
                duplicate=True,
            )

        try:
            if command_name is None:
                await self._safe_send_message(
                    settings=settings,
                    peer_id=incoming.peer_id or "",
                    text=(
                        "Используйте /status <ticket_id>, /claim <ticket_id>, "
                        "/reply <ticket_id> <текст>, /note <ticket_id> <текст>, "
                        "/close <ticket_id> или /reopen <ticket_id>."
                    ),
                )
                await self._update_webhook_receipt(
                    repository=repository,
                    receipt=webhook_receipt,
                    delivery_status="ignored",
                    message_kind="ticket_command_required",
                    metadata=_webhook_receipt_metadata(
                        command_name=command_name,
                        ticket_token=ticket_token,
                        reason="ticket_command_required",
                    ),
                )
                return VkWebhookProcessResult(
                    status="ignored",
                    reason="ticket_command_required",
                )

            if ticket_token is None:
                await self._safe_send_message(
                    settings=settings,
                    peer_id=incoming.peer_id or "",
                    text="Укажите ticket id после команды, например: /reply ABCD1234 Текст ответа",
                )
                await self._update_webhook_receipt(
                    repository=repository,
                    receipt=webhook_receipt,
                    delivery_status="ignored",
                    message_kind="ticket_id_required",
                    metadata=_webhook_receipt_metadata(
                        command_name=command_name,
                        ticket_token=ticket_token,
                        reason="ticket_id_required",
                    ),
                )
                return VkWebhookProcessResult(
                    status="ignored",
                    reason="ticket_id_required",
                )

            if not hasattr(repository, "find_handoff_ticket_by_external_thread"):
                await self._update_webhook_receipt(
                    repository=repository,
                    receipt=webhook_receipt,
                    delivery_status="ignored",
                    message_kind="repository_missing_external_thread_lookup",
                    metadata=_webhook_receipt_metadata(
                        command_name=command_name,
                        ticket_token=ticket_token,
                        reason="repository_missing_external_thread_lookup",
                    ),
                )
                return VkWebhookProcessResult(
                    status="ignored",
                    reason="repository_missing_external_thread_lookup",
                )

            ticket = await repository.find_handoff_ticket_by_external_thread(
                channel="vk",
                external_chat_id=incoming.peer_id or "",
                external_thread_id=ticket_token,
            )
            if not ticket:
                await self._safe_send_message(
                    settings=settings,
                    peer_id=incoming.peer_id or "",
                    text=f"Тикет #{ticket_token} не найден.",
                )
                await self._update_webhook_receipt(
                    repository=repository,
                    receipt=webhook_receipt,
                    delivery_status="ignored",
                    message_kind="ticket_not_found",
                    metadata=_webhook_receipt_metadata(
                        command_name=command_name,
                        ticket_token=ticket_token,
                        reason="ticket_not_found",
                    ),
                )
                return VkWebhookProcessResult(
                    status="ignored",
                    reason="ticket_not_found",
                )

            if not hasattr(repository, "get_handoff"):
                await self._update_webhook_receipt(
                    repository=repository,
                    receipt=webhook_receipt,
                    delivery_status="ignored",
                    message_kind="repository_missing_handoff_lookup",
                    metadata=_webhook_receipt_metadata(
                        command_name=command_name,
                        ticket_token=ticket_token,
                        reason="repository_missing_handoff_lookup",
                    ),
                )
                return VkWebhookProcessResult(
                    status="ignored",
                    reason="repository_missing_handoff_lookup",
                )
            handoff = await repository.get_handoff(ticket["handoff_id"])
            if not handoff:
                await self._update_webhook_receipt(
                    repository=repository,
                    receipt=webhook_receipt,
                    delivery_status="ignored",
                    message_kind="handoff_not_found",
                    metadata=_webhook_receipt_metadata(
                        command_name=command_name,
                        ticket_token=ticket_token,
                        reason="handoff_not_found",
                    ),
                )
                return VkWebhookProcessResult(
                    status="ignored",
                    reason="handoff_not_found",
                )

            reservation: dict[str, Any] | None = None
            if hasattr(repository, "reserve_external_handoff_message"):
                reservation, reserved = await repository.reserve_external_handoff_message(
                    handoff_id=handoff["id"],
                    session_id=handoff["session_id"],
                    channel="vk",
                    external_chat_id=incoming.peer_id or "",
                    external_thread_id=ticket_token,
                    external_message_id=incoming.message_id,
                    external_event_id=incoming.message_id,
                    direction="vk_inbound",
                    message_kind="message_processing",
                    operator_external_user_id=incoming.user_id,
                    operator_username=incoming.username,
                    content=incoming.text,
                    metadata={"ticket_id": ticket_token},
                )
                if not reserved:
                    await self._update_webhook_receipt(
                        repository=repository,
                        receipt=webhook_receipt,
                        delivery_status="duplicate",
                        message_kind="duplicate_update",
                        metadata=_webhook_receipt_metadata(
                            command_name=command_name,
                            ticket_token=ticket_token,
                            reason="duplicate_update",
                        ),
                    )
                    return VkWebhookProcessResult(
                        status="duplicate",
                        action=command_name,
                        handoff_id=str(handoff.get("id") or ""),
                        ticket_status=str(ticket.get("ticket_status") or "submitted"),
                        reason="duplicate_update",
                        duplicate=True,
                    )

            operator_role = _vk_operator_role(settings, incoming.user_id)
            if operator_role is None:
                await self._record_webhook_update(
                    repository=repository,
                    handoff=handoff,
                    ticket=ticket,
                    incoming=incoming,
                    ticket_token=ticket_token,
                    delivery_status="rejected",
                    message_kind="command_unauthorized",
                    content=incoming.text,
                    operator_role=None,
                    reason="operator_not_allowed",
                    reservation=reservation,
                )
                await self._update_webhook_receipt(
                    repository=repository,
                    receipt=webhook_receipt,
                    delivery_status="rejected",
                    message_kind="command_unauthorized",
                    metadata=_webhook_receipt_metadata(
                        command_name=command_name,
                        ticket_token=ticket_token,
                        reason="operator_not_allowed",
                    ),
                )
                await self._safe_send_message(
                    settings=settings,
                    peer_id=incoming.peer_id or "",
                    text="Недостаточно прав для работы с этим обращением.",
                )
                return VkWebhookProcessResult(
                    status="processed",
                    action=command_name,
                    handoff_id=str(handoff.get("id") or ""),
                    ticket_status=str(ticket.get("ticket_status") or "submitted"),
                    reason="operator_not_allowed",
                )

            outcome = await self._execute_ticket_action(
                repository=repository,
                handoff=handoff,
                ticket=ticket,
                incoming=incoming,
                operator_role=operator_role,
                action=command_name,
                argument=argument,
                ticket_token=ticket_token,
                reservation=reservation,
            )
            if outcome.operator_message:
                await self._safe_send_message(
                    settings=settings,
                    peer_id=incoming.peer_id or "",
                    text=outcome.operator_message,
                )
            await self._record_webhook_update(
                repository=repository,
                handoff=handoff,
                ticket=ticket,
                incoming=incoming,
                ticket_token=ticket_token,
                delivery_status=outcome.delivery_status,
                message_kind=outcome.message_kind,
                content=outcome.content,
                operator_role=operator_role,
                reason=outcome.reason,
                assistant_message_id=outcome.assistant_message_id,
                reservation=reservation,
            )
            await self._update_webhook_receipt(
                repository=repository,
                receipt=webhook_receipt,
                delivery_status=outcome.delivery_status,
                message_kind=outcome.message_kind,
                metadata=_webhook_receipt_metadata(
                    command_name=command_name,
                    ticket_token=ticket_token,
                    reason=outcome.reason,
                ),
            )
            return VkWebhookProcessResult(
                status="processed",
                action=outcome.action,
                handoff_id=str(handoff.get("id") or ""),
                ticket_status=outcome.ticket_status,
                message=outcome.reason or outcome.operator_message,
                reason=outcome.reason,
            )
        except Exception:
            await self._update_webhook_receipt(
                repository=repository,
                receipt=webhook_receipt,
                delivery_status="failed",
                message_kind="message_failed",
                metadata=_webhook_receipt_metadata(
                    command_name=command_name,
                    ticket_token=ticket_token,
                    reason="unexpected_exception",
                ),
            )
            raise

    async def _execute_ticket_action(
        self,
        *,
        repository,
        handoff: dict[str, Any],
        ticket: dict[str, Any],
        incoming: VkIncomingMessage,
        operator_role: str,
        action: str,
        argument: str | None,
        ticket_token: str,
        reservation: dict[str, Any] | None,
    ) -> VkActionOutcome:
        normalized_action = {"take": "claim"}.get(action, action)
        if normalized_action == "status":
            return VkActionOutcome(
                action="status",
                delivery_status="reported",
                ticket_status=str(ticket.get("ticket_status") or "submitted"),
                message_kind="command_status",
                operator_message=_ticket_status_text(ticket=ticket, handoff=handoff),
                reason="status_reported",
            )
        if normalized_action == "claim":
            return await self._claim_ticket(
                repository=repository,
                ticket=ticket,
                handoff=handoff,
                incoming=incoming,
                operator_role=operator_role,
            )
        if normalized_action == "close":
            return await self._close_ticket(
                repository=repository,
                ticket=ticket,
                handoff=handoff,
                incoming=incoming,
                operator_role=operator_role,
            )
        if normalized_action == "reopen":
            return await self._reopen_ticket(
                repository=repository,
                ticket=ticket,
                handoff=handoff,
                incoming=incoming,
                operator_role=operator_role,
            )
        if normalized_action == "note":
            return await self._save_internal_note(
                repository=repository,
                ticket=ticket,
                handoff=handoff,
                incoming=incoming,
                operator_role=operator_role,
                note_text=argument,
            )
        if normalized_action == "reply":
            return await self._deliver_operator_reply(
                repository=repository,
                ticket=ticket,
                handoff=handoff,
                incoming=incoming,
                operator_role=operator_role,
                reply_text=argument,
                reservation=reservation,
            )
        return VkActionOutcome(
            action=normalized_action,
            delivery_status="ignored",
            ticket_status=str(ticket.get("ticket_status") or "submitted"),
            message_kind="command_unsupported",
            operator_message=(
                f"Неизвестная команда для тикета #{ticket_token} была проигнорирована."
            ),
            reason="unsupported_action",
        )

    async def _claim_ticket(
        self,
        *,
        repository,
        ticket: dict[str, Any],
        handoff: dict[str, Any],
        incoming: VkIncomingMessage,
        operator_role: str,
    ) -> VkActionOutcome:
        current_status = str(ticket.get("ticket_status") or "submitted")
        assigned_operator_id = _as_str(ticket.get("assigned_operator_id"))
        if current_status == "closed":
            return VkActionOutcome(
                action="claim",
                delivery_status="rejected",
                ticket_status=current_status,
                message_kind="command_claim",
                operator_message="Обращение закрыто. Используйте /reopen перед /claim.",
                reason="ticket_closed",
            )
        if assigned_operator_id and assigned_operator_id != incoming.user_id:
            return VkActionOutcome(
                action="claim",
                delivery_status="rejected",
                ticket_status=current_status,
                message_kind="command_claim",
                operator_message="Обращение уже назначено другому оператору.",
                reason="ticket_assigned_to_other_operator",
            )
        if assigned_operator_id == incoming.user_id:
            return VkActionOutcome(
                action="claim",
                delivery_status="noop",
                ticket_status=current_status,
                message_kind="command_claim",
                operator_message="Обращение уже назначено вам.",
                reason="ticket_already_claimed",
            )
        if current_status not in {"open", "waiting_operator"}:
            return VkActionOutcome(
                action="claim",
                delivery_status="rejected",
                ticket_status=current_status,
                message_kind="command_claim",
                operator_message="Взять в работу можно только открытое обращение.",
                reason="claim_not_allowed_for_status",
            )
        now = datetime.now(timezone.utc)
        updated = await repository.update_handoff_ticket(
            handoff_id=handoff["id"],
            channel="vk",
            ticket_status="assigned",
            assigned_operator_id=incoming.user_id,
            assigned_operator_username=incoming.username,
            assigned_at=ticket.get("assigned_at") or now,
            last_external_event_id=incoming.message_id,
            last_sync_at=now,
        )
        return VkActionOutcome(
            action="claim",
            delivery_status="updated",
            ticket_status=str(updated.get("ticket_status") or "assigned"),
            message_kind="command_claim",
            operator_message="Обращение назначено текущему оператору.",
            reason="ticket_assigned",
        )

    async def _close_ticket(
        self,
        *,
        repository,
        ticket: dict[str, Any],
        handoff: dict[str, Any],
        incoming: VkIncomingMessage,
        operator_role: str,
    ) -> VkActionOutcome:
        current_status = str(ticket.get("ticket_status") or "submitted")
        if current_status == "closed":
            return VkActionOutcome(
                action="close",
                delivery_status="noop",
                ticket_status="closed",
                message_kind="command_close",
                operator_message="Обращение уже закрыто.",
                reason="ticket_already_closed",
            )
        permission_error = _ticket_assignment_permission_error(
            ticket=ticket,
            operator_user_id=incoming.user_id,
            operator_role=operator_role,
            allow_admin_override=True,
        )
        if permission_error:
            return VkActionOutcome(
                action="close",
                delivery_status="rejected",
                ticket_status=current_status,
                message_kind="command_close",
                operator_message=permission_error,
                reason="ticket_assignment_mismatch",
            )
        now = datetime.now(timezone.utc)
        updated = await repository.update_handoff_ticket(
            handoff_id=handoff["id"],
            channel="vk",
            ticket_status="closed",
            closed_at=now,
            last_external_event_id=incoming.message_id,
            last_sync_at=now,
        )
        return VkActionOutcome(
            action="close",
            delivery_status="updated",
            ticket_status=str(updated.get("ticket_status") or "closed"),
            message_kind="command_close",
            operator_message="Обращение закрыто.",
            reason="ticket_closed",
        )

    async def _reopen_ticket(
        self,
        *,
        repository,
        ticket: dict[str, Any],
        handoff: dict[str, Any],
        incoming: VkIncomingMessage,
        operator_role: str,
    ) -> VkActionOutcome:
        current_status = str(ticket.get("ticket_status") or "submitted")
        if current_status != "closed":
            return VkActionOutcome(
                action="reopen",
                delivery_status="noop",
                ticket_status=current_status,
                message_kind="command_reopen",
                operator_message="Обращение уже открыто.",
                reason="ticket_not_closed",
            )
        permission_error = _ticket_assignment_permission_error(
            ticket=ticket,
            operator_user_id=incoming.user_id,
            operator_role=operator_role,
            allow_admin_override=True,
        )
        if permission_error:
            return VkActionOutcome(
                action="reopen",
                delivery_status="rejected",
                ticket_status=current_status,
                message_kind="command_reopen",
                operator_message=permission_error,
                reason="ticket_assignment_mismatch",
            )
        now = datetime.now(timezone.utc)
        next_status = "waiting_operator" if ticket.get("assigned_operator_id") else "open"
        updated = await repository.update_handoff_ticket(
            handoff_id=handoff["id"],
            channel="vk",
            ticket_status=next_status,
            closed_at=None,
            last_external_event_id=incoming.message_id,
            last_sync_at=now,
        )
        return VkActionOutcome(
            action="reopen",
            delivery_status="updated",
            ticket_status=str(updated.get("ticket_status") or next_status),
            message_kind="command_reopen",
            operator_message="Обращение переоткрыто.",
            reason="ticket_reopened",
        )

    async def _save_internal_note(
        self,
        *,
        repository,
        ticket: dict[str, Any],
        handoff: dict[str, Any],
        incoming: VkIncomingMessage,
        operator_role: str,
        note_text: str | None,
    ) -> VkActionOutcome:
        normalized_note = _clean_text(note_text, max_length=2_000)
        if not normalized_note:
            return VkActionOutcome(
                action="note",
                delivery_status="rejected",
                ticket_status=str(ticket.get("ticket_status") or "submitted"),
                message_kind="command_note",
                operator_message="Используйте /note <ticket_id> <текст>, чтобы сохранить заметку.",
                reason="note_text_required",
            )
        permission_error = _ticket_assignment_permission_error(
            ticket=ticket,
            operator_user_id=incoming.user_id,
            operator_role=operator_role,
            allow_admin_override=False,
        )
        if permission_error:
            return VkActionOutcome(
                action="note",
                delivery_status="rejected",
                ticket_status=str(ticket.get("ticket_status") or "submitted"),
                message_kind="command_note",
                operator_message=permission_error,
                reason="ticket_assignment_mismatch",
                content=normalized_note,
            )
        now = datetime.now(timezone.utc)
        await repository.update_handoff_ticket(
            handoff_id=handoff["id"],
            channel="vk",
            last_external_event_id=incoming.message_id,
            last_sync_at=now,
        )
        refreshed = await repository.get_handoff_ticket(handoff_id=handoff["id"], channel="vk")
        return VkActionOutcome(
            action="note",
            delivery_status="saved",
            ticket_status=str((refreshed or {}).get("ticket_status") or ticket.get("ticket_status") or "submitted"),
            message_kind="command_note",
            operator_message="Внутренняя заметка сохранена и не отправлена клиенту.",
            reason="note_saved",
            content=normalized_note,
        )

    async def _deliver_operator_reply(
        self,
        *,
        repository,
        ticket: dict[str, Any],
        handoff: dict[str, Any],
        incoming: VkIncomingMessage,
        operator_role: str,
        reply_text: str | None,
        reservation: dict[str, Any] | None,
    ) -> VkActionOutcome:
        current_status = str(ticket.get("ticket_status") or "submitted")
        if current_status == "closed":
            return VkActionOutcome(
                action="reply",
                delivery_status="rejected",
                ticket_status=current_status,
                message_kind="command_reply",
                operator_message="Обращение закрыто. Используйте /reopen перед /reply.",
                reason="ticket_closed",
            )
        if current_status in {"submitted", "failed"}:
            return VkActionOutcome(
                action="reply",
                delivery_status="rejected",
                ticket_status=current_status,
                message_kind="command_reply",
                operator_message="Обращение ещё не готово для ответа клиенту.",
                reason="ticket_not_ready",
            )
        permission_error = _ticket_assignment_permission_error(
            ticket=ticket,
            operator_user_id=incoming.user_id,
            operator_role=operator_role,
            allow_admin_override=False,
        )
        if permission_error:
            return VkActionOutcome(
                action="reply",
                delivery_status="rejected",
                ticket_status=current_status,
                message_kind="command_reply",
                operator_message=permission_error,
                reason="ticket_assignment_mismatch",
            )
        normalized_reply = _clean_text(reply_text, max_length=2_000)
        if not normalized_reply:
            return VkActionOutcome(
                action="reply",
                delivery_status="rejected",
                ticket_status=current_status,
                message_kind="command_reply",
                operator_message="Используйте /reply <ticket_id> <текст>, чтобы отправить ответ клиенту.",
                reason="reply_text_required",
            )
        now = datetime.now(timezone.utc)
        assigned_at = ticket.get("assigned_at") or now
        assistant_message_id = reservation.get("assistant_message_id") if reservation else None
        if assistant_message_id is None:
            assistant_message = await repository.add_message(
                session_id=handoff["session_id"],
                role="assistant",
                content=normalized_reply,
                intent="vk_operator_reply",
                metadata={"source": "vk_operator"},
            )
            assistant_message_id = assistant_message.get("id")
        updated = await repository.update_handoff_ticket(
            handoff_id=handoff["id"],
            channel="vk",
            ticket_status="waiting_customer",
            assigned_operator_id=ticket.get("assigned_operator_id") or incoming.user_id,
            assigned_operator_username=ticket.get("assigned_operator_username") or incoming.username,
            assigned_at=assigned_at,
            last_operator_message_at=now,
            last_external_event_id=incoming.message_id,
            last_sync_at=now,
        )
        return VkActionOutcome(
            action="reply",
            delivery_status="delivered",
            ticket_status=str(updated.get("ticket_status") or "waiting_customer"),
            message_kind="command_reply",
            operator_message="Ответ оператора добавлен в сессию ассистента.",
            reason="operator_reply_delivered",
            assistant_message_id=assistant_message_id,
            content=normalized_reply,
        )

    async def _record_webhook_update(
        self,
        *,
        repository,
        handoff: dict[str, Any],
        ticket: dict[str, Any],
        incoming: VkIncomingMessage,
        ticket_token: str,
        delivery_status: str,
        message_kind: str,
        content: str | None,
        operator_role: str | None,
        reason: str | None,
        assistant_message_id: Any = None,
        reservation: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        metadata = {
            "ticket_id": ticket_token,
            "peer_id": incoming.peer_id,
            "reason": reason,
            "operator_role": operator_role,
        }
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
        if not hasattr(repository, "create_external_handoff_message"):
            return reservation
        return await repository.create_external_handoff_message(
            handoff_id=handoff["id"],
            session_id=handoff["session_id"],
            channel="vk",
            external_chat_id=incoming.peer_id or ticket.get("external_chat_id") or "",
            external_thread_id=ticket_token,
            external_message_id=incoming.message_id,
            external_event_id=incoming.message_id,
            direction="vk_inbound",
            delivery_status=delivery_status,
            message_kind=message_kind,
            assistant_message_id=assistant_message_id,
            operator_external_user_id=incoming.user_id,
            operator_username=incoming.username,
            content=content,
            metadata=metadata,
        )

    async def _reserve_webhook_receipt(
        self,
        *,
        repository,
        incoming: VkIncomingMessage,
        command_name: str | None,
        ticket_token: str | None,
    ) -> tuple[dict[str, Any] | None, bool]:
        if not hasattr(repository, "reserve_external_webhook_receipt"):
            return None, True
        return await repository.reserve_external_webhook_receipt(
            channel="vk",
            external_chat_id=incoming.peer_id or "",
            external_thread_id=ticket_token,
            external_message_id=incoming.message_id,
            external_event_id=incoming.message_id,
            direction="vk_inbound",
            message_kind="message_processing",
            metadata=_webhook_receipt_metadata(
                command_name=command_name,
                ticket_token=ticket_token,
                reason="message_processing",
            ),
        )

    async def _update_webhook_receipt(
        self,
        *,
        repository,
        receipt: dict[str, Any] | None,
        delivery_status: str,
        message_kind: str,
        metadata: dict[str, Any],
    ) -> dict[str, Any] | None:
        if receipt is None or not hasattr(repository, "update_external_webhook_receipt"):
            return receipt
        return await repository.update_external_webhook_receipt(
            external_webhook_receipt_id=receipt["id"],
            delivery_status=delivery_status,
            message_kind=message_kind,
            metadata=metadata,
        )

    async def _safe_send_message(
        self,
        *,
        settings: VkHandoffRuntimeSettings,
        peer_id: str,
        text: str,
    ) -> None:
        try:
            await self._api_client.send_message(
                settings.community_access_token or "",
                group_id=settings.group_id or "",
                peer_id=peer_id,
                message=text,
                random_id=_random_id(),
            )
        except Exception:
            self._logger.warning("assistant.vk_handoff.send_failed")


def constant_time_secret_matches(expected: str | None, actual: str | None) -> bool:
    if not expected or not actual:
        return False
    return secrets.compare_digest(str(actual), str(expected))


def _group_identity(payload: dict[str, Any]) -> VkGroupIdentity:
    return VkGroupIdentity(
        id=_as_str(payload.get("id")),
        name=_as_str(payload.get("name")),
        screen_name=_as_str(payload.get("screen_name")),
    )


def _missing_connection_fields(settings: VkHandoffRuntimeSettings) -> list[str]:
    missing_fields: list[str] = []
    if not settings.group_id:
        missing_fields.append("group_id")
    if not settings.support_peer_id:
        missing_fields.append("support_peer_id")
    if not settings.webhook_url:
        missing_fields.append("webhook_url")
    if not settings.has_community_access_token:
        missing_fields.append("community_access_token")
    if not settings.has_secret_key:
        missing_fields.append("secret_key")
    if not settings.has_confirmation_code:
        missing_fields.append("confirmation_code")
    if settings.environment_mode == "production" and not settings.has_operator_acl:
        missing_fields.append("allowed_operator_ids_or_allowed_admin_ids")
    return missing_fields


def _ticket_has_open_link(ticket: dict[str, Any] | None) -> bool:
    if not ticket:
        return False
    return bool(ticket.get("external_thread_id") and ticket.get("external_root_message_id"))


def _parse_vk_message(event: dict[str, Any] | None) -> VkIncomingMessage | None:
    if not isinstance(event, dict):
        return None
    event_type = _as_str(event.get("type"))
    obj = event.get("object")
    obj = obj if isinstance(obj, dict) else {}
    message = obj.get("message")
    message = message if isinstance(message, dict) else obj
    if not isinstance(message, dict):
        return None
    from_id = _as_str(message.get("from_id"))
    if not from_id:
        return None
    return VkIncomingMessage(
        event_type=event_type or "",
        peer_id=_as_str(message.get("peer_id")),
        message_id=_as_str(message.get("id")),
        user_id=from_id,
        username=_as_str((message.get("from_user") or {}).get("username"))
        if isinstance(message.get("from_user"), dict)
        else None,
        text=_as_str(message.get("text")),
        has_attachment=bool(message.get("attachments")),
    )


_VK_COMMAND_RE = re.compile(
    r"^\s*/([A-Za-z]+)(?:\s+([#A-Za-z0-9_-]+))?(?:\s+(.+))?\s*$"
)


def _parse_vk_command(text: str | None) -> tuple[str | None, str | None, str | None]:
    raw = _as_str(text)
    if not raw:
        return None, None, None
    match = _VK_COMMAND_RE.match(raw)
    if not match:
        return None, None, None
    command = (match.group(1) or "").strip().lower() or None
    ticket_token = _normalize_ticket_token(match.group(2))
    argument = match.group(3)
    return command, ticket_token, argument.strip() if isinstance(argument, str) else None


def _normalize_ticket_token(value: str | None) -> str | None:
    normalized = re.sub(r"[^A-Za-z0-9]", "", str(value or "")).upper()
    return normalized[:8] or None


def _vk_operator_role(
    settings: VkHandoffRuntimeSettings,
    user_id: str | None,
) -> str | None:
    if not user_id:
        return None
    if user_id in settings.allowed_admin_user_ids:
        return "admin"
    if user_id in settings.allowed_operator_user_ids:
        return "operator"
    return None


def _payload_group_id(event: dict[str, Any] | None) -> str | None:
    if not isinstance(event, dict):
        return None
    return _as_str(event.get("group_id"))


def _webhook_receipt_metadata(
    *,
    command_name: str | None,
    ticket_token: str | None,
    reason: str | None,
) -> dict[str, Any]:
    metadata: dict[str, Any] = {}
    if command_name:
        metadata["command"] = command_name
    if ticket_token:
        metadata["ticket_id"] = ticket_token
    if reason:
        metadata["reason"] = reason
    return metadata


def _ticket_assignment_permission_error(
    *,
    ticket: dict[str, Any],
    operator_user_id: str | None,
    operator_role: str,
    allow_admin_override: bool,
) -> str | None:
    assigned_operator_id = _as_str(ticket.get("assigned_operator_id"))
    if not assigned_operator_id or assigned_operator_id == operator_user_id:
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
    lines = [
        f"Ticket status: {ticket.get('ticket_status') or 'submitted'}",
        f"Assigned operator: {assigned_label}",
        f"Handoff ID: {handoff.get('id')}",
        f"Session ID: {handoff.get('session_id')}",
    ]
    if handoff.get("created_at"):
        lines.append(f"Opened at: {_format_datetime(handoff.get('created_at'))}")
    return "\n".join(lines)


def _handoff_short_id(value: Any) -> str:
    normalized = re.sub(r"[^A-Za-z0-9]", "", str(value or ""))
    return (normalized[:8] or "UNKNOWN").upper()


def _handoff_card_text(
    *,
    handoff: dict[str, Any],
    session: dict[str, Any] | None,
    transcript: list[dict[str, Any]],
    ticket_status: str,
) -> str:
    short_id = _handoff_short_id(handoff.get("id"))
    lines = [
        f"New VK support handoff #{short_id}",
        f"Ticket status: {ticket_status}",
        f"Handoff ID: {handoff.get('id')}",
    ]
    _append_field(lines, "Name", handoff.get("name"))
    _append_field(lines, "Email", handoff.get("email"))
    _append_field(lines, "Phone", handoff.get("phone"))
    _append_field(lines, "Store ID", handoff.get("store_id"))
    _append_field(lines, "Tenant ID", handoff.get("tenant_id"))
    _append_field(lines, "Locale", handoff.get("locale"))
    _append_field(lines, "Reason", handoff.get("reason"))
    _append_field(lines, "Summary", handoff.get("summary"))
    _append_field(lines, "Customer note", handoff.get("note"))
    if isinstance(session, dict) and session.get("customer_id"):
        _append_field(lines, "Customer ID", session.get("customer_id"))
    if transcript:
        lines.append("")
        lines.append("Recent assistant session messages:")
        for item in transcript[-5:]:
            role = _as_str(item.get("role")) or "unknown"
            content = _clean_text(item.get("content"), max_length=180)
            if not content:
                continue
            lines.append(f"- {role}: {content}")
    lines.extend(
        [
            "",
            "Operator commands:",
            f"/status {short_id}",
            f"/claim {short_id}",
            f"/reply {short_id} <text>",
            f"/note {short_id} <text>",
            f"/close {short_id}",
            f"/reopen {short_id}",
        ]
    )
    return _truncate_text("\n".join(lines), max_length=3_000)


def _append_field(lines: list[str], label: str, value: Any) -> None:
    cleaned = _clean_text(value, max_length=700)
    if cleaned:
        lines.append(f"{label}: {cleaned}")


def _clean_text(value: Any, *, max_length: int) -> str | None:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    if not text:
        return None
    return text[:max_length]


def _truncate_text(value: str, *, max_length: int) -> str:
    text = value.strip()
    if len(text) <= max_length:
        return text
    return text[: max_length - 1].rstrip() + "…"


def _random_id() -> str:
    return str(secrets.randbelow(2_147_483_647) or 1)


def _smoke_message_text() -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return f"VK handoff smoke test at {timestamp}."


def _as_str(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def _as_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _as_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _format_datetime(value: Any) -> str:
    timestamp = _as_datetime(value)
    if timestamp is None:
        return "unknown"
    return timestamp.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


__all__ = [
    "VkApiClient",
    "VkApiError",
    "VkGroupIdentity",
    "VkHandoffConnectionTestResult",
    "VkHandoffDispatchResult",
    "VkHandoffService",
    "VkWebhookProcessResult",
    "VkWebhookState",
    "constant_time_secret_matches",
]
