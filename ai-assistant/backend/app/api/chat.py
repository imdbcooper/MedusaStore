from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request as FastAPIRequest
from fastapi.responses import StreamingResponse

from app.api.dependencies import get_chat_service
from app.core.auth import require_api_token
from app.core.security import enforce_rate_limit, rate_limit_identity
from app.schemas.chat import ChatHistoryMessage, ChatHistoryResponse, ChatRequest, ChatResponse
from app.services.chat import ChatService

router = APIRouter(prefix="/chat", tags=["chat"])


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
    try:
        return await service.answer(request, request_id=getattr(http_request.state, "request_id", None))
    except Exception as exc:
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
