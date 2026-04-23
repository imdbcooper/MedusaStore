import crypto from "node:crypto"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateCartWorkflow } from "@medusajs/medusa/core-flows"
import {
  DELIVERY_HUB_MODE_CODE,
  DELIVERY_HUB_PROVIDER_YANDEX,
  DELIVERY_HUB_QUOTE_REFERENCE_ID_PATTERN,
  DELIVERY_HUB_SUPPORTED_PUBLIC_PROVIDER_CODES,
} from "./constants"
import type { DeliveryPickupPoint } from "./domain/pickup-point"
import type { DeliveryPickupWindow } from "./domain/pickup-window"
import { DeliveryHubError } from "./errors"

export const DELIVERY_HUB_CART_METADATA_NAMESPACE = "delivery_hub"
export const DELIVERY_HUB_CART_SELECTION_VERSION = 1

export type DeliveryHubCartSelectionQuoteType =
  (typeof DELIVERY_HUB_MODE_CODE)[keyof typeof DELIVERY_HUB_MODE_CODE]

export type DeliveryHubCartSelectionQuoteSummary = {
  carrier_code: string
  carrier_label: string
  amount: number
  currency_code: string
  delivery_eta_min: number | null
  delivery_eta_max: number | null
  pickup_point_required: boolean
  pickup_window_required: boolean
}

export type DeliveryHubCartSelectionPickupPoint = Omit<DeliveryPickupPoint, "metadata">

export type DeliveryHubCartSelectionPickupWindow = Omit<DeliveryPickupWindow, "metadata">

export type DeliveryHubQuoteReference = {
  id: string
  version: number
}

export type DeliveryHubCartSelectionPublic = {
  version: number
  provider_code: string
  connection_id: string
  quote_type: DeliveryHubCartSelectionQuoteType
  quote_reference: DeliveryHubQuoteReference
  quote: DeliveryHubCartSelectionQuoteSummary
  pickup_point: DeliveryHubCartSelectionPickupPoint
  pickup_window: DeliveryHubCartSelectionPickupWindow | null
  correlation_id: string | null
  updated_at: string
}

export type DeliveryHubCartSelectionWriteInput = {
  provider_code?: string | null
  connection_id: string
  quote_type: DeliveryHubCartSelectionQuoteType
  quote: DeliveryHubCartSelectionQuoteSummary
  pickup_point: DeliveryHubCartSelectionPickupPoint
  pickup_window?: DeliveryHubCartSelectionPickupWindow | null
  correlation_id?: string | null
} & ({
  quote_reference: DeliveryHubQuoteReference
} | {
  quote_key: string
})

type QueryGraphInput = {
  entity: string
  fields: string[]
  filters?: Record<string, unknown>
}

type QueryGraphResult<T> = {
  data: T[]
}

export type DeliveryHubQueryGraphLike = {
  graph: <T>(input: QueryGraphInput) => Promise<QueryGraphResult<T>>
}

export type DeliveryHubCartSelectionRecord = {
  id: string
  metadata?: unknown
}

type DeliveryHubCartSelectionPersisted = DeliveryHubCartSelectionPublic

export async function getDeliveryHubCartById(
  query: DeliveryHubQueryGraphLike,
  cartId: string
): Promise<DeliveryHubCartSelectionRecord | null> {
  const normalizedCartId = requireNonEmptyString(cartId, "cart_id")
  const { data } = await query.graph<DeliveryHubCartSelectionRecord>({
    entity: "cart",
    fields: ["id", "metadata"],
    filters: {
      id: normalizedCartId,
    },
  })

  return data?.[0] ?? null
}

export function requireDeliveryHubCart(
  cart: DeliveryHubCartSelectionRecord | null,
  cartId: string
): DeliveryHubCartSelectionRecord {
  if (cart) {
    return cart
  }

  throw new DeliveryHubError({
    code: "DELIVERY_HUB_NOT_FOUND",
    message: `Cart "${cartId}" was not found`,
    status: 404,
    details: {
      field: "cart_id",
    },
  })
}

