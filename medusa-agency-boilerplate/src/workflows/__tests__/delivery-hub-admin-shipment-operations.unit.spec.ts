import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it, jest } from "@jest/globals"
import { DeliveryHubError } from "../../modules/delivery-hub/errors"
import { buildDeliveryHubAdminOrderDeliveryHubSnapshot } from "../../modules/delivery-hub/admin-order-delivery-hub"
import { buildDeliveryHubAdminShipmentOperationsViewModel } from "../../modules/delivery-hub/admin-shipment-operations"
import { buildDeliveryHubAcceptedShipmentLifecycleSnapshot } from "../../modules/delivery-hub/shipment-lifecycle-read-model"
import { cancelDeliveryHubAcceptedShipment } from "../../modules/delivery-hub/shipment-cancel-policy"
import { refreshDeliveryHubAcceptedShipmentStatus } from "../../modules/delivery-hub/shipment-status-polling"
import type { DeliveryConnectionRecord } from "../../modules/delivery-hub/domain/connection"
import type { DeliveryHubPgConnection } from "../../modules/delivery-hub/storage/pg"
import type { DeliveryHubShipmentRecord } from "../../modules/delivery-hub/storage/shipments-repository"
import type { YandexShipmentStatusClientLike } from "../../modules/delivery-hub/adapters/yandex/shipment-status"
import type { YandexShipmentCancelClientLike } from "../../modules/delivery-hub/adapters/yandex/shipment-cancel"

const acceptedConnection: DeliveryConnectionRecord = {
  id: "conn_admin_ops",
  provider_code: "yandex",
  name: "Yandex Admin Ops",
  status: "active",
  mode: "live",
  enabled: true,
  country_code: "RU",
  credentials_envelope: {
    version: "dh.v1",
    mode: "sealed",
    ciphertext: "sealed",
    iv: "iv",
    tag: "tag",
  },
  credentials_state: "sealed",
  credentials_fingerprint: "fp_admin_ops",
  credentials_last_validated_at: "2026-04-24T05:00:00.000Z",
  credentials_last_error_code: null,
  config: {},
  metadata: {},
  created_at: "2026-04-24T05:00:00.000Z",
  updated_at: "2026-04-24T05:00:00.000Z",
}

