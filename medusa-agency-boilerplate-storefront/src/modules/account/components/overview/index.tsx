import { Container } from "@medusajs/ui"

import ChevronDown from "@modules/common/icons/chevron-down"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import EmailVerificationBanner from "@modules/account/components/email-verification-banner"
import { storefrontConfig } from "@lib/storefront-config"
import { convertToLocale } from "@lib/util/money"
import { isCustomerEmailVerified } from "@lib/util/email-verification"
import { HttpTypes } from "@medusajs/types"

type OverviewProps = {
  customer: HttpTypes.StoreCustomer | null
  orders: HttpTypes.StoreOrder[] | null
  countryCode?: string | null
}

const Overview = ({ customer, orders, countryCode }: OverviewProps) => {
  const accountCopy = storefrontConfig.copy.account
  const profileCompletion = getProfileCompletion(customer)
  const ordersCount = orders?.length ?? 0
  const addressesCount = customer?.addresses?.length || 0
  const lastOrder = orders && orders.length > 0 ? orders[0] : null
  const emailVerified = isCustomerEmailVerified(customer)

  return (
    <div data-testid="overview-page-wrapper" className="flex flex-col gap-y-8">
      {/* Greeting */}
      <div className="flex flex-col gap-y-2">
        <h1
          className="text-2xl-semi text-ui-fg-base"
          data-testid="welcome-message"
          data-value={customer?.first_name}
        >
          {accountCopy.hello}
          {customer?.first_name ? `, ${customer.first_name}` : ""}
          !
        </h1>
        <p className="text-base-regular text-ui-fg-subtle">
          {accountCopy.signedInAs}:{" "}
          <span
            className="font-semibold text-ui-fg-base"
            data-testid="customer-email"
            data-value={customer?.email}
          >
            {customer?.email}
          </span>
        </p>
      </div>

      {/* Email verification card (inline, not a top-banner) */}
      {customer && !emailVerified ? (
        <EmailVerificationBanner
          variant="card"
          countryCode={countryCode || ""}
          email={customer.email}
        />
      ) : null}

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 small:grid-cols-3">
        <StatCard
          label={accountCopy.orders}
          value={ordersCount.toString()}
          hint={
            lastOrder
              ? `Последний ${new Date(lastOrder.created_at).toLocaleDateString("ru-RU")}`
              : "Пока нет заказов"
          }
          testId="stats-orders"
        />
        <StatCard
          label={accountCopy.addresses}
          value={addressesCount.toString()}
          hint={
            addressesCount > 0
              ? `${accountCopy.saved.toLowerCase()}`
              : "Добавьте первый адрес"
          }
          testId="stats-addresses"
          dataValue={addressesCount}
        />
        <StatCard
          label={accountCopy.profile}
          value={`${profileCompletion}%`}
          hint={accountCopy.completed}
          testId="stats-profile"
          dataValue={profileCompletion}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-3 small:grid-cols-3">
        <QuickAction
          href="/account/profile"
          label="Обновить профиль"
          description="Имя, email, телефон"
        />
        <QuickAction
          href="/account/addresses"
          label="Адреса доставки"
          description="Добавить или изменить"
        />
        <QuickAction
          href="/account/orders"
          label="История заказов"
          description="Статусы и детали"
        />
      </div>

      {/* Recent orders */}
      <section className="flex flex-col gap-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-large-semi">{accountCopy.recentOrders}</h2>
          {orders && orders.length > 0 ? (
            <LocalizedClientLink
              href="/account/orders"
              className="text-small-regular text-ui-fg-subtle hover:text-ui-fg-base underline decoration-dotted underline-offset-4"
              data-testid="view-all-orders-link"
            >
              {storefrontConfig.copy.common.viewAll}
            </LocalizedClientLink>
          ) : null}
        </div>

        <ul className="flex flex-col gap-y-3" data-testid="orders-wrapper">
          {orders && orders.length > 0 ? (
            orders.slice(0, 5).map((order) => (
              <li
                key={order.id}
                data-testid="order-wrapper"
                data-value={order.id}
              >
                <LocalizedClientLink
                  href={`/account/orders/details/${order.id}`}
                >
                  <Container className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 transition-all hover:border-gray-300 hover:shadow-sm">
                    <div className="grid grid-cols-3 grid-rows-2 text-small-regular gap-x-4 flex-1 min-w-0">
                      <span className="text-ui-fg-muted">Дата</span>
                      <span className="text-ui-fg-muted">Номер заказа</span>
                      <span className="text-ui-fg-muted">Сумма</span>
                      <span data-testid="order-created-date">
                        {new Date(order.created_at).toLocaleDateString("ru-RU")}
                      </span>
                      <span
                        data-testid="order-id"
                        data-value={order.display_id}
                        className="font-semibold"
                      >
                        #{order.display_id}
                      </span>
                      <span
                        data-testid="order-amount"
                        className="font-semibold"
                      >
                        {convertToLocale({
                          amount: order.total,
                          currency_code: order.currency_code,
                        })}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="flex items-center justify-center flex-shrink-0 rounded-full p-1 text-ui-fg-muted transition-colors hover:bg-gray-100 hover:text-ui-fg-base"
                      data-testid="open-order-button"
                      aria-label={`${accountCopy.openOrder} #${order.display_id}`}
                    >
                      <ChevronDown className="-rotate-90" />
                    </button>
                  </Container>
                </LocalizedClientLink>
              </li>
            ))
          ) : (
            <li
              className="flex flex-col items-center justify-center gap-y-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center"
              data-testid="no-orders-message"
            >
              <p className="text-base-regular text-ui-fg-subtle">
                {accountCopy.noRecentOrders}
              </p>
              <LocalizedClientLink
                href="/"
                className="text-small-semi text-emerald-700 underline decoration-dotted underline-offset-4 hover:text-emerald-800"
              >
                Перейти в каталог
              </LocalizedClientLink>
            </li>
          )}
        </ul>
      </section>
    </div>
  )
}

