import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  createLlmProvider,
  ensureAssistantSettingsTables,
  getAssistantSettingsPgConnection,
  listLlmProviders,
} from "../../../../../modules/assistant-settings"
import { errorResponse, toPublicProvider } from "../_helpers"
import type { LlmProviderCreateBody } from "../_schemas"

/**
 * `/admin/assistant/settings/providers`
 *
 * - `GET`  — list every LLM provider; optional `?enabled_only=true` filter.
 * - `POST` — create a new provider (body validated by
 *   [`LlmProviderCreateSchema`](medusa-agency-boilerplate/src/api/admin/assistant/settings/_schemas.ts:1)
 *   in `middlewares.ts`).
 *
 * Auth: standard admin auth via the central middleware registry. Errors are
 * funnelled through {@link errorResponse} to keep the wire shape uniform
 * across the eight routes in this folder.
 */

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  try {
    const pg = getAssistantSettingsPgConnection(req.scope)
    await ensureAssistantSettingsTables(pg)
    const enabledOnly =
      String(req.query?.enabled_only ?? "").toLowerCase() === "true"
    const providers = await listLlmProviders(pg, { enabled_only: enabledOnly })
    res.status(200).json({
      providers: providers.map(toPublicProvider),
    })
  } catch (err) {
    errorResponse(res, err)
  }
}

export async function POST(
  req: AuthenticatedMedusaRequest<LlmProviderCreateBody>,
  res: MedusaResponse
) {
  try {
    const input = req.validatedBody as LlmProviderCreateBody
    const pg = getAssistantSettingsPgConnection(req.scope)
    await ensureAssistantSettingsTables(pg)
    const provider = await createLlmProvider(pg, input)
    res.status(201).json({
      provider: toPublicProvider(provider),
    })
  } catch (err) {
    errorResponse(res, err)
  }
}
