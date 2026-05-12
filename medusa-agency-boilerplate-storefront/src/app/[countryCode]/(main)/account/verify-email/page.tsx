import { Metadata } from "next"
import Link from "next/link"

import { verifyEmail } from "@lib/data/customer"
import AuthCardShell, {
  AlertCircleIcon,
  CheckCircleIcon,
} from "@modules/account/components/auth-card-shell"
import { getMetadataTitle, storefrontConfig } from "@lib/storefront-config"

export const metadata: Metadata = {
  title: getMetadataTitle("Подтверждение email"),
  description:
    "Страница подтверждения адреса электронной почты для аккаунта покупателя.",
}

type VerifyEmailPageProps = {
  params: Promise<{ countryCode: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const GENERIC_INVALID_TOKEN_MESSAGE =
  "Ссылка недействительна или её срок действия истёк. Запросите новое письмо подтверждения."

const ERROR_MESSAGES: Record<string, string> = {
  invalid_or_expired_token: GENERIC_INVALID_TOKEN_MESSAGE,
  // legacy codes kept for backward compatibility during rollout:
  invalid_token_format: GENERIC_INVALID_TOKEN_MESSAGE,
  customer_not_found: GENERIC_INVALID_TOKEN_MESSAGE,
  token_mismatch: GENERIC_INVALID_TOKEN_MESSAGE,
  token_expired: GENERIC_INVALID_TOKEN_MESSAGE,
  token_already_consumed: GENERIC_INVALID_TOKEN_MESSAGE,
  email_mismatch: GENERIC_INVALID_TOKEN_MESSAGE,
  email_verification_failed: "Не удалось подтвердить email. Попробуйте позже.",
}

function readSearchParam(
  value: string | string[] | undefined
): string | null {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : null
  }

  return typeof value === "string" ? value : null
}

function resolveErrorMessage(code?: string | null) {
  if (!code) {
    return ERROR_MESSAGES.email_verification_failed
  }

  return ERROR_MESSAGES[code] || ERROR_MESSAGES.email_verification_failed
}

export default async function VerifyEmailPage(props: VerifyEmailPageProps) {
  const { countryCode } = await props.params
  const searchParams = props.searchParams ? await props.searchParams : {}
  const token = readSearchParam(searchParams.token)

  if (!token) {
    return (
      <VerifyEmailShell
        tone="error"
        heading="Ссылка подтверждения не найдена"
        message="В ссылке отсутствует токен. Запросите новое письмо подтверждения через аккаунт."
        countryCode={countryCode}
      />
    )
  }

  const result = await verifyEmail(token).catch(
    () =>
      ({ ok: false, code: "email_verification_failed" }) as Awaited<
        ReturnType<typeof verifyEmail>
      >
  )

  if (!result.ok) {
    return (
      <VerifyEmailShell
        tone="error"
        heading="Не удалось подтвердить email"
        message={resolveErrorMessage(result.code)}
        countryCode={countryCode}
      />
    )
  }

  const alreadyVerified = result.status === "already_verified"

  return (
    <VerifyEmailShell
      tone="success"
      heading={
        alreadyVerified
          ? "Email уже был подтверждён"
          : "Email успешно подтверждён"
      }
      message={
        alreadyVerified
          ? "Адрес электронной почты уже был подтверждён ранее. Можно пользоваться аккаунтом без ограничений."
          : "Спасибо. Адрес электронной почты подтверждён."
      }
      countryCode={countryCode}
    />
  )
}

type VerifyEmailShellProps = {
  tone: "success" | "error"
  heading: string
  message: string
  countryCode: string
}

function VerifyEmailShell({
  tone,
  heading,
  message,
  countryCode,
}: VerifyEmailShellProps) {
  const accountHref = `/${countryCode}/account`
  const icon =
    tone === "success" ? <CheckCircleIcon /> : <AlertCircleIcon />

  return (
    <AuthCardShell tone={tone} icon={icon} testId="verify-email-page">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-xl-semi">{heading}</h1>
        <p className="text-small-regular text-ui-fg-subtle">{message}</p>
        <div className="flex w-full flex-col gap-3 pt-2 small:flex-row small:justify-center">
          <Link
            href={accountHref}
            className="inline-flex items-center justify-center rounded-md border border-gray-900 bg-gray-900 px-4 py-2 text-small-semi text-white transition-colors hover:bg-gray-800"
            data-testid="verify-email-account-link"
          >
            {storefrontConfig.copy.account.title || "Личный кабинет"}
          </Link>
          <Link
            href={`/${countryCode}`}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-small-semi text-gray-900 transition-colors hover:bg-gray-50"
            data-testid="verify-email-home-link"
          >
            На главную
          </Link>
        </div>
      </div>
    </AuthCardShell>
  )
}
