/**
 * PR 4 — TestButton с локальным состоянием.
 *
 * Запускает probe конкретного провайдера через
 * [`testProvider`](medusa-agency-boilerplate/src/admin/routes/settings/assistant/lib/api.ts:1).
 * Состояние не идёт в react-query кэш (это разовое UI-действие), а после
 * успешного/неуспешного ответа инвалидирует список провайдеров — backend
 * обновляет `last_test_*` в БД и таблица должна показать новый снапшот.
 */

import { CheckCircleSolid, PlaySolid, XCircleSolid } from "@medusajs/icons"
import { Button, Tooltip } from "@medusajs/ui"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { testProvider } from "../lib/api"
import { assistantCopy } from "../lib/copy"
import { mapAssistantError } from "../lib/error-mapping"
import { assistantKeys } from "../lib/query-keys"

type TestState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; latency_ms: number }
  | { kind: "error"; message: string }

type TestButtonProps = {
  providerId: string
  /** Если true — рендерится в компактном виде для строки таблицы. */
  compact?: boolean
  disabled?: boolean
}

export const TestButton = ({
  providerId,
  compact = false,
  disabled,
}: TestButtonProps) => {
  const [state, setState] = useState<TestState>({ kind: "idle" })
  const queryClient = useQueryClient()

  const run = async () => {
    setState({ kind: "loading" })
    const result = await testProvider(providerId)
    if (!result.ok) {
      setState({
        kind: "error",
        message: mapAssistantError(result.error, result.status, result.message),
      })
    } else {
      const probe = result.data.result
      if (probe.ok) {
        setState({ kind: "ok", latency_ms: probe.latency_ms })
      } else {
        setState({
          kind: "error",
          message:
            probe.error?.trim() ||
            (probe.http_status
              ? `HTTP ${probe.http_status}`
              : assistantCopy.test.failShort),
        })
      }
    }
    queryClient.invalidateQueries({ queryKey: assistantKeys.providers() })
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  let label: React.ReactNode = (
    <>
      <PlaySolid />
      <span>{assistantCopy.test.cta}</span>
    </>
  )
  let variant: "secondary" | "primary" | "danger" = "secondary"
  let tooltip: string | undefined

  if (state.kind === "loading") {
    label = <span>{assistantCopy.test.running}</span>
  } else if (state.kind === "ok") {
    variant = "primary"
    label = (
      <>
        <CheckCircleSolid />
        <span>{assistantCopy.test.okShort(state.latency_ms)}</span>
      </>
    )
  } else if (state.kind === "error") {
    variant = "danger"
    tooltip = state.message
    label = (
      <>
        <XCircleSolid />
        <span>{assistantCopy.test.failShort}</span>
      </>
    )
  }

  const button = (
    <Button
      type="button"
      size={compact ? "small" : "base"}
      variant={variant}
      onClick={run}
      disabled={disabled || state.kind === "loading"}
      isLoading={state.kind === "loading"}
    >
      {label}
    </Button>
  )

  if (tooltip) {
    return <Tooltip content={tooltip}>{button}</Tooltip>
  }
  return button
}

export default TestButton
