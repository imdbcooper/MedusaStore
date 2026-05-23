import {
  Alert,
  Button,
  Heading,
  Input,
  Label,
  Select,
  Skeleton,
  StatusBadge,
  Switch,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"

import {
  getTelegramHandoffConfig,
  testTelegramHandoffConfig,
  updateTelegramHandoffConfig,
} from "../lib/api"
import { assistantCopy } from "../lib/copy"
import { mapAssistantError } from "../lib/error-mapping"
import { formatTimestamp } from "../lib/helpers"
import { assistantKeys } from "../lib/query-keys"
import type {
  AssistantTelegramHandoffConfigRow,
  AssistantTelegramHandoffDiagnostics,
  AssistantTelegramHandoffDiagnosticsStatus,
  AssistantTelegramHandoffEnvironmentMode,
  AssistantTelegramHandoffOperatorReplyMode,
  AssistantTelegramHandoffUpdateInput,
} from "../lib/types"

type FormState = {
  enabled: boolean
  environment_mode: AssistantTelegramHandoffEnvironmentMode
  bot_token_input: string
  bot_username: string
  support_chat_id: string
  topics_required: boolean
  webhook_url: string
  webhook_secret_input: string
  allowed_operator_ids_text: string
  allowed_admin_ids_text: string
  operator_reply_mode: AssistantTelegramHandoffOperatorReplyMode
  fallback_message: string
}

function splitIds(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\s,]+/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  )
}

function normalizeNullableText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function fromConfig(config: AssistantTelegramHandoffConfigRow): FormState {
  return {
    enabled: config.enabled,
    environment_mode: config.environment_mode,
    bot_token_input: "",
    bot_username: config.bot_username ?? "",
    support_chat_id: config.support_chat_id ?? "",
    topics_required: config.topics_required,
    webhook_url: config.webhook_url ?? "",
    webhook_secret_input: "",
    allowed_operator_ids_text: (config.allowed_operator_ids ?? []).join("\n"),
    allowed_admin_ids_text: (config.allowed_admin_ids ?? []).join("\n"),
    operator_reply_mode: config.operator_reply_mode,
    fallback_message: config.fallback_message ?? "",
  }
}

function buildPatch(
  state: FormState,
  current: AssistantTelegramHandoffConfigRow,
): AssistantTelegramHandoffUpdateInput {
  const patch: AssistantTelegramHandoffUpdateInput = {}

  if (state.enabled !== current.enabled) {
    patch.enabled = state.enabled
  }
  if (state.environment_mode !== current.environment_mode) {
    patch.environment_mode = state.environment_mode
  }

  const botUsername = normalizeNullableText(state.bot_username)
  if (botUsername !== current.bot_username) {
    patch.bot_username = botUsername
  }

  const supportChatId = normalizeNullableText(state.support_chat_id)
  if (supportChatId !== current.support_chat_id) {
    patch.support_chat_id = supportChatId
  }

  if (state.topics_required !== current.topics_required) {
    patch.topics_required = state.topics_required
  }

  const webhookUrl = normalizeNullableText(state.webhook_url)
  if (webhookUrl !== current.webhook_url) {
    patch.webhook_url = webhookUrl
  }

  const allowedOperatorIds = splitIds(state.allowed_operator_ids_text)
  if (
    JSON.stringify(allowedOperatorIds) !==
    JSON.stringify(current.allowed_operator_ids ?? [])
  ) {
    patch.allowed_operator_ids = allowedOperatorIds
  }

  const allowedAdminIds = splitIds(state.allowed_admin_ids_text)
  if (
    JSON.stringify(allowedAdminIds) !==
    JSON.stringify(current.allowed_admin_ids ?? [])
  ) {
    patch.allowed_admin_ids = allowedAdminIds
  }

  if (state.operator_reply_mode !== current.operator_reply_mode) {
    patch.operator_reply_mode = state.operator_reply_mode
  }

  const fallbackMessage = normalizeNullableText(state.fallback_message)
  if (fallbackMessage !== current.fallback_message) {
    patch.fallback_message = fallbackMessage
  }

  const botToken = state.bot_token_input.trim()
  if (botToken.length > 0) {
    patch.bot_token = botToken
  }

  const webhookSecret = state.webhook_secret_input.trim()
  if (webhookSecret.length > 0) {
    patch.webhook_secret = webhookSecret
  }

  return patch
}

