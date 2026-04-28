import crypto from "node:crypto"
import {
  DELIVERY_HUB_CONNECTION_STATUS,
  DELIVERY_HUB_CREDENTIALS_STATE,
  DELIVERY_HUB_LOG_KIND,
  DELIVERY_HUB_MODE_CODE,
  DELIVERY_HUB_PROVIDER_YANDEX,
} from "./constants"
import {
  createDeliveryHubQuoteReference,
  readDeliveryHubCartSelection,
  type DeliveryHubQuoteReference,
} from "./cart-selection"
import type {
  DeliveryConnectionPublic,
  DeliveryConnectionRecord,
  DeliveryConnectionUpsertInput,
} from "./domain/connection"
import type { DeliveryQuote } from "./domain/quote"
import type { DeliveryPickupPoint } from "./domain/pickup-point"
import type { DeliveryPickupWindow } from "./domain/pickup-window"
import type {
  DeliveryHubDiagnosticsSummary,
  DeliveryTestQuoteEcho,
  DeliveryTestQuoteInput,
} from "./domain/test-dto"
import type {
  DeliveryWarehousePublic,
  DeliveryWarehouseRecord,
  DeliveryWarehouseUpsertInput,
} from "./domain/warehouse"
import { DeliveryHubError, isDeliveryHubError } from "./errors"
import {
  planDeliveryHubDesiredShippingOptions,
  type DeliveryHubShippingOptionPlan,
} from "./shipping-option-planner"
import {
  reconcileDeliveryHubShippingOptions,
  type DeliveryHubShippingOptionReconciliation,
  type DeliveryHubShippingOptionSnapshot,
} from "./shipping-option-reconciliation"
import {
  buildDeliveryHubShippingOptionSyncOperationPlan,
  type DeliveryHubShippingOptionSyncOperationPlan,
} from "./shipping-option-sync-operation-plan"
import {
  buildDeliveryHubCutoverPreconditions,
  type DeliveryHubCutoverPreconditionsResponse,
} from "./cutover-preconditions"
import {
  buildDeliveryHubCutoverCandidate,
  type DeliveryHubCutoverCandidateResponse,
} from "./cutover-candidate"
import {
  buildDeliveryHubStoreSelectionConnectionSummary,
  buildDeliveryHubStoreSelectionReadiness,
  createMissingDeliveryHubSelectionConnectionSummary,
} from "./selection-readiness"
import { getDeliveryHubAdapter, listDeliveryHubProviders } from "./registry"
import {
  createCredentialsFingerprint,
  encryptDeliveryHubCredentials,
  getDeliveryHubEncryptionState,
} from "./security/encryption"
import {
  buildDeliveryHubExecutionPlanObservabilityPreview,
  buildDeliveryHubFulfillmentBridgePreview,
  type DeliveryHubExecutionPlanObservabilityPreview,
  type DeliveryHubFulfillmentBridgePlannerIssue,
  type DeliveryHubFulfillmentBridgePreview,
} from "./fulfillment-provider-bridge"
import {
  buildDeliveryHubAdminShipmentOperationsViewModel,
  type DeliveryHubAdminShipmentOperationsViewModel,
} from "./admin-shipment-operations"
import { buildDeliveryHubAcceptedShipmentLifecycleSnapshot } from "./shipment-lifecycle-read-model"
import { refreshDeliveryHubAcceptedShipmentStatus } from "./shipment-status-polling"
import { cancelDeliveryHubAcceptedShipment } from "./shipment-cancel-policy"
import { requestDeliveryHubShipmentManualRetry } from "./shipment-retry-policy"
import { redactRecord } from "./security/redaction"
import {
  getDeliveryConnectionById,
  getDeliveryConnectionByIdReadOnly,
  listDeliveryConnections,
  listDeliveryConnectionsReadOnly,
  upsertDeliveryConnection,
} from "./storage/connections-repository"
import {
  appendDeliveryEventLog,
  listDeliveryEventLogs,
  listDeliveryEventLogsReadOnly,
  type DeliveryHubEventLogRecord,
} from "./storage/event-log-repository"
import { type DeliveryHubPgConnection } from "./storage/pg"
import {
  serializeDeliveryConnectionPublic,
  serializeDeliveryWarehousePublic,
} from "./storage/serializers"
import {
  getDeliveryWarehouseById,
  listDeliveryWarehouses,
  listDeliveryWarehousesReadOnly,
  upsertDeliveryWarehouse,
} from "./storage/warehouses-repository"
import { DeliveryHubExecutionLedgerPgRepository } from "./storage/execution-ledger-pg-repository"
import { getDeliveryShipmentByExecutionReference } from "./storage/shipments-repository"

export type DeliveryHubEventLogListInput = {
  connection_id?: string | null
  provider_code?: string | null
  limit?: number | null
}

export type DeliveryHubEventLogPublic = DeliveryHubEventLogRecord

export type DeliveryHubShippingOptionPreviewSummary = {
  current_option_count: number
  desired_option_count: number
  deferred_option_count: number
  deferred_issue_count: number
  connection_plan_count: number
  create_candidate_count: number
  update_candidate_count: number
  unchanged_count: number
  orphaned_managed_option_count: number
  ignored_foreign_option_count: number
}

export type DeliveryHubShippingOptionPreview = {
  provider_code: DeliveryHubShippingOptionPlan["provider_code"]
  provider_id: DeliveryHubShippingOptionPlan["provider_id"]
  current_options: DeliveryHubShippingOptionSnapshot[]
  plan: DeliveryHubShippingOptionPlan
  reconciliation: DeliveryHubShippingOptionReconciliation
  summary: DeliveryHubShippingOptionPreviewSummary
}

export type DeliveryHubFulfillmentBridgePreviewSummary = {
  mode_count: number
  ready_mode_count: number
  error_mode_count: number
  projected_mode_count: number
  deferred_mode_count: number
}

export type DeliveryHubFulfillmentBridgeReadinessPreview = {
  provider_code: DeliveryHubShippingOptionPlan["provider_code"]
  provider_id: DeliveryHubShippingOptionPlan["provider_id"]
  shipping_option_preview: DeliveryHubShippingOptionPreview
  bridge_preview: DeliveryHubFulfillmentBridgePreview
  summary: DeliveryHubFulfillmentBridgePreviewSummary
}

export type DeliveryHubExecutionPlanObservabilityPreviewSummary = {
  mode_count: number
  ready_mode_count: number
  blocked_mode_count: number
  projected_mode_count: number
  deferred_mode_count: number
  unconfigured_mode_count: number
}

export type DeliveryHubExecutionPlanObservabilityReadModel = {
  provider_code: DeliveryHubShippingOptionPlan["provider_code"]
  provider_id: DeliveryHubShippingOptionPlan["provider_id"]
  shipping_option_preview: DeliveryHubShippingOptionPreview
  execution_plan_preview: DeliveryHubExecutionPlanObservabilityPreview
  summary: DeliveryHubExecutionPlanObservabilityPreviewSummary
}

export type DeliveryHubAdminShipmentOperationsSnapshot = {
  ok: true
  operations: DeliveryHubAdminShipmentOperationsViewModel
}

export type DeliveryHubAdminPickupPointLookupPoint = {
  id: string
  code: string | null
  operator_id: string | null
  network_label: string | null
  station_type: string | null
  is_yandex_branded: boolean | null
  is_market_partner: boolean | null
  name: string
  address: string
  city: string | null
  available_for_dropoff: boolean
  coordinates: {
    lat: number | null
    lng: number | null
  }
}

export type DeliveryHubAdminPickupPointLookupResponse = {
  ok: true
  connection: DeliveryConnectionPublic
  points: DeliveryHubAdminPickupPointLookupPoint[]
  limit: number
  total_available: number
  returned_count: number
  truncated: boolean
  correlation_id: string
}

export type DeliveryHubAdminPickupWindowLookupWindow = {
  date: string
  time_from: string | null
  time_to: string | null
  interval_utc: {
    from: string
    to: string
  }
  label: string
}

export type DeliveryHubAdminPickupWindowLookupResponse = {
  ok: true
  connection: DeliveryConnectionPublic
  warehouse_id: string
  destination_point_id: string | null
  windows: DeliveryHubAdminPickupWindowLookupWindow[]
  limit: number
  total_available: number
  returned_count: number
  truncated: boolean
  correlation_id: string
}

type DeliveryStoreQuotePublic = Omit<
  DeliveryQuote,
  "quote_key" | "pickup_points_embedded" | "pickup_window_options" | "raw_reference"
> & {
  quote_reference: DeliveryHubQuoteReference
}

export type DeliveryHubStoreSettingsStatus =
  | "unavailable"
  | "informational_only"
  | "available"

