import { z } from "@medusajs/framework/zod"
import {
  DELIVERY_HUB_QUOTE_REFERENCE_ID_PATTERN,
  DELIVERY_HUB_SUPPORTED_PUBLIC_PROVIDER_CODES,
} from "../constants"

export const DeliveryHubConnectionConfigSchema = z.object({
  auto_confirm: z.boolean().optional(),
  label_format: z.string().optional(),
  default_warehouse_id: z.string().optional(),
})

export const DeliveryHubCreateConnectionSchema = z.object({
  provider_code: z.string().min(1),
  name: z.string().min(1),
  mode: z.enum(["test", "live"]),
  enabled: z.boolean().optional(),
  country_code: z.string().min(2).max(2).optional(),
  credentials: z
    .object({
      token: z.string().min(1),
    })
    .optional(),
  config: DeliveryHubConnectionConfigSchema.optional(),
  metadata: z.record(z.any()).optional(),
})

export const DeliveryHubUpdateConnectionSchema = DeliveryHubCreateConnectionSchema.extend({
  id: z.string().min(1).optional(),
})
  .partial()
  .extend({
    name: z.string().min(1),
  })

const DeliveryHubWarehouseMetadataSchema = z
  .object({
    postal_code: z.string().trim().min(1).optional(),
    contact_email: z.string().trim().email().optional(),
    coordinates: z.tuple([z.number().finite(), z.number().finite()]).nullable().optional(),
    lat: z.number().finite().optional(),
    lng: z.number().finite().optional(),
    fullname: z.string().trim().min(1).optional(),
  })
  .passthrough()

export const DeliveryHubCreateWarehouseSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean().optional(),
  country_code: z.string().trim().min(2).max(2),
  city: z.string().trim().min(1),
  address_line_1: z.string().trim().min(1),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  provider_code: z.string().optional(),
  provider_warehouse_id: z.string().optional(),
  metadata: DeliveryHubWarehouseMetadataSchema.optional(),
})

export const DeliveryHubUpdateWarehouseSchema = DeliveryHubCreateWarehouseSchema.extend({
  id: z.string().min(1).optional(),
})
  .partial()
  .extend({
    name: z.string().min(1),
  })

export const DeliveryHubConnectionTestSchema = z.object({
  include_pickup_points: z.boolean().optional(),
})


