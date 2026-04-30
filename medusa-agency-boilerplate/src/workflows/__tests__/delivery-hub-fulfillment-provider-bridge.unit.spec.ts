import { describe, expect, it } from "@jest/globals"
import { DELIVERY_HUB_MODE_CODE } from "../../modules/delivery-hub/constants"
import {
  buildDeliveryHubCreateFulfillmentBridgeDiagnostic,
  buildDeliveryHubCreateFulfillmentBridgePayload,
  buildDeliveryHubExecutionLedgerEvidenceArtifactAssembly,
  buildDeliveryHubExecutionPlanObservabilityPreview,
  buildDeliveryHubFulfillmentBridgePayload,
  buildDeliveryHubFulfillmentBridgePayloadFromCartSelection,
  buildDeliveryHubFulfillmentBridgePreview,
  buildDeliveryHubFulfillmentHandoffSnapshot,
  buildDeliveryHubShipmentExecutionPlanPreview,
  DELIVERY_HUB_EXECUTION_IDENTITY_PREVIEW_VERSION,
  DELIVERY_HUB_EXECUTION_LEDGER_EVIDENCE_ARTIFACT_VERSION,
  DELIVERY_HUB_EXECUTION_PERSISTENCE_AUDIT_PREVIEW_VERSION,
  DELIVERY_HUB_EXECUTION_PREFLIGHT_ELIGIBILITY_PREVIEW_VERSION,
  DELIVERY_HUB_FAILURE_HANDLING_PREVIEW_VERSION,
  DELIVERY_HUB_FULFILLMENT_HANDOFF_SNAPSHOT_VERSION,
  DELIVERY_HUB_PROVIDER_DISPATCH_PREVIEW_VERSION,
  DELIVERY_HUB_SHIPMENT_RESULT_PREVIEW_VERSION,
  DELIVERY_HUB_EXECUTION_PLAN_OBSERVABILITY_PREVIEW_VERSION,
} from "../../modules/delivery-hub/fulfillment-provider-bridge"
import { createDeliveryHubQuoteReference } from "../../modules/delivery-hub/cart-selection"
import {
  DELIVERY_HUB_EXECUTION_LEDGER_REPOSITORY_ASSEMBLY_MODE,
  DELIVERY_HUB_EXECUTION_LEDGER_REPOSITORY_ASSEMBLY_VERSION,
} from "../../modules/delivery-hub/storage/execution-ledger-repository-assembly-scaffold"
import {
  DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
  DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
} from "../../modules/delivery-hub/shipping-option-contract"

