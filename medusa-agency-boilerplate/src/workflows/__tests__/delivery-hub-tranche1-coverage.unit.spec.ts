import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import {
  DELIVERY_HUB_CONNECTION_STATUS,
  DELIVERY_HUB_CREDENTIALS_STATE,
  DELIVERY_HUB_MODE_CODE,
  DELIVERY_HUB_PROVIDER_YANDEX,
} from "../../modules/delivery-hub/constants"
import { createYandexDeliveryAdapter } from "../../modules/delivery-hub/adapters/yandex"
import { YandexDeliveryClient } from "../../modules/delivery-hub/adapters/yandex/client"
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
          payment_methods: ["card", "cash"],
        },
      ],
    })

    const result = await adapter.listPickupPoints(createAdapterContext(), {
      city: "Moscow",
      country_code: "RU",
    })

    expect(postSpy).toHaveBeenCalledWith(
      "/pickup-points/list",
      {
        city: "Moscow",
        country: "RU",
      },
      "corr_1"
    )
    expect(result).toEqual([
      {
        provider_point_id: "501",
        provider_point_code: "PVZ-501",
        name: "Main pickup point",
        address: "Tverskaya 1",
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
        },
      },
    ])
  })

  it("normalizes pickup windows through the adapter without live HTTP", async () => {
    const adapter = createYandexDeliveryAdapter()
    const postSpy = jest.spyOn(YandexDeliveryClient.prototype, "post").mockResolvedValue({
      options: [
        {
          date: " 2026-04-22 ",
          time_from: " 10:00 ",
          time_to: " 14:00 ",
          interval_utc: {
            from: " 2026-04-22T07:00:00.000Z ",
            to: " 2026-04-22T11:00:00.000Z ",
          },
        },
      ],
    })

    const result = await adapter.listPickupWindows(createAdapterContext(), {
      warehouse_id: "ya-wh-1",
    })

    expect(postSpy).toHaveBeenCalledWith(
      "/pickups/pickup-options",
      {
        warehouse_id: "ya-wh-1",
      },
      "corr_1"
    )
    expect(result).toEqual([
      {
        date: "2026-04-22",
        time_from: "10:00",
        time_to: "14:00",
        interval_utc: {
          from: "2026-04-22T07:00:00.000Z",
          to: "2026-04-22T11:00:00.000Z",
        },
        label: "2026-04-22 10:00-14:00",
        metadata: {},
      },
    ])
  })

  it("maps warehouse and dropoff quote payloads through mock adapter responses without live HTTP", async () => {
    const adapter = createYandexDeliveryAdapter()
    const postSpy = jest
      .spyOn(YandexDeliveryClient.prototype, "post")
      .mockResolvedValueOnce({
        options: [
          {
            date: "2026-04-22",
            time_from: "10:00",
            time_to: "14:00",
            interval_utc: {
              from: "2026-04-22T07:00:00.000Z",
              to: "2026-04-22T11:00:00.000Z",
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        offers: [
          {
            offer_id: null,
            price: {
              amount: "499",
              currency: "RUB",
            },
            eta: {
              days_min: 1,
              days_max: 2,
            },
          },
        ],
      })
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
      currency_code: "RUB",
    })
    const dropoffQuotes = await adapter.quoteDropoffPointToPickupPoint(createAdapterContext(), {
      origin_point_id: "dropoff_1",
      destination_point_id: "pvz_1",
      currency_code: "USD",
    })

    expect(postSpy).toHaveBeenNthCalledWith(
      1,
      "/pickups/pickup-options",
      {
        warehouse_id: "ya-wh-1",
      },
      "corr_1"
    )
    expect(postSpy).toHaveBeenNthCalledWith(
      2,
      "/pricing-calculator",
      {
        source: {
          warehouse_id: "ya-wh-1",
          interval_utc: {
            from: "2026-04-22T07:00:00.000Z",
            to: "2026-04-22T11:00:00.000Z",
          },
        },
        destination: {
          pickup_point_id: "pvz_1",
        },
        items: [],
        currency: "RUB",
        last_mile_policy: "self_pickup",
      },
      "corr_1"
    )
    expect(postSpy).toHaveBeenNthCalledWith(
      3,
      "/offers/create",
      {
        source: {
          pickup_point_id: "dropoff_1",
        },
        destination: {
          pickup_point_id: "pvz_1",
        },
        items: [],
        currency: "USD",
        last_mile_policy: "self_pickup",
      },
      "corr_1"
    )

    expect(warehouseQuotes).toEqual([
      {
        carrier_code: DELIVERY_HUB_PROVIDER_YANDEX,
        carrier_label: "Yandex Delivery",
        mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
        quote_key: `${DELIVERY_HUB_PROVIDER_YANDEX}:${DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint}:pvz_1`,
        amount: 499,
        currency_code: "rub",
        delivery_eta_min: 1,
        delivery_eta_max: 2,
        pickup_point_required: true,
        pickup_point_ids: ["pvz_1"],
        pickup_points_embedded: [],
        pickup_window_required: true,
        pickup_window_options: [
          {
            date: "2026-04-22",
            time_from: "10:00",
            time_to: "14:00",
            interval_utc: {
              from: "2026-04-22T07:00:00.000Z",
              to: "2026-04-22T11:00:00.000Z",
            },
            label: "2026-04-22 10:00-14:00",
            metadata: {},
          },
        ],
        raw_reference: {
          provider_offer_id: null,
          provider: DELIVERY_HUB_PROVIDER_YANDEX,
        },
      },
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
})

describe("Delivery Hub service contract seams", () => {
  it("records successful connection tests with pickup-point sampling via service seam", async () => {
    const connection = createConnectionRecord({
      enabled: true,
      status: "draft",
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
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

    const upsertCall = pg.calls.find((call) => call.sql.includes("insert into delivery_connections"))
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
      mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
      destination_point_id: "pvz_1",
      origin_point_id: "dropoff_1",
      warehouse_id: null,
      provider_warehouse_id: null,
      interval_utc: null,
    })
    expect(JSON.parse(String(eventLogCall?.params[7]))).toEqual({
      quotes_count: 1,
      quote_keys: ["quote_dropoff_1"],
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
