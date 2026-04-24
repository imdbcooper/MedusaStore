import { describe, expect, it } from "@jest/globals"
import {
  requestDeliveryHubShipmentManualRetry,
  resolveDeliveryHubShipmentRetryReadiness,
} from "../../modules/delivery-hub/shipment-retry-policy"
import type { DeliveryHubAcceptedShipmentLifecycleSnapshot } from "../../modules/delivery-hub/shipment-lifecycle-read-model"
import type { DeliveryHubExecutionLedgerRecord } from "../../modules/delivery-hub/storage/execution-ledger-repository"
import type { DeliveryHubShipmentRecord } from "../../modules/delivery-hub/storage/shipments-repository"

describe("Delivery Hub shipment retry policy", () => {
  it("marks readiness available only for failed_blocked with intact ledger/idempotency and no duplicate markers", () => {
    const lifecycle = buildLifecycle({
      classification: "failed_dispatch",
      accepted: false,
      provider: {
        provider_code: "deliveryhub",
        mode_code: "dropoff_point_to_pickup_point",
        dispatch_status: "dispatch_failed",
        dispatch_outcome: "failed",
        provider_shipment_reference_present: false,
        provider_correlation_reference_present: false,
      },
    })
    const shipment = buildShipment({
      outcome: "failed",
      status: "dispatch_failed",
      accepted: false,
      succeeded: false,
      provider_shipment_reference_present: false,
      metadata: { redacted: true },
      response_summary: { redacted: true },
      provider_status_summary: {
        neutral_status: "failed",
      },
    })
    const ledger = buildLedger({
      current_state: "failed_blocked",
      terminal_completed: false,
      terminal_blocked: true,
      transitions_count: 2,
    })

    const readiness = resolveDeliveryHubShipmentRetryReadiness({
      lifecycle,
      shipment,
      ledger,
    })

    expect(readiness).toEqual(
      expect.objectContaining({
        version: 1,
        available: true,
        blocked_reason_code: null,
        ledger_state: "failed_blocked",
        terminal_completed: false,
        terminal_blocked: true,
        idempotency_linked: true,
        accepted_shipment_present: false,
        provider_shipment_reference_present: false,
        redacted: true,
      })
    )
  })

  it("blocks accepted shipment retry", () => {
    const readiness = resolveDeliveryHubShipmentRetryReadiness({
      lifecycle: buildLifecycle({ classification: "accepted_shipment", accepted: true }),
      shipment: buildShipment(),
      ledger: buildLedger(),
    })

    expect(readiness.available).toBe(false)
    expect(readiness.blocked_reason_code).toBe("accepted_shipment_not_retryable")
  })

  it("blocks cancelled neutral status retry", () => {
    const readiness = resolveDeliveryHubShipmentRetryReadiness({
      lifecycle: buildLifecycle(),
      shipment: buildShipment({
        outcome: "failed",
        status: "dispatch_failed",
        accepted: false,
        succeeded: false,
        provider_status_summary: { neutral_status: "cancelled" },
      }),
      ledger: buildLedger(),
    })

    expect(readiness.available).toBe(false)
    expect(readiness.blocked_reason_code).toBe("neutral_status_not_retryable")
  })

  it("blocks delivered or returned terminal statuses", () => {
    const delivered = resolveDeliveryHubShipmentRetryReadiness({
      lifecycle: buildLifecycle(),
      shipment: buildShipment({
        outcome: "failed",
        status: "dispatch_failed",
        accepted: false,
        succeeded: false,
        provider_status_summary: { neutral_status: "delivered" },
      }),
      ledger: buildLedger(),
    })
    const returned = resolveDeliveryHubShipmentRetryReadiness({
      lifecycle: buildLifecycle(),
      shipment: buildShipment({
        outcome: "failed",
        status: "dispatch_failed",
        accepted: false,
        succeeded: false,
        provider_status_summary: { neutral_status: "returned" },
      }),
      ledger: buildLedger(),
    })

    expect(delivered.blocked_reason_code).toBe("neutral_status_not_retryable")
    expect(returned.blocked_reason_code).toBe("neutral_status_not_retryable")
  })

  it("blocks when ledger or idempotency posture is missing", () => {
    const noLedger = resolveDeliveryHubShipmentRetryReadiness({
      lifecycle: buildLifecycle(),
      shipment: buildShipment({
        outcome: "failed",
        status: "dispatch_failed",
        accepted: false,
        succeeded: false,
        provider_shipment_reference_present: false,
        metadata: { redacted: true },
        response_summary: { redacted: true },
        provider_status_summary: { neutral_status: "failed" },
      }),
      ledger: null,
    })

    const brokenIdempotency = resolveDeliveryHubShipmentRetryReadiness({
      lifecycle: buildLifecycle(),
      shipment: buildShipment({
        outcome: "failed",
        status: "dispatch_failed",
        accepted: false,
        succeeded: false,
        provider_shipment_reference_present: false,
        metadata: { redacted: true },
        response_summary: { redacted: true },
        provider_status_summary: { neutral_status: "failed" },
      }),
      ledger: buildLedger({ reservation_dedupe_scope: "" }),
    })

    expect(noLedger.blocked_reason_code).toBe("execution_ledger_required")
    expect(brokenIdempotency.blocked_reason_code).toBe("execution_ledger_idempotency_required")
  })

  it("blocks drifted lifecycle", () => {
    const readiness = resolveDeliveryHubShipmentRetryReadiness({
      lifecycle: buildLifecycle({ classification: "drift_blocked", accepted: false }),
      shipment: buildShipment({
        outcome: "failed",
        status: "dispatch_failed",
        accepted: false,
        succeeded: false,
        provider_shipment_reference_present: false,
        metadata: { redacted: true },
        response_summary: { redacted: true },
        provider_status_summary: { neutral_status: "failed" },
      }),
      ledger: buildLedger(),
    })

    expect(readiness.blocked_reason_code).toBe("lifecycle_drift_blocked")
  })

  it("blocks duplicate prevention when provider reference is already present", () => {
    const readiness = resolveDeliveryHubShipmentRetryReadiness({
      lifecycle: buildLifecycle({
        provider: {
          provider_code: "deliveryhub",
          mode_code: "dropoff_point_to_pickup_point",
          dispatch_status: "dispatch_failed",
          dispatch_outcome: "failed",
          provider_shipment_reference_present: true,
          provider_correlation_reference_present: false,
        },
      }),
      shipment: buildShipment({
        outcome: "failed",
        status: "dispatch_failed",
        accepted: false,
        succeeded: false,
        provider_shipment_reference_present: true,
        metadata: { provider_shipment_reference: "provider-should-not-leak" },
        response_summary: { redacted: true },
        provider_status_summary: { neutral_status: "failed" },
      }),
      ledger: buildLedger(),
    })

    expect(readiness.blocked_reason_code).toBe("provider_shipment_reference_present")
  })

  it("returns truthful blocked-only retry result even when readiness passes and sanitizes leaks", async () => {
    const lifecycle = buildLifecycle({
      classification: "failed_dispatch",
      accepted: false,
      provider: {
        provider_code: "deliveryhub",
        mode_code: "dropoff_point_to_pickup_point",
        dispatch_status: "dispatch_failed",
        dispatch_outcome: "failed",
        provider_shipment_reference_present: false,
        provider_correlation_reference_present: false,
      },
    })
    const shipment = buildShipment({
      outcome: "failed",
      status: "dispatch_failed",
      accepted: false,
      succeeded: false,
      provider_shipment_reference_present: false,
      metadata: { redacted: true },
      response_summary: { redacted: true },
      provider_status_summary: { neutral_status: "failed" },
    })
    const ledger = buildLedger({
      current_state: "failed_blocked",
      terminal_completed: false,
      terminal_blocked: true,
      transitions_count: 1,
    })

    const result = await requestDeliveryHubShipmentManualRetry({
      lifecycle,
      shipment,
      ledger,
      correlation_id: "corr_retry_policy_1",
    })

    expect(result).toEqual(
      expect.objectContaining({
        version: 1,
        status: "blocked",
        provider_call_attempted: false,
        blocked_reason_code: "retry_execution_not_materialized",
        retry: expect.objectContaining({
          attempted: false,
          performed: false,
          semantics_certainty: "readiness_only_no_live_redispatch",
          redacted: true,
        }),
      })
    )

    const json = JSON.stringify(result)
    expect(json).not.toContain("provider-should-not-leak")
    expect(json).not.toContain("authorization")
    expect(json).not.toContain('"quote_key":"')
  })
})

