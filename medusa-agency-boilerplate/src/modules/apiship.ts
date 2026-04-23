import type {
  CalculateShippingOptionPriceDTO,
  CreateFulfillmentResult,
  FulfillmentOption,
  FulfillmentOrderDTO,
  FulfillmentDTO,
  FulfillmentItemDTO,
  Logger,
} from "@medusajs/framework/types"
import {
  AbstractFulfillmentProviderService,
  MedusaError,
  ModuleProvider,
  Modules,
} from "@medusajs/framework/utils"

const APISHIP_LIVE_BASE_URL = "https://api.apiship.ru/v1"
const APISHIP_TEST_BASE_URL = "http://api.dev.apiship.ru/v1"
const DEFAULT_PACKAGE_DIMENSION = 10
const DEFAULT_PACKAGE_WEIGHT = 20

export const APISHIP_PROVIDER_ID = "apiship_apiship"
export const APISHIP_COURIER_OPTION_ID = "apiship_courier_to_address"

const LEGACY_APISHIP_FULFILLMENT_OPTIONS: FulfillmentOption[] = [
  {
    id: APISHIP_COURIER_OPTION_ID,
    name: "ApiShip courier to address",
    deliveryType: 1,
    pickupType: 1,
  },
]

export type ApiShipProviderOptions = {
  token: string
  isTest?: boolean
}

type InjectedDependencies = {
  logger: Logger
}

type ApiShipTariff = {
  deliveryCost?: number
  providerKey?: string
  tariffId?: number
  pickupTypes?: number[]
  deliveryTypes?: number[]
  pointIds?: number[]
}

type ApiShipTariffGroup = {
  providerKey?: string
  tariffs?: ApiShipTariff[]
}

type ApiShipCalculatorResponse = {
  deliveryToDoor?: ApiShipTariffGroup[]
  deliveryToPoint?: ApiShipTariffGroup[]
}

export type ApiShipSelectionData = {
  provider_key: string
  tariff_id: number
  pickup_type?: number
  delivery_type?: number
  mode_key?: string
  point_out_id?: number
  provider_name?: string
  tariff_name?: string
  quote_key?: string
  estimated_days_min?: number
  estimated_days_max?: number
  selection_mode?: string
  point_label?: string
  point_address?: string
}

type ApiShipErrorDetails = {
  status: number
  statusText: string
  code?: string
  message?: string
  description?: string
  hint?: string
  rawBody?: string
}

type ApiShipRequestInput = {
  path: string
  method?: "GET" | "POST"
  options?: ApiShipProviderOptions
  body?: Record<string, unknown>
  query?: Record<string, string | number | boolean | null | undefined>
  logger?: Pick<Logger, "warn" | "debug"> | null
}

export function getApiShipProviderOptionsFromEnv(): ApiShipProviderOptions {
  return {
    token: process.env.APISHIP_TOKEN?.trim() || "",
    isTest: parseApiShipTestMode(process.env.APISHIP_TEST_MODE),
  }
}

export function isApiShipConfigured(
  options: ApiShipProviderOptions = getApiShipProviderOptionsFromEnv()
) {
  return !!options.token
}

export function getApiShipBaseUrl(options: ApiShipProviderOptions) {
  return options.isTest ? APISHIP_TEST_BASE_URL : APISHIP_LIVE_BASE_URL
}

export async function requestApiShip<T>(input: ApiShipRequestInput): Promise<T> {
  const options = input.options ?? getApiShipProviderOptionsFromEnv()

  if (!isApiShipConfigured(options)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "ApiShip shipping is not configured. Set APISHIP_TOKEN to enable ApiShip backend flows."
    )
  }

  const url = new URL(`${getApiShipBaseUrl(options)}${input.path}`)

  Object.entries(input.query || {}).forEach(([key, value]) => {
    if (value === null || typeof value === "undefined") {
      return
    }

    url.searchParams.set(key, String(value))
  })

  let response: Response

  try {
    response = await fetch(url.toString(), {
      method: input.method || "POST",
      headers: {
        Accept: "application/json",
        Authorization: options.token,
        ...(input.method === "GET" ? {} : { "Content-Type": "application/json" }),
      },
      ...(input.method === "GET" ? {} : { body: JSON.stringify(input.body || {}) }),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fetch failure"

    input.logger?.warn?.(
      `ApiShip request transport failure: ${JSON.stringify({
        path: input.path,
        method: input.method || "POST",
        mode: options.isTest ? "test" : "live",
        message,
      })}`
    )

    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `ApiShip request failed before a response was received. ${message}`
    )
  }

  if (!response.ok) {
    const errorDetails = await parseApiShipErrorResponse(response)

    input.logger?.warn?.(
      `ApiShip request failed: ${JSON.stringify({
        path: input.path,
        method: input.method || "POST",
        mode: options.isTest ? "test" : "live",
        ...errorDetails,
      })}`
    )

    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      formatApiShipErrorMessage(errorDetails)
    )
  }

  if (response.status === 204) {
    return {} as T
  }

  return (await response.json()) as T
}

