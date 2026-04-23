import { DELIVERY_HUB_PROVIDER_YANDEX } from "../../constants"
import type { YandexCreateShipmentMaterializerMode } from "./create-shipment-materializer"

export const YANDEX_CREATE_SHIPMENT_DISPATCH_PORT_VERSION = 1

export type YandexCreateShipmentDispatchPortBlockedReasonCode =
  | "execution_gate_disabled"
  | "dispatch_port_not_implemented"
  | "provider_not_supported"
  | "mode_not_supported"

export type YandexCreateShipmentDispatchPortSummary = {
  provider_code: typeof DELIVERY_HUB_PROVIDER_YANDEX
  operation: "create_shipment"
  available: boolean
  implemented: false
  execution_gate_enabled: boolean
  dispatch_attempted: false
  dispatch_blocked: true
  blocked_reason_code: YandexCreateShipmentDispatchPortBlockedReasonCode
  blocked_reason: string
  preview_materialization_available: boolean
  preview_materialization_ready: boolean
  preview_mode: "preview_only"
  supported_mode: boolean
  mode_code: YandexCreateShipmentMaterializerMode | string | null
}

export type YandexCreateShipmentDispatchPortContract = {
  version: typeof YANDEX_CREATE_SHIPMENT_DISPATCH_PORT_VERSION
  provider_code: typeof DELIVERY_HUB_PROVIDER_YANDEX
  operation: "create_shipment"
  summary: YandexCreateShipmentDispatchPortSummary
}

export function buildYandexCreateShipmentDispatchPortContract(input: {
  execution_gate_enabled: boolean
  preview_available: boolean
  preview_ready: boolean
  mode_code: YandexCreateShipmentMaterializerMode | string | null
  supported_mode: boolean
  provider_supported: boolean
}): YandexCreateShipmentDispatchPortContract {
  const blockedReason = resolveBlockedReason(input)

  return {
    version: YANDEX_CREATE_SHIPMENT_DISPATCH_PORT_VERSION,
    provider_code: DELIVERY_HUB_PROVIDER_YANDEX,
    operation: "create_shipment",
    summary: {
      provider_code: DELIVERY_HUB_PROVIDER_YANDEX,
      operation: "create_shipment",
      available: input.provider_supported && input.supported_mode && input.execution_gate_enabled,
      implemented: false,
      execution_gate_enabled: input.execution_gate_enabled,
      dispatch_attempted: false,
      dispatch_blocked: true,
      blocked_reason_code: blockedReason.code,
      blocked_reason: blockedReason.message,
      preview_materialization_available: input.preview_available,
      preview_materialization_ready: input.preview_ready,
      preview_mode: "preview_only",
      supported_mode: input.supported_mode,
      mode_code: input.mode_code,
    },
  }
}

function resolveBlockedReason(input: {
  execution_gate_enabled: boolean
  supported_mode: boolean
  provider_supported: boolean
}) {
  if (!input.provider_supported) {
    return {
      code: "provider_not_supported" as const,
      message:
        "Direct Yandex create_shipment dispatch port is not available because the controlled execution seam is not on the Yandex provider contour.",
    }
  }

  if (!input.supported_mode) {
    return {
      code: "mode_not_supported" as const,
      message:
        "Direct Yandex create_shipment dispatch port is not available because the committed Delivery Hub mode is outside the currently supported direct Yandex contour.",
    }
  }

  if (!input.execution_gate_enabled) {
    return {
      code: "execution_gate_disabled" as const,
      message:
        "Direct Yandex create_shipment dispatch port remains runtime-blocked because DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED is disabled.",
    }
  }

  return {
    code: "dispatch_port_not_implemented" as const,
    message:
      "Direct Yandex create_shipment dispatch port boundary is materialized, but the actual adapter invocation is intentionally not implemented.",
  }
}
