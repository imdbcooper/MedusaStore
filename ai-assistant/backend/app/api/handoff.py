import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request as FastAPIRequest, status

from app.api.dependencies import (
    get_repository,
    get_settings_provider,
    get_telegram_handoff_service,
    get_vk_handoff_service,
)
from app.core.security import enforce_rate_limit, rate_limit_identity
from app.schemas.handoff import HandoffRequest, HandoffResponse, HandoffTicketResponse
from app.services.settings_provider import AssistantRuntimeSettings, SettingsFetchError, SettingsProvider
from app.services.telegram_handoff import TelegramHandoffService
from app.services.vk_handoff import VkHandoffService

router = APIRouter(prefix="/handoff", tags=["handoff"])
logger = logging.getLogger("assistant.handoff.api")


@router.post("", response_model=HandoffResponse)
async def create_handoff(
    request: HandoffRequest,
    http_request: FastAPIRequest,
    repository=Depends(get_repository),
    settings_provider: SettingsProvider | None = Depends(get_settings_provider),
    telegram_handoff_service: TelegramHandoffService = Depends(get_telegram_handoff_service),
    vk_handoff_service: VkHandoffService = Depends(get_vk_handoff_service),
) -> HandoffResponse:
    identity = rate_limit_identity(
        http_request,
        scope="feedback",
        session_id=str(request.session_id),
        store_id=request.store_id,
    )
    enforce_rate_limit(http_request, scope="feedback", identity=identity)
    if not hasattr(repository, "create_handoff"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": {"code": "HANDOFF_UNAVAILABLE", "message": "Repository does not support handoff.", "retryable": True}},
        )
    session = await validate_handoff_scope(repository, request)
    record = await repository.create_handoff(
        session_id=request.session_id,
        message_id=request.message_id,
        store_id=request.store_id,
        tenant_id=request.tenant_id,
        locale=request.locale,
        source=request.source,
        name=request.name,
        email=request.email,
        phone=request.phone,
        summary=request.summary,
        reason=request.reason,
        note=request.note,
        metadata=request.metadata,
    )
    ticket = await _sync_handoff_ticket(
        repository=repository,
        settings_provider=settings_provider,
        telegram_handoff_service=telegram_handoff_service,
        vk_handoff_service=vk_handoff_service,
        handoff_record=record,
        session=session,
    )
    return HandoffResponse(
        handoff_id=record["id"],
        session_id=record["session_id"],
        message_id=record.get("message_id"),
        store_id=record.get("store_id") or request.store_id,
        tenant_id=record.get("tenant_id"),
        locale=record.get("locale") or request.locale,
        status=record.get("status") or "submitted",
        source=record.get("source") or request.source,
        created_at=record.get("created_at"),
        ticket=ticket,
    )


async def _sync_handoff_ticket(
    *,
    repository,
    settings_provider: SettingsProvider | None,
    telegram_handoff_service: TelegramHandoffService,
    vk_handoff_service: VkHandoffService,
    handoff_record: dict,
    session: dict,
) -> HandoffTicketResponse | None:
    if not hasattr(repository, "upsert_handoff_ticket"):
        return None

    snapshot = None
    snapshot_unavailable_message = None
    if settings_provider is not None:
        try:
            snapshot = await settings_provider.get()
        except (SettingsFetchError, RuntimeError) as exc:
            logger.warning(
                "assistant.handoff.runtime_settings_unavailable",
                extra={"error_type": exc.__class__.__name__},
            )
            snapshot_unavailable_message = (
                "Handoff was saved without delivery because runtime settings could not be refreshed."
            )

    active_channel = _active_handoff_channel(snapshot)
    if active_channel == "vk":
        return await _sync_vk_ticket(
            repository=repository,
            settings_provider=settings_provider,
            vk_handoff_service=vk_handoff_service,
            handoff_record=handoff_record,
            session=session,
            snapshot=snapshot,
            fallback_message=snapshot_unavailable_message
            or "Handoff was saved without VK delivery because runtime settings are unavailable.",
        )
    return await _sync_telegram_ticket(
        repository=repository,
        settings_provider=settings_provider,
        telegram_handoff_service=telegram_handoff_service,
        handoff_record=handoff_record,
        session=session,
        snapshot=snapshot,
        fallback_message=snapshot_unavailable_message
        or "Handoff was saved without Telegram delivery because runtime settings are unavailable.",
    )


