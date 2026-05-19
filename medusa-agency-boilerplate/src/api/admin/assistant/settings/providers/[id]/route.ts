import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  AssistantSettingsError,
  deleteLlmProvider,
  ensureAssistantSettingsTables,
  getAssistantSettingsPgConnection,
  getLlmProvider,
  updateLlmProvider,
} from "../../../../../../modules/assistant-settings"
import { errorResponse, toPublicProvider } from "../../_helpers"
import type { LlmProviderUpdateBody } from "../../_schemas"

/**
 * `/admin/assistant/settings/providers/:id`
 *
 * - `GET`    — fetch one provider; 404 if missing.
 * - `PATCH`  — partial update (body validated by
 *   [`LlmProviderUpdateSchema`](medusa-agency-boilerplate/src/api/admin/assistant/settings/_schemas.ts:1)
 *   in `middlewares.ts`).
 * - `DELETE` — remove provider; returns 204 with `X-Was-Active` header.
 */

function getId(req: AuthenticatedMedusaRequest): string {
  const params = req.params as Record<string, unknown> | undefined
  return typeof params?.id === "string" ? params.id.trim() : ""
}

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const id = getId(req)
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
    const provider = await getLlmProvider(pg, id)
    if (!provider) {
      res.status(404).json({
        error: "not_found",
        message: `Provider with id '${id}' was not found`,
      })
      return
    }
    res.status(200).json({ provider: toPublicProvider(provider) })
  } catch (err) {
    errorResponse(res, err)
  }
}

export async function PATCH(
  req: AuthenticatedMedusaRequest<LlmProviderUpdateBody>,
  res: MedusaResponse
) {
  const id = getId(req)
  if (!id) {
    errorResponse(
      res,
      new AssistantSettingsError("validation", "id is required")
    )
    return
  }
  try {
    const input = req.validatedBody as LlmProviderUpdateBody
    const pg = getAssistantSettingsPgConnection(req.scope)
    await ensureAssistantSettingsTables(pg)
    const provider = await updateLlmProvider(pg, id, input)
    res.status(200).json({ provider: toPublicProvider(provider) })
  } catch (err) {
    errorResponse(res, err)
  }
}

export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const id = getId(req)
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
    const result = await deleteLlmProvider(pg, id)
    if (!result.deleted) {
      res.status(404).json({
        error: "not_found",
        message: `Provider with id '${id}' was not found`,
      })
      return
    }
    // Surface whether the deleted row was active so the UI can prompt the
    // operator to pick a new active provider without an extra round trip.
    res.setHeader("X-Was-Active", result.was_active ? "true" : "false")
    res.status(204).end()
  } catch (err) {
    errorResponse(res, err)
  }
}