function deriveDiagnostics(
  state: FormState,
  current: AssistantTelegramHandoffConfigRow,
): AssistantTelegramHandoffDiagnostics {
  if (!state.enabled) {
    return {
      status: "disabled",
      missing_fields: [],
      can_test: false,
    }
  }

  const missing_fields: string[] = []
  const hasBotToken =
    state.bot_token_input.trim().length > 0 || current.bot_token.is_configured
  const hasWebhookSecret =
    state.webhook_secret_input.trim().length > 0 ||
    current.webhook_secret.is_configured
  const supportChatId = normalizeNullableText(state.support_chat_id)
  const webhookUrl = normalizeNullableText(state.webhook_url)
  const topicsRequired = state.topics_required
  const hasOperators = splitIds(state.allowed_operator_ids_text).length > 0
  const hasAdmins = splitIds(state.allowed_admin_ids_text).length > 0

  if (!hasBotToken) {
    missing_fields.push("bot_token")
  }
  if (!hasWebhookSecret) {
    missing_fields.push("webhook_secret")
  }
  if (!supportChatId) {
    missing_fields.push("support_chat_id")
  }
  if (!topicsRequired) {
    missing_fields.push("topics_required")
  }
  if (!webhookUrl) {
    missing_fields.push("webhook_url")
  }
  if (!hasOperators && !hasAdmins && state.environment_mode === "production") {
    missing_fields.push("allowed_operator_ids_or_allowed_admin_ids")
  }

  if (missing_fields.length === 0) {
    return {
      status: "ready_for_connection_test",
      missing_fields: [],
      can_test: true,
    }
  }

  const configuredSignals = [
    hasBotToken,
    hasWebhookSecret,
    Boolean(supportChatId),
    Boolean(webhookUrl),
    hasOperators || hasAdmins,
  ].filter(Boolean).length

  return {
    status:
      configuredSignals === 0 ? "not_configured" : "partially_configured",
    missing_fields,
    can_test: false,
  }
}

function statusColor(
  status: AssistantTelegramHandoffDiagnosticsStatus,
): "green" | "orange" | "grey" {
  switch (status) {
    case "ready_for_connection_test":
      return "green"
    case "disabled":
      return "grey"
    default:
      return "orange"
  }
}

function statusLabel(status: AssistantTelegramHandoffDiagnosticsStatus): string {
  const copy = assistantCopy.telegramHandoff.status
  switch (status) {
    case "disabled":
      return copy.disabled
    case "not_configured":
      return copy.notConfigured
    case "partially_configured":
      return copy.partiallyConfigured
    case "ready_for_connection_test":
      return copy.ready
  }
}

function describeMissingField(field: string): string {
  const copy = assistantCopy.telegramHandoff.fields
  switch (field) {
    case "bot_token":
      return copy.botToken
    case "support_chat_id":
      return copy.supportChatId
    case "topics_required":
      return copy.topicsRequired
    case "webhook_url":
      return copy.webhookUrl
    case "webhook_secret":
      return copy.webhookSecret
    case "allowed_operator_ids_or_allowed_admin_ids":
      return `${copy.allowedOperatorIds} / ${copy.allowedAdminIds}`
    default:
      return field
  }
}

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
  if (code === "validation" && typeof message === "string" && message.trim()) {
    return message.trim()
  }
  return mapAssistantError(code, status, message)
}

const Section = ({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) => (
  <section className="flex flex-col gap-4 rounded-lg border border-ui-border-base bg-ui-bg-base p-5">
    <div className="flex flex-col gap-1">
      <Heading level="h3">{title}</Heading>
      {subtitle ? (
        <Text size="small" className="text-ui-fg-subtle">
          {subtitle}
        </Text>
      ) : null}
    </div>
    {children}
  </section>
)

const FieldStack = ({ children }: { children: ReactNode }) => (
  <div className="flex min-w-[220px] flex-1 flex-col gap-2">{children}</div>
)

const Grid = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
)