async def validate_handoff_scope(repository, request: HandoffRequest) -> dict:
    if not hasattr(repository, "get_session"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": {
                    "code": "HANDOFF_UNAVAILABLE",
                    "message": "Repository does not support session validation.",
                    "retryable": True,
                }
            },
        )
    session = await repository.get_session(request.session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "SESSION_NOT_FOUND", "message": "Handoff session does not exist.", "retryable": False}},
        )
    session_tenant = session.get("tenant_id") or (session.get("metadata") or {}).get("tenant_id")
    if session.get("store_id") != request.store_id or session.get("locale") != request.locale or session_tenant != request.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "HANDOFF_SCOPE_MISMATCH", "message": "Handoff scope does not match the chat session.", "retryable": False}},
        )
    if request.message_id:
        if hasattr(repository, "message_belongs_to_session"):
            belongs = await repository.message_belongs_to_session(message_id=request.message_id, session_id=request.session_id)
        elif hasattr(repository, "get_message"):
            message = await repository.get_message(request.message_id)
            belongs = bool(message and message.get("session_id") == request.session_id)
        else:
            belongs = False
        if not belongs:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": {
                        "code": "HANDOFF_MESSAGE_SCOPE_MISMATCH",
                        "message": "Handoff message does not belong to the supplied session.",
                        "retryable": False,
                    }
                },
            )
    return session


async def _sync_telegram_ticket(
    *,
    repository,
    settings_provider: SettingsProvider | None,
    telegram_handoff_service: TelegramHandoffService,
    handoff_record: dict,
    session: dict,
    snapshot: AssistantRuntimeSettings | None = None,
    fallback_message: str = (
        "Handoff was saved without Telegram delivery because runtime settings are unavailable."
    ),
) -> HandoffTicketResponse | None:
    if not hasattr(repository, "upsert_handoff_ticket"):
        return None

    existing_ticket = None
    if hasattr(repository, "get_handoff_ticket"):
        existing_ticket = await repository.get_handoff_ticket(
            handoff_id=handoff_record["id"],
            channel="telegram",
        )

    if _ticket_has_open_link(existing_ticket):
        return _public_ticket(
            channel="telegram",
            status="open",
            message="Telegram ticket already exists for this handoff.",
            updated_at=_ticket_updated_at(existing_ticket),
        )

    current_ticket = existing_ticket
    if current_ticket is None:
        current_ticket = await repository.upsert_handoff_ticket(
            handoff_id=handoff_record["id"],
            channel="telegram",
            ticket_status="submitted",
            created_at=handoff_record.get("created_at"),
            last_customer_message_at=handoff_record.get("created_at"),
            last_sync_at=handoff_record.get("created_at") or datetime.now(timezone.utc),
        )

    if snapshot is None and settings_provider is None:
        return _public_ticket_from_record(
            channel="telegram",
            ticket=current_ticket,
            fallback_message=fallback_message,
        )

    if snapshot is None:
        return _public_ticket_from_record(
            channel="telegram",
            ticket=current_ticket,
            fallback_message=fallback_message,
        )

    transcript = []
    if hasattr(repository, "list_messages"):
        transcript = await repository.list_messages(
            handoff_record["session_id"],
            limit=10,
        )

    dispatch = await telegram_handoff_service.dispatch_handoff(
        settings=snapshot.telegram_handoff,
        handoff=handoff_record,
        session=session,
        transcript=transcript,
        existing_ticket=current_ticket,
    )

    persisted = await repository.upsert_handoff_ticket(
        handoff_id=handoff_record["id"],
        channel=dispatch.channel,
        ticket_status=dispatch.ticket_status,
        telegram_chat_id=dispatch.telegram_chat_id,
        telegram_topic_id=dispatch.telegram_topic_id,
        telegram_topic_title=dispatch.telegram_topic_title,
        telegram_root_message_id=dispatch.telegram_root_message_id,
        failure_reason=dispatch.failure_reason,
        created_at=handoff_record.get("created_at"),
        opened_at=dispatch.opened_at,
        last_customer_message_at=handoff_record.get("created_at"),
        last_sync_at=dispatch.last_sync_at,
    )
    return _public_ticket(
        channel=dispatch.channel,
        status=dispatch.ticket_status,
        message=dispatch.message,
        updated_at=persisted.get("last_sync_at") or dispatch.last_sync_at,
    )