describe("Delivery Hub admin shipment operations visibility", () => {
  it("builds a safe accepted admin shipment operations view-model with current status summary", () => {
    const shipment = buildAcceptedShipment({
      metadata: {
        provider_shipment_reference: "provider-admin-raw-shipment-id-should-not-leak",
        redacted: true,
      },
      provider_status_summary: {
        provider_code: "yandex",
        operation: "get_shipment_status",
        attempted: true,
        succeeded: true,
        status_category: "received",
        neutral_status: "in_transit",
        provider_status_known: true,
        provider_status_present: true,
        provider_status_normalized: "in_transit",
        provider_status_code: null,
        correlation_id_present: true,
        provider_shipment_reference_present: true,
        safe_message: "Yandex shipment status was refreshed and normalized.",
        redacted: true,
        raw_provider_payload: "should-not-cross",
      },
      status_refresh_outcome: "refreshed",
      status_refreshed_at: "2026-04-24T06:00:00.000Z",
    })
    const lifecycle = buildDeliveryHubAcceptedShipmentLifecycleSnapshot({ shipment })
    const view = buildDeliveryHubAdminShipmentOperationsViewModel({
      lifecycle,
      shipment,
      connection: acceptedConnection,
    })

    expect(view).toEqual(
      expect.objectContaining({
        version: 1,
        safe: true,
        lifecycle: expect.objectContaining({
          classification: "accepted_shipment",
          accepted: true,
        }),
        provider: expect.objectContaining({
          provider_code: "deliveryhub",
          mode_code: "dropoff_point_to_pickup_point",
          dispatch_status: "dispatch_accepted",
          provider_shipment_reference_present: true,
        }),
        status: expect.objectContaining({
          current: expect.objectContaining({
            provider_code: "yandex",
            operation: "get_shipment_status",
            neutral_status: "in_transit",
            provider_status_known: true,
            redacted: true,
          }),
          refresh: expect.objectContaining({
            available: true,
            blocked_reason_code: null,
            last_outcome: "refreshed",
            status_refreshed_at: "2026-04-24T06:00:00.000Z",
          }),
        }),
        action_posture: {
          refresh_status: "available",
          cancel: "available",
          retry: "blocked",
          webhooks: "not_materialized",
          scheduler: "not_materialized",
        },
      })
    )

    const json = JSON.stringify(view)
    expect(json).not.toContain("provider-admin-raw-shipment-id-should-not-leak")
    expect(json).not.toContain("should-not-cross")
    expect(json).not.toContain("exec_admin_ops_accepted_reference")
    expect(json).not.toContain("idempotency_admin_ops_raw_key")
  })

  it("keeps non-accepted admin shipment operations paths blocked and not accepted", () => {
    const failedShipment = buildAcceptedShipment({
      outcome: "failed",
      status: "dispatch_failed",
      accepted: false,
      succeeded: false,
      metadata: {
        provider_shipment_reference: "provider-failed-raw-id-should-not-leak",
      },
    })
    const lifecycle = buildDeliveryHubAcceptedShipmentLifecycleSnapshot({
      shipment: failedShipment,
    })
    const view = buildDeliveryHubAdminShipmentOperationsViewModel({
      lifecycle,
      shipment: failedShipment,
      connection: acceptedConnection,
    })

    expect(view.lifecycle).toEqual(
      expect.objectContaining({
        classification: "failed_dispatch",
        accepted: false,
      })
    )
    expect(view.shipment).toEqual(
      expect.objectContaining({
        id: null,
        accepted: false,
        status: null,
      })
    )
    expect(view.status.refresh).toEqual(
      expect.objectContaining({
        available: false,
        blocked_reason_code: "accepted_shipment_required",
      })
    )
    expect(view.action_posture.cancel).toBe("blocked")
    expect(view.cancel.readiness.blocked_reason_code).toBe("accepted_lifecycle_required")
    expect(JSON.stringify(view)).not.toContain("provider-failed-raw-id-should-not-leak")
  })

  it("cancels accepted shipment from backend-only provider reference through a redacted Yandex boundary", async () => {
    const providerReference = "provider-admin-cancel-backend-only-ref"
    const shipment = buildAcceptedShipment({
      metadata: {
        provider_shipment_reference: providerReference,
        redacted: true,
      },
      provider_status_summary: {
        neutral_status: "accepted",
      },
    })
    const lifecycle = buildDeliveryHubAcceptedShipmentLifecycleSnapshot({ shipment })
    const post = jest.fn(async () => ({
      status: "cancellation_requested",
      shipment_id: "provider-cancel-response-raw-id-should-not-leak",
      request_id: "provider-cancel-correlation-should-not-leak",
      authorization: "Bearer provider-cancel-token-should-not-leak",
      quote_key: "provider-cancel-quote-key-should-not-leak",
    }))
    const client = { post } as unknown as YandexShipmentCancelClientLike

    const result = await cancelDeliveryHubAcceptedShipment({
      lifecycle,
      shipment,
      connection: acceptedConnection,
      correlation_id: "admin-cancel-correlation",
      client,
    })

    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith(
      "/request/cancel",
      { shipment_id: providerReference },
      "admin-cancel-correlation"
    )
    expect(result).toEqual(
      expect.objectContaining({
        status: "cancel_requested",
        provider_call_attempted: true,
        accepted: true,
        provider_cancel: expect.objectContaining({
          provider_code: "yandex",
          operation: "cancel_shipment",
          status_category: "cancelled",
          neutral_status: "cancelled",
          redacted: true,
          semantics_certainty: "adapter_boundary_mocked_only",
        }),
      })
    )

    const json = JSON.stringify(result)
    expect(json).not.toContain(providerReference)
    expect(json).not.toContain("provider-cancel-response-raw-id-should-not-leak")
    expect(json).not.toContain("provider-cancel-correlation-should-not-leak")
    expect(json).not.toContain("provider-cancel-token-should-not-leak")
    expect(json).not.toContain("provider-cancel-quote-key-should-not-leak")
  })

  it("blocks cancel with zero provider call for terminal or already cancelled lifecycle states", async () => {
    const deliveredShipment = buildAcceptedShipment({
      metadata: {
        provider_shipment_reference: "provider-terminal-ref-should-not-leak",
      },
      provider_status_summary: {
        neutral_status: "delivered",
      },
    })
    const cancelledShipment = buildAcceptedShipment({
      metadata: {
        provider_shipment_reference: "provider-cancelled-ref-should-not-leak",
      },
      provider_status_summary: {
        neutral_status: "cancelled",
      },
    })
    const post = jest.fn(async () => ({}))
    const client = { post } as unknown as YandexShipmentCancelClientLike

    const deliveredResult = await cancelDeliveryHubAcceptedShipment({
      lifecycle: buildDeliveryHubAcceptedShipmentLifecycleSnapshot({ shipment: deliveredShipment }),
      shipment: deliveredShipment,
      connection: acceptedConnection,
      correlation_id: "admin-cancel-terminal",
      client,
    })
    const cancelledResult = await cancelDeliveryHubAcceptedShipment({
      lifecycle: buildDeliveryHubAcceptedShipmentLifecycleSnapshot({ shipment: cancelledShipment }),
      shipment: cancelledShipment,
      connection: acceptedConnection,
      correlation_id: "admin-cancel-already-cancelled",
      client,
    })

    expect(post).not.toHaveBeenCalled()
    expect(deliveredResult).toEqual(expect.objectContaining({
      status: "blocked",
      provider_call_attempted: false,
      blocked_reason_code: "terminal_status_not_cancellable",
    }))
    expect(cancelledResult).toEqual(expect.objectContaining({
      status: "blocked",
      provider_call_attempted: false,
      blocked_reason_code: "already_cancelled",
    }))
    expect(JSON.stringify([deliveredResult, cancelledResult])).not.toContain("provider-terminal-ref-should-not-leak")
    expect(JSON.stringify([deliveredResult, cancelledResult])).not.toContain("provider-cancelled-ref-should-not-leak")
  })

  it("blocks cancel before provider call when backend-only provider reference is missing", async () => {
    const shipment = buildAcceptedShipment({
      provider_shipment_reference_present: true,
      metadata: { redacted: true },
      response_summary: {
        provider_shipment_reference_present: true,
        safe_message: "accepted without raw reference",
      },
    })
    const lifecycle = buildDeliveryHubAcceptedShipmentLifecycleSnapshot({ shipment })
    const post = jest.fn(async () => ({}))
    const client = { post } as unknown as YandexShipmentCancelClientLike

    const result = await cancelDeliveryHubAcceptedShipment({
      lifecycle,
      shipment,
      connection: acceptedConnection,
      correlation_id: "admin-cancel-missing-reference",
      client,
    })

    expect(post).not.toHaveBeenCalled()
    expect(result).toEqual(
      expect.objectContaining({
        status: "blocked",
        provider_call_attempted: false,
        blocked_reason_code: "provider_shipment_reference_required",
        lifecycle_classification: "accepted_shipment",
        accepted: false,
        provider_cancel: null,
      })
    )
  })

  it("sanitizes provider cancel failure without leaking raw body, ids, auth or quotes", async () => {
    const providerReference = "provider-admin-cancel-failure-backend-ref"
    const shipment = buildAcceptedShipment({
      metadata: {
        provider_shipment_reference: providerReference,
        redacted: true,
      },
    })
    const lifecycle = buildDeliveryHubAcceptedShipmentLifecycleSnapshot({ shipment })
    const post = jest.fn(async () => {
      throw new DeliveryHubError({
        code: "DELIVERY_HUB_PROVIDER_ERROR",
        message: "Provider rejected cancellation",
        status: 502,
        details: {
          provider_status: 409,
          error_category: "provider_rejected",
          response: {
            shipment_id: "raw-failure-shipment-id-should-not-leak",
            token: "raw-failure-token-should-not-leak",
            quote_key: "raw-failure-quote-key-should-not-leak",
            body: "raw-failure-body-should-not-leak",
          },
        },
      })
    })
    const client = { post } as unknown as YandexShipmentCancelClientLike

    const result = await cancelDeliveryHubAcceptedShipment({
      lifecycle,
      shipment,
      connection: acceptedConnection,
      correlation_id: "admin-cancel-failure-correlation",
      client,
    })

    expect(post).toHaveBeenCalledTimes(1)
    expect(result).toEqual(expect.objectContaining({
      status: "cancel_requested",
      provider_call_attempted: true,
      provider_cancel: expect.objectContaining({
        succeeded: false,
        status_category: "provider_rejected",
        provider_status_code: 409,
        redacted: true,
      }),
    }))

    const json = JSON.stringify(result)
    expect(json).not.toContain(providerReference)
    expect(json).not.toContain("raw-failure-shipment-id-should-not-leak")
    expect(json).not.toContain("raw-failure-token-should-not-leak")
    expect(json).not.toContain("raw-failure-quote-key-should-not-leak")
    expect(json).not.toContain("raw-failure-body-should-not-leak")
  })

  it("refreshes from the backend-only provider shipment reference and returns a redacted admin-safe foundation", async () => {
    const providerReference = "provider-admin-refresh-backend-only-ref"
    const shipment = buildAcceptedShipment({
      metadata: {
        provider_shipment_reference: providerReference,
        redacted: true,
      },
    })
    const lifecycle = buildDeliveryHubAcceptedShipmentLifecycleSnapshot({ shipment })
    const post = jest.fn(async () => ({
      status: "delivering",
      shipment_id: "provider-refresh-response-raw-id-should-not-leak",
      request_id: "provider-refresh-correlation-should-not-leak",
      token: "provider-refresh-token-should-not-leak",
      quote_key: "provider-refresh-quote-key-should-not-leak",
    }))
    const client = { post } as unknown as YandexShipmentStatusClientLike
    const pg = buildStatusUpdatePg(shipment)

    const result = await refreshDeliveryHubAcceptedShipmentStatus({
      lifecycle,
      shipment,
      connection: acceptedConnection,
      pg_connection: pg,
      correlation_id: "admin-refresh-correlation",
      now: () => "2026-04-24T06:05:00.000Z",
      client,
    })

    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith(
      "/shipments/info",
      { shipment_id: providerReference },
      "admin-refresh-correlation"
    )
    expect(result).toEqual(
      expect.objectContaining({
        status: "refreshed",
        provider_call_attempted: true,
        accepted: true,
        provider_status: expect.objectContaining({
          provider_code: "yandex",
          operation: "get_shipment_status",
          neutral_status: "in_transit",
          redacted: true,
        }),
        persistence: expect.objectContaining({
          attempted: true,
          performed: true,
          outcome: "refreshed",
          status_refreshed_at: "2026-04-24T06:05:00.000Z",
        }),
      })
    )

    const json = JSON.stringify(result)
    expect(json).not.toContain(providerReference)
    expect(json).not.toContain("provider-refresh-response-raw-id-should-not-leak")
    expect(json).not.toContain("provider-refresh-correlation-should-not-leak")
    expect(json).not.toContain("provider-refresh-token-should-not-leak")
    expect(json).not.toContain("provider-refresh-quote-key-should-not-leak")
  })

  it("blocks refresh with zero provider call when backend-only provider reference is missing", async () => {
    const shipment = buildAcceptedShipment({
      provider_shipment_reference_present: true,
      metadata: { redacted: true },
      response_summary: {
        provider_shipment_reference_present: true,
        safe_message: "accepted without raw reference",
      },
    })
    const lifecycle = buildDeliveryHubAcceptedShipmentLifecycleSnapshot({ shipment })
    const post = jest.fn(async () => ({}))
    const client = { post } as unknown as YandexShipmentStatusClientLike

    const result = await refreshDeliveryHubAcceptedShipmentStatus({
      lifecycle,
      shipment,
      connection: acceptedConnection,
      pg_connection: buildStatusUpdatePg(shipment),
      correlation_id: "admin-refresh-missing-reference",
      client,
    })

    expect(post).not.toHaveBeenCalled()
    expect(result).toEqual(
      expect.objectContaining({
        status: "blocked",
        provider_call_attempted: false,
        blocked_reason_code: "provider_shipment_reference_required",
        lifecycle_classification: "accepted_shipment",
        accepted: false,
        provider_status: null,
        persistence: {
          attempted: false,
          performed: false,
          outcome: "not_refreshed",
        },
      })
    )
  })

  it("builds an order-scoped Delivery Hub snapshot without exposing execution references", () => {
    const shipment = buildAcceptedShipment({
      metadata: {
        provider_shipment_reference: "provider-order-widget-raw-ref-should-not-leak",
        redacted: true,
      },
    })
    const operations = buildDeliveryHubAdminShipmentOperationsViewModel({
      lifecycle: buildDeliveryHubAcceptedShipmentLifecycleSnapshot({ shipment }),
      shipment,
      connection: acceptedConnection,
    })
    const snapshot = buildDeliveryHubAdminOrderDeliveryHubSnapshot({
      order_id: "order_admin_ops",
      order: buildOrderWithDeliveryHubFulfillment(),
      shipments: [shipment],
      shipment_operations: [{ id: shipment.id, operations }],
      connections: [
        {
          ...acceptedConnection,
          config: {
            default_warehouse_id: "wh_admin_ops",
          },
        },
      ],
      warehouses: [
        {
          id: "wh_admin_ops",
          name: "Admin warehouse",
          enabled: true,
          country_code: "RU",
          city: "Moscow",
          address_line_1: "Tverskaya 1",
          contact_name: "Ops",
          contact_phone: "+79990000000",
          provider_code: "yandex",
          provider_warehouse_id: "ya-wh-admin",
          metadata: {},
          created_at: "2026-04-24T05:00:00.000Z",
          updated_at: "2026-04-24T05:00:00.000Z",
        },
      ],
      execution_enabled: false,
    })

    expect(snapshot).toEqual(
      expect.objectContaining({
        safe: true,
        order: expect.objectContaining({
          id: "order_admin_ops",
          email_present: true,
          customer_contact: expect.objectContaining({
            phone_present: true,
          }),
        }),
        delivery: expect.objectContaining({
          selection_present: true,
          selection_source: "fulfillment_data",
          method: expect.objectContaining({
            carrier_label: "Yandex Delivery",
            mode_code: "dropoff_point_to_pickup_point",
          }),
          pickup_point: expect.objectContaining({
            name: "PVZ 2",
          }),
        }),
        source: expect.objectContaining({
          warehouse: expect.objectContaining({
            id: "wh_admin_ops",
          }),
        }),
        shipment_readiness: expect.objectContaining({
          available: false,
          blocked_reason_code: "shipment_already_created",
        }),
        action_posture: expect.objectContaining({
          refresh_status: "available",
          cancel: "available",
        }),
      })
    )

    const json = JSON.stringify(snapshot)
    expect(json).not.toContain("exec_admin_ops_accepted_reference")
    expect(json).not.toContain("idempotency_admin_ops_raw_key")
    expect(json).not.toContain("provider-order-widget-raw-ref-should-not-leak")
    expect(json).not.toContain("leaked_quote_key")
    expect(json).not.toContain("leaked_offer_id")
  })

  it("blocks duplicate order-scoped shipment creation when a shipment already exists", () => {
    const shipment = buildAcceptedShipment()
    const snapshot = buildDeliveryHubAdminOrderDeliveryHubSnapshot({
      order_id: "order_admin_ops",
      order: buildOrderWithDeliveryHubFulfillment(),
      shipments: [shipment],
      shipment_operations: [],
      execution_enabled: true,
    })

    expect(snapshot.shipment_readiness).toEqual(
      expect.objectContaining({
        available: false,
        status: "already_created",
        blocked_reason_code: "shipment_already_created",
      })
    )
    expect(snapshot.action_posture.create_shipment).toBe("blocked")
  })

  it("keeps order-scoped create blocked when execution flag is off", () => {
    const snapshot = buildDeliveryHubAdminOrderDeliveryHubSnapshot({
      order_id: "order_admin_ops",
      order: buildOrderWithDeliveryHubFulfillment(),
      shipments: [],
      shipment_operations: [],
      execution_enabled: false,
    })

    expect(snapshot.shipment_readiness).toEqual(
      expect.objectContaining({
        available: false,
        status: "blocked",
        blocked_reason_code: "shipment_execution_disabled",
        execution_enabled: false,
      })
    )
    expect(snapshot.action_posture.create_shipment).toBe("blocked")
  })

  it("keeps order-scoped create blocked in Phase 6 even when the order context is otherwise ready", () => {
    const snapshot = buildDeliveryHubAdminOrderDeliveryHubSnapshot({
      order_id: "order_admin_ops",
      order: buildOrderWithDeliveryHubFulfillment(),
      shipments: [],
      shipment_operations: [],
      execution_enabled: true,
    })

    expect(snapshot.shipment_readiness).toEqual(
      expect.objectContaining({
        available: false,
        status: "blocked",
        blocked_reason_code: "order_scoped_shipment_create_not_materialized",
        execution_enabled: true,
      })
    )
    expect(snapshot.action_posture.create_shipment).toBe("blocked")
  })

  it("wires explicit admin auth middleware for accepted shipment operation routes", () => {
    const middlewaresSource = readFileSync(
      resolve(process.cwd(), "src/api/middlewares.ts"),
      "utf8"
    )

    expect(middlewaresSource).toMatch(
      /matcher:\s*"\/admin\/delivery\/shipments\/:execution_reference\/operations"[\s\S]*?methods:\s*\["GET"\][\s\S]*?middlewares:\s*\[adminAuth\]/
    )
    expect(middlewaresSource).toMatch(
      /matcher:\s*"\/admin\/delivery\/shipments\/:execution_reference\/operations\/refresh-status"[\s\S]*?methods:\s*\["POST"\][\s\S]*?middlewares:\s*\[adminAuth\]/
    )
    expect(middlewaresSource).toMatch(
      /matcher:\s*"\/admin\/delivery\/shipments\/:execution_reference\/operations\/cancel"[\s\S]*?methods:\s*\["POST"\][\s\S]*?middlewares:\s*\[adminAuth\]/
    )
    expect(middlewaresSource).toMatch(
      /matcher:\s*"\/admin\/delivery\/shipments\/:execution_reference\/operations\/retry"[\s\S]*?methods:\s*\["POST"\][\s\S]*?middlewares:\s*\[adminAuth\]/
    )
    expect(middlewaresSource).toMatch(
      /matcher:\s*"\/admin\/orders\/:id\/delivery-hub"[\s\S]*?methods:\s*\["GET"\][\s\S]*?middlewares:\s*\[adminAuth\]/
    )
    expect(middlewaresSource).toMatch(
      /matcher:\s*"\/admin\/orders\/:id\/delivery-hub\/shipments"[\s\S]*?methods:\s*\["POST"\][\s\S]*?middlewares:\s*\[adminAuth,\s*validateAndTransformBody\(AdminOrderDeliveryHubCreateShipmentSchema\)\]/
    )
    expect(middlewaresSource).toMatch(
      /matcher:\s*"\/admin\/orders\/:id\/delivery-hub\/shipments\/:shipment_id\/refresh"[\s\S]*?methods:\s*\["POST"\][\s\S]*?middlewares:\s*\[adminAuth,\s*validateAndTransformBody\(AdminOrderDeliveryHubShipmentActionSchema\)\]/
    )
    expect(middlewaresSource).toMatch(
      /matcher:\s*"\/admin\/orders\/:id\/delivery-hub\/shipments\/:shipment_id\/cancel"[\s\S]*?methods:\s*\["POST"\][\s\S]*?middlewares:\s*\[adminAuth,\s*validateAndTransformBody\(AdminOrderDeliveryHubShipmentActionSchema\)\]/
    )
  })
})