class ApiShipFulfillmentProvider extends AbstractFulfillmentProviderService {
  static identifier = "apiship"

  protected readonly logger_: Logger
  protected readonly options_: ApiShipProviderOptions

  constructor({ logger }: InjectedDependencies, options: ApiShipProviderOptions) {
    super()

    this.logger_ = logger
    this.options_ = options
  }

  static validateOptions(options: Record<string, unknown>) {
    const token = getString(options.token)

    if (!token) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "ApiShip fulfillment provider requires APISHIP_TOKEN."
      )
    }
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return LEGACY_APISHIP_FULFILLMENT_OPTIONS
  }

  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    return getFiniteInteger(data.deliveryType) === 1 && getFiniteInteger(data.pickupType) === 1
  }

  async validateFulfillmentData(
    _: Record<string, unknown>,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return data ?? {}
  }

  async canCalculate(): Promise<boolean> {
    return true
  }

  async calculatePrice(
    optionData: CalculateShippingOptionPriceDTO["optionData"],
    _: CalculateShippingOptionPriceDTO["data"],
    context: CalculateShippingOptionPriceDTO["context"]
  ) {
    const deliveryType = 1
    const calculatorRequest = buildCalculatorRequest({
      optionData,
      context,
      deliveryType,
      pickupType: 1,
    })

    this.logger_.info(
      `ApiShip calculator request summary: ${JSON.stringify(
        summarizeCalculatorRequest(calculatorRequest)
      )}`
    )
    this.logger_.debug(
      `ApiShip calculator full request body: ${JSON.stringify(calculatorRequest)}`
    )

    const response = await requestApiShip<ApiShipCalculatorResponse>({
      path: "/calculator",
      method: "POST",
      body: calculatorRequest,
      options: this.options_,
      logger: this.logger_,
    })

    this.logger_.info(
      `ApiShip calculator response summary: ${JSON.stringify(
        summarizeCalculatorResponse(response)
      )}`
    )

    const selectedTariff = pickCheapestTariff(response, deliveryType)
    const deliveryCost = selectedTariff?.deliveryCost

    if (typeof deliveryCost !== "number" || !Number.isFinite(deliveryCost)) {
      this.logger_.warn(
        `ApiShip returned no usable courier tariff. ${JSON.stringify(
          summarizeCalculatorResponse(response)
        )}`
      )
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "ApiShip returned no courier-to-address tariff for the current cart and address. Check that the ApiShip account has active delivery connections/contracts and that the route is supported."
      )
    }

    this.logger_.info(
      `ApiShip selected cheapest tariff: ${JSON.stringify({
        deliveryCost,
        providerKey: selectedTariff?.providerKey,
        tariffId: selectedTariff?.tariffId,
      })}`
    )

    return {
      calculated_amount: deliveryCost,
      is_calculated_price_tax_inclusive: true,
      data: response,
    }
  }

  async createFulfillment(
    _: Record<string, unknown>,
    __: Partial<Omit<FulfillmentItemDTO, "fulfillment">>[],
    ___: Partial<FulfillmentOrderDTO> | undefined,
    ____: Partial<Omit<FulfillmentDTO, "provider_id" | "data" | "items">>
  ): Promise<CreateFulfillmentResult> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "ApiShip fulfillment automation is intentionally out of scope for the current shipping slice."
    )
  }

  async cancelFulfillment(): Promise<Record<string, never>> {
    return {}
  }

  async getFulfillmentDocuments(): Promise<never[]> {
    return []
  }

  async createReturnFulfillment(_: Record<string, unknown>): Promise<CreateFulfillmentResult> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "ApiShip return fulfillment automation is intentionally out of scope for the current shipping slice."
    )
  }

  async getReturnDocuments(): Promise<never[]> {
    return []
  }

  async getShipmentDocuments(): Promise<never[]> {
    return []
  }

  async retrieveDocuments(): Promise<void> {
    return
  }
}

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [ApiShipFulfillmentProvider],
})

