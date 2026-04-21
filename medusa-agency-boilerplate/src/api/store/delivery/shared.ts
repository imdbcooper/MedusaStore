import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  createDeliveryHubService,
  getDeliveryHubPgConnection,
  isDeliveryHubError,
} from "../../../modules/delivery-hub"
import { redactRecord } from "../../../modules/delivery-hub/security/redaction"

export function getStoreDeliveryHubService(req: MedusaRequest) {
  const pg = getDeliveryHubPgConnection(req.scope)
  return createDeliveryHubService(pg)
}

export function handleStoreDeliveryHubError(res: MedusaResponse, error: unknown) {
  if (isDeliveryHubError(error)) {
    res.status(error.status).json({
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        details: sanitizeErrorDetails(error.details),
      },
    })
    return
  }

  res.status(500).json({
    ok: false,
    error: {
      code: "DELIVERY_HUB_UNEXPECTED_ERROR",
      message: error instanceof Error ? error.message : "Unexpected Delivery Hub error",
      details: null,
    },
  })
}

export function parseStoreDeliveryItems(rawItems: string | undefined) {
  if (!rawItems?.trim()) {
    return undefined
  }

  const parsed = JSON.parse(rawItems)

  if (!Array.isArray(parsed)) {
    throw new Error('Query parameter "items" must be a JSON array')
  }

  return parsed
}

export function parseStoreDeliveryInterval(rawInterval: string | undefined) {
  if (!rawInterval?.trim()) {
    return undefined
  }

  const parsed = JSON.parse(rawInterval)

  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as { from?: unknown }).from !== "string" ||
    typeof (parsed as { to?: unknown }).to !== "string"
  ) {
    throw new Error('Query parameter "interval_utc" must be a JSON object with "from" and "to"')
  }

  return parsed as {
    from: string
    to: string
  }
}

function sanitizeErrorDetails(details: Record<string, unknown> | undefined) {
  if (!details) {
    return null
  }

  return redactRecord(details)
}
