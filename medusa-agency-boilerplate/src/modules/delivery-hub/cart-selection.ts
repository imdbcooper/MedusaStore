import crypto from "node:crypto"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateCartWorkflow } from "@medusajs/medusa/core-flows"
import {
  DELIVERY_HUB_MODE_CODE,
  DELIVERY_HUB_PROVIDER_YANDEX,
  DELIVERY_HUB_QUOTE_REFERENCE_ID_PATTERN,
  DELIVERY_HUB_SUPPORTED_PUBLIC_PROVIDER_CODES,
} from "./constants"
import type { DeliveryHubCustomerPrice } from "./domain/pricing-policy"
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
  customer_price?: DeliveryHubCustomerPrice
  delivery_eta_min: number | null
  delivery_eta_max: number | null
  pickup_point_required: boolean
  pickup_window_required: boolean
}

export type DeliveryHubCartSelectionPickupPoint = Omit<DeliveryPickupPoint, "metadata">

export type DeliveryHubCartSelectionPickupWindow = Omit<DeliveryPickupWindow, "metadata">

export type DeliveryHubProviderOriginDispatchContext =
  | {
      mode_code: typeof DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint
      origin_point_id: string
    }
  | {
      mode_code: typeof DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint
      provider_warehouse_id: string
    }

export type DeliveryHubQuoteReference = {
  id: string
  version: number
}

export type DeliveryHubProviderExecutionReference = {
  version: number
  token: string
}

