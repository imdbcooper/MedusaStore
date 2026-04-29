import { defineRouteConfig } from "@medusajs/admin-sdk";
import { HandTruck } from "@medusajs/icons";
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Switch,
  Text,
} from "@medusajs/ui";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD,
  buildDeliveryHubShippingOptionManualSyncDryRunRequest,
  buildDeliveryHubShippingOptionManualSyncExecuteRequest,
  type DeliveryHubShippingOptionManualSyncErrorMode,
  type DeliveryHubShippingOptionManualSyncMode,
} from "./manual-sync";
import {
  buildShipmentOperationsCancelRequestBody,
  buildShipmentOperationsCancelUrl,
  buildShipmentOperationsRefreshStatusRequestBody,
  buildShipmentOperationsRefreshStatusUrl,
  buildShipmentOperationsRetryUrl,
  buildShipmentOperationsSnapshotUrl,
  buildPickupPointLookupQuery,
  buildPickupWindowLookupQuery,
  buildYandexSandboxPickupPointLookupForm,
  capabilityLabels,
  connectionToForm,
  defaultConnectionForm,
  defaultPickupPointLookupForm,
  defaultPickupWindowLookupForm,
  defaultShipmentOperationsForm,
  defaultWarehouseForm,
  deriveExecutionPlanObservabilityRenderState,
  deriveFulfillmentBridgePreviewRenderState,
  deriveShipmentOperationsRenderState,
  deriveShippingOptionManualSyncRenderState,
  deriveShippingOptionPreviewRenderState,
  formatTimestamp,
  getDeliveryHubApiErrorSafeLines,
  getDiagnosticsSummaryText,
  getFieldRequirementText,
  getFilteredEventLogs,
  getObservedEncryptionDisabled,
  getPickupPointOptionLabel,
  getPickupWindowOptionLabel,
  getProviderCodeOperatorHint,
  getQuoteInputEchoLines,
  getQuoteModeHint,
  getRequiredBadgeClass,
  getRequiredBadgeText,
  getShippingOptionSyncCapability,
  getTestConnectionCapability,
  getTestQuoteCapability,
  getWarehouseOptionLabel,
  getYandexConnections,
  getYandexWarehouses,
  labelFormatOptions,
  logSuccessToneClass,
  modeLabels,
  normalizeConfig,
  plannerStatusToneClass,
  statusToneClass,
  warehouseToForm,
  yandexApiBaseUrlOptions,
  YANDEX_VERIFIED_SANDBOX_PVZ,
  type ApiErrorPayload,
  type DeliveryConfig,
  type DeliveryConnection,
  type DeliveryConnectionForm,
  type DeliveryEventLog,
  type DeliveryHubDiagnosticsSummary,
  type DeliveryHubTestQuoteInputEcho,
  type DeliveryHubExecutionPlanObservabilityReadModel,
  type DeliveryHubFulfillmentBridgeReadinessPreview,
  type DeliveryHubPickupPointLookupForm,
  type DeliveryHubPickupPointLookupResponse,
  type DeliveryHubPickupWindowLookupForm,
  type DeliveryHubPickupWindowLookupResponse,
  type DeliveryHubShipmentOperationsCancelResponse,
  type DeliveryHubShipmentOperationsForm,
  type DeliveryHubShipmentOperationsRefreshResponse,
  type DeliveryHubShipmentOperationsResponse,
  type DeliveryHubShipmentOperationsRetryResponse,
  type DeliveryHubShipmentOperationsSnapshot,
  type DeliveryHubShippingOptionManualSyncResponse,
  type DeliveryHubShippingOptionPreview,
  type DeliveryProviderDefinition,
  type DeliveryWarehouse,
  type DeliveryWarehouseForm,
} from "./page-state";

type DeliveryTestConnectionResult = {
  ok: boolean;
  provider_code: string;
  diagnostics: Record<string, unknown>;
  diagnostics_summary?: DeliveryHubDiagnosticsSummary;
};

type DeliveryQuote = {
  carrier_code: string;
  carrier_label: string;
  mode_code: string;
  quote_key: string;
  amount: number;
  currency_code: string;
  delivery_eta_min: number | null;
  delivery_eta_max: number | null;
  pickup_point_required: boolean;
  pickup_point_ids: string[];
  pickup_points_embedded: unknown[];
  pickup_window_required: boolean;
  pickup_window_options: unknown[];
  raw_reference: Record<string, unknown>;
};

type DeliveryTestQuoteResponse = {
  ok: boolean;
  connection: DeliveryConnection;
  quotes: DeliveryQuote[];
  correlation_id: string;
  input_echo: DeliveryHubTestQuoteInputEcho;
  diagnostics_summary: DeliveryHubDiagnosticsSummary;
};

type DeliveryTestQuoteForm = {
  connection_id: string;
  mode_code: "warehouse_to_pickup_point" | "dropoff_point_to_pickup_point";
  destination_point_id: string;
  origin_point_id: string;
  warehouse_id: string;
  currency_code: string;
  interval_from: string;
  interval_to: string;
  item_quantity: string;
  item_weight_grams: string;
  item_price: string;
};

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
};

const RequirementBadge = ({ required }: { required: boolean }) => (
  <span
    className={`ml-2 rounded-full border px-2 py-0.5 text-[11px] ${getRequiredBadgeClass(
      required,
    )}`}
  >
    {getRequiredBadgeText(required)}
  </span>
);

const FieldLabel = ({
  htmlFor,
  children,
  required,
}: {
  htmlFor?: string;
  children: ReactNode;
  required: boolean;
}) => (
  <Label htmlFor={htmlFor}>
    {children}
    <RequirementBadge required={required} />
  </Label>
);

const getApiError = async (response: Response): Promise<ApiErrorPayload> => {
  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const structured = payload as {
    error?: { code?: string; message?: string; details?: unknown };
  } | null;

  return {
    status: response.status,
    code: structured?.error?.code || `HTTP_${response.status}`,
    message: structured?.error?.message || `HTTP ${response.status}`,
    details: structured?.error?.details ?? null,
  };
};

const requestJson = async <T,>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(input, {
    credentials: "include",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw await getApiError(response);
  }

  return (await response.json()) as T;
};

