import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import {
  createDeliveryHubService,
  getDeliveryHubPgConnection,
  isDeliveryHubError,
} from "../../../modules/delivery-hub"
import { normalizeDeliveryHubShippingOptionData } from "../../../modules/delivery-hub/shipping-option-contract"
import {
  redactRecord,
  redactSensitiveText,
} from "../../../modules/delivery-hub/security/redaction"

const AdminDeliveryWarehouseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    enabled: z.boolean(),
    country_code: z.string().nullable(),
    city: z.string().nullable(),
    address_line_1: z.string().nullable(),
    contact_name: z.string().nullable(),
    contact_phone: z.string().nullable(),
    provider_code: z.string().nullable(),
    provider_warehouse_id: z.string().nullable(),
    metadata: z.record(z.unknown()),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict()

const AdminDeliveryConnectionConfigSchema = z
  .object({
    auto_confirm: z.boolean().optional(),
    label_format: z.string().optional(),
    default_warehouse_id: z.string().nullable().optional(),
    default_warehouse: AdminDeliveryWarehouseSchema.optional(),
  })
  .strict()

const AdminDeliveryConnectionSchema = z
  .object({
    id: z.string(),
    provider_code: z.string(),
    name: z.string(),
    status: z.string(),
    mode: z.string(),
    enabled: z.boolean(),
    country_code: z.string().nullable(),
    credentials_state: z.string(),
    credentials_fingerprint: z.string().nullable(),
    credentials_last_validated_at: z.string().nullable(),
    credentials_last_error_code: z.string().nullable(),
    credentials_present: z.boolean(),
    config: AdminDeliveryConnectionConfigSchema,
    metadata: z.record(z.unknown()),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict()

const AdminDeliveryTestQuoteResponseSchema = z
  .object({
    ok: z.literal(true),
    connection: AdminDeliveryConnectionSchema,
    quotes: z.array(z.record(z.unknown())),
    correlation_id: z.string(),
  })
  .strict()

const AdminDeliveryProviderSchema = z
  .object({
    code: z.string(),
    label: z.string(),
    capabilities: z.array(z.string()),
    supported_mode_codes: z.array(z.string()),
  })
  .strict()

const AdminDeliveryConnectionTestResultSchema = z
  .object({
    ok: z.boolean(),
    provider_code: z.string(),
    diagnostics: z.record(z.unknown()),
  })
  .strict()

const AdminDeliveryEventLogSchema = z
  .object({
    id: z.string(),
    connection_id: z.string().nullable(),
    provider_code: z.string(),
    kind: z.string(),
    correlation_id: z.string(),
    success: z.boolean(),
    request_summary: z.record(z.unknown()),
    response_summary: z.record(z.unknown()),
    error_code: z.string().nullable(),
    created_at: z.string(),
  })
  .strict()

const AdminDeliveryShippingOptionDataSchema = z
  .object({
    version: z.number().int().min(1),
    provider_code: z.string(),
    provider_id: z.string(),
    id: z.string(),
    mode_code: z.string(),
  })
  .strict()

const AdminDeliveryShippingOptionSnapshotSchema = z
  .object({
    id: z.string(),
    name: z.string().nullable().optional(),
    provider_id: z.string().nullable().optional(),
    data: AdminDeliveryShippingOptionDataSchema.nullable().optional(),
  })
  .strict()

const AdminDeliveryShippingOptionPlannerIssueSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    mode_code: z.string().nullable(),
  })
  .strict()

const AdminDeliveryProjectedShippingOptionSchema = z
  .object({
    status: z.literal("projected"),
    mode_code: z.string(),
    data: AdminDeliveryShippingOptionDataSchema,
    supporting_connection_ids: z.array(z.string()),
  })
  .strict()

const AdminDeliveryDeferredShippingOptionSchema = z
  .object({
    status: z.literal("deferred"),
    mode_code: z.string(),
    data: AdminDeliveryShippingOptionDataSchema,
    issues: z.array(
      AdminDeliveryShippingOptionPlannerIssueSchema.extend({
        connection_id: z.string(),
        provider_code: z.string(),
      }).strict()
    ),
  })
  .strict()

const AdminDeliveryShippingOptionConnectionPlanSchema = z
  .object({
    connection_id: z.string(),
    provider_code: z.string(),
    status: z.enum(["projected", "deferred", "skipped"]),
    projected_mode_codes: z.array(z.string()),
    issues: z.array(AdminDeliveryShippingOptionPlannerIssueSchema),
  })
  .strict()

const AdminDeliveryShippingOptionPreviewPlanSchema = z
  .object({
    provider_code: z.string(),
    provider_id: z.string(),
    desired_options: z.array(AdminDeliveryProjectedShippingOptionSchema),
    deferred_options: z.array(AdminDeliveryDeferredShippingOptionSchema),
    connection_plans: z.array(AdminDeliveryShippingOptionConnectionPlanSchema),
  })
  .strict()

const AdminDeliveryShippingOptionPreviewReconciliationSchema = z
  .object({
    provider_code: z.string(),
    provider_id: z.string(),
    create_candidates: z.array(
      z
        .object({
          desired: AdminDeliveryProjectedShippingOptionSchema,
        })
        .strict()
    ),
    update_candidates: z.array(
      z
        .object({
          desired: AdminDeliveryProjectedShippingOptionSchema,
          current: AdminDeliveryShippingOptionSnapshotSchema,
          normalized_current_data: AdminDeliveryShippingOptionDataSchema,
          reasons: z.array(z.string()),
        })
        .strict()
    ),
    unchanged: z.array(
      z
        .object({
          desired: AdminDeliveryProjectedShippingOptionSchema,
          current: AdminDeliveryShippingOptionSnapshotSchema,
          normalized_current_data: AdminDeliveryShippingOptionDataSchema,
        })
        .strict()
    ),
    orphaned_managed_options: z.array(
      z
        .object({
          current: AdminDeliveryShippingOptionSnapshotSchema,
          normalized_current_data: AdminDeliveryShippingOptionDataSchema,
          reason: z.string(),
        })
        .strict()
    ),
    ignored_foreign_options: z.array(
      z
        .object({
          current: AdminDeliveryShippingOptionSnapshotSchema,
        })
        .strict()
    ),
  })
  .strict()

const AdminDeliveryShippingOptionPreviewSummarySchema = z
  .object({
    current_option_count: z.number().int().min(0),
    desired_option_count: z.number().int().min(0),
    deferred_option_count: z.number().int().min(0),
    deferred_issue_count: z.number().int().min(0),
    connection_plan_count: z.number().int().min(0),
    create_candidate_count: z.number().int().min(0),
    update_candidate_count: z.number().int().min(0),
    unchanged_count: z.number().int().min(0),
    orphaned_managed_option_count: z.number().int().min(0),
    ignored_foreign_option_count: z.number().int().min(0),
  })
  .strict()

const AdminDeliveryShippingOptionPreviewSchema = z
  .object({
    provider_code: z.string(),
    provider_id: z.string(),
    current_options: z.array(AdminDeliveryShippingOptionSnapshotSchema),
    plan: AdminDeliveryShippingOptionPreviewPlanSchema,
    reconciliation: AdminDeliveryShippingOptionPreviewReconciliationSchema,
    summary: AdminDeliveryShippingOptionPreviewSummarySchema,
  })
  .strict()

const AdminDeliveryFulfillmentBridgePreviewStepSchema = z
  .object({
    key: z.enum([
      "shipping_option_contract",
      "fulfillment_payload",
      "calculated_price_data",
      "create_fulfillment_payload",
    ]),
    ready: z.boolean(),
    message: z.string(),
  })
  .strict()

const AdminDeliveryFulfillmentBridgePlannerIssueSchema = AdminDeliveryShippingOptionPlannerIssueSchema.extend({
  connection_id: z.string(),
  provider_code: z.string(),
}).strict()

const AdminDeliveryFulfillmentBridgeQuoteReferenceSchema = z
  .object({
    id: z.string(),
    version: z.number().int().min(1),
  })
  .strict()

const AdminDeliveryFulfillmentBridgeQuoteSchema = z
  .object({
    carrier_code: z.string(),
    carrier_label: z.string(),
    amount: z.number(),
    currency_code: z.string(),
    delivery_eta_min: z.number().nullable(),
    delivery_eta_max: z.number().nullable(),
    pickup_point_required: z.boolean(),
    pickup_window_required: z.boolean(),
  })
  .strict()