function buildLifecycle(
  overrides?: Partial<DeliveryHubAcceptedShipmentLifecycleSnapshot>
): DeliveryHubAcceptedShipmentLifecycleSnapshot {
  return {
    version: 1,
    classification: "failed_dispatch",
    accepted: false,
    safe: true,
    shipment: null,
    provider: {
      provider_code: "deliveryhub",
      mode_code: "dropoff_point_to_pickup_point",
      dispatch_status: "dispatch_failed",
      dispatch_outcome: "failed",
      provider_shipment_reference_present: false,
      provider_correlation_reference_present: false,
    },
    dispatch: {
      attempted: true,
      accepted: false,
      succeeded: false,
      outcome: "failed",
      result_decision: "blocked",
      blocked_reason_code: null,
    },
    ledger: {
      linked: true,
      state: "failed_blocked",
      terminal_completed: false,
      terminal_blocked: true,
      execution_reference_preview: "ex***01",
      idempotency_key_preview: "id***01",
      transition_count: 1,
      audit_event_count: 1,
    },
    context: {
      connection_id: "conn_1",
      order_id: "order_1",
      fulfillment_id: "ful_1",
      cart_id: "cart_1",
      shipping_option_id: "so_1",
      location_id: "loc_1",
      quote_reference: {
        id: "quote_1",
        version: 1,
      },
      correlation_id_present: true,
    },
    timestamps: {
      created_at: null,
      updated_at: null,
    },
    anti_leak_confirmations: {
      raw_provider_payloads_included: false,
      auth_headers_included: false,
      credentials_included: false,
      raw_yandex_response_body_included: false,
      quote_key_included: false,
    },
    ...overrides,
  }
}

