import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  createDeliveryHubService,
  DELIVERY_HUB_QUOTE_REFERENCE_ID_PATTERN,
  DELIVERY_HUB_SUPPORTED_PUBLIC_PROVIDER_CODES,
  DeliveryHubError,
  getDeliveryHubPgConnection,
  isDeliveryHubError,
} from "../../../modules/delivery-hub"
import { redactRecord } from "../../../modules/delivery-hub/security/redaction"

const StoreDeliveryCatalogConnectionSchema = z
  .object({
    connection_id: z.string(),
    label: z.string(),
    state: z.string(),
    ready: z.boolean(),
    quote_types: z.array(z.string()),
    supports_pickup_points: z.boolean(),
    supports_pickup_windows: z.boolean(),
    supports_dropoff: z.boolean(),
  })
  .strict()

const StoreDeliveryCatalogResponseSchema = z
  .object({
    ok: z.literal(true),
    default_connection_id: z.string().nullable(),
    connections: z.array(StoreDeliveryCatalogConnectionSchema),
  })
  .strict()

const StoreDeliverySettingsResponseSchema = z
  .object({
    ok: z.literal(true),
    settings: z
      .object({
        enabled: z.boolean(),
        status: z.enum(["unavailable", "informational_only", "available"]),
        summary: z
          .object({
            enabled_connection_count: z.number().int().nonnegative(),
            ready_connection_count: z.number().int().nonnegative(),
            default_connection_label: z.string().nullable(),
            modality_codes: z.array(z.string()),
            supports_pickup_points: z.boolean(),
            supports_pickup_windows: z.boolean(),
            supports_dropoff: z.boolean(),
          })
          .strict(),
        preview_visibility: z
          .object({
            shadow_settings: z.boolean(),
            readiness: z.boolean(),
            persisted_selection: z.boolean(),
            shadow_catalog: z.boolean(),
            shadow_pickup_points: z.boolean(),
            shadow_quotes: z.boolean(),
            shadow_pickup_windows: z.boolean(),
          })
          .strict(),
        hints: z.array(z.string()),
      })
      .strict(),
  })
  .strict()

const StoreDeliveryQuoteReferenceSchema = z
  .object({
    id: z.string().regex(
      DELIVERY_HUB_QUOTE_REFERENCE_ID_PATTERN,
      "quote_reference.id must be an opaque Delivery Hub quote reference"
    ),
    version: z.number().int().positive(),
  })
  .strict()

const StoreDeliveryQuoteSchema = z
  .object({
    carrier_code: z.string(),
    carrier_label: z.string(),
    mode_code: z.string(),
    quote_reference: StoreDeliveryQuoteReferenceSchema,
    amount: z.number(),
    currency_code: z.string(),
    delivery_eta_min: z.number().int().nullable(),
    delivery_eta_max: z.number().int().nullable(),
    pickup_point_required: z.boolean(),
    pickup_point_ids: z.array(z.string()),
    pickup_window_required: z.boolean(),
  })
  .strict()

const StoreDeliverySmokeDiagnosticsSchema = z
  .object({
    correlation_id: z.string().nullable(),
    checkout_source_of_truth: z.literal("unchanged"),
    contour: z.literal("delivery_hub_storefront_preview"),
  })
  .strict()

const StoreDeliveryQuotesResponseSchema = z
  .object({
    ok: z.literal(true),
    quotes: z.array(StoreDeliveryQuoteSchema),
    diagnostics: StoreDeliverySmokeDiagnosticsSchema.optional(),
  })
  .strict()

const StoreDeliveryPickupPointSchema = z
  .object({
    provider_point_id: z.string(),
    provider_point_code: z.string().nullable(),
    provider_operator_id: z.string().nullable(),
    network_label: z.string().nullable(),
    is_yandex_branded: z.boolean().nullable(),
    is_market_partner: z.boolean().nullable(),
    station_type: z.string().nullable(),
    name: z.string(),
    address: z.string(),
    city: z.string().nullable(),
    region: z.string().nullable(),
    postal_code: z.string().nullable(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    is_origin_dropoff_allowed: z.boolean(),
    is_destination_pickup_allowed: z.boolean(),
    payment_methods: z.array(z.string()),
    metadata: z.record(z.unknown()).default({}),
  })
  .strict()

const StoreDeliveryPickupPointsResponseSchema = z
  .object({
    ok: z.literal(true),
    points: z.array(StoreDeliveryPickupPointSchema),
  })
  .strict()

const StoreDeliveryPickupWindowSchema = z
  .object({
    date: z.string(),
    time_from: z.string().nullable(),
    time_to: z.string().nullable(),
    interval_utc: z
      .object({
        from: z.string(),
        to: z.string(),
      })
      .strict(),
    label: z.string(),
    metadata: z.record(z.unknown()).default({}),
  })
  .strict()

const StoreDeliveryPickupWindowsResponseSchema = z
  .object({
    ok: z.literal(true),
    pickup_windows: z.array(StoreDeliveryPickupWindowSchema),
  })
  .strict()

const StoreDeliveryReadinessIssueSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    field: z.string().nullable(),
  })
  .strict()