function buildOrderWithDeliveryHubFulfillment() {
  return {
    id: "order_admin_ops",
    display_id: 42,
    email: "customer@example.test",
    shipping_address: {
      first_name: "Ivan",
      last_name: "Petrov",
      phone: "+79990000000",
      city: "Moscow",
      address_1: "Customer street 1",
      postal_code: "125009",
      country_code: "RU",
    },
    items: [
      {
        id: "item_1",
        title: "Item 1",
        quantity: 2,
        requires_shipping: true,
        variant: {
          sku: "SKU-1",
        },
      },
    ],
    fulfillments: [
      {
        id: "ful_admin_ops",
        provider_id: "deliveryhub_deliveryhub",
        location_id: "sloc_admin_ops",
        data: {
          delivery: {
            version: 1,
            connection_id: "conn_admin_ops",
            mode_code: "dropoff_point_to_pickup_point",
            quote_reference: {
              id: "dhsel_safe_reference",
              version: 1,
            },
            quote: {
              carrier_code: "yandex",
              carrier_label: "Yandex Delivery",
              amount: 499,
              currency_code: "RUB",
              customer_price: {
                amount: 399,
                currency_code: "RUB",
                source: "fixed",
                policy_id: "policy_safe",
              },
              delivery_eta_min: 1,
              delivery_eta_max: 2,
              pickup_point_required: true,
              pickup_window_required: false,
            },
            pickup_point: {
              provider_point_id: "pvz_backend_only_should_not_be_rendered_raw",
              name: "PVZ 2",
              address: "PVZ street 2",
              city: "Moscow",
              region: "Moscow",
              postal_code: "125009",
              lat: 55.75,
              lng: 37.61,
              is_origin_dropoff_allowed: false,
              is_destination_pickup_allowed: true,
              payment_methods: ["card"],
            },
            pickup_window: null,
          },
        },
      },
    ],
  }
}

