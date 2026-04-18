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
}

type ApiShipTariffGroup = {
  providerKey?: string
  tariffs?: ApiShipTariff[]
}

type ApiShipCalculatorResponse = {
  deliveryToDoor?: ApiShipTariffGroup[]
  deliveryToPoint?: ApiShipTariffGroup[]
}

type ApiShipErrorDetails = {
  status: number
  statusText: string
  code?: string
  message?: string
  description?: string
  hint?: string
  rawBody?: string
  contentType?: string
  bodyKeys?: string[]
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
    return [
      {
        id: APISHIP_COURIER_OPTION_ID,
        name: "ApiShip courier to address",
        deliveryType: 1,
        pickupType: 1,
      },
    ]
  }

  async validateOption(data: Record<string, unknown>): Promise<boolean> {
    return getNumber(data.deliveryType) === 1 && getNumber(data.pickupType) === 1
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
    const calculatorRequest = buildCalculatorRequest(optionData, context)

    this.logger_.info(
      `ApiShip calculator request summary: ${JSON.stringify(
        summarizeCalculatorRequest(calculatorRequest)
      )}`
    )

    this.logger_.debug(
      `ApiShip calculator full request body: ${JSON.stringify(calculatorRequest)}`
    )

    const response = await this.request<ApiShipCalculatorResponse>(
      "/calculator",
      calculatorRequest
    )

    this.logger_.info(
      `ApiShip calculator response summary: ${JSON.stringify(
        summarizeCalculatorResponse(response)
      )}`
    )

    const cheapestTariff = pickCheapestTariff(
      response,
      getNumber(optionData.deliveryType) || 1
    )
    const deliveryCost = cheapestTariff?.deliveryCost

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
        deliveryCost: cheapestTariff!.deliveryCost,
        providerKey: cheapestTariff!.providerKey,
        tariffId: cheapestTariff!.tariffId,
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
      "ApiShip fulfillment automation is intentionally out of scope for the first shipping slice."
    )
  }

  async cancelFulfillment(): Promise<Record<string, never>> {
    return {}
  }

  async getFulfillmentDocuments(): Promise<never[]> {
    return []
  }

  async createReturnFulfillment(
    _: Record<string, unknown>
  ): Promise<CreateFulfillmentResult> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "ApiShip return fulfillment automation is intentionally out of scope for the first shipping slice."
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

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    if (!isApiShipConfigured(this.options_)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "ApiShip shipping is not configured. Set APISHIP_TOKEN to enable the opt-in rate slice."
      )
    }

    const url = `${getApiShipBaseUrl(this.options_)}${path}`
    let response: Response

    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: this.options_.token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown fetch failure"

      this.logger_.warn(
        `ApiShip request transport failure: ${JSON.stringify({
          path,
          mode: this.options_.isTest ? "test" : "live",
          message,
        })}`
      )

      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `ApiShip tariff calculation failed before a response was received. ${message}`
      )
    }

    if (!response.ok) {
      const errorDetails = await parseApiShipErrorResponse(response)

      this.logger_.warn(
        `ApiShip request failed: ${JSON.stringify({
          path,
          mode: this.options_.isTest ? "test" : "live",
          ...errorDetails,
        })}`
      )

      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        formatApiShipErrorMessage(errorDetails)
      )
    }

    return (await response.json()) as T
  }
}

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [ApiShipFulfillmentProvider],
})

function buildCalculatorRequest(
  optionData: CalculateShippingOptionPriceDTO["optionData"],
  context: CalculateShippingOptionPriceDTO["context"]
) {
  const shippingAddress = context.shipping_address
  const stockLocationAddress = context.from_location?.address

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

  const items = context.items ?? []

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
      const weight = getNumber(item.variant?.weight) || DEFAULT_PACKAGE_WEIGHT
      const height = getNumber(item.variant?.height) || DEFAULT_PACKAGE_DIMENSION
      const length = getNumber(item.variant?.length) || DEFAULT_PACKAGE_DIMENSION
      const width = getNumber(item.variant?.width) || DEFAULT_PACKAGE_DIMENSION

      return Array.from({ length: quantity }, () => ({
        height,
        length,
        width,
        weight,
      }))
    }),
    pickupTypes: [getNumber(optionData.pickupType) || 1],
    deliveryTypes: [getNumber(optionData.deliveryType) || 1],
    assessedCost: items.reduce((sum, item) => {
      return sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 0)
    }, 0),
    codCost: 0,
    includeFees: false,
  }
}

function pickCheapestTariff(
  response: ApiShipCalculatorResponse,
  deliveryType: number
) {
  const groups =
    deliveryType === 1 ? response.deliveryToDoor ?? [] : response.deliveryToPoint ?? []

  return groups
    .flatMap((group) => {
      return (group.tariffs ?? []).map((tariff) => ({
        ...tariff,
        providerKey: tariff.providerKey ?? group.providerKey,
      }))
    })
    .reduce<ApiShipTariff | null>((cheapest, current) => {
      if (
        typeof current.deliveryCost !== "number" ||
        !Number.isFinite(current.deliveryCost)
      ) {
        return cheapest
      }

      if (!cheapest || current.deliveryCost < (cheapest.deliveryCost ?? Number.POSITIVE_INFINITY)) {
        return current
      }

      return cheapest
    }, null)
}