export function readDeliveryHubCartSelection(
  metadata?: unknown
): DeliveryHubCartSelectionPublic | null {
  return readPersistedDeliveryHubCartSelection(metadata)
}

export function buildDeliveryHubCartSelectionMetadata(
  metadata: unknown,
  input: DeliveryHubCartSelectionWriteInput | null
) {
  const currentMetadata = asRecord(metadata)
  const currentNamespace = asRecord(currentMetadata[DELIVERY_HUB_CART_METADATA_NAMESPACE])
  const nextNamespace = {
    ...currentNamespace,
  }

  if (!input) {
    delete nextNamespace.selection
  } else {
    nextNamespace.selection = buildPersistedDeliveryHubCartSelection(input)
  }

  if (!Object.keys(nextNamespace).length) {
    const nextMetadata = {
      ...currentMetadata,
    }
    delete nextMetadata[DELIVERY_HUB_CART_METADATA_NAMESPACE]
    return nextMetadata
  }

  return {
    ...currentMetadata,
    [DELIVERY_HUB_CART_METADATA_NAMESPACE]: nextNamespace,
  }
}

export async function upsertDeliveryHubCartSelection(
  container: any,
  cart: DeliveryHubCartSelectionRecord,
  input: DeliveryHubCartSelectionWriteInput
) {
  const nextMetadata = buildDeliveryHubCartSelectionMetadata(cart.metadata, input)

  await persistDeliveryHubCartMetadata(container, cart.id, nextMetadata)

  return readDeliveryHubCartSelection(nextMetadata)
}

export async function clearDeliveryHubCartSelection(
  container: any,
  cart: DeliveryHubCartSelectionRecord
) {
  const nextMetadata = buildDeliveryHubCartSelectionMetadata(cart.metadata, null)

  await persistDeliveryHubCartMetadata(container, cart.id, nextMetadata)

  return null
}

function readPersistedDeliveryHubCartSelection(metadata?: unknown) {
  const root = asRecord(metadata)
  const namespace = asRecord(root[DELIVERY_HUB_CART_METADATA_NAMESPACE])
  const selection = asRecord(namespace.selection)
  const quoteReference = asRecord(selection.quote_reference)
  const quote = asRecord(selection.quote)
  const pickupPoint = readPickupPoint(selection.pickup_point)
  const pickupWindow = readPickupWindow(selection.pickup_window)
  const version = readNumber(selection.version)
  const providerCode = readProviderCode(selection.provider_code)
  const connectionId = readString(selection.connection_id)
  const quoteType = readQuoteType(selection.quote_type)
  const quoteReferenceId = readQuoteReferenceId(quoteReference.id)
  const quoteReferenceVersion = readNumber(quoteReference.version)
  const correlationId = readNullableString(selection.correlation_id)
  const updatedAt = readString(selection.updated_at)

  if (
    version !== DELIVERY_HUB_CART_SELECTION_VERSION ||
    !providerCode ||
    !connectionId ||
    !quoteType ||
    !quoteReferenceId ||
    quoteReferenceVersion !== DELIVERY_HUB_CART_SELECTION_VERSION ||
    !updatedAt ||
    !pickupPoint
  ) {
    return null
  }

  const amount = readNumber(quote.amount)
  const carrierCode = readString(quote.carrier_code)
  const carrierLabel = readString(quote.carrier_label)
  const currencyCode = readString(quote.currency_code)
  const pickupPointRequired = readBoolean(quote.pickup_point_required)
  const pickupWindowRequired = readBoolean(quote.pickup_window_required)

  if (
    amount === null ||
    !carrierCode ||
    !carrierLabel ||
    !currencyCode ||
    pickupPointRequired === null ||
    pickupWindowRequired === null
  ) {
    return null
  }

  return {
    version,
    provider_code: providerCode,
    connection_id: connectionId,
    quote_type: quoteType,
    quote_reference: {
      id: quoteReferenceId,
      version: quoteReferenceVersion,
    },
    quote: {
      carrier_code: carrierCode,
      carrier_label: carrierLabel,
      amount,
      currency_code: currencyCode,
      delivery_eta_min: readNullableNumber(quote.delivery_eta_min),
      delivery_eta_max: readNullableNumber(quote.delivery_eta_max),
      pickup_point_required: pickupPointRequired,
      pickup_window_required: pickupWindowRequired,
    },
    pickup_point: pickupPoint,
    pickup_window: pickupWindow,
    correlation_id: correlationId,
    updated_at: updatedAt,
  } satisfies DeliveryHubCartSelectionPersisted
}

