import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"

export const APISHIP_PICKUP_POINT_SHIPPING_OPTION_PROVIDER_DATA_ID =
  "apiship_doortopoint" as const
export const APISHIP_COURIER_SHIPPING_OPTION_PROVIDER_DATA_ID =
  "apiship_doortodoor" as const
export const APISHIP_PICKUP_POINT_PROVIDER_ID = "apiship_apiship" as const
export const APISHIP_FULFILLMENT_PROVIDER_CODE = "apiship" as const
export const APISHIP_PICKUP_POINT_DELIVERY_MODE = "pickup_point" as const
export const APISHIP_COURIER_DELIVERY_MODE = "courier" as const

export const APISHIP_CHECKOUT_READINESS_ERROR_CODE =
  "apiship_checkout_not_ready" as const

export type ApishipCheckoutReadinessIssueCode =
  | "shipping_method_missing"
  | "shipping_method_not_apiship"
  | "apiship_data_missing"
  | "tariff_missing"
  | "tariff_id_missing"
  | "provider_key_missing"
  | "delivery_cost_missing"
  | "pickup_point_missing"
  | "pickup_point_id_missing"
  | "context_mismatch"

export type ApishipDeliveryMode =
  | typeof APISHIP_PICKUP_POINT_DELIVERY_MODE
  | typeof APISHIP_COURIER_DELIVERY_MODE

export type ApishipCheckoutReadinessIssue = {
  code: ApishipCheckoutReadinessIssueCode
  message: string
  field: string | null
}

export type ApishipCheckoutReadinessResult = {
  ready: boolean
  issues: ApishipCheckoutReadinessIssue[]
  contextKey: string | null
}

type ApishipCartLike = {
  id?: string | null
  currency_code?: string | null
  subtotal?: number | string | null
  shipping_address?: {
    country_code?: string | null
    city?: string | null
    postal_code?: string | null
    address_1?: string | null
  } | null
  shipping_methods?: unknown[] | null
}

type PaymentCollectionCartLink = {
  cart_id?: string | null
}

export function getApishipCheckoutAddressRequestKey(cart: ApishipCartLike) {
  const address = cart.shipping_address

  if (!address?.country_code || !address.city) {
    return null
  }

  return [
    address.country_code.toUpperCase(),
    address.city,
    address.postal_code,
    address.address_1,
  ]
    .filter(Boolean)
    .join("|")
}

export function getApishipCheckoutContextKey(
  cart: ApishipCartLike,
  shippingOptionId?: string | null
) {
  return [
    cart.id ?? "missing_cart",
    cart.currency_code ?? "missing_currency",
    String(cart.subtotal ?? ""),
    getApishipCheckoutAddressRequestKey(cart) ?? "missing_address",
    shippingOptionId ?? "missing_apiship_option",
  ].join("|")
}

