from fastapi import Request

from app.services.chat import ChatService
from app.services.ingestion import MarkdownIngestionService


def get_repository(request: Request):
    return request.app.state.repository


def get_chat_service(request: Request) -> ChatService:
    return request.app.state.chat_service


def get_ingestion_service(request: Request) -> MarkdownIngestionService:
    return request.app.state.ingestion_service
