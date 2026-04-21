import { defineRouteConfig } from "@medusajs/admin-sdk"
import { HandTruck } from "@medusajs/icons"
import { Button, Container, Heading, Input, Label, Switch, Text } from "@medusajs/ui"
import { useEffect, useMemo, useState } from "react"

type DeliveryProviderDefinition = {
  code: string
  label: string
  capabilities: string[]
  supported_mode_codes: string[]
}

type DeliveryConnection = {
  id: string
  provider_code: string
  name: string
  status: "draft" | "active" | "error" | "disabled"
  mode: "test" | "live"
  enabled: boolean
  country_code: string
  credentials_state: "empty" | "sealed" | "disabled" | "invalid"
  credentials_fingerprint: string | null
  credentials_last_validated_at: string | null
  credentials_last_error_code: string | null
  credentials_present: boolean
  config: Record<string, unknown>
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

type DeliveryConfig = {
  auto_confirm?: boolean
  label_format?: string
  default_warehouse_id?: string
}

type DeliveryConnectionForm = {
  provider_code: string
  name: string
  mode: "test" | "live"
  enabled: boolean
  country_code: string
  token: string
  auto_confirm: boolean
  label_format: string
  default_warehouse_id: string
}

type DeliveryTestConnectionResult = {
  ok: boolean
  provider_code: string
  diagnostics: Record<string, unknown>
}

type DeliveryQuote = {
  carrier_code: string
  carrier_label: string
  mode_code: string
  quote_key: string
  amount: number
  currency_code: string
  delivery_eta_min: number | null
  delivery_eta_max: number | null
  pickup_point_required: boolean
  pickup_point_ids: string[]
  pickup_points_embedded: unknown[]
  pickup_window_required: boolean
  pickup_window_options: unknown[]
  raw_reference: Record<string, unknown>
}

type DeliveryTestQuoteResponse = {
  ok: boolean
  connection: DeliveryConnection
  quotes: DeliveryQuote[]
  correlation_id: string
}

type DeliveryEventLog = {
  id: string
  connection_id: string | null
  provider_code: string
  kind: string
  correlation_id: string
  success: boolean
  request_summary: Record<string, unknown>
  response_summary: Record<string, unknown>
  error_code: string | null
  created_at: string
}

type DeliveryTestQuoteForm = {
  connection_id: string
  mode_code: "warehouse_to_pickup_point" | "dropoff_point_to_pickup_point"
  destination_point_id: string
  origin_point_id: string
  warehouse_id: string
  currency_code: string
  interval_from: string
  interval_to: string
  item_quantity: string
  item_weight_grams: string
  item_price: string
}

type ApiErrorPayload = {
  status: number
  code: string
  message: string
  details: unknown
}

const defaultConnectionForm: DeliveryConnectionForm = {
  provider_code: "yandex",
  name: "",
  mode: "test",
  enabled: false,
  country_code: "RU",
  token: "",
  auto_confirm: false,
  label_format: "",
  default_warehouse_id: "",
}

const defaultTestQuoteForm: DeliveryTestQuoteForm = {
  connection_id: "",
  mode_code: "warehouse_to_pickup_point",
  destination_point_id: "",
  origin_point_id: "",
  warehouse_id: "",
  currency_code: "RUB",
  interval_from: "",
  interval_to: "",
  item_quantity: "1",
  item_weight_grams: "500",
  item_price: "0",
}

const capabilityLabels: Record<string, string> = {
  test_connection: "Test connection",
  list_pickup_points: "List pickup points",
  list_pickup_windows: "List pickup windows",
  quote_warehouse_to_pickup_point: "Quote warehouse → pickup point",
  quote_dropoff_point_to_pickup_point: "Quote dropoff point → pickup point",
}

const modeLabels: Record<string, string> = {
  warehouse_to_pickup_point: "warehouse_to_pickup_point",
  dropoff_point_to_pickup_point: "dropoff_point_to_pickup_point",
}

const labelFormatOptions = ["", "pdf", "zpl"]

const formatTimestamp = (value: string | null) => {
  if (!value) {
    return "—"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

const normalizeConfig = (form: DeliveryConnectionForm): DeliveryConfig => {
  const nextConfig: DeliveryConfig = {}

  if (form.auto_confirm) {
    nextConfig.auto_confirm = true
  }

  if (form.label_format.trim()) {
    nextConfig.label_format = form.label_format.trim()
  }

  if (form.default_warehouse_id.trim()) {
    nextConfig.default_warehouse_id = form.default_warehouse_id.trim()
  }

  return nextConfig
}

const connectionToForm = (connection: DeliveryConnection): DeliveryConnectionForm => {
  const config = connection.config as DeliveryConfig

  return {
    provider_code: connection.provider_code,
    name: connection.name,
    mode: connection.mode,
    enabled: connection.enabled,
    country_code: connection.country_code,
    token: "",
    auto_confirm: !!config.auto_confirm,
    label_format:
      typeof config.label_format === "string" && config.label_format.trim()
        ? config.label_format
        : "",
    default_warehouse_id:
      typeof config.default_warehouse_id === "string" && config.default_warehouse_id.trim()
        ? config.default_warehouse_id
        : "",
  }
}

const getApiError = async (response: Response): Promise<ApiErrorPayload> => {
  let payload: unknown = null

  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  const structured = payload as {
    error?: { code?: string; message?: string; details?: unknown }
  } | null

  return {
    status: response.status,
    code: structured?.error?.code || `HTTP_${response.status}`,
    message: structured?.error?.message || `HTTP ${response.status}`,
    details: structured?.error?.details ?? null,
  }
}

const requestJson = async <T,>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    credentials: "include",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  })

  if (!response.ok) {
    throw await getApiError(response)
  }

  return (await response.json()) as T
}

