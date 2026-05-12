"use client"

import React, { useState, useTransition } from "react"
import { toast } from "@medusajs/ui"

import Input from "@modules/common/components/input"
import AccountInfo from "../account-info"
import { updateCustomerPassword } from "@lib/data/customer"

const WEAK_PASSWORD_MESSAGES: Record<string, string> = {
  password_too_short: "Пароль должен содержать не менее 8 символов.",
  password_too_long: "Пароль не должен превышать 128 символов.",
  password_missing_letter: "Пароль должен содержать хотя бы одну букву.",
  password_missing_digit: "Пароль должен содержать хотя бы одну цифру.",
}

function resolveErrorMessage(code?: string, detail?: string): string {
  if (!code) {
    return "Не удалось сохранить пароль. Попробуйте позже."
  }

  if (code === "invalid_current_password") {
    return "Текущий пароль указан неверно."
  }

  if (code === "same_password") {
    return "Новый пароль должен отличаться от текущего."
  }

  if (code === "weak_password") {
    if (detail && WEAK_PASSWORD_MESSAGES[detail]) {
      return WEAK_PASSWORD_MESSAGES[detail]
    }

    return "Пароль слишком простой. Используйте минимум 8 символов, включая буквы и цифры."
  }

  if (code === "customer_auth_required") {
    return "Сессия истекла. Войдите снова и попробуйте ещё раз."
  }

  return "Не удалось сохранить пароль. Попробуйте позже."
}

const ProfilePassword: React.FC = () => {
  const [isPending, startTransition] = useTransition()
  const [isSuccess, setIsSuccess] = useState(false)
  const [isError, setIsError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined
  )

  const clearState = () => {
    setIsSuccess(false)
    setIsError(false)
    setErrorMessage(undefined)
  }

  const handleSubmit = (formData: FormData) => {
    clearState()

    const currentPassword = String(formData.get("old_password") || "")
    const newPassword = String(formData.get("new_password") || "")
    const confirmPassword = String(formData.get("confirm_password") || "")

    if (!currentPassword || !newPassword) {
      setIsError(true)
      setErrorMessage("Заполните все поля.")
      return
    }

    if (newPassword !== confirmPassword) {
      setIsError(true)
      setErrorMessage("Пароли не совпадают.")
      return
    }

    startTransition(async () => {
      const result = await updateCustomerPassword({
        currentPassword,
        newPassword,
      })

      if (result.ok) {
        setIsSuccess(true)
        toast.success("Пароль обновлён")
        return
      }

      setIsError(true)
      setErrorMessage(resolveErrorMessage(result.code, result.detail))
    })
  }

  return (
    <form
      action={handleSubmit}
      onReset={clearState}
      className="w-full"
      data-testid="profile-password-form"
      data-pending={isPending || undefined}
    >
      <AccountInfo
        label="Пароль"
        currentInfo={
          <span>Пароль скрыт в целях безопасности</span>
        }
        isSuccess={isSuccess}
        isError={isError}
        errorMessage={errorMessage}
        clearState={clearState}
        data-testid="account-password-editor"
      >
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Текущий пароль"
            name="old_password"
            required
            type="password"
            autoComplete="current-password"
            data-testid="old-password-input"
          />
          <Input
            label="Новый пароль"
            type="password"
            name="new_password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            data-testid="new-password-input"
          />
          <Input
            label="Подтвердите пароль"
            type="password"
            name="confirm_password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            data-testid="confirm-password-input"
          />
        </div>
      </AccountInfo>
    </form>
  )
}

export default ProfilePassword
