import { afterEach, describe, expect, it, jest } from "@jest/globals"
import {
  createYandexDeliveryAdapter,
} from "../../modules/delivery-hub/adapters/yandex"
import {
  YANDEX_DELIVERY_API_PATH,
  YANDEX_DELIVERY_LEGACY_API_PATH,
  YANDEX_DELIVERY_LEGACY_SANDBOX_API_BASE_URL,
  YANDEX_DELIVERY_PRODUCTION_API_BASE_URL,
  YANDEX_DELIVERY_SANDBOX_API_BASE_URL,
} from "../../modules/delivery-hub/adapters/yandex/endpoints"
import {
  resolveYandexDeliveryApiBaseUrl,
  resolveYandexDeliveryLegacyApiBaseUrl,
} from "../../modules/delivery-hub/adapters/yandex/base-url"
import { encryptDeliveryHubCredentials } from "../../modules/delivery-hub/security/encryption"
import type { DeliveryConnectionRecord } from "../../modules/delivery-hub/domain/connection"

const originalFetch = global.fetch
const originalEncryptionKey = process.env.DELIVERY_HUB_ENCRYPTION_KEY

describe("Delivery Hub Yandex documented Other-day API contract", () => {
  afterEach(() => {
    global.fetch = originalFetch
    if (typeof originalEncryptionKey === "string") {
      process.env.DELIVERY_HUB_ENCRYPTION_KEY = originalEncryptionKey
    } else {
      delete process.env.DELIVERY_HUB_ENCRYPTION_KEY
    }
    jest.restoreAllMocks()
  })

  it("resolves documented sandbox and production API hosts", () => {
    expect(resolveYandexDeliveryApiBaseUrl(buildConnection({ mode: "test" })).base_url).toBe(
      YANDEX_DELIVERY_SANDBOX_API_BASE_URL
    )
    expect(resolveYandexDeliveryApiBaseUrl(buildConnection({ mode: "live" })).base_url).toBe(
      YANDEX_DELIVERY_PRODUCTION_API_BASE_URL
    )
  })

  it("normalizes previously persisted legacy sandbox override to documented sandbox host", () => {
    expect(resolveYandexDeliveryApiBaseUrl(buildConnection({
      mode: "test",
      config: { api_base_url: YANDEX_DELIVERY_LEGACY_SANDBOX_API_BASE_URL },
    })).base_url).toBe(YANDEX_DELIVERY_SANDBOX_API_BASE_URL)
  })

  it("maps platform host overrides to documented legacy check-price host", () => {
    expect(resolveYandexDeliveryLegacyApiBaseUrl(buildConnection({
      mode: "test",
      config: { api_base_url: YANDEX_DELIVERY_SANDBOX_API_BASE_URL },
    })).base_url).toBe(YANDEX_DELIVERY_LEGACY_SANDBOX_API_BASE_URL)
  })

  it("uses documented pickup-points list path and empty body for connection test", async () => {
    const calls: Array<{ url: string; body: unknown }> = []
    global.fetch = jest.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      calls.push({
        url: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      })

      return new Response(JSON.stringify({ points: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }) as typeof fetch

    await createYandexDeliveryAdapter().testConnection({
      connection: buildConnection({ mode: "test" }),
      correlation_id: "corr-yandex-docs-test",
    })

    expect(calls).toEqual([
      {
        url: `${YANDEX_DELIVERY_SANDBOX_API_BASE_URL}${YANDEX_DELIVERY_API_PATH.pickupPointsList}`,
        body: {},
      },
    ])
  })

  it("uses documented offers info self-pickup path with non-empty places for pickup windows", async () => {
    const calls: Array<{ url: string; body: any }> = []
    global.fetch = jest.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      calls.push({
        url: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      })

      return new Response(JSON.stringify({
        offers: [
          {
            from: "2026-01-18T07:00:00.000000Z",
            to: "2026-01-18T15:00:00.000000Z",
          },
        ],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }) as typeof fetch

    const windows = await createYandexDeliveryAdapter().listPickupWindows(
      {
        connection: buildConnection({ mode: "test" }),
        correlation_id: "corr-yandex-window-test",
      },
      {
        warehouse_id: "ya-wh-1",
        destination_point_id: "pvz_1",
        items: [{ weight_grams: 500 }],
      }
    )

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(`${YANDEX_DELIVERY_SANDBOX_API_BASE_URL}${YANDEX_DELIVERY_API_PATH.offersInfo}?last_mile_policy=self_pickup`)
    expect(calls[0].body).toMatchObject({
      source: {
        platform_station_id: "ya-wh-1",
      },
      destination: {
        platform_station_id: "pvz_1",
      },
    })
    expect(Array.isArray(calls[0].body.places)).toBe(true)
    expect(calls[0].body.places).toHaveLength(1)
    expect(calls[0].body.places).not.toEqual([])
    expect(windows).toEqual([
      {
        date: "2026-01-18",
        time_from: "07:00",
        time_to: "15:00",
        interval_utc: {
          from: "2026-01-18T07:00:00.000000Z",
          to: "2026-01-18T15:00:00.000000Z",
        },
        label: "2026-01-18 07:00-15:00",
        metadata: {},
      },
    ])
  })

  it("uses documented check-price flat route-point shape for warehouse to PVZ quote", async () => {
    const calls: Array<{ url: string; headers: Record<string, string>; body: any }> = []
    global.fetch = jest.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      calls.push({
        url: String(url),
        headers: init?.headers as Record<string, string>,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      })

      return new Response(JSON.stringify({
        price: 499.5,
        currency_rules: { code: "RUB" },
        distance_meters: 1500,
        eta: 60,
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }) as typeof fetch

    const quotes = await createYandexDeliveryAdapter().quoteWarehouseToPickupPoint(
      {
        connection: buildConnection({ mode: "test" }),
        correlation_id: "corr-yandex-check-price-test",
      },
      {
        warehouse_id: "ya-wh-1",
        destination_point_id: "pvz_1",
        origin_address: {
          fullname: "RU, Москва, Склад 1",
          coordinates: [37.62, 55.76],
          contact: { name: "Seller", phone: "+79990000000" },
        },
        destination_address: {
          fullname: "125009, Москва, Тверская 1",
          coordinates: [37.61, 55.75],
          contact: { name: "Buyer", phone: "+79990000001" },
        },
        interval_utc: {
          from: "2026-01-18T07:00:00.000Z",
          to: "2026-01-18T10:00:00.000Z",
        },
        items: [{ weight_grams: 500, price: 100 }],
      }
    )

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(`${YANDEX_DELIVERY_LEGACY_SANDBOX_API_BASE_URL}${YANDEX_DELIVERY_LEGACY_API_PATH.checkPrice}`)
    expect(calls[0].headers).toMatchObject({
      Accept: "application/json",
      "Accept-Language": "ru",
      "Content-Type": "application/json",
    })
    expect(calls[0].body).toMatchObject({
      route_points: [
        {
          id: 1,
          type: "source",
          fullname: "RU, Москва, Склад 1",
          coordinates: [37.62, 55.76],
          contact: {
            name: "Seller",
            phone: "+79990000000",
          },
        },
        {
          id: 2,
          type: "destination",
          fullname: "125009, Москва, Тверская 1",
          coordinates: [37.61, 55.75],
          contact: {
            name: "Buyer",
            phone: "+79990000001",
          },
        },
      ],
      items: [
        {
          title: "Delivery Hub item 1",
          quantity: 1,
          cost_currency: "RUB",
          cost_value: "100",
          weight: 0.5,
          size: {
            length: 0.1,
            width: 0.1,
            height: 0.1,
          },
        },
      ],
      places: [
        {
          physical_dims: {
            dx: 1,
            dy: 1,
            dz: 1,
            weight_gross: 500,
          },
        },
      ],
      billing_info: {
        payment_method: "already_paid",
      },
    })
    expect(calls[0].body.route_points[0]).not.toHaveProperty("address")
    expect(calls[0].body).not.toHaveProperty("source")
    expect(calls[0].body).not.toHaveProperty("destination")
    expect(calls[0].body).not.toHaveProperty("merchant_id")
    expect(calls[0].body).not.toHaveProperty("platform_station_id")
    expect(calls[0].body).not.toHaveProperty("last_mile_policy")
    expect(quotes).toEqual([
      expect.objectContaining({
        amount: 499.5,
        currency_code: "rub",
        mode_code: "warehouse_to_pickup_point",
        pickup_point_required: true,
        pickup_window_required: false,
        raw_reference: expect.objectContaining({
          provider_price_endpoint: "check-price",
          distance_meters: 1500,
        }),
      }),
    ])
    expect(JSON.stringify(quotes[0].raw_reference)).not.toContain("offer_id")
  })

  it("fails with validation error before provider call when check-price origin address is missing", async () => {
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>
    global.fetch = fetchMock

    await expect(createYandexDeliveryAdapter().quoteWarehouseToPickupPoint(
      {
        connection: buildConnection({ mode: "test" }),
        correlation_id: "corr-yandex-missing-origin-test",
      },
      {
        warehouse_id: "ya-wh-1",
        destination_point_id: "pvz_1",
        destination_address: {
          fullname: "125009, Москва, Тверская 1",
        },
        items: [{ weight_grams: 500, price: 100 }],
      }
    )).rejects.toMatchObject({
      code: "DELIVERY_HUB_VALIDATION_ERROR",
      status: 400,
      details: {
        field: "origin_address",
      },
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("surfaces safe provider 409 diagnostics from check-price without raw provider body", async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({
      code: "estimating.claim.no_zone_id",
      message: "errors.suitable_offer_not_found",
      raw_offer_id: "raw-offer-id-should-not-leak",
      quote_reference: "raw-quote-reference-should-not-leak",
    }), {
      status: 409,
      headers: { "content-type": "application/json" },
    })) as typeof fetch

    let capturedError: unknown = null

    try {
      await createYandexDeliveryAdapter().quoteWarehouseToPickupPoint(
        {
          connection: buildConnection({ mode: "test" }),
          correlation_id: "corr-yandex-safe-409-test",
        },
        {
          warehouse_id: "wh-internal-id",
          destination_point_id: "pvz_1",
          origin_address: {
            fullname: "RU, Москва, Склад 1",
            coordinates: [37.62, 55.76],
          },
          destination_address: {
            fullname: "125009, Москва, Тверская 1",
            coordinates: [37.61, 55.75],
          },
          items: [{ weight_grams: 500, price: 100 }],
        }
      )
    } catch (error) {
      capturedError = error
    }

    expect(capturedError).toMatchObject({
      code: "DELIVERY_HUB_PROVIDER_ERROR",
      status: 409,
      details: expect.objectContaining({
        provider_status: 409,
        error_category: "provider_route_unavailable",
        provider_code: "estimating.claim.no_zone_id",
        customer_safe: true,
        operator_hint: expect.stringContaining("origin→PVZ route"),
        request: expect.objectContaining({
          path: YANDEX_DELIVERY_LEGACY_API_PATH.checkPrice,
        }),
        response: expect.objectContaining({
          body_type: "json",
          provider_code: "estimating.claim.no_zone_id",
          redacted: true,
          body: undefined,
        }),
      }),
    })
    expect(JSON.stringify(capturedError)).not.toContain("raw-offer-id-should-not-leak")
    expect(JSON.stringify(capturedError)).not.toContain("raw-quote-reference-should-not-leak")
  })

  it("surfaces safe actionable diagnostics when check-price rejects route shape with provider 400", async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({
      message: "route_points are not serviceable for selected pickup station",
      raw_offer_id: "raw-offer-id-should-not-leak",
      quote_reference: "raw-quote-reference-should-not-leak",
    }), {
      status: 400,
      headers: { "content-type": "application/json" },
    })) as typeof fetch

    let capturedError: unknown = null

    try {
      await createYandexDeliveryAdapter().quoteWarehouseToPickupPoint(
        {
          connection: buildConnection({ mode: "test" }),
          correlation_id: "corr-yandex-safe-400-test",
        },
        {
          warehouse_id: "wh-internal-id",
          destination_point_id: "pvz_1",
          origin_address: {
            fullname: "RU, Москва, Склад 1",
            coordinates: [37.62, 55.76],
          },
          destination_address: {
            fullname: "125009, Москва, Тверская 1",
            coordinates: [37.61, 55.75],
          },
          items: [{ weight_grams: 500, price: 100 }],
        }
      )
    } catch (error) {
      capturedError = error
    }

    expect(capturedError).toMatchObject({
      code: "DELIVERY_HUB_PROVIDER_ERROR",
      status: 409,
      details: expect.objectContaining({
        provider_status: 400,
        error_category: "provider_route_unavailable",
        provider_code: null,
        customer_safe: true,
        operator_hint: expect.stringContaining("origin→PVZ route"),
        request: expect.objectContaining({
          path: YANDEX_DELIVERY_LEGACY_API_PATH.checkPrice,
        }),
        response: expect.objectContaining({
          body_type: "json",
          provider_code: null,
          redacted: true,
          body: undefined,
        }),
      }),
    })
    expect(JSON.stringify(capturedError)).not.toContain("route_points are not serviceable")
    expect(JSON.stringify(capturedError)).not.toContain("raw-offer-id-should-not-leak")
    expect(JSON.stringify(capturedError)).not.toContain("raw-quote-reference-should-not-leak")
  })
})

function buildConnection(input: {
  mode: "test" | "live"
  config?: Record<string, unknown>
}): DeliveryConnectionRecord {
  process.env.DELIVERY_HUB_ENCRYPTION_KEY = Buffer.alloc(32, 4).toString("base64")

  return {
    id: `conn_${input.mode}`,
    provider_code: "yandex",
    name: "Yandex",
    mode: input.mode,
    enabled: true,
    status: "active",
    country_code: "RU",
    credentials_state: "sealed",
    credentials_fingerprint: "fingerprint",
    credentials_last_validated_at: null,
    credentials_last_error_code: null,
    credentials_envelope: encryptDeliveryHubCredentials(
      { token: "test-token-not-real" },
      { mode: "sealed", key: Buffer.alloc(32, 4) }
    ),
    config: input.config ?? {},
    metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  }
}
