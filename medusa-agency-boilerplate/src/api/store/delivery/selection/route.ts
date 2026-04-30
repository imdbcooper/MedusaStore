import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import * as deliveryHub from "../../../../modules/delivery-hub"
import {
  getStoreDeliveryHubService,
  getStoreQuery,
  handleStoreDeliveryHubError,
  sanitizeStoreDeliverySelectionResponse,
} from "../shared"

export const StoreDeliveryCartSelectionQuerySchema =
  deliveryHub.DeliveryHubStoreCartSelectionQuerySchema
export const StoreDeliveryUpsertCartSelectionBodySchema =
  deliveryHub.DeliveryHubStoreUpsertCartSelectionBodySchema
export const StoreDeliveryDeleteCartSelectionBodySchema =
  deliveryHub.DeliveryHubStoreDeleteCartSelectionBodySchema

type StoreDeliveryCartSelectionQuery = z.infer<typeof StoreDeliveryCartSelectionQuerySchema>
type StoreDeliveryUpsertCartSelectionBody = z.infer<
  typeof StoreDeliveryUpsertCartSelectionBodySchema
>
type StoreDeliveryDeleteCartSelectionBody = z.infer<
  typeof StoreDeliveryDeleteCartSelectionBodySchema
>

export const storeDeliverySelectionDeps = {
  getDeliveryHubCartById: deliveryHub.getDeliveryHubCartById,
  requireDeliveryHubCart: deliveryHub.requireDeliveryHubCart,
  readDeliveryHubCartSelection: deliveryHub.readDeliveryHubCartSelection,
  upsertDeliveryHubCartSelection: deliveryHub.upsertDeliveryHubCartSelection,
  clearDeliveryHubCartSelection: deliveryHub.clearDeliveryHubCartSelection,
}

export async function GET(
  req: MedusaRequest<unknown, StoreDeliveryCartSelectionQuery>,
  res: MedusaResponse
) {
  try {
    const query = getStoreQuery(req)
    const validatedQuery = req.validatedQuery
    const cart = await storeDeliverySelectionDeps.getDeliveryHubCartById(
      query,
      validatedQuery.cart_id
    )
    storeDeliverySelectionDeps.requireDeliveryHubCart(cart, validatedQuery.cart_id)

    res.status(200).json(
      sanitizeStoreDeliverySelectionResponse({
        ok: true,
        cart_id: validatedQuery.cart_id,
        selection: storeDeliverySelectionDeps.readDeliveryHubCartSelection(cart?.metadata),
      })
    )
  } catch (error) {
    handleStoreDeliveryHubError(res, error)
  }
}

export async function POST(
  req: MedusaRequest<StoreDeliveryUpsertCartSelectionBody>,
  res: MedusaResponse
) {
  try {
    const validatedBody = req.validatedBody
    const query = getStoreQuery(req)
    const cart = await storeDeliverySelectionDeps.getDeliveryHubCartById(
      query,
      validatedBody.cart_id
    )
    const existingCart = storeDeliverySelectionDeps.requireDeliveryHubCart(
      cart,
      validatedBody.cart_id
    )
    const service = getStoreDeliveryHubService(req)
    const selection = await storeDeliverySelectionDeps.upsertDeliveryHubCartSelection(
      req.scope,
      existingCart,
      {
        provider_code: validatedBody.provider_code ?? null,
        connection_id: validatedBody.connection_id,
        quote_type: validatedBody.quote_type,
        quote_reference: validatedBody.quote_reference,
        quote: validatedBody.quote,
        pickup_point: {
          provider_point_id: validatedBody.pickup_point.provider_point_id,
          provider_point_code: validatedBody.pickup_point.provider_point_code ?? null,
          name: validatedBody.pickup_point.name,
          address: validatedBody.pickup_point.address,
          city: validatedBody.pickup_point.city ?? null,
          region: validatedBody.pickup_point.region ?? null,
          postal_code: validatedBody.pickup_point.postal_code ?? null,
          lat: validatedBody.pickup_point.lat ?? null,
          lng: validatedBody.pickup_point.lng ?? null,
          is_origin_dropoff_allowed: validatedBody.pickup_point.is_origin_dropoff_allowed,
          is_destination_pickup_allowed:
            validatedBody.pickup_point.is_destination_pickup_allowed,
          payment_methods: validatedBody.pickup_point.payment_methods ?? [],
        },
        pickup_window: validatedBody.pickup_window
          ? {
              date: validatedBody.pickup_window.date,
              time_from: validatedBody.pickup_window.time_from ?? null,
              time_to: validatedBody.pickup_window.time_to ?? null,
              interval_utc: validatedBody.pickup_window.interval_utc,
              label: validatedBody.pickup_window.label,
            }
          : null,
        correlation_id: validatedBody.correlation_id ?? null,
        validation_context: service.buildStoreSelectionValidationContext({
          cart: existingCart,
        }),
      }
    )

    res.status(200).json(
      sanitizeStoreDeliverySelectionResponse({
        ok: true,
        cart_id: existingCart.id,
        selection,
        diagnostics: {
          correlation_id: validatedBody.correlation_id ?? null,
          checkout_source_of_truth: "unchanged",
          contour: "delivery_hub_storefront_preview",
        },
      })
    )
  } catch (error) {
    handleStoreDeliveryHubError(res, error)
  }
}

export async function DELETE(
  req: MedusaRequest<StoreDeliveryDeleteCartSelectionBody>,
  res: MedusaResponse
) {
  try {
    const validatedBody = req.validatedBody
    const query = getStoreQuery(req)
    const cart = await storeDeliverySelectionDeps.getDeliveryHubCartById(
      query,
      validatedBody.cart_id
    )
    const existingCart = storeDeliverySelectionDeps.requireDeliveryHubCart(
      cart,
      validatedBody.cart_id
    )

    await storeDeliverySelectionDeps.clearDeliveryHubCartSelection(req.scope, existingCart)

    res.status(200).json(
      sanitizeStoreDeliverySelectionResponse({
        ok: true,
        cart_id: existingCart.id,
        selection: null,
        diagnostics: {
          correlation_id: null,
          checkout_source_of_truth: "unchanged",
          contour: "delivery_hub_storefront_preview",
        },
      })
    )
  } catch (error) {
    handleStoreDeliveryHubError(res, error)
  }
}
