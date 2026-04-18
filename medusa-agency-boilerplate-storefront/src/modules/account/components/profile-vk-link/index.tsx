import { startVkIdLink, unlinkVkId } from "@lib/data/customer"
import { VK_ID_ENABLED } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { Badge, Button } from "@medusajs/ui"

type ProfileVkLinkProps = {
  customer: HttpTypes.StoreCustomer
  countryCode: string
  initialResult: string | null
  initialReason: string | null
}

type VkLinkSnapshot = {
  isLinked: boolean
  provider: string | null
  vkUserId: string | null
  vkPeerId: string | null
  linkedAt: string | null
  linkSource: string | null
  linkStatus: string | null
  lastVerifiedAt: string | null
  unlinkedAt: string | null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function readVkLink(customer: HttpTypes.StoreCustomer): VkLinkSnapshot {
  const metadata = asRecord(customer.metadata)
  const vkLink = asRecord(metadata.vk_link)
  const legacyPeerId = normalizeString(metadata.vk_peer_id)
  const linkStatus = normalizeString(vkLink.link_status)
  const structuredPeerId = normalizeString(vkLink.vk_peer_id)
  const resolvedPeerId = structuredPeerId || legacyPeerId
  const isLinked = linkStatus === "unlinked" ? Boolean(legacyPeerId) : Boolean(resolvedPeerId)

  return {
    isLinked,
    provider:
      normalizeString(vkLink.provider) || (legacyPeerId ? "vkid-legacy" : null),
    vkUserId: normalizeString(vkLink.vk_user_id),
    vkPeerId: resolvedPeerId,
    linkedAt: normalizeString(vkLink.linked_at),
    linkSource: normalizeString(vkLink.link_source),
    linkStatus: linkStatus || (isLinked ? "linked" : null),
    lastVerifiedAt: normalizeString(vkLink.last_verified_at),
    unlinkedAt: normalizeString(vkLink.unlinked_at),
  }
}

function getResultMessage(result: string | null, reason: string | null) {
  if (!result) {
    return null
  }

  if (result === "linked") {
    return {
      tone: "success",
      message: "VK ID успешно привязан к профилю.",
    } as const
  }

  if (result === "already_linked") {
    return {
      tone: "success",
      message: "Этот VK ID уже привязан к вашему профилю.",
    } as const
  }

  if (result === "unlinked") {
    return {
      tone: "success",
      message: "Привязка VK ID удалена.",
    } as const
  }

  if (result === "conflict") {
    if (reason === "vk_identity_linked_to_another_customer") {
      return {
        tone: "error",
        message: "Этот VK ID уже привязан к другому customer и не может быть связан повторно.",
      } as const
    }

    if (reason === "customer_linked_to_different_vk_identity") {
      return {
        tone: "error",
        message: "Профиль уже связан с другим VK ID. Сначала выполните unlink.",
      } as const
    }
  }

  if (result === "failed") {
    if (reason === "missing_vk_peer_id") {
      return {
        tone: "error",
        message: "VK callback не вернул usable vk_peer_id, поэтому привязка не была сохранена.",
      } as const
    }

    if (reason === "invalid_or_expired_state") {
      return {
        tone: "error",
        message: "Ссылка VK ID устарела или повреждена. Запустите linking заново.",
      } as const
    }

    if (reason === "vk_id_disabled") {
      return {
        tone: "error",
        message: "VK ID сейчас отключен в runtime конфигурации.",
      } as const
    }

    if (reason === "customer_auth_required") {
      return {
        tone: "error",
        message: "Для VK ID linking требуется authenticated customer session.",
      } as const
    }
  }

  return {
    tone: "error",
    message: "VK ID flow завершился с ошибкой. Повторите попытку позже.",
  } as const
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "—"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

export default function ProfileVkLink({
  customer,
  countryCode,
  initialResult,
  initialReason,
}: ProfileVkLinkProps) {
  const link = readVkLink(customer)
  const resultMessage = getResultMessage(initialResult, initialReason)

  return (
    <div className="flex flex-col gap-y-4 rounded-rounded border border-ui-border-base p-6">
      <div className="flex flex-col gap-y-2">
        <div className="flex items-center gap-x-3">
          <h2 className="text-large-semi">VK ID</h2>
          <Badge color={link.isLinked ? "green" : "grey"}>
            {link.isLinked ? "Connected" : "Not connected"}
          </Badge>
        </div>
        <p className="text-small-regular text-ui-fg-subtle">
          Optional identity linking layer для customer profile. Existing VK notification transport продолжает читать legacy truth из metadata.vk_peer_id.
        </p>
      </div>

      {resultMessage ? (
        <div
          className={`rounded-rounded border px-4 py-3 text-small-regular ${
            resultMessage.tone === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {resultMessage.message}
        </div>
      ) : null}

      <dl className="grid grid-cols-1 gap-3 text-small-regular small:grid-cols-2">
        <div>
          <dt className="text-ui-fg-subtle">Provider</dt>
          <dd className="font-medium">{link.provider || "—"}</dd>
        </div>
        <div>
          <dt className="text-ui-fg-subtle">VK user id</dt>
          <dd className="font-medium">{link.vkUserId || "—"}</dd>
        </div>
        <div>
          <dt className="text-ui-fg-subtle">VK peer id</dt>
          <dd className="font-medium">{link.vkPeerId || "—"}</dd>
        </div>
        <div>
          <dt className="text-ui-fg-subtle">Status</dt>
          <dd className="font-medium">{link.linkStatus || "not_linked"}</dd>
        </div>
        <div>
          <dt className="text-ui-fg-subtle">Linked at</dt>
          <dd className="font-medium">{formatDateTime(link.linkedAt)}</dd>
        </div>
        <div>
          <dt className="text-ui-fg-subtle">Last verified at</dt>
          <dd className="font-medium">{formatDateTime(link.lastVerifiedAt)}</dd>
        </div>
        <div>
          <dt className="text-ui-fg-subtle">Unlinked at</dt>
          <dd className="font-medium">{formatDateTime(link.unlinkedAt)}</dd>
        </div>
        <div>
          <dt className="text-ui-fg-subtle">Link source</dt>
          <dd className="font-medium">{link.linkSource || "—"}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-3 small:flex-row">
        <form action={startVkIdLink.bind(null, countryCode)}>
          <Button type="submit" variant="primary" disabled={!VK_ID_ENABLED}>
            {link.isLinked ? "Повторно проверить VK ID" : "Привязать VK ID"}
          </Button>
        </form>
        <form action={unlinkVkId.bind(null, countryCode)}>
          <Button
            type="submit"
            variant="secondary"
            disabled={!link.isLinked}
          >
            Отвязать VK ID
          </Button>
        </form>
      </div>

      {!VK_ID_ENABLED ? (
        <p className="text-small-regular text-ui-fg-subtle">
          Storefront guardrail: VK ID surface скрыт за optional env flag и не должен ломать baseline storefront runtime без `NEXT_PUBLIC_VK_ID_ENABLED=true`.
        </p>
      ) : null}
    </div>
  )
}
