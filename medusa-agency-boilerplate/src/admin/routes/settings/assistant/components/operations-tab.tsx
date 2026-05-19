import {
  Alert,
  Button,
  Heading,
  Input,
  Label,
  Select,
  Skeleton,
  StatusBadge,
  Table,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import type { ChangeEvent, ReactNode } from "react"

import {
  getAssistantJob,
  getAssistantStats,
  getRuntime,
  listReindexIntents,
  processReindexQueue,
  queueFullCatalogReindex,
  queueSelectedProductsReindex,
  createKnowledgeDocument,
  reindexVectors,
  syncKnowledgeMarkdown,
} from "../lib/api"
import { assistantCopy } from "../lib/copy"
import { mapAssistantError } from "../lib/error-mapping"
import { formatTimestamp } from "../lib/helpers"
import { assistantKeys } from "../lib/query-keys"
import type { AssistantReindexIntent } from "../lib/types"

type IntentStatusFilter = "all" | "pending" | "processing" | "completed" | "error"
type VectorSourceType = "all" | "markdown" | "medusa_product"

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

function parseProductIds(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\s,]+/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  )
}

function formatIntentProducts(intent: AssistantReindexIntent): string {
  if (!intent.product_ids.length) {
    return assistantCopy.common.none
  }
  if (intent.product_ids.length <= 2) {
    return intent.product_ids.join(", ")
  }
  return `${intent.product_ids.slice(0, 2).join(", ")} +${intent.product_ids.length - 2}`
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2)
  } catch {
    return assistantCopy.common.none
  }
}

function statusColor(
  status: string | null | undefined,
): "green" | "orange" | "red" | "grey" | "blue" {
  switch ((status || "").toLowerCase()) {
    case "ok":
    case "completed":
      return "green"
    case "processing":
      return "blue"
    case "pending":
    case "degraded":
      return "orange"
    case "disabled":
      return "grey"
    case "error":
      return "red"
    default:
      return "grey"
  }
}

function numericStat(stats: Record<string, number> | undefined, key: string): string {
  const value = stats?.[key]
  return typeof value === "number" ? value.toLocaleString("ru-RU") : assistantCopy.common.none
}

function deriveKnowledgeTitleFromFileName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const RuntimeCard = ({
  title,
  label,
  tone,
  subtitle,
  extra,
}: {
  title: string
  label: string
  tone: "green" | "orange" | "red" | "grey" | "blue"
  subtitle?: string
  extra?: string
}) => (
  <div className="flex min-w-[220px] flex-1 flex-col gap-2 rounded-lg border border-ui-border-base bg-ui-bg-base p-4">
    <div className="flex items-center justify-between gap-3">
      <Text size="small" className="text-ui-fg-subtle">
        {title}
      </Text>
      <StatusBadge color={tone}>{label}</StatusBadge>
    </div>
      <Text className="text-sm font-medium">{subtitle || assistantCopy.common.none}</Text>
    {extra ? (
      <Text size="small" className="text-ui-fg-subtle whitespace-pre-wrap">
        {extra}
      </Text>
    ) : null}
  </div>
)

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
  <div className="flex min-w-[180px] flex-1 flex-col gap-2">{children}</div>
)

const Grid = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div>
)

