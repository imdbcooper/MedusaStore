import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import {
  DELIVERY_HUB_CREDENTIALS_STATE,
  DELIVERY_HUB_MODE_CODE,
  DELIVERY_HUB_PROVIDER_YANDEX,
} from "../../modules/delivery-hub/constants"
import { DeliveryHubError } from "../../modules/delivery-hub/errors"
import { getDeliveryHubAdapter, listDeliveryHubProviders } from "../../modules/delivery-hub/registry"
import {
  createCredentialsFingerprint,
  decryptDeliveryHubCredentials,
  encryptDeliveryHubCredentials,
  getDeliveryHubEncryptionState,
} from "../../modules/delivery-hub/security/encryption"
import {
  redactRecord,
  redactSensitiveText,
} from "../../modules/delivery-hub/security/redaction"
import { DeliveryHubService } from "../../modules/delivery-hub/service"

const originalEncryptionKey = process.env.DELIVERY_HUB_ENCRYPTION_KEY

afterEach(() => {
  if (typeof originalEncryptionKey === "string") {
    process.env.DELIVERY_HUB_ENCRYPTION_KEY = originalEncryptionKey
    return
  }

  delete process.env.DELIVERY_HUB_ENCRYPTION_KEY
})

beforeEach(() => {
  jest.restoreAllMocks()
})

describe("Delivery Hub registry", () => {
  it("exposes yandex provider definition and capabilities", () => {
    const providers = listDeliveryHubProviders()
    expect(providers.some((provider) => provider.code === DELIVERY_HUB_PROVIDER_YANDEX)).toBe(true)

    const adapter = getDeliveryHubAdapter(DELIVERY_HUB_PROVIDER_YANDEX)
    expect(adapter.definition).toMatchObject({
      code: DELIVERY_HUB_PROVIDER_YANDEX,
      label: "Yandex Delivery",
      supported_mode_codes: [
        DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
        DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
      ],
    })
    expect(adapter.definition.capabilities).toEqual(
      expect.arrayContaining([
        "test_connection",
        "list_pickup_points",
        "list_pickup_windows",
        "quote_warehouse_to_pickup_point",
        "quote_dropoff_point_to_pickup_point",
      ])
    )
  })

  it("rejects unsupported provider codes", () => {
    expect(() => getDeliveryHubAdapter("unsupported-provider")).toThrow(
      /DELIVERY_HUB_PROVIDER_NOT_SUPPORTED|not supported/
    )
  })
})

describe("Delivery Hub redaction", () => {
  it("masks token-like keys regardless of case or separator", () => {
    const redacted = redactRecord({
      Authorization: "Bearer secret-token-123",
      authorization: "Bearer secret-token-123",
      AUTHORIZATION: "Bearer secret-token-123",
      proxy_authorization: "Basic abc123",
      accessToken: "secret-token-123",
      oauth_token: "secret-token-123",
      xApiKey: "secret-token-123",
      clientSecret: "secret-token-123",
      nested: {
        serviceTicket: "secret-ticket",
        items: [
          {
            X_YA_SERVICE_TICKET: "another-secret-ticket",
          },
        ],
      },
      safe: "visible",
    })

    expect(redacted).toEqual({
      Authorization: "***",
      authorization: "***",
      AUTHORIZATION: "***",
      proxy_authorization: "***",
      accessToken: "***",
      oauth_token: "***",
      xApiKey: "***",
      clientSecret: "***",
      nested: {
        serviceTicket: "***",
        items: [
          {
            X_YA_SERVICE_TICKET: "***",
          },
        ],
      },
      safe: "visible",
    })
  })

  it("sanitizes bearer and inline token fragments in arbitrary strings", () => {
    const text = [
      "Authorization: Bearer secret-token-123",
      'payload={"access_token":"secret-token-123"}',
      "x-api-key=api-key-456",
    ].join("; ")

    expect(redactSensitiveText(text)).toBe(
      'Authorization: Bearer ***; payload={"access_token":"***"}; x-api-key=***'
    )
  })
})

