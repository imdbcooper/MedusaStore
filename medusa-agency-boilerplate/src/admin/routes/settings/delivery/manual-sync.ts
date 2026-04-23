export const DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD =
  "deliveryhub:execute_shipping_option_sync"

export type DeliveryHubShippingOptionManualSyncErrorMode = "abort" | "continue"
export type DeliveryHubShippingOptionManualSyncMode = "dry_run" | "execute"

export type DeliveryHubShippingOptionCreateModeCode =
  | "warehouse_to_pickup_point"
  | "dropoff_point_to_pickup_point"

export type DeliveryHubShippingOptionManualSyncRequest = {
  mode: DeliveryHubShippingOptionManualSyncMode
  confirm_execute?: string
  on_error: DeliveryHubShippingOptionManualSyncErrorMode
  mutation_context?: {
    create: Record<
      string,
      {
        name: string
        service_zone_id: string
        shipping_profile_id: string
      }
    >
  }
}

export function isDeliveryHubShippingOptionManualSyncGuardConfirmed(value: string) {
  return value.trim() === DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD
}

export function getDeliveryHubShippingOptionDefaultCreateName(modeCode: string) {
  switch (modeCode) {
    case "warehouse_to_pickup_point":
      return "Delivery Hub — Со склада в пункт выдачи"
    case "dropoff_point_to_pickup_point":
      return "Delivery Hub — Из дроп-офф пункта в пункт выдачи"
    default:
      return `Delivery Hub — ${modeCode}`
  }
}

export function buildDeliveryHubShippingOptionManualSyncDryRunRequest(input?: {
  on_error?: DeliveryHubShippingOptionManualSyncErrorMode
}): DeliveryHubShippingOptionManualSyncRequest {
  return {
    mode: "dry_run",
    on_error: input?.on_error ?? "abort",
  }
}

export function buildDeliveryHubShippingOptionManualSyncExecuteRequest(input: {
  confirm_execute: string
  service_zone_id: string
  shipping_profile_id: string
  on_error?: DeliveryHubShippingOptionManualSyncErrorMode
  mode_codes?: string[]
  names?: Partial<Record<string, string>>
}): DeliveryHubShippingOptionManualSyncRequest {
  if (!isDeliveryHubShippingOptionManualSyncGuardConfirmed(input.confirm_execute)) {
    throw new Error("delivery_hub_manual_sync_execute_guard_mismatch")
  }

  const serviceZoneId = input.service_zone_id.trim()
  const shippingProfileId = input.shipping_profile_id.trim()

  if (!serviceZoneId || !shippingProfileId) {
    throw new Error("delivery_hub_manual_sync_execute_context_incomplete")
  }

  const modeCodes = input.mode_codes?.length
    ? input.mode_codes
    : ["warehouse_to_pickup_point", "dropoff_point_to_pickup_point"]

  return {
    mode: "execute",
    confirm_execute: DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD,
    on_error: input.on_error ?? "abort",
    mutation_context: {
      create: Object.fromEntries(
        modeCodes.map((modeCode) => {
          const configuredName = input.names?.[modeCode]?.trim()

          return [
            modeCode,
            {
              name: configuredName || getDeliveryHubShippingOptionDefaultCreateName(modeCode),
              service_zone_id: serviceZoneId,
              shipping_profile_id: shippingProfileId,
            },
          ]
        })
      ),
    },
  }
}