export type DeliveryHubProviderExecutionReferenceValidationContext = {
  connection_id: string
  quote_type: DeliveryHubCartSelectionQuoteType
  quote_reference: DeliveryHubQuoteReference
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

export type DeliveryHubCartSelectionValidationContext = {
  version: number
  cart_id: string
  cart_fingerprint: string
  address_fingerprint: string
  quote_expires_at: string
}

export type DeliveryHubCartSelectionWriteInput = {
  provider_code?: string | null
  connection_id: string
  quote_type: DeliveryHubCartSelectionQuoteType
  quote: DeliveryHubCartSelectionQuoteSummary
  pickup_point: DeliveryHubCartSelectionPickupPoint
  pickup_window?: DeliveryHubCartSelectionPickupWindow | null
  correlation_id?: string | null
  validation_context?: DeliveryHubCartSelectionValidationContext | null
  provider_execution_reference?: DeliveryHubProviderExecutionReference | null
  provider_origin_dispatch_context?: DeliveryHubProviderOriginDispatchContext | null
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
  currency_code?: string | null
  subtotal?: number | null
  total?: number | null
  item_subtotal?: number | null
  items?: Array<{
    id?: string | null
    title?: string | null
    subtitle?: string | null
    quantity?: number | null
    unit_price?: number | null
    total?: number | null
    subtotal?: number | null
    variant?: {
      id?: string | null
      title?: string | null
      sku?: string | null
      weight?: number | null
      length?: number | null
      width?: number | null
      height?: number | null
    } | null
  }> | null
  shipping_address?: unknown
  shipping_methods?: Array<{
    shipping_option?: {
      id?: string | null
      name?: string | null
      provider_id?: string | null
      data?: Record<string, unknown> | null
    } | null
  }> | null
}

type DeliveryHubCartSelectionPersisted = DeliveryHubCartSelectionPublic & {
  validation_context?: DeliveryHubCartSelectionValidationContext
  backend_execution_reference?: DeliveryHubProviderExecutionReference
}

export async function getDeliveryHubCartById(
  query: DeliveryHubQueryGraphLike,
  cartId: string
): Promise<DeliveryHubCartSelectionRecord | null> {
  const normalizedCartId = requireNonEmptyString(cartId, "cart_id")
  const { data } = await query.graph<DeliveryHubCartSelectionRecord>({
    entity: "cart",
    fields: [
      "id",
      "metadata",
      "currency_code",
      "subtotal",
      "total",
      "item_subtotal",
      "items.id",
      "items.title",
      "items.subtitle",
      "items.quantity",
      "items.unit_price",
      "items.total",
      "items.subtotal",
      "items.variant.id",
      "items.variant.title",
      "items.variant.sku",
      "items.variant.weight",
      "items.variant.length",
      "items.variant.width",
      "items.variant.height",
      "shipping_address.*",
      "shipping_methods.shipping_option.id",
      "shipping_methods.shipping_option.name",
      "shipping_methods.shipping_option.provider_id",
      "shipping_methods.shipping_option.data",
    ],
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
  const selection = readPersistedDeliveryHubCartSelection(metadata)

  if (!selection) {
    return null
  }

  return stripBackendOnlyCartSelectionFields(selection)
}

export function readDeliveryHubCartSelectionValidationContext(
  metadata?: unknown
): DeliveryHubCartSelectionValidationContext | null {
  return readPersistedDeliveryHubCartSelection(metadata)?.validation_context ?? null
}

export function readDeliveryHubCartSelectionBackendExecutionReference(
  metadata?: unknown
): DeliveryHubProviderExecutionReference | null {
  return readPersistedDeliveryHubCartSelection(metadata)?.backend_execution_reference ?? null
}

export function validateDeliveryHubProviderExecutionReference(
  reference: DeliveryHubProviderExecutionReference,
  context: DeliveryHubProviderExecutionReferenceValidationContext
): DeliveryHubProviderExecutionReference | null {
  return readProviderExecutionReference(reference, context)
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
  const validationContext = readSelectionValidationContext(selection.validation_context)

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
  const customerPrice = readCustomerPrice(quote.customer_price, {
    amount,
    currency_code: currencyCode,
  })
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

  const backendExecutionReference =
    connectionId && quoteType && quoteReferenceId && quoteReferenceVersion === DELIVERY_HUB_CART_SELECTION_VERSION
      ? readProviderExecutionReference(selection.backend_execution_reference, {
          connection_id: connectionId,
          quote_type: quoteType,
          quote_reference: {
            id: quoteReferenceId,
            version: quoteReferenceVersion,
          },
        })
      : null

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
      ...(customerPrice
        ? {
            customer_price: customerPrice,
          }
        : {}),
      delivery_eta_min: readNullableNumber(quote.delivery_eta_min),
      delivery_eta_max: readNullableNumber(quote.delivery_eta_max),
      pickup_point_required: pickupPointRequired,
      pickup_window_required: pickupWindowRequired,
    },
    pickup_point: pickupPoint,
    pickup_window: pickupWindow,
    correlation_id: correlationId,
    updated_at: updatedAt,
    ...(validationContext
      ? {
          validation_context: validationContext,
        }
      : {}),
    ...(backendExecutionReference
      ? {
          backend_execution_reference: backendExecutionReference,
        }
      : {}),
  } satisfies DeliveryHubCartSelectionPersisted
}

function buildPersistedDeliveryHubCartSelection(input: DeliveryHubCartSelectionWriteInput) {
  const providerCode = normalizeProviderCode(input.provider_code)
  const connectionId = requireNonEmptyString(input.connection_id, "connection_id")
  const quoteType = requireQuoteType(input.quote_type)
  const quoteReference = resolveQuoteReference(connectionId, quoteType, input)
  const providerExecutionReference = resolveProviderExecutionReference(
    connectionId,
    quoteType,
    quoteReference,
    input
  )
  const customerPrice = requireCustomerPrice(input.quote)
  const quoteAmount = requireFiniteNumber(input.quote.amount, "quote.amount")
  const quoteCurrencyCode = requireNonEmptyString(input.quote.currency_code, "quote.currency_code")
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
      amount: quoteAmount,
      currency_code: quoteCurrencyCode,
      customer_price: customerPrice,
      delivery_eta_min: normalizeNullableFiniteNumber(input.quote.delivery_eta_min),
      delivery_eta_max: normalizeNullableFiniteNumber(input.quote.delivery_eta_max),
      pickup_point_required: !!input.quote.pickup_point_required,
      pickup_window_required: !!input.quote.pickup_window_required,
    },
    pickup_point: normalizePickupPoint(input.pickup_point),
    pickup_window: input.pickup_window ? normalizePickupWindow(input.pickup_window) : null,
    correlation_id: normalizeNullableString(input.correlation_id),
    updated_at: updatedAt,
    ...(input.validation_context
      ? {
          validation_context: normalizeSelectionValidationContext(input.validation_context),
        }
      : {}),
    ...(providerExecutionReference
      ? {
          backend_execution_reference: providerExecutionReference,
        }
      : {}),
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
  provider_origin_dispatch_context?: DeliveryHubProviderOriginDispatchContext | null
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
  provider_origin_dispatch_context?: DeliveryHubProviderOriginDispatchContext | null
}) {
  const quoteType = readQuoteType(input.quote_type)
  const normalizedInput = {
    connection_id: input.connection_id,
    quote_type: input.quote_type,
    quote_key: input.quote_key,
    provider_origin_dispatch_context: quoteType
      ? normalizeProviderOriginDispatchContextForQuoteType(
          input.provider_origin_dispatch_context,
          quoteType
        )
      : null,
  }
  const encryptedToken = normalizedInput.provider_origin_dispatch_context
    ? encryptDeliveryHubQuoteReferencePayload(normalizedInput)
    : null

  if (encryptedToken) {
    return `dhsel_t1_${encryptedToken}`
  }

  const digest = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        version: DELIVERY_HUB_CART_SELECTION_VERSION,
        connection_id: normalizedInput.connection_id,
        quote_type: normalizedInput.quote_type,
        quote_key: normalizedInput.quote_key,
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
    provider_origin_dispatch_context: input.provider_origin_dispatch_context ?? null,
  })
}

