import secrets

from fastapi import Header, HTTPException, Request, status

from app.core.security import assert_not_browser_request


async def require_api_token(
    request: Request,
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> None:
    """Require the env-driven assistant API token for privileged server-side operations."""
    assert_not_browser_request(request)
    settings = request.app.state.settings
    expected = settings.api_token
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": {
                    "code": "AUTH_REQUIRED",
                    "message": "AI_ASSISTANT_API_TOKEN is not configured.",
                    "retryable": False,
                }
            },
        )

    candidates = []
    if x_api_key:
        candidates.append(x_api_key.strip())
    if authorization:
        scheme, _, value = authorization.strip().partition(" ")
        if scheme.lower() == "bearer" and value:
            candidates.append(value.strip())

    if not any(secrets.compare_digest(expected, candidate) for candidate in candidates):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "AUTH_REQUIRED",
                    "message": "Valid assistant API token is required.",
                    "retryable": False,
                }
            },
            headers={"WWW-Authenticate": "Bearer"},
        )
