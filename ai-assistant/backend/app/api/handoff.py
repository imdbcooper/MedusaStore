from fastapi import APIRouter, Depends, HTTPException, Request as FastAPIRequest, status

from app.api.dependencies import get_repository
from app.core.security import enforce_rate_limit, rate_limit_identity
from app.schemas.handoff import HandoffRequest, HandoffResponse

router = APIRouter(prefix="/handoff", tags=["handoff"])


@router.post("", response_model=HandoffResponse)
async def create_handoff(
    request: HandoffRequest,
    http_request: FastAPIRequest,
    repository=Depends(get_repository),
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
    await validate_handoff_scope(repository, request)
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
    )


async def validate_handoff_scope(repository, request: HandoffRequest) -> None:
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
