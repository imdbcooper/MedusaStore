import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  StoreYooKassaReturnSchema,
  buildStorefrontCheckoutReturnUrl,
} from "../../store/payment/yookassa/return/route"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const validatedQuery = StoreYooKassaReturnSchema.parse(req.query ?? {})
  const countryCode = validatedQuery.country_code
  const paymentId = validatedQuery.payment_id?.trim() || null
  const redirectUrl = buildStorefrontCheckoutReturnUrl({
    cartId: validatedQuery.cart_id,
    countryCode,
    paymentId,
    storefrontOrigin: validatedQuery.storefront_origin,
  })

  if (!paymentId) {
    console.warn("[YooKassa return] Missing payment_id in public return query", {
      cart_id: validatedQuery.cart_id,
      country_code: countryCode ?? "ru",
    })
  }

  res.redirect(302, redirectUrl.toString())
}
