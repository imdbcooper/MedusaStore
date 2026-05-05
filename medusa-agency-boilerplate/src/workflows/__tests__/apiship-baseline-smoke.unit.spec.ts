import { describe, expect, it } from "@jest/globals"
import fs from "node:fs"
import path from "node:path"

import {
  APISHIP_FULFILLMENT_PROVIDER_CODE,
  APISHIP_FULFILLMENT_PROVIDER_ID,
  APISHIP_PRIMARY_ADAPTER,
  getDefaultFulfillmentContourContract,
} from "../../modules/fulfillment-contour-contract"
import {
  APISHIP_FULFILLMENT_PROVIDER_CODE as APISHIP_READINESS_PROVIDER_CODE,
  APISHIP_COURIER_SHIPPING_OPTION_PROVIDER_DATA_ID,
  APISHIP_PICKUP_POINT_PROVIDER_ID,
  APISHIP_PICKUP_POINT_SHIPPING_OPTION_PROVIDER_DATA_ID,
  buildApishipCheckoutReadiness,
  getApishipCheckoutContextKey,
} from "../../modules/apiship-checkout-readiness"
import {
  APISHIP_SHIPMENT_EXECUTION_ENV,
  assertApishipShipmentExecutionAllowed,
  isApishipShipmentExecutionEnabled,
} from "../../modules/apiship-shipment-execution-guard"

const backendRoot = path.resolve(__dirname, "../../..")

const medusaConfigSource = fs.readFileSync(
  path.join(backendRoot, "medusa-config.ts"),
  "utf8"
)
const gorgoApishipProviderSource = fs.readFileSync(
  path.join(
    backendRoot,
    "node_modules/@gorgo/medusa-fulfillment-apiship/.medusa/server/src/providers/fulfillment-apiship/services/apiship.js"
  ),
  "utf8"
)
const seedScript = require(path.join(backendRoot, "src/scripts/seed.ts"))