export function buildApishipCheckoutReadiness(
  cart?: ApishipCartLike | null
): ApishipCheckoutReadinessResult {
  const method = cart?.shipping_methods?.at(-1)
  const issues: ApishipCheckoutReadinessIssue[] = []

  if (!method) {
    issues.push({
      code: "shipping_method_missing",
      message: "ApiShip shipping method is required before payment.",
      field: "shipping_methods",
    })

    return {
      ready: false,
      issues,
      contextKey: null,
    }
  }

  if (!isApishipShippingMethodLike(method)) {
    issues.push({
      code: "shipping_method_not_apiship",
      message: "Selected shipping method is not an ApiShip method.",
      field: "shipping_methods",
    })
  }

  const deliveryMode = getApishipDeliveryModeFromShippingMethod(method)

  const apishipData = getApishipDataFromShippingMethod(method)

  if (!apishipData) {
    issues.push({
      code: "apiship_data_missing",
      message: "Selected ApiShip shipping method is missing apishipData.",
      field: "shipping_methods.data.apishipData",
    })
  }

  const tariff = asRecord(apishipData?.tariff)

  if (!tariff) {
    issues.push({
      code: "tariff_missing",
      message: "ApiShip tariff is required before payment.",
      field: "shipping_methods.data.apishipData.tariff",
    })
  } else {
    if (!toNonEmptyString(tariff.tariffId)) {
      issues.push({
        code: "tariff_id_missing",
        message: "ApiShip tariffId is required before payment.",
        field: "shipping_methods.data.apishipData.tariff.tariffId",
      })
    }

    if (!toNonEmptyString(tariff.providerKey)) {
      issues.push({
        code: "provider_key_missing",
        message: "ApiShip providerKey is required before payment.",
        field: "shipping_methods.data.apishipData.tariff.providerKey",
      })
    }

    if (toFiniteNumber(tariff.deliveryCost) === null) {
      issues.push({
        code: "delivery_cost_missing",
        message: "ApiShip numeric deliveryCost is required before payment.",
        field: "shipping_methods.data.apishipData.tariff.deliveryCost",
      })
    }
  }

  const point = asRecord(apishipData?.point)

  if (deliveryMode === APISHIP_PICKUP_POINT_DELIVERY_MODE) {
    if (!point) {
      issues.push({
        code: "pickup_point_missing",
        message: "ApiShip pickup point is required before payment.",
        field: "shipping_methods.data.apishipData.point",
      })
    } else if (!toNonEmptyString(point.id)) {
      issues.push({
        code: "pickup_point_id_missing",
        message: "ApiShip pickup point id is required before payment.",
        field: "shipping_methods.data.apishipData.point.id",
      })
    }
  }

  const shippingOptionId = getShippingMethodOptionId(method)
  const contextKey = cart
    ? getApishipCheckoutContextKey(cart, shippingOptionId)
    : null
  const persistedContextKey = toNonEmptyString(apishipData?.contextKey)

  if (
    persistedContextKey &&
    (!contextKey || persistedContextKey !== contextKey)
  ) {
    issues.push({
      code: "context_mismatch",
      message: "ApiShip delivery selection no longer matches the current cart or address context.",
      field: "shipping_methods.data.apishipData.contextKey",
    })
  }

  return {
    ready: issues.length === 0,
    issues,
    contextKey,
  }
}

export function assertApishipCheckoutReady(cart?: ApishipCartLike | null) {
  const readiness = buildApishipCheckoutReadiness(cart)

  if (readiness.ready) {
    return readiness
  }

  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `ApiShip delivery selection is required before payment (${readiness.issues
      .map((issue) => issue.code)
      .join(", ")}).`
  )
}

export async function enforceApishipCheckoutReadinessForPaymentSession(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const paymentCollectionId = req.params.id
  const cartId = await getCartIdForPaymentCollection(req, paymentCollectionId)
  const cart = await getApishipReadinessCart(req, cartId)

  assertApishipCheckoutReady(cart)
  next()
}

export async function enforceApishipCheckoutReadinessForCartCompletion(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const cart = await getApishipReadinessCart(req, req.params.id)

  assertApishipCheckoutReady(cart)
  next()
}

async function getCartIdForPaymentCollection(
  req: MedusaRequest,
  paymentCollectionId?: string
) {
  const normalizedPaymentCollectionId = toNonEmptyString(paymentCollectionId)

  if (!normalizedPaymentCollectionId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Payment collection id is required for ApiShip checkout readiness."
    )
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart_payment_collection",
    fields: ["cart_id"],
    filters: {
      payment_collection_id: normalizedPaymentCollectionId,
    },
  })
  const link = data[0] as PaymentCollectionCartLink | undefined
  const cartId = toNonEmptyString(link?.cart_id)

  if (!cartId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Payment collection is not linked to a cart for ApiShip checkout readiness."
    )
  }

  return cartId
}

