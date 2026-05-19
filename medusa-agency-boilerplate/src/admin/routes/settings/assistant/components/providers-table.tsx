/**
 * PR 4 — таблица провайдеров.
 *
 * Чисто-презентационный компонент: получает массив, эмитит callbacks
 * (`onEdit`, `onTest` и т. п.) — но `Test` оборачивается отдельным
 * компонентом [`TestButton`](medusa-agency-boilerplate/src/admin/routes/settings/assistant/components/test-button.tsx:1)
 * с собственным локальным состоянием.
 */

import { EllipsisHorizontal, PencilSquare, Trash } from "@medusajs/icons"
import {
  DropdownMenu,
  IconButton,
  Table,
  Text,
} from "@medusajs/ui"

import { assistantCopy } from "../lib/copy"
import { formatLastTest } from "../lib/helpers"
import type { LlmProviderRow } from "../lib/types"
import ProviderStatusBadge from "./status-badge"
import TestButton from "./test-button"

const LAST_TEST_COLOR_DOT: Record<"green" | "red" | "grey", string> = {
  green: "bg-ui-tag-green-icon",
  red: "bg-ui-tag-red-icon",
  grey: "bg-ui-fg-muted",
}

type ProvidersTableProps = {
  providers: LlmProviderRow[]
  onEdit: (provider: LlmProviderRow) => void
  onActivate: (provider: LlmProviderRow) => void
  onToggleEnabled: (provider: LlmProviderRow) => void
  onDelete: (provider: LlmProviderRow) => void
  isMutating: boolean
}

export const ProvidersTable = ({
  providers,
  onEdit,
  onActivate,
  onToggleEnabled,
  onDelete,
  isMutating,
}: ProvidersTableProps) => {
  return (
    <div className="overflow-x-auto">
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>
              {assistantCopy.providers.columns.name}
            </Table.HeaderCell>
            <Table.HeaderCell>
              {assistantCopy.providers.columns.baseUrl}
            </Table.HeaderCell>
            <Table.HeaderCell>
              {assistantCopy.providers.columns.model}
            </Table.HeaderCell>
            <Table.HeaderCell>
              {assistantCopy.providers.columns.status}
            </Table.HeaderCell>
            <Table.HeaderCell>
              {assistantCopy.providers.columns.lastTest}
            </Table.HeaderCell>
            <Table.HeaderCell className="text-right">
              {assistantCopy.providers.columns.actions}
            </Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {providers.map((p) => {
            const lastTest = formatLastTest(p)
            return (
              <Table.Row key={p.id}>
                <Table.Cell>
                  <div className="flex flex-col">
                    <span className="text-ui-fg-base text-sm font-medium">
                      {p.name}
                    </span>
                    <Text size="xsmall" className="text-ui-fg-muted font-mono">
                      ••••{p.api_key_last4 || "----"}
                    </Text>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <code className="text-ui-fg-subtle break-all text-xs">
                    {p.base_url}
                  </code>
                </Table.Cell>
                <Table.Cell>
                  <span className="text-sm">{p.model}</span>
                </Table.Cell>
                <Table.Cell>
                  <ProviderStatusBadge provider={p} />
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`inline-block h-2 w-2 rounded-full ${LAST_TEST_COLOR_DOT[lastTest.color]}`}
                    />
                    <span className="text-ui-fg-subtle text-xs">
                      {lastTest.label}
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex items-center justify-end gap-1">
                    <TestButton providerId={p.id} compact disabled={isMutating} />

                    <IconButton
                      size="small"
                      variant="transparent"
                      type="button"
                      aria-label={assistantCopy.providers.actions.edit}
                      onClick={() => onEdit(p)}
                      disabled={isMutating}
                    >
                      <PencilSquare />
                    </IconButton>

                    <DropdownMenu>
                      <DropdownMenu.Trigger asChild>
                        <IconButton
                          size="small"
                          variant="transparent"
                          type="button"
                          aria-label={assistantCopy.providers.actions.menu}
                          disabled={isMutating}
                        >
                          <EllipsisHorizontal />
                        </IconButton>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content align="end">
                        <DropdownMenu.Item
                          disabled={p.is_active || !p.is_enabled}
                          onSelect={() => onActivate(p)}
                        >
                          {assistantCopy.providers.actions.activate}
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          onSelect={() => onToggleEnabled(p)}
                        >
                          {p.is_enabled
                            ? assistantCopy.providers.actions.disable
                            : assistantCopy.providers.actions.enable}
                        </DropdownMenu.Item>
                        <DropdownMenu.Separator />
                        <DropdownMenu.Item
                          onSelect={() => onDelete(p)}
                          className="text-ui-fg-error"
                        >
                          <Trash />
                          <span>{assistantCopy.providers.actions.delete}</span>
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu>
                  </div>
                </Table.Cell>
              </Table.Row>
            )
          })}
        </Table.Body>
      </Table>
    </div>
  )
}

export default ProvidersTable
