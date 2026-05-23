import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ensureAssistantSettingsTables,
  getAssistantSettingsPgConnection,
  getAssistantTelegramHandoffConfig,
  updateAssistantTelegramHandoffConfig,
} from "../../../../../modules/assistant-settings"
import { errorResponse } from "../_helpers"
import type { AssistantTelegramHandoffUpdateBody } from "../_schemas"

/**
 * `/admin/assistant/settings/telegram-handoff`
 *
 * Stores the Telegram handoff configuration in Medusa's backend.
 * Secrets are encrypted at rest and never leave the API as plain-text.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  try {
    const pg = getAssistantSettingsPgConnection(req.scope)
    await ensureAssistantSettingsTables(pg)
    const config = await getAssistantTelegramHandoffConfig(pg)
    res.status(200).json({ config })
  } catch (err) {
    errorResponse(res, err)
  }
}

export async function PATCH(
  req: AuthenticatedMedusaRequest<AssistantTelegramHandoffUpdateBody>,
  res: MedusaResponse
) {
  try {
    const body = req.validatedBody as AssistantTelegramHandoffUpdateBody
    const { expected_version, ...rest } = body
    const pg = getAssistantSettingsPgConnection(req.scope)
    await ensureAssistantSettingsTables(pg)
    const config = await updateAssistantTelegramHandoffConfig(
      pg,
      rest,
      { expectedVersion: expected_version }
    )
    res.status(200).json({ config })
  } catch (err) {
    errorResponse(res, err)
  }
}
