import { Metadata } from "next"
import Link from "next/link"

import UnsubscribeForm from "@modules/marketing/components/unsubscribe-form"
import type { MarketingChannelId } from "@lib/data/customer"
import { getMetadataTitle } from "@lib/storefront-config"

export const metadata: Metadata = {
  title: getMetadataTitle("Отписаться от рассылки"),
  description:
    "Управление подпиской на маркетинговые уведомления по ссылке.",
}

const ALLOWED_CHANNELS: ReadonlySet<MarketingChannelId> = new Set<MarketingChannelId>([
  "email",
  "sms",
  "vk",
])

type UnsubscribePageProps = {
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

function parseChannelsParam(value: string | null): MarketingChannelId[] {
  if (!value) {
    return ["email"]
  }

  const candidates = value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)

  const result: MarketingChannelId[] = []

  for (const candidate of candidates) {
    if (ALLOWED_CHANNELS.has(candidate as MarketingChannelId)) {
      const typed = candidate as MarketingChannelId
      if (!result.includes(typed)) {
        result.push(typed)
      }
    }
  }

  return result.length ? result : ["email"]
}

export default async function UnsubscribePage(props: UnsubscribePageProps) {
  const { countryCode } = await props.params
  const searchParams = props.searchParams ? await props.searchParams : {}
  const token = readSearchParam(searchParams.token)
  const channels = parseChannelsParam(readSearchParam(searchParams.channels))

  if (!token) {
    return (
      <div
        className="content-container mx-auto my-12 max-w-2xl"
        data-testid="unsubscribe-missing-token"
      >
        <div className="rounded-rounded border border-red-200 bg-red-50 px-6 py-8 text-red-900">
          <h1 className="text-2xl-semi mb-3">Ссылка не найдена</h1>
          <p className="text-base-regular mb-6">
            В ссылке отсутствует токен. Управлять подпиской можно в личном
            кабинете.
          </p>
          <Link
            href={`/${countryCode}/account/profile`}
            className="inline-flex items-center justify-center rounded-rounded border border-gray-900 bg-gray-900 px-4 py-2 text-small-semi text-white hover:bg-gray-800"
          >
            Перейти в профиль
          </Link>
        </div>
      </div>
    )
  }

  return (
    <UnsubscribeForm
      token={token}
      countryCode={countryCode}
      initialChannels={channels}
    />
  )
}
