import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  AssistantSettingsError,
  ensureAssistantSettingsTables,
  getAssistantSettingsPgConnection,
  testLlmProvider,
} from "../../../../../../../modules/assistant-settings"
import { errorResponse } from "../../../_helpers"
import { LlmProviderTestQuerySchema } from "../../../_schemas"

/**
 * `POST /admin/assistant/settings/providers/:id/test`
 *
 * Connectivity probe — sends a minimal `chat/completions` request through
 * the configured base URL with the decrypted api_key. The query string is
 * parsed manually instead of via `validateAndTransformQuery` because the
 * route already gracefully defaults to `"ping"` and the central middleware
 * pattern would force redundant default-binding plumbing for one optional
 * field.
 *
 * Successful and failed probes are both returned with HTTP 200 — the
 * transport-level outcome lives in `result.ok`. This matches the contract
 * of [`testLlmProvider`](medusa-agency-boilerplate/src/modules/assistant-settings.ts:1336),
 * which never throws on network failures and persists `last_test_*` to the
 * provider row regardless.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const params = req.params as Record<string, unknown> | undefined
  const id = typeof params?.id === "string" ? params.id.trim() : ""
  if (!id) {
    errorResponse(
      res,
      new AssistantSettingsError("validation", "id is required")
    )
    return
  }

  // Strict query parse — unknown keys / oversized prompts → 400.
  const parsed = LlmProviderTestQuerySchema.safeParse(
    (req.query as Record<string, unknown>) ?? {}
  )
  if (!parsed.success) {
    res.status(400).json({
      error: "validation",
      message: parsed.error.issues[0]?.message || "Invalid query",
    })
    return
  }

  try {
    const pg = getAssistantSettingsPgConnection(req.scope)
    await ensureAssistantSettingsTables(pg)
    const result = await testLlmProvider(pg, id, {
      prompt: parsed.data.prompt,
    })
    res.status(200).json({ result })
  } catch (err) {
    errorResponse(res, err)
  }
}