type StatCardProps = {
  label: string
  value: string
  hint?: string
  testId?: string
  dataValue?: string | number
}

const StatCard = ({ label, value, hint, testId, dataValue }: StatCardProps) => (
  <div
    className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-sm"
    data-testid={testId}
    data-value={dataValue}
  >
    <span className="text-[11px] uppercase tracking-[0.08em] text-ui-fg-muted">
      {label}
    </span>
    <span className="text-3xl-semi leading-none text-ui-fg-base">{value}</span>
    {hint ? (
      <span className="text-small-regular text-ui-fg-subtle">{hint}</span>
    ) : null}
  </div>
)

type QuickActionProps = {
  href: string
  label: string
  description: string
}

const QuickAction = ({ href, label, description }: QuickActionProps) => (
  <LocalizedClientLink
    href={href}
    className="group flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-emerald-300 hover:bg-emerald-50/50"
  >
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-small-semi text-ui-fg-base group-hover:text-emerald-800">
        {label}
      </span>
      <span className="text-small-regular text-ui-fg-subtle">
        {description}
      </span>
    </div>
    <ChevronDown className="-rotate-90 flex-shrink-0 text-ui-fg-muted group-hover:text-emerald-700" />
  </LocalizedClientLink>
)

const getProfileCompletion = (customer: HttpTypes.StoreCustomer | null) => {
  let count = 0

  if (!customer) {
    return 0
  }

  if (customer.email) {
    count++
  }

  if (customer.first_name && customer.last_name) {
    count++
  }

  if (customer.phone) {
    count++
  }

  const billingAddress = customer.addresses?.find(
    (addr) => addr.is_default_billing
  )

  if (billingAddress) {
    count++
  }

  return (count / 4) * 100
}

export default Overview
