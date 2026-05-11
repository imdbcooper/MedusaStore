from fastapi import APIRouter, Depends, HTTPException, Request as FastAPIRequest, status

from app.api.dependencies import get_repository
from app.core.security import enforce_rate_limit, rate_limit_identity, redact_mapping, redact_pii
from app.schemas.feedback import FeedbackRequest, FeedbackResponse

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("", response_model=FeedbackResponse)
async def create_feedback(
    request: FeedbackRequest,
    http_request: FastAPIRequest,
    repository=Depends(get_repository),
) -> FeedbackResponse:
    settings = http_request.app.state.settings
    if not settings.enable_feedback:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "FEEDBACK_DISABLED", "message": "Feedback is disabled.", "retryable": False}},
        )
    identity = rate_limit_identity(
        http_request,
        scope="feedback",
        session_id=str(request.session_id),
        store_id=request.store_id,
    )
    enforce_rate_limit(http_request, scope="feedback", identity=identity)
    if not hasattr(repository, "create_feedback"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": {"code": "FEEDBACK_UNAVAILABLE", "message": "Repository does not support feedback.", "retryable": True}},
        )
    await validate_feedback_ownership(repository, request)
    record = await repository.create_feedback(
        session_id=request.session_id,
        message_id=request.message_id,
        store_id=request.store_id,
        tenant_id=request.tenant_id,
        locale=request.locale,
        rating=request.rating,
        label=request.label,
        comment=redact_pii(request.comment),
        metadata=redact_mapping(request.metadata),
    )
    return FeedbackResponse(
        feedback_id=record["id"],
        session_id=record["session_id"],
        message_id=record.get("message_id"),
        store_id=record.get("store_id") or request.store_id,
        tenant_id=record.get("tenant_id"),
        locale=record.get("locale") or request.locale,
        rating=record.get("rating"),
        label=record.get("label"),
        comment=record.get("comment"),
        metadata=record.get("metadata") or {},
        created_at=record.get("created_at"),
    )


async def validate_feedback_ownership(repository, request: FeedbackRequest) -> None:
    if not hasattr(repository, "get_session"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": {"code": "FEEDBACK_UNAVAILABLE", "message": "Repository does not support session validation.", "retryable": True}},
        )
    session = await repository.get_session(request.session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "SESSION_NOT_FOUND", "message": "Feedback session does not exist.", "retryable": False}},
        )
    session_tenant = session.get("tenant_id") or (session.get("metadata") or {}).get("tenant_id")
    if session.get("store_id") != request.store_id or session.get("locale") != request.locale or session_tenant != request.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FEEDBACK_SCOPE_MISMATCH", "message": "Feedback scope does not match the chat session.", "retryable": False}},
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
                detail={"error": {"code": "FEEDBACK_MESSAGE_SCOPE_MISMATCH", "message": "Feedback message does not belong to the supplied session.", "retryable": False}},
            )
