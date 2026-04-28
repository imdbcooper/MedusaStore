import { afterEach, describe, expect, it, jest } from "@jest/globals"
import {
  createYandexDeliveryAdapter,
} from "../../modules/delivery-hub/adapters/yandex"
import {
  YANDEX_DELIVERY_API_PATH,
  YANDEX_DELIVERY_LEGACY_SANDBOX_API_BASE_URL,
  YANDEX_DELIVERY_PRODUCTION_API_BASE_URL,
  YANDEX_DELIVERY_SANDBOX_API_BASE_URL,
} from "../../modules/delivery-hub/adapters/yandex/endpoints"
import { resolveYandexDeliveryApiBaseUrl } from "../../modules/delivery-hub/adapters/yandex/base-url"
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

  it("uses documented offers/create shape for warehouse to PVZ quote", async () => {
    const calls: Array<{ url: string; body: any }> = []
    global.fetch = jest.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      calls.push({
        url: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      })

      return new Response(JSON.stringify({
        offers: [
          {
            offer_id: "offer-docs-warehouse-1",
            offer_details: {
              delivery_interval: {
                min: "2026-01-19T07:00:00.000000Z",
                max: "2026-01-20T15:00:00.000000Z",
                policy: "self_pickup",
              },
              pricing_total: "499.50 RUB",
            },
          },
        ],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }) as typeof fetch

    const quotes = await createYandexDeliveryAdapter().quoteWarehouseToPickupPoint(
      {
        connection: buildConnection({ mode: "test" }),
        correlation_id: "corr-yandex-offer-test",
      },
      {
        warehouse_id: "ya-wh-1",
        destination_point_id: "pvz_1",
        items: [{ weight_grams: 500, price: 100 }],
      }
    )

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(`${YANDEX_DELIVERY_SANDBOX_API_BASE_URL}${YANDEX_DELIVERY_API_PATH.offersCreate}`)
    expect(calls[0].body).toMatchObject({
      source: {
        platform_station: {
          platform_id: "ya-wh-1",
        },
      },
      destination: {
        type: "platform_station",
        platform_station: {
          platform_id: "pvz_1",
        },
        custom_location: null,
        interval_utc: null,
      },
      items: [
        {
          count: 1,
          place_barcode: "DH-DIAG-PLACE-1",
          billing_details: {
            unit_price: 100,
            assessed_unit_price: 100,
          },
        },
      ],
      places: [
        {
          barcode: "DH-DIAG-PLACE-1",
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
        delivery_cost: 0,
      },
      recipient_info: {
        first_name: "Delivery",
        last_name: "Hub",
        phone: "+79990000000",
        email: "delivery-hub-quote@example.invalid",
      },
      last_mile_policy: "self_pickup",
    })
    expect(calls[0].body.source).not.toHaveProperty("interval_utc")
    expect(calls[0].body.items[0].place_barcode).toBe(calls[0].body.places[0].barcode)
    expect(calls[0].body).not.toHaveProperty("tariff")
    expect(quotes).toEqual([
      expect.objectContaining({
        quote_key: "offer-docs-warehouse-1",
        amount: 499.5,
        currency_code: "rub",
        pickup_window_required: false,
      }),
    ])
  })

  it("adds source interval only when both from and to are provided", async () => {
    const calls: Array<{ url: string; body: any }> = []
    global.fetch = jest.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      calls.push({
        url: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      })

      return new Response(JSON.stringify({
        offers: [
          {
            offer_id: "offer-with-interval",
            offer_details: {
              pricing: "500 RUB",
            },
          },
        ],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }) as typeof fetch

    await createYandexDeliveryAdapter().quoteWarehouseToPickupPoint(
      {
        connection: buildConnection({ mode: "test" }),
        correlation_id: "corr-yandex-offer-interval-test",
      },
      {
        warehouse_id: "ya-wh-1",
        destination_point_id: "pvz_1",
        interval_utc: {
          from: "2026-01-18T07:00:00.000Z",
          to: "2026-01-18T10:00:00.000Z",
        },
      }
    )

    expect(calls[0].body.source.interval_utc).toEqual({
      from: "2026-01-18T07:00:00.000Z",
      to: "2026-01-18T10:00:00.000Z",
    })
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