async def _sync_vk_ticket(
    *,
    repository,
    settings_provider: SettingsProvider | None,
    vk_handoff_service: VkHandoffService,
    handoff_record: dict,
    session: dict,
    snapshot: AssistantRuntimeSettings | None = None,
    fallback_message: str = (
        "Handoff was saved without VK delivery because runtime settings are unavailable."
    ),
) -> HandoffTicketResponse | None:
    if not hasattr(repository, "upsert_handoff_ticket"):
        return None

    existing_ticket = None
    if hasattr(repository, "get_handoff_ticket"):
        existing_ticket = await repository.get_handoff_ticket(
            handoff_id=handoff_record["id"],
            channel="vk",
        )

    if _ticket_has_open_link(existing_ticket):
        return _public_ticket(
            channel="vk",
            status="open",
            message="VK ticket already exists for this handoff.",
            updated_at=_ticket_updated_at(existing_ticket),
        )

    current_ticket = existing_ticket
    if current_ticket is None:
        current_ticket = await repository.upsert_handoff_ticket(
            handoff_id=handoff_record["id"],
            channel="vk",
            ticket_status="submitted",
            created_at=handoff_record.get("created_at"),
            last_customer_message_at=handoff_record.get("created_at"),
            last_sync_at=handoff_record.get("created_at") or datetime.now(timezone.utc),
        )

    if snapshot is None and settings_provider is None:
        return _public_ticket_from_record(
            channel="vk",
            ticket=current_ticket,
            fallback_message=fallback_message,
        )

    if snapshot is None:
        return _public_ticket_from_record(
            channel="vk",
            ticket=current_ticket,
            fallback_message=fallback_message,
        )

    transcript = []
    if hasattr(repository, "list_messages"):
        transcript = await repository.list_messages(
            handoff_record["session_id"],
            limit=10,
        )

    dispatch = await vk_handoff_service.dispatch_handoff(
        settings=snapshot.vk_handoff,
        handoff=handoff_record,
        session=session,
        transcript=transcript,
        existing_ticket=current_ticket,
    )

    persisted = await repository.upsert_handoff_ticket(
        handoff_id=handoff_record["id"],
        channel=dispatch.channel,
        ticket_status=dispatch.ticket_status,
        external_chat_id=dispatch.external_chat_id,
        external_thread_id=dispatch.external_thread_id,
        external_thread_title=dispatch.external_thread_title,
        external_root_message_id=dispatch.external_root_message_id,
        failure_reason=dispatch.failure_reason,
        created_at=handoff_record.get("created_at"),
        opened_at=dispatch.opened_at,
        last_customer_message_at=handoff_record.get("created_at"),
        last_sync_at=dispatch.last_sync_at,
    )
    return _public_ticket(
        channel=dispatch.channel,
        status=dispatch.ticket_status,
        message=dispatch.message,
        updated_at=persisted.get("last_sync_at") or dispatch.last_sync_at,
    )


def _public_ticket(
    *,
    channel: str,
    status: str,
    message: str | None,
    updated_at,
) -> HandoffTicketResponse:
    return HandoffTicketResponse(
        channel=channel,
        status=status,
        message=message,
        updated_at=updated_at,
    )


def _public_ticket_from_record(
    channel: str,
    ticket: dict | None,
    *,
    fallback_message: str,
) -> HandoffTicketResponse:
    if not ticket:
        return _public_ticket(
            channel=channel,
            status="submitted",
            message=fallback_message,
            updated_at=None,
        )

    status = str(ticket.get("ticket_status") or "submitted")
    if status == "open":
        message = (
            "VK ticket already exists for this handoff."
            if channel == "vk"
            else "Telegram ticket already exists for this handoff."
        )
    elif status == "failed":
        message = (
            "Handoff was saved, but VK ticket creation failed."
            if channel == "vk"
            else "Handoff was saved, but Telegram ticket creation failed."
        )
    else:
        message = fallback_message

    return _public_ticket(
        channel=channel,
        status=status,
        message=message,
        updated_at=_ticket_updated_at(ticket),
    )


def _ticket_has_open_link(ticket: dict | None) -> bool:
    if not ticket:
        return False
    if str(ticket.get("ticket_status") or "") != "open":
        return False
    return (
        (
            ticket.get("telegram_topic_id") is not None
            and ticket.get("telegram_root_message_id") is not None
        )
        or (
            ticket.get("external_thread_id") is not None
            and ticket.get("external_root_message_id") is not None
        )
    )


def _ticket_updated_at(ticket: dict | None):
    if not ticket:
        return None
    return (
        ticket.get("last_sync_at")
        or ticket.get("opened_at")
        or ticket.get("updated_at")
        or ticket.get("created_at")
    )


def _active_handoff_channel(snapshot: AssistantRuntimeSettings | None) -> str:
    if snapshot is None:
        return "telegram"
    return snapshot.active_handoff_channel
