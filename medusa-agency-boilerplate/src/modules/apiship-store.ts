import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createShippingOptionsWorkflow } from "@medusajs/medusa/core-flows"
import {
  type ApiShipSettings,
  getApiShipPgConnection,
  getApiShipSettings,
} from "./apiship-settings"
import {
  type ApiShipShippingOptionRecord,
  APISHIP_TO_DOOR_OPTION_NAME,
  APISHIP_TO_POINT_OPTION_NAME,
  buildApiShipShippingOptionUpdate,
  getApiShipShippingOptionType,
  isApiShipStoreModeEnabled,
  syncExistingApiShipShippingOptions,
} from "./apiship-shipping-options"
import {
  APISHIP_TO_DOOR_OPTION_ID,
  APISHIP_TO_POINT_OPTION_ID,
  buildApiShipShippingOptionData,
} from "./apiship-settings"
import { APISHIP_PROVIDER_ID } from "./apiship"

type QueryGraphInput = {
  entity: string
  fields: string[]
  filters?: Record<string, unknown>
}

type QueryGraphResult<T> = {
  data: T[]
}

type QueryGraphLike = {
  graph: <T>(input: QueryGraphInput) => Promise<QueryGraphResult<T>>
}

type StoreRecord = {
  id: string
}

export async function listStoreApiShipShippingOptions(query: QueryGraphLike) {
  const { data } = await query.graph<ApiShipShippingOptionRecord>({
    entity: "shipping_option",
    fields: ["id", "name", "provider_id", "data"],
    filters: {
      provider_id: APISHIP_PROVIDER_ID,
    },
  })

  return data || []
}

export async function getApiShipStore(reqOrContainer: any) {
  const query = reqOrContainer.scope
    ? (reqOrContainer.scope.resolve(ContainerRegistrationKeys.QUERY) as QueryGraphLike)
    : (reqOrContainer.resolve(ContainerRegistrationKeys.QUERY) as QueryGraphLike)

  const { data } = await query.graph<StoreRecord>({
    entity: "store",
    fields: ["id"],
  })

  return data?.[0] ?? null
}

export async function getApiShipSettingsFromContainer(container: any): Promise<ApiShipSettings> {
  const pgConnection = getApiShipPgConnection(container)
  return getApiShipSettings(pgConnection)
}

export async function ensureApiShipShippingOptionsForStore(input: {
  container: any
  service_zone_id: string
  shipping_profile_id: string
  existing_shipping_options: ApiShipShippingOptionRecord[]
  settings: ApiShipSettings
}) {
  const existingById = new Map(
    input.existing_shipping_options.map((option) => [String(option.id), option])
  )

  const existingDoor = input.existing_shipping_options.find((option) => {
    return getDataId(option) === APISHIP_TO_DOOR_OPTION_ID
  })
  const existingPoint = input.existing_shipping_options.find((option) => {
    return getDataId(option) === APISHIP_TO_POINT_OPTION_ID
  })

  const createInput: any[] = []

  if (!existingDoor) {
    createInput.push({
      name: APISHIP_TO_DOOR_OPTION_NAME,
      price_type: "calculated",
      provider_id: APISHIP_PROVIDER_ID,
      service_zone_id: input.service_zone_id,
      shipping_profile_id: input.shipping_profile_id,
      type: getApiShipShippingOptionType(APISHIP_TO_DOOR_OPTION_ID),
      data: buildApiShipShippingOptionData(APISHIP_TO_DOOR_OPTION_ID, input.settings),
      rules: [
        {
          attribute: "enabled_in_store",
          value: isApiShipStoreModeEnabled(input.settings, APISHIP_TO_DOOR_OPTION_ID)
            ? "true"
            : "false",
          operator: "eq" as const,
        },
        {
          attribute: "is_return",
          value: "false",
          operator: "eq" as const,
        },
      ],
    })
  }

  if (!existingPoint) {
    createInput.push({
      name: APISHIP_TO_POINT_OPTION_NAME,
      price_type: "calculated",
      provider_id: APISHIP_PROVIDER_ID,
      service_zone_id: input.service_zone_id,
      shipping_profile_id: input.shipping_profile_id,
      type: getApiShipShippingOptionType(APISHIP_TO_POINT_OPTION_ID),
      data: buildApiShipShippingOptionData(APISHIP_TO_POINT_OPTION_ID, input.settings),
      rules: [
        {
          attribute: "enabled_in_store",
          value: isApiShipStoreModeEnabled(input.settings, APISHIP_TO_POINT_OPTION_ID)
            ? "true"
            : "false",
          operator: "eq" as const,
        },
        {
          attribute: "is_return",
          value: "false",
          operator: "eq" as const,
        },
      ],
    })
  }

  if (createInput.length) {
    await createShippingOptionsWorkflow(input.container).run({
      input: createInput,
    })
  }

  const refreshQuery = input.container.resolve(
    ContainerRegistrationKeys.QUERY
  ) as QueryGraphLike
  const refreshed = await listStoreApiShipShippingOptions(refreshQuery)

  const updates = refreshed
    .map((option) => {
      const dataId = getDataId(option)

      if (dataId === APISHIP_TO_DOOR_OPTION_ID) {
        return buildApiShipShippingOptionUpdate(option.id, APISHIP_TO_DOOR_OPTION_ID, input.settings)
      }

      if (dataId === APISHIP_TO_POINT_OPTION_ID) {
        return buildApiShipShippingOptionUpdate(option.id, APISHIP_TO_POINT_OPTION_ID, input.settings)
      }

      return null
    })
    .filter((value) => value !== null)

  if (updates.length) {
    await syncExistingApiShipShippingOptions(input.container, refreshed, input.settings)
  }

  return {
    created_option_count: createInput.length,
    shipping_options: refreshed,
    existing_option_count: existingById.size,
  }
}

function getDataId(option: ApiShipShippingOptionRecord) {
  return typeof option.data?.id === "string" ? option.data.id.trim() : null
}
