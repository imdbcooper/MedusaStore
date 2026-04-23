import { afterAll, beforeEach, describe, expect, it, jest } from "@jest/globals"
import { MedusaError } from "@medusajs/framework/utils"
import { DeliveryHubFulfillmentProvider } from "../../modules/deliveryhub"
import { DELIVERY_HUB_MODE_CODE } from "../../modules/delivery-hub/constants"
import {
  createDeliveryHubProviderExecutionReference,
  createDeliveryHubQuoteReference,
} from "../../modules/delivery-hub/cart-selection"

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}

const originalEncryptionKey = process.env.DELIVERY_HUB_ENCRYPTION_KEY
const originalShipmentExecutionEnabled = process.env.DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED

beforeEach(() => {
  logger.info.mockClear()
  logger.warn.mockClear()
  logger.error.mockClear()
  logger.debug.mockClear()
  process.env.DELIVERY_HUB_ENCRYPTION_KEY = "test-delivery-hub-key"
  delete process.env.DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED
})

describe("Delivery Hub provider validation seam", () => {
  it("keeps validateFulfillmentData and createFulfillment aligned for valid input while returning a truthful controlled execution block", async () => {
    const provider = buildProvider()
    const optionData = buildValidOptionData()
    const fulfillmentData = buildValidFulfillmentData()

    await expect(provider.validateFulfillmentData(optionData, fulfillmentData)).resolves.toMatchObject({
      version: 1,
      connection_id: "conn_ready",
      mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
      quote: {
        carrier_code: "yandex",
        currency_code: "RUB",
        pickup_point_required: true,
      },
      pickup_point: {
        provider_point_id: "pvz_2",
        name: "PVZ 2",
      },
      pickup_window: null,
    })

    await expect(
      provider.createFulfillment(
        fulfillmentData,
        [
          {
            line_item_id: "item_1",
            quantity: 1,
          },
        ],
        {
          id: "order_1",
          display_id: 42,
          currency_code: "RUB",
        },
        {
          id: "ful_1",
          location_id: "sloc_1",
        }
      )
    ).resolves.toEqual({
      data: {
        provider_code: "deliveryhub",
        controlled_execution: expect.objectContaining({
          status: "blocked",
          result_decision: "blocked_before_preparation",
          blocking_stage: "handoff_preflight",
          blocked_reason_code: "delivery_hub_handoff_missing",
          anti_leak_confirmations: {
            credentials_included: false,
            raw_provider_payloads_included: false,
            raw_offer_ids_included: false,
          },
        }),
      },
      labels: [],
    })
    const executionPreviewLog = logger.info.mock.calls.find((call) =>
      String(call[0]).includes("execution-plan preview seam evaluated")
    )
    const controlledExecutionLog = logger.info.mock.calls.find((call) =>
      String(call[0]).includes("controlled execution seam evaluated")
    )

    await expect(executionPreviewLog).toBeDefined()
    await expect(controlledExecutionLog).toBeDefined()
    expect(String(executionPreviewLog?.[0])).toContain('"execution_status":"blocked"')
    expect(String(executionPreviewLog?.[0])).toContain('"readiness_status":"ready"')
    expect(String(executionPreviewLog?.[0])).toContain('"handoff_ready":false')
    expect(String(controlledExecutionLog?.[0])).toContain('"blocked_reason_code":"delivery_hub_handoff_missing"')
    expect(String(controlledExecutionLog?.[0])).toContain('"credentials_included":false')
    expect(String(controlledExecutionLog?.[0])).not.toContain("secret-token")
    expect(String(controlledExecutionLog?.[0])).not.toContain("raw-offer-id")
  })
 
  it("blocks missing required fulfillment fragment through the same validation verdict", async () => {
    const provider = buildProvider()
    const optionData = buildValidOptionData()
    const fulfillmentData = {
      ...buildValidFulfillmentData(),
      quote: {
        ...buildValidFulfillmentData().quote,
        currency_code: "",
      },
    }

    await expect(provider.validateFulfillmentData(optionData, fulfillmentData)).rejects.toThrow(
      'Delivery Hub fulfillment data is blocked: Delivery Hub field "quote.currency_code" is required.'
    )

    await expect(
      provider.createFulfillment(
        fulfillmentData,
        [
          {
            line_item_id: "item_1",
            quantity: 1,
          },
        ],
        {
          id: "order_1",
          display_id: 42,
          currency_code: "RUB",
        },
        {
          id: "ful_1",
          location_id: "sloc_1",
        }
      )
    ).rejects.toThrow(
      'Delivery Hub createFulfillment input is blocked: Delivery Hub field "quote.currency_code" is required.; Shipment execution remains intentionally unavailable; diagnostics validate payload assembly and block live shipment automation.'
    )
  })

  it("returns dispatch-prepared-but-blocked controlled execution when committed option and active Yandex connection are present", async () => {
    const provider = buildProvider({
      resolvedPgConnection: buildReadOnlyLookupPgConnection([
        {
          id: "conn_ready",
          provider_code: "yandex",
          name: "Yandex Live",
          status: "active",
          mode: "live",
          enabled: true,
          country_code: "RU",
          credentials_envelope: { ciphertext: "sealed" },
          credentials_state: "sealed",
          credentials_fingerprint: "fp_ready",
          credentials_last_validated_at: "2026-04-23T06:50:00.000Z",
          credentials_last_error_code: null,
          config: {},
          metadata: {},
          created_at: "2026-04-23T06:00:00.000Z",
          updated_at: "2026-04-23T06:50:00.000Z",
        },
      ]),
      carts: [
        {
          id: "cart_1",
          metadata: {
            delivery_hub: {
              selection: {
                version: 1,
                provider_code: "yandex",
                connection_id: "conn_ready",
                quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                quote_reference: createDeliveryHubQuoteReference({
                  connection_id: "conn_ready",
                  quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                  quote_key: "quote_provider_validation",
                  provider_origin_dispatch_context: {
                    mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                    origin_point_id: "origin_dropoff_1",
                  },
                }),
                backend_execution_reference: createDeliveryHubProviderExecutionReference({
                  connection_id: "conn_ready",
                  quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                  quote_key: "quote_provider_validation",
                  provider_origin_dispatch_context: {
                    mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                    origin_point_id: "origin_dropoff_1",
                  },
                }),
                quote: {
                  carrier_code: "yandex",
                  carrier_label: "Yandex Delivery",
                  amount: 299,
                  currency_code: "RUB",
                  delivery_eta_min: 1,
                  delivery_eta_max: 1,
                  pickup_point_required: true,
                  pickup_window_required: false,
                },
                pickup_point: {
                  provider_point_id: "pvz_1",
                  provider_point_code: null,
                  name: "PVZ 1",
                  address: "Tverskaya 1",
                  city: "Moscow",
                  region: null,
                  postal_code: null,
                  lat: null,
                  lng: null,
                  is_origin_dropoff_allowed: false,
                  is_destination_pickup_allowed: true,
                  payment_methods: [],
                },
                pickup_window: null,
                correlation_id: "corr_handoff_provider",
                updated_at: "2026-04-23T07:00:00.000Z",
              },
            },
          },
        },
      ],
    })
    const fulfillmentData = {
      ...buildValidFulfillmentData(),
      cart_id: "cart_1",
      shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
      shipping_option_type_id: "deliveryhub_deliveryhub",
      correlation_id: "corr_handoff_provider",
      updated_at: "2026-04-23T07:00:00.000Z",
      credentials: {
        token: "secret-token",
      },
      raw_response: {
        offer_id: "raw-offer-id",
      },
    }

    await expect(
      provider.createFulfillment(
        fulfillmentData,
        [
          {
            line_item_id: "item_1",
            quantity: 1,
          },
        ],
        {
          id: "order_1",
          display_id: 42,
          currency_code: "RUB",
        },
        {
          id: "ful_1",
          location_id: "sloc_1",
        }
      )
    ).resolves.toEqual({
      data: {
        provider_code: "deliveryhub",
        controlled_execution: expect.objectContaining({
          status: "dispatch_prepared",
          result_decision: "dispatch_prepared_but_blocked",
          blocking_stage: "provider_dispatch_contract",
          blocked_reason_code: "provider_dispatch_not_materialized",
          handoff: expect.objectContaining({
            available: true,
            connection_id: "conn_ready",
            quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
            correlation_id: "corr_handoff_provider",
          }),
          connection: expect.objectContaining({
            lookup_available: true,
            id: "conn_ready",
            provider_code: "yandex",
            mode: "live",
            status: "active",
            enabled: true,
            credentials_ready: true,
          }),
          dispatch_preparation: expect.objectContaining({
            provider_code: "yandex",
            operation: "create_shipment",
            mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
            mode_supported: true,
            provider_execution_reference_present: true,
            provider_origin_dispatch_context_present: true,
            shipment_execution_enabled: false,
            live_adapter_call_performed: false,
            persisted_execution_ledger_write_performed: false,
          }),
          provider_dispatch_port: expect.objectContaining({
            provider_code: "yandex",
            operation: "create_shipment",
            available: false,
            implemented: false,
            execution_gate_enabled: false,
            dispatch_attempted: false,
            dispatch_blocked: true,
            blocked_reason_code: "execution_gate_disabled",
            preview_materialization_available: true,
            preview_materialization_ready: true,
            preview_mode: "preview_only",
            supported_mode: true,
            mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
          }),
          provider_payload_materialization: expect.objectContaining({
            provider_code: "yandex",
            operation: "create_shipment",
            mode: "preview_only",
            status: "ready",
            attempted: true,
            ready: true,
            blocked_reason_code: null,
            blocked_reason: null,
            provider_execution_reference_present: true,
            provider_origin_dispatch_context_present: true,
            preview_summary: expect.objectContaining({
              source_type: "dropoff_point",
              destination_pickup_point_present: true,
              pickup_interval_present: false,
              recipient_contact_present: true,
              packages_present: true,
              package_count: 1,
              item_count: 1,
              connection_mode: "live",
              order_reference_present: true,
              masked_correlation_id_present: true,
            }),
            anti_leak_confirmations: {
              credentials_included: false,
              auth_headers_included: false,
              raw_execution_token_included: false,
              raw_provider_payload_included: false,
            },
          }),
          anti_leak_confirmations: {
            credentials_included: false,
            raw_provider_payloads_included: false,
            raw_offer_ids_included: false,
          },
        }),
      },
      labels: [],
    })

    const executionPreviewLog = [...logger.info.mock.calls]
      .reverse()
      .find((call) => String(call[0]).includes("execution-plan preview seam evaluated"))
    const controlledExecutionLog = [...logger.info.mock.calls]
      .reverse()
      .find((call) => String(call[0]).includes("controlled execution seam evaluated"))

    expect(String(executionPreviewLog?.[0])).toContain('"handoff_ready":true')
    expect(String(executionPreviewLog?.[0])).toContain('"handoff_contour":{"contract_status":"ready","execution_status":"blocked","handoff_target":"manual_external"')
    expect(String(executionPreviewLog?.[0])).toContain('"execution_ledger_evidence_status":"ready"')
    expect(String(executionPreviewLog?.[0])).toContain('"artifact_kind":"deliveryhub_execution_ledger_evidence"')
    expect(String(executionPreviewLog?.[0])).toContain('"ledger_persistence_enabled":false')
    expect(String(controlledExecutionLog?.[0])).toContain('"status":"dispatch_prepared"')
    expect(String(controlledExecutionLog?.[0])).toContain('"blocked_reason_code":"provider_dispatch_not_materialized"')
    expect(String(controlledExecutionLog?.[0])).toContain('"shipment_execution_enabled":false')
    expect(String(controlledExecutionLog?.[0])).toContain('"provider_dispatch_port"')
    expect(String(controlledExecutionLog?.[0])).toContain('"blocked_reason_code":"execution_gate_disabled"')
    expect(String(controlledExecutionLog?.[0])).toContain('"live_adapter_call_performed":false')
    expect(String(controlledExecutionLog?.[0])).toContain('"provider_payload_materialization"')
    expect(String(controlledExecutionLog?.[0])).toContain('"status":"ready"')
    expect(String(controlledExecutionLog?.[0])).toContain('"source_type":"dropoff_point"')
    expect(String(controlledExecutionLog?.[0])).toContain('"masked_correlation_id_present":true')
    expect(String(controlledExecutionLog?.[0])).not.toContain("secret-token")
    expect(String(controlledExecutionLog?.[0])).not.toContain("raw-offer-id")
  })

  it("keeps dispatch blocked behind the shipment execution gate even when the contour is otherwise ready", async () => {
    const provider = buildProvider({
      resolvedPgConnection: buildReadOnlyLookupPgConnection([buildConnectionRow()]),
      carts: [
        {
          id: "cart_1",
          metadata: {
            delivery_hub: {
              selection: {
                version: 1,
                provider_code: "yandex",
                connection_id: "conn_ready",
                quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                quote_reference: createDeliveryHubQuoteReference({
                  connection_id: "conn_ready",
                  quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                  quote_key: "quote_provider_validation",
                  provider_origin_dispatch_context: {
                    mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                    origin_point_id: "origin_dropoff_1",
                  },
                }),
                backend_execution_reference: createDeliveryHubProviderExecutionReference({
                  connection_id: "conn_ready",
                  quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                  quote_key: "quote_provider_validation",
                  provider_origin_dispatch_context: {
                    mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                    origin_point_id: "origin_dropoff_1",
                  },
                }),
                quote: {
                  carrier_code: "yandex",
                  carrier_label: "Yandex Delivery",
                  amount: 299,
                  currency_code: "RUB",
                  delivery_eta_min: 1,
                  delivery_eta_max: 1,
                  pickup_point_required: true,
                  pickup_window_required: false,
                },
                pickup_point: {
                  provider_point_id: "pvz_1",
                  provider_point_code: null,
                  name: "PVZ 1",
                  address: "Tverskaya 1",
                  city: "Moscow",
                  region: null,
                  postal_code: null,
                  lat: null,
                  lng: null,
                  is_origin_dropoff_allowed: false,
                  is_destination_pickup_allowed: true,
                  payment_methods: [],
                },
                pickup_window: null,
                correlation_id: "corr_gate_disabled",
                updated_at: "2026-04-23T07:00:00.000Z",
              },
            },
          },
        },
      ],
    })

    await expect(
      provider.createFulfillment(
        {
          ...buildValidFulfillmentData(),
          cart_id: "cart_1",
          shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
          shipping_option_type_id: "deliveryhub_deliveryhub",
          correlation_id: "corr_gate_disabled",
          updated_at: "2026-04-23T07:00:00.000Z",
        },
        [{ line_item_id: "item_1", quantity: 1 }],
        { id: "order_1", display_id: 42, currency_code: "RUB" },
        { id: "ful_1", location_id: "sloc_1" }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          controlled_execution: expect.objectContaining({
            status: "dispatch_prepared",
            blocked_reason_code: "provider_dispatch_not_materialized",
            blocked_reason: expect.stringContaining("DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED is not enabled"),
            dispatch_preparation: expect.objectContaining({
              provider_execution_reference_present: true,
              provider_origin_dispatch_context_present: true,
              shipment_execution_enabled: false,
              live_adapter_call_performed: false,
              persisted_execution_ledger_write_performed: false,
            }),
            provider_dispatch_port: expect.objectContaining({
              available: false,
              implemented: false,
              execution_gate_enabled: false,
              dispatch_attempted: false,
              blocked_reason_code: "execution_gate_disabled",
              preview_materialization_available: true,
              preview_materialization_ready: true,
              preview_mode: "preview_only",
            }),
            provider_payload_materialization: expect.objectContaining({
              status: "ready",
              attempted: true,
              ready: true,
              blocked_reason_code: null,
              blocked_reason: null,
              preview_summary: expect.objectContaining({
                source_type: "dropoff_point",
                destination_pickup_point_present: true,
                pickup_interval_present: false,
                recipient_contact_present: true,
                packages_present: true,
                package_count: 1,
                item_count: 1,
              }),
            }),
          }),
        }),
      })
    )
  })

  it("truthfully shifts the dropoff direct Yandex blocker after provider-origin context is available and the shipment execution gate is enabled", async () => {
    process.env.DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED = "true"

    const provider = buildProvider({
      resolvedPgConnection: buildReadOnlyLookupPgConnection([buildConnectionRow()]),
      carts: [
        {
          id: "cart_1",
          metadata: {
            delivery_hub: {
              selection: {
                version: 1,
                provider_code: "yandex",
                connection_id: "conn_ready",
                quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                quote_reference: createDeliveryHubQuoteReference({
                  connection_id: "conn_ready",
                  quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                  quote_key: "quote_provider_validation",
                  provider_origin_dispatch_context: {
                    mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                    origin_point_id: "origin_dropoff_1",
                  },
                }),
                backend_execution_reference: createDeliveryHubProviderExecutionReference({
                  connection_id: "conn_ready",
                  quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                  quote_key: "quote_provider_validation",
                  provider_origin_dispatch_context: {
                    mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                    origin_point_id: "origin_dropoff_1",
                  },
                }),
                quote: {
                  carrier_code: "yandex",
                  carrier_label: "Yandex Delivery",
                  amount: 299,
                  currency_code: "RUB",
                  delivery_eta_min: 1,
                  delivery_eta_max: 1,
                  pickup_point_required: true,
                  pickup_window_required: false,
                },
                pickup_point: {
                  provider_point_id: "pvz_1",
                  provider_point_code: null,
                  name: "PVZ 1",
                  address: "Tverskaya 1",
                  city: "Moscow",
                  region: null,
                  postal_code: null,
                  lat: null,
                  lng: null,
                  is_origin_dropoff_allowed: false,
                  is_destination_pickup_allowed: true,
                  payment_methods: [],
                },
                pickup_window: null,
                correlation_id: "corr_enabled_boundary",
                updated_at: "2026-04-23T07:00:00.000Z",
              },
            },
          },
        },
      ],
    })

    await expect(
      provider.createFulfillment(
        {
          ...buildValidFulfillmentData(),
          cart_id: "cart_1",
          shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
          shipping_option_type_id: "deliveryhub_deliveryhub",
          correlation_id: "corr_enabled_boundary",
          updated_at: "2026-04-23T07:00:00.000Z",
        },
        [{ line_item_id: "item_1", quantity: 1 }],
        { id: "order_1", display_id: 42, currency_code: "RUB" },
        { id: "ful_1", location_id: "sloc_1" }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          controlled_execution: expect.objectContaining({
            status: "dispatch_prepared",
            blocked_reason_code: "provider_dispatch_not_materialized",
            blocked_reason: expect.stringContaining("provider-origin dropoff context became available"),
            dispatch_preparation: expect.objectContaining({
              provider_execution_reference_present: true,
              provider_origin_dispatch_context_present: true,
              shipment_execution_enabled: true,
              live_adapter_call_performed: false,
              persisted_execution_ledger_write_performed: false,
            }),
            provider_dispatch_port: expect.objectContaining({
              available: true,
              implemented: false,
              execution_gate_enabled: true,
              dispatch_attempted: false,
              blocked_reason_code: "dispatch_port_not_implemented",
              preview_materialization_available: true,
              preview_materialization_ready: true,
              preview_mode: "preview_only",
            }),
            provider_payload_materialization: expect.objectContaining({
              status: "ready",
              attempted: true,
              ready: true,
              blocked_reason_code: null,
              blocked_reason: null,
              preview_summary: expect.objectContaining({
                source_type: "dropoff_point",
                destination_pickup_point_present: true,
                pickup_interval_present: false,
                recipient_contact_present: true,
                packages_present: true,
                package_count: 1,
                item_count: 1,
              }),
            }),
            anti_leak_confirmations: {
              credentials_included: false,
              raw_provider_payloads_included: false,
              raw_offer_ids_included: false,
            },
          }),
        }),
      })
    )

    const controlledExecutionLog = [...logger.info.mock.calls]
      .reverse()
      .find((call) => String(call[0]).includes("controlled execution seam evaluated"))

    expect(String(controlledExecutionLog?.[0])).toContain('"shipment_execution_enabled":true')
    expect(String(controlledExecutionLog?.[0])).toContain('"provider_origin_dispatch_context_present":true')
    expect(String(controlledExecutionLog?.[0])).toContain('"provider_dispatch_port"')
    expect(String(controlledExecutionLog?.[0])).toContain('"blocked_reason_code":"dispatch_port_not_implemented"')
    expect(String(controlledExecutionLog?.[0])).toContain('"provider_payload_materialization"')
    expect(String(controlledExecutionLog?.[0])).toContain('"source_type":"dropoff_point"')
    expect(String(controlledExecutionLog?.[0])).toContain('"masked_correlation_id_present":true')
    expect(String(controlledExecutionLog?.[0])).not.toContain("quote_provider_validation")
    expect(String(controlledExecutionLog?.[0])).not.toContain("origin_dropoff_1")
  })
 
  it("truthfully shifts the warehouse direct Yandex blocker after provider-origin context is available and the shipment execution gate is enabled", async () => {
    process.env.DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED = "true"

    const provider = buildProvider({
      resolvedPgConnection: buildReadOnlyLookupPgConnection([buildConnectionRow()]),
      carts: [
        {
          id: "cart_1",
          metadata: {
            delivery_hub: {
              selection: {
                version: 1,
                provider_code: "yandex",
                connection_id: "conn_ready",
                quote_type: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
                quote_reference: createDeliveryHubQuoteReference({
                  connection_id: "conn_ready",
                  quote_type: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
                  quote_key: "quote_provider_validation_wh",
                  provider_origin_dispatch_context: {
                    mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
                    provider_warehouse_id: "provider_wh_1",
                  },
                }),
                backend_execution_reference: createDeliveryHubProviderExecutionReference({
                  connection_id: "conn_ready",
                  quote_type: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
                  quote_key: "quote_provider_validation_wh",
                  provider_origin_dispatch_context: {
                    mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
                    provider_warehouse_id: "provider_wh_1",
                  },
                }),
                quote: {
                  carrier_code: "yandex",
                  carrier_label: "Yandex Delivery",
                  amount: 299,
                  currency_code: "RUB",
                  delivery_eta_min: 1,
                  delivery_eta_max: 1,
                  pickup_point_required: true,
                  pickup_window_required: false,
                },
                pickup_point: {
                  provider_point_id: "pvz_1",
                  provider_point_code: null,
                  name: "PVZ 1",
                  address: "Tverskaya 1",
                  city: "Moscow",
                  region: null,
                  postal_code: null,
                  lat: null,
                  lng: null,
                  is_origin_dropoff_allowed: false,
                  is_destination_pickup_allowed: true,
                  payment_methods: [],
                },
                pickup_window: null,
                correlation_id: "corr_enabled_boundary_wh",
                updated_at: "2026-04-23T07:00:00.000Z",
              },
            },
          },
        },
      ],
    })

    await expect(
      provider.createFulfillment(
        {
          ...buildValidFulfillmentData(),
          cart_id: "cart_1",
          connection_id: "conn_ready",
          mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
          quote_type: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
          shipping_option_id: "deliveryhub:warehouse_to_pickup_point",
          shipping_option_type_id: "deliveryhub_deliveryhub",
          correlation_id: "corr_enabled_boundary_wh",
          updated_at: "2026-04-23T07:00:00.000Z",
          quote_reference: createDeliveryHubQuoteReference({
            connection_id: "conn_ready",
            quote_type: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
            quote_key: "quote_provider_validation_wh",
            provider_origin_dispatch_context: {
              mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
              provider_warehouse_id: "provider_wh_1",
            },
          }),
        },
        [{ line_item_id: "item_1", quantity: 1 }],
        { id: "order_1", display_id: 42, currency_code: "RUB" },
        { id: "ful_1", location_id: "sloc_1" }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          controlled_execution: expect.objectContaining({
            status: "dispatch_prepared",
            blocked_reason_code: "provider_dispatch_not_materialized",
            blocked_reason: expect.stringContaining("provider-origin warehouse context became available"),
            dispatch_preparation: expect.objectContaining({
              mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
              provider_execution_reference_present: true,
              provider_origin_dispatch_context_present: true,
              shipment_execution_enabled: true,
              live_adapter_call_performed: false,
              persisted_execution_ledger_write_performed: false,
            }),
            provider_dispatch_port: expect.objectContaining({
              available: true,
              implemented: false,
              execution_gate_enabled: true,
              dispatch_attempted: false,
              blocked_reason_code: "dispatch_port_not_implemented",
              preview_materialization_available: true,
              preview_materialization_ready: false,
              preview_mode: "preview_only",
            }),
            provider_payload_materialization: expect.objectContaining({
              status: "blocked",
              attempted: true,
              ready: false,
              blocked_reason_code: "missing_pickup_interval_window",
              preview_summary: expect.objectContaining({
                source_type: null,
                destination_pickup_point_present: false,
                pickup_interval_present: false,
                recipient_contact_present: false,
                packages_present: false,
                package_count: 0,
                item_count: 0,
              }),
            }),
          }),
        }),
      })
    )

    const controlledExecutionLog = [...logger.info.mock.calls]
      .reverse()
      .find((call) => String(call[0]).includes("controlled execution seam evaluated"))

    expect(String(controlledExecutionLog?.[0])).toContain('"provider_dispatch_port"')
    expect(String(controlledExecutionLog?.[0])).toContain('"blocked_reason_code":"dispatch_port_not_implemented"')
    expect(String(controlledExecutionLog?.[0])).toContain('"provider_payload_materialization"')
    expect(String(controlledExecutionLog?.[0])).toContain('"blocked_reason_code":"missing_pickup_interval_window"')
    expect(String(controlledExecutionLog?.[0])).not.toContain("quote_provider_validation_wh")
    expect(String(controlledExecutionLog?.[0])).not.toContain("provider_wh_1")
  })
 
  it("does not falsely shift the direct Yandex blocker for mismatched provider-origin context", async () => {
    process.env.DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED = "true"

    const provider = buildProvider({
      resolvedPgConnection: buildReadOnlyLookupPgConnection([buildConnectionRow()]),
      carts: [
        {
          id: "cart_1",
          metadata: {
            delivery_hub: {
              selection: {
                version: 1,
                provider_code: "yandex",
                connection_id: "conn_ready",
                quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                quote_reference: createDeliveryHubQuoteReference({
                  connection_id: "conn_ready",
                  quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                  quote_key: "quote_mismatch_context",
                  provider_origin_dispatch_context: {
                    mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
                    provider_warehouse_id: "provider_wh_wrong",
                  },
                }),
                backend_execution_reference: createDeliveryHubProviderExecutionReference({
                  connection_id: "conn_ready",
                  quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                  quote_key: "quote_mismatch_context",
                  provider_origin_dispatch_context: {
                    mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
                    provider_warehouse_id: "provider_wh_wrong",
                  },
                }),
                quote: {
                  carrier_code: "yandex",
                  carrier_label: "Yandex Delivery",
                  amount: 299,
                  currency_code: "RUB",
                  delivery_eta_min: 1,
                  delivery_eta_max: 1,
                  pickup_point_required: true,
                  pickup_window_required: false,
                },
                pickup_point: {
                  provider_point_id: "pvz_1",
                  provider_point_code: null,
                  name: "PVZ 1",
                  address: "Tverskaya 1",
                  city: "Moscow",
                  region: null,
                  postal_code: null,
                  lat: null,
                  lng: null,
                  is_origin_dropoff_allowed: false,
                  is_destination_pickup_allowed: true,
                  payment_methods: [],
                },
                pickup_window: null,
                correlation_id: "corr_mismatch_context",
                updated_at: "2026-04-23T07:00:00.000Z",
              },
            },
          },
        },
      ],
    })

    await expect(
      provider.createFulfillment(
        {
          ...buildValidFulfillmentData(),
          cart_id: "cart_1",
          shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
          shipping_option_type_id: "deliveryhub_deliveryhub",
          correlation_id: "corr_mismatch_context",
          updated_at: "2026-04-23T07:00:00.000Z",
        },
        [{ line_item_id: "item_1", quantity: 1 }],
        { id: "order_1", display_id: 42, currency_code: "RUB" },
        { id: "ful_1", location_id: "sloc_1" }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          controlled_execution: expect.objectContaining({
            status: "dispatch_prepared",
            blocked_reason_code: "provider_dispatch_not_materialized",
            blocked_reason: expect.stringContaining("does not persist the provider-origin dropoff point reference"),
            dispatch_preparation: expect.objectContaining({
              provider_execution_reference_present: true,
              provider_origin_dispatch_context_present: false,
              shipment_execution_enabled: true,
              live_adapter_call_performed: false,
              persisted_execution_ledger_write_performed: false,
            }),
            provider_dispatch_port: expect.objectContaining({
              available: true,
              implemented: false,
              execution_gate_enabled: true,
              dispatch_attempted: false,
              blocked_reason_code: "dispatch_port_not_implemented",
              preview_materialization_available: true,
              preview_materialization_ready: false,
              preview_mode: "preview_only",
            }),
            provider_payload_materialization: expect.objectContaining({
              status: "blocked",
              attempted: true,
              ready: false,
              blocked_reason_code: "missing_provider_origin_dispatch_context",
              blocked_reason: "Yandex create_shipment payload preview requires backend-only provider origin dispatch context.",
              preview_summary: expect.objectContaining({
                source_type: null,
                destination_pickup_point_present: false,
                pickup_interval_present: false,
                recipient_contact_present: false,
                packages_present: false,
                package_count: 0,
                item_count: 0,
                order_reference_present: false,
                masked_correlation_id_present: false,
              }),
            }),
          }),
        }),
      })
    )

    const controlledExecutionLog = [...logger.info.mock.calls]
      .reverse()
      .find((call) => String(call[0]).includes("controlled execution seam evaluated"))

    expect(String(controlledExecutionLog?.[0])).toContain('"provider_origin_dispatch_context_present":false')
    expect(String(controlledExecutionLog?.[0])).toContain('"provider_dispatch_port"')
    expect(String(controlledExecutionLog?.[0])).toContain('"blocked_reason_code":"dispatch_port_not_implemented"')
    expect(String(controlledExecutionLog?.[0])).toContain('"provider_payload_materialization"')
    expect(String(controlledExecutionLog?.[0])).toContain('"blocked_reason_code":"missing_provider_origin_dispatch_context"')
    expect(String(controlledExecutionLog?.[0])).not.toContain("provider_wh_wrong")
    expect(String(controlledExecutionLog?.[0])).not.toContain("quote_mismatch_context")
  })

  it("keeps the old blocker when backend execution reference cannot materialize without encryption key", async () => {
    delete process.env.DELIVERY_HUB_ENCRYPTION_KEY

    const provider = buildProvider({
      resolvedPgConnection: buildReadOnlyLookupPgConnection([buildConnectionRow()]),
      carts: [
        {
          id: "cart_1",
          metadata: {
            delivery_hub: {
              selection: {
                version: 1,
                provider_code: "yandex",
                connection_id: "conn_ready",
                quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                quote_reference: createDeliveryHubQuoteReference({
                  connection_id: "conn_ready",
                  quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                  quote_key: "quote_provider_validation",
                }),
                quote: {
                  carrier_code: "yandex",
                  carrier_label: "Yandex Delivery",
                  amount: 299,
                  currency_code: "RUB",
                  delivery_eta_min: 1,
                  delivery_eta_max: 1,
                  pickup_point_required: true,
                  pickup_window_required: false,
                },
                pickup_point: {
                  provider_point_id: "pvz_1",
                  provider_point_code: null,
                  name: "PVZ 1",
                  address: "Tverskaya 1",
                  city: "Moscow",
                  region: null,
                  postal_code: null,
                  lat: null,
                  lng: null,
                  is_origin_dropoff_allowed: false,
                  is_destination_pickup_allowed: true,
                  payment_methods: [],
                },
                pickup_window: null,
                correlation_id: "corr_handoff_provider",
                updated_at: "2026-04-23T07:00:00.000Z",
              },
            },
          },
        },
      ],
    })

    await expect(
      provider.createFulfillment(
        {
          ...buildValidFulfillmentData(),
          cart_id: "cart_1",
          shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
          shipping_option_type_id: "deliveryhub_deliveryhub",
          correlation_id: "corr_handoff_provider",
          updated_at: "2026-04-23T07:00:00.000Z",
        },
        [{ line_item_id: "item_1", quantity: 1 }],
        { id: "order_1", display_id: 42, currency_code: "RUB" },
        { id: "ful_1", location_id: "sloc_1" }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          controlled_execution: expect.objectContaining({
            status: "dispatch_prepared",
            blocked_reason_code: "provider_execution_reference_unavailable",
            dispatch_preparation: expect.objectContaining({
              provider_execution_reference_present: false,
            }),
          }),
        }),
      })
    )
  })

  it("keeps the old blocker when persisted backend execution reference token is stale or mismatched", async () => {
    const provider = buildProvider({
      resolvedPgConnection: buildReadOnlyLookupPgConnection([buildConnectionRow()]),
      carts: [
        {
          id: "cart_1",
          metadata: {
            delivery_hub: {
              selection: {
                version: 1,
                provider_code: "yandex",
                connection_id: "conn_ready",
                quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                quote_reference: createDeliveryHubQuoteReference({
                  connection_id: "conn_ready",
                  quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                  quote_key: "quote_provider_validation",
                }),
                backend_execution_reference: createDeliveryHubProviderExecutionReference({
                  connection_id: "conn_other",
                  quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                  quote_key: "quote_provider_validation",
                }),
                quote: {
                  carrier_code: "yandex",
                  carrier_label: "Yandex Delivery",
                  amount: 299,
                  currency_code: "RUB",
                  delivery_eta_min: 1,
                  delivery_eta_max: 1,
                  pickup_point_required: true,
                  pickup_window_required: false,
                },
                pickup_point: {
                  provider_point_id: "pvz_1",
                  provider_point_code: null,
                  name: "PVZ 1",
                  address: "Tverskaya 1",
                  city: "Moscow",
                  region: null,
                  postal_code: null,
                  lat: null,
                  lng: null,
                  is_origin_dropoff_allowed: false,
                  is_destination_pickup_allowed: true,
                  payment_methods: [],
                },
                pickup_window: null,
                correlation_id: "corr_handoff_provider",
                updated_at: "2026-04-23T07:00:00.000Z",
              },
            },
          },
        },
      ],
    })

    await expect(
      provider.createFulfillment(
        {
          ...buildValidFulfillmentData(),
          cart_id: "cart_1",
          shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
          shipping_option_type_id: "deliveryhub_deliveryhub",
          correlation_id: "corr_handoff_provider",
          updated_at: "2026-04-23T07:00:00.000Z",
        },
        [{ line_item_id: "item_1", quantity: 1 }],
        { id: "order_1", display_id: 42, currency_code: "RUB" },
        { id: "ful_1", location_id: "sloc_1" }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          controlled_execution: expect.objectContaining({
            status: "dispatch_prepared",
            blocked_reason_code: "provider_execution_reference_unavailable",
            dispatch_preparation: expect.objectContaining({
              provider_execution_reference_present: false,
            }),
          }),
        }),
      })
    )
  })

  it("blocks controlled execution when Delivery Hub connection lookup seam is unavailable", async () => {
    const provider = buildProvider()
    const fulfillmentData = {
      ...buildValidFulfillmentData(),
      cart_id: "cart_1",
      shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
      shipping_option_type_id: "deliveryhub_deliveryhub",
      correlation_id: "corr_lookup_missing",
      updated_at: "2026-04-23T07:00:00.000Z",
    }

    await expect(
      provider.createFulfillment(
        fulfillmentData,
        [{ line_item_id: "item_1", quantity: 1 }],
        { id: "order_1", display_id: 42, currency_code: "RUB" },
        { id: "ful_1", location_id: "sloc_1" }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          controlled_execution: expect.objectContaining({
            status: "blocked",
            blocking_stage: "connection_readiness",
            blocked_reason_code: "delivery_connection_lookup_unavailable",
          }),
        }),
      })
    )
  })

  it("gracefully degrades to blocked result when read-only connection lookup throws at order time", async () => {
    const provider = buildProvider({
      resolvedPgConnection: {
        raw: async () => {
          throw new Error("lookup query failed")
        },
      },
    })
    const fulfillmentData = {
      ...buildValidFulfillmentData(),
      cart_id: "cart_1",
      shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
      shipping_option_type_id: "deliveryhub_deliveryhub",
      correlation_id: "corr_lookup_throw",
      updated_at: "2026-04-23T07:00:00.000Z",
    }

    await expect(
      provider.createFulfillment(
        fulfillmentData,
        [{ line_item_id: "item_1", quantity: 1 }],
        { id: "order_1", display_id: 42, currency_code: "RUB" },
        { id: "ful_1", location_id: "sloc_1" }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          controlled_execution: expect.objectContaining({
            status: "blocked",
            result_decision: "blocked_before_preparation",
            blocking_stage: "connection_readiness",
            blocked_reason_code: "delivery_connection_lookup_unavailable",
            handoff: expect.objectContaining({
              available: true,
              connection_id: "conn_ready",
            }),
            connection: expect.objectContaining({
              lookup_available: false,
              id: null,
            }),
          }),
        }),
      })
    )
  })

  it("blocks controlled execution when committed Delivery Hub connection is missing or not ready", async () => {
    const baseFulfillmentData = {
      ...buildValidFulfillmentData(),
      cart_id: "cart_1",
      shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
      shipping_option_type_id: "deliveryhub_deliveryhub",
      correlation_id: "corr_conn_state",
      updated_at: "2026-04-23T07:00:00.000Z",
    }

    const scenarios = [
      {
        name: "missing",
        rows: [],
        blocked_reason_code: "delivery_connection_missing",
      },
      {
        name: "disabled",
        rows: [buildConnectionRow({ enabled: false })],
        blocked_reason_code: "delivery_connection_disabled",
      },
      {
        name: "not_active",
        rows: [buildConnectionRow({ status: "draft" })],
        blocked_reason_code: "delivery_connection_not_active",
      },
      {
        name: "credentials_not_ready",
        rows: [buildConnectionRow({ credentials_state: "invalid" })],
        blocked_reason_code: "delivery_connection_credentials_not_ready",
      },
      {
        name: "provider_not_supported",
        rows: [buildConnectionRow({ provider_code: "cdek" })],
        blocked_reason_code: "delivery_connection_provider_not_supported",
      },
    ] as const

    for (const scenario of scenarios) {
      const provider = buildProvider({
        resolvedPgConnection: buildReadOnlyLookupPgConnection(scenario.rows),
      })

      await expect(
        provider.createFulfillment(
          baseFulfillmentData,
          [{ line_item_id: "item_1", quantity: 1 }],
          { id: "order_1", display_id: 42, currency_code: "RUB" },
          { id: "ful_1", location_id: "sloc_1" }
        )
      ).resolves.toEqual(
        expect.objectContaining({
          data: expect.objectContaining({
            controlled_execution: expect.objectContaining({
              status: "blocked",
              blocking_stage: "connection_readiness",
              blocked_reason_code: scenario.blocked_reason_code,
            }),
          }),
        })
      )
    }
  })

  it("blocks provider and shape drift through the same normalized diagnostic seam", async () => {
    const provider = buildProvider()
    const optionData = {
      id: "foreign:pickup",
      provider_code: "foreign_provider",
      provider_id: "fp_foreign",
      mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
    }
    const fulfillmentData = {
      provider_code: "foreign_provider",
      delivery: {
        version: 1,
        option: {
          id: "foreign:pickup",
        },
      },
    }

    await expect(provider.validateFulfillmentData(optionData, fulfillmentData)).rejects.toMatchObject({
      type: MedusaError.Types.INVALID_DATA,
      message: expect.stringContaining("Delivery Hub fulfillment data is blocked:"),
    })

    await expect(
      provider.createFulfillment(
        fulfillmentData,
        [
          {
            line_item_id: "item_1",
            quantity: 1,
          },
        ],
        {
          id: "order_1",
          display_id: 42,
          currency_code: "RUB",
        },
        {
          id: "ful_1",
          location_id: "sloc_1",
        }
      )
    ).rejects.toMatchObject({
      type: MedusaError.Types.INVALID_DATA,
      message: expect.stringContaining("Delivery Hub createFulfillment input is blocked:"),
    })

    await expect(provider.validateFulfillmentData(optionData, fulfillmentData)).rejects.toMatchObject({
      type: MedusaError.Types.INVALID_DATA,
      message: expect.stringContaining('Delivery Hub option_data.provider_code expected "deliveryhub" but received "foreign_provider".'),
    })
  })
})