export async function getApishipReadinessCart(
  req: MedusaRequest,
  cartId?: string
) {
  const normalizedCartId = toNonEmptyString(cartId)

  if (!normalizedCartId) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Cart id is required for ApiShip checkout readiness."
    )
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "currency_code",
      "subtotal",
      "shipping_address.country_code",
      "shipping_address.city",
      "shipping_address.postal_code",
      "shipping_address.address_1",
      "shipping_methods.id",
      "shipping_methods.shipping_option_id",
      "shipping_methods.provider_id",
      "shipping_methods.data",
      "shipping_methods.shipping_option.id",
      "shipping_methods.shipping_option.provider_id",
      "shipping_methods.shipping_option.data",
    ],
    filters: {
      id: normalizedCartId,
    },
  })
  const cart = data[0] as ApishipCartLike | undefined

  if (!cart) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Cart with id '${normalizedCartId}' was not found for ApiShip checkout readiness.`
    )
  }

  return cart
}

function getApishipDeliveryModeFromShippingMethod(
  method?: unknown
): ApishipDeliveryMode {
  if (!isRecord(method)) {
    return APISHIP_PICKUP_POINT_DELIVERY_MODE
  }

  const methodData = asRecord(method.data)
  const shippingOption = asRecord(method.shipping_option)
  const shippingOptionData = asRecord(shippingOption?.data)
  const apishipData = getApishipDataFromShippingMethod(method)
  const providerDataId = getShippingMethodProviderDataId(method)
  const deliveryType = shippingOptionData?.deliveryType ?? methodData?.deliveryType

  if (
    apishipData?.mode === APISHIP_COURIER_DELIVERY_MODE ||
    providerDataId === APISHIP_COURIER_SHIPPING_OPTION_PROVIDER_DATA_ID ||
    deliveryType === 1
  ) {
    return APISHIP_COURIER_DELIVERY_MODE
  }

  return APISHIP_PICKUP_POINT_DELIVERY_MODE
}

function isApishipShippingMethodLike(method?: unknown) {
  if (!isRecord(method)) {
    return false
  }

  const methodData = asRecord(method.data)
  const shippingOption = asRecord(method.shipping_option)
  const shippingOptionData = asRecord(shippingOption?.data)
  const providerDataId = getShippingMethodProviderDataId(method)

  return Boolean(
    method.provider_id === APISHIP_PICKUP_POINT_PROVIDER_ID ||
      shippingOption?.provider_id === APISHIP_PICKUP_POINT_PROVIDER_ID ||
      methodData?.provider_id === APISHIP_PICKUP_POINT_PROVIDER_ID ||
      providerDataId === APISHIP_PICKUP_POINT_SHIPPING_OPTION_PROVIDER_DATA_ID ||
      providerDataId === APISHIP_COURIER_SHIPPING_OPTION_PROVIDER_DATA_ID ||
      methodData?.provider_code === APISHIP_FULFILLMENT_PROVIDER_CODE ||
      shippingOptionData?.provider_code === APISHIP_FULFILLMENT_PROVIDER_CODE
  )
}

function getApishipDataFromShippingMethod(method?: unknown) {
  if (!isRecord(method)) {
    return null
  }

  const methodData = asRecord(method.data)
  const apishipData = asRecord(methodData?.apishipData)

  return apishipData
}

function getShippingMethodProviderDataId(method?: unknown) {
  if (!isRecord(method)) {
    return null
  }

  const methodData = asRecord(method.data)
  const shippingOption = asRecord(method.shipping_option)
  const shippingOptionData = asRecord(shippingOption?.data)

  return (
    methodData?.id ??
    methodData?.provider_data_id ??
    methodData?.providerDataId ??
    methodData?.code ??
    shippingOptionData?.id ??
    shippingOptionData?.provider_data_id ??
    shippingOptionData?.providerDataId ??
    shippingOptionData?.code ??
    null
  )
}

function getShippingMethodOptionId(method?: unknown) {
  if (!isRecord(method)) {
    return null
  }

  const shippingOption = asRecord(method.shipping_option)

  return (
    toNonEmptyString(method.shipping_option_id) ??
    toNonEmptyString(shippingOption?.id)
  )
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function toNonEmptyString(value: unknown) {
  if (value === undefined || value === null) {
    return null
  }

  const normalized = String(value).trim()

  return normalized.length > 0 ? normalized : null
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value)

    return Number.isFinite(numericValue) ? numericValue : null
  }

  return null
}