const StoreDeliverySelectionQuoteSchema = z
  .object({
    carrier_code: z.string(),
    carrier_label: z.string(),
    amount: z.number(),
    currency_code: z.string(),
    delivery_eta_min: z.number().int().nullable(),
    delivery_eta_max: z.number().int().nullable(),
    pickup_point_required: z.boolean(),
    pickup_window_required: z.boolean(),
  })
  .strict()

const StoreDeliverySelectionPickupPointSchema = z
  .object({
    provider_point_id: z.string(),
    provider_point_code: z.string().nullable(),
    provider_operator_id: z.string().nullable().optional(),
    network_label: z.string().nullable().optional(),
    is_yandex_branded: z.boolean().nullable().optional(),
    is_market_partner: z.boolean().nullable().optional(),
    station_type: z.string().nullable().optional(),
    name: z.string(),
    address: z.string(),
    city: z.string().nullable(),
    region: z.string().nullable(),
    postal_code: z.string().nullable(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    is_origin_dropoff_allowed: z.boolean(),
    is_destination_pickup_allowed: z.boolean(),
    payment_methods: z.array(z.string()),
  })
  .strict()

const StoreDeliverySelectionPickupWindowSchema = z
  .object({
    date: z.string(),
    time_from: z.string().nullable(),
    time_to: z.string().nullable(),
    interval_utc: z
      .object({
        from: z.string(),
        to: z.string(),
      })
      .strict(),
    label: z.string(),
  })
  .strict()

const StoreDeliveryProviderCodeSchema = z.enum(DELIVERY_HUB_SUPPORTED_PUBLIC_PROVIDER_CODES)

const StoreDeliverySelectionSchema = z
  .object({
    version: z.number().int().positive(),
    provider_code: StoreDeliveryProviderCodeSchema,
    connection_id: z.string(),
    quote_type: z.string(),
    quote_reference: StoreDeliveryQuoteReferenceSchema,
    quote: StoreDeliverySelectionQuoteSchema,
    pickup_point: StoreDeliverySelectionPickupPointSchema,
    pickup_window: StoreDeliverySelectionPickupWindowSchema.nullable(),
    correlation_id: z.string().nullable(),
    updated_at: z.string(),
  })
  .strict()

const StoreDeliverySelectionResponseSchema = z
  .object({
    ok: z.literal(true),
    cart_id: z.string(),
    selection: StoreDeliverySelectionSchema.nullable(),
    diagnostics: StoreDeliverySmokeDiagnosticsSchema.optional(),
  })
  .strict()

const StoreDeliveryReadinessConnectionSchema = z
  .object({
    connection_id: z.string().nullable(),
    state: z.string(),
    ready: z.boolean(),
  })
  .strict()

const StoreDeliveryReadinessResponseSchema = z
  .object({
    ok: z.literal(true),
    cart_id: z.string(),
    status: z.enum(["missing_selection", "invalid_selection", "not_ready", "ready"]),
    issues: z.array(StoreDeliveryReadinessIssueSchema),
    selection: StoreDeliverySelectionSchema.nullable(),
    quote_context: z
      .object({
        connection: StoreDeliveryReadinessConnectionSchema,
        quote_type: z.string(),
        quote_reference: StoreDeliveryQuoteReferenceSchema,
        pickup_point_required: z.boolean(),
        pickup_window_required: z.boolean(),
        updated_at: z.string(),
      })
      .strict()
      .nullable(),
  })
  .strict()

export function getStoreDeliveryHubService(req: MedusaRequest) {
  const pg = getDeliveryHubPgConnection(req.scope)
  return createDeliveryHubService(pg)
}

export function getStoreQuery(req: MedusaRequest) {
  return req.scope.resolve(ContainerRegistrationKeys.QUERY)
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

export function sanitizeStoreDeliveryCatalogResponse(result: unknown) {
  return StoreDeliveryCatalogResponseSchema.parse(result)
}

export function sanitizeStoreDeliverySettingsResponse(result: unknown) {
  return StoreDeliverySettingsResponseSchema.parse(result)
}

export function sanitizeStoreDeliveryQuotesResponse(result: unknown) {
  return StoreDeliveryQuotesResponseSchema.parse(result)
}

export function sanitizeStoreDeliveryPickupPointsResponse(result: unknown) {
  return StoreDeliveryPickupPointsResponseSchema.parse(result)
}

export function sanitizeStoreDeliveryPickupWindowsResponse(result: unknown) {
  return StoreDeliveryPickupWindowsResponseSchema.parse(result)
}

export function sanitizeStoreDeliveryReadinessResponse(result: unknown) {
  return StoreDeliveryReadinessResponseSchema.parse(result)
}

export function sanitizeStoreDeliverySelectionResponse(result: unknown) {
  return StoreDeliverySelectionResponseSchema.parse(result)
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

export function createStoreDeliveryValidationError(message: string, field: string) {
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
