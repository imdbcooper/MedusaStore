import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import {
  DELIVERY_HUB_CONNECTION_STATUS,
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
import { DELIVERY_HUB_FULFILLMENT_PROVIDER_ID } from "../../modules/delivery-hub/shipping-option-contract"

const originalEncryptionKey = process.env.DELIVERY_HUB_ENCRYPTION_KEY
const originalExecutionEnabled = process.env.DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED

afterEach(() => {
  if (typeof originalEncryptionKey === "string") {
    process.env.DELIVERY_HUB_ENCRYPTION_KEY = originalEncryptionKey
  } else {
    delete process.env.DELIVERY_HUB_ENCRYPTION_KEY
  }

  if (typeof originalExecutionEnabled === "string") {
    process.env.DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED = originalExecutionEnabled
  } else {
    delete process.env.DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED
  }
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
      country_code: "RU",
      city: "Москва",
      address_line_1: "Тверская 1",
      contact_name: "Warehouse Operator",
      contact_phone: "+79990000000",
      metadata: {
        postal_code: "125009",
        coordinates: [37.6173, 55.7558],
      },
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
      destination_address: { fullname: "125009, Москва, Тверская 1" },
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
        origin_address: expect.objectContaining({
          fullname: "RU, 125009, Москва, Тверская 1",
          coordinates: [37.6173, 55.7558],
          contact: expect.objectContaining({
            name: "Warehouse Operator",
            phone: "+79990000000",
          }),
        }),
      })
    )

    quoteSpy.mockRestore()
  })

  it("rejects warehouse quote with clear validation when destination address is missing", async () => {
    const warehouse = createWarehouseRecord({
      id: "wh_origin_ready",
      provider_code: "yandex",
      provider_warehouse_id: "ya-wh-origin-ready",
      country_code: "RU",
      city: "Москва",
      address_line_1: "Тверская 1",
      metadata: { postal_code: "125009" },
    })
    const connection = createConnectionRecord({
      status: DELIVERY_HUB_CONNECTION_STATUS.active,
      enabled: true,
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
      config: {
        default_warehouse_id: warehouse.id,
      },
    })
    const pg = createMockPg([connection], [], [warehouse])
    const service = new DeliveryHubService(pg as any)

    await expect(
      service.listStoreQuotes({
        connection_id: connection.id,
        mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
        destination_point_id: "pvz_1",
        items: [{ quantity: 1, weight_grams: 500 }],
      })
    ).rejects.toMatchObject({
      code: "DELIVERY_HUB_VALIDATION_ERROR",
      status: 409,
      message: expect.stringContaining("destination_address.fullname"),
      details: expect.objectContaining({
        field: "destination_address",
      }),
    })
  })

  it("rejects warehouse quote with clear validation when origin address is missing", async () => {
    const warehouse = createWarehouseRecord({
      id: "wh_missing_origin",
      provider_code: "yandex",
      provider_warehouse_id: "ya-wh-missing-origin",
      city: null,
      address_line_1: null,
      metadata: {},
    })
    const connection = createConnectionRecord({
      status: DELIVERY_HUB_CONNECTION_STATUS.active,
      enabled: true,
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
      config: {
        default_warehouse_id: warehouse.id,
      },
    })
    const pg = createMockPg([connection], [], [warehouse])
    const service = new DeliveryHubService(pg as any)

    await expect(
      service.listStoreQuotes({
        connection_id: connection.id,
        mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
        destination_point_id: "pvz_1",
        destination_address: {
          fullname: "125009, Москва, Тверская 1",
          coordinates: [37.6173, 55.7558],
        },
        items: [{ quantity: 1, weight_grams: 500 }],
      })
    ).rejects.toMatchObject({
      code: "DELIVERY_HUB_VALIDATION_ERROR",
      status: 409,
      message: expect.stringContaining("origin address"),
      details: expect.objectContaining({
        field: "warehouse.origin_address",
        warehouse_id: warehouse.id,
        missing_fields: expect.arrayContaining(["warehouse.city", "warehouse.address_line_1"]),
      }),
    })
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

  it("keeps sealed credentials when updating an existing connection without a token", async () => {
    process.env.DELIVERY_HUB_ENCRYPTION_KEY = Buffer.alloc(32, 13).toString("base64")

    const envelope = encryptDeliveryHubCredentials({ token: "existing-token" })
    const fingerprint = createCredentialsFingerprint({ token: "existing-token" })
    const connection = createConnectionRecord({
      credentials_envelope: envelope,
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
      credentials_fingerprint: fingerprint,
      credentials_last_validated_at: "2026-04-21T00:00:00.000Z",
      credentials_last_error_code: null,
    })
    const pg = createMockPg([connection])
    const service = new DeliveryHubService(pg as any)

    const updated = await service.updateConnection(connection.id, {
      name: "Yandex renamed",
      mode: "test",
      enabled: true,
      country_code: "RU",
      config: {
        auto_confirm: true,
      },
    })

    expect(updated).toMatchObject({
      id: connection.id,
      name: "Yandex renamed",
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
      credentials_fingerprint: fingerprint,
      credentials_present: true,
    })

    const upsertCall = pg.calls.find((call) => call.sql.includes("insert into delivery_connections"))
    expect(upsertCall?.params[7]).toBe(JSON.stringify(envelope))
    expect(upsertCall?.params[8]).toBe(DELIVERY_HUB_CREDENTIALS_STATE.sealed)
    expect(upsertCall?.params[9]).toBe(fingerprint)
    expect(upsertCall?.params[10]).toBe("2026-04-21T00:00:00.000Z")
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

  it("builds execution-plan observability preview with persistence and audit seam via service", async () => {
    const warehouse = createWarehouseRecord({
      id: "wh_1",
      provider_warehouse_id: "ya-wh-1",
    })
    const connection = createConnectionRecord({
      id: "conn_ready",
      enabled: true,
      status: "active",
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
      config: {
        default_warehouse_id: warehouse.id,
      },
    })
    const pg = createMockPg([connection], [], [warehouse])
    const service = new DeliveryHubService(pg as any)
    delete process.env.DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED

    const preview = await service.buildExecutionPlanObservabilityPreview([])
    const readyMode = preview.execution_plan_preview.mode_previews.find(
      (mode) => mode.mode_code === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint
    )

    expect(preview.provider_code).toBe("deliveryhub")
    expect(preview.provider_id).toBe(DELIVERY_HUB_FULFILLMENT_PROVIDER_ID)
    expect(preview.summary.ready_mode_count).toBeGreaterThan(0)
    expect(readyMode).toBeDefined()
    expect(readyMode).toMatchObject({
      status: "ready",
      repository_assembly_summary: {
        repository_status: "pg_repository_implementation_available",
        persistence_readiness_contour: {
          current_stage: "activation_blocked",
        },
        missing_activation_prerequisites: expect.arrayContaining([
          "migration_or_table_creation",
          "transaction_runner",
          "explicit_runtime_wiring",
          "operational_runbook",
          "safety_review",
        ]),
      },
      preflight_eligibility: {
        redacted: true,
        current_mode: "preview_only",
        decision: "eligible_when_enabled",
        real_execution_enabled: false,
        future_execution_flag: {
          name: "DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED",
          status: "future_inert_not_read",
        },
        confirmations: {
          shipment_execution_disabled: true,
          provider_calls_disabled: true,
          persistence_writes_disabled: true,
          checkout_cutover_disabled: true,
        },
      },
      persistence_audit_preview: {
        redacted: true,
        status: "ready",
        execution_record: {
          ready: true,
          connection_id: expect.stringMatching(/^preview_/),
          initial_status: "planned",
        },
        idempotency_reservation: {
          ready: true,
          dedupe_scope: "deliveryhub:create_shipment",
        },
        blocked: expect.arrayContaining([
          expect.objectContaining({ key: "metadata_commit" }),
          expect.objectContaining({ key: "provider_dispatch" }),
        ]),
      },
      shipment_result_preview: {
        redacted: true,
        current_mode: "preview_only",
        result_decision: "projected_for_future_execution",
        projected_result_status: "projected_for_future_execution",
        normalization_target: "deliveryhub_shipment_result",
        provider_normalization_target: "create_shipment_response",
        artifact_summary: {
          external_shipment_reference_present: true,
          tracking_reference_present: true,
          label_document_present: true,
          pickup_booking_present: true,
          pickup_interval_present: true,
          status_timeline_present: true,
          failure_placeholder_present: true,
          rollback_placeholder_present: true,
        },
        confirmations: {
          provider_response_fetch_disabled: true,
          adapter_invocation_disabled: true,
          shipment_creation_disabled: true,
          label_persistence_disabled: true,
          order_mutation_disabled: true,
          fulfillment_persistence_disabled: true,
          checkout_cutover_disabled: true,
        },
      },
      fulfillment_application_preview: {
        redacted: true,
        current_mode: "preview_only",
        application_decision: "projected_for_future_application",
        projected_application_status: "projected_for_future_application",
        application_target: "medusa_fulfillment_mutation_plan",
        application_scope: "backend_admin_only",
        mutation_semantics: {
          fulfillment_data_patch_present: true,
          shipment_reference_linkage_present: true,
          tracking_projection_present: true,
          label_document_reference_linkage_present: true,
          status_transition_application_present: true,
          audit_linkage_present: true,
        },
        persistence_linkage: {
          execution_reference_present: true,
          idempotency_reservation_present: true,
          audit_log_reference_present: true,
        },
        confirmations: {
          order_mutation_disabled: true,
          fulfillment_persistence_disabled: true,
          shipment_persistence_disabled: true,
          label_persistence_disabled: true,
          event_persistence_disabled: true,
          checkout_cutover_disabled: true,
        },
      },
    })
    expect(readyMode?.steps.some((step) => step.key === "preflight_eligibility")).toBe(true)
    expect(readyMode?.preflight_eligibility.reasons.map((reason) => reason.code)).toEqual([
      "EXECUTION_PREVIEW_ONLY",
      "FUTURE_EXECUTION_FLAG_INERT",
      "LIVE_EXECUTION_DISABLED",
      "PROVIDER_EXECUTION_ADAPTER_DISABLED",
    ])
    expect(readyMode?.shipment_execution.materialized).toBe(false)
    expect(
      JSON.stringify(readyMode?.persistence_audit_preview.audit_log_entries ?? [])
    ).not.toContain("delivery-hub-provider-credential")
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
    expect(upsertCalls[0].params[3]).toBe(DELIVERY_HUB_CONNECTION_STATUS.error)
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

  it("keeps sealed active connection shopper-ready when Test connection gets provider access-block", async () => {
    const connection = createConnectionRecord({
      enabled: true,
      status: DELIVERY_HUB_CONNECTION_STATUS.active,
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
      credentials_last_validated_at: "2026-04-28T18:52:16.000Z",
      credentials_last_error_code: null,
    })
    const pg = createMockPg([connection])
    const service = new DeliveryHubService(pg as any)
    const adapter = getDeliveryHubAdapter("yandex")
    jest.spyOn(adapter, "testConnection").mockRejectedValue(
      new DeliveryHubError({
        code: "DELIVERY_HUB_PROVIDER_ERROR",
        message: "Yandex Delivery request failed with status 403",
        status: 502,
        details: {
          provider_status: 403,
          error_category: "provider_access_blocked",
          correlation_id: "corr_access_block",
        },
      })
    )

    await expect(service.testConnection(connection.id)).rejects.toMatchObject({
      code: "DELIVERY_HUB_PROVIDER_ERROR",
      status: 502,
      details: expect.objectContaining({
        provider_status: "403",
        error_category: "provider_access_blocked",
        diagnostics_summary: expect.objectContaining({
          error_category: "provider_access_blocked",
        }),
      }),
    })

    const upsertCalls = pg.calls.filter((call) => call.sql.includes("insert into delivery_connections"))
    expect(upsertCalls).toHaveLength(1)
    expect(upsertCalls[0].params[3]).toBe(DELIVERY_HUB_CONNECTION_STATUS.active)
    expect(upsertCalls[0].params[8]).toBe(DELIVERY_HUB_CREDENTIALS_STATE.sealed)
    expect(upsertCalls[0].params[10]).toBe("2026-04-28T18:52:16.000Z")
    expect(upsertCalls[0].params[11]).toBe("DELIVERY_HUB_PROVIDER_ERROR")

    const settings = await service.getStoreSettings()
    expect(settings.settings.status).toBe("available")
    expect(settings.settings.summary.ready_connection_count).toBe(1)
  })

  it("keeps sealed active connection rollout-ready after provider access-block Test connection", async () => {
    const warehouse = createWarehouseRecord({
      id: "wh_1",
      enabled: true,
      provider_code: "yandex",
      provider_warehouse_id: "ya-wh-1",
    })
    const connection = createConnectionRecord({
      enabled: true,
      status: DELIVERY_HUB_CONNECTION_STATUS.active,
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
      credentials_last_validated_at: "2026-04-28T18:52:16.000Z",
      credentials_last_error_code: "DELIVERY_HUB_PROVIDER_ERROR",
      config: {
        default_warehouse_id: warehouse.id,
      },
    })
    const pg = createMockPg([connection], [], [warehouse])
    const service = new DeliveryHubService(pg as any)

    const preview = await service.buildShippingOptionPreview([])

    expect(preview.summary.desired_option_count).toBeGreaterThan(0)
    expect(preview.summary.deferred_issue_count).toBe(0)
    expect(preview.plan.connection_plans[0]).toMatchObject({
      status: "projected",
      projected_mode_codes: expect.arrayContaining([
        DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
      ]),
      issues: [],
    })
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
        provider_operator_id: "market_l4g",
        network_label: "Яндекс Маркет",
        is_yandex_branded: true,
        is_market_partner: true,
        station_type: "pickup_point",
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

  it("normalizes lowercase store pickup country codes before provider calls", async () => {
    const connection = createConnectionRecord({
      enabled: true,
      status: "active",
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
      country_code: "RU",
    })
    const pg = createMockPg([connection])
    const service = new DeliveryHubService(pg as any)
    const adapter = getDeliveryHubAdapter("yandex")
    const pickupSpy = jest.spyOn(adapter, "listPickupPoints").mockResolvedValue([])

    await expect(
      service.listStorePickupPoints({
        city: "Moscow",
        country_code: "ru",
      })
    ).resolves.toMatchObject({
      ok: true,
      points: [],
    })

    expect(pickupSpy).toHaveBeenCalledWith(
      expect.objectContaining({ connection }),
      {
        city: "Moscow",
        country_code: "RU",
      }
    )
  })

  it("lists admin pickup points as capped sanitized operator sample", async () => {
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
        provider_operator_id: "market_l4g",
        network_label: "Яндекс Маркет",
        is_yandex_branded: true,
        is_market_partner: true,
        station_type: "pickup_point",
        name: "PVZ 1",
        address: "Tverskaya 1",
        city: "Moscow",
        region: "Moscow",
        postal_code: "101000",
        lat: 55.75,
        lng: 37.61,
        is_origin_dropoff_allowed: true,
        is_destination_pickup_allowed: true,
        payment_methods: ["card"],
        metadata: {
          available_for_dropoff: true,
          raw_provider_fragment: "must-not-cross-admin-lookup",
        },
      },
    ])

    const result = await service.listAdminPickupPoints({
      connection_id: connection.id,
      city: "Moscow",
      limit: 20,
    })

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      limit: 20,
      total_available: 1,
      returned_count: 1,
      truncated: false,
      points: [
        {
          id: "pvz_1",
          code: "code_1",
          operator_id: "market_l4g",
          network_label: "Яндекс Маркет",
          station_type: "pickup_point",
          is_yandex_branded: true,
          is_market_partner: true,
          name: "PVZ 1",
          address: "Tverskaya 1",
          city: "Moscow",
          postal_code: "101000",
          available_for_dropoff: true,
          coordinates: {
            lat: 55.75,
            lng: 37.61,
          },
        },
      ],
    }))
    expect(pickupSpy).toHaveBeenCalledWith(
      expect.objectContaining({ connection }),
      {
        city: "Moscow",
        country_code: "RU",
        geo_id: null,
        pickup_point_ids: null,
        operator_ids: null,
        station_type: null,
        available_for_dropoff: null,
        is_yandex_branded: null,
        is_not_branded_partner_station: null,
      }
    )
  })

  it("lists store pickup windows using default warehouse mapping", async () => {
    const warehouse = createWarehouseRecord({
      id: "wh_1",
      provider_code: "yandex",
      provider_warehouse_id: "ya-wh-1",
      country_code: "RU",
      city: "Москва",
      address_line_1: "Тверская 1",
      metadata: { postal_code: "125009" },
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

  it("selects the latest validated ready store connection when duplicates are active", async () => {
    const stale = createConnectionRecord({
      id: "conn_stale",
      enabled: true,
      status: "active",
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
      credentials_last_validated_at: "2026-04-20T00:00:00.000Z",
      updated_at: "2026-04-20T00:00:00.000Z",
    })
    const latest = createConnectionRecord({
      id: "conn_latest",
      name: "Latest connection",
      enabled: true,
      status: "active",
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
      credentials_last_validated_at: "2026-04-21T00:00:00.000Z",
      updated_at: "2026-04-21T00:00:00.000Z",
    })
    const pg = createMockPg([stale, latest])
    const service = new DeliveryHubService(pg as any)
    const adapter = getDeliveryHubAdapter("yandex")
    const pickupSpy = jest.spyOn(adapter, "listPickupPoints").mockResolvedValue([])

    await expect(
      service.listStorePickupPoints({
        city: "Moscow",
      })
    ).resolves.toMatchObject({
      ok: true,
      points: [],
    })

    expect(pickupSpy).toHaveBeenCalledWith(
      expect.objectContaining({ connection: latest }),
      {
        city: "Moscow",
        country_code: "RU",
      }
    )
  })

  it("deletes only the connection row while leaving event logs available for audit", async () => {
    const connection = createConnectionRecord({
      id: "conn_delete",
      enabled: true,
      status: "error",
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
    })
    const pg = createMockPg([connection], [
      {
        id: "log_keep",
        connection_id: "conn_delete",
        provider_code: "yandex",
        kind: "connection_test",
        correlation_id: "corr_keep",
        success: false,
        request_summary: {},
        response_summary: {},
        error_code: "PROVIDER_ERROR",
        created_at: "2026-04-21T00:00:00.000Z",
      },
    ])
    const service = new DeliveryHubService(pg as any)

    const result = await service.deleteConnection("conn_delete")

    expect(result).toMatchObject({
      deleted: true,
      connection: {
        id: "conn_delete",
        status: "error",
      },
    })
    await expect(service.listConnections()).resolves.toEqual([])
    await expect(service.listEventLogs({ connection_id: "conn_delete" })).resolves.toHaveLength(1)
  })

  it("returns neutral selection readiness from cart metadata and connection state", async () => {
    const connection = createConnectionRecord({
      id: "conn_1",
      enabled: true,
      status: "active",
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
    })
    const pg = createMockPg([connection])
    const service = new DeliveryHubService(pg as any)

    const result = await service.getStoreSelectionReadiness({
      cart_id: "cart_1",
      metadata: {
        delivery_hub: {
            selection: {
              version: 1,
              provider_code: "yandex",
              connection_id: "conn_1",
              quote_type: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
            quote_reference: {
              id: "dhsel_0123456789abcdef0123456789abcdef",
              version: 1,
            },
            quote: {
              carrier_code: "yandex",
              carrier_label: "Yandex Delivery",
              amount: 499,
              currency_code: "RUB",
              delivery_eta_min: 1,
              delivery_eta_max: 2,
              pickup_point_required: true,
              pickup_window_required: false,
            },
            pickup_point: {
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
            },
            pickup_window: null,
            updated_at: "2026-04-21T03:00:00.000Z",
            backend: {
              quote_key: "offer_123",
            },
          },
        },
      },
    })

    expect(result).toEqual({
      ok: true,
      cart_id: "cart_1",
      status: "ready",
      issues: [],
      selection: {
        version: 1,
        provider_code: "yandex",
        connection_id: "conn_1",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_0123456789abcdef0123456789abcdef",
          version: 1,
        },
        quote: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: false,
        },
        correlation_id: null,
        pickup_point: {
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
        },
        pickup_window: null,
        updated_at: "2026-04-21T03:00:00.000Z",
      },
      quote_context: {
        connection: {
          connection_id: "conn_1",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_0123456789abcdef0123456789abcdef",
          version: 1,
        },
        pickup_point_required: true,
        pickup_window_required: false,
        updated_at: "2026-04-21T03:00:00.000Z",
      },
    })
  })

  it("returns not_ready readiness when referenced connection is disabled", async () => {
    const connection = createConnectionRecord({
      id: "conn_1",
      enabled: false,
      status: "active",
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
    })
    const pg = createMockPg([connection])
    const service = new DeliveryHubService(pg as any)

    const result = await service.getStoreSelectionReadiness({
      cart_id: "cart_1",
      metadata: {
        delivery_hub: {
            selection: {
              version: 1,
              provider_code: "yandex",
              connection_id: "conn_1",
              quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
            quote_reference: {
              id: "dhsel_0123456789abcdef0123456789abcdef",
              version: 1,
            },
            quote: {
              carrier_code: "yandex",
              carrier_label: "Yandex Delivery",
              amount: 499,
              currency_code: "RUB",
              delivery_eta_min: 1,
              delivery_eta_max: 2,
              pickup_point_required: true,
              pickup_window_required: false,
            },
            pickup_point: {
              provider_point_id: "pvz_1",
              provider_point_code: "code_1",
              name: "PVZ 1",
              address: "Tverskaya 1",
              city: "Moscow",
              region: "Moscow",
              postal_code: "101000",
              lat: 55.75,
              lng: 37.61,
              is_origin_dropoff_allowed: true,
              is_destination_pickup_allowed: true,
              payment_methods: ["card"],
            },
            pickup_window: null,
            updated_at: "2026-04-21T03:00:00.000Z",
            backend: {
              quote_key: "offer_123",
            },
          },
        },
      },
    })

    expect(result.status).toBe("not_ready")
    expect(result.issues).toEqual([
      {
        code: "connection_disabled",
        message: "Delivery connection is disabled for shopper-facing use",
        field: "connection_id",
      },
    ])
    expect(result.selection).toEqual(
      expect.objectContaining({
        connection_id: "conn_1",
      })
    )
    expect(result.quote_context?.connection).toEqual({
      connection_id: "conn_1",
      state: "disabled",
      ready: false,
    })
    expect(result.quote_context?.connection).not.toHaveProperty("provider_code")
    expect(result.quote_context?.connection).not.toHaveProperty("enabled")
    expect(result.quote_context?.connection).not.toHaveProperty("status")
    expect(result.quote_context?.connection).not.toHaveProperty("credentials_state")
  })

  it("builds missing-selection cutover candidate fail-safe without provider calls or writes", async () => {
    const pg = createMockPg([], [], [])
    const service = new DeliveryHubService(pg as any)
    const adapter = getDeliveryHubAdapter("yandex")
    const quoteWhSpy = jest.spyOn(adapter, "quoteWarehouseToPickupPoint")
    const quoteDropoffSpy = jest.spyOn(adapter, "quoteDropoffPointToPickupPoint")
    const pickupSpy = jest.spyOn(adapter, "listPickupPoints")
    const windowsSpy = jest.spyOn(adapter, "listPickupWindows")

    const result = await service.getStoreCutoverCandidate({
      cart_id: "cart_candidate_missing",
      metadata: {},
      current_shipping_options: [],
    })

    expect(result).toEqual({
      ok: true,
      version: 1,
      cart_id: "cart_candidate_missing",
      selection_present: false,
      selection_reference_id: null,
      candidate_status: "selection_missing",
      candidate_shipping_option_id: null,
      candidate_shipping_option_name: null,
      candidate_amount: null,
      currency_code: null,
      candidate_pickup_point_id: null,
      required_preconditions: [
        "neutral_selection_ready",
        "matching_delivery_hub_shipping_option_present",
        "operator_approval_required",
        "can_commit_shipping_method_false",
      ],
      blocked_reasons: [
        "selection_missing",
        "operator_approval_required",
        "can_commit_shipping_method_false",
      ],
      can_commit_shipping_method: false,
      checkout_source_of_truth: "unchanged",
      guardrails: {
        no_network_calls: true,
        no_provider_payloads: true,
        no_secret_material: true,
        shipment_lifecycle_not_enabled: true,
        can_commit_shipping_method: false,
      },
    })
    expect(quoteWhSpy).not.toHaveBeenCalled()
    expect(quoteDropoffSpy).not.toHaveBeenCalled()
    expect(pickupSpy).not.toHaveBeenCalled()
    expect(windowsSpy).not.toHaveBeenCalled()
    expect(pg.calls.some((call: any) => call.sql.includes("insert into"))).toBe(false)
    expect(pg.calls.some((call: any) => call.sql.includes("create table if not exists"))).toBe(false)
  })

  it("builds safe read-only cutover candidate summary from neutral selection and managed shipping option", async () => {
    const pg = createMockPg([], [], [])
    const service = new DeliveryHubService(pg as any)
    const adapter = getDeliveryHubAdapter("yandex")
    const quoteWhSpy = jest.spyOn(adapter, "quoteWarehouseToPickupPoint")
    const quoteDropoffSpy = jest.spyOn(adapter, "quoteDropoffPointToPickupPoint")
    const pickupSpy = jest.spyOn(adapter, "listPickupPoints")
    const windowsSpy = jest.spyOn(adapter, "listPickupWindows")

    const result = await service.getStoreCutoverCandidate({
      cart_id: "cart_candidate_ready",
      metadata: {
        delivery_hub: {
          selection: {
            version: 1,
            provider_code: "yandex",
            connection_id: "conn_candidate",
            quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
            quote_reference: {
              id: "dhsel_0123456789abcdef0123456789abcdef",
              version: 1,
            },
            quote: {
              carrier_code: "yandex",
              carrier_label: "Yandex Delivery",
              amount: 499,
              currency_code: "RUB",
              delivery_eta_min: 1,
              delivery_eta_max: 2,
              pickup_point_required: true,
              pickup_window_required: false,
              quote_key: "quote-key-must-not-leak",
            },
            pickup_point: {
              provider_point_id: "pvz_candidate",
              provider_point_code: "code_1",
              name: "PVZ Candidate",
              address: "Tverskaya 1",
              city: "Moscow",
              region: "Moscow",
              postal_code: "101000",
              lat: 55.75,
              lng: 37.61,
              is_origin_dropoff_allowed: true,
              is_destination_pickup_allowed: true,
              payment_methods: ["card"],
            },
            pickup_window: null,
            correlation_id: "corr_candidate_must_not_leak",
            updated_at: "2026-04-25T03:00:00.000Z",
            backend: {
              token: "backend-token-must-not-leak",
            },
          },
        },
      },
      current_shipping_options: [
        {
          id: "deliveryhub:dropoff_point_to_pickup_point",
          name: "Delivery Hub Pickup Candidate",
          provider_id: "deliveryhub_deliveryhub",
          data: {
            version: 1,
            provider_code: "deliveryhub",
            provider_id: "deliveryhub_deliveryhub",
            id: "deliveryhub:dropoff_point_to_pickup_point",
            mode_code: "dropoff_point_to_pickup_point",
            raw_reference: {
              offer_id: "provider-offer-must-not-leak",
            },
          },
        },
      ],
    })

    expect(result).toEqual({
      ok: true,
      version: 1,
      cart_id: "cart_candidate_ready",
      selection_present: true,
      selection_reference_id: "dhsel_0123456789abcdef0123456789abcdef",
      candidate_status: "ready_for_review",
      candidate_shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
      candidate_shipping_option_name: "Delivery Hub Pickup Candidate",
      candidate_amount: 499,
      currency_code: "RUB",
      candidate_pickup_point_id: "pvz_candidate",
      required_preconditions: [
        "neutral_selection_ready",
        "matching_delivery_hub_shipping_option_present",
        "operator_approval_required",
        "can_commit_shipping_method_false",
      ],
      blocked_reasons: [
        "operator_approval_required",
        "can_commit_shipping_method_false",
      ],
      can_commit_shipping_method: false,
      checkout_source_of_truth: "unchanged",
      guardrails: {
        no_network_calls: true,
        no_provider_payloads: true,
        no_secret_material: true,
        shipment_lifecycle_not_enabled: true,
        can_commit_shipping_method: false,
      },
    })
    const serialized = JSON.stringify(result)
    expect(serialized).not.toMatch(
      /quote-key-must-not-leak|corr_candidate_must_not_leak|backend-token-must-not-leak|provider-offer-must-not-leak/i
    )
    expect(serialized).not.toMatch(/authorization|ciphertext|raw_reference|quote_key|token|provider_offer_id/i)
    expect(quoteWhSpy).not.toHaveBeenCalled()
    expect(quoteDropoffSpy).not.toHaveBeenCalled()
    expect(pickupSpy).not.toHaveBeenCalled()
    expect(windowsSpy).not.toHaveBeenCalled()
    expect(pg.calls.some((call: any) => call.sql.includes("insert into"))).toBe(false)
    expect(pg.calls.some((call: any) => call.sql.includes("create table if not exists"))).toBe(false)
  })

  it("keeps cutover candidate blocked when matching shipping option is missing", async () => {
    const pg = createMockPg([], [], [])
    const service = new DeliveryHubService(pg as any)

    const result = await service.getStoreCutoverCandidate({
      cart_id: "cart_candidate_no_option",
      metadata: {
        delivery_hub: {
          selection: {
            version: 1,
            provider_code: "yandex",
            connection_id: "conn_candidate",
            quote_type: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
            quote_reference: {
              id: "dhsel_0123456789abcdef0123456789abcdef",
              version: 1,
            },
            quote: {
              carrier_code: "yandex",
              carrier_label: "Yandex Delivery",
              amount: 499,
              currency_code: "RUB",
              delivery_eta_min: 1,
              delivery_eta_max: 2,
              pickup_point_required: true,
              pickup_window_required: false,
            },
            pickup_point: {
              provider_point_id: "pvz_candidate",
              provider_point_code: "code_1",
              name: "PVZ Candidate",
              address: "Tverskaya 1",
              city: "Moscow",
              region: "Moscow",
              postal_code: "101000",
              lat: 55.75,
              lng: 37.61,
              is_origin_dropoff_allowed: false,
              is_destination_pickup_allowed: true,
              payment_methods: ["card"],
            },
            pickup_window: null,
            updated_at: "2026-04-25T03:00:00.000Z",
          },
        },
      },
      current_shipping_options: [],
    })

    expect(result.candidate_status).toBe("shipping_option_missing")
    expect(result.candidate_shipping_option_id).toBeNull()
    expect(result.can_commit_shipping_method).toBe(false)
    expect(result.blocked_reasons).toEqual([
      "matching_delivery_hub_shipping_option_missing",
      "operator_approval_required",
      "can_commit_shipping_method_false",
    ])
  })

  it("builds read-only cutover preconditions from stored safe state without provider calls or writes", async () => {
    const warehouse = createWarehouseRecord({
      id: "wh_ready",
      provider_code: "yandex",
      provider_warehouse_id: "ya-wh-ready",
    })
    const connection = createConnectionRecord({
      id: "conn_ready",
      enabled: true,
      status: "active",
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
      config: {
        default_warehouse_id: warehouse.id,
      },
      credentials_envelope: {
        mode: "sealed",
        ciphertext: "ciphertext-must-not-leak",
        iv: "iv-must-not-leak",
        auth_tag: "tag-must-not-leak",
      },
      metadata: {
        token: "metadata-token-must-not-leak",
      },
    })
    const pg = createMockPg(
      [connection],
      [
        {
          id: "log_wh",
          connection_id: connection.id,
          provider_code: "yandex",
          kind: "quote",
          correlation_id: "corr_wh_should_not_leak",
          success: true,
          request_summary: {
            mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
            Authorization: "Bearer should-not-leak",
          },
          response_summary: {
            quote_keys: ["quote-key-must-not-leak"],
          },
          error_code: null,
          created_at: "2026-04-24T00:00:00.000Z",
        },
        {
          id: "log_dropoff",
          connection_id: connection.id,
          provider_code: "yandex",
          kind: "quote",
          correlation_id: "corr_dropoff_should_not_leak",
          success: true,
          request_summary: {
            mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
            token: "request-token-must-not-leak",
          },
          response_summary: {
            raw_reference: "raw-reference-must-not-leak",
          },
          error_code: null,
          created_at: "2026-04-24T00:01:00.000Z",
        },
      ],
      [warehouse]
    )
    const service = new DeliveryHubService(pg as any)
    const adapter = getDeliveryHubAdapter("yandex")
    const quoteWhSpy = jest.spyOn(adapter, "quoteWarehouseToPickupPoint")
    const quoteDropoffSpy = jest.spyOn(adapter, "quoteDropoffPointToPickupPoint")
    const pickupSpy = jest.spyOn(adapter, "listPickupPoints")
    const windowsSpy = jest.spyOn(adapter, "listPickupWindows")

    const result = await service.getStoreCutoverPreconditions()

    expect(result.ok).toBe(true)
    expect(result.posture).toBe("evidence_preflight_only")
    expect(result.status).toBe("preflight_only")
    expect(result.can_commit_shipping_method).toBe(false)
    expect(result.guardrails).toEqual({
      checkout_source_of_truth: "unchanged",
      no_network_calls: true,
      no_provider_payloads: true,
      no_secret_material: true,
      shipment_lifecycle_not_enabled: true,
      can_commit_shipping_method: false,
    })
    expect(result.preconditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "store_quote_contract_ready",
          status: "ready",
          ready: true,
        }),
        expect.objectContaining({
          code: "admin_yandex_quote_baseline_recorded",
          status: "ready",
          ready: true,
        }),
        expect.objectContaining({
          code: "operator_approval_required",
          status: "required",
          ready: false,
        }),
        expect.objectContaining({
          code: "can_commit_shipping_method",
          status: "blocked",
          ready: false,
        }),
      ])
    )
    const serialized = JSON.stringify(result)
    expect(serialized).not.toMatch(
      /ciphertext-must-not-leak|metadata-token-must-not-leak|Bearer should-not-leak|quote-key-must-not-leak|raw-reference-must-not-leak|request-token-must-not-leak|corr_wh_should_not_leak|corr_dropoff_should_not_leak/i
    )
    expect(serialized).not.toMatch(/authorization|ciphertext|raw_reference|quote_key|token/i)
    expect(quoteWhSpy).not.toHaveBeenCalled()
    expect(quoteDropoffSpy).not.toHaveBeenCalled()
    expect(pickupSpy).not.toHaveBeenCalled()
    expect(windowsSpy).not.toHaveBeenCalled()
    expect(pg.calls.some((call: any) => call.sql.includes("insert into"))).toBe(false)
    expect(pg.calls.some((call: any) => call.sql.includes("create table if not exists"))).toBe(false)
  })

  it("builds missing quote-baseline preconditions without creating read-only tables", async () => {
    const pg = createMockPg([], [], [])
    const service = new DeliveryHubService(pg as any)

    const result = await service.getStoreCutoverPreconditions()

    expect(result.can_commit_shipping_method).toBe(false)
    expect(result.preconditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "admin_yandex_quote_baseline_recorded",
          status: "missing",
          ready: false,
        }),
        expect.objectContaining({
          code: "can_commit_shipping_method",
          status: "blocked",
          ready: false,
        }),
      ])
    )
    expect(pg.calls.some((call: any) => call.sql.includes("create table if not exists"))).toBe(false)
    expect(pg.calls.some((call: any) => call.sql.includes("insert into"))).toBe(false)
  })

  it("returns neutral readiness connection summary for credentials-not-ready store case", async () => {
    const connection = createConnectionRecord({
      id: "conn_1",
      enabled: true,
      status: "active",
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.invalid,
    })
    const pg = createMockPg([connection])
    const service = new DeliveryHubService(pg as any)

    const result = await service.getStoreSelectionReadiness({
      cart_id: "cart_1",
      metadata: {
        delivery_hub: {
            selection: {
              version: 1,
              provider_code: "yandex",
              connection_id: "conn_1",
              quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
            quote_reference: {
              id: "dhsel_0123456789abcdef0123456789abcdef",
              version: 1,
            },
            quote: {
              carrier_code: "yandex",
              carrier_label: "Yandex Delivery",
              amount: 499,
              currency_code: "RUB",
              delivery_eta_min: 1,
              delivery_eta_max: 2,
              pickup_point_required: true,
              pickup_window_required: false,
            },
            pickup_point: {
              provider_point_id: "pvz_1",
              provider_point_code: "code_1",
              name: "PVZ 1",
              address: "Tverskaya 1",
              city: "Moscow",
              region: "Moscow",
              postal_code: "101000",
              lat: 55.75,
              lng: 37.61,
              is_origin_dropoff_allowed: true,
              is_destination_pickup_allowed: true,
              payment_methods: ["card"],
            },
            pickup_window: null,
            updated_at: "2026-04-21T03:00:00.000Z",
            backend: {
              quote_key: "offer_123",
            },
          },
        },
      },
    })

    expect(result.status).toBe("not_ready")
    expect(result.issues).toEqual([
      {
        code: "connection_credentials_not_ready",
        message: "Delivery connection credentials are not ready for shopper-facing use",
        field: "connection_id",
      },
    ])
    expect(result.quote_context?.connection).toEqual({
      connection_id: "conn_1",
      state: "credentials_not_ready",
      ready: false,
    })
    expect(result.quote_context?.connection).not.toHaveProperty("provider_code")
    expect(result.quote_context?.connection).not.toHaveProperty("enabled")
    expect(result.quote_context?.connection).not.toHaveProperty("status")
    expect(result.quote_context?.connection).not.toHaveProperty("credentials_state")
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
        raw_reference: {
          provider_offer_id: "offer-123",
          provider: "yandex",
        },
      },
    ])

    const result = await service.listStoreQuotes({
      mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
      destination_point_id: "pvz_1",
      destination_address: { fullname: "125009, Москва, Тверская 1" },
      currency_code: "RUB",
    })

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        quotes: [
          expect.objectContaining({
            amount: 499,
            quote_reference: expect.objectContaining({
              id: expect.any(String),
              version: 1,
            }),
          }),
        ],
      })
    )
    expect(result.quotes[0]).not.toHaveProperty("quote_key")
    expect(result.quotes[0]).not.toHaveProperty("raw_reference")
    expect(quoteSpy).toHaveBeenCalledWith(
      expect.objectContaining({ connection }),
      expect.objectContaining({
        warehouse_id: "ya-wh-1",
        destination_point_id: "pvz_1",
        currency_code: "RUB",
      })
    )
  })

  it("uses warehouse record id for Yandex price quote when platform station id is absent", async () => {
    const warehouse = createWarehouseRecord({
      id: "wh_without_station",
      provider_code: DELIVERY_HUB_PROVIDER_YANDEX,
      provider_warehouse_id: null,
      city: "Москва",
      address_line_1: "Льва Толстого 16",
      metadata: { coordinates: [37.6173, 55.7558] },
    })
    const connection = createConnectionRecord({
      enabled: true,
      status: DELIVERY_HUB_CONNECTION_STATUS.active,
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
      config: {
        default_warehouse_id: warehouse.id,
      },
    })
    const pg = createMockPg([connection], [], [warehouse])
    const service = new DeliveryHubService(pg as any)
    const adapter = getDeliveryHubAdapter(DELIVERY_HUB_PROVIDER_YANDEX)
    const quoteSpy = jest.spyOn(adapter, "quoteWarehouseToPickupPoint").mockResolvedValue([
      {
        carrier_code: DELIVERY_HUB_PROVIDER_YANDEX,
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
        raw_reference: {
          provider_offer_id: "raw-offer-id-should-not-leak",
          provider: DELIVERY_HUB_PROVIDER_YANDEX,
        },
      },
    ])

    const result = await service.listStoreQuotes({
      connection_id: connection.id,
      mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
      destination_point_id: "pvz_1",
      destination_address: {
        fullname: "125009, Москва, Тверская 1",
        coordinates: [37.61, 55.75],
      },
      currency_code: "RUB",
    })

    expect(quoteSpy).toHaveBeenCalledWith(
      expect.objectContaining({ connection }),
      expect.objectContaining({
        warehouse_id: warehouse.id,
        origin_address: expect.objectContaining({
          fullname: expect.stringContaining("Москва"),
          coordinates: [37.6173, 55.7558],
        }),
      })
    )
    expect(JSON.stringify(result)).not.toContain("raw-offer-id-should-not-leak")
    expect(result.quotes[0].quote_reference.id).toMatch(/^dhsel_/)
  })

  it("fails invalid Yandex warehouse country-like city before provider quote call", async () => {
    const warehouse = createWarehouseRecord({
      id: "wh_country_city",
      provider_code: DELIVERY_HUB_PROVIDER_YANDEX,
      city: "Russia",
      address_line_1: "Льва Толстого 16",
    })
    const connection = createConnectionRecord({
      enabled: true,
      status: DELIVERY_HUB_CONNECTION_STATUS.active,
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
      config: {
        default_warehouse_id: warehouse.id,
      },
    })
    const pg = createMockPg([connection], [], [warehouse])
    const service = new DeliveryHubService(pg as any)
    const adapter = getDeliveryHubAdapter(DELIVERY_HUB_PROVIDER_YANDEX)
    const quoteSpy = jest.spyOn(adapter, "quoteWarehouseToPickupPoint")

    await expect(service.listStoreQuotes({
      connection_id: connection.id,
      mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
      destination_point_id: "pvz_1",
      destination_address: {
        fullname: "125009, Москва, Тверская 1",
        coordinates: [37.61, 55.75],
      },
      currency_code: "RUB",
    })).rejects.toMatchObject({
      code: "DELIVERY_HUB_VALIDATION_ERROR",
      status: 409,
      details: expect.objectContaining({
        field: "warehouse.city",
        warehouse_id: warehouse.id,
        operator_hint: expect.stringContaining("Укажите город склада"),
      }),
    })
    expect(quoteSpy).not.toHaveBeenCalled()
  })

  it("does not invalidate sealed credentials on provider access-block quote failure", async () => {
    const connection = createConnectionRecord({
      enabled: true,
      status: "active",
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
      credentials_last_validated_at: "2026-04-28T18:52:16.000Z",
      credentials_last_error_code: null,
    })
    const pg = createMockPg([connection])
    const service = new DeliveryHubService(pg as any)
    const adapter = getDeliveryHubAdapter("yandex")
    jest.spyOn(adapter, "quoteDropoffPointToPickupPoint").mockRejectedValue(
      new DeliveryHubError({
        code: "DELIVERY_HUB_PROVIDER_ERROR",
        message: "Yandex Delivery request failed with status 403",
        status: 502,
        details: {
          provider_status: 403,
          error_category: "provider_access_blocked",
          correlation_id: "corr_access_block",
        },
      })
    )

    await expect(service.listStoreQuotes({
      connection_id: connection.id,
      mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
      origin_point_id: "dropoff_1",
      destination_point_id: "pvz_1",
      destination_address: { fullname: "125009, Москва, Тверская 1" },
      origin_address: { fullname: "125009, Москва, Тверская 2" },
      currency_code: "RUB",
      items: [{ quantity: 1, weight_grams: 500, price: 2000 }],
    })).rejects.toMatchObject({
      code: "DELIVERY_HUB_PROVIDER_ERROR",
      status: 502,
      details: expect.objectContaining({
        provider_status: 403,
        error_category: "provider_access_blocked",
      }),
    })

    const upsertCalls = pg.calls.filter((call) => call.sql.includes("insert into delivery_connections"))
    expect(upsertCalls).toHaveLength(1)
    expect(upsertCalls[0].params[3]).toBe("active")
    expect(upsertCalls[0].params[8]).toBe(DELIVERY_HUB_CREDENTIALS_STATE.sealed)
    expect(upsertCalls[0].params[10]).toBe("2026-04-28T18:52:16.000Z")
    expect(upsertCalls[0].params[11]).toBe("DELIVERY_HUB_PROVIDER_ERROR")

    const eventLogCall = pg.calls.find((call) => call.sql.includes("insert into delivery_event_logs"))
    expect(eventLogCall).toBeDefined()
    expect(eventLogCall?.params[5]).toBe(false)
    expect(eventLogCall?.params[8]).toBe("DELIVERY_HUB_PROVIDER_ERROR")
  })

  it("does not invalidate sealed credentials on provider access-block pickup point failure", async () => {
    const connection = createConnectionRecord({
      enabled: true,
      status: "active",
      credentials_state: DELIVERY_HUB_CREDENTIALS_STATE.sealed,
      credentials_last_validated_at: "2026-04-28T18:52:16.000Z",
      credentials_last_error_code: null,
    })
    const pg = createMockPg([connection])
    const service = new DeliveryHubService(pg as any)
    const adapter = getDeliveryHubAdapter("yandex")
    jest.spyOn(adapter, "listPickupPoints").mockRejectedValue(
      new DeliveryHubError({
        code: "DELIVERY_HUB_PROVIDER_ERROR",
        message: "Yandex Delivery request failed with status 403",
        status: 502,
        details: {
          provider_status: 403,
          error_category: "provider_access_blocked",
          correlation_id: "corr_pickup_access_block",
        },
      })
    )

    await expect(service.listStorePickupPoints({
      connection_id: connection.id,
      city: "Moscow",
      country_code: "RU",
    })).rejects.toMatchObject({
      code: "DELIVERY_HUB_PROVIDER_ERROR",
      status: 502,
    })

    const upsertCalls = pg.calls.filter((call) => call.sql.includes("insert into delivery_connections"))
    expect(upsertCalls).toHaveLength(1)
    expect(upsertCalls[0].params[3]).toBe("active")
    expect(upsertCalls[0].params[8]).toBe(DELIVERY_HUB_CREDENTIALS_STATE.sealed)
    expect(upsertCalls[0].params[10]).toBe("2026-04-28T18:52:16.000Z")
    expect(upsertCalls[0].params[11]).toBe("DELIVERY_HUB_PROVIDER_ERROR")

    const settings = await service.getStoreSettings()
    expect(settings.settings.status).toBe("available")
    expect(settings.settings.summary.ready_connection_count).toBe(1)
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

      if (normalizedSql.includes("select to_regclass(?) as table_name")) {
        const tableName = String(normalizedParams[0] ?? "")

        return {
          rows: [
            {
              table_name:
                tableName === "delivery_connections" ||
                tableName === "delivery_warehouses" ||
                tableName === "delivery_event_logs"
                  ? tableName
                  : null,
            },
          ],
        }
      }

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

      if (normalizedSql.includes("delete from delivery_connections where id = ? returning *")) {
        const id = String(normalizedParams[0] ?? "")
        const row = connectionState.get(id)

        if (row) {
          connectionState.delete(id)
        }

        return {
          rows: row ? [row] : [],
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
