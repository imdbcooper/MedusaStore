import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"

export type DeliveryHubAdminOrderGraphRecord = Record<string, unknown>

export async function getAdminDeliveryHubOrder(
  req: AuthenticatedMedusaRequest,
  orderId: string
): Promise<DeliveryHubAdminOrderGraphRecord> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as {
    graph: <T>(input: {
      entity: string
      fields: string[]
      filters: Record<string, unknown>
    }) => Promise<{ data: T[] }>
  }
  const { data } = await query.graph<DeliveryHubAdminOrderGraphRecord>({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "currency_code",
      "metadata",
      "shipping_address.*",
      "items.id",
      "items.title",
      "items.subtitle",
      "items.quantity",
      "items.requires_shipping",
      "items.variant.id",
      "items.variant.title",
      "items.variant.sku",
      "items.variant.weight",
      "items.variant.length",
      "items.variant.width",
      "items.variant.height",
      "shipping_methods.id",
      "shipping_methods.name",
      "shipping_methods.data",
      "shipping_methods.shipping_option.id",
      "shipping_methods.shipping_option.name",
      "shipping_methods.shipping_option.provider_id",
      "shipping_methods.shipping_option.data",
      "fulfillments.id",
      "fulfillments.status",
      "fulfillments.provider_id",
      "fulfillments.location_id",
      "fulfillments.data",
      "fulfillments.items.id",
      "fulfillments.items.quantity",
      "fulfillments.items.line_item_id",
    ],
    filters: {
      id: orderId,
    },
  })

  return data?.[0] ?? { id: orderId }
}
