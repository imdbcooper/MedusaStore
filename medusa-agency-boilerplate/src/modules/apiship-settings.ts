import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const APISHIP_TO_DOOR_OPTION_ID = "apiship_to_door"
export const APISHIP_TO_POINT_OPTION_ID = "apiship_to_point"
export const APISHIP_SETTINGS_DEPRECATION_NOTICE =
  "ApiShip settings are deprecated legacy compatibility controls and should not be enabled for fresh templates; configure Delivery Hub/direct Yandex instead."

export const APISHIP_SHOPPER_MODE_KEYS = [
  APISHIP_TO_DOOR_OPTION_ID,
  APISHIP_TO_POINT_OPTION_ID,
] as const

export const APISHIP_TECHNICAL_MODE_KEYS = [
  "door_to_door",
  "dropoff_to_door",
  "door_to_point",
  "dropoff_to_point",
] as const

export type ApiShipShopperModeKey = (typeof APISHIP_SHOPPER_MODE_KEYS)[number]
export type ApiShipTechnicalModeKey = (typeof APISHIP_TECHNICAL_MODE_KEYS)[number]

export type ApiShipModeDefinition = {
  key: ApiShipTechnicalModeKey
  shopper_mode_key: ApiShipShopperModeKey
  shopper_mode_label: string
  pickup_type: 1 | 2
  delivery_type: 1 | 2
}

export type ApiShipSettings = {
  enabled: boolean
  modes: Record<ApiShipTechnicalModeKey, boolean>
  updated_at: string | null
}

export type ApiShipSettingsInput = {
  enabled: boolean
  modes: Record<ApiShipTechnicalModeKey, boolean>
}

export type ApiShipStorefrontSettings = {
  enabled: boolean
  shopper_modes: Record<
    ApiShipShopperModeKey,
    {
      mode_key: ApiShipShopperModeKey
      mode_label: string
      shipping_option_id: string
      enabled: boolean
      technical_mode_keys: ApiShipTechnicalModeKey[]
      pickup_types: number[]
      delivery_type: 1 | 2
    }
  >
}

type RawSqlRowsResult<T> = {
  rows?: T[]
}

type PgConnectionLike = {
  raw: <T = unknown>(sql: string, bindings?: unknown[]) => Promise<RawSqlRowsResult<T>>
}

type ApiShipSettingsRow = {
  enabled?: boolean | null
  door_to_door?: boolean | null
  dropoff_to_door?: boolean | null
  door_to_point?: boolean | null
  dropoff_to_point?: boolean | null
  updated_at?: string | Date | null
}

const APISHIP_SETTINGS_SINGLETON_ID = "default"

export const APISHIP_MODE_DEFINITIONS: Record<ApiShipTechnicalModeKey, ApiShipModeDefinition> = {
  door_to_door: {
    key: "door_to_door",
    shopper_mode_key: APISHIP_TO_DOOR_OPTION_ID,
    shopper_mode_label: "До двери",
    pickup_type: 1,
    delivery_type: 1,
  },
  dropoff_to_door: {
    key: "dropoff_to_door",
    shopper_mode_key: APISHIP_TO_DOOR_OPTION_ID,
    shopper_mode_label: "До двери",
    pickup_type: 2,
    delivery_type: 1,
  },
  door_to_point: {
    key: "door_to_point",
    shopper_mode_key: APISHIP_TO_POINT_OPTION_ID,
    shopper_mode_label: "В пункт выдачи",
    pickup_type: 1,
    delivery_type: 2,
  },
  dropoff_to_point: {
    key: "dropoff_to_point",
    shopper_mode_key: APISHIP_TO_POINT_OPTION_ID,
    shopper_mode_label: "В пункт выдачи",
    pickup_type: 2,
    delivery_type: 2,
  },
}

export function getApiShipPgConnection(container: any) {
  return container.resolve(
    ContainerRegistrationKeys.PG_CONNECTION
  ) as PgConnectionLike
}

// Deprecated legacy compatibility defaults. Keep disabled-by-default until the
// staged ApiShip removal packages delete the settings surface.
export function getDefaultApiShipSettings(
  input?: {
    enabled?: boolean
    modes?: Partial<Record<ApiShipTechnicalModeKey, boolean>>
    updated_at?: string | null
  }
): ApiShipSettings {
  const defaultModes: Record<ApiShipTechnicalModeKey, boolean> = {
    door_to_door: true,
    dropoff_to_door: false,
    door_to_point: true,
    dropoff_to_point: false,
  }

  return {
    enabled: normalizeBoolean(input?.enabled, false),
    modes: {
      door_to_door: normalizeBoolean(input?.modes?.door_to_door, defaultModes.door_to_door),
      dropoff_to_door: normalizeBoolean(
        input?.modes?.dropoff_to_door,
        defaultModes.dropoff_to_door
      ),
      door_to_point: normalizeBoolean(input?.modes?.door_to_point, defaultModes.door_to_point),
      dropoff_to_point: normalizeBoolean(
        input?.modes?.dropoff_to_point,
        defaultModes.dropoff_to_point
      ),
    },
    updated_at: normalizeIsoDate(input?.updated_at),
  }
}