function buildShipment(overrides?: Partial<DeliveryHubShipmentRecord>): DeliveryHubShipmentRecord {
  return {
    id: "shipment_retry_policy_1",
    execution_reference: "exec_retry_policy_1",
    idempotency_key: "idem_retry_policy_1",
    provider_code: "deliveryhub",
    connection_id: "conn_1",
    mode_code: "dropoff_point_to_pickup_point",
    order_id: "order_1",
    fulfillment_id: "ful_1",
    cart_id: "cart_1",
    shipping_option_id: "so_1",
    location_id: "loc_1",
    quote_reference_id: "quote_1",
    quote_reference_version: 1,
    correlation_id: "corr_retry_policy",
    outcome: "accepted",
    status: "dispatch_accepted",
    accepted: true,
    succeeded: true,
    provider_shipment_reference_present: true,
    provider_correlation_reference_present: true,
    label_document_present: false,
    attachment_document_present: false,
    provider_status_summary: {
      neutral_status: "accepted",
    },
    status_refresh_outcome: "not_refreshed",
    status_refreshed_at: null,
    request_summary: {
      redacted: true,
    },
    response_summary: {
      redacted: true,
    },
    metadata: {
      redacted: true,
    },
    created_at: "2026-04-24T08:00:00.000Z",
    updated_at: "2026-04-24T08:00:00.000Z",
    ...overrides,
  }
}