describe("Delivery Hub encryption", () => {
  it("resolves disabled mode when encryption key is missing", () => {
    delete process.env.DELIVERY_HUB_ENCRYPTION_KEY

    expect(getDeliveryHubEncryptionState()).toEqual({
      mode: "disabled",
    })
  })

  it("accepts 32-byte base64 key as sealed mode", () => {
    const key = Buffer.alloc(32, 11)
    process.env.DELIVERY_HUB_ENCRYPTION_KEY = key.toString("base64")

    const state = getDeliveryHubEncryptionState()
    expect(state.mode).toBe("sealed")

    if (state.mode !== "sealed") {
      throw new Error("Expected sealed encryption state")
    }

    expect(state.key.equals(key)).toBe(true)
  })

  it("encrypts and decrypts credentials in sealed mode", () => {
    const state = {
      mode: "sealed" as const,
      key: Buffer.alloc(32, 7),
    }

    const envelope = encryptDeliveryHubCredentials(
      {
        token: "test-token-123456",
      },
      state
    )

    expect(envelope.mode).toBe("sealed")
    expect(envelope.ciphertext).not.toContain("test-token")

    const decrypted = decryptDeliveryHubCredentials(envelope, state)
    expect(decrypted).toEqual({
      token: "test-token-123456",
    })
    expect(createCredentialsFingerprint(decrypted)).toHaveLength(64)
  })

  it("fails fast when encryption is disabled", () => {
    expect(() =>
      encryptDeliveryHubCredentials(
        {
          token: "test-token-123456",
        },
        { mode: "disabled" }
      )
    ).toThrow(/encryption key is not configured/)
  })

  it("rejects decrypting missing credentials envelope", () => {
    try {
      decryptDeliveryHubCredentials(null, {
        mode: "sealed",
        key: Buffer.alloc(32, 3),
      })
      throw new Error("Expected decryption to fail")
    } catch (error) {
      expectDeliveryHubError(error, {
        code: "DELIVERY_HUB_CREDENTIALS_REQUIRED",
        status: 409,
      })
    }
  })

  it("rejects decrypting credentials with invalid auth data", () => {
    const sourceState = {
      mode: "sealed" as const,
      key: Buffer.alloc(32, 9),
    }
    const targetState = {
      mode: "sealed" as const,
      key: Buffer.alloc(32, 5),
    }
    const envelope = encryptDeliveryHubCredentials(
      {
        token: "test-token-123456",
      },
      sourceState
    )

    try {
      decryptDeliveryHubCredentials(envelope, targetState)
      throw new Error("Expected decryption to fail")
    } catch (error) {
      expectDeliveryHubError(error, {
        code: "DELIVERY_HUB_CREDENTIALS_INVALID",
        status: 409,
      })
    }
  })

  it("builds deterministic fingerprint for the same token", () => {
    const first = createCredentialsFingerprint({ token: "same-token" })
    const second = createCredentialsFingerprint({ token: "same-token" })

    expect(first).toBe(second)
    expect(first).toHaveLength(64)
  })
})

