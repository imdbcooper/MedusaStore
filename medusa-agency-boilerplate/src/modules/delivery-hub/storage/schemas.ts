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

export const DeliveryHubTestQuoteSchema = z.object({
  connection_id: z.string().min(1),
  mode_code: z.enum(["warehouse_to_pickup_point", "dropoff_point_to_pickup_point"]),
  currency_code: z.string().min(3).max(3).optional(),
  destination_point_id: z.string().min(1),
  origin_point_id: z.string().optional(),
  warehouse_id: z.string().optional(),
  interval_utc: z
    .object({
      from: z.string().min(1),
      to: z.string().min(1),
    })
    .optional(),
  items: z
    .array(
      z.object({
        quantity: z.number().int().positive().optional(),
        weight_grams: z.number().positive().optional(),
        price: z.number().nonnegative().optional(),
      })
    )
    .optional(),
})