function resolveProviderExecutionReference(
  connectionId: string,
  quoteType: DeliveryHubCartSelectionQuoteType,
  quoteReference: DeliveryHubQuoteReference,
  input: DeliveryHubCartSelectionWriteInput
): DeliveryHubProviderExecutionReference | null {
  if (input.provider_execution_reference) {
    return requireProviderExecutionReference(input.provider_execution_reference, {
      connection_id: connectionId,
      quote_type: quoteType,
      quote_reference: quoteReference,
    })
  }

  if ("quote_key" in input) {
    return createDeliveryHubProviderExecutionReference({
      connection_id: connectionId,
      quote_type: quoteType,
      quote_key: requireNonEmptyString(input.quote_key, "quote_key"),
      provider_origin_dispatch_context: input.provider_origin_dispatch_context ?? null,
    })
  }

  return createDeliveryHubProviderExecutionReferenceFromQuoteReference(quoteReference)
}

export function createDeliveryHubProviderExecutionReference(input: {
  connection_id: string
  quote_type: string
  quote_key: string
  provider_origin_dispatch_context?: DeliveryHubProviderOriginDispatchContext | null
}): DeliveryHubProviderExecutionReference | null {
  const quoteKey = requireNonEmptyString(input.quote_key, "quote_key")
  const quoteType = requireQuoteType(input.quote_type)
  const token = encryptDeliveryHubProviderExecutionReference({
    connection_id: requireNonEmptyString(input.connection_id, "connection_id"),
    quote_type: quoteType,
    quote_key: quoteKey,
    provider_quote_reference: quoteKey,
    provider_origin_dispatch_context: normalizeProviderOriginDispatchContextForQuoteType(
      input.provider_origin_dispatch_context,
      quoteType
    ),
  })

  if (!token) {
    return null
  }

  return {
    version: DELIVERY_HUB_CART_SELECTION_VERSION,
    token,
  }
}

export function decryptDeliveryHubProviderExecutionReference(
  reference: DeliveryHubProviderExecutionReference
) {
  return decryptProviderExecutionReferenceToken(reference.token)
}

export function readDeliveryHubProviderExecutionReferenceOriginContext(
  reference: DeliveryHubProviderExecutionReference
): DeliveryHubProviderOriginDispatchContext | null {
  return decryptProviderExecutionReferenceToken(reference.token).provider_origin_dispatch_context ?? null
}

function requireProviderExecutionReference(
  value: unknown,
  context?: DeliveryHubProviderExecutionReferenceValidationContext
): DeliveryHubProviderExecutionReference {
  const record = asRecord(value)
  const version = requireFiniteNumber(record.version, "backend_execution_reference.version")
  const token = requireNonEmptyString(record.token, "backend_execution_reference.token")

  if (version !== DELIVERY_HUB_CART_SELECTION_VERSION) {
    throw new DeliveryHubError({
      code: "DELIVERY_HUB_VALIDATION_ERROR",
      message: `Field "backend_execution_reference.version" must equal ${DELIVERY_HUB_CART_SELECTION_VERSION}`,
      status: 400,
      details: {
        field: "backend_execution_reference.version",
      },
    })
  }

  const payload = decryptProviderExecutionReferenceToken(token)

  if (context && !providerExecutionReferenceMatchesContext(payload, context)) {
    throw new DeliveryHubError({
      code: "DELIVERY_HUB_VALIDATION_ERROR",
      message: 'Field "backend_execution_reference.token" must match the current Delivery Hub selection context',
      status: 400,
      details: {
        field: "backend_execution_reference.token",
      },
    })
  }

  return {
    version,
    token,
  }
}