function getApiShipBaseUrl(options: ApiShipProviderOptions) {
  return options.isTest ? APISHIP_TEST_BASE_URL : APISHIP_LIVE_BASE_URL
}

function compactAddress(parts: Array<string | null | undefined>) {
  const value = parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ")

  return value || undefined
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function summarizeCalculatorRequest(request: ReturnType<typeof buildCalculatorRequest>) {
  return {
    from: {
      countryCode: request.from.countryCode,
      city: request.from.city,
      index: request.from.index,
      region: request.from.region,
    },
    to: {
      countryCode: request.to.countryCode,
      city: request.to.city,
      index: request.to.index,
      region: request.to.region,
    },
    placesCount: request.places.length,
    totalWeight: request.places.reduce((sum, place) => sum + (place.weight || 0), 0),
    pickupTypes: request.pickupTypes,
    deliveryTypes: request.deliveryTypes,
    assessedCost: request.assessedCost,
    codCost: request.codCost,
    includeFees: request.includeFees,
  }
}

function summarizeCalculatorResponse(response: ApiShipCalculatorResponse) {
  const deliveryToDoor = response.deliveryToDoor ?? []
  const deliveryToPoint = response.deliveryToPoint ?? []

  return {
    deliveryToDoorProviders: deliveryToDoor.length,
    deliveryToDoorTariffs: countTariffs(deliveryToDoor),
    deliveryToPointProviders: deliveryToPoint.length,
    deliveryToPointTariffs: countTariffs(deliveryToPoint),
    cheapestDoorCost: pickCheapestTariff(response, 1)?.deliveryCost ?? null,
    cheapestPointCost: pickCheapestTariff(response, 2)?.deliveryCost ?? null,
  }
}

function countTariffs(groups: ApiShipTariffGroup[]) {
  return groups.reduce((sum, group) => sum + (group.tariffs?.length ?? 0), 0)
}

function parseApiShipTestMode(value: string | undefined) {
  if (typeof value !== "string" || !value.trim()) {
    return true
  }

  const normalized = value.trim().toLowerCase()

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false
  }

  return true
}

async function parseApiShipErrorResponse(response: Response): Promise<ApiShipErrorDetails> {
  const contentType = response.headers.get("content-type") || undefined
  const rawBody = truncateForLogs(await response.text())
  const parsedBody = tryParseJson(rawBody)
  const body = isRecord(parsedBody) ? parsedBody : undefined
  const nestedError = isRecord(body?.error) ? body.error : undefined
  const primarySource = nestedError ?? body
  const message =
    getErrorString(primarySource?.message) ||
    getErrorString(body?.message) ||
    getErrorString(body?.error) ||
    response.statusText ||
    undefined
  const description =
    getErrorString(primarySource?.description) ||
    getErrorString(body?.description) ||
    getErrorString(primarySource?.details) ||
    getErrorString(body?.details)
  const code =
    getErrorString(primarySource?.code) ||
    getErrorString(body?.code) ||
    getErrorString(body?.statusCode) ||
    getErrorString(body?.errorCode)

  return {
    status: response.status,
    statusText: response.statusText,
    code,
    message,
    description,
    hint: getApiShipErrorHint(response.status, message, description),
    rawBody:
      message || description || code || body
        ? undefined
        : rawBody || undefined,
    contentType,
    bodyKeys: body ? Object.keys(body).slice(0, 10) : undefined,
  }
}

function formatApiShipErrorMessage(error: ApiShipErrorDetails) {
  const parts = [`ApiShip tariff calculation failed (HTTP ${error.status})`]

  if (error.code) {
    parts.push(`code: ${error.code}`)
  }

  if (error.message) {
    parts.push(error.message)
  }

  if (error.description && error.description !== error.message) {
    parts.push(error.description)
  }

  if (error.hint) {
    parts.push(error.hint)
  }

  return parts.join(". ")
}

function getApiShipErrorHint(
  status: number,
  message?: string,
  description?: string
) {
  const combined = `${message || ""} ${description || ""}`.toLowerCase()

  if (
    status === 401 ||
    combined.includes("token") ||
    combined.includes("auth") ||
    combined.includes("unauthorized")
  ) {
    return "Check ApiShip token validity and account access configuration."
  }

  if (
    status === 402 ||
    combined.includes("billing") ||
    combined.includes("balance") ||
    combined.includes("payment required")
  ) {
    return "Check ApiShip billing and account balance state."
  }

  if (
    status === 403 ||
    combined.includes("contract") ||
    combined.includes("connection") ||
    combined.includes("provider") ||
    combined.includes("not available")
  ) {
    return "Check ApiShip carrier connections, contracts, and cabinet configuration for the requested route."
  }

  if (status === 422 || combined.includes("validation") || combined.includes("address")) {
    return "Check shipping address, stock location data, and ApiShip request payload mapping."
  }

  return "Check ApiShip account state, billing, carrier connections/contracts, and request configuration."
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
