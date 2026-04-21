import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  createDeliveryHubService,
  getDeliveryHubPgConnection,
  isDeliveryHubError,
} from "../../../modules/delivery-hub"
import { redactRecord } from "../../../modules/delivery-hub/security/redaction"

export function getDeliveryHubService(req: AuthenticatedMedusaRequest) {
  const pg = getDeliveryHubPgConnection(req.scope)
  return createDeliveryHubService(pg)
}

export function getRouteParam(req: AuthenticatedMedusaRequest, key: string) {
  const fromParams = (req as { params?: Record<string, string | undefined> }).params?.[key]

  if (fromParams?.trim()) {
    return fromParams.trim()
  }

  const path = req.url?.split("?")[0] || ""
  const segments = path.split("/").filter(Boolean)
  const connectionsIndex = segments.findIndex((segment) => segment === "connections")

  if (connectionsIndex >= 0 && key === "id") {
    return segments[connectionsIndex + 1] || ""
  }

  return ""
}

export function handleDeliveryHubError(res: MedusaResponse, error: unknown) {
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

function sanitizeErrorDetails(details: Record<string, unknown> | undefined) {
  if (!details) {
    return null
  }

  return redactRecord(details)
}
