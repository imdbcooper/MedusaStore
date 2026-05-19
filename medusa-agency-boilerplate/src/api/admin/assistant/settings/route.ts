import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ensureAssistantSettingsTables,
  getAssistantSetting,
  getAssistantSettingsPgConnection,
  updateAssistantSetting,
  type AssistantSettingUpdateInput,
} from "../../../../modules/assistant-settings"
import { errorResponse } from "./_helpers"
import type { AssistantSettingUpdateBody } from "./_schemas"

/**
 * `/admin/assistant/settings`
 *
 * - `GET`   — read the singleton `assistant_setting` row (auto-seeded by
 *   the module's `ensureAssistantSettingsTables`).
 * - `PATCH` — partial update with optimistic concurrency via
 *   `expected_version`. The route splits `expected_version` out of the
 *   wire body and forwards the rest to
 *   [`updateAssistantSetting`](medusa-agency-boilerplate/src/modules/assistant-settings.ts:1530).
 *
 * `updated_by` is sourced from `req.auth_context?.actor_id` (the admin
 * user). When the actor is missing (e.g. api-key path with no user
 * resolved), we forward `null`, matching the column's nullability.
 */

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  try {
    const pg = getAssistantSettingsPgConnection(req.scope)
    await ensureAssistantSettingsTables(pg)
    const settings = await getAssistantSetting(pg)
    res.status(200).json({ settings })
  } catch (err) {
    errorResponse(res, err)
  }
}

export async function PATCH(
  req: AuthenticatedMedusaRequest<AssistantSettingUpdateBody>,
  res: MedusaResponse
) {
  try {
    const body = req.validatedBody as AssistantSettingUpdateBody
    const { expected_version, ...rest } = body
    const pg = getAssistantSettingsPgConnection(req.scope)
    await ensureAssistantSettingsTables(pg)
    const updatedBy = req.auth_context?.actor_id ?? null
    const settings = await updateAssistantSetting(
      pg,
      rest as AssistantSettingUpdateInput,
      {
        expectedVersion: expected_version,
        // updateAssistantSetting accepts `string` for updatedBy; forward
        // `null` only via the body branch when there is no actor.
        ...(updatedBy ? { updatedBy } : {}),
      }
    )
    res.status(200).json({ settings })
  } catch (err) {
    errorResponse(res, err)
  }
}
