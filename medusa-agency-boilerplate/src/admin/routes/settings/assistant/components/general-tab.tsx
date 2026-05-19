/**
 * PR 4 — вкладка «Общие настройки».
 *
 * Загружает singleton через `getSettings()`, рендерит форму со всеми
 * полями `AssistantSettingRow`. Patch отправляется только для тех полей,
 * которые реально изменились (через сравнение с исходным снапшотом),
 * плюс `expected_version` — это даёт optimistic concurrency: если другой
 * пользователь успел сохранить раньше, backend вернёт 409 +
 * `version_mismatch`, и мы покажем тост с просьбой обновить страницу.
 *
 * `tools_enabled`, `guardrails`, `rate_limits`, `observability` —
 * динамические объекты «ключ → значение». UI рендерит свитчи / поля
 * по тем ключам, которые пришли с сервера, плюс минимальный известный
 * набор по умолчанию для пустых объектов (см. `DEFAULT_*_KEYS`).
 */

import {
  Alert,
  Button,
  Heading,
  Input,
  Label,
  Select,
  Skeleton,
  Switch,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"

import { getSettings, updateSettings } from "../lib/api"
import { assistantCopy } from "../lib/copy"
import { mapAssistantError } from "../lib/error-mapping"
import { assistantKeys } from "../lib/query-keys"
import type {
  AssistantRetrievalMode,
  AssistantSettingRow,
  AssistantSettingUpdateInput,
} from "../lib/types"

// ---------------------------------------------------------------------------
// Defaults — для редких случаев, когда сервер вернул пустые объекты.
// ---------------------------------------------------------------------------

const DEFAULT_TOOLS = [
  "price_lookup",
  "stock_lookup",
  "add_to_cart_proposal",
  "search_products",
] as const

const DEFAULT_GUARDRAILS = [
  "prompt_injection",
  "pii_redaction",
  "no_hallucination_price_stock",
] as const

const DEFAULT_RATE_LIMITS = ["chat_per_minute", "chat_per_day"] as const

const DEFAULT_OBSERVABILITY = ["sentry", "langsmith"] as const

const RETRIEVAL_MODES: ReadonlyArray<{
  value: AssistantRetrievalMode
  label: string
}> = [
  { value: "auto", label: "auto" },
  { value: "markdown", label: "markdown" },
  { value: "vector", label: "vector" },
  { value: "lightrag", label: "lightrag" },
]

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

type FormState = {
  system_prompt: string
  retrieval_mode: AssistantRetrievalMode
  retrieval_top_k: string
  retrieval_min_score: string
  embedding_provider: string
  embedding_model: string
  embedding_dimension: string
  max_history_messages: string
  max_input_chars: string
  max_output_tokens: string
  streaming_enabled: boolean
  default_locale: string
  allowed_models_text: string
  tools_enabled: Record<string, boolean>
  guardrails: Record<string, boolean>
  rate_limits: Record<string, string>
  observability: Record<string, boolean>
  usage_tracking_enabled: boolean
}

function fromSettings(s: AssistantSettingRow): FormState {
  return {
    system_prompt: s.system_prompt,
    retrieval_mode: s.retrieval_mode,
    retrieval_top_k: String(s.retrieval_top_k),
    retrieval_min_score: String(s.retrieval_min_score),
    embedding_provider: s.embedding_provider,
    embedding_model: s.embedding_model ?? "",
    embedding_dimension: String(s.embedding_dimension),
    max_history_messages: String(s.max_history_messages),
    max_input_chars: String(s.max_input_chars),
    max_output_tokens: String(s.max_output_tokens),
    streaming_enabled: s.streaming_enabled,
    default_locale: s.default_locale,
    allowed_models_text: (s.allowed_models ?? []).join("\n"),
    tools_enabled: ensureKeys(s.tools_enabled, DEFAULT_TOOLS, true),
    guardrails: ensureKeys(s.guardrails, DEFAULT_GUARDRAILS, true),
    rate_limits: Object.fromEntries(
      Object.entries(
        ensureKeys<number>(
          s.rate_limits,
          DEFAULT_RATE_LIMITS,
          0,
        ),
      ).map(([k, v]) => [k, String(v)]),
    ),
    observability: ensureKeys(s.observability, DEFAULT_OBSERVABILITY, false),
    usage_tracking_enabled: s.usage_tracking_enabled,
  }
}

/**
 * Объединяет ключи объекта с дефолтным набором так, чтобы UI всегда
 * рендерил минимум известные тогглы — даже если backend почистил всё.
 */
function ensureKeys<V>(
  source: Record<string, V> | undefined | null,
  defaults: ReadonlyArray<string>,
  defaultValue: V,
): Record<string, V> {
  const out: Record<string, V> = {}
  for (const key of defaults) {
    out[key] = (source?.[key] ?? defaultValue) as V
  }
  if (source) {
    for (const [k, v] of Object.entries(source)) {
      out[k] = v
    }
  }
  return out
}

function buildPatch(
  next: FormState,
  prev: AssistantSettingRow,
): AssistantSettingUpdateInput {
  const patch: AssistantSettingUpdateInput = {}

  if (next.system_prompt !== prev.system_prompt) {
    patch.system_prompt = next.system_prompt
  }
  if (next.retrieval_mode !== prev.retrieval_mode) {
    patch.retrieval_mode = next.retrieval_mode
  }
  const topK = Number(next.retrieval_top_k)
  if (Number.isFinite(topK) && topK !== prev.retrieval_top_k) {
    patch.retrieval_top_k = topK
  }
  const minScore = Number(next.retrieval_min_score)
  if (Number.isFinite(minScore) && minScore !== prev.retrieval_min_score) {
    patch.retrieval_min_score = minScore
  }
  if (next.embedding_provider !== prev.embedding_provider) {
    patch.embedding_provider = next.embedding_provider
  }
  const embModel = next.embedding_model.trim() ? next.embedding_model.trim() : null
  if (embModel !== prev.embedding_model) {
    patch.embedding_model = embModel
  }
  const embDim = Number(next.embedding_dimension)
  if (Number.isFinite(embDim) && embDim !== prev.embedding_dimension) {
    patch.embedding_dimension = embDim
  }
  const maxHistory = Number(next.max_history_messages)
  if (Number.isFinite(maxHistory) && maxHistory !== prev.max_history_messages) {
    patch.max_history_messages = maxHistory
  }
  const maxInput = Number(next.max_input_chars)
  if (Number.isFinite(maxInput) && maxInput !== prev.max_input_chars) {
    patch.max_input_chars = maxInput
  }
  const maxOut = Number(next.max_output_tokens)
  if (Number.isFinite(maxOut) && maxOut !== prev.max_output_tokens) {
    patch.max_output_tokens = maxOut
  }
  if (next.streaming_enabled !== prev.streaming_enabled) {
    patch.streaming_enabled = next.streaming_enabled
  }
  if (next.default_locale !== prev.default_locale) {
    patch.default_locale = next.default_locale
  }

  const allowedModels = next.allowed_models_text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (
    JSON.stringify(allowedModels) !== JSON.stringify(prev.allowed_models ?? [])
  ) {
    patch.allowed_models = allowedModels
  }

  if (
    JSON.stringify(next.tools_enabled) !==
    JSON.stringify(prev.tools_enabled ?? {})
  ) {
    patch.tools_enabled = next.tools_enabled
  }
  if (
    JSON.stringify(next.guardrails) !== JSON.stringify(prev.guardrails ?? {})
  ) {
    patch.guardrails = next.guardrails
  }
  const rateLimitsParsed: Record<string, number> = {}
  for (const [k, v] of Object.entries(next.rate_limits)) {
    const n = Number(v)
    rateLimitsParsed[k] = Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
  }
  if (
    JSON.stringify(rateLimitsParsed) !==
    JSON.stringify(prev.rate_limits ?? {})
  ) {
    patch.rate_limits = rateLimitsParsed
  }
  if (
    JSON.stringify(next.observability) !==
    JSON.stringify(prev.observability ?? {})
  ) {
    patch.observability = next.observability
  }
  if (next.usage_tracking_enabled !== prev.usage_tracking_enabled) {
    patch.usage_tracking_enabled = next.usage_tracking_enabled
  }

  return patch
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const GeneralTab = () => {
  const queryClient = useQueryClient()

  const settingsQuery = useQuery({
    queryKey: assistantKeys.settings(),
    queryFn: async () => {
      const result = await getSettings()
      if (!result.ok) throw result
      return result.data.settings
    },
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  })

  const initial = useMemo<FormState | null>(
    () => (settingsQuery.data ? fromSettings(settingsQuery.data) : null),
    [settingsQuery.data],
  )

  const [state, setState] = useState<FormState | null>(initial)

  useEffect(() => {
    if (initial) {
      setState(initial)
    }
  }, [initial])

  const updateMut = useMutation({
    mutationFn: async (patch: AssistantSettingUpdateInput) => {
      const result = await updateSettings(patch)
      if (!result.ok) throw result
      return result.data.settings
    },
    onSuccess: (settings) => {
      toast.success(assistantCopy.general.toasts.saved)
      queryClient.setQueryData(assistantKeys.settings(), settings)
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
    },
  })

  if (settingsQuery.isLoading || !settingsQuery.data || !state) {
    if (settingsQuery.isError) {
      return (
        <div className="px-6 py-5">
          <Alert variant="error">
            <span>{assistantCopy.general.errors.load}</span>
            <Button
              size="small"
              variant="secondary"
              onClick={() => settingsQuery.refetch()}
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
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-12 w-1/2" />
      </div>
    )
  }

  const settings = settingsQuery.data
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((prev) => (prev ? { ...prev, [key]: value } : prev))

  const setToolEnabled = (key: string, value: boolean) =>
    setState((prev) =>
      prev
        ? { ...prev, tools_enabled: { ...prev.tools_enabled, [key]: value } }
        : prev,
    )
  const setGuardrail = (key: string, value: boolean) =>
    setState((prev) =>
      prev ? { ...prev, guardrails: { ...prev.guardrails, [key]: value } } : prev,
    )
  const setRateLimit = (key: string, value: string) =>
    setState((prev) =>
      prev ? { ...prev, rate_limits: { ...prev.rate_limits, [key]: value } } : prev,
    )
  const setObservability = (key: string, value: boolean) =>
    setState((prev) =>
      prev
        ? { ...prev, observability: { ...prev.observability, [key]: value } }
        : prev,
    )

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const patch = buildPatch(state, settings)
    if (Object.keys(patch).length === 0) {
      toast.success(assistantCopy.common.saved)
      return
    }
    patch.expected_version = settings.version
    updateMut.mutate(patch)
  }

  const handleRevert = () => {
    setState(fromSettings(settings))
  }

  const isDirty = Object.keys(buildPatch(state, settings)).length > 0

  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Heading level="h2">{assistantCopy.general.heading}</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            {assistantCopy.general.subheading}
          </Text>
        </div>
        <Text size="small" className="text-ui-fg-muted font-mono">
          {assistantCopy.general.versionLabel(settings.version)}
        </Text>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-6"
        noValidate
      >
        {/* PROMPT */}
        <Section title={assistantCopy.general.sections.prompt}>
          <FieldStack>
            <Label htmlFor="system-prompt">
              {assistantCopy.general.fields.systemPrompt}
            </Label>
            <Textarea
              id="system-prompt"
              rows={12}
              value={state.system_prompt}
              onChange={(e) =>
                setField("system_prompt", e.currentTarget.value)
              }
            />
            <Text size="xsmall" className="text-ui-fg-muted">
              {assistantCopy.general.fields.systemPromptCounter(
                state.system_prompt.length,
                20_000,
              )}
            </Text>
          </FieldStack>
        </Section>

        {/* RETRIEVAL */}
        <Section title={assistantCopy.general.sections.retrieval}>
          <Grid>
            <FieldStack>
              <Label>{assistantCopy.general.fields.retrievalMode}</Label>
              <Select
                value={state.retrieval_mode}
                onValueChange={(v) =>
                  setField("retrieval_mode", v as AssistantRetrievalMode)
                }
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {RETRIEVAL_MODES.map((opt) => (
                    <Select.Item key={opt.value} value={opt.value}>
                      {opt.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </FieldStack>
            <FieldStack>
              <Label>{assistantCopy.general.fields.retrievalTopK}</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={state.retrieval_top_k}
                onChange={(e) =>
                  setField("retrieval_top_k", e.currentTarget.value)
                }
              />
            </FieldStack>
            <FieldStack>
              <Label>{assistantCopy.general.fields.retrievalMinScore}</Label>
              <Input
                type="number"
                step="0.001"
                min={0}
                max={1}
                value={state.retrieval_min_score}
                onChange={(e) =>
                  setField("retrieval_min_score", e.currentTarget.value)
                }
              />
            </FieldStack>
          </Grid>
        </Section>

        {/* EMBEDDING */}
        <Section title={assistantCopy.general.sections.embedding}>
          <Grid>
            <FieldStack>
              <Label>{assistantCopy.general.fields.embeddingProvider}</Label>
              <Input
                value={state.embedding_provider}
                onChange={(e) =>
                  setField("embedding_provider", e.currentTarget.value)
                }
              />
            </FieldStack>
            <FieldStack>
              <Label>{assistantCopy.general.fields.embeddingModel}</Label>
              <Input
                value={state.embedding_model}
                onChange={(e) =>
                  setField("embedding_model", e.currentTarget.value)
                }
                placeholder={assistantCopy.common.optional}
              />
            </FieldStack>
            <FieldStack>
              <Label>{assistantCopy.general.fields.embeddingDimension}</Label>
              <Input
                type="number"
                min={8}
                max={8192}
                value={state.embedding_dimension}
                onChange={(e) =>
                  setField("embedding_dimension", e.currentTarget.value)
                }
              />
            </FieldStack>
          </Grid>
        </Section>

        {/* LIMITS */}
        <Section title={assistantCopy.general.sections.limits}>
          <Grid>
            <FieldStack>
              <Label>{assistantCopy.general.fields.maxHistoryMessages}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={state.max_history_messages}
                onChange={(e) =>
                  setField("max_history_messages", e.currentTarget.value)
                }
              />
            </FieldStack>
            <FieldStack>
              <Label>{assistantCopy.general.fields.maxInputChars}</Label>
              <Input
                type="number"
                min={100}
                max={50_000}
                value={state.max_input_chars}
                onChange={(e) =>
                  setField("max_input_chars", e.currentTarget.value)
                }
              />
            </FieldStack>
            <FieldStack>
              <Label>{assistantCopy.general.fields.maxOutputTokens}</Label>
              <Input
                type="number"
                min={1}
                max={32_000}
                value={state.max_output_tokens}
                onChange={(e) =>
                  setField("max_output_tokens", e.currentTarget.value)
                }
              />
            </FieldStack>
          </Grid>
        </Section>

        {/* BEHAVIOR */}
        <Section title={assistantCopy.general.sections.behavior}>
          <Grid>
            <ToggleField
              id="streaming-enabled"
              label={assistantCopy.general.fields.streamingEnabled}
              checked={state.streaming_enabled}
              onChange={(v) => setField("streaming_enabled", v)}
            />
            <FieldStack>
              <Label>{assistantCopy.general.fields.defaultLocale}</Label>
              <Input
                value={state.default_locale}
                onChange={(e) =>
                  setField("default_locale", e.currentTarget.value)
                }
              />
            </FieldStack>
          </Grid>
        </Section>

        {/* ALLOWED MODELS */}
        <Section title={assistantCopy.general.sections.allowedModels}>
          <FieldStack>
            <Label>{assistantCopy.general.fields.allowedModels}</Label>
            <Textarea
              rows={4}
              value={state.allowed_models_text}
              onChange={(e) =>
                setField("allowed_models_text", e.currentTarget.value)
              }
            />
            <Text size="xsmall" className="text-ui-fg-muted">
              {assistantCopy.general.fields.allowedModelsHint}
            </Text>
          </FieldStack>
        </Section>

        {/* TOOLS */}
        <Section title={assistantCopy.general.sections.tools}>
          <Grid>
            {Object.entries(state.tools_enabled).map(([key, enabled]) => (
              <ToggleField
                key={`tool-${key}`}
                id={`tool-${key}`}
                label={key}
                checked={enabled}
                onChange={(v) => setToolEnabled(key, v)}
              />
            ))}
          </Grid>
        </Section>

        {/* GUARDRAILS */}
        <Section title={assistantCopy.general.sections.guardrails}>
          <Grid>
            {Object.entries(state.guardrails).map(([key, enabled]) => (
              <ToggleField
                key={`guard-${key}`}
                id={`guard-${key}`}
                label={key}
                checked={enabled}
                onChange={(v) => setGuardrail(key, v)}
              />
            ))}
          </Grid>
        </Section>

        {/* RATE LIMITS */}
        <Section title={assistantCopy.general.sections.rateLimits}>
          <Grid>
            {Object.entries(state.rate_limits).map(([key, value]) => (
              <FieldStack key={`rate-${key}`}>
                <Label>{key}</Label>
                <Input
                  type="number"
                  min={0}
                  value={value}
                  onChange={(e) =>
                    setRateLimit(key, e.currentTarget.value)
                  }
                />
              </FieldStack>
            ))}
          </Grid>
        </Section>

        {/* OBSERVABILITY */}
        <Section title={assistantCopy.general.sections.observability}>
          <Grid>
            {Object.entries(state.observability).map(([key, enabled]) => (
              <ToggleField
                key={`obs-${key}`}
                id={`obs-${key}`}
                label={key}
                checked={enabled}
                onChange={(v) => setObservability(key, v)}
              />
            ))}
          </Grid>
        </Section>

        {/* MISC */}
        <Section title={assistantCopy.general.sections.misc}>
          <Grid>
            <ToggleField
              id="usage-tracking-enabled"
              label={assistantCopy.general.fields.usageTrackingEnabled}
              checked={state.usage_tracking_enabled}
              onChange={(v) => setField("usage_tracking_enabled", v)}
            />
          </Grid>
        </Section>

        <div className="flex justify-end gap-2 border-t border-ui-border-base pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleRevert}
            disabled={!isDirty || updateMut.isPending}
          >
            {assistantCopy.general.actions.revert}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!isDirty || updateMut.isPending}
            isLoading={updateMut.isPending}
          >
            {assistantCopy.general.actions.save}
          </Button>
        </div>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

const Section = ({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) => (
  <section className="flex flex-col gap-3 rounded-lg border border-ui-border-base bg-ui-bg-base p-5">
    <Heading level="h3">{title}</Heading>
    {children}
  </section>
)

const Grid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{children}</div>
)

const FieldStack = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">{children}</div>
)

const ToggleField = ({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) => (
  <div className="flex items-center justify-between gap-3 rounded-md border border-ui-border-base p-3">
    <Label htmlFor={id}>{label}</Label>
    <Switch id={id} checked={checked} onCheckedChange={onChange} />
  </div>
)

export default GeneralTab
