import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import {
  DELIVERY_HUB_CONNECTION_STATUS,
  DELIVERY_HUB_CREDENTIALS_STATE,
  DELIVERY_HUB_MODE_CODE,
  DELIVERY_HUB_PROVIDER_YANDEX,
} from "../../modules/delivery-hub/constants"
import { createYandexDeliveryAdapter } from "../../modules/delivery-hub/adapters/yandex"
import { YandexDeliveryClient } from "../../modules/delivery-hub/adapters/yandex/client"
import {
  YANDEX_DELIVERY_PRODUCTION_API_BASE_URL,
  YANDEX_DELIVERY_SANDBOX_API_BASE_URL,
  resolveYandexDeliveryApiBaseUrl,
} from "../../modules/delivery-hub/adapters/yandex/base-url"
import { DeliveryHubService } from "../../modules/delivery-hub/service"
import {
  createCredentialsFingerprint,
  decryptDeliveryHubCredentials,
  encryptDeliveryHubCredentials,
} from "../../modules/delivery-hub/security/encryption"
import { redactRecord } from "../../modules/delivery-hub/security/redaction"
import { getDeliveryHubAdapter } from "../../modules/delivery-hub/registry"

const originalEncryptionKey = process.env.DELIVERY_HUB_ENCRYPTION_KEY

beforeEach(() => {
  jest.restoreAllMocks()
})

afterEach(() => {
  if (typeof originalEncryptionKey === "string") {
    process.env.DELIVERY_HUB_ENCRYPTION_KEY = originalEncryptionKey
    return
  }

  delete process.env.DELIVERY_HUB_ENCRYPTION_KEY
})

describe("Delivery Hub security boundaries", () => {
  it("produces unique sealed envelopes for the same token while preserving round-trip and deterministic fingerprint", () => {
    const state = {
      mode: "sealed" as const,
      key: Buffer.alloc(32, 17),
    }
    const credentials = {
      token: "test-token-123456",
    }

    const first = encryptDeliveryHubCredentials(credentials, state)
    const second = encryptDeliveryHubCredentials(credentials, state)

    expect(first.version).toBe("dh.v1")
    expect(second.version).toBe("dh.v1")
    expect(first.mode).toBe("sealed")
    expect(second.mode).toBe("sealed")
    expect(first.iv).not.toBe(second.iv)
    expect(first.tag).not.toBe(second.tag)
    expect(first.ciphertext).not.toBe(second.ciphertext)

    const firstRoundTrip = decryptDeliveryHubCredentials(first, state)
    const secondRoundTrip = decryptDeliveryHubCredentials(second, state)

    expect(firstRoundTrip).toEqual(credentials)
    expect(secondRoundTrip).toEqual(credentials)
    expect(createCredentialsFingerprint(firstRoundTrip)).toBe(
      createCredentialsFingerprint(secondRoundTrip)
    )
  })

  it("redacts nested credential-like payloads while preserving safe context fields", () => {
    const redacted = redactRecord({
      correlation_id: "corr_123",
      request: {
        headers: {
          Authorization: "Bearer secret-token-123",
          "x-api-key": "secret-api-key-456",
        },
        body: {
          token: "secret-token-123",
          nested: {
            notes: 'payload={"access_token":"secret-token-123"}',
          },
        },
      },
      summary: "Authorization: Bearer secret-token-123; x-api-key=secret-api-key-456",
    })

    expect(redacted).toEqual({
      correlation_id: "corr_123",
      request: {
        headers: {
          Authorization: "***",
          "x-api-key": "***",
        },
        body: {
          token: "***",
          nested: {
            notes: 'payload={"access_token":"***"}',
          },
        },
      },
      summary: "Authorization: Bearer ***; x-api-key=***",
    })
  })
})

