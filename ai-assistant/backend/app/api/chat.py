import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request as FastAPIRequest
from fastapi.responses import StreamingResponse

from app.api.dependencies import get_chat_service
from app.core.auth import require_api_token
from app.core.security import (
    assistant_principal_identity,
    classify_abuse_event,
    enforce_rate_limit,
    evolve_principal_state,
    principal_block_retry_after_seconds,
    rate_limit_identity,
)
from app.schemas.chat import ChatHistoryMessage, ChatHistoryResponse, ChatRequest, ChatResponse
from app.services.chat import ChatService

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger("assistant.chat.api")


@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    http_request: FastAPIRequest,
    service: ChatService = Depends(get_chat_service),
) -> ChatResponse:
    identity = rate_limit_identity(
        http_request,
        scope="chat",
        session_id=str(request.session_id) if request.session_id else None,
        store_id=request.store_id,
    )
    enforce_rate_limit(http_request, scope="chat", identity=identity)
    validate_input_length(http_request, request.message)
    await enforce_principal_block_policy(http_request=http_request, request=request, service=service)
    try:
        return await service.answer(request, request_id=getattr(http_request.state, "request_id", None))
    except Exception as exc:
        logger.exception("assistant chat request failed")
        raise HTTPException(
            status_code=500,
            detail={
                "error": {
                    "code": "RETRIEVAL_UNAVAILABLE",
                    "message": "Could not build assistant response.",
                    "retryable": True,
                    "details": str(exc),
                }
            },
        ) from exc


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    http_request: FastAPIRequest,
    service: ChatService = Depends(get_chat_service),
):
    identity = rate_limit_identity(
        http_request,
        scope="chat",
        session_id=str(request.session_id) if request.session_id else None,
        store_id=request.store_id,
    )
    enforce_rate_limit(http_request, scope="chat", identity=identity)
    validate_input_length(http_request, request.message)
    await enforce_principal_block_policy(http_request=http_request, request=request, service=service)
    return StreamingResponse(
        service.stream_events(request, request_id=getattr(http_request.state, "request_id", None)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/history", response_model=list[ChatHistoryMessage])
async def chat_history(
    session_id: UUID,
    http_request: FastAPIRequest,
    service: ChatService = Depends(get_chat_service),
    _: None = Depends(require_api_token),
) -> list[dict]:
    identity = rate_limit_identity(http_request, scope="admin", session_id=str(session_id))
    enforce_rate_limit(http_request, scope="admin", identity=identity)
    return await service.history(session_id)


@router.get("/history/scoped", response_model=ChatHistoryResponse)
async def scoped_chat_history(
    http_request: FastAPIRequest,
    session_id: UUID,
    store_id: str,
    locale: str = "ru",
    customer_id: str | None = None,
    limit: int = 50,
    service: ChatService = Depends(get_chat_service),
    _: None = Depends(require_api_token),
) -> dict:
    identity = rate_limit_identity(http_request, scope="admin", session_id=str(session_id), store_id=store_id)
    enforce_rate_limit(http_request, scope="admin", identity=identity)
    history = await service.scoped_history(
        session_id,
        store_id=store_id,
        locale=locale,
        customer_id=customer_id,
        limit=limit,
    )
    if history is None:
        raise HTTPException(
            status_code=404,
            detail={
                "error": {
                    "code": "SESSION_HISTORY_NOT_FOUND",
                    "message": "Assistant session history is not available for this scope.",
                    "retryable": False,
                }
            },
        )
    return history


def validate_input_length(http_request: FastAPIRequest, message: str) -> None:
    max_chars = http_request.app.state.settings.chat_max_input_chars
    if max_chars > 0 and len(message) > max_chars:
        raise HTTPException(
            status_code=413,
            detail={
                "error": {
                    "code": "CHAT_INPUT_TOO_LONG",
                    "message": f"Chat message exceeds CHAT_MAX_INPUT_CHARS={max_chars}.",
                    "retryable": False,
                    "max_chars": max_chars,
                }
            },
        )


async def enforce_principal_block_policy(
    *,
    http_request: FastAPIRequest,
    request: ChatRequest,
    service: ChatService,
) -> None:
    repository = getattr(service, "repository", None)
    if repository is None or not hasattr(repository, "get_principal_state") or not hasattr(repository, "upsert_principal_state"):
        return
    principal = assistant_principal_identity(
        http_request,
        customer_id=request.customer_id,
        store_id=request.store_id,
        tenant_id=request.tenant_id,
    )
    current_state = await repository.get_principal_state(principal["principal_id"])
    retry_after = principal_block_retry_after_seconds(current_state)
    if retry_after > 0:
        raise_temporary_block(current_state or {}, retry_after_seconds=retry_after)
    event_type = classify_abuse_event(request.message)
    if not event_type:
        return
    settings = http_request.app.state.settings
    next_state = evolve_principal_state(
        current_state,
        principal_id=str(principal["principal_id"]),
        principal_kind=str(principal["principal_kind"]),
        store_id=request.store_id,
        tenant_id=request.tenant_id,
        customer_id=request.customer_id,
        event_type=event_type,
        window_seconds=int(settings.abuse_window_seconds),
        block_seconds=int(settings.abuse_block_seconds),
        off_topic_threshold=int(settings.abuse_off_topic_threshold),
        prompt_injection_threshold=int(settings.abuse_prompt_injection_threshold),
    )
    stored_state = await repository.upsert_principal_state(next_state)
    retry_after = principal_block_retry_after_seconds(stored_state)
    if retry_after > 0:
        raise_temporary_block(stored_state, retry_after_seconds=retry_after)


def raise_temporary_block(state: dict, *, retry_after_seconds: int) -> None:
    block_reason = state.get("block_reason") or "assistant_policy"
    raise HTTPException(
        status_code=429,
        detail={
            "error": {
                "code": "ASSISTANT_TEMPORARILY_BLOCKED",
                "message": "Assistant access is temporarily blocked for this user due to repeated off-topic or unsafe requests.",
                "retryable": True,
                "retry_after_seconds": retry_after_seconds,
                "block_reason": block_reason,
            }
        },
        headers={"Retry-After": str(retry_after_seconds)},
    )