export type DeliveryHubStoreSettingsPreviewVisibility = {
  shadow_settings: boolean
  readiness: boolean
  persisted_selection: boolean
  shadow_catalog: boolean
  shadow_pickup_points: boolean
  shadow_quotes: boolean
  shadow_pickup_windows: boolean
}

export type DeliveryHubStoreSettingsResponse = {
  ok: true
  settings: {
    enabled: boolean
    status: DeliveryHubStoreSettingsStatus
    summary: {
      enabled_connection_count: number
      ready_connection_count: number
      default_connection_label: string | null
      modality_codes: Array<DeliveryStoreQuotePublic["mode_code"]>
      supports_pickup_points: boolean
      supports_pickup_windows: boolean
      supports_dropoff: boolean
    }
    preview_visibility: DeliveryHubStoreSettingsPreviewVisibility
    hints: string[]
  }
}

type DeliveryHubStoreCatalogConnection = {
  connection_id: string
  label: string
  state: ReturnType<typeof buildDeliveryHubStoreSelectionConnectionSummary>["state"]
  ready: boolean
  quote_types: Array<DeliveryStoreQuotePublic["mode_code"]>
  supports_pickup_points: boolean
  supports_pickup_windows: boolean
  supports_dropoff: boolean
}

export class DeliveryHubService {
  constructor(private readonly pg: DeliveryHubPgConnection) {}

  async listProviders() {
    return listDeliveryHubProviders()
  }