function buildPersistedDeliveryHubCartSelection(input: DeliveryHubCartSelectionWriteInput) {
  const providerCode = normalizeProviderCode(input.provider_code)
  const connectionId = requireNonEmptyString(input.connection_id, "connection_id")
  const quoteType = requireQuoteType(input.quote_type)
  const quoteReference = resolveQuoteReference(connectionId, quoteType, input)
  const updatedAt = new Date().toISOString()

  return {
    version: DELIVERY_HUB_CART_SELECTION_VERSION,
    provider_code: providerCode,
    connection_id: connectionId,
    quote_type: quoteType,
    quote_reference: quoteReference,
    quote: {
      carrier_code: requireNonEmptyString(input.quote.carrier_code, "quote.carrier_code"),
      carrier_label: requireNonEmptyString(input.quote.carrier_label, "quote.carrier_label"),
      amount: requireFiniteNumber(input.quote.amount, "quote.amount"),
      currency_code: requireNonEmptyString(input.quote.currency_code, "quote.currency_code"),
      delivery_eta_min: normalizeNullableFiniteNumber(input.quote.delivery_eta_min),
      delivery_eta_max: normalizeNullableFiniteNumber(input.quote.delivery_eta_max),
      pickup_point_required: !!input.quote.pickup_point_required,
      pickup_window_required: !!input.quote.pickup_window_required,
    },
    pickup_point: normalizePickupPoint(input.pickup_point),
    pickup_window: input.pickup_window ? normalizePickupWindow(input.pickup_window) : null,
    correlation_id: normalizeNullableString(input.correlation_id),
    updated_at: updatedAt,
  } satisfies DeliveryHubCartSelectionPersisted
}

async function persistDeliveryHubCartMetadata(
  container: any,
  cartId: string,
  metadata: Record<string, unknown>
) {
  const { result } = await updateCartWorkflow(container).run({
    input: {
      id: cartId,
      metadata,
    },
  })

  return result
}

export function getDeliveryHubQuery(container: any): DeliveryHubQueryGraphLike {
  return container.resolve(ContainerRegistrationKeys.QUERY) as DeliveryHubQueryGraphLike
}

export function createDeliveryHubQuoteReference(input: {
  connection_id: string
  quote_type: string
  quote_key: string
}): DeliveryHubQuoteReference {
  return {
    id: createDeliveryHubQuoteReferenceId(input),
    version: DELIVERY_HUB_CART_SELECTION_VERSION,
  }
}

function createDeliveryHubQuoteReferenceId(input: {
  connection_id: string
  quote_type: string
  quote_key: string
}) {
  const digest = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        version: DELIVERY_HUB_CART_SELECTION_VERSION,
        connection_id: input.connection_id,
        quote_type: input.quote_type,
        quote_key: input.quote_key,
      })
    )
    .digest("hex")

  return `dhsel_${digest.slice(0, 32)}`
}