function readProviderExecutionReference(
  value: unknown,
  context?: DeliveryHubProviderExecutionReferenceValidationContext
): DeliveryHubProviderExecutionReference | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  try {
    return requireProviderExecutionReference(value, context)
  } catch {
    return null
  }
}

function stripBackendOnlyCartSelectionFields(
  selection: DeliveryHubCartSelectionPersisted
): DeliveryHubCartSelectionPublic {
  const {
    backend_execution_reference: _backendExecutionReference,
    validation_context: _validationContext,
    ...publicSelection
  } = selection

  return publicSelection
}

function normalizeSelectionValidationContext(
  value: DeliveryHubCartSelectionValidationContext
): DeliveryHubCartSelectionValidationContext {
  const context = asRecord(value)
  const version = requireFiniteNumber(context.version, "validation_context.version")

  if (version !== DELIVERY_HUB_CART_SELECTION_VERSION) {
    throw new DeliveryHubError({
      code: "DELIVERY_HUB_VALIDATION_ERROR",
      message: `Field "validation_context.version" must equal ${DELIVERY_HUB_CART_SELECTION_VERSION}`,
      status: 400,
      details: {
        field: "validation_context.version",
      },
    })
  }

  return {
    version,
    cart_id: requireNonEmptyString(context.cart_id, "validation_context.cart_id"),
    cart_fingerprint: requireNonEmptyString(
      context.cart_fingerprint,
      "validation_context.cart_fingerprint"
    ),
    address_fingerprint: requireNonEmptyString(
      context.address_fingerprint,
      "validation_context.address_fingerprint"
    ),
    quote_expires_at: requireNonEmptyString(
      context.quote_expires_at,
      "validation_context.quote_expires_at"
    ),
  }
}

function readSelectionValidationContext(value: unknown): DeliveryHubCartSelectionValidationContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  try {
    return normalizeSelectionValidationContext(value as DeliveryHubCartSelectionValidationContext)
  } catch {
    return null
  }
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

function readCustomerPrice(
  value: unknown,
  fallback: {
    amount: number | null
    currency_code: string | null
  }
): DeliveryHubCustomerPrice | null {
  const record = asRecord(value)

  if (!Object.keys(record).length) {
    return null
  }

  const amount = readNumber(record.amount) ?? fallback.amount
  const currencyCode = readString(record.currency_code) ?? fallback.currency_code
  const source = readCustomerPriceSource(record.source) ?? "provider_quote"
  const policyId = readNullableString(record.policy_id)

  if (amount === null || !currencyCode) {
    return null
  }

  return {
    amount,
    currency_code: currencyCode,
    source,
    policy_id: policyId,
  }
}

function requireCustomerPrice(
  quote: DeliveryHubCartSelectionQuoteSummary
): DeliveryHubCustomerPrice {
  const fallbackAmount = readNumber(quote.amount)
  const fallbackCurrency = readString(quote.currency_code)
  const customerPrice = readCustomerPrice(quote.customer_price, {
    amount: fallbackAmount,
    currency_code: fallbackCurrency,
  })

  if (customerPrice) {
    return customerPrice
  }

  throw new DeliveryHubError({
    code: "DELIVERY_HUB_VALIDATION_ERROR",
    message: 'Field "quote.customer_price" must contain the buyer-facing Delivery Hub price',
    status: 400,
    details: {
      field: "quote.customer_price",
    },
  })
}

