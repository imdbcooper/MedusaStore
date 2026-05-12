import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import sendPasswordResetWorkflow from "../../../../../workflows/send-password-reset"
import { sanitizeLogValue } from "../../../../../modules/password-reset"

type AdminPasswordResetCustomer = {
  id: string
  email: string | null
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const customerId = (req.params.id || "").trim()

  if (!customerId) {
    res.status(400).json({
      ok: false,
      code: "customer_id_required",
    })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "email"],
    filters: {
      id: customerId,
    },
  })

  const customer = customers[0] as AdminPasswordResetCustomer | undefined

  if (!customer) {
    res.status(404).json({
      ok: false,
      code: "customer_not_found",
    })
    return
  }

  if (!customer.email) {
    res.status(422).json({
      ok: false,
      code: "missing_customer_email",
      customer_id: customer.id,
    })
    return
  }

  const body = (req.body as Record<string, unknown> | undefined) || {}
  const countryCode =
    typeof body.country_code === "string" ? body.country_code : null
  const reason =
    typeof body.reason === "string" && body.reason.trim()
      ? body.reason
      : "admin_resend"

  try {
    const { result } = await sendPasswordResetWorkflow(req.scope).run({
      input: {
        email: customer.email,
        countryCode,
        reason,
      },
    })

    const outcome = result.result

    if (outcome.status === "skipped") {
      logger.warn(
        `[password-reset] admin send failed reason=${outcome.reason} customer_id=${sanitizeLogValue(customer.id)}`
      )
      res.status(422).json({
        ok: false,
        code: outcome.reason || "password_reset_skipped",
        customer_id: customer.id,
      })
      return
    }

    res.status(200).json({
      ok: true,
      customer_id: customer.id,
      status: outcome.status,
      recipient: outcome.recipient,
      expires_at: outcome.expires_at,
      token_ttl_minutes: outcome.token_ttl_minutes,
      provider: {
        requested: outcome.provider_requested,
        resolved: outcome.provider_resolved,
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown_workflow_error"
    logger.error(
      `[password-reset] admin send workflow error customer_id=${sanitizeLogValue(customer.id)} message=${sanitizeLogValue(message)}`
    )

    res.status(500).json({
      ok: false,
      code: "password_reset_send_failed",
      customer_id: customer.id,
    })
  }
}
