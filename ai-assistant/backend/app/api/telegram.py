from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.api.dependencies import (
    get_repository,
    get_settings_provider,
    get_telegram_handoff_service,
)
from app.services.settings_provider import SettingsFetchError, SettingsProvider
from app.services.telegram_handoff import (
    TelegramHandoffService,
    TelegramWebhookProcessResult,
    constant_time_secret_matches,
)

router = APIRouter(prefix="/telegram", tags=["telegram"])


@router.post("/webhook", response_model=TelegramWebhookProcessResult)
async def telegram_webhook(
    payload: dict[str, Any],
    repository=Depends(get_repository),
    settings_provider: SettingsProvider | None = Depends(get_settings_provider),
    service: TelegramHandoffService = Depends(get_telegram_handoff_service),
    secret_token: str | None = Header(
        default=None,
        alias="X-Telegram-Bot-Api-Secret-Token",
    ),
) -> TelegramWebhookProcessResult:
    if settings_provider is None:
        return TelegramWebhookProcessResult(
            status="ignored",
            reason="settings_provider_unavailable",
            message="Telegram webhook ignored because runtime settings are unavailable.",
        )

    try:
        snapshot = await settings_provider.get()
    except (SettingsFetchError, RuntimeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": {
                    "code": "TELEGRAM_SETTINGS_UNAVAILABLE",
                    "message": "Telegram webhook settings are temporarily unavailable.",
                    "retryable": True,
                    "details": exc.__class__.__name__,
                }
            },
        ) from exc

    telegram_settings = snapshot.telegram_handoff
    if not telegram_settings.is_ready_for_webhook:
        return TelegramWebhookProcessResult(
            status="ignored",
            reason="disabled_or_incomplete",
            message="Telegram webhook ignored because the handoff integration is disabled or incomplete.",
        )

    if not constant_time_secret_matches(
        telegram_settings.webhook_secret,
        secret_token,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "TELEGRAM_WEBHOOK_SECRET_INVALID",
                    "message": "Valid Telegram webhook secret is required.",
                    "retryable": False,
                }
            },
        )

    return await service.process_webhook_update(
        settings=telegram_settings,
        repository=repository,
        update=payload,
    )