export async function ensureApiShipSettingsTable(pgConnection: PgConnectionLike) {
  await pgConnection.raw(`
    create table if not exists apiship_settings (
      id text primary key,
      enabled boolean not null default false,
      door_to_door boolean not null default true,
      dropoff_to_door boolean not null default false,
      door_to_point boolean not null default true,
      dropoff_to_point boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `)
}

export async function bootstrapApiShipSettings(
  pgConnection: PgConnectionLike,
  input?: Partial<ApiShipSettingsInput>
): Promise<ApiShipSettings> {
  await ensureApiShipSettingsTable(pgConnection)

  const defaults = getDefaultApiShipSettings(input)

  await pgConnection.raw(
    `
      insert into apiship_settings (
        id,
        enabled,
        door_to_door,
        dropoff_to_door,
        door_to_point,
        dropoff_to_point
      )
      values (?, ?, ?, ?, ?, ?)
      on conflict (id) do nothing
    `,
    [
      APISHIP_SETTINGS_SINGLETON_ID,
      defaults.enabled,
      defaults.modes.door_to_door,
      defaults.modes.dropoff_to_door,
      defaults.modes.door_to_point,
      defaults.modes.dropoff_to_point,
    ]
  )

  return getApiShipSettings(pgConnection)
}

export async function getApiShipSettings(
  pgConnection: PgConnectionLike
): Promise<ApiShipSettings> {
  await ensureApiShipSettingsTable(pgConnection)

  const rows = getRawRows<ApiShipSettingsRow>(
    await pgConnection.raw(
      `
        select enabled, door_to_door, dropoff_to_door, door_to_point, dropoff_to_point, updated_at
        from apiship_settings
        where id = ?
        limit 1
      `,
      [APISHIP_SETTINGS_SINGLETON_ID]
    )
  )

  if (rows[0]) {
    return normalizeApiShipSettingsRecord(rows[0])
  }

  return bootstrapApiShipSettings(pgConnection)
}

export async function upsertApiShipSettings(
  pgConnection: PgConnectionLike,
  input: Partial<ApiShipSettingsInput>
) {
  const current = await getApiShipSettings(pgConnection)
  const next = mergeApiShipSettings(current, input)
  const rows = getRawRows<ApiShipSettingsRow>(
    await pgConnection.raw(
      `
        insert into apiship_settings (
          id,
          enabled,
          door_to_door,
          dropoff_to_door,
          door_to_point,
          dropoff_to_point,
          updated_at
        )
        values (?, ?, ?, ?, ?, ?, now())
        on conflict (id)
        do update set
          enabled = excluded.enabled,
          door_to_door = excluded.door_to_door,
          dropoff_to_door = excluded.dropoff_to_door,
          door_to_point = excluded.door_to_point,
          dropoff_to_point = excluded.dropoff_to_point,
          updated_at = now()
        returning enabled, door_to_door, dropoff_to_door, door_to_point, dropoff_to_point, updated_at
      `,
      [
        APISHIP_SETTINGS_SINGLETON_ID,
        next.enabled,
        next.modes.door_to_door,
        next.modes.dropoff_to_door,
        next.modes.door_to_point,
        next.modes.dropoff_to_point,
      ]
    )
  )

  return normalizeApiShipSettingsRecord(rows[0] || null)
}

export function mergeApiShipSettings(
  current: ApiShipSettings,
  input: Partial<ApiShipSettingsInput>
): ApiShipSettings {
  return {
    enabled: normalizeBoolean(input.enabled, current.enabled),
    modes: {
      door_to_door: normalizeBoolean(
        input.modes?.door_to_door,
        current.modes.door_to_door
      ),
      dropoff_to_door: normalizeBoolean(
        input.modes?.dropoff_to_door,
        current.modes.dropoff_to_door
      ),
      door_to_point: normalizeBoolean(
        input.modes?.door_to_point,
        current.modes.door_to_point
      ),
      dropoff_to_point: normalizeBoolean(
        input.modes?.dropoff_to_point,
        current.modes.dropoff_to_point
      ),
    },
    updated_at: current.updated_at,
  }
}

export function normalizeApiShipSettingsRecord(value: ApiShipSettingsRow | null | undefined) {
  return getDefaultApiShipSettings({
    enabled: value?.enabled ?? undefined,
    modes: {
      door_to_door: value?.door_to_door ?? undefined,
      dropoff_to_door: value?.dropoff_to_door ?? undefined,
      door_to_point: value?.door_to_point ?? undefined,
      dropoff_to_point: value?.dropoff_to_point ?? undefined,
    },
    updated_at: normalizeIsoDate(value?.updated_at),
  })
}

