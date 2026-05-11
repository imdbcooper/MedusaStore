import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { errorResponse } from "../../../../lib/route-utils"
import { requireAssistantBackendClient } from "../../../../modules/assistant-runtime"

export const AdminAssistantReindexSchema = z.object({
  scope: z.enum(["all", "products"]).default("products"),
  product_ids: z.array(z.string().trim().min(1)).default([]),
  store_id: z.string().trim().min(1).default("default"),
  locale: z.string().trim().min(1).default("ru"),
  region_id: z.string().trim().min(1).optional(),
  currency_code: z.string().trim().min(3).max(3).optional(),
  force: z.boolean().default(false),
})

type AdminAssistantReindexBody = z.infer<typeof AdminAssistantReindexSchema>

export async function POST(
  req: AuthenticatedMedusaRequest<AdminAssistantReindexBody>,
  res: MedusaResponse
) {
  const body = req.validatedBody || AdminAssistantReindexSchema.parse(req.body || {})

  try {
    const client = requireAssistantBackendClient()
    if (body.scope === "products" && !body.force && body.product_ids.length === 0) {
      res.status(400).json({
        ok: false,
        error: {
          code: "AI_ASSISTANT_PRODUCT_IDS_REQUIRED",
          message: "product_ids must contain at least one product id when scope is products",
        },
      })
      return
    }

    const allProducts = body.scope === "all" || body.force
    const result = await client.enqueueReindexIntent({
      store_id: body.store_id,
      locale: body.locale,
      event_name: "admin.reindex",
      action: "reindex",
      scope: allProducts ? "all_products" : "products",
      product_ids: allProducts ? [] : body.product_ids,
      reason: "admin.reindex",
      coalescing_key: allProducts ? "assistant:catalog:all-products" : `assistant:admin:products:${body.product_ids.slice().sort().join(",")}`,
      metadata: {
        region_id: body.region_id,
        currency_code: body.currency_code,
        force: body.force,
      },
    })

    res.status(202).json({ ok: true, queued: true, result })
  } catch (error) {
    errorResponse(res, error)
  }
}