const AdminDeliveryFulfillmentBridgePickupPointSchema = z
  .object({
    provider_point_id: z.string(),
    provider_point_code: z.string().nullable(),
    name: z.string(),
    address: z.string(),
    city: z.string().nullable(),
    region: z.string().nullable(),
    postal_code: z.string().nullable(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    is_origin_dropoff_allowed: z.boolean(),
    is_destination_pickup_allowed: z.boolean(),
    payment_methods: z.array(z.string()),
  })
  .strict()

const AdminDeliveryFulfillmentBridgePickupWindowSchema = z
  .object({
    date: z.string(),
    time_from: z.string().nullable(),
    time_to: z.string().nullable(),
    interval_utc: z
      .object({
        from: z.string(),
        to: z.string(),
      })
      .strict(),
    label: z.string(),
  })
  .strict()

const AdminDeliveryFulfillmentBridgeSelectionSchema = z
  .object({
    version: z.number().int().min(1),
    connection_id: z.string(),
    quote_type: z.string(),
    quote_reference: AdminDeliveryFulfillmentBridgeQuoteReferenceSchema,
    quote: AdminDeliveryFulfillmentBridgeQuoteSchema,
    pickup_point: AdminDeliveryFulfillmentBridgePickupPointSchema,
    pickup_window: AdminDeliveryFulfillmentBridgePickupWindowSchema.nullable(),
    updated_at: z.string(),
  })
  .strict()

const AdminDeliveryFulfillmentBridgeFulfillmentDataSchema = z
  .object({
    version: z.number().int().min(1),
    connection_id: z.string(),
    mode_code: z.string(),
    quote_reference: AdminDeliveryFulfillmentBridgeQuoteReferenceSchema,
    quote: AdminDeliveryFulfillmentBridgeQuoteSchema,
    pickup_point: AdminDeliveryFulfillmentBridgePickupPointSchema,
    pickup_window: AdminDeliveryFulfillmentBridgePickupWindowSchema.nullable(),
  })
  .strict()

const AdminDeliveryFulfillmentBridgeCalculatedPriceDataSchema = z
  .object({
    version: z.number().int().min(1),
    provider_code: z.string(),
    connection_id: z.string(),
    mode_code: z.string(),
    quote_reference: AdminDeliveryFulfillmentBridgeQuoteReferenceSchema,
    quote: AdminDeliveryFulfillmentBridgeQuoteSchema,
    pickup_point: AdminDeliveryFulfillmentBridgePickupPointSchema,
    pickup_window: AdminDeliveryFulfillmentBridgePickupWindowSchema.nullable(),
  })
  .strict()

const AdminDeliveryFulfillmentBridgePayloadSchema = z
  .object({
    version: z.number().int().min(1),
    option: AdminDeliveryShippingOptionDataSchema,
    fulfillment_data: AdminDeliveryFulfillmentBridgeFulfillmentDataSchema,
    calculated_price_data: AdminDeliveryFulfillmentBridgeCalculatedPriceDataSchema,
  })
  .strict()

const AdminDeliveryFulfillmentBridgeCreatePayloadSchema = z
  .object({
    version: z.number().int().min(1),
    delivery: AdminDeliveryFulfillmentBridgePayloadSchema,
    order: z
      .object({
        id: z.string().nullable(),
        display_id: z.union([z.string(), z.number()]).nullable(),
        currency_code: z.string().nullable(),
      })
      .strict(),
    fulfillment: z
      .object({
        id: z.string().nullable(),
        location_id: z.string().nullable(),
      })
      .strict(),
    items: z.array(
      z
        .object({
          line_item_id: z.string().nullable(),
          quantity: z.number().int().min(1),
        })
        .strict()
    ),
  })
  .strict()

const AdminDeliveryFulfillmentBridgeModePreviewSchema = z
  .object({
    mode_code: z.string(),
    status: z.enum(["ready", "error"]),
    rollout_status: z.enum(["projected", "deferred", "unconfigured"]),
    supporting_connection_ids: z.array(z.string()),
    blocking_issues: z.array(AdminDeliveryFulfillmentBridgePlannerIssueSchema),
    steps: z.array(AdminDeliveryFulfillmentBridgePreviewStepSchema),
    selection: AdminDeliveryFulfillmentBridgeSelectionSchema.nullable(),
    shipping_option_data: AdminDeliveryShippingOptionDataSchema.nullable(),
    fulfillment_payload: AdminDeliveryFulfillmentBridgePayloadSchema.nullable(),
    create_fulfillment_payload: AdminDeliveryFulfillmentBridgeCreatePayloadSchema.nullable(),
    shipment_execution: z
      .object({
        materialized: z.literal(false),
        reason: z.string(),
      })
      .strict(),
    error: z
      .object({
        message: z.string(),
      })
      .nullable(),
  })
  .strict()

const AdminDeliveryFulfillmentBridgePreviewSummarySchema = z
  .object({
    mode_count: z.number().int().min(0),
    ready_mode_count: z.number().int().min(0),
    error_mode_count: z.number().int().min(0),
    projected_mode_count: z.number().int().min(0),
    deferred_mode_count: z.number().int().min(0),
  })
  .strict()

const AdminDeliveryFulfillmentBridgePreviewSchema = z
  .object({
    version: z.number().int().min(1),
    provider_code: z.string(),
    provider_id: z.string(),
    mode_previews: z.array(AdminDeliveryFulfillmentBridgeModePreviewSchema),
    summary: AdminDeliveryFulfillmentBridgePreviewSummarySchema,
  })
  .strict()

const AdminDeliveryExecutionPlanObservabilityStepSchema = z
  .object({
    key: z.enum([
      "delivery_payload",
      "order_context",
      "fulfillment_context",
      "items",
      "provider_execution_plan",
      "execution_identity",
      "outbound_payload_preview",
      "persistence_audit_preview",
      "preflight_eligibility",
      "provider_dispatch_preview",
      "shipment_result_preview",
      "fulfillment_application_preview",
      "failure_handling_preview",
      "shipment_execution",
    ]),
    ready: z.boolean(),
    message: z.string(),
  })
  .strict()

const AdminDeliveryExecutionPreflightReasonSchema = z
  .object({
    code: z.string(),
    message: z.string(),
  })
  .strict()

const AdminDeliveryExecutionPreflightPrerequisiteSchema = z
  .object({
    code: z.string(),
    label: z.string(),
    status: z.literal("required_future_work"),
  })
  .strict()

const AdminDeliveryExecutionPreflightBlockedActionSchema = z
  .object({
    code: z.string(),
    label: z.string(),
    blocked: z.literal(true),
  })
  .strict()

const AdminDeliveryExecutionPreflightEligibilitySchema = z
  .object({
    version: z.number().int().min(1),
    redacted: z.literal(true),
    current_mode: z.literal("preview_only"),
    decision: z.enum(["eligible_when_enabled", "not_ready"]),
    real_execution_enabled: z.literal(false),
    future_execution_flag: z
      .object({
        name: z.literal("DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED"),
        status: z.literal("future_inert_not_read"),
        description: z.string(),
      })
      .strict(),
    reasons: z.array(AdminDeliveryExecutionPreflightReasonSchema),
    required_prerequisites: z.array(AdminDeliveryExecutionPreflightPrerequisiteSchema),
    confirmations: z
      .object({
        shipment_execution_disabled: z.literal(true),
        provider_calls_disabled: z.literal(true),
        persistence_writes_disabled: z.literal(true),
        checkout_cutover_disabled: z.literal(true),
      })
      .strict(),
    blocked_live_actions: z.array(AdminDeliveryExecutionPreflightBlockedActionSchema),
  })
  .strict()

const AdminDeliveryExecutionIdentityPreviewSchema = z
  .object({
    version: z.number().int().min(1),
    redacted: z.literal(true),
    operation: z.literal("create_shipment"),
    provider_operation_label: z.string(),
    provider_operation_reference: z.string(),
    plan_fingerprint: z.string(),
    execution_fingerprint: z.string(),
    idempotency_key_preview: z.string(),
  })
  .strict()


const AdminDeliveryProviderDispatchBlockedActionSchema = z
  .object({
    code: z.string(),
    label: z.string(),
    reason: z.string(),
    blocked: z.literal(true),
  })
  .strict()

const AdminDeliveryProviderDispatchPreviewSchema = z
  .object({
    version: z.number().int().min(1),
    redacted: z.literal(true),
    current_mode: z.literal("preview_only"),
    dispatch_decision: z.enum(["ready_for_future_dispatch", "not_dispatched"]),
    provider: z
      .object({
        provider_code: z.string(),
        provider_id: z.string(),
        provider_key: z.string(),
        adapter_operation: z.literal("create_shipment"),
        adapter_operation_label: z.string(),
      })
      .strict(),
    command_identity: z
      .object({
        provider_operation_reference: z.string().nullable(),
        idempotency_key_preview: z.string().nullable(),
        plan_fingerprint: z.string().nullable(),
        execution_fingerprint: z.string().nullable(),
      })
      .strict(),
    command_envelope_summary: z
      .object({
        connection_id_present: z.boolean(),
        mode_code: z.string().nullable(),
        origin_kind: z.enum(["fulfillment_location", "dropoff_point", "unknown"]),
        destination_kind: z.enum(["pickup_point", "unknown"]),
        quote_reference_present: z.boolean(),
        offer_reference_present: z.boolean(),
        package_reference_present: z.boolean(),
        order_reference_present: z.boolean(),
        fulfillment_reference_present: z.boolean(),
        pickup_scheduling_reference_present: z.boolean(),
        dropoff_scheduling_reference_present: z.boolean(),
        item_count: z.number().int().min(0),
      })
      .strict(),
    blocked_dispatch_actions: z.array(AdminDeliveryProviderDispatchBlockedActionSchema),
    confirmations: z
      .object({
        adapter_invocation_disabled: z.literal(true),
        provider_network_calls_disabled: z.literal(true),
        shipment_creation_disabled: z.literal(true),
        label_creation_disabled: z.literal(true),
        order_mutation_disabled: z.literal(true),
        persistence_writes_disabled: z.literal(true),
        checkout_cutover_disabled: z.literal(true),
      })
      .strict(),
  })
  .strict()

const AdminDeliveryShipmentResultBlockedActionSchema = z
  .object({
    code: z.string(),
    label: z.string(),
    reason: z.string(),
    blocked: z.literal(true),
  })
  .strict()

const AdminDeliveryShipmentResultPreviewSchema = z
  .object({
    version: z.number().int().min(1),
    redacted: z.literal(true),
    current_mode: z.literal("preview_only"),
    result_decision: z.enum(["projected_for_future_execution", "not_materialized"]),
    projected_result_status: z.enum(["projected_for_future_execution", "not_materialized"]),
    result_kind: z.literal("shipment_result"),
    normalization_target: z.literal("deliveryhub_shipment_result"),
    provider_normalization_target: z.literal("create_shipment_response"),
    identity_linkage: z
      .object({
        provider_operation_reference: z.string().nullable(),
        idempotency_key_preview: z.string().nullable(),
        plan_fingerprint: z.string().nullable(),
        execution_fingerprint: z.string().nullable(),
      })
      .strict(),
    artifact_summary: z
      .object({
        external_shipment_reference_present: z.boolean(),
        tracking_reference_present: z.boolean(),
        label_document_present: z.boolean(),
        pickup_booking_present: z.boolean(),
        pickup_interval_present: z.boolean(),
        status_timeline_present: z.boolean(),
        failure_placeholder_present: z.boolean(),
        rollback_placeholder_present: z.boolean(),
      })
      .strict(),
    blocked_materialization_actions: z.array(AdminDeliveryShipmentResultBlockedActionSchema),
    confirmations: z
      .object({
        provider_response_fetch_disabled: z.literal(true),
        adapter_invocation_disabled: z.literal(true),
        shipment_creation_disabled: z.literal(true),
        label_persistence_disabled: z.literal(true),
        order_mutation_disabled: z.literal(true),
        fulfillment_persistence_disabled: z.literal(true),
        checkout_cutover_disabled: z.literal(true),
      })
      .strict(),
  })
  .strict()

const AdminDeliveryFailureHandlingBlockedActionSchema = z
  .object({
    code: z.string(),
    label: z.string(),
    reason: z.string(),
    blocked: z.literal(true),
  })
  .strict()

const AdminDeliveryFailureHandlingFailureClassSchema = z
  .object({
    code: z.enum([
      "provider_dispatch_failure",
      "provider_timeout",
      "provider_response_invalid",
      "shipment_result_rejected",
      "application_projection_blocked",
    ]),
    retry_eligibility: z.enum(["eligible_when_enabled", "blocked"]),
    compensation_requirement: z.enum(["required_when_enabled", "not_required"]),
    manual_intervention: z.enum(["required_when_enabled", "not_required"]),
    reason_bucket: z.enum([
      "dispatch_transport",
      "provider_timeout",
      "response_normalization",
      "result_semantics",
      "application_projection",
    ]),
  })
  .strict()

const AdminDeliveryFailureHandlingPreviewSchema = z
  .object({
    version: z.number().int().min(1),
    redacted: z.literal(true),
    current_mode: z.literal("preview_only"),
    failure_path_decision: z.enum(["projected_retry_policy", "no_live_failure_path"]),
    projected_failure_status: z.enum([
      "manual_intervention_required_when_enabled",
      "not_applicable_in_preview",
    ]),
    failure_classes: z.array(AdminDeliveryFailureHandlingFailureClassSchema),
    identity_linkage: z
      .object({
        provider_operation_reference: z.string().nullable(),
        idempotency_key_preview: z.string().nullable(),
        plan_fingerprint: z.string().nullable(),
        execution_fingerprint: z.string().nullable(),
      })
      .strict(),
    retry_projection: z
      .object({
        eligibility: z.enum(["eligible_when_enabled", "blocked"]),
        policy: z.literal("deterministic_preview_only"),
        retry_block_reasons: z.array(z.string()),
        scheduling_status: z.literal("disabled"),
      })
      .strict(),
    compensation_projection: z
      .object({
        requirement: z.enum(["required_when_enabled", "not_required"]),
        write_plan_status: z.literal("disabled"),
        rollback_status: z.literal("disabled"),
        blocked_actions: z.array(z.string()),
      })
      .strict(),
    manual_intervention_projection: z
      .object({
        status: z.enum(["required_when_enabled", "not_required"]),
        reason_markers: z.array(z.string()),
      })
      .strict(),
    blocked_failure_actions: z.array(AdminDeliveryFailureHandlingBlockedActionSchema),
    confirmations: z
      .object({
        retry_scheduling_disabled: z.literal(true),
        rollback_disabled: z.literal(true),
        compensation_writes_disabled: z.literal(true),
        order_mutation_disabled: z.literal(true),
        fulfillment_mutation_disabled: z.literal(true),
        event_persistence_disabled: z.literal(true),
        provider_redispatch_disabled: z.literal(true),
        checkout_cutover_disabled: z.literal(true),
      })
      .strict(),
  })
  .strict()

const AdminDeliveryFulfillmentApplicationBlockedActionSchema = z
  .object({
    code: z.string(),
    label: z.string(),
    reason: z.string(),
    blocked: z.literal(true),
  })
  .strict()

const AdminDeliveryFulfillmentApplicationPreviewSchema = z
  .object({
    version: z.number().int().min(1),
    redacted: z.literal(true),
    current_mode: z.literal("preview_only"),
    application_decision: z.enum(["projected_for_future_application", "not_applied"]),
    projected_application_status: z.enum(["projected_for_future_application", "not_applied"]),
    application_target: z.literal("medusa_fulfillment_mutation_plan"),
    application_scope: z.literal("backend_admin_only"),
    mutation_semantics: z
      .object({
        fulfillment_data_patch_present: z.boolean(),
        shipment_reference_linkage_present: z.boolean(),
        tracking_projection_present: z.boolean(),
        label_document_reference_linkage_present: z.boolean(),
        status_transition_application_present: z.boolean(),
        audit_linkage_present: z.boolean(),
      })
      .strict(),
    identity_linkage: z
      .object({
        provider_operation_reference: z.string().nullable(),
        idempotency_key_preview: z.string().nullable(),
        plan_fingerprint: z.string().nullable(),
        execution_fingerprint: z.string().nullable(),
      })
      .strict(),
    persistence_linkage: z
      .object({
        execution_reference_present: z.boolean(),
        idempotency_reservation_present: z.boolean(),
        audit_log_reference_present: z.boolean(),
      })
      .strict(),
    blocked_application_actions: z.array(AdminDeliveryFulfillmentApplicationBlockedActionSchema),
    confirmations: z
      .object({
        order_mutation_disabled: z.literal(true),
        fulfillment_persistence_disabled: z.literal(true),
        shipment_persistence_disabled: z.literal(true),
        label_persistence_disabled: z.literal(true),
        event_persistence_disabled: z.literal(true),
        checkout_cutover_disabled: z.literal(true),
      })
      .strict(),
  })
  .strict()

const AdminDeliveryExecutionPersistenceAuditFieldSchema = z
  .object({
    field: z.string(),
    value_preview: z.string(),
  })
  .strict()

const AdminDeliveryExecutionPersistenceAuditSchema = z
  .object({
    version: z.number().int().min(1),
    redacted: z.literal(true),
    status: z.enum(["ready", "blocked"]),
    metadata_patch: z
      .object({
        target: z.literal("fulfillment_execution_shadow"),
        action: z.literal("merge"),
        fields: z.array(AdminDeliveryExecutionPersistenceAuditFieldSchema),
      })
      .strict(),
    execution_record: z
      .object({
        ready: z.boolean(),
        draft: z.record(z.unknown()).nullable(),
        record_type: z.literal("deliveryhub_shipment_execution"),
        operation: z.literal("create_shipment"),
        provider_code: z.string(),
        provider_id: z.string(),
        connection_id: z.string().nullable(),
        mode_code: z.string().nullable(),
        execution_reference: z.string().nullable(),
        idempotency_key_preview: z.string().nullable(),
        initial_status: z.string().nullable(),
      })
      .strict(),
    idempotency_reservation: z
      .object({
        ready: z.boolean(),
        draft: z.record(z.unknown()).nullable(),
        dedupe_scope: z.literal("deliveryhub:create_shipment"),
        reservation_key_preview: z.string().nullable(),
        reservation_fingerprint: z.string().nullable(),
        matched_fields: z.array(AdminDeliveryExecutionPersistenceAuditFieldSchema),
      })
      .strict(),
    status_transitions: z.array(
      z
        .object({
          from: z.string(),
          to: z.string(),
          reason: z.string(),
        })
        .strict()
    ),
    audit_log_entries: z.array(
      z
        .object({
          version: z.number().int().min(1),
          event_type: z.string(),
          execution_reference: z.string(),
          current_state: z.string(),
          summary: z.string(),
          correlation: z.record(z.union([z.string(), z.number(), z.null()])),
          identity: z.record(z.string()),
        })
        .strict()
    ),
    blocked: z.array(
      z
        .object({
          key: z.string(),
          reason: z.string(),
        })
        .strict()
    ),
    deferred: z.array(
      z
        .object({
          key: z.string(),
          reason: z.string(),
        })
        .strict()
    ),
  })
  .strict()

const AdminDeliveryExecutionLifecyclePhaseSchema = z
  .object({
    code: z.enum([
      "preflight_eligibility",
      "provider_dispatch",
      "shipment_result_normalization",
      "fulfillment_application",
      "failure_handling",
    ]),
    order: z.number().int().min(1),
    status: z.enum(["projected_for_future_execution", "blocked_in_preview"]),
    readiness_posture: z.enum(["ready_when_enabled", "blocked_in_preview"]),
    block_reasons: z.array(z.string()),
    disabled_live_actions: z.array(z.string()),
    linked_preview_artifacts: z.array(z.string()),
  })
  .strict()

const AdminDeliveryExecutionLifecyclePreviewSchema = z
  .object({
    version: z.literal(1),
    redacted: z.literal(true),
    current_mode: z.literal("preview_only"),
    lifecycle_status: z.enum(["projected_for_future_execution", "blocked_in_preview"]),
    readiness_posture: z.enum(["ready_when_enabled", "blocked_in_preview"]),
    phase_sequence: z.array(
      z.enum([
        "preflight_eligibility",
        "provider_dispatch",
        "shipment_result_normalization",
        "fulfillment_application",
        "failure_handling",
      ])
    ),
    identity_correlation: z
      .object({
        provider_operation_reference: z.string().nullable(),
        idempotency_key_preview: z.string().nullable(),
        plan_fingerprint: z.string().nullable(),
        execution_fingerprint: z.string().nullable(),
      })
      .strict(),
    phases: z.array(AdminDeliveryExecutionLifecyclePhaseSchema),
    confirmations: z
      .object({
        preview_only: z.literal(true),
        orchestration_scheduling_disabled: z.literal(true),
        shipment_execution_disabled: z.literal(true),
        provider_calls_disabled: z.literal(true),
        persistence_writes_disabled: z.literal(true),
        retry_scheduling_disabled: z.literal(true),
        compensation_writes_disabled: z.literal(true),
        order_mutation_disabled: z.literal(true),
        fulfillment_mutation_disabled: z.literal(true),
        checkout_cutover_disabled: z.literal(true),
      })
      .strict(),
  })
  .strict()

const AdminDeliveryExecutionPlanObservabilityIssueSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    field_path: z.string().nullable(),
  })
  .strict()