export function resolveEnabledApiShipModeDefinitions(settings: ApiShipSettings) {
  return APISHIP_TECHNICAL_MODE_KEYS.filter((key) => settings.modes[key]).map(
    (key) => APISHIP_MODE_DEFINITIONS[key]
  )
}

export function resolveEnabledApiShipModeDefinitionsForShopperMode(
  settings: ApiShipSettings,
  shopperModeKey: ApiShipShopperModeKey
) {
  return resolveEnabledApiShipModeDefinitions(settings).filter(
    (definition) => definition.shopper_mode_key === shopperModeKey
  )
}

export function resolveAllowedPickupTypesForShopperMode(
  settings: ApiShipSettings,
  shopperModeKey: ApiShipShopperModeKey
) {
  return Array.from(
    new Set(
      resolveEnabledApiShipModeDefinitionsForShopperMode(settings, shopperModeKey).map(
        (definition) => definition.pickup_type
      )
    )
  ).sort((left, right) => left - right)
}

export function buildApiShipShippingOptionData(
  shopperModeKey: ApiShipShopperModeKey,
  settings: ApiShipSettings
) {
  const enabledDefinitions = resolveEnabledApiShipModeDefinitionsForShopperMode(
    settings,
    shopperModeKey
  )
  const deliveryType = enabledDefinitions[0]?.delivery_type ?? getDeliveryTypeForShopperMode(shopperModeKey)
  const pickupTypes = resolveAllowedPickupTypesForShopperMode(settings, shopperModeKey)

  return {
    id: shopperModeKey,
    mode_key: shopperModeKey,
    mode_label: getShopperModeLabel(shopperModeKey),
    deliveryType,
    pickupTypes,
    technicalModes: enabledDefinitions.map((definition) => definition.key),
    ...(pickupTypes.length === 1 ? { pickupType: pickupTypes[0] } : {}),
  }
}

export function projectApiShipSettingsForStore(settings: ApiShipSettings): ApiShipStorefrontSettings {
  return {
    enabled: settings.enabled,
    shopper_modes: {
      [APISHIP_TO_DOOR_OPTION_ID]: {
        mode_key: APISHIP_TO_DOOR_OPTION_ID,
        mode_label: getShopperModeLabel(APISHIP_TO_DOOR_OPTION_ID),
        shipping_option_id: APISHIP_TO_DOOR_OPTION_ID,
        enabled:
          settings.enabled &&
          resolveEnabledApiShipModeDefinitionsForShopperMode(
            settings,
            APISHIP_TO_DOOR_OPTION_ID
          ).length > 0,
        technical_mode_keys: resolveEnabledApiShipModeDefinitionsForShopperMode(
          settings,
          APISHIP_TO_DOOR_OPTION_ID
        ).map((definition) => definition.key),
        pickup_types: resolveAllowedPickupTypesForShopperMode(
          settings,
          APISHIP_TO_DOOR_OPTION_ID
        ),
        delivery_type: 1,
      },
      [APISHIP_TO_POINT_OPTION_ID]: {
        mode_key: APISHIP_TO_POINT_OPTION_ID,
        mode_label: getShopperModeLabel(APISHIP_TO_POINT_OPTION_ID),
        shipping_option_id: APISHIP_TO_POINT_OPTION_ID,
        enabled:
          settings.enabled &&
          resolveEnabledApiShipModeDefinitionsForShopperMode(
            settings,
            APISHIP_TO_POINT_OPTION_ID
          ).length > 0,
        technical_mode_keys: resolveEnabledApiShipModeDefinitionsForShopperMode(
          settings,
          APISHIP_TO_POINT_OPTION_ID
        ).map((definition) => definition.key),
        pickup_types: resolveAllowedPickupTypesForShopperMode(
          settings,
          APISHIP_TO_POINT_OPTION_ID
        ),
        delivery_type: 2,
      },
    },
  }
}

export function resolveApiShipTechnicalMode(
  pickupType: number,
  deliveryType: number
): ApiShipModeDefinition | null {
  return (
    Object.values(APISHIP_MODE_DEFINITIONS).find(
      (definition) =>
        definition.pickup_type === pickupType && definition.delivery_type === deliveryType
    ) ?? null
  )
}

export function getDeliveryTypeForShopperMode(shopperModeKey: ApiShipShopperModeKey): 1 | 2 {
  return shopperModeKey === APISHIP_TO_POINT_OPTION_ID ? 2 : 1
}

export function getShopperModeLabel(shopperModeKey: ApiShipShopperModeKey) {
  return shopperModeKey === APISHIP_TO_POINT_OPTION_ID ? "В пункт выдачи" : "До двери"
}

function getRawRows<T>(result: RawSqlRowsResult<T>) {
  return Array.isArray(result?.rows) ? result.rows : []
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback
}

function normalizeIsoDate(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value.trim() : parsed.toISOString()
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString()
  }

  return null
}
