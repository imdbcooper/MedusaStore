"use client"

import React, { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Input from "@modules/common/components/input"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { resolveVkLinkConflict } from "@lib/data/customer"

type VkLinkConflictFormProps = {
  email: string
  firstName: string | null
  lastName: string | null
  pendingToken: string
}

/**
 * Phase 5.3 conflict resolution form. The VK callback redirected the visitor
 * here because the email returned by VK already belongs to an existing
 * password-based customer. We ask for the password, hit the backend
 * `/store/auth/vk-id/link-conflict-resolve` route, and — on success — send
 * the user to `/ru/account?vk_linked=success` where the banner confirms the
 * link.
 */
function describeError(code: string | null): string | null {
  if (!code) return null

  switch (code) {
    case "pending_token_missing":
    case "pending_token_malformed":
    case "pending_token_invalid_signature":
      return "Сессия привязки ВК недействительна. Попробуйте войти через ВК ещё раз."
    case "pending_token_expired":
      return "Сессия привязки ВК истекла. Попробуйте войти через ВК ещё раз."
    case "email_mismatch":
      return "Email из ВК не совпадает с email в форме. Обновите страницу и повторите попытку."
    case "customer_not_found":
      return "Аккаунт с таким email не найден. Зарегистрируйтесь через ВК заново."
    case "invalid_password":
      return "Неверный пароль. Попробуйте ещё раз или восстановите пароль."
    case "link_conflict":
      return "Этот ВК аккаунт уже привязан к другому пользователю."
    case "vk_id_disabled":
    case "vk_id_register_disabled":
      return "Вход через ВК сейчас отключён. Войдите по паролю."
    case "network_error":
      return "Сбой соединения. Проверьте интернет и повторите попытку."
    case "invalid_input":
      return "Заполните email и пароль."
    default:
      return "Не удалось связать ВК с аккаунтом. Попробуйте позже."
  }
}

export default function VkLinkConflictForm({
  email,
  firstName,
  lastName,
  pendingToken,
}: VkLinkConflictFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorCode, setErrorCode] = useState<string | null>(null)

  const onSubmit = (formData: FormData) => {
    const password = String(formData.get("password") || "")

    setErrorCode(null)

    if (!password) {
      setErrorCode("invalid_input")
      return
    }

    startTransition(async () => {
      const result = await resolveVkLinkConflict({
        email,
        password,
        pendingToken,
      })

      if (result.ok) {
        // The backend returns an absolute URL that already includes
        // `vk_linked=success`. Falling back to the localized account path is
        // safe when the absolute URL is the same origin.
        try {
          const absolute = new URL(result.redirectTo)
          router.push(`${absolute.pathname}${absolute.search}`)
        } catch {
          router.push("/ru/account?vk_linked=success")
        }
        router.refresh()
        return
      }

      setErrorCode(result.code)
    })
  }

  const greeting = [firstName, lastName].filter(Boolean).join(" ").trim()
  const errorMessage = describeError(errorCode)

  return (
    <div
      className="w-full flex flex-col"
      data-testid="vk-link-conflict-form"
    >
      <div className="mb-6 flex flex-col gap-y-1 text-center">
        <h1 className="text-xl-semi">Email уже зарегистрирован</h1>
        <p className="text-small-regular text-ui-fg-subtle">
          {greeting
            ? `Здравствуйте, ${greeting}. `
            : ""}
          Этот email уже используется другим аккаунтом. Войдите по паролю —
          мы автоматически привяжем ВКонтакте к вашему аккаунту.
        </p>
      </div>
      <form className="w-full" action={onSubmit}>
        <div className="flex flex-col w-full gap-y-2">
          <Input
            label="Email"
            name="email"
            type="email"
            value={email}
            readOnly
            required
            autoComplete="email"
            data-testid="vk-link-conflict-email-input"
          />
          <Input
            label="Пароль"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            data-testid="vk-link-conflict-password-input"
          />
        </div>
        {errorMessage ? (
          <p
            className="text-small-regular text-rose-600 mt-3"
            data-testid="vk-link-conflict-error"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}
        <SubmitButton
          className="w-full mt-6"
          data-testid="vk-link-conflict-submit"
        >
          {isPending ? "Связываем..." : "Войти и связать ВК"}
        </SubmitButton>
      </form>
      <div className="w-full flex flex-col small:flex-row justify-between gap-2 mt-6 text-small-regular">
        <LocalizedClientLink
          href="/account/forgot-password"
          className="text-ui-fg-subtle hover:text-ui-fg-base hover:underline underline-offset-4"
          data-testid="vk-link-conflict-forgot-password"
        >
          Забыли пароль?
        </LocalizedClientLink>
        <LocalizedClientLink
          href="/account"
          className="text-ui-fg-subtle hover:text-ui-fg-base hover:underline underline-offset-4"
          data-testid="vk-link-conflict-back-to-login"
        >
          Вернуться ко входу
        </LocalizedClientLink>
      </div>
    </div>
  )
}