afterAll(() => {
  if (typeof originalEncryptionKey === "string") {
    process.env.DELIVERY_HUB_ENCRYPTION_KEY = originalEncryptionKey
  } else {
    delete process.env.DELIVERY_HUB_ENCRYPTION_KEY
  }

  if (typeof originalShipmentExecutionEnabled === "string") {
    process.env.DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED = originalShipmentExecutionEnabled
  } else {
    delete process.env.DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED
  }
})

function buildProvider(input?: {
  resolvedPgConnection?: { raw: (...args: unknown[]) => Promise<unknown> }
  carts?: Array<{ id: string; metadata?: unknown }>
}) {
  return new DeliveryHubFulfillmentProvider({
    logger: logger as never,
    resolve: jest.fn((key: string | symbol) => {
      if (String(key) === "query") {
        return {
          graph: async ({ entity, filters }: { entity: string; filters?: Record<string, unknown> }) => {
            if (entity !== "cart") {
              return { data: [] }
            }

            const cartId = typeof filters?.id === "string" ? filters.id : null

            return {
              data: (input?.carts ?? []).filter((cart) => !cartId || cart.id === cartId),
            }
          },
        }
      }

      if (input?.resolvedPgConnection) {
        return input.resolvedPgConnection
      }

      throw new Error(`pg connection unavailable for ${String(key)}`)
    }),
  })
}
function buildReadOnlyLookupPgConnection(rows: readonly unknown[]) {
  return {
    raw: async (query: unknown) => {
      const sql = typeof query === "string" ? query : String(query ?? "")

      if (sql.includes("select to_regclass")) {
        return {
          rows: [{ table_name: "delivery_hub_connections" }],
        }
      }

      return { rows }
    },
  }
}

