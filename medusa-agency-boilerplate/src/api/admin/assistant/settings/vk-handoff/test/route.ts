import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  AssistantSettingsError,
  getAssistantSettingsPgConnection,
  recordAssistantVkHandoffTestResult,
} from "../../../../../../modules/assistant-settings"
import { requireAssistantBackendClient } from "../../../../../../modules/assistant-runtime"
import {
  assistantClientErrorResponse,
  errorResponse,
} from "../../_helpers"
import type { AssistantVkHandoffTestBody } from "../../_schemas"

export async function POST(
  req: AuthenticatedMedusaRequest<AssistantVkHandoffTestBody>,
  res: MedusaResponse
) {
  try {
    const body = (req.validatedBody as AssistantVkHandoffTestBody) ?? {}
    if (Object.keys(body).length > 0) {
      throw new AssistantSettingsError(
        "validation",
        "Save the VK handoff configuration before running a live connection test."
      )
    }
    const client = requireAssistantBackendClient()
    const result = await client.testVkHandoffConnection()
    const pg = getAssistantSettingsPgConnection(req.scope)
    await recordAssistantVkHandoffTestResult(pg, result)
    res.status(200).json({ result })
  } catch (err) {
    if (err instanceof AssistantSettingsError) {
      errorResponse(res, err)
      return
    }
    assistantClientErrorResponse(res, err)
  }
}
