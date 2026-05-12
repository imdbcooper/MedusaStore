import { Metadata } from "next"

import ForgotPasswordForm from "@modules/account/components/forgot-password"
import { getMetadataTitle } from "@lib/storefront-config"

export const metadata: Metadata = {
  title: getMetadataTitle("Восстановление пароля"),
  description:
    "Запрос на восстановление пароля для учётной записи покупателя.",
}

type ForgotPasswordPageProps = {
  params: Promise<{ countryCode: string }>
}

export default async function ForgotPasswordPage(
  props: ForgotPasswordPageProps
) {
  const { countryCode } = await props.params

  return (
    <div className="w-full flex justify-start px-8 py-8">
      <ForgotPasswordForm countryCode={countryCode} />
    </div>
  )
}