describe("Delivery Hub service", () => {
  it("lists providers without touching connection repositories", async () => {
    const service = new DeliveryHubService({
      raw: async () => ({ rows: [] }),
    })

    const providers = await service.listProviders()
    expect(providers).toHaveLength(1)
    expect(providers[0].code).toBe(DELIVERY_HUB_PROVIDER_YANDEX)
  })

  it("lists warehouses and embeds default warehouse into public connection payload", async () => {
    const warehouse = createWarehouseRecord({
      id: "wh_1",
      name: "Main warehouse",
      provider_warehouse_id: "ya-wh-1",
    })
    const connection = createConnectionRecord({
      config: {
        default_warehouse_id: warehouse.id,
      },
    })
    const pg = createMockPg([connection], [], [warehouse])
    const service = new DeliveryHubService(pg as any)

    const [publicConnection] = await service.listConnections()
    const listedWarehouses = await service.listWarehouses()

    expect(listedWarehouses).toHaveLength(1)
    expect(listedWarehouses[0]).toMatchObject({
      id: warehouse.id,
      provider_warehouse_id: "ya-wh-1",
    })
    expect(publicConnection.config).toMatchObject({
      default_warehouse_id: warehouse.id,
      default_warehouse: {
        id: warehouse.id,
        name: "Main warehouse",
        provider_warehouse_id: "ya-wh-1",
      },
    })
  })

  it("uses materialized warehouse mapping for warehouse quote flow", async () => {
    const warehouse = createWarehouseRecord({
      id: "wh_1",
      provider_code: "yandex",
      provider_warehouse_id: "ya-wh-1",
    })
    const connection = createConnectionRecord({
      provider_code: "yandex",
      config: {
        default_warehouse_id: warehouse.id,
      },
    })
    const pg = createMockPg([connection], [], [warehouse])
    const service = new DeliveryHubService(pg as any)
    const adapter = getDeliveryHubAdapter("yandex")
    const quoteSpy = jest
      .spyOn(adapter, "quoteWarehouseToPickupPoint")
      .mockResolvedValue([])

    const response = await service.testQuote({
      connection_id: connection.id,
      mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
      warehouse_id: warehouse.id,
      destination_point_id: "pvz_1",
      currency_code: "RUB",
    })

    expect(response.ok).toBe(true)
    expect(quoteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        connection,
      }),
      expect.objectContaining({
        warehouse_id: "ya-wh-1",
        destination_point_id: "pvz_1",
      })
    )

    quoteSpy.mockRestore()
  })

  it("rejects binding disabled warehouse as connection default", async () => {
    const warehouse = createWarehouseRecord({
      id: "wh_1",
      enabled: false,
    })
    const pg = createMockPg([], [], [warehouse])
    const service = new DeliveryHubService(pg as any)

    await expect(
      service.createConnection({
        provider_code: "yandex",
        name: "Yandex test",
        mode: "test",
        config: {
          default_warehouse_id: warehouse.id,
        },
      })
    ).rejects.toMatchObject({
      code: "DELIVERY_HUB_VALIDATION_ERROR",
      status: 400,
    })
  })

  it("lists event logs with filters and keeps summaries sanitized", async () => {
    const connection = createConnectionRecord()
    const pg = createMockPg([connection], [
      {
        id: "log_1",
        connection_id: connection.id,
        provider_code: "yandex",
        kind: "connection_test",
        correlation_id: "corr-log-1",
        success: false,
        request_summary: {
          Authorization: "Bearer secret-token-123",
        },
        response_summary: {
          payload: '{"access_token":"secret-token-123"}',
        },
        error_code: "DELIVERY_HUB_PROVIDER_ERROR",
        created_at: "2026-04-20T00:00:00.000Z",
      },
    ])
    const service = new DeliveryHubService(pg as any)

    const logs = await service.listEventLogs({
      connection_id: connection.id,
      provider_code: "yandex",
      limit: 20,
    })

    expect(logs).toEqual([
      {
        id: "log_1",
        connection_id: connection.id,
        provider_code: "yandex",
        kind: "connection_test",
        correlation_id: "corr-log-1",
        success: false,
        request_summary: {
          Authorization: "***",
        },
        response_summary: {
          payload: '{"access_token":"***"}',
        },
        error_code: "DELIVERY_HUB_PROVIDER_ERROR",
        created_at: "2026-04-20T00:00:00.000Z",
      },
    ])

    const listCall = pg.calls.find((call) =>
      call.sql.includes("from delivery_event_logs where connection_id = ? and provider_code = ? order by created_at desc, id desc limit ?")
    )
    expect(listCall?.params).toEqual([connection.id, "yandex", 20])
  })

  it("materializes invalid credentials state and redacts persisted diagnostics on decrypt failure", async () => {
    process.env.DELIVERY_HUB_ENCRYPTION_KEY = Buffer.alloc(32, 4).toString("base64")

    const sourceState = {
      mode: "sealed" as const,
      key: Buffer.alloc(32, 9),
    }
    const connection = createConnectionRecord({
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
      credentials_last_validated_at: "2026-04-20T00:00:00.000Z",
      credentials_last_error_code: null,
      credentials_envelope: encryptDeliveryHubCredentials(
        {
          token: "secret-token-123",
        },
        sourceState
      ),
    })
    const pg = createMockPg([connection])
    const service = new DeliveryHubService(pg as any)

    await expect(service.testConnection(connection.id)).rejects.toMatchObject({
      code: "DELIVERY_HUB_CREDENTIALS_INVALID",
      status: 409,
    })

    const upsertCalls = pg.calls.filter((call) => call.sql.includes("insert into delivery_connections"))
    expect(upsertCalls).toHaveLength(1)
    expect(upsertCalls[0].params[8]).toBe(DELIVERY_HUB_CREDENTIALS_STATE.invalid)
    expect(upsertCalls[0].params[10]).toBe(null)
    expect(upsertCalls[0].params[11]).toBe("DELIVERY_HUB_CREDENTIALS_INVALID")

    const eventLogCall = pg.calls.find((call) => call.sql.includes("insert into delivery_event_logs"))
    expect(eventLogCall).toBeDefined()

    const responseSummary = JSON.parse(String(eventLogCall?.params[7])) as {
      message: string
      details?: Record<string, unknown>
    }
    expect(responseSummary.message).toBe("Delivery Hub credentials cannot be decrypted")
    expect(responseSummary.details ?? {}).toEqual({})
  })
  it("lists store pickup points through neutral public contract", async () => {
    const connection = createConnectionRecord({
      enabled: true,
      status: "active",
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
    })
    const pg = createMockPg([connection])
    const service = new DeliveryHubService(pg as any)
    const adapter = getDeliveryHubAdapter("yandex")
    const pickupSpy = jest.spyOn(adapter, "listPickupPoints").mockResolvedValue([
      {
        provider_point_id: "pvz_1",
        provider_point_code: "code_1",
        name: "PVZ 1",
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
      },
    ])

    const result = await service.listStorePickupPoints({
      city: "Moscow",
    })

    expect(result).toEqual({
      ok: true,
      points: [
        expect.objectContaining({
          provider_point_id: "pvz_1",
        }),
      ],
    })
    expect(pickupSpy).toHaveBeenCalledWith(
      expect.objectContaining({ connection }),
      {
        city: "Moscow",
        country_code: "RU",
      }
    )
  })

  it("lists store pickup windows using default warehouse mapping", async () => {
    const warehouse = createWarehouseRecord({
      id: "wh_1",
      provider_code: "yandex",
      provider_warehouse_id: "ya-wh-1",
    })
    const connection = createConnectionRecord({
      enabled: true,
      status: "active",
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
      config: {
        default_warehouse_id: warehouse.id,
      },
    })
    const pg = createMockPg([connection], [], [warehouse])
    const service = new DeliveryHubService(pg as any)
    const adapter = getDeliveryHubAdapter("yandex")
    const windowsSpy = jest.spyOn(adapter, "listPickupWindows").mockResolvedValue([
      {
        date: "2026-04-22",
        time_from: "10:00",
        time_to: "14:00",
        interval_utc: {
          from: "2026-04-22T07:00:00.000Z",
          to: "2026-04-22T11:00:00.000Z",
        },
        label: "22 Apr, 10:00-14:00",
        metadata: {},
      },
    ])

    const result = await service.listStorePickupWindows({})

    expect(result).toEqual({
      ok: true,
      pickup_windows: [
        expect.objectContaining({
          date: "2026-04-22",
        }),
      ],
    })
    expect(windowsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ connection }),
      {
        warehouse_id: "ya-wh-1",
      }
    )
  })

  it("requires explicit connection_id when multiple public connections are active", async () => {
    const first = createConnectionRecord({
      id: "conn_1",
      enabled: true,
      status: "active",
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
    })
    const second = createConnectionRecord({
      id: "conn_2",
      name: "Second connection",
      enabled: true,
      status: "active",
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
    })
    const pg = createMockPg([first, second])
    const service = new DeliveryHubService(pg as any)

    await expect(
      service.listStorePickupPoints({
        city: "Moscow",
      })
    ).rejects.toMatchObject({
      code: "DELIVERY_HUB_VALIDATION_ERROR",
      status: 400,
      details: {
        field: "connection_id",
      },
    })
  })

  it("lists store quotes for warehouse-to-pickup-point flow", async () => {
    const warehouse = createWarehouseRecord({
      id: "wh_1",
      provider_code: "yandex",
      provider_warehouse_id: "ya-wh-1",
    })
    const connection = createConnectionRecord({
      enabled: true,
      status: "active",
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
      config: {
        default_warehouse_id: warehouse.id,
      },
    })
    const pg = createMockPg([connection], [], [warehouse])
    const service = new DeliveryHubService(pg as any)
    const adapter = getDeliveryHubAdapter("yandex")
    const quoteSpy = jest.spyOn(adapter, "quoteWarehouseToPickupPoint").mockResolvedValue([
      {
        carrier_code: "yandex",
        carrier_label: "Yandex Delivery",
        mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
        quote_key: "quote_1",
        amount: 499,
        currency_code: "RUB",
        delivery_eta_min: 1,
        delivery_eta_max: 2,
        pickup_point_required: true,
        pickup_point_ids: ["pvz_1"],
        pickup_points_embedded: [],
        pickup_window_required: false,
        pickup_window_options: [],
        raw_reference: {},
      },
    ])

    const result = await service.listStoreQuotes({
      mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
      destination_point_id: "pvz_1",
      currency_code: "RUB",
    })

    expect(result).toEqual({
      ok: true,
      quotes: [
        expect.objectContaining({
          quote_key: "quote_1",
          amount: 499,
        }),
      ],
    })
    expect(quoteSpy).toHaveBeenCalledWith(
      expect.objectContaining({ connection }),
      expect.objectContaining({
        warehouse_id: "ya-wh-1",
        destination_point_id: "pvz_1",
        currency_code: "RUB",
      })
    )
  })
})

