import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  AssistantSettingsError,
  ensureAssistantSettingsTables,
  getAssistantSettingsPgConnection,
  setActiveLlmProvider,
} from "../../../../../../../modules/assistant-settings"
import { errorResponse, toPublicProvider } from "../../../_helpers"

/**
 * `POST /admin/assistant/settings/providers/:id/activate`
 *
 * Marks the given provider as the active one for runtime traffic. The
 * module's
 * [`setActiveLlmProvider`](medusa-agency-boilerplate/src/modules/assistant-settings.ts:1105)
 * runs the swap in a transaction and refuses to activate a disabled
 * provider (`provider_disabled` → 409 via {@link errorResponse}).
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

  try {
    const pg = getAssistantSettingsPgConnection(req.scope)
    await ensureAssistantSettingsTables(pg)
    const provider = await setActiveLlmProvider(pg, id)
    res.status(200).json({ provider: toPublicProvider(provider) })
  } catch (err) {
    errorResponse(res, err)
  }
}
