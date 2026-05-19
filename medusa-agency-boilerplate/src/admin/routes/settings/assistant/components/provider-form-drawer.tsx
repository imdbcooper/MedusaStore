/**
 * PR 4 — Drawer для создания/редактирования провайдера.
 *
 * Использует `@medusajs/ui` Drawer (slide-over). Один компонент покрывает
 * оба режима (`mode: "create" | "edit"`) — в edit-режиме поле api_key
 * имеет placeholder `sk-***<last4>` и не отправляется на сервер, если
 * пользователь его не трогал.
 *
 * Валидация на клиенте — параллельно с серверной (defence in depth):
 * URL, диапазоны temperature/max_tokens/top_p/timeout_ms/fallback_priority,
 * формат заголовков (см. `parseRequestHeaders`).
 *
 * При ошибке backend (через
 * [`mapAssistantError`](medusa-agency-boilerplate/src/admin/routes/settings/assistant/lib/error-mapping.ts:1))
 * сообщение показывается inline в баннере над формой плюс toast.
 */

import {
  Button,
  Drawer,
  Heading,
  Input,
  Label,
  Switch,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"

import {
  createProvider,
  updateProvider,
} from "../lib/api"
import { assistantCopy } from "../lib/copy"
import { mapAssistantError } from "../lib/error-mapping"
import {
  maskApiKeyLast4,
  parseOptionalInteger,
  parseOptionalNumber,
  parseRequestHeaders,
  serializeRequestHeaders,
  validateBaseUrl,
} from "../lib/helpers"
import { assistantKeys } from "../lib/query-keys"
import type {
  LlmProviderCreateInput,
  LlmProviderRow,
  LlmProviderUpdateInput,
} from "../lib/types"

type ProviderFormMode =
  | { kind: "create" }
  | { kind: "edit"; provider: LlmProviderRow }

type ProviderFormDrawerProps = {
  open: boolean
  onOpenChange: (next: boolean) => void
  mode: ProviderFormMode
}

type FormState = {
  name: string
  base_url: string
  api_key: string
  model: string
  temperature: string
  max_tokens: string
  top_p: string
  timeout_ms: string
  request_headers_text: string
  is_enabled: boolean
  fallback_priority: string
}

const EMPTY_FORM: FormState = {
  name: "",
  base_url: "",
  api_key: "",
  model: "",
  temperature: "0.2",
  max_tokens: "1024",
  top_p: "",
  timeout_ms: "30000",
  request_headers_text: "",
  is_enabled: true,
  fallback_priority: "",
}

function fromProvider(p: LlmProviderRow): FormState {
  return {
    name: p.name,
    base_url: p.base_url,
    api_key: "",
    model: p.model,
    temperature: String(p.temperature),
    max_tokens: String(p.max_tokens),
    top_p: p.top_p === null || p.top_p === undefined ? "" : String(p.top_p),
    timeout_ms: String(p.timeout_ms),
    request_headers_text: serializeRequestHeaders(p.request_headers),
    is_enabled: p.is_enabled,
    fallback_priority:
      p.fallback_priority === null || p.fallback_priority === undefined
        ? ""
        : String(p.fallback_priority),
  }
}

type FieldErrors = Partial<Record<keyof FormState, string>>

function validate(state: FormState, mode: ProviderFormMode["kind"]): FieldErrors {
  const errors: FieldErrors = {}
  const v = assistantCopy.providerForm.validation

  if (!state.name.trim()) {
    errors.name = v.nameRequired
  }
  if (!state.base_url.trim()) {
    errors.base_url = v.baseUrlRequired
  } else if (!validateBaseUrl(state.base_url)) {
    errors.base_url = v.baseUrlInvalid
  }
  if (!state.model.trim()) {
    errors.model = v.modelRequired
  }
  if (mode === "create" && !state.api_key.trim()) {
    errors.api_key = v.apiKeyRequired
  }

  const temperature = parseOptionalNumber(state.temperature)
  if (temperature === null || temperature < 0 || temperature > 2) {
    errors.temperature = v.temperatureRange
  }
  const maxTokens = parseOptionalInteger(state.max_tokens)
  if (maxTokens === null || maxTokens < 1 || maxTokens > 32_000) {
    errors.max_tokens = v.maxTokensRange
  }
  if (state.top_p.trim()) {
    const topP = parseOptionalNumber(state.top_p)
    if (topP === null || topP < 0 || topP > 1) {
      errors.top_p = v.topPRange
    }
  }
  const timeoutMs = parseOptionalInteger(state.timeout_ms)
  if (timeoutMs === null || timeoutMs < 1000 || timeoutMs > 120_000) {
    errors.timeout_ms = v.timeoutMsRange
  }
  if (state.fallback_priority.trim()) {
    const fp = parseOptionalInteger(state.fallback_priority)
    if (fp === null || fp < 1 || fp > 20) {
      errors.fallback_priority = v.fallbackPriorityRange
    }
  }

  // Headers — пустые строки и BOM игнорируются; «битые» строки помечаем.
  if (state.request_headers_text.trim()) {
    let headerErrors = 0
    parseRequestHeaders(state.request_headers_text, () => {
      headerErrors += 1
    })
    if (headerErrors > 0) {
      errors.request_headers_text = v.headersFormat
    }
  }

  return errors
}

function buildCreatePayload(state: FormState): LlmProviderCreateInput {
  return {
    name: state.name.trim(),
    base_url: state.base_url.trim(),
    api_key: state.api_key,
    model: state.model.trim(),
    temperature: Number(state.temperature),
    max_tokens: Number(state.max_tokens),
    top_p: state.top_p.trim() ? Number(state.top_p) : null,
    timeout_ms: Number(state.timeout_ms),
    request_headers: parseRequestHeaders(state.request_headers_text),
    is_enabled: state.is_enabled,
    fallback_priority: state.fallback_priority.trim()
      ? Number(state.fallback_priority)
      : null,
  }
}

function buildUpdatePayload(
  state: FormState,
  original: LlmProviderRow,
): LlmProviderUpdateInput {
  const patch: LlmProviderUpdateInput = {}
  if (state.name.trim() !== original.name) {
    patch.name = state.name.trim()
  }
  if (state.base_url.trim() !== original.base_url) {
    patch.base_url = state.base_url.trim()
  }
  if (state.model.trim() !== original.model) {
    patch.model = state.model.trim()
  }
  if (Number(state.temperature) !== original.temperature) {
    patch.temperature = Number(state.temperature)
  }
  if (Number(state.max_tokens) !== original.max_tokens) {
    patch.max_tokens = Number(state.max_tokens)
  }
  const topP = state.top_p.trim() ? Number(state.top_p) : null
  if (topP !== original.top_p) {
    patch.top_p = topP
  }
  if (Number(state.timeout_ms) !== original.timeout_ms) {
    patch.timeout_ms = Number(state.timeout_ms)
  }
  const headers = parseRequestHeaders(state.request_headers_text)
  if (
    JSON.stringify(headers) !== JSON.stringify(original.request_headers ?? {})
  ) {
    patch.request_headers = headers
  }
  if (state.is_enabled !== original.is_enabled) {
    patch.is_enabled = state.is_enabled
  }
  const fp = state.fallback_priority.trim()
    ? Number(state.fallback_priority)
    : null
  if (fp !== original.fallback_priority) {
    patch.fallback_priority = fp
  }
  if (state.api_key.trim()) {
    patch.api_key = state.api_key
  }
  return patch
}

export const ProviderFormDrawer = ({
  open,
  onOpenChange,
  mode,
}: ProviderFormDrawerProps) => {
  const queryClient = useQueryClient()

  const initial = useMemo<FormState>(
    () => (mode.kind === "edit" ? fromProvider(mode.provider) : EMPTY_FORM),
    [mode],
  )

  const [state, setState] = useState<FormState>(initial)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})

  // Сбрасываем форму при открытии и при смене редактируемого провайдера.
  useEffect(() => {
    if (open) {
      setState(initial)
      setSubmitError(null)
      setErrors({})
    }
  }, [open, initial])

  const setField = <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  const createMut = useMutation({
    mutationFn: async (input: LlmProviderCreateInput) => {
      const result = await createProvider(input)
      if (!result.ok) throw result
      return result.data
    },
    onSuccess: () => {
      toast.success(assistantCopy.providers.toasts.created)
      queryClient.invalidateQueries({ queryKey: assistantKeys.all })
      onOpenChange(false)
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
      const text = mapAssistantError(code, status, message)
      setSubmitError(text)
      toast.error(text)
    },
  })

  const updateMut = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: LlmProviderUpdateInput
    }) => {
      const result = await updateProvider(id, patch)
      if (!result.ok) throw result
      return result.data
    },
    onSuccess: () => {
      toast.success(assistantCopy.providers.toasts.updated)
      queryClient.invalidateQueries({ queryKey: assistantKeys.all })
      onOpenChange(false)
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
      const text = mapAssistantError(code, status, message)
      setSubmitError(text)
      toast.error(text)
    },
  })

  const isPending = createMut.isPending || updateMut.isPending

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const v = validate(state, mode.kind)
    setErrors(v)
    if (Object.keys(v).length > 0) {
      return
    }
    setSubmitError(null)
    if (mode.kind === "create") {
      createMut.mutate(buildCreatePayload(state))
    } else {
      const patch = buildUpdatePayload(state, mode.provider)
      if (Object.keys(patch).length === 0) {
        toast.success(assistantCopy.common.saved)
        onOpenChange(false)
        return
      }
      updateMut.mutate({ id: mode.provider.id, patch })
    }
  }

  const apiKeyPlaceholder =
    mode.kind === "edit"
      ? assistantCopy.providerForm.fields.apiKeyEditPlaceholder(
          mode.provider.api_key_last4,
        )
      : assistantCopy.providerForm.fields.apiKeyCreatePlaceholder

  const apiKeyHint =
    mode.kind === "edit"
      ? assistantCopy.providerForm.fields.apiKeyEditHint
      : assistantCopy.providerForm.fields.apiKeyCreateHint

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <div className="flex flex-col gap-1">
            <Drawer.Title asChild>
              <Heading level="h2">
                {mode.kind === "create"
                  ? assistantCopy.providerForm.createTitle
                  : `${assistantCopy.providerForm.editTitle}: ${mode.provider.name}`}
              </Heading>
            </Drawer.Title>
            <Drawer.Description asChild>
              <Text size="small" className="text-ui-fg-subtle">
                {assistantCopy.providerForm.description}
              </Text>
            </Drawer.Description>
          </div>
        </Drawer.Header>

        <Drawer.Body className="flex flex-col gap-5 overflow-y-auto p-6">
          <form
            id="assistant-provider-form"
            onSubmit={handleSubmit}
            className="flex flex-col gap-5"
            noValidate
          >
            {submitError ? (
              <div
                role="alert"
                className="bg-ui-tag-red-bg text-ui-tag-red-text rounded-md px-3 py-2 text-sm"
              >
                {submitError}
              </div>
            ) : null}

            {mode.kind === "edit" ? (
              <Field
                label={assistantCopy.providerForm.fields.name}
                hint={assistantCopy.providerForm.fields.nameHint}
                error={errors.name}
              >
                <Input
                  value={state.name}
                  onChange={(e) => setField("name", e.currentTarget.value)}
                  placeholder={assistantCopy.providerForm.fields.namePlaceholder}
                  required
                />
                <Text size="xsmall" className="text-ui-fg-muted mt-1 font-mono">
                  {maskApiKeyLast4(mode.provider.api_key_last4)}
                </Text>
              </Field>
            ) : (
              <Field
                label={assistantCopy.providerForm.fields.name}
                hint={assistantCopy.providerForm.fields.nameHint}
                error={errors.name}
              >
                <Input
                  value={state.name}
                  onChange={(e) => setField("name", e.currentTarget.value)}
                  placeholder={assistantCopy.providerForm.fields.namePlaceholder}
                  required
                />
              </Field>
            )}

            <Field
              label={assistantCopy.providerForm.fields.baseUrl}
              hint={assistantCopy.providerForm.fields.baseUrlHint}
              error={errors.base_url}
            >
              <Input
                value={state.base_url}
                onChange={(e) => setField("base_url", e.currentTarget.value)}
                placeholder={assistantCopy.providerForm.fields.baseUrlPlaceholder}
                required
              />
            </Field>

            <Field
              label={assistantCopy.providerForm.fields.apiKey}
              hint={apiKeyHint}
              error={errors.api_key}
            >
              <Input
                type="password"
                autoComplete="new-password"
                value={state.api_key}
                onChange={(e) => setField("api_key", e.currentTarget.value)}
                placeholder={apiKeyPlaceholder}
                required={mode.kind === "create"}
              />
            </Field>

            <Field
              label={assistantCopy.providerForm.fields.model}
              hint={assistantCopy.providerForm.fields.modelHint}
              error={errors.model}
            >
              <Input
                value={state.model}
                onChange={(e) => setField("model", e.currentTarget.value)}
                placeholder={assistantCopy.providerForm.fields.modelPlaceholder}
                required
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                label={assistantCopy.providerForm.fields.temperature}
                hint={assistantCopy.providerForm.fields.temperatureHint}
                error={errors.temperature}
              >
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={2}
                  value={state.temperature}
                  onChange={(e) =>
                    setField("temperature", e.currentTarget.value)
                  }
                />
              </Field>
              <Field
                label={assistantCopy.providerForm.fields.maxTokens}
                hint={assistantCopy.providerForm.fields.maxTokensHint}
                error={errors.max_tokens}
              >
                <Input
                  type="number"
                  step="1"
                  min={1}
                  max={32_000}
                  value={state.max_tokens}
                  onChange={(e) =>
                    setField("max_tokens", e.currentTarget.value)
                  }
                />
              </Field>
              <Field
                label={`${assistantCopy.providerForm.fields.topP} (${assistantCopy.common.optional})`}
                hint={assistantCopy.providerForm.fields.topPHint}
                error={errors.top_p}
              >
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={1}
                  value={state.top_p}
                  onChange={(e) => setField("top_p", e.currentTarget.value)}
                />
              </Field>
              <Field
                label={assistantCopy.providerForm.fields.timeoutMs}
                hint={assistantCopy.providerForm.fields.timeoutMsHint}
                error={errors.timeout_ms}
              >
                <Input
                  type="number"
                  step="100"
                  min={1000}
                  max={120_000}
                  value={state.timeout_ms}
                  onChange={(e) =>
                    setField("timeout_ms", e.currentTarget.value)
                  }
                />
              </Field>
            </div>

            <Field
              label={assistantCopy.providerForm.fields.requestHeaders}
              hint={assistantCopy.providerForm.fields.requestHeadersHint}
              error={errors.request_headers_text}
            >
              <Textarea
                rows={4}
                value={state.request_headers_text}
                onChange={(e) =>
                  setField("request_headers_text", e.currentTarget.value)
                }
                placeholder={
                  assistantCopy.providerForm.fields.requestHeadersPlaceholder
                }
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between gap-2 rounded-md border border-ui-border-base p-3">
                <div className="flex flex-col">
                  <Label htmlFor="provider-is-enabled">
                    {assistantCopy.providerForm.fields.isEnabled}
                  </Label>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {assistantCopy.providerForm.fields.isEnabledHint}
                  </Text>
                </div>
                <Switch
                  id="provider-is-enabled"
                  checked={state.is_enabled}
                  onCheckedChange={(checked) =>
                    setField("is_enabled", checked)
                  }
                />
              </div>
              <Field
                label={`${assistantCopy.providerForm.fields.fallbackPriority} (${assistantCopy.common.optional})`}
                hint={assistantCopy.providerForm.fields.fallbackPriorityHint}
                error={errors.fallback_priority}
              >
                <Input
                  type="number"
                  step="1"
                  min={1}
                  max={20}
                  value={state.fallback_priority}
                  onChange={(e) =>
                    setField("fallback_priority", e.currentTarget.value)
                  }
                  placeholder={
                    assistantCopy.providerForm.fields.fallbackPriorityPlaceholder
                  }
                />
              </Field>
            </div>
          </form>
        </Drawer.Body>

        <Drawer.Footer>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {assistantCopy.providerForm.actions.cancel}
            </Button>
            <Button
              type="submit"
              form="assistant-provider-form"
              variant="primary"
              isLoading={isPending}
              disabled={isPending}
            >
              {mode.kind === "create"
                ? assistantCopy.providerForm.actions.submitCreate
                : assistantCopy.providerForm.actions.submitEdit}
            </Button>
          </div>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

// ---------------------------------------------------------------------------
// Field — общая обёртка label/hint/error
// ---------------------------------------------------------------------------

const Field = ({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) => {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {children}
      {error ? (
        <Text size="xsmall" className="text-ui-tag-red-icon">
          {error}
        </Text>
      ) : hint ? (
        <Text size="xsmall" className="text-ui-fg-muted">
          {hint}
        </Text>
      ) : null}
    </div>
  )
}

export default ProviderFormDrawer
