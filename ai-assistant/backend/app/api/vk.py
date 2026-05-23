from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse

from app.api.dependencies import (
    get_repository,
    get_settings_provider,
    get_vk_handoff_service,
)
from app.services.settings_provider import SettingsFetchError, SettingsProvider
from app.services.vk_handoff import VkHandoffService, constant_time_secret_matches

router = APIRouter(prefix="/vk", tags=["vk"])


@router.post("/webhook", response_class=PlainTextResponse)
async def vk_webhook(
    payload: dict[str, Any],
    repository=Depends(get_repository),
    settings_provider: SettingsProvider | None = Depends(get_settings_provider),
    service: VkHandoffService = Depends(get_vk_handoff_service),
) -> PlainTextResponse:
    if settings_provider is None:
        return PlainTextResponse("ok")

    try:
        snapshot = await settings_provider.get()
    except (SettingsFetchError, RuntimeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": {
                    "code": "VK_SETTINGS_UNAVAILABLE",
                    "message": "VK webhook settings are temporarily unavailable.",
                    "retryable": True,
                    "details": exc.__class__.__name__,
                }
            },
        ) from exc

    vk_settings = snapshot.vk_handoff
    event_type = str((payload or {}).get("type") or "").strip()

    if event_type == "confirmation":
        if not vk_settings.enabled or not vk_settings.has_confirmation_code:
            return PlainTextResponse("ok")
    elif not vk_settings.is_ready_for_webhook:
        return PlainTextResponse("ok")

    if not constant_time_secret_matches(
        vk_settings.secret_key,
        str((payload or {}).get("secret") or "").strip() or None,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "VK_WEBHOOK_SECRET_INVALID",
                    "message": "Valid VK webhook secret is required.",
                    "retryable": False,
                }
            },
        )

    result = await service.process_webhook_event(
        settings=vk_settings,
        repository=repository,
        event=payload,
    )
    return PlainTextResponse(result.response_text)