function readCustomerPriceSource(value: unknown): DeliveryHubCustomerPrice["source"] | null {
  const normalized = readString(value)

  if (
    normalized === "fixed" ||
    normalized === "free_threshold" ||
    normalized === "free" ||
    normalized === "provider_quote" ||
    normalized === "provider_quote_markup" ||
    normalized === "manual"
  ) {
    return normalized
  }

  return null
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

function encryptDeliveryHubProviderExecutionReference(payload: {
  connection_id: string
  quote_type: string
  quote_key: string
  provider_quote_reference: string
  provider_origin_dispatch_context?: DeliveryHubProviderOriginDispatchContext | null
}) {
  const secret = getConfiguredDeliveryHubProviderExecutionReferenceSecret()

  if (!secret) {
    return null
  }

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", secret, iv)
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8")
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()

  return [iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(".")
}

function decryptProviderExecutionReferenceToken(token: string): {
  connection_id: string
  quote_type: string
  quote_key: string
  provider_quote_reference: string
  provider_origin_dispatch_context: DeliveryHubProviderOriginDispatchContext | null
} {
  const segments = token.split(".")

  if (segments.length !== 3 || segments.some((segment) => !segment)) {
    throw new DeliveryHubError({
      code: "DELIVERY_HUB_VALIDATION_ERROR",
      message: 'Field "backend_execution_reference.token" must be a valid Delivery Hub backend execution reference token',
      status: 400,
      details: {
        field: "backend_execution_reference.token",
      },
    })
  }

  try {
    const [iv, tag, ciphertext] = segments
    const secret = getDeliveryHubProviderExecutionReferenceSecret()
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      secret,
      Buffer.from(iv!, "base64")
    )
    decipher.setAuthTag(Buffer.from(tag!, "base64"))
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertext!, "base64")),
      decipher.final(),
    ])
    const payload = asRecord(JSON.parse(plaintext.toString("utf8")))
    const quoteType = requireQuoteType(payload.quote_type)

    return {
      connection_id: requireNonEmptyString(
        payload.connection_id,
        "backend_execution_reference.payload.connection_id"
      ),
      quote_type: quoteType,
      quote_key: requireNonEmptyString(
        payload.quote_key,
        "backend_execution_reference.payload.quote_key"
      ),
      provider_quote_reference: requireNonEmptyString(
        payload.provider_quote_reference,
        "backend_execution_reference.payload.provider_quote_reference"
      ),
      provider_origin_dispatch_context: normalizeProviderOriginDispatchContextForQuoteType(
        payload.provider_origin_dispatch_context,
        quoteType
      ),
    }
  } catch {
    throw new DeliveryHubError({
      code: "DELIVERY_HUB_VALIDATION_ERROR",
      message: 'Field "backend_execution_reference.token" must be a valid Delivery Hub backend execution reference token',
      status: 400,
      details: {
        field: "backend_execution_reference.token",
      },
    })
  }
}

function getDeliveryHubProviderExecutionReferenceSecret() {
  const secret = getConfiguredDeliveryHubProviderExecutionReferenceSecret()

  if (secret) {
    return secret
  }

  throw new DeliveryHubError({
    code: "DELIVERY_HUB_VALIDATION_ERROR",
    message:
      'Field "backend_execution_reference.token" is unavailable because DELIVERY_HUB_ENCRYPTION_KEY is not configured',
    status: 400,
    details: {
      field: "backend_execution_reference.token",
    },
  })
}

function getConfiguredDeliveryHubProviderExecutionReferenceSecret() {
  const encryptionKey = process.env.DELIVERY_HUB_ENCRYPTION_KEY?.trim()

  return encryptionKey ? normalizeProviderExecutionReferenceSecret(encryptionKey) : null
}

function normalizeProviderExecutionReferenceSecret(rawSecret: string) {
  return crypto.createHash("sha256").update(rawSecret, "utf8").digest()
}

function providerExecutionReferenceMatchesContext(
  payload: {
    connection_id: string
    quote_type: string
    quote_key: string
    provider_quote_reference: string
    provider_origin_dispatch_context: DeliveryHubProviderOriginDispatchContext | null
  },
  context: DeliveryHubProviderExecutionReferenceValidationContext
) {
  if (payload.connection_id !== context.connection_id || payload.quote_type !== context.quote_type) {
    return false
  }

  const quoteReferencePayload = decryptDeliveryHubQuoteReferencePayload(context.quote_reference)

  if (quoteReferencePayload) {
    return (
      quoteReferencePayload.connection_id === payload.connection_id &&
      quoteReferencePayload.quote_type === payload.quote_type &&
      quoteReferencePayload.quote_key === payload.quote_key &&
      providerOriginDispatchContextsEqual(
        quoteReferencePayload.provider_origin_dispatch_context,
        payload.provider_origin_dispatch_context
      )
    )
  }

  const expectedQuoteReference = createDeliveryHubQuoteReference({
    connection_id: payload.connection_id,
    quote_type: payload.quote_type,
    quote_key: payload.quote_key,
  })

  return (
    payload.provider_origin_dispatch_context === null &&
    expectedQuoteReference.id === context.quote_reference.id &&
    expectedQuoteReference.version === context.quote_reference.version
  )
}

function providerOriginDispatchContextsEqual(
  left: DeliveryHubProviderOriginDispatchContext | null,
  right: DeliveryHubProviderOriginDispatchContext | null
) {
  if (left === null || right === null) {
    return left === right
  }

  if (left.mode_code !== right.mode_code) {
    return false
  }

  if (left.mode_code === DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint) {
    return (
      right.mode_code === DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint &&
      left.origin_point_id === right.origin_point_id
    )
  }

  return (
    right.mode_code === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint &&
    left.provider_warehouse_id === right.provider_warehouse_id
  )
}

