import { afterEach, describe, expect, it, jest } from "@jest/globals"
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

function createMockPg(initialConnections: any[], initialEventLogs: any[] = []) {
  const state = new Map(initialConnections.map((connection) => [connection.id, connection]))
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
        const row = state.get(id)
        return {
          rows: row ? [row] : [],
        }
      }

      if (normalizedSql.includes("insert into delivery_connections")) {
        const nextRecord = {
          ...(state.get(String(normalizedParams[0])) ?? {}),
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
            state.get(String(normalizedParams[0]))?.created_at ?? "2026-04-20T00:00:00.000Z",
          updated_at: "2026-04-20T00:00:00.000Z",
        }

        state.set(nextRecord.id, nextRecord)

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
        normalizedSql.includes("create table if not exists delivery_event_logs")
      ) {
        return {
          rows: [],
        }
      }

      throw new Error(`Unhandled SQL in test: ${normalizedSql}`)
    },
  }
}
