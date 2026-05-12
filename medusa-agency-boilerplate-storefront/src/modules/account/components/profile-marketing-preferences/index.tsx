"use client"

import React, { useEffect, useState, useTransition } from "react"
import { Badge, Button } from "@medusajs/ui"
import type {
  StoreMarketingBindings,
  StoreMarketingPreferences,
  MarketingChannel,
  MarketingChannelStatus,
} from "@lib/data/marketing"
import { updateMarketingPreferences } from "@lib/data/marketing"

type ProfileMarketingPreferencesProps = {
  preferences: StoreMarketingPreferences | null
  bindings: StoreMarketingBindings | null
}

type ChannelViewModel = {
  channel: MarketingChannel
  label: string
  recipientLabel: string
}

const CHANNELS: ChannelViewModel[] = [
  {
    channel: "email",
    label: "Email campaigns",
    recipientLabel: "Email recipient",
  },
  {
    channel: "sms",
    label: "SMS campaigns",
    recipientLabel: "SMS recipient",
  },
  {
    channel: "vk",
    label: "VK campaigns",
    recipientLabel: "VK recipient",
  },
]

function formatDateTime(value: string | null) {
  if (!value) {
    return "—"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function getChannelBadgeColor(status: MarketingChannelStatus) {
  if (status === "subscribed") {
    return "green"
  }

  if (status === "unsubscribed") {
    return "red"
  }

  if (status === "pending") {
    return "orange"
  }

  return "grey"
}

function getRecipientText(
  channel: MarketingChannel,
  bindings: StoreMarketingBindings | null
) {
  if (!bindings) {
    return "—"
  }

  const binding = bindings[channel]

  if (!binding?.recipient) {
    return "Not available"
  }

  return binding.recipient
}

export default function ProfileMarketingPreferences({
  preferences,
  bindings,
}: ProfileMarketingPreferencesProps) {
  const [state, setState] = useState(preferences)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setState(preferences)
  }, [preferences])

  const handleGlobalToggle = () => {
    if (!state) {
      return
    }

    const nextStatus =
      state.global_status === "subscribed" ? "unsubscribed" : "subscribed"

    startTransition(async () => {
      try {
        const response = await updateMarketingPreferences({
          global_status: nextStatus,
        })

        setState(response.marketing)
        setMessage(
          nextStatus === "subscribed"
            ? "Глобальная marketing подписка включена."
            : "Глобальная marketing подписка отключена."
        )
        setError(null)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Не удалось обновить настройки")
      }
    })
  }

  const handleChannelToggle = (channel: MarketingChannel) => {
    if (!state) {
      return
    }

    const current = state.channels[channel]
    const nextStatus =
      current.status === "subscribed" ? "unsubscribed" : "subscribed"

    startTransition(async () => {
      try {
        const response = await updateMarketingPreferences({
          channels: {
            [channel]: {
              status: nextStatus,
            },
          },
        })

        setState(response.marketing)

        const confirmationTarget = channel === "email" && nextStatus === "subscribed"

        if (confirmationTarget) {
          setMessage(
            "Мы отправили письмо для подтверждения подписки. Перейдите по ссылке из письма, чтобы активировать рассылку."
          )
        } else {
          setMessage(
            nextStatus === "subscribed"
              ? `Канал ${channel} включён для marketing кампаний.`
              : `Канал ${channel} отключён для marketing кампаний.`
          )
        }

        setError(null)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Не удалось обновить настройки")
      }
    })
  }

  const handleResendConfirmation = (channel: MarketingChannel) => {
    if (!state) {
      return
    }

    startTransition(async () => {
      try {
        // Retriggering by toggling "subscribed" re-issues a pending state +
        // confirmation email via the storefront API (route handles the
        // double-opt-in branch). Safe to call while already pending.
        const response = await updateMarketingPreferences({
          channels: {
            [channel]: {
              status: "subscribed",
            },
          },
        })

        setState(response.marketing)
        setMessage(
          "Письмо для подтверждения подписки отправлено повторно. Проверьте папку спам, если не видите его во входящих."
        )
        setError(null)
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Не удалось повторно отправить письмо подтверждения"
        )
      }
    })
  }

  if (!state) {
    return (
      <div className="rounded-rounded border border-ui-border-base p-6 text-small-regular text-ui-fg-subtle">
        Marketing preferences недоступны без customer session.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-y-5 rounded-rounded border border-ui-border-base p-6">
      <div className="flex flex-col gap-y-2">
        <div className="flex items-center gap-x-3">
          <h2 className="text-large-semi">Marketing preferences</h2>
          <Badge color={state.global_status === "subscribed" ? "green" : "red"}>
            {state.global_status === "subscribed"
              ? "Subscribed"
              : "Globally unsubscribed"}
          </Badge>
        </div>
        <p className="text-small-regular text-ui-fg-subtle">
          Self-service слой для consent и channel-level opt-out. Source of truth остаётся в customer.metadata.marketing.
        </p>
      </div>

      {message ? (
        <div className="rounded-rounded border border-green-200 bg-green-50 px-4 py-3 text-small-regular text-green-800">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-rounded border border-red-200 bg-red-50 px-4 py-3 text-small-regular text-red-800">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-y-3 rounded-rounded bg-ui-bg-subtle p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-small-plus text-ui-fg-base">Global marketing status</p>
            <p className="text-small-regular text-ui-fg-subtle">
              Unsubscribe выключает manual campaigns для всех каналов сразу.
            </p>
          </div>
          <Button
            variant={state.global_status === "subscribed" ? "secondary" : "primary"}
            size="small"
            isLoading={isPending}
            onClick={handleGlobalToggle}
          >
            {state.global_status === "subscribed"
              ? "Disable all marketing"
              : "Enable marketing"}
          </Button>
        </div>
        <dl className="grid grid-cols-1 gap-2 text-small-regular small:grid-cols-2">
          <div>
            <dt className="text-ui-fg-subtle">Last marketing sent</dt>
            <dd className="font-medium">{formatDateTime(state.last_marketing_sent_at)}</dd>
          </div>
          <div>
            <dt className="text-ui-fg-subtle">Suppressed until</dt>
            <dd className="font-medium">{formatDateTime(state.suppressed_until)}</dd>
          </div>
        </dl>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {CHANNELS.map(({ channel, label, recipientLabel }) => {
          const channelState = state.channels[channel]
          const recipientText = getRecipientText(channel, bindings)
          const canSubscribe = bindings?.[channel]?.available ?? false

          return (
            <div
              key={channel}
              className="rounded-rounded border border-ui-border-base p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-x-3">
                    <h3 className="text-small-plus">{label}</h3>
                    <Badge color={getChannelBadgeColor(channelState.status)}>
                      {channelState.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-small-regular text-ui-fg-subtle">
                    Updated {formatDateTime(channelState.updated_at)} · source {channelState.source || "—"}
                  </p>
                </div>
                <Button
                  variant={channelState.status === "subscribed" ? "secondary" : "primary"}
                  size="small"
                  isLoading={isPending}
                  disabled={!canSubscribe && channelState.status !== "subscribed"}
                  onClick={() => handleChannelToggle(channel)}
                >
                  {channelState.status === "subscribed" ? "Unsubscribe" : "Subscribe"}
                </Button>
              </div>
              <dl className="grid grid-cols-1 gap-2 text-small-regular small:grid-cols-2">
                <div>
                  <dt className="text-ui-fg-subtle">{recipientLabel}</dt>
                  <dd className="font-medium">{recipientText}</dd>
                </div>
                <div>
                  <dt className="text-ui-fg-subtle">Binding available</dt>
                  <dd className="font-medium">{bindings?.[channel]?.available ? "yes" : "no"}</dd>
                </div>
              </dl>

              {channel === "email" && channelState.status === "pending" ? (
                <div className="mt-3 flex flex-col gap-2 rounded-rounded border border-orange-200 bg-orange-50 px-4 py-3">
                  <p className="text-small-regular text-orange-900">
                    Ожидаем подтверждение подписки. Проверьте почту и перейдите
                    по ссылке из письма. Без подтверждения маркетинговые письма
                    не отправляются.
                  </p>
                  <div>
                    <Button
                      variant="secondary"
                      size="small"
                      isLoading={isPending}
                      onClick={() => handleResendConfirmation(channel)}
                    >
                      Отправить подтверждение повторно
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
