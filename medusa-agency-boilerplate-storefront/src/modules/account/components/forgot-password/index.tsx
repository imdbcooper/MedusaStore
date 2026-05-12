"use client"

import React, { useState, useTransition } from "react"
import Input from "@modules/common/components/input"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { requestPasswordReset } from "@lib/data/customer"

type ForgotPasswordFormProps = {
  countryCode: string
}

const SUCCESS_MESSAGE =
  "Если указанный адрес зарегистрирован, мы отправили письмо с инструкциями. Проверьте папку входящих и спам."

const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  countryCode,
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
        className="max-w-sm w-full flex flex-col items-start gap-4"
        data-testid="forgot-password-sent"
      >
        <h1 className="text-large-semi uppercase">Проверьте почту</h1>
        <p className="text-base-regular text-ui-fg-base">{SUCCESS_MESSAGE}</p>
        <LocalizedClientLink
          href="/account"
          className="text-small-regular underline"
          data-testid="back-to-login-link"
        >
          Вернуться ко входу
        </LocalizedClientLink>
      </div>
    )
  }

  return (
    <div
      className="max-w-sm w-full flex flex-col items-center"
      data-testid="forgot-password-form"
    >
      <h1 className="text-large-semi uppercase mb-4">Восстановление пароля</h1>
      <p className="text-center text-base-regular text-ui-fg-base mb-6">
        Укажите email, указанный при регистрации. Мы отправим ссылку для
        установки нового пароля.
      </p>
      <form className="w-full" action={onSubmit}>
        <div className="flex flex-col w-full gap-y-2">
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
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
      <div className="w-full flex justify-between mt-6 text-small-regular">
        <LocalizedClientLink
          href="/account"
          className="underline text-ui-fg-subtle"
          data-testid="back-to-login-link"
        >
          Вернуться ко входу
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default ForgotPasswordForm
