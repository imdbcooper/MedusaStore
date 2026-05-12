import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import applyPasswordResetWorkflow from "../../../../workflows/apply-password-reset"
import { sanitizeLogValue } from "../../../../modules/password-reset"

export const StoreResetPasswordSchema = z.object({
  token: z.string().trim().min(1).max(512),
  // Defense-in-depth: floor length at 8. Actual strength policy
  // (letters/digits mix, etc.) is enforced in the workflow.
  new_password: z.string().min(8).max(128),
})

export type StoreResetPasswordRequestBody = z.infer<
  typeof StoreResetPasswordSchema
>

/**
 * Generic error code returned to clients for any token-related or password
 * strength failure. The specific internal reason is logged server-side.
 */
const GENERIC_TOKEN_ERROR_CODE = "invalid_or_expired_token"
const PASSWORD_WEAK_ERROR_CODE = "weak_password"

const STRENGTH_REASONS = new Set([
  "password_too_short",
  "password_too_long",
  "password_missing_letter",
  "password_missing_digit",
])

export async function POST(
  req: MedusaRequest<StoreResetPasswordRequestBody>,
  res: MedusaResponse
) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const validatedBody = (req.validatedBody || {}) as Partial<StoreResetPasswordRequestBody>
  const fallbackBody = (req.body as Record<string, unknown> | undefined) || {}
  const token =
    typeof validatedBody.token === "string" && validatedBody.token.length
      ? validatedBody.token
      : typeof fallbackBody.token === "string"
        ? fallbackBody.token
        : ""
  const newPassword =
    typeof validatedBody.new_password === "string"
      ? validatedBody.new_password
      : typeof fallbackBody.new_password === "string"
        ? (fallbackBody.new_password as string)
        : ""

  try {
    const { result } = await applyPasswordResetWorkflow(req.scope).run({
      input: {
        token,
        newPassword,
      },
    })

    const outcome = result.result

    if (outcome.status === "applied") {
      res.status(200).json({
        ok: true,
        customer_id: outcome.customer_id,
      })
      return
    }

    if (STRENGTH_REASONS.has(outcome.reason)) {
      logger.info(
        `[password-reset] reset-password weak_password reason=${outcome.reason} customer_id=${sanitizeLogValue(outcome.customer_id)}`
      )
      res.status(400).json({
        ok: false,
        code: PASSWORD_WEAK_ERROR_CODE,
        detail: outcome.reason,
      })
      return
    }

    logger.info(
      `[password-reset] reset-password failed reason=${outcome.reason} customer_id=${sanitizeLogValue(outcome.customer_id)}`
    )

    res.status(400).json({
      ok: false,
      code: GENERIC_TOKEN_ERROR_CODE,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown_workflow_error"
    logger.error(
      `[password-reset] reset-password workflow error message=${sanitizeLogValue(message)}`
    )

    res.status(400).json({
      ok: false,
      code: GENERIC_TOKEN_ERROR_CODE,
    })
  }
}
