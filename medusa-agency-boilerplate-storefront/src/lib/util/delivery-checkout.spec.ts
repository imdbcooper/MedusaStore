/// <reference types="node" />

import assert from "node:assert/strict"
// @ts-ignore -- runtime uses Node 24 test runner via --experimental-strip-types
import test from "node:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, resolve } from "node:path"

import {
  buildDeliveryCheckoutReadinessState,
  buildDeliveryCheckoutSummary,
  isDeliveryCheckoutReady,
} from "./delivery-checkout.ts"
import { getApishipCheckoutContextKey } from "./apiship.ts"

const workspaceRoot = resolve(process.cwd(), "..")
const storefrontRoot = process.cwd()
const backendRoot = join(workspaceRoot, "medusa-agency-boilerplate")
const backendStoreApiRoot = join(backendRoot, "src", "api", "store")

const publicContractSearchRoots = [
  join(storefrontRoot, "src", "lib", "data"),
  backendStoreApiRoot,
]

test("valid ApiShip method maps to provider-neutral ready state and summary", () => {
  const cart = buildReadyApishipCart()
  const contextKey = getApishipCheckoutContextKey(cart, "so_apiship")

  assert.deepEqual(
    buildDeliveryCheckoutReadinessState(cart, {
      contextKey,
      shippingOptionId: "so_apiship",
    }),
    {
      provider: "apiship",
      ready: true,
      reason: null,
      contextKey,
      summary: {
        provider: "apiship",
        label: "ApiShip",
        point_label: "ПВЗ ApiShip · ул. Ленина, 1",
        tariff_label: "cdek · 123",
      },
    }
  )
  assert.equal(isDeliveryCheckoutReady(cart, { contextKey }), true)
  assert.deepEqual(buildDeliveryCheckoutSummary(cart.shipping_methods[0]), {
    provider: "apiship",
    label: "ApiShip",
    point_label: "ПВЗ ApiShip · ул. Ленина, 1",
    tariff_label: "cdek · 123",
  })
})

test("missing tariff/point/context mismatch maps to not-ready with provider-neutral reasons", () => {
  const cart = buildReadyApishipCart()

  assert.deepEqual(
    buildDeliveryCheckoutReadinessState({
      ...cart,
      shipping_methods: [
        {
          ...cart.shipping_methods[0],
          data: {
            apishipData: {
              point: cart.shipping_methods[0].data.apishipData.point,
              contextKey: "stale_context",
            },
          },
        },
      ],
    }).reason,
    "tariff_missing"
  )

  assert.deepEqual(
    buildDeliveryCheckoutReadinessState({
      ...cart,
      shipping_methods: [
        {
          ...cart.shipping_methods[0],
          data: {
            apishipData: {
              tariff: cart.shipping_methods[0].data.apishipData.tariff,
              contextKey: "stale_context",
            },
          },
        },
      ],
    }).reason,
    "pickup_point_missing"
  )

  assert.deepEqual(
    buildDeliveryCheckoutReadinessState(cart, {
      contextKey: "different_checkout_context",
    }).reason,
    "context_mismatch"
  )
})

test("non-ApiShip/manual method does not produce false ready for ApiShip baseline", () => {
  const cart = {
    ...buildReadyApishipCart(),
    shipping_methods: [
      {
        id: "sm_manual",
        shipping_option_id: "so_manual",
        provider_id: "manual_manual",
        data: {
          provider_code: "manual",
        },
        shipping_option: {
          id: "so_manual",
          provider_id: "manual_manual",
          data: { id: "manual_flat_rate", provider_code: "manual" },
        },
      },
    ],
  }

  assert.deepEqual(buildDeliveryCheckoutReadinessState(cart), {
    provider: "apiship",
    ready: false,
    reason: "shipping_method_provider_mismatch",
    contextKey: getApishipCheckoutContextKey(cart, undefined),
    summary: null,
  })
  assert.equal(isDeliveryCheckoutReady(cart), false)
  assert.equal(buildDeliveryCheckoutSummary(cart.shipping_methods[0]), null)
})

test("provider-neutral checkout layer does not introduce a public /store/delivery facade", () => {
  for (const root of publicContractSearchRoots) {
    const matches = readDirectorySources(root)
      .filter(({ file }) => file.endsWith(".ts") || file.endsWith(".tsx"))
      .filter(({ file }) => !file.includes("delivery-hub"))
      .filter(({ source }) => source.includes("/store/delivery"))

    assert.deepEqual(matches, [])
  }

  assert.equal(statSync(join(backendStoreApiRoot, "delivery")).isDirectory(), true)
  assert.equal(
    readDirectorySources(backendStoreApiRoot).some(({ file, source }) =>
      !file.includes("delivery-hub") && source.includes("/store/delivery")
    ),
    false
  )
})

function buildReadyApishipCart() {
  return {
    id: "cart_delivery_checkout",
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
        id: "sm_apiship",
        shipping_option_id: "so_apiship",
        provider_id: "apiship_apiship",
        data: {
          apishipData: {
            tariff: {
              tariffId: 123,
              providerKey: "cdek",
              deliveryCost: 450,
            },
            point: {
              id: "pvz_apiship",
              name: "ПВЗ ApiShip",
              address: "ул. Ленина, 1",
            },
            contextKey: getApishipCheckoutContextKey(
              {
                id: "cart_delivery_checkout",
                currency_code: "rub",
                subtotal: 1200,
                shipping_address: {
                  country_code: "ru",
                  city: "Moscow",
                  postal_code: "101000",
                  address_1: "Smoke street 1",
                },
              },
              "so_apiship"
            ),
          },
          provider_code: "apiship",
        },
        shipping_option: {
          id: "so_apiship",
          provider_id: "apiship_apiship",
          data: {
            id: "apiship_doortopoint",
            provider_code: "apiship",
          },
        },
      },
    ],
  }
}

function readDirectorySources(root: string): Array<{ file: string; source: string }> {
  const entries = readdirSync(root, { withFileTypes: true })
  const sources: Array<{ file: string; source: string }> = []

  for (const entry of entries) {
    const file = join(root, entry.name)

    if (entry.isDirectory()) {
      sources.push(...readDirectorySources(file))
      continue
    }

    if (statSync(file).isFile()) {
      sources.push({ file, source: readFileSync(file, "utf8") })
    }
  }

  return sources
}
