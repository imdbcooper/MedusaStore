import { Metadata } from "next"

import ForgotPasswordForm from "@modules/account/components/forgot-password"
import AuthCardShell, {
  KeyIcon,
} from "@modules/account/components/auth-card-shell"
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
    <AuthCardShell icon={<KeyIcon />} testId="forgot-password-page">
      <ForgotPasswordForm countryCode={countryCode} />
    </AuthCardShell>
  )
}
