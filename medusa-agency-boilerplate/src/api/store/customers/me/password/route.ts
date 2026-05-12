import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import updateCustomerPasswordWorkflow from "../../../../../workflows/update-customer-password"
import { sanitizeLogValue } from "../../../../../modules/password-reset"

export const StoreUpdateCustomerPasswordSchema = z.object({
  current_password: z.string().min(1).max(128),
  new_password: z.string().min(1).max(128),
})

export type StoreUpdateCustomerPasswordRequestBody = z.infer<
  typeof StoreUpdateCustomerPasswordSchema
>

const STRENGTH_REASONS = new Set([
  "password_too_short",
  "password_too_long",
  "password_missing_letter",
  "password_missing_digit",
])

export async function POST(
  req: AuthenticatedMedusaRequest<StoreUpdateCustomerPasswordRequestBody>,
  res: MedusaResponse
) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const customerId = req.auth_context.actor_id?.trim()

  if (!customerId) {
    res.status(401).json({
      ok: false,
      code: "customer_auth_required",
    })
    return
  }

  const validatedBody = (req.validatedBody || {}) as Partial<StoreUpdateCustomerPasswordRequestBody>
  const currentPassword =
    typeof validatedBody.current_password === "string"
      ? validatedBody.current_password
      : ""
  const newPassword =
    typeof validatedBody.new_password === "string"
      ? validatedBody.new_password
      : ""

  try {
    const { result } = await updateCustomerPasswordWorkflow(req.scope).run({
      input: {
        customerId,
        currentPassword,
        newPassword,
      },
    })

    const outcome = result.result

    if (outcome.status === "updated") {
      res.status(200).json({
        ok: true,
        customer_id: outcome.customer_id,
      })
      return
    }

    if (outcome.reason === "invalid_current_password") {
      res.status(400).json({
        ok: false,
        code: "invalid_current_password",
      })
      return
    }

    if (STRENGTH_REASONS.has(outcome.reason)) {
      res.status(400).json({
        ok: false,
        code: "weak_password",
        detail: outcome.reason,
      })
      return
    }

    if (outcome.reason === "same_password") {
      res.status(400).json({
        ok: false,
        code: "same_password",
      })
      return
    }

    if (outcome.reason === "customer_not_found") {
      res.status(404).json({
        ok: false,
        code: "customer_not_found",
      })
      return
    }

    logger.warn(
      `[password-update] route generic failure reason=${outcome.reason} customer_id=${sanitizeLogValue(customerId)}`
    )
    res.status(400).json({
      ok: false,
      code: "password_update_failed",
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown_workflow_error"
    logger.error(
      `[password-update] workflow error customer_id=${sanitizeLogValue(customerId)} message=${sanitizeLogValue(message)}`
    )

    res.status(400).json({
      ok: false,
      code: "password_update_failed",
    })
  }
}
