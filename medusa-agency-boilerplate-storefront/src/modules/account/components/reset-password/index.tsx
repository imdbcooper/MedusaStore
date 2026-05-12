"use client"

import React, { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Input from "@modules/common/components/input"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { applyPasswordReset } from "@lib/data/customer"

type ResetPasswordFormProps = {
  countryCode: string
  token: string
}

const GENERIC_TOKEN_MESSAGE =
  "Ссылка недействительна или её срок действия истёк. Запросите новую ссылку для восстановления пароля."

const WEAK_PASSWORD_MESSAGES: Record<string, string> = {
  password_too_short: "Пароль должен содержать не менее 8 символов.",
  password_too_long: "Пароль не должен превышать 128 символов.",
  password_missing_letter: "Пароль должен содержать хотя бы одну букву.",
  password_missing_digit: "Пароль должен содержать хотя бы одну цифру.",
}

function resolveErrorMessage(code?: string, detail?: string): string {
  if (code === "weak_password") {
    if (detail && WEAK_PASSWORD_MESSAGES[detail]) {
      return WEAK_PASSWORD_MESSAGES[detail]
    }

    return "Пароль слишком простой. Используйте минимум 8 символов, включая буквы и цифры."
  }

  return GENERIC_TOKEN_MESSAGE
}

const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({
  countryCode,
  token,
}) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [mismatch, setMismatch] = useState(false)

  const onSubmit = (formData: FormData) => {
    const newPassword = String(formData.get("new_password") || "")
    const confirmPassword = String(formData.get("confirm_password") || "")

    setErrorCode(null)
    setErrorDetail(null)
    setMismatch(false)

    if (newPassword !== confirmPassword) {
      setMismatch(true)
      return
    }

    startTransition(async () => {
      const result = await applyPasswordReset({
        token,
        newPassword,
      })

      if (result.ok) {
        router.push(`/${countryCode}/account?password_reset=success`)
        router.refresh()
        return
      }

      setErrorCode(result.code || "invalid_or_expired_token")
      setErrorDetail(result.detail || null)
    })
  }

  const invalidToken = errorCode === "invalid_or_expired_token"

  return (
    <div
      className="w-full flex flex-col"
      data-testid="reset-password-form"
    >
      <div className="mb-6 flex flex-col gap-y-1 text-center">
        <h1 className="text-xl-semi">Новый пароль</h1>
        <p className="text-small-regular text-ui-fg-subtle">
          Укажите новый пароль для вашей учётной записи.
        </p>
      </div>
      <form className="w-full" action={onSubmit}>
        <div className="flex flex-col w-full gap-y-2">
          <Input
            label="Новый пароль"
            name="new_password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            data-testid="new-password-input"
          />
          <Input
            label="Подтвердите пароль"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            data-testid="confirm-password-input"
          />
        </div>
        {mismatch ? (
          <p
            className="text-small-regular text-rose-600 mt-3"
            data-testid="reset-password-mismatch"
            role="alert"
          >
            Пароли не совпадают.
          </p>
        ) : null}
        {errorCode ? (
          <p
            className="text-small-regular text-rose-600 mt-3"
            data-testid="reset-password-error"
            role="alert"
          >
            {resolveErrorMessage(errorCode, errorDetail || undefined)}
          </p>
        ) : null}
        <SubmitButton
          className="w-full mt-6"
          data-testid="reset-password-submit"
        >
          {isPending ? "Сохраняем..." : "Сохранить пароль"}
        </SubmitButton>
      </form>
      <div className="w-full flex flex-col small:flex-row justify-between gap-2 mt-6 text-small-regular">
        <LocalizedClientLink
          href="/account/forgot-password"
          className="text-ui-fg-subtle hover:text-ui-fg-base hover:underline underline-offset-4"
          data-testid="request-new-reset-link"
        >
          {invalidToken ? "Запросить новую ссылку" : "Отправить новую ссылку"}
        </LocalizedClientLink>
        <LocalizedClientLink
          href="/account"
          className="text-ui-fg-subtle hover:text-ui-fg-base hover:underline underline-offset-4"
          data-testid="back-to-login-link"
        >
          Вернуться ко входу
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default ResetPasswordForm
