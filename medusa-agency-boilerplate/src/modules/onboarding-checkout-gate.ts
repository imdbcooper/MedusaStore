import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isPlaceholderEmail } from "./vk-id"

/**
 * Checkout gate middleware: blocks cart completion if the authenticated
 * customer has a placeholder email (VK onboarding not completed).
 *
 * Applied to `/store/carts/:id/complete` and
 * `/store/payment-collections/:id/payment-sessions`.
 *
 * If no authenticated customer is present (guest checkout), the middleware
 * passes through — guest carts use the email from the cart itself.
 */
export async function enforceOnboardingEmailForCheckout(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  // Only check if there's an authenticated customer
  const authContext = (req as any).auth_context
  const customerId = authContext?.actor_id?.trim()

  if (!customerId) {
    // Guest checkout — no customer session, pass through
    return next()
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const { data } = await query.graph({
      entity: "customer",
      fields: ["id", "email"],
      filters: { id: [customerId] },
      pagination: { take: 1, skip: 0 },
    })

    if (!data || !data.length) {
      // Customer not found — let downstream handle it
      return next()
    }

    const customer = data[0] as { id: string; email: string }

    if (isPlaceholderEmail(customer.email)) {
      res.status(400).json({
        type: "invalid_data",
        code: "onboarding_required",
        message: "Для оформления заказа укажите email",
        details: {
          reason: "placeholder_email",
          action: "complete_onboarding",
        },
      })
      return
    }
  } catch (error) {
    // If we can't check, let the request through — don't block checkout
    // on an infrastructure error. Log for operators.
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
    logger.warn(
      `[onboarding-gate] failed to check customer email customer_id=${customerId}`
    )
  }

  return next()
}
