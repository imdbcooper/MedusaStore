import { Metadata } from "next"

import ResetPasswordForm from "@modules/account/components/reset-password"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import AuthCardShell, {
  AlertCircleIcon,
  KeyIcon,
} from "@modules/account/components/auth-card-shell"
import { getMetadataTitle } from "@lib/storefront-config"

export const metadata: Metadata = {
  title: getMetadataTitle("Новый пароль"),
  description:
    "Установка нового пароля по ссылке для учётной записи покупателя.",
}

type ResetPasswordPageProps = {
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

export default async function ResetPasswordPage(
  props: ResetPasswordPageProps
) {
  const { countryCode } = await props.params
  const searchParams = props.searchParams ? await props.searchParams : {}
  const token = readSearchParam(searchParams.token)?.trim()

  if (!token) {
    return (
      <AuthCardShell
        tone="error"
        icon={<AlertCircleIcon />}
        testId="reset-password-missing-token"
      >
        <div className="w-full flex flex-col items-center gap-3 text-center">
          <h1 className="text-xl-semi">Ссылка не найдена</h1>
          <p className="text-small-regular text-ui-fg-subtle">
            В ссылке отсутствует токен. Запросите новую ссылку для
            восстановления пароля.
          </p>
          <LocalizedClientLink
            href="/account/forgot-password"
            className="text-small-semi underline decoration-dotted underline-offset-4 text-ui-fg-base hover:text-emerald-700"
          >
            Запросить новую ссылку
          </LocalizedClientLink>
        </div>
      </AuthCardShell>
    )
  }

  return (
    <AuthCardShell icon={<KeyIcon />} testId="reset-password-page">
      <ResetPasswordForm countryCode={countryCode} token={token} />
    </AuthCardShell>
  )
}