function expectDeliveryHubError(
  error: unknown,
  expected: { code: string; status: number }
) {
  expect(error).toBeInstanceOf(DeliveryHubError)

  if (!(error instanceof DeliveryHubError)) {
    return
  }

  expect(error.code).toBe(expected.code)
  expect(error.status).toBe(expected.status)
}

function createConnectionRecord(input?: Partial<any>) {
  return {
    id: "conn_1",
    provider_code: "yandex",
    name: "Yandex test",
    status: "draft",
    mode: "test",
    enabled: false,
    country_code: "RU",
    credentials_envelope: null,
    credentials_state: "empty",
    credentials_fingerprint: "fingerprint",
    credentials_last_validated_at: null,
    credentials_last_error_code: null,
    config: {},
    metadata: {},
    created_at: "2026-04-20T00:00:00.000Z",
    updated_at: "2026-04-20T00:00:00.000Z",
    ...input,
  }
}

function createWarehouseRecord(input?: Partial<any>) {
  return {
    id: "wh_1",
    name: "Warehouse",
    enabled: true,
    country_code: "RU",
    city: "Moscow",
    address_line_1: "Tverskaya 1",
    contact_name: null,
    contact_phone: null,
    provider_code: "yandex",
    provider_warehouse_id: "ya-wh-1",
    metadata: {},
    created_at: "2026-04-20T00:00:00.000Z",
    updated_at: "2026-04-20T00:00:00.000Z",
    ...input,
  }
}

