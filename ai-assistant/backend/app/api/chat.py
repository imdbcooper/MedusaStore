from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.api.dependencies import get_chat_service
from app.schemas.chat import ChatHistoryMessage, ChatRequest, ChatResponse
from app.services.chat import ChatService

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest, service: ChatService = Depends(get_chat_service)) -> ChatResponse:
    try:
        return await service.answer(request)
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
async def chat_stream(request: ChatRequest, service: ChatService = Depends(get_chat_service)):
    return StreamingResponse(
        service.stream_events(request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/history", response_model=list[ChatHistoryMessage])
async def chat_history(
    session_id: UUID,
    service: ChatService = Depends(get_chat_service),
) -> list[dict]:
    return await service.history(session_id)
