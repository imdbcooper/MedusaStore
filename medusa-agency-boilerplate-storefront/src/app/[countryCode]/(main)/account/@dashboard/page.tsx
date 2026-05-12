import { Metadata } from "next"

import Overview from "@modules/account/components/overview"
import { notFound } from "next/navigation"
import { retrieveCustomer } from "@lib/data/customer"
import { listOrders } from "@lib/data/orders"
import { getMetadataTitle, storefrontConfig } from "@lib/storefront-config"

export const metadata: Metadata = {
  title: getMetadataTitle(storefrontConfig.copy.account.title),
  description: storefrontConfig.copy.account.dashboardDescription,
}

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function readSearchParam(
  value: string | string[] | undefined
): string | null {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : null
  }

  return typeof value === "string" ? value : null
}

export default async function OverviewTemplate(props: DashboardPageProps) {
  const customer = await retrieveCustomer().catch(() => null)
  const orders = (await listOrders().catch(() => null)) || null
  const searchParams = props.searchParams ? await props.searchParams : {}
  const passwordResetStatus = readSearchParam(searchParams.password_reset)

  if (!customer) {
    notFound()
  }

  return (
    <div className="flex w-full flex-col gap-y-4">
      {passwordResetStatus === "success" ? (
        <div
          className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          role="status"
          data-testid="password-reset-success-banner"
        >
          Пароль успешно обновлён.
        </div>
      ) : null}
      <Overview customer={customer} orders={orders} />
    </div>
  )
}
