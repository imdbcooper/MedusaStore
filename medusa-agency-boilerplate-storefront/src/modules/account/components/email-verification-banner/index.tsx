"use client"

import { useEffect, useRef, useState, useTransition } from "react"

import { requestEmailVerification } from "@lib/data/customer"

type EmailVerificationBannerProps = {
  countryCode: string
  email?: string | null
}

type BannerStatus =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }

const ERROR_MESSAGES: Record<string, string> = {
  customer_auth_required: "Войдите в аккаунт, чтобы отправить письмо.",
  customer_not_found: "Не удалось найти аккаунт. Попробуйте позже.",
  missing_customer_email:
    "В профиле не указан адрес электронной почты. Добавьте его, чтобы отправить письмо.",
  missing_storefront_url:
    "Конфигурация storefront не готова для отправки письма. Обратитесь в поддержку.",
  email_verification_request_failed:
    "Не удалось отправить письмо. Повторите попытку позже.",
  email_verification_skipped:
    "Письмо не было отправлено. Проверьте данные профиля.",
}

const RESEND_COOLDOWN_SECONDS = 30

function resolveErrorMessage(code?: string | null): string {
  if (!code) {
    return ERROR_MESSAGES.email_verification_request_failed
  }

  return ERROR_MESSAGES[code] || ERROR_MESSAGES.email_verification_request_failed
}

export default function EmailVerificationBanner({
  countryCode,
  email,
}: EmailVerificationBannerProps) {
  const [status, setStatus] = useState<BannerStatus>({ kind: "idle" })
  const [isPending, startTransition] = useTransition()
  const [cooldownSecondsLeft, setCooldownSecondsLeft] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [])

  const startCooldown = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    setCooldownSecondsLeft(RESEND_COOLDOWN_SECONDS)

    intervalRef.current = setInterval(() => {
      setCooldownSecondsLeft((previous) => {
        if (previous <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          return 0
        }

        return previous - 1
      })
    }, 1000)
  }

  const handleResend = () => {
    if (cooldownSecondsLeft > 0 || isPending) {
      return
    }

    startTransition(async () => {
      setStatus({ kind: "idle" })

      const result = await requestEmailVerification({
        countryCode,
        reason: "storefront_banner_resend",
      })

      if (!result.ok) {
        setStatus({ kind: "error", message: resolveErrorMessage(result.code) })
        return
      }

      setStatus({
        kind: "success",
        message: email
          ? `Письмо отправлено на ${email}. Проверьте входящие и папку со спамом.`
          : "Письмо отправлено. Проверьте входящие и папку со спамом.",
      })

      startCooldown()
    })
  }

  const isDisabled = isPending || cooldownSecondsLeft > 0
  const buttonLabel = isPending
    ? "Отправляем..."
    : cooldownSecondsLeft > 0
      ? `Повторно через ${cooldownSecondsLeft} с`
      : "Отправить повторно"

  return (
    <div
      className="mb-6 flex flex-col gap-3 rounded-rounded border border-amber-200 bg-amber-50 px-4 py-3 text-small-regular text-amber-900 small:flex-row small:items-center small:justify-between"
      role="status"
      data-testid="email-verification-banner"
    >
      <div className="flex flex-col gap-1">
        <strong className="font-semibold">Подтвердите email</strong>
        <span>
          Мы отправили письмо со ссылкой на подтверждение адреса
          {email ? ` ${email}` : ""}. Пока email не подтвержден, часть
          возможностей может быть ограничена.
        </span>
        {status.kind === "success" ? (
          <span className="text-emerald-700">{status.message}</span>
        ) : null}
        {status.kind === "error" ? (
          <span className="text-red-700">{status.message}</span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={handleResend}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        className="inline-flex items-center justify-center rounded-rounded border border-amber-300 bg-white px-4 py-2 text-small-semi text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        data-testid="email-verification-resend"
      >
        {buttonLabel}
      </button>
    </div>
  )
}
