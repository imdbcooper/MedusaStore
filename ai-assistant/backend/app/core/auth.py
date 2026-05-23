import secrets

from fastapi import Header, HTTPException, Request, status

from app.core.security import assert_not_browser_request


async def require_api_token(
    request: Request,
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> None:
    await _require_token(
        request,
        authorization=authorization,
        x_api_key=x_api_key,
        allow_server_token=False,
    )


async def require_server_token_or_api_token(
    request: Request,
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> None:
    await _require_token(
        request,
        authorization=authorization,
        x_api_key=x_api_key,
        allow_server_token=True,
    )


async def _require_token(
    request: Request,
    *,
    authorization: str | None,
    x_api_key: str | None,
    allow_server_token: bool,
) -> None:
    assert_not_browser_request(request)
    settings = request.app.state.settings
    expected = [(settings.api_token or "").strip()]
    if allow_server_token:
        expected.append((settings.ai_assistant_server_token or "").strip())
    expected = [token for token in dict.fromkeys(expected) if token]
    if not expected:
        message = (
            "AI_ASSISTANT_API_TOKEN or AI_ASSISTANT_SERVER_TOKEN is not configured."
            if allow_server_token
            else "AI_ASSISTANT_API_TOKEN is not configured."
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": {
                    "code": "AUTH_REQUIRED",
                    "message": message,
                    "retryable": False,
                }
            },
        )

    candidates: list[str] = []
    if x_api_key:
        candidates.append(x_api_key.strip())
    if authorization:
        scheme, _, value = authorization.strip().partition(" ")
        if scheme.lower() == "bearer" and value:
            candidates.append(value.strip())

    if any(
        secrets.compare_digest(candidate, token)
        for candidate in candidates
        for token in expected
    ):
        return

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={
            "error": {
                "code": "AUTH_REQUIRED",
                "message": (
                    "Valid assistant API or server-side token is required."
                    if allow_server_token
                    else "Valid assistant API token is required."
                ),
                "retryable": False,
            }
        },
        headers={"WWW-Authenticate": "Bearer"},
    )
