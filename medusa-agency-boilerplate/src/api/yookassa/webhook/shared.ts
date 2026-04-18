import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import { processPaymentWorkflowId } from "@medusajs/medusa/core-flows"
import {
  YOOKASSA_PROVIDER_KEY,
  type YooKassaPaymentSessionData,
} from "../../../modules/yookassa"

const UNSIGNED_WEBHOOK_OVERRIDE_ENV = "YOOKASSA_ALLOW_UNSIGNED_WEBHOOKS"

export async function handleYooKassaWebhook(
  req: MedusaRequest,
  res: MedusaResponse
) {
  try {
    verifyYooKassaWebhook(req)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid YooKassa webhook request."

    console.warn("[YooKassa webhook] Request rejected", {
      reason: message,
      has_secret_header: Boolean(
        getString(req.headers["x-yookassa-webhook-secret"]) ||
          getString(req.headers["x-yookassa-secret"]) ||
          getString(req.headers["authorization"])
      ),
    })

    return res.status(401).json({
      ok: false,
      code: "invalid_webhook_secret",
    })
  }

  const body = getBody(req.body)
  const paymentObject = getBody(body.object)
  const paymentId = getString(paymentObject.id)

  if (!paymentId) {
    return res.status(400).json({ ok: false, code: "missing_payment_id" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: sessions } = await query.graph({
    entity: "payment_session",
    fields: ["id", "provider_id", "data"],
    filters: {
      provider_id: YOOKASSA_PROVIDER_KEY,
    },
  })

  const session = (sessions as unknown as {
    id: string
    provider_id: string
    data?: YooKassaPaymentSessionData
  }[]).find((candidate) => candidate.data?.id === paymentId)

  if (!session) {
    return res.status(202).json({
      ok: true,
      ignored: true,
      reason: "session_not_found",
    })
  }

  const workflowEngine = req.scope.resolve(Modules.WORKFLOW_ENGINE) as {
    run: (
      workflowId: string,
      payload: { input: Record<string, unknown> }
    ) => Promise<unknown>
  }

  await workflowEngine.run(processPaymentWorkflowId, {
    input: {
      action: mapYooKassaWebhookAction(getString(paymentObject.status)),
      data: {
        session_id: session.id,
        amount: Number(getBody(paymentObject.amount).value ?? 0),
      },
    },
  })

  return res.status(200).json({ ok: true })
}

function verifyYooKassaWebhook(req: MedusaRequest) {
  const expectedSecret = process.env.YOOKASSA_WEBHOOK_SECRET?.trim()
  const headerSecret =
    getString(req.headers["x-yookassa-webhook-secret"]) ||
    getString(req.headers["x-yookassa-secret"]) ||
    normalizeAuthorizationSecret(getString(req.headers["authorization"]))

  if (expectedSecret) {
    if (headerSecret !== expectedSecret) {
      throw new MedusaError(
        MedusaError.Types.UNAUTHORIZED,
        "Invalid YooKassa webhook secret."
      )
    }

    return
  }

  if (isUnsignedWebhookOverrideEnabled()) {
    console.warn(
      `[YooKassa webhook] Accepting unsigned webhook because ${UNSIGNED_WEBHOOK_OVERRIDE_ENV}=true in a controlled development/test runtime. Do not use this override in public environments.`
    )
    return
  }

  throw new MedusaError(
    MedusaError.Types.UNAUTHORIZED,
    `YOOKASSA_WEBHOOK_SECRET is not configured. Unsigned YooKassa webhooks are rejected unless ${UNSIGNED_WEBHOOK_OVERRIDE_ENV}=true in development/test.`
  )
}

function isUnsignedWebhookOverrideEnabled() {
  if (!isTruthy(process.env[UNSIGNED_WEBHOOK_OVERRIDE_ENV])) {
    return false
  }

  const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase()

  return !nodeEnv || nodeEnv === "development" || nodeEnv === "test"
}

function isTruthy(value?: string) {
  if (!value) {
    return false
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase())
}

function normalizeAuthorizationSecret(value: string) {
  if (!value) {
    return ""
  }

  return value.toLowerCase().startsWith("bearer ")
    ? value.slice(7).trim()
    : value
}

function mapYooKassaWebhookAction(status: string) {
  switch (status) {
    case "waiting_for_capture":
      return "authorized"
    case "succeeded":
      return "successful"
    case "canceled":
      return "canceled"
    case "waiting_for_confirmation":
      return "requires_more"
    case "pending":
    default:
      return "pending"
  }
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function getBody(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}
