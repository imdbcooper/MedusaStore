import { Metadata } from "next"

import VkLinkConflictForm from "@modules/account/components/vk-link-conflict-form"
import AuthCardShell, {
  AlertCircleIcon,
} from "@modules/account/components/auth-card-shell"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { getMetadataTitle } from "@lib/storefront-config"

export const metadata: Metadata = {
  title: getMetadataTitle("Связывание ВКонтакте"),
  description:
    "Завершение привязки аккаунта ВКонтакте к существующей учётной записи.",
}

type VkLinkConflictPageProps = {
  params: Promise<{ countryCode: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function readSearchParam(
  value: string | string[] | undefined
): string | null {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : null
  }

  return typeof value === "string" ? value : null
}

type PendingTokenPreview = {
  email: string | null
  firstName: string | null
  lastName: string | null
}

/**
 * Phase 5.3: unsafe, display-only decode of the pending-link token payload.
 *
 * The conflict page needs to show the VK-provided email (read-only) and the
 * user's first/last name as a friendly greeting. The token is signed and
 * verified server-side when the form submits; we do NOT trust these fields
 * for any security decision. This decode exists purely so the page can
 * render without a backend round trip.
 *
 * Returns `null` if the token is missing or malformed so the page can show
 * a friendly "link expired" fallback.
 */
function previewPendingToken(
  token: string | null
): PendingTokenPreview | null {
  if (!token) {
    return null
  }

  const parts = token.split(".")

  if (parts.length !== 2) {
    return null
  }

  const [encoded] = parts

  try {
    const padded =
      encoded.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (encoded.length % 4)) % 4)
    const decoded = Buffer.from(padded, "base64").toString("utf8")
    const parsed = JSON.parse(decoded) as Partial<{
      email: unknown
      firstName: unknown
      lastName: unknown
    }>

    const email =
      typeof parsed.email === "string" && parsed.email.trim()
        ? parsed.email.trim()
        : null
    const firstName =
      typeof parsed.firstName === "string" && parsed.firstName.trim()
        ? parsed.firstName.trim()
        : null
    const lastName =
      typeof parsed.lastName === "string" && parsed.lastName.trim()
        ? parsed.lastName.trim()
        : null

    if (!email) {
      return null
    }

    return { email, firstName, lastName }
  } catch {
    return null
  }
}

export default async function VkLinkConflictPage(
  props: VkLinkConflictPageProps
) {
  await props.params
  const searchParams = props.searchParams ? await props.searchParams : {}
  const pendingToken = readSearchParam(searchParams.pending_token)?.trim() || ""
  const preview = previewPendingToken(pendingToken)

  if (!pendingToken || !preview) {
    return (
      <AuthCardShell
        tone="error"
        icon={<AlertCircleIcon />}
        testId="vk-link-conflict-missing-token"
      >
        <div className="w-full flex flex-col items-center gap-3 text-center">
          <h1 className="text-xl-semi">Ссылка недействительна</h1>
          <p className="text-small-regular text-ui-fg-subtle">
            Сессия привязки ВКонтакте истекла или повреждена. Вернитесь на
            страницу входа и попробуйте снова.
          </p>
          <LocalizedClientLink
            href="/account"
            className="text-small-semi underline decoration-dotted underline-offset-4 text-ui-fg-base hover:text-emerald-700"
            data-testid="vk-link-conflict-back-to-login"
          >
            Вернуться ко входу
          </LocalizedClientLink>
        </div>
      </AuthCardShell>
    )
  }

  return (
    <AuthCardShell
      icon={<AlertCircleIcon />}
      testId="vk-link-conflict-page"
    >
      <VkLinkConflictForm
        email={preview.email!}
        firstName={preview.firstName}
        lastName={preview.lastName}
        pendingToken={pendingToken}
      />
    </AuthCardShell>
  )
}
