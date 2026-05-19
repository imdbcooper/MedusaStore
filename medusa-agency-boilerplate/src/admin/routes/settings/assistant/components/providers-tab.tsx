/**
 * PR 4 — вкладка Providers.
 *
 * Состав:
 *   - блок «Цепочка fallback» (drag-and-drop) над таблицей;
 *   - таблица провайдеров с inline `TestButton`, edit-icon и dropdown
 *     с активацией / включением / удалением;
 *   - Drawer для создания и редактирования.
 *
 * Подтверждения через `usePrompt()`:
 *   - удаление активного провайдера → отдельный заголовок «провайдер
 *     активный»;
 *   - удаление обычного → стандартный prompt.
 *
 * Все мутации инвалидируют `assistantKeys.all`, чтобы FallbackChain,
 * GeneralTab (косвенно через статус) и HealthTab увидели новые данные.
 */

import { Plus } from "@medusajs/icons"
import {
  Alert,
  Button,
  Heading,
  Skeleton,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import {
  activateProvider,
  deleteProvider,
  listProviders,
  updateProvider,
} from "../lib/api"
import { assistantCopy } from "../lib/copy"
import { mapAssistantError } from "../lib/error-mapping"
import { assistantKeys } from "../lib/query-keys"
import type { LlmProviderRow } from "../lib/types"
import FallbackChain from "./fallback-chain"
import ProviderFormDrawer from "./provider-form-drawer"
import ProvidersTable from "./providers-table"

type DrawerState =
  | { open: false }
  | { open: true; mode: { kind: "create" } }
  | { open: true; mode: { kind: "edit"; provider: LlmProviderRow } }

function errorTextOf(err: unknown): string {
  const code =
    err && typeof err === "object" && "error" in err
      ? String((err as { error: unknown }).error)
      : "network"
  const status =
    err && typeof err === "object" && "status" in err
      ? Number((err as { status: unknown }).status)
      : 0
  const message =
    err && typeof err === "object" && "message" in err
      ? String((err as { message: unknown }).message)
      : undefined
  return mapAssistantError(code, status, message)
}

export const ProvidersTab = () => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()

  const [drawer, setDrawer] = useState<DrawerState>({ open: false })

  const listQuery = useQuery({
    queryKey: assistantKeys.providers(),
    queryFn: async () => {
      const result = await listProviders()
      if (!result.ok) throw result
      return result.data.providers
    },
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  })

  const invalidateAll = () =>
    queryClient.invalidateQueries({ queryKey: assistantKeys.all })

  // ---- Mutations -----------------------------------------------------------

  const activateMut = useMutation({
    mutationFn: async (id: string) => {
      const result = await activateProvider(id)
      if (!result.ok) throw result
      return result.data
    },
    onSuccess: () => {
      toast.success(assistantCopy.providers.toasts.activated)
      invalidateAll()
    },
    onError: (err) => toast.error(errorTextOf(err)),
  })

  const toggleMut = useMutation({
    mutationFn: async ({
      id,
      next,
    }: {
      id: string
      next: boolean
    }) => {
      const result = await updateProvider(id, { is_enabled: next })
      if (!result.ok) throw result
      return result.data
    },
    onSuccess: (_data, vars) => {
      toast.success(
        vars.next
          ? assistantCopy.providers.toasts.enabled
          : assistantCopy.providers.toasts.disabled,
      )
      invalidateAll()
    },
    onError: (err) => toast.error(errorTextOf(err)),
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteProvider(id)
      if (!result.ok) throw result
      return result
    },
    onSuccess: () => {
      toast.success(assistantCopy.providers.toasts.deleted)
      invalidateAll()
    },
    onError: (err) => toast.error(errorTextOf(err)),
  })

  const isMutating =
    activateMut.isPending ||
    toggleMut.isPending ||
    deleteMut.isPending

  // ---- Handlers ------------------------------------------------------------

  const onAdd = () => setDrawer({ open: true, mode: { kind: "create" } })
  const onEdit = (provider: LlmProviderRow) =>
    setDrawer({ open: true, mode: { kind: "edit", provider } })

  const onActivate = async (p: LlmProviderRow) => {
    const confirmed = await prompt({
      title: assistantCopy.providers.confirmActivate.title,
      description: assistantCopy.providers.confirmActivate.description,
      confirmText: assistantCopy.providers.confirmActivate.confirm,
      cancelText: assistantCopy.common.cancel,
    })
    if (!confirmed) return
    activateMut.mutate(p.id)
  }

  const onToggleEnabled = async (p: LlmProviderRow) => {
    const next = !p.is_enabled
    const confirmed = await prompt({
      title: next
        ? assistantCopy.providers.confirmEnableDisable.enableTitle
        : assistantCopy.providers.confirmEnableDisable.disableTitle,
      description: next
        ? assistantCopy.providers.confirmEnableDisable.enableDescription
        : assistantCopy.providers.confirmEnableDisable.disableDescription,
      confirmText: next
        ? assistantCopy.providers.confirmEnableDisable.enableConfirm
        : assistantCopy.providers.confirmEnableDisable.disableConfirm,
      cancelText: assistantCopy.common.cancel,
      variant: next ? "confirmation" : "danger",
    })
    if (!confirmed) return
    toggleMut.mutate({ id: p.id, next })
  }

  const onDelete = async (p: LlmProviderRow) => {
    const isActive = p.is_active
    const confirmed = await prompt({
      title: isActive
        ? assistantCopy.providers.confirmDelete.titleActive
        : assistantCopy.providers.confirmDelete.title,
      description: isActive
        ? assistantCopy.providers.confirmDelete.descriptionActive
        : assistantCopy.providers.confirmDelete.description,
      confirmText: assistantCopy.providers.confirmDelete.confirm,
      cancelText: assistantCopy.common.cancel,
      variant: "danger",
    })
    if (!confirmed) return
    deleteMut.mutate(p.id)
  }

  // ---- Render --------------------------------------------------------------

  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Heading level="h2">{assistantCopy.providers.heading}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {assistantCopy.providers.subheading}
          </Text>
        </div>
        <Button
          variant="primary"
          type="button"
          onClick={onAdd}
        >
          <Plus />
          <span>{assistantCopy.providers.addCta}</span>
        </Button>
      </div>

      {listQuery.isLoading ? (
        <SkeletonRows />
      ) : listQuery.isError ? (
        <Alert variant="error">
          <span>{errorTextOf(listQuery.error)}</span>
          <Button
            type="button"
            size="small"
            variant="secondary"
            onClick={() => listQuery.refetch()}
          >
            {assistantCopy.common.retry}
          </Button>
        </Alert>
      ) : !listQuery.data || listQuery.data.length === 0 ? (
        <EmptyState onAdd={onAdd} />
      ) : (
        <>
          <FallbackChain providers={listQuery.data} />
          <ProvidersTable
            providers={listQuery.data}
            onEdit={onEdit}
            onActivate={onActivate}
            onToggleEnabled={onToggleEnabled}
            onDelete={onDelete}
            isMutating={isMutating}
          />
        </>
      )}

      {drawer.open ? (
        <ProviderFormDrawer
          open={drawer.open}
          onOpenChange={(next) => {
            if (!next) setDrawer({ open: false })
          }}
          mode={drawer.mode}
        />
      ) : null}
    </div>
  )
}

const SkeletonRows = () => (
  <div className="flex flex-col gap-2">
    {Array.from({ length: 4 }).map((_, idx) => (
      <Skeleton key={idx} className="h-12 w-full" />
    ))}
  </div>
)

const EmptyState = ({ onAdd }: { onAdd: () => void }) => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-ui-border-base px-6 py-12 text-center">
    <Heading level="h3">{assistantCopy.providers.empty.heading}</Heading>
    <Text className="text-ui-fg-subtle">
      {assistantCopy.providers.empty.body}
    </Text>
    <Button type="button" variant="primary" onClick={onAdd}>
      <Plus />
      <span>{assistantCopy.providers.empty.addCta}</span>
    </Button>
  </div>
)

export default ProvidersTab
