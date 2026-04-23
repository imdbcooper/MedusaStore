import type { FulfillmentWorkflow } from "@medusajs/framework/types"
import { updateShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"
import { APISHIP_PROVIDER_ID } from "./apiship"
import {
  APISHIP_TO_DOOR_OPTION_ID,
  APISHIP_TO_POINT_OPTION_ID,
  type ApiShipSettings,
  type ApiShipShopperModeKey,
  buildApiShipShippingOptionData,
  getShopperModeLabel,
  resolveEnabledApiShipModeDefinitionsForShopperMode,
} from "./apiship-settings"

export const APISHIP_TO_DOOR_OPTION_NAME = "ApiShip — До двери"
export const APISHIP_TO_POINT_OPTION_NAME = "ApiShip — В пункт выдачи"
export const APISHIP_LEGACY_DOOR_OPTION_ID = "apiship_courier_to_address"
export const APISHIP_LEGACY_DOOR_OPTION_NAME = "ApiShip Courier to Address"

export type ApiShipShippingOptionRecord = {
  id: string
  name?: string | null
  provider_id?: string | null
  data?: Record<string, unknown> | null
}

export function getApiShipShippingOptionName(shopperModeKey: ApiShipShopperModeKey) {
  return shopperModeKey === APISHIP_TO_POINT_OPTION_ID
    ? APISHIP_TO_POINT_OPTION_NAME
    : APISHIP_TO_DOOR_OPTION_NAME
}

export function getApiShipShippingOptionType(shopperModeKey: ApiShipShopperModeKey) {
  return shopperModeKey === APISHIP_TO_POINT_OPTION_ID
    ? {
        label: "Пункт выдачи",
        description: "ApiShip delivery to pickup point with provider/tariff selection.",
        code: "apiship-to-point",
      }
    : {
        label: "До двери",
        description: "ApiShip delivery to recipient address with provider/tariff selection.",
        code: "apiship-to-door",
      }
}

export function isApiShipStoreModeEnabled(
  settings: ApiShipSettings,
  shopperModeKey: ApiShipShopperModeKey
) {
  return (
    settings.enabled &&
    resolveEnabledApiShipModeDefinitionsForShopperMode(settings, shopperModeKey).length > 0
  )
}

export function buildApiShipStoreRules(enabled: boolean) {
  return [
    {
      attribute: "enabled_in_store",
      value: enabled ? "true" : "false",
      operator: "eq" as const,
    },
    {
      attribute: "is_return",
      value: "false",
      operator: "eq" as const,
    },
  ]
}

export function resolveApiShipShippingOptionTargets(
  existingShippingOptions: ApiShipShippingOptionRecord[]
) {
  const doorOption =
    findByDataId(existingShippingOptions, APISHIP_TO_DOOR_OPTION_ID) ||
    findByDataId(existingShippingOptions, APISHIP_LEGACY_DOOR_OPTION_ID) ||
    findByName(existingShippingOptions, APISHIP_TO_DOOR_OPTION_NAME) ||
    findByName(existingShippingOptions, APISHIP_LEGACY_DOOR_OPTION_NAME)

  const pointOption =
    findByDataId(existingShippingOptions, APISHIP_TO_POINT_OPTION_ID) ||
    findByName(existingShippingOptions, APISHIP_TO_POINT_OPTION_NAME)

  return {
    [APISHIP_TO_DOOR_OPTION_ID]: doorOption,
    [APISHIP_TO_POINT_OPTION_ID]: pointOption,
  }
}

export function buildApiShipShippingOptionUpdate(
  shippingOptionId: string,
  shopperModeKey: ApiShipShopperModeKey,
  settings: ApiShipSettings
): FulfillmentWorkflow.UpdateShippingOptionsWorkflowInput {
  return {
    id: shippingOptionId,
    name: getApiShipShippingOptionName(shopperModeKey),
    price_type: "calculated" as const,
    provider_id: APISHIP_PROVIDER_ID,
    type: getApiShipShippingOptionType(shopperModeKey),
    data: buildApiShipShippingOptionData(shopperModeKey, settings),
    rules: buildApiShipStoreRules(isApiShipStoreModeEnabled(settings, shopperModeKey)),
  }
}

export async function syncExistingApiShipShippingOptions(
  container: any,
  existingShippingOptions: ApiShipShippingOptionRecord[],
  settings: ApiShipSettings
) {
  const targets = resolveApiShipShippingOptionTargets(existingShippingOptions)
  const updates: FulfillmentWorkflow.UpdateShippingOptionsWorkflowInput[] = []

  if (targets[APISHIP_TO_DOOR_OPTION_ID]) {
    updates.push(
      buildApiShipShippingOptionUpdate(
        targets[APISHIP_TO_DOOR_OPTION_ID]!.id,
        APISHIP_TO_DOOR_OPTION_ID,
        settings
      )
    )
  }

  if (targets[APISHIP_TO_POINT_OPTION_ID]) {
    updates.push(
      buildApiShipShippingOptionUpdate(
        targets[APISHIP_TO_POINT_OPTION_ID]!.id,
        APISHIP_TO_POINT_OPTION_ID,
        settings
      )
    )
  }

  if (!updates.length) {
    return []
  }

  const { result } = await updateShippingOptionsWorkflow(container).run({
    input: updates,
  })

  return result
}

function findByName(
  shippingOptions: ApiShipShippingOptionRecord[],
  name: string
) {
  return (
    shippingOptions.find(
      (candidate) =>
        candidate.provider_id === APISHIP_PROVIDER_ID && candidate.name === name
    ) ?? null
  )
}

function findByDataId(
  shippingOptions: ApiShipShippingOptionRecord[],
  dataId: string
) {
  return (
    shippingOptions.find((candidate) => {
      return (
        candidate.provider_id === APISHIP_PROVIDER_ID &&
        getNonEmptyString(candidate.data?.id) === dataId
      )
    }) ?? null
  )
}

function getNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}