const statusToneClass = (value: string) => {
  if (value === "active" || value === "sealed") {
    return "border-green-200 bg-green-50 text-green-700"
  }

  if (value === "error" || value === "invalid") {
    return "border-red-200 bg-red-50 text-red-700"
  }

  if (value === "disabled") {
    return "border-amber-200 bg-amber-50 text-amber-700"
  }

  return "border-ui-border-base bg-ui-bg-subtle text-ui-fg-subtle"
}

const logSuccessToneClass = (success: boolean) => {
  return success
    ? "border-green-200 bg-green-50 text-green-700"
    : "border-red-200 bg-red-50 text-red-700"
}

const DeliverySettingsPage = () => {
  const [providers, setProviders] = useState<DeliveryProviderDefinition[]>([])
  const [connections, setConnections] = useState<DeliveryConnection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null)
  const [connectionForm, setConnectionForm] = useState<DeliveryConnectionForm>(defaultConnectionForm)
  const [formNotice, setFormNotice] = useState<string | null>(null)
  const [pageError, setPageError] = useState<ApiErrorPayload | null>(null)
  const [formError, setFormError] = useState<ApiErrorPayload | null>(null)
  const [testConnectionResult, setTestConnectionResult] =
    useState<DeliveryTestConnectionResult | null>(null)
  const [testConnectionError, setTestConnectionError] = useState<ApiErrorPayload | null>(null)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [includePickupPoints, setIncludePickupPoints] = useState(true)
  const [testQuoteForm, setTestQuoteForm] = useState<DeliveryTestQuoteForm>(defaultTestQuoteForm)
  const [testQuoteResult, setTestQuoteResult] = useState<DeliveryTestQuoteResponse | null>(null)
  const [testQuoteError, setTestQuoteError] = useState<ApiErrorPayload | null>(null)
  const [isTestingQuote, setIsTestingQuote] = useState(false)
  const [eventLogs, setEventLogs] = useState<DeliveryEventLog[]>([])

  const activeConnection = useMemo(() => {
    if (!activeConnectionId) {
      return null
    }

    return connections.find((connection) => connection.id === activeConnectionId) || null
  }, [activeConnectionId, connections])

  const yandexProvider = useMemo(
    () => providers.find((provider) => provider.code === "yandex") || null,
    [providers]
  )

  const observedEncryptionDisabled = useMemo(() => {
    return (
      connections.some((connection) => connection.credentials_state === "disabled") ||
      activeConnection?.credentials_state === "disabled" ||
      formError?.code === "DELIVERY_HUB_ENCRYPTION_DISABLED" ||
      testConnectionError?.code === "DELIVERY_HUB_ENCRYPTION_DISABLED"
    )
  }, [activeConnection, connections, formError, testConnectionError])

  const yandexConnections = useMemo(
    () => connections.filter((connection) => connection.provider_code === "yandex"),
    [connections]
  )

  const filteredEventLogs = useMemo(() => {
    if (!activeConnectionId) {
      return eventLogs
    }

    return eventLogs.filter((log) => log.connection_id === activeConnectionId)
  }, [activeConnectionId, eventLogs])

  const loadData = async (silent = false) => {
    if (silent) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      const [providersPayload, connectionsPayload, logsPayload] = await Promise.all([
        requestJson<{ providers: DeliveryProviderDefinition[] }>("/admin/delivery/providers", {
          method: "GET",
        }),
        requestJson<{ connections: DeliveryConnection[] }>("/admin/delivery/connections", {
          method: "GET",
        }),
        requestJson<{ logs: DeliveryEventLog[] }>("/admin/delivery/logs?provider_code=yandex&limit=20", {
          method: "GET",
        }),
      ])

      setProviders(providersPayload.providers || [])
      setConnections(connectionsPayload.connections || [])
      setEventLogs(logsPayload.logs || [])
      setPageError(null)

      const nextConnections = connectionsPayload.connections || []

      if (activeConnectionId && !nextConnections.some((connection) => connection.id === activeConnectionId)) {
        setActiveConnectionId(null)
      }

      setTestQuoteForm((current) => {
        if (current.connection_id && nextConnections.some((connection) => connection.id === current.connection_id)) {
          return current
        }

        return {
          ...current,
          connection_id: nextConnections.find((connection) => connection.provider_code === "yandex")?.id || "",
        }
      })
    } catch (error) {
      setPageError(error as ApiErrorPayload)
    } finally {
      if (silent) {
        setIsRefreshing(false)
      } else {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    if (activeConnection) {
      setConnectionForm(connectionToForm(activeConnection))
      setTestQuoteForm((current) => ({
        ...current,
        connection_id: activeConnection.id,
      }))
      return
    }

    setConnectionForm(defaultConnectionForm)
  }, [activeConnection])

  const handleFormField = <K extends keyof DeliveryConnectionForm>(
    key: K,
    value: DeliveryConnectionForm[K]
  ) => {
    setConnectionForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const handleQuoteField = <K extends keyof DeliveryTestQuoteForm>(
    key: K,
    value: DeliveryTestQuoteForm[K]
  ) => {
    setTestQuoteForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const startCreate = () => {
    setActiveConnectionId(null)
    setConnectionForm(defaultConnectionForm)
    setFormError(null)
    setFormNotice(null)
    setTestConnectionError(null)
    setTestConnectionResult(null)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setFormError(null)
    setFormNotice(null)

    try {
      const payload = {
        provider_code: "yandex",
        name: connectionForm.name.trim(),
        mode: connectionForm.mode,
        enabled: connectionForm.enabled,
        country_code: connectionForm.country_code.trim().toUpperCase(),
        config: normalizeConfig(connectionForm),
        ...(connectionForm.token.trim()
          ? {
              credentials: {
                token: connectionForm.token.trim(),
              },
            }
          : {}),
      }

      const result = activeConnectionId
        ? await requestJson<{ connection: DeliveryConnection }>(
            `/admin/delivery/connections/${activeConnectionId}`,
            {
              method: "PUT",
              body: JSON.stringify(payload),
            }
          )
        : await requestJson<{ connection: DeliveryConnection }>("/admin/delivery/connections", {
            method: "POST",
            body: JSON.stringify(payload),
          })

      setActiveConnectionId(result.connection.id)
      setConnectionForm(connectionToForm(result.connection))
      setFormNotice(activeConnectionId ? "Yandex connection updated" : "Yandex connection created")
      await loadData(true)
    } catch (error) {
      setFormError(error as ApiErrorPayload)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestConnection = async () => {
    if (!activeConnectionId) {
      setTestConnectionError({
        status: 400,
        code: "DELIVERY_HUB_CONNECTION_REQUIRED",
        message: "Save the connection before running Test connection",
        details: null,
      })
      setTestConnectionResult(null)
      return
    }

    setIsTestingConnection(true)
    setTestConnectionError(null)
    setTestConnectionResult(null)

    try {
      const payload = await requestJson<{ ok: boolean; result: DeliveryTestConnectionResult }>(
        `/admin/delivery/connections/${activeConnectionId}/test`,
        {
          method: "POST",
          body: JSON.stringify({
            include_pickup_points: includePickupPoints,
          }),
        }
      )

      setTestConnectionResult(payload.result)
      await loadData(true)
    } catch (error) {
      setTestConnectionError(error as ApiErrorPayload)
      await loadData(true)
    } finally {
      setIsTestingConnection(false)
    }
  }

  const handleTestQuote = async () => {
    setIsTestingQuote(true)
    setTestQuoteError(null)
    setTestQuoteResult(null)

    try {
      const items = {
        quantity: testQuoteForm.item_quantity ? Number(testQuoteForm.item_quantity) : undefined,
        weight_grams: testQuoteForm.item_weight_grams
          ? Number(testQuoteForm.item_weight_grams)
          : undefined,
        price: testQuoteForm.item_price ? Number(testQuoteForm.item_price) : undefined,
      }

      const payload = await requestJson<DeliveryTestQuoteResponse>("/admin/delivery/test-quote", {
        method: "POST",
        body: JSON.stringify({
          connection_id: testQuoteForm.connection_id,
          mode_code: testQuoteForm.mode_code,
          destination_point_id: testQuoteForm.destination_point_id.trim(),
          currency_code: testQuoteForm.currency_code.trim().toUpperCase() || undefined,
          warehouse_id:
            testQuoteForm.mode_code === "warehouse_to_pickup_point"
              ? testQuoteForm.warehouse_id.trim()
              : undefined,
          origin_point_id:
            testQuoteForm.mode_code === "dropoff_point_to_pickup_point"
              ? testQuoteForm.origin_point_id.trim()
              : undefined,
          interval_utc:
            testQuoteForm.mode_code === "warehouse_to_pickup_point" &&
            testQuoteForm.interval_from.trim() &&
            testQuoteForm.interval_to.trim()
              ? {
                  from: testQuoteForm.interval_from.trim(),
                  to: testQuoteForm.interval_to.trim(),
                }
              : undefined,
          items: [items],
        }),
      })

      setTestQuoteResult(payload)
    } catch (error) {
      setTestQuoteError(error as ApiErrorPayload)
    } finally {
      setIsTestingQuote(false)
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <div>
          <Heading level="h1">Delivery</Heading>
          <Text className="text-ui-fg-subtle mt-2">
            Admin control plane for Delivery Hub tranche-1. Existing ApiShip behavior is left intact.
          </Text>
        </div>
        <Button type="button" variant="secondary" onClick={() => void loadData(true)} isLoading={isRefreshing}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 px-6 py-4">
        {pageError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <Text className="text-ui-fg-error font-medium">{pageError.message}</Text>
            <Text className="text-ui-fg-subtle mt-1">
              {pageError.code} · HTTP {pageError.status}
            </Text>
          </div>
        ) : null}

        {observedEncryptionDisabled ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <Text className="font-medium text-amber-800">Credentials encryption is disabled on backend</Text>
            <Text className="mt-1 text-sm text-amber-700">
              Token fields stay write-only, but backend cannot seal new credentials until the encryption key is configured.
            </Text>
          </div>
        ) : null}

        <div className="rounded-lg border p-4">
          <Heading level="h2">Providers</Heading>
          <Text className="text-ui-fg-subtle mt-2">
            Available Delivery Hub adapters and their supported diagnostics/capabilities.
          </Text>

          <div className="mt-4 grid gap-4">
            {providers.length ? (
              providers.map((provider) => (
                <div key={provider.code} className="rounded-md border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <Text className="font-medium">{provider.label}</Text>
                      <Text className="text-ui-fg-subtle text-sm">code: {provider.code}</Text>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {provider.supported_mode_codes.map((modeCode) => (
                        <span
                          key={modeCode}
                          className="rounded-full border border-ui-border-base bg-ui-bg-subtle px-2 py-1 text-xs"
                        >
                          {modeLabels[modeCode] || modeCode}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {provider.capabilities.map((capability) => (
                      <span
                        key={capability}
                        className="rounded-full border border-ui-border-base bg-ui-bg-subtle px-2 py-1 text-xs"
                      >
                        {capabilityLabels[capability] || capability}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <Text className="text-ui-fg-subtle">No providers returned by backend.</Text>
            )}
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Heading level="h2">Connections</Heading>
              <Text className="text-ui-fg-subtle mt-2">
                Existing Delivery Hub connections with truthful status and credentials state.
              </Text>
            </div>
            <Button type="button" variant="secondary" onClick={startCreate}>
              New Yandex connection
            </Button>
          </div>

          <div className="mt-4 grid gap-3">
            {yandexConnections.length ? (
              yandexConnections.map((connection) => {
                const isActive = connection.id === activeConnectionId

                return (
                  <button
                    key={connection.id}
                    type="button"
                    onClick={() => setActiveConnectionId(connection.id)}
                    className={`rounded-md border p-4 text-left transition-colors ${
                      isActive ? "border-ui-border-interactive bg-ui-bg-subtle" : "hover:bg-ui-bg-subtle"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Text className="font-medium">{connection.name}</Text>
                        <Text className="text-ui-fg-subtle text-sm">
                          {connection.provider_code} · {connection.mode} · {connection.country_code}
                        </Text>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full border px-2 py-1 text-xs ${statusToneClass(connection.status)}`}>
                          status: {connection.status}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-1 text-xs ${statusToneClass(
                            connection.credentials_state
                          )}`}
                        >
                          credentials: {connection.credentials_state}
                        </span>
                        <span className="rounded-full border border-ui-border-base px-2 py-1 text-xs">
                          {connection.enabled ? "enabled" : "disabled"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-1 text-sm text-ui-fg-subtle">
                      <Text>Credentials present: {connection.credentials_present ? "yes" : "no"}</Text>
                      <Text>
                        Last validated: {formatTimestamp(connection.credentials_last_validated_at)}
                      </Text>
                      <Text>
                        Last credentials error: {connection.credentials_last_error_code || "—"}
                      </Text>
                      <Text>Updated: {formatTimestamp(connection.updated_at)}</Text>
                    </div>
                  </button>
                )
              })
            ) : (
              <Text className="text-ui-fg-subtle">No Yandex connections yet.</Text>
            )}
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Heading level="h2">Yandex connection</Heading>
              <Text className="text-ui-fg-subtle mt-2">
                Create or update one connection. Token is write-only and never echoed back from backend.
              </Text>
            </div>
            <Text className="text-ui-fg-subtle text-sm">
              {activeConnectionId ? `Editing ${activeConnectionId}` : "Creating new draft"}
            </Text>
          </div>

          {yandexProvider ? null : (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <Text className="text-amber-800">Yandex provider is not reported by backend providers list.</Text>
            </div>
          )}

          {formNotice ? <Text className="mt-4 text-ui-fg-interactive">{formNotice}</Text> : null}
          {formError ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <Text className="text-ui-fg-error font-medium">{formError.message}</Text>
              <Text className="text-ui-fg-subtle mt-1">{formError.code}</Text>
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="delivery-name">Connection name</Label>
              <Input
                id="delivery-name"
                value={connectionForm.name}
                onChange={(event) => handleFormField("name", event.target.value)}
                disabled={isLoading || isSaving}
              />
            </div>

            <div>
              <Label htmlFor="delivery-country">Country</Label>
              <Input
                id="delivery-country"
                value={connectionForm.country_code}
                onChange={(event) => handleFormField("country_code", event.target.value)}
                disabled={isLoading || isSaving}
                maxLength={2}
              />
            </div>

            <div>
              <Label htmlFor="delivery-mode">Mode</Label>
              <select
                id="delivery-mode"
                value={connectionForm.mode}
                onChange={(event) => handleFormField("mode", event.target.value as "test" | "live")}
                disabled={isLoading || isSaving}
                className="bg-ui-bg-field shadow-borders-base txt-compact-small text-ui-fg-base focus-visible:shadow-borders-interactive-with-active h-10 w-full rounded-md px-3 outline-none"
              >
                <option value="test">test</option>
                <option value="live">live</option>
              </select>
            </div>

            <div>
              <Label htmlFor="delivery-provider">Provider</Label>
              <Input id="delivery-provider" readOnly value="yandex" />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="delivery-token">Token</Label>
              <Input
                id="delivery-token"
                type="password"
                placeholder={activeConnection?.credentials_present ? "Stored token is not shown. Enter only to replace." : "Paste Yandex token"}
                value={connectionForm.token}
                onChange={(event) => handleFormField("token", event.target.value)}
                disabled={isLoading || isSaving}
              />
              <Text className="text-ui-fg-subtle mt-2 text-sm">
                Write-only field. Saved token is never rendered in admin UI, docs or logs.
              </Text>
            </div>

            <div>
              <Label htmlFor="delivery-label-format">Label format</Label>
              <select
                id="delivery-label-format"
                value={connectionForm.label_format}
                onChange={(event) => handleFormField("label_format", event.target.value)}
                disabled={isLoading || isSaving}
                className="bg-ui-bg-field shadow-borders-base txt-compact-small text-ui-fg-base focus-visible:shadow-borders-interactive-with-active h-10 w-full rounded-md px-3 outline-none"
              >
                {labelFormatOptions.map((option) => (
                  <option key={option || "default"} value={option}>
                    {option || "backend default"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="delivery-warehouse">Default warehouse id</Label>
              <Input
                id="delivery-warehouse"
                value={connectionForm.default_warehouse_id}
                onChange={(event) => handleFormField("default_warehouse_id", event.target.value)}
                disabled={isLoading || isSaving}
              />
            </div>

            <div className="rounded-md border p-3 md:col-span-2">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Enabled</Label>
                  <Text className="text-ui-fg-subtle mt-1 text-sm">
                    Controls whether this connection is available for backend delivery orchestration.
                  </Text>
                </div>
                <Switch
                  checked={connectionForm.enabled}
                  onCheckedChange={(checked) => handleFormField("enabled", checked)}
                  disabled={isLoading || isSaving}
                />
              </div>
            </div>

            <div className="rounded-md border p-3 md:col-span-2">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Auto confirm</Label>
                  <Text className="text-ui-fg-subtle mt-1 text-sm">
                    Stored in connection config for Yandex adapter calls.
                  </Text>
                </div>
                <Switch
                  checked={connectionForm.auto_confirm}
                  onCheckedChange={(checked) => handleFormField("auto_confirm", checked)}
                  disabled={isLoading || isSaving}
                />
              </div>
            </div>
          </div>

          {activeConnection ? (
            <div className="mt-4 grid gap-3 rounded-lg border p-4 md:grid-cols-2">
              <div>
                <Label>Status</Label>
                <Input readOnly value={activeConnection.status} />
              </div>
              <div>
                <Label>Credentials state</Label>
                <Input readOnly value={activeConnection.credentials_state} />
              </div>
              <div>
                <Label>Credentials fingerprint</Label>
                <Input readOnly value={activeConnection.credentials_fingerprint || "—"} />
              </div>
              <div>
                <Label>Last credentials error</Label>
                <Input readOnly value={activeConnection.credentials_last_error_code || "—"} />
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button type="button" onClick={handleSave} isLoading={isSaving} disabled={isLoading}>
              {activeConnectionId ? "Save changes" : "Create connection"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleTestConnection}
              isLoading={isTestingConnection}
              disabled={isLoading}
            >
              Test connection
            </Button>
          </div>

          <div className="mt-4 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Heading level="h3">Connection diagnostics</Heading>
                <Text className="text-ui-fg-subtle mt-1 text-sm">
                  Optional pickup points listing extends the connection test for Yandex pickup flows.
                </Text>
              </div>
              <Switch checked={includePickupPoints} onCheckedChange={setIncludePickupPoints} />
            </div>

            {testConnectionError ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                <Text className="text-ui-fg-error font-medium">{testConnectionError.message}</Text>
                <Text className="text-ui-fg-subtle mt-1">{testConnectionError.code}</Text>
              </div>
            ) : null}

            {testConnectionResult ? (
              <div className="mt-4 grid gap-3">
                <div>
                  <Label>Provider</Label>
                  <Input readOnly value={testConnectionResult.provider_code} />
                </div>
                <div>
                  <Label>Diagnostics</Label>
                  <pre className="mt-2 overflow-auto rounded-md border bg-ui-bg-subtle p-3 text-xs">
                    {JSON.stringify(testConnectionResult.diagnostics, null, 2)}
                  </pre>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Heading level="h2">Event logs</Heading>
              <Text className="text-ui-fg-subtle mt-2">
                Read-only recent Delivery Hub diagnostic events. Payloads stay sanitized and filtered to Yandex.
              </Text>
            </div>
            <Text className="text-ui-fg-subtle text-sm">
              {activeConnectionId ? `Filtered by connection ${activeConnectionId}` : "Showing all Yandex connections"}
            </Text>
          </div>

          <div className="mt-4 grid gap-3">
            {filteredEventLogs.length ? (
              filteredEventLogs.map((log) => (
                <div key={log.id} className="rounded-md border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Text className="font-medium">{log.kind}</Text>
                      <Text className="text-ui-fg-subtle text-sm">
                        {log.provider_code} · {log.connection_id || "unscoped"}
                      </Text>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full border px-2 py-1 text-xs ${logSuccessToneClass(log.success)}`}>
                        {log.success ? "success" : "failure"}
                      </span>
                      <span className="rounded-full border border-ui-border-base px-2 py-1 text-xs">
                        {formatTimestamp(log.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-1 text-sm text-ui-fg-subtle">
                    <Text>Correlation id: {log.correlation_id}</Text>
                    <Text>Error code: {log.error_code || "—"}</Text>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Request summary</Label>
                      <pre className="mt-2 overflow-auto rounded-md border bg-ui-bg-subtle p-3 text-xs">
                        {JSON.stringify(log.request_summary, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <Label>Response summary</Label>
                      <pre className="mt-2 overflow-auto rounded-md border bg-ui-bg-subtle p-3 text-xs">
                        {JSON.stringify(log.response_summary, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <Text className="text-ui-fg-subtle">No delivery-hub event logs found for the current filter.</Text>
            )}
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <Heading level="h2">Test quote</Heading>
          <Text className="text-ui-fg-subtle mt-2">
            Minimal diagnostic form for Yandex supported modes in tranche-1.
          </Text>

          {testQuoteError ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <Text className="text-ui-fg-error font-medium">{testQuoteError.message}</Text>
              <Text className="text-ui-fg-subtle mt-1">{testQuoteError.code}</Text>
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="quote-connection">Connection</Label>
              <select
                id="quote-connection"
                value={testQuoteForm.connection_id}
                onChange={(event) => handleQuoteField("connection_id", event.target.value)}
                className="bg-ui-bg-field shadow-borders-base txt-compact-small text-ui-fg-base focus-visible:shadow-borders-interactive-with-active h-10 w-full rounded-md px-3 outline-none"
              >
                <option value="">Select connection</option>
                {yandexConnections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name} · {connection.mode} · {connection.status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="quote-mode">Mode code</Label>
              <select
                id="quote-mode"
                value={testQuoteForm.mode_code}
                onChange={(event) =>
                  handleQuoteField(
                    "mode_code",
                    event.target.value as DeliveryTestQuoteForm["mode_code"]
                  )
                }
                className="bg-ui-bg-field shadow-borders-base txt-compact-small text-ui-fg-base focus-visible:shadow-borders-interactive-with-active h-10 w-full rounded-md px-3 outline-none"
              >
                <option value="warehouse_to_pickup_point">warehouse_to_pickup_point</option>
                <option value="dropoff_point_to_pickup_point">dropoff_point_to_pickup_point</option>
              </select>
            </div>

            <div>
              <Label htmlFor="quote-destination-point">Destination point id</Label>
              <Input
                id="quote-destination-point"
                value={testQuoteForm.destination_point_id}
                onChange={(event) => handleQuoteField("destination_point_id", event.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="quote-currency">Currency</Label>
              <Input
                id="quote-currency"
                value={testQuoteForm.currency_code}
                onChange={(event) => handleQuoteField("currency_code", event.target.value)}
              />
            </div>

            {testQuoteForm.mode_code === "warehouse_to_pickup_point" ? (
              <>
                <div>
                  <Label htmlFor="quote-warehouse-id">Warehouse id</Label>
                  <Input
                    id="quote-warehouse-id"
                    value={testQuoteForm.warehouse_id}
                    onChange={(event) => handleQuoteField("warehouse_id", event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="quote-interval-from">Interval from (UTC ISO)</Label>
                  <Input
                    id="quote-interval-from"
                    placeholder="2026-04-21T09:00:00.000Z"
                    value={testQuoteForm.interval_from}
                    onChange={(event) => handleQuoteField("interval_from", event.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="quote-interval-to">Interval to (UTC ISO)</Label>
                  <Input
                    id="quote-interval-to"
                    placeholder="2026-04-21T18:00:00.000Z"
                    value={testQuoteForm.interval_to}
                    onChange={(event) => handleQuoteField("interval_to", event.target.value)}
                  />
                </div>
              </>
            ) : (
              <div className="md:col-span-2">
                <Label htmlFor="quote-origin-point">Origin dropoff point id</Label>
                <Input
                  id="quote-origin-point"
                  value={testQuoteForm.origin_point_id}
                  onChange={(event) => handleQuoteField("origin_point_id", event.target.value)}
                />
              </div>
            )}

            <div>
              <Label htmlFor="quote-item-quantity">Item quantity</Label>
              <Input
                id="quote-item-quantity"
                type="number"
                min="1"
                value={testQuoteForm.item_quantity}
                onChange={(event) => handleQuoteField("item_quantity", event.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="quote-item-weight">Weight grams</Label>
              <Input
                id="quote-item-weight"
                type="number"
                min="0"
                value={testQuoteForm.item_weight_grams}
                onChange={(event) => handleQuoteField("item_weight_grams", event.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="quote-item-price">Declared price</Label>
              <Input
                id="quote-item-price"
                type="number"
                min="0"
                value={testQuoteForm.item_price}
                onChange={(event) => handleQuoteField("item_price", event.target.value)}
              />
            </div>
          </div>

          <div className="mt-6">
            <Button type="button" onClick={handleTestQuote} isLoading={isTestingQuote} disabled={isLoading}>
              Test quote
            </Button>
          </div>

          {testQuoteResult ? (
            <div className="mt-6 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Correlation id</Label>
                  <Input readOnly value={testQuoteResult.correlation_id} />
                </div>
                <div>
                  <Label>Quotes count</Label>
                  <Input readOnly value={String(testQuoteResult.quotes.length)} />
                </div>
              </div>

              <div className="grid gap-3">
                {testQuoteResult.quotes.map((quote) => (
                  <div key={quote.quote_key} className="rounded-md border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Text className="font-medium">{quote.carrier_label}</Text>
                        <Text className="text-ui-fg-subtle text-sm">
                          {quote.mode_code} · {quote.quote_key}
                        </Text>
                      </div>
                      <div className="text-right">
                        <Text className="font-medium">
                          {quote.amount} {quote.currency_code}
                        </Text>
                        <Text className="text-ui-fg-subtle text-sm">
                          ETA {quote.delivery_eta_min ?? "?"}–{quote.delivery_eta_max ?? "?"}
                        </Text>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-1 text-sm text-ui-fg-subtle">
                      <Text>
                        Pickup point required: {quote.pickup_point_required ? "yes" : "no"}
                      </Text>
                      <Text>
                        Pickup window required: {quote.pickup_window_required ? "yes" : "no"}
                      </Text>
                      <Text>
                        Pickup point ids: {quote.pickup_point_ids.length ? quote.pickup_point_ids.join(", ") : "—"}
                      </Text>
                    </div>

                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-ui-fg-subtle">Raw reference</summary>
                      <pre className="mt-2 overflow-auto rounded-md border bg-ui-bg-subtle p-3 text-xs">
                        {JSON.stringify(quote.raw_reference, null, 2)}
                      </pre>
                    </details>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Delivery",
  icon: HandTruck,
})

export default DeliverySettingsPage