  async listConnections(): Promise<DeliveryConnectionPublic[]> {
    const records = await listDeliveryConnections(this.pg)
    const warehouses = await listDeliveryWarehouses(this.pg)
    const warehouseMap = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]))

    return records.map((record) => serializeDeliveryConnectionPublic(record, warehouseMap))
  }

  async listWarehouses(): Promise<DeliveryWarehousePublic[]> {
    const records = await listDeliveryWarehouses(this.pg)
    return records.map(serializeDeliveryWarehousePublic)
  }

  async planDesiredShippingOptions(): Promise<DeliveryHubShippingOptionPlan> {
    const [connections, warehouses] = await Promise.all([
      listDeliveryConnectionsReadOnly(this.pg),
      listDeliveryWarehousesReadOnly(this.pg),
    ])

    return planDeliveryHubDesiredShippingOptions({
      connections,
      warehouses,
    })
  }

  async buildShippingOptionPreview(
    currentOptions: DeliveryHubShippingOptionSnapshot[]
  ): Promise<DeliveryHubShippingOptionPreview> {
    const plan = await this.planDesiredShippingOptions()
    const reconciliation = reconcileDeliveryHubShippingOptions({
      desired_options: plan.desired_options,
      current_options: currentOptions,
    })

    return {
      provider_code: plan.provider_code,
      provider_id: plan.provider_id,
      current_options: currentOptions,
      plan,
      reconciliation,
      summary: {
        current_option_count: currentOptions.length,
        desired_option_count: plan.desired_options.length,
        deferred_option_count: plan.deferred_options.length,
        deferred_issue_count: plan.deferred_options.reduce(
          (total, deferredOption) => total + deferredOption.issues.length,
          0
        ),
        connection_plan_count: plan.connection_plans.length,
        create_candidate_count: reconciliation.create_candidates.length,
        update_candidate_count: reconciliation.update_candidates.length,
        unchanged_count: reconciliation.unchanged.length,
        orphaned_managed_option_count: reconciliation.orphaned_managed_options.length,
        ignored_foreign_option_count: reconciliation.ignored_foreign_options.length,
      },
    }
  }

  async buildFulfillmentBridgeReadinessPreview(
    currentOptions: DeliveryHubShippingOptionSnapshot[]
  ): Promise<DeliveryHubFulfillmentBridgeReadinessPreview> {
    const shippingOptionPreview = await this.buildShippingOptionPreview(currentOptions)
    const bridgePreview = buildDeliveryHubFulfillmentBridgePreview({
      projected_modes: shippingOptionPreview.plan.desired_options.map((option) => ({
        mode_code: option.mode_code,
        supporting_connection_ids: option.supporting_connection_ids,
      })),
      deferred_modes: shippingOptionPreview.plan.deferred_options.map((option) => ({
        mode_code: option.mode_code,
        issues: option.issues.map<DeliveryHubFulfillmentBridgePlannerIssue>((issue) => ({
          connection_id: issue.connection_id,
          provider_code: issue.provider_code,
          code: issue.code,
          message: issue.message,
          mode_code: issue.mode_code,
        })),
      })),
    })

    return {
      provider_code: shippingOptionPreview.provider_code,
      provider_id: shippingOptionPreview.provider_id,
      shipping_option_preview: shippingOptionPreview,
      bridge_preview: bridgePreview,
      summary: {
        mode_count: bridgePreview.summary.mode_count,
        ready_mode_count: bridgePreview.summary.ready_mode_count,
        error_mode_count: bridgePreview.summary.error_mode_count,
        projected_mode_count: bridgePreview.summary.projected_mode_count,
        deferred_mode_count: bridgePreview.summary.deferred_mode_count,
      },
    }
  }

  async buildExecutionPlanObservabilityPreview(
    currentOptions: DeliveryHubShippingOptionSnapshot[]
  ): Promise<DeliveryHubExecutionPlanObservabilityReadModel> {
    const shippingOptionPreview = await this.buildShippingOptionPreview(currentOptions)
    const executionPlanPreview = buildDeliveryHubExecutionPlanObservabilityPreview({
      projected_modes: shippingOptionPreview.plan.desired_options.map((option) => ({
        mode_code: option.mode_code,
        supporting_connection_ids: option.supporting_connection_ids,
      })),
      deferred_modes: shippingOptionPreview.plan.deferred_options.map((option) => ({
        mode_code: option.mode_code,
        issues: option.issues.map<DeliveryHubFulfillmentBridgePlannerIssue>((issue) => ({
          connection_id: issue.connection_id,
          provider_code: issue.provider_code,
          code: issue.code,
          message: issue.message,
          mode_code: issue.mode_code,
        })),
      })),
    })

    return {
      provider_code: shippingOptionPreview.provider_code,
      provider_id: shippingOptionPreview.provider_id,
      shipping_option_preview: shippingOptionPreview,
      execution_plan_preview: executionPlanPreview,
      summary: {
        mode_count: executionPlanPreview.summary.mode_count,
        ready_mode_count: executionPlanPreview.summary.ready_mode_count,
        blocked_mode_count: executionPlanPreview.summary.blocked_mode_count,
        projected_mode_count: executionPlanPreview.summary.projected_mode_count,
        deferred_mode_count: executionPlanPreview.summary.deferred_mode_count,
        unconfigured_mode_count: executionPlanPreview.summary.unconfigured_mode_count,
      },
    }
  }

  async getAdminShipmentOperationsSnapshot(input: {
    execution_reference: string
  }): Promise<DeliveryHubAdminShipmentOperationsSnapshot> {
    const executionReference = requireString(input.execution_reference, "execution_reference")
    const shipment = await getDeliveryShipmentByExecutionReference(this.pg, executionReference)
    const ledger = await new DeliveryHubExecutionLedgerPgRepository({
      connection: this.pg,
    }).getExecutionByReference(executionReference)
    const connection = shipment?.connection_id
      ? await getDeliveryConnectionByIdReadOnly(this.pg, shipment.connection_id)
      : null
    const lifecycle = buildDeliveryHubAcceptedShipmentLifecycleSnapshot({
      shipment,
      ledger,
    })

    return {
      ok: true,
      operations: buildDeliveryHubAdminShipmentOperationsViewModel({
        lifecycle,
        shipment,
        connection,
        ledger,
      }),
    }
  }

  async refreshAdminShipmentOperationsStatus(input: {
    execution_reference: string
    correlation_id?: string | null
  }): Promise<DeliveryHubAdminShipmentOperationsSnapshot & { refresh: Awaited<ReturnType<typeof refreshDeliveryHubAcceptedShipmentStatus>> }> {
    const executionReference = requireString(input.execution_reference, "execution_reference")
    const shipment = await getDeliveryShipmentByExecutionReference(this.pg, executionReference)
    const ledger = await new DeliveryHubExecutionLedgerPgRepository({
      connection: this.pg,
    }).getExecutionByReference(executionReference)
    const connection = shipment?.connection_id
      ? await getDeliveryConnectionByIdReadOnly(this.pg, shipment.connection_id)
      : null
    const lifecycle = buildDeliveryHubAcceptedShipmentLifecycleSnapshot({
      shipment,
      ledger,
    })
    const refresh = await refreshDeliveryHubAcceptedShipmentStatus({
      lifecycle,
      shipment,
      connection,
      pg_connection: this.pg,
      correlation_id:
        normalizeNullableText(input.correlation_id) ??
        lifecycle.ledger.execution_reference_preview ??
        "admin-shipment-status-refresh",
    })
    const refreshedShipment = await getDeliveryShipmentByExecutionReference(this.pg, executionReference)
    const refreshedLifecycle = buildDeliveryHubAcceptedShipmentLifecycleSnapshot({
      shipment: refreshedShipment,
      ledger,
    })

    return {
      ok: true,
      operations: buildDeliveryHubAdminShipmentOperationsViewModel({
        lifecycle: refreshedLifecycle,
        shipment: refreshedShipment,
        connection,
        ledger,
      }),
      refresh,
    }
  }

  async cancelAdminShipmentOperationsShipment(input: {
    execution_reference: string
    correlation_id?: string | null
  }): Promise<DeliveryHubAdminShipmentOperationsSnapshot & { cancel: Awaited<ReturnType<typeof cancelDeliveryHubAcceptedShipment>> }> {
    const executionReference = requireString(input.execution_reference, "execution_reference")
    const shipment = await getDeliveryShipmentByExecutionReference(this.pg, executionReference)
    const ledger = await new DeliveryHubExecutionLedgerPgRepository({
      connection: this.pg,
    }).getExecutionByReference(executionReference)
    const connection = shipment?.connection_id
      ? await getDeliveryConnectionByIdReadOnly(this.pg, shipment.connection_id)
      : null
    const lifecycle = buildDeliveryHubAcceptedShipmentLifecycleSnapshot({
      shipment,
      ledger,
    })
    const cancel = await cancelDeliveryHubAcceptedShipment({
      lifecycle,
      shipment,
      connection,
      correlation_id:
        normalizeNullableText(input.correlation_id) ??
        lifecycle.ledger.execution_reference_preview ??
        "admin-shipment-cancel",
    })
    const refreshedShipment = await getDeliveryShipmentByExecutionReference(this.pg, executionReference)
    const refreshedLifecycle = buildDeliveryHubAcceptedShipmentLifecycleSnapshot({
      shipment: refreshedShipment,
      ledger,
    })

    return {
      ok: true,
      operations: buildDeliveryHubAdminShipmentOperationsViewModel({
        lifecycle: refreshedLifecycle,
        shipment: refreshedShipment,
        connection,
        ledger,
      }),
      cancel,
    }
  }

  async retryAdminShipmentOperationsExecution(input: {
    execution_reference: string
    correlation_id?: string | null
  }): Promise<
    DeliveryHubAdminShipmentOperationsSnapshot & {
      retry: Awaited<ReturnType<typeof requestDeliveryHubShipmentManualRetry>>
    }
  > {
    const executionReference = requireString(input.execution_reference, "execution_reference")
    const shipment = await getDeliveryShipmentByExecutionReference(this.pg, executionReference)
    const ledger = await new DeliveryHubExecutionLedgerPgRepository({
      connection: this.pg,
    }).getExecutionByReference(executionReference)
    const connection = shipment?.connection_id
      ? await getDeliveryConnectionByIdReadOnly(this.pg, shipment.connection_id)
      : null
    const lifecycle = buildDeliveryHubAcceptedShipmentLifecycleSnapshot({
      shipment,
      ledger,
    })
    const retry = await requestDeliveryHubShipmentManualRetry({
      lifecycle,
      shipment,
      ledger,
      correlation_id:
        normalizeNullableText(input.correlation_id) ??
        lifecycle.ledger.execution_reference_preview ??
        "admin-shipment-retry",
    })
    const refreshedShipment = await getDeliveryShipmentByExecutionReference(this.pg, executionReference)
    const refreshedLedger = await new DeliveryHubExecutionLedgerPgRepository({
      connection: this.pg,
    }).getExecutionByReference(executionReference)
    const refreshedLifecycle = buildDeliveryHubAcceptedShipmentLifecycleSnapshot({
      shipment: refreshedShipment,
      ledger: refreshedLedger,
    })

    return {
      ok: true,
      operations: buildDeliveryHubAdminShipmentOperationsViewModel({
        lifecycle: refreshedLifecycle,
        shipment: refreshedShipment,
        connection,
        ledger: refreshedLedger,
      }),
      retry,
    }
  }

  async reconcileShippingOptions(
    currentOptions: DeliveryHubShippingOptionSnapshot[]
  ): Promise<DeliveryHubShippingOptionReconciliation> {
    const preview = await this.buildShippingOptionPreview(currentOptions)
    return preview.reconciliation
  }

  async buildShippingOptionSyncOperationPlan(
    currentOptions: DeliveryHubShippingOptionSnapshot[]
  ): Promise<DeliveryHubShippingOptionSyncOperationPlan> {
    const reconciliation = await this.reconcileShippingOptions(currentOptions)
    return buildDeliveryHubShippingOptionSyncOperationPlan(reconciliation)
  }

  async listEventLogs(input: DeliveryHubEventLogListInput = {}): Promise<DeliveryHubEventLogPublic[]> {
    const logs = await listDeliveryEventLogs(this.pg, {
      connection_id: input.connection_id,
      provider_code: input.provider_code,
      limit: input.limit,
    })

    return logs.map((log) => ({
      ...log,
      request_summary: redactRecord(log.request_summary),
      response_summary: redactRecord(log.response_summary),
    }))
  }

  async createConnection(input: DeliveryConnectionUpsertInput) {
    return this.saveConnection(input)
  }

  async updateConnection(id: string, input: Partial<DeliveryConnectionUpsertInput>) {
    const current = await this.requireConnection(id)

    return this.saveConnection(
      {
        id: current.id,
        provider_code: input.provider_code ?? current.provider_code,
        name: input.name ?? current.name,
        status: input.status ?? current.status,
        mode: input.mode ?? current.mode,
        enabled: input.enabled ?? current.enabled,
        country_code: input.country_code ?? current.country_code,
        credentials: input.credentials,
        config: input.config ?? current.config,
        metadata: input.metadata ?? current.metadata,
      },
      current
    )
  }

  async createWarehouse(input: DeliveryWarehouseUpsertInput) {
    return this.saveWarehouse(input)
  }

  async updateWarehouse(id: string, input: Partial<DeliveryWarehouseUpsertInput>) {
    const current = await this.requireWarehouse(id)

    return this.saveWarehouse({
      id: current.id,
      name: input.name ?? current.name,
      enabled: input.enabled ?? current.enabled,
      country_code: input.country_code ?? current.country_code,
      city: input.city ?? current.city,
      address_line_1: input.address_line_1 ?? current.address_line_1,
      contact_name: input.contact_name ?? current.contact_name,
      contact_phone: input.contact_phone ?? current.contact_phone,
      provider_code: input.provider_code ?? current.provider_code,
      provider_warehouse_id: input.provider_warehouse_id ?? current.provider_warehouse_id,
      metadata: input.metadata ?? current.metadata,
    })
  }

  async testConnection(id: string, input?: { include_pickup_points?: boolean }) {
    const connection = await this.requireConnection(id)
    const adapter = getDeliveryHubAdapter(connection.provider_code)
    const correlationId = crypto.randomUUID()

    try {
      const result = await adapter.testConnection(
        this.buildAdapterContext(connection, correlationId)
      )
      let pickupPointsCount: number | null = null

      if (input?.include_pickup_points) {
        const points = await adapter.listPickupPoints(
          this.buildAdapterContext(connection, correlationId),
          {
            country_code: connection.country_code,
          }
        )
        pickupPointsCount = points.length
      }

      await this.appendLog({
        connection,
        kind: DELIVERY_HUB_LOG_KIND.connectionTest,
        correlation_id: correlationId,
        success: true,
        request_summary: {
          include_pickup_points: !!input?.include_pickup_points,
        },
        response_summary: {
          ...result.diagnostics,
          pickup_points_count: pickupPointsCount,
        },
      })

      await upsertDeliveryConnection(this.pg, {
        id: connection.id,
        provider_code: connection.provider_code,
        name: connection.name,
        status: DELIVERY_HUB_CONNECTION_STATUS.active,
        mode: connection.mode,
        enabled: connection.enabled,
        country_code: connection.country_code,
        config: connection.config,
        metadata: connection.metadata,
        credentials_envelope: connection.credentials_envelope,
        credentials_state: connection.credentials_envelope
          ? DELIVERY_HUB_CREDENTIALS_STATE.sealed
          : connection.credentials_state,
        credentials_fingerprint: connection.credentials_fingerprint,
        credentials_last_validated_at: new Date().toISOString(),
        credentials_last_error_code: null,
      })

      const diagnostics = redactRecord({
        ...result.diagnostics,
        pickup_points_count: pickupPointsCount,
        correlation_id: correlationId,
      })

      return {
        ...result,
        diagnostics,
        diagnostics_summary: buildDiagnosticsSummary({
          ok: result.ok,
          diagnostics,
          correlation_id: correlationId,
        }),
      }
    } catch (error) {
      const normalized = normalizeDeliveryHubError(error)

      await this.appendLog({
        connection,
        kind: DELIVERY_HUB_LOG_KIND.connectionTest,
        correlation_id: correlationId,
        success: false,
        error_code: normalized.code,
        request_summary: {
          include_pickup_points: !!input?.include_pickup_points,
        },
        response_summary: buildProviderErrorSummary(normalized, correlationId),
      })

      await this.materializeConnectionFailure(connection, normalized, {
        status: DELIVERY_HUB_CONNECTION_STATUS.error,
      })
      normalized.details = buildProviderErrorSummary(normalized, correlationId)
      throw normalized
    }
  }

  async testQuote(input: DeliveryTestQuoteInput) {
    const connection = await this.requireConnection(input.connection_id)
    const adapter = getDeliveryHubAdapter(connection.provider_code)
    const correlationId = crypto.randomUUID()
    const resolvedWarehouseId =
      input.mode_code === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint
        ? await this.resolveWarehouseProviderRef(connection, input.warehouse_id)
        : null

    try {
      const quotes =
        input.mode_code === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint
          ? await adapter.quoteWarehouseToPickupPoint(
              this.buildAdapterContext(connection, correlationId),
              {
                warehouse_id: requireString(resolvedWarehouseId, "warehouse_id"),
                destination_point_id: input.destination_point_id,
                interval_utc: input.interval_utc ?? null,
                currency_code: input.currency_code,
                items: input.items,
              }
            )
          : await adapter.quoteDropoffPointToPickupPoint(
              this.buildAdapterContext(connection, correlationId),
              {
                origin_point_id: requireString(input.origin_point_id, "origin_point_id"),
                destination_point_id: input.destination_point_id,
                currency_code: input.currency_code,
                items: input.items,
              }
            )

      const inputEcho = buildTestQuoteInputEcho(input)
      const diagnosticsSummary = buildDiagnosticsSummary({
        ok: true,
        diagnostics: { quotes_count: quotes.length },
        correlation_id: correlationId,
      })

      await this.appendLog({
        connection,
        kind: DELIVERY_HUB_LOG_KIND.quote,
        correlation_id: correlationId,
        success: true,
        request_summary: redactRecord({
          ...inputEcho,
          provider_warehouse_id_present: !!resolvedWarehouseId,
        }),
        response_summary: {
          quotes_count: quotes.length,
          quote_keys: quotes.map((quote) => quote.quote_key),
          diagnostics_summary: diagnosticsSummary,
        },
      })

      return {
        ok: true,
        connection: serializeDeliveryConnectionPublic(connection),
        quotes: quotes.map(sanitizeAdminQuote),
        correlation_id: correlationId,
        input_echo: inputEcho,
        diagnostics_summary: diagnosticsSummary,
      }
    } catch (error) {
      const normalized = normalizeDeliveryHubError(error)

      await this.appendLog({
        connection,
        kind: DELIVERY_HUB_LOG_KIND.quote,
        correlation_id: correlationId,
        success: false,
        error_code: normalized.code,
        request_summary: redactRecord({
          ...buildTestQuoteInputEcho(input),
          provider_warehouse_id_present: !!resolvedWarehouseId,
        }),
        response_summary: buildProviderErrorSummary(normalized, correlationId),
      })

      await this.materializeConnectionFailure(connection, normalized)
      normalized.details = buildProviderErrorSummary(normalized, correlationId)
      throw normalized
    }
  }

  async listAdminPickupPoints(input: {
    connection_id: string
    city?: string | null
    country_code?: string | null
    geo_id?: number | null
    pickup_point_id?: string | null
    operator_id?: string | null
    station_type?: "pickup_point" | "terminal" | "warehouse" | null
    available_for_dropoff?: boolean | null
    is_yandex_branded?: boolean | null
    is_not_branded_partner_station?: boolean | null
    limit?: number | null
  }): Promise<DeliveryHubAdminPickupPointLookupResponse> {
    const connection = await this.requireConnection(input.connection_id)
    const adapter = getDeliveryHubAdapter(connection.provider_code)
    const correlationId = crypto.randomUUID()
    const countryCode = normalizeNullableText(input.country_code) ?? connection.country_code
    const city = normalizeNullableText(input.city)
    const geoId = Number.isInteger(input.geo_id) ? input.geo_id : null
    const pickupPointId = normalizeNullableText(input.pickup_point_id)
    const operatorId = normalizeNullableText(input.operator_id)
    const stationType = input.station_type ?? null
    const availableForDropoff = typeof input.available_for_dropoff === "boolean" ? input.available_for_dropoff : null
    const isYandexBranded = typeof input.is_yandex_branded === "boolean" ? input.is_yandex_branded : null
    const isNotBrandedPartnerStation = typeof input.is_not_branded_partner_station === "boolean" ? input.is_not_branded_partner_station : null
    const limit = normalizePickupPointLookupLimit(input.limit)

    try {
      const points = await adapter.listPickupPoints(this.buildAdapterContext(connection, correlationId), {
        city,
        country_code: countryCode,
        geo_id: geoId,
        pickup_point_ids: pickupPointId ? [pickupPointId] : null,
        operator_ids: operatorId ? [operatorId] : null,
        station_type: stationType,
        available_for_dropoff: availableForDropoff,
        is_yandex_branded: isYandexBranded,
        is_not_branded_partner_station: isNotBrandedPartnerStation,
      })
      const sampledPoints = points.slice(0, limit).map(sanitizeAdminPickupPoint)

      await this.appendLog({
        connection,
        kind: DELIVERY_HUB_LOG_KIND.pickupPoints,
        correlation_id: correlationId,
        success: true,
        request_summary: {
          city,
          country_code: countryCode,
          geo_id: geoId,
          pickup_point_id_present: !!pickupPointId,
          operator_id: operatorId,
          station_type: stationType,
          available_for_dropoff: availableForDropoff,
          is_yandex_branded: isYandexBranded,
          is_not_branded_partner_station: isNotBrandedPartnerStation,
          limit,
          admin_lookup: true,
        },
        response_summary: {
          pickup_points_count: points.length,
          returned_count: sampledPoints.length,
          truncated: points.length > sampledPoints.length,
        },
      })

      return {
        ok: true,
        connection: serializeDeliveryConnectionPublic(connection),
        points: sampledPoints,
        limit,
        total_available: points.length,
        returned_count: sampledPoints.length,
        truncated: points.length > sampledPoints.length,
        correlation_id: correlationId,
      }
    } catch (error) {
      const normalized = normalizeDeliveryHubError(error)

      await this.appendLog({
        connection,
        kind: DELIVERY_HUB_LOG_KIND.pickupPoints,
        correlation_id: correlationId,
        success: false,
        error_code: normalized.code,
        request_summary: {
          city,
          country_code: countryCode,
          geo_id: geoId,
          pickup_point_id_present: !!pickupPointId,
          operator_id: operatorId,
          station_type: stationType,
          available_for_dropoff: availableForDropoff,
          is_yandex_branded: isYandexBranded,
          is_not_branded_partner_station: isNotBrandedPartnerStation,
          limit,
          admin_lookup: true,
        },
        response_summary: buildProviderErrorSummary(normalized, correlationId),
      })

      await this.materializeConnectionFailure(connection, normalized)
      normalized.details = buildProviderErrorSummary(normalized, correlationId)
      throw normalized
    }
  }

  async listAdminPickupWindows(input: {
    connection_id: string
    warehouse_id?: string | null
    destination_point_id?: string | null
    limit?: number | null
    items?: Array<{
      quantity?: number
      weight_grams?: number
      price?: number
    }>
  }): Promise<DeliveryHubAdminPickupWindowLookupResponse> {
    const connection = await this.requireConnection(input.connection_id)
    const adapter = getDeliveryHubAdapter(connection.provider_code)
    const correlationId = crypto.randomUUID()
    const resolvedWarehouseId = await this.resolveWarehouseProviderRef(connection, input.warehouse_id)
    const providerWarehouseId = requireString(resolvedWarehouseId, "warehouse_id")
    const destinationPointId = normalizeNullableText(input.destination_point_id)
    const limit = normalizePickupWindowLookupLimit(input.limit)

    try {
      const windows = await adapter.listPickupWindows(this.buildAdapterContext(connection, correlationId), {
        warehouse_id: providerWarehouseId,
        destination_point_id: destinationPointId,
        items: input.items,
      })
      const sampledWindows = windows.slice(0, limit).map(sanitizeAdminPickupWindow)

      await this.appendLog({
        connection,
        kind: DELIVERY_HUB_LOG_KIND.pickupWindows,
        correlation_id: correlationId,
        success: true,
        request_summary: {
          warehouse_id: input.warehouse_id ?? null,
          provider_warehouse_id_present: !!providerWarehouseId,
          destination_point_id_present: !!destinationPointId,
          limit,
          item_count: Array.isArray(input.items) ? input.items.length : 0,
          admin_lookup: true,
        },
        response_summary: {
          pickup_windows_count: windows.length,
          returned_count: sampledWindows.length,
          truncated: windows.length > sampledWindows.length,
        },
      })

      return {
        ok: true,
        connection: serializeDeliveryConnectionPublic(connection),
        warehouse_id: input.warehouse_id ?? "",
        destination_point_id: destinationPointId,
        windows: sampledWindows,
        limit,
        total_available: windows.length,
        returned_count: sampledWindows.length,
        truncated: windows.length > sampledWindows.length,
        correlation_id: correlationId,
      }
    } catch (error) {
      const normalized = normalizeDeliveryHubError(error)

      await this.appendLog({
        connection,
        kind: DELIVERY_HUB_LOG_KIND.pickupWindows,
        correlation_id: correlationId,
        success: false,
        error_code: normalized.code,
        request_summary: {
          warehouse_id: input.warehouse_id ?? null,
          provider_warehouse_id_present: !!providerWarehouseId,
          destination_point_id_present: !!destinationPointId,
          limit,
          item_count: Array.isArray(input.items) ? input.items.length : 0,
          admin_lookup: true,
        },
        response_summary: buildProviderErrorSummary(normalized, correlationId),
      })

      await this.materializeConnectionFailure(connection, normalized)
      normalized.details = buildProviderErrorSummary(normalized, correlationId)
      throw normalized
    }
  }

  async listStorePickupPoints(input: {
    connection_id?: string | null
    city?: string | null
    country_code?: string | null
  }) {
    const connection = await this.resolveStoreConnection(input.connection_id)
    const adapter = getDeliveryHubAdapter(connection.provider_code)
    const correlationId = crypto.randomUUID()
    const countryCode = normalizeNullableText(input.country_code) ?? connection.country_code
    const city = normalizeNullableText(input.city)

    try {
      const points = await adapter.listPickupPoints(this.buildAdapterContext(connection, correlationId), {
        city,
        country_code: countryCode,
      })

      await this.appendLog({
        connection,
        kind: DELIVERY_HUB_LOG_KIND.pickupPoints,
        correlation_id: correlationId,
        success: true,
        request_summary: {
          city,
          country_code: countryCode,
        },
        response_summary: {
          pickup_points_count: points.length,
        },
      })

      return {
        ok: true,
        points,
      }
    } catch (error) {
      const normalized = normalizeDeliveryHubError(error)

      await this.appendLog({
        connection,
        kind: DELIVERY_HUB_LOG_KIND.pickupPoints,
        correlation_id: correlationId,
        success: false,
        error_code: normalized.code,
        request_summary: {
          city,
          country_code: countryCode,
        },
        response_summary: {
          message: normalized.message,
          details: normalized.details ?? {},
        },
      })

      await this.materializeConnectionFailure(connection, normalized)

      throw normalized
    }
  }

  async listStorePickupWindows(input: {
    connection_id?: string | null
    warehouse_id?: string | null
  }) {
    const connection = await this.resolveStoreConnection(input.connection_id)
    const adapter = getDeliveryHubAdapter(connection.provider_code)
    const correlationId = crypto.randomUUID()
    const resolvedWarehouseId = await this.resolveWarehouseProviderRef(connection, input.warehouse_id)
    const providerWarehouseId = requireString(resolvedWarehouseId, "warehouse_id")

    try {
      const windows = await adapter.listPickupWindows(this.buildAdapterContext(connection, correlationId), {
        warehouse_id: providerWarehouseId,
      })

      await this.appendLog({
        connection,
        kind: DELIVERY_HUB_LOG_KIND.pickupWindows,
        correlation_id: correlationId,
        success: true,
        request_summary: {
          warehouse_id: input.warehouse_id ?? null,
          provider_warehouse_id: providerWarehouseId,
        },
        response_summary: {
          pickup_windows_count: windows.length,
        },
      })

      return {
        ok: true,
        pickup_windows: windows,
      }
    } catch (error) {
      const normalized = normalizeDeliveryHubError(error)

      await this.appendLog({
        connection,
        kind: DELIVERY_HUB_LOG_KIND.pickupWindows,
        correlation_id: correlationId,
        success: false,
        error_code: normalized.code,
        request_summary: {
          warehouse_id: input.warehouse_id ?? null,
          provider_warehouse_id: providerWarehouseId,
        },
        response_summary: {
          message: normalized.message,
          details: normalized.details ?? {},
        },
      })

      await this.materializeConnectionFailure(connection, normalized)

      throw normalized
    }
  }

  async listStoreQuotes(input: {
    connection_id?: string | null
    mode_code: string
    currency_code?: string | null
    destination_point_id: string
    origin_point_id?: string | null
    warehouse_id?: string | null
    interval_utc?: {
      from: string
      to: string
    } | null
    items?: Array<{
      quantity?: number
      weight_grams?: number
      price?: number
    }>
  }) {
    const connection = await this.resolveStoreConnection(input.connection_id)
    const adapter = getDeliveryHubAdapter(connection.provider_code)
    const correlationId = crypto.randomUUID()
    const resolvedWarehouseId =
      input.mode_code === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint
        ? await this.resolveWarehouseProviderRef(connection, input.warehouse_id)
        : null

    try {
      const quotes =
        input.mode_code === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint
          ? await adapter.quoteWarehouseToPickupPoint(
              this.buildAdapterContext(connection, correlationId),
              {
                warehouse_id: requireString(resolvedWarehouseId, "warehouse_id"),
                destination_point_id: input.destination_point_id,
                interval_utc: input.interval_utc ?? null,
                currency_code: input.currency_code ?? undefined,
                items: input.items,
              }
            )
          : await adapter.quoteDropoffPointToPickupPoint(
              this.buildAdapterContext(connection, correlationId),
              {
                origin_point_id: requireString(input.origin_point_id, "origin_point_id"),
                destination_point_id: input.destination_point_id,
                currency_code: input.currency_code ?? undefined,
                items: input.items,
              }
            )

      await this.appendLog({
        connection,
        kind: DELIVERY_HUB_LOG_KIND.quote,
        correlation_id: correlationId,
        success: true,
        request_summary: {
          mode_code: input.mode_code,
          destination_point_id: input.destination_point_id,
          origin_point_id: input.origin_point_id ?? null,
          warehouse_id: input.warehouse_id ?? null,
          provider_warehouse_id: resolvedWarehouseId,
          interval_utc: input.interval_utc ?? null,
        },
        response_summary: {
          quotes_count: quotes.length,
          quote_keys: quotes.map((quote) => quote.quote_key),
        },
      })

      return {
        ok: true,
        quotes: quotes.map((quote) =>
          sanitizeStoreQuote(connection.id, quote, input.mode_code === DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint
            ? {
                mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
                origin_point_id: requireString(input.origin_point_id, "origin_point_id"),
              }
            : {
                mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
                provider_warehouse_id: requireString(resolvedWarehouseId, "warehouse_id"),
              })
        ),
        diagnostics: {
          correlation_id: correlationId,
          checkout_source_of_truth: "unchanged",
          contour: "delivery_hub_storefront_preview",
        },
      }
    } catch (error) {
      const normalized = normalizeDeliveryHubError(error)

      await this.appendLog({
        connection,
        kind: DELIVERY_HUB_LOG_KIND.quote,
        correlation_id: correlationId,
        success: false,
        error_code: normalized.code,
        request_summary: {
          mode_code: input.mode_code,
          destination_point_id: input.destination_point_id,
          origin_point_id: input.origin_point_id ?? null,
          warehouse_id: input.warehouse_id ?? null,
          provider_warehouse_id: resolvedWarehouseId,
          interval_utc: input.interval_utc ?? null,
        },
        response_summary: {
          message: normalized.message,
          details: normalized.details ?? {},
        },
      })

      await this.materializeConnectionFailure(connection, normalized)

      throw normalized
    }
  }

  async getStoreSelectionReadiness(input: {
    cart_id: string
    metadata?: unknown
  }) {
    const cartId = requireString(input.cart_id, "cart_id")
    const selection = readDeliveryHubCartSelection(input.metadata)

    if (!selection) {
      return {
        ok: true,
        cart_id: cartId,
        ...buildDeliveryHubStoreSelectionReadiness({
          metadata: input.metadata,
        }),
      }
    }

    const connection = await this.getStoreSelectionConnectionSummary(selection.connection_id)

    return {
      ok: true,
      cart_id: cartId,
      ...buildDeliveryHubStoreSelectionReadiness({
        metadata: input.metadata,
        connection,
      }),
    }
  }

  async listStoreCatalog() {
    const { connections, defaultConnectionId } = await this.buildStoreCatalogSnapshot()

    return {
      ok: true,
      default_connection_id: defaultConnectionId,
      connections,
    }
  }

  async getStoreCutoverCandidate(input: {
    cart_id: string
    metadata?: unknown
    current_shipping_options?: DeliveryHubShippingOptionSnapshot[] | null
  }): Promise<DeliveryHubCutoverCandidateResponse> {
    return buildDeliveryHubCutoverCandidate({
      cart_id: input.cart_id,
      metadata: input.metadata,
      current_shipping_options: input.current_shipping_options ?? [],
    })
  }

  async getStoreCutoverPreconditions(): Promise<DeliveryHubCutoverPreconditionsResponse> {
    const [connections, warehouses, quoteEventLogs] = await Promise.all([
      listDeliveryConnectionsReadOnly(this.pg),
      listDeliveryWarehousesReadOnly(this.pg),
      listDeliveryEventLogsReadOnly(this.pg, {
        provider_code: DELIVERY_HUB_PROVIDER_YANDEX,
        limit: 100,
      }),
    ])
    const shippingOptionPlan = planDeliveryHubDesiredShippingOptions({
      connections,
      warehouses,
    })
    const fulfillmentBridgePreview = buildDeliveryHubFulfillmentBridgePreview({
      projected_modes: shippingOptionPlan.desired_options.map((option) => ({
        mode_code: option.mode_code,
        supporting_connection_ids: option.supporting_connection_ids,
      })),
      deferred_modes: shippingOptionPlan.deferred_options.map((option) => ({
        mode_code: option.mode_code,
        issues: option.issues.map<DeliveryHubFulfillmentBridgePlannerIssue>((issue) => ({
          connection_id: issue.connection_id,
          provider_code: issue.provider_code,
          code: issue.code,
          message: issue.message,
          mode_code: issue.mode_code,
        })),
      })),
    })

    return buildDeliveryHubCutoverPreconditions({
      connections,
      warehouses,
      shipping_option_plan: shippingOptionPlan,
      fulfillment_bridge_preview: fulfillmentBridgePreview,
      quote_event_logs: quoteEventLogs,
    })
  }

  async getStoreSettings(): Promise<DeliveryHubStoreSettingsResponse> {
    const { connections, defaultConnectionId } = await this.buildStoreCatalogSnapshot()
    const readyConnectionCount = connections.filter((connection) => connection.ready).length
    const modalityCodes = Array.from(
      new Set(connections.flatMap((connection) => connection.quote_types))
    )
    const defaultConnectionLabel =
      connections.find((connection) => connection.connection_id === defaultConnectionId)?.label ?? null

    return {
      ok: true,
      settings: {
        enabled: connections.length > 0,
        status:
          connections.length === 0
            ? "unavailable"
            : readyConnectionCount > 0
              ? "available"
              : "informational_only",
        summary: {
          enabled_connection_count: connections.length,
          ready_connection_count: readyConnectionCount,
          default_connection_label: defaultConnectionLabel,
          modality_codes: modalityCodes,
          supports_pickup_points: connections.some((connection) => connection.supports_pickup_points),
          supports_pickup_windows: connections.some((connection) => connection.supports_pickup_windows),
          supports_dropoff: connections.some((connection) => connection.supports_dropoff),
        },
        preview_visibility: {
          shadow_settings: true,
          readiness: true,
          persisted_selection: true,
          shadow_catalog: true,
          shadow_pickup_points: true,
          shadow_quotes: true,
          shadow_pickup_windows: true,
        },
        hints: buildStoreSettingsHints({
          connection_count: connections.length,
          ready_connection_count: readyConnectionCount,
          default_connection_label: defaultConnectionLabel,
          supports_pickup_points: connections.some((connection) => connection.supports_pickup_points),
          supports_pickup_windows: connections.some((connection) => connection.supports_pickup_windows),
          supports_dropoff: connections.some((connection) => connection.supports_dropoff),
        }),
      },
    }
  }

  private async buildStoreCatalogSnapshot(): Promise<{
    connections: DeliveryHubStoreCatalogConnection[]
    defaultConnectionId: string | null
  }> {
    const records = await listDeliveryConnections(this.pg)
    const connections: DeliveryHubStoreCatalogConnection[] = records
      .filter((connection) => connection.enabled)
      .map((connection) => {
        const readiness = buildDeliveryHubStoreSelectionConnectionSummary({
          id: connection.id,
          enabled: connection.enabled,
          status: connection.status,
          credentials_state: connection.credentials_state,
        })
        const capabilities = buildStoreCatalogCapabilities(connection)

        return {
          connection_id: connection.id,
          label: connection.name,
          state: readiness.state,
          ready: readiness.ready,
          ...capabilities,
        }
      })
    const readyConnections = connections.filter((connection) => connection.ready)

    return {
      connections,
      defaultConnectionId: readyConnections.length === 1 ? readyConnections[0].connection_id : null,
    }
  }

  private async saveConnection(
    input: DeliveryConnectionUpsertInput,
    current?: DeliveryConnectionRecord | null
  ) {
    getDeliveryHubAdapter(input.provider_code)

    const sanitizedConfig = await this.sanitizeConnectionConfig(input.config ?? current?.config ?? {})
    const encryptionState = getDeliveryHubEncryptionState()
    const hasNewCredentials = !!input.credentials?.token?.trim()

    const credentialsEnvelope = hasNewCredentials
      ? encryptDeliveryHubCredentials(input.credentials!, encryptionState)
      : current?.credentials_envelope

    const credentialsFingerprint = hasNewCredentials
      ? createCredentialsFingerprint(input.credentials!)
      : current?.credentials_fingerprint ?? null

    const credentialsState = hasNewCredentials
      ? DELIVERY_HUB_CREDENTIALS_STATE.sealed
      : current?.credentials_state ??
        (encryptionState.mode === "sealed"
          ? DELIVERY_HUB_CREDENTIALS_STATE.empty
          : DELIVERY_HUB_CREDENTIALS_STATE.disabled)

    const record = await upsertDeliveryConnection(this.pg, {
      id: input.id,
      provider_code: input.provider_code,
      name: input.name,
      status: input.status ?? current?.status ?? DELIVERY_HUB_CONNECTION_STATUS.draft,
      mode: input.mode,
      enabled: input.enabled ?? current?.enabled ?? false,
      country_code: input.country_code ?? current?.country_code,
      config: sanitizedConfig,
      metadata: input.metadata ?? current?.metadata ?? {},
      credentials_envelope: credentialsEnvelope,
      credentials_state: credentialsState,
      credentials_fingerprint: credentialsFingerprint,
      credentials_last_validated_at: hasNewCredentials
        ? null
        : current?.credentials_last_validated_at ?? null,
      credentials_last_error_code: hasNewCredentials
        ? null
        : current?.credentials_last_error_code ?? null,
    })

    if (hasNewCredentials || (!current && credentialsState === DELIVERY_HUB_CREDENTIALS_STATE.disabled)) {
      await this.appendLog({
        connection: record,
        kind: DELIVERY_HUB_LOG_KIND.credentials,
        correlation_id: crypto.randomUUID(),
        success: hasNewCredentials,
        error_code: null,
        request_summary: {
          provider_code: record.provider_code,
        },
        response_summary: {
          credentials_state: record.credentials_state,
          credentials_present: !!record.credentials_envelope,
        },
      })
    }

    const warehouseMap = await this.getWarehouseMap()
    return serializeDeliveryConnectionPublic(record, warehouseMap)
  }

  private async saveWarehouse(input: DeliveryWarehouseUpsertInput) {
    const providerCode = normalizeNullableText(input.provider_code)

    if (providerCode) {
      getDeliveryHubAdapter(providerCode)
    }

    const record = await upsertDeliveryWarehouse(this.pg, {
      id: input.id,
      name: input.name,
      enabled: input.enabled ?? true,
      country_code: input.country_code,
      city: input.city,
      address_line_1: input.address_line_1,
      contact_name: input.contact_name,
      contact_phone: input.contact_phone,
      provider_code: providerCode,
      provider_warehouse_id: input.provider_warehouse_id,
      metadata: input.metadata ?? {},
    })

    return serializeDeliveryWarehousePublic(record)
  }

  private async resolveStoreConnection(connectionId: string | null | undefined) {
    const explicitConnectionId = normalizeNullableText(connectionId)

    if (explicitConnectionId) {
      const connection = await this.requireConnection(explicitConnectionId)
      this.assertStoreConnectionReady(connection)
      return connection
    }

    const connections = await listDeliveryConnections(this.pg)
    const activeConnections = connections.filter(
      (connection) =>
        connection.enabled &&
        connection.status === DELIVERY_HUB_CONNECTION_STATUS.active &&
        connection.credentials_state === DELIVERY_HUB_CREDENTIALS_STATE.sealed
    )

    if (activeConnections.length === 1) {
      return activeConnections[0]
    }

    if (!activeConnections.length) {
      throw new DeliveryHubError({
        code: "DELIVERY_HUB_NOT_FOUND",
        message: "No active public delivery connection is available",
        status: 404,
      })
    }

    throw new DeliveryHubError({
      code: "DELIVERY_HUB_VALIDATION_ERROR",
      message: 'Field "connection_id" is required',
      status: 400,
      details: {
        field: "connection_id",
      },
    })
  }

  private assertStoreConnectionReady(connection: DeliveryConnectionRecord) {
    if (!connection.enabled) {
      throw new DeliveryHubError({
        code: "DELIVERY_HUB_VALIDATION_ERROR",
        message: "Delivery connection is disabled for store/public use",
        status: 409,
        details: {
          field: "connection_id",
        },
      })
    }

    if (connection.status !== DELIVERY_HUB_CONNECTION_STATUS.active) {
      throw new DeliveryHubError({
        code: "DELIVERY_HUB_VALIDATION_ERROR",
        message: "Delivery connection is not active for store/public use",
        status: 409,
        details: {
          field: "connection_id",
        },
      })
    }

    if (connection.credentials_state !== DELIVERY_HUB_CREDENTIALS_STATE.sealed) {
      throw new DeliveryHubError({
        code: "DELIVERY_HUB_VALIDATION_ERROR",
        message: "Delivery connection credentials are not ready for store/public use",
        status: 409,
        details: {
          field: "connection_id",
        },
      })
    }
  }

  private async getStoreSelectionConnectionSummary(connectionId: string) {
    const normalizedId = normalizeNullableText(connectionId)

    if (!normalizedId) {
      return createMissingDeliveryHubSelectionConnectionSummary(null, "missing")
    }

    const connection = await getDeliveryConnectionById(this.pg, normalizedId)

    if (!connection) {
      return createMissingDeliveryHubSelectionConnectionSummary(normalizedId, "not_found")
    }

    return buildDeliveryHubStoreSelectionConnectionSummary({
      id: connection.id,
      enabled: connection.enabled,
      status: connection.status,
      credentials_state: connection.credentials_state,
    })
  }

  private async requireConnection(id: string): Promise<DeliveryConnectionRecord> {
    const normalizedId = id?.trim()

    if (!normalizedId) {
      throw new DeliveryHubError({
        code: "DELIVERY_HUB_VALIDATION_ERROR",
        message: 'Field "id" is required',
        status: 400,
        details: { field: "id" },
      })
    }

    const connection = await getDeliveryConnectionById(this.pg, normalizedId)

    if (!connection) {
      throw new DeliveryHubError({
        code: "DELIVERY_HUB_NOT_FOUND",
        message: `Delivery Hub connection "${normalizedId}" was not found`,
        status: 404,
      })
    }

    return connection
  }

  private async requireWarehouse(id: string): Promise<DeliveryWarehouseRecord> {
    const normalizedId = id?.trim()

    if (!normalizedId) {
      throw new DeliveryHubError({
        code: "DELIVERY_HUB_VALIDATION_ERROR",
        message: 'Field "id" is required',
        status: 400,
        details: { field: "id" },
      })
    }

    const warehouse = await getDeliveryWarehouseById(this.pg, normalizedId)

    if (!warehouse) {
      throw new DeliveryHubError({
        code: "DELIVERY_HUB_NOT_FOUND",
        message: `Delivery Hub warehouse "${normalizedId}" was not found`,
        status: 404,
      })
    }

    return warehouse
  }

  private buildAdapterContext(connection: DeliveryConnectionRecord, correlation_id: string) {
    return {
      connection,
      correlation_id,
    }
  }

  private async appendLog(input: {
    connection: DeliveryConnectionRecord
    kind: string
    correlation_id: string
    success: boolean
    request_summary: Record<string, unknown>
    response_summary: Record<string, unknown>
    error_code?: string | null
  }) {
    await appendDeliveryEventLog(this.pg, {
      connection_id: input.connection.id,
      provider_code: input.connection.provider_code,
      kind: input.kind,
      correlation_id: input.correlation_id,
      success: input.success,
      request_summary: redactRecord(input.request_summary),
      response_summary: redactRecord(input.response_summary),
      error_code: input.error_code ?? null,
    })
  }

  private async materializeConnectionFailure(
    connection: DeliveryConnectionRecord,
    error: DeliveryHubError,
    input?: {
      status?: DeliveryConnectionRecord["status"]
    }
  ) {
    const nextCredentialsState =
      error.code === "DELIVERY_HUB_CREDENTIALS_INVALID"
        ? DELIVERY_HUB_CREDENTIALS_STATE.invalid
        : connection.credentials_state

    const nextStatus =
      input?.status ??
      (nextCredentialsState === DELIVERY_HUB_CREDENTIALS_STATE.invalid
        ? DELIVERY_HUB_CONNECTION_STATUS.error
        : connection.status)

    const nextValidatedAt =
      input?.status || error.code === "DELIVERY_HUB_CREDENTIALS_INVALID"
        ? null
        : connection.credentials_last_validated_at

    const shouldPersist =
      nextStatus !== connection.status ||
      nextCredentialsState !== connection.credentials_state ||
      nextValidatedAt !== connection.credentials_last_validated_at ||
      connection.credentials_last_error_code !== error.code

    if (!shouldPersist) {
      return connection
    }

    return upsertDeliveryConnection(this.pg, {
      id: connection.id,
      provider_code: connection.provider_code,
      name: connection.name,
      status: nextStatus,
      mode: connection.mode,
      enabled: connection.enabled,
      country_code: connection.country_code,
      config: connection.config,
      metadata: connection.metadata,
      credentials_envelope: connection.credentials_envelope,
      credentials_state: nextCredentialsState,
      credentials_fingerprint: connection.credentials_fingerprint,
      credentials_last_validated_at: nextValidatedAt,
      credentials_last_error_code: error.code,
    })
  }

  private async sanitizeConnectionConfig(config: Record<string, unknown>) {
    const nextConfig = { ...config }
    const rawDefaultWarehouseId = normalizeNullableText(config.default_warehouse_id)

    if (!rawDefaultWarehouseId) {
      delete nextConfig.default_warehouse_id
      return nextConfig
    }

    const warehouse = await this.requireWarehouse(rawDefaultWarehouseId)

    if (!warehouse.enabled) {
      throw new DeliveryHubError({
        code: "DELIVERY_HUB_VALIDATION_ERROR",
        message: "Default warehouse must be enabled",
        status: 400,
        details: {
          field: "config.default_warehouse_id",
          warehouse_id: warehouse.id,
        },
      })
    }

    nextConfig.default_warehouse_id = warehouse.id
    return nextConfig
  }

  private async resolveWarehouseProviderRef(
    connection: DeliveryConnectionRecord,
    warehouseId: string | null | undefined
  ) {
    const explicitWarehouseId = normalizeNullableText(warehouseId)
    const configDefaultWarehouseId = normalizeNullableText(connection.config.default_warehouse_id)
    const selectedWarehouseId = explicitWarehouseId ?? configDefaultWarehouseId

    if (!selectedWarehouseId) {
      return null
    }

    const warehouse = await this.requireWarehouse(selectedWarehouseId)

    if (!warehouse.enabled) {
      throw new DeliveryHubError({
        code: "DELIVERY_HUB_VALIDATION_ERROR",
        message: "Selected warehouse is disabled",
        status: 400,
        details: {
          field: explicitWarehouseId ? "warehouse_id" : "config.default_warehouse_id",
          warehouse_id: warehouse.id,
        },
      })
    }

    if (warehouse.provider_code && warehouse.provider_code !== connection.provider_code) {
      throw new DeliveryHubError({
        code: "DELIVERY_HUB_VALIDATION_ERROR",
        message: "Warehouse provider does not match connection provider",
        status: 400,
        details: {
          field: explicitWarehouseId ? "warehouse_id" : "config.default_warehouse_id",
          warehouse_id: warehouse.id,
          warehouse_provider_code: warehouse.provider_code,
          connection_provider_code: connection.provider_code,
        },
      })
    }

    if (connection.provider_code === DELIVERY_HUB_PROVIDER_YANDEX && !warehouse.provider_warehouse_id) {
      throw new DeliveryHubError({
        code: "DELIVERY_HUB_VALIDATION_ERROR",
        message: "Warehouse provider mapping is required for this connection",
        status: 400,
        details: {
          field: explicitWarehouseId ? "warehouse_id" : "config.default_warehouse_id",
          warehouse_id: warehouse.id,
        },
      })
    }

    return warehouse.provider_warehouse_id ?? warehouse.id
  }

  private async getWarehouseMap() {
    const warehouses = await listDeliveryWarehouses(this.pg)
    return new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]))
  }
}