export function normalizeApiShipSelectionData(data?: Record<string, unknown>) {
  if (!data) {
    return {}
  }

  const providerKey = getString(data.provider_key)
  const tariffId = getFiniteInteger(data.tariff_id)
  const pickupType = getFiniteInteger(data.pickup_type)
  const deliveryType = getFiniteInteger(data.delivery_type)
  const pointOutId = getFiniteInteger(data.point_out_id)
  const normalized: Record<string, unknown> = {}
  const hasSelectionIdentity =
    Object.prototype.hasOwnProperty.call(data, "provider_key") ||
    Object.prototype.hasOwnProperty.call(data, "tariff_id")

  if (hasSelectionIdentity && (!providerKey || tariffId === null)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "ApiShip shipping selection must include both provider_key and tariff_id."
    )
  }

  if (providerKey && tariffId !== null) {
    normalized.provider_key = providerKey
    normalized.tariff_id = tariffId
  }

  if (pickupType !== null) {
    normalized.pickup_type = pickupType
  }

  if (deliveryType !== null) {
    normalized.delivery_type = deliveryType
  }

  if ((pickupType !== null || deliveryType !== null) && (pickupType === null || deliveryType === null)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "ApiShip shipping selection must include both pickup_type and delivery_type when one of them is provided."
    )
  }

  if (deliveryType === 2 && hasSelectionIdentity && pointOutId === null) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "ApiShip pickup-point selection must include point_out_id before the shipping method can be confirmed."
    )
  }

  if (pointOutId !== null) {
    normalized.point_out_id = pointOutId
  }

  copyStringField(normalized, data, "provider_name")
  copyStringField(normalized, data, "tariff_name")
  copyStringField(normalized, data, "quote_key")
  copyStringField(normalized, data, "selection_mode")
  copyStringField(normalized, data, "mode_key")
  copyStringField(normalized, data, "point_label")
  copyStringField(normalized, data, "point_address")
  copyIntegerField(normalized, data, "estimated_days_min")
  copyIntegerField(normalized, data, "estimated_days_max")

  return normalized
}

export function parseApiShipSelectionData(
  data?: Record<string, unknown>
): ApiShipSelectionData | null {
  const normalized = normalizeApiShipSelectionData(data)
  const providerKey = getString(normalized.provider_key)
  const tariffId = getFiniteInteger(normalized.tariff_id)

  if (!providerKey || tariffId === null) {
    return null
  }

  return {
    provider_key: providerKey,
    tariff_id: tariffId,
    pickup_type: getFiniteInteger(normalized.pickup_type) ?? undefined,
    delivery_type: getFiniteInteger(normalized.delivery_type) ?? undefined,
    point_out_id: getFiniteInteger(normalized.point_out_id) ?? undefined,
    provider_name: getString(normalized.provider_name) || undefined,
    tariff_name: getString(normalized.tariff_name) || undefined,
    quote_key: getString(normalized.quote_key) || undefined,
    estimated_days_min: getFiniteInteger(normalized.estimated_days_min) ?? undefined,
    estimated_days_max: getFiniteInteger(normalized.estimated_days_max) ?? undefined,
    selection_mode: getString(normalized.selection_mode) || undefined,
    mode_key: getString(normalized.mode_key) || undefined,
    point_label: getString(normalized.point_label) || undefined,
    point_address: getString(normalized.point_address) || undefined,
  }
}

export function formatApiShipProviderLabel(
  providerKey: string,
  providerName?: string | null
) {
  const normalizedProviderName = providerName?.trim()

  if (normalizedProviderName) {
    return normalizedProviderName
  }

  const normalizedKey = providerKey.trim().toLowerCase()

  if (normalizedKey === "yataxi" || normalizedKey.includes("yandex")) {
    return "Яндекс.Доставка"
  }

  return providerKey.trim() || null
}

