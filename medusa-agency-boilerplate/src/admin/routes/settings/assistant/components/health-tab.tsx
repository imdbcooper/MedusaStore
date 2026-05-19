/**
 * PR 4 — вкладка Health.
 *
 * Две карточки:
 *   1. «Проверить все провайдеры» — параллельный probe всех включённых
 *      провайдеров. Состояние локальное (не лезет в react-query кэш),
 *      но после завершения инвалидирует список — backend обновил
 *      `last_test_*`, и snapshot-карточка сразу подтянет свежие данные.
 *   2. Снапшот «Последние тесты» — тонкая table-обёртка над `listProviders()`,
 *      рендерит цветные точки + время для каждого ряда.
 */

import {
  CheckCircleSolid,
  PlaySolid,
  XCircleSolid,
} from "@medusajs/icons"
import {
  Alert,
  Badge,
  Button,
  Heading,
  Skeleton,
  Table,
  Text,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { listProviders, testProvider } from "../lib/api"
import { assistantCopy } from "../lib/copy"
import { mapAssistantError } from "../lib/error-mapping"
import { formatLastTest, formatLatency } from "../lib/helpers"
import { assistantKeys } from "../lib/query-keys"
import type { LlmProviderRow, LlmProviderTestResult } from "../lib/types"

type ProbeOutcome =
  | { kind: "skipped"; provider: LlmProviderRow }
  | {
      kind: "ok"
      provider: LlmProviderRow
      result: LlmProviderTestResult
    }
  | {
      kind: "error"
      provider: LlmProviderRow
      message: string
      result?: LlmProviderTestResult
    }

const COLOR_DOT: Record<"green" | "red" | "grey", string> = {
  green: "bg-ui-tag-green-icon",
  red: "bg-ui-tag-red-icon",
  grey: "bg-ui-fg-muted",
}

export const HealthTab = () => {
  const queryClient = useQueryClient()

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

  const [outcomes, setOutcomes] = useState<ProbeOutcome[]>([])

  const runAllMut = useMutation({
    mutationFn: async (providers: LlmProviderRow[]) => {
      const enabled = providers.filter((p) => p.is_enabled)
      const settled = await Promise.all(
        enabled.map(async (p): Promise<ProbeOutcome> => {
          const result = await testProvider(p.id)
          if (!result.ok) {
            return {
              kind: "error",
              provider: p,
              message: mapAssistantError(
                result.error,
                result.status,
                result.message,
              ),
            }
          }
          if (result.data.result.ok) {
            return {
              kind: "ok",
              provider: p,
              result: result.data.result,
            }
          }
          return {
            kind: "error",
            provider: p,
            result: result.data.result,
            message:
              result.data.result.error?.trim() ||
              (result.data.result.http_status
                ? `HTTP ${result.data.result.http_status}`
                : assistantCopy.test.failShort),
          }
        }),
      )
      const skipped: ProbeOutcome[] = providers
        .filter((p) => !p.is_enabled)
        .map((p) => ({ kind: "skipped", provider: p }))
      return [...settled, ...skipped]
    },
    onSuccess: (results) => {
      setOutcomes(results)
      queryClient.invalidateQueries({ queryKey: assistantKeys.providers() })
    },
  })

  if (listQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3 px-6 py-5">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (listQuery.isError) {
    return (
      <div className="px-6 py-5">
        <Alert variant="error">
          <span>{assistantCopy.providers.errors.load}</span>
          <Button
            size="small"
            variant="secondary"
            onClick={() => listQuery.refetch()}
          >
            {assistantCopy.common.retry}
          </Button>
        </Alert>
      </div>
    )
  }

  const providers = listQuery.data ?? []
  const enabledCount = providers.filter((p) => p.is_enabled).length
  const okCount = outcomes.filter((o) => o.kind === "ok").length

  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      <div className="flex flex-col gap-1">
        <Heading level="h2">{assistantCopy.health.heading}</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {assistantCopy.health.subheading}
        </Text>
      </div>

      {/* PROBE-ALL CARD */}
      <section className="flex flex-col gap-3 rounded-lg border border-ui-border-base bg-ui-bg-base p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Heading level="h3">
            {assistantCopy.health.runAllCta}
          </Heading>
          <div className="flex items-center gap-3">
            {outcomes.length > 0 ? (
              <Text size="small" className="text-ui-fg-subtle">
                {assistantCopy.health.summary(okCount, enabledCount)}
              </Text>
            ) : null}
            <Button
              type="button"
              variant="primary"
              onClick={() => runAllMut.mutate(providers)}
              disabled={runAllMut.isPending || enabledCount === 0}
              isLoading={runAllMut.isPending}
            >
              <PlaySolid />
              <span>
                {runAllMut.isPending
                  ? assistantCopy.health.running
                  : assistantCopy.health.runAllCta}
              </span>
            </Button>
          </div>
        </div>

        {enabledCount === 0 ? (
          <Text size="small" className="text-ui-fg-muted">
            {assistantCopy.health.empty}
          </Text>
        ) : outcomes.length === 0 ? null : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>
                  {assistantCopy.health.columns.name}
                </Table.HeaderCell>
                <Table.HeaderCell>
                  {assistantCopy.health.columns.latency}
                </Table.HeaderCell>
                <Table.HeaderCell>
                  {assistantCopy.health.columns.status}
                </Table.HeaderCell>
                <Table.HeaderCell>
                  {assistantCopy.health.columns.error}
                </Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {outcomes.map((o) => (
                <Table.Row key={`probe-${o.provider.id}`}>
                  <Table.Cell>
                    <span className="text-sm font-medium">
                      {o.provider.name}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    {o.kind === "ok"
                      ? formatLatency(o.result.latency_ms)
                      : o.kind === "error"
                        ? formatLatency(o.result?.latency_ms ?? null)
                        : assistantCopy.common.none}
                  </Table.Cell>
                  <Table.Cell>
                    {o.kind === "ok" ? (
                      <Badge color="green" size="small">
                        <CheckCircleSolid />
                        <span className="ml-1">
                          {assistantCopy.health.statusOk}
                        </span>
                      </Badge>
                    ) : o.kind === "error" ? (
                      <Badge color="red" size="small">
                        <XCircleSolid />
                        <span className="ml-1">
                          {assistantCopy.health.statusError}
                        </span>
                      </Badge>
                    ) : (
                      <Badge color="grey" size="small">
                        <span>{assistantCopy.health.statusSkipped}</span>
                      </Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-ui-fg-muted text-xs">
                      {o.kind === "error" ? o.message : assistantCopy.common.none}
                    </span>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </section>

      {/* SNAPSHOT CARD */}
      <section className="flex flex-col gap-3 rounded-lg border border-ui-border-base bg-ui-bg-base p-5">
        <div className="flex flex-col gap-1">
          <Heading level="h3">
            {assistantCopy.health.snapshotHeading}
          </Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {assistantCopy.health.snapshotSubheading}
          </Text>
        </div>

        {providers.length === 0 ? (
          <Text size="small" className="text-ui-fg-muted">
            {assistantCopy.health.empty}
          </Text>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>
                  {assistantCopy.health.columns.name}
                </Table.HeaderCell>
                <Table.HeaderCell>
                  {assistantCopy.health.columns.latency}
                </Table.HeaderCell>
                <Table.HeaderCell>
                  {assistantCopy.health.columns.status}
                </Table.HeaderCell>
                <Table.HeaderCell>
                  {assistantCopy.health.columns.error}
                </Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {providers.map((p) => {
                const last = formatLastTest(p)
                return (
                  <Table.Row key={`snap-${p.id}`}>
                    <Table.Cell>
                      <span className="text-sm font-medium">{p.name}</span>
                    </Table.Cell>
                    <Table.Cell>
                      {formatLatency(p.last_test_latency_ms)}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className={`inline-block h-2 w-2 rounded-full ${COLOR_DOT[last.color]}`}
                        />
                        <span className="text-ui-fg-subtle text-xs">
                          {last.label}
                        </span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-ui-fg-muted text-xs">
                        {p.last_test_error ?? assistantCopy.common.none}
                      </span>
                    </Table.Cell>
                  </Table.Row>
                )
              })}
            </Table.Body>
          </Table>
        )}
      </section>
    </div>
  )
}

export default HealthTab
