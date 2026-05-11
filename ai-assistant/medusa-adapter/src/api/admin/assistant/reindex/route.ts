import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { errorResponse } from "../../../../lib/route-utils"
import assistantReindexAllProductsWorkflow from "../../../../workflows/assistant-reindex-all-products"
import assistantReindexProductWorkflow from "../../../../workflows/assistant-reindex-product"

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

    if (body.scope === "all" || body.force) {
      const { result } = await assistantReindexAllProductsWorkflow(req.scope).run({
        input: {
          storeId: body.store_id,
          locale: body.locale,
          regionId: body.region_id,
          currencyCode: body.currency_code,
          reason: "admin.reindex",
        },
      })

      res.status(202).json({ ok: true, result: result.result })
      return
    }

    const { result } = await assistantReindexProductWorkflow(req.scope).run({
      input: {
        productIds: body.product_ids,
        storeId: body.store_id,
        locale: body.locale,
        regionId: body.region_id,
        currencyCode: body.currency_code,
        reason: "admin.reindex",
      },
    })

    res.status(202).json({ ok: true, result: result.result })
  } catch (error) {
    errorResponse(res, error)
  }
}
