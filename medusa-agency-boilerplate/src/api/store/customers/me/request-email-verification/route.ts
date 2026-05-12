import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import sendEmailVerificationWorkflow from "../../../../../workflows/send-email-verification"

export const StoreRequestEmailVerificationSchema = z.object({
  country_code: z
    .string()
    .trim()
    .min(1)
    .max(8)
    .nullable()
    .optional(),
  reason: z.string().trim().min(1).max(64).optional(),
})

export type StoreRequestEmailVerificationRequestBody = z.infer<
  typeof StoreRequestEmailVerificationSchema
>

type RequestEmailVerificationCustomer = {
  id: string
  email: string | null
}

export async function POST(
  req: AuthenticatedMedusaRequest<StoreRequestEmailVerificationRequestBody>,
  res: MedusaResponse
) {
  const customerId = req.auth_context.actor_id?.trim()

  if (!customerId) {
    res.status(401).json({
      ok: false,
      code: "customer_auth_required",
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

  const customer = customers[0] as RequestEmailVerificationCustomer | undefined

  if (!customer) {
    res.status(404).json({
      ok: false,
      code: "customer_not_found",
    })
    return
  }

  const validatedBody = req.validatedBody || {}
  const countryCode =
    typeof validatedBody.country_code === "string"
      ? validatedBody.country_code
      : null
  const reason =
    typeof validatedBody.reason === "string"
      ? validatedBody.reason
      : "resend"

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
