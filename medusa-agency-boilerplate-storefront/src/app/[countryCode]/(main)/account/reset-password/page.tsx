import { Metadata } from "next"

import ResetPasswordForm from "@modules/account/components/reset-password"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
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
      <div className="w-full flex justify-start px-8 py-8">
        <div
          className="max-w-sm w-full flex flex-col items-start gap-4"
          data-testid="reset-password-missing-token"
        >
          <h1 className="text-large-semi uppercase">Ссылка не найдена</h1>
          <p className="text-base-regular text-ui-fg-base">
            В ссылке отсутствует токен. Запросите новую ссылку для
            восстановления пароля.
          </p>
          <LocalizedClientLink
            href="/account/forgot-password"
            className="underline text-ui-fg-subtle text-small-regular"
          >
            Запросить новую ссылку
          </LocalizedClientLink>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full flex justify-start px-8 py-8">
      <ResetPasswordForm countryCode={countryCode} token={token} />
    </div>
  )
}
