"use client"

import { useEffect, useRef, useState, useTransition } from "react"

import { requestEmailVerification } from "@lib/data/customer"

type EmailVerificationBannerProps = {
  countryCode: string
  email?: string | null
  variant?: "banner" | "card"
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

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  )
}

export default function EmailVerificationBanner({
  countryCode,
  email,
  variant = "banner",
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
        reason:
          variant === "card"
            ? "storefront_overview_resend"
            : "storefront_banner_resend",
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

  if (variant === "card") {
    return (
      <section
        className="flex flex-col gap-4 rounded-xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm"
        role="status"
        data-testid="email-verification-banner"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <MailIcon />
          </span>
          <div className="flex flex-col gap-1">
            <strong className="text-base font-semibold text-amber-900">
              Подтвердите email
            </strong>
            <p className="text-small-regular text-amber-900/90">
              Мы отправили письмо со ссылкой на подтверждение адреса
              {email ? ` ${email}` : ""}. Пока email не подтверждён, часть
              возможностей может быть ограничена.
            </p>
            {status.kind === "success" ? (
              <p className="text-small-regular text-emerald-700">
                {status.message}
              </p>
            ) : null}
            {status.kind === "error" ? (
              <p className="text-small-regular text-red-700">
                {status.message}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex">
          <button
            type="button"
            onClick={handleResend}
            disabled={isDisabled}
            aria-disabled={isDisabled}
            className="inline-flex items-center justify-center rounded-md border border-amber-300 bg-white px-4 py-2 text-small-semi text-amber-900 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="email-verification-resend"
          >
            {buttonLabel}
          </button>
        </div>
      </section>
    )
  }

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
          {email ? ` ${email}` : ""}. Пока email не подтверждён, часть
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
