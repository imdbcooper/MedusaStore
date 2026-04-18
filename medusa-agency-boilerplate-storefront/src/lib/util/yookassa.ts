import { HttpTypes } from "@medusajs/types"

export const YOOKASSA_PROVIDER_KEY = "pp_yookassa_yookassa"

export type YooKassaPaymentSessionData = {
  id?: string
  status?: string
  paid?: boolean
  confirmation?: {
    type?: string
    confirmation_url?: string
  }
  return_url?: string
}

export function getYooKassaConfirmationUrl(cart: HttpTypes.StoreCart) {
  const session = cart.payment_collection?.payment_sessions?.find(
    (candidate) => candidate.provider_id === YOOKASSA_PROVIDER_KEY
  )

  const data = session?.data as YooKassaPaymentSessionData | undefined

  return data?.confirmation?.confirmation_url || null
}

export function getYooKassaPaymentId(cart: HttpTypes.StoreCart) {
  const session = cart.payment_collection?.payment_sessions?.find(
    (candidate) => candidate.provider_id === YOOKASSA_PROVIDER_KEY
  )

  const data = session?.data as YooKassaPaymentSessionData | undefined

  return data?.id || null
}