describe("Delivery Hub direct Yandex adapter mapping", () => {
  it("normalizes pickup point payloads through the adapter without live HTTP", async () => {
    const adapter = createYandexDeliveryAdapter()
    const postSpy = jest.spyOn(YandexDeliveryClient.prototype, "post").mockResolvedValue({
      points: [
        {
          id: 501,
          code: " PVZ-501 ",
          operator_id: "market_l4g",
          operator_station_id: "station-501",
          type: "pickup_point",
          name: " Main pickup point ",
          address: {
            full_address: " Tverskaya 1 ",
            locality: " Moscow ",
            province: " Moscow ",
            zip_code: " 101000 ",
            latitude: "55.75",
            longitude: "37.61",
          },
          available_for_dropoff: true,
          is_yandex_branded: true,
          is_market_partner: true,
          payment_methods: ["card", "cash"],
        },
      ],
    })

    const result = await adapter.listPickupPoints(createAdapterContext(), {
      geo_id: 213,
      operator_ids: ["market_l4g"],
      station_type: "pickup_point",
      is_yandex_branded: true,
    })

    expect(postSpy).toHaveBeenCalledWith(
      "/pickup-points/list",
      {
        geo_id: 213,
        operator_ids: ["market_l4g"],
        type: "pickup_point",
        is_yandex_branded: true,
      },
      "corr_1"
    )
    expect(result).toEqual([
      {
        provider_point_id: "501",
        provider_point_code: "PVZ-501",
        provider_operator_id: "market_l4g",
        network_label: "Яндекс Маркет",
        is_yandex_branded: true,
        is_market_partner: true,
        station_type: "pickup_point",
        name: "Main pickup point",
        address: "Moscow, Tverskaya 1",
        city: "Moscow",
        region: "Moscow",
        postal_code: "101000",
        lat: 55.75,
        lng: 37.61,
        is_origin_dropoff_allowed: true,
        is_destination_pickup_allowed: true,
        payment_methods: ["card", "cash"],
        metadata: {
          available_for_dropoff: true,
          operator_id: "market_l4g",
          operator_station_id: "station-501",
          station_type: "pickup_point",
          is_yandex_branded: true,
          is_market_partner: true,
          network_label: "Яндекс Маркет",
        },
      },
    ])
  })

  it("normalizes pickup windows through the adapter without live HTTP", async () => {
    const adapter = createYandexDeliveryAdapter()
    const postSpy = jest.spyOn(YandexDeliveryClient.prototype, "post").mockResolvedValue({
      offers: [
        {
          from: " 2026-04-22T07:00:00.000Z ",
          to: " 2026-04-22T11:00:00.000Z ",
        },
      ],
    })

    const result = await adapter.listPickupWindows(createAdapterContext(), {
      warehouse_id: "ya-wh-1",
    })

    expect(postSpy).toHaveBeenCalledWith(
      "/offers/info?last_mile_policy=self_pickup",
      {
        source: {
          platform_station_id: "ya-wh-1",
        },
        places: [
          {
            physical_dims: {
              dx: 1,
              dy: 1,
              dz: 1,
              weight_gross: 1,
            },
          },
        ],
      },
      "corr_1"
    )
    expect(result).toEqual([
      {
        date: "2026-04-22",
        time_from: "07:00",
        time_to: "11:00",
        interval_utc: {
          from: "2026-04-22T07:00:00.000Z",
          to: "2026-04-22T11:00:00.000Z",
        },
        label: "2026-04-22 07:00-11:00",
        metadata: {},
      },
    ])
  })

  it("maps warehouse check-price and dropoff offer payloads through mock adapter responses without live HTTP", async () => {
    const adapter = createYandexDeliveryAdapter()
    const postLegacySpy = jest
      .spyOn(YandexDeliveryClient.prototype, "postLegacy")
      .mockResolvedValueOnce({
        price: "499",
        currency_rules: {
          code: "RUB",
        },
        eta: 2880,
      })
    const postSpy = jest
      .spyOn(YandexDeliveryClient.prototype, "post")
      .mockResolvedValueOnce({
        offers: [
          {
            offer_id: "offer-dropoff-1",
            price: {
              amount: 799,
              currency: "USD",
            },
            eta: {
              days_min: 3,
              days_max: null,
            },
          },
        ],
      })

    const warehouseQuotes = await adapter.quoteWarehouseToPickupPoint(createAdapterContext(), {
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
        from: "2026-04-22T07:00:00.000Z",
        to: "2026-04-22T11:00:00.000Z",
      },
      currency_code: "RUB",
    })
    const dropoffQuotes = await adapter.quoteDropoffPointToPickupPoint(createAdapterContext(), {
      origin_point_id: "dropoff_1",
      destination_point_id: "pvz_1",
      currency_code: "USD",
    })

    expect(postLegacySpy).toHaveBeenCalledWith(
      "/check-price",
      expect.objectContaining({
        route_points: [
          expect.objectContaining({
            id: 1,
            type: "source",
            fullname: "RU, Москва, Склад 1",
            coordinates: [37.62, 55.76],
          }),
          expect.objectContaining({
            id: 2,
            type: "destination",
            fullname: "125009, Москва, Тверская 1",
            coordinates: [37.61, 55.75],
          }),
        ],
        billing_info: {
          payment_method: "already_paid",
        },
      }),
      "corr_1"
    )
    expect(postLegacySpy.mock.calls[0][1]).toMatchObject({
      items: [
        {
          title: "Delivery Hub item 1",
          quantity: 1,
          cost_currency: "RUB",
          cost_value: "0",
          weight: 1,
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
            weight_gross: 1,
          },
        },
      ],
      billing_info: {
        payment_method: "already_paid",
      },
    })
    expect(postSpy).toHaveBeenCalledWith(
      "/offers/create",
      expect.objectContaining({
        source: {
          platform_station: {
            platform_id: "dropoff_1",
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
        last_mile_policy: "self_pickup",
      }),
      "corr_1"
    )

    expect(warehouseQuotes).toEqual([
      expect.objectContaining({
        carrier_code: DELIVERY_HUB_PROVIDER_YANDEX,
        carrier_label: "Yandex Delivery",
        mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
        amount: 499,
        currency_code: "rub",
        delivery_eta_min: 2,
        delivery_eta_max: 2,
        pickup_point_required: true,
        pickup_point_ids: ["pvz_1"],
        pickup_points_embedded: [],
        pickup_window_required: false,
        pickup_window_options: [],
        raw_reference: {
          provider_price_endpoint: "check-price",
          provider: DELIVERY_HUB_PROVIDER_YANDEX,
        },
      }),
    ])

    expect(dropoffQuotes).toEqual([
      {
        carrier_code: DELIVERY_HUB_PROVIDER_YANDEX,
        carrier_label: "Yandex Delivery",
        mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
        quote_key: "offer-dropoff-1",
        amount: 799,
        currency_code: "usd",
        delivery_eta_min: 3,
        delivery_eta_max: 3,
        pickup_point_required: true,
        pickup_point_ids: ["pvz_1"],
        pickup_points_embedded: [],
        pickup_window_required: false,
        pickup_window_options: [],
        raw_reference: {
          provider_offer_id: "offer-dropoff-1",
          provider: DELIVERY_HUB_PROVIDER_YANDEX,
        },
      },
    ])
  })

  it("fails closed when a 200 quote response is missing an offers array", async () => {
    const adapter = createYandexDeliveryAdapter()
    jest.spyOn(YandexDeliveryClient.prototype, "post").mockResolvedValue({})

    await expect(adapter.quoteDropoffPointToPickupPoint(createAdapterContext(), {
      origin_point_id: "dropoff_1",
      destination_point_id: "pvz_1",
      currency_code: "RUB",
    })).rejects.toMatchObject({
      code: "DELIVERY_HUB_PROVIDER_ERROR",
      status: 502,
      details: {
        provider_status: "ok",
        error_category: "provider_shape",
        expected_array: "offers",
        reason: "expected_array_missing",
      },
    })
  })

  it("does not accept unrelated items as quote offers", async () => {
    const adapter = createYandexDeliveryAdapter()
    jest.spyOn(YandexDeliveryClient.prototype, "post").mockResolvedValue({
      items: [
        {
          offer_id: "unrelated-item-offer",
          price: {
            amount: 10,
            currency: "RUB",
          },
        },
      ],
    })

    await expect(adapter.quoteDropoffPointToPickupPoint(createAdapterContext(), {
      origin_point_id: "dropoff_1",
      destination_point_id: "pvz_1",
      currency_code: "RUB",
    })).rejects.toMatchObject({
      code: "DELIVERY_HUB_PROVIDER_ERROR",
      details: {
        error_category: "provider_shape",
        expected_array: "offers",
        response_shape: {
          keys: ["items"],
        },
      },
    })
  })

  it.each([
    ["missing price", { offer_id: "offer-1", price: { currency: "RUB" } }, "price.amount|offer_details.pricing_total"],
    ["missing id", { price: { amount: 0, currency: "RUB" } }, "offer_id"],
    ["missing currency", { offer_id: "offer-1", price: { amount: 10 } }, "price.currency|offer_details.pricing_total"],
  ])("rejects malformed quote offers instead of producing zero or synthetic quotes: %s", async (_case, offer, expectedField) => {
    const adapter = createYandexDeliveryAdapter()
    jest.spyOn(YandexDeliveryClient.prototype, "post").mockResolvedValue({
      offers: [offer],
    })

    await expect(adapter.quoteDropoffPointToPickupPoint(createAdapterContext(), {
      origin_point_id: "dropoff_1",
      destination_point_id: "pvz_1",
      currency_code: "RUB",
    })).rejects.toMatchObject({
      code: "DELIVERY_HUB_PROVIDER_ERROR",
      status: 502,
      details: {
        provider_status: "ok",
        error_category: "provider_shape",
        expected_field: expectedField,
      },
    })
  })

  it("accepts explicit zero amount when offer id and currency are present", async () => {
    const adapter = createYandexDeliveryAdapter()
    jest.spyOn(YandexDeliveryClient.prototype, "post").mockResolvedValue({
      data: {
        offers: [
          {
            offer_id: "offer-free-1",
            price: {
              amount: 0,
              currency: "RUB",
            },
          },
        ],
      },
    })

    const quotes = await adapter.quoteDropoffPointToPickupPoint(createAdapterContext(), {
      origin_point_id: "dropoff_1",
      destination_point_id: "pvz_1",
      currency_code: "RUB",
    })

    expect(quotes).toEqual([
      expect.objectContaining({
        quote_key: "offer-free-1",
        amount: 0,
        currency_code: "rub",
        raw_reference: {
          provider_offer_id: "offer-free-1",
          provider: DELIVERY_HUB_PROVIDER_YANDEX,
        },
      }),
    ])
  })

  it("normalizes documented offers/create offer_details pricing without legacy price object", async () => {
    const adapter = createYandexDeliveryAdapter()
    jest.spyOn(YandexDeliveryClient.prototype, "post").mockResolvedValue({
      offers: [
        {
          offer_id: "offer-docs-1",
          offer_details: {
            delivery_interval: {
              min: "2026-04-23T07:00:00.000000Z",
              max: "2026-04-24T15:00:00.000000Z",
              policy: "self_pickup",
            },
            pickup_interval: {
              min: "2026-04-22T07:00:00.000000Z",
              max: "2026-04-22T11:00:00.000000Z",
            },
            pricing_total: "1400.96 RUB",
          },
        },
      ],
    })

    const quotes = await adapter.quoteDropoffPointToPickupPoint(createAdapterContext(), {
      origin_point_id: "dropoff_1",
      destination_point_id: "pvz_1",
      currency_code: "RUB",
    })

    expect(quotes).toEqual([
      expect.objectContaining({
        quote_key: "offer-docs-1",
        amount: 1400.96,
        currency_code: "rub",
      }),
    ])
  })

  it("distinguishes valid empty pickup arrays from missing pickup array keys", async () => {
    const adapter = createYandexDeliveryAdapter()
    const postSpy = jest
      .spyOn(YandexDeliveryClient.prototype, "post")
      .mockResolvedValueOnce({ points: [] })
      .mockResolvedValueOnce({})

    await expect(adapter.listPickupPoints(createAdapterContext(), {
      city: "Moscow",
      country_code: "RU",
    })).resolves.toEqual([])

    await expect(adapter.listPickupPoints(createAdapterContext(), {
      city: "Moscow",
      country_code: "RU",
    })).rejects.toMatchObject({
      code: "DELIVERY_HUB_PROVIDER_ERROR",
      details: {
        error_category: "provider_shape",
        expected_array: "points",
        reason: "expected_array_missing",
      },
    })
    expect(postSpy).toHaveBeenCalledTimes(2)
  })
})

  it("normalizes and redacts Yandex provider HTTP errors without leaking auth", async () => {
    process.env.DELIVERY_HUB_ENCRYPTION_KEY = Buffer.alloc(32, 18).toString("base64")
    const client = new YandexDeliveryClient(createConnectionRecord({
      credentials_envelope: encryptDeliveryHubCredentials(
        { token: "client-secret-token" },
        { mode: "sealed", key: Buffer.alloc(32, 18) }
      ),
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
    }) as any)
    const fetchSpy = jest.spyOn(globalThis, "fetch" as any).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: "Authorization: Bearer leaked-token" }),
    } as any)

    await expect(client.post("/pickup-points/list", { token: "payload-secret" }, "corr_1")).rejects.toMatchObject({
      code: "DELIVERY_HUB_CREDENTIALS_INVALID",
      details: {
        provider_status: 401,
        error_category: "auth",
        request: {
          base_url: YANDEX_DELIVERY_SANDBOX_API_BASE_URL,
          base_url_source: "connection_mode",
          connection_mode: "test",
          headers: { Authorization: "***" },
          payload: { token: "***" },
        },
        response: {
          message: "Authorization: Bearer ***",
        },
      },
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledWith(
      `${YANDEX_DELIVERY_SANDBOX_API_BASE_URL}/pickup-points/list`,
      expect.objectContaining({ method: "POST" })
    )
  })

  it("resolves Yandex sandbox host for test mode and production host for live mode", () => {
    expect(resolveYandexDeliveryApiBaseUrl(createConnectionRecord({ mode: "test" }) as any)).toEqual({
      base_url: YANDEX_DELIVERY_SANDBOX_API_BASE_URL,
      source: "connection_mode",
      mode: "test",
    })
    expect(resolveYandexDeliveryApiBaseUrl(createConnectionRecord({ mode: "live" }) as any)).toEqual({
      base_url: YANDEX_DELIVERY_PRODUCTION_API_BASE_URL,
      source: "connection_mode",
      mode: "live",
    })
    expect(resolveYandexDeliveryApiBaseUrl(createConnectionRecord({
      mode: "test",
      config: { api_base_url: YANDEX_DELIVERY_PRODUCTION_API_BASE_URL },
    }) as any)).toEqual({
      base_url: YANDEX_DELIVERY_PRODUCTION_API_BASE_URL,
      source: "connection_config",
      mode: "test",
    })
  })

  it("classifies Yandex 404 no-route responses as route mismatch diagnostics", async () => {
    process.env.DELIVERY_HUB_ENCRYPTION_KEY = Buffer.alloc(32, 18).toString("base64")
    const client = new YandexDeliveryClient(createConnectionRecord({
      credentials_envelope: encryptDeliveryHubCredentials(
        { token: "client-secret-token" },
        { mode: "sealed", key: Buffer.alloc(32, 18) }
      ),
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
      mode: "test",
    }) as any)
    jest.spyOn(globalThis, "fetch" as any).mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ code: "404", message: "No route for URL" }),
    } as any)

    await expect(client.post("/pickup-points/list", { limit: 1 }, "corr_404")).rejects.toMatchObject({
      code: "DELIVERY_HUB_PROVIDER_ERROR",
      status: 502,
      details: {
        provider_status: 404,
        error_category: "provider_route_mismatch",
        operator_hint: expect.stringContaining("path is unavailable"),
        request: {
          base_url: YANDEX_DELIVERY_SANDBOX_API_BASE_URL,
          path: "/pickup-points/list",
        },
        response: {
          code: "404",
          message: "No route for URL",
        },
      },
    })
  })

  it("classifies Yandex 403 HTML access-block responses without persisting raw HTML", async () => {
    process.env.DELIVERY_HUB_ENCRYPTION_KEY = Buffer.alloc(32, 18).toString("base64")
    const client = new YandexDeliveryClient(createConnectionRecord({
      credentials_envelope: encryptDeliveryHubCredentials(
        { token: "client-secret-token" },
        { mode: "sealed", key: Buffer.alloc(32, 18) }
      ),
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
      mode: "test",
    }) as any)
    jest.spyOn(globalThis, "fetch" as any).mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => `<!DOCTYPE html><html><head><title>403</title></head><body><h1>Access to&nbsp;our service has been temporarily blocked.</h1><script>raw-provider-page</script></body></html>`,
    } as any)

    await expect(client.post("/pickup-points/list", { limit: 1 }, "corr_403")).rejects.toMatchObject({
      code: "DELIVERY_HUB_PROVIDER_ERROR",
      status: 502,
      details: {
        provider_status: 403,
        error_category: "provider_access_blocked",
        operator_hint: expect.stringContaining("HTML access-block page"),
        request: {
          base_url: YANDEX_DELIVERY_SANDBOX_API_BASE_URL,
          path: "/pickup-points/list",
          headers: { Authorization: "***" },
        },
        response: {
          body_type: "html",
          html_title: "403",
          access_block_page: true,
        },
      },
    })
  })

  describe("Delivery Hub service contract seams", () => {
    it("records successful connection tests with pickup-point sampling via service seam", async () => {
      const sourceState = {
        mode: "sealed" as const,
        key: Buffer.alloc(32, 18),
      }
      const connection = createConnectionRecord({
        enabled: true,
        status: "draft",
        credentials_envelope: encryptDeliveryHubCredentials(
          {
            token: "test-token-123456",
          },
          sourceState
        ),
        credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.invalid,
        credentials_last_error_code: "DELIVERY_HUB_PROVIDER_ERROR",
      })
    const pg = createMockPg([connection])
    const service = new DeliveryHubService(pg as any)
    const adapter = getDeliveryHubAdapter(DELIVERY_HUB_PROVIDER_YANDEX)
    const testConnectionSpy = jest.spyOn(adapter, "testConnection").mockResolvedValue({
      ok: true,
      provider_code: DELIVERY_HUB_PROVIDER_YANDEX,
      diagnostics: {
        provider_status: "ok",
      },
    })
    const listPickupPointsSpy = jest.spyOn(adapter, "listPickupPoints").mockResolvedValue([
      createPickupPoint("pvz_1"),
      createPickupPoint("pvz_2"),
    ])

    const result = await service.testConnection(connection.id, {
      include_pickup_points: true,
    })

    expect(result).toMatchObject({
      ok: true,
      provider_code: DELIVERY_HUB_PROVIDER_YANDEX,
      diagnostics: {
        provider_status: "ok",
        pickup_points_count: 2,
        correlation_id: expect.any(String),
      },
      diagnostics_summary: {
        status: "ok",
        provider_status: "ok",
        error_category: null,
        correlation_id: expect.any(String),
        redacted: true,
      },
    })
    expect(testConnectionSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        connection,
      })
    )
    expect(listPickupPointsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        connection,
      }),
      {
        country_code: "RU",
      }
    )

    const upsertCall = [...pg.calls].reverse().find((call) => call.sql.includes("insert into delivery_connections"))
    expect(upsertCall?.params[3]).toBe(DELIVERY_HUB_CONNECTION_STATUS.active)
    expect(upsertCall?.params[8]).toBe(DELIVERY_HUB_CREDENTIALS_STATE.sealed)
    expect(typeof upsertCall?.params[10]).toBe("string")
    expect(upsertCall?.params[11]).toBe(null)

    const eventLogCall = pg.calls.find((call) => call.sql.includes("insert into delivery_event_logs"))
    expect(eventLogCall).toBeDefined()
    expect(JSON.parse(String(eventLogCall?.params[6]))).toEqual({
      include_pickup_points: true,
    })
    expect(JSON.parse(String(eventLogCall?.params[7]))).toEqual({
      provider_status: "ok",
      pickup_points_count: 2,
    })
  })

  it("returns dropoff-point test quotes via service seam and logs quote keys without server bootstrap", async () => {
    const connection = createConnectionRecord({
      enabled: true,
      status: "active",
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
    })
    const pg = createMockPg([connection])
    const service = new DeliveryHubService(pg as any)
    const adapter = getDeliveryHubAdapter(DELIVERY_HUB_PROVIDER_YANDEX)
    const quote = {
      carrier_code: DELIVERY_HUB_PROVIDER_YANDEX,
      carrier_label: "Yandex Delivery",
      mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
      quote_key: "quote_dropoff_1",
      amount: 499,
      currency_code: "RUB",
      delivery_eta_min: 1,
      delivery_eta_max: 2,
      pickup_point_required: true,
      pickup_point_ids: ["pvz_1"],
      pickup_points_embedded: [],
      pickup_window_required: false,
      pickup_window_options: [],
      raw_reference: {
        provider_offer_id: "offer_1",
        provider: DELIVERY_HUB_PROVIDER_YANDEX,
      },
    }
    const quoteSpy = jest.spyOn(adapter, "quoteDropoffPointToPickupPoint").mockResolvedValue([quote])

    const result = await service.testQuote({
      connection_id: connection.id,
      mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
      origin_point_id: "dropoff_1",
      destination_point_id: "pvz_1",
      currency_code: "RUB",
      items: [
        {
          quantity: 1,
          weight_grams: 500,
          price: 499,
        },
      ],
    })

    expect(result).toMatchObject({
      ok: true,
      quotes: [quote],
      correlation_id: expect.any(String),
      input_echo: {
        connection_id: connection.id,
        mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
        destination_point_id: "pvz_1",
        origin_point_id: "dropoff_1",
        warehouse_id: null,
        currency_code: "RUB",
        item_count: 1,
      },
      diagnostics_summary: {
        status: "ok",
        provider_status: null,
        error_category: null,
        redacted: true,
      },
      connection: {
        id: connection.id,
        provider_code: DELIVERY_HUB_PROVIDER_YANDEX,
      },
    })
    expect(quoteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        connection,
      }),
      {
        origin_point_id: "dropoff_1",
        destination_point_id: "pvz_1",
        currency_code: "RUB",
        items: [
          {
            quantity: 1,
            weight_grams: 500,
            price: 499,
          },
        ],
      }
    )

    const eventLogCall = pg.calls.find((call) => call.sql.includes("insert into delivery_event_logs"))
    expect(eventLogCall).toBeDefined()
    expect(JSON.parse(String(eventLogCall?.params[6]))).toEqual({
      connection_id: connection.id,
      mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
      destination_point_id: "pvz_1",
      origin_point_id: "dropoff_1",
      warehouse_id: null,
      interval_utc: null,
      currency_code: "RUB",
      item_count: 1,
      provider_warehouse_id_present: false,
    })
    expect(JSON.parse(String(eventLogCall?.params[7]))).toMatchObject({
      quotes_count: 1,
      quote_key_present_count: 1,
      diagnostics_summary: {
        status: "ok",
        redacted: true,
      },
    })
  })
})

