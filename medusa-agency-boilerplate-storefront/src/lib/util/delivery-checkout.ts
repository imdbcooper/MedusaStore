import {
  getApishipCheckoutContextKey,
  APISHIP_COURIER_DELIVERY_MODE,
  APISHIP_PICKUP_POINT_DELIVERY_MODE,
  getApishipDataFromShippingMethod,
  getApishipDeliveryModeFromShippingMethod,
  getApishipPersistablePointId,
  hasApishipDeliveryModeConflict,
  isApishipShippingMethodLike,
  normalizeApishipTariffForCheckout,
  type ApishipDeliveryMode,
  type ApishipPoint,
  type ApishipTariff,
} from "./apiship.ts"

export const DELIVERY_CHECKOUT_PROVIDER_APISHIP = "apiship" as const

export type DeliveryCheckoutProvider = typeof DELIVERY_CHECKOUT_PROVIDER_APISHIP

export type DeliveryCheckoutReadinessReason =
  | "shipping_method_missing"
  | "shipping_method_provider_mismatch"
  | "selection_missing"
  | "tariff_missing"
  | "pickup_point_missing"
  | "context_mismatch"

export type DeliveryCheckoutSummary = {
  provider: DeliveryCheckoutProvider
  label: string
  point_label: string | null
  tariff_label: string | null
  mode: ApishipDeliveryMode
}

export type DeliveryCheckoutReadinessState = {
  provider: DeliveryCheckoutProvider
  ready: boolean
  reason: DeliveryCheckoutReadinessReason | null
  contextKey: string | null
  summary: DeliveryCheckoutSummary | null
}

type DeliveryCheckoutCartLike = {
  id?: string
  currency_code?: string | null
  subtotal?: number | null
  shipping_address?: {
    country_code?: string | null
    city?: string | null
    postal_code?: string | null
    address_1?: string | null
  } | null
  shipping_methods?: unknown[] | null
}

type DeliveryCheckoutReadinessOptions = {
  provider?: DeliveryCheckoutProvider
  contextKey?: string | null
  shippingOptionId?: string | null
  mode?: ApishipDeliveryMode | null
}

type ApishipCheckoutSelection = {
  tariff?: ApishipTariff | null
  point?: ApishipPoint | null
  mode?: ApishipDeliveryMode | null
  contextKey?: string | null
}

export function buildDeliveryCheckoutReadinessState(
  cart?: DeliveryCheckoutCartLike | null,
  options: DeliveryCheckoutReadinessOptions = {}
): DeliveryCheckoutReadinessState {
  const provider = options.provider ?? DELIVERY_CHECKOUT_PROVIDER_APISHIP

  if (provider !== DELIVERY_CHECKOUT_PROVIDER_APISHIP) {
    return buildNotReadyState(provider, "shipping_method_provider_mismatch", null)
  }

  return buildApishipDeliveryCheckoutReadinessState(cart, options)
}

export function isDeliveryCheckoutReady(
  cart?: DeliveryCheckoutCartLike | null,
  options: DeliveryCheckoutReadinessOptions = {}
) {
  return buildDeliveryCheckoutReadinessState(cart, options).ready
}

export function buildDeliveryCheckoutSummary(
  method?: unknown,
  options: Pick<DeliveryCheckoutReadinessOptions, "provider"> = {}
): DeliveryCheckoutSummary | null {
  const provider = options.provider ?? DELIVERY_CHECKOUT_PROVIDER_APISHIP

  if (provider !== DELIVERY_CHECKOUT_PROVIDER_APISHIP) {
    return null
  }

  if (!isApishipShippingMethodLike(method)) {
    return null
  }

  const selection = getApishipDeliverySelection(method)

  if (!selection || hasApishipDeliveryModeConflict(method)) {
    return null
  }

  return buildApishipDeliverySummary({
    ...selection,
    mode: getApishipDeliveryModeFromShippingMethod(method),
  })
}