function buildAcceptedShipment(
  overrides?: Partial<DeliveryHubShipmentRecord>
): DeliveryHubShipmentRecord {
  return {
    id: "shipment_admin_ops_1",
    execution_reference: "exec_admin_ops_accepted_reference",
    idempotency_key: "idempotency_admin_ops_raw_key",
    provider_code: "deliveryhub",
    connection_id: "conn_admin_ops",
    mode_code: "dropoff_point_to_pickup_point",
    order_id: "order_admin_ops",
    fulfillment_id: "ful_admin_ops",
    cart_id: "cart_admin_ops",
    shipping_option_id: "deliveryhub:dropoff_point_to_pickup_point",
    location_id: "sloc_admin_ops",
    quote_reference_id: "quote_admin_ops",
    quote_reference_version: 1,
    correlation_id: "corr_admin_ops_should_not_leak",
    outcome: "accepted",
    status: "dispatch_accepted",
    accepted: true,
    succeeded: true,
    provider_shipment_reference_present: true,
    provider_correlation_reference_present: true,
    label_document_present: false,
    attachment_document_present: false,
    provider_status_summary: {},
    status_refresh_outcome: "not_refreshed",
    status_refreshed_at: null,
    request_summary: {
      redacted: true,
    },
    response_summary: {
      provider_shipment_reference_present: true,
      provider_correlation_reference_present: true,
      safe_message: "accepted",
      redacted: true,
    },
    metadata: {
      redacted: true,
    },
    created_at: "2026-04-24T05:30:00.000Z",
    updated_at: "2026-04-24T05:35:00.000Z",
    ...overrides,
  }
}