const DeliverySettingsPage = () => {
  const [providers, setProviders] = useState<DeliveryProviderDefinition[]>([]);
  const [connections, setConnections] = useState<DeliveryConnection[]>([]);
  const [warehouses, setWarehouses] = useState<DeliveryWarehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingConnection, setIsDeletingConnection] = useState(false);
  const [isSavingWarehouse, setIsSavingWarehouse] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(
    null,
  );
  const [activeWarehouseId, setActiveWarehouseId] = useState<string | null>(
    null,
  );
  const [connectionForm, setConnectionForm] = useState<DeliveryConnectionForm>(
    defaultConnectionForm,
  );
  const [warehouseForm, setWarehouseForm] =
    useState<DeliveryWarehouseForm>(defaultWarehouseForm);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [warehouseFormNotice, setWarehouseFormNotice] = useState<string | null>(
    null,
  );
  const [pageError, setPageError] = useState<ApiErrorPayload | null>(null);
  const [formError, setFormError] = useState<ApiErrorPayload | null>(null);
  const [warehouseFormError, setWarehouseFormError] =
    useState<ApiErrorPayload | null>(null);
  const [testConnectionResult, setTestConnectionResult] =
    useState<DeliveryTestConnectionResult | null>(null);
  const [testConnectionError, setTestConnectionError] =
    useState<ApiErrorPayload | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [includePickupPoints, setIncludePickupPoints] = useState(true);
  const [pickupPointLookupForm, setPickupPointLookupForm] =
    useState<DeliveryHubPickupPointLookupForm>(defaultPickupPointLookupForm);
  const [pickupPointLookupResult, setPickupPointLookupResult] =
    useState<DeliveryHubPickupPointLookupResponse | null>(null);
  const [pickupPointLookupError, setPickupPointLookupError] =
    useState<ApiErrorPayload | null>(null);
  const [isLoadingPickupPoints, setIsLoadingPickupPoints] = useState(false);
  const [pickupWindowLookupForm, setPickupWindowLookupForm] =
    useState<DeliveryHubPickupWindowLookupForm>(defaultPickupWindowLookupForm);
  const [pickupWindowLookupResult, setPickupWindowLookupResult] =
    useState<DeliveryHubPickupWindowLookupResponse | null>(null);
  const [pickupWindowLookupError, setPickupWindowLookupError] =
    useState<ApiErrorPayload | null>(null);
  const [isLoadingPickupWindows, setIsLoadingPickupWindows] = useState(false);
  const [testQuoteForm, setTestQuoteForm] =
    useState<DeliveryTestQuoteForm>(defaultTestQuoteForm);
  const [testQuoteResult, setTestQuoteResult] =
    useState<DeliveryTestQuoteResponse | null>(null);
  const [testQuoteError, setTestQuoteError] = useState<ApiErrorPayload | null>(
    null,
  );
  const [isTestingQuote, setIsTestingQuote] = useState(false);
  const [eventLogs, setEventLogs] = useState<DeliveryEventLog[]>([]);
  const [shippingOptionPreview, setShippingOptionPreview] =
    useState<DeliveryHubShippingOptionPreview | null>(null);
  const [fulfillmentBridgePreview, setFulfillmentBridgePreview] =
    useState<DeliveryHubFulfillmentBridgeReadinessPreview | null>(null);
  const [executionPlanPreview, setExecutionPlanPreview] =
    useState<DeliveryHubExecutionPlanObservabilityReadModel | null>(null);
  const [shippingOptionSyncResult, setShippingOptionSyncResult] =
    useState<DeliveryHubShippingOptionManualSyncResponse | null>(null);
  const [shippingOptionSyncError, setShippingOptionSyncError] =
    useState<ApiErrorPayload | null>(null);
  const [isRunningShippingOptionSync, setIsRunningShippingOptionSync] =
    useState(false);
  const [shippingOptionSyncErrorMode, setShippingOptionSyncErrorMode] =
    useState<DeliveryHubShippingOptionManualSyncErrorMode>("abort");
  const [shippingOptionSyncExecuteGuard, setShippingOptionSyncExecuteGuard] =
    useState("");
  const [shippingOptionSyncServiceZoneId, setShippingOptionSyncServiceZoneId] =
    useState("");
  const [
    shippingOptionSyncShippingProfileId,
    setShippingOptionSyncShippingProfileId,
  ] = useState("");
  const [shipmentOperationsForm, setShipmentOperationsForm] =
    useState<DeliveryHubShipmentOperationsForm>(defaultShipmentOperationsForm);
  const [shipmentOperationsSnapshot, setShipmentOperationsSnapshot] =
    useState<DeliveryHubShipmentOperationsSnapshot | null>(null);
  const [shipmentOperationsError, setShipmentOperationsError] =
    useState<ApiErrorPayload | null>(null);
  const [shipmentOperationsNotice, setShipmentOperationsNotice] = useState<
    string | null
  >(null);
  const [isLoadingShipmentOperations, setIsLoadingShipmentOperations] =
    useState(false);
  const [isRefreshingShipmentStatus, setIsRefreshingShipmentStatus] =
    useState(false);
  const [isCancellingShipment, setIsCancellingShipment] = useState(false);
  const [isRetryingShipment, setIsRetryingShipment] = useState(false);

  const activeConnection = useMemo(() => {
    if (!activeConnectionId) {
      return null;
    }

    return (
      connections.find((connection) => connection.id === activeConnectionId) ||
      null
    );
  }, [activeConnectionId, connections]);

  const activeWarehouse = useMemo(() => {
    if (!activeWarehouseId) {
      return null;
    }

    return (
      warehouses.find((warehouse) => warehouse.id === activeWarehouseId) || null
    );
  }, [activeWarehouseId, warehouses]);

  const yandexProvider = useMemo(
    () => providers.find((provider) => provider.code === "yandex") || null,
    [providers],
  );

  const observedEncryptionDisabled = useMemo(() => {
    return getObservedEncryptionDisabled({
      connections,
      activeConnection,
      formError,
      testConnectionError,
    });
  }, [activeConnection, connections, formError, testConnectionError]);

  const yandexConnections = useMemo(
    () => getYandexConnections(connections),
    [connections],
  );

  const yandexWarehouses = useMemo(
    () => getYandexWarehouses(warehouses),
    [warehouses],
  );

  const filteredEventLogs = useMemo(() => {
    return getFilteredEventLogs(eventLogs, activeConnectionId);
  }, [activeConnectionId, eventLogs]);

  const shippingOptionSyncCapability = useMemo(() => {
    return getShippingOptionSyncCapability({
      executeGuard: shippingOptionSyncExecuteGuard,
      serviceZoneId: shippingOptionSyncServiceZoneId,
      shippingProfileId: shippingOptionSyncShippingProfileId,
    });
  }, [
    shippingOptionSyncExecuteGuard,
    shippingOptionSyncServiceZoneId,
    shippingOptionSyncShippingProfileId,
  ]);

  const testConnectionCapability = useMemo(
    () =>
      getTestConnectionCapability({ activeConnectionId, isLoading, isSaving }),
    [activeConnectionId, isLoading, isSaving],
  );

  const testQuoteCapability = useMemo(
    () => getTestQuoteCapability(testQuoteForm),
    [testQuoteForm],
  );

  const shippingOptionSyncExecuteGuardConfirmed =
    shippingOptionSyncCapability.guardConfirmed;
  const canExecuteShippingOptionSync = shippingOptionSyncCapability.canExecute;

  const previewRenderState = useMemo(
    () => deriveShippingOptionPreviewRenderState(shippingOptionPreview),
    [shippingOptionPreview],
  );

  const manualSyncRenderState = useMemo(
    () =>
      deriveShippingOptionManualSyncRenderState({
        result: shippingOptionSyncResult,
        executeGuard: shippingOptionSyncExecuteGuard,
        serviceZoneId: shippingOptionSyncServiceZoneId,
        shippingProfileId: shippingOptionSyncShippingProfileId,
      }),
    [
      shippingOptionSyncExecuteGuard,
      shippingOptionSyncResult,
      shippingOptionSyncServiceZoneId,
      shippingOptionSyncShippingProfileId,
    ],
  );

  const fulfillmentBridgeRenderState = useMemo(
    () => deriveFulfillmentBridgePreviewRenderState(fulfillmentBridgePreview),
    [fulfillmentBridgePreview],
  );

  const executionPlanRenderState = useMemo(
    () => deriveExecutionPlanObservabilityRenderState(executionPlanPreview),
    [executionPlanPreview],
  );

  const shipmentOperationsRenderState = useMemo(
    () =>
      deriveShipmentOperationsRenderState({
        form: shipmentOperationsForm,
        snapshot: shipmentOperationsSnapshot,
      }),
    [shipmentOperationsForm, shipmentOperationsSnapshot],
  );

  const loadData = async (silent = false) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const [
        providersPayload,
        connectionsPayload,
        warehousesPayload,
        logsPayload,
        previewPayload,
        fulfillmentBridgePayload,
        executionPlanPayload,
      ] = await Promise.all([
        requestJson<{ providers: DeliveryProviderDefinition[] }>(
          "/admin/delivery/providers",
          {
            method: "GET",
          },
        ),
        requestJson<{ connections: DeliveryConnection[] }>(
          "/admin/delivery/connections",
          {
            method: "GET",
          },
        ),
        requestJson<{ warehouses: DeliveryWarehouse[] }>(
          "/admin/delivery/warehouses",
          {
            method: "GET",
          },
        ),
        requestJson<{ logs: DeliveryEventLog[] }>(
          "/admin/delivery/logs?provider_code=yandex&limit=20",
          {
            method: "GET",
          },
        ),
        requestJson<{ preview: DeliveryHubShippingOptionPreview }>(
          "/admin/delivery/shipping-options/preview",
          {
            method: "GET",
          },
        ),
        requestJson<{ preview: DeliveryHubFulfillmentBridgeReadinessPreview }>(
          "/admin/delivery/fulfillment-bridge/preview",
          {
            method: "GET",
          },
        ),
        requestJson<{
          preview: DeliveryHubExecutionPlanObservabilityReadModel;
        }>("/admin/delivery/execution-plan/preview", {
          method: "GET",
        }),
      ]);

      setProviders(providersPayload.providers || []);
      setConnections(connectionsPayload.connections || []);
      setWarehouses(warehousesPayload.warehouses || []);
      setEventLogs(logsPayload.logs || []);
      setShippingOptionPreview(previewPayload.preview || null);
      setFulfillmentBridgePreview(fulfillmentBridgePayload.preview || null);
      setExecutionPlanPreview(executionPlanPayload.preview || null);
      setPageError(null);

      const nextConnections = connectionsPayload.connections || [];

      if (
        activeConnectionId &&
        !nextConnections.some(
          (connection) => connection.id === activeConnectionId,
        )
      ) {
        setActiveConnectionId(null);
      }

      const nextWarehouses = warehousesPayload.warehouses || [];

      if (
        activeWarehouseId &&
        !nextWarehouses.some((warehouse) => warehouse.id === activeWarehouseId)
      ) {
        setActiveWarehouseId(null);
      }

      const defaultYandexConnectionId =
        nextConnections.find(
          (connection) => connection.provider_code === "yandex",
        )?.id || "";

      setTestQuoteForm((current) => {
        if (
          current.connection_id &&
          nextConnections.some(
            (connection) => connection.id === current.connection_id,
          )
        ) {
          return current;
        }

        return {
          ...current,
          connection_id: defaultYandexConnectionId,
        };
      });

      setPickupPointLookupForm((current) => ({
        ...current,
        connection_id: current.connection_id || defaultYandexConnectionId,
      }));

      setPickupWindowLookupForm((current) => ({
        ...current,
        connection_id: current.connection_id || defaultYandexConnectionId,
        warehouse_id:
          current.warehouse_id ||
          nextWarehouses.find(
            (warehouse) =>
              warehouse.provider_code === "yandex" && warehouse.enabled,
          )?.id ||
          "",
      }));
    } catch (error) {
      setPageError(error as ApiErrorPayload);
    } finally {
      if (silent) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (activeConnection) {
      setConnectionForm(connectionToForm(activeConnection));
      setTestQuoteForm((current) => ({
        ...current,
        connection_id: activeConnection.id,
      }));
      setPickupPointLookupForm((current) => ({
        ...current,
        connection_id: activeConnection.id,
      }));
      setPickupWindowLookupForm((current) => ({
        ...current,
        connection_id: activeConnection.id,
      }));
      return;
    }

    setConnectionForm(defaultConnectionForm);
  }, [activeConnection]);

  useEffect(() => {
    if (activeWarehouse) {
      setWarehouseForm(warehouseToForm(activeWarehouse));
      setTestQuoteForm((current) => {
        if (current.warehouse_id === activeWarehouse.id) {
          return current;
        }

        setPickupWindowLookupForm((lookup) => ({
          ...lookup,
          warehouse_id: lookup.warehouse_id || activeWarehouse.id,
        }));

        return {
          ...current,
          warehouse_id: current.warehouse_id || activeWarehouse.id,
        };
      });
      return;
    }

    setWarehouseForm(defaultWarehouseForm);
  }, [activeWarehouse]);

  const handleFormField = <K extends keyof DeliveryConnectionForm>(
    key: K,
    value: DeliveryConnectionForm[K],
  ) => {
    setConnectionForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleQuoteField = <K extends keyof DeliveryTestQuoteForm>(
    key: K,
    value: DeliveryTestQuoteForm[K],
  ) => {
    setTestQuoteForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handlePickupPointLookupField = <
    K extends keyof DeliveryHubPickupPointLookupForm,
  >(
    key: K,
    value: DeliveryHubPickupPointLookupForm[K],
  ) => {
    setPickupPointLookupForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handlePickupWindowLookupField = <
    K extends keyof DeliveryHubPickupWindowLookupForm,
  >(
    key: K,
    value: DeliveryHubPickupWindowLookupForm[K],
  ) => {
    setPickupWindowLookupForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleWarehouseField = <K extends keyof DeliveryWarehouseForm>(
    key: K,
    value: DeliveryWarehouseForm[K],
  ) => {
    setWarehouseForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleShipmentOperationsField = <
    K extends keyof DeliveryHubShipmentOperationsForm,
  >(
    key: K,
    value: DeliveryHubShipmentOperationsForm[K],
  ) => {
    setShipmentOperationsForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const startCreate = () => {
    setActiveConnectionId(null);
    setConnectionForm(defaultConnectionForm);
    setFormError(null);
    setFormNotice(null);
    setTestConnectionError(null);
    setTestConnectionResult(null);
  };

  const startCreateWarehouse = () => {
    setActiveWarehouseId(null);
    setWarehouseForm(defaultWarehouseForm);
    setWarehouseFormError(null);
    setWarehouseFormNotice(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setFormError(null);
    setFormNotice(null);

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
      };

      const result = activeConnectionId
        ? await requestJson<{ connection: DeliveryConnection }>(
            `/admin/delivery/connections/${activeConnectionId}`,
            {
              method: "PUT",
              body: JSON.stringify(payload),
            },
          )
        : await requestJson<{ connection: DeliveryConnection }>(
            "/admin/delivery/connections",
            {
              method: "POST",
              body: JSON.stringify(payload),
            },
          );

      setActiveConnectionId(result.connection.id);
      setConnectionForm(connectionToForm(result.connection));
      setFormNotice(
        activeConnectionId
          ? "Yandex connection updated"
          : "Yandex connection created",
      );
      await loadData(true);
    } catch (error) {
      setFormError(error as ApiErrorPayload);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConnection = async () => {
    if (!activeConnectionId || !activeConnection) {
      setFormError({
        status: 400,
        code: "DELIVERY_HUB_CONNECTION_REQUIRED",
        message: "Выберите сохранённое подключение перед удалением.",
        details: null,
      });
      return;
    }

    const confirmed = window.confirm(
      `Удалить подключение "${activeConnection.name}"? Audit event logs останутся в backend, но само подключение исчезнет из admin/storefront selection.`,
    );

    if (!confirmed) {
      return;
    }

    setIsDeletingConnection(true);
    setFormError(null);
    setFormNotice(null);
    setTestConnectionError(null);
    setTestConnectionResult(null);

    try {
      await requestJson<{ deleted: true; connection: DeliveryConnection }>(
        `/admin/delivery/connections/${activeConnectionId}`,
        {
          method: "DELETE",
        },
      );

      setActiveConnectionId(null);
      setConnectionForm(defaultConnectionForm);
      setTestQuoteForm((current) => ({
        ...current,
        connection_id:
          current.connection_id === activeConnectionId ? "" : current.connection_id,
      }));
      setPickupPointLookupForm((current) => ({
        ...current,
        connection_id:
          current.connection_id === activeConnectionId ? "" : current.connection_id,
      }));
      setPickupWindowLookupForm((current) => ({
        ...current,
        connection_id:
          current.connection_id === activeConnectionId ? "" : current.connection_id,
      }));
      setFormNotice("Yandex connection deleted");
      await loadData(true);
    } catch (error) {
      setFormError(error as ApiErrorPayload);
    } finally {
      setIsDeletingConnection(false);
    }
  };

  const handleSaveWarehouse = async () => {
    setIsSavingWarehouse(true);
    setWarehouseFormError(null);
    setWarehouseFormNotice(null);

    try {
      const payload = {
        name: warehouseForm.name.trim(),
        enabled: warehouseForm.enabled,
        country_code: warehouseForm.country_code.trim().toUpperCase(),
        city: warehouseForm.city.trim() || undefined,
        address_line_1: warehouseForm.address_line_1.trim() || undefined,
        contact_name: warehouseForm.contact_name.trim() || undefined,
        contact_phone: warehouseForm.contact_phone.trim() || undefined,
        provider_code: warehouseForm.provider_code.trim() || undefined,
        provider_warehouse_id:
          warehouseForm.provider_warehouse_id.trim() || undefined,
      };

      const result = activeWarehouseId
        ? await requestJson<{ warehouse: DeliveryWarehouse }>(
            `/admin/delivery/warehouses/${activeWarehouseId}`,
            {
              method: "PUT",
              body: JSON.stringify(payload),
            },
          )
        : await requestJson<{ warehouse: DeliveryWarehouse }>(
            "/admin/delivery/warehouses",
            {
              method: "POST",
              body: JSON.stringify(payload),
            },
          );

      setActiveWarehouseId(result.warehouse.id);
      setWarehouseForm(warehouseToForm(result.warehouse));
      setWarehouseFormNotice(
        activeWarehouseId ? "Warehouse updated" : "Warehouse created",
      );
      await loadData(true);
    } catch (error) {
      setWarehouseFormError(error as ApiErrorPayload);
    } finally {
      setIsSavingWarehouse(false);
    }
  };

  const handleTestConnection = async () => {
    if (!activeConnectionId) {
      setTestConnectionError({
        status: 400,
        code: "DELIVERY_HUB_CONNECTION_REQUIRED",
        message: "Save the connection before running Проверить подключение",
        details: null,
      });
      setTestConnectionResult(null);
      return;
    }

    setIsTestingConnection(true);
    setTestConnectionError(null);
    setTestConnectionResult(null);

    try {
      const payload = await requestJson<{
        ok: boolean;
        result: DeliveryTestConnectionResult;
      }>(`/admin/delivery/connections/${activeConnectionId}/test`, {
        method: "POST",
        body: JSON.stringify({
          include_pickup_points: includePickupPoints,
        }),
      });

      setTestConnectionResult(payload.result);
      await loadData(true);
    } catch (error) {
      setTestConnectionError(error as ApiErrorPayload);
      await loadData(true);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleLoadPickupPoints = async () => {
    if (!pickupPointLookupForm.connection_id.trim()) {
      setPickupPointLookupError({
        status: 400,
        code: "DELIVERY_HUB_CONNECTION_REQUIRED",
        message: "Выберите сохранённое подключение перед загрузкой ПВЗ.",
        details: null,
      });
      setPickupPointLookupResult(null);
      return;
    }

    setIsLoadingPickupPoints(true);
    setPickupPointLookupError(null);
    setPickupPointLookupResult(null);

    try {
      const payload = await requestJson<DeliveryHubPickupPointLookupResponse>(
        `/admin/delivery/pickup-points?${buildPickupPointLookupQuery(pickupPointLookupForm)}`,
        { method: "GET" },
      );

      setPickupPointLookupResult(payload);
    } catch (error) {
      setPickupPointLookupError(error as ApiErrorPayload);
    } finally {
      setIsLoadingPickupPoints(false);
    }
  };

  const handleUsePickupPointAsDestination = (pointId: string) => {
    handleQuoteField("destination_point_id", pointId);
    setPickupWindowLookupForm((current) => ({
      ...current,
      destination_point_id: pointId,
    }));
  };

  const handleUseYandexSandboxPickupPoint = () => {
    handleUsePickupPointAsDestination(YANDEX_VERIFIED_SANDBOX_PVZ.id);
    setPickupPointLookupForm((current) =>
      buildYandexSandboxPickupPointLookupForm(current),
    );
  };

  const handleUsePickupPointAsOrigin = (pointId: string) => {
    handleQuoteField("origin_point_id", pointId);
  };

  const handleLoadPickupWindows = async () => {
    if (
      !pickupWindowLookupForm.connection_id.trim() ||
      !pickupWindowLookupForm.warehouse_id.trim() ||
      !pickupWindowLookupForm.destination_point_id.trim()
    ) {
      setPickupWindowLookupError({
        status: 400,
        code: "DELIVERY_HUB_PICKUP_WINDOWS_INPUT_REQUIRED",
        message:
          "Выберите сохранённое подключение, склад и destination PVZ id перед загрузкой pickup windows.",
        details: null,
      });
      setPickupWindowLookupResult(null);
      return;
    }

    setIsLoadingPickupWindows(true);
    setPickupWindowLookupError(null);
    setPickupWindowLookupResult(null);

    try {
      const payload = await requestJson<DeliveryHubPickupWindowLookupResponse>(
        `/admin/delivery/pickup-windows?${buildPickupWindowLookupQuery(pickupWindowLookupForm)}`,
        { method: "GET" },
      );

      setPickupWindowLookupResult(payload);
    } catch (error) {
      setPickupWindowLookupError(error as ApiErrorPayload);
    } finally {
      setIsLoadingPickupWindows(false);
    }
  };

  const handleUsePickupWindowInterval = (
    window: DeliveryHubPickupWindowLookupResponse["windows"][number],
  ) => {
    setTestQuoteForm((current) => ({
      ...current,
      mode_code: "warehouse_to_pickup_point",
      connection_id:
        pickupWindowLookupForm.connection_id || current.connection_id,
      warehouse_id: pickupWindowLookupForm.warehouse_id || current.warehouse_id,
      destination_point_id:
        pickupWindowLookupForm.destination_point_id ||
        current.destination_point_id,
      interval_from: window.interval_utc.from,
      interval_to: window.interval_utc.to,
    }));
  };

  const handleTestQuote = async () => {
    if (!testQuoteCapability.canTest) {
      setTestQuoteError({
        status: 400,
        code: "DELIVERY_HUB_TEST_QUOTE_INPUT_REQUIRED",
        message:
          testQuoteCapability.errorMessage ||
          "Заполните обязательные поля перед Test quote.",
        details: {
          blocking_reasons: testQuoteCapability.blockingReasons,
        },
      });
      setTestQuoteResult(null);
      return;
    }

    setIsTestingQuote(true);
    setTestQuoteError(null);
    setTestQuoteResult(null);

    try {
      const items = {
        quantity: testQuoteForm.item_quantity
          ? Number(testQuoteForm.item_quantity)
          : undefined,
        weight_grams: testQuoteForm.item_weight_grams
          ? Number(testQuoteForm.item_weight_grams)
          : undefined,
        price: testQuoteForm.item_price
          ? Number(testQuoteForm.item_price)
          : undefined,
      };

      const payload = await requestJson<DeliveryTestQuoteResponse>(
        "/admin/delivery/test-quote",
        {
          method: "POST",
          body: JSON.stringify({
            connection_id: testQuoteForm.connection_id,
            mode_code: testQuoteForm.mode_code,
            destination_point_id: testQuoteForm.destination_point_id.trim(),
            currency_code:
              testQuoteForm.currency_code.trim().toUpperCase() || undefined,
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
        },
      );

      setTestQuoteResult(payload);
    } catch (error) {
      setTestQuoteError(error as ApiErrorPayload);
    } finally {
      setIsTestingQuote(false);
    }
  };

  const handleShippingOptionSync = async (
    mode: DeliveryHubShippingOptionManualSyncMode,
  ) => {
    setIsRunningShippingOptionSync(true);
    setShippingOptionSyncError(null);

    try {
      const payload =
        mode === "execute"
          ? buildDeliveryHubShippingOptionManualSyncExecuteRequest({
              confirm_execute: shippingOptionSyncExecuteGuard,
              service_zone_id: shippingOptionSyncServiceZoneId,
              shipping_profile_id: shippingOptionSyncShippingProfileId,
              on_error: shippingOptionSyncErrorMode,
            })
          : buildDeliveryHubShippingOptionManualSyncDryRunRequest({
              on_error: shippingOptionSyncErrorMode,
            });

      const result = await requestJson<{
        ok: boolean;
        sync: DeliveryHubShippingOptionManualSyncResponse;
      }>("/admin/delivery/shipping-options/sync", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setShippingOptionSyncResult(result.sync);

      if (mode === "execute") {
        setShippingOptionSyncExecuteGuard("");
      }

      await loadData(true);
    } catch (error) {
      if (error instanceof Error) {
        setShippingOptionSyncError({
          status: 400,
          code: "DELIVERY_HUB_MANUAL_SYNC_UI_ERROR",
          message: error.message,
          details: null,
        });
      } else {
        setShippingOptionSyncError(error as ApiErrorPayload);
      }
    } finally {
      setIsRunningShippingOptionSync(false);
    }
  };

  const handleLoadShipmentOperations = async () => {
    setIsLoadingShipmentOperations(true);
    setShipmentOperationsError(null);
    setShipmentOperationsNotice(null);

    try {
      const payload = await requestJson<DeliveryHubShipmentOperationsResponse>(
        buildShipmentOperationsSnapshotUrl(
          shipmentOperationsForm.execution_reference,
        ),
        {
          method: "GET",
        },
      );

      setShipmentOperationsSnapshot(payload.operations);
      setShipmentOperationsNotice("Shipment operations snapshot loaded");
    } catch (error) {
      if (error instanceof Error) {
        setShipmentOperationsError({
          status: 400,
          code: "DELIVERY_HUB_SHIPMENT_OPERATIONS_UI_ERROR",
          message: error.message,
          details: null,
        });
      } else {
        setShipmentOperationsError(error as ApiErrorPayload);
      }
      setShipmentOperationsSnapshot(null);
    } finally {
      setIsLoadingShipmentOperations(false);
    }
  };

  const handleRefreshShipmentStatus = async () => {
    setIsRefreshingShipmentStatus(true);
    setShipmentOperationsError(null);
    setShipmentOperationsNotice(null);

    try {
      const payload =
        await requestJson<DeliveryHubShipmentOperationsRefreshResponse>(
          buildShipmentOperationsRefreshStatusUrl(
            shipmentOperationsForm.execution_reference,
          ),
          {
            method: "POST",
            body: JSON.stringify(
              buildShipmentOperationsRefreshStatusRequestBody(),
            ),
          },
        );

      setShipmentOperationsSnapshot(payload.operations);
      setShipmentOperationsNotice(
        `Status refresh returned ${String(payload.refresh?.status ?? "result")}`,
      );
    } catch (error) {
      if (error instanceof Error) {
        setShipmentOperationsError({
          status: 400,
          code: "DELIVERY_HUB_SHIPMENT_STATUS_REFRESH_UI_ERROR",
          message: error.message,
          details: null,
        });
      } else {
        setShipmentOperationsError(error as ApiErrorPayload);
      }
    } finally {
      setIsRefreshingShipmentStatus(false);
    }
  };

  const handleCancelShipment = async () => {
    setIsCancellingShipment(true);
    setShipmentOperationsError(null);
    setShipmentOperationsNotice(null);

    try {
      const payload =
        await requestJson<DeliveryHubShipmentOperationsCancelResponse>(
          buildShipmentOperationsCancelUrl(
            shipmentOperationsForm.execution_reference,
          ),
          {
            method: "POST",
            body: JSON.stringify(buildShipmentOperationsCancelRequestBody()),
          },
        );

      setShipmentOperationsSnapshot(payload.operations);
      setShipmentOperationsNotice(
        `Cancel returned ${String(payload.cancel?.status ?? "result")}`,
      );
    } catch (error) {
      if (error instanceof Error) {
        setShipmentOperationsError({
          status: 400,
          code: "DELIVERY_HUB_SHIPMENT_CANCEL_UI_ERROR",
          message: error.message,
          details: null,
        });
      } else {
        setShipmentOperationsError(error as ApiErrorPayload);
      }
    } finally {
      setIsCancellingShipment(false);
    }
  };

  const handleRetryShipment = async () => {
    setIsRetryingShipment(true);
    setShipmentOperationsError(null);
    setShipmentOperationsNotice(null);

    try {
      const payload =
        await requestJson<DeliveryHubShipmentOperationsRetryResponse>(
          buildShipmentOperationsRetryUrl(
            shipmentOperationsForm.execution_reference,
          ),
          {
            method: "POST",
            body: JSON.stringify({}),
          },
        );

      setShipmentOperationsSnapshot(payload.operations);
      setShipmentOperationsNotice(
        `Retry returned ${String(payload.retry?.status ?? "result")}`,
      );
    } catch (error) {
      if (error instanceof Error) {
        setShipmentOperationsError({
          status: 400,
          code: "DELIVERY_HUB_SHIPMENT_RETRY_UI_ERROR",
          message: error.message,
          details: null,
        });
      } else {
        setShipmentOperationsError(error as ApiErrorPayload);
      }
    } finally {
      setIsRetryingShipment(false);
    }
  };

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <div>
          <Heading level="h1">Доставка</Heading>
          <Text className="text-ui-fg-subtle mt-2">
            Панель ручного тестирования Delivery Hub. Боевые shipment-операции
            остаются закрытыми и по умолчанию выключены.
          </Text>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void loadData(true)}
          isLoading={isRefreshing}
        >
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 px-6 py-4">
        {pageError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <Text className="text-ui-fg-error font-medium">
              {pageError.message}
            </Text>
            <Text className="text-ui-fg-subtle mt-1">
              {pageError.code} · HTTP {pageError.status}
            </Text>
          </div>
        ) : null}

        {observedEncryptionDisabled ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <Text className="font-medium text-amber-800">
              Credentials encryption is disabled on backend
            </Text>
            <Text className="mt-1 text-sm text-amber-700">
              Token fields stay write-only, but backend cannot seal new
              credentials until the encryption key is configured.
            </Text>
          </div>
        ) : null}

        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer text-base font-medium">
            Расширенная диагностика: провайдеры и capabilities
          </summary>
          <Text className="text-ui-fg-subtle mt-2">
            Технический список Delivery Hub adapters и поддерживаемых
            diagnostics/capabilities. Для базового тестирования он не нужен.
          </Text>

          <div className="mt-4 grid gap-4">
            {providers.length ? (
              providers.map((provider) => (
                <div key={provider.code} className="rounded-md border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <Text className="font-medium">{provider.label}</Text>
                      <Text className="text-ui-fg-subtle text-sm">
                        code: {provider.code}
                      </Text>
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
              <Text className="text-ui-fg-subtle">
                No providers returned by backend.
              </Text>
            )}
          </div>
        </details>

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Heading level="h2">1. Подключение Яндекс Доставки</Heading>
              <Text className="text-ui-fg-subtle mt-2">
                Создайте или выберите сохранённое подключение. Токен вводится
                только при создании или ротации; пустое поле при редактировании
                означает «оставить сохранённый sealed token».
              </Text>
            </div>
            <Button type="button" variant="secondary" onClick={startCreate}>
              Новое подключение Yandex
            </Button>
          </div>

          <div className="mt-4 grid gap-3">
            {yandexConnections.length ? (
              yandexConnections.map((connection) => {
                const isActive = connection.id === activeConnectionId;

                return (
                  <button
                    key={connection.id}
                    type="button"
                    onClick={() => setActiveConnectionId(connection.id)}
                    className={`rounded-md border p-4 text-left transition-colors ${
                      isActive
                        ? "border-ui-border-interactive bg-ui-bg-subtle"
                        : "hover:bg-ui-bg-subtle"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Text className="font-medium">{connection.name}</Text>
                        <Text className="text-ui-fg-subtle text-sm">
                          {connection.provider_code} · {connection.mode} ·{" "}
                          {connection.country_code}
                        </Text>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-2 py-1 text-xs ${statusToneClass(connection.status)}`}
                        >
                          status: {connection.status}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-1 text-xs ${statusToneClass(
                            connection.credentials_state,
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
                      <Text>
                        Credentials present:{" "}
                        {connection.credentials_present ? "yes" : "no"}
                      </Text>
                      <Text>
                        Fingerprint: {connection.credentials_fingerprint || "—"}{" "}
                        · validated:{" "}
                        {formatTimestamp(
                          connection.credentials_last_validated_at,
                        )}
                      </Text>
                      <Text>
                        Last credential error:{" "}
                        {connection.credentials_last_error_code || "—"}
                      </Text>
                      <Text>
                        Updated: {formatTimestamp(connection.updated_at)}
                      </Text>
                    </div>
                  </button>
                );
              })
            ) : (
              <Text className="text-ui-fg-subtle">
                Подключений Yandex пока нет.
              </Text>
            )}
          </div>

          <div className="mt-6 rounded-md border p-4">
            <Heading level="h3">
              {activeConnectionId
                ? "Редактировать выбранное подключение"
                : "Создать подключение Yandex"}
            </Heading>
            <Text className="text-ui-fg-subtle mt-1 text-sm">
              Токен остаётся write-only: после сохранения он не показывается
              оператору. При редактировании оставьте поле пустым, чтобы
              сохранить текущий sealed token.
            </Text>

            {formError ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                <Text className="text-ui-fg-error font-medium">
                  {formError.message}
                </Text>
                <Text className="text-ui-fg-subtle mt-1">
                  {formError.code} · HTTP {formError.status}
                </Text>
              </div>
            ) : null}

            {formNotice ? (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
                <Text className="font-medium text-green-800">{formNotice}</Text>
              </div>
            ) : null}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="connection-name">Название</Label>
                <Input
                  id="connection-name"
                  value={connectionForm.name}
                  onChange={(event) =>
                    handleFormField("name", event.target.value)
                  }
                  placeholder="Yandex test"
                />
              </div>

              <div>
                <Label htmlFor="connection-country">Код страны</Label>
                <Input
                  id="connection-country"
                  value={connectionForm.country_code}
                  onChange={(event) =>
                    handleFormField("country_code", event.target.value)
                  }
                  placeholder="RU"
                />
              </div>

              <div>
                <Label htmlFor="connection-mode">Режим</Label>
                <select
                  id="connection-mode"
                  value={connectionForm.mode}
                  onChange={(event) =>
                    handleFormField(
                      "mode",
                      event.target.value as DeliveryConnectionForm["mode"],
                    )
                  }
                  className="bg-ui-bg-field shadow-borders-base txt-compact-small text-ui-fg-base focus-visible:shadow-borders-interactive-with-active h-10 w-full rounded-md px-3 outline-none"
                >
                  <option value="test">test</option>
                  <option value="live">live</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="connection-default-warehouse">
                  Склад по умолчанию
                </Label>
                <select
                  id="connection-default-warehouse"
                  value={connectionForm.default_warehouse_id}
                  onChange={(event) =>
                    handleFormField("default_warehouse_id", event.target.value)
                  }
                  className="bg-ui-bg-field shadow-borders-base txt-compact-small text-ui-fg-base focus-visible:shadow-borders-interactive-with-active h-10 w-full rounded-md px-3 outline-none"
                >
                  <option value="">Без склада по умолчанию</option>
                  {yandexWarehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {getWarehouseOptionLabel(warehouse)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <FieldLabel
                  htmlFor="connection-token"
                  required={!activeConnection?.credentials_present}
                >
                  Write-only токен
                </FieldLabel>
                <Input
                  id="connection-token"
                  type="password"
                  value={connectionForm.token}
                  onChange={(event) =>
                    handleFormField("token", event.target.value)
                  }
                  placeholder={
                    activeConnectionId
                      ? "Оставьте пустым, чтобы сохранить текущий sealed token"
                      : "Вставьте Yandex token"
                  }
                />
                <Text className="text-ui-fg-subtle mt-2 text-sm">
                  {getFieldRequirementText({
                    field: "token",
                    hasSavedToken: !!activeConnection?.credentials_present,
                  })}
                </Text>
              </div>

              <details className="md:col-span-2 rounded-md border p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  Расширенные настройки подключения
                </summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <FieldLabel htmlFor="connection-label-format" required={false}>
                      Формат label
                    </FieldLabel>
                    <select
                      id="connection-label-format"
                      value={connectionForm.label_format}
                      onChange={(event) =>
                        handleFormField("label_format", event.target.value)
                      }
                      className="bg-ui-bg-field shadow-borders-base txt-compact-small text-ui-fg-base focus-visible:shadow-borders-interactive-with-active mt-1 h-10 w-full rounded-md px-3 outline-none"
                    >
                      {labelFormatOptions.map((option) => (
                        <option key={option || "default"} value={option}>
                          {option || "Формат провайдера по умолчанию"}
                        </option>
                      ))}
                    </select>
                    <Text className="text-ui-fg-subtle mt-2 text-sm">
                      {getFieldRequirementText({ field: "label_format" })}
                    </Text>
                  </div>

                  <div>
                    <FieldLabel htmlFor="connection-api-base-url" required={false}>
                      Yandex API host
                    </FieldLabel>
                    <select
                      id="connection-api-base-url"
                      value={connectionForm.api_base_url}
                      onChange={(event) =>
                        handleFormField("api_base_url", event.target.value)
                      }
                      className="bg-ui-bg-field shadow-borders-base txt-compact-small text-ui-fg-base focus-visible:shadow-borders-interactive-with-active mt-1 h-10 w-full rounded-md px-3 outline-none"
                    >
                      {yandexApiBaseUrlOptions.map((option) => (
                        <option key={option.value || "auto"} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <Text className="text-ui-fg-subtle mt-2 text-sm">
                      {getFieldRequirementText({ field: "api_host" })}
                    </Text>
                  </div>

                  <div className="flex items-center justify-between rounded-md border p-4 md:col-span-2">
                    <div>
                      <Text className="font-medium">
                        Auto confirm <RequirementBadge required={false} />
                      </Text>
                      <Text className="text-ui-fg-subtle text-sm">
                        {getFieldRequirementText({ field: "auto_confirm" })}
                      </Text>
                    </div>
                    <Switch
                      checked={connectionForm.auto_confirm}
                      onCheckedChange={(checked) =>
                        handleFormField("auto_confirm", checked)
                      }
                    />
                  </div>
                </div>
              </details>

              <div className="flex items-center justify-between rounded-md border p-4">
                <div>
                  <Text className="font-medium">Включено</Text>
                  <Text className="text-ui-fg-subtle text-sm">
                    Подключение участвует в диагностике и planner state.
                  </Text>
                </div>
                <Switch
                  checked={connectionForm.enabled}
                  onCheckedChange={(checked) =>
                    handleFormField("enabled", checked)
                  }
                />
              </div>

            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() => void handleSave()}
                isLoading={isSaving}
                disabled={isLoading}
              >
                {activeConnectionId
                  ? "Сохранить подключение"
                  : "Создать подключение"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={startCreate}
                disabled={isSaving || isDeletingConnection}
              >
                Сбросить форму
              </Button>
              {activeConnectionId ? (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => void handleDeleteConnection()}
                  isLoading={isDeletingConnection}
                  disabled={isSaving || isTestingConnection}
                >
                  Удалить подключение
                </Button>
              ) : null}
            </div>
            <Text className="text-ui-fg-subtle mt-2 text-sm">
              Удаление убирает connection из активного Delivery Hub выбора и storefront-каталога; event logs остаются для audit trail и не показывают секреты.
            </Text>
            <Text className="text-ui-fg-subtle mt-2 text-sm">
              {testConnectionCapability.helperText}
            </Text>

          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Heading level="h2">2. Проверить подключение</Heading>
              <Text className="text-ui-fg-subtle mt-2">
                Безопасный read-only вызов к Yandex. Используется сохранённый
                sealed token; секреты и raw provider body не показываются.
              </Text>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleTestConnection()}
              isLoading={isTestingConnection}
              disabled={!testConnectionCapability.canTest || isTestingConnection}
            >
              Проверить подключение
            </Button>
          </div>
          <Text className="text-ui-fg-subtle mt-2 text-sm">
            {testConnectionCapability.helperText}
          </Text>

          <div className="mt-4 flex items-center justify-between rounded-md border p-4">
            <div>
              <Text className="font-medium">
                Дополнительно загрузить количество ПВЗ
              </Text>
              <Text className="text-ui-fg-subtle text-sm">
                Необязательно: включает safe lookup ПВЗ в результат проверки,
                без shipment create/cancel/status/retry.
              </Text>
            </div>
            <Switch
              checked={includePickupPoints}
              onCheckedChange={setIncludePickupPoints}
            />
          </div>

          {testConnectionError ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                <Text className="text-ui-fg-error font-medium">
                  {testConnectionError.message}
                </Text>
                <Text className="text-ui-fg-subtle mt-1">
                  {testConnectionError.code} · HTTP {testConnectionError.status}
                </Text>
              </div>
            ) : null}

            {testConnectionResult ? (
              <div className="mt-4 rounded-md border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Heading level="h3">Диагностика подключения</Heading>
                    <Text className="text-ui-fg-subtle mt-1 text-sm">
                      Provider-level response snapshot from the latest admin
                      test call.
                    </Text>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-1 text-xs ${logSuccessToneClass(testConnectionResult.ok)}`}
                  >
                    {testConnectionResult.ok ? "ready" : "failed"}
                  </span>
                </div>
                <Text className="text-ui-fg-subtle mt-3 text-sm">
                  {getDiagnosticsSummaryText(
                    testConnectionResult.diagnostics_summary,
                  )}
                </Text>
                <pre className="mt-3 overflow-auto rounded-md border bg-ui-bg-subtle p-3 text-xs">
                  {JSON.stringify(testConnectionResult.diagnostics, null, 2)}
                </pre>
              </div>
          ) : null}
        </div>

        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer text-base font-medium">
            Расширенные настройки: склады/source platform_station_id
          </summary>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div>
              <Heading level="h2">Склады Delivery Hub</Heading>
              <Text className="text-ui-fg-subtle mt-2">
                Source records для warehouse_to_pickup_point. Поле
                provider_warehouse_id должно содержать Yandex platform_station_id;
                backend отправляет его как source.platform_station.platform_id.
              </Text>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={startCreateWarehouse}
            >
              Новый склад
            </Button>
          </div>

          <div className="mt-4 grid gap-3">
            {yandexWarehouses.length ? (
              yandexWarehouses.map((warehouse) => {
                const isActive = warehouse.id === activeWarehouseId;

                return (
                  <button
                    key={warehouse.id}
                    type="button"
                    onClick={() => setActiveWarehouseId(warehouse.id)}
                    className={`rounded-md border p-4 text-left transition-colors ${
                      isActive
                        ? "border-ui-border-interactive bg-ui-bg-subtle"
                        : "hover:bg-ui-bg-subtle"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Text className="font-medium">{warehouse.name}</Text>
                        <Text className="text-ui-fg-subtle text-sm">
                          {getWarehouseOptionLabel(warehouse)}
                        </Text>
                      </div>
                      <span className="rounded-full border border-ui-border-base px-2 py-1 text-xs">
                        {warehouse.enabled ? "enabled" : "disabled"}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <Text className="text-ui-fg-subtle">
                No Yandex warehouses configured yet.
              </Text>
            )}
          </div>

          <div className="mt-6 rounded-md border p-4">
            <Heading level="h3">
              {activeWarehouseId
                ? "Редактировать выбранный склад"
                : "Создать склад"}
            </Heading>

            {warehouseFormError ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                <Text className="text-ui-fg-error font-medium">
                  {warehouseFormError.message}
                </Text>
                <Text className="text-ui-fg-subtle mt-1">
                  {warehouseFormError.code} · HTTP {warehouseFormError.status}
                </Text>
              </div>
            ) : null}

            {warehouseFormNotice ? (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
                <Text className="font-medium text-green-800">
                  {warehouseFormNotice}
                </Text>
              </div>
            ) : null}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel htmlFor="warehouse-name" required={true}>
                  Название склада
                </FieldLabel>
                <Input
                  id="warehouse-name"
                  value={warehouseForm.name}
                  onChange={(event) =>
                    handleWarehouseField("name", event.target.value)
                  }
                />
              </div>

              <div>
                <FieldLabel htmlFor="warehouse-country" required={true}>
                  Код страны
                </FieldLabel>
                <Input
                  id="warehouse-country"
                  value={warehouseForm.country_code}
                  onChange={(event) =>
                    handleWarehouseField("country_code", event.target.value)
                  }
                />
              </div>

              <div>
                <FieldLabel htmlFor="warehouse-city" required={false}>
                  Город
                </FieldLabel>
                <Input
                  id="warehouse-city"
                  value={warehouseForm.city}
                  onChange={(event) =>
                    handleWarehouseField("city", event.target.value)
                  }
                />
              </div>

              <div>
                <FieldLabel htmlFor="warehouse-address" required={false}>
                  Адрес
                </FieldLabel>
                <Input
                  id="warehouse-address"
                  value={warehouseForm.address_line_1}
                  onChange={(event) =>
                    handleWarehouseField("address_line_1", event.target.value)
                  }
                />
              </div>

              <div>
                <FieldLabel htmlFor="warehouse-contact-name" required={false}>
                  Контактное лицо
                </FieldLabel>
                <Input
                  id="warehouse-contact-name"
                  value={warehouseForm.contact_name}
                  onChange={(event) =>
                    handleWarehouseField("contact_name", event.target.value)
                  }
                />
              </div>

              <div>
                <FieldLabel htmlFor="warehouse-contact-phone" required={false}>
                  Контактный телефон
                </FieldLabel>
                <Input
                  id="warehouse-contact-phone"
                  value={warehouseForm.contact_phone}
                  onChange={(event) =>
                    handleWarehouseField("contact_phone", event.target.value)
                  }
                />
              </div>

              <div>
                <FieldLabel htmlFor="warehouse-provider-code" required={false}>
                  Provider code
                </FieldLabel>
                <Input
                  id="warehouse-provider-code"
                  value={warehouseForm.provider_code}
                  onChange={(event) =>
                    handleWarehouseField("provider_code", event.target.value)
                  }
                />
              </div>

              <div>
                <FieldLabel htmlFor="warehouse-provider-id" required={true}>
                  Provider warehouse id / platform_station_id
                </FieldLabel>
                <Input
                  id="warehouse-provider-id"
                  value={warehouseForm.provider_warehouse_id}
                  onChange={(event) =>
                    handleWarehouseField(
                      "provider_warehouse_id",
                      event.target.value,
                    )
                  }
                />
                <Text className="text-ui-fg-subtle mt-2 text-sm">
                  {getFieldRequirementText({ field: "warehouse" })}
                </Text>
              </div>

              <div className="md:col-span-2 flex items-center justify-between rounded-md border p-4">
                <div>
                  <Text className="font-medium">Включено</Text>
                  <Text className="text-ui-fg-subtle text-sm">
                    Только включённые склады доступны в расчёте склад → ПВЗ.
                  </Text>
                </div>
                <Switch
                  checked={warehouseForm.enabled}
                  onCheckedChange={(checked) =>
                    handleWarehouseField("enabled", checked)
                  }
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() => void handleSaveWarehouse()}
                isLoading={isSavingWarehouse}
                disabled={isLoading}
              >
                {activeWarehouseId ? "Сохранить склад" : "Создать склад"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={startCreateWarehouse}
                disabled={isSavingWarehouse}
              >
                Сбросить форму
              </Button>
            </div>
          </div>
        </details>

        <div className="rounded-lg border p-4">
          <Heading level="h2">3. Найти ПВЗ</Heading>
          <Text className="text-ui-fg-subtle mt-2">
            Безопасный поиск Yandex pickup points. По документации Yandex для
            тестов используйте geo_id и operator_ids: по умолчанию выбран
            Moscow geo_id=213, operator=market_l4g и только Яндекс-бренд. Найденный id
            используйте как destination PVZ id.
          </Text>
          <Text className="text-ui-fg-subtle mt-2 text-sm">
            {getFieldRequirementText({ field: "five_post" })}
          </Text>

          {pickupPointLookupError ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <Text className="text-ui-fg-error font-medium">
                {pickupPointLookupError.message}
              </Text>
              <Text className="text-ui-fg-subtle mt-1">
                {pickupPointLookupError.code} · HTTP {pickupPointLookupError.status}
              </Text>
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <FieldLabel htmlFor="pickup-point-connection" required={true}>
                Подключение
              </FieldLabel>
              <select
                id="pickup-point-connection"
                value={pickupPointLookupForm.connection_id}
                onChange={(event) =>
                  handlePickupPointLookupField("connection_id", event.target.value)
                }
                className="bg-ui-bg-field shadow-borders-base txt-compact-small text-ui-fg-base focus-visible:shadow-borders-interactive-with-active mt-1 h-10 w-full rounded-md px-3 outline-none"
              >
                <option value="">Выберите подключение</option>
                {yandexConnections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name} · {connection.mode} · {connection.status}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="pickup-point-geo-id" required={false}>
                geo_id
              </FieldLabel>
              <Input
                id="pickup-point-geo-id"
                value={pickupPointLookupForm.geo_id}
                onChange={(event) =>
                  handlePickupPointLookupField("geo_id", event.target.value)
                }
                placeholder="213"
              />
              <Text className="text-ui-fg-subtle mt-1 text-xs">
                213 — Москва в тестовом сценарии.
              </Text>
            </div>
            <div>
              <FieldLabel htmlFor="pickup-point-operator" required={false}>
                Сеть ПВЗ
              </FieldLabel>
              <select
                id="pickup-point-operator"
                value={pickupPointLookupForm.operator_id}
                onChange={(event) =>
                  handlePickupPointLookupField(
                    "operator_id",
                    event.target.value as DeliveryHubPickupPointLookupForm["operator_id"],
                  )
                }
                className="bg-ui-bg-field shadow-borders-base txt-compact-small text-ui-fg-base focus-visible:shadow-borders-interactive-with-active mt-1 h-10 w-full rounded-md px-3 outline-none"
              >
                <option value="market_l4g">Яндекс Маркет / партнёры</option>
                <option value="5post">5 Post</option>
                <option value="">Все сети из каталога Yandex</option>
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="pickup-point-brand" required={false}>
                Яндекс-бренд
              </FieldLabel>
              <select
                id="pickup-point-brand"
                value={pickupPointLookupForm.is_yandex_branded}
                onChange={(event) =>
                  handlePickupPointLookupField(
                    "is_yandex_branded",
                    event.target.value as DeliveryHubPickupPointLookupForm["is_yandex_branded"],
                  )
                }
                className="bg-ui-bg-field shadow-borders-base txt-compact-small text-ui-fg-base focus-visible:shadow-borders-interactive-with-active mt-1 h-10 w-full rounded-md px-3 outline-none"
              >
                <option value="true">Только Яндекс-бренд</option>
                <option value="false">Не Яндекс-бренд</option>
                <option value="">Не фильтровать</option>
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="pickup-point-type" required={false}>
                Тип станции
              </FieldLabel>
              <select
                id="pickup-point-type"
                value={pickupPointLookupForm.station_type}
                onChange={(event) =>
                  handlePickupPointLookupField(
                    "station_type",
                    event.target.value as DeliveryHubPickupPointLookupForm["station_type"],
                  )
                }
                className="bg-ui-bg-field shadow-borders-base txt-compact-small text-ui-fg-base focus-visible:shadow-borders-interactive-with-active mt-1 h-10 w-full rounded-md px-3 outline-none"
              >
                <option value="pickup_point">ПВЗ</option>
                <option value="terminal">Постамат/terminal</option>
                <option value="warehouse">Склад/warehouse</option>
                <option value="">Все типы</option>
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="pickup-point-id" required={false}>
                Точный id ПВЗ
              </FieldLabel>
              <Input
                id="pickup-point-id"
                value={pickupPointLookupForm.pickup_point_id}
                onChange={(event) =>
                  handlePickupPointLookupField("pickup_point_id", event.target.value)
                }
                placeholder="e1139f6d-e34f-47a9-a55f-31f032a861a6"
              />
            </div>
            <div>
              <FieldLabel htmlFor="pickup-point-dropoff" required={false}>
                Origin dropoff
              </FieldLabel>
              <select
                id="pickup-point-dropoff"
                value={pickupPointLookupForm.available_for_dropoff}
                onChange={(event) =>
                  handlePickupPointLookupField(
                    "available_for_dropoff",
                    event.target.value as DeliveryHubPickupPointLookupForm["available_for_dropoff"],
                  )
                }
                className="bg-ui-bg-field shadow-borders-base txt-compact-small text-ui-fg-base focus-visible:shadow-borders-interactive-with-active mt-1 h-10 w-full rounded-md px-3 outline-none"
              >
                <option value="">Не фильтровать</option>
                <option value="true">Только available_for_dropoff=true</option>
                <option value="false">Только false</option>
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="pickup-point-country" required={false}>
                Страна
              </FieldLabel>
              <Input
                id="pickup-point-country"
                value={pickupPointLookupForm.country_code}
                onChange={(event) =>
                  handlePickupPointLookupField("country_code", event.target.value)
                }
                placeholder="RU"
              />
            </div>
            <div>
              <FieldLabel htmlFor="pickup-point-limit" required={false}>
                Лимит
              </FieldLabel>
              <Input
                id="pickup-point-limit"
                value={pickupPointLookupForm.limit}
                onChange={(event) =>
                  handlePickupPointLookupField("limit", event.target.value)
                }
                placeholder="20"
              />
            </div>
          </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void handleLoadPickupPoints()}
                isLoading={isLoadingPickupPoints}
                disabled={isLoading || isLoadingPickupPoints}
              >
                Найти ПВЗ
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleUseYandexSandboxPickupPoint}
                disabled={isLoading || isLoadingPickupPoints}
              >
                Использовать тестовый PVZ Яндекса
              </Button>
            </div>
            <Text className="text-ui-fg-subtle mt-2 text-xs">
              Проверенный sandbox PVZ: {YANDEX_VERIFIED_SANDBOX_PVZ.id} · {YANDEX_VERIFIED_SANDBOX_PVZ.label}. Кнопка сразу подставит его в Test quote и exact lookup filter.
            </Text>

            {pickupPointLookupResult ? (
            <div className="mt-6 grid gap-3">
              <Text className="text-ui-fg-subtle text-sm">
                Найдено {pickupPointLookupResult.returned_count} из {pickupPointLookupResult.total_available}; correlation={pickupPointLookupResult.correlation_id}
              </Text>
              {pickupPointLookupResult.points.map((point) => (
                <div key={point.id} className="rounded-md border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Text className="font-medium">{point.name}</Text>
                      <Text className="text-ui-fg-subtle text-sm">
                        {getPickupPointOptionLabel(point)}
                      </Text>
                      <Text className="text-ui-fg-subtle mt-1 text-sm">
                        Провайдер: Yandex · Сеть ПВЗ: {point.network_label || point.operator_id || "не указана"}
                      </Text>
                      {point.id === YANDEX_VERIFIED_SANDBOX_PVZ.id ? (
                        <Text className="text-ui-fg-interactive mt-1 text-sm">
                          Verified sandbox PVZ для тестового склада Yandex.
                        </Text>
                      ) : null}
                      <Text className="text-ui-fg-subtle mt-1 text-sm">
                        {point.address || "Адрес не указан"}
                      </Text>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleUsePickupPointAsDestination(point.id)}
                      >
                        Использовать как destination
                      </Button>
                      {point.available_for_dropoff ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => handleUsePickupPointAsOrigin(point.id)}
                        >
                          Использовать как origin dropoff
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer text-base font-medium">
            Техническая диагностика: shipping options, fulfillment bridge, execution plan, shipment operations
          </summary>
          <div className="mt-4 grid gap-6">

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Heading level="h2">Shipping option preview</Heading>
              <Text className="text-ui-fg-subtle mt-2">
                Admin-only read preview for desired and reconciled deliveryhub
                shipping-option state. No sync or write side-effects.
              </Text>
            </div>
            <Text className="text-ui-fg-subtle text-sm">
              {previewRenderState.headerText}
            </Text>
          </div>

          {shippingOptionPreview ? (
            <div className="mt-4 grid gap-6">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {previewRenderState.summaryCards.map((card) => (
                  <div key={card.key} className="rounded-md border p-3">
                    <Text className="text-ui-fg-subtle text-xs">
                      {card.label}
                    </Text>
                    <Text className="mt-2 font-medium">{card.value}</Text>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-md border p-4">
                  <Heading level="h3">Desired projected options</Heading>
                  <Text className="text-ui-fg-subtle mt-1 text-sm">
                    Canonical deliveryhub options that planner currently
                    considers rollout-ready.
                  </Text>
                  <div className="mt-4 grid gap-3">
                    {previewRenderState.desiredOptions.length ? (
                      previewRenderState.desiredOptions.map((option) => (
                        <div key={option.key} className="rounded-md border p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <Text className="font-medium">
                                {option.modeCode}
                              </Text>
                              <Text className="text-ui-fg-subtle text-sm">
                                {option.id}
                              </Text>
                            </div>
                            <span className="rounded-full border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700">
                              projected
                            </span>
                          </div>
                          <Text className="text-ui-fg-subtle mt-3 text-sm">
                            Supporting connections:{" "}
                            {option.supportingConnectionsText}
                          </Text>
                        </div>
                      ))
                    ) : (
                      <Text className="text-ui-fg-subtle">
                        {previewRenderState.desiredEmptyText}
                      </Text>
                    )}
                  </div>
                </div>

                <div className="rounded-md border p-4">
                  <Heading level="h3">Deferred rollout state</Heading>
                  <Text className="text-ui-fg-subtle mt-1 text-sm">
                    Deferred options and truthful planner issues blocking
                    deliveryhub shipping-option rollout.
                  </Text>
                  <div className="mt-4 grid gap-3">
                    {previewRenderState.deferredOptions.length ? (
                      previewRenderState.deferredOptions.map((option) => (
                        <div key={option.key} className="rounded-md border p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <Text className="font-medium">
                                {option.modeCode}
                              </Text>
                              <Text className="text-ui-fg-subtle text-sm">
                                {option.id}
                              </Text>
                            </div>
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
                              deferred
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2">
                            {option.issues.map((issue) => (
                              <div
                                key={issue.key}
                                className="rounded-md border border-amber-200 bg-amber-50 p-3"
                              >
                                <Text className="font-medium text-amber-800">
                                  {issue.code}
                                </Text>
                                <Text className="mt-1 text-sm text-amber-700">
                                  {issue.message}
                                </Text>
                                <Text className="mt-2 text-xs text-amber-700">
                                  {issue.connectionText}
                                </Text>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <Text className="text-ui-fg-subtle">
                        {previewRenderState.deferredEmptyText}
                      </Text>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-md border p-4">
                <Heading level="h3">Reconciliation buckets</Heading>
                <Text className="text-ui-fg-subtle mt-1 text-sm">
                  Summary over create, update, unchanged, orphaned managed and
                  ignored foreign shipping options. Preview remains read-only.
                </Text>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-md border p-3">
                    <Text className="text-ui-fg-subtle text-xs">
                      create_candidates
                    </Text>
                    <Text className="mt-2 font-medium">
                      {previewRenderState.reconciliationCounts.createCandidates}
                    </Text>
                  </div>
                  <div className="rounded-md border p-3">
                    <Text className="text-ui-fg-subtle text-xs">
                      update_candidates
                    </Text>
                    <Text className="mt-2 font-medium">
                      {previewRenderState.reconciliationCounts.updateCandidates}
                    </Text>
                  </div>
                  <div className="rounded-md border p-3">
                    <Text className="text-ui-fg-subtle text-xs">unchanged</Text>
                    <Text className="mt-2 font-medium">
                      {previewRenderState.reconciliationCounts.unchanged}
                    </Text>
                  </div>
                  <div className="rounded-md border p-3">
                    <Text className="text-ui-fg-subtle text-xs">
                      orphaned_managed_options
                    </Text>
                    <Text className="mt-2 font-medium">
                      {previewRenderState.reconciliationCounts.orphanedManaged}
                    </Text>
                  </div>
                  <div className="rounded-md border p-3">
                    <Text className="text-ui-fg-subtle text-xs">
                      ignored_foreign_options
                    </Text>
                    <Text className="mt-2 font-medium">
                      {previewRenderState.reconciliationCounts.ignoredForeign}
                    </Text>
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  <details className="rounded-md border p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Create candidates (
                      {previewRenderState.createCandidates.length})
                    </summary>
                    <div className="mt-3 grid gap-2">
                      {previewRenderState.createCandidates.length ? (
                        previewRenderState.createCandidates.map((candidate) => (
                          <div
                            key={candidate.key}
                            className="rounded-md border p-3"
                          >
                            <Text className="font-medium">
                              {candidate.title}
                            </Text>
                            <Text className="text-ui-fg-subtle mt-1 text-sm">
                              {candidate.subtitle}
                            </Text>
                          </div>
                        ))
                      ) : (
                        <Text className="text-ui-fg-subtle text-sm">
                          No create candidates.
                        </Text>
                      )}
                    </div>
                  </details>

                  <details className="rounded-md border p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Update candidates (
                      {previewRenderState.updateCandidates.length})
                    </summary>
                    <div className="mt-3 grid gap-2">
                      {previewRenderState.updateCandidates.length ? (
                        previewRenderState.updateCandidates.map((candidate) => (
                          <div
                            key={candidate.key}
                            className="rounded-md border p-3"
                          >
                            <Text className="font-medium">
                              {candidate.title}
                            </Text>
                            <Text className="text-ui-fg-subtle mt-1 text-sm">
                              {candidate.subtitle}
                            </Text>
                          </div>
                        ))
                      ) : (
                        <Text className="text-ui-fg-subtle text-sm">
                          No update candidates.
                        </Text>
                      )}
                    </div>
                  </details>

                  <details className="rounded-md border p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Unchanged ({previewRenderState.unchangedEntries.length})
                    </summary>
                    <div className="mt-3 grid gap-2">
                      {previewRenderState.unchangedEntries.length ? (
                        previewRenderState.unchangedEntries.map((entry) => (
                          <div
                            key={entry.key}
                            className="rounded-md border p-3"
                          >
                            <Text className="font-medium">{entry.title}</Text>
                            <Text className="text-ui-fg-subtle mt-1 text-sm">
                              {entry.subtitle}
                            </Text>
                          </div>
                        ))
                      ) : (
                        <Text className="text-ui-fg-subtle text-sm">
                          No unchanged managed options.
                        </Text>
                      )}
                    </div>
                  </details>

                  <details className="rounded-md border p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Orphaned managed (
                      {previewRenderState.orphanedManagedEntries.length})
                    </summary>
                    <div className="mt-3 grid gap-2">
                      {previewRenderState.orphanedManagedEntries.length ? (
                        previewRenderState.orphanedManagedEntries.map(
                          (entry) => (
                            <div
                              key={entry.key}
                              className="rounded-md border p-3"
                            >
                              <Text className="font-medium">{entry.title}</Text>
                              <Text className="text-ui-fg-subtle mt-1 text-sm">
                                {entry.subtitle}
                              </Text>
                            </div>
                          ),
                        )
                      ) : (
                        <Text className="text-ui-fg-subtle text-sm">
                          No orphaned managed options.
                        </Text>
                      )}
                    </div>
                  </details>

                  <details className="rounded-md border p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Ignored foreign (
                      {previewRenderState.ignoredForeignEntries.length})
                    </summary>
                    <div className="mt-3 grid gap-2">
                      {previewRenderState.ignoredForeignEntries.length ? (
                        previewRenderState.ignoredForeignEntries.map(
                          (entry) => (
                            <div
                              key={entry.key}
                              className="rounded-md border p-3"
                            >
                              <Text className="font-medium">{entry.title}</Text>
                              <Text className="text-ui-fg-subtle mt-1 text-sm">
                                {entry.subtitle}
                              </Text>
                            </div>
                          ),
                        )
                      ) : (
                        <Text className="text-ui-fg-subtle text-sm">
                          No ignored foreign options.
                        </Text>
                      )}
                    </div>
                  </details>
                </div>
              </div>

              <div className="rounded-md border p-4">
                <Heading level="h3">Per-connection planner state</Heading>
                <Text className="text-ui-fg-subtle mt-1 text-sm">
                  Read-only planner status for each configured delivery
                  connection.
                </Text>
                <div className="mt-4 grid gap-3">
                  {previewRenderState.connectionPlans.length ? (
                    previewRenderState.connectionPlans.map((plan) => (
                      <div key={plan.key} className="rounded-md border p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <Text className="font-medium">
                              {plan.connectionId}
                            </Text>
                            <Text className="text-ui-fg-subtle text-sm">
                              provider: {plan.providerCode}
                            </Text>
                          </div>
                          <span
                            className={`rounded-full border px-2 py-1 text-xs ${plannerStatusToneClass(plan.status)}`}
                          >
                            {plan.status}
                          </span>
                        </div>
                        <Text className="text-ui-fg-subtle mt-3 text-sm">
                          projected modes: {plan.projectedModesText}
                        </Text>
                        {plan.issues.length ? (
                          <div className="mt-3 grid gap-2">
                            {plan.issues.map((issue) => (
                              <div
                                key={issue.key}
                                className="rounded-md border bg-ui-bg-subtle p-3"
                              >
                                <Text className="font-medium">
                                  {issue.code}
                                </Text>
                                <Text className="text-ui-fg-subtle mt-1 text-sm">
                                  {issue.message}
                                </Text>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <Text className="text-ui-fg-subtle">
                      {previewRenderState.connectionPlansEmptyText}
                    </Text>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <Text className="text-ui-fg-subtle mt-4">
              No shipping-option preview returned by backend.
            </Text>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Heading level="h2">Fulfillment bridge readiness preview</Heading>
              <Text className="text-ui-fg-subtle mt-2">
                Read-only backend/admin preview for deliveryhub fulfillment
                bridge payload assembly. No shipment execution, checkout cutover
                or state mutation occurs.
              </Text>
            </div>
            <Text className="text-ui-fg-subtle text-sm">
              {fulfillmentBridgeRenderState.headerText}
            </Text>
          </div>

          {fulfillmentBridgePreview ? (
            <div className="mt-4 grid gap-6">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {fulfillmentBridgeRenderState.summaryCards.map((card) => (
                  <div key={card.key} className="rounded-md border p-3">
                    <Text className="text-ui-fg-subtle text-xs">
                      {card.label}
                    </Text>
                    <Text className="mt-2 font-medium">{card.value}</Text>
                  </div>
                ))}
              </div>

              <div className="grid gap-3">
                {fulfillmentBridgeRenderState.modePreviews.map((mode) => (
                  <div key={mode.key} className="rounded-md border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Text className="font-medium">{mode.modeCode}</Text>
                        <Text className="text-ui-fg-subtle mt-1 text-sm">
                          supporting connections:{" "}
                          {mode.supportingConnectionsText}
                        </Text>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-2 py-1 text-xs ${plannerStatusToneClass(mode.rolloutStatus)}`}
                        >
                          rollout: {mode.rolloutStatus}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-1 text-xs ${plannerStatusToneClass(mode.status === "ready" ? "projected" : "deferred")}`}
                        >
                          bridge: {mode.status}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-md border p-3">
                        <Text className="text-ui-fg-subtle text-xs">
                          Validated steps
                        </Text>
                        <Text className="mt-2 font-medium">
                          {mode.stepReadinessText}
                        </Text>
                      </div>
                      <div className="rounded-md border p-3 md:col-span-2">
                        <Text className="text-ui-fg-subtle text-xs">
                          Shipment execution
                        </Text>
                        <Text className="mt-2 text-sm">
                          {mode.shipmentExecutionText}
                        </Text>
                      </div>
                    </div>

                    {mode.issueBadges.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {mode.issueBadges.map((issue) => (
                          <span
                            key={issue.key}
                            className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700"
                          >
                            {issue.label}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {mode.errorText ? (
                      <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
                        <Text className="font-medium text-red-700">
                          Preview error
                        </Text>
                        <Text className="mt-1 text-sm text-red-700">
                          {mode.errorText}
                        </Text>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Text className="text-ui-fg-subtle mt-4">
              {fulfillmentBridgeRenderState.emptyText}
            </Text>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Heading level="h2">Execution-plan observability preview</Heading>
              <Text className="text-ui-fg-subtle mt-2">
                Admin-only diagnostic preview for exact redacted shipment
                planning state. No network calls, shipment execution or checkout
                cutover occurs.
              </Text>
            </div>
            <Text className="text-ui-fg-subtle text-sm">
              {executionPlanRenderState.headerText}
            </Text>
          </div>

          {executionPlanPreview ? (
            <div className="mt-4 grid gap-6">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                {executionPlanRenderState.summaryCards.map((card) => (
                  <div key={card.key} className="rounded-md border p-3">
                    <Text className="text-ui-fg-subtle text-xs">
                      {card.label}
                    </Text>
                    <Text className="mt-2 font-medium">{card.value}</Text>
                  </div>
                ))}
              </div>

              <div className="grid gap-3">
                {executionPlanRenderState.modePreviews.map((mode) => (
                  <div key={mode.key} className="rounded-md border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Text className="font-medium">{mode.modeCode}</Text>
                        <Text className="text-ui-fg-subtle mt-1 text-sm">
                          supporting connections:{" "}
                          {mode.supportingConnectionsText}
                        </Text>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-2 py-1 text-xs ${plannerStatusToneClass(mode.rolloutStatus)}`}
                        >
                          rollout: {mode.rolloutStatus}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-1 text-xs ${plannerStatusToneClass(
                            mode.status === "ready" ? "projected" : "deferred",
                          )}`}
                        >
                          preview: {mode.status}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 xl:grid-cols-2">
                      <div className="rounded-md border p-3">
                        <Text className="text-ui-fg-subtle text-xs">
                          Readiness verdict
                        </Text>
                        <Text className="mt-2 text-sm">
                          {mode.readinessText}
                        </Text>
                      </div>
                      <div className="rounded-md border p-3">
                        <Text className="text-ui-fg-subtle text-xs">
                          Validated steps
                        </Text>
                        <Text className="mt-2 font-medium">
                          {mode.stepReadinessText}
                        </Text>
                      </div>
                      <div className="rounded-md border p-3 xl:col-span-2">
                        <Text className="text-ui-fg-subtle text-xs">
                          Blocked reasons
                        </Text>
                        <Text className="mt-2 text-sm">
                          {mode.blockedReasonsText}
                        </Text>
                      </div>
                      <div className="rounded-md border p-3">
                        <Text className="text-ui-fg-subtle text-xs">
                          Execution plan
                        </Text>
                        <Text className="mt-2 text-sm">
                          {mode.executionPlanText}
                        </Text>
                      </div>
                      <div className="rounded-md border p-3">
                        <Text className="text-ui-fg-subtle text-xs">
                          Shipment execution
                        </Text>
                        <Text className="mt-2 text-sm">
                          {mode.shipmentExecutionText}
                        </Text>
                      </div>
                      <div className="rounded-md border p-3 xl:col-span-2">
                        <Text className="text-ui-fg-subtle text-xs">
                          Execution gate / preflight eligibility
                        </Text>
                        <Text className="mt-2 text-sm">
                          {mode.preflightEligibilityText}
                        </Text>
                        <Text className="text-ui-fg-subtle mt-2 text-xs">
                          Future prerequisites:{" "}
                          {mode.preflightPrerequisitesText}
                        </Text>
                        <Text className="text-ui-fg-subtle mt-1 text-xs">
                          Blocked live actions: {mode.blockedLiveActionsText}
                        </Text>
                      </div>
                      <div className="rounded-md border p-3 xl:col-span-2">
                        <Text className="text-ui-fg-subtle text-xs">
                          Provider dispatch command preview
                        </Text>
                        <Text className="mt-2 text-sm">
                          {mode.providerDispatchText}
                        </Text>
                        <Text className="text-ui-fg-subtle mt-2 text-xs">
                          Blocked dispatch actions:{" "}
                          {mode.blockedDispatchActionsText}
                        </Text>
                      </div>
                      <div className="rounded-md border p-3 xl:col-span-2">
                        <Text className="text-ui-fg-subtle text-xs">
                          Normalized shipment result preview
                        </Text>
                        <Text className="mt-2 text-sm">
                          {mode.shipmentResultText}
                        </Text>
                        <Text className="text-ui-fg-subtle mt-2 text-xs">
                          Blocked materialization actions:{" "}
                          {mode.blockedMaterializationActionsText}
                        </Text>
                      </div>
                      <div className="rounded-md border p-3 xl:col-span-2">
                        <Text className="text-ui-fg-subtle text-xs">
                          Fulfillment application mutation preview
                        </Text>
                        <Text className="mt-2 text-sm">
                          {mode.applicationPreviewText}
                        </Text>
                        <Text className="text-ui-fg-subtle mt-2 text-xs">
                          Blocked application actions:{" "}
                          {mode.blockedApplicationActionsText}
                        </Text>
                      </div>
                      <div className="rounded-md border p-3 xl:col-span-2">
                        <Text className="text-ui-fg-subtle text-xs">
                          Execution lifecycle timeline preview
                        </Text>
                        <Text className="mt-2 text-sm">
                          {mode.lifecycleStatusText}
                        </Text>
                        <Text className="text-ui-fg-subtle mt-2 text-xs">
                          Phase sequence: {mode.lifecyclePhaseSequenceText}
                        </Text>
                        <Text className="text-ui-fg-subtle mt-1 text-xs">
                          Identity correlation: {mode.lifecycleIdentityText}
                        </Text>
                        <Text className="text-ui-fg-subtle mt-1 text-xs">
                          Disabled live confirmations:{" "}
                          {mode.lifecycleDisabledActionsText}
                        </Text>
                        <div className="mt-3 overflow-auto rounded-md border">
                          <table className="min-w-full divide-y text-left text-xs">
                            <thead className="bg-ui-bg-subtle">
                              <tr>
                                <th className="px-3 py-2 font-medium">#</th>
                                <th className="px-3 py-2 font-medium">Phase</th>
                                <th className="px-3 py-2 font-medium">
                                  Status
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  Readiness
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  Linked previews
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  Block reasons
                                </th>
                                <th className="px-3 py-2 font-medium">
                                  Disabled actions
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {mode.lifecyclePhaseRows.map((phase) => (
                                <tr key={phase.key}>
                                  <td className="px-3 py-2 align-top">
                                    {phase.order}
                                  </td>
                                  <td className="px-3 py-2 align-top">
                                    {phase.code}
                                  </td>
                                  <td className="px-3 py-2 align-top">
                                    {phase.status}
                                  </td>
                                  <td className="px-3 py-2 align-top">
                                    {phase.readiness}
                                  </td>
                                  <td className="px-3 py-2 align-top">
                                    {phase.linkedArtifactsText}
                                  </td>
                                  <td className="px-3 py-2 align-top">
                                    {phase.blockReasonsText}
                                  </td>
                                  <td className="px-3 py-2 align-top">
                                    {phase.disabledActionsText}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="rounded-md border p-3 xl:col-span-2">
                        <Text className="text-ui-fg-subtle text-xs">
                          Failure handling and compensation preview
                        </Text>
                        <Text className="mt-2 text-sm">
                          {mode.failureHandlingText}
                        </Text>
                        <Text className="text-ui-fg-subtle mt-2 text-xs">
                          Retry posture: {mode.retryPostureText}
                        </Text>
                        <Text className="text-ui-fg-subtle mt-1 text-xs">
                          Compensation posture: {mode.compensationPostureText}
                        </Text>
                        <Text className="text-ui-fg-subtle mt-1 text-xs">
                          Blocked failure actions:{" "}
                          {mode.blockedFailureActionsText}
                        </Text>
                      </div>
                      <div className="rounded-md border p-3 xl:col-span-2">
                        <Text className="text-ui-fg-subtle text-xs">
                          Deterministic execution identity
                        </Text>
                        <pre className="mt-2 overflow-auto rounded-md border bg-ui-bg-subtle p-3 text-xs">
                          {mode.executionIdentityText}
                        </pre>
                      </div>
                      <div className="rounded-md border p-3 xl:col-span-2">
                        <Text className="text-ui-fg-subtle text-xs">
                          Persistence and audit preview
                        </Text>
                        <pre className="mt-2 overflow-auto rounded-md border bg-ui-bg-subtle p-3 text-xs">
                          {mode.persistenceAuditText}
                        </pre>
                      </div>
                    </div>

                    {mode.issueBadges.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {mode.issueBadges.map((issue) => (
                          <span
                            key={issue.key}
                            className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700"
                          >
                            {issue.label}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <details className="mt-4 rounded-md border p-3">
                      <summary className="cursor-pointer text-sm font-medium">
                        Redacted outbound payload preview
                      </summary>
                      <pre className="mt-3 overflow-auto rounded-md border bg-ui-bg-subtle p-3 text-xs">
                        {mode.outboundRequestText}
                      </pre>
                    </details>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Text className="text-ui-fg-subtle mt-4">
              {executionPlanRenderState.emptyText}
            </Text>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Heading level="h2">Shipment operations lookup</Heading>
              <Text className="text-ui-fg-subtle mt-2">
                Single-reference operator lookup for accepted shipment
                lifecycle, status refresh posture and guarded manual
                cancel/status refresh. Manual retry v1 follows backend
                readiness-only policy and returns blocked diagnostics when live
                redispatch is not materialized.
              </Text>
            </div>
            <Text className="text-ui-fg-subtle text-sm">
              {shipmentOperationsRenderState.headerText}
            </Text>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <Label htmlFor="shipment-operations-execution-reference">
                Execution reference
              </Label>
              <Input
                id="shipment-operations-execution-reference"
                value={shipmentOperationsForm.execution_reference}
                onChange={(event) =>
                  handleShipmentOperationsField(
                    "execution_reference",
                    event.target.value,
                  )
                }
                disabled={
                  isLoadingShipmentOperations ||
                  isRefreshingShipmentStatus ||
                  isCancellingShipment ||
                  isRetryingShipment
                }
                placeholder="Paste execution_reference from controlled fulfillment result or execution ledger"
              />
              <Text className="text-ui-fg-subtle mt-2 text-sm">
                The backend response returns only masked/safe references and
                boolean presence markers, never raw provider ids, auth tokens,
                quote keys or execution secrets.
              </Text>
            </div>
            <div className="flex items-end gap-3">
              <Button
                type="button"
                onClick={() => void handleLoadShipmentOperations()}
                isLoading={isLoadingShipmentOperations}
                disabled={
                  !shipmentOperationsRenderState.lookupReady ||
                  isRefreshingShipmentStatus ||
                  isCancellingShipment ||
                  isRetryingShipment
                }
              >
                Load snapshot
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleRefreshShipmentStatus()}
                isLoading={isRefreshingShipmentStatus}
                disabled={
                  !shipmentOperationsRenderState.lookupReady ||
                  !shipmentOperationsRenderState.canRefreshStatus ||
                  isLoadingShipmentOperations ||
                  isCancellingShipment ||
                  isRetryingShipment
                }
              >
                {shipmentOperationsRenderState.refreshButtonText}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleCancelShipment()}
                isLoading={isCancellingShipment}
                disabled={
                  !shipmentOperationsRenderState.lookupReady ||
                  !shipmentOperationsRenderState.canCancelShipment ||
                  isLoadingShipmentOperations ||
                  isRefreshingShipmentStatus ||
                  isRetryingShipment
                }
              >
                {shipmentOperationsRenderState.cancelButtonText}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleRetryShipment()}
                isLoading={isRetryingShipment}
                disabled={
                  !shipmentOperationsRenderState.lookupReady ||
                  !shipmentOperationsRenderState.canRetryShipment ||
                  isLoadingShipmentOperations ||
                  isRefreshingShipmentStatus ||
                  isCancellingShipment
                }
              >
                {shipmentOperationsRenderState.retryButtonText}
              </Button>
            </div>
          </div>

          {shipmentOperationsError ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <Text className="text-ui-fg-error font-medium">
                {shipmentOperationsError.message}
              </Text>
              <Text className="text-ui-fg-subtle mt-1">
                {shipmentOperationsError.code} · HTTP{" "}
                {shipmentOperationsError.status}
              </Text>
              {shipmentOperationsError.details ? (
                <pre className="mt-3 overflow-auto rounded-md border bg-white p-3 text-xs">
                  {JSON.stringify(shipmentOperationsError.details, null, 2)}
                </pre>
              ) : null}
            </div>
          ) : null}

          {shipmentOperationsNotice ? (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
              <Text className="font-medium text-green-800">
                {shipmentOperationsNotice}
              </Text>
            </div>
          ) : null}

          {shipmentOperationsSnapshot ? (
            <div className="mt-6 grid gap-6">
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-2 py-1 text-xs ${plannerStatusToneClass(shipmentOperationsRenderState.refreshStatusTone)}`}
                >
                  {shipmentOperationsRenderState.statusBadgeText}
                </span>
                {shipmentOperationsRenderState.actionBadges.map((badge) => (
                  <span
                    key={badge.key}
                    className={`rounded-full border px-2 py-1 text-xs ${plannerStatusToneClass(
                      badge.available ? "projected" : "deferred",
                    )}`}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                {shipmentOperationsRenderState.summaryCards.map((card) => (
                  <div key={card.key} className="rounded-md border p-3">
                    <Text className="text-ui-fg-subtle text-xs">
                      {card.label}
                    </Text>
                    <Text className="mt-2 font-medium">{card.value}</Text>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-md border p-4">
                  <Heading level="h3">Lifecycle and shipment summary</Heading>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {shipmentOperationsRenderState.detailRows.map((row) => (
                      <div key={row.key}>
                        <Label>{row.label}</Label>
                        <Input readOnly value={row.value} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-md border p-4">
                  <Heading level="h3">Status refresh outcome</Heading>
                  <Text className="text-ui-fg-subtle mt-1 text-sm">
                    Refresh is backend-guarded by accepted shipment, active
                    sealed Yandex connection and stored backend-only provider
                    shipment reference.
                  </Text>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {shipmentOperationsRenderState.statusRefreshRows.map(
                      (row) => (
                        <div key={row.key}>
                          <Label>{row.label}</Label>
                          <Input readOnly value={row.value} />
                        </div>
                      ),
                    )}
                  </div>
                </div>

                <div className="rounded-md border p-4">
                  <Heading level="h3">Cancel readiness and result</Heading>
                  <Text className="text-ui-fg-subtle mt-1 text-sm">
                    Cancel is an explicit backend/admin-only action guarded by
                    accepted lifecycle, safe status posture, Yandex connection
                    readiness and backend-only provider reference.
                  </Text>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {shipmentOperationsRenderState.cancelRows.map((row) => (
                      <div key={row.key}>
                        <Label>{row.label}</Label>
                        <Input readOnly value={row.value} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-md border p-4">
                  <Heading level="h3">Ledger counts and previews</Heading>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {shipmentOperationsRenderState.ledgerRows.map((row) => (
                      <div key={row.key}>
                        <Label>{row.label}</Label>
                        <Input readOnly value={row.value} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-md border p-4">
                  <Heading level="h3">Context references</Heading>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {shipmentOperationsRenderState.contextRows.map((row) => (
                      <div key={row.key}>
                        <Label>{row.label}</Label>
                        <Input readOnly value={row.value} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <Text className="text-ui-fg-subtle mt-6">
              {shipmentOperationsRenderState.emptyText}
            </Text>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Heading level="h2">Shipping option manual sync</Heading>
              <Text className="text-ui-fg-subtle mt-2">
                Admin-only operator control surface for explicit manual sync
                against deliveryhub shipping options. Dry-run is the default
                safe path.
              </Text>
            </div>
            <Text className="text-ui-fg-subtle text-sm">
              {manualSyncRenderState.headerText}
            </Text>
          </div>

          <div className="mt-4 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-4">
            <Text className="font-medium">Safe-by-default guardrails</Text>
            <Text className="text-ui-fg-subtle mt-2 text-sm">
              Dry-run never writes shipping options. Execute remains manual-only
              and requires the exact backend guard string plus explicit Medusa
              create context ids.
            </Text>
          </div>

          {shippingOptionSyncError ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <Text className="text-ui-fg-error font-medium">
                {shippingOptionSyncError.message}
              </Text>
              <Text className="text-ui-fg-subtle mt-1">
                {shippingOptionSyncError.code} · HTTP{" "}
                {shippingOptionSyncError.status}
              </Text>
              {shippingOptionSyncError.details ? (
                <pre className="mt-3 overflow-auto rounded-md border bg-white p-3 text-xs">
                  {JSON.stringify(shippingOptionSyncError.details, null, 2)}
                </pre>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-md border p-4">
              <Heading level="h3">Dry-run</Heading>
              <Text className="text-ui-fg-subtle mt-1 text-sm">
                Primary action. Calls the admin route in safe mode and returns
                desired plan, reconciliation and operation summaries without
                applying Medusa mutations.
              </Text>

              <div className="mt-4">
                <Label htmlFor="shipping-option-sync-error-mode">
                  Execute error mode
                </Label>
                <select
                  id="shipping-option-sync-error-mode"
                  value={shippingOptionSyncErrorMode}
                  onChange={(event) =>
                    setShippingOptionSyncErrorMode(
                      event.target
                        .value as DeliveryHubShippingOptionManualSyncErrorMode,
                    )
                  }
                  disabled={isLoading || isRunningShippingOptionSync}
                  className="bg-ui-bg-field shadow-borders-base txt-compact-small text-ui-fg-base focus-visible:shadow-borders-interactive-with-active mt-2 h-10 w-full rounded-md px-3 outline-none"
                >
                  <option value="abort">abort</option>
                  <option value="continue">continue</option>
                </select>
                <Text className="text-ui-fg-subtle mt-2 text-sm">
                  Used only if execute mode is explicitly confirmed. Dry-run
                  remains non-mutating regardless of this selection.
                </Text>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => void handleShippingOptionSync("dry_run")}
                  isLoading={isRunningShippingOptionSync}
                  disabled={isLoading}
                >
                  Run dry-run sync
                </Button>
              </div>
            </div>

            <div className="rounded-md border p-4">
              <Heading level="h3">Execute with explicit confirmation</Heading>
              <Text className="text-ui-fg-subtle mt-1 text-sm">
                Secondary admin-only write path. Nothing executes unless the
                confirmation string matches exactly and both Medusa ids are
                filled in.
              </Text>

              <div className="mt-4 grid gap-4">
                <div>
                  <Label htmlFor="shipping-option-sync-guard-expected">
                    Expected guard string
                  </Label>
                  <Input
                    id="shipping-option-sync-guard-expected"
                    readOnly
                    value={DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD}
                  />
                </div>

                <div>
                  <Label htmlFor="shipping-option-sync-guard-input">
                    Type exact guard string to unlock execute
                  </Label>
                  <Input
                    id="shipping-option-sync-guard-input"
                    value={shippingOptionSyncExecuteGuard}
                    onChange={(event) =>
                      setShippingOptionSyncExecuteGuard(event.target.value)
                    }
                    disabled={isLoading || isRunningShippingOptionSync}
                    placeholder="deliveryhub:execute_shipping_option_sync"
                  />
                  <Text className="mt-2 text-sm">
                    {manualSyncRenderState.guardConfirmed ? (
                      <span className="text-green-700">
                        Guard confirmed. Execute button can be enabled once
                        Medusa ids are provided.
                      </span>
                    ) : (
                      <span className="text-ui-fg-subtle">
                        Guard not confirmed. Execute remains blocked.
                      </span>
                    )}
                  </Text>
                </div>

                <div>
                  <Label htmlFor="shipping-option-sync-service-zone">
                    Medusa service zone id
                  </Label>
                  <Input
                    id="shipping-option-sync-service-zone"
                    value={shippingOptionSyncServiceZoneId}
                    onChange={(event) =>
                      setShippingOptionSyncServiceZoneId(event.target.value)
                    }
                    disabled={isLoading || isRunningShippingOptionSync}
                    placeholder="serzo_..."
                  />
                </div>

                <div>
                  <Label htmlFor="shipping-option-sync-shipping-profile">
                    Medusa shipping profile id
                  </Label>
                  <Input
                    id="shipping-option-sync-shipping-profile"
                    value={shippingOptionSyncShippingProfileId}
                    onChange={(event) =>
                      setShippingOptionSyncShippingProfileId(event.target.value)
                    }
                    disabled={isLoading || isRunningShippingOptionSync}
                    placeholder="sp_..."
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleShippingOptionSync("execute")}
                  isLoading={isRunningShippingOptionSync}
                  disabled={isLoading || !manualSyncRenderState.canExecute}
                >
                  Execute manual sync
                </Button>
              </div>
            </div>
          </div>

          {shippingOptionSyncResult ? (
            <div className="mt-6 grid gap-6">
              <div className="rounded-md border p-4">
                <Heading level="h3">Returned execution mode</Heading>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {manualSyncRenderState.modeFields.map((field) => (
                    <div key={field.label}>
                      <Label>{field.label}</Label>
                      <Input readOnly value={field.value} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                <div className="rounded-md border p-4">
                  <Heading level="h3">Desired plan summary</Heading>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {manualSyncRenderState.desiredPlanSummaryCards.map(
                      (card) => (
                        <div key={card.key} className="rounded-md border p-3">
                          <Text className="text-ui-fg-subtle text-xs">
                            {card.label}
                          </Text>
                          <Text className="mt-2 font-medium">{card.value}</Text>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                <div className="rounded-md border p-4">
                  <Heading level="h3">Reconciliation summary</Heading>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {manualSyncRenderState.reconciliationSummaryCards.map(
                      (card) => (
                        <div key={card.key} className="rounded-md border p-3">
                          <Text className="text-ui-fg-subtle text-xs">
                            {card.label}
                          </Text>
                          <Text className="mt-2 font-medium">{card.value}</Text>
                        </div>
                      ),
                    )}
                  </div>
                </div>

                <div className="rounded-md border p-4">
                  <Heading level="h3">Operation plan summary</Heading>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {manualSyncRenderState.operationPlanSummaryCards.map(
                      (card) => (
                        <div key={card.key} className="rounded-md border p-3">
                          <Text className="text-ui-fg-subtle text-xs">
                            {card.label}
                          </Text>
                          <Text className="mt-2 font-medium">{card.value}</Text>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>

              {manualSyncRenderState.executionReport ? (
                <div className="rounded-md border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Heading level="h3">Execution report</Heading>
                      <Text className="text-ui-fg-subtle mt-1 text-sm">
                        Returned only for explicit execute runs that passed the
                        confirmation guard and backend validation.
                      </Text>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-xs ${logSuccessToneClass(
                        manualSyncRenderState.executionReport
                          .outcomeToneIsSuccess,
                      )}`}
                    >
                      {manualSyncRenderState.executionReport.outcome}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div>
                      <Label>Aborted</Label>
                      <Input
                        readOnly
                        value={manualSyncRenderState.executionReport.aborted}
                      />
                    </div>
                    <div>
                      <Label>Error mode</Label>
                      <Input
                        readOnly
                        value={manualSyncRenderState.executionReport.errorMode}
                      />
                    </div>
                    <div>
                      <Label>Executed operations</Label>
                      <Input
                        readOnly
                        value={
                          manualSyncRenderState.executionReport
                            .executedOperationCount
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {manualSyncRenderState.executionReport.summaryCards.map(
                      (card) => (
                        <div key={card.key} className="rounded-md border p-3">
                          <Text className="text-ui-fg-subtle text-xs">
                            {card.label}
                          </Text>
                          <Text className="mt-2 font-medium">{card.value}</Text>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                  <Text className="font-medium text-amber-800">
                    No execution report returned
                  </Text>
                  <Text className="mt-1 text-sm text-amber-700">
                    {manualSyncRenderState.noExecutionReportText}
                  </Text>
                </div>
              )}

              <div className="grid gap-3">
                <details className="rounded-md border p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Desired plan details
                  </summary>
                  <pre className="mt-3 overflow-auto rounded-md border bg-ui-bg-subtle p-3 text-xs">
                    {JSON.stringify(
                      shippingOptionSyncResult.desired_plan,
                      null,
                      2,
                    )}
                  </pre>
                </details>

                <details className="rounded-md border p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Reconciliation details
                  </summary>
                  <pre className="mt-3 overflow-auto rounded-md border bg-ui-bg-subtle p-3 text-xs">
                    {JSON.stringify(
                      shippingOptionSyncResult.reconciliation,
                      null,
                      2,
                    )}
                  </pre>
                </details>

                <details className="rounded-md border p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Operation plan details
                  </summary>
                  <pre className="mt-3 overflow-auto rounded-md border bg-ui-bg-subtle p-3 text-xs">
                    {JSON.stringify(
                      shippingOptionSyncResult.operation_plan,
                      null,
                      2,
                    )}
                  </pre>
                </details>

                <details className="rounded-md border p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Execution report details
                  </summary>
                  <pre className="mt-3 overflow-auto rounded-md border bg-ui-bg-subtle p-3 text-xs">
                    {JSON.stringify(
                      shippingOptionSyncResult.execution.report,
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </div>
            </div>
          ) : (
            <Text className="text-ui-fg-subtle mt-6">
              {manualSyncRenderState.noResultText}
            </Text>
          )}
        </div>

          </div>
        </details>

        <details className="rounded-lg border p-4">
          <summary className="cursor-pointer text-base font-medium">
            Техническая диагностика: журнал событий
          </summary>
          <div className="mt-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Heading level="h2">Журнал диагностики</Heading>
              <Text className="text-ui-fg-subtle mt-2">
                Последние read-only события Delivery Hub. Payloads sanitized и
                отфильтрованы по Yandex.
              </Text>
            </div>
            <Text className="text-ui-fg-subtle text-sm">
              {activeConnectionId
                ? `Filtered by connection ${activeConnectionId}`
                : "Показаны все Yandex connections"}
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
                      <span
                        className={`rounded-full border px-2 py-1 text-xs ${logSuccessToneClass(log.success)}`}
                      >
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
              <Text className="text-ui-fg-subtle">
                Для текущего фильтра событий delivery-hub не найдено.
              </Text>
            )}
          </div>
          </div>
        </details>

        <div className="rounded-lg border p-4">
          <Heading level="h2">4. Проверить стоимость доставки</Heading>
          <Text className="text-ui-fg-subtle mt-2">
            Диагностический расчёт тарифа для поддерживаемых режимов Yandex.
            Shipment не создаётся, токены и raw provider body не выводятся.
          </Text>
          <div className="mt-3 rounded-md border bg-ui-bg-subtle p-3">
            <Text className="text-ui-fg-subtle text-sm">
              {getQuoteModeHint(testQuoteForm.mode_code)}
            </Text>
            <Text className="text-ui-fg-subtle mt-2 text-sm">
              {testQuoteCapability.helperText}
            </Text>
          </div>

          {testQuoteError ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
              <Text className="text-ui-fg-error font-medium">
                {testQuoteError.message}
              </Text>
              <Text className="text-ui-fg-subtle mt-1">
                {testQuoteError.code} · HTTP {testQuoteError.status}
              </Text>
              {getProviderCodeOperatorHint(
                getDeliveryHubApiErrorSafeLines(testQuoteError)
                  .find((line) => line.startsWith("provider_code="))
                  ?.replace("provider_code=", ""),
              ) ? (
                <Text className="text-ui-fg-subtle mt-2 text-sm">
                  {getProviderCodeOperatorHint(
                    getDeliveryHubApiErrorSafeLines(testQuoteError)
                      .find((line) => line.startsWith("provider_code="))
                      ?.replace("provider_code=", ""),
                  )}
                </Text>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {getDeliveryHubApiErrorSafeLines(testQuoteError).map((line) => (
                  <span
                    key={line}
                    className="rounded-full border border-red-200 bg-ui-bg-base px-2 py-1 text-xs text-ui-fg-subtle"
                  >
                    {line}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel htmlFor="quote-connection" required={true}>
                Подключение
              </FieldLabel>
              <Text className="text-ui-fg-subtle mb-1 text-xs">
                {getFieldRequirementText({ field: "connection" })}
              </Text>
              <select
                id="quote-connection"
                value={testQuoteForm.connection_id}
                onChange={(event) =>
                  handleQuoteField("connection_id", event.target.value)
                }
                className="bg-ui-bg-field shadow-borders-base txt-compact-small text-ui-fg-base focus-visible:shadow-borders-interactive-with-active h-10 w-full rounded-md px-3 outline-none"
              >
                <option value="">Выберите подключение</option>
                {yandexConnections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name} · {connection.mode} · {connection.status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="quote-mode" required={true}>
                Сценарий расчёта
              </FieldLabel>
              <select
                id="quote-mode"
                value={testQuoteForm.mode_code}
                onChange={(event) =>
                  handleQuoteField(
                    "mode_code",
                    event.target.value as DeliveryTestQuoteForm["mode_code"],
                  )
                }
                className="bg-ui-bg-field shadow-borders-base txt-compact-small text-ui-fg-base focus-visible:shadow-borders-interactive-with-active h-10 w-full rounded-md px-3 outline-none"
              >
                <option value="warehouse_to_pickup_point">
                  Склад → ПВЗ (warehouse_to_pickup_point)
                </option>
                <option value="dropoff_point_to_pickup_point">
                  Dropoff ПВЗ → ПВЗ (dropoff_point_to_pickup_point)
                </option>
              </select>
            </div>

            <div>
              <FieldLabel htmlFor="quote-destination-point" required={true}>
                Destination PVZ/platform station id
              </FieldLabel>
              <Text className="text-ui-fg-subtle mb-1 text-xs">
                {getFieldRequirementText({ field: "destination_point" })}
              </Text>
              <Input
                id="quote-destination-point"
                value={testQuoteForm.destination_point_id}
                onChange={(event) =>
                  handleQuoteField("destination_point_id", event.target.value)
                }
              />
            </div>

            <div>
              <FieldLabel htmlFor="quote-currency" required={false}>
                Валюта
              </FieldLabel>
              <Text className="text-ui-fg-subtle mb-1 text-xs">
                {getFieldRequirementText({ field: "currency" })}
              </Text>
              <Input
                id="quote-currency"
                value={testQuoteForm.currency_code}
                onChange={(event) =>
                  handleQuoteField("currency_code", event.target.value)
                }
              />
            </div>

            {testQuoteForm.mode_code === "warehouse_to_pickup_point" ? (
              <>
                <div>
                  <FieldLabel htmlFor="quote-warehouse-id" required={true}>
                    Склад/source
                  </FieldLabel>
                  <Text className="text-ui-fg-subtle mb-1 text-xs">
                    {getFieldRequirementText({ field: "warehouse" })}
                  </Text>
                  <select
                    id="quote-warehouse-id"
                    value={testQuoteForm.warehouse_id}
                    onChange={(event) =>
                      handleQuoteField("warehouse_id", event.target.value)
                    }
                    className="bg-ui-bg-field shadow-borders-base txt-compact-small text-ui-fg-base focus-visible:shadow-borders-interactive-with-active h-10 w-full rounded-md px-3 outline-none"
                  >
                    <option value="">Выберите склад</option>
                    {yandexWarehouses
                      .filter((warehouse) => warehouse.enabled)
                      .map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {getWarehouseOptionLabel(warehouse)}
                        </option>
                      ))}
                  </select>
                </div>
                <details className="md:col-span-2 rounded-md border p-4">
                  <summary className="cursor-pointer text-sm font-medium">
                    Необязательный interval_utc для pickup diagnostics
                  </summary>
                  <Text className="text-ui-fg-subtle mt-2 text-sm">
                    {getFieldRequirementText({ field: "interval" })}
                  </Text>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <FieldLabel htmlFor="quote-interval-from" required={false}>
                        Interval from (UTC ISO)
                      </FieldLabel>
                      <Input
                        id="quote-interval-from"
                        placeholder="Опционально из pickup windows lookup"
                        value={testQuoteForm.interval_from}
                        onChange={(event) =>
                          handleQuoteField("interval_from", event.target.value)
                        }
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor="quote-interval-to" required={false}>
                        Interval to (UTC ISO)
                      </FieldLabel>
                      <Input
                        id="quote-interval-to"
                        placeholder="Опционально из pickup windows lookup"
                        value={testQuoteForm.interval_to}
                        onChange={(event) =>
                          handleQuoteField("interval_to", event.target.value)
                        }
                      />
                    </div>
                  </div>
                </details>
              </>
            ) : (
              <div className="md:col-span-2">
                <FieldLabel htmlFor="quote-origin-point" required={true}>
                  Origin dropoff point id
                </FieldLabel>
                <Text className="text-ui-fg-subtle mb-1 text-xs">
                  {getFieldRequirementText({ field: "origin_dropoff_point" })}
                </Text>
                <Input
                  id="quote-origin-point"
                  value={testQuoteForm.origin_point_id}
                  onChange={(event) =>
                    handleQuoteField("origin_point_id", event.target.value)
                  }
                />
              </div>
            )}

            <div>
              <FieldLabel htmlFor="quote-item-quantity" required={true}>
                Количество товара
              </FieldLabel>
              <Text className="text-ui-fg-subtle mb-1 text-xs">
                {getFieldRequirementText({ field: "item_quantity" })}
              </Text>
              <Input
                id="quote-item-quantity"
                type="number"
                min="1"
                value={testQuoteForm.item_quantity}
                onChange={(event) =>
                  handleQuoteField("item_quantity", event.target.value)
                }
              />
            </div>

            <div>
              <FieldLabel htmlFor="quote-item-weight" required={true}>
                Вес, граммы
              </FieldLabel>
              <Text className="text-ui-fg-subtle mb-1 text-xs">
                {getFieldRequirementText({ field: "item_weight" })}
              </Text>
              <Input
                id="quote-item-weight"
                type="number"
                min="0"
                value={testQuoteForm.item_weight_grams}
                onChange={(event) =>
                  handleQuoteField("item_weight_grams", event.target.value)
                }
              />
            </div>

            <div className="md:col-span-2">
              <FieldLabel htmlFor="quote-item-price" required={false}>
                Объявленная цена
              </FieldLabel>
              <Text className="text-ui-fg-subtle mb-1 text-xs">
                {getFieldRequirementText({ field: "item_price" })}
              </Text>
              <Input
                id="quote-item-price"
                type="number"
                min="0"
                value={testQuoteForm.item_price}
                onChange={(event) =>
                  handleQuoteField("item_price", event.target.value)
                }
              />
            </div>
          </div>

          <details className="mt-4 rounded-md border p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Диагностика pickup windows (не блокирует Test quote)
            </summary>
            <Text className="text-ui-fg-subtle mt-2 text-sm">
              Необязательный read-only вызов /offers/info. Нужен только если
              Yandex попросит interval_utc или нужно вручную выбрать pickup
              interval. Для /offers/create quote можно не запускать.
            </Text>

            {pickupWindowLookupError ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                <Text className="text-ui-fg-error font-medium">
                  {pickupWindowLookupError.message}
                </Text>
                <Text className="text-ui-fg-subtle mt-1">
                  {pickupWindowLookupError.code} · HTTP {pickupWindowLookupError.status}
                </Text>
                <div className="mt-3 flex flex-wrap gap-2">
                  {getDeliveryHubApiErrorSafeLines(pickupWindowLookupError).map((line) => (
                    <span
                      key={line}
                      className="rounded-full border border-red-200 bg-ui-bg-base px-2 py-1 text-xs text-ui-fg-subtle"
                    >
                      {line}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <div>
                <FieldLabel htmlFor="pickup-window-connection" required={true}>
                  Подключение
                </FieldLabel>
                <select
                  id="pickup-window-connection"
                  value={pickupWindowLookupForm.connection_id}
                  onChange={(event) =>
                    handlePickupWindowLookupField("connection_id", event.target.value)
                  }
                  className="bg-ui-bg-field shadow-borders-base txt-compact-small text-ui-fg-base focus-visible:shadow-borders-interactive-with-active mt-1 h-10 w-full rounded-md px-3 outline-none"
                >
                  <option value="">Выберите подключение</option>
                  {yandexConnections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.name} · {connection.mode} · {connection.status}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel htmlFor="pickup-window-warehouse" required={true}>
                  Склад/source
                </FieldLabel>
                <select
                  id="pickup-window-warehouse"
                  value={pickupWindowLookupForm.warehouse_id}
                  onChange={(event) =>
                    handlePickupWindowLookupField("warehouse_id", event.target.value)
                  }
                  className="bg-ui-bg-field shadow-borders-base txt-compact-small text-ui-fg-base focus-visible:shadow-borders-interactive-with-active mt-1 h-10 w-full rounded-md px-3 outline-none"
                >
                  <option value="">Выберите склад</option>
                  {yandexWarehouses
                    .filter((warehouse) => warehouse.enabled)
                    .map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {getWarehouseOptionLabel(warehouse)}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <FieldLabel htmlFor="pickup-window-destination" required={true}>
                  Destination PVZ id
                </FieldLabel>
                <Input
                  id="pickup-window-destination"
                  value={pickupWindowLookupForm.destination_point_id}
                  onChange={(event) =>
                    handlePickupWindowLookupField("destination_point_id", event.target.value)
                  }
                />
              </div>
              <div>
                <FieldLabel htmlFor="pickup-window-limit" required={false}>
                  Лимит
                </FieldLabel>
                <Input
                  id="pickup-window-limit"
                  value={pickupWindowLookupForm.limit}
                  onChange={(event) =>
                    handlePickupWindowLookupField("limit", event.target.value)
                  }
                />
              </div>
            </div>

            <div className="mt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleLoadPickupWindows()}
                isLoading={isLoadingPickupWindows}
                disabled={isLoading || isLoadingPickupWindows}
              >
                Загрузить pickup windows
              </Button>
            </div>

            {pickupWindowLookupResult ? (
              <div className="mt-4 grid gap-3">
                <Text className="text-ui-fg-subtle text-sm">
                  Найдено {pickupWindowLookupResult.returned_count} из {pickupWindowLookupResult.total_available}; correlation={pickupWindowLookupResult.correlation_id}
                </Text>
                {pickupWindowLookupResult.windows.map((window) => (
                  <div key={`${window.interval_utc.from}-${window.interval_utc.to}`} className="rounded-md border p-3">
                    <Text className="font-medium">{getPickupWindowOptionLabel(window)}</Text>
                    <Button
                      type="button"
                      variant="secondary"
                      className="mt-3"
                      onClick={() => handleUsePickupWindowInterval(window)}
                    >
                      Использовать interval в Test quote
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </details>

          <div className="mt-6">
            <Button
              type="button"
              onClick={handleTestQuote}
              isLoading={isTestingQuote}
              disabled={
                isLoading || isTestingQuote || !testQuoteCapability.canTest
              }
            >
              Проверить стоимость
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
                  <Input
                    readOnly
                    value={String(testQuoteResult.quotes.length)}
                  />
                </div>
              </div>

              <div className="rounded-md border bg-ui-bg-subtle p-4">
                <Text className="font-medium">Сводка диагностики</Text>
                <Text className="text-ui-fg-subtle mt-1 text-sm">
                  {getDiagnosticsSummaryText(
                    testQuoteResult.diagnostics_summary,
                  )}
                </Text>
                <div className="mt-3 flex flex-wrap gap-2">
                  {getQuoteInputEchoLines(testQuoteResult.input_echo).map(
                    (line) => (
                      <span
                        key={line}
                        className="rounded-full border bg-ui-bg-base px-2 py-1 text-xs text-ui-fg-subtle"
                      >
                        {line}
                      </span>
                    ),
                  )}
                </div>
              </div>

              <div className="grid gap-3">
                {testQuoteResult.quotes.length ? (
                  testQuoteResult.quotes.map((quote) => (
                    <div
                      key={quote.quote_key}
                      className="rounded-md border p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Text className="font-medium">
                            {quote.carrier_label}
                          </Text>
                          <Text className="text-ui-fg-subtle text-sm">
                            {quote.mode_code} · {quote.quote_key}
                          </Text>
                        </div>
                        <div className="text-right">
                          <Text className="font-medium">
                            {quote.amount} {quote.currency_code}
                          </Text>
                          <Text className="text-ui-fg-subtle text-sm">
                            ETA {quote.delivery_eta_min ?? "?"}–
                            {quote.delivery_eta_max ?? "?"}
                          </Text>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-1 text-sm text-ui-fg-subtle">
                        <Text>
                          Pickup point required:{" "}
                          {quote.pickup_point_required ? "yes" : "no"}
                        </Text>
                        <Text>
                          Pickup window required: {quote.pickup_window_required ? "yes" : "no"} (для /offers/create quote ожидается no)
                        </Text>
                        <Text>
                          Pickup point ids:{" "}
                          {quote.pickup_point_ids.length
                            ? quote.pickup_point_ids.join(", ")
                            : "—"}
                        </Text>
                      </div>

                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm text-ui-fg-subtle">
                          Техническая диагностика: redacted provider reference
                        </summary>
                        <pre className="mt-2 overflow-auto rounded-md border bg-ui-bg-subtle p-3 text-xs">
                          {JSON.stringify(quote.raw_reference, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border p-4">
                    <Text className="text-ui-fg-subtle">
                      Для этого диагностического запроса quote не вернулся.
                    </Text>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Delivery",
  icon: HandTruck,
});

export default DeliverySettingsPage;