const AdminDeliveryExecutionPlanObservabilityReadinessVerdictSchema = z
  .object({
    status: z.enum(["ready", "blocked"]),
    blocked_reasons: z.array(z.string()),
  })
  .strict()

const AdminDeliveryExecutionPlanObservabilityExecutionPlanSchema = z
  .object({
    version: z.number().int().min(1),
    operation: z.literal("create_shipment"),
    connection_id: z.string(),
    mode_code: z.string(),
    quote_reference: AdminDeliveryFulfillmentBridgeQuoteReferenceSchema,
    order: AdminDeliveryFulfillmentBridgeCreatePayloadSchema.shape.order,
    fulfillment: AdminDeliveryFulfillmentBridgeCreatePayloadSchema.shape.fulfillment,
    items: AdminDeliveryFulfillmentBridgeCreatePayloadSchema.shape.items,
    outbound_request: z
      .object({
        method: z.literal("POST"),
        path: z.literal("/shipments"),
        headers: z
          .object({
            authorization: z.string(),
            "content-type": z.literal("application/json"),
          })
          .strict(),
      })
      .strict(),
  })
  .strict()

const AdminDeliveryExecutionPlanObservabilityOutboundPreviewSchema = z
  .object({
    redacted: z.literal(true),
    request: z.record(z.unknown()).nullable(),
  })
  .strict()

const AdminDeliveryExecutionPlanObservabilityModePreviewSchema = z
  .object({
    mode_code: z.string(),
    status: z.enum(["ready", "blocked"]),
    rollout_status: z.enum(["projected", "deferred", "unconfigured"]),
    supporting_connection_ids: z.array(z.string()),
    blocking_issues: z.array(AdminDeliveryFulfillmentBridgePlannerIssueSchema),
    readiness_verdict: AdminDeliveryExecutionPlanObservabilityReadinessVerdictSchema,
    blocked_reasons: z.array(z.string()),
    issues: z.array(AdminDeliveryExecutionPlanObservabilityIssueSchema),
    steps: z.array(AdminDeliveryExecutionPlanObservabilityStepSchema),
    execution_plan: AdminDeliveryExecutionPlanObservabilityExecutionPlanSchema.nullable(),
    execution_identity: AdminDeliveryExecutionIdentityPreviewSchema.nullable(),
    outbound_payload_preview: AdminDeliveryExecutionPlanObservabilityOutboundPreviewSchema,
    persistence_audit_preview: AdminDeliveryExecutionPersistenceAuditSchema,
    preflight_eligibility: AdminDeliveryExecutionPreflightEligibilitySchema,
    provider_dispatch_preview: AdminDeliveryProviderDispatchPreviewSchema,
    shipment_result_preview: AdminDeliveryShipmentResultPreviewSchema,
    failure_handling_preview: AdminDeliveryFailureHandlingPreviewSchema,
    fulfillment_application_preview: AdminDeliveryFulfillmentApplicationPreviewSchema,
    execution_lifecycle_preview: AdminDeliveryExecutionLifecyclePreviewSchema,
    shipment_execution: z
      .object({
        materialized: z.literal(false),
        reason: z.string(),
      })
      .strict(),
  })
  .strict()

const AdminDeliveryExecutionPlanObservabilityPreviewSummarySchema = z
  .object({
    mode_count: z.number().int().min(0),
    ready_mode_count: z.number().int().min(0),
    blocked_mode_count: z.number().int().min(0),
    projected_mode_count: z.number().int().min(0),
    deferred_mode_count: z.number().int().min(0),
    unconfigured_mode_count: z.number().int().min(0),
  })
  .strict()

const AdminDeliveryExecutionPlanObservabilityPreviewSchema = z
  .object({
    version: z.number().int().min(1),
    provider_code: z.string(),
    provider_id: z.string(),
    mode_previews: z.array(AdminDeliveryExecutionPlanObservabilityModePreviewSchema),
    summary: AdminDeliveryExecutionPlanObservabilityPreviewSummarySchema,
  })
  .strict()

const AdminDeliveryShippingOptionManualSyncExecutionModeSchema = z
  .object({
    requested_mode: z.enum(["dry_run", "execute"]),
    effective_mode: z.enum(["dry_run", "execute"]),
    execute_requested: z.boolean(),
    execute_confirmed: z.boolean(),
    execute_guard: z.string(),
    is_dry_run: z.boolean(),
  })
  .strict()

const AdminDeliveryShippingOptionManualSyncDesiredPlanSummarySchema = z
  .object({
    desired_option_count: z.number().int().min(0),
    deferred_option_count: z.number().int().min(0),
    deferred_issue_count: z.number().int().min(0),
    connection_plan_count: z.number().int().min(0),
  })
  .strict()

const AdminDeliveryShippingOptionManualSyncReconciliationSummarySchema = z
  .object({
    create_candidate_count: z.number().int().min(0),
    update_candidate_count: z.number().int().min(0),
    unchanged_count: z.number().int().min(0),
    orphaned_managed_option_count: z.number().int().min(0),
    ignored_foreign_option_count: z.number().int().min(0),
  })
  .strict()

const AdminDeliveryShippingOptionSyncOperationPlanSummarySchema = z
  .object({
    create_operation_count: z.number().int().min(0),
    update_operation_count: z.number().int().min(0),
    archive_operation_count: z.number().int().min(0),
    noop_count: z.number().int().min(0),
    mutation_operation_count: z.number().int().min(0),
    ignored_foreign_option_count: z.number().int().min(0),
    managed_option_count: z.number().int().min(0),
  })
  .strict()

const AdminDeliveryShippingOptionCreateOperationSchema = z
  .object({
    type: z.literal("create"),
    provider_code: z.string(),
    provider_id: z.string(),
    mode_code: z.string(),
    desired: AdminDeliveryProjectedShippingOptionSchema,
    target_data: AdminDeliveryShippingOptionDataSchema,
    supporting_connection_ids: z.array(z.string()),
  })
  .strict()

const AdminDeliveryShippingOptionUpdateOperationSchema = z
  .object({
    type: z.literal("update"),
    provider_code: z.string(),
    provider_id: z.string(),
    mode_code: z.string(),
    desired: AdminDeliveryProjectedShippingOptionSchema,
    current: AdminDeliveryShippingOptionSnapshotSchema,
    normalized_current_data: AdminDeliveryShippingOptionDataSchema,
    target_data: AdminDeliveryShippingOptionDataSchema,
    supporting_connection_ids: z.array(z.string()),
    reasons: z.array(z.string()),
  })
  .strict()

