import { describe, expect, it } from "@jest/globals"
import {
  APISHIP_MODE_DEFINITIONS,
  APISHIP_TO_DOOR_OPTION_ID,
  APISHIP_TO_POINT_OPTION_ID,
  getDefaultApiShipSettings,
  projectApiShipSettingsForStore,
  resolveAllowedPickupTypesForShopperMode,
  resolveApiShipTechnicalMode,
} from "../../modules/apiship-settings"
import {
  normalizeApiShipSelectionData,
  parseApiShipSelectionData,
} from "../../modules/apiship"
import {
  buildApiShipQuotesResponse,
  type ApiShipCalculatedData,
} from "../../modules/apiship-rates"

function buildApiShipAddressFingerprint(address: {
  address_1?: string | null
  city?: string | null
  country_code?: string | null
  postal_code?: string | null
  province?: string | null
}) {
  const normalize = (value?: string | null) =>
    typeof value === "string" && value.trim() ? value.trim().toLowerCase() : ""

  const fingerprint = [
    normalize(address.country_code),
    normalize(address.postal_code),
    normalize(address.province),
    normalize(address.city),
    normalize(address.address_1),
  ].join("|")

  return fingerprint === "||||" ? null : fingerprint
}

function validateApiShipShippingSelectionData(
  data: Record<string, unknown>,
  options?: {
    shippingOptionId?: string | null
    shopperModeKey?: string | null
    addressFingerprint?: string | null
  }
) {
  const selection = parseApiShipSelectionData(data)

  if (!selection) {
    throw new Error("ApiShip shipping selection must include exact provider and tariff data.")
  }

  const normalizedShippingOptionId =
    typeof options?.shippingOptionId === "string" && options.shippingOptionId.trim()
      ? options.shippingOptionId.trim()
      : null
  const normalizedSelectionOptionId =
    typeof data.shipping_option_id === "string" && data.shipping_option_id.trim()
      ? data.shipping_option_id.trim()
      : null

  if (options?.shopperModeKey && selection.mode_key !== options.shopperModeKey) {
    throw new Error("ApiShip shipping selection mode_key does not match the selected shopper mode.")
  }

  if (
    normalizedShippingOptionId &&
    normalizedSelectionOptionId &&
    normalizedShippingOptionId !== normalizedSelectionOptionId
  ) {
    throw new Error(
      "ApiShip shipping selection shipping_option_id does not match the selected shipping option."
    )
  }

  return {
    ...selection,
    shipping_option_id:
      normalizedSelectionOptionId ?? normalizedShippingOptionId ?? undefined,
    address_fingerprint:
      (typeof data.address_fingerprint === "string" && data.address_fingerprint.trim()
        ? data.address_fingerprint.trim()
        : null) ?? options?.addressFingerprint ?? undefined,
  }
}

describe("ApiShip backend settings contract", () => {
  it("projects seller settings into shopper-visible modes", () => {
    const settings = getDefaultApiShipSettings({
      enabled: true,
      modes: {
        door_to_door: true,
        dropoff_to_door: true,
        door_to_point: false,
        dropoff_to_point: true,
      },
    })

    const projected = projectApiShipSettingsForStore(settings)

    expect(projected.enabled).toBe(true)
    expect(projected.shopper_modes[APISHIP_TO_DOOR_OPTION_ID]).toEqual({
      mode_key: APISHIP_TO_DOOR_OPTION_ID,
      mode_label: "До двери",
      shipping_option_id: APISHIP_TO_DOOR_OPTION_ID,
      enabled: true,
      technical_mode_keys: ["door_to_door", "dropoff_to_door"],
      pickup_types: [1, 2],
      delivery_type: 1,
    })
    expect(projected.shopper_modes[APISHIP_TO_POINT_OPTION_ID]).toEqual({
      mode_key: APISHIP_TO_POINT_OPTION_ID,
      mode_label: "В пункт выдачи",
      shipping_option_id: APISHIP_TO_POINT_OPTION_ID,
      enabled: true,
      technical_mode_keys: ["dropoff_to_point"],
      pickup_types: [2],
      delivery_type: 2,
    })
  })

  it("maps technical pickup/delivery combinations into shopper modes", () => {
    expect(resolveApiShipTechnicalMode(1, 1)).toEqual(APISHIP_MODE_DEFINITIONS.door_to_door)
    expect(resolveApiShipTechnicalMode(2, 1)).toEqual(APISHIP_MODE_DEFINITIONS.dropoff_to_door)
    expect(resolveApiShipTechnicalMode(1, 2)).toEqual(APISHIP_MODE_DEFINITIONS.door_to_point)
    expect(resolveApiShipTechnicalMode(2, 2)).toEqual(APISHIP_MODE_DEFINITIONS.dropoff_to_point)
    expect(resolveApiShipTechnicalMode(3, 1)).toBeNull()
  })

  it("derives allowed pickup types per shopper mode from seller settings", () => {
    const settings = getDefaultApiShipSettings({
      enabled: true,
      modes: {
        door_to_door: false,
        dropoff_to_door: true,
        door_to_point: true,
        dropoff_to_point: false,
      },
    })

    expect(resolveAllowedPickupTypesForShopperMode(settings, APISHIP_TO_DOOR_OPTION_ID)).toEqual([2])
    expect(resolveAllowedPickupTypesForShopperMode(settings, APISHIP_TO_POINT_OPTION_ID)).toEqual([1])
  })
})

