import {
  DELIVERY_HUB_CONNECTION_STATUS,
  DELIVERY_HUB_CREDENTIALS_STATE,
  DELIVERY_HUB_MODE_CODE,
  DELIVERY_HUB_PROVIDER_YANDEX,
} from "./constants"
import type { DeliveryConnectionRecord } from "./domain/connection"
import type { DeliveryWarehouseRecord } from "./domain/warehouse"
import { getDeliveryHubAdapter } from "./registry"
import {
  buildDeliveryHubShippingOptionData,
  DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
  DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
  type DeliveryHubFulfillmentModeCode,
  type DeliveryHubShippingOptionData,
} from "./shipping-option-contract"

export type DeliveryHubShippingOptionPlannerIssueCode =
  | "unsupported_provider"
  | "no_supported_modes"
  | "connection_disabled"
  | "connection_not_active"
  | "credentials_not_ready"
  | "missing_default_warehouse"
  | "default_warehouse_not_found"
  | "default_warehouse_disabled"
  | "default_warehouse_provider_mismatch"
  | "default_warehouse_mapping_required"

export type DeliveryHubShippingOptionPlannerIssue = {
  code: DeliveryHubShippingOptionPlannerIssueCode
  message: string
  mode_code: DeliveryHubFulfillmentModeCode | null
}

export type DeliveryHubProjectedShippingOption = {
  status: "projected"
  mode_code: DeliveryHubFulfillmentModeCode
  data: DeliveryHubShippingOptionData
  supporting_connection_ids: string[]
}

export type DeliveryHubDeferredShippingOption = {
  status: "deferred"
  mode_code: DeliveryHubFulfillmentModeCode
  data: DeliveryHubShippingOptionData
  issues: Array<
    DeliveryHubShippingOptionPlannerIssue & {
      connection_id: string
      provider_code: string
    }
  >
}

export type DeliveryHubShippingOptionConnectionPlan = {
  connection_id: string
  provider_code: string
  status: "projected" | "deferred" | "skipped"
  projected_mode_codes: DeliveryHubFulfillmentModeCode[]
  issues: DeliveryHubShippingOptionPlannerIssue[]
}

export type DeliveryHubShippingOptionPlan = {
  provider_code: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE
  provider_id: typeof DELIVERY_HUB_FULFILLMENT_PROVIDER_ID
  desired_options: DeliveryHubProjectedShippingOption[]
  deferred_options: DeliveryHubDeferredShippingOption[]
  connection_plans: DeliveryHubShippingOptionConnectionPlan[]
}

export function planDeliveryHubDesiredShippingOptions(input: {
  connections: DeliveryConnectionRecord[]
  warehouses?: DeliveryWarehouseRecord[]
}): DeliveryHubShippingOptionPlan {
  const warehouses = input.warehouses ?? []
  const warehouseMap = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]))
  const projectedByMode = createModeBuckets<string[]>()
  const deferredByMode = createModeBuckets<DeliveryHubDeferredShippingOption["issues"]>()
  const connectionPlans = input.connections.map((connection) => {
    const plan = planConnectionShippingOptions(connection, warehouseMap)

    for (const modeCode of plan.projected_mode_codes) {
      projectedByMode[modeCode].push(connection.id)
    }

    for (const issue of plan.issues) {
      if (!issue.mode_code) {
        continue
      }

      deferredByMode[issue.mode_code].push({
        connection_id: connection.id,
        provider_code: connection.provider_code,
        ...issue,
      })
    }

    return plan
  })

  const desired_options = getAllDeliveryHubModeCodes()
    .filter((modeCode) => projectedByMode[modeCode].length > 0)
    .map((modeCode) => ({
      status: "projected" as const,
      mode_code: modeCode,
      data: buildDeliveryHubShippingOptionData(modeCode),
      supporting_connection_ids: projectedByMode[modeCode],
    }))

  const deferred_options = getAllDeliveryHubModeCodes()
    .filter(
      (modeCode) =>
        projectedByMode[modeCode].length === 0 && deferredByMode[modeCode].length > 0
    )
    .map((modeCode) => ({
      status: "deferred" as const,
      mode_code: modeCode,
      data: buildDeliveryHubShippingOptionData(modeCode),
      issues: deferredByMode[modeCode],
    }))

  return {
    provider_code: DELIVERY_HUB_FULFILLMENT_PROVIDER_CODE,
    provider_id: DELIVERY_HUB_FULFILLMENT_PROVIDER_ID,
    desired_options,
    deferred_options,
    connection_plans: connectionPlans,
  }
}

