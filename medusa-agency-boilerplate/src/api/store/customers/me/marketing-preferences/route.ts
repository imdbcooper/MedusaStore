import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  MARKETING_CHANNELS,
  MARKETING_CHANNEL_STATUS_VALUES,
  MARKETING_GLOBAL_STATUS_VALUES,
  STOREFRONT_MARKETING_SOURCE,
  buildCustomerMarketingMetadata,
  getMarketingCustomerById,
  persistCustomerMarketingMetadata,
  resolveMarketingPreferences,
} from "../../../../../modules/marketing-preferences"

export const StoreCustomerMarketingPreferencesSchema = z.object({
  global_status: z.enum(MARKETING_GLOBAL_STATUS_VALUES).optional(),
  channels: z
    .object({
      email: z
        .object({
          status: z.enum(MARKETING_CHANNEL_STATUS_VALUES).optional(),
        })
        .optional(),
      sms: z
        .object({
          status: z.enum(MARKETING_CHANNEL_STATUS_VALUES).optional(),
        })
        .optional(),
      vk: z
        .object({
          status: z.enum(MARKETING_CHANNEL_STATUS_VALUES).optional(),
        })
        .optional(),
    })
    .optional(),
})

type StoreCustomerMarketingPreferencesRequestBody = z.infer<
  typeof StoreCustomerMarketingPreferencesSchema
>

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const customerId = req.auth_context.actor_id?.trim()

  if (!customerId) {
    res.status(401).json({
      ok: false,
      code: "customer_auth_required",
    })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const customer = await getMarketingCustomerById(query, customerId)

  if (!customer) {
    res.status(404).json({
      ok: false,
      code: "customer_not_found",
    })
    return
  }

  const resolution = resolveMarketingPreferences(customer.metadata, customer)

  res.status(200).json({
    ok: true,
    customer_id: customer.id,
    marketing: resolution.preferences,
    bindings: resolution.bindings,
  })
}

export async function POST(
  req: AuthenticatedMedusaRequest<StoreCustomerMarketingPreferencesRequestBody>,
  res: MedusaResponse
) {
  const customerId = req.auth_context.actor_id?.trim()

  if (!customerId) {
    res.status(401).json({
      ok: false,
      code: "customer_auth_required",
    })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const customer = await getMarketingCustomerById(query, customerId)

  if (!customer) {
    res.status(404).json({
      ok: false,
      code: "customer_not_found",
    })
    return
  }

  const nextMetadata = buildCustomerMarketingMetadata(customer, {
    global_status: req.validatedBody.global_status || null,
    channels: req.validatedBody.channels || {},
    source: STOREFRONT_MARKETING_SOURCE,
  })

  await persistCustomerMarketingMetadata(req.scope, customer.id, nextMetadata)

  const updatedCustomer = await getMarketingCustomerById(query, customer.id)
  const resolution = resolveMarketingPreferences(
    updatedCustomer?.metadata || nextMetadata,
    updatedCustomer || {
      ...customer,
      metadata: nextMetadata,
    }
  )

  res.status(200).json({
    ok: true,
    customer_id: customer.id,
    marketing: resolution.preferences,
    bindings: resolution.bindings,
    updated_channels: MARKETING_CHANNELS.filter((channel) => {
      return Boolean(req.validatedBody.channels?.[channel])
    }),
  })
}