function normalizePickupPoint(
  input: DeliveryHubCartSelectionPickupPoint
): DeliveryHubCartSelectionPickupPoint {
  return {
    provider_point_id: requireNonEmptyString(input.provider_point_id, "pickup_point.provider_point_id"),
    provider_point_code: normalizeNullableString(input.provider_point_code),
    name: requireNonEmptyString(input.name, "pickup_point.name"),
    address: requireNonEmptyString(input.address, "pickup_point.address"),
    city: normalizeNullableString(input.city),
    region: normalizeNullableString(input.region),
    postal_code: normalizeNullableString(input.postal_code),
    lat: normalizeNullableFiniteNumber(input.lat),
    lng: normalizeNullableFiniteNumber(input.lng),
    is_origin_dropoff_allowed: !!input.is_origin_dropoff_allowed,
    is_destination_pickup_allowed: !!input.is_destination_pickup_allowed,
    payment_methods: Array.isArray(input.payment_methods)
      ? input.payment_methods
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
      : [],
  }
}

function normalizePickupWindow(
  input: DeliveryHubCartSelectionPickupWindow
): DeliveryHubCartSelectionPickupWindow {
  return {
    date: requireNonEmptyString(input.date, "pickup_window.date"),
    time_from: normalizeNullableString(input.time_from),
    time_to: normalizeNullableString(input.time_to),
    interval_utc: {
      from: requireNonEmptyString(input.interval_utc?.from, "pickup_window.interval_utc.from"),
      to: requireNonEmptyString(input.interval_utc?.to, "pickup_window.interval_utc.to"),
    },
    label: requireNonEmptyString(input.label, "pickup_window.label"),
  }
}

function readPickupPoint(value: unknown): DeliveryHubCartSelectionPickupPoint | null {
  const record = asRecord(value)
  const providerPointId = readString(record.provider_point_id)
  const name = readString(record.name)
  const address = readString(record.address)
  const originDropoffAllowed = readBoolean(record.is_origin_dropoff_allowed)
  const destinationPickupAllowed = readBoolean(record.is_destination_pickup_allowed)

  if (
    !providerPointId ||
    !name ||
    !address ||
    originDropoffAllowed === null ||
    destinationPickupAllowed === null
  ) {
    return null
  }

  return {
    provider_point_id: providerPointId,
    provider_point_code: readNullableString(record.provider_point_code),
    name,
    address,
    city: readNullableString(record.city),
    region: readNullableString(record.region),
    postal_code: readNullableString(record.postal_code),
    lat: readNullableNumber(record.lat),
    lng: readNullableNumber(record.lng),
    is_origin_dropoff_allowed: originDropoffAllowed,
    is_destination_pickup_allowed: destinationPickupAllowed,
    payment_methods: Array.isArray(record.payment_methods)
      ? record.payment_methods
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
      : [],
  }
}

function readPickupWindow(value: unknown): DeliveryHubCartSelectionPickupWindow | null {
  if (value === null || typeof value === "undefined") {
    return null
  }

  const record = asRecord(value)
  const intervalUtc = asRecord(record.interval_utc)
  const date = readString(record.date)
  const intervalFrom = readString(intervalUtc.from)
  const intervalTo = readString(intervalUtc.to)
  const label = readString(record.label)

  if (!date || !intervalFrom || !intervalTo || !label) {
    return null
  }

  return {
    date,
    time_from: readNullableString(record.time_from),
    time_to: readNullableString(record.time_to),
    interval_utc: {
      from: intervalFrom,
      to: intervalTo,
    },
    label,
  }
}

function normalizeProviderCode(value: unknown) {
  const normalized = normalizeNullableString(value) ?? DELIVERY_HUB_PROVIDER_YANDEX

  if (isSupportedProviderCode(normalized)) {
    return normalized
  }

  throw new DeliveryHubError({
    code: "DELIVERY_HUB_VALIDATION_ERROR",
    message: 'Field "provider_code" must be a supported neutral delivery provider code',
    status: 400,
    details: {
      field: "provider_code",
    },
  })
}

