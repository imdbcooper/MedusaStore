import { describe, expect, it } from "@jest/globals"
import {
  buildShipmentOperationsCancelRequestBody,
  buildShipmentOperationsCancelUrl,
  buildShipmentOperationsRefreshStatusRequestBody,
  buildShipmentOperationsRefreshStatusUrl,
  buildShipmentOperationsRetryUrl,
  buildShipmentOperationsSnapshotUrl,
  connectionToForm,
  defaultConnectionForm,
  deriveExecutionPlanObservabilityRenderState,
  deriveFulfillmentBridgePreviewRenderState,
  deriveShipmentOperationsRenderState,
  deriveShippingOptionManualSyncRenderState,
  deriveShippingOptionPreviewRenderState,
  getDiagnosticsSummaryText,
  getFilteredEventLogs,
  getObservedEncryptionDisabled,
  getQuoteInputEchoLines,
  getQuoteModeHint,
  getShippingOptionSyncCapability,
  getWarehouseOptionLabel,
  getYandexConnections,
  getYandexWarehouses,
  normalizeConfig,
  warehouseToForm,
  type DeliveryConnection,
  type DeliveryEventLog,
  type DeliveryHubExecutionPlanObservabilityReadModel,
  type DeliveryHubFulfillmentBridgeReadinessPreview,
  type DeliveryHubShipmentOperationsSnapshot,
  type DeliveryHubShippingOptionManualSyncResponse,
  type DeliveryHubShippingOptionPreview,
  type DeliveryWarehouse,
} from "../page-state"
import { DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD } from "../manual-sync"