function buildCalculatorRequest(input: {
  optionData: CalculateShippingOptionPriceDTO["optionData"]
  context: CalculateShippingOptionPriceDTO["context"]
  deliveryType: number
  pickupType: number
}) {
  const shippingAddress = input.context.shipping_address
  const stockLocationAddress = input.context.from_location?.address
  const items = input.context.items ?? []

  if (!shippingAddress?.country_code || !shippingAddress.city || !shippingAddress.address_1) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Shipping address must include country, city, and street before ApiShip rate calculation."
    )
  }

  if (!stockLocationAddress?.country_code || !stockLocationAddress.city) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Stock location must include country and city before ApiShip rate calculation."
    )
  }

  if (!items.length) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Cart must contain shippable items before ApiShip rate calculation."
    )
  }

  return {
    from: {
      countryCode: stockLocationAddress.country_code.toUpperCase(),
      index: stockLocationAddress.postal_code || undefined,
      region: stockLocationAddress.province || undefined,
      city: stockLocationAddress.city,
      addressString: compactAddress([
        stockLocationAddress.city,
        stockLocationAddress.address_1,
        stockLocationAddress.address_2,
      ]),
    },
    to: {
      countryCode: shippingAddress.country_code.toUpperCase(),
      index: shippingAddress.postal_code || undefined,
      region: shippingAddress.province || undefined,
      city: shippingAddress.city,
      addressString: compactAddress([
        shippingAddress.city,
        shippingAddress.address_1,
        shippingAddress.address_2,
      ]),
    },
    places: items.flatMap((item) => {
      const quantity = Math.max(Number(item.quantity) || 0, 1)
      const weight = getFiniteNumber(item.variant?.weight) ?? DEFAULT_PACKAGE_WEIGHT
      const height = getFiniteNumber(item.variant?.height) ?? DEFAULT_PACKAGE_DIMENSION
      const length = getFiniteNumber(item.variant?.length) ?? DEFAULT_PACKAGE_DIMENSION
      const width = getFiniteNumber(item.variant?.width) ?? DEFAULT_PACKAGE_DIMENSION

      return Array.from({ length: quantity }, () => ({ height, length, width, weight }))
    }),
    pickupTypes: [input.pickupType],
    deliveryTypes: [input.deliveryType],
    assessedCost: items.reduce((sum, item) => {
      return sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 0)
    }, 0),
    codCost: 0,
    includeFees: false,
  }
}

function pickCheapestTariff(response: ApiShipCalculatorResponse, deliveryType: number) {
  return listTariffsForDeliveryType(response, deliveryType).reduce<ApiShipTariff | null>(
    (cheapest, current) => {
      if (typeof current.deliveryCost !== "number" || !Number.isFinite(current.deliveryCost)) {
        return cheapest
      }

      if (!cheapest || current.deliveryCost < (cheapest.deliveryCost ?? Number.POSITIVE_INFINITY)) {
        return current
      }

      return cheapest
    },
    null
  )
}

function pickRequestedTariff(
  response: ApiShipCalculatorResponse,
  selection: Required<Pick<ApiShipSelectionData, "provider_key" | "tariff_id">> & {
    delivery_type: number
    pickup_type: number
    point_out_id?: number
  }
) {
  return (
    listTariffsForDeliveryType(response, selection.delivery_type).find((tariff) => {
      if (tariff.providerKey !== selection.provider_key || tariff.tariffId !== selection.tariff_id) {
        return false
      }

      if (Array.isArray(tariff.pickupTypes) && tariff.pickupTypes.length) {
        if (!tariff.pickupTypes.includes(selection.pickup_type)) {
          return false
        }
      }

      if (
        typeof selection.point_out_id === "number" &&
        Array.isArray(tariff.pointIds) &&
        tariff.pointIds.length &&
        !tariff.pointIds.includes(selection.point_out_id)
      ) {
        return false
      }

      return true
    }) ?? null
  )
}

