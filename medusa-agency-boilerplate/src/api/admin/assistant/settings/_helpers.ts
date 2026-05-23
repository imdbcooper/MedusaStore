import type { MedusaResponse } from "@medusajs/framework/http"
import {
  AssistantSettingsError,
  type LlmProviderRow,
} from "../../../../modules/assistant-settings"
import type { AssistantClientError } from "../../../../lib/assistant-client"

/**
 * Shared response helpers for the assistant-settings admin API (PR 3).
 *
 * - {@link errorResponse} maps {@link AssistantSettingsError} codes to HTTP
 *   statuses with a stable wire shape `{ error, message }`. The chosen
 *   shape mirrors the module's typed-error contract (see
 *   {@link ASSISTANT_SETTINGS_ERROR_CODES}) and intentionally NEVER carries
 *   `api_key` / ciphertext / IV / tag fields.
 * - {@link toPublicProvider} strips encrypted columns from a provider row
 *   before serializing to the wire. The Admin UI may surface
 *   `api_key_last4` (so the operator can identify which secret is in use)
 *   along with a derived `api_key_masked` string.
 */

// ---------------------------------------------------------------------------
// HTTP error mapping
// ---------------------------------------------------------------------------

const ASSISTANT_ERROR_STATUS: Record<string, number> = {
  not_found: 404,
  already_exists: 409,
  validation: 400,
  encryption_failure: 500,
  encryption_not_configured: 503,
  active_required: 409,
  provider_disabled: 409,
  version_mismatch: 409,
}

/**
 * Map an unknown thrown error into a JSON HTTP response.
 *
 * Strategy:
 *   - {@link AssistantSettingsError} → typed code/status mapping above;
 *   - any other Error → 500 `internal_error` with the error message;
 *   - non-Error values (string, undefined…) → 500 `internal_error` with a
 *     generic message.
 *
 * The function does NOT log — callers may add logging at the route layer if
 * useful, but the body never leaks `api_key` because none of these branches
 * serialize the original input back to the client.
 */
export function errorResponse(res: MedusaResponse, error: unknown): void {
  if (error instanceof AssistantSettingsError) {
    const status = ASSISTANT_ERROR_STATUS[error.code] ?? 500
    res.status(status).json({
      error: error.code,
      message: error.message,
    })
    return
  }

  const message =
    error instanceof Error ? error.message : "Unexpected internal error"
  res.status(500).json({
    error: "internal_error",
    message,
  })
}

export function assistantClientErrorResponse(
  res: MedusaResponse,
  error: unknown
): void {
  const assistantError = error as Partial<AssistantClientError>
  const rawStatus =
    typeof assistantError.status === "number" ? assistantError.status : 500
  const status = rawStatus === 401 || rawStatus === 403 ? 502 : rawStatus
  res.status(status).json({
    error: assistantError.code || "AI_ASSISTANT_ADAPTER_ERROR",
    message:
      error instanceof Error
        ? error.message
        : "AI Assistant adapter request failed",
  })
}

// ---------------------------------------------------------------------------
// Provider serialization
// ---------------------------------------------------------------------------

/**
 * Public DTO returned by every admin route that surfaces an LLM provider.
 *
 * The shape is `LlmProviderRow` PLUS a UI-friendly masked rendering of the
 * api_key. The encrypted-at-rest columns
 * (`api_key_ciphertext` / `api_key_iv` / `api_key_tag`) and the decrypted
 * runtime field (`api_key`) are NEVER present here — they live only on
 * `LlmProviderRuntime`, which is internal to the module + the
 * `effective` runtime endpoint.
 */
export type PublicLlmProvider = LlmProviderRow & {
  api_key_masked: string
}

/**
 * Build a UI-facing mask from `api_key_last4`. Format: `••••<last4>` with
 * an empty-string fallback when the row pre-dates the `api_key_last4`
 * column (defensive — the module always writes it on insert/update).
 */
function maskSecret(last4: string | null | undefined): string {
  if (!last4) return ""
  return `••••${last4}`
}

/**
 * Serialize a {@link LlmProviderRow} for the Admin UI / public response.
 *
 * Spreads the row as-is (the row type intentionally does NOT include
 * encrypted columns — see
 * [`PROVIDER_PUBLIC_COLUMNS`](medusa-agency-boilerplate/src/modules/assistant-settings.ts:721))
 * and adds `api_key_masked`. Keeping `api_key_last4` in the payload is
 * deliberate: the UI uses it to confirm "yes, this is the same key I
 * configured" without ever seeing the secret itself.
 */
export function toPublicProvider(row: LlmProviderRow): PublicLlmProvider {
  return {
    ...row,
    api_key_masked: maskSecret(row.api_key_last4),
  }
}