function createDeliveryHubProviderExecutionReferenceFromQuoteReference(
  quoteReference: DeliveryHubQuoteReference
): DeliveryHubProviderExecutionReference | null {
  const payload = decryptDeliveryHubQuoteReferencePayload(quoteReference)

  if (!payload) {
    return null
  }

  return createDeliveryHubProviderExecutionReference({
    connection_id: payload.connection_id,
    quote_type: payload.quote_type,
    quote_key: payload.quote_key,
    provider_origin_dispatch_context: payload.provider_origin_dispatch_context,
  })
}

function encryptDeliveryHubQuoteReferencePayload(payload: {
  connection_id: string
  quote_type: string
  quote_key: string
  provider_origin_dispatch_context?: DeliveryHubProviderOriginDispatchContext | null
}) {
  const secret = getConfiguredDeliveryHubProviderExecutionReferenceSecret()

  if (!secret) {
    return null
  }

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", secret, iv)
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8")
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    encodeDeliveryHubOpaqueTokenSegment(iv),
    encodeDeliveryHubOpaqueTokenSegment(tag),
    encodeDeliveryHubOpaqueTokenSegment(ciphertext),
  ].join(".")
}

function decryptDeliveryHubQuoteReferencePayload(quoteReference: DeliveryHubQuoteReference): {
  connection_id: string
  quote_type: DeliveryHubCartSelectionQuoteType
  quote_key: string
  provider_origin_dispatch_context: DeliveryHubProviderOriginDispatchContext | null
} | null {
  const normalizedId = readString(quoteReference.id)

  if (!normalizedId || !normalizedId.startsWith("dhsel_t1_")) {
    return null
  }

  const token = normalizedId.slice("dhsel_t1_".length)
  const segments = token.split(".")

  if (segments.length !== 3 || segments.some((segment) => !segment)) {
    return null
  }

  try {
    const [iv, tag, ciphertext] = segments
    const secret = getDeliveryHubProviderExecutionReferenceSecret()
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      secret,
      decodeDeliveryHubOpaqueTokenSegment(iv!)
    )
    decipher.setAuthTag(decodeDeliveryHubOpaqueTokenSegment(tag!))
    const plaintext = Buffer.concat([
      decipher.update(decodeDeliveryHubOpaqueTokenSegment(ciphertext!)),
      decipher.final(),
    ])
    const payload = asRecord(JSON.parse(plaintext.toString("utf8")))
    const quoteType = readQuoteType(payload.quote_type)

    if (!quoteType) {
      return null
    }

    const providerOriginDispatchContext = normalizeProviderOriginDispatchContextForQuoteType(
      payload.provider_origin_dispatch_context,
      quoteType
    )

    if (hasProviderOriginDispatchContext(payload) && !providerOriginDispatchContext) {
      return null
    }

    return {
      connection_id: requireNonEmptyString(payload.connection_id, "quote_reference.payload.connection_id"),
      quote_type: quoteType,
      quote_key: requireNonEmptyString(payload.quote_key, "quote_reference.payload.quote_key"),
      provider_origin_dispatch_context: providerOriginDispatchContext,
    }
  } catch {
    return null
  }
}

function normalizeProviderOriginDispatchContextForQuoteType(
  value: unknown,
  quoteType: DeliveryHubCartSelectionQuoteType
): DeliveryHubProviderOriginDispatchContext | null {
  const record = asRecord(value)
  const modeCode = readQuoteType(record.mode_code)

  if (quoteType === DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint) {
    const originPointId = readString(record.origin_point_id)
    return modeCode === DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint && originPointId
      ? {
          mode_code: quoteType,
          origin_point_id: originPointId,
        }
      : null
  }

  const providerWarehouseId = readString(record.provider_warehouse_id)
  return modeCode === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint && providerWarehouseId
    ? {
        mode_code: quoteType,
        provider_warehouse_id: providerWarehouseId,
      }
    : null
}

function hasProviderOriginDispatchContext(value: Record<string, unknown>) {
  return Object.prototype.hasOwnProperty.call(value, "provider_origin_dispatch_context")
}

function encodeDeliveryHubOpaqueTokenSegment(value: Buffer) {
  return value.toString("base64url")
}

function decodeDeliveryHubOpaqueTokenSegment(value: string) {
  return Buffer.from(value, "base64url")
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}
