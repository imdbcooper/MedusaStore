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

export default async function OverviewTemplate() {
  const customer = await retrieveCustomer().catch(() => null)
  const orders = (await listOrders().catch(() => null)) || null

  if (!customer) {
    notFound()
  }

  return <Overview customer={customer} orders={orders} />
}