describe("ApiShip baseline smoke evidence", () => {
  it("registers ApiShip/Gorgo as the canonical fulfillment provider in Medusa config", () => {
    expect(medusaConfigSource).toContain(
      'const APISHIP_FULFILLMENT_PROVIDER_CODE = "apiship"'
    )
    expect(medusaConfigSource).toContain(
      '"@gorgo/medusa-fulfillment-apiship/providers/fulfillment-apiship"'
    )
    expect(medusaConfigSource).toContain(
      "resolve: APISHIP_FULFILLMENT_PROVIDER_MODULE"
    )
    expect(medusaConfigSource).toContain(
      "id: APISHIP_FULFILLMENT_PROVIDER_CODE"
    )
    expect(medusaConfigSource).toContain(
      'resolve: "@medusajs/medusa/fulfillment"'
    )
    expect(medusaConfigSource).toContain("providers: fulfillmentProviders")
  })

  it("keeps the fresh-template contour on ApiShip/Gorgo pickup-point baseline", () => {
    expect(getDefaultFulfillmentContourContract()).toEqual({
      version: 1,
      contour: "apiship_gorgo",
      provider_id: APISHIP_FULFILLMENT_PROVIDER_ID,
      provider_code: APISHIP_FULFILLMENT_PROVIDER_CODE,
      primary_adapter: APISHIP_PRIMARY_ADAPTER,
      buyer_facing_mode: "pickup_point_first",
      courier_delivery: "optional_later",
      posture: "default_for_new_templates",
      live_execution_enabled: false,
    })
    expect(APISHIP_FULFILLMENT_PROVIDER_ID).toBe("apiship_apiship")
  })

  it("confirms the ApiShip courier option id/data from the installed Gorgo provider", () => {
    expect(gorgoApishipProviderSource).toContain('id: "apiship_doortodoor"')
    expect(gorgoApishipProviderSource).toContain("deliveryType: 1")
    expect(gorgoApishipProviderSource).toContain("pickupType: 1")
    expect(gorgoApishipProviderSource).toContain("From door to door")
    expect(APISHIP_COURIER_SHIPPING_OPTION_PROVIDER_DATA_ID).toBe(
      "apiship_doortodoor"
    )
    expect(APISHIP_COURIER_SHIPPING_OPTION_PROVIDER_DATA_ID).not.toBe(
      APISHIP_PICKUP_POINT_SHIPPING_OPTION_PROVIDER_DATA_ID
    )
  })

  it("exports the seed contract for ApiShip pickup-point and courier shipping option bootstrap", () => {
    expect(seedScript.__APISHIP_BASELINE_SMOKE_CONTRACT__).toEqual({
      provider_id: "apiship_apiship",
      shipping_option_data_id: "apiship_doortopoint",
      shipping_option_data: {
        id: "apiship_doortopoint",
        deliveryType: 2,
        pickupType: 1,
        baseline: "apiship_pickup_point_first",
      },
      courier_shipping_option_data_id: "apiship_doortodoor",
      courier_shipping_option_data: {
        id: "apiship_doortodoor",
        deliveryType: 1,
        pickupType: 1,
        baseline: "apiship_courier_optional",
      },
      price_type: "calculated",
      shipping_option_name: "ApiShip — Пункт выдачи",
      courier_shipping_option_name: "ApiShip — Курьер",
    })
  })

  it("accepts only a saved ApiShip tariff and PVZ selection as checkout-ready", () => {
    const cart = buildReadyApishipCart()

    expect(buildApishipCheckoutReadiness(cart)).toEqual({
      ready: true,
      issues: [],
      contextKey: getApishipCheckoutContextKey(cart, "so_apiship"),
    })

    expect(
      buildApishipCheckoutReadiness({
        ...cart,
        shipping_methods: [
          {
            ...cart.shipping_methods[0],
            data: {
              apishipData: {
                tariff: cart.shipping_methods[0].data.apishipData.tariff,
              },
            },
          },
        ],
      }).issues.map((issue) => issue.code)
    ).toContain("pickup_point_missing")

    expect(
      buildApishipCheckoutReadiness({
        ...cart,
        shipping_methods: [
          {
            ...cart.shipping_methods[0],
            provider_id: "manual_manual",
            data: {
              apishipData: cart.shipping_methods[0].data.apishipData,
              provider_code: "manual",
            },
            shipping_option: {
              id: "so_manual",
              provider_id: "manual_manual",
              data: { id: "manual_flat_rate", provider_code: "manual" },
            },
          },
        ],
      }).issues.map((issue) => issue.code)
    ).toContain("shipping_method_not_apiship")
  })

  it("allows courier readiness with a valid tariff and no PVZ point", () => {
    const cart = buildReadyApishipCourierCart()

    expect(buildApishipCheckoutReadiness(cart)).toEqual({
      ready: true,
      issues: [],
      contextKey: getApishipCheckoutContextKey(cart, "so_apiship_courier"),
    })

    expect(
      buildApishipCheckoutReadiness({
        ...cart,
        shipping_methods: [
          {
            ...cart.shipping_methods[0],
            data: {
              apishipData: {
                mode: "courier",
              },
            },
          },
        ],
      }).issues.map((issue) => issue.code)
    ).toContain("tariff_missing")
  })

  it("does not let client-controlled mode bypass pickup-point PVZ readiness", () => {
    const cart = buildReadyApishipCart()
    const readiness = buildApishipCheckoutReadiness({
      ...cart,
      shipping_methods: [
        {
          ...cart.shipping_methods[0],
          data: {
            ...cart.shipping_methods[0].data,
            apishipData: {
              tariff: cart.shipping_methods[0].data.apishipData.tariff,
              mode: "courier",
            },
          },
        },
      ],
    })

    expect(readiness.ready).toBe(false)
    expect(readiness.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["delivery_mode_conflict", "pickup_point_missing"])
    )
  })

  it("fails closed when persisted mode hint conflicts with courier shipping option contract", () => {
    const cart = buildReadyApishipCourierCart()
    const readiness = buildApishipCheckoutReadiness({
      ...cart,
      shipping_methods: [
        {
          ...cart.shipping_methods[0],
          data: {
            ...cart.shipping_methods[0].data,
            apishipData: {
              ...cart.shipping_methods[0].data.apishipData,
              mode: "pickup_point",
            },
          },
        },
      ],
    })

    expect(readiness.ready).toBe(false)
    expect(readiness.issues.map((issue) => issue.code)).toContain(
      "delivery_mode_conflict"
    )
  })

  it("keeps live ApiShip shipment execution default-off unless exact opt-in is provided", () => {
    for (const value of [undefined, "", "false", "1", "TRUE", "yes"]) {
      const env = value === undefined ? {} : { [APISHIP_SHIPMENT_EXECUTION_ENV]: value }

      expect(isApishipShipmentExecutionEnabled(env)).toBe(false)
      expect(() =>
        assertApishipShipmentExecutionAllowed({
          provider_id: APISHIP_FULFILLMENT_PROVIDER_ID,
          operation: "create_fulfillment",
          env,
        })
      ).toThrow("ApiShip shipment execution is disabled by default")
    }

    expect(
      isApishipShipmentExecutionEnabled({
        [APISHIP_SHIPMENT_EXECUTION_ENV]: "true",
      })
    ).toBe(true)
  })
})

