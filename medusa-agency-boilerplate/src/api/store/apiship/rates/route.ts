import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { APISHIP_PROVIDER_ID } from "../../../../modules/apiship"

type CartShippingAddress = {
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  country_code?: string | null
  province?: string | null
  postal_code?: string | null
}

type ShippingOptionRecord = {
  id: string
  name?: string | null
  provider_id?: string | null
}

type CartRecord = {
  id: string
  currency_code: string
  shipping_address?: CartShippingAddress | null
  shipping_methods?: {
    shipping_option_id?: string | null
  }[]
}

type CalculatedShippingOption = {
  id: string
  amount?: number | null
  calculated_price?: {
    calculated_amount?: number | null
    is_calculated_price_tax_inclusive?: boolean
    data?: Record<string, unknown> | null
  } | null
}

type ApiShipTariff = {
  deliveryCost?: number
  daysMin?: number
  daysMax?: number
  workDaysMin?: number
  workDaysMax?: number
  calendarDaysMin?: number
  calendarDaysMax?: number
  providerKey?: string
  tariffId?: number
  tariffName?: string
  providerName?: string
}

type ApiShipTariffGroup = {
  providerKey?: string
  providerName?: string
  tariffs?: ApiShipTariff[]
}

type ApiShipCalculatedData = {
  deliveryToDoor?: ApiShipTariffGroup[]
}

export const StoreApiShipRatesSchema = z.object({
  cart_id: z.string().trim().min(1),
  shipping_option_id: z.string().trim().min(1),
})

type StoreApiShipRatesRequest = z.infer<typeof StoreApiShipRatesSchema>

export async function GET(
  req: MedusaRequest<StoreApiShipRatesRequest>,
  res: MedusaResponse
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const validatedQuery = req.validatedQuery as StoreApiShipRatesRequest

  const { data: carts } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "currency_code",
      "shipping_address.address_1",
      "shipping_address.address_2",
      "shipping_address.city",
      "shipping_address.country_code",
      "shipping_address.province",
      "shipping_address.postal_code",
      "shipping_methods.shipping_option_id",
    ],
    filters: {
      id: validatedQuery.cart_id,
    },
  })

  const cart = carts?.[0] as CartRecord | undefined

  if (!cart) {
    return res.status(404).json({
      quotes: [],
      code: "cart_not_found",
    })
  }

  if (!hasAddressForApiShip(cart.shipping_address)) {
    return res.status(200).json({
      quotes: [],
      code: "shipping_address_incomplete",
    })
  }

  const { data: shippingOptions } = await query.graph({
    entity: "shipping_option",
    fields: ["id", "name", "provider_id"],
    filters: {
      id: validatedQuery.shipping_option_id,
    },
  })

  const shippingOption = shippingOptions?.[0] as ShippingOptionRecord | undefined

  if (!shippingOption || shippingOption.provider_id !== APISHIP_PROVIDER_ID) {
    return res.status(200).json({
      quotes: [],
      code: "apiship_option_not_found",
    })
  }

  const calculated = await queryApiShipCalculation(
    req,
    cart.id,
    shippingOption.id
  )

  const calculatedData = calculated?.calculated_price?.data as ApiShipCalculatedData | undefined

  if (!calculatedData) {
    return res.status(200).json({
      quotes: [],
      code: "apiship_calculation_unavailable",
    })
  }

  const quotes = (calculatedData.deliveryToDoor ?? [])
    .flatMap((group) => {
      return (group.tariffs ?? [])
        .filter((tariff) => typeof tariff.deliveryCost === "number")
        .map((tariff) => {
          const eta = resolveEstimatedDays(tariff)

          return {
            amount: tariff.deliveryCost as number,
            currency_code: cart.currency_code,
            shipping_option_id: shippingOption.id,
            shipping_option_name: shippingOption.name ?? "ApiShip Courier to Address",
            provider_key: tariff.providerKey ?? group.providerKey ?? null,
            tariff_id: tariff.tariffId ?? null,
            provider_label:
              tariff.providerName ?? group.providerName ?? tariff.tariffName ?? "ApiShip",
            estimated_days_min: eta.min,
            estimated_days_max: eta.max,
          }
        })
    })
    .sort((left, right) => left.amount - right.amount)

  return res.status(200).json({
    quotes,
    selected_quote: quotes[0] ?? null,
    selection_mode: "cheapest_only_v1",
  })
}

async function queryApiShipCalculation(
  req: MedusaRequest,
  cartId: string,
  shippingOptionId: string
) {
  const protocol = req.protocol || "http"
  const host = req.get("host")
  const url = `${protocol}://${host}/store/shipping-options/${shippingOptionId}/calculate`

  const response = await fetch(url, {
    method: "POST",
    headers: forwardHeaders(req.headers),
    body: JSON.stringify({
      cart_id: cartId,
    }),
  })

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as {
    shipping_option?: CalculatedShippingOption
  }

  return payload.shipping_option ?? null
}

function hasAddressForApiShip(address?: CartShippingAddress | null) {
  return !!(
    address?.country_code?.trim() &&
    address.city?.trim() &&
    address.address_1?.trim()
  )
}

function forwardHeaders(headers: MedusaRequest["headers"]) {
  const xPublishableApiKey = headers["x-publishable-api-key"]
  const authorization = headers.authorization

  return {
    "content-type": "application/json",
    ...(typeof xPublishableApiKey === "string"
      ? { "x-publishable-api-key": xPublishableApiKey }
      : {}),
    ...(typeof authorization === "string" ? { authorization } : {}),
  }
}

function resolveEstimatedDays(tariff: ApiShipTariff) {
  const legacyMin = getFiniteNumber(tariff.daysMin)
  const legacyMax = getFiniteNumber(tariff.daysMax)

  if (legacyMin !== null || legacyMax !== null) {
    return {
      min: legacyMin,
      max: legacyMax ?? legacyMin,
    }
  }

  const workMin = getFiniteNumber(tariff.workDaysMin)
  const workMax = getFiniteNumber(tariff.workDaysMax)

  if (workMin !== null || workMax !== null) {
    return {
      min: workMin,
      max: workMax ?? workMin,
    }
  }

  const calendarMin = getFiniteNumber(tariff.calendarDaysMin)
  const calendarMax = getFiniteNumber(tariff.calendarDaysMax)

  return {
    min: calendarMin,
    max: calendarMax ?? calendarMin,
  }
}

function getFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}
