"use client"

import React from "react"
import { HttpTypes } from "@medusajs/types"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Phase 5.4: surface a "set initial password" CTA for VK-registered customers.
 *
 * Context
 * -------
 * When a customer signs up via VK ID the backend seeds a random-password
 * emailpass identity so the forgot-password flow has a valid target. The
 * customer never learns that random password, so they cannot log in via
 * email/password until they replace it. The simplest UX for that is the
 * existing forgot-password flow — we just need to point the customer at it.
 *
 * Detection
 * ---------
 * The VK-registered state is recorded in `metadata.vk_link.link_source ===
 * "vk_id_register"` (set by [`createVkIdCustomer`](medusa-agency-boilerplate/src/modules/vk-id.ts:1898)).
 * Once the customer successfully completes the reset flow the backend
 * subscriber stamps `metadata.emailpass_password_set = true`, which we read
 * here to hide the CTA on subsequent visits.
 *
 * Anti-generic UX guardrail
 * -------------------------
 * We intentionally do NOT add a dedicated set-password form here. Re-building
 * the reset flow would duplicate token issuance, email templates, and
 * validation rules. Sending the customer through the canonical
 * `/account/forgot-password` route keeps a single source of truth and means
 * the CTA inherits all rate-limits and email-delivery guardrails the reset
 * flow already has.
 */

type ProfileVkSetPasswordProps = {
  customer: HttpTypes.StoreCustomer
  countryCode: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export function shouldShowVkSetPasswordCta(
  customer: HttpTypes.StoreCustomer
): boolean {
  const metadata = asRecord(customer.metadata)
  const vkLink = asRecord(metadata.vk_link)
  const linkSource = normalizeString(vkLink.link_source)

  if (linkSource !== "vk_id_register") {
    return false
  }

  // Once the customer goes through the reset flow and sets their own password
  // we stamp `emailpass_password_set=true` (see backend reset-password
  // workflow follow-up). Absence of the flag means the VK random password is
  // still in place.
  if (metadata.emailpass_password_set === true) {
    return false
  }

  return true
}

const ProfileVkSetPassword: React.FC<ProfileVkSetPasswordProps> = ({
  customer,
  countryCode,
}) => {
  if (!shouldShowVkSetPasswordCta(customer)) {
    return null
  }

  const email = customer.email?.trim() || ""
  const query = email
    ? `?email=${encodeURIComponent(email)}`
    : ""

  return (
    <div
      className="flex flex-col gap-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 small:p-5"
      data-testid="profile-vk-set-password-cta"
      data-country-code={countryCode}
    >
      <div className="flex flex-col gap-y-1">
        <h3 className="text-small-semi text-ui-fg-base">
          Задайте пароль для запасного входа
        </h3>
        <p className="text-small-regular text-ui-fg-subtle">
          Вы зарегистрировались через ВКонтакте. Чтобы иметь возможность
          входить по email и паролю, установите собственный пароль — мы
          отправим вам письмо со ссылкой.
        </p>
      </div>
      <div>
        <LocalizedClientLink
          href={`/account/forgot-password${query}`}
          className="inline-flex items-center gap-x-2 rounded-md border border-amber-300 bg-white px-3 py-2 text-small-semi text-amber-900 transition-colors hover:bg-amber-100"
          data-testid="profile-vk-set-password-link"
        >
          Установить пароль для входа без ВКонтакте
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default ProfileVkSetPassword