const TelegramHandoffTab = () => {
  const queryClient = useQueryClient()
  const copy = assistantCopy.telegramHandoff

  const configQuery = useQuery({
    queryKey: assistantKeys.telegramHandoff(),
    queryFn: async () => {
      const result = await getTelegramHandoffConfig()
      if (!result.ok) throw result
      return result.data.config
    },
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  })

  const initial = useMemo(
    () => (configQuery.data ? fromConfig(configQuery.data) : null),
    [configQuery.data],
  )

  const [state, setState] = useState<FormState | null>(initial)

  useEffect(() => {
    if (initial) {
      setState((prev) => prev ?? initial)
    }
  }, [initial])

  const saveMutation = useMutation({
    mutationFn: async (patch: AssistantTelegramHandoffUpdateInput) => {
      const result = await updateTelegramHandoffConfig(patch)
      if (!result.ok) throw result
      return result.data.config
    },
    onSuccess: (config) => {
      toast.success(copy.toasts.saved)
      setState(fromConfig(config))
      queryClient.setQueryData(assistantKeys.telegramHandoff(), config)
      queryClient.invalidateQueries({ queryKey: assistantKeys.all })
    },
    onError: (err) => toast.error(errorTextOf(err)),
  })

  const testMutation = useMutation({
    mutationFn: async () => {
      const result = await testTelegramHandoffConfig()
      if (!result.ok) throw result
      return result.data.result
    },
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(result.message || copy.toasts.testPassed)
      } else {
        toast.error(copy.toasts.testMissing)
      }
      queryClient.invalidateQueries({ queryKey: assistantKeys.telegramHandoff() })
    },
    onError: (err) => toast.error(errorTextOf(err)),
  })

  if (configQuery.isLoading || !configQuery.data || !state) {
    if (configQuery.isError) {
      return (
        <div className="px-6 py-5">
          <Alert variant="error">
            <span>{copy.errors.load}</span>
            <Button
              size="small"
              variant="secondary"
              onClick={() => configQuery.refetch()}
            >
              {assistantCopy.common.retry}
            </Button>
          </Alert>
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-3 px-6 py-5">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  const current = configQuery.data
  const patch = buildPatch(state, current)
  const isDirty = Object.keys(patch).length > 0
  const diagnostics = deriveDiagnostics(state, current)
  const lastTestLabel = current.last_test_at
    ? `${copy.lastTest.at}: ${formatTimestamp(current.last_test_at)}`
    : copy.lastTest.never

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((prev) => (prev ? { ...prev, [key]: value } : prev))

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isDirty) {
      return
    }
    saveMutation.mutate({
      ...patch,
      expected_version: current.version,
    })
  }

  const handleTest = () => {
    if (isDirty) {
      toast.error(copy.toasts.saveFirst)
      return
    }
    testMutation.mutate()
  }

  return (
    <form className="flex flex-col gap-5 px-6 py-5" onSubmit={handleSave}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex flex-col gap-1">
          <Heading level="h2">{copy.heading}</Heading>
          <Text className="text-ui-fg-subtle" size="small">
            {copy.subheading}
          </Text>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleTest}
            isLoading={testMutation.isPending}
          >
            {testMutation.isPending ? copy.actions.testing : copy.actions.test}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!isDirty || saveMutation.isPending}
            onClick={() => setState(fromConfig(current))}
          >
            {copy.actions.revert}
          </Button>
          <Button type="submit" isLoading={saveMutation.isPending} disabled={!isDirty}>
            {copy.actions.save}
          </Button>
        </div>
      </div>

      <Section title={copy.sections.diagnostics}>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base p-4">
            <div className="flex items-center justify-between gap-3">
              <Text size="small" className="text-ui-fg-subtle">
                {copy.sections.diagnostics}
              </Text>
              <StatusBadge color={statusColor(diagnostics.status)}>
                {statusLabel(diagnostics.status)}
              </StatusBadge>
            </div>
            <Text className="text-sm">
              {diagnostics.can_test ? copy.status.canTest : copy.status.cannotTest}
            </Text>
            {diagnostics.missing_fields.length > 0 ? (
              <Text size="small" className="text-ui-fg-subtle">
                {copy.status.missing}{" "}
                {diagnostics.missing_fields
                  .map((field) => describeMissingField(field))
                  .join(", ")}
              </Text>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base p-4">
            <div className="flex items-center justify-between gap-3">
              <Text size="small" className="text-ui-fg-subtle">
                {copy.lastTest.at}
              </Text>
              {current.last_test_status ? (
                <StatusBadge
                  color={
                    current.last_test_status === "dry_run_passed" ||
                    current.last_test_status === "connection_ok"
                      ? "green"
                      : current.last_test_status === "disabled"
                        ? "grey"
                        : "orange"
                  }
                >
                  {current.last_test_status}
                </StatusBadge>
              ) : null}
            </div>
            <Text className="text-sm">{lastTestLabel}</Text>
            {current.last_test_error ? (
              <Text size="small" className="text-ui-fg-subtle whitespace-pre-wrap">
                {current.last_test_error}
              </Text>
            ) : null}
          </div>
        </div>
      </Section>

      <Section title={copy.sections.connection}>
        <Grid>
          <FieldStack>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-ui-border-base px-3 py-2">
              <div className="flex flex-col gap-1">
                <Label>{copy.fields.enabled}</Label>
                <Text size="small" className="text-ui-fg-subtle">
                  {copy.fields.enabledHint}
                </Text>
              </div>
              <Switch
                checked={state.enabled}
                onCheckedChange={(checked) => setField("enabled", checked)}
              />
            </div>
          </FieldStack>

          <FieldStack>
            <Label>{copy.fields.environmentMode}</Label>
            <Select
              value={state.environment_mode}
              onValueChange={(value) =>
                setField(
                  "environment_mode",
                  value as AssistantTelegramHandoffEnvironmentMode,
                )
              }
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="test">
                  {copy.environmentModes.test}
                </Select.Item>
                <Select.Item value="production">
                  {copy.environmentModes.production}
                </Select.Item>
              </Select.Content>
            </Select>
            <Text size="small" className="text-ui-fg-subtle">
              {copy.fields.environmentModeHint}
            </Text>
          </FieldStack>

          <FieldStack>
            <Label>{copy.fields.botToken}</Label>
            <Input
              type="password"
              autoComplete="new-password"
              value={state.bot_token_input}
              placeholder={
                current.bot_token.masked
                  ? copy.placeholders.botTokenMasked(current.bot_token.masked)
                  : copy.placeholders.botTokenEmpty
              }
              onChange={(event) => setField("bot_token_input", event.target.value)}
            />
            <Text size="small" className="text-ui-fg-subtle">
              {copy.fields.botTokenHint}
            </Text>
          </FieldStack>

          <FieldStack>
            <Label>{copy.fields.botUsername}</Label>
            <Input
              value={state.bot_username}
              placeholder={copy.placeholders.botUsername}
              onChange={(event) => setField("bot_username", event.target.value)}
            />
            <Text size="small" className="text-ui-fg-subtle">
              {copy.fields.botUsernameHint}
            </Text>
          </FieldStack>

          <FieldStack>
            <Label>{copy.fields.supportChatId}</Label>
            <Input
              value={state.support_chat_id}
              placeholder={copy.placeholders.supportChatId}
              onChange={(event) => setField("support_chat_id", event.target.value)}
            />
            <Text size="small" className="text-ui-fg-subtle">
              {copy.fields.supportChatIdHint}
            </Text>
          </FieldStack>

          <FieldStack>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-ui-border-base px-3 py-2">
              <div className="flex flex-col gap-1">
                <Label>{copy.fields.topicsRequired}</Label>
                <Text size="small" className="text-ui-fg-subtle">
                  {copy.fields.topicsRequiredHint}
                </Text>
              </div>
              <Switch
                checked={state.topics_required}
                onCheckedChange={(checked) => setField("topics_required", checked)}
              />
            </div>
          </FieldStack>

          <FieldStack>
            <Label>{copy.fields.webhookUrl}</Label>
            <Input
              value={state.webhook_url}
              placeholder={copy.placeholders.webhookUrl}
              onChange={(event) => setField("webhook_url", event.target.value)}
            />
            <Text size="small" className="text-ui-fg-subtle">
              {copy.fields.webhookUrlHint}
            </Text>
          </FieldStack>

          <FieldStack>
            <Label>{copy.fields.webhookSecret}</Label>
            <Input
              type="password"
              autoComplete="new-password"
              value={state.webhook_secret_input}
              placeholder={
                current.webhook_secret.masked
                  ? copy.placeholders.webhookSecretMasked(
                      current.webhook_secret.masked,
                    )
                  : copy.placeholders.webhookSecretEmpty
              }
              onChange={(event) =>
                setField("webhook_secret_input", event.target.value)
              }
            />
            <Text size="small" className="text-ui-fg-subtle">
              {copy.fields.webhookSecretHint}
            </Text>
          </FieldStack>
        </Grid>
      </Section>

      <Section title={copy.sections.access}>
        <Grid>
          <FieldStack>
            <Label>{copy.fields.allowedOperatorIds}</Label>
            <Textarea
              rows={6}
              value={state.allowed_operator_ids_text}
              placeholder={copy.placeholders.ids}
              onChange={(event) =>
                setField("allowed_operator_ids_text", event.target.value)
              }
            />
            <Text size="small" className="text-ui-fg-subtle">
              {copy.fields.allowedOperatorIdsHint}
            </Text>
          </FieldStack>

          <FieldStack>
            <Label>{copy.fields.allowedAdminIds}</Label>
            <Textarea
              rows={6}
              value={state.allowed_admin_ids_text}
              placeholder={copy.placeholders.ids}
              onChange={(event) =>
                setField("allowed_admin_ids_text", event.target.value)
              }
            />
            <Text size="small" className="text-ui-fg-subtle">
              {copy.fields.allowedAdminIdsHint}
            </Text>
          </FieldStack>
        </Grid>
      </Section>

      <Section title={copy.sections.behavior}>
        <Grid>
          <FieldStack>
            <Label>{copy.fields.operatorReplyMode}</Label>
            <Select
              value={state.operator_reply_mode}
              onValueChange={(value) =>
                setField(
                  "operator_reply_mode",
                  value as AssistantTelegramHandoffOperatorReplyMode,
                )
              }
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="explicit_reply_command">
                  {copy.operatorReplyModes.explicitReplyCommand}
                </Select.Item>
                <Select.Item value="all_topic_messages">
                  {copy.operatorReplyModes.allTopicMessages}
                </Select.Item>
              </Select.Content>
            </Select>
            <Text size="small" className="text-ui-fg-subtle">
              {copy.fields.operatorReplyModeHint}
            </Text>
          </FieldStack>

          <FieldStack>
            <Label>{copy.fields.fallbackMessage}</Label>
            <Textarea
              rows={6}
              value={state.fallback_message}
              placeholder={copy.placeholders.fallbackMessage}
              onChange={(event) =>
                setField("fallback_message", event.target.value)
              }
            />
            <Text size="small" className="text-ui-fg-subtle">
              {copy.fields.fallbackMessageHint}
            </Text>
          </FieldStack>
        </Grid>
      </Section>

      <Section title={copy.sections.checklist}>
        <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base p-4">
          <Text size="small" className="text-ui-fg-subtle">
            {copy.checklist.intro}
          </Text>
          <ul className="list-disc space-y-2 pl-5 text-sm text-ui-fg-subtle">
            {copy.checklist.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </Section>
    </form>
  )
}

export default TelegramHandoffTab
