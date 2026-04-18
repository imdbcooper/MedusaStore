import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { getMetadataTitle, storefrontConfig } from "@lib/storefront-config"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: getMetadataTitle(storefrontConfig.copy.checkout.title),
}

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function Checkout(props: Props) {
  const cart = await retrieveCart()

  if (!cart) {
    return notFound()
  }

  const customer = await retrieveCustomer()
  const searchParams = (await props.searchParams) || {}
  const yookassaStatus =
    typeof searchParams.yookassa === "string" ? searchParams.yookassa : null

  return (
    <div className="grid grid-cols-1 small:grid-cols-[1fr_416px] content-container gap-x-40 py-12">
      <PaymentWrapper cart={cart}>
        <CheckoutForm
          cart={cart}
          customer={customer}
          yookassaStatus={yookassaStatus}
        />
      </PaymentWrapper>
      <CheckoutSummary cart={cart} />
    </div>
  )
}
