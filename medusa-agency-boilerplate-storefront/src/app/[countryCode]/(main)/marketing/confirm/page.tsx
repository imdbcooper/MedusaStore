import { Metadata } from "next"
import Link from "next/link"

import { confirmMarketingSubscription } from "@lib/data/customer"
import { getMetadataTitle, storefrontConfig } from "@lib/storefront-config"

export const metadata: Metadata = {
  title: getMetadataTitle("Подтверждение подписки на рассылку"),
  description:
    "Страница подтверждения подписки на маркетинговую рассылку.",
}

type MarketingConfirmPageProps = {
  params: Promise<{ countryCode: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const GENERIC_INVALID_TOKEN_MESSAGE =
  "Ссылка недействительна или её срок действия истёк. Включите подписку повторно в личном кабинете."

function readSearchParam(
  value: string | string[] | undefined
): string | null {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : null
  }

  return typeof value === "string" ? value : null
}

export default async function MarketingConfirmPage(
  props: MarketingConfirmPageProps
) {
  const { countryCode } = await props.params
  const searchParams = props.searchParams ? await props.searchParams : {}
  const token = readSearchParam(searchParams.token)

  if (!token) {
    return (
      <MarketingConfirmShell
        tone="error"
        heading="Ссылка подтверждения не найдена"
        message="В ссылке отсутствует токен. Запросите новое письмо подтверждения через профиль."
        countryCode={countryCode}
      />
    )
  }

  const result = await confirmMarketingSubscription(token).catch(
    () =>
      ({ ok: false, code: "invalid_or_expired_token" }) as Awaited<
        ReturnType<typeof confirmMarketingSubscription>
      >
  )

  if (!result.ok) {
    return (
      <MarketingConfirmShell
        tone="error"
        heading="Не удалось подтвердить подписку"
        message={GENERIC_INVALID_TOKEN_MESSAGE}
        countryCode={countryCode}
      />
    )
  }

  return (
    <MarketingConfirmShell
      tone="success"
      heading="Подписка подтверждена"
      message="Спасибо. Подписка на рассылку активирована. Вы сможете отписаться в любой момент — ссылка будет в каждом письме."
      countryCode={countryCode}
    />
  )
}

type MarketingConfirmShellProps = {
  tone: "success" | "error"
  heading: string
  message: string
  countryCode: string
}

function MarketingConfirmShell({
  tone,
  heading,
  message,
  countryCode,
}: MarketingConfirmShellProps) {
  const accountHref = `/${countryCode}/account/profile`
  const toneClassName =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-red-200 bg-red-50 text-red-900"

  return (
    <div
      className="content-container mx-auto my-12 max-w-2xl"
      data-testid="marketing-confirm-page"
    >
      <div className={`rounded-rounded border px-6 py-8 ${toneClassName}`}>
        <h1 className="text-2xl-semi mb-3">{heading}</h1>
        <p className="text-base-regular mb-6">{message}</p>
        <div className="flex flex-col gap-3 small:flex-row">
          <Link
            href={accountHref}
            className="inline-flex items-center justify-center rounded-rounded border border-gray-900 bg-gray-900 px-4 py-2 text-small-semi text-white hover:bg-gray-800"
            data-testid="marketing-confirm-profile-link"
          >
            {storefrontConfig.copy.account.title || "Личный кабинет"}
          </Link>
          <Link
            href={`/${countryCode}`}
            className="inline-flex items-center justify-center rounded-rounded border border-gray-300 bg-white px-4 py-2 text-small-semi text-gray-900 hover:bg-gray-100"
            data-testid="marketing-confirm-home-link"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  )
}
