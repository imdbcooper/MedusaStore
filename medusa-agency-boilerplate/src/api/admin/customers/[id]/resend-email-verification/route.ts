import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import sendEmailVerificationWorkflow from "../../../../../workflows/send-email-verification"

type AdminResendEmailCustomer = {
  id: string
  email: string | null
}

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
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

  const customer = customers[0] as AdminResendEmailCustomer | undefined

  if (!customer) {
    res.status(404).json({
      ok: false,
      code: "customer_not_found",
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

  const { result } = await sendEmailVerificationWorkflow(req.scope).run({
    input: {
      customerId: customer.id,
      countryCode,
      reason,
    },
  })

  const outcome = result.result

  if (outcome.status === "skipped") {
    res.status(422).json({
      ok: false,
      code: outcome.reason || "email_verification_skipped",
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
}
