import { Metadata } from "next"
import { notFound } from "next/navigation"

import { retrieveCustomer } from "@lib/data/customer"
import { retrieveMarketingPreferences } from "@lib/data/marketing"
import { listRegions } from "@lib/data/regions"
import { getMetadataTitle, storefrontConfig } from "@lib/storefront-config"
import ProfileBillingAddress from "@modules/account/components/profile-billing-address"
import ProfileEmail from "@modules/account/components/profile-email"
import ProfileMarketingPreferences from "@modules/account/components/profile-marketing-preferences"
import ProfileName from "@modules/account/components/profile-name"
import ProfilePhone from "@modules/account//components/profile-phone"
import ProfileVkLink from "@modules/account/components/profile-vk-link"

export const metadata: Metadata = {
  title: getMetadataTitle(storefrontConfig.copy.account.profile),
  description: storefrontConfig.copy.account.profileDescription,
}

type ProfilePageProps = {
  params: Promise<{ countryCode: string }>
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

export default async function Profile(props: ProfilePageProps) {
  const customer = await retrieveCustomer()
  const regions = await listRegions()
  const marketingPreferences = await retrieveMarketingPreferences()
  const { countryCode } = await props.params
  const searchParams = props.searchParams ? await props.searchParams : {}
  const initialResult = readSearchParam(searchParams.vk_id_result)
  const initialReason = readSearchParam(searchParams.vk_id_reason)

  if (!customer || !regions) {
    notFound()
  }

  return (
    <div className="w-full" data-testid="profile-page-wrapper">
      <div className="mb-8 flex flex-col gap-y-4">
        <h1 className="text-2xl-semi">{storefrontConfig.copy.account.profile}</h1>
        <p className="text-base-regular">
          {storefrontConfig.copy.account.profileDescription}
        </p>
      </div>
      <div className="flex w-full flex-col gap-y-8">
        <ProfileName customer={customer} />
        <Divider />
        <ProfileEmail customer={customer} />
        <Divider />
        <ProfilePhone customer={customer} />
        <Divider />
        <ProfileVkLink
          customer={customer}
          countryCode={countryCode}
          initialResult={initialResult}
          initialReason={initialReason}
        />
        <Divider />
        <ProfileMarketingPreferences
          preferences={marketingPreferences?.marketing || null}
          bindings={marketingPreferences?.bindings || null}
        />
        <Divider />
        <ProfileBillingAddress customer={customer} regions={regions} />
      </div>
    </div>
  )
}

const Divider = () => {
  return <div className="h-px w-full bg-gray-200" />
}
