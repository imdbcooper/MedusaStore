import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { APISHIP_PROVIDER_ID } from "../../../../modules/apiship"
import {
  buildApiShipQuotesResponse,
  buildEmptyApiShipRatesResponse,
  getApiShipQuery,
  getCartForApiShip,
  getShippingOptionForApiShip,
  hasAddressForApiShip,
  queryApiShipCalculation,
} from "../../../../modules/apiship-rates"
import {
  getApiShipPgConnection,
  getApiShipSettings,
  projectApiShipSettingsForStore,
} from "../../../../modules/apiship-settings"
import { z } from "@medusajs/framework/zod"

export const StoreApiShipRatesSchema = z.object({
  cart_id: z.string().trim().min(1),
  shipping_option_id: z.string().trim().min(1),
})

type StoreApiShipRatesRequest = z.infer<typeof StoreApiShipRatesSchema>

export async function GET(
  req: MedusaRequest<StoreApiShipRatesRequest>,
  res: MedusaResponse
) {
  const query = getApiShipQuery(req)
  const pgConnection = getApiShipPgConnection(req.scope)
  const settings = await getApiShipSettings(pgConnection)
  const validatedQuery = req.validatedQuery as StoreApiShipRatesRequest

  if (!settings.enabled) {
    return res.status(200).json({
      ...buildEmptyApiShipRatesResponse("apiship_disabled"),
      settings: projectApiShipSettingsForStore(settings),
    })
  }

  const cart = await getCartForApiShip(query, validatedQuery.cart_id)

  if (!cart) {
    return res.status(404).json({
      ...buildEmptyApiShipRatesResponse("cart_not_found"),
      settings: projectApiShipSettingsForStore(settings),
    })
  }

  if (!hasAddressForApiShip(cart.shipping_address)) {
    return res.status(200).json({
      ...buildEmptyApiShipRatesResponse("shipping_address_incomplete"),
      settings: projectApiShipSettingsForStore(settings),
    })
  }

  const shippingOption = await getShippingOptionForApiShip(
    query,
    validatedQuery.shipping_option_id
  )

  if (!shippingOption || shippingOption.provider_id !== APISHIP_PROVIDER_ID) {
    return res.status(200).json({
      ...buildEmptyApiShipRatesResponse("apiship_option_not_found"),
      settings: projectApiShipSettingsForStore(settings),
    })
  }

  const calculated = await queryApiShipCalculation(req, cart.id, shippingOption.id)
  const calculatedData = calculated?.calculated_price?.data || null

  if (!calculatedData) {
    return res.status(200).json({
      ...buildEmptyApiShipRatesResponse("apiship_calculation_unavailable"),
      settings: projectApiShipSettingsForStore(settings),
    })
  }

  const payload = buildApiShipQuotesResponse({
    cartCurrencyCode: cart.currency_code,
    shippingOption,
    calculatedData,
    settings,
  })

  return res.status(200).json({
    ...payload,
    settings: projectApiShipSettingsForStore(settings),
  })
}
