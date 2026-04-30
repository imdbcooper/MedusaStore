import { describe, expect, it } from "@jest/globals"
import {
  buildDeliveryHubCutoverApprovalArtifact,
  buildDeliveryHubCutoverCandidate,
  buildDeliveryHubCutoverPreconditions,
} from "../../modules/delivery-hub"
import { buildDeliveryHubShippingOptionId } from "../../modules/delivery-hub/shipping-option-contract"

describe("Delivery Hub cutover approval artifact", () => {
  it("builds a non-executable decision template from preconditions and candidate evidence", () => {
    const preconditions = buildDeliveryHubCutoverPreconditions()
    const candidate = buildDeliveryHubCutoverCandidate({
      cart_id: "cart_cutover_decision",
      metadata: {
        delivery_hub: {
          selection: {
            version: 1,
            provider_code: "yandex",
            connection_id: "conn_decision",
            quote_type: "dropoff_point_to_pickup_point",
            quote_reference: {
              id: "dhsel_0123456789abcdef0123456789abcdef",
              version: 1,
            },
            quote: {
              carrier_code: "neutral_carrier",
              carrier_label: "Neutral Carrier",
              amount: 749,
              currency_code: "RUB",
              delivery_eta_min: 2,
              delivery_eta_max: 4,
              pickup_point_required: true,
              pickup_window_required: false,
            },
            pickup_point: {
              provider_point_id: "pvz_decision",
              provider_point_code: null,
              name: "Decision pickup point",
              address: "Decision pickup point address",
              city: "Moscow",
              region: "Moscow",
              postal_code: "101000",
              lat: null,
              lng: null,
              is_origin_dropoff_allowed: true,
              is_destination_pickup_allowed: true,
              payment_methods: [],
            },
            pickup_window: null,
            correlation_id: "corr_decision",
            updated_at: "2026-04-28T06:00:00.000Z",
          },
        },
      },
      current_shipping_options: [
        {
          id: buildDeliveryHubShippingOptionId("dropoff_point_to_pickup_point"),
          name: "Delivery Hub Pickup Candidate",
          provider_id: "deliveryhub_deliveryhub",
          data: {
            id: buildDeliveryHubShippingOptionId("dropoff_point_to_pickup_point"),
            provider_code: "deliveryhub",
            mode_code: "dropoff_point_to_pickup_point",
          },
        },
      ],
      selection_readiness: {
        status: "ready",
        issues: [],
        selection: null,
        quote_context: null,
      },
    })

    const artifact = buildDeliveryHubCutoverApprovalArtifact({
      cart_id: "cart_cutover_decision",
      preconditions,
      candidate: {
        ...candidate,
        can_commit_shipping_method: false,
        checkout_source_of_truth: "unchanged",
        guardrails: {
          ...candidate.guardrails,
          can_commit_shipping_method: false,
        },
      },
      generated_at: "2026-04-28T06:30:00.000Z",
    })

    expect(artifact.artifact_type).toBe("delivery_hub_checkout_cutover_decision")
    expect(artifact.decision_status).toBe("not_requested")
    expect(artifact.cart_id).toBe("cart_cutover_decision")
    expect(artifact.candidate_summary.available).toBe(true)
    expect(artifact.candidate_summary.candidate_status).toBe("ready_for_review")
    expect(artifact.required_acknowledgements.approval_does_not_enable_commit).toBe(false)
    expect(artifact.required_signoffs.operator).toBe("pending")
    expect(artifact.commit_controls).toEqual({
      can_commit_shipping_method: false,
      requires_separate_implementation: true,
      requires_feature_flag: true,
      approval_is_executable: false,
    })
    expect(artifact.candidate_summary.can_commit_shipping_method).toBe(false)
    expect(artifact.preconditions_summary.guardrails.can_commit_shipping_method).toBe(false)
    expect(artifact.non_executable_notice).toContain("no approval execution")
  })

  it("supports missing cart/candidate behavior without creating executable approval state", () => {
    const artifact = buildDeliveryHubCutoverApprovalArtifact({
      preconditions: buildDeliveryHubCutoverPreconditions(),
      generated_at: "2026-04-28T06:30:00.000Z",
    })

    expect(artifact.cart_id).toBeNull()
    expect(artifact.candidate_summary.available).toBe(false)
    expect(artifact.candidate_summary.candidate_status).toBe("not_requested")
    expect(artifact.candidate_summary.blocked_reasons).toContain("candidate_not_requested")
    expect(artifact.commit_controls.can_commit_shipping_method).toBe(false)
    expect(artifact.commit_controls.approval_is_executable).toBe(false)
  })

  it("rejects unsafe candidate evidence and never leaks provider internals", () => {
    const preconditions = buildDeliveryHubCutoverPreconditions()
    const candidate = buildDeliveryHubCutoverCandidate({
      cart_id: "cart_cutover_decision",
      metadata: {},
      current_shipping_options: [],
    })

    expect(() =>
      buildDeliveryHubCutoverApprovalArtifact({
        preconditions,
        candidate: {
          ...candidate,
          candidate_shipping_option_name: "token=must-not-leak",
        },
      })
    ).toThrow(/must not expose provider internals/)
  })

  it("rejects any commit-enabled evidence before returning an artifact", () => {
    const preconditions = buildDeliveryHubCutoverPreconditions()
    const candidate = buildDeliveryHubCutoverCandidate({
      cart_id: "cart_cutover_decision",
      metadata: {},
      current_shipping_options: [],
    })

    expect(() =>
      buildDeliveryHubCutoverApprovalArtifact({
        preconditions,
        candidate: {
          ...candidate,
          can_commit_shipping_method: true as false,
        },
      })
    ).toThrow(/requires a safe candidate/)
  })
})
