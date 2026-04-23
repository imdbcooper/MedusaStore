import { describe, expect, it } from "@jest/globals"
import type { DeliveryHubProviderExecutionPlan } from "../../modules/delivery-hub/fulfillment-provider-bridge"
import { createDeliveryHubQuoteReference } from "../../modules/delivery-hub/cart-selection"
import { DELIVERY_HUB_MODE_CODE } from "../../modules/delivery-hub/constants"
import {
  DELIVERY_HUB_EXECUTION_STATE,
  buildDeliveryHubControlledExecutionAuditDraft,
  buildDeliveryHubControlledExecutionIdentity,
  buildDeliveryHubControlledExecutionRecordDraft,
  buildDeliveryHubControlledExecutionReservationDraft,
  canApplyDeliveryHubControlledExecution,
  canDispatchDeliveryHubControlledExecution,
  canFailBlockedDeliveryHubControlledExecution,
  canFinalizeDeliveryHubControlledExecution,
  canReserveDeliveryHubControlledExecution,
  canStartDeliveryHubControlledExecution,
  compareDeliveryHubExecutionReservationDrafts,
  listDeliveryHubControlledExecutionTransitions,
  validateDeliveryHubExecutionStateTransition,
} from "../../modules/delivery-hub/shipment-execution-contract"
import {
  DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
  DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
} from "../../modules/delivery-hub/shipping-option-contract"

