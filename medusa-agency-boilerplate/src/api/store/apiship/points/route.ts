import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import {
  getApiShipProviderOptionsFromEnv,
  normalizeApiShipSelectionData,
  requestApiShip,
} from "../../../../modules/apiship"
import {
  buildEmptyApiShipRatesResponse,
  getApiShipQuery,
  getCartForApiShip,
  getShippingOptionForApiShip,
  hasAddressForApiShip,
  queryApiShipCalculation,
  type ApiShipCalculatedData,
} from "../../../../modules/apiship-rates"
import {
  APISHIP_TO_POINT_OPTION_ID,
  getApiShipPgConnection,
  getApiShipSettings,
  projectApiShipSettingsForStore,
} from "../../../../modules/apiship-settings"

type ApiShipPointObject = {
  id?: number
  providerKey?: string
  code?: string
  name?: string
  postIndex?: string
  lat?: number
  lng?: number
  countryCode?: string
  region?: string
  city?: string
  address?: string
  street?: string
  house?: string
  phone?: string
  timetable?: string
  paymentCash?: number | null
  paymentCard?: number | null
  paymentOnline?: number | null
  cod?: number | null
  fittingRoom?: number | null
}

type ApiShipPointsResponse = {
  rows?: ApiShipPointObject[]
  meta?: {
    total?: number
    offset?: number
    limit?: number
  }
}

export const StoreApiShipPointsSchema = z.object({
  cart_id: z.string().trim().min(1),
  shipping_option_id: z.string().trim().min(1),
  provider_key: z.string().trim().min(1),
  tariff_id: z.coerce.number().int(),
  pickup_type: z.coerce.number().int().min(1).max(2),
  delivery_type: z.coerce.number().int().refine((value) => value === 2),
  q: z.string().trim().optional(),
})

type StoreApiShipPointsRequest = z.infer<typeof StoreApiShipPointsSchema>

