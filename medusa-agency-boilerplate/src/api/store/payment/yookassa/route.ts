import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import {
  YOOKASSA_PROVIDER_KEY,
  canPlaceOrderFromYooKassaStatus,
  retrieveYooKassaPayment,
  type YooKassaProviderOptions,
} from "../../../../modules/yookassa"

export const StoreYooKassaPaymentStatusSchema = z.object({
  cart_id: z.string().trim().min(1),
  payment_id: z.string().trim().min(1),
})

type StoreYooKassaPaymentStatusRequest = z.infer<
  typeof StoreYooKassaPaymentStatusSchema
>

export async function GET(
  req: MedusaRequest<StoreYooKassaPaymentStatusRequest>,
  res: MedusaResponse
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const validatedQuery = req.validatedQuery as StoreYooKassaPaymentStatusRequest
  const cartId = validatedQuery.cart_id

  const { data: carts } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "region.id",
      "payment_collection.id",
      "payment_collection.payment_sessions.id",
      "payment_collection.payment_sessions.provider_id",
      "payment_collection.payment_sessions.status",
      "payment_collection.payment_sessions.data",
    ],
    filters: {
      id: cartId,
    },
  })

  const cart = carts?.[0] as {
    id: string
    payment_collection?: {
      payment_sessions?: {
        id: string
        provider_id: string
        status: string
        data?: Record<string, unknown>
      }[]
    }
  } | undefined

  if (!cart?.payment_collection?.payment_sessions?.length) {
    return res.status(404).json({
      ok: false,
      code: "cart_payment_session_not_found",
    })
  }

  const session = cart.payment_collection.payment_sessions.find(
    (candidate) => candidate.provider_id === YOOKASSA_PROVIDER_KEY
  )

  if (!session) {
    return res.status(404).json({
      ok: false,
      code: "yookassa_session_not_found",
    })
  }

  const paymentId =
    typeof session.data?.id === "string" ? session.data.id : undefined

  if (!paymentId || paymentId !== validatedQuery.payment_id) {
    return res.status(400).json({
      ok: false,
      code: "payment_id_mismatch",
    })
  }

  const providerOptions = getYooKassaProviderOptions()
  const remotePayment = await retrieveYooKassaPayment(providerOptions, paymentId)

  return res.status(200).json({
    ok: true,
    cart_id: cart.id,
    payment_session_id: session.id,
    payment_id: remotePayment.id,
    provider_id: session.provider_id,
    session_status: session.status,
    payment_status: remotePayment.status,
    confirmation_url: remotePayment.confirmation?.confirmation_url ?? null,
    can_place_order: canPlaceOrderFromYooKassaStatus(remotePayment.status),
  })
}

function getYooKassaProviderOptions(): YooKassaProviderOptions {
  const shopId = process.env.YOOKASSA_SHOP_ID?.trim()
  const secretKey = process.env.YOOKASSA_SECRET_KEY?.trim()
  const returnUrl = process.env.YOOKASSA_RETURN_URL?.trim()

  if (!shopId || !secretKey || !returnUrl) {
    throw new Error(
      "YooKassa is not configured. Set YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY, and YOOKASSA_RETURN_URL."
    )
  }

  return {
    shopId,
    secretKey,
    returnUrl,
    webhookSecret: process.env.YOOKASSA_WEBHOOK_SECRET?.trim() || "",
  }
}