describe("Delivery Hub controlled execution contract", () => {
  it("allows only canonical controlled execution state transitions", () => {
    expect(validateDeliveryHubExecutionStateTransition({
      from: DELIVERY_HUB_EXECUTION_STATE.planned,
      to: DELIVERY_HUB_EXECUTION_STATE.reserved,
    })).toEqual({
      allowed: true,
      reason:
        "Transition planned -> reserved is allowed with reason code reservation_projected.",
    })

    expect(validateDeliveryHubExecutionStateTransition({
      from: DELIVERY_HUB_EXECUTION_STATE.reserved,
      to: DELIVERY_HUB_EXECUTION_STATE.dispatchReady,
    }).allowed).toBe(true)

    expect(validateDeliveryHubExecutionStateTransition({
      from: DELIVERY_HUB_EXECUTION_STATE.dispatchReady,
      to: DELIVERY_HUB_EXECUTION_STATE.resultReceived,
    })).toEqual({
      allowed: false,
      reason:
        "Transition dispatch_ready -> result_received is not allowed by the controlled execution contract.",
    })

    expect(listDeliveryHubControlledExecutionTransitions()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: DELIVERY_HUB_EXECUTION_STATE.planned,
          to: DELIVERY_HUB_EXECUTION_STATE.reserved,
          reason_code: "reservation_projected",
        }),
        expect.objectContaining({
          from: DELIVERY_HUB_EXECUTION_STATE.applicationReady,
          to: DELIVERY_HUB_EXECUTION_STATE.completed,
          reason_code: "application_projection_completed",
        }),
        expect.objectContaining({
          from: DELIVERY_HUB_EXECUTION_STATE.dispatchInflight,
          to: DELIVERY_HUB_EXECUTION_STATE.failedBlocked,
          reason_code: "execution_blocked",
        }),
      ])
    )
  })

  it("exposes pure decision helpers for start reserve dispatch apply finalize and fail-blocked semantics", () => {
    expect(canStartDeliveryHubControlledExecution(DELIVERY_HUB_EXECUTION_STATE.planned)).toBe(true)
    expect(canStartDeliveryHubControlledExecution(DELIVERY_HUB_EXECUTION_STATE.reserved)).toBe(false)

    expect(canReserveDeliveryHubControlledExecution(DELIVERY_HUB_EXECUTION_STATE.planned)).toBe(true)
    expect(canReserveDeliveryHubControlledExecution(DELIVERY_HUB_EXECUTION_STATE.dispatchReady)).toBe(false)

    expect(canDispatchDeliveryHubControlledExecution(DELIVERY_HUB_EXECUTION_STATE.dispatchReady)).toBe(true)
    expect(canDispatchDeliveryHubControlledExecution(DELIVERY_HUB_EXECUTION_STATE.reserved)).toBe(false)

    expect(canApplyDeliveryHubControlledExecution(DELIVERY_HUB_EXECUTION_STATE.applicationReady)).toBe(true)
    expect(canApplyDeliveryHubControlledExecution(DELIVERY_HUB_EXECUTION_STATE.resultReceived)).toBe(false)

    expect(canFinalizeDeliveryHubControlledExecution(DELIVERY_HUB_EXECUTION_STATE.applicationReady)).toBe(true)
    expect(canFinalizeDeliveryHubControlledExecution(DELIVERY_HUB_EXECUTION_STATE.completed)).toBe(false)

    expect(canFailBlockedDeliveryHubControlledExecution(DELIVERY_HUB_EXECUTION_STATE.planned)).toBe(true)
    expect(canFailBlockedDeliveryHubControlledExecution(DELIVERY_HUB_EXECUTION_STATE.dispatchInflight)).toBe(true)
    expect(canFailBlockedDeliveryHubControlledExecution(DELIVERY_HUB_EXECUTION_STATE.completed)).toBe(false)
    expect(canFailBlockedDeliveryHubControlledExecution(DELIVERY_HUB_EXECUTION_STATE.failedBlocked)).toBe(false)
  })

  it("builds deterministic execution identity reservation record and audit drafts from the normalized execution plan", () => {
    const executionPlan = buildExecutionPlan()

    const identity = buildDeliveryHubControlledExecutionIdentity(executionPlan)
    const reservationDraft = buildDeliveryHubControlledExecutionReservationDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
    })
    const recordDraft = buildDeliveryHubControlledExecutionRecordDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
      reservation_draft: reservationDraft,
    })
    const auditDraft = buildDeliveryHubControlledExecutionAuditDraft({
      execution_plan: executionPlan,
      execution_identity: identity,
      current_state: DELIVERY_HUB_EXECUTION_STATE.reserved,
      event_type: "deliveryhub.execution.reserved",
    })

    expect(identity).toEqual({
      execution_reference: expect.stringMatching(/^dhprev_[a-f0-9]{16}$/),
      provider_operation_label: "create_shipment:dropoff_point_to_pickup_point",
      provider_key: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
      provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
      provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
      operation: "create_shipment",
      idempotency_key: expect.stringMatching(/^deliveryhub:preview:create_shipment:[a-f0-9]{64}$/),
      plan_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      execution_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      reservation_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    })

    expect(reservationDraft).toEqual({
      version: 1,
      reservation_type: "deliveryhub_execution_idempotency_reservation",
      dedupe_scope: "deliveryhub:create_shipment",
      reservation_key: identity.idempotency_key,
      reservation_fingerprint: identity.reservation_fingerprint,
      execution_reference: identity.execution_reference,
      provider_key: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
      operation: "create_shipment",
      connection_id: "conn_ready",
      mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
      quote_reference_id: executionPlan.quote_reference.id,
      plan_fingerprint: identity.plan_fingerprint,
      execution_fingerprint: identity.execution_fingerprint,
      matched_identity_fields: expect.arrayContaining([
        {
          field: "provider_key",
          value_preview: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
        },
        {
          field: "execution_reference",
          value_preview: identity.execution_reference,
        },
        {
          field: "plan_fingerprint",
          value_preview: identity.plan_fingerprint,
        },
      ]),
    })

    expect(recordDraft).toEqual({
      version: 1,
      record_type: "deliveryhub_controlled_shipment_execution",
      lifecycle: "controlled_future_orchestration",
      provider: {
        provider_key: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
        provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
        provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
      },
      execution: identity,
      correlation: {
        connection_id: "conn_ready",
        mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
        quote_reference_id: executionPlan.quote_reference.id,
        order_id: "order_1",
        order_display_id: 42,
        fulfillment_id: "ful_1",
        fulfillment_location_id: "sloc_1",
      },
      current_state: DELIVERY_HUB_EXECUTION_STATE.planned,
      allowed_transitions: expect.arrayContaining([
        expect.objectContaining({
          from: DELIVERY_HUB_EXECUTION_STATE.planned,
          to: DELIVERY_HUB_EXECUTION_STATE.reserved,
        }),
      ]),
      plan_snapshot: {
        operation: "create_shipment",
        connection_id: "conn_ready",
        mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
        item_count: 1,
        destination_kind: "pickup_point",
        origin_kind: "dropoff_point",
      },
      reservation: {
        dedupe_scope: "deliveryhub:create_shipment",
        reservation_key: identity.idempotency_key,
        reservation_fingerprint: identity.reservation_fingerprint,
        plan_fingerprint: identity.plan_fingerprint,
        drift_status: "in_sync",
      },
      terminality: {
        completed: false,
        blocked: false,
      },
    })

    expect(auditDraft).toEqual({
      version: 1,
      event_type: "deliveryhub.execution.reserved",
      execution_reference: identity.execution_reference,
      current_state: DELIVERY_HUB_EXECUTION_STATE.reserved,
      summary:
        "Controlled execution deliveryhub.execution.reserved remains a pure projection for dropoff_point_to_pickup_point.",
      correlation: {
        connection_id: "conn_ready",
        mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
        quote_reference_id: executionPlan.quote_reference.id,
        order_id: "order_1",
        fulfillment_id: "ful_1",
      },
      identity: {
        idempotency_key: identity.idempotency_key,
        plan_fingerprint: identity.plan_fingerprint,
        execution_fingerprint: identity.execution_fingerprint,
        reservation_fingerprint: identity.reservation_fingerprint,
      },
    })
  })

  it("detects reservation drift when plan fingerprint or dedupe scope changes", () => {
    const executionPlan = buildExecutionPlan()
    const expected = buildDeliveryHubControlledExecutionReservationDraft({
      execution_plan: executionPlan,
    })
    const driftedPlan = buildExecutionPlan({
      items: [
        {
          line_item_id: "item_1",
          quantity: 2,
        },
      ],
    })
    const incoming = buildDeliveryHubControlledExecutionReservationDraft({
      execution_plan: driftedPlan,
    })
    const scopeDriftIncoming = {
      ...incoming,
      dedupe_scope: "deliveryhub:create_shipment:unexpected",
    } as unknown as typeof incoming

    expect(compareDeliveryHubExecutionReservationDrafts({ expected, incoming })).toEqual({
      status: "drifted",
      drift_reasons: expect.arrayContaining([
        "plan_fingerprint_mismatch",
        "execution_fingerprint_mismatch",
        "reservation_fingerprint_mismatch",
      ]),
      expected_reservation_fingerprint: expected.reservation_fingerprint,
      incoming_reservation_fingerprint: incoming.reservation_fingerprint,
      expected_plan_fingerprint: expected.plan_fingerprint,
      incoming_plan_fingerprint: incoming.plan_fingerprint,
      expected_execution_fingerprint: expected.execution_fingerprint,
      incoming_execution_fingerprint: incoming.execution_fingerprint,
    })

    expect(
      compareDeliveryHubExecutionReservationDrafts({
        expected,
        incoming: scopeDriftIncoming,
      }).drift_reasons
    ).toEqual(expect.arrayContaining(["reservation_scope_mismatch"]))
  })

  it("classifies isolated reservation fingerprint drift truthfully", () => {
    const executionPlan = buildExecutionPlan()
    const expected = buildDeliveryHubControlledExecutionReservationDraft({
      execution_plan: executionPlan,
    })
    const incoming = {
      ...expected,
      reservation_fingerprint: `${expected.reservation_fingerprint.slice(0, 63)}0`,
    }

    expect(compareDeliveryHubExecutionReservationDrafts({ expected, incoming })).toEqual({
      status: "drifted",
      drift_reasons: ["reservation_fingerprint_mismatch"],
      expected_reservation_fingerprint: expected.reservation_fingerprint,
      incoming_reservation_fingerprint: incoming.reservation_fingerprint,
      expected_plan_fingerprint: expected.plan_fingerprint,
      incoming_plan_fingerprint: incoming.plan_fingerprint,
      expected_execution_fingerprint: expected.execution_fingerprint,
      incoming_execution_fingerprint: incoming.execution_fingerprint,
    })
  })
})

function buildExecutionPlan(overrides?: {
  items?: Array<{ line_item_id: string | null; quantity: number }>
}): DeliveryHubProviderExecutionPlan {
  return {
    version: 1 as const,
    provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
    provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
    operation: "create_shipment" as const,
    connection_id: "conn_ready",
    mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
    quote_reference: createDeliveryHubQuoteReference({
      connection_id: "conn_ready",
      quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
      quote_key: "quote_contract",
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
    items: overrides?.items ?? [
      {
        line_item_id: "item_1",
        quantity: 1,
      },
    ],
    outbound_request: {
      method: "POST" as const,
      path: "/shipments" as const,
      headers: {
        authorization: "Bearer delivery-hub-provider-credential",
        "content-type": "application/json" as const,
      },
      body: {
        provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
        provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
        connection_id: "conn_ready",
        mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
        quote_reference: createDeliveryHubQuoteReference({
          connection_id: "conn_ready",
          quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
          quote_key: "quote_contract",
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
        items: overrides?.items ?? [
          {
            line_item_id: "item_1",
            quantity: 1,
          },
        ],
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
      },
    },
  }
}
