"""OpenAI-compatible LLM client and provider router.

This module hosts two layers:

* :class:`OpenAICompatibleClient` — minimal ``/v1/chat/completions`` client
  with bounded internal retries (1 retry on network errors, 5xx, or 429 with
  ``Retry-After`` honoured). It supports both buffered (``complete``) and
  streamed (``stream``) flows. The client never logs ``api_key`` material —
  only :meth:`ProviderRuntime.safe_repr` is used for diagnostics.
* :class:`LlmRouter` — composes :class:`SettingsProvider` with the client and
  walks the ``active → fallback[0] → fallback[1] → …`` chain on failure. The
  streaming variant only walks the chain *before* the first token is emitted;
  a mid-stream failure is propagated to the caller verbatim so the chat layer
  can decide how to surface it.

Both classes accept dependency-injection seams (``client``, ``client_factory``,
``clock``, ``sleeper``) so unit tests can run without real network or wall
clock.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any

import httpx
from pydantic import BaseModel, ConfigDict, Field

from app.core.security import structured_log
from app.services.settings_provider import (
    AssistantRuntimeSettings,
    ProviderRuntime,
    SettingsFetchError,
    SettingsProvider,
)

# --------------------------------------------------------------------------- #
# Pydantic models
# --------------------------------------------------------------------------- #


class ChatMessage(BaseModel):
    """Single chat-completion message (``role``/``content``)."""

    model_config = ConfigDict(extra="ignore")

    role: str
    content: str


class LlmCallRequest(BaseModel):
    """Provider-agnostic request payload for one completion call."""

    model_config = ConfigDict(extra="ignore")

    system_prompt: str
    messages: list[ChatMessage] = Field(default_factory=list)
    max_tokens: int = 1024
    temperature: float = 0.2
    top_p: float | None = None
    stream: bool = False


class LlmUsage(BaseModel):
    """Token usage block returned by the provider, when available."""

    model_config = ConfigDict(extra="ignore")

    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class LlmResult(BaseModel):
    """Successful completion result, decorated with routing metadata."""

    model_config = ConfigDict(extra="ignore")

    content: str
    finish_reason: str = "stop"
    usage: LlmUsage = Field(default_factory=LlmUsage)
    provider_id: str
    provider_name: str
    model: str
    latency_ms: int
    attempts: int = 1


class LlmRoutingError(Exception):
    """Raised when the router could not produce a result."""

    def __init__(self, message: str, attempts: list[dict[str, Any]] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.attempts = attempts or []


# --------------------------------------------------------------------------- #
# Single-provider HTTP client
# --------------------------------------------------------------------------- #


_DEFAULT_RETRY_BACKOFF_SECONDS = 0.5
_DEFAULT_RATE_LIMIT_BACKOFF_SECONDS = 1.0
_RETRY_STATUS_CODES = frozenset({500, 502, 503, 504})


class OpenAICompatibleClient:
    """OpenAI-compatible ``/chat/completions`` client for one provider.

    Handles bounded retries (1 retry on network/timeout/5xx, 1 retry on 429
    respecting ``Retry-After``). 4xx other than 429 are surfaced via
    :class:`httpx.HTTPStatusError` so the router can convert them into an
    attempt record.
    """

    def __init__(
        self,
        provider: ProviderRuntime,
        *,
        client: httpx.AsyncClient | None = None,
        max_internal_retries: int = 1,
        clock: Callable[[], float] = time.monotonic,
        sleeper: Callable[[float], Awaitable[None]] = asyncio.sleep,
        logger: logging.Logger | None = None,
    ) -> None:
        if max_internal_retries < 0:
            raise ValueError("max_internal_retries must be >= 0")
        self.provider = provider
        self._client = client
        self._owns_client = client is None
        self._max_internal_retries = int(max_internal_retries)
        self._clock = clock
        self._sleeper = sleeper
        self._logger = logger or logging.getLogger("assistant.llm")
        self._closed = False

    # ------------------------------------------------------------------ public

    async def complete(self, req: LlmCallRequest) -> LlmResult:
        """Send a buffered chat-completions request, returning the assistant text."""

        url = self._endpoint()
        headers = self._headers()
        body = self._build_body(req, stream=False)
        timeout = self._timeout_seconds()

        client = self._ensure_client()
        attempts = 0
        max_attempts = self._max_internal_retries + 1
        started = self._clock()
        last_error: Exception | None = None

        for attempt_idx in range(max_attempts):
            attempts = attempt_idx + 1
            try:
                response = await client.post(
                    url,
                    headers=headers,
                    json=body,
                    timeout=timeout,
                )
            except (httpx.RequestError, httpx.TimeoutException) as exc:
                last_error = exc
                self._log_attempt_warning(
                    attempt=attempts,
                    max_attempts=max_attempts,
                    reason="network_error",
                    error=str(exc),
                )
                if attempts >= max_attempts:
                    raise
                await self._sleeper(_DEFAULT_RETRY_BACKOFF_SECONDS)
                continue

            status_code = response.status_code

            if status_code == 200:
                latency_ms = int((self._clock() - started) * 1000)
                return self._parse_complete_response(response, latency_ms, attempts)

            if status_code == 429:
                retry_after = _parse_retry_after(response.headers.get("retry-after"))
                self._log_attempt_warning(
                    attempt=attempts,
                    max_attempts=max_attempts,
                    reason="rate_limited",
                    status_code=status_code,
                    retry_after=retry_after,
                )
                if attempts >= max_attempts:
                    response.raise_for_status()
                await self._sleeper(retry_after if retry_after > 0 else _DEFAULT_RATE_LIMIT_BACKOFF_SECONDS)
                continue

            if status_code in _RETRY_STATUS_CODES or 500 <= status_code < 600:
                last_error = httpx.HTTPStatusError(
                    f"Provider returned HTTP {status_code}",
                    request=response.request,
                    response=response,
                )
                self._log_attempt_warning(
                    attempt=attempts,
                    max_attempts=max_attempts,
                    reason="server_error",
                    status_code=status_code,
                )
                if attempts >= max_attempts:
                    response.raise_for_status()
                await self._sleeper(_DEFAULT_RETRY_BACKOFF_SECONDS)
                continue

            # Non-retriable 4xx (401, 403, 404, 422, ...).
            self._log_attempt_warning(
                attempt=attempts,
                max_attempts=max_attempts,
                reason="non_retriable_http",
                status_code=status_code,
            )
            response.raise_for_status()

        # Defensive fallback: the loop above always raises or returns on the
        # final attempt. If we somehow exit without a result, surface the last
        # captured error for visibility.
        if last_error is not None:
            raise last_error
        raise RuntimeError("OpenAICompatibleClient.complete exited without a result")

    async def stream(self, req: LlmCallRequest) -> AsyncIterator[str]:
        """Stream text deltas from the provider as they arrive.

        Connect-time failures (network errors, non-200 status) propagate from
        :meth:`stream` itself, *before* the iterator starts producing deltas,
        so the router can decide whether to walk the fallback chain. After
        the first chunk has been emitted, downstream errors are re-raised in
        place — the chat service is responsible for surfacing them as SSE
        ``error`` events.
        """

        url = self._endpoint()
        headers = self._headers()
        body = self._build_body(req, stream=True)
        timeout = self._timeout_seconds()

        client = self._ensure_client()

        request = client.build_request(
            "POST",
            url,
            headers=headers,
            json=body,
            timeout=timeout,
        )
        response = await client.send(request, stream=True)

        try:
            if response.status_code != 200:
                # Drain the body so we can include it in error context, then
                # raise like the non-streaming code path.
                await response.aread()
                response.raise_for_status()
        except BaseException:
            await response.aclose()
            raise

        async def gen() -> AsyncIterator[str]:
            try:
                async for line in response.aiter_lines():
                    delta = _parse_sse_delta(line)
                    if delta is _SSE_DONE:
                        return
                    if delta is None:
                        continue
                    if not delta:
                        continue
                    yield delta
            finally:
                await response.aclose()

        return gen()

    async def aclose(self) -> None:
        if self._closed:
            return
        self._closed = True
        if self._owns_client and self._client is not None:
            await self._client.aclose()
            self._client = None

    # ----------------------------------------------------------------- helpers

    def _ensure_client(self) -> httpx.AsyncClient:
        if self._closed:
            raise RuntimeError("OpenAICompatibleClient has been closed")
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=self._timeout_seconds())
        return self._client

    def _endpoint(self) -> str:
        return f"{self.provider.base_url.rstrip('/')}/chat/completions"

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {
            "Authorization": f"Bearer {self.provider.api_key}",
            "Content-Type": "application/json",
        }
        for key, value in (self.provider.request_headers or {}).items():
            # Provider-defined extra headers must not silently overwrite the
            # mandatory Content-Type / Authorization values: we keep the
            # provider entries last so admins can intentionally override them
            # only if they really need to.
            headers[str(key)] = str(value)
        return headers

    def _timeout_seconds(self) -> float:
        return max(0.001, self.provider.timeout_ms / 1000.0)

    def _build_body(self, req: LlmCallRequest, *, stream: bool) -> dict[str, Any]:
        messages: list[dict[str, str]] = []
        if req.system_prompt:
            messages.append({"role": "system", "content": req.system_prompt})
        for msg in req.messages:
            messages.append({"role": msg.role, "content": msg.content})

        body: dict[str, Any] = {
            "model": self.provider.model,
            "messages": messages,
            "max_tokens": req.max_tokens,
            "temperature": req.temperature,
            "stream": bool(stream),
        }
        if req.top_p is not None:
            body["top_p"] = req.top_p
        return body

    def _parse_complete_response(
        self,
        response: httpx.Response,
        latency_ms: int,
        attempts: int,
    ) -> LlmResult:
        try:
            payload = response.json()
        except ValueError as exc:
            raise httpx.HTTPStatusError(
                f"Provider returned non-JSON 200 body: {exc}",
                request=response.request,
                response=response,
            ) from exc

        if not isinstance(payload, dict):
            raise httpx.HTTPStatusError(
                "Provider 200 body is not a JSON object",
                request=response.request,
                response=response,
            )

        choices = payload.get("choices") or []
        if not isinstance(choices, list) or not choices:
            raise httpx.HTTPStatusError(
                "Provider response has no choices",
                request=response.request,
                response=response,
            )

        first = choices[0] if isinstance(choices[0], dict) else {}
        message = first.get("message") if isinstance(first, dict) else None
        content = ""
        if isinstance(message, dict):
            content = str(message.get("content") or "")
        finish_reason = str(first.get("finish_reason") or "stop")

        usage_raw = payload.get("usage") if isinstance(payload, dict) else None
        usage = LlmUsage()
        if isinstance(usage_raw, dict):
            usage = LlmUsage(
                prompt_tokens=int(usage_raw.get("prompt_tokens") or 0),
                completion_tokens=int(usage_raw.get("completion_tokens") or 0),
                total_tokens=int(usage_raw.get("total_tokens") or 0),
            )

        return LlmResult(
            content=content,
            finish_reason=finish_reason,
            usage=usage,
            provider_id=self.provider.id,
            provider_name=self.provider.name,
            model=self.provider.model,
            latency_ms=latency_ms,
            attempts=attempts,
        )

    def _log_attempt_warning(
        self,
        *,
        attempt: int,
        max_attempts: int,
        reason: str,
        **fields: Any,
    ) -> None:
        structured_log(
            self._logger,
            logging.WARNING,
            "assistant.llm.attempt_error",
            provider=self.provider.safe_repr(),
            provider_id=self.provider.id,
            attempt=attempt,
            max_attempts=max_attempts,
            reason=reason,
            **fields,
        )


# --------------------------------------------------------------------------- #
# SSE parsing helpers
# --------------------------------------------------------------------------- #


_SSE_DONE: object = object()


def _parse_sse_delta(line: str) -> str | object | None:
    """Return the next content delta, ``_SSE_DONE``, or ``None`` for ignored lines."""

    if not line:
        return None
    raw = line.lstrip()
    if not raw.startswith("data:"):
        return None
    payload = raw[len("data:") :].strip()
    if not payload:
        return None
    if payload == "[DONE]":
        return _SSE_DONE
    try:
        parsed = json.loads(payload)
    except ValueError:
        return None
    if not isinstance(parsed, dict):
        return None
    choices = parsed.get("choices") or []
    if not isinstance(choices, list) or not choices:
        return None
    first = choices[0]
    if not isinstance(first, dict):
        return None
    delta = first.get("delta")
    if not isinstance(delta, dict):
        return None
    content = delta.get("content")
    if content is None:
        return ""
    return str(content)


def _parse_retry_after(header_value: str | None) -> float:
    if not header_value:
        return _DEFAULT_RATE_LIMIT_BACKOFF_SECONDS
    try:
        return max(0.0, float(header_value))
    except ValueError:
        return _DEFAULT_RATE_LIMIT_BACKOFF_SECONDS


# --------------------------------------------------------------------------- #
# Router
# --------------------------------------------------------------------------- #


ClientFactory = Callable[[ProviderRuntime], OpenAICompatibleClient]


def _default_client_factory(provider: ProviderRuntime) -> OpenAICompatibleClient:
    return OpenAICompatibleClient(provider)


class LlmRouter:
    """Walk ``active → fallback[*]`` chain, returning the first success."""

    def __init__(
        self,
        settings_provider: SettingsProvider,
        *,
        client_factory: ClientFactory | None = None,
        logger: logging.Logger | None = None,
    ) -> None:
        self._settings_provider = settings_provider
        self._client_factory = client_factory or _default_client_factory
        self._logger = logger or logging.getLogger("assistant.llm.router")
        self._closed = False

    # ------------------------------------------------------------------ public

    async def complete(self, req: LlmCallRequest) -> LlmResult:
        """Buffered chat-completion with provider failover."""

        runtime = await self._safe_get_settings()
        chain = _provider_chain(runtime)
        if not chain:
            raise LlmRoutingError("no_providers_configured", attempts=[])

        attempts: list[dict[str, Any]] = []
        total_attempts = 0
        for provider in chain:
            client = self._client_factory(provider)
            try:
                result = await client.complete(req)
            except Exception as exc:  # noqa: BLE001 — converted to attempt record
                record = _attempt_record_from_exception(provider, exc)
                attempts.append(record)
                total_attempts += int(record.get("attempts") or 1)
                self._log_attempt_failure(provider, record)
                await _safe_aclose(client)
                continue
            else:
                total_attempts += int(result.attempts or 1)
                await _safe_aclose(client)
                return result.model_copy(update={"attempts": total_attempts})

        raise LlmRoutingError("all_providers_failed", attempts=attempts)

    async def stream(
        self,
        req: LlmCallRequest,
    ) -> tuple[ProviderRuntime, AsyncIterator[str]]:
        """Stream chat-completion deltas from the first provider that connects.

        Returns a ``(provider, iterator)`` tuple. ``provider`` is the runtime
        record that actually produced the stream, useful for logs and the
        ``done`` SSE event.
        """

        runtime = await self._safe_get_settings()
        chain = _provider_chain(runtime)
        if not chain:
            raise LlmRoutingError("no_providers_configured", attempts=[])

        attempts: list[dict[str, Any]] = []
        for provider in chain:
            client = self._client_factory(provider)
            try:
                base_iterator = await client.stream(req)
            except Exception as exc:  # noqa: BLE001 — connect-time failure
                record = _attempt_record_from_exception(provider, exc)
                attempts.append(record)
                self._log_attempt_failure(provider, record)
                await _safe_aclose(client)
                continue

            iterator = self._wrap_stream(client, provider, base_iterator)
            return provider, iterator

        raise LlmRoutingError("all_providers_failed", attempts=attempts)

    async def aclose(self) -> None:
        # The router does not own the settings provider or per-call clients;
        # everything is lifecycle-bound to a single ``complete``/``stream``
        # call. ``aclose`` exists so callers can mirror httpx semantics.
        self._closed = True

    # ----------------------------------------------------------------- helpers

    async def _safe_get_settings(self) -> AssistantRuntimeSettings:
        try:
            return await self._settings_provider.get()
        except SettingsFetchError as exc:
            raise LlmRoutingError("settings_unavailable", attempts=[]) from exc

    def _log_attempt_failure(
        self,
        provider: ProviderRuntime,
        record: dict[str, Any],
    ) -> None:
        structured_log(
            self._logger,
            logging.WARNING,
            "assistant.llm.provider_failed",
            provider=provider.safe_repr(),
            provider_id=provider.id,
            error=record.get("error"),
            http_status=record.get("http_status"),
        )

    async def _wrap_stream(
        self,
        client: OpenAICompatibleClient,
        provider: ProviderRuntime,
        iterator: AsyncIterator[str],
    ) -> AsyncIterator[str]:
        try:
            async for delta in iterator:
                yield delta
        finally:
            await _safe_aclose(client)


# --------------------------------------------------------------------------- #
# Module-level helpers
# --------------------------------------------------------------------------- #


def _provider_chain(runtime: AssistantRuntimeSettings) -> list[ProviderRuntime]:
    chain: list[ProviderRuntime] = []
    if runtime.active is not None:
        chain.append(runtime.active)
    chain.extend(runtime.fallback)
    return chain


def _attempt_record_from_exception(
    provider: ProviderRuntime,
    exc: BaseException,
) -> dict[str, Any]:
    record: dict[str, Any] = {
        "provider_id": provider.id,
        "provider_name": provider.name,
        "error": str(exc),
        "attempts": 1,
    }
    if isinstance(exc, httpx.HTTPStatusError) and exc.response is not None:
        record["http_status"] = exc.response.status_code
    return record


async def _safe_aclose(client: OpenAICompatibleClient) -> None:
    try:
        await client.aclose()
    except Exception:  # noqa: BLE001 — close errors must not mask completion errors
        pass


__all__ = [
    "ChatMessage",
    "LlmCallRequest",
    "LlmResult",
    "LlmRouter",
    "LlmRoutingError",
    "LlmUsage",
    "OpenAICompatibleClient",
]
