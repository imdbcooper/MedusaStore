/**
 * PR 4 — статус-бэдж провайдера. Тонкая обёртка над `@medusajs/ui`
 * `StatusBadge`, инкапсулирующая маппинг
 * [`deriveProviderStatusKind`](medusa-agency-boilerplate/src/admin/routes/settings/assistant/lib/helpers.ts:1)
 * → цвет + текст. Используется в таблице провайдеров и в drawer'е.
 */

import { StatusBadge } from "@medusajs/ui"

import { assistantCopy } from "../lib/copy"
import {
  deriveProviderStatusKind,
  type ProviderStatusKind,
} from "../lib/helpers"
import type { LlmProviderRow } from "../lib/types"

type ProviderStatusBadgeProps = {
  provider: Pick<
    LlmProviderRow,
    "is_active" | "is_enabled" | "fallback_priority"
  >
}

const STATUS_COLOR: Record<
  ProviderStatusKind,
  "green" | "blue" | "grey" | "orange"
> = {
  active: "green",
  fallback: "blue",
  disabled: "grey",
  none: "grey",
}

export const ProviderStatusBadge = ({ provider }: ProviderStatusBadgeProps) => {
  const kind = deriveProviderStatusKind(provider)
  const color = STATUS_COLOR[kind]

  let label: string
  if (kind === "fallback" && provider.fallback_priority !== null && provider.fallback_priority !== undefined) {
    label = assistantCopy.providers.status.fallback(provider.fallback_priority)
  } else if (kind === "active") {
    label = assistantCopy.providers.status.active
  } else if (kind === "disabled") {
    label = assistantCopy.providers.status.disabled
  } else {
    label = assistantCopy.providers.status.none
  }

  return <StatusBadge color={color}>{label}</StatusBadge>
}

export default ProviderStatusBadge