function createAdapterContext(): any {
  return {
    connection: createConnectionRecord({
      enabled: true,
      status: "active",
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
    }),
    correlation_id: "corr_1",
  }
}

function createPickupPoint(providerPointId: string) {
  return {
    provider_point_id: providerPointId,
    provider_point_code: providerPointId.toUpperCase(),
    name: `Pickup ${providerPointId}`,
    address: "Tverskaya 1",
    city: "Moscow",
    region: "Moscow",
    postal_code: "101000",
    lat: 55.75,
    lng: 37.61,
    is_origin_dropoff_allowed: false,
    is_destination_pickup_allowed: true,
    payment_methods: ["card"],
    metadata: {},
  }
}

function createConnectionRecord(input?: Partial<any>) {
  return {
    id: "conn_1",
    provider_code: DELIVERY_HUB_PROVIDER_YANDEX,
    name: "Yandex test",
    status: "draft",
    mode: "test",
    enabled: false,
    country_code: "RU",
    credentials_envelope: null,
    credentials_state: "empty",
    credentials_fingerprint: createCredentialsFingerprint({
      token: "test-token-123456",
    }),
    credentials_last_validated_at: null,
    credentials_last_error_code: null,
    config: {},
    metadata: {},
    created_at: "2026-04-20T00:00:00.000Z",
    updated_at: "2026-04-20T00:00:00.000Z",
    ...input,
  }
}

