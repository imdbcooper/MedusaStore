import { describe, expect, it, jest } from "@jest/globals"
import { buildDeliveryHubAdminShipmentOperationsViewModel } from "../../modules/delivery-hub/admin-shipment-operations"
import { buildDeliveryHubAcceptedShipmentLifecycleSnapshot } from "../../modules/delivery-hub/shipment-lifecycle-read-model"
import { refreshDeliveryHubAcceptedShipmentStatus } from "../../modules/delivery-hub/shipment-status-polling"
import type { DeliveryConnectionRecord } from "../../modules/delivery-hub/domain/connection"
import type { DeliveryHubPgConnection } from "../../modules/delivery-hub/storage/pg"
import type { DeliveryHubShipmentRecord } from "../../modules/delivery-hub/storage/shipments-repository"
import type { YandexShipmentStatusClientLike } from "../../modules/delivery-hub/adapters/yandex/shipment-status"

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
          cancel: "not_materialized",
          retry: "not_materialized",
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
    expect(JSON.stringify(view)).not.toContain("provider-failed-raw-id-should-not-leak")
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
})

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
