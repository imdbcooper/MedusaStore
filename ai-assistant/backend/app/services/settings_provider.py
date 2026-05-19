"""TTL-cached provider over Medusa /internal/assistant/settings/effective.

The provider exposes the *effective* assistant configuration (active provider,
fallback chain, global settings) so the rest of the service can pick up
dashboard changes without redeploys. It is intentionally HTTP-only and does
not perform any LLM I/O.

Key behaviours:
  * TTL cache with single-flight refresh (`asyncio.Lock`).
  * Stale-while-error: if the upstream is briefly unavailable we keep serving
    the previous snapshot up to ``stale_after_seconds`` and emit a structured
    ``assistant.settings.stale_used`` warning.
  * Bounded retries with exponential backoff for transient network and 5xx
    failures. 4xx are surfaced immediately as ``SettingsFetchError``.
  * Plain ``api_key`` is preserved on the in-memory model but never logged or
    rendered via ``repr``; callers must read it explicitly.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Callable
from typing import Any

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.core.security import structured_log

_RETRY_STATUS_CODES: frozenset[int] = frozenset({500, 502, 503, 504})


class ProviderRuntime(BaseModel):
    """Runtime view of a single LLM provider entry from Medusa.

    The ``api_key`` field stores the *plain* secret. It must never be logged
    or echoed via ``repr`` — use :meth:`safe_repr` for diagnostics.
    """

    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    base_url: str
    api_key: str
    model: str
    temperature: float = 0.2
    max_tokens: int = 1024
    top_p: float | None = None
    timeout_ms: int = 30_000
    request_headers: dict[str, str] = Field(default_factory=dict)
    fallback_priority: int | None = None

    def safe_repr(self) -> str:
        last4 = self.api_key[-4:] if len(self.api_key) >= 4 else "***"
        return (
            f"<ProviderRuntime id={self.id} name={self.name} "
            f"model={self.model} key=***{last4}>"
        )

    def __repr__(self) -> str:  # pragma: no cover - delegation
        return self.safe_repr()

    def __str__(self) -> str:  # pragma: no cover - delegation
        return self.safe_repr()


class GlobalAssistantSettings(BaseModel):
    """Global assistant policy and limits managed in Medusa Admin."""

    model_config = ConfigDict(extra="ignore")

    system_prompt: str
    retrieval_mode: str = "auto"
    retrieval_top_k: int = 5
    retrieval_min_score: float = 0.0
    embedding_provider: str = "hashing"
    embedding_model: str | None = None
    embedding_dimension: int = 384
    max_history_messages: int = 10
    max_input_chars: int = 4000
    max_output_tokens: int = 1024
    streaming_enabled: bool = True
    default_locale: str = "ru"
    allowed_models: list[str] = Field(default_factory=list)
    tools_enabled: dict[str, bool] = Field(default_factory=dict)
    guardrails: dict[str, bool] = Field(default_factory=dict)
    rate_limits: dict[str, int] = Field(default_factory=dict)
    usage_tracking_enabled: bool = True
    observability: dict[str, bool] = Field(default_factory=dict)
    version: int = 1


class AssistantRuntimeSettings(BaseModel):
    """Snapshot of the effective assistant configuration.

    Cache bookkeeping (monotonic clock readings) lives on
    :class:`SettingsProvider`, not on the model itself, so the snapshot can be
    safely passed around, copied, or eventually serialised without leaking
    process-local timestamps.
    """

    model_config = ConfigDict(extra="ignore")

    version: str
    active: ProviderRuntime | None = None
    fallback: list[ProviderRuntime] = Field(default_factory=list)
    global_settings: GlobalAssistantSettings


class SettingsFetchError(RuntimeError):
    """Raised when settings cannot be fetched and no usable cache exists."""


class SettingsProvider:
    """TTL cache over Medusa ``/internal/assistant/settings/effective``.

    Concurrency model: one in-flight refresh per provider instance, guarded by
    an :class:`asyncio.Lock`. Awaiters that arrive while another coroutine is
    refreshing wait on the lock and then re-check the cache, so they do not
    trigger duplicate HTTP calls.

    The provider owns its :class:`httpx.AsyncClient` unless one is injected
    (used by tests with :class:`httpx.MockTransport`). When ownership is
    internal the client is closed in :meth:`aclose`.
    """

    def __init__(
        self,
        *,
        endpoint: str,
        server_token: str,
        ttl_seconds: float = 30.0,
        stale_after_seconds: float = 600.0,
        timeout_seconds: float = 5.0,
        retries: int = 3,
        retry_backoff_seconds: float = 0.25,
        client: httpx.AsyncClient | None = None,
        logger: logging.Logger | None = None,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        if not endpoint:
            raise ValueError("endpoint must be a non-empty URL")
        if not server_token:
            raise ValueError("server_token must be a non-empty string")
        if ttl_seconds < 0:
            raise ValueError("ttl_seconds must be >= 0")
        if stale_after_seconds < 0:
            raise ValueError("stale_after_seconds must be >= 0")
        if retries < 0:
            raise ValueError("retries must be >= 0")

        self._endpoint = endpoint
        self._server_token = server_token
        self._ttl_seconds = float(ttl_seconds)
        self._stale_after_seconds = float(stale_after_seconds)
        self._timeout_seconds = float(timeout_seconds)
        self._retries = int(retries)
        self._retry_backoff_seconds = float(retry_backoff_seconds)
        self._clock = clock
        self._logger = logger or logging.getLogger("assistant.settings")

        self._client = client
        self._owns_client = client is None

        self._refresh_lock = asyncio.Lock()
        self._snapshot: AssistantRuntimeSettings | None = None
        self._fetched_at: float | None = None
        self._closed = False

    async def get(self) -> AssistantRuntimeSettings:
        """Return a fresh snapshot, refreshing through HTTP if the TTL expired."""

        snapshot = self._fresh_snapshot()
        if snapshot is not None:
            return snapshot

        async with self._refresh_lock:
            # Double-check: another awaiter may have refreshed the cache while
            # we were waiting for the lock.
            snapshot = self._fresh_snapshot()
            if snapshot is not None:
                return snapshot

            try:
                fetched = await self._fetch_with_retries()
            except SettingsFetchError:
                stale = self._stale_snapshot_or_raise()
                return stale

            self._snapshot = fetched
            self._fetched_at = self._clock()
            structured_log(
                self._logger,
                logging.INFO,
                "assistant.settings.refresh",
                version=fetched.version,
                active_provider_id=fetched.active.id if fetched.active else None,
                fallback_count=len(fetched.fallback),
            )
            return fetched

    async def invalidate(self) -> None:
        """Drop the cached snapshot so the next :meth:`get` performs HTTP."""

        async with self._refresh_lock:
            self._snapshot = None
            self._fetched_at = None

    async def aclose(self) -> None:
        """Close the owned HTTP client, if any. Idempotent."""

        if self._closed:
            return
        self._closed = True
        if self._owns_client and self._client is not None:
            await self._client.aclose()
            self._client = None

    # ------------------------------------------------------------------ helpers

    def _fresh_snapshot(self) -> AssistantRuntimeSettings | None:
        if self._snapshot is None or self._fetched_at is None:
            return None
        if (self._clock() - self._fetched_at) < self._ttl_seconds:
            return self._snapshot
        return None

    def _stale_snapshot_or_raise(self) -> AssistantRuntimeSettings:
        if self._snapshot is None or self._fetched_at is None:
            raise SettingsFetchError(
                "Failed to fetch assistant settings and no cached snapshot is available",
            )
        age = self._clock() - self._fetched_at
        if age > self._stale_after_seconds:
            raise SettingsFetchError(
                "Failed to fetch assistant settings and cached snapshot is older "
                f"than stale window ({age:.1f}s > {self._stale_after_seconds:.1f}s)",
            )
        structured_log(
            self._logger,
            logging.WARNING,
            "assistant.settings.stale_used",
            version=self._snapshot.version,
            active_provider_id=(
                self._snapshot.active.id if self._snapshot.active else None
            ),
            fallback_count=len(self._snapshot.fallback),
            cache_age_seconds=round(age, 3),
        )
        return self._snapshot

    def _ensure_client(self) -> httpx.AsyncClient:
        if self._closed:
            raise RuntimeError("SettingsProvider has been closed")
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self._timeout_seconds)
        return self._client

    async def _fetch_with_retries(self) -> AssistantRuntimeSettings:
        client = self._ensure_client()
        headers = {
            "X-Assistant-Server-Token": self._server_token,
            "accept": "application/json",
        }
        attempts = self._retries + 1
        last_error: Exception | None = None

        for attempt in range(attempts):
            try:
                response = await client.get(
                    self._endpoint,
                    headers=headers,
                    timeout=self._timeout_seconds,
                )
            except httpx.RequestError as exc:
                last_error = exc
                structured_log(
                    self._logger,
                    logging.WARNING,
                    "assistant.settings.fetch_error",
                    attempt=attempt + 1,
                    max_attempts=attempts,
                    reason="network_error",
                    error=str(exc),
                )
                if attempt + 1 >= attempts:
                    break
                await self._sleep_backoff(attempt)
                continue

            status_code = response.status_code

            if status_code == 200:
                return self._parse_response(response)

            if status_code in {401, 403, 404}:
                structured_log(
                    self._logger,
                    logging.ERROR,
                    "assistant.settings.fetch_error",
                    attempt=attempt + 1,
                    max_attempts=attempts,
                    reason="non_retriable_http",
                    status_code=status_code,
                )
                raise SettingsFetchError(
                    f"Medusa rejected settings request with HTTP {status_code}",
                )

            if status_code in _RETRY_STATUS_CODES or 500 <= status_code < 600:
                last_error = SettingsFetchError(
                    f"Medusa returned HTTP {status_code} for settings endpoint",
                )
                structured_log(
                    self._logger,
                    logging.WARNING,
                    "assistant.settings.fetch_error",
                    attempt=attempt + 1,
                    max_attempts=attempts,
                    reason="retriable_http",
                    status_code=status_code,
                )
                if attempt + 1 >= attempts:
                    break
                await self._sleep_backoff(attempt)
                continue

            # Any other unexpected status (e.g. 3xx without redirect, 4xx not
            # whitelisted above) — fail fast without retries.
            structured_log(
                self._logger,
                logging.ERROR,
                "assistant.settings.fetch_error",
                attempt=attempt + 1,
                max_attempts=attempts,
                reason="unexpected_http",
                status_code=status_code,
            )
            raise SettingsFetchError(
                f"Unexpected HTTP {status_code} from assistant settings endpoint",
            )

        raise SettingsFetchError(
            f"Exhausted {attempts} attempts contacting assistant settings endpoint: {last_error}",
        )

    async def _sleep_backoff(self, attempt: int) -> None:
        delay = self._retry_backoff_seconds * (2**attempt)
        if delay > 0:
            await asyncio.sleep(delay)

    def _parse_response(self, response: httpx.Response) -> AssistantRuntimeSettings:
        try:
            payload: Any = response.json()
        except ValueError as exc:
            raise SettingsFetchError(f"Settings response is not valid JSON: {exc}") from exc

        if not isinstance(payload, dict):
            raise SettingsFetchError("Settings response root is not a JSON object")

        effective = payload.get("effective")
        if not isinstance(effective, dict):
            raise SettingsFetchError("Settings response has no 'effective' object")

        version = effective.get("version")
        if not isinstance(version, str) or not version:
            raise SettingsFetchError("Settings response is missing 'effective.version'")

        global_raw = effective.get("global")
        if not isinstance(global_raw, dict):
            raise SettingsFetchError("Settings response has no 'effective.global' object")

        active_raw = effective.get("active")
        fallback_raw = effective.get("fallback") or []

        try:
            global_settings = GlobalAssistantSettings.model_validate(global_raw)
        except ValidationError as exc:
            raise SettingsFetchError(f"Global settings payload is invalid: {exc}") from exc

        active: ProviderRuntime | None = None
        if active_raw is not None:
            if not isinstance(active_raw, dict):
                raise SettingsFetchError("'effective.active' must be an object or null")
            try:
                active = ProviderRuntime.model_validate(active_raw)
            except ValidationError as exc:
                raise SettingsFetchError(
                    f"Active provider payload is invalid: {exc}",
                ) from exc

        if not isinstance(fallback_raw, list):
            raise SettingsFetchError("'effective.fallback' must be a list")

        fallback: list[ProviderRuntime] = []
        for index, item in enumerate(fallback_raw):
            if not isinstance(item, dict):
                raise SettingsFetchError(
                    f"'effective.fallback[{index}]' must be an object",
                )
            try:
                fallback.append(ProviderRuntime.model_validate(item))
            except ValidationError as exc:
                raise SettingsFetchError(
                    f"Fallback provider payload is invalid at index {index}: {exc}",
                ) from exc

        # Re-sort defensively so the service does not depend on backend ordering.
        fallback.sort(
            key=lambda provider: (
                provider.fallback_priority is None,
                provider.fallback_priority if provider.fallback_priority is not None else 0,
                provider.name,
            ),
        )

        return AssistantRuntimeSettings(
            version=version,
            active=active,
            fallback=fallback,
            global_settings=global_settings,
        )


__all__ = [
    "AssistantRuntimeSettings",
    "GlobalAssistantSettings",
    "ProviderRuntime",
    "SettingsFetchError",
    "SettingsProvider",
]
