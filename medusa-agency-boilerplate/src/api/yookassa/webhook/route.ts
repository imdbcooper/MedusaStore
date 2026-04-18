import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { handleYooKassaWebhook } from "./shared"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  return handleYooKassaWebhook(req, res)
}