const AdminDeliveryShippingOptionArchiveOperationSchema = z
  .object({
    type: z.literal("archive"),
    provider_code: z.string(),
    provider_id: z.string(),
    mode_code: z.string(),
    current: AdminDeliveryShippingOptionSnapshotSchema,
    normalized_current_data: AdminDeliveryShippingOptionDataSchema,
    reason: z.string(),
  })
  .strict()

const AdminDeliveryShippingOptionNoopSchema = z
  .object({
    type: z.literal("noop"),
    provider_code: z.string(),
    provider_id: z.string(),
    mode_code: z.string(),
    desired: AdminDeliveryProjectedShippingOptionSchema,
    current: AdminDeliveryShippingOptionSnapshotSchema,
    normalized_current_data: AdminDeliveryShippingOptionDataSchema,
    target_data: AdminDeliveryShippingOptionDataSchema,
    supporting_connection_ids: z.array(z.string()),
  })
  .strict()

const AdminDeliveryShippingOptionSyncOperationPlanSchema = z
  .object({
    provider_code: z.string(),
    provider_id: z.string(),
    create_operations: z.array(AdminDeliveryShippingOptionCreateOperationSchema),
    update_operations: z.array(AdminDeliveryShippingOptionUpdateOperationSchema),
    archive_operations: z.array(AdminDeliveryShippingOptionArchiveOperationSchema),
    noops: z.array(AdminDeliveryShippingOptionNoopSchema),
    ignored_foreign_options: z.array(
      z
        .object({
          current: AdminDeliveryShippingOptionSnapshotSchema,
        })
        .strict()
    ),
    summary: AdminDeliveryShippingOptionSyncOperationPlanSummarySchema,
  })
  .strict()

const AdminDeliveryShippingOptionSyncExecutionSummarySchema = z
  .object({
    create_operation_count: z.number().int().min(0),
    update_operation_count: z.number().int().min(0),
    archive_operation_count: z.number().int().min(0),
    mutation_operation_count: z.number().int().min(0),
    noop_count: z.number().int().min(0),
    ignored_foreign_option_count: z.number().int().min(0),
    attempted_operation_count: z.number().int().min(0),
    succeeded_operation_count: z.number().int().min(0),
    failed_operation_count: z.number().int().min(0),
    not_executed_operation_count: z.number().int().min(0),
  })
  .strict()

const AdminDeliveryShippingOptionCreateExecutionResultSchema = z
  .object({
    type: z.literal("create"),
    status: z.enum(["succeeded", "failed"]),
    operation: AdminDeliveryShippingOptionCreateOperationSchema,
    output: z.unknown().optional(),
    error: z.unknown().optional(),
  })
  .strict()

const AdminDeliveryShippingOptionUpdateExecutionResultSchema = z
  .object({
    type: z.literal("update"),
    status: z.enum(["succeeded", "failed"]),
    operation: AdminDeliveryShippingOptionUpdateOperationSchema,
    output: z.unknown().optional(),
    error: z.unknown().optional(),
  })
  .strict()

const AdminDeliveryShippingOptionArchiveExecutionResultSchema = z
  .object({
    type: z.literal("archive"),
    status: z.enum(["succeeded", "failed"]),
    operation: AdminDeliveryShippingOptionArchiveOperationSchema,
    output: z.unknown().optional(),
    error: z.unknown().optional(),
  })
  .strict()

const AdminDeliveryShippingOptionMutationExecutionResultSchema = z.discriminatedUnion("type", [
  AdminDeliveryShippingOptionCreateExecutionResultSchema,
  AdminDeliveryShippingOptionUpdateExecutionResultSchema,
  AdminDeliveryShippingOptionArchiveExecutionResultSchema,
])

const AdminDeliveryShippingOptionSyncExecutionReportSchema = z
  .object({
    provider_code: z.string(),
    provider_id: z.string(),
    outcome: z.enum(["succeeded", "failed", "partial_failure"]),
    aborted: z.boolean(),
    error_mode: z.enum(["abort", "continue"]),
    summary: AdminDeliveryShippingOptionSyncExecutionSummarySchema,
    create_results: z.array(AdminDeliveryShippingOptionCreateExecutionResultSchema),
    update_results: z.array(AdminDeliveryShippingOptionUpdateExecutionResultSchema),
    archive_results: z.array(AdminDeliveryShippingOptionArchiveExecutionResultSchema),
    executed_operations: z.array(AdminDeliveryShippingOptionMutationExecutionResultSchema),
  })
  .strict()

const AdminDeliveryShippingOptionManualSyncResponseSchema = z
  .object({
    provider_code: z.string(),
    provider_id: z.string(),
    current_options: z.array(AdminDeliveryShippingOptionSnapshotSchema),
    desired_plan: AdminDeliveryShippingOptionPreviewPlanSchema,
    desired_plan_summary: AdminDeliveryShippingOptionManualSyncDesiredPlanSummarySchema,
    reconciliation: AdminDeliveryShippingOptionPreviewReconciliationSchema,
    reconciliation_summary: AdminDeliveryShippingOptionManualSyncReconciliationSummarySchema,
    operation_plan: AdminDeliveryShippingOptionSyncOperationPlanSchema,
    execution: z
      .object({
        mode: AdminDeliveryShippingOptionManualSyncExecutionModeSchema,
        report: AdminDeliveryShippingOptionSyncExecutionReportSchema.nullable(),
      })
      .strict(),
  })
  .strict()

export function getDeliveryHubService(req: AuthenticatedMedusaRequest) {
  const pg = getDeliveryHubPgConnection(req.scope)
  return createDeliveryHubService(pg)
}

export function getRouteParam(req: AuthenticatedMedusaRequest, key: string) {
  const fromParams = (req as { params?: Record<string, string | undefined> }).params?.[key]

  if (fromParams?.trim()) {
    return fromParams.trim()
  }

  const path = req.url?.split("?")[0] || ""
  const segments = path.split("/").filter(Boolean)

  if (key === "id") {
    const connectionsIndex = segments.findIndex((segment) => segment === "connections")

    if (connectionsIndex >= 0) {
      return segments[connectionsIndex + 1] || ""
    }

    const warehousesIndex = segments.findIndex((segment) => segment === "warehouses")

    if (warehousesIndex >= 0) {
      return segments[warehousesIndex + 1] || ""
    }
  }

  return ""
}

export function sanitizeAdminDeliveryConnection(connection: unknown) {
  return AdminDeliveryConnectionSchema.parse(connection)
}

export function sanitizeAdminDeliveryWarehouse(warehouse: unknown) {
  return AdminDeliveryWarehouseSchema.parse(warehouse)
}

export function sanitizeAdminDeliveryTestQuoteResponse(result: unknown) {
  return AdminDeliveryTestQuoteResponseSchema.parse(result)
}

export function sanitizeAdminDeliveryProvider(provider: unknown) {
  return AdminDeliveryProviderSchema.parse(provider)
}

export function sanitizeAdminDeliveryConnectionTestResult(result: unknown) {
  const root = asRecord(result)

  return AdminDeliveryConnectionTestResultSchema.parse({
    ...root,
    diagnostics: sanitizeAdminStructuredPayload(root.diagnostics),
  })
}

export function sanitizeAdminDeliveryEventLog(log: unknown) {
  const root = asRecord(log)

  return AdminDeliveryEventLogSchema.parse({
    ...root,
    request_summary: sanitizeAdminStructuredPayload(root.request_summary),
    response_summary: sanitizeAdminStructuredPayload(root.response_summary),
  })
}

export function sanitizeAdminDeliveryShippingOptionPreview(preview: unknown) {
  const root = asRecord(preview)

  return AdminDeliveryShippingOptionPreviewSchema.parse({
    ...root,
    current_options: asArray(root.current_options).map(sanitizeAdminDeliveryShippingOptionSnapshot),
    plan: sanitizeAdminDeliveryShippingOptionPreviewPlan(root.plan),
    reconciliation: sanitizeAdminDeliveryShippingOptionPreviewReconciliation(root.reconciliation),
    summary: AdminDeliveryShippingOptionPreviewSummarySchema.parse(root.summary),
  })
}

export function sanitizeAdminDeliveryShippingOptionManualSyncResponse(result: unknown) {
  const root = asRecord(result)
  const execution = asRecord(root.execution)

  return AdminDeliveryShippingOptionManualSyncResponseSchema.parse({
    ...root,
    current_options: asArray(root.current_options).map(sanitizeAdminDeliveryShippingOptionSnapshot),
    desired_plan: sanitizeAdminDeliveryShippingOptionPreviewPlan(root.desired_plan),
    desired_plan_summary: AdminDeliveryShippingOptionManualSyncDesiredPlanSummarySchema.parse(
      root.desired_plan_summary
    ),
    reconciliation: sanitizeAdminDeliveryShippingOptionPreviewReconciliation(root.reconciliation),
    reconciliation_summary:
      AdminDeliveryShippingOptionManualSyncReconciliationSummarySchema.parse(
        root.reconciliation_summary
      ),
    operation_plan: sanitizeAdminDeliveryShippingOptionSyncOperationPlan(root.operation_plan),
    execution: {
      ...execution,
      mode: AdminDeliveryShippingOptionManualSyncExecutionModeSchema.parse(execution.mode),
      report:
        execution.report === null || typeof execution.report === "undefined"
          ? null
          : sanitizeAdminDeliveryShippingOptionSyncExecutionReport(execution.report),
    },
  })
}

export function sanitizeAdminDeliveryFulfillmentBridgePreview(preview: unknown) {
  const root = asRecord(preview)

  return AdminDeliveryFulfillmentBridgePreviewSchema.parse({
    ...root,
    mode_previews: asArray(root.mode_previews).map((entry) =>
      sanitizeAdminDeliveryFulfillmentBridgeModePreview(entry)
    ),
    summary: AdminDeliveryFulfillmentBridgePreviewSummarySchema.parse(root.summary),
  })
}

export function sanitizeAdminDeliveryFulfillmentBridgeReadinessPreview(preview: unknown) {
  const root = asRecord(preview)

  return z
    .object({
      provider_code: z.string(),
      provider_id: z.string(),
      shipping_option_preview: AdminDeliveryShippingOptionPreviewSchema,
      bridge_preview: AdminDeliveryFulfillmentBridgePreviewSchema,
      summary: AdminDeliveryFulfillmentBridgePreviewSummarySchema,
    })
    .strict()
    .parse({
      ...root,
      shipping_option_preview: sanitizeAdminDeliveryShippingOptionPreview(root.shipping_option_preview),
      bridge_preview: sanitizeAdminDeliveryFulfillmentBridgePreview(root.bridge_preview),
      summary: AdminDeliveryFulfillmentBridgePreviewSummarySchema.parse(root.summary),
    })
}

export function sanitizeAdminDeliveryExecutionPlanObservabilityPreview(preview: unknown) {
  const root = asRecord(preview)

  return z
    .object({
      provider_code: z.string(),
      provider_id: z.string(),
      shipping_option_preview: AdminDeliveryShippingOptionPreviewSchema,
      execution_plan_preview: AdminDeliveryExecutionPlanObservabilityPreviewSchema,
      summary: AdminDeliveryExecutionPlanObservabilityPreviewSummarySchema,
    })
    .strict()
    .parse({
      ...root,
      shipping_option_preview: sanitizeAdminDeliveryShippingOptionPreview(root.shipping_option_preview),
      execution_plan_preview: AdminDeliveryExecutionPlanObservabilityPreviewSchema.parse({
        ...asRecord(root.execution_plan_preview),
        mode_previews: asArray(asRecord(root.execution_plan_preview).mode_previews).map((entry) =>
          sanitizeAdminDeliveryExecutionPlanObservabilityModePreview(entry)
        ),
        summary: AdminDeliveryExecutionPlanObservabilityPreviewSummarySchema.parse(
          asRecord(root.execution_plan_preview).summary
        ),
      }),
      summary: AdminDeliveryExecutionPlanObservabilityPreviewSummarySchema.parse(root.summary),
    })
}

