import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  getDeliveryHubService,
  handleDeliveryHubError,
  sanitizeAdminDeliveryExecutionPlanObservabilityPreview,
} from "../../shared"

type DeliveryHubShippingOptionQuery = {
  graph: <T = Record<string, unknown>>(input: {
    entity: string
    fields: string[]
    filters?: Record<string, unknown>
  }) => Promise<{ data?: T[] }>
}

type AdminDeliveryShippingOptionSnapshot = {
  id: string
  name?: string | null
  provider_id?: string | null
  data?: Record<string, unknown> | null
}

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    const service = getDeliveryHubService(req)
    const query = req.scope.resolve(
      ContainerRegistrationKeys.QUERY
    ) as DeliveryHubShippingOptionQuery
    const { data } = await query.graph<AdminDeliveryShippingOptionSnapshot>({
      entity: "shipping_option",
      fields: ["id", "name", "provider_id", "data"],
    })
    const preview = sanitizeAdminDeliveryExecutionPlanObservabilityPreview(
      await service.buildExecutionPlanObservabilityPreview(data ?? [])
    )

    res.status(200).json({
      ok: true,
      preview,
    })
  } catch (error) {
    handleDeliveryHubError(res, error)
  }
}