export async function GET(
  req: MedusaRequest<StoreApiShipPointsRequest>,
  res: MedusaResponse
) {
  const validatedQuery = req.validatedQuery as StoreApiShipPointsRequest
  const query = getApiShipQuery(req)
  const pgConnection = getApiShipPgConnection(req.scope)
  const settings = await getApiShipSettings(pgConnection)

  if (!settings.enabled) {
    return res.status(200).json({
      points: [],
      selected_selection: null,
      selection_confirmation_required: true,
      code: "apiship_disabled",
      settings: projectApiShipSettingsForStore(settings),
    })
  }

  const cart = await getCartForApiShip(query, validatedQuery.cart_id)

  if (!cart) {
    return res.status(404).json({
      points: [],
      selected_selection: null,
      selection_confirmation_required: true,
      code: "cart_not_found",
      settings: projectApiShipSettingsForStore(settings),
    })
  }

  if (!hasAddressForApiShip(cart.shipping_address)) {
    return res.status(200).json({
      points: [],
      selected_selection: null,
      selection_confirmation_required: true,
      code: "shipping_address_incomplete",
      settings: projectApiShipSettingsForStore(settings),
    })
  }

  const shippingOption = await getShippingOptionForApiShip(
    query,
    validatedQuery.shipping_option_id
  )

  if (!shippingOption || shippingOption.data?.id !== APISHIP_TO_POINT_OPTION_ID) {
    return res.status(200).json({
      points: [],
      selected_selection: null,
      selection_confirmation_required: true,
      code: "apiship_option_not_found",
      settings: projectApiShipSettingsForStore(settings),
    })
  }

  const calculated = await queryApiShipCalculation(req, cart.id, shippingOption.id, {
    provider_key: validatedQuery.provider_key,
    tariff_id: validatedQuery.tariff_id,
    pickup_type: validatedQuery.pickup_type,
    delivery_type: validatedQuery.delivery_type,
  })
  const calculatedData = calculated?.calculated_price?.data as ApiShipCalculatedData | undefined

  if (!calculatedData) {
    return res.status(200).json({
      points: [],
      selected_selection: null,
      selection_confirmation_required: true,
      code: "apiship_calculation_unavailable",
      settings: projectApiShipSettingsForStore(settings),
    })
  }

  const pointIds = resolvePointIds(calculatedData, {
    providerKey: validatedQuery.provider_key,
    tariffId: validatedQuery.tariff_id,
    pickupType: validatedQuery.pickup_type,
  })

  if (!pointIds.length) {
    return res.status(200).json({
      points: [],
      selected_selection: null,
      selection_confirmation_required: true,
      code: "apiship_points_unavailable",
      settings: projectApiShipSettingsForStore(settings),
    })
  }

  const providerOptions = getApiShipProviderOptionsFromEnv()
  const filterParts = [
    `providerKey=${validatedQuery.provider_key}`,
    `availableOperation=[2,3]`,
    `id=[${pointIds.join(",")}]`,
  ]

  if (validatedQuery.q) {
    const safeQuery = validatedQuery.q.replace(/[;\[\]]/g, " ").trim()

    if (safeQuery) {
      filterParts.push(`city=${safeQuery}`)
    }
  } else if (cart.shipping_address?.city?.trim()) {
    filterParts.push(`city=${cart.shipping_address.city.trim()}`)
  }

  const response = await requestApiShip<ApiShipPointsResponse>({
    path: "/lists/points",
    method: "GET",
    options: providerOptions,
    query: {
      limit: 100,
      offset: 0,
      stateCheckOff: 1,
      filter: filterParts.join(";"),
    },
  })

  const points = (response.rows ?? [])
    .filter((point) => typeof point.id === "number" && pointIds.includes(point.id))
    .map((point) => ({
      id: point.id as number,
      provider_key: point.providerKey?.trim() || validatedQuery.provider_key,
      code: point.code?.trim() || null,
      name: point.name?.trim() || null,
      address: point.address?.trim() || formatPointAddress(point),
      city: point.city?.trim() || null,
      region: point.region?.trim() || null,
      post_index: point.postIndex?.trim() || null,
      lat: typeof point.lat === "number" ? point.lat : null,
      lng: typeof point.lng === "number" ? point.lng : null,
      phone: point.phone?.trim() || null,
      timetable: point.timetable?.trim() || null,
      payment_cash: normalizeNullableFlag(point.paymentCash),
      payment_card: normalizeNullableFlag(point.paymentCard),
      payment_online: normalizeNullableFlag(point.paymentOnline),
      cod: normalizeNullableFlag(point.cod),
      fitting_room: normalizeNullableFlag(point.fittingRoom),
      selection_data: normalizeApiShipSelectionData({
        provider_key: validatedQuery.provider_key,
        tariff_id: validatedQuery.tariff_id,
        pickup_type: validatedQuery.pickup_type,
        delivery_type: validatedQuery.delivery_type,
        point_out_id: point.id,
        mode_key: APISHIP_TO_POINT_OPTION_ID,
        point_label: point.name?.trim() || undefined,
        point_address: point.address?.trim() || formatPointAddress(point) || undefined,
        selection_mode: "provider_aware_v2",
      }),
    }))
    .sort((left, right) => {
      const leftName = `${left.city || ""} ${left.name || ""}`.trim()
      const rightName = `${right.city || ""} ${right.name || ""}`.trim()
      return leftName.localeCompare(rightName, "ru")
    })

  return res.status(200).json({
    points,
    selected_selection: null,
    selection_confirmation_required: true,
    selected_quote_key: `${validatedQuery.provider_key}:${validatedQuery.tariff_id}:${validatedQuery.pickup_type}:2`,
    code: points.length ? null : "apiship_points_unavailable",
    settings: projectApiShipSettingsForStore(settings),
  })
}

function resolvePointIds(
  data: ApiShipCalculatedData,
  selection: {
    providerKey: string
    tariffId: number
    pickupType: number
  }
) {
  return (data.deliveryToPoint ?? [])
    .flatMap((group) => {
      return (group.tariffs ?? []).flatMap((tariff) => {
        const providerKey = (tariff.providerKey ?? group.providerKey)?.trim()

        if (providerKey !== selection.providerKey || tariff.tariffId !== selection.tariffId) {
          return []
        }

        if (
          Array.isArray(tariff.pickupTypes) &&
          tariff.pickupTypes.length &&
          !tariff.pickupTypes.includes(selection.pickupType)
        ) {
          return []
        }

        return Array.isArray(tariff.pointIds) ? tariff.pointIds : []
      })
    })
    .filter((value, index, collection) => Number.isInteger(value) && collection.indexOf(value) === index)
}

function formatPointAddress(point: ApiShipPointObject) {
  const parts = [
    point.city?.trim(),
    point.street?.trim(),
    point.house?.trim() ? `д. ${point.house.trim()}` : null,
  ].filter(Boolean)

  return parts.length ? parts.join(", ") : null
}

function normalizeNullableFlag(value: unknown) {
  return typeof value === "number" ? value : null
}