export function handleDeliveryHubError(res: MedusaResponse, error: unknown) {
  if (isDeliveryHubError(error)) {
    res.status(error.status).json({
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        details: sanitizeErrorDetails(error.details),
      },
    })
    return
  }

  res.status(500).json({
    ok: false,
    error: {
      code: "DELIVERY_HUB_UNEXPECTED_ERROR",
      message: error instanceof Error ? error.message : "Unexpected Delivery Hub error",
      details: null,
    },
  })
}

function sanitizeErrorDetails(details: Record<string, unknown> | undefined) {
  if (!details) {
    return null
  }

  return redactRecord(details)
}

function sanitizeAdminDeliveryShippingOptionPreviewPlan(plan: unknown) {
  const root = asRecord(plan)

  return AdminDeliveryShippingOptionPreviewPlanSchema.parse({
    ...root,
    desired_options: asArray(root.desired_options).map((option) =>
      AdminDeliveryProjectedShippingOptionSchema.parse(option)
    ),
    deferred_options: asArray(root.deferred_options).map((option) =>
      AdminDeliveryDeferredShippingOptionSchema.parse(option)
    ),
    connection_plans: asArray(root.connection_plans).map((planEntry) =>
      AdminDeliveryShippingOptionConnectionPlanSchema.parse(planEntry)
    ),
  })
}

function sanitizeAdminDeliveryFulfillmentBridgeModePreview(preview: unknown) {
  const root = asRecord(preview)

  return AdminDeliveryFulfillmentBridgeModePreviewSchema.parse({
    ...root,
    blocking_issues: asArray(root.blocking_issues).map((issue) =>
      AdminDeliveryFulfillmentBridgePlannerIssueSchema.parse(issue)
    ),
    steps: asArray(root.steps).map((step) => AdminDeliveryFulfillmentBridgePreviewStepSchema.parse(step)),
    selection: sanitizeNullableAdminDeliveryFulfillmentBridgeSelection(root.selection),
    shipping_option_data: sanitizeNullableAdminDeliveryFulfillmentBridgeOptionData(
      root.shipping_option_data
    ),
    fulfillment_payload: sanitizeNullableAdminDeliveryFulfillmentBridgePayload(
      root.fulfillment_payload
    ),
    create_fulfillment_payload: sanitizeNullableAdminDeliveryFulfillmentBridgeCreatePayload(
      root.create_fulfillment_payload
    ),
    shipment_execution:
      root.shipment_execution && typeof root.shipment_execution === "object"
        ? AdminDeliveryFulfillmentBridgeModePreviewSchema.shape.shipment_execution.parse({
            ...asRecord(root.shipment_execution),
            reason: sanitizeAdminString(asRecord(root.shipment_execution).reason),
          })
        : root.shipment_execution,
    error:
      root.error === null || typeof root.error === "undefined"
        ? null
        : AdminDeliveryFulfillmentBridgeModePreviewSchema.shape.error.unwrap().parse({
            ...asRecord(root.error),
            message: sanitizeAdminString(asRecord(root.error).message),
          }),
  })
}

function sanitizeNullableAdminDeliveryFulfillmentBridgeSelection(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return null
  }

  return sanitizeAdminDeliveryFulfillmentBridgeSelection(value)
}

function sanitizeNullableAdminDeliveryFulfillmentBridgeOptionData(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return null
  }

  return sanitizeAdminDeliveryFulfillmentBridgeOptionData(value)
}

function sanitizeNullableAdminDeliveryFulfillmentBridgePayload(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return null
  }

  return sanitizeAdminDeliveryFulfillmentBridgePayload(value)
}

function sanitizeNullableAdminDeliveryFulfillmentBridgeCreatePayload(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return null
  }

  return sanitizeAdminDeliveryFulfillmentBridgeCreatePayload(value)
}

function sanitizeAdminDeliveryFulfillmentBridgeSelection(selection: unknown) {
  const root = asRecord(selection)

  return AdminDeliveryFulfillmentBridgeSelectionSchema.parse({
    version: root.version,
    connection_id: sanitizeAdminString(root.connection_id),
    quote_type: sanitizeAdminString(root.quote_type),
    quote_reference: sanitizeAdminDeliveryFulfillmentBridgeQuoteReference(root.quote_reference),
    quote: sanitizeAdminDeliveryFulfillmentBridgeQuote(root.quote),
    pickup_point: sanitizeAdminDeliveryFulfillmentBridgePickupPoint(root.pickup_point),
    pickup_window: sanitizeNullableAdminDeliveryFulfillmentBridgePickupWindow(root.pickup_window),
    updated_at: sanitizeAdminString(root.updated_at),
  })
}

function sanitizeAdminDeliveryFulfillmentBridgeOptionData(data: unknown) {
  const root = asRecord(data)

  return AdminDeliveryShippingOptionDataSchema.parse({
    version: root.version,
    provider_code: sanitizeAdminString(root.provider_code),
    provider_id: sanitizeAdminString(root.provider_id),
    id: sanitizeAdminString(root.id),
    mode_code: sanitizeAdminString(root.mode_code),
  })
}

function sanitizeAdminDeliveryFulfillmentBridgePayload(payload: unknown) {
  const root = asRecord(payload)

  return AdminDeliveryFulfillmentBridgePayloadSchema.parse({
    version: root.version,
    option: sanitizeAdminDeliveryFulfillmentBridgeOptionData(root.option),
    fulfillment_data: sanitizeAdminDeliveryFulfillmentBridgeFulfillmentData(root.fulfillment_data),
    calculated_price_data: sanitizeAdminDeliveryFulfillmentBridgeCalculatedPriceData(
      root.calculated_price_data
    ),
  })
}

function sanitizeAdminDeliveryFulfillmentBridgeCreatePayload(payload: unknown) {
  const root = asRecord(payload)

  return AdminDeliveryFulfillmentBridgeCreatePayloadSchema.parse({
    version: root.version,
    delivery: sanitizeAdminDeliveryFulfillmentBridgePayload(root.delivery),
    order: sanitizeAdminDeliveryFulfillmentBridgeOrder(root.order),
    fulfillment: sanitizeAdminDeliveryFulfillmentBridgeFulfillment(root.fulfillment),
    items: asArray(root.items).map((item) => sanitizeAdminDeliveryFulfillmentBridgeItem(item)),
  })
}

function sanitizeAdminDeliveryFulfillmentBridgeQuoteReference(value: unknown) {
  const root = asRecord(value)

  return AdminDeliveryFulfillmentBridgeQuoteReferenceSchema.parse({
    id: sanitizeAdminString(root.id),
    version: root.version,
  })
}

function sanitizeAdminDeliveryFulfillmentBridgeQuote(value: unknown) {
  const root = asRecord(value)

  return AdminDeliveryFulfillmentBridgeQuoteSchema.parse({
    carrier_code: sanitizeAdminString(root.carrier_code),
    carrier_label: sanitizeAdminString(root.carrier_label),
    amount: root.amount,
    currency_code: sanitizeAdminString(root.currency_code),
    delivery_eta_min: root.delivery_eta_min ?? null,
    delivery_eta_max: root.delivery_eta_max ?? null,
    pickup_point_required: root.pickup_point_required,
    pickup_window_required: root.pickup_window_required,
  })
}

function sanitizeAdminDeliveryFulfillmentBridgePickupPoint(value: unknown) {
  const root = asRecord(value)

  return AdminDeliveryFulfillmentBridgePickupPointSchema.parse({
    provider_point_id: sanitizeAdminString(root.provider_point_id),
    provider_point_code: sanitizeNullableAdminString(root.provider_point_code),
    name: sanitizeAdminString(root.name),
    address: sanitizeAdminString(root.address),
    city: sanitizeNullableAdminString(root.city),
    region: sanitizeNullableAdminString(root.region),
    postal_code: sanitizeNullableAdminString(root.postal_code),
    lat: root.lat ?? null,
    lng: root.lng ?? null,
    is_origin_dropoff_allowed: root.is_origin_dropoff_allowed,
    is_destination_pickup_allowed: root.is_destination_pickup_allowed,
    payment_methods: asArray(root.payment_methods).map((entry) => sanitizeAdminString(entry)),
  })
}

function sanitizeNullableAdminDeliveryFulfillmentBridgePickupWindow(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return null
  }

  return sanitizeAdminDeliveryFulfillmentBridgePickupWindow(value)
}

function sanitizeAdminDeliveryFulfillmentBridgePickupWindow(value: unknown) {
  const root = asRecord(value)
  const interval = asRecord(root.interval_utc)

  return AdminDeliveryFulfillmentBridgePickupWindowSchema.parse({
    date: sanitizeAdminString(root.date),
    time_from: sanitizeNullableAdminString(root.time_from),
    time_to: sanitizeNullableAdminString(root.time_to),
    interval_utc: {
      from: sanitizeAdminString(interval.from),
      to: sanitizeAdminString(interval.to),
    },
    label: sanitizeAdminString(root.label),
  })
}

function sanitizeAdminDeliveryFulfillmentBridgeFulfillmentData(value: unknown) {
  const root = asRecord(value)

  return AdminDeliveryFulfillmentBridgeFulfillmentDataSchema.parse({
    version: root.version,
    connection_id: sanitizeAdminString(root.connection_id),
    mode_code: sanitizeAdminString(root.mode_code),
    quote_reference: sanitizeAdminDeliveryFulfillmentBridgeQuoteReference(root.quote_reference),
    quote: sanitizeAdminDeliveryFulfillmentBridgeQuote(root.quote),
    pickup_point: sanitizeAdminDeliveryFulfillmentBridgePickupPoint(root.pickup_point),
    pickup_window: sanitizeNullableAdminDeliveryFulfillmentBridgePickupWindow(root.pickup_window),
  })
}

function sanitizeAdminDeliveryFulfillmentBridgeCalculatedPriceData(value: unknown) {
  const root = asRecord(value)

  return AdminDeliveryFulfillmentBridgeCalculatedPriceDataSchema.parse({
    version: root.version,
    provider_code: sanitizeAdminString(root.provider_code),
    connection_id: sanitizeAdminString(root.connection_id),
    mode_code: sanitizeAdminString(root.mode_code),
    quote_reference: sanitizeAdminDeliveryFulfillmentBridgeQuoteReference(root.quote_reference),
    quote: sanitizeAdminDeliveryFulfillmentBridgeQuote(root.quote),
    pickup_point: sanitizeAdminDeliveryFulfillmentBridgePickupPoint(root.pickup_point),
    pickup_window: sanitizeNullableAdminDeliveryFulfillmentBridgePickupWindow(root.pickup_window),
  })
}

function sanitizeAdminDeliveryFulfillmentBridgeOrder(value: unknown) {
  const root = asRecord(value)

  return AdminDeliveryFulfillmentBridgeCreatePayloadSchema.shape.order.parse({
    id: sanitizeNullableAdminString(root.id),
    display_id: sanitizeNullableAdminDisplayId(root.display_id),
    currency_code: sanitizeNullableAdminString(root.currency_code),
  })
}

function sanitizeAdminDeliveryFulfillmentBridgeFulfillment(value: unknown) {
  const root = asRecord(value)

  return AdminDeliveryFulfillmentBridgeCreatePayloadSchema.shape.fulfillment.parse({
    id: sanitizeNullableAdminString(root.id),
    location_id: sanitizeNullableAdminString(root.location_id),
  })
}

function sanitizeAdminDeliveryFulfillmentBridgeItem(value: unknown) {
  const root = asRecord(value)

  return AdminDeliveryFulfillmentBridgeCreatePayloadSchema.shape.items.element.parse({
    line_item_id: sanitizeNullableAdminString(root.line_item_id),
    quantity: root.quantity,
  })
}

