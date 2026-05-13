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
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function readEmailFromQuery(
  value: string | string[] | undefined
): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== "string") {
    return undefined
  }

  const trimmed = raw.trim()
  if (!trimmed) {
    return undefined
  }

  // Lightweight shape check; the form's server action does proper validation.
  // We only want to avoid pre-filling obvious garbage that confuses the user.
  if (trimmed.length > 254 || !trimmed.includes("@")) {
    return undefined
  }

  return trimmed
}

export default async function ForgotPasswordPage(
  props: ForgotPasswordPageProps
) {
  const { countryCode } = await props.params
  const searchParams = props.searchParams ? await props.searchParams : {}
  const initialEmail = readEmailFromQuery(searchParams.email)

  return (
    <AuthCardShell icon={<KeyIcon />} testId="forgot-password-page">
      <ForgotPasswordForm
        countryCode={countryCode}
        initialEmail={initialEmail}
      />
    </AuthCardShell>
  )
}
