import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { getMetadataTitle, storefrontConfig } from "@lib/storefront-config"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
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
    <main className="content-container py-14 small:py-24">
      <div className="mx-auto mb-12 max-w-5xl">
        <LocalizedClientLink
          className="mb-6 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-[var(--theme-accent)] transition hover:text-[var(--theme-accent-strong)]"
          href="/store"
        >
          ← Вернуться в каталог
        </LocalizedClientLink>
        <h1 className="text-5xl font-bold tracking-[-0.035em] text-[var(--theme-foreground)] small:text-6xl">
          Оформление заказа
        </h1>
        <p className="pt-5 text-lg leading-8 text-[var(--theme-muted)]">
          Заполните данные для начала сотрудничества. Адрес, доставка, оплата и подтверждение остаются рабочим Medusa checkout flow.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-8 small:grid-cols-[1fr_416px] small:gap-x-12">
        <div className="rounded-[var(--theme-radius-shell)] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 shadow-[var(--theme-shadow-card)] small:p-8">
          <PaymentWrapper cart={cart}>
            <CheckoutForm
              cart={cart}
              customer={customer}
              yookassaStatus={yookassaStatus}
            />
          </PaymentWrapper>
        </div>
        <CheckoutSummary cart={cart} />
      </div>
    </main>
  )
}