function buildLedger(input?: {
  current_state?: string
  terminal_completed?: boolean
  terminal_blocked?: boolean
  transitions_count?: number
  reservation_dedupe_scope?: string | null
}): DeliveryHubExecutionLedgerRecord {
  const transitionsCount = input?.transitions_count ?? 1

  return {
    execution: {
      version: 1,
      record_type: "deliveryhub_controlled_shipment_execution",
      lifecycle: "controlled_future_orchestration",
      provider: {
        provider_key: "deliveryhub",
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
      },
      execution: {
        execution_reference: "exec_retry_policy_1",
        provider_operation_label: "Delivery Hub create_shipment",
        provider_key: "deliveryhub",
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
        operation: "create_shipment",
        idempotency_key: "idem_retry_policy_1",
        plan_fingerprint: "plan_fp_1",
        execution_fingerprint: "exec_fp_1",
        reservation_fingerprint: "res_fp_1",
      },
      correlation: {
        connection_id: "conn_1",
        mode_code: "dropoff_point_to_pickup_point",
        quote_reference_id: "quote_1",
        order_id: "order_1",
        order_display_id: "1001",
        fulfillment_id: "ful_1",
        fulfillment_location_id: "loc_1",
      },
      current_state: (input?.current_state ?? "failed_blocked") as DeliveryHubExecutionLedgerRecord["execution"]["current_state"],
      allowed_transitions: [],
      plan_snapshot: {
        operation: "create_shipment",
        connection_id: "conn_1",
        mode_code: "dropoff_point_to_pickup_point",
        item_count: 1,
        destination_kind: "pickup_point",
        origin_kind: "dropoff_point",
      },
      reservation: {
        dedupe_scope: "deliveryhub:create_shipment",
        reservation_key: "idem_retry_policy_1",
        reservation_fingerprint: "res_fp_1",
        plan_fingerprint: "plan_fp_1",
        drift_status: "in_sync",
      },
      terminality: {
        completed: input?.terminal_completed ?? false,
        blocked: input?.terminal_blocked ?? true,
      },
    },
    reservation: {
      version: 1,
      reservation_type: "deliveryhub_execution_idempotency_reservation",
      dedupe_scope: (input?.reservation_dedupe_scope ?? "deliveryhub:create_shipment") as "deliveryhub:create_shipment",
      reservation_key: "idem_retry_policy_1",
      reservation_fingerprint: "res_fp_1",
      execution_reference: "exec_retry_policy_1",
      provider_key: "deliveryhub",
      operation: "create_shipment",
      connection_id: "conn_1",
      mode_code: "dropoff_point_to_pickup_point",
      quote_reference_id: "quote_1",
      plan_fingerprint: "plan_fp_1",
      execution_fingerprint: "exec_fp_1",
      matched_identity_fields: [
        {
          field: "execution_reference",
          value_preview: "ex***01",
        },
      ],
    },
    transitions: Array.from({ length: transitionsCount }, (_, index) => ({
      sequence: index + 1,
      recorded_at: "2026-04-24T08:00:00.000Z",
      execution_reference: "exec_retry_policy_1",
      from: "dispatch_ready",
      to: "failed_blocked",
      reason: "Transition dispatch_ready -> failed_blocked is allowed with reason code execution_blocked.",
    })),
    audit_events: [
      {
        sequence: 1,
        recorded_at: "2026-04-24T08:00:00.000Z",
        execution_reference: "exec_retry_policy_1",
        event: {
          version: 1,
          event_type: "deliveryhub.execution.dispatch_ready",
          execution_reference: "exec_retry_policy_1",
          current_state: "dispatch_ready",
          summary: "Execution prepared",
          correlation: {
            connection_id: "conn_1",
            mode_code: "dropoff_point_to_pickup_point",
            quote_reference_id: "quote_1",
            order_id: "order_1",
            fulfillment_id: "ful_1",
          },
          identity: {
            idempotency_key: "idem_retry_policy_1",
            plan_fingerprint: "plan_fp_1",
            execution_fingerprint: "exec_fp_1",
            reservation_fingerprint: "res_fp_1",
          },
        },
      },
    ],
  }
}
