import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ensureAssistantSettingsTables,
  getAssistantSettingsPgConnection,
  reorderFallbackChain,
} from "../../../../../../modules/assistant-settings"
import { errorResponse, toPublicProvider } from "../../_helpers"
import type { ReorderFallbackBody } from "../../_schemas"

/**
 * `POST /admin/assistant/settings/providers/reorder-fallback`
 *
 * Replaces the fallback chain with the provided ordered list of provider
 * ids. Validation lives in two layers:
 *   - `ReorderFallbackSchema` (Zod) — rejects non-array / oversize input;
 *   - [`reorderFallbackChain`](medusa-agency-boilerplate/src/modules/assistant-settings.ts:1165)
 *     additionally enforces uniqueness, that every id exists, and that
 *     every referenced provider is enabled.
 *
 * Returns the resulting fallback chain as an array of public providers in
 * the new order, so the UI can refresh without an extra GET.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<ReorderFallbackBody>,
  res: MedusaResponse
) {
  try {
    const input = req.validatedBody as ReorderFallbackBody
    const pg = getAssistantSettingsPgConnection(req.scope)
    await ensureAssistantSettingsTables(pg)
    const providers = await reorderFallbackChain(pg, input.ordered_ids)
    res.status(200).json({
      providers: providers.map(toPublicProvider),
    })
  } catch (err) {
    errorResponse(res, err)
  }
}