function createMockPg(initialConnections: any[], initialEventLogs: any[] = [], initialWarehouses: any[] = []) {
  const connectionState = new Map(initialConnections.map((connection) => [connection.id, connection]))
  const warehouseState = new Map(initialWarehouses.map((warehouse) => [warehouse.id, warehouse]))
  const eventLogs = [...initialEventLogs]
  const calls: Array<{ sql: string; params: unknown[] }> = []

  return {
    calls,
    async raw(sql: string, params?: unknown[]) {
      const normalizedSql = sql.replace(/\s+/g, " ").trim()
      const normalizedParams = Array.isArray(params) ? params : []
      calls.push({ sql: normalizedSql, params: normalizedParams })

      if (normalizedSql.includes("select * from delivery_connections where id = ? limit 1")) {
        const id = String(normalizedParams[0] ?? "")
        const row = connectionState.get(id)
        return {
          rows: row ? [row] : [],
        }
      }

      if (normalizedSql.includes("select * from delivery_warehouses where id = ? limit 1")) {
        const id = String(normalizedParams[0] ?? "")
        const row = warehouseState.get(id)
        return {
          rows: row ? [row] : [],
        }
      }

      if (normalizedSql.includes("from delivery_connections order by created_at desc, id desc")) {
        return {
          rows: Array.from(connectionState.values()),
        }
      }

      if (normalizedSql.includes("from delivery_warehouses order by created_at desc, id desc")) {
        return {
          rows: Array.from(warehouseState.values()),
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

      if (normalizedSql.includes("insert into delivery_warehouses")) {
        const nextRecord = {
          ...(warehouseState.get(String(normalizedParams[0])) ?? {}),
          id: String(normalizedParams[0]),
          name: normalizedParams[1],
          enabled: normalizedParams[2],
          country_code: normalizedParams[3],
          city: normalizedParams[4],
          address_line_1: normalizedParams[5],
          contact_name: normalizedParams[6],
          contact_phone: normalizedParams[7],
          provider_code: normalizedParams[8],
          provider_warehouse_id: normalizedParams[9],
          metadata: JSON.parse(String(normalizedParams[10] ?? "{}")),
          created_at:
            warehouseState.get(String(normalizedParams[0]))?.created_at ?? "2026-04-20T00:00:00.000Z",
          updated_at: "2026-04-20T00:00:00.000Z",
        }

        warehouseState.set(nextRecord.id, nextRecord)

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

      if (normalizedSql.includes("from delivery_event_logs")) {
        let rows = [...eventLogs]

        if (normalizedSql.includes("where connection_id = ? and provider_code = ?")) {
          rows = rows.filter(
            (row) =>
              row.connection_id === normalizedParams[0] && row.provider_code === normalizedParams[1]
          )
        } else if (normalizedSql.includes("where connection_id = ?")) {
          rows = rows.filter((row) => row.connection_id === normalizedParams[0])
        } else if (normalizedSql.includes("where provider_code = ?")) {
          rows = rows.filter((row) => row.provider_code === normalizedParams[0])
        }

        const limit = Number(normalizedParams[normalizedParams.length - 1] ?? rows.length)

        return {
          rows: rows.slice(0, limit),
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
