import { z } from "@medusajs/framework/zod"

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

export const DeliveryHubCreateWarehouseSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean().optional(),
  country_code: z.string().min(2).max(2).optional(),
  city: z.string().optional(),
  address_line_1: z.string().optional(),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  provider_code: z.string().optional(),
  provider_warehouse_id: z.string().optional(),
  metadata: z.record(z.any()).optional(),
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

export const DeliveryHubTestQuoteSchema = z.object({
  connection_id: z.string().min(1),
  mode_code: z.enum(["warehouse_to_pickup_point", "dropoff_point_to_pickup_point"]),
  currency_code: z.string().min(3).max(3).optional(),
  destination_point_id: z.string().min(1),
  origin_point_id: z.string().optional(),
  warehouse_id: z.string().optional(),
  interval_utc: DeliveryHubIntervalUtcSchema,
  items: DeliveryHubQuoteItemsSchema,
})

export const DeliveryHubStoreQuotesQuerySchema = z.object({
  connection_id: z.string().trim().min(1).optional(),
  mode_code: z.enum(["warehouse_to_pickup_point", "dropoff_point_to_pickup_point"]),
  currency_code: z.string().trim().min(3).max(3).optional(),
  destination_point_id: z.string().trim().min(1),
  origin_point_id: z.string().trim().min(1).optional(),
  warehouse_id: z.string().trim().min(1).optional(),
  interval_utc: z.string().trim().optional(),
  items: z.string().trim().optional(),
})

export const DeliveryHubStorePickupPointsQuerySchema = z.object({
  connection_id: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  country_code: z.string().trim().min(2).max(2).optional(),
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

export const DeliveryHubStoreCatalogQuerySchema = z.object({})

export const DeliveryHubStoreSettingsQuerySchema = z.object({})

export const DeliveryHubStoreCartSelectionQuoteSchema = z.object({
  carrier_code: z.string().trim().min(1),
  carrier_label: z.string().trim().min(1),
  amount: z.number().finite(),
  currency_code: z.string().trim().min(1),
  delivery_eta_min: z.number().int().nonnegative().nullable(),
  delivery_eta_max: z.number().int().nonnegative().nullable(),
  pickup_point_required: z.boolean(),
  pickup_window_required: z.boolean(),
})

export const DeliveryHubStoreCartSelectionPickupPointSchema = z
  .object({
    provider_point_id: z.string().trim().min(1),
    provider_point_code: z.string().trim().min(1).nullable().optional(),
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
    interval_utc: z.object({
      from: z.string().trim().min(1),
      to: z.string().trim().min(1),
    }),
    label: z.string().trim().min(1),
  })
  .strict()

export const DeliveryHubStoreQuoteReferenceSchema = z
  .object({
    id: z.string().trim().min(1),
    version: z.number().int().positive(),
  })
  .strict()

export const DeliveryHubStoreUpsertCartSelectionBodySchema = z.object({
  cart_id: z.string().trim().min(1),
  connection_id: z.string().trim().min(1),
  quote_type: z.enum(["warehouse_to_pickup_point", "dropoff_point_to_pickup_point"]),
  quote_reference: DeliveryHubStoreQuoteReferenceSchema,
  quote: DeliveryHubStoreCartSelectionQuoteSchema,
  pickup_point: DeliveryHubStoreCartSelectionPickupPointSchema,
  pickup_window: DeliveryHubStoreCartSelectionPickupWindowSchema.nullable().optional(),
})

export const DeliveryHubStoreDeleteCartSelectionBodySchema = z.object({
  cart_id: z.string().trim().min(1),
})
