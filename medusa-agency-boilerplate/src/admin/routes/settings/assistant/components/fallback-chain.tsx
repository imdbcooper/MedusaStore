/**
 * PR 4 — drag-and-drop fallback-цепочки.
 *
 * Из переданного списка провайдеров отбирает только те, у кого
 * `is_enabled === true && fallback_priority !== null`, сортирует по
 * `fallback_priority` и рендерит как сортируемый `@dnd-kit/sortable`
 * список. Кнопка «Сохранить порядок» становится активной только если
 * порядок отличается от исходного — это предотвращает no-op запросы.
 *
 * Доступность:
 *   - `KeyboardSensor` (через `sortableKeyboardCoordinates`) даёт
 *     стрелочную навигацию;
 *   - drag handle помечен `aria-label`, чтобы screen-reader озвучил
 *     перетаскиваемый элемент.
 */

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { DotsSix, MinusMini } from "@medusajs/icons"
import { Button, Heading, IconButton, Text, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"

import { reorderFallback } from "../lib/api"
import { assistantCopy } from "../lib/copy"
import { mapAssistantError } from "../lib/error-mapping"
import { assistantKeys } from "../lib/query-keys"
import type { LlmProviderRow } from "../lib/types"

type FallbackChainProps = {
  providers: LlmProviderRow[]
}

function selectFallback(providers: LlmProviderRow[]): LlmProviderRow[] {
  return providers
    .filter((p) => p.is_enabled && p.fallback_priority !== null)
    .sort(
      (a, b) =>
        (a.fallback_priority ?? Number.POSITIVE_INFINITY) -
        (b.fallback_priority ?? Number.POSITIVE_INFINITY),
    )
}

export const FallbackChain = ({ providers }: FallbackChainProps) => {
  const queryClient = useQueryClient()

  const initialIds = useMemo(
    () => selectFallback(providers).map((p) => p.id),
    [providers],
  )

  const [orderedIds, setOrderedIds] = useState<string[]>(initialIds)

  // Если backend изменил состав цепочки (например, после save) —
  // подтягиваем новый порядок. Сравнение по join, чтобы не дёргать
  // setState на каждом ререндере.
  useEffect(() => {
    if (orderedIds.join(",") !== initialIds.join(",")) {
      setOrderedIds(initialIds)
    }
    // мы хотим реагировать только на смену initialIds
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialIds.join(",")])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const reorderMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const result = await reorderFallback(ids)
      if (!result.ok) throw result
      return result.data
    },
    onSuccess: () => {
      toast.success(assistantCopy.providers.toasts.reorderSaved)
      queryClient.invalidateQueries({ queryKey: assistantKeys.all })
    },
    onError: (err: unknown) => {
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
      toast.error(mapAssistantError(code, status, message))
      // Откат локального порядка к исходному.
      setOrderedIds(initialIds)
    },
  })

  const providerById = useMemo(() => {
    const map = new Map<string, LlmProviderRow>()
    for (const p of providers) map.set(p.id, p)
    return map
  }, [providers])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }
    setOrderedIds((current) => {
      const oldIndex = current.indexOf(String(active.id))
      const newIndex = current.indexOf(String(over.id))
      if (oldIndex < 0 || newIndex < 0) {
        return current
      }
      return arrayMove(current, oldIndex, newIndex)
    })
  }

  const isDirty = useMemo(
    () => orderedIds.join(",") !== initialIds.join(","),
    [orderedIds, initialIds],
  )

  const handleSave = () => {
    if (!isDirty) {
      toast.success(assistantCopy.providers.toasts.reorderEmpty)
      return
    }
    reorderMut.mutate(orderedIds)
  }

  const handleCancel = () => setOrderedIds(initialIds)

  const removeFromChain = (id: string) => {
    setOrderedIds((current) => current.filter((x) => x !== id))
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-ui-border-base bg-ui-bg-base p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Heading level="h3">{assistantCopy.fallback.heading}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {assistantCopy.fallback.subheading}
          </Text>
        </div>
        <div className="flex gap-2">
          {isDirty ? (
            <Button
              variant="secondary"
              size="small"
              type="button"
              onClick={handleCancel}
              disabled={reorderMut.isPending}
            >
              {assistantCopy.fallback.cancelCta}
            </Button>
          ) : null}
          <Button
            variant="primary"
            size="small"
            type="button"
            onClick={handleSave}
            disabled={!isDirty || reorderMut.isPending}
            isLoading={reorderMut.isPending}
          >
            {assistantCopy.fallback.saveCta}
          </Button>
        </div>
      </div>

      {orderedIds.length === 0 ? (
        <div className="text-ui-fg-subtle rounded-md border border-dashed border-ui-border-base px-4 py-6 text-sm">
          {assistantCopy.fallback.emptyState}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={orderedIds}
            strategy={verticalListSortingStrategy}
          >
            <ol className="flex flex-col gap-2">
              {orderedIds.map((id, index) => {
                const provider = providerById.get(id)
                if (!provider) return null
                return (
                  <SortableRow
                    key={id}
                    id={id}
                    index={index}
                    provider={provider}
                    onRemove={() => removeFromChain(id)}
                  />
                )
              })}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <Text size="xsmall" className="text-ui-fg-muted">
        {assistantCopy.fallback.keyboardHint}
      </Text>
    </section>
  )
}

// ---------------------------------------------------------------------------
// SortableRow
// ---------------------------------------------------------------------------

type SortableRowProps = {
  id: string
  index: number
  provider: LlmProviderRow
  onRemove: () => void
}

const SortableRow = ({ id, index, provider, onRemove }: SortableRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-md border border-ui-border-base bg-ui-bg-subtle px-3 py-2"
    >
      <IconButton
        ref={setActivatorNodeRef}
        size="small"
        variant="transparent"
        type="button"
        aria-label={assistantCopy.fallback.dragHandleAria(provider.name)}
        {...attributes}
        {...listeners}
      >
        <DotsSix />
      </IconButton>

      <span className="text-ui-fg-muted text-xs font-mono">#{index + 1}</span>

      <div className="flex flex-col">
        <span className="text-sm font-medium">{provider.name}</span>
        <span className="text-ui-fg-muted text-xs">
          {provider.model} · {provider.base_url}
        </span>
      </div>

      <div className="ml-auto">
        <IconButton
          size="small"
          variant="transparent"
          type="button"
          onClick={onRemove}
          aria-label={`${assistantCopy.common.delete}: ${provider.name}`}
        >
          <MinusMini />
        </IconButton>
      </div>
    </li>
  )
}

export default FallbackChain