function createMockPg(initialConnections: any[]) {
  const connectionState = new Map(initialConnections.map((connection) => [connection.id, connection]))
  const eventLogs: any[] = []
  const calls: Array<{ sql: string; params: unknown[] }> = []

  return {
    calls,
    async raw(sql: string, params?: unknown[]) {
      const normalizedSql = sql.replace(/\s+/g, " ").trim()
      const normalizedParams = Array.isArray(params) ? params : []
      calls.push({
        sql: normalizedSql,
        params: normalizedParams,
      })

      if (normalizedSql.includes("select * from delivery_connections where id = ? limit 1")) {
        const id = String(normalizedParams[0] ?? "")
        const row = connectionState.get(id)

        return {
          rows: row ? [row] : [],
        }
      }

      if (normalizedSql.includes("insert into delivery_connections")) {
        const nextRecord = {
          ...(connectionState.get(String(normalizedParams[0])) ?? {}),
          id: String(normalizedParams[0]),
          provider_code: normalizedParams[1],
          name: normalizedParams[2],
          status: normalizedParams[3],
          mode: normalizedParams[4],
          enabled: normalizedParams[5],
          country_code: normalizedParams[6],
          credentials_envelope: normalizedParams[7]
            ? JSON.parse(String(normalizedParams[7]))
            : null,
          credentials_state: normalizedParams[8],
          credentials_fingerprint: normalizedParams[9],
          credentials_last_validated_at: normalizedParams[10],
          credentials_last_error_code: normalizedParams[11],
          config: JSON.parse(String(normalizedParams[12] ?? "{}")),
          metadata: JSON.parse(String(normalizedParams[13] ?? "{}")),
          created_at:
            connectionState.get(String(normalizedParams[0]))?.created_at ?? "2026-04-20T00:00:00.000Z",
          updated_at: "2026-04-20T00:00:00.000Z",
        }

        connectionState.set(nextRecord.id, nextRecord)

        return {
          rows: [nextRecord],
        }
      }

      if (normalizedSql.includes("insert into delivery_event_logs")) {
        const record = {
          id: "log_1",
          connection_id: normalizedParams[1],
          provider_code: normalizedParams[2],
          kind: normalizedParams[3],
          correlation_id: normalizedParams[4],
          success: normalizedParams[5],
          request_summary: JSON.parse(String(normalizedParams[6] ?? "{}")),
          response_summary: JSON.parse(String(normalizedParams[7] ?? "{}")),
          error_code: normalizedParams[8] ?? null,
          created_at: "2026-04-20T00:00:00.000Z",
        }

        eventLogs.unshift(record)

        return {
          rows: [record],
        }
      }

      if (
        normalizedSql.includes("create table if not exists delivery_connections") ||
        normalizedSql.includes("create table if not exists delivery_event_logs") ||
        normalizedSql.includes("create table if not exists delivery_warehouses")
      ) {
        return {
          rows: [],
        }
      }

      throw new Error(`Unhandled SQL in test: ${normalizedSql}`)
    },
  }
}
