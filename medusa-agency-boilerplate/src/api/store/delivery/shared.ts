import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import {
  createDeliveryHubService,
  DeliveryHubError,
  getDeliveryHubPgConnection,
  isDeliveryHubError,
} from "../../../modules/delivery-hub"
import { redactRecord } from "../../../modules/delivery-hub/security/redaction"

export function getStoreDeliveryHubService(req: MedusaRequest) {
  const pg = getDeliveryHubPgConnection(req.scope)
  return createDeliveryHubService(pg)
}

export function handleStoreDeliveryHubError(res: MedusaResponse, error: unknown) {
  if (error instanceof z.ZodError) {
    respondWithStoreDeliveryHubError(
      res,
      new DeliveryHubError({
        code: "DELIVERY_HUB_VALIDATION_ERROR",
        message: "Store delivery request validation failed",
        status: 400,
        details: {
          issues: error.issues.map((issue) => ({
            code: issue.code,
            message: issue.message,
            path: issue.path.join("."),
          })),
        },
      })
    )
    return
  }

  if (isDeliveryHubError(error)) {
    respondWithStoreDeliveryHubError(res, error)
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

  const parsed = parseStoreDeliveryJsonQuery(rawItems, "items")

  if (!Array.isArray(parsed)) {
    throw createStoreDeliveryValidationError(
      'Query parameter "items" must be a JSON array',
      "items"
    )
  }

  return parsed
}

export function parseStoreDeliveryInterval(rawInterval: string | undefined) {
  if (!rawInterval?.trim()) {
    return undefined
  }

  const parsed = parseStoreDeliveryJsonQuery(rawInterval, "interval_utc")

  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as { from?: unknown }).from !== "string" ||
    typeof (parsed as { to?: unknown }).to !== "string"
  ) {
    throw createStoreDeliveryValidationError(
      'Query parameter "interval_utc" must be a JSON object with "from" and "to"',
      "interval_utc"
    )
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

function parseStoreDeliveryJsonQuery(rawValue: string, field: string) {
  try {
    return JSON.parse(rawValue)
  } catch {
    throw createStoreDeliveryValidationError(
      `Query parameter "${field}" must be valid JSON`,
      field
    )
  }
}

function createStoreDeliveryValidationError(message: string, field: string) {
  return new DeliveryHubError({
    code: "DELIVERY_HUB_VALIDATION_ERROR",
    message,
    status: 400,
    details: {
      field,
    },
  })
}

function respondWithStoreDeliveryHubError(res: MedusaResponse, error: DeliveryHubError) {
  res.status(error.status).json({
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      details: sanitizeErrorDetails(error.details),
    },
  })
}