function sanitizeAdminDeliveryExecutionPlanObservabilityModePreview(preview: unknown) {
  const root = asRecord(preview)

  return AdminDeliveryExecutionPlanObservabilityModePreviewSchema.parse({
    ...root,
    blocking_issues: asArray(root.blocking_issues).map((issue) =>
      AdminDeliveryFulfillmentBridgePlannerIssueSchema.parse(issue)
    ),
    readiness_verdict: AdminDeliveryExecutionPlanObservabilityReadinessVerdictSchema.parse({
      ...asRecord(root.readiness_verdict),
      blocked_reasons: asArray(asRecord(root.readiness_verdict).blocked_reasons).map((reason) =>
        sanitizeAdminString(reason)
      ),
    }),
    blocked_reasons: asArray(root.blocked_reasons).map((reason) => sanitizeAdminString(reason)),
    issues: asArray(root.issues).map((issue) => {
      const issueRecord = asRecord(issue)

      return AdminDeliveryExecutionPlanObservabilityIssueSchema.parse({
        code: sanitizeAdminString(issueRecord.code),
        message: sanitizeAdminString(issueRecord.message),
        field_path: sanitizeNullableAdminString(issueRecord.field_path),
      })
    }),
    steps: asArray(root.steps).map((step) =>
      AdminDeliveryExecutionPlanObservabilityStepSchema.parse({
        ...asRecord(step),
        message: sanitizeAdminString(asRecord(step).message),
      })
    ),
    execution_plan: sanitizeNullableAdminDeliveryExecutionPlanObservabilityExecutionPlan(
      root.execution_plan
    ),
    execution_identity: sanitizeNullableAdminDeliveryExecutionIdentityPreview(root.execution_identity),
    outbound_payload_preview: AdminDeliveryExecutionPlanObservabilityOutboundPreviewSchema.parse({
      ...asRecord(root.outbound_payload_preview),
      request: sanitizeNullableAdminStructuredPayload(asRecord(root.outbound_payload_preview).request),
    }),
    persistence_audit_preview: sanitizeAdminDeliveryExecutionPersistenceAuditPreview(
      root.persistence_audit_preview
    ),
    preflight_eligibility: sanitizeAdminDeliveryExecutionPreflightEligibility(
      root.preflight_eligibility
    ),
    provider_dispatch_preview: sanitizeAdminDeliveryProviderDispatchPreview(root.provider_dispatch_preview),
    shipment_result_preview: sanitizeAdminDeliveryShipmentResultPreview(root.shipment_result_preview),
    failure_handling_preview: sanitizeAdminDeliveryFailureHandlingPreview(
      root.failure_handling_preview
    ),
    fulfillment_application_preview: sanitizeAdminDeliveryFulfillmentApplicationPreview(
      root.fulfillment_application_preview
    ),
    execution_lifecycle_preview: sanitizeAdminDeliveryExecutionLifecyclePreview(
      root.execution_lifecycle_preview
    ),
    shipment_execution:
      root.shipment_execution && typeof root.shipment_execution === "object"
        ? AdminDeliveryExecutionPlanObservabilityModePreviewSchema.shape.shipment_execution.parse({
            ...asRecord(root.shipment_execution),
            reason: sanitizeAdminString(asRecord(root.shipment_execution).reason),
          })
        : root.shipment_execution,
  })
}

function sanitizeNullableAdminDeliveryExecutionPlanObservabilityExecutionPlan(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return null
  }

  return sanitizeAdminDeliveryExecutionPlanObservabilityExecutionPlan(value)
}

function sanitizeAdminDeliveryExecutionPlanObservabilityExecutionPlan(value: unknown) {
  const root = asRecord(value)
  const outboundRequest = asRecord(root.outbound_request)
  const headers = asRecord(outboundRequest.headers)

  return AdminDeliveryExecutionPlanObservabilityExecutionPlanSchema.parse({
    version: root.version,
    operation: root.operation,
    connection_id: sanitizeAdminString(root.connection_id),
    mode_code: sanitizeAdminString(root.mode_code),
    quote_reference: sanitizeAdminDeliveryFulfillmentBridgeQuoteReference(root.quote_reference),
    order: sanitizeAdminDeliveryFulfillmentBridgeOrder(root.order),
    fulfillment: sanitizeAdminDeliveryFulfillmentBridgeFulfillment(root.fulfillment),
    items: asArray(root.items).map((item) => sanitizeAdminDeliveryFulfillmentBridgeItem(item)),
    outbound_request: {
      method: outboundRequest.method,
      path: sanitizeAdminString(outboundRequest.path),
      headers: {
        authorization: sanitizeAdminString(headers.authorization),
        "content-type": headers["content-type"],
      },
    },
  })
}

function sanitizeAdminDeliveryExecutionLifecyclePreview(value: unknown) {
  const root = asRecord(value)
  const identityCorrelation = asRecord(root.identity_correlation)
  const confirmations = asRecord(root.confirmations)

  return AdminDeliveryExecutionLifecyclePreviewSchema.parse({
    version: root.version,
    redacted: root.redacted,
    current_mode: root.current_mode,
    lifecycle_status: root.lifecycle_status,
    readiness_posture: root.readiness_posture,
    phase_sequence: asArray(root.phase_sequence),
    identity_correlation: {
      provider_operation_reference: sanitizeNullableAdminString(
        identityCorrelation.provider_operation_reference
      ),
      idempotency_key_preview: sanitizeNullableAdminString(identityCorrelation.idempotency_key_preview),
      plan_fingerprint: sanitizeNullableAdminString(identityCorrelation.plan_fingerprint),
      execution_fingerprint: sanitizeNullableAdminString(identityCorrelation.execution_fingerprint),
    },
    phases: asArray(root.phases).map((phase) => {
      const phaseRoot = asRecord(phase)

      return AdminDeliveryExecutionLifecyclePhaseSchema.parse({
        code: phaseRoot.code,
        order: phaseRoot.order,
        status: phaseRoot.status,
        readiness_posture: phaseRoot.readiness_posture,
        block_reasons: asArray(phaseRoot.block_reasons).map((reason) => sanitizeAdminString(reason)),
        disabled_live_actions: asArray(phaseRoot.disabled_live_actions).map((action) =>
          sanitizeAdminString(action)
        ),
        linked_preview_artifacts: asArray(phaseRoot.linked_preview_artifacts).map((artifact) =>
          sanitizeAdminString(artifact)
        ),
      })
    }),
    confirmations: {
      preview_only: confirmations.preview_only,
      orchestration_scheduling_disabled: confirmations.orchestration_scheduling_disabled,
      shipment_execution_disabled: confirmations.shipment_execution_disabled,
      provider_calls_disabled: confirmations.provider_calls_disabled,
      persistence_writes_disabled: confirmations.persistence_writes_disabled,
      retry_scheduling_disabled: confirmations.retry_scheduling_disabled,
      compensation_writes_disabled: confirmations.compensation_writes_disabled,
      order_mutation_disabled: confirmations.order_mutation_disabled,
      fulfillment_mutation_disabled: confirmations.fulfillment_mutation_disabled,
      checkout_cutover_disabled: confirmations.checkout_cutover_disabled,
    },
  })
}

function sanitizeNullableAdminDeliveryExecutionIdentityPreview(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return null
  }

  return sanitizeAdminDeliveryExecutionIdentityPreview(value)
}

function sanitizeAdminDeliveryExecutionIdentityPreview(value: unknown) {
  const root = asRecord(value)

  return AdminDeliveryExecutionIdentityPreviewSchema.parse({
    version: root.version,
    redacted: root.redacted,
    operation: root.operation,
    provider_operation_label: sanitizeAdminString(root.provider_operation_label),
    provider_operation_reference: sanitizeAdminString(root.provider_operation_reference),
    plan_fingerprint: sanitizeAdminString(root.plan_fingerprint),
    execution_fingerprint: sanitizeAdminString(root.execution_fingerprint),
    idempotency_key_preview: sanitizeAdminString(root.idempotency_key_preview),
  })
}

function sanitizeAdminDeliveryExecutionPreflightEligibility(value: unknown) {
  const root = asRecord(value)
  const futureExecutionFlag = asRecord(root.future_execution_flag)
  const confirmations = asRecord(root.confirmations)

  return AdminDeliveryExecutionPreflightEligibilitySchema.parse({
    version: root.version,
    redacted: root.redacted,
    current_mode: root.current_mode,
    decision: root.decision,
    real_execution_enabled: root.real_execution_enabled,
    future_execution_flag: {
      name: futureExecutionFlag.name,
      status: futureExecutionFlag.status,
      description: sanitizeAdminString(futureExecutionFlag.description),
    },
    reasons: asArray(root.reasons).map((entry) =>
      AdminDeliveryExecutionPreflightReasonSchema.parse({
        code: sanitizeAdminString(asRecord(entry).code),
        message: sanitizeAdminString(asRecord(entry).message),
      })
    ),
    required_prerequisites: asArray(root.required_prerequisites).map((entry) =>
      AdminDeliveryExecutionPreflightPrerequisiteSchema.parse({
        code: sanitizeAdminString(asRecord(entry).code),
        label: sanitizeAdminString(asRecord(entry).label),
        status: asRecord(entry).status,
      })
    ),
    confirmations: {
      shipment_execution_disabled: confirmations.shipment_execution_disabled,
      provider_calls_disabled: confirmations.provider_calls_disabled,
      persistence_writes_disabled: confirmations.persistence_writes_disabled,
      checkout_cutover_disabled: confirmations.checkout_cutover_disabled,
    },
    blocked_live_actions: asArray(root.blocked_live_actions).map((entry) =>
      AdminDeliveryExecutionPreflightBlockedActionSchema.parse({
        code: sanitizeAdminString(asRecord(entry).code),
        label: sanitizeAdminString(asRecord(entry).label),
        blocked: asRecord(entry).blocked,
      })
    ),
  })
}

function sanitizeAdminDeliveryProviderDispatchPreview(value: unknown) {
  const root = asRecord(value)
  const provider = asRecord(root.provider)
  const commandIdentity = asRecord(root.command_identity)
  const commandEnvelopeSummary = asRecord(root.command_envelope_summary)
  const confirmations = asRecord(root.confirmations)

  return AdminDeliveryProviderDispatchPreviewSchema.parse({
    version: root.version,
    redacted: root.redacted,
    current_mode: root.current_mode,
    dispatch_decision: root.dispatch_decision,
    provider: {
      provider_code: sanitizeAdminString(provider.provider_code),
      provider_id: sanitizeAdminString(provider.provider_id),
      provider_key: sanitizeAdminString(provider.provider_key),
      adapter_operation: provider.adapter_operation,
      adapter_operation_label: sanitizeAdminString(provider.adapter_operation_label),
    },
    command_identity: {
      provider_operation_reference: sanitizeNullableAdminString(commandIdentity.provider_operation_reference),
      idempotency_key_preview: sanitizeNullableAdminString(commandIdentity.idempotency_key_preview),
      plan_fingerprint: sanitizeNullableAdminString(commandIdentity.plan_fingerprint),
      execution_fingerprint: sanitizeNullableAdminString(commandIdentity.execution_fingerprint),
    },
    command_envelope_summary: {
      connection_id_present: commandEnvelopeSummary.connection_id_present,
      mode_code: sanitizeNullableAdminString(commandEnvelopeSummary.mode_code),
      origin_kind: commandEnvelopeSummary.origin_kind,
      destination_kind: commandEnvelopeSummary.destination_kind,
      quote_reference_present: commandEnvelopeSummary.quote_reference_present,
      offer_reference_present: commandEnvelopeSummary.offer_reference_present,
      package_reference_present: commandEnvelopeSummary.package_reference_present,
      order_reference_present: commandEnvelopeSummary.order_reference_present,
      fulfillment_reference_present: commandEnvelopeSummary.fulfillment_reference_present,
      pickup_scheduling_reference_present: commandEnvelopeSummary.pickup_scheduling_reference_present,
      dropoff_scheduling_reference_present: commandEnvelopeSummary.dropoff_scheduling_reference_present,
      item_count: commandEnvelopeSummary.item_count,
    },
    blocked_dispatch_actions: asArray(root.blocked_dispatch_actions).map((entry) =>
      AdminDeliveryProviderDispatchPreviewSchema.shape.blocked_dispatch_actions.element.parse({
        code: sanitizeAdminString(asRecord(entry).code),
        label: sanitizeAdminString(asRecord(entry).label),
        reason: sanitizeAdminString(asRecord(entry).reason),
        blocked: asRecord(entry).blocked,
      })
    ),
    confirmations: {
      adapter_invocation_disabled: confirmations.adapter_invocation_disabled,
      provider_network_calls_disabled: confirmations.provider_network_calls_disabled,
      shipment_creation_disabled: confirmations.shipment_creation_disabled,
      label_creation_disabled: confirmations.label_creation_disabled,
      order_mutation_disabled: confirmations.order_mutation_disabled,
      persistence_writes_disabled: confirmations.persistence_writes_disabled,
      checkout_cutover_disabled: confirmations.checkout_cutover_disabled,
    },
  })
}

