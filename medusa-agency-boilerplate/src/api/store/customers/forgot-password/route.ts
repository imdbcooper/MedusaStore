import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import sendPasswordResetWorkflow from "../../../../workflows/send-password-reset"
import { sanitizeLogValue } from "../../../../modules/password-reset"

export const StoreForgotPasswordSchema = z.object({
  email: z.string().trim().min(3).max(254).email(),
  country_code: z.string().trim().min(1).max(8).nullable().optional(),
  reason: z.string().trim().min(1).max(64).optional(),
})

export type StoreForgotPasswordRequestBody = z.infer<
  typeof StoreForgotPasswordSchema
>

/**
 * Forgot password endpoint.
 *
 * Always returns 200 with `{ ok: true }` to avoid exposing whether an email
 * is registered. The workflow itself decides whether to send an email; any
 * skip is logged server-side but not surfaced to the client.
 */
export async function POST(
  req: MedusaRequest<StoreForgotPasswordRequestBody>,
  res: MedusaResponse
) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const validatedBody = (req.validatedBody || {}) as Partial<StoreForgotPasswordRequestBody>
  const fallbackBody = (req.body as Record<string, unknown> | undefined) || {}
  const email =
    typeof validatedBody.email === "string"
      ? validatedBody.email
      : typeof fallbackBody.email === "string"
        ? fallbackBody.email
        : ""
  const countryCode =
    typeof validatedBody.country_code === "string"
      ? validatedBody.country_code
      : typeof fallbackBody.country_code === "string"
        ? fallbackBody.country_code
        : null
  const reason =
    typeof validatedBody.reason === "string"
      ? validatedBody.reason
      : typeof fallbackBody.reason === "string"
        ? (fallbackBody.reason as string)
        : "forgot_password"

  try {
    const { result } = await sendPasswordResetWorkflow(req.scope).run({
      input: {
        email,
        countryCode,
        reason,
      },
    })

    const outcome = result.result

    logger.info(
      `[password-reset] forgot-password request outcome=${outcome.status} reason=${outcome.reason ?? "none"} country_code=${sanitizeLogValue(outcome.country_code)}`
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown_workflow_error"
    logger.error(
      `[password-reset] forgot-password workflow error message=${sanitizeLogValue(message)}`
    )
  }

  // Always success response regardless of skip reason to prevent user enumeration.
  res.status(200).json({ ok: true })
}