function listTariffsForDeliveryType(
  response: ApiShipCalculatorResponse,
  deliveryType: number
) {
  const groups = deliveryType === 2 ? response.deliveryToPoint ?? [] : response.deliveryToDoor ?? []

  return groups.flatMap((group) => {
    return (group.tariffs ?? []).map((tariff) => ({
      ...tariff,
      providerKey: tariff.providerKey ?? group.providerKey,
    }))
  })
}

function summarizeCalculatorRequest(request: ReturnType<typeof buildCalculatorRequest>) {
  return {
    from: request.from.city,
    to: request.to.city,
    placesCount: request.places.length,
    pickupTypes: request.pickupTypes,
    deliveryTypes: request.deliveryTypes,
    assessedCost: request.assessedCost,
  }
}

function summarizeCalculatorResponse(response: ApiShipCalculatorResponse) {
  return {
    deliveryToDoorProviders: response.deliveryToDoor?.length ?? 0,
    deliveryToPointProviders: response.deliveryToPoint?.length ?? 0,
    cheapestDoorCost: pickCheapestTariff(response, 1)?.deliveryCost ?? null,
    cheapestPointCost: pickCheapestTariff(response, 2)?.deliveryCost ?? null,
  }
}

function compactAddress(parts: Array<string | null | undefined>) {
  const value = parts.map((part) => part?.trim()).filter(Boolean).join(", ")
  return value || undefined
}

function parseApiShipTestMode(value: string | undefined) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : ""

  if (!normalized) {
    return true
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false
  }

  return true
}

async function parseApiShipErrorResponse(response: Response): Promise<ApiShipErrorDetails> {
  const rawBody = truncateForLogs(await response.text())
  const parsedBody = tryParseJson(rawBody)
  const body = isRecord(parsedBody) ? parsedBody : undefined
  const nestedError = isRecord(body?.error) ? body.error : undefined
  const primarySource = nestedError ?? body

  return {
    status: response.status,
    statusText: response.statusText,
    code: getErrorString(primarySource?.code) || getErrorString(body?.code),
    message:
      getErrorString(primarySource?.message) ||
      getErrorString(body?.message) ||
      getErrorString(body?.error) ||
      response.statusText ||
      undefined,
    description:
      getErrorString(primarySource?.description) ||
      getErrorString(body?.description) ||
      getErrorString(primarySource?.details) ||
      getErrorString(body?.details),
    hint: getApiShipErrorHint(response.status),
    rawBody: rawBody || undefined,
  }
}

function formatApiShipErrorMessage(error: ApiShipErrorDetails) {
  return [
    `ApiShip request failed (HTTP ${error.status})`,
    error.code ? `code: ${error.code}` : null,
    error.message || null,
    error.description && error.description !== error.message ? error.description : null,
    error.hint || null,
  ]
    .filter(Boolean)
    .join(". ")
}

function getApiShipErrorHint(status: number) {
  if (status === 401) {
    return "Check ApiShip token validity and account access configuration."
  }

  if (status === 402) {
    return "Check ApiShip billing and account balance state."
  }

  if (status === 403) {
    return "Check ApiShip carrier connections, contracts, and cabinet configuration."
  }

  if (status === 422) {
    return "Check shipping address, stock location data, and ApiShip request payload mapping."
  }

  return "Check ApiShip account state, billing, carrier connections/contracts, and request configuration."
}

function copyStringField(target: Record<string, unknown>, source: Record<string, unknown>, key: string) {
  const value = getString(source[key])

  if (value) {
    target[key] = value
  }
}

function copyIntegerField(target: Record<string, unknown>, source: Record<string, unknown>, key: string) {
  const value = getFiniteInteger(source[key])

  if (value !== null) {
    target[key] = value
  }
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function getFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function getFiniteInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null
}

function getFiniteIntegerArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((entry) => getFiniteInteger(entry))
        .filter((entry): entry is number => entry !== null)
    : []
}

function truncateForLogs(value: string, limit = 1000) {
  if (!value) {
    return ""
  }

  return value.length > limit ? `${value.slice(0, limit)}…` : value
}

function tryParseJson(value: string) {
  if (!value) {
    return undefined
  }

  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getErrorString(value: unknown) {
  if (typeof value === "string") {
    return value.trim() || undefined
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  return undefined
}