describe("delivery admin settings page state", () => {
  it("keeps connection form token write-only while preserving supported config fields", () => {
    const connection: DeliveryConnection = {
      id: "conn_yandex_1",
      provider_code: "yandex",
      name: "Yandex main",
      status: "active",
      mode: "live",
      enabled: true,
      country_code: "RU",
      credentials_state: "sealed",
      credentials_fingerprint: "fp_123",
      credentials_last_validated_at: "2026-04-21T10:00:00.000Z",
      credentials_last_error_code: null,
      credentials_present: true,
      config: {
        auto_confirm: true,
        label_format: "pdf",
        default_warehouse_id: "wh_main",
        token: "secret-token-that-must-not-roundtrip",
      },
      metadata: {
        authorization: "Bearer hidden",
      },
      created_at: "2026-04-20T10:00:00.000Z",
      updated_at: "2026-04-21T10:00:00.000Z",
    }

    expect(connectionToForm(connection)).toEqual({
      provider_code: "yandex",
      name: "Yandex main",
      mode: "live",
      enabled: true,
      country_code: "RU",
      token: "",
      auto_confirm: true,
      label_format: "pdf",
      default_warehouse_id: "wh_main",
    })
  })

  it("normalizes only truthful non-empty connection config fields", () => {
    expect(
      normalizeConfig({
        ...defaultConnectionForm,
        auto_confirm: true,
        label_format: "  pdf  ",
        default_warehouse_id: "  wh_123  ",
      })
    ).toEqual({
      auto_confirm: true,
      label_format: "pdf",
      default_warehouse_id: "wh_123",
    })

    expect(
      normalizeConfig({
        ...defaultConnectionForm,
        auto_confirm: false,
        label_format: "   ",
        default_warehouse_id: "",
      })
    ).toEqual({})
  })

  it("derives yandex-only connection and warehouse contours for admin selectors", () => {
    const warehouseWithoutProvider: DeliveryWarehouse = {
      id: "wh_legacy",
      name: "Legacy warehouse",
      enabled: true,
      country_code: "RU",
      city: null,
      address_line_1: null,
      contact_name: null,
      contact_phone: null,
      provider_code: null,
      provider_warehouse_id: null,
      metadata: {},
      created_at: "2026-04-20T10:00:00.000Z",
      updated_at: "2026-04-21T10:00:00.000Z",
    }

    expect(
      getYandexConnections([
        {
          id: "conn_yandex",
          provider_code: "yandex",
          name: "Yandex",
          status: "draft",
          mode: "test",
          enabled: false,
          country_code: "RU",
          credentials_state: "empty",
          credentials_fingerprint: null,
          credentials_last_validated_at: null,
          credentials_last_error_code: null,
          credentials_present: false,
          config: {},
          metadata: {},
          created_at: "2026-04-20T10:00:00.000Z",
          updated_at: "2026-04-21T10:00:00.000Z",
        },
        {
          id: "conn_other",
          provider_code: "cdek",
          name: "Other",
          status: "active",
          mode: "live",
          enabled: true,
          country_code: "RU",
          credentials_state: "sealed",
          credentials_fingerprint: null,
          credentials_last_validated_at: null,
          credentials_last_error_code: null,
          credentials_present: true,
          config: {},
          metadata: {},
          created_at: "2026-04-20T10:00:00.000Z",
          updated_at: "2026-04-21T10:00:00.000Z",
        },
      ]).map((connection) => connection.id)
    ).toEqual(["conn_yandex"])

    expect(
      getYandexWarehouses([
        warehouseWithoutProvider,
        {
          ...warehouseWithoutProvider,
          id: "wh_yandex",
          provider_code: "yandex",
        },
        {
          ...warehouseWithoutProvider,
          id: "wh_other",
          provider_code: "cdek",
        },
      ]).map((warehouse) => warehouse.id)
    ).toEqual(["wh_legacy", "wh_yandex"])
  })


  it("derives redacted diagnostics and quote input helper text for operators", () => {
    expect(
      getDiagnosticsSummaryText({
        status: "ok",
        provider_status: "ok",
        error_category: null,
        message: null,
        correlation_id: "corr_1",
        checked_at: "2026-04-21T10:00:00.000Z",
        redacted: true,
      })
    ).toBe("ok · provider=ok · category=n/a · correlation=corr_1")

    expect(getQuoteModeHint("warehouse_to_pickup_point")).toContain("mapped Delivery Hub warehouse")
    expect(getQuoteModeHint("dropoff_point_to_pickup_point")).toContain("origin Yandex dropoff")
    expect(
      getQuoteInputEchoLines({
        connection_id: "conn_1",
        mode_code: "warehouse_to_pickup_point",
        destination_point_id: "pvz_1",
        origin_point_id: null,
        warehouse_id: "wh_1",
        interval_utc: null,
        currency_code: "RUB",
        item_count: 1,
      })
    ).toEqual([
      "mode=warehouse_to_pickup_point",
      "destination=pvz_1",
      "warehouse=wh_1",
      "currency=RUB",
      "items=1",
    ])
  })

  it("formats warehouse labels and warehouse form fields for operator-facing selectors", () => {
    const warehouse: DeliveryWarehouse = {
      id: "wh_main",
      name: "Main warehouse",
      enabled: true,
      country_code: "RU",
      city: "Moscow",
      address_line_1: "Tverskaya 1",
      contact_name: "Operator",
      contact_phone: "+79990000000",
      provider_code: "yandex",
      provider_warehouse_id: "YANDEX-01",
      metadata: {},
      created_at: "2026-04-20T10:00:00.000Z",
      updated_at: "2026-04-21T10:00:00.000Z",
    }

    expect(getWarehouseOptionLabel(warehouse)).toBe(
      "Main warehouse · Moscow, Tverskaya 1 · provider: YANDEX-01"
    )

    expect(warehouseToForm(warehouse)).toEqual({
      name: "Main warehouse",
      enabled: true,
      country_code: "RU",
      city: "Moscow",
      address_line_1: "Tverskaya 1",
      contact_name: "Operator",
      contact_phone: "+79990000000",
      provider_code: "yandex",
      provider_warehouse_id: "YANDEX-01",
    })
  })

  it("derives preview state for happy path sections without exposing hidden payload fragments", () => {
    const preview: DeliveryHubShippingOptionPreview = {
      provider_code: "yandex",
      provider_id: "prov_yandex",
      current_options: [
        {
          id: "so_current_1",
          provider_id: "prov_yandex",
          data: {
            id: "deliveryhub.warehouse_to_pickup_point",
            secret_token: "must-not-be-rendered-via-derived-state",
          },
        },
      ],
      plan: {
        provider_code: "yandex",
        provider_id: "prov_yandex",
        desired_options: [
          {
            status: "projected",
            mode_code: "warehouse_to_pickup_point",
            data: {
              version: 1,
              provider_code: "yandex",
              provider_id: "prov_yandex",
              id: "deliveryhub.warehouse_to_pickup_point",
              mode_code: "warehouse_to_pickup_point",
            },
            supporting_connection_ids: ["conn_a", "conn_b"],
          },
        ],
        deferred_options: [
          {
            status: "deferred",
            mode_code: "dropoff_point_to_pickup_point",
            data: {
              version: 1,
              provider_code: "yandex",
              provider_id: "prov_yandex",
              id: "deliveryhub.dropoff_point_to_pickup_point",
              mode_code: "dropoff_point_to_pickup_point",
            },
            issues: [
              {
                connection_id: "conn_b",
                provider_code: "yandex",
                code: "WAREHOUSE_REQUIRED",
                message: "Warehouse must be configured",
                mode_code: "dropoff_point_to_pickup_point",
              },
            ],
          },
        ],
        connection_plans: [
          {
            connection_id: "conn_a",
            provider_code: "yandex",
            status: "projected",
            projected_mode_codes: ["warehouse_to_pickup_point"],
            issues: [],
          },
          {
            connection_id: "conn_b",
            provider_code: "yandex",
            status: "deferred",
            projected_mode_codes: [],
            issues: [
              {
                code: "WAREHOUSE_REQUIRED",
                message: "Warehouse must be configured",
                mode_code: "dropoff_point_to_pickup_point",
              },
            ],
          },
        ],
      },
      reconciliation: {
        provider_code: "yandex",
        provider_id: "prov_yandex",
        create_candidates: [
          {
            desired: {
              status: "projected",
              mode_code: "warehouse_to_pickup_point",
              data: {
                version: 1,
                provider_code: "yandex",
                provider_id: "prov_yandex",
                id: "deliveryhub.warehouse_to_pickup_point",
                mode_code: "warehouse_to_pickup_point",
              },
              supporting_connection_ids: ["conn_a"],
            },
          },
        ],
        update_candidates: [
          {
            desired: {
              status: "projected",
              mode_code: "dropoff_point_to_pickup_point",
              data: {
                version: 1,
                provider_code: "yandex",
                provider_id: "prov_yandex",
                id: "deliveryhub.dropoff_point_to_pickup_point",
                mode_code: "dropoff_point_to_pickup_point",
              },
              supporting_connection_ids: ["conn_b"],
            },
            current: {
              id: "so_current_2",
              provider_id: "prov_yandex",
              data: {
                id: "deliveryhub.dropoff_point_to_pickup_point",
                api_key: "still-must-not-surface",
              },
            },
            normalized_current_data: {
              version: 1,
              provider_code: "yandex",
              provider_id: "prov_yandex",
              id: "deliveryhub.dropoff_point_to_pickup_point",
              mode_code: "dropoff_point_to_pickup_point",
            },
            reasons: ["name_mismatch", "price_type_mismatch"],
          },
        ],
        unchanged: [
          {
            desired: {
              status: "projected",
              mode_code: "warehouse_to_pickup_point",
              data: {
                version: 1,
                provider_code: "yandex",
                provider_id: "prov_yandex",
                id: "deliveryhub.unchanged",
                mode_code: "warehouse_to_pickup_point",
              },
              supporting_connection_ids: ["conn_a"],
            },
            current: {
              id: "so_current_unchanged",
              provider_id: "prov_yandex",
            },
            normalized_current_data: {
              version: 1,
              provider_code: "yandex",
              provider_id: "prov_yandex",
              id: "deliveryhub.unchanged",
              mode_code: "warehouse_to_pickup_point",
            },
          },
        ],
        orphaned_managed_options: [
          {
            current: {
              id: "so_orphaned",
              provider_id: "prov_yandex",
            },
            normalized_current_data: {
              version: 1,
              provider_code: "yandex",
              provider_id: "prov_yandex",
              id: "deliveryhub.orphaned",
              mode_code: "warehouse_to_pickup_point",
            },
            reason: "provider_connection_missing",
          },
        ],
        ignored_foreign_options: [
          {
            current: {
              id: "so_foreign",
              provider_id: "foreign_provider",
              data: {
                token: "foreign-secret",
              },
            },
          },
        ],
      },
      summary: {
        current_option_count: 5,
        desired_option_count: 2,
        deferred_option_count: 1,
        deferred_issue_count: 1,
        connection_plan_count: 2,
        create_candidate_count: 1,
        update_candidate_count: 1,
        unchanged_count: 1,
        orphaned_managed_option_count: 1,
        ignored_foreign_option_count: 1,
      },
    }

    const state = deriveShippingOptionPreviewRenderState(preview)

    expect(state.headerText).toBe("yandex · prov_yandex")
    expect(state.summaryCards.map((card) => [card.key, card.value])).toEqual(
      expect.arrayContaining([
        ["desired_option_count", "2"],
        ["deferred_option_count", "1"],
        ["connection_plan_count", "2"],
      ])
    )
    expect(state.desiredOptions).toEqual([
      {
        key: "deliveryhub.warehouse_to_pickup_point",
        modeCode: "warehouse_to_pickup_point",
        id: "deliveryhub.warehouse_to_pickup_point",
        supportingConnectionsText: "conn_a, conn_b",
      },
    ])
    expect(state.deferredOptions[0]).toEqual({
      key: "deliveryhub.dropoff_point_to_pickup_point",
      modeCode: "dropoff_point_to_pickup_point",
      id: "deliveryhub.dropoff_point_to_pickup_point",
      issues: [
        {
          key: "deliveryhub.dropoff_point_to_pickup_point-conn_b-WAREHOUSE_REQUIRED-0",
          code: "WAREHOUSE_REQUIRED",
          message: "Warehouse must be configured",
          connectionText: "connection: conn_b · provider: yandex",
        },
      ],
    })
    expect(state.reconciliationCounts).toEqual({
      createCandidates: "1",
      updateCandidates: "1",
      unchanged: "1",
      orphanedManaged: "1",
      ignoredForeign: "1",
    })
    expect(state.updateCandidates[0].subtitle).toBe(
      "desired: deliveryhub.dropoff_point_to_pickup_point · reasons: name_mismatch, price_type_mismatch"
    )
    expect(state.orphanedManagedEntries[0].subtitle).toBe(
      "deliveryhub.orphaned · reason: provider_connection_missing"
    )
    expect(state.ignoredForeignEntries[0]).toEqual({
      key: "so_foreign",
      title: "so_foreign",
      subtitle: "provider: foreign_provider",
    })
    expect(state.connectionPlans.map((plan) => [plan.connectionId, plan.status, plan.projectedModesText])).toEqual([
      ["conn_a", "projected", "warehouse_to_pickup_point"],
      ["conn_b", "deferred", "—"],
    ])

    const renderedState = JSON.stringify(state)
    expect(renderedState).not.toContain("secret-token-that-must-not-roundtrip")
    expect(renderedState).not.toContain("still-must-not-surface")
    expect(renderedState).not.toContain("foreign-secret")
  })

  it("derives preview empty and guard states when backend returns no preview payload", () => {
    expect(deriveShippingOptionPreviewRenderState(null)).toEqual({
      headerText: "Preview unavailable",
      summaryCards: [],
      desiredOptions: [],
      desiredEmptyText: "Planner has no rollout-ready desired deliveryhub options yet.",
      deferredOptions: [],
      deferredEmptyText: "No deferred deliveryhub mode projections currently reported by planner.",
      reconciliationCounts: {
        createCandidates: "0",
        updateCandidates: "0",
        unchanged: "0",
        orphanedManaged: "0",
        ignoredForeign: "0",
      },
      createCandidates: [],
      updateCandidates: [],
      unchangedEntries: [],
      orphanedManagedEntries: [],
      ignoredForeignEntries: [],
      connectionPlans: [],
      connectionPlansEmptyText: "No delivery connection planner state returned by backend.",
    })
  })

  it("derives fulfillment bridge preview state without leaking payload internals", () => {
    const preview: DeliveryHubFulfillmentBridgeReadinessPreview = {
      provider_code: "deliveryhub",
      provider_id: "deliveryhub_deliveryhub",
      shipping_option_preview: {
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
        current_options: [],
        plan: {
          provider_code: "deliveryhub",
          provider_id: "deliveryhub_deliveryhub",
          desired_options: [],
          deferred_options: [],
          connection_plans: [],
        },
        reconciliation: {
          provider_code: "deliveryhub",
          provider_id: "deliveryhub_deliveryhub",
          create_candidates: [],
          update_candidates: [],
          unchanged: [],
          orphaned_managed_options: [],
          ignored_foreign_options: [],
        },
        summary: {
          current_option_count: 0,
          desired_option_count: 1,
          deferred_option_count: 1,
          deferred_issue_count: 1,
          connection_plan_count: 1,
          create_candidate_count: 0,
          update_candidate_count: 0,
          unchanged_count: 0,
          orphaned_managed_option_count: 0,
          ignored_foreign_option_count: 0,
        },
      },
      bridge_preview: {
        version: 1,
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
        mode_previews: [
          {
            mode_code: "warehouse_to_pickup_point",
            status: "ready",
            rollout_status: "projected",
            supporting_connection_ids: ["conn_a", "conn_b"],
            blocking_issues: [],
            steps: [
              {
                key: "shipping_option_contract",
                ready: true,
                message: "contract ready",
              },
              {
                key: "fulfillment_payload",
                ready: true,
                message: "payload ready",
              },
            ],
            selection: {
              secret: "must-not-leak",
            },
            shipping_option_data: {
              token: "must-not-leak",
            },
            fulfillment_payload: {
              api_key: "must-not-leak",
            },
            create_fulfillment_payload: {
              password: "must-not-leak",
            },
            shipment_execution: {
              materialized: false,
              reason: "Shipment execution remains disabled.",
            },
            error: null,
          },
          {
            mode_code: "dropoff_point_to_pickup_point",
            status: "error",
            rollout_status: "deferred",
            supporting_connection_ids: [],
            blocking_issues: [
              {
                connection_id: "conn_b",
                provider_code: "yandex",
                code: "WAREHOUSE_REQUIRED",
                message: "Warehouse required",
                mode_code: "dropoff_point_to_pickup_point",
              },
            ],
            steps: [
              {
                key: "shipping_option_contract",
                ready: false,
                message: "validation failed",
              },
            ],
            selection: null,
            shipping_option_data: null,
            fulfillment_payload: null,
            create_fulfillment_payload: null,
            shipment_execution: {
              materialized: false,
              reason: "Shipment execution remains disabled.",
            },
            error: {
              message: "validation failed",
            },
          },
        ],
        summary: {
          mode_count: 2,
          ready_mode_count: 1,
          error_mode_count: 1,
          projected_mode_count: 1,
          deferred_mode_count: 1,
        },
      },
      summary: {
        mode_count: 2,
        ready_mode_count: 1,
        error_mode_count: 1,
        projected_mode_count: 1,
        deferred_mode_count: 1,
      },
    }

    const state = deriveFulfillmentBridgePreviewRenderState(preview)

    expect(state.headerText).toBe("deliveryhub · deliveryhub_deliveryhub")
    expect(state.summaryCards.map((card) => [card.key, card.value])).toEqual([
      ["mode_count", "2"],
      ["ready_mode_count", "1"],
      ["error_mode_count", "1"],
      ["projected_mode_count", "1"],
      ["deferred_mode_count", "1"],
    ])
    expect(state.modePreviews).toEqual([
      {
        key: "warehouse_to_pickup_point",
        modeCode: "warehouse_to_pickup_point",
        status: "ready",
        rolloutStatus: "projected",
        supportingConnectionsText: "conn_a, conn_b",
        stepReadinessText: "2/2",
        issueBadges: [],
        errorText: null,
        shipmentExecutionText: "Shipment execution remains disabled.",
      },
      {
        key: "dropoff_point_to_pickup_point",
        modeCode: "dropoff_point_to_pickup_point",
        status: "error",
        rolloutStatus: "deferred",
        supportingConnectionsText: "—",
        stepReadinessText: "0/1",
        issueBadges: [
          {
            key: "dropoff_point_to_pickup_point-conn_b-WAREHOUSE_REQUIRED-0",
            label: "WAREHOUSE_REQUIRED · conn_b",
          },
        ],
        errorText: "validation failed",
        shipmentExecutionText: "Shipment execution remains disabled.",
      },
    ])

    const renderedState = JSON.stringify(state)
    expect(renderedState).not.toContain("must-not-leak")
  })

  it("derives fulfillment bridge empty state when backend returns no bridge preview payload", () => {
    expect(deriveFulfillmentBridgePreviewRenderState(null)).toEqual({
      headerText: "Preview unavailable",
      summaryCards: [],
      modePreviews: [],
      emptyText:
        "Fulfillment bridge readiness preview is unavailable until backend returns a diagnostic-only bridge preview payload.",
    })
  })

  it("derives execution-plan observability render state without leaking internal payload fragments", () => {
    const preview: DeliveryHubExecutionPlanObservabilityReadModel = {
      provider_code: "deliveryhub",
      provider_id: "deliveryhub_deliveryhub",
      shipping_option_preview: {
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
        current_options: [],
        plan: {
          provider_code: "deliveryhub",
          provider_id: "deliveryhub_deliveryhub",
          desired_options: [],
          deferred_options: [],
          connection_plans: [],
        },
        reconciliation: {
          provider_code: "deliveryhub",
          provider_id: "deliveryhub_deliveryhub",
          create_candidates: [],
          update_candidates: [],
          unchanged: [],
          orphaned_managed_options: [],
          ignored_foreign_options: [],
        },
        summary: {
          current_option_count: 0,
          desired_option_count: 0,
          deferred_option_count: 0,
          deferred_issue_count: 0,
          connection_plan_count: 0,
          create_candidate_count: 0,
          update_candidate_count: 0,
          unchanged_count: 0,
          orphaned_managed_option_count: 0,
          ignored_foreign_option_count: 0,
        },
      },
      execution_plan_preview: {
        version: 1,
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
        mode_previews: [
          {
            mode_code: "warehouse_to_pickup_point",
            status: "ready",
            rollout_status: "projected",
            supporting_connection_ids: ["conn_a", "conn_b"],
            blocking_issues: [
              {
                connection_id: "conn_b",
                provider_code: "yandex",
                code: "MISSING_WAREHOUSE",
                message: "Warehouse required",
                mode_code: "warehouse_to_pickup_point",
              },
            ],
            readiness_verdict: {
              status: "ready",
              blocked_reasons: [],
            },
            blocked_reasons: ["Shipment execution remains disabled."],
            issues: [
              {
                code: "DELIVERY_HUB_SHAPE_DRIFT",
                message: "must-not-leak",
                field_path: "fulfillment_data.internal",
              },
            ],
            steps: [
              {
                key: "delivery_payload",
                ready: true,
                message: "Payload normalized",
              },
              {
                key: "provider_execution_plan",
                ready: true,
                message: "Plan ready",
              },
              {
                key: "execution_identity",
                ready: true,
                message: "Identity ready",
              },
              {
                key: "persistence_audit_preview",
                ready: true,
                message: "Persistence preview ready",
              },
            ],
            execution_plan: {
              version: 1,
              operation: "create_shipment",
              connection_id: "conn_a",
              mode_code: "warehouse_to_pickup_point",
              quote_reference: {
                id: "ref_1",
                version: 1,
              },
              order: {
                id: null,
                display_id: "ord_1",
                currency_code: "RUB",
              },
              fulfillment: {
                id: null,
                location_id: null,
              },
              items: [
                {
                  line_item_id: "item_1",
                  quantity: 1,
                },
              ],
              outbound_request: {
                method: "POST",
                path: "/shipments",
                headers: {
                  authorization: "Bearer ***",
                  "content-type": "application/json",
                },
              },
            },
            execution_identity: {
              version: 1,
              redacted: true,
              operation: "create_shipment",
              provider_operation_label: "create_shipment:warehouse_to_pickup_point",
              provider_operation_reference: "dhprev_1234567890abcdef",
              plan_fingerprint: "plan_fp_123",
              execution_fingerprint: "execution_fp_456",
              idempotency_key_preview: "deliveryhub:preview:create_shipment:identity_789",
            },
            outbound_payload_preview: {
              redacted: true,
              request: {
                headers: {
                  authorization: "Bearer ***",
                },
              },
            },
            persistence_audit_preview: {
              version: 1,
              redacted: true,
              status: "ready",
              metadata_patch: {
                target: "fulfillment_execution_shadow",
                action: "merge",
                fields: [
                  {
                    field: "execution_reference",
                    value_preview: "dhprev_1234567890abcdef",
                  },
                ],
              },
              execution_record: {
                ready: true,
                record_type: "deliveryhub_shipment_execution",
                operation: "create_shipment",
                provider_code: "deliveryhub",
                provider_id: "deliveryhub_deliveryhub",
                connection_id: "conn_a",
                mode_code: "warehouse_to_pickup_point",
                execution_reference: "dhprev_1234567890abcdef",
                idempotency_key_preview: "deliveryhub:preview:create_shipment:identity_789",
                initial_status: "planned",
              },
              idempotency_reservation: {
                ready: true,
                dedupe_scope: "deliveryhub:create_shipment",
                reservation_key_preview: "deliveryhub:preview:create_shipment:identity_789",
                matched_fields: [
                  {
                    field: "execution_fingerprint",
                    value_preview: "execution_fp_456",
                  },
                ],
              },
              status_transitions: [
                {
                  from: "planned",
                  to: "persisted",
                  reason: "Persist preview before provider dispatch.",
                },
              ],
              audit_log_entries: [
                {
                  kind: "execution.persistence.prepare",
                  message: "Prepare persistence preview.",
                  payload: {
                    execution_reference: "dhprev_1234567890abcdef",
                    shipment_execution_blocked: true,
                  },
                },
              ],
              blocked: [
                {
                  key: "provider_dispatch",
                  reason: "Shipment execution remains disabled.",
                },
              ],
              deferred: [
                {
                  key: "audit_log_commit",
                  reason: "Audit log commit stays deferred in preview mode.",
                },
              ],
            },
            preflight_eligibility: {
              version: 1,
              redacted: true,
              current_mode: "preview_only",
              decision: "eligible_when_enabled",
              real_execution_enabled: false,
              future_execution_flag: {
                name: "DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED",
                status: "future_inert_not_read",
                description: "Future inert flag name; not read by this preview.",
              },
              reasons: [
                {
                  code: "EXECUTION_PREVIEW_ONLY",
                  message: "Preview only.",
                },
                {
                  code: "FUTURE_EXECUTION_FLAG_INERT",
                  message: "Future flag name is inert.",
                },
                {
                  code: "LIVE_EXECUTION_DISABLED",
                  message: "Live execution disabled.",
                },
              ],
              required_prerequisites: [
                {
                  code: "operator_approval",
                  label: "Operator approval",
                  status: "required_future_work",
                },
                {
                  code: "provider_execution_adapter_readiness",
                  label: "Provider adapter readiness",
                  status: "required_future_work",
                },
              ],
              confirmations: {
                shipment_execution_disabled: true,
                provider_calls_disabled: true,
                persistence_writes_disabled: true,
                checkout_cutover_disabled: true,
              },
              blocked_live_actions: [
                {
                  code: "provider_create_shipment_call",
                  label: "Provider create shipment call",
                  blocked: true,
                },
                {
                  code: "checkout_cutover",
                  label: "Checkout cutover",
                  blocked: true,
                },
              ],
            },
            provider_dispatch_preview: {
              version: 1,
              redacted: true,
              current_mode: "preview_only",
              dispatch_decision: "ready_for_future_dispatch",
              provider: {
                provider_code: "deliveryhub",
                provider_id: "deliveryhub_deliveryhub",
                provider_key: "deliveryhub",
                adapter_operation: "create_shipment",
                adapter_operation_label: "create_shipment:warehouse_to_pickup_point",
              },
              command_identity: {
                provider_operation_reference: "dhprev_1234567890abcdef",
                idempotency_key_preview: "deliveryhub:preview:create_shipment:identity_789",
                plan_fingerprint: "plan_fp_123",
                execution_fingerprint: "execution_fp_456",
              },
              command_envelope_summary: {
                connection_id_present: true,
                mode_code: "warehouse_to_pickup_point",
                origin_kind: "fulfillment_location",
                destination_kind: "pickup_point",
                quote_reference_present: true,
                offer_reference_present: true,
                package_reference_present: true,
                order_reference_present: true,
                fulfillment_reference_present: false,
                pickup_scheduling_reference_present: false,
                dropoff_scheduling_reference_present: false,
                item_count: 1,
              },
              blocked_dispatch_actions: [
                {
                  code: "adapter_invocation",
                  label: "Adapter invocation",
                  reason: "Adapter disabled.",
                  blocked: true,
                },
                {
                  code: "provider_network_call",
                  label: "Provider network call",
                  reason: "Network disabled.",
                  blocked: true,
                },
                {
                  code: "checkout_cutover",
                  label: "Checkout cutover",
                  reason: "Checkout disabled.",
                  blocked: true,
                },
              ],
              confirmations: {
                adapter_invocation_disabled: true,
                provider_network_calls_disabled: true,
                shipment_creation_disabled: true,
                label_creation_disabled: true,
                order_mutation_disabled: true,
                persistence_writes_disabled: true,
                checkout_cutover_disabled: true,
              },
            },
            failure_handling_preview: {
              version: 1,
              redacted: true,
              current_mode: "preview_only",
              failure_path_decision: "projected_retry_policy",
              projected_failure_status: "manual_intervention_required_when_enabled",
              failure_classes: [
                {
                  code: "provider_dispatch_failure",
                  retry_eligibility: "eligible_when_enabled",
                  compensation_requirement: "required_when_enabled",
                  manual_intervention: "required_when_enabled",
                  reason_bucket: "dispatch_transport",
                },
              ],
              identity_linkage: {
                provider_operation_reference: "dhprev_1234567890abcdef",
                idempotency_key_preview: "deliveryhub:preview:create_shipment:identity_789",
                plan_fingerprint: "plan_fp_123",
                execution_fingerprint: "execution_fp_456",
              },
              retry_projection: {
                eligibility: "eligible_when_enabled",
                policy: "deterministic_preview_only",
                retry_block_reasons: ["retry_scheduling_disabled_in_preview_only_mode"],
                scheduling_status: "disabled",
              },
              compensation_projection: {
                requirement: "required_when_enabled",
                write_plan_status: "disabled",
                rollback_status: "disabled",
                blocked_actions: [
                  "compensation_write_disabled_in_preview_only_mode",
                  "rollback_disabled_in_preview_only_mode",
                ],
              },
              manual_intervention_projection: {
                status: "required_when_enabled",
                reason_markers: ["projected_provider_failure_triage"],
              },
              blocked_failure_actions: [
                {
                  code: "retry_scheduling",
                  label: "Retry scheduling",
                  reason: "Retry scheduling remains disabled.",
                  blocked: true,
                },
                {
                  code: "compensation_write",
                  label: "Compensation write",
                  reason: "Compensation persistence remains disabled.",
                  blocked: true,
                },
              ],
              confirmations: {
                retry_scheduling_disabled: true,
                rollback_disabled: true,
                compensation_writes_disabled: true,
                order_mutation_disabled: true,
                fulfillment_mutation_disabled: true,
                event_persistence_disabled: true,
                provider_redispatch_disabled: true,
                checkout_cutover_disabled: true,
              },
            },
            shipment_result_preview: {
              version: 1,
              redacted: true,
              current_mode: "preview_only",
              result_decision: "projected_for_future_execution",
              projected_result_status: "projected_for_future_execution",
              result_kind: "shipment_result",
              normalization_target: "deliveryhub_shipment_result",
              provider_normalization_target: "create_shipment_response",
              identity_linkage: {
                provider_operation_reference: "dhprev_1234567890abcdef",
                idempotency_key_preview: "deliveryhub:preview:create_shipment:identity_789",
                plan_fingerprint: "plan_fp_123",
                execution_fingerprint: "execution_fp_456",
              },
              artifact_summary: {
                external_shipment_reference_present: true,
                tracking_reference_present: true,
                label_document_present: true,
                pickup_booking_present: false,
                pickup_interval_present: false,
                status_timeline_present: true,
                failure_placeholder_present: true,
                rollback_placeholder_present: true,
              },
              blocked_materialization_actions: [
                {
                  code: "provider_response_fetch",
                  label: "Provider response fetch",
                  reason: "Provider response fetch disabled.",
                  blocked: true,
                },
                {
                  code: "label_persistence",
                  label: "Label persistence",
                  reason: "Label persistence disabled.",
                  blocked: true,
                },
                {
                  code: "checkout_cutover",
                  label: "Checkout cutover",
                  reason: "Checkout cutover disabled.",
                  blocked: true,
                },
              ],
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
              version: 1,
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
              identity_linkage: {
                provider_operation_reference: "dhprev_1234567890abcdef",
                idempotency_key_preview: "deliveryhub:preview:create_shipment:identity_789",
                plan_fingerprint: "plan_fp_123",
                execution_fingerprint: "execution_fp_456",
              },
              persistence_linkage: {
                execution_reference_present: true,
                idempotency_reservation_present: true,
                audit_log_reference_present: true,
              },
              blocked_application_actions: [
                {
                  code: "order_mutation",
                  label: "Order mutation",
                  reason: "Order mutation disabled.",
                  blocked: true,
                },
                {
                  code: "event_persistence",
                  label: "Event persistence",
                  reason: "Event persistence disabled.",
                  blocked: true,
                },
              ],
              confirmations: {
                order_mutation_disabled: true,
                fulfillment_persistence_disabled: true,
                shipment_persistence_disabled: true,
                label_persistence_disabled: true,
                event_persistence_disabled: true,
                checkout_cutover_disabled: true,
              },
            },
            execution_lifecycle_preview: {
              version: 1,
              redacted: true,
              current_mode: "preview_only",
              lifecycle_status: "projected_for_future_execution",
              readiness_posture: "ready_when_enabled",
              phase_sequence: [
                "preflight_eligibility",
                "provider_dispatch",
                "shipment_result_normalization",
                "fulfillment_application",
                "failure_handling",
              ],
              identity_correlation: {
                provider_operation_reference: "dhprev_1234567890abcdef",
                idempotency_key_preview: "deliveryhub:preview:create_shipment:identity_789",
                plan_fingerprint: "plan_fp_123",
                execution_fingerprint: "execution_fp_456",
              },
              phases: [
                {
                  code: "preflight_eligibility",
                  order: 1,
                  status: "projected_for_future_execution",
                  readiness_posture: "ready_when_enabled",
                  block_reasons: [
                    "EXECUTION_PREVIEW_ONLY",
                    "FUTURE_EXECUTION_FLAG_INERT",
                    "LIVE_EXECUTION_DISABLED",
                  ],
                  disabled_live_actions: [
                    "provider_create_shipment_call",
                    "checkout_cutover",
                  ],
                  linked_preview_artifacts: [
                    "preflight_eligibility",
                    "execution_identity",
                    "persistence_audit_preview",
                  ],
                },
                {
                  code: "provider_dispatch",
                  order: 2,
                  status: "projected_for_future_execution",
                  readiness_posture: "ready_when_enabled",
                  block_reasons: ["Adapter disabled.", "Network disabled.", "Checkout disabled."],
                  disabled_live_actions: [
                    "adapter_invocation",
                    "provider_network_call",
                    "checkout_cutover",
                  ],
                  linked_preview_artifacts: ["provider_dispatch_preview", "execution_identity"],
                },
                {
                  code: "shipment_result_normalization",
                  order: 3,
                  status: "projected_for_future_execution",
                  readiness_posture: "ready_when_enabled",
                  block_reasons: [
                    "Provider response fetch disabled.",
                    "Label persistence disabled.",
                    "Checkout cutover disabled.",
                  ],
                  disabled_live_actions: [
                    "provider_response_fetch",
                    "label_persistence",
                    "checkout_cutover",
                  ],
                  linked_preview_artifacts: [
                    "shipment_result_preview",
                    "provider_dispatch_preview",
                    "execution_identity",
                  ],
                },
                {
                  code: "fulfillment_application",
                  order: 4,
                  status: "projected_for_future_execution",
                  readiness_posture: "ready_when_enabled",
                  block_reasons: ["Order mutation disabled.", "Event persistence disabled."],
                  disabled_live_actions: ["order_mutation", "event_persistence"],
                  linked_preview_artifacts: [
                    "fulfillment_application_preview",
                    "shipment_result_preview",
                    "persistence_audit_preview",
                    "execution_identity",
                  ],
                },
                {
                  code: "failure_handling",
                  order: 5,
                  status: "projected_for_future_execution",
                  readiness_posture: "ready_when_enabled",
                  block_reasons: [
                    "retry_scheduling_disabled_in_preview_only_mode",
                    "Retry scheduling remains disabled.",
                    "Compensation persistence remains disabled.",
                  ],
                  disabled_live_actions: ["retry_scheduling", "compensation_write"],
                  linked_preview_artifacts: [
                    "failure_handling_preview",
                    "provider_dispatch_preview",
                    "shipment_result_preview",
                    "fulfillment_application_preview",
                    "execution_identity",
                  ],
                },
              ],
              confirmations: {
                preview_only: true,
                orchestration_scheduling_disabled: true,
                shipment_execution_disabled: true,
                provider_calls_disabled: true,
                persistence_writes_disabled: true,
                retry_scheduling_disabled: true,
                compensation_writes_disabled: true,
                order_mutation_disabled: true,
                fulfillment_mutation_disabled: true,
                checkout_cutover_disabled: true,
              },
            },
            shipment_execution: {
              materialized: false,
              reason: "Shipment execution remains disabled.",
            },
          },
          {
            mode_code: "dropoff_point_to_pickup_point",
            status: "blocked",
            rollout_status: "deferred",
            supporting_connection_ids: [],
            blocking_issues: [],
            readiness_verdict: {
              status: "blocked",
              blocked_reasons: ["Missing connection"],
            },
            blocked_reasons: ["Missing connection", "Shipment execution remains disabled."],
            issues: [],
            steps: [
              {
                key: "provider_execution_plan",
                ready: false,
                message: "Plan blocked",
              },
              {
                key: "persistence_audit_preview",
                ready: false,
                message: "Persistence preview blocked",
              },
            ],
            execution_plan: null,
            execution_identity: null,
            outbound_payload_preview: {
              redacted: true,
              request: null,
            },
            persistence_audit_preview: {
              version: 1,
              redacted: true,
              status: "blocked",
              metadata_patch: {
                target: "fulfillment_execution_shadow",
                action: "merge",
                fields: [],
              },
              execution_record: {
                ready: false,
                record_type: "deliveryhub_shipment_execution",
                operation: "create_shipment",
                provider_code: "deliveryhub",
                provider_id: "deliveryhub_deliveryhub",
                connection_id: null,
                mode_code: null,
                execution_reference: null,
                idempotency_key_preview: null,
                initial_status: null,
              },
              idempotency_reservation: {
                ready: false,
                dedupe_scope: "deliveryhub:create_shipment",
                reservation_key_preview: null,
                matched_fields: [],
              },
              status_transitions: [],
              audit_log_entries: [],
              blocked: [
                {
                  key: "execution_plan_prerequisite",
                  reason: "Persistence preview blocked.",
                },
              ],
              deferred: [
                {
                  key: "terminal_status_resolution",
                  reason: "Terminal resolution deferred.",
                },
              ],
            },
            preflight_eligibility: {
              version: 1,
              redacted: true,
              current_mode: "preview_only",
              decision: "not_ready",
              real_execution_enabled: false,
              future_execution_flag: {
                name: "DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED",
                status: "future_inert_not_read",
                description: "Future inert flag name; not read by this preview.",
              },
              reasons: [
                {
                  code: "EXECUTION_PREVIEW_ONLY",
                  message: "Preview only.",
                },
                {
                  code: "EXECUTION_PLAN_NOT_READY",
                  message: "Plan not ready.",
                },
              ],
              required_prerequisites: [
                {
                  code: "operator_approval",
                  label: "Operator approval",
                  status: "required_future_work",
                },
              ],
              confirmations: {
                shipment_execution_disabled: true,
                provider_calls_disabled: true,
                persistence_writes_disabled: true,
                checkout_cutover_disabled: true,
              },
              blocked_live_actions: [
                {
                  code: "provider_create_shipment_call",
                  label: "Provider create shipment call",
                  blocked: true,
                },
              ],
            },
            provider_dispatch_preview: {
              version: 1,
              redacted: true,
              current_mode: "preview_only",
              dispatch_decision: "not_dispatched",
              provider: {
                provider_code: "deliveryhub",
                provider_id: "deliveryhub_deliveryhub",
                provider_key: "deliveryhub",
                adapter_operation: "create_shipment",
                adapter_operation_label: "create_shipment",
              },
              command_identity: {
                provider_operation_reference: null,
                idempotency_key_preview: null,
                plan_fingerprint: null,
                execution_fingerprint: null,
              },
              command_envelope_summary: {
                connection_id_present: false,
                mode_code: null,
                origin_kind: "unknown",
                destination_kind: "unknown",
                quote_reference_present: false,
                offer_reference_present: false,
                package_reference_present: false,
                order_reference_present: false,
                fulfillment_reference_present: false,
                pickup_scheduling_reference_present: false,
                dropoff_scheduling_reference_present: false,
                item_count: 0,
              },
              blocked_dispatch_actions: [
                {
                  code: "adapter_invocation",
                  label: "Adapter invocation",
                  reason: "Adapter disabled.",
                  blocked: true,
                },
              ],
              confirmations: {
                adapter_invocation_disabled: true,
                provider_network_calls_disabled: true,
                shipment_creation_disabled: true,
                label_creation_disabled: true,
                order_mutation_disabled: true,
                persistence_writes_disabled: true,
                checkout_cutover_disabled: true,
              },
            },
            shipment_result_preview: {
              version: 1,
              redacted: true,
              current_mode: "preview_only",
              result_decision: "not_materialized",
              projected_result_status: "not_materialized",
              result_kind: "shipment_result",
              normalization_target: "deliveryhub_shipment_result",
              provider_normalization_target: "create_shipment_response",
              identity_linkage: {
                provider_operation_reference: null,
                idempotency_key_preview: null,
                plan_fingerprint: null,
                execution_fingerprint: null,
              },
              artifact_summary: {
                external_shipment_reference_present: false,
                tracking_reference_present: false,
                label_document_present: false,
                pickup_booking_present: false,
                pickup_interval_present: false,
                status_timeline_present: false,
                failure_placeholder_present: true,
                rollback_placeholder_present: true,
              },
              blocked_materialization_actions: [
                {
                  code: "provider_response_fetch",
                  label: "Provider response fetch",
                  reason: "Provider response fetch disabled.",
                  blocked: true,
                },
              ],
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
            failure_handling_preview: {
              version: 1,
              redacted: true,
              current_mode: "preview_only",
              failure_path_decision: "no_live_failure_path",
              projected_failure_status: "not_applicable_in_preview",
              failure_classes: [
                {
                  code: "provider_dispatch_failure",
                  retry_eligibility: "blocked",
                  compensation_requirement: "not_required",
                  manual_intervention: "not_required",
                  reason_bucket: "dispatch_transport",
                },
              ],
              identity_linkage: {
                provider_operation_reference: null,
                idempotency_key_preview: null,
                plan_fingerprint: null,
                execution_fingerprint: null,
              },
              retry_projection: {
                eligibility: "blocked",
                policy: "deterministic_preview_only",
                retry_block_reasons: ["execution_plan_not_ready"],
                scheduling_status: "disabled",
              },
              compensation_projection: {
                requirement: "not_required",
                write_plan_status: "disabled",
                rollback_status: "disabled",
                blocked_actions: ["compensation_not_projected_until_execution_plan_ready"],
              },
              manual_intervention_projection: {
                status: "not_required",
                reason_markers: ["preview_only_no_live_failure_path"],
              },
              blocked_failure_actions: [
                {
                  code: "retry_scheduling",
                  label: "Retry scheduling",
                  reason: "Retry scheduling remains disabled.",
                  blocked: true,
                },
              ],
              confirmations: {
                retry_scheduling_disabled: true,
                rollback_disabled: true,
                compensation_writes_disabled: true,
                order_mutation_disabled: true,
                fulfillment_mutation_disabled: true,
                event_persistence_disabled: true,
                provider_redispatch_disabled: true,
                checkout_cutover_disabled: true,
              },
            },
            fulfillment_application_preview: {
              version: 1,
              redacted: true,
              current_mode: "preview_only",
              application_decision: "not_applied",
              projected_application_status: "not_applied",
              application_target: "medusa_fulfillment_mutation_plan",
              application_scope: "backend_admin_only",
              mutation_semantics: {
                fulfillment_data_patch_present: false,
                shipment_reference_linkage_present: false,
                tracking_projection_present: false,
                label_document_reference_linkage_present: false,
                status_transition_application_present: false,
                audit_linkage_present: false,
              },
              identity_linkage: {
                provider_operation_reference: null,
                idempotency_key_preview: null,
                plan_fingerprint: null,
                execution_fingerprint: null,
              },
              persistence_linkage: {
                execution_reference_present: false,
                idempotency_reservation_present: false,
                audit_log_reference_present: false,
              },
              blocked_application_actions: [
                {
                  code: "order_mutation",
                  label: "Order mutation",
                  reason: "Order mutation disabled.",
                  blocked: true,
                },
              ],
              confirmations: {
                order_mutation_disabled: true,
                fulfillment_persistence_disabled: true,
                shipment_persistence_disabled: true,
                label_persistence_disabled: true,
                event_persistence_disabled: true,
                checkout_cutover_disabled: true,
              },
            },
            execution_lifecycle_preview: {
              version: 1,
              redacted: true,
              current_mode: "preview_only",
              lifecycle_status: "blocked_in_preview",
              readiness_posture: "blocked_in_preview",
              phase_sequence: [
                "preflight_eligibility",
                "provider_dispatch",
                "shipment_result_normalization",
                "fulfillment_application",
                "failure_handling",
              ],
              identity_correlation: {
                provider_operation_reference: null,
                idempotency_key_preview: null,
                plan_fingerprint: null,
                execution_fingerprint: null,
              },
              phases: [
                {
                  code: "preflight_eligibility",
                  order: 1,
                  status: "blocked_in_preview",
                  readiness_posture: "blocked_in_preview",
                  block_reasons: ["EXECUTION_PREVIEW_ONLY", "EXECUTION_PLAN_NOT_READY"],
                  disabled_live_actions: ["provider_create_shipment_call"],
                  linked_preview_artifacts: [
                    "preflight_eligibility",
                    "execution_identity",
                    "persistence_audit_preview",
                  ],
                },
                {
                  code: "provider_dispatch",
                  order: 2,
                  status: "blocked_in_preview",
                  readiness_posture: "blocked_in_preview",
                  block_reasons: ["Adapter disabled."],
                  disabled_live_actions: ["adapter_invocation"],
                  linked_preview_artifacts: ["provider_dispatch_preview", "execution_identity"],
                },
                {
                  code: "shipment_result_normalization",
                  order: 3,
                  status: "blocked_in_preview",
                  readiness_posture: "blocked_in_preview",
                  block_reasons: ["Provider response fetch disabled."],
                  disabled_live_actions: ["provider_response_fetch"],
                  linked_preview_artifacts: [
                    "shipment_result_preview",
                    "provider_dispatch_preview",
                    "execution_identity",
                  ],
                },
                {
                  code: "fulfillment_application",
                  order: 4,
                  status: "blocked_in_preview",
                  readiness_posture: "blocked_in_preview",
                  block_reasons: ["Order mutation disabled."],
                  disabled_live_actions: ["order_mutation"],
                  linked_preview_artifacts: [
                    "fulfillment_application_preview",
                    "shipment_result_preview",
                    "persistence_audit_preview",
                    "execution_identity",
                  ],
                },
                {
                  code: "failure_handling",
                  order: 5,
                  status: "blocked_in_preview",
                  readiness_posture: "blocked_in_preview",
                  block_reasons: ["execution_plan_not_ready", "Retry scheduling remains disabled."],
                  disabled_live_actions: ["retry_scheduling"],
                  linked_preview_artifacts: [
                    "failure_handling_preview",
                    "provider_dispatch_preview",
                    "shipment_result_preview",
                    "fulfillment_application_preview",
                    "execution_identity",
                  ],
                },
              ],
              confirmations: {
                preview_only: true,
                orchestration_scheduling_disabled: true,
                shipment_execution_disabled: true,
                provider_calls_disabled: true,
                persistence_writes_disabled: true,
                retry_scheduling_disabled: true,
                compensation_writes_disabled: true,
                order_mutation_disabled: true,
                fulfillment_mutation_disabled: true,
                checkout_cutover_disabled: true,
              },
            },
            shipment_execution: {
              materialized: false,
              reason: "Shipment execution remains disabled.",
            },
          },
        ],
        summary: {
          mode_count: 2,
          ready_mode_count: 1,
          blocked_mode_count: 1,
          projected_mode_count: 1,
          deferred_mode_count: 1,
          unconfigured_mode_count: 0,
        },
      },
      summary: {
        mode_count: 2,
        ready_mode_count: 1,
        blocked_mode_count: 1,
        projected_mode_count: 1,
        deferred_mode_count: 1,
        unconfigured_mode_count: 0,
      },
    }

    const state = deriveExecutionPlanObservabilityRenderState(preview)

    expect(state.headerText).toBe("deliveryhub · deliveryhub_deliveryhub")
    expect(state.summaryCards.map((card) => [card.key, card.value])).toEqual([
      ["mode_count", "2"],
      ["ready_mode_count", "1"],
      ["blocked_mode_count", "1"],
      ["projected_mode_count", "1"],
      ["deferred_mode_count", "1"],
      ["unconfigured_mode_count", "0"],
    ])
    expect(state.modePreviews).toEqual([
      {
        key: "warehouse_to_pickup_point",
        modeCode: "warehouse_to_pickup_point",
        status: "ready",
        rolloutStatus: "projected",
        supportingConnectionsText: "conn_a, conn_b",
        readinessText: "ready · blocked reasons: 0",
        blockedReasonsText: "Shipment execution remains disabled.",
        issueBadges: [
          {
            key: "warehouse_to_pickup_point-MISSING_WAREHOUSE-0",
            label: "MISSING_WAREHOUSE · conn_b",
          },
          {
            key: "warehouse_to_pickup_point-DELIVERY_HUB_SHAPE_DRIFT-1",
            label: "DELIVERY_HUB_SHAPE_DRIFT · fulfillment_data.internal",
          },
        ],
        stepReadinessText: "4/4",
        executionPlanText: "create_shipment · POST /shipments",
        executionIdentityText:
          "label=create_shipment:warehouse_to_pickup_point\nreference=dhprev_1234567890abcdef\nplan=plan_fp_123\nexecution=execution_fp_456\nidempotency=deliveryhub:preview:create_shipment:identity_789",
        outboundRequestText: JSON.stringify(
          {
            headers: {
              authorization: "Bearer ***",
            },
          },
          null,
          2
        ),
        persistenceAuditText: JSON.stringify(
          {
            status: "ready",
            metadata_patch: {
              target: "fulfillment_execution_shadow",
              action: "merge",
              fields: [
                {
                  field: "execution_reference",
                  value_preview: "dhprev_1234567890abcdef",
                },
              ],
            },
            execution_record: {
              ready: true,
              record_type: "deliveryhub_shipment_execution",
              operation: "create_shipment",
              provider_code: "deliveryhub",
              provider_id: "deliveryhub_deliveryhub",
              connection_id: "conn_a",
              mode_code: "warehouse_to_pickup_point",
              execution_reference: "dhprev_1234567890abcdef",
              idempotency_key_preview: "deliveryhub:preview:create_shipment:identity_789",
              initial_status: "planned",
            },
            idempotency_reservation: {
              ready: true,
              dedupe_scope: "deliveryhub:create_shipment",
              reservation_key_preview: "deliveryhub:preview:create_shipment:identity_789",
              matched_fields: [
                {
                  field: "execution_fingerprint",
                  value_preview: "execution_fp_456",
                },
              ],
            },
            status_transitions: [
              {
                from: "planned",
                to: "persisted",
                reason: "Persist preview before provider dispatch.",
              },
            ],
            audit_log_entries: [
              {
                kind: "execution.persistence.prepare",
                message: "Prepare persistence preview.",
                payload: {
                  execution_reference: "dhprev_1234567890abcdef",
                  shipment_execution_blocked: true,
                },
              },
            ],
            blocked: [
              {
                key: "provider_dispatch",
                reason: "Shipment execution remains disabled.",
              },
            ],
            deferred: [
              {
                key: "audit_log_commit",
                reason: "Audit log commit stays deferred in preview mode.",
              },
            ],
          },
          null,
          2
        ),
        preflightEligibilityText:
          "mode=preview_only · decision=eligible_when_enabled · real_execution_enabled=no · reasons=EXECUTION_PREVIEW_ONLY, FUTURE_EXECUTION_FLAG_INERT, LIVE_EXECUTION_DISABLED",
        preflightPrerequisitesText:
          "operator_approval: required_future_work; provider_execution_adapter_readiness: required_future_work",
        blockedLiveActionsText: "provider_create_shipment_call, checkout_cutover",
        providerDispatchText:
          "mode=preview_only · decision=ready_for_future_dispatch · provider=deliveryhub · adapter=create_shipment:warehouse_to_pickup_point · identity=dhprev_1234567890abcdef · idempotency=deliveryhub:preview:create_shipment:identity_789 · origin=fulfillment_location · destination=pickup_point",
        blockedDispatchActionsText: "adapter_invocation, provider_network_call, checkout_cutover",
        shipmentResultText:
          "mode=preview_only · decision=projected_for_future_execution · status=projected_for_future_execution · target=deliveryhub_shipment_result · provider_target=create_shipment_response · identity=dhprev_1234567890abcdef · tracking=yes · label=yes",
        blockedMaterializationActionsText:
          "provider_response_fetch, label_persistence, checkout_cutover",
        applicationPreviewText:
          "mode=preview_only · decision=projected_for_future_application · status=projected_for_future_application · target=medusa_fulfillment_mutation_plan · identity=dhprev_1234567890abcdef · fulfillment_patch=yes · tracking=yes · audit=yes",
        blockedApplicationActionsText: "order_mutation, event_persistence",
        lifecycleStatusText:
          "mode=preview_only · status=projected_for_future_execution · readiness=ready_when_enabled",
        lifecyclePhaseSequenceText:
          "preflight_eligibility → provider_dispatch → shipment_result_normalization → fulfillment_application → failure_handling",
        lifecycleIdentityText:
          "identity=dhprev_1234567890abcdef · idempotency=deliveryhub:preview:create_shipment:identity_789 · plan=plan_fp_123 · execution=execution_fp_456",
        lifecycleDisabledActionsText:
          "preview_only, orchestration_scheduling_disabled, shipment_execution_disabled, provider_calls_disabled, persistence_writes_disabled, retry_scheduling_disabled, compensation_writes_disabled, order_mutation_disabled, fulfillment_mutation_disabled, checkout_cutover_disabled",
        lifecyclePhaseRows: [
          {
            key: "warehouse_to_pickup_point-preflight_eligibility",
            code: "preflight_eligibility",
            order: "1",
            status: "projected_for_future_execution",
            readiness: "ready_when_enabled",
            linkedArtifactsText:
              "preflight_eligibility, execution_identity, persistence_audit_preview",
            blockReasonsText:
              "EXECUTION_PREVIEW_ONLY; FUTURE_EXECUTION_FLAG_INERT; LIVE_EXECUTION_DISABLED",
            disabledActionsText: "provider_create_shipment_call, checkout_cutover",
          },
          {
            key: "warehouse_to_pickup_point-provider_dispatch",
            code: "provider_dispatch",
            order: "2",
            status: "projected_for_future_execution",
            readiness: "ready_when_enabled",
            linkedArtifactsText: "provider_dispatch_preview, execution_identity",
            blockReasonsText: "Adapter disabled.; Network disabled.; Checkout disabled.",
            disabledActionsText: "adapter_invocation, provider_network_call, checkout_cutover",
          },
          {
            key: "warehouse_to_pickup_point-shipment_result_normalization",
            code: "shipment_result_normalization",
            order: "3",
            status: "projected_for_future_execution",
            readiness: "ready_when_enabled",
            linkedArtifactsText:
              "shipment_result_preview, provider_dispatch_preview, execution_identity",
            blockReasonsText:
              "Provider response fetch disabled.; Label persistence disabled.; Checkout cutover disabled.",
            disabledActionsText: "provider_response_fetch, label_persistence, checkout_cutover",
          },
          {
            key: "warehouse_to_pickup_point-fulfillment_application",
            code: "fulfillment_application",
            order: "4",
            status: "projected_for_future_execution",
            readiness: "ready_when_enabled",
            linkedArtifactsText:
              "fulfillment_application_preview, shipment_result_preview, persistence_audit_preview, execution_identity",
            blockReasonsText: "Order mutation disabled.; Event persistence disabled.",
            disabledActionsText: "order_mutation, event_persistence",
          },
          {
            key: "warehouse_to_pickup_point-failure_handling",
            code: "failure_handling",
            order: "5",
            status: "projected_for_future_execution",
            readiness: "ready_when_enabled",
            linkedArtifactsText:
              "failure_handling_preview, provider_dispatch_preview, shipment_result_preview, fulfillment_application_preview, execution_identity",
            blockReasonsText:
              "retry_scheduling_disabled_in_preview_only_mode; Retry scheduling remains disabled.; Compensation persistence remains disabled.",
            disabledActionsText: "retry_scheduling, compensation_write",
          },
        ],
        failureHandlingText:
          "mode=preview_only · decision=projected_retry_policy · status=manual_intervention_required_when_enabled · identity=dhprev_1234567890abcdef · manual=required_when_enabled",
        retryPostureText:
          "eligibility=eligible_when_enabled · policy=deterministic_preview_only · scheduling=disabled · reasons=retry_scheduling_disabled_in_preview_only_mode",
        compensationPostureText:
          "requirement=required_when_enabled · writes=disabled · rollback=disabled · manual_markers=projected_provider_failure_triage",
        blockedFailureActionsText: "retry_scheduling, compensation_write",
        shipmentExecutionText: "Shipment execution remains disabled.",
      },
      {
        key: "dropoff_point_to_pickup_point",
        modeCode: "dropoff_point_to_pickup_point",
        status: "blocked",
        rolloutStatus: "deferred",
        supportingConnectionsText: "—",
        readinessText: "blocked · blocked reasons: 1",
        blockedReasonsText: "Missing connection; Shipment execution remains disabled.",
        issueBadges: [],
        stepReadinessText: "0/2",
        executionPlanText: "Execution plan remains blocked",
        executionIdentityText: "Deterministic execution identity preview unavailable.",
        outboundRequestText: "Redacted outbound payload preview unavailable.",
        persistenceAuditText: JSON.stringify(
          {
            status: "blocked",
            metadata_patch: {
              target: "fulfillment_execution_shadow",
              action: "merge",
              fields: [],
            },
            execution_record: {
              ready: false,
              record_type: "deliveryhub_shipment_execution",
              operation: "create_shipment",
              provider_code: "deliveryhub",
              provider_id: "deliveryhub_deliveryhub",
              connection_id: null,
              mode_code: null,
              execution_reference: null,
              idempotency_key_preview: null,
              initial_status: null,
            },
            idempotency_reservation: {
              ready: false,
              dedupe_scope: "deliveryhub:create_shipment",
              reservation_key_preview: null,
              matched_fields: [],
            },
            status_transitions: [],
            audit_log_entries: [],
            blocked: [
              {
                key: "execution_plan_prerequisite",
                reason: "Persistence preview blocked.",
              },
            ],
            deferred: [
              {
                key: "terminal_status_resolution",
                reason: "Terminal resolution deferred.",
              },
            ],
          },
          null,
          2
        ),
        preflightEligibilityText:
          "mode=preview_only · decision=not_ready · real_execution_enabled=no · reasons=EXECUTION_PREVIEW_ONLY, EXECUTION_PLAN_NOT_READY",
        preflightPrerequisitesText: "operator_approval: required_future_work",
        blockedLiveActionsText: "provider_create_shipment_call",
        providerDispatchText:
          "mode=preview_only · decision=not_dispatched · provider=deliveryhub · adapter=create_shipment · identity=— · idempotency=— · origin=unknown · destination=unknown",
        blockedDispatchActionsText: "adapter_invocation",
        shipmentResultText:
          "mode=preview_only · decision=not_materialized · status=not_materialized · target=deliveryhub_shipment_result · provider_target=create_shipment_response · identity=— · tracking=no · label=no",
        blockedMaterializationActionsText: "provider_response_fetch",
        applicationPreviewText:
          "mode=preview_only · decision=not_applied · status=not_applied · target=medusa_fulfillment_mutation_plan · identity=— · fulfillment_patch=no · tracking=no · audit=no",
        blockedApplicationActionsText: "order_mutation",
        lifecycleStatusText:
          "mode=preview_only · status=blocked_in_preview · readiness=blocked_in_preview",
        lifecyclePhaseSequenceText:
          "preflight_eligibility → provider_dispatch → shipment_result_normalization → fulfillment_application → failure_handling",
        lifecycleIdentityText: "identity=— · idempotency=— · plan=— · execution=—",
        lifecycleDisabledActionsText:
          "preview_only, orchestration_scheduling_disabled, shipment_execution_disabled, provider_calls_disabled, persistence_writes_disabled, retry_scheduling_disabled, compensation_writes_disabled, order_mutation_disabled, fulfillment_mutation_disabled, checkout_cutover_disabled",
        lifecyclePhaseRows: [
          {
            key: "dropoff_point_to_pickup_point-preflight_eligibility",
            code: "preflight_eligibility",
            order: "1",
            status: "blocked_in_preview",
            readiness: "blocked_in_preview",
            linkedArtifactsText:
              "preflight_eligibility, execution_identity, persistence_audit_preview",
            blockReasonsText: "EXECUTION_PREVIEW_ONLY; EXECUTION_PLAN_NOT_READY",
            disabledActionsText: "provider_create_shipment_call",
          },
          {
            key: "dropoff_point_to_pickup_point-provider_dispatch",
            code: "provider_dispatch",
            order: "2",
            status: "blocked_in_preview",
            readiness: "blocked_in_preview",
            linkedArtifactsText: "provider_dispatch_preview, execution_identity",
            blockReasonsText: "Adapter disabled.",
            disabledActionsText: "adapter_invocation",
          },
          {
            key: "dropoff_point_to_pickup_point-shipment_result_normalization",
            code: "shipment_result_normalization",
            order: "3",
            status: "blocked_in_preview",
            readiness: "blocked_in_preview",
            linkedArtifactsText:
              "shipment_result_preview, provider_dispatch_preview, execution_identity",
            blockReasonsText: "Provider response fetch disabled.",
            disabledActionsText: "provider_response_fetch",
          },
          {
            key: "dropoff_point_to_pickup_point-fulfillment_application",
            code: "fulfillment_application",
            order: "4",
            status: "blocked_in_preview",
            readiness: "blocked_in_preview",
            linkedArtifactsText:
              "fulfillment_application_preview, shipment_result_preview, persistence_audit_preview, execution_identity",
            blockReasonsText: "Order mutation disabled.",
            disabledActionsText: "order_mutation",
          },
          {
            key: "dropoff_point_to_pickup_point-failure_handling",
            code: "failure_handling",
            order: "5",
            status: "blocked_in_preview",
            readiness: "blocked_in_preview",
            linkedArtifactsText:
              "failure_handling_preview, provider_dispatch_preview, shipment_result_preview, fulfillment_application_preview, execution_identity",
            blockReasonsText: "execution_plan_not_ready; Retry scheduling remains disabled.",
            disabledActionsText: "retry_scheduling",
          },
        ],
        failureHandlingText:
          "mode=preview_only · decision=no_live_failure_path · status=not_applicable_in_preview · identity=— · manual=not_required",
        retryPostureText:
          "eligibility=blocked · policy=deterministic_preview_only · scheduling=disabled · reasons=execution_plan_not_ready",
        compensationPostureText:
          "requirement=not_required · writes=disabled · rollback=disabled · manual_markers=preview_only_no_live_failure_path",
        blockedFailureActionsText: "retry_scheduling",
        shipmentExecutionText: "Shipment execution remains disabled.",
      },
    ])

    expect(state.modePreviews[0]).toMatchObject({
      failureHandlingText:
        "mode=preview_only · decision=projected_retry_policy · status=manual_intervention_required_when_enabled · identity=dhprev_1234567890abcdef · manual=required_when_enabled",
      retryPostureText:
        "eligibility=eligible_when_enabled · policy=deterministic_preview_only · scheduling=disabled · reasons=retry_scheduling_disabled_in_preview_only_mode",
      compensationPostureText:
        "requirement=required_when_enabled · writes=disabled · rollback=disabled · manual_markers=projected_provider_failure_triage",
      blockedFailureActionsText: "retry_scheduling, compensation_write",
    })
    expect(state.modePreviews[1]).toMatchObject({
      failureHandlingText:
        "mode=preview_only · decision=no_live_failure_path · status=not_applicable_in_preview · identity=— · manual=not_required",
      retryPostureText:
        "eligibility=blocked · policy=deterministic_preview_only · scheduling=disabled · reasons=execution_plan_not_ready",
      compensationPostureText:
        "requirement=not_required · writes=disabled · rollback=disabled · manual_markers=preview_only_no_live_failure_path",
      blockedFailureActionsText: "retry_scheduling",
    })

    expect(state.modePreviews[0]).toMatchObject({
      failureHandlingText:
        "mode=preview_only · decision=projected_retry_policy · status=manual_intervention_required_when_enabled · identity=dhprev_1234567890abcdef · manual=required_when_enabled",
      retryPostureText:
        "eligibility=eligible_when_enabled · policy=deterministic_preview_only · scheduling=disabled · reasons=retry_scheduling_disabled_in_preview_only_mode",
      compensationPostureText:
        "requirement=required_when_enabled · writes=disabled · rollback=disabled · manual_markers=projected_provider_failure_triage",
      blockedFailureActionsText: "retry_scheduling, compensation_write",
    })
    expect(state.modePreviews[1]).toMatchObject({
      failureHandlingText:
        "mode=preview_only · decision=no_live_failure_path · status=not_applicable_in_preview · identity=— · manual=not_required",
      retryPostureText:
        "eligibility=blocked · policy=deterministic_preview_only · scheduling=disabled · reasons=execution_plan_not_ready",
      compensationPostureText:
        "requirement=not_required · writes=disabled · rollback=disabled · manual_markers=preview_only_no_live_failure_path",
      blockedFailureActionsText: "retry_scheduling",
    })

    const renderedState = JSON.stringify(state)
    expect(renderedState).not.toContain("must-not-leak")
  })

  it("builds shipment operations endpoint URLs and request bodies from trimmed execution references", () => {
    expect(buildShipmentOperationsSnapshotUrl(" exec/ref 1 ")).toBe(
      "/admin/delivery/shipments/exec%2Fref%201/operations"
    )
    expect(buildShipmentOperationsRefreshStatusUrl(" exec/ref 1 ")).toBe(
      "/admin/delivery/shipments/exec%2Fref%201/operations/refresh-status"
    )
    expect(buildShipmentOperationsCancelUrl(" exec/ref 1 ")).toBe(
      "/admin/delivery/shipments/exec%2Fref%201/operations/cancel"
    )
    expect(buildShipmentOperationsRetryUrl(" exec/ref 1 ")).toBe(
      "/admin/delivery/shipments/exec%2Fref%201/operations/retry"
    )
    expect(buildShipmentOperationsRefreshStatusRequestBody(" corr_1 ")).toEqual({ correlation_id: "corr_1" })
    expect(buildShipmentOperationsCancelRequestBody(" cancel_corr_1 ")).toEqual({ correlation_id: "cancel_corr_1" })
    expect(buildShipmentOperationsRefreshStatusRequestBody("   ")).toEqual({})
    expect(() => buildShipmentOperationsSnapshotUrl("   ")).toThrow(
      "execution_reference is required to load shipment operations"
    )
  })

  it("derives accepted shipment operations display model and guarded refresh availability without leaking raw fields", () => {
    const snapshot: DeliveryHubShipmentOperationsSnapshot = {
      version: 1,
      safe: true,
      reference: {
        lookup_kind: "execution_reference",
        execution_reference_preview: "ex***42",
      },
      lifecycle: {
        classification: "accepted_shipment",
        accepted: true,
        blocked_reason_code: null,
      },
      provider: {
        provider_code: "yandex",
        mode_code: "warehouse_to_pickup_point",
        dispatch_status: "dispatch_accepted",
        dispatch_outcome: "accepted",
        provider_shipment_reference_present: true,
        provider_correlation_reference_present: true,
      },
      status: {
        current: {
          provider_code: "yandex",
          operation: "get_shipment_status",
          attempted: true,
          succeeded: true,
          status_category: "in_transit",
          neutral_status: "in_transit",
          provider_status_known: true,
          provider_status_present: true,
          provider_status_normalized: "ready_to_ship",
          provider_status_code: 200,
          correlation_id_present: true,
          provider_shipment_reference_present: true,
          safe_message: "Status refreshed safely",
          redacted: true,
        },
        refresh: {
          available: true,
          blocked_reason_code: null,
          blocked_reason: null,
          last_outcome: "refreshed",
          status_refreshed_at: "2026-04-24T07:00:00.000Z",
        },
      },
      cancel: {
        readiness: {
          version: 1,
          available: true,
          blocked_reason_code: null,
          blocked_reason: null,
          lifecycle_classification: "accepted_shipment",
          accepted: true,
          provider_code: "yandex",
          provider_shipment_reference_present: true,
          status_neutral: "in_transit",
          redacted: true,
          anti_leak_confirmations: {
            raw_provider_payloads_included: false,
          },
        },
        last_result: {
          status: "not_requested",
          safe_message: "Manual shipment cancellation has not been requested in this snapshot.",
          redacted: true,
        },
      },
      retry: {
        readiness: {
          version: 1,
          available: false,
          blocked_reason_code: "accepted_shipment_not_retryable",
          blocked_reason:
            "Manual retry is blocked because this execution already has an accepted shipment and redispatch would risk duplicate shipment creation.",
          lifecycle_classification: "accepted_shipment",
          ledger_state: "completed",
          terminal_completed: true,
          terminal_blocked: false,
          idempotency_linked: true,
          persisted_shipment_present: true,
          accepted_shipment_present: true,
          provider_shipment_reference_present: true,
          redacted: true,
          anti_leak_confirmations: {
            raw_provider_payloads_included: false,
          },
        },
        last_result: {
          status: "not_requested",
          safe_message: "Manual shipment retry has not been requested in this snapshot.",
          redacted: true,
        },
      },
      ledger: {
        linked: true,
        state: "completed",
        terminal_completed: true,
        terminal_blocked: false,
        execution_reference_preview: "ex***42",
        idempotency_key_preview: "idem***42",
        transition_count: 6,
        audit_event_count: 4,
      },
      shipment: {
        id: "ship_123",
        accepted: true,
        status: "dispatch_accepted",
        label_document_present: false,
        attachment_document_present: false,
      },
      context: {
        connection_id: "conn_1",
        order_id: "order_1",
        fulfillment_id: "ful_1",
        cart_id: "cart_1",
        shipping_option_id: "so_1",
        location_id: "loc_1",
        quote_reference: {
          id: "quote_safe_1",
          version: 1,
        },
        correlation_id_present: true,
      },
      timestamps: {
        created_at: "2026-04-24T06:00:00.000Z",
        updated_at: "2026-04-24T06:30:00.000Z",
        status_refreshed_at: "2026-04-24T07:00:00.000Z",
      },
      action_posture: {
        refresh_status: "available",
        cancel: "available",
        retry: "blocked",
        webhooks: "not_materialized",
        scheduler: "not_materialized",
      },
      anti_leak_confirmations: {
        raw_provider_payloads_included: false,
        raw_provider_request_included: false,
        raw_provider_response_included: false,
        auth_headers_included: false,
        credentials_included: false,
        raw_quote_key_included: false,
        raw_provider_identifier_included: false,
        raw_execution_secret_included: false,
      },
    }

    const state = deriveShipmentOperationsRenderState({
      form: { execution_reference: " execution-secret-that-stays-input-only " },
      snapshot,
    })

    expect(state.lookupReady).toBe(true)
    expect(state.canRefreshStatus).toBe(true)
    expect(state.refreshButtonText).toBe("Refresh status")
    expect(state.canCancelShipment).toBe(true)
    expect(state.cancelButtonText).toBe("Cancel shipment")
    expect(state.statusBadgeText).toBe("accepted shipment")
    expect(state.summaryCards.map((card) => [card.key, card.value])).toEqual([
      ["lifecycle", "accepted_shipment"],
      ["accepted", "yes"],
      ["provider_mode", "yandex / warehouse_to_pickup_point"],
      ["dispatch", "dispatch_accepted / accepted"],
      ["neutral_status", "in_transit"],
      ["refresh", "yes"],
      ["cancel", "yes"],
      ["retry", "no"],
    ])
    expect(state.statusRefreshRows.map((row) => [row.key, row.value])).toEqual(
      expect.arrayContaining([
        ["refresh_available", "yes"],
        ["last_outcome", "refreshed"],
        ["provider_status", "ready_to_ship"],
        ["status_category", "in_transit"],
        ["safe_message", "Status refreshed safely"],
      ])
    )
    expect(state.ledgerRows.map((row) => [row.key, row.value])).toEqual(
      expect.arrayContaining([
        ["transition_count", "6"],
        ["audit_event_count", "4"],
        ["idempotency_key_preview", "idem***42"],
      ])
    )
    expect(state.cancelRows).toEqual(
      expect.arrayContaining([
        { key: "cancel_available", label: "Available", value: "yes" },
        { key: "status_neutral", label: "Neutral status gate", value: "in_transit" },
        {
          key: "last_result",
          label: "Last result",
          value: "Manual shipment cancellation has not been requested in this snapshot.",
        },
      ])
    )
    expect(state.actionBadges).toEqual([
      { key: "refresh_status", label: "refresh_status: available", available: true },
      { key: "cancel", label: "cancel: available", available: true },
      { key: "retry", label: "retry: blocked", available: false },
      { key: "webhooks", label: "webhooks: not_materialized", available: false },
      { key: "scheduler", label: "scheduler: not_materialized", available: false },
    ])

    const renderedState = JSON.stringify(state)
    expect(renderedState).not.toContain("execution-secret-that-stays-input-only")
    expect(renderedState).not.toContain("raw-provider-id")
    expect(renderedState).not.toContain("auth-token")
    expect(renderedState).not.toContain("quote-secret")
  })

  it("keeps shipment status refresh blocked when backend action posture is unavailable", () => {
    const snapshot: DeliveryHubShipmentOperationsSnapshot = {
      version: 1,
      safe: true,
      reference: {
        lookup_kind: "execution_reference",
        execution_reference_preview: "ex***blocked",
      },
      lifecycle: {
        classification: "non_accepted_shipment",
        accepted: false,
        blocked_reason_code: "provider_failed",
      },
      provider: {
        provider_code: "yandex",
        mode_code: "dropoff_point_to_pickup_point",
        dispatch_status: "failed_blocked",
        dispatch_outcome: "failed",
        provider_shipment_reference_present: false,
        provider_correlation_reference_present: false,
      },
      status: {
        current: null,
        refresh: {
          available: false,
          blocked_reason_code: "accepted_shipment_required",
          blocked_reason: "Status refresh is available only for accepted shipment lifecycle snapshots.",
          last_outcome: "failed",
          status_refreshed_at: null,
        },
      },
      cancel: {
        readiness: {
          version: 1,
          available: false,
          blocked_reason_code: "accepted_lifecycle_required",
          blocked_reason: "Shipment cancellation is allowed only for accepted shipment lifecycle snapshots.",
          lifecycle_classification: "non_accepted_shipment",
          accepted: false,
          provider_code: "yandex",
          provider_shipment_reference_present: false,
          status_neutral: null,
          redacted: true,
          anti_leak_confirmations: {
            raw_provider_payloads_included: false,
          },
        },
        last_result: {
          status: "not_requested",
          safe_message: "Manual shipment cancellation has not been requested in this snapshot.",
          redacted: true,
        },
      },
      retry: {
        readiness: {
          version: 1,
          available: false,
          blocked_reason_code: "execution_ledger_state_not_retryable",
          blocked_reason:
            "Manual retry is allowed only for execution-ledger state failed_blocked in this tranche.",
          lifecycle_classification: "non_accepted_shipment",
          ledger_state: "failed_blocked",
          terminal_completed: false,
          terminal_blocked: true,
          idempotency_linked: true,
          persisted_shipment_present: false,
          accepted_shipment_present: false,
          provider_shipment_reference_present: false,
          redacted: true,
          anti_leak_confirmations: {
            raw_provider_payloads_included: false,
          },
        },
        last_result: {
          status: "not_requested",
          safe_message: "Manual shipment retry has not been requested in this snapshot.",
          redacted: true,
        },
      },
      ledger: {
        linked: true,
        state: "failed_blocked",
        terminal_completed: false,
        terminal_blocked: true,
        execution_reference_preview: "ex***blocked",
        idempotency_key_preview: "idem***blocked",
        transition_count: 3,
        audit_event_count: 2,
      },
      shipment: {
        id: null,
        accepted: false,
        status: null,
        label_document_present: false,
        attachment_document_present: false,
      },
      context: {
        connection_id: null,
        order_id: null,
        fulfillment_id: null,
        cart_id: null,
        shipping_option_id: null,
        location_id: null,
        quote_reference: {
          id: null,
          version: null,
        },
        correlation_id_present: false,
      },
      timestamps: {
        created_at: null,
        updated_at: null,
        status_refreshed_at: null,
      },
      action_posture: {
        refresh_status: "blocked",
        cancel: "blocked",
        retry: "blocked",
        webhooks: "not_materialized",
        scheduler: "not_materialized",
      },
      anti_leak_confirmations: {
        raw_provider_payloads_included: false,
        raw_provider_request_included: false,
        raw_provider_response_included: false,
        auth_headers_included: false,
        credentials_included: false,
        raw_quote_key_included: false,
        raw_provider_identifier_included: false,
        raw_execution_secret_included: false,
      },
    }

    const state = deriveShipmentOperationsRenderState({
      form: { execution_reference: "exec_blocked" },
      snapshot,
    })

    expect(state.canRefreshStatus).toBe(false)
    expect(state.refreshButtonText).toBe("Refresh status blocked")
    expect(state.canCancelShipment).toBe(false)
    expect(state.cancelButtonText).toBe("Cancel blocked")
    expect(state.statusBadgeText).toBe("blocked: provider_failed")
    expect(state.canRetryShipment).toBe(false)
    expect(state.retryButtonText).toBe("Retry blocked")
    expect(state.detailRows).toEqual(
      expect.arrayContaining([
        {
          key: "blocked_reason",
          label: "Blocked reason",
          value: "Status refresh is available only for accepted shipment lifecycle snapshots.",
        },
      ])
    )
  })

  it("derives empty shipment operations state before lookup", () => {
    expect(
      deriveShipmentOperationsRenderState({
        form: { execution_reference: "   " },
        snapshot: null,
      })
    ).toEqual({
      headerText: "No shipment operations snapshot loaded",
      hasSnapshot: false,
      lookupReady: false,
      canRefreshStatus: false,
      canCancelShipment: false,
      canRetryShipment: false,
      refreshButtonText: "Refresh status blocked",
      cancelButtonText: "Cancel blocked",
      retryButtonText: "Retry blocked",
      refreshStatusTone: "deferred",
      statusBadgeText: "not loaded",
      actionBadges: [],
      summaryCards: [],
      detailRows: [],
      statusRefreshRows: [],
      cancelRows: [],
      ledgerRows: [],
      contextRows: [],
      emptyText:
        "Paste an execution_reference from the controlled fulfillment result or execution ledger, then load the safe operator snapshot.",
    })
  })

  it("derives manual sync safe-default execute guard state before any result snapshot exists", () => {
    expect(
      getShippingOptionSyncCapability({
        executeGuard: " wrong ",
        serviceZoneId: "serzo_123",
        shippingProfileId: "sp_123",
      })
    ).toEqual({
      guardConfirmed: false,
      canExecute: false,
    })

    expect(
      deriveShippingOptionManualSyncRenderState({
        result: null,
        executeGuard: " wrong ",
        serviceZoneId: "serzo_123",
        shippingProfileId: "sp_123",
      })
    ).toEqual({
      headerText: "No manual sync run yet",
      guardConfirmed: false,
      canExecute: false,
      modeFields: [],
      desiredPlanSummaryCards: [],
      reconciliationSummaryCards: [],
      operationPlanSummaryCards: [],
      executionReport: null,
      noExecutionReportText:
        "This is expected for default dry-run mode or for execute requests that never passed confirmation into backend write mode.",
      noResultText:
        "Run the default dry-run to materialize a truthful manual sync result snapshot before considering execute mode.",
    })
  })

  it("derives manual sync result summaries and execute capability from admin contract payload without leaking raw details", () => {
    const result: DeliveryHubShippingOptionManualSyncResponse = {
      provider_code: "yandex",
      provider_id: "prov_yandex",
      current_options: [],
      desired_plan: {
        provider_code: "yandex",
        provider_id: "prov_yandex",
        desired_options: [],
        deferred_options: [],
        connection_plans: [],
      },
      desired_plan_summary: {
        desired_option_count: 2,
        deferred_option_count: 1,
        deferred_issue_count: 3,
        connection_plan_count: 2,
      },
      reconciliation: {
        provider_code: "yandex",
        provider_id: "prov_yandex",
        create_candidates: [],
        update_candidates: [],
        unchanged: [],
        orphaned_managed_options: [],
        ignored_foreign_options: [],
      },
      reconciliation_summary: {
        create_candidate_count: 1,
        update_candidate_count: 2,
        unchanged_count: 3,
        orphaned_managed_option_count: 4,
        ignored_foreign_option_count: 5,
      },
      operation_plan: {
        provider_code: "yandex",
        provider_id: "prov_yandex",
        create_operations: [
          {
            token: "raw-create-secret",
          },
        ],
        update_operations: [],
        archive_operations: [],
        noops: [],
        ignored_foreign_options: [],
        summary: {
          create_operation_count: 1,
          update_operation_count: 2,
          archive_operation_count: 3,
          noop_count: 4,
          mutation_operation_count: 5,
          ignored_foreign_option_count: 6,
          managed_option_count: 7,
        },
      },
      execution: {
        mode: {
          requested_mode: "execute",
          effective_mode: "execute",
          execute_requested: true,
          execute_confirmed: true,
          execute_guard: DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD,
          is_dry_run: false,
        },
        report: {
          outcome: "partial_failure",
          aborted: false,
          error_mode: "continue",
          summary: {
            create_operation_count: 1,
            update_operation_count: 2,
            archive_operation_count: 3,
            mutation_operation_count: 4,
            noop_count: 5,
            ignored_foreign_option_count: 6,
            attempted_operation_count: 7,
            succeeded_operation_count: 8,
            failed_operation_count: 1,
            not_executed_operation_count: 2,
          },
          create_results: [],
          update_results: [],
          archive_results: [],
          executed_operations: [{ id: "op_1" }, { id: "op_2" }],
        },
      },
    }

    const state = deriveShippingOptionManualSyncRenderState({
      result,
      executeGuard: DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD,
      serviceZoneId: "serzo_123",
      shippingProfileId: "sp_123",
    })

    expect(state.headerText).toBe("yandex · prov_yandex")
    expect(state.guardConfirmed).toBe(true)
    expect(state.canExecute).toBe(true)
    expect(state.modeFields).toEqual([
      { label: "Requested mode", value: "execute" },
      { label: "Effective mode", value: "execute" },
      { label: "Dry-run", value: "no" },
      { label: "Execute requested", value: "yes" },
      { label: "Execute confirmed", value: "yes" },
      { label: "Execute guard", value: DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD },
    ])
    expect(state.desiredPlanSummaryCards.map((card) => [card.key, card.value])).toEqual([
      ["desired_option_count", "2"],
      ["deferred_option_count", "1"],
      ["deferred_issue_count", "3"],
      ["connection_plan_count", "2"],
    ])
    expect(state.reconciliationSummaryCards.map((card) => [card.key, card.value])).toEqual([
      ["create_candidate_count", "1"],
      ["update_candidate_count", "2"],
      ["unchanged_count", "3"],
      ["orphaned_managed_option_count", "4"],
      ["ignored_foreign_option_count", "5"],
    ])
    expect(state.operationPlanSummaryCards.map((card) => [card.key, card.value])).toEqual([
      ["create_operation_count", "1"],
      ["update_operation_count", "2"],
      ["archive_operation_count", "3"],
      ["noop_count", "4"],
      ["mutation_operation_count", "5"],
      ["ignored_foreign_option_count", "6"],
      ["managed_option_count", "7"],
    ])
    expect(state.executionReport).toEqual({
      outcome: "partial_failure",
      outcomeToneIsSuccess: false,
      aborted: "no",
      errorMode: "continue",
      executedOperationCount: "2",
      summaryCards: [
        ["attempted_operation_count", "7"],
        ["succeeded_operation_count", "8"],
        ["failed_operation_count", "1"],
        ["not_executed_operation_count", "2"],
        ["mutation_operation_count", "4"],
        ["noop_count", "5"],
      ].map(([key, value], index) => ({
        key,
        label: [
          "Attempted ops",
          "Succeeded ops",
          "Failed ops",
          "Not executed",
          "Planned mutation ops",
          "Planned noops",
        ][index] as string,
        value,
      })),
    })

    const renderedState = JSON.stringify(state)
    expect(renderedState).not.toContain("raw-create-secret")
  })

  it("shows encryption disabled warning if any relevant connection or admin error reports it", () => {
    const baseConnection: DeliveryConnection = {
      id: "conn_1",
      provider_code: "yandex",
      name: "Yandex",
      status: "draft",
      mode: "test",
      enabled: false,
      country_code: "RU",
      credentials_state: "sealed",
      credentials_fingerprint: null,
      credentials_last_validated_at: null,
      credentials_last_error_code: null,
      credentials_present: false,
      config: {},
      metadata: {},
      created_at: "2026-04-20T10:00:00.000Z",
      updated_at: "2026-04-21T10:00:00.000Z",
    }

    expect(
      getObservedEncryptionDisabled({
        connections: [{ ...baseConnection, credentials_state: "disabled" }],
        activeConnection: null,
        formError: null,
        testConnectionError: null,
      })
    ).toBe(true)

    expect(
      getObservedEncryptionDisabled({
        connections: [baseConnection],
        activeConnection: baseConnection,
        formError: { code: "DELIVERY_HUB_ENCRYPTION_DISABLED" },
        testConnectionError: null,
      })
    ).toBe(true)

    expect(
      getObservedEncryptionDisabled({
        connections: [baseConnection],
        activeConnection: null,
        formError: null,
        testConnectionError: { code: "DELIVERY_HUB_ENCRYPTION_DISABLED" },
      })
    ).toBe(true)

    expect(
      getObservedEncryptionDisabled({
        connections: [baseConnection],
        activeConnection: null,
        formError: null,
        testConnectionError: null,
      })
    ).toBe(false)
  })

  it("filters event logs by active connection while keeping unscoped list when nothing is selected", () => {
    const logs: DeliveryEventLog[] = [
      {
        id: "log_1",
        connection_id: "conn_a",
        provider_code: "yandex",
        kind: "test_connection",
        correlation_id: "corr_1",
        success: true,
        request_summary: { ok: true },
        response_summary: { ok: true },
        error_code: null,
        created_at: "2026-04-21T10:00:00.000Z",
      },
      {
        id: "log_2",
        connection_id: "conn_b",
        provider_code: "yandex",
        kind: "test_quote",
        correlation_id: "corr_2",
        success: false,
        request_summary: { message: "no token" },
        response_summary: { code: "DELIVERY_HUB_FAILURE" },
        error_code: "DELIVERY_HUB_FAILURE",
        created_at: "2026-04-21T11:00:00.000Z",
      },
      {
        id: "log_3",
        connection_id: null,
        provider_code: "yandex",
        kind: "sync_preview",
        correlation_id: "corr_3",
        success: true,
        request_summary: {},
        response_summary: {},
        error_code: null,
        created_at: "2026-04-21T12:00:00.000Z",
      },
    ]

    expect(getFilteredEventLogs(logs, null).map((log) => log.id)).toEqual(["log_1", "log_2", "log_3"])
    expect(getFilteredEventLogs(logs, "conn_b").map((log) => log.id)).toEqual(["log_2"])
  })
})
