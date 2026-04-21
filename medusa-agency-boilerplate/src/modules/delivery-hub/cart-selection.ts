import crypto from "node:crypto"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateCartWorkflow } from "@medusajs/medusa/core-flows"
import { DELIVERY_HUB_MODE_CODE } from "./constants"
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

export type DeliveryHubCartSelectionPublic = {
  version: number
  connection_id: string
  quote_type: DeliveryHubCartSelectionQuoteType
  quote_reference: {
    id: string
    version: number
  }
  quote: DeliveryHubCartSelectionQuoteSummary
  pickup_point: DeliveryHubCartSelectionPickupPoint
  pickup_window: DeliveryHubCartSelectionPickupWindow | null
  updated_at: string
}

export type DeliveryHubCartSelectionWriteInput = {
  connection_id: string
  quote_type: DeliveryHubCartSelectionQuoteType
  quote_key: string
  quote: DeliveryHubCartSelectionQuoteSummary
  pickup_point: DeliveryHubCartSelectionPickupPoint
  pickup_window?: DeliveryHubCartSelectionPickupWindow | null
}

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

type DeliveryHubCartSelectionPersisted = DeliveryHubCartSelectionPublic & {
  backend: {
    quote_key: string
  }
}

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
  const persisted = readPersistedDeliveryHubCartSelection(metadata)

  if (!persisted) {
    return null
  }

  const { backend: _backend, ...selection } = persisted
  return selection
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
  const backend = asRecord(selection.backend)
  const pickupPoint = readPickupPoint(selection.pickup_point)
  const pickupWindow = readPickupWindow(selection.pickup_window)
  const version = readNumber(selection.version)
  const connectionId = readString(selection.connection_id)
  const quoteType = readQuoteType(selection.quote_type)
  const quoteReferenceId = readString(quoteReference.id)
  const quoteReferenceVersion = readNumber(quoteReference.version)
  const updatedAt = readString(selection.updated_at)
  const quoteKey = readString(backend.quote_key)

  if (
    version !== DELIVERY_HUB_CART_SELECTION_VERSION ||
    !connectionId ||
    !quoteType ||
    !quoteReferenceId ||
    quoteReferenceVersion !== DELIVERY_HUB_CART_SELECTION_VERSION ||
    !updatedAt ||
    !quoteKey ||
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
    updated_at: updatedAt,
    backend: {
      quote_key: quoteKey,
    },
  } satisfies DeliveryHubCartSelectionPersisted
}

function buildPersistedDeliveryHubCartSelection(input: DeliveryHubCartSelectionWriteInput) {
  const connectionId = requireNonEmptyString(input.connection_id, "connection_id")
  const quoteType = requireQuoteType(input.quote_type)
  const quoteKey = requireNonEmptyString(input.quote_key, "quote_key")
  const updatedAt = new Date().toISOString()

  return {
    version: DELIVERY_HUB_CART_SELECTION_VERSION,
    connection_id: connectionId,
    quote_type: quoteType,
    quote_reference: {
      id: createDeliveryHubQuoteReferenceId({
        connection_id: connectionId,
        quote_type: quoteType,
        quote_key: quoteKey,
      }),
      version: DELIVERY_HUB_CART_SELECTION_VERSION,
    },
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
    updated_at: updatedAt,
    backend: {
      quote_key: quoteKey,
    },
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
