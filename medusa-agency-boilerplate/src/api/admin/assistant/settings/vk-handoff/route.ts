import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ensureAssistantSettingsTables,
  getAssistantSettingsPgConnection,
  getAssistantVkHandoffConfig,
  updateAssistantVkHandoffConfig,
} from "../../../../../modules/assistant-settings"
import { errorResponse } from "../_helpers"
import type { AssistantVkHandoffUpdateBody } from "../_schemas"

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  try {
    const pg = getAssistantSettingsPgConnection(req.scope)
    await ensureAssistantSettingsTables(pg)
    const config = await getAssistantVkHandoffConfig(pg)
    res.status(200).json({ config })
  } catch (err) {
    errorResponse(res, err)
  }
}

export async function PATCH(
  req: AuthenticatedMedusaRequest<AssistantVkHandoffUpdateBody>,
  res: MedusaResponse
) {
  try {
    const body = req.validatedBody as AssistantVkHandoffUpdateBody
    const { expected_version, ...rest } = body
    const pg = getAssistantSettingsPgConnection(req.scope)
    await ensureAssistantSettingsTables(pg)
    const config = await updateAssistantVkHandoffConfig(
      pg,
      rest,
      { expectedVersion: expected_version }
    )
    res.status(200).json({ config })
  } catch (err) {
    errorResponse(res, err)
  }
}