function sanitizeAdminDeliveryShipmentResultPreview(value: unknown) {
  const root = asRecord(value)
  const identityLinkage = asRecord(root.identity_linkage)
  const artifactSummary = asRecord(root.artifact_summary)
  const confirmations = asRecord(root.confirmations)

  return AdminDeliveryShipmentResultPreviewSchema.parse({
    version: root.version,
    redacted: root.redacted,
    current_mode: root.current_mode,
    result_decision: root.result_decision,
    projected_result_status: root.projected_result_status,
    result_kind: root.result_kind,
    normalization_target: root.normalization_target,
    provider_normalization_target: root.provider_normalization_target,
    identity_linkage: {
      provider_operation_reference: sanitizeNullableAdminString(
        identityLinkage.provider_operation_reference
      ),
      idempotency_key_preview: sanitizeNullableAdminString(identityLinkage.idempotency_key_preview),
      plan_fingerprint: sanitizeNullableAdminString(identityLinkage.plan_fingerprint),
      execution_fingerprint: sanitizeNullableAdminString(identityLinkage.execution_fingerprint),
    },
    artifact_summary: {
      external_shipment_reference_present: artifactSummary.external_shipment_reference_present,
      tracking_reference_present: artifactSummary.tracking_reference_present,
      label_document_present: artifactSummary.label_document_present,
      pickup_booking_present: artifactSummary.pickup_booking_present,
      pickup_interval_present: artifactSummary.pickup_interval_present,
      status_timeline_present: artifactSummary.status_timeline_present,
      failure_placeholder_present: artifactSummary.failure_placeholder_present,
      rollback_placeholder_present: artifactSummary.rollback_placeholder_present,
    },
    blocked_materialization_actions: asArray(root.blocked_materialization_actions).map((entry) =>
      AdminDeliveryShipmentResultBlockedActionSchema.parse({
        code: sanitizeAdminString(asRecord(entry).code),
        label: sanitizeAdminString(asRecord(entry).label),
        reason: sanitizeAdminString(asRecord(entry).reason),
        blocked: asRecord(entry).blocked,
      })
    ),
    confirmations: {
      provider_response_fetch_disabled: confirmations.provider_response_fetch_disabled,
      adapter_invocation_disabled: confirmations.adapter_invocation_disabled,
      shipment_creation_disabled: confirmations.shipment_creation_disabled,
      label_persistence_disabled: confirmations.label_persistence_disabled,
      order_mutation_disabled: confirmations.order_mutation_disabled,
      fulfillment_persistence_disabled: confirmations.fulfillment_persistence_disabled,
      checkout_cutover_disabled: confirmations.checkout_cutover_disabled,
    },
  })
}

function sanitizeAdminDeliveryFailureHandlingPreview(value: unknown) {
  const root = asRecord(value)
  const identityLinkage = asRecord(root.identity_linkage)
  const retryProjection = asRecord(root.retry_projection)
  const compensationProjection = asRecord(root.compensation_projection)
  const manualInterventionProjection = asRecord(root.manual_intervention_projection)
  const confirmations = asRecord(root.confirmations)

  return AdminDeliveryFailureHandlingPreviewSchema.parse({
    version: root.version,
    redacted: root.redacted,
    current_mode: root.current_mode,
    failure_path_decision: root.failure_path_decision,
    projected_failure_status: root.projected_failure_status,
    failure_classes: asArray(root.failure_classes).map((entry) =>
      AdminDeliveryFailureHandlingFailureClassSchema.parse({
        code: asRecord(entry).code,
        retry_eligibility: asRecord(entry).retry_eligibility,
        compensation_requirement: asRecord(entry).compensation_requirement,
        manual_intervention: asRecord(entry).manual_intervention,
        reason_bucket: asRecord(entry).reason_bucket,
      })
    ),
    identity_linkage: {
      provider_operation_reference: sanitizeNullableAdminString(
        identityLinkage.provider_operation_reference
      ),
      idempotency_key_preview: sanitizeNullableAdminString(identityLinkage.idempotency_key_preview),
      plan_fingerprint: sanitizeNullableAdminString(identityLinkage.plan_fingerprint),
      execution_fingerprint: sanitizeNullableAdminString(identityLinkage.execution_fingerprint),
    },
    retry_projection: {
      eligibility: retryProjection.eligibility,
      policy: retryProjection.policy,
      retry_block_reasons: asArray(retryProjection.retry_block_reasons).map((entry) =>
        sanitizeAdminString(entry)
      ),
      scheduling_status: retryProjection.scheduling_status,
    },
    compensation_projection: {
      requirement: compensationProjection.requirement,
      write_plan_status: compensationProjection.write_plan_status,
      rollback_status: compensationProjection.rollback_status,
      blocked_actions: asArray(compensationProjection.blocked_actions).map((entry) =>
        sanitizeAdminString(entry)
      ),
    },
    manual_intervention_projection: {
      status: manualInterventionProjection.status,
      reason_markers: asArray(manualInterventionProjection.reason_markers).map((entry) =>
        sanitizeAdminString(entry)
      ),
    },
    blocked_failure_actions: asArray(root.blocked_failure_actions).map((entry) =>
      AdminDeliveryFailureHandlingBlockedActionSchema.parse({
        code: sanitizeAdminString(asRecord(entry).code),
        label: sanitizeAdminString(asRecord(entry).label),
        reason: sanitizeAdminString(asRecord(entry).reason),
        blocked: asRecord(entry).blocked,
      })
    ),
    confirmations: {
      retry_scheduling_disabled: confirmations.retry_scheduling_disabled,
      rollback_disabled: confirmations.rollback_disabled,
      compensation_writes_disabled: confirmations.compensation_writes_disabled,
      order_mutation_disabled: confirmations.order_mutation_disabled,
      fulfillment_mutation_disabled: confirmations.fulfillment_mutation_disabled,
      event_persistence_disabled: confirmations.event_persistence_disabled,
      provider_redispatch_disabled: confirmations.provider_redispatch_disabled,
      checkout_cutover_disabled: confirmations.checkout_cutover_disabled,
    },
  })
}

function sanitizeAdminDeliveryFulfillmentApplicationPreview(value: unknown) {
  const root = asRecord(value)
  const mutationSemantics = asRecord(root.mutation_semantics)
  const identityLinkage = asRecord(root.identity_linkage)
  const persistenceLinkage = asRecord(root.persistence_linkage)
  const confirmations = asRecord(root.confirmations)

  return AdminDeliveryFulfillmentApplicationPreviewSchema.parse({
    version: root.version,
    redacted: root.redacted,
    current_mode: root.current_mode,
    application_decision: root.application_decision,
    projected_application_status: root.projected_application_status,
    application_target: root.application_target,
    application_scope: root.application_scope,
    mutation_semantics: {
      fulfillment_data_patch_present: mutationSemantics.fulfillment_data_patch_present,
      shipment_reference_linkage_present: mutationSemantics.shipment_reference_linkage_present,
      tracking_projection_present: mutationSemantics.tracking_projection_present,
      label_document_reference_linkage_present:
        mutationSemantics.label_document_reference_linkage_present,
      status_transition_application_present:
        mutationSemantics.status_transition_application_present,
      audit_linkage_present: mutationSemantics.audit_linkage_present,
    },
    identity_linkage: {
      provider_operation_reference: sanitizeNullableAdminString(
        identityLinkage.provider_operation_reference
      ),
      idempotency_key_preview: sanitizeNullableAdminString(identityLinkage.idempotency_key_preview),
      plan_fingerprint: sanitizeNullableAdminString(identityLinkage.plan_fingerprint),
      execution_fingerprint: sanitizeNullableAdminString(identityLinkage.execution_fingerprint),
    },
    persistence_linkage: {
      execution_reference_present: persistenceLinkage.execution_reference_present,
      idempotency_reservation_present: persistenceLinkage.idempotency_reservation_present,
      audit_log_reference_present: persistenceLinkage.audit_log_reference_present,
    },
    blocked_application_actions: asArray(root.blocked_application_actions).map((entry) =>
      AdminDeliveryFulfillmentApplicationBlockedActionSchema.parse({
        code: sanitizeAdminString(asRecord(entry).code),
        label: sanitizeAdminString(asRecord(entry).label),
        reason: sanitizeAdminString(asRecord(entry).reason),
        blocked: asRecord(entry).blocked,
      })
    ),
    confirmations: {
      order_mutation_disabled: confirmations.order_mutation_disabled,
      fulfillment_persistence_disabled: confirmations.fulfillment_persistence_disabled,
      shipment_persistence_disabled: confirmations.shipment_persistence_disabled,
      label_persistence_disabled: confirmations.label_persistence_disabled,
      event_persistence_disabled: confirmations.event_persistence_disabled,
      checkout_cutover_disabled: confirmations.checkout_cutover_disabled,
    },
  })
}

function sanitizeAdminDeliveryExecutionPersistenceAuditPreview(value: unknown) {
  const root = asRecord(value)
  const metadataPatch = asRecord(root.metadata_patch)
  const executionRecord = asRecord(root.execution_record)
  const idempotencyReservation = asRecord(root.idempotency_reservation)

  return AdminDeliveryExecutionPersistenceAuditSchema.parse({
    version: root.version,
    redacted: root.redacted,
    status: root.status,
    metadata_patch: {
      target: metadataPatch.target,
      action: metadataPatch.action,
      fields: asArray(metadataPatch.fields).map((entry) =>
        AdminDeliveryExecutionPersistenceAuditFieldSchema.parse({
          field: sanitizeAdminString(asRecord(entry).field),
          value_preview: sanitizeAdminString(asRecord(entry).value_preview),
        })
      ),
    },
    execution_record: {
      ready: executionRecord.ready,
      draft: executionRecord.draft ? redactRecord(asRecord(executionRecord.draft)) : null,
      record_type: executionRecord.record_type,
      operation: executionRecord.operation,
      provider_code: sanitizeAdminString(executionRecord.provider_code),
      provider_id: sanitizeAdminString(executionRecord.provider_id),
      connection_id: sanitizeNullableAdminString(executionRecord.connection_id),
      mode_code: sanitizeNullableAdminString(executionRecord.mode_code),
      execution_reference: sanitizeNullableAdminString(executionRecord.execution_reference),
      idempotency_key_preview: sanitizeNullableAdminString(executionRecord.idempotency_key_preview),
      initial_status: sanitizeNullableAdminString(executionRecord.initial_status),
    },
    idempotency_reservation: {
      ready: idempotencyReservation.ready,
      draft: idempotencyReservation.draft ? redactRecord(asRecord(idempotencyReservation.draft)) : null,
      dedupe_scope: idempotencyReservation.dedupe_scope,
      reservation_key_preview: sanitizeNullableAdminString(
        idempotencyReservation.reservation_key_preview
      ),
      reservation_fingerprint: sanitizeNullableAdminString(
        idempotencyReservation.reservation_fingerprint
      ),
      matched_fields: asArray(idempotencyReservation.matched_fields).map((entry) =>
        AdminDeliveryExecutionPersistenceAuditFieldSchema.parse({
          field: sanitizeAdminString(asRecord(entry).field),
          value_preview: sanitizeAdminString(asRecord(entry).value_preview),
        })
      ),
    },
    status_transitions: asArray(root.status_transitions).map((entry) =>
      z
        .object({
          from: z.string(),
          to: z.string(),
          reason: z.string(),
        })
        .strict()
        .parse({
          from: sanitizeAdminString(asRecord(entry).from),
          to: sanitizeAdminString(asRecord(entry).to),
          reason: sanitizeAdminString(asRecord(entry).reason),
        })
    ),
    audit_log_entries: asArray(root.audit_log_entries).map((entry) => {
      const correlation = asRecord(asRecord(entry).correlation)
      const identity = asRecord(asRecord(entry).identity)

      return z
        .object({
          version: z.number().int().min(1),
          event_type: z.string(),
          execution_reference: z.string(),
          current_state: z.string(),
          summary: z.string(),
          correlation: z.record(z.union([z.string(), z.number(), z.null()])),
          identity: z.record(z.string()),
        })
        .strict()
        .parse({
          version: asRecord(entry).version,
          event_type: sanitizeAdminString(asRecord(entry).event_type),
          execution_reference: sanitizeAdminString(asRecord(entry).execution_reference),
          current_state: sanitizeAdminString(asRecord(entry).current_state),
          summary: sanitizeAdminString(asRecord(entry).summary),
          correlation: Object.entries(correlation).reduce<Record<string, string | number | null>>(
            (accumulator, [key, rawValue]) => {
              if (typeof rawValue === "string") {
                accumulator[key] = sanitizeAdminString(rawValue) as string
                return accumulator
              }

              if (typeof rawValue === "number" || rawValue === null) {
                accumulator[key] = rawValue
              }

              return accumulator
            },
            {}
          ),
          identity: Object.entries(identity).reduce<Record<string, string>>((accumulator, [key, rawValue]) => {
            accumulator[key] = sanitizeAdminString(rawValue) as string
            return accumulator
          }, {}),
        })
    }),
    blocked: asArray(root.blocked).map((entry) =>
      z
        .object({
          key: z.string(),
          reason: z.string(),
        })
        .strict()
        .parse({
          key: sanitizeAdminString(asRecord(entry).key),
          reason: sanitizeAdminString(asRecord(entry).reason),
        })
    ),
    deferred: asArray(root.deferred).map((entry) =>
      z
        .object({
          key: z.string(),
          reason: z.string(),
        })
        .strict()
        .parse({
          key: sanitizeAdminString(asRecord(entry).key),
          reason: sanitizeAdminString(asRecord(entry).reason),
        })
    ),
  })
}