describe("Delivery Hub fulfillment provider bridge", () => {
  it("materializes Medusa-facing bridge payload from persisted cart selection", () => {
    const selection = {
      version: 1,
      provider_code: "yandex",
      connection_id: "conn_ready",
      quote_type: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
      quote_reference: createDeliveryHubQuoteReference({
        connection_id: "conn_ready",
        quote_type: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
        quote_key: "quote_1",
      }),
      quote: {
        carrier_code: "yandex",
        carrier_label: "Yandex Delivery",
        amount: 499,
        currency_code: "RUB",
        customer_price: {
          amount: 399,
          currency_code: "RUB",
          source: "fixed" as const,
          policy_id: "policy_test_fixed",
        },
        delivery_eta_min: 1,
        delivery_eta_max: 2,
        pickup_point_required: true,
        pickup_window_required: true,
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
      pickup_window: {
        date: "2026-04-22",
        time_from: "10:00",
        time_to: "14:00",
        interval_utc: {
          from: "2026-04-22T07:00:00.000Z",
          to: "2026-04-22T11:00:00.000Z",
        },
        label: "22 Apr, 10:00-14:00",
      },
      correlation_id: "corr_store_1",
      updated_at: "2026-04-22T04:00:00.000Z",
    }

    const bridge = buildDeliveryHubFulfillmentBridgePayloadFromCartSelection({
      selection,
    })

    expect(bridge).toEqual({
      version: 1,
      option: {
        version: 1,
        provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
        provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
        id: "deliveryhub:warehouse_to_pickup_point",
        mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
      },
      fulfillment_data: {
        version: 1,
        connection_id: "conn_ready",
        mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
        quote_reference: selection.quote_reference,
        quote: selection.quote,
        pickup_point: selection.pickup_point,
        pickup_window: selection.pickup_window,
      },
      calculated_price_data: {
        version: 1,
        provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
        connection_id: "conn_ready",
        mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
        quote_reference: selection.quote_reference,
        quote: selection.quote,
        pickup_point: selection.pickup_point,
        pickup_window: selection.pickup_window,
      },
    })
  })

  it("rejects bridge payload when shipping option mode diverges from selection mode", () => {
    expect(() =>
      buildDeliveryHubFulfillmentBridgePayload({
        option_data: {
          id: "deliveryhub:dropoff_point_to_pickup_point",
          mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
        },
        fulfillment_data: {
          version: 1,
          connection_id: "conn_ready",
          mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
          quote_reference: createDeliveryHubQuoteReference({
            connection_id: "conn_ready",
            quote_type: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
            quote_key: "quote_1",
          }),
          quote: {
            carrier_code: "yandex",
            carrier_label: "Yandex Delivery",
            amount: 499,
            currency_code: "RUB",
            customer_price: {
              amount: 399,
              currency_code: "RUB",
              source: "fixed" as const,
              policy_id: "policy_test_fixed",
            },
            delivery_eta_min: 1,
            delivery_eta_max: 2,
            pickup_point_required: true,
            pickup_window_required: false,
          },
          pickup_point: {
            provider_point_id: "pvz_1",
            provider_point_code: null,
            name: "PVZ 1",
            address: "Tverskaya 1",
            city: null,
            region: null,
            postal_code: null,
            lat: null,
            lng: null,
            is_origin_dropoff_allowed: false,
            is_destination_pickup_allowed: true,
            payment_methods: [],
          },
          pickup_window: null,
        },
      })
    ).toThrow("Delivery Hub shipping selection mode does not match the shipping option mode.")
  })

  it("builds create-fulfillment bridge payload without dispatching live fulfillment automation", () => {
    const payload = buildDeliveryHubCreateFulfillmentBridgePayload({
      fulfillment_data: {
        version: 1,
        connection_id: "conn_ready",
        mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
        quote_reference: createDeliveryHubQuoteReference({
          connection_id: "conn_ready",
          quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
          quote_key: "quote_2",
        }),
        quote: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 299,
          currency_code: "RUB",
          customer_price: {
            amount: 250,
            currency_code: "RUB",
            source: "fixed" as const,
            policy_id: "policy_test_fixed",
          },
          delivery_eta_min: 1,
          delivery_eta_max: 1,
          pickup_point_required: true,
          pickup_window_required: false,
        },
        pickup_point: {
          provider_point_id: "pvz_2",
          provider_point_code: "code_2",
          name: "PVZ 2",
          address: "Arbat 10",
          city: "Moscow",
          region: "Moscow",
          postal_code: "119019",
          lat: 55.75,
          lng: 37.6,
          is_origin_dropoff_allowed: true,
          is_destination_pickup_allowed: true,
          payment_methods: ["card"],
        },
        pickup_window: null,
      },
      order: {
        id: "order_1",
        display_id: 42,
        currency_code: "RUB",
      },
      fulfillment: {
        id: "ful_1",
        location_id: "sloc_1",
      },
      items: [
        {
          line_item_id: "item_1",
          quantity: 2,
        },
        {
          id: "item_2",
          quantity: 1,
        },
      ],
    })

    expect(payload).toEqual({
      version: 1,
      delivery: {
        version: 1,
        option: {
          version: 1,
          provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
          provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
          id: "deliveryhub:dropoff_point_to_pickup_point",
          mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
        },
        fulfillment_data: {
          version: 1,
          connection_id: "conn_ready",
          mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
          quote_reference: expect.objectContaining({
            id: expect.stringMatching(/^dhsel_[a-f0-9]{32}$/),
            version: 1,
          }),
          quote: {
            carrier_code: "yandex",
            carrier_label: "Yandex Delivery",
            amount: 299,
            currency_code: "RUB",
            customer_price: {
              amount: 250,
              currency_code: "RUB",
              source: "fixed" as const,
              policy_id: "policy_test_fixed",
            },
            delivery_eta_min: 1,
            delivery_eta_max: 1,
            pickup_point_required: true,
            pickup_window_required: false,
          },
          pickup_point: {
            provider_point_id: "pvz_2",
            provider_point_code: "code_2",
            name: "PVZ 2",
            address: "Arbat 10",
            city: "Moscow",
            region: "Moscow",
            postal_code: "119019",
            lat: 55.75,
            lng: 37.6,
            is_origin_dropoff_allowed: true,
            is_destination_pickup_allowed: true,
            payment_methods: ["card"],
          },
          pickup_window: null,
        },
        calculated_price_data: {
          version: 1,
          provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
          connection_id: "conn_ready",
          mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
          quote_reference: expect.objectContaining({
            id: expect.stringMatching(/^dhsel_[a-f0-9]{32}$/),
            version: 1,
          }),
          quote: {
            carrier_code: "yandex",
            carrier_label: "Yandex Delivery",
            amount: 299,
            currency_code: "RUB",
            customer_price: {
              amount: 250,
              currency_code: "RUB",
              source: "fixed" as const,
              policy_id: "policy_test_fixed",
            },
            delivery_eta_min: 1,
            delivery_eta_max: 1,
            pickup_point_required: true,
            pickup_window_required: false,
          },
          pickup_point: {
            provider_point_id: "pvz_2",
            provider_point_code: "code_2",
            name: "PVZ 2",
            address: "Arbat 10",
            city: "Moscow",
            region: "Moscow",
            postal_code: "119019",
            lat: 55.75,
            lng: 37.6,
            is_origin_dropoff_allowed: true,
            is_destination_pickup_allowed: true,
            payment_methods: ["card"],
          },
          pickup_window: null,
        },
      },
      order: {
        id: "order_1",
        display_id: 42,
        currency_code: "RUB",
      },
      fulfillment: {
        id: "ful_1",
        location_id: "sloc_1",
      },
      items: [
        {
          line_item_id: "item_1",
          quantity: 2,
        },
        {
          line_item_id: "item_2",
          quantity: 1,
        },
      ],
    })
  })

  it("materializes order-side diagnostic input when create-fulfillment contract is valid while keeping execution blocked", () => {
    const diagnostic = buildDeliveryHubCreateFulfillmentBridgeDiagnostic({
      fulfillment_data: buildValidFulfillmentData(),
      order: {
        id: "order_1",
        display_id: 42,
        currency_code: "RUB",
      },
      fulfillment: {
        id: "ful_1",
        location_id: "sloc_1",
      },
      items: [
        {
          line_item_id: "item_1",
          quantity: 2,
        },
      ],
    })

    expect(diagnostic).toMatchObject({
      version: 1,
      contract_status: "ready",
      execution_status: "blocked",
      blocked_reasons: [expect.stringContaining("Shipment execution remains intentionally unavailable")],
      issues: [],
      shipment_execution: {
        materialized: false,
        reason: expect.stringContaining("diagnostics validate payload assembly"),
      },
      normalized: {
        delivery: expect.objectContaining({
          fulfillment_data: expect.objectContaining({
            connection_id: "conn_ready",
            mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
          }),
        }),
        order: {
          id: "order_1",
          display_id: 42,
          currency_code: "RUB",
        },
        fulfillment: {
          id: "ful_1",
          location_id: "sloc_1",
        },
        items: [
          {
            line_item_id: "item_1",
            quantity: 2,
          },
        ],
        create_fulfillment_payload: expect.objectContaining({
          delivery: expect.objectContaining({
            fulfillment_data: expect.objectContaining({
              connection_id: "conn_ready",
            }),
          }),
        }),
      },
    })
    expect(diagnostic.steps.find((step) => step.key === "create_fulfillment_payload")).toEqual(
      expect.objectContaining({
        ready: true,
      })
    )
  })

  it("reports missing required order-side fragments in create-fulfillment diagnostics", () => {
    const diagnostic = buildDeliveryHubCreateFulfillmentBridgeDiagnostic({
      fulfillment_data: {
        ...buildValidFulfillmentData(),
        quote: {
          ...buildValidFulfillmentData().quote,
          currency_code: "",
        },
      },
      items: [
        {
          line_item_id: "item_1",
          quantity: 1,
        },
      ],
    })

    expect(diagnostic.contract_status).toBe("blocked")
    expect(diagnostic.execution_status).toBe("blocked")
    expect(diagnostic.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "DELIVERY_HUB_INVALID_FULFILLMENT_DATA",
          field_path: "fulfillment_data",
          message: 'Delivery Hub field "quote.currency_code" is required.',
        }),
      ])
    )
    expect(diagnostic.normalized.delivery).toBeNull()
    expect(diagnostic.normalized.create_fulfillment_payload).toBeNull()
  })

  it("reports provider drift and nested shape drift in order-side diagnostics without enabling execution", () => {
    const diagnostic = buildDeliveryHubCreateFulfillmentBridgeDiagnostic({
      option_data: {
        id: "foreign:pickup",
        provider_code: "foreign_provider",
        provider_id: "fp_foreign",
        mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
      },
      fulfillment_data: {
        provider_code: "foreign_provider",
        delivery: {
          version: 1,
          option: {
            id: "foreign:pickup",
          },
        },
      },
      items: [
        {
          line_item_id: "item_1",
          quantity: 1,
        },
      ],
    })

    expect(diagnostic.contract_status).toBe("blocked")
    expect(diagnostic.execution_status).toBe("blocked")
    expect(diagnostic.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "DELIVERY_HUB_PROVIDER_DRIFT",
          field_path: "option_data.provider_code",
        }),
        expect.objectContaining({
          code: "DELIVERY_HUB_PROVIDER_DRIFT",
          field_path: "option_data.provider_id",
        }),
        expect.objectContaining({
          code: "DELIVERY_HUB_PROVIDER_DRIFT",
          field_path: "option_data.id",
        }),
        expect.objectContaining({
          code: "DELIVERY_HUB_PROVIDER_DRIFT",
          field_path: "fulfillment_data.provider_code",
        }),
        expect.objectContaining({
          code: "DELIVERY_HUB_SHAPE_DRIFT",
          field_path: "fulfillment_data",
        }),
        expect.objectContaining({
          code: "DELIVERY_HUB_INVALID_FULFILLMENT_DATA",
          field_path: "fulfillment_data",
        }),
      ])
    )
    expect(diagnostic.shipment_execution).toEqual({
      materialized: false,
      reason: expect.stringContaining("block live shipment automation"),
    })
  })

  it("builds readiness preview with projected/deferred semantics and preview-only shipment guardrails", () => {
    const preview = buildDeliveryHubFulfillmentBridgePreview({
      projected_modes: [
        {
          mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
          supporting_connection_ids: ["conn_ready_a", "conn_ready_b"],
        },
      ],
      deferred_modes: [
        {
          mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
          issues: [
            {
              connection_id: "conn_missing_capability",
              provider_code: "yandex",
              code: "DELIVERY_HUB_MODE_UNAVAILABLE",
              message: "Authorization: Bearer live-secret-token is missing dropoff capability.",
              mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
            },
          ],
        },
      ],
    })

    expect(preview.summary).toEqual({
      mode_count: 2,
      ready_mode_count: 2,
      error_mode_count: 0,
      projected_mode_count: 1,
      deferred_mode_count: 1,
    })

    const projectedMode = preview.mode_previews.find(
      (entry) => entry.mode_code === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint
    )
    const deferredMode = preview.mode_previews.find(
      (entry) => entry.mode_code === DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint
    )

    expect(projectedMode).toMatchObject({
      mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
      status: "ready",
      rollout_status: "projected",
      supporting_connection_ids: ["conn_ready_a", "conn_ready_b"],
      shipment_execution: {
        materialized: false,
        reason: expect.stringContaining("intentionally unavailable"),
      },
    })
    expect(projectedMode?.selection).toEqual(
      expect.objectContaining({
        quote_type: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
        connection_id: "preview_warehouse_to_pickup_point",
        quote: expect.objectContaining({
          pickup_window_required: true,
          currency_code: "RUB",
          customer_price: {
            amount: 399,
            currency_code: "RUB",
            source: "fixed" as const,
            policy_id: "policy_test_fixed",
          },
        }),
        pickup_window: expect.objectContaining({
          interval_utc: expect.objectContaining({
            from: "2026-01-02T07:00:00.000Z",
            to: "2026-01-02T11:00:00.000Z",
          }),
        }),
      })
    )
    expect(projectedMode?.shipping_option_data).toEqual({
      version: 1,
      provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
      provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
      id: "deliveryhub:warehouse_to_pickup_point",
      mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
    })
    expect(projectedMode?.fulfillment_payload).toEqual(
      expect.objectContaining({
        version: 1,
        option: expect.objectContaining({
          id: "deliveryhub:warehouse_to_pickup_point",
        }),
        fulfillment_data: expect.objectContaining({
          mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
        }),
        calculated_price_data: expect.objectContaining({
          connection_id: "preview_warehouse_to_pickup_point",
        }),
      })
    )
    expect(projectedMode?.create_fulfillment_payload).toEqual(
      expect.objectContaining({
        version: 1,
        delivery: expect.objectContaining({
          fulfillment_data: expect.objectContaining({
            mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
          }),
        }),
        order: {
          id: null,
          display_id: null,
          currency_code: "RUB",
        },
        fulfillment: {
          id: null,
          location_id: null,
        },
        items: [
          {
            line_item_id: "preview_warehouse_to_pickup_point_item",
            quantity: 1,
          },
        ],
      })
    )

    expect(deferredMode).toMatchObject({
      mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
      status: "ready",
      rollout_status: "deferred",
      supporting_connection_ids: [],
      blocking_issues: [
        {
          connection_id: "conn_missing_capability",
          provider_code: "yandex",
          code: "DELIVERY_HUB_MODE_UNAVAILABLE",
          message: "Authorization: Bearer live-secret-token is missing dropoff capability.",
          mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
        },
      ],
      shipment_execution: {
        materialized: false,
        reason: expect.any(String),
      },
    })
    expect(deferredMode?.selection).toEqual(
      expect.objectContaining({
        quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
        pickup_window: null,
        pickup_point: expect.objectContaining({
          is_origin_dropoff_allowed: true,
        }),
      })
    )
    expect(deferredMode?.create_fulfillment_payload?.items).toEqual([
      {
        line_item_id: "preview_dropoff_point_to_pickup_point_item",
        quantity: 1,
      },
    ])
  })

  it("assembles shopper-safe and ops-safe fulfillment handoff snapshot", () => {
    const handoff = buildDeliveryHubFulfillmentHandoffSnapshot({
      fulfillment_data: {
        ...buildValidFulfillmentData(),
        cart_id: "cart_1",
        shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
        shipping_option_type_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
        correlation_id: "corr_handoff_1",
        updated_at: "2026-04-23T07:00:00.000Z",
      },
      order: {
        id: "order_1",
        display_id: 42,
        currency_code: "RUB",
      },
      fulfillment: {
        id: "ful_1",
        location_id: "sloc_1",
      },
    })

    expect(handoff).toEqual({
      version: DELIVERY_HUB_FULFILLMENT_HANDOFF_SNAPSHOT_VERSION,
      provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
      provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
      connection_id: "conn_ready",
      quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
      quote_reference: expect.objectContaining({
        id: expect.stringMatching(/^dhsel_[a-f0-9]{32}$/),
        version: 1,
      }),
      quote_summary: {
        carrier_code: "yandex",
        carrier_label: "Yandex Delivery",
        amount: 250,
        currency_code: "RUB",
        delivery_eta_min: 1,
        delivery_eta_max: 1,
      },
      pickup_point_summary: {
        name: "PVZ 2",
        address: "Arbat 10",
        city: "Moscow",
        region: "Moscow",
        postal_code: "119019",
      },
      pickup_window_summary: null,
      references: {
        cart_id: "cart_1",
        order_id: "order_1",
        order_display_id: 42,
        fulfillment_id: "ful_1",
        shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
        shipping_option_type_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
        location_id: "sloc_1",
      },
      correlation_id: "corr_handoff_1",
      timestamps: {
        selection_updated_at: "2026-04-23T07:00:00.000Z",
        assembled_at: expect.any(String),
      },
      contour: {
        contract_status: "ready",
        execution_status: "blocked",
        handoff_target: "manual_external",
        repository_current_stage: "activation_blocked",
        live_execution_enabled: false,
        real_provider_dispatch_enabled: false,
      },
    })
  })

  it("blocks fulfillment handoff on missing selection, mismatched option and stale reference", () => {
    expect(() =>
      buildDeliveryHubFulfillmentHandoffSnapshot({
        fulfillment_data: {
          shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
        },
      })
    ).toThrow("Delivery Hub fulfillment handoff is blocked:")

    expect(() =>
      buildDeliveryHubFulfillmentHandoffSnapshot({
        fulfillment_data: {
          ...buildValidFulfillmentData(),
          shipping_option_id: "deliveryhub:warehouse_to_pickup_point",
          shipping_option_type_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
          updated_at: "2026-04-23T07:00:00.000Z",
        },
      })
    ).toThrow(
      "Delivery Hub fulfillment handoff is blocked: committed shipping option does not match saved delivery selection."
    )

    expect(() =>
      buildDeliveryHubFulfillmentHandoffSnapshot({
        fulfillment_data: {
          ...buildValidFulfillmentData(),
          shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
          shipping_option_type_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
          committed_quote_reference: {
            id: "dhsel_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            version: 1,
          },
          updated_at: "2026-04-23T07:00:00.000Z",
        },
      })
    ).toThrow(
      "Delivery Hub fulfillment handoff is blocked: committed quote reference is stale relative to saved delivery selection."
    )
  })

  it("assembles execution-ledger evidence artifact from valid handoff snapshot without enabling persistence", () => {
    const artifactAssembly = buildDeliveryHubExecutionLedgerEvidenceArtifactAssembly({
      fulfillment_data: {
        ...buildValidFulfillmentData(),
        cart_id: "cart_1",
        shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
        shipping_option_type_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
        correlation_id: "corr_handoff_1",
        updated_at: "2026-04-23T07:00:00.000Z",
      },
      order: {
        id: "order_1",
        display_id: 42,
        currency_code: "RUB",
      },
      fulfillment: {
        id: "ful_1",
        location_id: "sloc_1",
      },
    })

    expect(artifactAssembly).toEqual({
      version: DELIVERY_HUB_EXECUTION_LEDGER_EVIDENCE_ARTIFACT_VERSION,
      status: "ready",
      blocked_reason: null,
      artifact: {
        version: DELIVERY_HUB_EXECUTION_LEDGER_EVIDENCE_ARTIFACT_VERSION,
        artifact_kind: "deliveryhub_execution_ledger_evidence",
        artifact_status: "assembled",
        evidence_status: "preview_ready_manual_handoff",
        provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
        provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
        connection_id: "conn_ready",
        quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
        quote_reference_summary: {
          id: expect.stringMatching(/^dhsel_[a-f0-9]{32}$/),
          version: 1,
        },
        quote_summary: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 299,
          currency_code: "RUB",
          customer_price: {
            amount: 250,
            currency_code: "RUB",
            source: "fixed" as const,
            policy_id: "policy_test_fixed",
          },
          delivery_eta_min: 1,
          delivery_eta_max: 1,
        },
        pickup_point_summary: {
          name: "PVZ 2",
          address: "Arbat 10",
          city: "Moscow",
          region: "Moscow",
          postal_code: "119019",
        },
        pickup_window_summary: null,
        references: {
          cart_id: "cart_1",
          order_id: "order_1",
          order_display_id: 42,
          fulfillment_id: "ful_1",
          shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
          shipping_option_type_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
          location_id: "sloc_1",
        },
        correlation_id: "corr_handoff_1",
        timestamps: {
          selection_updated_at: "2026-04-23T07:00:00.000Z",
          handoff_assembled_at: expect.any(String),
          artifact_assembled_at: expect.any(String),
        },
        contour: {
          contract_status: "ready",
          execution_status: "blocked",
          handoff_target: "manual_external",
          persistence_contour: "manual_external_only",
          repository_current_stage: "activation_blocked",
          live_execution_enabled: false,
          ledger_persistence_enabled: false,
          real_provider_dispatch_enabled: false,
        },
      },
    })
  })

  it("blocks execution-ledger evidence artifact assembly when handoff is missing or stale", () => {
    expect(
      buildDeliveryHubExecutionLedgerEvidenceArtifactAssembly({
        fulfillment_data: {
          ...buildValidFulfillmentData(),
        },
      })
    ).toEqual({
      version: DELIVERY_HUB_EXECUTION_LEDGER_EVIDENCE_ARTIFACT_VERSION,
      status: "blocked",
      artifact: null,
      blocked_reason: "Delivery Hub fulfillment handoff requires committed shipping_option_id.",
    })

    expect(
      buildDeliveryHubExecutionLedgerEvidenceArtifactAssembly({
        fulfillment_data: {
          ...buildValidFulfillmentData(),
          shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
          shipping_option_type_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
          committed_quote_reference: {
            id: "dhsel_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            version: 1,
          },
          updated_at: "2026-04-23T07:00:00.000Z",
        },
      })
    ).toEqual({
      version: DELIVERY_HUB_EXECUTION_LEDGER_EVIDENCE_ARTIFACT_VERSION,
      status: "blocked",
      artifact: null,
      blocked_reason:
        "Delivery Hub fulfillment handoff is blocked: committed quote reference is stale relative to saved delivery selection.",
    })
  })

  it("keeps handoff artifact anti-leak and execution-plan preview includes serialized handoff", () => {
    const preview = buildDeliveryHubShipmentExecutionPlanPreview({
      fulfillment_data: {
        ...buildValidFulfillmentData(),
        cart_id: "cart_1",
        shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
        shipping_option_type_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
        correlation_id: "corr_handoff_1",
        updated_at: "2026-04-23T07:00:00.000Z",
        credentials: {
          token: "secret-token",
        },
        raw_response: {
          offer_id: "raw-offer-id",
        },
        metadata: {
          secret: "secret-value",
        },
      },
      order: {
        id: "order_1",
        display_id: 42,
        currency_code: "RUB",
      },
      fulfillment: {
        id: "ful_1",
        location_id: "sloc_1",
      },
      items: [
        {
          line_item_id: "item_1",
          quantity: 1,
        },
      ],
    })

    expect(preview.normalized.fulfillment_handoff).toEqual(
      expect.objectContaining({
        references: expect.objectContaining({
          shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
        }),
        contour: expect.objectContaining({
          execution_status: "blocked",
        }),
      })
    )
    expect(preview.normalized.execution_ledger_evidence).toEqual(
      expect.objectContaining({
        status: "ready",
        artifact: expect.objectContaining({
          artifact_kind: "deliveryhub_execution_ledger_evidence",
          evidence_status: "preview_ready_manual_handoff",
          quote_reference_summary: expect.objectContaining({
            id: expect.stringMatching(/^dhsel_[a-f0-9]{32}$/),
          }),
          contour: expect.objectContaining({
            execution_status: "blocked",
            ledger_persistence_enabled: false,
          }),
        }),
      })
    )
    expect(preview.normalized.fulfillment_handoff).not.toHaveProperty("credentials")
    expect(preview.normalized.fulfillment_handoff).not.toHaveProperty("raw_response")
    expect(preview.normalized.fulfillment_handoff).not.toHaveProperty("metadata")
    expect(JSON.stringify(preview.normalized.fulfillment_handoff)).not.toContain("secret-token")
    expect(JSON.stringify(preview.normalized.fulfillment_handoff)).not.toContain("raw-offer-id")
    expect(JSON.stringify(preview.normalized.fulfillment_handoff)).not.toContain("secret-value")
    expect(preview.normalized.execution_ledger_evidence?.artifact).not.toHaveProperty("credentials")
    expect(preview.normalized.execution_ledger_evidence?.artifact).not.toHaveProperty("raw_response")
    expect(preview.normalized.execution_ledger_evidence?.artifact).not.toHaveProperty("metadata")
    expect(JSON.stringify(preview.normalized.execution_ledger_evidence)).not.toContain("secret-token")
    expect(JSON.stringify(preview.normalized.execution_ledger_evidence)).not.toContain("raw-offer-id")
    expect(JSON.stringify(preview.normalized.execution_ledger_evidence)).not.toContain("secret-value")
    expect(preview.normalized.execution_ledger_evidence?.artifact).not.toHaveProperty(
      "quote_reference"
    )
    expect(preview.execution_status).toBe("blocked")
  })

  it("materializes admin execution-plan observability preview with ready and blocked contours", () => {
    const preview = buildDeliveryHubExecutionPlanObservabilityPreview({
      projected_modes: [
        {
          mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
          supporting_connection_ids: ["conn_ready_a", "conn_ready_b"],
        },
      ],
      deferred_modes: [
        {
          mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
          issues: [
            {
              connection_id: "conn_missing_capability",
              provider_code: "yandex",
              code: "DELIVERY_HUB_MODE_UNAVAILABLE",
              message: "Authorization: Bearer live-secret-token is missing dropoff capability.",
              mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
            },
          ],
        },
      ],
    })

    expect(preview.summary).toEqual({
      mode_count: 2,
      ready_mode_count: 1,
      blocked_mode_count: 1,
      projected_mode_count: 1,
      deferred_mode_count: 1,
      unconfigured_mode_count: 0,
    })

    const projectedMode = preview.mode_previews.find(
      (entry) => entry.mode_code === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint
    )
    const deferredMode = preview.mode_previews.find(
      (entry) => entry.mode_code === DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint
    )

    expect(projectedMode).toMatchObject({
      mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
      status: "ready",
      rollout_status: "projected",
      supporting_connection_ids: ["conn_ready_a", "conn_ready_b"],
      readiness_verdict: {
        status: "ready",
        blocked_reasons: [],
      },
      repository_assembly_summary: {
        version: DELIVERY_HUB_EXECUTION_LEDGER_REPOSITORY_ASSEMBLY_VERSION,
        mode: DELIVERY_HUB_EXECUTION_LEDGER_REPOSITORY_ASSEMBLY_MODE,
        repository_status: "pg_repository_implementation_available",
        persistence_readiness_contour: {
          stages: [
            "artifact_defined",
            "manual_application_external",
            "snapshot_verification_available",
            "activation_blocked",
          ],
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
      execution_plan: {
        operation: "create_shipment",
        connection_id: "preview_warehouse_to_pickup_point",
        mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
        outbound_request: {
          method: "POST",
          path: "/shipments",
          headers: {
            authorization: "***",
            "content-type": "application/json",
          },
        },
      },
      execution_identity: {
        version: DELIVERY_HUB_EXECUTION_IDENTITY_PREVIEW_VERSION,
        redacted: true,
        operation: "create_shipment",
        provider_operation_label: "create_shipment:warehouse_to_pickup_point",
        provider_operation_reference: expect.stringMatching(/^dhprev_[a-f0-9]{16}$/),
        plan_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        execution_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        idempotency_key_preview: expect.stringMatching(
          /^deliveryhub:preview:create_shipment:[a-f0-9]{64}$/
        ),
      },
      outbound_payload_preview: {
        redacted: true,
        request: expect.objectContaining({
          headers: expect.objectContaining({
            authorization: "***",
          }),
        }),
      },
      preflight_eligibility: {
        version: DELIVERY_HUB_EXECUTION_PREFLIGHT_ELIGIBILITY_PREVIEW_VERSION,
        redacted: true,
        current_mode: "preview_only",
        decision: "eligible_when_enabled",
        real_execution_enabled: false,
        reasons: expect.arrayContaining([
          expect.objectContaining({ code: "EXECUTION_PREVIEW_ONLY" }),
          expect.objectContaining({ code: "FUTURE_EXECUTION_FLAG_INERT" }),
          expect.objectContaining({ code: "LIVE_EXECUTION_DISABLED" }),
          expect.objectContaining({ code: "PROVIDER_EXECUTION_ADAPTER_DISABLED" }),
        ]),
        blocked_live_actions: expect.arrayContaining([
          expect.objectContaining({ code: "provider_create_shipment_call", blocked: true }),
          expect.objectContaining({ code: "checkout_cutover", blocked: true }),
        ]),
      },
      provider_dispatch_preview: {
        version: DELIVERY_HUB_PROVIDER_DISPATCH_PREVIEW_VERSION,
        redacted: true,
        current_mode: "preview_only",
        dispatch_decision: "ready_for_future_dispatch",
        provider: expect.objectContaining({
          provider_key: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
          adapter_operation: "create_shipment",
          adapter_operation_label: "create_shipment:warehouse_to_pickup_point",
        }),
        command_identity: expect.objectContaining({
          provider_operation_reference: expect.stringMatching(/^dhprev_[a-f0-9]{16}$/),
          idempotency_key_preview: expect.stringMatching(
            /^deliveryhub:preview:create_shipment:[a-f0-9]{64}$/
          ),
        }),
        command_envelope_summary: expect.objectContaining({
          origin_kind: "fulfillment_location",
          destination_kind: "pickup_point",
          quote_reference_present: true,
          offer_reference_present: true,
          package_reference_present: true,
        }),
        blocked_dispatch_actions: expect.arrayContaining([
          expect.objectContaining({ code: "adapter_invocation", blocked: true }),
          expect.objectContaining({ code: "provider_network_call", blocked: true }),
          expect.objectContaining({ code: "shipment_creation", blocked: true }),
          expect.objectContaining({ code: "persistence_write", blocked: true }),
          expect.objectContaining({ code: "checkout_cutover", blocked: true }),
        ]),
        confirmations: expect.objectContaining({
          adapter_invocation_disabled: true,
          provider_network_calls_disabled: true,
          shipment_creation_disabled: true,
          label_creation_disabled: true,
          order_mutation_disabled: true,
          persistence_writes_disabled: true,
          checkout_cutover_disabled: true,
        }),
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
        identity_correlation: expect.objectContaining({
          provider_operation_reference: expect.stringMatching(/^dhprev_[a-f0-9]{16}$/),
          idempotency_key_preview: expect.stringMatching(
            /^deliveryhub:preview:create_shipment:[a-f0-9]{64}$/
          ),
          plan_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
          execution_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
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
      shipment_result_preview: {
        version: DELIVERY_HUB_SHIPMENT_RESULT_PREVIEW_VERSION,
        redacted: true,
        current_mode: "preview_only",
        result_decision: "projected_for_future_execution",
        projected_result_status: "projected_for_future_execution",
        result_kind: "shipment_result",
        normalization_target: "deliveryhub_shipment_result",
        provider_normalization_target: "create_shipment_response",
        identity_linkage: expect.objectContaining({
          provider_operation_reference: expect.stringMatching(/^dhprev_[a-f0-9]{16}$/),
          idempotency_key_preview: expect.stringMatching(
            /^deliveryhub:preview:create_shipment:[a-f0-9]{64}$/
          ),
        }),
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
        blocked_materialization_actions: expect.arrayContaining([
          expect.objectContaining({ code: "provider_response_fetch", blocked: true }),
          expect.objectContaining({ code: "adapter_result_normalization", blocked: true }),
          expect.objectContaining({ code: "shipment_creation", blocked: true }),
          expect.objectContaining({ code: "label_persistence", blocked: true }),
          expect.objectContaining({ code: "fulfillment_persistence", blocked: true }),
          expect.objectContaining({ code: "checkout_cutover", blocked: true }),
        ]),
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
        persistence_linkage: {
          execution_reference_present: true,
          idempotency_reservation_present: true,
          audit_log_reference_present: true,
        },
        blocked_application_actions: expect.arrayContaining([
          expect.objectContaining({ code: "order_mutation", blocked: true }),
          expect.objectContaining({ code: "fulfillment_persistence", blocked: true }),
          expect.objectContaining({ code: "shipment_persistence", blocked: true }),
          expect.objectContaining({ code: "event_persistence", blocked: true }),
          expect.objectContaining({ code: "checkout_cutover", blocked: true }),
        ]),
        confirmations: {
          order_mutation_disabled: true,
          fulfillment_persistence_disabled: true,
          shipment_persistence_disabled: true,
          label_persistence_disabled: true,
          event_persistence_disabled: true,
          checkout_cutover_disabled: true,
        },
      },
      shipment_execution: {
        materialized: false,
        reason: expect.stringContaining("intentionally unavailable"),
      },
    })
    expect(projectedMode?.repository_assembly_summary).toEqual(
      buildDeliveryHubShipmentExecutionPlanPreview({
        fulfillment_data: buildValidFulfillmentData(),
        order: {
          id: null,
          display_id: null,
          currency_code: "RUB",
        },
        fulfillment: {
          id: null,
          location_id: null,
        },
        items: [
          {
            line_item_id: "preview_warehouse_to_pickup_point_item",
            quantity: 1,
          },
        ],
      }).repository_assembly_summary
    )
    expect(JSON.stringify(projectedMode)).not.toContain("delivery-hub-provider-credential")

    expect(deferredMode).toMatchObject({
      mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
      status: "blocked",
      rollout_status: "deferred",
      readiness_verdict: {
        status: "blocked",
        blocked_reasons: [
          "Authorization: Bearer live-secret-token is missing dropoff capability.",
        ],
      },
      execution_plan: null,
      execution_identity: null,
      outbound_payload_preview: {
        redacted: true,
        request: null,
      },
      preflight_eligibility: expect.objectContaining({
        current_mode: "preview_only",
        decision: "not_ready",
        real_execution_enabled: false,
        reasons: expect.arrayContaining([
          expect.objectContaining({ code: "EXECUTION_PLAN_NOT_READY" }),
          expect.objectContaining({ code: "EXECUTION_IDENTITY_NOT_READY" }),
          expect.objectContaining({ code: "PERSISTENCE_AUDIT_NOT_READY" }),
        ]),
      }),
      provider_dispatch_preview: expect.objectContaining({
        current_mode: "preview_only",
        dispatch_decision: "not_dispatched",
        command_identity: {
          provider_operation_reference: null,
          idempotency_key_preview: null,
          plan_fingerprint: null,
          execution_fingerprint: null,
        },
        confirmations: expect.objectContaining({
          adapter_invocation_disabled: true,
          provider_network_calls_disabled: true,
          shipment_creation_disabled: true,
        }),
      }),
      fulfillment_application_preview: expect.objectContaining({
        current_mode: "preview_only",
        application_decision: "not_applied",
        projected_application_status: "not_applied",
        mutation_semantics: expect.objectContaining({
          fulfillment_data_patch_present: false,
          tracking_projection_present: false,
          audit_linkage_present: false,
        }),
        confirmations: expect.objectContaining({
          order_mutation_disabled: true,
          fulfillment_persistence_disabled: true,
          shipment_persistence_disabled: true,
          label_persistence_disabled: true,
          event_persistence_disabled: true,
          checkout_cutover_disabled: true,
        }),
      }),
      shipment_execution: {
        materialized: false,
        reason: expect.stringContaining("intentionally unavailable"),
      },
    })
    expect(deferredMode?.steps.some((step) => step.key === "provider_execution_plan" && step.ready)).toBe(
      false
    )
  })
 
  it("materializes a dry-run execution plan preview with redacted outbound request", () => {
    const preview = buildDeliveryHubShipmentExecutionPlanPreview({
      fulfillment_data: buildValidFulfillmentData(),
      order: {
        id: "order_1",
        display_id: 42,
        currency_code: "RUB",
      },
      fulfillment: {
        id: "ful_1",
        location_id: "sloc_1",
      },
      items: [
        {
          line_item_id: "item_1",
          quantity: 2,
        },
      ],
    })

    expect(preview).toMatchObject({
      version: 1,
      contract_status: "ready",
      execution_status: "blocked",
      readiness_verdict: {
        status: "ready",
        blocked_reasons: [],
      },
      repository_assembly_summary: {
        version: DELIVERY_HUB_EXECUTION_LEDGER_REPOSITORY_ASSEMBLY_VERSION,
        mode: DELIVERY_HUB_EXECUTION_LEDGER_REPOSITORY_ASSEMBLY_MODE,
        repository_status: "pg_repository_implementation_available",
        table_name: "deliveryhub_execution_ledger",
        persistence_readiness_contour: {
          stages: [
            "artifact_defined",
            "manual_application_external",
            "snapshot_verification_available",
            "activation_blocked",
          ],
          current_stage: "activation_blocked",
          activation_blocked_until: [
            "migration_or_table_creation",
            "transaction_runner",
            "explicit_runtime_wiring",
            "operational_runbook",
            "safety_review",
          ],
        },
        missing_activation_prerequisites: [
          "migration_or_table_creation",
          "transaction_runner",
          "explicit_runtime_wiring",
          "operational_runbook",
          "safety_review",
        ],
        disabled_confirmations: {
          query_execution: false,
          transaction_execution: false,
          transaction_open: false,
          transaction_commit: false,
          transaction_rollback: false,
          production_writes: false,
          runtime_wiring: false,
          live_execution: false,
          provider_dispatch: false,
          shipment_creation: false,
          label_or_document_generation: false,
          order_or_fulfillment_mutation: false,
          retry_scheduling: false,
          compensation_or_rollback_writes: false,
          checkout_or_storefront_cutover: false,
          connection_factory_invocation: false,
          migration_or_table_creation: false,
        },
      },
      blocked_reasons: [expect.stringContaining("Shipment execution remains intentionally unavailable")],
      normalized: {
        provider_execution_plan: {
          version: 1,
          provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
          provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
          operation: "create_shipment",
          connection_id: "conn_ready",
          mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
          order: {
            id: "order_1",
            display_id: 42,
            currency_code: "RUB",
          },
          fulfillment: {
            id: "ful_1",
            location_id: "sloc_1",
          },
          items: [
            {
              line_item_id: "item_1",
              quantity: 2,
            },
          ],
          outbound_request: {
            method: "POST",
            path: "/shipments",
            headers: {
              authorization: "Bearer delivery-hub-provider-credential",
              "content-type": "application/json",
            },
          },
        },
      },
      execution_identity: {
        version: DELIVERY_HUB_EXECUTION_IDENTITY_PREVIEW_VERSION,
        redacted: true,
        operation: "create_shipment",
        provider_operation_label: "create_shipment:dropoff_point_to_pickup_point",
        provider_operation_reference: expect.stringMatching(/^dhprev_[a-f0-9]{16}$/),
        plan_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        execution_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        idempotency_key_preview: expect.stringMatching(
          /^deliveryhub:preview:create_shipment:[a-f0-9]{64}$/
        ),
      },
      outbound_payload_preview: {
        redacted: true,
        request: {
          method: "POST",
          path: "/shipments",
          headers: {
            authorization: "***",
            "content-type": "application/json",
          },
          body: expect.objectContaining({
            provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
            provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
            connection_id: "conn_ready",
            mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
            order: {
              id: "order_1",
              display_id: 42,
              currency_code: "RUB",
            },
            fulfillment: {
              id: "ful_1",
              location_id: "sloc_1",
            },
            items: [
              {
                line_item_id: "item_1",
                quantity: 2,
              },
            ],
          }),
        },
      },
      persistence_audit_preview: {
        version: DELIVERY_HUB_EXECUTION_PERSISTENCE_AUDIT_PREVIEW_VERSION,
        redacted: true,
        status: "ready",
        metadata_patch: {
          target: "fulfillment_execution_shadow",
          action: "merge",
          fields: expect.arrayContaining([
            {
              field: "execution_reference",
              value_preview: expect.stringMatching(/^dhprev_[a-f0-9]{16}$/),
            },
            {
              field: "status_snapshot",
              value_preview: "planned",
            },
          ]),
        },
        execution_record: {
          ready: true,
          record_type: "deliveryhub_shipment_execution",
          operation: "create_shipment",
          provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
          provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
          connection_id: "conn_ready",
          mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
          execution_reference: expect.stringMatching(/^dhprev_[a-f0-9]{16}$/),
          idempotency_key_preview: expect.stringMatching(
            /^deliveryhub:preview:create_shipment:[a-f0-9]{64}$/
          ),
          initial_status: "planned",
        },
        idempotency_reservation: {
          ready: true,
          draft: expect.objectContaining({
            reservation_type: "deliveryhub_execution_idempotency_reservation",
            connection_id: "conn_ready",
            mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
          }),
          dedupe_scope: "deliveryhub:create_shipment",
          reservation_key_preview: expect.stringMatching(
            /^deliveryhub:preview:create_shipment:[a-f0-9]{64}$/
          ),
          reservation_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
          matched_fields: expect.arrayContaining([
            {
              field: "connection_id",
              value_preview: "conn_ready",
            },
            {
              field: "execution_fingerprint",
              value_preview: expect.stringMatching(/^[a-f0-9]{64}$/),
            },
          ]),
        },
        status_transitions: expect.arrayContaining([
          expect.objectContaining({ from: "planned", to: "reserved", reason: "reservation_projected" }),
          expect.objectContaining({ from: "reserved", to: "dispatch_ready", reason: "dispatch_gate_satisfied" }),
        ]),
        audit_log_entries: expect.arrayContaining([
          expect.objectContaining({ event_type: "deliveryhub.execution.planned" }),
          expect.objectContaining({ event_type: "deliveryhub.execution.reserved" }),
          expect.objectContaining({ event_type: "deliveryhub.execution.dispatch_ready" }),
        ]),
        blocked: expect.arrayContaining([
          expect.objectContaining({ key: "metadata_commit" }),
          expect.objectContaining({ key: "provider_dispatch" }),
        ]),
        deferred: expect.arrayContaining([
          expect.objectContaining({ key: "provider_response_capture" }),
          expect.objectContaining({ key: "audit_log_commit" }),
        ]),
      },
      provider_dispatch_preview: {
        version: DELIVERY_HUB_PROVIDER_DISPATCH_PREVIEW_VERSION,
        redacted: true,
        current_mode: "preview_only",
        dispatch_decision: "ready_for_future_dispatch",
        provider: expect.objectContaining({
          provider_key: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
          adapter_operation: "create_shipment",
          adapter_operation_label: "create_shipment:dropoff_point_to_pickup_point",
        }),
        command_identity: expect.objectContaining({
          provider_operation_reference: expect.stringMatching(/^dhprev_[a-f0-9]{16}$/),
          idempotency_key_preview: expect.stringMatching(
            /^deliveryhub:preview:create_shipment:[a-f0-9]{64}$/
          ),
        }),
        command_envelope_summary: expect.objectContaining({
          connection_id_present: true,
          mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
          origin_kind: "dropoff_point",
          destination_kind: "pickup_point",
          quote_reference_present: true,
          offer_reference_present: true,
          package_reference_present: true,
          order_reference_present: true,
          fulfillment_reference_present: true,
          pickup_scheduling_reference_present: false,
          dropoff_scheduling_reference_present: true,
          item_count: 1,
        }),
        blocked_dispatch_actions: expect.arrayContaining([
          expect.objectContaining({ code: "adapter_invocation", blocked: true }),
          expect.objectContaining({ code: "provider_network_call", blocked: true }),
          expect.objectContaining({ code: "shipment_creation", blocked: true }),
          expect.objectContaining({ code: "label_creation", blocked: true }),
          expect.objectContaining({ code: "order_mutation", blocked: true }),
          expect.objectContaining({ code: "persistence_write", blocked: true }),
          expect.objectContaining({ code: "checkout_cutover", blocked: true }),
        ]),
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
        version: DELIVERY_HUB_FAILURE_HANDLING_PREVIEW_VERSION,
        redacted: true,
        current_mode: "preview_only",
        failure_path_decision: "projected_retry_policy",
        projected_failure_status: "manual_intervention_required_when_enabled",
        failure_classes: [
          {
            code: "provider_dispatch_failure",
            retry_eligibility: "eligible_when_enabled",
            compensation_requirement: "not_required",
            manual_intervention: "required_when_enabled",
            reason_bucket: "dispatch_transport",
          },
          {
            code: "provider_timeout",
            retry_eligibility: "eligible_when_enabled",
            compensation_requirement: "not_required",
            manual_intervention: "required_when_enabled",
            reason_bucket: "provider_timeout",
          },
          {
            code: "provider_response_invalid",
            retry_eligibility: "blocked",
            compensation_requirement: "not_required",
            manual_intervention: "required_when_enabled",
            reason_bucket: "response_normalization",
          },
          {
            code: "shipment_result_rejected",
            retry_eligibility: "blocked",
            compensation_requirement: "required_when_enabled",
            manual_intervention: "required_when_enabled",
            reason_bucket: "result_semantics",
          },
          {
            code: "application_projection_blocked",
            retry_eligibility: "blocked",
            compensation_requirement: "required_when_enabled",
            manual_intervention: "required_when_enabled",
            reason_bucket: "application_projection",
          },
        ],
        identity_linkage: expect.objectContaining({
          provider_operation_reference: expect.stringMatching(/^dhprev_[a-f0-9]{16}$/),
          idempotency_key_preview: expect.stringMatching(
            /^deliveryhub:preview:create_shipment:[a-f0-9]{64}$/
          ),
        }),
        retry_projection: {
          eligibility: "eligible_when_enabled",
          policy: "deterministic_preview_only",
          retry_block_reasons: [
            "Retry scheduling remains disabled in preview-only mode until a future live execution layer exists.",
            "Provider re-dispatch remains blocked even when deterministic retry eligibility is projected.",
          ],
          scheduling_status: "disabled",
        },
        compensation_projection: {
          requirement: "required_when_enabled",
          write_plan_status: "disabled",
          rollback_status: "disabled",
          blocked_actions: [
            "rollback_execution_state",
            "compensation_write",
            "shipment_result_reversal",
          ],
        },
        manual_intervention_projection: {
          status: "required_when_enabled",
          reason_markers: [
            "manual_review_after_retry_budget_when_enabled",
            "operator_confirmation_required_before_compensation_when_enabled",
          ],
        },
        blocked_failure_actions: expect.arrayContaining([
          expect.objectContaining({ code: "retry_scheduling", blocked: true }),
          expect.objectContaining({ code: "provider_redispatch", blocked: true }),
          expect.objectContaining({ code: "rollback_execution_state", blocked: true }),
          expect.objectContaining({ code: "compensation_write", blocked: true }),
          expect.objectContaining({ code: "event_persistence", blocked: true }),
          expect.objectContaining({ code: "order_mutation", blocked: true }),
          expect.objectContaining({ code: "checkout_cutover", blocked: true }),
        ]),
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
        phases: [
          {
            code: "preflight_eligibility",
            order: 1,
            status: "projected_for_future_execution",
            readiness_posture: "ready_when_enabled",
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
            linked_preview_artifacts: ["provider_dispatch_preview", "execution_identity"],
          },
          {
            code: "shipment_result_normalization",
            order: 3,
            status: "projected_for_future_execution",
            readiness_posture: "ready_when_enabled",
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
        reason: expect.stringContaining("block live shipment automation"),
      },
    })
    expect(preview.steps.find((step) => step.key === "provider_execution_plan")).toEqual(
      expect.objectContaining({
        ready: true,
      })
    )
    expect(preview.steps.find((step) => step.key === "execution_identity")).toEqual(
      expect.objectContaining({
        ready: true,
      })
    )
    expect(preview.steps.find((step) => step.key === "outbound_payload_preview")).toEqual(
      expect.objectContaining({
        ready: true,
      })
    )
    expect(preview.steps.find((step) => step.key === "persistence_audit_preview")).toEqual(
      expect.objectContaining({
        ready: true,
      })
    )
    expect(preview.steps.find((step) => step.key === "preflight_eligibility")).toEqual(
      expect.objectContaining({
        ready: true,
      })
    )
    expect(preview.steps.find((step) => step.key === "provider_dispatch_preview")).toEqual(
      expect.objectContaining({
        ready: true,
      })
    )
    expect(preview.steps.find((step) => step.key === "failure_handling_preview")).toEqual(
      expect.objectContaining({
        ready: true,
      })
    )
    expect(preview.preflight_eligibility).toMatchObject({
      version: DELIVERY_HUB_EXECUTION_PREFLIGHT_ELIGIBILITY_PREVIEW_VERSION,
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
    })
    expect(preview.preflight_eligibility.reasons.map((reason) => reason.code)).toEqual([
      "EXECUTION_PREVIEW_ONLY",
      "FUTURE_EXECUTION_FLAG_INERT",
      "LIVE_EXECUTION_DISABLED",
      "PROVIDER_EXECUTION_ADAPTER_DISABLED",
    ])
    expect(preview.preflight_eligibility.required_prerequisites.map((entry) => entry.code)).toEqual([
      "explicit_future_feature_flag",
      "operator_approval",
      "persistence_repository_readiness",
      "idempotency_reservation_storage",
      "provider_execution_adapter_readiness",
      "shipment_audit_sink_readiness",
    ])
    expect(preview.preflight_eligibility.blocked_live_actions.map((entry) => entry.code)).toEqual([
      "provider_create_shipment_call",
      "provider_label_purchase",
      "fulfillment_metadata_write",
      "execution_record_insert",
      "idempotency_reservation_commit",
      "shipment_audit_log_commit",
      "checkout_cutover",
    ])
    expect(preview.execution_lifecycle_preview.phases.map((phase) => phase.code)).toEqual([
      "preflight_eligibility",
      "provider_dispatch",
      "shipment_result_normalization",
      "fulfillment_application",
      "failure_handling",
    ])
    expect(preview.execution_lifecycle_preview.phases.map((phase) => phase.status)).toEqual([
      "projected_for_future_execution",
      "projected_for_future_execution",
      "projected_for_future_execution",
      "projected_for_future_execution",
      "projected_for_future_execution",
    ])
    expect(preview.execution_lifecycle_preview.phases[0]?.block_reasons).toEqual([
      "EXECUTION_PREVIEW_ONLY",
      "FUTURE_EXECUTION_FLAG_INERT",
      "LIVE_EXECUTION_DISABLED",
      "PROVIDER_EXECUTION_ADAPTER_DISABLED",
    ])
    expect(preview.execution_lifecycle_preview.confirmations).toEqual({
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
    })
  })

  it("keeps execution identity stable for identical normalized execution input and changes on material plan drift", () => {
    const basePreview = buildDeliveryHubShipmentExecutionPlanPreview({
      fulfillment_data: buildValidFulfillmentData(),
      order: {
        id: "order_1",
        display_id: 42,
        currency_code: "RUB",
      },
      fulfillment: {
        id: "ful_1",
        location_id: "sloc_1",
      },
      items: [
        {
          line_item_id: "item_1",
          quantity: 2,
        },
      ],
    })
    const samePreview = buildDeliveryHubShipmentExecutionPlanPreview({
      fulfillment_data: buildValidFulfillmentData(),
      order: {
        id: "order_1",
        display_id: 42,
        currency_code: "RUB",
      },
      fulfillment: {
        id: "ful_1",
        location_id: "sloc_1",
      },
      items: [
        {
          line_item_id: "item_1",
          quantity: 2,
        },
      ],
    })
    const changedPreview = buildDeliveryHubShipmentExecutionPlanPreview({
      fulfillment_data: buildValidFulfillmentData(),
      order: {
        id: "order_1",
        display_id: 42,
        currency_code: "RUB",
      },
      fulfillment: {
        id: "ful_1",
        location_id: "sloc_1",
      },
      items: [
        {
          line_item_id: "item_1",
          quantity: 3,
        },
      ],
    })

    expect(basePreview.execution_identity).toEqual(samePreview.execution_identity)
    expect(basePreview.execution_identity?.plan_fingerprint).not.toBe(
      changedPreview.execution_identity?.plan_fingerprint
    )
    expect(basePreview.execution_identity?.execution_fingerprint).not.toBe(
      changedPreview.execution_identity?.execution_fingerprint
    )
    expect(basePreview.execution_identity?.idempotency_key_preview).not.toBe(
      changedPreview.execution_identity?.idempotency_key_preview
    )
    expect(basePreview.execution_identity).not.toHaveProperty("reservation_fingerprint")
    expect(changedPreview.persistence_audit_preview.idempotency_reservation.reservation_fingerprint).toEqual(
      expect.stringMatching(/^[a-f0-9]{64}$/)
    )
    expect(JSON.stringify(basePreview.execution_identity)).not.toContain(
      "delivery-hub-provider-credential"
    )
    expect(JSON.stringify(basePreview.execution_identity)).not.toContain('"quote"')
    expect(JSON.stringify(basePreview.execution_identity)).not.toContain('"pickup_point"')
    expect(JSON.stringify(basePreview.execution_identity)).not.toContain('"pickup_window"')
  })

  it("keeps execution plan preview blocked when required fragments are missing", () => {
    const preview = buildDeliveryHubShipmentExecutionPlanPreview({
      fulfillment_data: {
        ...buildValidFulfillmentData(),
        quote: {
          ...buildValidFulfillmentData().quote,
          currency_code: "",
        },
      },
      items: [
        {
          line_item_id: "item_1",
          quantity: 1,
        },
      ],
    })

    expect(preview.contract_status).toBe("blocked")
    expect(preview.readiness_verdict).toEqual({
      status: "blocked",
      blocked_reasons: ['Delivery Hub field "quote.currency_code" is required.'],
    })
    expect(preview.normalized.provider_execution_plan).toBeNull()
    expect(preview.execution_identity).toBeNull()
    expect(preview.outbound_payload_preview).toEqual({
      redacted: true,
      request: null,
    })
    expect(preview.persistence_audit_preview).toMatchObject({
      version: DELIVERY_HUB_EXECUTION_PERSISTENCE_AUDIT_PREVIEW_VERSION,
      redacted: true,
      status: "blocked",
      metadata_patch: {
        fields: [],
      },
      execution_record: {
        ready: false,
        execution_reference: null,
      },
      idempotency_reservation: {
        ready: false,
        matched_fields: [],
      },
      blocked: expect.arrayContaining([
        expect.objectContaining({ key: "execution_plan_prerequisite" }),
      ]),
      deferred: expect.arrayContaining([
        expect.objectContaining({ key: "terminal_status_resolution" }),
      ]),
    })
    expect(preview.repository_assembly_summary.persistence_readiness_contour).toEqual({
      stages: [
        "artifact_defined",
        "manual_application_external",
        "snapshot_verification_available",
        "activation_blocked",
      ],
      current_stage: "activation_blocked",
      review_preparation_available_now: [
        "descriptor_bundle_defined",
        "migration_artifact_reviewable",
        "snapshot_schema_verifier_available",
        "snapshot_schema_check_plan_available",
      ],
      external_manual_application_remaining: [
        "manual_migration_review",
        "manual_table_creation_or_migration_execution",
        "manual_schema_snapshot_capture",
      ],
      activation_blocked_until: [
        "migration_or_table_creation",
        "transaction_runner",
        "explicit_runtime_wiring",
        "operational_runbook",
        "safety_review",
      ],
    })
    expect(preview.preflight_eligibility).toMatchObject({
      current_mode: "preview_only",
      decision: "not_ready",
      real_execution_enabled: false,
      confirmations: {
        shipment_execution_disabled: true,
        provider_calls_disabled: true,
        persistence_writes_disabled: true,
        checkout_cutover_disabled: true,
      },
    })
    expect(preview.preflight_eligibility.reasons.map((reason) => reason.code)).toEqual([
      "EXECUTION_PREVIEW_ONLY",
      "FUTURE_EXECUTION_FLAG_INERT",
      "EXECUTION_PLAN_NOT_READY",
      "EXECUTION_IDENTITY_NOT_READY",
      "PERSISTENCE_AUDIT_NOT_READY",
    ])
    expect(preview.provider_dispatch_preview).toMatchObject({
      current_mode: "preview_only",
      dispatch_decision: "not_dispatched",
      command_identity: {
        provider_operation_reference: null,
        idempotency_key_preview: null,
        plan_fingerprint: null,
        execution_fingerprint: null,
      },
      confirmations: {
        adapter_invocation_disabled: true,
        provider_network_calls_disabled: true,
        shipment_creation_disabled: true,
        label_creation_disabled: true,
        order_mutation_disabled: true,
        persistence_writes_disabled: true,
        checkout_cutover_disabled: true,
      },
    })
    expect(preview.execution_lifecycle_preview).toMatchObject({
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
      phases: [
        {
          code: "preflight_eligibility",
          order: 1,
          status: "blocked_in_preview",
          readiness_posture: "blocked_in_preview",
          block_reasons: [
            "EXECUTION_PREVIEW_ONLY",
            "FUTURE_EXECUTION_FLAG_INERT",
            "EXECUTION_PLAN_NOT_READY",
            "EXECUTION_IDENTITY_NOT_READY",
            "PERSISTENCE_AUDIT_NOT_READY",
          ],
        },
        {
          code: "provider_dispatch",
          order: 2,
          status: "blocked_in_preview",
          readiness_posture: "blocked_in_preview",
        },
        {
          code: "shipment_result_normalization",
          order: 3,
          status: "blocked_in_preview",
          readiness_posture: "blocked_in_preview",
        },
        {
          code: "fulfillment_application",
          order: 4,
          status: "blocked_in_preview",
          readiness_posture: "blocked_in_preview",
        },
        {
          code: "failure_handling",
          order: 5,
          status: "blocked_in_preview",
          readiness_posture: "blocked_in_preview",
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
    })
    expect(preview.shipment_execution.materialized).toBe(false)
  })

  it("keeps execution lifecycle preview deterministic across identical inputs", () => {
    const first = buildDeliveryHubShipmentExecutionPlanPreview({
      fulfillment_data: buildValidFulfillmentData(),
      order: {
        id: "order_1",
        display_id: 42,
        currency_code: "RUB",
      },
      fulfillment: {
        id: "ful_1",
        location_id: "sloc_1",
      },
      items: [
        {
          line_item_id: "item_1",
          quantity: 2,
        },
      ],
    })
    const second = buildDeliveryHubShipmentExecutionPlanPreview({
      fulfillment_data: buildValidFulfillmentData(),
      order: {
        id: "order_1",
        display_id: 42,
        currency_code: "RUB",
      },
      fulfillment: {
        id: "ful_1",
        location_id: "sloc_1",
      },
      items: [
        {
          line_item_id: "item_1",
          quantity: 2,
        },
      ],
    })

    expect(first.execution_lifecycle_preview).toEqual(second.execution_lifecycle_preview)
  })

  it("exposes lifecycle preview seam from observability payload without orchestration activation", () => {
    const preview = buildDeliveryHubExecutionPlanObservabilityPreview({
      projected_modes: [
        {
          mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
          supporting_connection_ids: ["conn_ready_a"],
        },
      ],
    })
    const readyMode = preview.mode_previews[0]

    expect(preview.version).toBe(DELIVERY_HUB_EXECUTION_PLAN_OBSERVABILITY_PREVIEW_VERSION)
    expect(readyMode?.execution_lifecycle_preview).toMatchObject({
      current_mode: "preview_only",
      lifecycle_status: "projected_for_future_execution",
      readiness_posture: "ready_when_enabled",
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
    })
    expect(readyMode?.execution_lifecycle_preview.phases.map((phase) => phase.code)).toEqual([
      "preflight_eligibility",
      "provider_dispatch",
      "shipment_result_normalization",
      "fulfillment_application",
      "failure_handling",
    ])
    expect(readyMode?.shipment_execution).toEqual({
      materialized: false,
      reason: expect.any(String),
    })
  })

  it("keeps execution plan preview blocked on provider and nested shape drift", () => {
    const preview = buildDeliveryHubShipmentExecutionPlanPreview({
      option_data: {
        id: "foreign:pickup",
        provider_code: "foreign_provider",
        provider_id: "fp_foreign",
        mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
      },
      fulfillment_data: {
        provider_code: "foreign_provider",
        delivery: {
          version: 1,
          option: {
            id: "foreign:pickup",
          },
        },
      },
      items: [
        {
          line_item_id: "item_1",
          quantity: 1,
        },
      ],
    })

    expect(preview.contract_status).toBe("blocked")
    expect(preview.readiness_verdict.status).toBe("blocked")
    expect(preview.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "DELIVERY_HUB_PROVIDER_DRIFT",
          field_path: "option_data.provider_code",
        }),
        expect.objectContaining({
          code: "DELIVERY_HUB_SHAPE_DRIFT",
          field_path: "fulfillment_data",
        }),
      ])
    )
    expect(preview.normalized.provider_execution_plan).toBeNull()
  })

  it("rejects create-fulfillment bridge items without positive quantity", () => {
    expect(() =>
      buildDeliveryHubCreateFulfillmentBridgePayload({
        fulfillment_data: {
          version: 1,
          connection_id: "conn_ready",
          mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
          quote_reference: createDeliveryHubQuoteReference({
            connection_id: "conn_ready",
            quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
            quote_key: "quote_3",
          }),
          quote: {
            carrier_code: "yandex",
            carrier_label: "Yandex Delivery",
            amount: 299,
            currency_code: "RUB",
            customer_price: {
              amount: 250,
              currency_code: "RUB",
              source: "fixed" as const,
              policy_id: "policy_test_fixed",
            },
            delivery_eta_min: 1,
            delivery_eta_max: 1,
            pickup_point_required: true,
            pickup_window_required: false,
          },
          pickup_point: {
            provider_point_id: "pvz_2",
            provider_point_code: "code_2",
            name: "PVZ 2",
            address: "Arbat 10",
            city: "Moscow",
            region: "Moscow",
            postal_code: "119019",
            lat: 55.75,
            lng: 37.6,
            is_origin_dropoff_allowed: true,
            is_destination_pickup_allowed: true,
            payment_methods: ["card"],
          },
          pickup_window: null,
        },
        items: [
          {
            line_item_id: "item_1",
            quantity: 0,
          },
        ],
      })
    ).toThrow(
      "Delivery Hub fulfillment bridge item at index 0 must include a positive integer quantity."
    )
  })
})

function buildValidFulfillmentData() {
  return {
    version: 1,
    connection_id: "conn_ready",
    mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
    quote_reference: createDeliveryHubQuoteReference({
      connection_id: "conn_ready",
      quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
      quote_key: "quote_valid_diagnostic",
    }),
    quote: {
      carrier_code: "yandex",
      carrier_label: "Yandex Delivery",
      amount: 299,
      currency_code: "RUB",
      customer_price: {
        amount: 250,
        currency_code: "RUB",
        source: "fixed" as const,
        policy_id: "policy_test_fixed",
      },
      delivery_eta_min: 1,
      delivery_eta_max: 1,
      pickup_point_required: true,
      pickup_window_required: false,
    },
    pickup_point: {
      provider_point_id: "pvz_2",
      provider_point_code: "code_2",
      name: "PVZ 2",
      address: "Arbat 10",
      city: "Moscow",
      region: "Moscow",
      postal_code: "119019",
      lat: 55.75,
      lng: 37.6,
      is_origin_dropoff_allowed: true,
      is_destination_pickup_allowed: true,
      payment_methods: ["card"],
    },
    pickup_window: null,
  }
}