function buildConnectionRow(
  overrides?: Partial<{
    provider_code: string
    status: string
    mode: string
    enabled: boolean
    credentials_state: string
  }>
) {
  return {
    id: "conn_ready",
    provider_code: overrides?.provider_code ?? "yandex",
    name: "Yandex Ready",
    status: overrides?.status ?? "active",
    mode: overrides?.mode ?? "live",
    enabled: overrides?.enabled ?? true,
    country_code: "RU",
    credentials_envelope: { ciphertext: "sealed" },
    credentials_state: overrides?.credentials_state ?? "sealed",
    credentials_fingerprint: "fp_ready",
    credentials_last_validated_at: "2026-04-23T06:50:00.000Z",
    credentials_last_error_code: null,
    config: {},
    metadata: {},
    created_at: "2026-04-23T06:00:00.000Z",
    updated_at: "2026-04-23T06:50:00.000Z",
  }
}

function buildValidOptionData() {
  return {
    id: "deliveryhub:dropoff_point_to_pickup_point",
    provider_code: "deliveryhub",
    provider_id: "deliveryhub_deliveryhub",
    mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
  }
}

function buildValidFulfillmentData() {
  return {
    version: 1,
    connection_id: "conn_ready",
    mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
    quote_reference: createDeliveryHubQuoteReference({
      connection_id: "conn_ready",
      quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
      quote_key: "quote_provider_validation",
    }),
    quote: {
      carrier_code: "yandex",
      carrier_label: "Yandex Delivery",
      amount: 299,
      currency_code: "RUB",
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
    shipping_address: {
      first_name: "Ivan",
      last_name: "Petrov",
      phone: "+79990000010",
      address_1: "Arbat 10",
      city: "Moscow",
      province: "Moscow",
      postal_code: "119019",
      country_code: "RU",
    },
    email: "ivan@example.com",
  }
}
