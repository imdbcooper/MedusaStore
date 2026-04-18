import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import {
  getMarketingCampaignById,
  getMarketingPgConnection,
  listMarketingDeliveryJournalByCampaignId,
} from "../../../../../modules/marketing-layer"
import sendMarketingCampaignWorkflow from "../../../../../workflows/send-marketing-campaign"

export const AdminLaunchMarketingCampaignSchema = z.object({
  launch: z.boolean().optional(),
})

type AdminLaunchMarketingCampaignRequestBody = z.infer<
  typeof AdminLaunchMarketingCampaignSchema
>

function getCampaignId(req: AuthenticatedMedusaRequest<any>) {
  const path = req.url?.split("?")[0] || ""
  const segments = path.split("/").filter(Boolean)

  return segments[segments.length - 1] || null
}

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const campaignId = getCampaignId(req)

  if (!campaignId) {
    res.status(400).json({
      ok: false,
      code: "campaign_id_required",
    })
    return
  }

  const pgConnection = getMarketingPgConnection(req.scope)
  const campaign = await getMarketingCampaignById(pgConnection, campaignId)

  if (!campaign) {
    res.status(404).json({
      ok: false,
      code: "campaign_not_found",
    })
    return
  }

  const journal = await listMarketingDeliveryJournalByCampaignId(pgConnection, campaign.id)

  res.status(200).json({
    ok: true,
    campaign,
    journal,
  })
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminLaunchMarketingCampaignRequestBody>,
  res: MedusaResponse
) {
  const campaignId = getCampaignId(req)

  if (!campaignId) {
    res.status(400).json({
      ok: false,
      code: "campaign_id_required",
    })
    return
  }

  const { result } = await sendMarketingCampaignWorkflow(req.scope).run({
    input: {
      campaignId,
      launchedBy: req.auth_context.actor_id || null,
    },
  })

  res.status(200).json({
    ok: true,
    result,
  })
}
