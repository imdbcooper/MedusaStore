import { afterAll, beforeEach, describe, expect, it, jest } from "@jest/globals"
import { MedusaError } from "@medusajs/framework/utils"
import { DeliveryHubFulfillmentProvider } from "../../modules/deliveryhub"
import { YandexDeliveryClient } from "../../modules/delivery-hub/adapters/yandex/client"
import { DELIVERY_HUB_MODE_CODE } from "../../modules/delivery-hub/constants"
import { DELIVERY_HUB_EXECUTION_STATE } from "../../modules/delivery-hub/shipment-execution-contract"
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
  jest.restoreAllMocks()
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
    ).resolves.toEqual(expect.objectContaining({
      data: expect.objectContaining({
        provider_code: "deliveryhub",
        accepted_shipment_lifecycle: expect.objectContaining({
          classification: "blocked_before_acceptance",
          accepted: false,
          shipment: null,
        }),
        accepted_shipment_status_refresh: expect.objectContaining({
          status: "blocked",
          provider_call_attempted: false,
          blocked_reason_code: "accepted_lifecycle_required",
        }),
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
        shipment_persistence: null,
      }),
      labels: [],
    }))
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
    ).resolves.toEqual(expect.objectContaining({
      data: expect.objectContaining({
        provider_code: "deliveryhub",
        accepted_shipment_lifecycle: expect.objectContaining({
          classification: "blocked_before_acceptance",
          accepted: false,
          shipment: null,
        }),
        accepted_shipment_status_refresh: expect.objectContaining({
          status: "blocked",
          provider_call_attempted: false,
          blocked_reason_code: "accepted_lifecycle_required",
        }),
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
            implemented: true,
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
        shipment_persistence: null,
      }),
      labels: [],
    }))

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

  it("keeps dispatch blocked behind the shipment execution gate even when the contour is otherwise ready without calling Yandex", async () => {
    const postSpy = jest.spyOn(YandexDeliveryClient.prototype, "post")

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
              implemented: true,
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

    expect(postSpy).not.toHaveBeenCalled()
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
            status: "dispatch_attempted",
            blocked_reason_code: null,
            blocked_reason: null,
            result_decision: "dispatch_attempted_no_persistence",
            contour: expect.objectContaining({
              ledger_persistence_performed: true,
            }),
            dispatch_preparation: expect.objectContaining({
              provider_execution_reference_present: true,
              provider_origin_dispatch_context_present: true,
              shipment_execution_enabled: true,
              live_adapter_call_performed: true,
              persisted_execution_ledger_write_performed: true,
            }),
            provider_dispatch_port: expect.objectContaining({
              available: true,
              implemented: true,
              execution_gate_enabled: true,
              dispatch_attempted: true,
              dispatch_blocked: false,
              blocked_reason_code: null,
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
            provider_dispatch_result: expect.objectContaining({
              attempted: true,
              redacted: true,
              credentials_included: false,
              auth_headers_included: false,
              raw_provider_request_included: false,
              raw_provider_response_included: false,
              raw_execution_token_included: false,
              raw_quote_key_included: false,
            }),
            dispatch_result: expect.objectContaining({
              attempted: true,
              performed: true,
              redacted: true,
              outcome: "failed",
              persistence_performed: false,
              execution_ledger_persistence_performed: true,
              order_mutation_performed: false,
              fulfillment_mutation_performed: false,
              safe_message: expect.stringContaining("shipment persistence and order or fulfillment mutation were not performed"),
            }),
            anti_leak_confirmations: {
              credentials_included: false,
              raw_provider_payloads_included: false,
              raw_offer_ids_included: false,
            },
          }),
          shipment_persistence: null,
        }),
      })
    )

    const controlledExecutionLog = [...logger.info.mock.calls]
      .reverse()
      .find((call) => String(call[0]).includes("controlled execution seam evaluated"))

    expect(String(controlledExecutionLog?.[0])).toContain('"shipment_execution_enabled":true')
    expect(String(controlledExecutionLog?.[0])).toContain('"provider_origin_dispatch_context_present":true')
    expect(String(controlledExecutionLog?.[0])).toContain('"provider_dispatch_port"')
    expect(String(controlledExecutionLog?.[0])).toContain('"dispatch_attempted":true')
    expect(String(controlledExecutionLog?.[0])).toContain('"provider_payload_materialization"')
    expect(String(controlledExecutionLog?.[0])).toContain('"provider_dispatch_result"')
    expect(String(controlledExecutionLog?.[0])).toContain('"dispatch_result"')
    expect(String(controlledExecutionLog?.[0])).toContain('"source_type":"dropoff_point"')
    expect(String(controlledExecutionLog?.[0])).toContain('"masked_correlation_id_present":true')
    expect(String(controlledExecutionLog?.[0])).not.toContain("quote_provider_validation")
    expect(String(controlledExecutionLog?.[0])).not.toContain("origin_dropoff_1")
  })

  it("executes one mocked direct Yandex dispatch call for a ready dropoff contour and keeps the result redacted", async () => {
    process.env.DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED = "true"

    const postSpy = jest.spyOn(YandexDeliveryClient.prototype, "post").mockResolvedValue({
      shipment_id: "shipment_dropoff_123456",
      request_id: "provider_dropoff_corr_987654",
      labels: [{ url: "https://example.test/dropoff-label.pdf" }],
      documents: [{ url: "https://example.test/dropoff-act.pdf" }],
      quote_key: "dropoff_quote_key_should_not_leak",
      token: "dropoff_execution_token_should_not_leak",
    })

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

    const result = await provider.createFulfillment(
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
    const controlledExecution = result.data.controlled_execution as {
      execution_identity: {
        provider_operation_reference: string | null
        idempotency_key_preview: string | null
        execution_fingerprint: string | null
      }
    }
    const rawExecutionReference = controlledExecution.execution_identity.provider_operation_reference
    const rawIdempotencyKey = controlledExecution.execution_identity.idempotency_key_preview
    const rawExecutionFingerprint = controlledExecution.execution_identity.execution_fingerprint

    expect(rawExecutionReference).toEqual(expect.stringMatching(/^dhprev_[a-f0-9]{16}$/))
    expect(rawIdempotencyKey).toEqual(
      expect.stringMatching(/^deliveryhub:preview:create_shipment:[a-f0-9]{64}$/)
    )
    expect(rawExecutionFingerprint).toEqual(expect.stringMatching(/^[a-f0-9]{64}$/))
    expect(rawIdempotencyKey).toContain(String(rawExecutionFingerprint))

    expect(postSpy).toHaveBeenCalledTimes(1)
    expect(postSpy.mock.calls[0]).toEqual([
      "/shipments/create",
      expect.objectContaining({
        source: expect.objectContaining({ pickup_point_id: "origin_dropoff_1" }),
        destination: expect.objectContaining({ pickup_point_id: "pvz_2" }),
      }),
      "corr_enabled_boundary",
    ])
    expect(result).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          controlled_execution: expect.objectContaining({
            status: "dispatch_attempted",
            provider_dispatch_result: expect.objectContaining({
              attempted: true,
              accepted: true,
              succeeded: true,
              status_category: "accepted",
              redacted: true,
              raw_provider_response_included: false,
              raw_execution_token_included: false,
              raw_quote_key_included: false,
            }),
            dispatch_result: expect.objectContaining({
              attempted: true,
              performed: true,
              outcome: "accepted",
              persistence_performed: true,
              execution_ledger_persistence_performed: true,
              order_mutation_performed: false,
              fulfillment_mutation_performed: false,
            }),
          }),
          shipment_persistence: expect.objectContaining({
            execution_reference: expect.any(String),
            outcome: "accepted",
            status: "dispatch_accepted",
            accepted: true,
            succeeded: true,
            provider_shipment_reference_present: true,
            provider_correlation_reference_present: true,
            label_document_present: true,
            attachment_document_present: true,
          }),
        }),
      })
    )
    expect(result.data.accepted_shipment_lifecycle).toEqual(
      expect.objectContaining({
        classification: "accepted_shipment",
        accepted: true,
        safe: true,
        shipment: expect.objectContaining({
          id: expect.any(String),
          execution_reference_preview: expect.any(String),
          provider_code: "deliveryhub",
          connection_id: "conn_ready",
          mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
          outcome: "accepted",
          status: "dispatch_accepted",
          accepted: true,
          succeeded: true,
          provider_shipment_reference_present: true,
          provider_correlation_reference_present: true,
          label_document_present: true,
          attachment_document_present: true,
        }),
        provider: expect.objectContaining({
          provider_code: "deliveryhub",
          mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
          dispatch_status: "dispatch_accepted",
          dispatch_outcome: "accepted",
          provider_shipment_reference_present: true,
        }),
        dispatch: expect.objectContaining({
          attempted: true,
          accepted: true,
          succeeded: true,
          outcome: "accepted",
          blocked_reason_code: null,
        }),
        ledger: expect.objectContaining({
          linked: true,
          state: DELIVERY_HUB_EXECUTION_STATE.completed,
          terminal_completed: true,
          terminal_blocked: false,
          execution_reference_preview: expect.any(String),
          idempotency_key_preview: expect.any(String),
        }),
        context: expect.objectContaining({
          connection_id: "conn_ready",
          order_id: "order_1",
          fulfillment_id: "ful_1",
          cart_id: "cart_1",
          shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
          location_id: "sloc_1",
          correlation_id_present: true,
        }),
        anti_leak_confirmations: {
          raw_provider_payloads_included: false,
          auth_headers_included: false,
          credentials_included: false,
          raw_yandex_response_body_included: false,
          quote_key_included: false,
        },
      })
    )

    const lifecycle = result.data.accepted_shipment_lifecycle as {
      shipment: { execution_reference_preview: string } | null
      ledger: {
        execution_reference_preview: string | null
        idempotency_key_preview: string | null
      }
    }
    const lifecycleJson = JSON.stringify(lifecycle)
    const strictMaskPattern = /^(.{2}\*\*\*.{2}|\*\*\*)$/
    const shipmentExecutionPreview = lifecycle.shipment?.execution_reference_preview
    const ledgerExecutionPreview = lifecycle.ledger.execution_reference_preview
    const ledgerIdempotencyPreview = lifecycle.ledger.idempotency_key_preview

    expect(shipmentExecutionPreview).toEqual(expect.stringMatching(strictMaskPattern))
    expect(ledgerExecutionPreview).toEqual(expect.stringMatching(strictMaskPattern))
    expect(ledgerIdempotencyPreview).toEqual(expect.stringMatching(strictMaskPattern))
    expect(shipmentExecutionPreview).not.toBe(rawExecutionReference)
    expect(ledgerExecutionPreview).not.toBe(rawExecutionReference)
    expect(ledgerIdempotencyPreview).not.toBe(rawIdempotencyKey)
    expect(lifecycleJson).not.toContain("dhprev_")
    expect(lifecycleJson).not.toContain("deliveryhub:preview:")
    expect(lifecycleJson).not.toContain("dropoff_quote_key_should_not_leak")
    expect(lifecycleJson).not.toContain("dropoff_execution_token_should_not_leak")
    expect(lifecycleJson).not.toContain("shipment_dropoff_123456")
    expect(lifecycleJson).not.toContain("provider_dropoff_corr_987654")
    expect(lifecycleJson).not.toContain("corr_enabled_boundary")
    expect(lifecycleJson).not.toContain(String(rawExecutionReference))
    expect(lifecycleJson).not.toContain(String(rawIdempotencyKey))
    expect(lifecycleJson).not.toContain(String(rawExecutionFingerprint))

    const controlledExecutionJson = JSON.stringify(result.data.controlled_execution)
    expect(controlledExecutionJson).toContain(String(rawExecutionReference))
    expect(controlledExecutionJson).toContain(String(rawIdempotencyKey))
    expect(controlledExecutionJson).toContain(String(rawExecutionFingerprint))
    expect(controlledExecutionJson).not.toContain("dropoff_quote_key_should_not_leak")
    expect(controlledExecutionJson).not.toContain("dropoff_execution_token_should_not_leak")
    expect(controlledExecutionJson).not.toContain("shipment_dropoff_123456")
    expect(controlledExecutionJson).not.toContain("provider_dropoff_corr_987654")
  })

  it("refreshes accepted persisted shipment status once from backend-only provider shipment reference and persists a safe normalized summary", async () => {
    process.env.DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED = "true"

    const postSpy = jest.spyOn(YandexDeliveryClient.prototype, "post")
      .mockResolvedValueOnce({
        shipment_id: "shipment_status_acceptance_should_not_leak",
        request_id: "provider_status_corr_should_not_leak",
        labels: [{ url: "https://example.test/dropoff-label.pdf" }],
      })
      .mockResolvedValueOnce({
        status: "delivering",
        shipment_id: "shipment_status_poll_should_not_leak",
        request_id: "provider_status_poll_corr_should_not_leak",
        token: "status_token_should_not_leak",
        quote_key: "status_quote_key_should_not_leak",
        raw_response: "Authorization: Bearer status-auth-should-not-leak",
      })
    const backendOnlyProviderShipmentReference = "provider_status_refresh_backend_only_ref_123"

    const provider = buildProvider({
      resolvedPgConnection: buildReadOnlyLookupPgConnection([buildConnectionRow()], {
        backendOnlyProviderShipmentReference,
      }),
      carts: [buildDropoffCartSelection("cart_1", "corr_status_refresh")],
    })

    const result = await provider.createFulfillment(
      {
        ...buildValidFulfillmentData(),
        cart_id: "cart_1",
        shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
        shipping_option_type_id: "deliveryhub_deliveryhub",
        correlation_id: "corr_status_refresh",
        updated_at: "2026-04-23T07:00:00.000Z",
      },
      [{ line_item_id: "item_1", quantity: 1 }],
      { id: "order_1", display_id: 42, currency_code: "RUB" },
      { id: "ful_1", location_id: "sloc_1" }
    )

    expect(postSpy).toHaveBeenCalledTimes(2)
    expect(postSpy.mock.calls[1]).toEqual([
      "/shipments/info",
      { shipment_id: backendOnlyProviderShipmentReference },
      "corr_status_refresh",
    ])
    expect(result.data.accepted_shipment_status_refresh).toEqual(
      expect.objectContaining({
        status: "refreshed",
        provider_call_attempted: true,
        accepted: true,
        provider_status: expect.objectContaining({
          provider_code: "yandex",
          operation: "get_shipment_status",
          attempted: true,
          succeeded: true,
          status_category: "received",
          neutral_status: "in_transit",
          provider_status_known: true,
          provider_status_present: true,
          provider_status_normalized: "in_transit",
          redacted: true,
        }),
        persistence: expect.objectContaining({
          attempted: true,
          performed: true,
          outcome: "refreshed",
        }),
        anti_leak_confirmations: {
          raw_provider_payloads_included: false,
          raw_provider_request_included: false,
          raw_provider_response_included: false,
          raw_yandex_response_body_included: false,
          auth_headers_included: false,
          credentials_included: false,
          raw_quote_key_included: false,
          raw_provider_identifier_included: false,
        },
      })
    )

    const statusJson = JSON.stringify(result.data.accepted_shipment_status_refresh)
    expect(statusJson).not.toContain("shipment_status_acceptance_should_not_leak")
    expect(statusJson).not.toContain("provider_status_corr_should_not_leak")
    expect(statusJson).not.toContain("shipment_status_poll_should_not_leak")
    expect(statusJson).not.toContain("provider_status_poll_corr_should_not_leak")
    expect(statusJson).not.toContain("status_token_should_not_leak")
    expect(statusJson).not.toContain("status_quote_key_should_not_leak")
    expect(statusJson).not.toContain("Authorization")
    expect(statusJson).not.toContain("status-auth-should-not-leak")
  })

  it("blocks accepted shipment status polling before provider status call when only provider reference presence flag exists", async () => {
    process.env.DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED = "true"

    const postSpy = jest.spyOn(YandexDeliveryClient.prototype, "post").mockResolvedValue({
      shipment_id: "shipment_missing_raw_reference_should_not_be_reused",
      request_id: "provider_missing_raw_reference_corr_should_not_leak",
      labels: [{ url: "https://example.test/dropoff-label.pdf" }],
    })

    const provider = buildProvider({
      resolvedPgConnection: buildReadOnlyLookupPgConnection([buildConnectionRow()]),
      carts: [buildDropoffCartSelection("cart_1", "corr_status_missing_provider_reference")],
    })

    const result = await provider.createFulfillment(
      {
        ...buildValidFulfillmentData(),
        cart_id: "cart_1",
        shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
        shipping_option_type_id: "deliveryhub_deliveryhub",
        correlation_id: "corr_status_missing_provider_reference",
        updated_at: "2026-04-23T07:00:00.000Z",
      },
      [{ line_item_id: "item_1", quantity: 1 }],
      { id: "order_1", display_id: 42, currency_code: "RUB" },
      { id: "ful_1", location_id: "sloc_1" }
    )

    expect(postSpy).toHaveBeenCalledTimes(1)
    expect(postSpy.mock.calls[0]?.[0]).toBe("/shipments/create")
    expect(postSpy.mock.calls.some((call) => call[0] === "/shipments/info")).toBe(false)
    expect(result.data.accepted_shipment_lifecycle).toEqual(
      expect.objectContaining({ classification: "accepted_shipment", accepted: true })
    )
    expect(result.data.shipment_persistence).toEqual(
      expect.objectContaining({
        outcome: "accepted",
        status: "dispatch_accepted",
        accepted: true,
        succeeded: true,
        provider_shipment_reference_present: true,
      })
    )
    expect(result.data.accepted_shipment_status_refresh).toEqual(
      expect.objectContaining({
        status: "blocked",
        provider_call_attempted: false,
        blocked_reason_code: "provider_shipment_reference_required",
        lifecycle_classification: "accepted_shipment",
        accepted: false,
        provider_status: null,
        persistence: { attempted: false, performed: false, outcome: "not_refreshed" },
      })
    )

    const statusRefreshJson = JSON.stringify(result.data.accepted_shipment_status_refresh)
    expect(statusRefreshJson).not.toContain("dhprev_")
    expect(statusRefreshJson).not.toContain("shipment_missing_raw_reference_should_not_be_reused")
    expect(statusRefreshJson).not.toContain("provider_missing_raw_reference_corr_should_not_leak")
  })

  it("blocks Yandex status polling for non-accepted lifecycle paths without provider calls", async () => {
    const postSpy = jest.spyOn(YandexDeliveryClient.prototype, "post")
    const provider = buildProvider({
      resolvedPgConnection: buildReadOnlyLookupPgConnection([buildConnectionRow()]),
      carts: [buildDropoffCartSelection("cart_1", "corr_status_blocked")],
    })

    const result = await provider.createFulfillment(
      {
        ...buildValidFulfillmentData(),
        cart_id: "cart_1",
        shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
        shipping_option_type_id: "deliveryhub_deliveryhub",
        correlation_id: "corr_status_blocked",
        updated_at: "2026-04-23T07:00:00.000Z",
      },
      [{ line_item_id: "item_1", quantity: 1 }],
      { id: "order_1", display_id: 42, currency_code: "RUB" },
      { id: "ful_1", location_id: "sloc_1" }
    )

    expect(postSpy).not.toHaveBeenCalled()
    expect(result.data.accepted_shipment_lifecycle).toEqual(
      expect.objectContaining({ classification: "blocked_before_acceptance", accepted: false })
    )
    expect(result.data.accepted_shipment_status_refresh).toEqual(
      expect.objectContaining({
        status: "blocked",
        provider_call_attempted: false,
        blocked_reason_code: "accepted_lifecycle_required",
        lifecycle_classification: "blocked_before_acceptance",
        accepted: false,
        provider_status: null,
        persistence: { attempted: false, performed: false, outcome: "not_refreshed" },
      })
    )
  })

  it("normalizes unknown provider status safely without corrupting the accepted shipment snapshot", async () => {
    process.env.DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED = "true"

    const postSpy = jest.spyOn(YandexDeliveryClient.prototype, "post")
      .mockResolvedValueOnce({ shipment_id: "shipment_unknown_status_acceptance_should_not_leak" })
      .mockResolvedValueOnce({
        status: "provider-brand-new-state",
        shipment_id: "shipment_unknown_status_poll_should_not_leak",
        authorization: "Bearer unknown-status-auth-should-not-leak",
      })

    const provider = buildProvider({
      resolvedPgConnection: buildReadOnlyLookupPgConnection([buildConnectionRow()], {
        backendOnlyProviderShipmentReference: "provider_unknown_status_backend_only_ref_123",
      }),
      carts: [buildDropoffCartSelection("cart_1", "corr_unknown_status")],
    })

    const result = await provider.createFulfillment(
      {
        ...buildValidFulfillmentData(),
        cart_id: "cart_1",
        shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
        shipping_option_type_id: "deliveryhub_deliveryhub",
        correlation_id: "corr_unknown_status",
        updated_at: "2026-04-23T07:00:00.000Z",
      },
      [{ line_item_id: "item_1", quantity: 1 }],
      { id: "order_1", display_id: 42, currency_code: "RUB" },
      { id: "ful_1", location_id: "sloc_1" }
    )

    expect(postSpy).toHaveBeenCalledTimes(2)
    expect(postSpy.mock.calls[1]).toEqual([
      "/shipments/info",
      { shipment_id: "provider_unknown_status_backend_only_ref_123" },
      "corr_unknown_status",
    ])
    expect(result.data.accepted_shipment_lifecycle).toEqual(
      expect.objectContaining({
        classification: "accepted_shipment",
        accepted: true,
        shipment: expect.objectContaining({
          outcome: "accepted",
          status: "dispatch_accepted",
          accepted: true,
          succeeded: true,
        }),
      })
    )
    expect(result.data.accepted_shipment_status_refresh).toEqual(
      expect.objectContaining({
        status: "refreshed",
        provider_call_attempted: true,
        provider_status: expect.objectContaining({
          status_category: "unknown_provider_status",
          neutral_status: "unknown",
          provider_status_known: false,
          provider_status_present: true,
          provider_status_normalized: "unknown",
        }),
        persistence: expect.objectContaining({
          attempted: true,
          performed: true,
          outcome: "refreshed",
        }),
      })
    )

    const resultJson = JSON.stringify(result.data)
    expect(resultJson).not.toContain("provider-brand-new-state")
    expect(resultJson).not.toContain("shipment_unknown_status_acceptance_should_not_leak")
    expect(resultJson).not.toContain("shipment_unknown_status_poll_should_not_leak")
    expect(resultJson).not.toContain("unknown-status-auth-should-not-leak")
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
            blocked_reason:
              "Yandex warehouse_to_pickup_point create_shipment payload preview requires a pickup interval/window.",
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
              implemented: true,
              execution_gate_enabled: true,
              dispatch_attempted: false,
              blocked_reason_code: "dispatch_runtime_blocked",
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
            dispatch_result: expect.objectContaining({
              attempted: false,
              outcome: "not_attempted",
            }),
          }),
        }),
      })
    )

    const controlledExecutionLog = [...logger.info.mock.calls]
      .reverse()
      .find((call) => String(call[0]).includes("controlled execution seam evaluated"))

    expect(String(controlledExecutionLog?.[0])).toContain('"provider_dispatch_port"')
    expect(String(controlledExecutionLog?.[0])).toContain('"implemented":true')
    expect(String(controlledExecutionLog?.[0])).toContain('"blocked_reason_code":"dispatch_runtime_blocked"')
    expect(String(controlledExecutionLog?.[0])).toContain('"provider_payload_materialization"')
    expect(String(controlledExecutionLog?.[0])).toContain('"blocked_reason_code":"missing_pickup_interval_window"')
    expect(String(controlledExecutionLog?.[0])).not.toContain("quote_provider_validation_wh")
    expect(String(controlledExecutionLog?.[0])).not.toContain("provider_wh_1")
  })

  it("executes one mocked direct Yandex dispatch call for a ready warehouse contour and keeps the result redacted", async () => {
    process.env.DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED = "true"

    const postSpy = jest.spyOn(YandexDeliveryClient.prototype, "post").mockResolvedValue({
      shipment_id: "shipment_warehouse_123456",
      request_id: "provider_warehouse_corr_987654",
      labels: [{ url: "https://example.test/warehouse-label.pdf" }],
      documents: [],
      body: "Authorization: Bearer should-not-leak",
    })

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
                  pickup_window_required: true,
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
                pickup_window: {
                  date: "2026-04-23",
                  time_from: "07:00",
                  time_to: "11:00",
                  label: "23 Apr, 07:00-11:00",
                  interval_utc: {
                    from: "2026-04-23T07:00:00.000Z",
                    to: "2026-04-23T11:00:00.000Z",
                  },
                },
                correlation_id: "corr_enabled_boundary_wh_live",
                updated_at: "2026-04-23T07:00:00.000Z",
              },
            },
          },
        },
      ],
    })

    const result = await provider.createFulfillment(
      {
        ...buildValidFulfillmentData(),
        connection_id: "conn_ready",
        mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
        quote_type: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
        shipping_option_id: "deliveryhub:warehouse_to_pickup_point",
        shipping_option_type_id: "deliveryhub_deliveryhub",
        cart_id: "cart_1",
        correlation_id: "corr_enabled_boundary_wh_live",
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
        pickup_window: {
          date: "2026-04-23",
          time_from: "07:00",
          time_to: "11:00",
          label: "23 Apr, 07:00-11:00",
          interval_utc: {
            from: "2026-04-23T07:00:00.000Z",
            to: "2026-04-23T11:00:00.000Z",
          },
        },
      },
      [{ line_item_id: "item_1", quantity: 1 }],
      { id: "order_1", display_id: 42, currency_code: "RUB" },
      { id: "ful_1", location_id: "sloc_1" }
    )

    expect(postSpy).toHaveBeenCalledTimes(1)
    expect(postSpy.mock.calls[0]).toEqual([
      "/shipments/create",
      expect.objectContaining({
        source: expect.objectContaining({
          warehouse_id: "provider_wh_1",
          interval_utc: expect.objectContaining({
            from: expect.any(String),
            to: expect.any(String),
          }),
        }),
        destination: expect.objectContaining({ pickup_point_id: "pvz_2" }),
      }),
      "corr_enabled_boundary_wh_live",
    ])
    expect(result).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          controlled_execution: expect.objectContaining({
            status: "dispatch_attempted",
            provider_payload_materialization: expect.objectContaining({
              status: "ready",
              ready: true,
              preview_summary: expect.objectContaining({
                source_type: "warehouse",
                pickup_interval_present: true,
              }),
            }),
            provider_dispatch_result: expect.objectContaining({
              attempted: true,
              accepted: true,
              succeeded: true,
              status_category: "accepted",
              redacted: true,
              raw_provider_response_included: false,
            }),
            dispatch_result: expect.objectContaining({
              attempted: true,
              performed: true,
              outcome: "accepted",
              persistence_performed: true,
              execution_ledger_persistence_performed: true,
              order_mutation_performed: false,
              fulfillment_mutation_performed: false,
            }),
          }),
          shipment_persistence: expect.objectContaining({
            execution_reference: expect.any(String),
            outcome: "accepted",
            status: "dispatch_accepted",
            accepted: true,
            succeeded: true,
            provider_shipment_reference_present: true,
            provider_correlation_reference_present: true,
            label_document_present: true,
            attachment_document_present: false,
          }),
        }),
      })
    )

    const controlledExecutionJson = JSON.stringify(result.data.controlled_execution)
    expect(controlledExecutionJson).not.toContain("Authorization")
    expect(controlledExecutionJson).not.toContain("should-not-leak")
    expect(controlledExecutionJson).not.toContain("shipment_warehouse_123456")
    expect(controlledExecutionJson).not.toContain("provider_warehouse_corr_987654")
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
            result_decision: "dispatch_prepared_but_blocked",
            dispatch_preparation: expect.objectContaining({
              provider_execution_reference_present: true,
              provider_origin_dispatch_context_present: false,
              shipment_execution_enabled: true,
              live_adapter_call_performed: false,
              persisted_execution_ledger_write_performed: false,
            }),
            provider_dispatch_port: expect.objectContaining({
              available: true,
              implemented: true,
              execution_gate_enabled: true,
              dispatch_attempted: false,
              dispatch_blocked: true,
              blocked_reason_code: "dispatch_runtime_blocked",
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
            dispatch_result: expect.objectContaining({
              attempted: false,
              performed: false,
              outcome: "not_attempted",
              redacted: true,
              persistence_performed: false,
              execution_ledger_persistence_performed: false,
              order_mutation_performed: false,
              fulfillment_mutation_performed: false,
            }),
            provider_dispatch_result: null,
          }),
        }),
      })
    )

    const controlledExecutionLog = [...logger.info.mock.calls]
      .reverse()
      .find((call) => String(call[0]).includes("controlled execution seam evaluated"))

    expect(String(controlledExecutionLog?.[0])).toContain('"provider_origin_dispatch_context_present":false')
    expect(String(controlledExecutionLog?.[0])).toContain('"provider_dispatch_port"')
    expect(String(controlledExecutionLog?.[0])).toContain('"implemented":true')
    expect(String(controlledExecutionLog?.[0])).toContain('"blocked_reason_code":"dispatch_runtime_blocked"')
    expect(String(controlledExecutionLog?.[0])).toContain('"provider_payload_materialization"')
    expect(String(controlledExecutionLog?.[0])).toContain('"blocked_reason_code":"missing_provider_origin_dispatch_context"')
    expect(String(controlledExecutionLog?.[0])).not.toContain("provider_wh_wrong")
    expect(String(controlledExecutionLog?.[0])).not.toContain("quote_mismatch_context")
  })

  it("returns a controlled redacted failure result when direct Yandex dispatch fails", async () => {
    process.env.DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED = "true"

    const postSpy = jest.spyOn(YandexDeliveryClient.prototype, "post").mockRejectedValue(
      new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "provider transport should stay redacted")
    )

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
                correlation_id: "corr_enabled_failure",
                updated_at: "2026-04-23T07:00:00.000Z",
              },
            },
          },
        },
      ],
    })

    const result = await provider.createFulfillment(
      {
        ...buildValidFulfillmentData(),
        cart_id: "cart_1",
        shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
        shipping_option_type_id: "deliveryhub_deliveryhub",
        correlation_id: "corr_enabled_failure",
        updated_at: "2026-04-23T07:00:00.000Z",
      },
      [{ line_item_id: "item_1", quantity: 1 }],
      { id: "order_1", display_id: 42, currency_code: "RUB" },
      { id: "ful_1", location_id: "sloc_1" }
    )

    expect(postSpy).toHaveBeenCalledTimes(1)
    expect(result).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          controlled_execution: expect.objectContaining({
            status: "dispatch_attempted",
            contour: expect.objectContaining({
              execution_status: "dispatch_attempted",
              ledger_persistence_performed: true,
            }),
            provider_dispatch_result: expect.objectContaining({
              attempted: true,
              accepted: false,
              succeeded: false,
              status_category: "unknown",
              redacted: true,
              auth_headers_included: false,
              raw_provider_request_included: false,
              raw_provider_response_included: false,
              raw_execution_token_included: false,
              raw_quote_key_included: false,
            }),
            dispatch_result: expect.objectContaining({
              attempted: true,
              performed: true,
              outcome: "failed",
              persistence_performed: false,
              execution_ledger_persistence_performed: true,
              order_mutation_performed: false,
              fulfillment_mutation_performed: false,
              safe_message: expect.stringContaining("shipment persistence and order or fulfillment mutation were not performed"),
            }),
          }),
          shipment_persistence: null,
          accepted_shipment_lifecycle: expect.objectContaining({
            classification: "provider_failed",
            accepted: false,
            shipment: null,
            dispatch: expect.objectContaining({
              attempted: true,
              outcome: "failed",
              accepted: false,
              succeeded: false,
            }),
            ledger: expect.objectContaining({
              linked: true,
              state: DELIVERY_HUB_EXECUTION_STATE.failedBlocked,
              terminal_completed: false,
              terminal_blocked: true,
            }),
          }),
        }),
      })
    )

    const failureLifecycleJson = JSON.stringify(result.data.accepted_shipment_lifecycle)
    expect(failureLifecycleJson).not.toContain("provider transport should stay redacted")
    expect(failureLifecycleJson).not.toContain("Authorization")
    expect(failureLifecycleJson).not.toContain("quote_provider_validation")
    expect(failureLifecycleJson).not.toContain("origin_dropoff_1")

    const controlledExecutionJson = JSON.stringify(result.data.controlled_execution)
    expect(controlledExecutionJson).not.toContain("provider transport should stay redacted")
    expect(controlledExecutionJson).not.toContain("Authorization")
    expect(controlledExecutionJson).not.toContain('"completed":true')
    expect(controlledExecutionJson).not.toContain('"application_projection_completed"')
    expect(controlledExecutionJson).toContain('"outcome":"failed"')
  })

  it("blocks accepted execution replay before provider dispatch without creating a second shipment record", async () => {
    process.env.DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED = "true"

    const postSpy = jest.spyOn(YandexDeliveryClient.prototype, "post")

    const provider = buildProvider({
      resolvedPgConnection: buildReadOnlyLookupPgConnection([buildConnectionRow()], {
        existingLedgerState: DELIVERY_HUB_EXECUTION_STATE.completed,
      }),
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
                correlation_id: "corr_replay_completed_execution",
                updated_at: "2026-04-23T07:00:00.000Z",
              },
            },
          },
        },
      ],
    })

    const result = await provider.createFulfillment(
      {
        ...buildValidFulfillmentData(),
        cart_id: "cart_1",
        shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
        shipping_option_type_id: "deliveryhub_deliveryhub",
        correlation_id: "corr_replay_completed_execution",
        updated_at: "2026-04-23T07:00:00.000Z",
      },
      [{ line_item_id: "item_1", quantity: 1 }],
      { id: "order_1", display_id: 42, currency_code: "RUB" },
      { id: "ful_1", location_id: "sloc_1" }
    )

    expect(postSpy).not.toHaveBeenCalled()
    expect(result).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          controlled_execution: expect.objectContaining({
            status: "dispatch_prepared",
            result_decision: "dispatch_prepared_but_blocked",
            blocking_stage: "provider_dispatch_execution",
            blocked_reason_code: "execution_ledger_replay_blocked",
            blocked_reason: expect.stringContaining("already completed this canonical shipment execution identity"),
            dispatch_preparation: expect.objectContaining({
              shipment_execution_enabled: true,
              live_adapter_call_performed: false,
              persisted_execution_ledger_write_performed: false,
            }),
            dispatch_result: expect.objectContaining({
              attempted: false,
              performed: false,
              outcome: "not_attempted",
              persistence_performed: false,
              execution_ledger_persistence_performed: false,
            }),
            provider_dispatch_result: null,
            contour: expect.objectContaining({
              execution_status: "blocked",
              live_dispatch_performed: false,
              ledger_persistence_performed: false,
            }),
          }),
          shipment_persistence: null,
          accepted_shipment_lifecycle: expect.objectContaining({
            classification: "replay_blocked",
            accepted: false,
            shipment: null,
            dispatch: expect.objectContaining({
              attempted: false,
              outcome: "not_attempted",
              accepted: false,
            }),
            ledger: expect.objectContaining({
              linked: true,
              state: DELIVERY_HUB_EXECUTION_STATE.completed,
              terminal_completed: true,
            }),
          }),
        }),
      })
    )
  })

  it("keeps accepted shipment details hidden for a completed ledger replay with an existing accepted shipment row", async () => {
    process.env.DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED = "true"

    const postSpy = jest.spyOn(YandexDeliveryClient.prototype, "post")
    const pgConnection = buildReadOnlyLookupPgConnection([buildConnectionRow()], {
      existingLedgerState: DELIVERY_HUB_EXECUTION_STATE.completed,
      seedAcceptedShipmentForExistingLedger: true,
    })

    const provider = buildProvider({
      resolvedPgConnection: pgConnection,
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
                correlation_id: "corr_replay_existing_accepted_shipment",
                updated_at: "2026-04-23T07:00:00.000Z",
              },
            },
          },
        },
      ],
    })

    const result = await provider.createFulfillment(
      {
        ...buildValidFulfillmentData(),
        cart_id: "cart_1",
        shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
        shipping_option_type_id: "deliveryhub_deliveryhub",
        correlation_id: "corr_replay_existing_accepted_shipment",
        updated_at: "2026-04-23T07:00:00.000Z",
      },
      [{ line_item_id: "item_1", quantity: 1 }],
      { id: "order_1", display_id: 42, currency_code: "RUB" },
      { id: "ful_1", location_id: "sloc_1" }
    )

    expect(postSpy).toHaveBeenCalledTimes(0)
    expect(pgConnection.getShipmentInsertCount()).toBe(0)
    expect(result).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          controlled_execution: expect.objectContaining({
            status: "dispatch_prepared",
            blocked_reason_code: "execution_ledger_replay_blocked",
            dispatch_preparation: expect.objectContaining({
              live_adapter_call_performed: false,
              persisted_execution_ledger_write_performed: false,
            }),
            dispatch_result: expect.objectContaining({
              attempted: false,
              performed: false,
              outcome: "not_attempted",
              persistence_performed: false,
              execution_ledger_persistence_performed: false,
            }),
            provider_dispatch_result: null,
          }),
          shipment_persistence: null,
          accepted_shipment_lifecycle: expect.objectContaining({
            classification: "replay_blocked",
            accepted: false,
            shipment: null,
            dispatch: expect.objectContaining({
              attempted: false,
              accepted: false,
              succeeded: false,
              outcome: "not_attempted",
              blocked_reason_code: "execution_ledger_replay_blocked",
            }),
            ledger: expect.objectContaining({
              linked: true,
              state: DELIVERY_HUB_EXECUTION_STATE.completed,
              terminal_completed: true,
              terminal_blocked: false,
            }),
          }),
        }),
      })
    )
  })

  it("blocks failed-blocked execution replay without automatic retry, completion, provider call, or shipment persistence", async () => {
    process.env.DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED = "true"

    const postSpy = jest.spyOn(YandexDeliveryClient.prototype, "post")

    const provider = buildProvider({
      resolvedPgConnection: buildReadOnlyLookupPgConnection([buildConnectionRow()], {
        existingLedgerState: DELIVERY_HUB_EXECUTION_STATE.failedBlocked,
      }),
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
                correlation_id: "corr_failed_blocked_replay",
                updated_at: "2026-04-23T07:00:00.000Z",
              },
            },
          },
        },
      ],
    })

    const result = await provider.createFulfillment(
      {
        ...buildValidFulfillmentData(),
        cart_id: "cart_1",
        shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
        shipping_option_type_id: "deliveryhub_deliveryhub",
        correlation_id: "corr_failed_blocked_replay",
        updated_at: "2026-04-23T07:00:00.000Z",
      },
      [{ line_item_id: "item_1", quantity: 1 }],
      { id: "order_1", display_id: 42, currency_code: "RUB" },
      { id: "ful_1", location_id: "sloc_1" }
    )

    expect(postSpy).not.toHaveBeenCalled()
    expect(result).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          controlled_execution: expect.objectContaining({
            status: "dispatch_prepared",
            result_decision: "dispatch_prepared_but_blocked",
            blocking_stage: "provider_dispatch_execution",
            blocked_reason_code: "execution_ledger_failed_blocked",
            blocked_reason: expect.stringContaining("without automatic retry"),
            dispatch_preparation: expect.objectContaining({
              shipment_execution_enabled: true,
              live_adapter_call_performed: false,
              persisted_execution_ledger_write_performed: false,
            }),
            dispatch_result: expect.objectContaining({
              attempted: false,
              performed: false,
              outcome: "not_attempted",
              persistence_performed: false,
              execution_ledger_persistence_performed: false,
            }),
            provider_dispatch_result: null,
            contour: expect.objectContaining({
              execution_status: "blocked",
              live_dispatch_performed: false,
              ledger_persistence_performed: false,
            }),
          }),
          shipment_persistence: null,
          accepted_shipment_lifecycle: expect.objectContaining({
            classification: "failed_blocked",
            accepted: false,
            shipment: null,
            dispatch: expect.objectContaining({
              attempted: false,
              outcome: "not_attempted",
              accepted: false,
            }),
            ledger: expect.objectContaining({
              linked: true,
              state: DELIVERY_HUB_EXECUTION_STATE.failedBlocked,
              terminal_blocked: true,
            }),
          }),
        }),
      })
    )
    expect(JSON.stringify(result.data.controlled_execution)).not.toContain('"completed":true')
  })

  it("blocks duplicate exact reservation in intermediate state before provider dispatch without misleading success semantics", async () => {
    process.env.DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED = "true"

    const postSpy = jest.spyOn(YandexDeliveryClient.prototype, "post")

    const provider = buildProvider({
      resolvedPgConnection: buildReadOnlyLookupPgConnection([buildConnectionRow()], {
        existingLedgerState: DELIVERY_HUB_EXECUTION_STATE.reserved,
      }),
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
                correlation_id: "corr_duplicate_intermediate_execution",
                updated_at: "2026-04-23T07:00:00.000Z",
              },
            },
          },
        },
      ],
    })

    const result = await provider.createFulfillment(
      {
        ...buildValidFulfillmentData(),
        cart_id: "cart_1",
        shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
        shipping_option_type_id: "deliveryhub_deliveryhub",
        correlation_id: "corr_duplicate_intermediate_execution",
        updated_at: "2026-04-23T07:00:00.000Z",
      },
      [{ line_item_id: "item_1", quantity: 1 }],
      { id: "order_1", display_id: 42, currency_code: "RUB" },
      { id: "ful_1", location_id: "sloc_1" }
    )

    expect(postSpy).not.toHaveBeenCalled()
    expect(result).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          controlled_execution: expect.objectContaining({
            status: "dispatch_prepared",
            result_decision: "dispatch_prepared_but_blocked",
            blocking_stage: "provider_dispatch_execution",
            blocked_reason_code: "execution_ledger_duplicate_execution",
            dispatch_preparation: expect.objectContaining({
              shipment_execution_enabled: true,
              live_adapter_call_performed: false,
              persisted_execution_ledger_write_performed: false,
            }),
            dispatch_result: expect.objectContaining({
              attempted: false,
              performed: false,
              outcome: "not_attempted",
              persistence_performed: false,
              execution_ledger_persistence_performed: false,
            }),
            provider_dispatch_result: null,
            contour: expect.objectContaining({
              execution_status: "blocked",
              live_dispatch_performed: false,
              ledger_persistence_performed: false,
            }),
          }),
          shipment_persistence: null,
          accepted_shipment_lifecycle: expect.objectContaining({
            classification: "duplicate_blocked",
            accepted: false,
            shipment: null,
            dispatch: expect.objectContaining({
              attempted: false,
              outcome: "not_attempted",
              accepted: false,
            }),
            ledger: expect.objectContaining({
              linked: true,
              state: DELIVERY_HUB_EXECUTION_STATE.reserved,
              terminal_completed: false,
              terminal_blocked: false,
            }),
          }),
        }),
      })
    )
  })

  it("blocks execution-ledger drift before provider dispatch without misleading success semantics", async () => {
    process.env.DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED = "true"

    const postSpy = jest.spyOn(YandexDeliveryClient.prototype, "post")

    const provider = buildProvider({
      resolvedPgConnection: buildReadOnlyLookupPgConnection([buildConnectionRow()], {
        forceReserveDrift: true,
      }),
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
                correlation_id: "corr_drift_execution",
                updated_at: "2026-04-23T07:00:00.000Z",
              },
            },
          },
        },
      ],
    })

    const result = await provider.createFulfillment(
      {
        ...buildValidFulfillmentData(),
        cart_id: "cart_1",
        shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
        shipping_option_type_id: "deliveryhub_deliveryhub",
        correlation_id: "corr_drift_execution",
        updated_at: "2026-04-23T07:00:00.000Z",
      },
      [{ line_item_id: "item_1", quantity: 1 }],
      { id: "order_1", display_id: 42, currency_code: "RUB" },
      { id: "ful_1", location_id: "sloc_1" }
    )

    expect(postSpy).not.toHaveBeenCalled()
    expect(result).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          controlled_execution: expect.objectContaining({
            status: "dispatch_prepared",
            result_decision: "dispatch_prepared_but_blocked",
            blocking_stage: "provider_dispatch_execution",
            blocked_reason_code: "execution_ledger_drift_detected",
            dispatch_preparation: expect.objectContaining({
              shipment_execution_enabled: true,
              live_adapter_call_performed: false,
              persisted_execution_ledger_write_performed: false,
            }),
            dispatch_result: expect.objectContaining({
              attempted: false,
              performed: false,
              outcome: "not_attempted",
              persistence_performed: false,
              execution_ledger_persistence_performed: false,
            }),
            provider_dispatch_result: null,
            contour: expect.objectContaining({
              execution_status: "blocked",
              live_dispatch_performed: false,
              ledger_persistence_performed: false,
            }),
          }),
          shipment_persistence: null,
          accepted_shipment_lifecycle: expect.objectContaining({
            classification: "drift_blocked",
            accepted: false,
            shipment: null,
            dispatch: expect.objectContaining({
              attempted: false,
              outcome: "not_attempted",
              accepted: false,
            }),
            ledger: expect.objectContaining({
              linked: true,
              state: DELIVERY_HUB_EXECUTION_STATE.planned,
              terminal_completed: false,
              terminal_blocked: false,
            }),
          }),
        }),
      })
    )
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

  it("does not call Yandex when the committed Delivery Hub provider contour is unsupported", async () => {
    const postSpy = jest.spyOn(YandexDeliveryClient.prototype, "post")
    const provider = buildProvider({
      resolvedPgConnection: buildReadOnlyLookupPgConnection([
        buildConnectionRow({ provider_code: "cdek" }),
      ]),
    })

    await expect(
      provider.createFulfillment(
        {
          ...buildValidFulfillmentData(),
          cart_id: "cart_1",
          shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
          shipping_option_type_id: "deliveryhub_deliveryhub",
          correlation_id: "corr_provider_unsupported_zero_call",
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
            status: "blocked",
            blocking_stage: "connection_readiness",
            blocked_reason_code: "delivery_connection_provider_not_supported",
          }),
        }),
      })
    )

    expect(postSpy).not.toHaveBeenCalled()
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
function buildReadOnlyLookupPgConnection(
  rows: readonly unknown[],
  options?: {
    forceReserveConflict?: boolean
    forceReserveDrift?: boolean
    existingLedgerState?: (typeof DELIVERY_HUB_EXECUTION_STATE)[keyof typeof DELIVERY_HUB_EXECUTION_STATE]
    seedAcceptedShipmentForExistingLedger?: boolean
    backendOnlyProviderShipmentReference?: string
  }
) {
  const state = {
    shipments: [] as Array<Record<string, unknown>>,
    shipmentInsertCount: 0,
    executionLedgerByReference: new Map<string, Record<string, unknown>>(),
    executionLedgerReferenceByIdempotencyKey: new Map<string, string>(),
  }

  return {
    getShipmentInsertCount: () => state.shipmentInsertCount,
    raw: async (...args: unknown[]) => {
      const query = args[0]
      const bindings = Array.isArray(args[1]) ? args[1] : undefined
      const sql = typeof query === "string" ? query : String(query ?? "")

      if (sql.includes("select to_regclass")) {
        if (sql.includes("delivery_connections")) {
          return {
            rows: [{ table_name: "delivery_connections" }],
          }
        }

        if (sql.includes("delivery_shipments")) {
          return {
            rows: [{ table_name: "delivery_shipments" }],
          }
        }

        if (sql.includes("deliveryhub_execution_ledger")) {
          return {
            rows: [{ table_name: "deliveryhub_execution_ledger" }],
          }
        }
 
        return {
          rows: [{ table_name: "delivery_connections" }],
        }
      }

      if (sql.includes("create table if not exists delivery_shipments")) {
        return { rows: [] }
      }

      if (sql.includes("select") && sql.includes("from delivery_shipments")) {
        if (sql.includes("where execution_reference =")) {
          const executionReference = typeof bindings?.[0] === "string" ? bindings[0] : ""
          const row = state.shipments.find(
            (entry) => entry.execution_reference === executionReference
          )
          return { rows: row ? [row] : [] }
        }
      }

      if (sql.includes("select") && sql.includes("from deliveryhub_execution_ledger")) {
        if (sql.includes("where execution_reference =")) {
          const executionReference = typeof bindings?.[0] === "string" ? bindings[0] : ""
          const row = state.executionLedgerByReference.get(executionReference)
          return { rows: row ? [row] : [] }
        }

        if (sql.includes("where idempotency_key =")) {
          const idempotencyKey = typeof bindings?.[0] === "string" ? bindings[0] : ""
          const executionReference = state.executionLedgerReferenceByIdempotencyKey.get(idempotencyKey)
          const row = executionReference
            ? state.executionLedgerByReference.get(executionReference) ?? null
            : null
          return { rows: row ? [row] : [] }
        }
      }

      if (sql.includes("insert into deliveryhub_execution_ledger") && sql.includes("on conflict")) {
        const executionReference = typeof bindings?.[0] === "string" ? bindings[0] : "dhprev_test"
        const idempotencyKey = typeof bindings?.[1] === "string" ? bindings[1] : "deliveryhub:test"
        const executionPayload = typeof bindings?.[2] === "string" ? bindings[2] : "{}"
        const reservationPayload = typeof bindings?.[3] === "string" ? bindings[3] : "{}"

        if (
          options?.forceReserveConflict ||
          options?.forceReserveDrift ||
          options?.existingLedgerState
        ) {
          const parsedExecutionPayload = JSON.parse(executionPayload) as Record<string, any>
          const parsedReservationPayload = JSON.parse(reservationPayload) as Record<string, any>
          const existingState = options.existingLedgerState ?? parsedExecutionPayload.current_state
          const existingExecutionPayload = JSON.stringify({
            ...parsedExecutionPayload,
            current_state: existingState,
            terminality: {
              completed: existingState === DELIVERY_HUB_EXECUTION_STATE.completed,
              blocked: existingState === DELIVERY_HUB_EXECUTION_STATE.failedBlocked,
            },
          })
          const conflictingReservationPayload = options.forceReserveDrift
            ? JSON.stringify({
                ...parsedReservationPayload,
                plan_fingerprint: "plan_fp_drifted_value",
              })
            : reservationPayload
          const row = {
            execution_reference: executionReference,
            idempotency_key: idempotencyKey,
            execution_payload: existingExecutionPayload,
            reservation_payload: conflictingReservationPayload,
            transitions_payload: "[]",
            audit_events_payload: "[]",
          }
          state.executionLedgerByReference.set(executionReference, row)
          state.executionLedgerReferenceByIdempotencyKey.set(idempotencyKey, executionReference)

          if (options.seedAcceptedShipmentForExistingLedger) {
            state.shipments = [
              {
                id: "shipment_existing_accepted_replay",
                execution_reference: executionReference,
                idempotency_key: idempotencyKey,
                provider_code: "deliveryhub",
                connection_id: "conn_ready",
                mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                order_id: "order_1",
                fulfillment_id: "ful_1",
                cart_id: "cart_1",
                shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
                location_id: "sloc_1",
                quote_reference_id: "qr_existing_accepted_replay",
                quote_reference_version: 1,
                correlation_id: "corr_existing_accepted_replay_row",
                outcome: "accepted",
                status: "dispatch_accepted",
                accepted: true,
                succeeded: true,
                provider_shipment_reference_present: true,
                provider_correlation_reference_present: true,
                label_document_present: true,
                attachment_document_present: true,
                provider_status_summary: {},
                status_refresh_outcome: "not_refreshed",
                status_refreshed_at: null,
                request_summary: {},
                response_summary: {},
                metadata: { ledger_persistence_performed: true, redacted: true },
                created_at: "2026-04-23T08:00:00.000Z",
                updated_at: "2026-04-23T08:00:00.000Z",
              },
            ]
          }

          return { rowCount: 0, rows: [] }
        }

        if (state.executionLedgerReferenceByIdempotencyKey.has(idempotencyKey)) {
          return { rowCount: 0, rows: [] }
        }
 
        const row = {
          execution_reference: executionReference,
          idempotency_key: idempotencyKey,
          execution_payload: executionPayload,
          reservation_payload: reservationPayload,
          transitions_payload: "[]",
          audit_events_payload: "[]",
        }
        state.executionLedgerByReference.set(executionReference, row)
        state.executionLedgerReferenceByIdempotencyKey.set(idempotencyKey, executionReference)
        return { rowCount: 1, rows: [row] }
      }

      if (sql.includes("insert into deliveryhub_execution_ledger_audit_events")) {
        return { rowCount: 1, rows: [] }
      }

      if (sql.includes("insert into deliveryhub_execution_ledger_transitions")) {
        return { rowCount: 1, rows: [] }
      }

      if (sql.includes("update deliveryhub_execution_ledger")) {
        const executionPayload = typeof bindings?.[0] === "string" ? bindings[0] : "{}"
        const reservationPayload = typeof bindings?.[1] === "string" ? bindings[1] : "{}"
        const transitionsPayload = typeof bindings?.[2] === "string" ? bindings[2] : "[]"
        const auditEventsPayload = typeof bindings?.[3] === "string" ? bindings[3] : "[]"
        const executionReference = typeof bindings?.[4] === "string" ? bindings[4] : ""
        const existing = state.executionLedgerByReference.get(executionReference)

        if (existing) {
          state.executionLedgerByReference.set(executionReference, {
            ...existing,
            execution_payload: executionPayload,
            reservation_payload: reservationPayload,
            transitions_payload: transitionsPayload,
            audit_events_payload: auditEventsPayload,
          })
        }

        return { rowCount: existing ? 1 : 0, rows: [] }
      }
 
      if (sql.includes("insert into delivery_shipments")) {
        state.shipmentInsertCount += 1
        const row = {
          id: typeof bindings?.[0] === "string" ? bindings[0] : "shipment_record_1",
          execution_reference: typeof bindings?.[1] === "string" ? bindings[1] : "exec_ref_1",
          idempotency_key: typeof bindings?.[2] === "string" ? bindings[2] : null,
          provider_code: typeof bindings?.[3] === "string" ? bindings[3] : "deliveryhub",
          connection_id: typeof bindings?.[4] === "string" ? bindings[4] : null,
          mode_code: typeof bindings?.[5] === "string" ? bindings[5] : null,
          order_id: typeof bindings?.[6] === "string" ? bindings[6] : null,
          fulfillment_id: typeof bindings?.[7] === "string" ? bindings[7] : null,
          cart_id: typeof bindings?.[8] === "string" ? bindings[8] : null,
          shipping_option_id: typeof bindings?.[9] === "string" ? bindings[9] : null,
          location_id: typeof bindings?.[10] === "string" ? bindings[10] : null,
          quote_reference_id: typeof bindings?.[11] === "string" ? bindings[11] : null,
          quote_reference_version:
            typeof bindings?.[12] === "number" ? bindings[12] : null,
          correlation_id: typeof bindings?.[13] === "string" ? bindings[13] : null,
          outcome: typeof bindings?.[14] === "string" ? bindings[14] : "accepted",
          status: typeof bindings?.[15] === "string" ? bindings[15] : "dispatch_accepted",
          accepted: Boolean(bindings?.[16]),
          succeeded: Boolean(bindings?.[17]),
          provider_shipment_reference_present: Boolean(bindings?.[18]),
          provider_correlation_reference_present: Boolean(bindings?.[19]),
          label_document_present: Boolean(bindings?.[20]),
          attachment_document_present: Boolean(bindings?.[21]),
          provider_status_summary:
            typeof bindings?.[22] === "string" ? JSON.parse(bindings[22] as string) : {},
          status_refresh_outcome:
            typeof bindings?.[23] === "string" ? bindings[23] : "not_refreshed",
          status_refreshed_at: typeof bindings?.[24] === "string" ? bindings[24] : null,
          request_summary:
            typeof bindings?.[25] === "string" ? JSON.parse(bindings[25] as string) : {},
          response_summary:
            typeof bindings?.[26] === "string" ? JSON.parse(bindings[26] as string) : {},
          metadata: {
            ...(typeof bindings?.[27] === "string" ? JSON.parse(bindings[27] as string) : {}),
            ...(options?.backendOnlyProviderShipmentReference
              ? {
                  provider_shipment_reference:
                    options.backendOnlyProviderShipmentReference,
                }
              : {}),
          },
          created_at: "2026-04-23T08:00:00.000Z",
          updated_at: "2026-04-23T08:00:00.000Z",
        }

        const existingIndex = state.shipments.findIndex(
          (entry) => entry.execution_reference === row.execution_reference
        )

        if (existingIndex >= 0) {
          state.shipments[existingIndex] = row
        } else {
          state.shipments.push(row)
        }

        return { rows: [row] }
      }

      if (sql.includes("update delivery_shipments")) {
        const providerStatusSummary =
          typeof bindings?.[0] === "string" ? JSON.parse(bindings[0] as string) : {}
        const statusRefreshOutcome =
          typeof bindings?.[1] === "string" ? bindings[1] : "not_refreshed"
        const statusRefreshedAt =
          typeof bindings?.[2] === "string" ? bindings[2] : "2026-04-23T09:00:00.000Z"
        const metadata = typeof bindings?.[3] === "string" ? JSON.parse(bindings[3] as string) : {}
        const executionReference = typeof bindings?.[4] === "string" ? bindings[4] : ""
        const existingIndex = state.shipments.findIndex(
          (entry) =>
            entry.execution_reference === executionReference &&
            entry.outcome === "accepted" &&
            entry.status === "dispatch_accepted" &&
            entry.accepted === true &&
            entry.succeeded === true
        )

        if (existingIndex < 0) {
          return { rowCount: 0, rows: [] }
        }

        const row = {
          ...state.shipments[existingIndex],
          provider_status_summary: providerStatusSummary,
          status_refresh_outcome: statusRefreshOutcome,
          status_refreshed_at: statusRefreshedAt,
          metadata,
          updated_at: "2026-04-23T09:00:00.000Z",
        }
        state.shipments[existingIndex] = row

        return { rowCount: 1, rows: [row] }
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

function buildDropoffCartSelection(id: string, correlationId: string) {
  return {
    id,
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
          correlation_id: correlationId,
          updated_at: "2026-04-23T07:00:00.000Z",
        },
      },
    },
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
