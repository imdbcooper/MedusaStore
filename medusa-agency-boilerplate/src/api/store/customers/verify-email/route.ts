import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { updateCustomersWorkflow } from "@medusajs/medusa/core-flows"
import {
  buildEmailVerificationConsumeMetadata,
  parseEmailVerificationToken,
  sanitizeLogValue,
  verifyEmailVerificationToken,
} from "../../../../modules/email-verification"

export const StoreVerifyEmailSchema = z.object({
  token: z.string().trim().min(1).max(512),
})

export type StoreVerifyEmailRequestBody = z.infer<typeof StoreVerifyEmailSchema>

/**
 * Generic error code returned to clients for any token-related failure
 * (missing/invalid/expired/mismatch/unknown customer). The specific internal
 * reason is still logged server-side for diagnostics, but is not exposed to
 * the client to minimise token-state enumeration surface.
 */
const GENERIC_TOKEN_ERROR_CODE = "invalid_or_expired_token"

type VerifyEmailCustomer = {
  id: string
  email: string | null
  metadata?: Record<string, unknown> | null
}

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
  req: MedusaRequest<StoreVerifyEmailRequestBody>,
  res: MedusaResponse
) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const validatedBody = (req.validatedBody || {}) as Partial<StoreVerifyEmailRequestBody>
  const fallbackBody = (req.body as Record<string, unknown> | undefined) || {}
  const token =
    typeof validatedBody.token === "string" && validatedBody.token.length
      ? validatedBody.token
      : typeof fallbackBody.token === "string"
        ? fallbackBody.token
        : ""

  const parsed = parseEmailVerificationToken(token)

  if (!parsed.ok) {
    logger.warn(
      `[email-verification] verify failed reason=${parsed.reason} token_length=${token?.length ?? 0}`
    )
    respondInvalidToken(res)
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: customers } = await query.graph({
    entity: "customer",
    fields: ["id", "email", "metadata"],
    filters: {
      id: parsed.customerId,
    },
  })

  const customer = customers[0] as VerifyEmailCustomer | undefined

  if (!customer) {
    logger.warn(
      `[email-verification] verify failed reason=customer_not_found customer_id=${sanitizeLogValue(parsed.customerId)}`
    )
    respondInvalidToken(res)
    return
  }

  const verification = verifyEmailVerificationToken({
    customer,
    rawToken: parsed.rawToken,
  })

  if (!verification.ok) {
    logger.warn(
      `[email-verification] verify failed reason=${verification.reason} customer_id=${sanitizeLogValue(customer.id)}`
    )
    respondInvalidToken(res)
    return
  }

  if (verification.alreadyVerified) {
    logger.info(
      `[email-verification] verify already_verified customer_id=${sanitizeLogValue(customer.id)} email=${sanitizeLogValue(verification.email)}`
    )
    res.status(200).json({
      ok: true,
      status: "already_verified",
      customer_id: customer.id,
      email: verification.email,
    })
    return
  }

  const nextMetadata = buildEmailVerificationConsumeMetadata({
    currentMetadata: customer.metadata,
    email: verification.email,
  })

  await updateCustomersWorkflow(req.scope).run({
    input: {
      selector: {
        id: [customer.id],
      },
      update: {
        metadata: nextMetadata,
      },
    },
  })

  logger.info(
    `[email-verification] verified customer_id=${sanitizeLogValue(customer.id)} email=${sanitizeLogValue(verification.email)}`
  )

  res.status(200).json({
    ok: true,
    status: "verified",
    customer_id: customer.id,
    email: verification.email,
  })
}
