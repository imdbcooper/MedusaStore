"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { submitOnboarding } from "@lib/data/customer"
import { OnboardingMetadata } from "@lib/util/onboarding"

type OnboardingFormProps = {
  onboarding: OnboardingMetadata
  countryCode: string
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidPhone(phone: string): boolean {
  // Accept formats like +79001234567, 89001234567, +7 (900) 123-45-67
  const digits = phone.replace(/[\s\-()]/g, "")
  return /^\+?\d{10,15}$/.test(digits)
}

export default function OnboardingForm({
  onboarding,
  countryCode,
}: OnboardingFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const needsEmail = onboarding.missing_fields.includes("email")
  const needsPhone = onboarding.missing_fields.includes("phone")

  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setEmailError(null)
    setPhoneError(null)
    setGeneralError(null)

    // Client-side validation
    if (needsEmail && !email.trim()) {
      setEmailError("Укажите email.")
      return
    }
    if (needsEmail && !isValidEmail(email.trim())) {
      setEmailError("Введите корректный email.")
      return
    }
    if (needsPhone && !phone.trim()) {
      setPhoneError("Укажите телефон.")
      return
    }
    if (needsPhone && !isValidPhone(phone.trim())) {
      setPhoneError("Введите корректный номер телефона.")
      return
    }

    startTransition(async () => {
      const input: { email?: string; phone?: string } = {}
      if (needsEmail && email.trim()) input.email = email.trim()
      if (needsPhone && phone.trim()) input.phone = phone.trim()

      const result = await submitOnboarding(input)

      if (!result.ok) {
        if (result.code === "email_already_exists") {
          setEmailError(result.error || "Этот email уже используется другим аккаунтом.")
        } else if (result.code === "auth_required") {
          setGeneralError(result.error || "Необходимо войти в аккаунт.")
        } else {
          setGeneralError(result.error || "Произошла ошибка. Попробуйте позже.")
        }
        return
      }

      // Success — redirect to account profile
      router.push(`/${countryCode}/account`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-y-6">
      {needsEmail && (
        <div className="flex flex-col gap-y-2">
          <label
            htmlFor="onboarding-email"
            className="text-base-semi text-ui-fg-base"
          >
            Email
          </label>
          <p className="text-small-regular text-ui-fg-subtle">
            Email нужен для уведомлений о заказах и восстановления доступа.
          </p>
          <input
            id="onboarding-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (emailError) setEmailError(null)
            }}
            placeholder="email@example.com"
            aria-invalid={!!emailError}
            aria-describedby={emailError ? "onboarding-email-error" : undefined}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-ui-fg-base placeholder:text-ui-fg-muted focus:border-ui-fg-interactive focus:outline-none focus:ring-1 focus:ring-ui-fg-interactive disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
          />
          {emailError && (
            <p
              id="onboarding-email-error"
              className="text-small-regular text-red-600"
              role="alert"
            >
              {emailError}
            </p>
          )}
        </div>
      )}

      {needsPhone && (
        <div className="flex flex-col gap-y-2">
          <label
            htmlFor="onboarding-phone"
            className="text-base-semi text-ui-fg-base"
          >
            Телефон
          </label>
          <p className="text-small-regular text-ui-fg-subtle">
            Телефон нужен для связи по заказам.
          </p>
          <input
            id="onboarding-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              if (phoneError) setPhoneError(null)
            }}
            placeholder="+7 (900) 123-45-67"
            aria-invalid={!!phoneError}
            aria-describedby={phoneError ? "onboarding-phone-error" : undefined}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-ui-fg-base placeholder:text-ui-fg-muted focus:border-ui-fg-interactive focus:outline-none focus:ring-1 focus:ring-ui-fg-interactive disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
          />
          {phoneError && (
            <p
              id="onboarding-phone-error"
              className="text-small-regular text-red-600"
              role="alert"
            >
              {phoneError}
            </p>
          )}
        </div>
      )}

      {generalError && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {generalError}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        aria-disabled={isPending}
        className="inline-flex w-full items-center justify-center rounded-lg bg-ui-fg-base px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-ui-fg-base/90 disabled:cursor-not-allowed disabled:opacity-60 small:w-auto"
      >
        {isPending ? "Сохраняем..." : "Сохранить и продолжить"}
      </button>
    </form>
  )
}