export function planConnectionShippingOptions(
  connection: DeliveryConnectionRecord,
  warehouses: Map<string, DeliveryWarehouseRecord> | DeliveryWarehouseRecord[] = []
): DeliveryHubShippingOptionConnectionPlan {
  const warehouseMap =
    warehouses instanceof Map ? warehouses : new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]))
  const adapter = resolveDeliveryHubAdapter(connection.provider_code)

  if (!adapter) {
    return {
      connection_id: connection.id,
      provider_code: connection.provider_code,
      status: "skipped",
      projected_mode_codes: [],
      issues: [
        {
          code: "unsupported_provider",
          message: `Connection provider "${connection.provider_code}" is not supported by deliveryhub planner.`,
          mode_code: null,
        },
      ],
    }
  }

  const supportedModes = normalizeSupportedModeCodes(adapter.definition.supported_mode_codes)

  if (!supportedModes.length) {
    return {
      connection_id: connection.id,
      provider_code: connection.provider_code,
      status: "skipped",
      projected_mode_codes: [],
      issues: [
        {
          code: "no_supported_modes",
          message: `Connection provider "${connection.provider_code}" does not expose supported deliveryhub mode codes.`,
          mode_code: null,
        },
      ],
    }
  }

  const projected_mode_codes: DeliveryHubFulfillmentModeCode[] = []
  const issues: DeliveryHubShippingOptionPlannerIssue[] = []
  const connectionRolloutIssue = resolveConnectionRolloutIssue(connection)

  for (const modeCode of supportedModes) {
    if (connectionRolloutIssue) {
      issues.push({
        ...connectionRolloutIssue,
        mode_code: modeCode,
      })
      continue
    }

    const modeIssue = resolveModeRolloutIssue(connection, modeCode, warehouseMap)

    if (modeIssue) {
      issues.push(modeIssue)
      continue
    }

    projected_mode_codes.push(modeCode)
  }

  return {
    connection_id: connection.id,
    provider_code: connection.provider_code,
    status: projected_mode_codes.length
      ? issues.length
        ? "deferred"
        : "projected"
      : "deferred",
    projected_mode_codes,
    issues,
  }
}

function resolveConnectionRolloutIssue(
  connection: DeliveryConnectionRecord
): Omit<DeliveryHubShippingOptionPlannerIssue, "mode_code"> | null {
  if (!connection.enabled) {
    return {
      code: "connection_disabled",
      message: `Connection "${connection.id}" is disabled and is not ready for deliveryhub shipping-option rollout.`,
    }
  }

  if (connection.status !== DELIVERY_HUB_CONNECTION_STATUS.active) {
    return {
      code: "connection_not_active",
      message: `Connection "${connection.id}" is not active and is not ready for deliveryhub shipping-option rollout.`,
    }
  }

  if (connection.credentials_state !== DELIVERY_HUB_CREDENTIALS_STATE.sealed) {
    return {
      code: "credentials_not_ready",
      message: `Connection "${connection.id}" credentials are not sealed and rollout must stay deferred.`,
    }
  }

  return null
}

function resolveModeRolloutIssue(
  connection: DeliveryConnectionRecord,
  modeCode: DeliveryHubFulfillmentModeCode,
  warehouses: Map<string, DeliveryWarehouseRecord>
): DeliveryHubShippingOptionPlannerIssue | null {
  if (modeCode !== DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint) {
    return null
  }

  const defaultWarehouseId = normalizeNullableText(connection.config.default_warehouse_id)

  if (!defaultWarehouseId) {
    return {
      code: "missing_default_warehouse",
      message: `Connection "${connection.id}" does not have config.default_warehouse_id, so warehouse rollout stays deferred.`,
      mode_code: modeCode,
    }
  }

  const warehouse = warehouses.get(defaultWarehouseId)

  if (!warehouse) {
    return {
      code: "default_warehouse_not_found",
      message: `Connection "${connection.id}" references missing default warehouse "${defaultWarehouseId}".`,
      mode_code: modeCode,
    }
  }

  if (!warehouse.enabled) {
    return {
      code: "default_warehouse_disabled",
      message: `Connection "${connection.id}" references disabled default warehouse "${warehouse.id}".`,
      mode_code: modeCode,
    }
  }

  if (warehouse.provider_code && warehouse.provider_code !== connection.provider_code) {
    return {
      code: "default_warehouse_provider_mismatch",
      message: `Connection "${connection.id}" default warehouse "${warehouse.id}" is mapped to provider "${warehouse.provider_code}" instead of "${connection.provider_code}".`,
      mode_code: modeCode,
    }
  }

  if (
    connection.provider_code === DELIVERY_HUB_PROVIDER_YANDEX &&
    !normalizeNullableText(warehouse.provider_warehouse_id)
  ) {
    return {
      code: "default_warehouse_mapping_required",
      message: `Connection "${connection.id}" requires provider_warehouse_id on warehouse "${warehouse.id}" before warehouse rollout can be materialized.`,
      mode_code: modeCode,
    }
  }

  return null
}

function resolveDeliveryHubAdapter(providerCode: string) {
  try {
    return getDeliveryHubAdapter(providerCode)
  } catch {
    return null
  }
}

function normalizeSupportedModeCodes(
  modeCodes: readonly string[]
): DeliveryHubFulfillmentModeCode[] {
  return modeCodes.filter(isDeliveryHubModeCode)
}

function isDeliveryHubModeCode(value: string): value is DeliveryHubFulfillmentModeCode {
  return getAllDeliveryHubModeCodes().includes(value as DeliveryHubFulfillmentModeCode)
}

function getAllDeliveryHubModeCodes(): DeliveryHubFulfillmentModeCode[] {
  return [
    DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
    DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
  ]
}

function createModeBuckets<T>() {
  return {
    [DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint]: [] as T,
    [DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint]: [] as T,
  }
}

function normalizeNullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}
