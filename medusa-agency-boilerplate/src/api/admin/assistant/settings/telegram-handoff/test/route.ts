import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  AssistantSettingsError,
  getAssistantSettingsPgConnection,
  recordAssistantTelegramHandoffTestResult,
} from "../../../../../../modules/assistant-settings"
import { requireAssistantBackendClient } from "../../../../../../modules/assistant-runtime"
import {
  assistantClientErrorResponse,
  errorResponse,
} from "../../_helpers"
import type { AssistantTelegramHandoffTestBody } from "../../_schemas"

/**
 * `POST /admin/assistant/settings/telegram-handoff/test`
 *
 * Runs a live server-to-server Telegram connection check against the SAVED
 * configuration snapshot. Unsaved local overrides must be persisted first.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AssistantTelegramHandoffTestBody>,
  res: MedusaResponse
) {
  try {
    const body = (req.validatedBody as AssistantTelegramHandoffTestBody) ?? {}
    if (Object.keys(body).length > 0) {
      throw new AssistantSettingsError(
        "validation",
        "Save the Telegram handoff configuration before running a live connection test."
      )
    }
    const client = requireAssistantBackendClient()
    const result = await client.testTelegramHandoffConnection()
    const pg = getAssistantSettingsPgConnection(req.scope)
    await recordAssistantTelegramHandoffTestResult(pg, result)
    res.status(200).json({ result })
  } catch (err) {
    if (err instanceof AssistantSettingsError) {
      errorResponse(res, err)
      return
    }
    assistantClientErrorResponse(res, err)
  }
}