function buildApishipDeliveryCheckoutReadinessState(
  cart?: DeliveryCheckoutCartLike | null,
  options: DeliveryCheckoutReadinessOptions = {}
): DeliveryCheckoutReadinessState {
  const method = cart?.shipping_methods?.at(-1)
  const contextKey = cart
    ? options.contextKey ?? getApishipCheckoutContextKey(cart, options.shippingOptionId)
    : null

  if (!method) {
    return buildNotReadyState(
      DELIVERY_CHECKOUT_PROVIDER_APISHIP,
      "shipping_method_missing",
      contextKey
    )
  }

  if (!isApishipShippingMethodLike(method)) {
    return buildNotReadyState(
      DELIVERY_CHECKOUT_PROVIDER_APISHIP,
      "shipping_method_provider_mismatch",
      contextKey
    )
  }

  const selection = getApishipDeliverySelection(method)
  const resolvedDeliveryMode = getApishipDeliveryModeFromShippingMethod(method)
  const deliveryMode = options.mode ?? resolvedDeliveryMode

  if (!selection) {
    return buildNotReadyState(
      DELIVERY_CHECKOUT_PROVIDER_APISHIP,
      "selection_missing",
      contextKey
    )
  }

  if (
    hasApishipDeliveryModeConflict(method) ||
    (options.mode && options.mode !== resolvedDeliveryMode)
  ) {
    return buildNotReadyState(
      DELIVERY_CHECKOUT_PROVIDER_APISHIP,
      "shipping_method_provider_mismatch",
      contextKey
    )
  }

  const tariff = normalizeApishipTariffForCheckout(selection.tariff)

  if (!tariff) {
    return buildNotReadyState(
      DELIVERY_CHECKOUT_PROVIDER_APISHIP,
      "tariff_missing",
      contextKey
    )
  }

  const pointId = getApishipPersistablePointId(selection.point)

  if (deliveryMode === APISHIP_PICKUP_POINT_DELIVERY_MODE && !pointId) {
    return buildNotReadyState(
      DELIVERY_CHECKOUT_PROVIDER_APISHIP,
      "pickup_point_missing",
      contextKey
    )
  }

  if (options.contextKey && selection.contextKey !== options.contextKey) {
    return buildNotReadyState(
      DELIVERY_CHECKOUT_PROVIDER_APISHIP,
      "context_mismatch",
      contextKey
    )
  }

  return {
    provider: DELIVERY_CHECKOUT_PROVIDER_APISHIP,
    ready: true,
    reason: null,
    contextKey,
    summary: buildApishipDeliverySummary({
      ...selection,
      mode: deliveryMode,
      tariff,
    }),
  }
}

function getApishipDeliverySelection(
  method?: unknown
): ApishipCheckoutSelection | null {
  return getApishipDataFromShippingMethod(method) ?? null
}

function buildApishipDeliverySummary(
  selection: ApishipCheckoutSelection
): DeliveryCheckoutSummary {
  const mode = selection.mode ?? APISHIP_PICKUP_POINT_DELIVERY_MODE

  return {
    provider: DELIVERY_CHECKOUT_PROVIDER_APISHIP,
    label: mode === APISHIP_COURIER_DELIVERY_MODE ? "ApiShip courier" : "ApiShip",
    point_label: mode === APISHIP_COURIER_DELIVERY_MODE ? null : getApishipPointLabel(selection.point),
    tariff_label: getApishipTariffLabel(selection.tariff),
    mode,
  }
}

function getApishipPointLabel(point?: ApishipPoint | null) {
  const label = [point?.name, point?.address].filter(Boolean).join(" · ")

  return label || getApishipPersistablePointId(point)
}

function getApishipTariffLabel(tariff?: ApishipTariff | null) {
  const providerKey = tariff?.providerKey
  const tariffId = tariff?.tariffId ?? tariff?.tariff_id

  return [providerKey, tariffId].filter(Boolean).join(" · ") || null
}

function buildNotReadyState(
  provider: DeliveryCheckoutProvider,
  reason: DeliveryCheckoutReadinessReason,
  contextKey: string | null
): DeliveryCheckoutReadinessState {
  return {
    provider,
    ready: false,
    reason,
    contextKey,
    summary: null,
  }
}
