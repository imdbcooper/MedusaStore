import { describe, expect, it } from "@jest/globals"
import {
  buildOrderDeliveryHubCancelShipmentUrl,
  buildOrderDeliveryHubCreateShipmentUrl,
  buildOrderDeliveryHubRefreshShipmentUrl,
  buildOrderDeliveryHubSnapshotUrl,
  deriveOrderDeliveryHubWidgetState,
  type OrderDeliveryHubWidgetSnapshot,
} from "../order-delivery-hub-state"

describe("order Delivery Hub widget state", () => {
  it("builds order-scoped urls without requiring manual execution references", () => {
    expect(buildOrderDeliveryHubSnapshotUrl("order 1/unsafe")).toBe(
      "/admin/orders/order%201%2Funsafe/delivery-hub"
    )
    expect(buildOrderDeliveryHubCreateShipmentUrl("order_1")).toBe(
      "/admin/orders/order_1/delivery-hub/shipments"
    )
    expect(buildOrderDeliveryHubRefreshShipmentUrl("order_1", "shipment/1")).toBe(
      "/admin/orders/order_1/delivery-hub/shipments/shipment%2F1/refresh"
    )
    expect(buildOrderDeliveryHubCancelShipmentUrl("order_1", "shipment/1")).toBe(
      "/admin/orders/order_1/delivery-hub/shipments/shipment%2F1/cancel"
    )
  })

  it("derives ready order widget state from backend-authoritative action posture", () => {
    const snapshot: OrderDeliveryHubWidgetSnapshot = {
      version: 1,
      safe: true,
      order: {
        id: "order_1",
        customer_contact: {
          name: "Ivan Petrov",
          email_present: true,
          phone_present: true,
        },
      },
      delivery: {
        selection_present: true,
        method: {
          carrier_label: "Yandex Delivery",
          mode_code: "warehouse_to_pickup_point",
          amount: 499,
          currency_code: "RUB",
        },
        pickup_point: {
          name: "PVZ 1",
          address: "Tverskaya 1",
          city: "Moscow",
          postal_code: "125009",
        },
      },
      source: {
        warehouse: {
          id: "wh_1",
          name: "Main warehouse",
          city: "Moscow",
          address_line_1: "Tverskaya 2",
          contact_phone_present: true,
        },
      },
      package: {
        item_count: 2,
        total_quantity: 3,
        ready: true,
        blockers: [],
      },
      shipment_readiness: {
        available: true,
        status: "ready",
        blocked_reason_code: null,
        blocked_reason: null,
        execution_enabled: true,
      },
      shipments: [
        {
          id: "shipment_1",
          operations: {
            provider: {
              dispatch_status: "dispatch_accepted",
            },
            status: {
              current: {
                neutral_status: "in_transit",
              },
              refresh: {
                available: true,
              },
            },
            cancel: {
              readiness: {
                available: true,
              },
            },
            shipment: {
              label_document_present: true,
              attachment_document_present: false,
            },
          },
        },
      ],
      safe_logs: [
        {
          code: "delivery_selection_present",
          message: "Delivery Hub delivery selection is available in the order context.",
          redacted: true,
        },
      ],
      action_posture: {
        create_shipment: "available",
        refresh_status: "available",
        cancel: "available",
        retry: "blocked",
      },
    }

    const state = deriveOrderDeliveryHubWidgetState(snapshot)

    expect(state).toEqual(
      expect.objectContaining({
        status: "ready",
        method: "Yandex Delivery · warehouse_to_pickup_point · 499 RUB",
        pickupPoint: "PVZ 1, Tverskaya 1, Moscow, 125009",
        customer: "Ivan Petrov · email present · phone present",
        warehouse: "Main warehouse · Moscow · Tverskaya 2 · phone present",
        packageReadiness: "2 items / 3 pcs ready",
        shipmentReadiness: "Create shipment is available",
        providerStatus: "in_transit",
        createEnabled: true,
        refreshEnabled: true,
        cancelEnabled: true,
        shipmentId: "shipment_1",
        labelPresent: true,
      })
    )
  })

  it("keeps blocked widget state safe and free from raw provider references", () => {
    const snapshot: OrderDeliveryHubWidgetSnapshot = {
      version: 1,
      safe: true,
      delivery: {
        selection_present: false,
      },
      package: {
        item_count: 0,
        total_quantity: 0,
        ready: false,
        blockers: ["Order items are missing."],
      },
      shipment_readiness: {
        available: false,
        status: "blocked",
        blocked_reason_code: "delivery_selection_required",
        blocked_reason: "Delivery Hub selection is required before a shipment can be created from the order.",
        execution_enabled: false,
      },
      safe_logs: [
        {
          code: "delivery_selection_required",
          message: "Delivery Hub selection is required before a shipment can be created from the order.",
          redacted: true,
        },
      ],
      action_posture: {
        create_shipment: "blocked",
        refresh_status: "blocked",
        cancel: "blocked",
        retry: "blocked",
      },
    }

    const state = deriveOrderDeliveryHubWidgetState(snapshot)

    expect(state.createEnabled).toBe(false)
    expect(state.refreshEnabled).toBe(false)
    expect(state.cancelEnabled).toBe(false)
    expect(JSON.stringify(state)).not.toContain("execution_reference")
    expect(JSON.stringify(state)).not.toContain("quote_key")
    expect(JSON.stringify(state)).not.toContain("offer_id")
    expect(JSON.stringify(state)).not.toContain("authorization")
  })
})
