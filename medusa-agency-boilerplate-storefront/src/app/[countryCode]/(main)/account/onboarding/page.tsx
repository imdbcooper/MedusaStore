import { Metadata } from "next"
import { redirect } from "next/navigation"

import { retrieveCustomer } from "@lib/data/customer"
import { getMetadataTitle } from "@lib/storefront-config"
import { getOnboardingMetadata, isOnboardingPending } from "@lib/util/onboarding"
import OnboardingForm from "@modules/account/components/onboarding-form"

export const metadata: Metadata = {
  title: getMetadataTitle("Завершение регистрации"),
  description: "Заполните данные профиля для полноценного использования аккаунта.",
}

type OnboardingPageProps = {
  params: Promise<{ countryCode: string }>
}

export default async function OnboardingPage(props: OnboardingPageProps) {
  const { countryCode } = await props.params
  const customer = await retrieveCustomer()

  if (!customer) {
    redirect(`/${countryCode}/account`)
  }

  if (!isOnboardingPending(customer)) {
    // Onboarding already completed — redirect to account
    redirect(`/${countryCode}/account`)
  }

  const onboarding = getOnboardingMetadata(customer)!

  return (
    <div className="w-full" data-testid="onboarding-page">
      <div className="mb-8 flex flex-col gap-y-2">
        <h1 className="text-2xl-semi">Завершите настройку профиля</h1>
        <p className="text-base-regular text-ui-fg-subtle">
          Укажите контактные данные для уведомлений о заказах и восстановления
          доступа к аккаунту.
        </p>
      </div>
      <OnboardingForm onboarding={onboarding} countryCode={countryCode} />
    </div>
  )
}
