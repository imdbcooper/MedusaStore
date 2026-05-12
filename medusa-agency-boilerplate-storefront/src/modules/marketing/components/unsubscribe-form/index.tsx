"use client"

import React, { useState, useTransition } from "react"
import Link from "next/link"

import { unsubscribeFromMarketing } from "@lib/data/customer"
import type { MarketingChannelId } from "@lib/data/customer"

type UnsubscribeFormProps = {
  token: string
  countryCode: string
  initialChannels: MarketingChannelId[]
}

const CHANNEL_LABELS: Record<MarketingChannelId, string> = {
  email: "Email-рассылка",
  sms: "SMS-рассылка",
  vk: "VK-рассылка",
}

export default function UnsubscribeForm({
  token,
  countryCode,
  initialChannels,
}: UnsubscribeFormProps) {
  const [selected, setSelected] = useState<Set<MarketingChannelId>>(
    () => new Set(initialChannels)
  )
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  const toggleChannel = (channel: MarketingChannelId) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(channel)) {
        next.delete(channel)
      } else {
        next.add(channel)
      }
      return next
    })
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const channels = Array.from(selected)
    if (!channels.length) {
      return
    }

    startTransition(async () => {
      await unsubscribeFromMarketing({
        token,
        channels,
      })
      setDone(true)
    })
  }

  if (done) {
    return (
      <div
        className="content-container mx-auto my-12 max-w-2xl"
        data-testid="unsubscribe-confirmation"
      >
        <div className="rounded-rounded border border-emerald-200 bg-emerald-50 px-6 py-8 text-emerald-900">
          <h1 className="text-2xl-semi mb-3">Вы отписались</h1>
          <p className="text-base-regular mb-6">
            Мы обновили ваши настройки рассылки. Включить подписку снова можно
            в личном кабинете.
          </p>
          <div className="flex flex-col gap-3 small:flex-row">
            <Link
              href={`/${countryCode}/account/profile`}
              className="inline-flex items-center justify-center rounded-rounded border border-gray-900 bg-gray-900 px-4 py-2 text-small-semi text-white hover:bg-gray-800"
            >
              Перейти в личный кабинет
            </Link>
            <Link
              href={`/${countryCode}`}
              className="inline-flex items-center justify-center rounded-rounded border border-gray-300 bg-white px-4 py-2 text-small-semi text-gray-900 hover:bg-gray-100"
            >
              На главную
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="content-container mx-auto my-12 max-w-2xl"
      data-testid="unsubscribe-form"
    >
      <div className="rounded-rounded border border-gray-200 bg-white px-6 py-8">
        <h1 className="text-2xl-semi mb-3 text-gray-900">Отписаться от рассылки</h1>
        <p className="text-base-regular text-gray-700 mb-6">
          Выберите каналы, от которых вы хотите отписаться. Действие необратимо
          без повторного включения в профиле.
        </p>

        <fieldset className="flex flex-col gap-3">
          {(Object.keys(CHANNEL_LABELS) as MarketingChannelId[]).map(
            (channel) => (
              <label
                key={channel}
                className="flex items-center gap-3 rounded-rounded border border-gray-200 px-4 py-3 cursor-pointer hover:bg-gray-50"
                data-testid={`unsubscribe-channel-${channel}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(channel)}
                  onChange={() => toggleChannel(channel)}
                  className="h-4 w-4"
                />
                <span className="text-small-plus text-gray-900">
                  {CHANNEL_LABELS[channel]}
                </span>
              </label>
            )
          )}
        </fieldset>

        <button
          type="submit"
          disabled={isPending || selected.size === 0}
          className="mt-6 inline-flex items-center justify-center rounded-rounded border border-gray-900 bg-gray-900 px-4 py-2 text-small-semi text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="unsubscribe-submit"
        >
          {isPending ? "Обрабатываем..." : "Отписаться"}
        </button>
      </div>
    </form>
  )
}