export const OperationsTab = () => {
  const queryClient = useQueryClient()
  const copy = assistantCopy.operations

  const [storeId, setStoreId] = useState("default")
  const [locale, setLocale] = useState("ru")
  const [regionId, setRegionId] = useState("")
  const [currencyCode, setCurrencyCode] = useState("")
  const [productIdsText, setProductIdsText] = useState("")
  const [queueLimit, setQueueLimit] = useState("10")
  const [queueBackoff, setQueueBackoff] = useState("60")
  const [intentStatus, setIntentStatus] = useState<IntentStatusFilter>("all")
  const [vectorSourceType, setVectorSourceType] = useState<VectorSourceType>("all")
  const [knowledgeTitle, setKnowledgeTitle] = useState("")
  const [knowledgeDescription, setKnowledgeDescription] = useState("")
  const [knowledgeContent, setKnowledgeContent] = useState("")
  const [knowledgeFileName, setKnowledgeFileName] = useState("")
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  const runtimeQuery = useQuery({
    queryKey: assistantKeys.runtime(),
    queryFn: async () => {
      const result = await getRuntime()
      if (!result.ok) throw result
      return result.data.runtime
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const adapterReady = runtimeQuery.data?.capabilities.assistant_backend_proxy ?? false

  const statsQuery = useQuery({
    queryKey: assistantKeys.stats(),
    queryFn: async () => {
      const result = await getAssistantStats()
      if (!result.ok) throw result
      return result.data.stats
    },
    enabled: adapterReady,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  })

  const intentsQuery = useQuery({
    queryKey: assistantKeys.intents({ status: intentStatus, limit: 20 }),
    queryFn: async () => {
      const result = await listReindexIntents({
        status: intentStatus,
        limit: 20,
      })
      if (!result.ok) throw result
      return result.data.result
    },
    enabled: adapterReady,
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  })

  const jobQuery = useQuery({
    queryKey: assistantKeys.job(selectedJobId || "none"),
    queryFn: async () => {
      if (!selectedJobId) {
        return null
      }
      const result = await getAssistantJob(selectedJobId)
      if (!result.ok) throw result
      return result.data.job
    },
    enabled: adapterReady && Boolean(selectedJobId),
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  })

  const invalidateOps = () =>
    queryClient.invalidateQueries({ queryKey: assistantKeys.all })

  const fullReindexMut = useMutation({
    mutationFn: async () => {
      const result = await queueFullCatalogReindex({
        store_id: storeId.trim() || "default",
        locale: locale.trim() || "ru",
        region_id: regionId.trim() || undefined,
        currency_code: currencyCode.trim() || undefined,
      })
      if (!result.ok) throw result
      return result.data
    },
    onSuccess: () => {
      toast.success(copy.toasts.fullQueued)
      invalidateOps()
    },
    onError: (err) => toast.error(errorTextOf(err)),
  })

  const selectedReindexMut = useMutation({
    mutationFn: async () => {
      const productIds = parseProductIds(productIdsText)
      if (productIds.length === 0) {
        throw {
          error: "AI_ASSISTANT_PRODUCT_IDS_REQUIRED",
          status: 400,
          message: copy.errors.productIdsRequired,
        }
      }
      const result = await queueSelectedProductsReindex({
        product_ids: productIds,
        store_id: storeId.trim() || "default",
        locale: locale.trim() || "ru",
        region_id: regionId.trim() || undefined,
        currency_code: currencyCode.trim() || undefined,
      })
      if (!result.ok) throw result
      return { response: result.data, productCount: productIds.length }
    },
    onSuccess: ({ productCount }) => {
      toast.success(copy.toasts.selectedQueued(productCount))
      invalidateOps()
    },
    onError: (err) => toast.error(errorTextOf(err)),
  })

  const processQueueMut = useMutation({
    mutationFn: async () => {
      const result = await processReindexQueue({
        limit: Math.max(1, Number(queueLimit) || 10),
        retry_backoff_seconds: Math.max(1, Number(queueBackoff) || 60),
      })
      if (!result.ok) throw result
      return result.data
    },
    onSuccess: (data) => {
      toast.success(copy.toasts.queueProcessed(data.result.claimed))
      const firstJobId = data.result.processed
        .map((item) => item.assistant_job_id)
        .find((item): item is string => typeof item === "string" && item.length > 0)
      if (firstJobId) {
        setSelectedJobId(firstJobId)
      }
      invalidateOps()
    },
    onError: (err) => toast.error(errorTextOf(err)),
  })

  const markdownMut = useMutation({
    mutationFn: async () => {
      const result = await syncKnowledgeMarkdown({
        store_id: storeId.trim() || "default",
        locale: locale.trim() || "ru",
      })
      if (!result.ok) throw result
      return result.data
    },
    onSuccess: () => {
      toast.success(copy.toasts.markdownSynced)
      invalidateOps()
    },
    onError: (err) => toast.error(errorTextOf(err)),
  })

  const knowledgeDocumentMut = useMutation({
    mutationFn: async () => {
      const title = knowledgeTitle.trim()
      const description = knowledgeDescription.trim()
      if (!title) {
        throw {
          error: "AI_ASSISTANT_KNOWLEDGE_TITLE_REQUIRED",
          status: 400,
          message: copy.errors.knowledgeTitleRequired,
        }
      }
      if (!description) {
        throw {
          error: "AI_ASSISTANT_KNOWLEDGE_DESCRIPTION_REQUIRED",
          status: 400,
          message: copy.errors.knowledgeDescriptionRequired,
        }
      }
      if (!knowledgeContent.trim()) {
        throw {
          error: "AI_ASSISTANT_KNOWLEDGE_CONTENT_REQUIRED",
          status: 400,
          message: copy.errors.knowledgeContentRequired,
        }
      }
      const result = await createKnowledgeDocument({
        store_id: storeId.trim() || "default",
        locale: locale.trim() || "ru",
        title,
        description,
        content: knowledgeContent,
        file_name: knowledgeFileName.trim() || undefined,
      })
      if (!result.ok) throw result
      return result.data.result
    },
    onSuccess: (data) => {
      toast.success(copy.toasts.knowledgeDocumentSaved(data.document.path))
      setSelectedJobId(data.job.job_id)
      setKnowledgeTitle("")
      setKnowledgeDescription("")
      setKnowledgeContent("")
      setKnowledgeFileName("")
      invalidateOps()
    },
    onError: (err) => toast.error(errorTextOf(err)),
  })

  const vectorMut = useMutation({
    mutationFn: async () => {
      const result = await reindexVectors({
        store_id: storeId.trim() || "default",
        locale: locale.trim() || "ru",
        source_type:
          vectorSourceType === "all" ? undefined : vectorSourceType,
      })
      if (!result.ok) throw result
      return result.data
    },
    onSuccess: () => {
      toast.success(copy.toasts.vectorSynced)
      invalidateOps()
    },
    onError: (err) => toast.error(errorTextOf(err)),
  })

  const runtimeMissingKeys = useMemo(
    () => runtimeQuery.data?.adapter.missing.join("\n") || "",
    [runtimeQuery.data],
  )

  const resetKnowledgeDocumentForm = () => {
    setKnowledgeTitle("")
    setKnowledgeDescription("")
    setKnowledgeContent("")
    setKnowledgeFileName("")
  }

  const handleKnowledgeFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.currentTarget.files?.[0]
    if (!file) {
      setKnowledgeFileName("")
      return
    }
    try {
      const text = await file.text()
      setKnowledgeContent(text)
      setKnowledgeFileName(file.name)
      if (!knowledgeTitle.trim()) {
        setKnowledgeTitle(deriveKnowledgeTitleFromFileName(file.name))
      }
    } catch {
      toast.error(copy.errors.knowledgeFileRead)
    }
  }

  if (runtimeQuery.isLoading) {
    return (
      <div className="flex flex-col gap-3 px-6 py-5">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    )
  }

  if (runtimeQuery.isError) {
    return (
      <div className="px-6 py-5">
        <Alert variant="error">
          <span>{copy.errors.runtime}</span>
          <Button
            type="button"
            size="small"
            variant="secondary"
            onClick={() => runtimeQuery.refetch()}
          >
            {assistantCopy.common.retry}
          </Button>
        </Alert>
      </div>
    )
  }

  const runtime = runtimeQuery.data!
  const stats = statsQuery.data
  const intents = intentsQuery.data?.intents ?? []
  const intentStats = intentsQuery.data?.stats ?? {}
  const componentEntries = stats ? Object.entries(stats.components || {}) : []

  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      <div className="flex flex-col gap-1">
        <Heading level="h2">{copy.heading}</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          {copy.subheading}
        </Text>
      </div>

      <Section title={copy.runtime.heading} subtitle={copy.runtime.subheading}>
        <div className="flex flex-wrap gap-4">
          <RuntimeCard
            title={copy.runtime.cards.adapter}
            label={
              runtime.adapter.enabled ? copy.runtime.configured : copy.runtime.missing
            }
            tone={runtime.adapter.enabled ? "green" : "red"}
            subtitle={`timeout ${runtime.adapter.timeout_ms} ms`}
            extra={runtimeMissingKeys ? `${copy.runtime.missingKeys}\n${runtimeMissingKeys}` : undefined}
          />
          <RuntimeCard
            title={copy.runtime.cards.encryption}
            label={
              runtime.secrets.assistant_settings_encryption_key_configured
                ? copy.runtime.configured
                : copy.runtime.missing
            }
            tone={
              runtime.secrets.assistant_settings_encryption_key_configured
                ? "green"
                : "red"
            }
            subtitle={
              runtime.secrets.assistant_settings_encryption_key_configured
                ? assistantCopy.providers.addCta
                : assistantCopy.providers.encryptionWarning
            }
          />
          <RuntimeCard
            title={copy.runtime.cards.service}
            label={
              stats?.status
                ? stats.status === "ok"
                  ? copy.runtime.ok
                  : stats.status === "degraded"
                    ? copy.runtime.degraded
                    : stats.status
                : runtime.adapter.enabled
                  ? assistantCopy.common.loading
                  : copy.runtime.disabled
            }
            tone={
              stats?.status
                ? statusColor(stats.status)
                : runtime.adapter.enabled
                  ? "grey"
                  : "grey"
            }
            subtitle={runtime.adapter.enabled ? "assistant backend proxy" : copy.runtime.disabled}
          />
          <RuntimeCard
            title={copy.runtime.cards.retrieval}
            label={stats?.retrieval_mode || assistantCopy.common.none}
            tone="grey"
            subtitle={stats ? `service status: ${stats.status}` : assistantCopy.common.none}
          />
        </div>
      </Section>

      {!runtime.adapter.enabled ? (
        <Alert variant="error">
          <span>{runtimeMissingKeys ? `${copy.runtime.missingKeys} ${runtime.adapter.missing.join(", ")}` : copy.runtime.disabled}</span>
        </Alert>
      ) : null}

      <Section title={copy.catalog.heading} subtitle={copy.catalog.subheading}>
        <Grid>
          <FieldStack>
            <Label>{copy.catalog.storeId}</Label>
            <Input value={storeId} onChange={(e) => setStoreId(e.currentTarget.value)} />
          </FieldStack>
          <FieldStack>
            <Label>{copy.catalog.locale}</Label>
            <Input value={locale} onChange={(e) => setLocale(e.currentTarget.value)} />
          </FieldStack>
          <FieldStack>
            <Label>{copy.catalog.regionId}</Label>
            <Input
              value={regionId}
              onChange={(e) => setRegionId(e.currentTarget.value)}
              placeholder={assistantCopy.common.optional}
            />
          </FieldStack>
          <FieldStack>
            <Label>{copy.catalog.currencyCode}</Label>
            <Input
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.currentTarget.value)}
              placeholder={assistantCopy.common.optional}
            />
          </FieldStack>
        </Grid>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="primary"
            onClick={() => fullReindexMut.mutate()}
            disabled={!runtime.capabilities.catalog_reindex}
            isLoading={fullReindexMut.isPending}
          >
            {copy.catalog.fullReindexCta}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => processQueueMut.mutate()}
            disabled={!runtime.capabilities.queue_processing}
            isLoading={processQueueMut.isPending}
          >
            {copy.catalog.processQueueCta}
          </Button>
        </div>

        <FieldStack>
          <Label>{copy.catalog.productIds}</Label>
          <Textarea
            rows={4}
            value={productIdsText}
            onChange={(e) => setProductIdsText(e.currentTarget.value)}
            placeholder={copy.catalog.productIdsPlaceholder}
          />
          <Text size="small" className="text-ui-fg-subtle">
            {copy.catalog.productIdsHint}
          </Text>
        </FieldStack>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => selectedReindexMut.mutate()}
            disabled={!runtime.capabilities.catalog_reindex}
            isLoading={selectedReindexMut.isPending}
          >
            {copy.catalog.selectedReindexCta}
          </Button>
        </div>

        <Grid>
          <FieldStack>
            <Label>{copy.catalog.processLimit}</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={queueLimit}
              onChange={(e) => setQueueLimit(e.currentTarget.value)}
            />
          </FieldStack>
          <FieldStack>
            <Label>{copy.catalog.processBackoff}</Label>
            <Input
              type="number"
              min={1}
              max={3600}
              value={queueBackoff}
              onChange={(e) => setQueueBackoff(e.currentTarget.value)}
            />
          </FieldStack>
        </Grid>
      </Section>

      <Section title={copy.knowledge.heading} subtitle={copy.knowledge.subheading}>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <Heading level="h3">{copy.knowledge.documentHeading}</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              {copy.knowledge.documentSubheading}
            </Text>
          </div>

          <Grid>
            <FieldStack>
              <Label>{copy.knowledge.documentTitle}</Label>
              <Input
                value={knowledgeTitle}
                onChange={(e) => setKnowledgeTitle(e.currentTarget.value)}
                placeholder={copy.knowledge.documentTitlePlaceholder}
              />
            </FieldStack>
            <FieldStack>
              <Label>{copy.knowledge.documentDescription}</Label>
              <Textarea
                rows={4}
                value={knowledgeDescription}
                onChange={(e) => setKnowledgeDescription(e.currentTarget.value)}
                placeholder={copy.knowledge.documentDescriptionPlaceholder}
              />
            </FieldStack>
          </Grid>

          <FieldStack>
            <Label>{copy.knowledge.documentFile}</Label>
            <input
              type="file"
              accept=".md,.markdown,text/markdown"
              onChange={handleKnowledgeFileChange}
              className="block w-full text-sm"
            />
            <Text size="small" className="text-ui-fg-subtle">
              {copy.knowledge.documentFileHint}
            </Text>
            {knowledgeFileName ? (
              <Text size="small" className="text-ui-fg-subtle">
                {copy.knowledge.documentSelectedFile(knowledgeFileName)}
              </Text>
            ) : null}
          </FieldStack>

          <FieldStack>
            <Label>{copy.knowledge.documentContent}</Label>
            <Textarea
              rows={12}
              value={knowledgeContent}
              onChange={(e) => setKnowledgeContent(e.currentTarget.value)}
              placeholder={copy.knowledge.documentContentPlaceholder}
            />
            <Text size="small" className="text-ui-fg-subtle">
              {copy.knowledge.documentContentHint}
            </Text>
            <Text size="xsmall" className="text-ui-fg-muted">
              {copy.knowledge.documentAutoFrontmatterHint}
            </Text>
          </FieldStack>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="primary"
              onClick={() => knowledgeDocumentMut.mutate()}
              disabled={!runtime.capabilities.markdown_sync}
              isLoading={knowledgeDocumentMut.isPending}
            >
              {copy.knowledge.documentSaveCta}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={resetKnowledgeDocumentForm}
              disabled={knowledgeDocumentMut.isPending}
            >
              {copy.knowledge.documentClearCta}
            </Button>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => markdownMut.mutate()}
              disabled={!runtime.capabilities.markdown_sync}
              isLoading={markdownMut.isPending}
            >
              {copy.knowledge.markdownSyncCta}
            </Button>
            <FieldStack>
              <Label>{copy.knowledge.vectorSourceType}</Label>
              <Select
                value={vectorSourceType}
                onValueChange={(value) => setVectorSourceType(value as VectorSourceType)}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all">
                    {copy.knowledge.vectorSourceTypeAll}
                  </Select.Item>
                  <Select.Item value="markdown">
                    {copy.knowledge.vectorSourceTypeMarkdown}
                  </Select.Item>
                  <Select.Item value="medusa_product">
                    {copy.knowledge.vectorSourceTypeProducts}
                  </Select.Item>
                </Select.Content>
              </Select>
            </FieldStack>
            <div className="flex items-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => vectorMut.mutate()}
                disabled={!runtime.capabilities.vector_reindex}
                isLoading={vectorMut.isPending}
              >
                {copy.knowledge.vectorSyncCta}
              </Button>
            </div>
          </div>
        </div>
      </Section>

      <Section title={copy.stats.heading} subtitle={copy.stats.subheading}>
        {!runtime.adapter.enabled ? (
          <Text className="text-ui-fg-subtle">{copy.stats.noStats}</Text>
        ) : statsQuery.isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : statsQuery.isError ? (
          <Alert variant="error">
            <span>{copy.errors.stats}</span>
            <Button
              type="button"
              size="small"
              variant="secondary"
              onClick={() => statsQuery.refetch()}
            >
              {assistantCopy.common.retry}
            </Button>
          </Alert>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
              <RuntimeCard
                title={copy.stats.documentCount}
                label={numericStat(stats?.stats, "document_count")}
                tone="grey"
              />
              <RuntimeCard
                title={copy.stats.chunkCount}
                label={numericStat(stats?.stats, "chunk_count")}
                tone="grey"
              />
              <RuntimeCard
                title={copy.stats.indexedProducts}
                label={numericStat(stats?.stats, "indexed_product_count")}
                tone="grey"
              />
              <RuntimeCard
                title={copy.stats.messages}
                label={numericStat(stats?.stats, "message_count")}
                tone="grey"
              />
              <RuntimeCard
                title={copy.stats.pendingIntents}
                label={numericStat(stats?.stats, "reindex_intents_pending")}
                tone="grey"
              />
              <RuntimeCard
                title={copy.stats.errorIntents}
                label={numericStat(stats?.stats, "reindex_intents_error")}
                tone="grey"
              />
            </div>
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Component</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Detail</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {componentEntries.map(([name, value]) => (
                  <Table.Row key={name}>
                    <Table.Cell>{name}</Table.Cell>
                    <Table.Cell>
                      <StatusBadge color={statusColor(String(value?.status || "disabled"))}>
                        {String(value?.status || "disabled")}
                      </StatusBadge>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-ui-fg-subtle text-xs">
                        {String(value?.detail || value?.error || value?.status_code || assistantCopy.common.none)}
                      </span>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </>
        )}
      </Section>

      <Section title={copy.intents.heading} subtitle={copy.intents.subheading}>
        <div className="flex flex-wrap items-end gap-3">
          <FieldStack>
            <Label>Status</Label>
            <Select
              value={intentStatus}
              onValueChange={(value) => setIntentStatus(value as IntentStatusFilter)}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">{copy.intents.filters.all}</Select.Item>
                <Select.Item value="pending">{copy.intents.filters.pending}</Select.Item>
                <Select.Item value="processing">{copy.intents.filters.processing}</Select.Item>
                <Select.Item value="completed">{copy.intents.filters.completed}</Select.Item>
                <Select.Item value="error">{copy.intents.filters.error}</Select.Item>
              </Select.Content>
            </Select>
          </FieldStack>
          <div className="flex items-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => intentsQuery.refetch()}
              disabled={!runtime.capabilities.queue_processing || intentsQuery.isFetching}
            >
              {copy.intents.refreshCta}
            </Button>
          </div>
          <div className="ml-auto flex gap-2 text-xs text-ui-fg-subtle">
            {Object.entries(intentStats).map(([key, value]) => (
              <span key={key}>{`${key}: ${value}`}</span>
            ))}
          </div>
        </div>

        {!runtime.adapter.enabled ? null : intentsQuery.isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-12 w-full" />
            ))}
          </div>
        ) : intentsQuery.isError ? (
          <Alert variant="error">
            <span>{copy.errors.intents}</span>
            <Button
              type="button"
              size="small"
              variant="secondary"
              onClick={() => intentsQuery.refetch()}
            >
              {assistantCopy.common.retry}
            </Button>
          </Alert>
        ) : intents.length === 0 ? (
          <Text className="text-ui-fg-subtle">{copy.intents.empty}</Text>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{copy.intents.columns.event}</Table.HeaderCell>
                <Table.HeaderCell>{copy.intents.columns.scope}</Table.HeaderCell>
                <Table.HeaderCell>{copy.intents.columns.products}</Table.HeaderCell>
                <Table.HeaderCell>{copy.intents.columns.status}</Table.HeaderCell>
                <Table.HeaderCell>{copy.intents.columns.attempts}</Table.HeaderCell>
                <Table.HeaderCell>{copy.intents.columns.updated}</Table.HeaderCell>
                <Table.HeaderCell>{copy.intents.columns.job}</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {intents.map((intent) => (
                <Table.Row key={intent.id}>
                  <Table.Cell>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">{intent.event_name}</span>
                      <span className="text-ui-fg-subtle text-xs">{intent.reason || assistantCopy.common.none}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>{intent.scope}</Table.Cell>
                  <Table.Cell>{formatIntentProducts(intent)}</Table.Cell>
                  <Table.Cell>
                    <StatusBadge color={statusColor(intent.status)}>{intent.status}</StatusBadge>
                  </Table.Cell>
                  <Table.Cell>{`${intent.attempts}/${intent.max_attempts}`}</Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col gap-1 text-xs text-ui-fg-subtle">
                      <span>{formatTimestamp(intent.updated_at)}</span>
                      {intent.last_error ? <span>{intent.last_error}</span> : null}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {intent.assistant_job_id ? (
                      <Button
                        type="button"
                        size="small"
                        variant="secondary"
                        onClick={() => {
                          setSelectedJobId(intent.assistant_job_id)
                          toast.success(copy.toasts.jobLoaded)
                        }}
                      >
                        {copy.intents.inspectJobCta}
                      </Button>
                    ) : (
                      copy.intents.noJob
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </Section>

      <Section title={copy.job.heading} subtitle={selectedJobId || copy.job.empty}>
        {!selectedJobId ? (
          <Text className="text-ui-fg-subtle">{copy.job.empty}</Text>
        ) : jobQuery.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : jobQuery.isError ? (
          <Alert variant="error">
            <span>{errorTextOf(jobQuery.error)}</span>
            <Button
              type="button"
              size="small"
              variant="secondary"
              onClick={() => jobQuery.refetch()}
            >
              {assistantCopy.common.retry}
            </Button>
          </Alert>
        ) : jobQuery.data ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <FieldStack>
                <Label>{copy.job.status}</Label>
                <StatusBadge color={statusColor(String(jobQuery.data.status || "unknown"))}>
                  {String(jobQuery.data.status || assistantCopy.common.none)}
                </StatusBadge>
              </FieldStack>
              <FieldStack>
                <Label>{copy.job.source}</Label>
                <Text>{String(jobQuery.data.source_type || jobQuery.data.source_id || assistantCopy.common.none)}</Text>
              </FieldStack>
              <FieldStack>
                <Label>{copy.job.createdAt}</Label>
                <Text>{formatTimestamp(typeof jobQuery.data.created_at === "string" ? jobQuery.data.created_at : null)}</Text>
              </FieldStack>
              <FieldStack>
                <Label>{copy.job.error}</Label>
                <Text>{String(jobQuery.data.error || assistantCopy.common.none)}</Text>
              </FieldStack>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{copy.job.result}</Label>
              <pre className="overflow-x-auto rounded-md border border-ui-border-base bg-ui-bg-subtle p-4 text-xs">
                {safeJson(jobQuery.data.result || jobQuery.data)}
              </pre>
            </div>
          </div>
        ) : (
          <Text className="text-ui-fg-subtle">{copy.job.empty}</Text>
        )}
      </Section>
    </div>
  )
}

export default OperationsTab
