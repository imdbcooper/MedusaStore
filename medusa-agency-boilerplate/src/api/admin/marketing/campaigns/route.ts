import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  ADMIN_MARKETING_SOURCE,
  MARKETING_CHANNEL_STATUS_VALUES,
  MARKETING_GLOBAL_STATUS_VALUES,
  buildCustomerMarketingMetadata,
  getMarketingCustomerById,
  persistCustomerMarketingMetadata,
  resolveMarketingPreferences,
} from "../../../../modules/marketing-preferences"
import {
  MARKETING_CAMPAIGN_AUDIENCE_TYPES,
  createMarketingCampaign,
  getMarketingPgConnection,
  listMarketingCampaigns,
} from "../../../../modules/marketing-layer"

export const AdminCreateMarketingCampaignSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  channel: z.enum(["email", "sms", "vk"]),
  audience_type: z.enum(MARKETING_CAMPAIGN_AUDIENCE_TYPES),
  audience_filters: z
    .object({
      customer_ids: z.array(z.string().trim().min(1)).optional(),
    })
    .optional(),
  template: z.string().trim().min(1).max(120),
  subject: z.string().trim().max(240).optional(),
  content: z.object({
    text: z.string().trim().min(1).max(20000).optional(),
    html: z.string().trim().min(1).max(40000).optional(),
    subject: z.string().trim().max(240).optional(),
    message: z.string().trim().min(1).max(20000).optional(),
  }),
  frequency_cap_window_hours: z.number().int().min(1).max(24 * 90).optional(),
  frequency_cap_count: z.number().int().min(1).max(100).optional(),
})

export const AdminUpdateCustomerMarketingPreferencesSchema = z.object({
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

type AdminCreateMarketingCampaignBody = z.infer<
  typeof AdminCreateMarketingCampaignSchema
>

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const pgConnection = getMarketingPgConnection(req.scope)
  const campaigns = await listMarketingCampaigns(pgConnection)

  res.status(200).json({
    ok: true,
    campaigns,
  })
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminCreateMarketingCampaignBody>,
  res: MedusaResponse
) {
  const pgConnection = getMarketingPgConnection(req.scope)
  const campaign = await createMarketingCampaign(pgConnection, {
    name: req.validatedBody.name,
    description: req.validatedBody.description,
    channel: req.validatedBody.channel,
    audience_type: req.validatedBody.audience_type,
    audience_filters: req.validatedBody.audience_filters || {},
    template: req.validatedBody.template,
    subject: req.validatedBody.subject,
    content: req.validatedBody.content,
    created_by: req.auth_context.actor_id || null,
    frequency_cap_window_hours: req.validatedBody.frequency_cap_window_hours,
    frequency_cap_count: req.validatedBody.frequency_cap_count,
  })

  res.status(201).json({
    ok: true,
    campaign,
  })
}

export async function PUT(
  req: AuthenticatedMedusaRequest<z.infer<typeof AdminUpdateCustomerMarketingPreferencesSchema>>,
  res: MedusaResponse
) {
  const customerId = String(req.query.customer_id || "").trim()

  if (!customerId) {
    res.status(400).json({
      ok: false,
      code: "customer_id_required",
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
    source: ADMIN_MARKETING_SOURCE,
  })

  await persistCustomerMarketingMetadata(req.scope, customer.id, nextMetadata)

  res.status(200).json({
    ok: true,
    customer_id: customer.id,
    marketing: resolveMarketingPreferences(nextMetadata, {
      ...customer,
      metadata: nextMetadata,
    }).preferences,
  })
}