function readProviderCode(value: unknown) {
  const normalized = readString(value)

  return normalized && isSupportedProviderCode(normalized) ? normalized : null
}

function isSupportedProviderCode(value: string): value is (typeof DELIVERY_HUB_SUPPORTED_PUBLIC_PROVIDER_CODES)[number] {
  return (DELIVERY_HUB_SUPPORTED_PUBLIC_PROVIDER_CODES as readonly string[]).includes(value)
}

function requireQuoteType(value: unknown): DeliveryHubCartSelectionQuoteType {
  const normalized = readQuoteType(value)

  if (normalized) {
    return normalized
  }

  throw new DeliveryHubError({
    code: "DELIVERY_HUB_VALIDATION_ERROR",
    message: 'Field "quote_type" must be a supported neutral delivery quote type',
    status: 400,
    details: {
      field: "quote_type",
    },
  })
}

function resolveQuoteReference(
  connectionId: string,
  quoteType: DeliveryHubCartSelectionQuoteType,
  input: DeliveryHubCartSelectionWriteInput
): DeliveryHubQuoteReference {
  if ("quote_reference" in input) {
    return requireQuoteReference(input.quote_reference)
  }

  return createDeliveryHubQuoteReference({
    connection_id: connectionId,
    quote_type: quoteType,
    quote_key: requireNonEmptyString(input.quote_key, "quote_key"),
  })
}

function requireQuoteReference(value: unknown): DeliveryHubQuoteReference {
  const record = asRecord(value)
  const id = requireQuoteReferenceId(record.id)
  const version = requireFiniteNumber(record.version, "quote_reference.version")

  if (version !== DELIVERY_HUB_CART_SELECTION_VERSION) {
    throw new DeliveryHubError({
      code: "DELIVERY_HUB_VALIDATION_ERROR",
      message: `Field "quote_reference.version" must equal ${DELIVERY_HUB_CART_SELECTION_VERSION}`,
      status: 400,
      details: {
        field: "quote_reference.version",
      },
    })
  }

  return {
    id,
    version,
  }
}

function requireQuoteReferenceId(value: unknown) {
  const normalized = requireNonEmptyString(value, "quote_reference.id")

  if (DELIVERY_HUB_QUOTE_REFERENCE_ID_PATTERN.test(normalized)) {
    return normalized
  }

  throw new DeliveryHubError({
    code: "DELIVERY_HUB_VALIDATION_ERROR",
    message: 'Field "quote_reference.id" must be an opaque Delivery Hub quote reference',
    status: 400,
    details: {
      field: "quote_reference.id",
    },
  })
}

function readQuoteReferenceId(value: unknown) {
  const normalized = readString(value)

  return normalized && DELIVERY_HUB_QUOTE_REFERENCE_ID_PATTERN.test(normalized) ? normalized : null
}

function readQuoteType(value: unknown): DeliveryHubCartSelectionQuoteType | null {
  const normalized = readString(value)

  if (
    normalized === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint ||
    normalized === DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint
  ) {
    return normalized
  }

  return null
}

function requireNonEmptyString(value: unknown, field: string) {
  const normalized = readString(value)

  if (normalized) {
    return normalized
  }

  throw new DeliveryHubError({
    code: "DELIVERY_HUB_VALIDATION_ERROR",
    message: `Field "${field}" is required`,
    status: 400,
    details: {
      field,
    },
  })
}

function requireFiniteNumber(value: unknown, field: string) {
  const normalized = readNumber(value)

  if (normalized !== null) {
    return normalized
  }

  throw new DeliveryHubError({
    code: "DELIVERY_HUB_VALIDATION_ERROR",
    message: `Field "${field}" must be a finite number`,
    status: 400,
    details: {
      field,
    },
  })
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function readNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function readNullableNumber(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return null
  }

  return readNumber(value)
}

function normalizeNullableFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}
