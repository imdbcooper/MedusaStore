import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  AdminDeliveryShippingOptionManualSyncSchema,
  createDeliveryHubShippingOptionManualSyncAuditLogger,
  createDeliveryHubShippingOptionManualSyncMedusaMutationService,
  getDeliveryHubPgConnection,
  runDeliveryHubShippingOptionManualSync,
  type AdminDeliveryShippingOptionManualSyncBody,
} from "../../../../../modules/delivery-hub"
import {
  getDeliveryHubService,
  handleDeliveryHubError,
  sanitizeAdminDeliveryShippingOptionManualSyncResponse,
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

export { AdminDeliveryShippingOptionManualSyncSchema }

export const deliveryHubShippingOptionManualSyncRouteDeps = {
  runDeliveryHubShippingOptionManualSync,
  createDeliveryHubShippingOptionManualSyncMedusaMutationService,
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminDeliveryShippingOptionManualSyncBody>,
  res: MedusaResponse
) {
  try {
    const service = getDeliveryHubService(req)
    const query = req.scope.resolve(
      ContainerRegistrationKeys.QUERY
    ) as DeliveryHubShippingOptionQuery
    const { data } = await query.graph<AdminDeliveryShippingOptionSnapshot>({
      entity: "shipping_option",
      fields: ["id", "name", "provider_id", "data"],
    })

    const request = AdminDeliveryShippingOptionManualSyncSchema.parse(
      req.validatedBody ?? req.body ?? {}
    ) as AdminDeliveryShippingOptionManualSyncBody
    const result = sanitizeAdminDeliveryShippingOptionManualSyncResponse(
      await deliveryHubShippingOptionManualSyncRouteDeps.runDeliveryHubShippingOptionManualSync({
        service,
        current_options: data ?? [],
        request,
        mutation_service:
          request.mode === "execute"
            ? deliveryHubShippingOptionManualSyncRouteDeps.createDeliveryHubShippingOptionManualSyncMedusaMutationService(
                req.scope
              )
            : undefined,
        audit_log: createDeliveryHubShippingOptionManualSyncAuditLogger(
          getDeliveryHubPgConnection(req.scope)
        ),
      })
    )

    res.status(200).json({
      ok: true,
      sync: result,
    })
  } catch (error) {
    handleDeliveryHubError(res, error)
  }
}