export function createDeliveryHubService(pg: DeliveryHubPgConnection) {
  return new DeliveryHubService(pg)
}

function normalizeDeliveryHubError(error: unknown) {
  if (isDeliveryHubError(error)) {
    return error
  }

  return new DeliveryHubError({
    code: "DELIVERY_HUB_PROVIDER_ERROR",
    message: error instanceof Error ? error.message : "Unknown Delivery Hub error",
    status: 502,
  })
}


function buildDiagnosticsSummary(input: {
  ok: boolean
  diagnostics: Record<string, unknown>
  correlation_id: string
  error?: DeliveryHubError
}): DeliveryHubDiagnosticsSummary {
  const details = input.error?.details ?? {}
  const providerStatus = normalizeProviderStatus(
    input.diagnostics.provider_status ??
      input.diagnostics.provider_status_code ??
      details.provider_status ??
      details.status
  )

  return {
    status: input.ok ? "ok" : "error",
    provider_status: providerStatus,
    error_category: input.ok ? null : normalizeProviderErrorCategory(input.error),
    message: input.ok ? null : input.error?.message ?? "Provider request failed",
    correlation_id: input.correlation_id,
    checked_at: new Date().toISOString(),
    redacted: true,
  }
}

function buildProviderErrorSummary(error: DeliveryHubError, correlationId: string) {
  return redactRecord({
    message: error.message,
    code: error.code,
    provider_status: normalizeProviderStatus(error.details?.provider_status),
    error_category: normalizeProviderErrorCategory(error),
    diagnostics_summary: buildDiagnosticsSummary({
      ok: false,
      diagnostics: {},
      correlation_id: correlationId,
      error,
    }),
    details: error.details ?? {},
  })
}

