"use client"

import React, { useState, useTransition } from "react"
import Input from "@modules/common/components/input"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { requestPasswordReset } from "@lib/data/customer"

type ForgotPasswordFormProps = {
  countryCode: string
  /**
   * Phase 5.4: pre-fill the email field when the user lands here from a
   * profile-level "set initial password" CTA. The CTA is surfaced for
   * VK-registered customers who received a random password at sign-up; the
   * storefront links them straight to `/account/forgot-password?email=<theirs>`
   * so the existing reset flow doubles as a "set initial password" flow.
   */
  initialEmail?: string
}

const SUCCESS_MESSAGE =
  "Если указанный адрес зарегистрирован, мы отправили письмо с инструкциями. Проверьте папку входящих и спам."

const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  countryCode,
  initialEmail,
}) => {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<"idle" | "sent">("idle")

  const onSubmit = (formData: FormData) => {
    const email = String(formData.get("email") || "").trim()

    if (!email) {
      return
    }

    startTransition(async () => {
      await requestPasswordReset({
        email,
        countryCode,
      })
      setStatus("sent")
    })
  }

  if (status === "sent") {
    return (
      <div
        className="w-full flex flex-col items-center gap-4 text-center"
        data-testid="forgot-password-sent"
      >
        <h1 className="text-xl-semi">Проверьте почту</h1>
        <p className="text-small-regular text-ui-fg-subtle">
          {SUCCESS_MESSAGE}
        </p>
        <LocalizedClientLink
          href="/account"
          className="text-small-semi underline decoration-dotted underline-offset-4 text-ui-fg-base hover:text-emerald-700"
          data-testid="back-to-login-link"
        >
          Вернуться ко входу
        </LocalizedClientLink>
      </div>
    )
  }

  return (
    <div
      className="w-full flex flex-col"
      data-testid="forgot-password-form"
    >
      <div className="mb-6 flex flex-col gap-y-1 text-center">
        <h1 className="text-xl-semi">Восстановление пароля</h1>
        <p className="text-small-regular text-ui-fg-subtle">
          Укажите email, указанный при регистрации. Мы отправим ссылку для
          установки нового пароля.
        </p>
      </div>
      <form className="w-full" action={onSubmit}>
        <div className="flex flex-col w-full gap-y-2">
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={initialEmail}
            data-testid="forgot-password-email-input"
          />
        </div>
        <SubmitButton
          className="w-full mt-6"
          data-testid="forgot-password-submit"
        >
          {isPending ? "Отправляем..." : "Отправить ссылку"}
        </SubmitButton>
      </form>
      <div className="w-full flex justify-center mt-6 text-small-regular">
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

export default ForgotPasswordForm
