import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import applyMarketingConfirmationWorkflow from "../../../../../workflows/apply-marketing-confirmation"
import { sanitizeMarketingLogValue } from "../../../../../modules/marketing-preferences"

export const StoreMarketingConfirmSchema = z.object({
  token: z.string().trim().min(1).max(512),
})

export type StoreMarketingConfirmRequestBody = z.infer<
  typeof StoreMarketingConfirmSchema
>

/**
 * Generic error code returned to clients for any token-related failure
 * (missing/invalid/expired/mismatch/unknown customer). The specific internal
 * reason is still logged server-side for diagnostics, but is not exposed to
 * the client to minimise token-state enumeration surface.
 */
const GENERIC_TOKEN_ERROR_CODE = "invalid_or_expired_token"

function respondInvalidToken(
  res: MedusaResponse,
  statusCode: number = 400
): void {
  res.status(statusCode).json({
    ok: false,
    code: GENERIC_TOKEN_ERROR_CODE,
  })
}

export async function POST(
  req: MedusaRequest<StoreMarketingConfirmRequestBody>,
  res: MedusaResponse
) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const validatedBody = (req.validatedBody || {}) as Partial<StoreMarketingConfirmRequestBody>
  const fallbackBody = (req.body as Record<string, unknown> | undefined) || {}
  const token =
    typeof validatedBody.token === "string" && validatedBody.token.length
      ? validatedBody.token
      : typeof fallbackBody.token === "string"
        ? fallbackBody.token
        : ""

  try {
    const { result } = await applyMarketingConfirmationWorkflow(req.scope).run({
      input: {
        token,
      },
    })

    const outcome = result.result

    if (outcome.status === "confirmed") {
      res.status(200).json({
        ok: true,
        customer_id: outcome.customer_id,
        channel: outcome.channel,
      })
      return
    }

    logger.info(
      `[marketing-confirmation] confirm failed reason=${outcome.reason} customer_id=${sanitizeMarketingLogValue(outcome.customer_id)} channel=${sanitizeMarketingLogValue(outcome.channel)}`
    )

    respondInvalidToken(res)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown_workflow_error"

    logger.error(
      `[marketing-confirmation] confirm workflow error message=${sanitizeMarketingLogValue(message)}`
    )

    respondInvalidToken(res)
  }
}