function normalizeProviderStatus(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim().toLowerCase()
  }

  return null
}

function normalizeProviderErrorCategory(error?: DeliveryHubError) {
  if (!error) {
    return null
  }

  if (error.code === "DELIVERY_HUB_CREDENTIALS_INVALID") {
    return "auth"
  }

  const providerStatus = error.details?.provider_status

  if (typeof providerStatus === "number") {
    if (providerStatus === 401 || providerStatus === 403) {
      return "auth"
    }
    if (providerStatus === 408 || providerStatus === 429 || providerStatus >= 500) {
      return "provider_unavailable"
    }
    if (providerStatus >= 400) {
      return "provider_rejected"
    }
  }

  return error.status >= 500 ? "provider_error" : "validation"
}

function buildTestQuoteInputEcho(input: DeliveryTestQuoteInput): DeliveryTestQuoteEcho {
  return {
    connection_id: input.connection_id,
    mode_code: input.mode_code,
    destination_point_id: input.destination_point_id,
    origin_point_id: input.origin_point_id ?? null,
    warehouse_id: input.warehouse_id ?? null,
    interval_utc: input.interval_utc ?? null,
    currency_code: input.currency_code ?? null,
    item_count: input.items?.length ?? 0,
  }
}

function sanitizeAdminQuote(quote: DeliveryQuote): DeliveryQuote {
  return {
    ...quote,
    raw_reference: redactRecord(quote.raw_reference ?? {}),
  }
}

