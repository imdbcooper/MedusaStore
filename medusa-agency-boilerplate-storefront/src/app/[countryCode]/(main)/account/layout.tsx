import { retrieveCustomer } from "@lib/data/customer"
import { Toaster } from "@medusajs/ui"
import AccountLayout from "@modules/account/templates/account-layout"

export default async function AccountPageLayout({
  dashboard,
  login,
  children,
  params,
}: {
  dashboard?: React.ReactNode
  login?: React.ReactNode
  children?: React.ReactNode
  params?: { countryCode?: string } | Promise<{ countryCode?: string }>
}) {
  const customer = await retrieveCustomer().catch(() => null)
  const resolvedParams =
    params && typeof (params as Promise<unknown>).then === "function"
      ? await (params as Promise<{ countryCode?: string }>)
      : (params as { countryCode?: string } | undefined)
  const countryCode = resolvedParams?.countryCode || null

  return (
    <AccountLayout customer={customer} countryCode={countryCode}>
      {children ?? (customer ? dashboard : login)}
      <Toaster />
    </AccountLayout>
  )
}