describe("ApiShip selection normalization", () => {
  it("preserves extended selection fields for point delivery", () => {
    const normalized = normalizeApiShipSelectionData({
      provider_key: "cdek",
      tariff_id: 456,
      pickup_type: 2,
      delivery_type: 2,
      mode_key: "apiship_to_point",
      point_out_id: 789,
      point_label: "ПВЗ на Ленина",
      point_address: "г Москва, ул Ленина, д 1",
      provider_name: "CDEK",
      tariff_name: "Самовывоз",
      quote_key: "cdek:456:2:2",
    })

    expect(normalized).toMatchObject({
      provider_key: "cdek",
      tariff_id: 456,
      pickup_type: 2,
      delivery_type: 2,
      mode_key: "apiship_to_point",
      point_out_id: 789,
      point_label: "ПВЗ на Ленина",
      point_address: "г Москва, ул Ленина, д 1",
      provider_name: "CDEK",
      tariff_name: "Самовывоз",
      quote_key: "cdek:456:2:2",
    })

    expect(parseApiShipSelectionData(normalized)).toMatchObject({
      provider_key: "cdek",
      tariff_id: 456,
      pickup_type: 2,
      delivery_type: 2,
      point_out_id: 789,
      mode_key: "apiship_to_point",
      point_label: "ПВЗ на Ленина",
      point_address: "г Москва, ул Ленина, д 1",
    })
  })

  it("adds storefront guardrail fields without conflating mode key and shipping option id", () => {
    const addressFingerprint = buildApiShipAddressFingerprint({
      country_code: "RU",
      postal_code: "101000",
      province: "Moscow",
      city: "Moscow",
      address_1: "Tverskaya 1",
    })

    const validated = validateApiShipShippingSelectionData(
      {
        provider_key: "cdek",
        tariff_id: 456,
        pickup_type: 2,
        delivery_type: 2,
        mode_key: "apiship_to_point",
        point_out_id: 789,
        point_label: "ПВЗ на Ленина",
        point_address: "г Москва, ул Ленина, д 1",
      },
      {
        shippingOptionId: "so_apiship_point_real",
        shopperModeKey: APISHIP_TO_POINT_OPTION_ID,
        addressFingerprint,
      }
    )

    expect(validated).toMatchObject({
      mode_key: APISHIP_TO_POINT_OPTION_ID,
      shipping_option_id: "so_apiship_point_real",
      address_fingerprint: addressFingerprint,
    })
  })

  it("rejects mismatched persisted shipping option id when storefront tries to restore selection", () => {
    expect(() =>
      validateApiShipShippingSelectionData(
        {
          provider_key: "cdek",
          tariff_id: 456,
          pickup_type: 1,
          delivery_type: 1,
          mode_key: APISHIP_TO_DOOR_OPTION_ID,
          shipping_option_id: "so_old",
        },
        {
          shippingOptionId: "so_new",
          shopperModeKey: APISHIP_TO_DOOR_OPTION_ID,
        }
      )
    ).toThrow(/shipping_option_id/)
  })

  it("rejects point delivery selection without point_out_id", () => {
    expect(() =>
      normalizeApiShipSelectionData({
        provider_key: "cdek",
        tariff_id: 456,
        pickup_type: 1,
        delivery_type: 2,
      })
    ).toThrow(/point_out_id/)
  })
})

describe("ApiShip rates shaping", () => {
  it("builds enriched quotes for shopper-visible point mode", () => {
    const settings = getDefaultApiShipSettings({
      enabled: true,
      modes: {
        door_to_door: true,
        dropoff_to_door: false,
        door_to_point: false,
        dropoff_to_point: true,
      },
    })
    const calculatedData: ApiShipCalculatedData = {
      deliveryToPoint: [
        {
          providerKey: "yataxi",
          providerName: "",
          tariffs: [
            {
              providerKey: "yataxi",
              providerName: "",
              tariffId: 101,
              tariffName: "ПВЗ",
              deliveryCost: 399,
              pointIds: [10, 20],
              pickupTypes: [2],
              deliveryTypes: [2],
              calendarDaysMin: 1,
              calendarDaysMax: 2,
            },
          ],
        },
      ],
    }

    const response = buildApiShipQuotesResponse({
      cartCurrencyCode: "rub",
      shippingOption: {
        id: "so_point",
        name: "ApiShip — В пункт выдачи",
        provider_id: "apiship_apiship",
        data: { id: APISHIP_TO_POINT_OPTION_ID },
      },
      calculatedData,
      settings,
    })

    expect(response.selection_mode).toBe("provider_aware_v2")
    expect(response.quotes).toHaveLength(1)
    expect(response.quotes[0]).toMatchObject({
      provider_key: "yataxi",
      provider_label: "Яндекс.Доставка",
      tariff_id: 101,
      pickup_type: 2,
      delivery_type: 2,
      mode_key: APISHIP_TO_POINT_OPTION_ID,
      mode_label: "В пункт выдачи",
      shipping_option_id: "so_point",
      shipping_option_name: "ApiShip — В пункт выдачи",
      point_ids: [10, 20],
      point_selection_required: true,
      point_selection_supported: true,
    })
    expect(response.quotes[0].eta).toEqual({ min: 1, max: 2 })
  })
})