function sanitizeAdminDeliveryShippingOptionPreviewReconciliation(reconciliation: unknown) {
  const root = asRecord(reconciliation)

  return AdminDeliveryShippingOptionPreviewReconciliationSchema.parse({
    ...root,
    create_candidates: asArray(root.create_candidates).map((candidate) => {
      const candidateRecord = asRecord(candidate)

      return {
        ...candidateRecord,
        desired: AdminDeliveryProjectedShippingOptionSchema.parse(candidateRecord.desired),
      }
    }),
    update_candidates: asArray(root.update_candidates).map((candidate) => {
      const candidateRecord = asRecord(candidate)

      return {
        ...candidateRecord,
        desired: AdminDeliveryProjectedShippingOptionSchema.parse(candidateRecord.desired),
        current: sanitizeAdminDeliveryShippingOptionSnapshot(candidateRecord.current),
        normalized_current_data: sanitizeAdminDeliveryShippingOptionData(
          candidateRecord.normalized_current_data
        ),
      }
    }),
    unchanged: asArray(root.unchanged).map((entry) => {
      const entryRecord = asRecord(entry)

      return {
        ...entryRecord,
        desired: AdminDeliveryProjectedShippingOptionSchema.parse(entryRecord.desired),
        current: sanitizeAdminDeliveryShippingOptionSnapshot(entryRecord.current),
        normalized_current_data: sanitizeAdminDeliveryShippingOptionData(
          entryRecord.normalized_current_data
        ),
      }
    }),
    orphaned_managed_options: asArray(root.orphaned_managed_options).map((entry) => {
      const entryRecord = asRecord(entry)

      return {
        ...entryRecord,
        current: sanitizeAdminDeliveryShippingOptionSnapshot(entryRecord.current),
        normalized_current_data: sanitizeAdminDeliveryShippingOptionData(
          entryRecord.normalized_current_data
        ),
      }
    }),
    ignored_foreign_options: asArray(root.ignored_foreign_options).map((entry) => {
      const entryRecord = asRecord(entry)

      return {
        ...entryRecord,
        current: sanitizeAdminDeliveryShippingOptionSnapshot(entryRecord.current),
      }
    }),
  })
}

function sanitizeAdminDeliveryShippingOptionSyncOperationPlan(plan: unknown) {
  const root = asRecord(plan)

  return AdminDeliveryShippingOptionSyncOperationPlanSchema.parse({
    ...root,
    create_operations: asArray(root.create_operations).map(
      sanitizeAdminDeliveryShippingOptionCreateOperation
    ),
    update_operations: asArray(root.update_operations).map(
      sanitizeAdminDeliveryShippingOptionUpdateOperation
    ),
    archive_operations: asArray(root.archive_operations).map(
      sanitizeAdminDeliveryShippingOptionArchiveOperation
    ),
    noops: asArray(root.noops).map(sanitizeAdminDeliveryShippingOptionNoop),
    ignored_foreign_options: asArray(root.ignored_foreign_options).map((entry) => {
      const entryRecord = asRecord(entry)

      return {
        ...entryRecord,
        current: sanitizeAdminDeliveryShippingOptionSnapshot(entryRecord.current),
      }
    }),
    summary: AdminDeliveryShippingOptionSyncOperationPlanSummarySchema.parse(root.summary),
  })
}

function sanitizeAdminDeliveryShippingOptionSyncExecutionReport(report: unknown) {
  const root = asRecord(report)

  return AdminDeliveryShippingOptionSyncExecutionReportSchema.parse({
    ...root,
    summary: AdminDeliveryShippingOptionSyncExecutionSummarySchema.parse(root.summary),
    create_results: asArray(root.create_results).map((result) =>
      sanitizeAdminDeliveryShippingOptionCreateExecutionResult(result)
    ),
    update_results: asArray(root.update_results).map((result) =>
      sanitizeAdminDeliveryShippingOptionUpdateExecutionResult(result)
    ),
    archive_results: asArray(root.archive_results).map((result) =>
      sanitizeAdminDeliveryShippingOptionArchiveExecutionResult(result)
    ),
    executed_operations: asArray(root.executed_operations).map((result) =>
      sanitizeAdminDeliveryShippingOptionMutationExecutionResult(result)
    ),
  })
}

function sanitizeAdminDeliveryShippingOptionSnapshot(snapshot: unknown) {
  const root = asRecord(snapshot)

  return AdminDeliveryShippingOptionSnapshotSchema.parse({
    ...root,
    data: sanitizeNullableAdminDeliveryShippingOptionData(root.data),
  })
}

function sanitizeNullableAdminDeliveryShippingOptionData(data: unknown) {
  if (data === null || typeof data === "undefined") {
    return null
  }

  try {
    return sanitizeAdminDeliveryShippingOptionData(data)
  } catch {
    return null
  }
}

function sanitizeAdminDeliveryShippingOptionData(data: unknown) {
  return AdminDeliveryShippingOptionDataSchema.parse(
    normalizeDeliveryHubShippingOptionData(asRecord(data))
  )
}

function sanitizeAdminDeliveryShippingOptionCreateOperation(operation: unknown) {
  const root = asRecord(operation)

  return AdminDeliveryShippingOptionCreateOperationSchema.parse({
    ...root,
    desired: AdminDeliveryProjectedShippingOptionSchema.parse(root.desired),
    target_data: sanitizeAdminDeliveryShippingOptionData(root.target_data),
  })
}

function sanitizeAdminDeliveryShippingOptionUpdateOperation(operation: unknown) {
  const root = asRecord(operation)

  return AdminDeliveryShippingOptionUpdateOperationSchema.parse({
    ...root,
    desired: AdminDeliveryProjectedShippingOptionSchema.parse(root.desired),
    current: sanitizeAdminDeliveryShippingOptionSnapshot(root.current),
    normalized_current_data: sanitizeAdminDeliveryShippingOptionData(
      root.normalized_current_data
    ),
    target_data: sanitizeAdminDeliveryShippingOptionData(root.target_data),
  })
}

function sanitizeAdminDeliveryShippingOptionArchiveOperation(operation: unknown) {
  const root = asRecord(operation)

  return AdminDeliveryShippingOptionArchiveOperationSchema.parse({
    ...root,
    current: sanitizeAdminDeliveryShippingOptionSnapshot(root.current),
    normalized_current_data: sanitizeAdminDeliveryShippingOptionData(
      root.normalized_current_data
    ),
  })
}

function sanitizeAdminDeliveryShippingOptionNoop(operation: unknown) {
  const root = asRecord(operation)

  return AdminDeliveryShippingOptionNoopSchema.parse({
    ...root,
    desired: AdminDeliveryProjectedShippingOptionSchema.parse(root.desired),
    current: sanitizeAdminDeliveryShippingOptionSnapshot(root.current),
    normalized_current_data: sanitizeAdminDeliveryShippingOptionData(
      root.normalized_current_data
    ),
    target_data: sanitizeAdminDeliveryShippingOptionData(root.target_data),
  })
}

function sanitizeAdminDeliveryShippingOptionCreateExecutionResult(result: unknown) {
  const root = asRecord(result)

  return AdminDeliveryShippingOptionCreateExecutionResultSchema.parse({
    ...root,
    operation: sanitizeAdminDeliveryShippingOptionCreateOperation(root.operation),
    output: sanitizeAdminUnknownPayload(root.output),
    error: sanitizeAdminUnknownPayload(root.error),
  })
}

function sanitizeAdminDeliveryShippingOptionUpdateExecutionResult(result: unknown) {
  const root = asRecord(result)

  return AdminDeliveryShippingOptionUpdateExecutionResultSchema.parse({
    ...root,
    operation: sanitizeAdminDeliveryShippingOptionUpdateOperation(root.operation),
    output: sanitizeAdminUnknownPayload(root.output),
    error: sanitizeAdminUnknownPayload(root.error),
  })
}

function sanitizeAdminDeliveryShippingOptionArchiveExecutionResult(result: unknown) {
  const root = asRecord(result)

  return AdminDeliveryShippingOptionArchiveExecutionResultSchema.parse({
    ...root,
    operation: sanitizeAdminDeliveryShippingOptionArchiveOperation(root.operation),
    output: sanitizeAdminUnknownPayload(root.output),
    error: sanitizeAdminUnknownPayload(root.error),
  })
}

function sanitizeAdminDeliveryShippingOptionMutationExecutionResult(result: unknown) {
  const root = asRecord(result)

  switch (root.type) {
    case "create":
      return sanitizeAdminDeliveryShippingOptionCreateExecutionResult(root)
    case "update":
      return sanitizeAdminDeliveryShippingOptionUpdateExecutionResult(root)
    case "archive":
      return sanitizeAdminDeliveryShippingOptionArchiveExecutionResult(root)
    default:
      return AdminDeliveryShippingOptionMutationExecutionResultSchema.parse(root)
  }
}

function sanitizeNullableAdminStructuredPayload(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return null
  }

  return sanitizeAdminStructuredPayload(value)
}

function sanitizeAdminStructuredPayload(value: unknown) {
  const sanitized = sanitizeAdminUnknownPayload(value)

  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) {
    return {}
  }

  return sanitized as Record<string, unknown>
}

function sanitizeAdminUnknownPayload(value: unknown): unknown {
  if (typeof value === "string") {
    return redactSensitiveText(value)
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeAdminUnknownPayload(entry))
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSensitiveText(value.message),
    }
  }

  if (value && typeof value === "object") {
    const nested = Object.entries(value as Record<string, unknown>).reduce(
      (acc, [key, entryValue]) => {
        acc[key] = sanitizeAdminUnknownPayload(entryValue)
        return acc
      },
      {} as Record<string, unknown>
    )

    return redactRecord(nested)
  }

  return value
}

function sanitizeAdminString(value: unknown) {
  return typeof value === "string" ? redactSensitiveText(value) : value
}

function sanitizeNullableAdminString(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return null
  }

  return typeof value === "string" ? redactSensitiveText(value) : value
}

function sanitizeNullableAdminDisplayId(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return null
  }

  return typeof value === "string" ? redactSensitiveText(value) : value
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : []
}
