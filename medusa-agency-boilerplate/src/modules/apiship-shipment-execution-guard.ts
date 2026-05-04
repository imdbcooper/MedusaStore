import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"

export const APISHIP_SHIPMENT_EXECUTION_ENV =
  "APISHIP_SHIPMENT_EXECUTION_ENABLED" as const
export const APISHIP_SHIPMENT_EXECUTION_ERROR_CODE =
  "apiship_shipment_execution_disabled" as const
export const APISHIP_FULFILLMENT_PROVIDER_CODE = "apiship" as const
export const APISHIP_FULFILLMENT_PROVIDER_ID = "apiship_apiship" as const

export type ApishipShipmentExecutionOperation =
  | "create_fulfillment"
  | "cancel_fulfillment"

type ApishipShipmentExecutionEnv = Partial<
  Pick<NodeJS.ProcessEnv, typeof APISHIP_SHIPMENT_EXECUTION_ENV>
>

export function isApishipShipmentExecutionEnabled(
  env: ApishipShipmentExecutionEnv = process.env
) {
  return env[APISHIP_SHIPMENT_EXECUTION_ENV]?.trim() === "true"
}

export function isApishipFulfillmentProviderId(providerId?: unknown) {
  if (typeof providerId !== "string") {
    return false
  }

  const normalized = providerId.trim()

  return (
    normalized === APISHIP_FULFILLMENT_PROVIDER_ID ||
    normalized === APISHIP_FULFILLMENT_PROVIDER_CODE
  )
}

export function assertApishipShipmentExecutionAllowed(input: {
  provider_id?: unknown
  operation: ApishipShipmentExecutionOperation
  env?: ApishipShipmentExecutionEnv
}) {
  if (!isApishipFulfillmentProviderId(input.provider_id)) {
    return
  }

  if (isApishipShipmentExecutionEnabled(input.env)) {
    return
  }

  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `ApiShip shipment execution is disabled by default (${APISHIP_SHIPMENT_EXECUTION_ENV}=true is required for ${input.operation}). Checkout shipping-method commit is still allowed; live ApiShip fulfillment creation, cancellation, tracking and documents remain blocked until explicit opt-in.`
  )
}

export async function enforceApishipDirectFulfillmentCreateExecutionGuard(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const body = getRequestBody(req)

  assertApishipShipmentExecutionAllowed({
    provider_id: body.provider_id,
    operation: "create_fulfillment",
  })

  next()
}

export async function enforceApishipOrderFulfillmentCreateExecutionGuard(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const providerId = await getOrderFulfillmentCreateProviderId(req)

  assertApishipShipmentExecutionAllowed({
    provider_id: providerId,
    operation: "create_fulfillment",
  })

  next()
}

export async function enforceApishipDirectFulfillmentCancelExecutionGuard(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const providerId = await getFulfillmentProviderId(req, req.params.id)

  assertApishipShipmentExecutionAllowed({
    provider_id: providerId,
    operation: "cancel_fulfillment",
  })

  next()
}

export async function enforceApishipOrderFulfillmentCancelExecutionGuard(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  const providerId = await getFulfillmentProviderId(req, req.params.fulfillment_id)

  assertApishipShipmentExecutionAllowed({
    provider_id: providerId,
    operation: "cancel_fulfillment",
  })

  next()
}

async function getOrderFulfillmentCreateProviderId(req: MedusaRequest) {
  const body = getRequestBody(req)
  const shippingOptionId =
    toNonEmptyString(body.shipping_option_id) ??
    (await getFirstOrderShippingOptionId(req, req.params.id))

  if (!shippingOptionId) {
    return null
  }

  const fulfillmentModuleService = req.scope.resolve(Modules.FULFILLMENT)
  const shippingOption = await fulfillmentModuleService.retrieveShippingOption(
    shippingOptionId
  )

  return shippingOption?.provider_id ?? null
}

async function getFirstOrderShippingOptionId(
  req: MedusaRequest,
  orderId?: string
) {
  const normalizedOrderId = toNonEmptyString(orderId)

  if (!normalizedOrderId) {
    return null
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "shipping_methods.shipping_option_id"],
    filters: {
      id: normalizedOrderId,
    },
  })
  const order = data[0] as
    | { shipping_methods?: { shipping_option_id?: string | null }[] | null }
    | undefined

  return toNonEmptyString(order?.shipping_methods?.[0]?.shipping_option_id)
}

async function getFulfillmentProviderId(
  req: MedusaRequest,
  fulfillmentId?: string
) {
  const normalizedFulfillmentId = toNonEmptyString(fulfillmentId)

  if (!normalizedFulfillmentId) {
    return null
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "fulfillment",
    fields: ["id", "provider_id"],
    filters: {
      id: normalizedFulfillmentId,
    },
  })
  const fulfillment = data[0] as { provider_id?: string | null } | undefined

  return fulfillment?.provider_id ?? null
}

function getRequestBody(req: MedusaRequest) {
  const request = req as MedusaRequest & {
    validatedBody?: Record<string, unknown>
    body?: Record<string, unknown>
  }

  return request.validatedBody ?? request.body ?? {}
}

function toNonEmptyString(value: unknown) {
  if (value === undefined || value === null) {
    return null
  }

  const normalized = String(value).trim()

  return normalized.length > 0 ? normalized : null
}
