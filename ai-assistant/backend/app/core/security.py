from __future__ import annotations

import hashlib
import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware

SENSITIVE_KEYS = {
    "authorization",
    "x-api-key",
    "api_key",
    "api_token",
    "token",
    "password",
    "secret",
    "cookie",
    "set-cookie",
    "credit_card",
    "card_number",
    "cvv",
    "payment_method",
}

EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)
PHONE_RE = re.compile(r"(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)")
CARD_RE = re.compile(r"(?<!\d)(?:\d[ -]*?){13,19}(?!\d)")
INJECTION_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"ignore\s+(all\s+)?previous\s+instructions",
        r"forget\s+(all\s+)?previous\s+instructions",
        r"disregard\s+(all\s+)?previous\s+instructions",
        r"system\s+prompt",
        r"developer\s+message",
        r"reveal\s+(your\s+)?(prompt|instructions|secret|token)",
        r"show\s+(me\s+)?(your\s+)?(prompt|system message|token|secret)",
        r"bypass\s+(safety|guardrails|policy)",
        r"jailbreak",
    )
]
SELLABLE_FACT_RE = re.compile(
    r"\b(price|stock|inventory|наличи[ея]|остат(?:ок|ки)|цен[ауеы]|оплат[аеуы]|заказ|order|payment)\b",
    re.IGNORECASE,
)


@dataclass(slots=True)
class RateLimitDecision:
    allowed: bool
    retry_after_seconds: int = 0
    remaining: int = 0
    limit: int = 0
    window_seconds: int = 0


@dataclass(slots=True)
class InMemoryRateLimiter:
    buckets: dict[str, list[float]] = field(default_factory=dict)

    def check(self, *, key: str, limit: int, window_seconds: int) -> RateLimitDecision:
        if limit <= 0 or window_seconds <= 0:
            return RateLimitDecision(True, remaining=max(limit, 0), limit=limit, window_seconds=window_seconds)
        now = time.monotonic()
        cutoff = now - window_seconds
        timestamps = [item for item in self.buckets.get(key, []) if item > cutoff]
        if len(timestamps) >= limit:
            retry_after = max(1, int(window_seconds - (now - timestamps[0])))
            self.buckets[key] = timestamps
            return RateLimitDecision(
                allowed=False,
                retry_after_seconds=retry_after,
                remaining=0,
                limit=limit,
                window_seconds=window_seconds,
            )
        timestamps.append(now)
        self.buckets[key] = timestamps
        return RateLimitDecision(
            allowed=True,
            remaining=max(limit - len(timestamps), 0),
            limit=limit,
            window_seconds=window_seconds,
        )


def parse_rate_limit(value: str | None, *, default: str) -> tuple[int, int]:
    raw = (value or default).strip().lower()
    if not raw:
        raw = default
    if "/" not in raw:
        return int(raw), 60
    amount_raw, _, window_raw = raw.partition("/")
    amount = int(amount_raw.strip())
    window = window_raw.strip()
    if window in {"s", "sec", "second", "seconds"}:
        return amount, 1
    if window in {"m", "min", "minute", "minutes"}:
        return amount, 60
    if window in {"h", "hour", "hours"}:
        return amount, 3600
    if window in {"d", "day", "days"}:
        return amount, 86400
    return amount, int(window)


def rate_limit_identity(request: Request, *, scope: str, session_id: str | None = None, store_id: str | None = None) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    ip = forwarded_for or (request.client.host if request.client else "unknown")
    raw = ":".join([scope, store_id or "default", session_id or "anonymous", ip])
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def enforce_rate_limit(request: Request, *, scope: str, identity: str) -> None:
    settings = request.app.state.settings
    limiter: InMemoryRateLimiter = request.app.state.rate_limiter
    config = {
        "chat": settings.chat_rate_limit,
        "admin": settings.admin_rate_limit,
        "ingestion": settings.ingestion_rate_limit,
        "tools": settings.tools_rate_limit,
        "feedback": settings.feedback_rate_limit,
    }.get(scope, settings.chat_rate_limit)
    limit, window_seconds = parse_rate_limit(config, default="60/minute")
    decision = limiter.check(key=identity, limit=limit, window_seconds=window_seconds)
    if decision.allowed:
        return
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "error": {
                "code": "RATE_LIMITED",
                "message": "Rate limit exceeded for this assistant endpoint.",
                "retryable": True,
                "retry_after_seconds": decision.retry_after_seconds,
            }
        },
        headers={"Retry-After": str(decision.retry_after_seconds)},
    )


def detect_prompt_injection(text: str) -> list[str]:
    return [pattern.pattern for pattern in INJECTION_PATTERNS if pattern.search(text or "")]


def redact_pii(text: str | None) -> str | None:
    if text is None:
        return None
    redacted = EMAIL_RE.sub("[REDACTED_EMAIL]", text)
    redacted = PHONE_RE.sub("[REDACTED_PHONE]", redacted)
    redacted = CARD_RE.sub("[REDACTED_CARD]", redacted)
    return redacted


def redact_mapping(value: Any) -> Any:
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            key_text = str(key).lower()
            if any(secret in key_text for secret in SENSITIVE_KEYS):
                result[key] = "[REDACTED]"
            else:
                result[key] = redact_mapping(item)
        return result
    if isinstance(value, list):
        return [redact_mapping(item) for item in value]
    if isinstance(value, str):
        return redact_pii(value)
    return value


def structured_log(logger: logging.Logger, level: int, event: str, **fields: Any) -> None:
    payload = {"event": event, **redact_mapping(fields)}
    logger.log(level, json.dumps(payload, ensure_ascii=False, default=str))


def request_id_from_headers(request: Request) -> str:
    return request.headers.get("x-request-id") or request.headers.get("x-correlation-id") or str(uuid4())


class ObservabilityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request_id_from_headers(request)
        request.state.request_id = request_id
        started = time.perf_counter()
        logger = logging.getLogger("assistant.request")
        try:
            response: Response = await call_next(request)
        except Exception:
            latency_ms = int((time.perf_counter() - started) * 1000)
            structured_log(
                logger,
                logging.ERROR,
                "request_error",
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                latency_ms=latency_ms,
            )
            raise
        latency_ms = int((time.perf_counter() - started) * 1000)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Assistant-Latency-Ms"] = str(latency_ms)
        structured_log(
            logger,
            logging.INFO,
            "request_completed",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            latency_ms=latency_ms,
        )
        return response


def browser_forbidden(request: Request) -> bool:
    sec_fetch_site = (request.headers.get("sec-fetch-site") or "").lower()
    if sec_fetch_site in {"same-origin", "same-site", "cross-site"}:
        return True
    origin = request.headers.get("origin")
    return bool(origin)


def assert_not_browser_request(request: Request) -> None:
    if browser_forbidden(request):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "BROWSER_FORBIDDEN",
                    "message": "Privileged assistant endpoints must be called server-to-server, not directly from a browser.",
                    "retryable": False,
                }
            },
        )


def sellable_fact_requested(text: str) -> bool:
    return bool(SELLABLE_FACT_RE.search(text or ""))