export const DeliveryHubAdminPickupPointsQuerySchema = z.object({
  connection_id: z.string().trim().min(1),
  city: z.string().trim().min(1).optional(),
  country_code: z.string().trim().min(2).max(2).optional(),
  geo_id: z.coerce.number().int().min(0).optional(),
  pickup_point_id: z.string().trim().min(1).optional(),
  operator_id: z.enum(["market_l4g", "5post"]).optional(),
  station_type: z.enum(["pickup_point", "terminal", "warehouse"]).optional(),
  available_for_dropoff: z.coerce.boolean().optional(),
  is_yandex_branded: z.coerce.boolean().optional(),
  is_not_branded_partner_station: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

export const DeliveryHubAdminPickupWindowsQuerySchema = z.object({
  connection_id: z.string().trim().min(1),
  warehouse_id: z.string().trim().min(1).optional(),
  destination_point_id: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

export const DeliveryHubQuoteItemsSchema = z
  .array(
    z.object({
      quantity: z.number().int().positive().optional(),
      weight_grams: z.number().positive().optional(),
      price: z.number().nonnegative().optional(),
    })
  )
  .optional()

export const DeliveryHubIntervalUtcSchema = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
  })
  .optional()

const DeliveryHubRoutePointAddressSchema = z.object({
  fullname: z.string().trim().min(1),
  coordinates: z.tuple([z.number().finite(), z.number().finite()]).nullable().optional(),
  contact: z.object({
    name: z.string().trim().min(1).nullable().optional(),
    phone: z.string().trim().min(1).nullable().optional(),
  }).nullable().optional(),
}).strict()

export const DeliveryHubTestQuoteSchema = z.object({
  connection_id: z.string().min(1),
  mode_code: z.enum(["warehouse_to_pickup_point", "dropoff_point_to_pickup_point"]),
  currency_code: z.string().min(3).max(3).optional(),
  destination_point_id: z.string().min(1),
  destination_address: DeliveryHubRoutePointAddressSchema.optional(),
  origin_point_id: z.string().optional(),
  warehouse_id: z.string().optional(),
  interval_utc: DeliveryHubIntervalUtcSchema,
  items: DeliveryHubQuoteItemsSchema,
})

const DeliveryHubStoreQuoteModeSchema = z.enum([
  "warehouse_to_pickup_point",
  "dropoff_point_to_pickup_point",
])

const DeliveryHubStoreQuoteBaseSchema = z.object({
  connection_id: z.string().trim().min(1).optional(),
  mode_code: DeliveryHubStoreQuoteModeSchema,
  currency_code: z.string().trim().min(3).max(3).optional(),
  destination_point_id: z.string().trim().min(1),
  destination_address: DeliveryHubRoutePointAddressSchema.optional(),
  origin_point_id: z.string().trim().min(1).optional(),
  origin_address: DeliveryHubRoutePointAddressSchema.optional(),
  warehouse_id: z.string().trim().min(1).optional(),
})

export const DeliveryHubStoreQuotesQuerySchema = DeliveryHubStoreQuoteBaseSchema.extend({
  interval_utc: z.string().trim().optional(),
  items: z.string().trim().optional(),
})

export const DeliveryHubStoreQuotesBodySchema = DeliveryHubStoreQuoteBaseSchema.extend({
  interval_utc: DeliveryHubIntervalUtcSchema.nullable().optional(),
  items: DeliveryHubQuoteItemsSchema,
}).strict()

export const DeliveryHubStorePickupPointsQuerySchema = z.object({
  connection_id: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  country_code: z.string().trim().min(2).max(2).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export const DeliveryHubStorePickupWindowsQuerySchema = z.object({
  connection_id: z.string().trim().min(1).optional(),
  warehouse_id: z.string().trim().min(1).optional(),
})

export const DeliveryHubStoreCartSelectionQuerySchema = z.object({
  cart_id: z.string().trim().min(1),
})

export const DeliveryHubStoreSelectionReadinessQuerySchema = z.object({
  cart_id: z.string().trim().min(1),
})

export const DeliveryHubStoreCutoverCandidateQuerySchema = z.object({
  cart_id: z.string().trim().min(1),
})

export const DeliveryHubStoreCutoverApprovalArtifactQuerySchema = z.object({
  cart_id: z.string().trim().min(1).optional(),
})

export const DeliveryHubStoreCatalogQuerySchema = z.object({})

export const DeliveryHubStoreSettingsQuerySchema = z.object({})

export const DeliveryHubStoreCutoverPreconditionsQuerySchema = z.object({})

export const DeliveryHubStoreCartSelectionQuoteSchema = z
  .object({
    carrier_code: z.string().trim().min(1),
    carrier_label: z.string().trim().min(1),
    amount: z.number().finite(),
    currency_code: z.string().trim().min(1),
    delivery_eta_min: z.number().int().nonnegative().nullable(),
    delivery_eta_max: z.number().int().nonnegative().nullable(),
    pickup_point_required: z.boolean(),
    pickup_window_required: z.boolean(),
  })
  .strict()

export const DeliveryHubStoreCartSelectionPickupPointSchema = z
  .object({
    provider_point_id: z.string().trim().min(1),
    provider_point_code: z.string().trim().min(1).nullable().optional(),
    provider_operator_id: z.string().trim().min(1).nullable().optional(),
    network_label: z.string().trim().min(1).nullable().optional(),
    is_yandex_branded: z.boolean().nullable().optional(),
    is_market_partner: z.boolean().nullable().optional(),
    station_type: z.string().trim().min(1).nullable().optional(),
    name: z.string().trim().min(1),
    address: z.string().trim().min(1),
    city: z.string().trim().min(1).nullable().optional(),
    region: z.string().trim().min(1).nullable().optional(),
    postal_code: z.string().trim().min(1).nullable().optional(),
    lat: z.number().finite().nullable().optional(),
    lng: z.number().finite().nullable().optional(),
    is_origin_dropoff_allowed: z.boolean(),
    is_destination_pickup_allowed: z.boolean(),
    payment_methods: z.array(z.string().trim().min(1)).optional(),
  })
  .strict()

export const DeliveryHubStoreCartSelectionPickupWindowSchema = z
  .object({
    date: z.string().trim().min(1),
    time_from: z.string().trim().min(1).nullable().optional(),
    time_to: z.string().trim().min(1).nullable().optional(),
    interval_utc: z
      .object({
        from: z.string().trim().min(1),
        to: z.string().trim().min(1),
      })
      .strict(),
    label: z.string().trim().min(1),
  })
  .strict()

export const DeliveryHubStoreQuoteReferenceSchema = z
  .object({
    id: z.string().trim().regex(
      DELIVERY_HUB_QUOTE_REFERENCE_ID_PATTERN,
      "quote_reference.id must be an opaque Delivery Hub quote reference"
    ),
    version: z.number().int().positive(),
  })
  .strict()

export const DeliveryHubStoreProviderCodeSchema = z.enum(DELIVERY_HUB_SUPPORTED_PUBLIC_PROVIDER_CODES)

export const DeliveryHubStoreUpsertCartSelectionBodySchema = z
  .object({
    cart_id: z.string().trim().min(1),
    connection_id: z.string().trim().min(1),
    provider_code: DeliveryHubStoreProviderCodeSchema.optional(),
    quote_type: z.enum(["warehouse_to_pickup_point", "dropoff_point_to_pickup_point"]),
    quote_reference: DeliveryHubStoreQuoteReferenceSchema,
    quote: DeliveryHubStoreCartSelectionQuoteSchema,
    pickup_point: DeliveryHubStoreCartSelectionPickupPointSchema,
    pickup_window: DeliveryHubStoreCartSelectionPickupWindowSchema.nullable().optional(),
    correlation_id: z.string().trim().min(1).nullable().optional(),
  })
  .strict()

export const DeliveryHubStoreDeleteCartSelectionBodySchema = z
  .object({
    cart_id: z.string().trim().min(1),
  })
  .strict()