function sanitizeAdminPickupPoint(point: DeliveryPickupPoint): DeliveryHubAdminPickupPointLookupPoint {
  return {
    id: point.provider_point_id,
    code: point.provider_point_code,
    operator_id: point.provider_operator_id ?? null,
    network_label: point.network_label ?? null,
    station_type: point.station_type ?? null,
    is_yandex_branded: point.is_yandex_branded ?? null,
    is_market_partner: point.is_market_partner ?? null,
    name: point.name,
    address: point.address,
    city: point.city,
    available_for_dropoff: point.is_origin_dropoff_allowed,
    coordinates: {
      lat: point.lat,
      lng: point.lng,
    },
  }
}

function sanitizeAdminPickupWindow(window: DeliveryPickupWindow): DeliveryHubAdminPickupWindowLookupWindow {
  return {
    date: window.date,
    time_from: window.time_from,
    time_to: window.time_to,
    interval_utc: {
      from: window.interval_utc.from,
      to: window.interval_utc.to,
    },
    label: window.label,
  }
}

function normalizePickupPointLookupLimit(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 20
  }

  return Math.max(1, Math.min(50, Math.floor(value)))
}

function normalizePickupWindowLookupLimit(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 20
  }

  return Math.max(1, Math.min(50, Math.floor(value)))
}

