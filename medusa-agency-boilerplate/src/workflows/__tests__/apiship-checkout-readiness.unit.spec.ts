import { describe, expect, it } from "@jest/globals"
import {
  APISHIP_FULFILLMENT_PROVIDER_CODE,
  APISHIP_PICKUP_POINT_PROVIDER_ID,
  APISHIP_PICKUP_POINT_SHIPPING_OPTION_PROVIDER_DATA_ID,
  buildApishipCheckoutReadiness,
  getApishipCheckoutContextKey,
  getApishipReadinessCart,
} from "../../modules/apiship-checkout-readiness"

describe("ApiShip checkout readiness guard", () => {
  it("retrieves readiness cart without invalid provider relation graph fields", async () => {
    const graphCalls: Array<{ fields: string[] }> = []
    const graph = async (query: { fields: string[] }) => {
      graphCalls.push(query)

      return { data: [buildCart()] }
    }
    const req = {
      scope: {
        resolve: () => ({ graph }),
      },
    }

    await expect(getApishipReadinessCart(req as never, "cart_1")).resolves.toEqual(
      buildCart()
    )

    expect(graphCalls[0]).toEqual(
      expect.objectContaining({
        entity: "cart",
        fields: expect.arrayContaining([
          "shipping_methods.provider_id",
          "shipping_methods.shipping_option.provider_id",
          "shipping_methods.shipping_option.data",
          "shipping_methods.data",
        ]),
      })
    )
    expect(graphCalls[0].fields).not.toContain("shipping_methods.provider.id")
  })

  it("passes valid ApiShip shipping method", () => {
    const cart = buildCart()

    expect(buildApishipCheckoutReadiness(cart)).toEqual({
      ready: true,
      issues: [],
      contextKey: getApishipCheckoutContextKey(cart, "so_apiship"),
    })
  })

  it("rejects missing shipping method", () => {
    const result = buildApishipCheckoutReadiness(
      buildCart({ shipping_methods: [] })
    )

    expect(result.ready).toBe(false)
    expect(issueCodes(result)).toContain("shipping_method_missing")
  })

  it("rejects non-ApiShip/manual shipping method", () => {
    const result = buildApishipCheckoutReadiness(
      buildCart({
        shipping_methods: [
          {
            id: "sm_manual",
            shipping_option_id: "so_manual",
            provider_id: "manual_manual",
            data: {
              id: "manual_flat_rate",
              apishipData: buildApishipData(),
            },
            shipping_option: {
              id: "so_manual",
              provider_id: "manual_manual",
              data: { id: "manual_flat_rate" },
            },
            provider: {
              id: "manual_manual",
            },
          },
        ],
      })
    )

    expect(result.ready).toBe(false)
    expect(issueCodes(result)).toContain("shipping_method_not_apiship")
  })

  it("rejects missing apishipData", () => {
    const result = buildApishipCheckoutReadiness(
      buildCart({
        shipping_methods: [
          buildShippingMethod({
            data: { id: APISHIP_PICKUP_POINT_SHIPPING_OPTION_PROVIDER_DATA_ID },
          }),
        ],
      })
    )

    expect(result.ready).toBe(false)
    expect(issueCodes(result)).toContain("apiship_data_missing")
  })

  it("rejects missing tariffId", () => {
    const result = buildApishipCheckoutReadiness(
      buildCartWithApishipData({
        tariff: {
          providerKey: "cdek",
          deliveryCost: 450,
        },
        point: { id: "pvz_1" },
      })
    )

    expect(result.ready).toBe(false)
    expect(issueCodes(result)).toContain("tariff_id_missing")
  })

  it("rejects missing providerKey", () => {
    const result = buildApishipCheckoutReadiness(
      buildCartWithApishipData({
        tariff: {
          tariffId: 123,
          deliveryCost: 450,
        },
        point: { id: "pvz_1" },
      })
    )

    expect(result.ready).toBe(false)
    expect(issueCodes(result)).toContain("provider_key_missing")
  })

  it("rejects missing deliveryCost", () => {
    const result = buildApishipCheckoutReadiness(
      buildCartWithApishipData({
        tariff: {
          tariffId: 123,
          providerKey: "cdek",
        },
        point: { id: "pvz_1" },
      })
    )

    expect(result.ready).toBe(false)
    expect(issueCodes(result)).toContain("delivery_cost_missing")
  })

  it("rejects missing PVZ point id", () => {
    const result = buildApishipCheckoutReadiness(
      buildCartWithApishipData({
        tariff: {
          tariffId: 123,
          providerKey: "cdek",
          deliveryCost: 450,
        },
        point: { code: "pvz_1" },
      })
    )

    expect(result.ready).toBe(false)
    expect(issueCodes(result)).toContain("pickup_point_id_missing")
  })

  it("rejects context mismatch", () => {
    const result = buildApishipCheckoutReadiness(
      buildCartWithApishipData({
        ...buildApishipData(),
        contextKey: "cart_1|rub|500|RU|Moscow|101000|Old address|so_apiship",
      })
    )

    expect(result.ready).toBe(false)
    expect(issueCodes(result)).toContain("context_mismatch")
  })
})

function issueCodes(result: ReturnType<typeof buildApishipCheckoutReadiness>) {
  return result.issues.map((issue) => issue.code)
}

function buildCart(overrides: Record<string, unknown> = {}) {
  return {
    id: "cart_1",
    currency_code: "rub",
    subtotal: 500,
    shipping_address: {
      country_code: "ru",
      city: "Moscow",
      postal_code: "101000",
      address_1: "Valid address",
    },
    shipping_methods: [buildShippingMethod()],
    ...overrides,
  }
}

function buildCartWithApishipData(apishipData: Record<string, unknown>) {
  return buildCart({
    shipping_methods: [
      buildShippingMethod({
        data: {
          apishipData,
          provider_code: APISHIP_FULFILLMENT_PROVIDER_CODE,
        },
      }),
    ],
  })
}

function buildShippingMethod(overrides: Record<string, unknown> = {}) {
  return {
    id: "sm_1",
    shipping_option_id: "so_apiship",
    provider_id: APISHIP_PICKUP_POINT_PROVIDER_ID,
    data: {
      apishipData: buildApishipData(),
      provider_code: APISHIP_FULFILLMENT_PROVIDER_CODE,
    },
    shipping_option: {
      id: "so_apiship",
      provider_id: APISHIP_PICKUP_POINT_PROVIDER_ID,
      data: {
        id: APISHIP_PICKUP_POINT_SHIPPING_OPTION_PROVIDER_DATA_ID,
        provider_code: APISHIP_FULFILLMENT_PROVIDER_CODE,
      },
    },
    provider: {
      id: APISHIP_PICKUP_POINT_PROVIDER_ID,
    },
    ...overrides,
  }
}

function buildApishipData(overrides: Record<string, unknown> = {}) {
  return {
    tariff: {
      tariffId: 123,
      providerKey: "cdek",
      deliveryCost: 450,
    },
    point: {
      id: "pvz_1",
    },
    ...overrides,
  }
}
