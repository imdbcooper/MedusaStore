import { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { retrieveCustomer } from "@lib/data/customer"
import { retrieveMarketingPreferences } from "@lib/data/marketing"
import { listRegions } from "@lib/data/regions"
import { getMetadataTitle, storefrontConfig } from "@lib/storefront-config"
import { isOnboardingPending } from "@lib/util/onboarding"
import OnboardingBanner from "@modules/account/components/onboarding-banner"
import ProfileBillingAddress from "@modules/account/components/profile-billing-address"
import ProfileEmail from "@modules/account/components/profile-email"
import ProfileMarketingPreferences from "@modules/account/components/profile-marketing-preferences"
import ProfileName from "@modules/account/components/profile-name"
import ProfilePhone from "@modules/account//components/profile-phone"
import ProfileVkLink from "@modules/account/components/profile-vk-link"
import ProfileVkSetPassword from "@modules/account/components/profile-vk-set-password"

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

function buildUnauthenticatedAccountRedirect(
  countryCode: string,
  initialResult: string | null,
  initialReason: string | null
) {
  const searchParams = new URLSearchParams()

  if (initialReason) {
    searchParams.set("vk_login_error", initialReason)
  } else if (initialResult === "failed") {
    searchParams.set("vk_login_error", "customer_auth_required")
  }

  const queryString = searchParams.toString()
  return `/${countryCode}/account${queryString ? `?${queryString}` : ""}`
}

type SectionProps = {
  title: string
  description?: string
  children: React.ReactNode
}

const Section = ({ title, description, children }: SectionProps) => (
  <section className="rounded-xl border border-gray-200 bg-white p-5 small:p-6">
    <header className="mb-4 flex flex-col gap-y-1">
      <h2 className="text-large-semi text-ui-fg-base">{title}</h2>
      {description ? (
        <p className="text-small-regular text-ui-fg-subtle">{description}</p>
      ) : null}
    </header>
    <div>{children}</div>
  </section>
)

export default async function Profile(props: ProfilePageProps) {
  const { countryCode } = await props.params
  const searchParams = props.searchParams ? await props.searchParams : {}
  const initialResult = readSearchParam(searchParams.vk_id_result)
  const initialReason = readSearchParam(searchParams.vk_id_reason)
  const customer = await retrieveCustomer()

  if (!customer) {
    redirect(
      buildUnauthenticatedAccountRedirect(countryCode, initialResult, initialReason)
    )
  }

  const regions = await listRegions()
  const marketingPreferences = await retrieveMarketingPreferences()

  if (!regions) {
    notFound()
  }

  return (
    <div className="w-full" data-testid="profile-page-wrapper">
      {isOnboardingPending(customer) ? (
        <div className="mb-6">
          <OnboardingBanner countryCode={countryCode} />
        </div>
      ) : null}
      <div className="mb-8 flex flex-col gap-y-2">
        <h1 className="text-2xl-semi">
          {storefrontConfig.copy.account.profile}
        </h1>
        <p className="text-base-regular text-ui-fg-subtle">
          {storefrontConfig.copy.account.profileDescription}
        </p>
      </div>
      <div className="flex w-full flex-col gap-y-6">
        <Section
          title="Личные данные"
          description="Имя и фамилия, как они будут указаны в заказах."
        >
          <ProfileName customer={customer} />
        </Section>

        <Section
          title="Контакты"
          description="Email и телефон для уведомлений и связи по заказам."
        >
          <div className="flex flex-col gap-y-6">
            <ProfileEmail customer={customer} />
            <div className="h-px w-full bg-gray-200" />
            <ProfilePhone customer={customer} />
          </div>
        </Section>

        <Section
          title="Привязка VK ID"
          description="Быстрый вход и подтверждение профиля через VK ID."
        >
          <div className="flex flex-col gap-y-4">
            <ProfileVkLink
              customer={customer}
              countryCode={countryCode}
              initialResult={initialResult}
              initialReason={initialReason}
            />
            <ProfileVkSetPassword
              customer={customer}
              countryCode={countryCode}
            />
          </div>
        </Section>

        <Section
          title="Рассылки и уведомления"
          description="Управляйте каналами маркетинговых сообщений."
        >
          <ProfileMarketingPreferences
            preferences={marketingPreferences?.marketing || null}
            bindings={marketingPreferences?.bindings || null}
          />
        </Section>

        <Section
          title="Платёжный адрес по умолчанию"
          description="Будет подставляться при оформлении заказа."
        >
          <ProfileBillingAddress customer={customer} regions={regions} />
        </Section>
      </div>
    </div>
  )
}