function requireString(value: string | null | undefined, field: string) {
  if (typeof value === "string" && value.trim()) {
    return value.trim()
  }

  throw new DeliveryHubError({
    code: "DELIVERY_HUB_VALIDATION_ERROR",
    message: `Field "${field}" is required`,
    status: 400,
    details: { field },
  })
}

function normalizeNullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function buildStoreCatalogCapabilities(
  connection: DeliveryConnectionRecord
): Pick<
  DeliveryHubStoreCatalogConnection,
  "quote_types" | "supports_pickup_points" | "supports_pickup_windows" | "supports_dropoff"
> {
  const adapter = getDeliveryHubAdapter(connection.provider_code)
  const quote_types = adapter.definition.supported_mode_codes.filter(
    (modeCode): modeCode is DeliveryStoreQuotePublic["mode_code"] => isStoreCatalogQuoteType(modeCode)
  )

  return {
    quote_types,
    supports_pickup_points: adapter.definition.capabilities.includes("list_pickup_points"),
    supports_pickup_windows:
      quote_types.includes(DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint) &&
      adapter.definition.capabilities.includes("list_pickup_windows"),
    supports_dropoff: quote_types.includes(DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint),
  }
}

function buildStoreSettingsHints(input: {
  connection_count: number
  ready_connection_count: number
  default_connection_label: string | null
  supports_pickup_points: boolean
  supports_pickup_windows: boolean
  supports_dropoff: boolean
}) {
  const hints = [
    input.connection_count === 0
      ? "Delivery Hub storefront visibility is currently unavailable because no shopper-visible connections are enabled."
      : input.ready_connection_count > 0
        ? `Delivery Hub currently exposes ${input.ready_connection_count} ready connection${input.ready_connection_count === 1 ? "" : "s"} for read-only storefront visibility.`
        : "Delivery Hub storefront visibility is currently informational only because no ready connection is exposed.",
    input.default_connection_label
      ? `Default neutral storefront connection is ${input.default_connection_label}.`
      : input.connection_count > 1
        ? "No default neutral storefront connection is exposed while multiple shopper-visible connections remain available."
        : input.connection_count === 1
          ? "Returned neutral storefront connection set does not expose a separate default hint."
          : null,
    input.supports_pickup_points
      ? "Returned neutral settings indicate pickup-point visibility support."
      : null,
    input.supports_pickup_windows
      ? "Returned neutral settings indicate pickup-window visibility support."
      : null,
    input.supports_dropoff
      ? "Returned neutral settings indicate dropoff-origin modality visibility."
      : null,
    "This settings surface is read-only and does not save selection state, commit checkout delivery, or enable live dispatch.",
  ]

  return Array.from(new Set(hints.filter((hint): hint is string => !!hint)))
}

function isStoreCatalogQuoteType(modeCode: string) {
  return (
    modeCode === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint ||
    modeCode === DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint
  )
}

function sanitizeStoreQuote(
  connectionId: string,
  quote: DeliveryQuote,
  providerOriginDispatchContext:
    | {
        mode_code: typeof DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint
        origin_point_id: string
      }
    | {
        mode_code: typeof DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint
        provider_warehouse_id: string
      }
): DeliveryStoreQuotePublic {
  return {
    carrier_code: quote.carrier_code,
    carrier_label: quote.carrier_label,
    mode_code: quote.mode_code,
    amount: quote.amount,
    currency_code: quote.currency_code,
    delivery_eta_min: quote.delivery_eta_min,
    delivery_eta_max: quote.delivery_eta_max,
    pickup_point_required: quote.pickup_point_required,
    pickup_point_ids: quote.pickup_point_ids,
    pickup_window_required: quote.pickup_window_required,
    quote_reference: createDeliveryHubQuoteReference({
      connection_id: connectionId,
      quote_type: quote.mode_code,
      quote_key: quote.quote_key,
      provider_origin_dispatch_context: providerOriginDispatchContext,
    }),
  }
}