function buildStatusUpdatePg(seed: DeliveryHubShipmentRecord): DeliveryHubPgConnection {
  let current = { ...seed }

  const pg = {
    raw: jest.fn(async (sqlInput: unknown, bindingsInput?: unknown[]) => {
      const sql = String(sqlInput ?? "")
      const bindings = Array.isArray(bindingsInput) ? bindingsInput : []

      if (sql.includes("create table if not exists delivery_shipments")) {
        return { rows: [] }
      }

      if (sql.includes("alter table delivery_shipments")) {
        return { rows: [] }
      }

      if (sql.includes("select") && sql.includes("from delivery_shipments")) {
        const executionReference = typeof bindings[0] === "string" ? bindings[0] : ""
        return {
          rows: executionReference === current.execution_reference ? [current] : [],
        }
      }

      if (sql.includes("update delivery_shipments")) {
        const executionReference = typeof bindings[4] === "string" ? bindings[4] : ""

        if (executionReference !== current.execution_reference) {
          return { rowCount: 0, rows: [] }
        }

        current = {
          ...current,
          provider_status_summary:
            typeof bindings[0] === "string" ? JSON.parse(bindings[0]) : {},
          status_refresh_outcome:
            bindings[1] === "refreshed" || bindings[1] === "failed"
              ? bindings[1]
              : "not_refreshed",
          status_refreshed_at:
            typeof bindings[2] === "string" ? bindings[2] : "2026-04-24T06:05:00.000Z",
          metadata: typeof bindings[3] === "string" ? JSON.parse(bindings[3]) : {},
          updated_at: "2026-04-24T06:05:00.000Z",
        }

        return { rowCount: 1, rows: [current] }
      }

      return { rows: [] }
    }),
  }

  return pg as unknown as DeliveryHubPgConnection
}