function buildReadyApishipCart() {
  return {
    id: "cart_apiship_baseline_smoke",
    currency_code: "rub",
    subtotal: 1200,
    shipping_address: {
      country_code: "ru",
      city: "Moscow",
      postal_code: "101000",
      address_1: "Smoke street 1",
    },
    shipping_methods: [
      {
        id: "sm_apiship_baseline_smoke",
        shipping_option_id: "so_apiship",
        provider_id: APISHIP_PICKUP_POINT_PROVIDER_ID,
        data: {
          apishipData: {
            tariff: {
              tariffId: 123,
              providerKey: "cdek",
              deliveryCost: 450,
            },
            point: {
              id: "pvz_apiship_baseline_smoke",
            },
          },
          provider_code: APISHIP_READINESS_PROVIDER_CODE,
        },
        shipping_option: {
          id: "so_apiship",
          provider_id: APISHIP_PICKUP_POINT_PROVIDER_ID,
          data: {
            id: APISHIP_PICKUP_POINT_SHIPPING_OPTION_PROVIDER_DATA_ID,
            provider_code: APISHIP_READINESS_PROVIDER_CODE,
          },
        },
      },
    ],
  }
}

function buildReadyApishipCourierCart() {
  return {
    id: "cart_apiship_courier_smoke",
    currency_code: "rub",
    subtotal: 2400,
    shipping_address: {
      country_code: "ru",
      city: "Moscow",
      postal_code: "101000",
      address_1: "Courier street 1",
    },
    shipping_methods: [
      {
        id: "sm_apiship_courier_smoke",
        shipping_option_id: "so_apiship_courier",
        provider_id: APISHIP_PICKUP_POINT_PROVIDER_ID,
        data: {
          apishipData: {
            tariff: {
              tariffId: 456,
              providerKey: "cdek",
              deliveryCost: 750,
            },
            mode: "courier",
          },
          provider_code: APISHIP_READINESS_PROVIDER_CODE,
        },
        shipping_option: {
          id: "so_apiship_courier",
          provider_id: APISHIP_PICKUP_POINT_PROVIDER_ID,
          data: {
            id: APISHIP_COURIER_SHIPPING_OPTION_PROVIDER_DATA_ID,
            deliveryType: 1,
            pickupType: 1,
            provider_code: APISHIP_READINESS_PROVIDER_CODE,
          },
        },
      },
    ],
  }
}
