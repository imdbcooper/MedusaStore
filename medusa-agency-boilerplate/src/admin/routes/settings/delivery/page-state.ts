import { isDeliveryHubShippingOptionManualSyncGuardConfirmed } from "./manual-sync";

export type DeliveryProviderDefinition = {
  code: string;
  label: string;
  capabilities: string[];
  supported_mode_codes: string[];
};

export type DeliveryConnection = {
  id: string;
  provider_code: string;
  name: string;
  status: "draft" | "active" | "error" | "disabled";
  mode: "test" | "live";
  enabled: boolean;
  country_code: string;
  credentials_state: "empty" | "sealed" | "disabled" | "invalid";
  credentials_fingerprint: string | null;
  credentials_last_validated_at: string | null;
  credentials_last_error_code: string | null;
  credentials_present: boolean;
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type DeliveryWarehouseMetadata = Record<string, unknown> & {
  postal_code?: string;
  contact_email?: string;
  coordinates?: [number, number] | null;
  lat?: number;
  lng?: number;
  fullname?: string;
};

export type DeliveryWarehouse = {
  id: string;
  name: string;
  enabled: boolean;
  country_code: string;
  city: string | null;
  address_line_1: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  provider_code: string | null;
  provider_warehouse_id: string | null;
  metadata: DeliveryWarehouseMetadata;
  created_at: string;
  updated_at: string;
};

export type DeliveryConfig = {
  auto_confirm?: boolean;
  label_format?: string;
  default_warehouse_id?: string;
  default_warehouse?: DeliveryWarehouse;
  api_base_url?: string;
};

export type DeliveryConnectionForm = {
  provider_code: string;
  name: string;
  mode: "test" | "live";
  enabled: boolean;
  country_code: string;
  token: string;
  auto_confirm: boolean;
  label_format: string;
  default_warehouse_id: string;
  api_base_url: string;
};

export type DeliveryWarehouseForm = {
  name: string;
  enabled: boolean;
  country_code: string;
  city: string;
  postal_code: string;
  address_line_1: string;
  latitude: string;
  longitude: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  provider_code: string;
  provider_warehouse_id: string;
};

export type DeliveryEventLog = {
  id: string;
  connection_id: string | null;
  provider_code: string;
  kind: string;
  correlation_id: string;
  success: boolean;
  request_summary: Record<string, unknown>;
  response_summary: Record<string, unknown>;
  error_code: string | null;
  created_at: string;
};

export type DeliveryHubDiagnosticsSummary = {
  status: "ok" | "error";
  provider_status: string | null;
  error_category: string | null;
  message: string | null;
  correlation_id: string | null;
  checked_at: string;
  redacted: true;
};

export type DeliveryHubTestQuoteInputEcho = {
  connection_id: string;
  mode_code: "warehouse_to_pickup_point" | "dropoff_point_to_pickup_point";
  destination_point_id: string;
  origin_point_id: string | null;
  warehouse_id: string | null;
  interval_utc: { from: string; to: string } | null;
  currency_code: string | null;
  item_count: number;
};

export function getDiagnosticsSummaryText(
  summary: DeliveryHubDiagnosticsSummary | null | undefined,
) {
  if (!summary) {
    return "Сводка диагностики недоступна";
  }

  const provider = summary.provider_status
    ? `provider=${summary.provider_status}`
    : "provider=n/a";
  const category = summary.error_category
    ? `category=${summary.error_category}`
    : "category=n/a";

  return `${summary.status} · ${provider} · ${category} · correlation=${summary.correlation_id ?? "n/a"}`;
}

export function getQuoteModeHint(
  modeCode: DeliveryHubTestQuoteInputEcho["mode_code"] | string,
) {
  if (modeCode === "warehouse_to_pickup_point") {
    return "Основной сценарий warehouse_to_pickup_point: нужен сохранённый connection, выбранный склад Delivery Hub и destination PVZ id. Для price quote backend отправляет Yandex /offers/calculate с address.fullname, координатами, items, places и billing_info; provider_warehouse_id/platform_station_id не обязателен для цены и нужен для pickup windows/создания отправления.";
  }

  if (modeCode === "dropoff_point_to_pickup_point") {
    return "Сценарий dropoff_point_to_pickup_point: нужен origin point id из каталога ПВЗ с available_for_dropoff=true и destination PVZ id. Склад и pickup windows в этот запрос не отправляются.";
  }

  return "Выберите поддерживаемый диагностический режим Яндекс Доставки.";
}

export function getRequiredBadgeText(required: boolean) {
  return required ? "Обязательно" : "Необязательно";
}

export function getRequiredBadgeClass(required: boolean) {
  return required
    ? "border-red-200 bg-red-50 text-red-700"
    : "border-ui-border-base bg-ui-bg-subtle text-ui-fg-subtle";
}

export function getFieldRequirementText(input: {
  field:
    | "connection"
    | "token"
    | "warehouse"
    | "warehouse_origin_address"
    | "warehouse_postal_code"
    | "warehouse_coordinates"
    | "warehouse_contact"
    | "destination_point"
    | "origin_dropoff_point"
    | "interval"
    | "item_quantity"
    | "item_weight"
    | "item_price"
    | "currency"
    | "api_host"
    | "label_format"
    | "auto_confirm"
    | "five_post";
  hasSavedToken?: boolean;
}) {
  switch (input.field) {
    case "connection":
      return "Обязательно: выберите сохранённое подключение Yandex. Для Test quote используется sealed token из backend, raw token не выводится.";
    case "token":
      return input.hasSavedToken
        ? "Необязательно при редактировании: оставьте поле пустым, чтобы сохранить текущий sealed token. Заполняйте только для создания или ротации токена."
        : "Обязательно при создании: вставьте Yandex token один раз. После сохранения поле станет пустым и write-only.";
    case "warehouse":
      return "Обязательно выбрать склад для warehouse_to_pickup_point. provider_warehouse_id/platform_station_id необязателен для расчёта цены через Yandex /offers/calculate; заполняйте его для pickup windows/создания отправления, если Yandex выдал station id.";
    case "warehouse_origin_address":
      return "Обязательно для Yandex /offers/calculate: страна, город и строка адреса продавца/склада. Город должен быть городом (например Москва), не страной (Russia/RU/Россия). Storefront этот адрес не отправляет и секретов здесь нет.";
    case "warehouse_postal_code":
      return "Необязательно, но полезно для точности /offers/calculate: индекс добавляется в origin fullname и хранится в metadata.postal_code.";
    case "warehouse_coordinates":
      return "Необязательно: долгота/широта склада для Yandex route point. Если заполнены, должны быть числовыми и соответствовать адресу склада; сохраняются как metadata.coordinates=[lng, lat].";
    case "warehouse_contact":
      return "Необязательно: контакт склада для provider route point. Токены, auth headers и provider DTO здесь не сохраняются.";
    case "destination_point":
      return "Обязательно: destination PVZ/platform station id из блока «3. Найти ПВЗ». Он уйдёт в destination.platform_station.platform_id.";
    case "origin_dropoff_point":
      return "Обязательно только для dropoff_point_to_pickup_point: используйте point id из каталога ПВЗ, где available_for_dropoff=true.";
    case "interval":
      return "Необязательно для /offers/create Test quote: заполняйте оба UTC ISO поля только если хотите диагностически проверить конкретный pickup interval.";
    case "item_quantity":
      return "Обязательно: положительное количество тестового товара; используется для items[].count.";
    case "item_weight":
      return "Обязательно: вес тестового места в граммах; используется для places[].physical_dims.weight_gross.";
    case "item_price":
      return "Необязательно: объявленная цена товара. 0 подходит для базовой sandbox-диагностики.";
    case "currency":
      return "Необязательно: код валюты для echo/совместимости, обычно RUB. Цена Yandex берётся из offer_details.pricing_total/pricing.";
    case "api_host":
      return "Расширенная настройка: обычно оставьте Auto. В test режиме Auto выбирает sandbox host, в live — production host.";
    case "label_format":
      return "Расширенная настройка будущих label-файлов; для Test connection, ПВЗ и Test quote не нужна.";
    case "auto_confirm":
      return "Расширенная настройка будущего подтверждения офферов; текущий Test quote не подтверждает оффер и shipment не создаёт.";
    case "five_post":
      return "5 Post — партнёрская сеть в каталоге Yandex Delivery, а не отдельный провайдер Delivery Hub. Для тестов склад → ПВЗ сначала выбирайте operator=market_l4g или «только Яндекс-бренд»: в sandbox такие точки дают офферы стабильнее, чем случайные 5Post.";
    default:
      return "";
  }
}

export function getQuoteInputEchoLines(
  echo: DeliveryHubTestQuoteInputEcho | null | undefined,
) {
  if (!echo) {
    return [];
  }

  return [
    `mode=${echo.mode_code}`,
    `destination=${echo.destination_point_id}`,
    echo.warehouse_id ? `warehouse=${echo.warehouse_id}` : null,
    echo.origin_point_id ? `origin=${echo.origin_point_id}` : null,
    echo.currency_code ? `currency=${echo.currency_code}` : null,
    `items=${echo.item_count}`,
    echo.interval_utc
      ? `interval=${echo.interval_utc.from} → ${echo.interval_utc.to}`
      : null,
  ].filter((line): line is string => !!line);
}

export type DeliveryHubShippingOptionData = {
  version: number;
  provider_code: string;
  provider_id: string;
  id: string;
  mode_code: string;
};

export type DeliveryHubProjectedShippingOption = {
  status: "projected";
  mode_code: string;
  data: DeliveryHubShippingOptionData;
  supporting_connection_ids: string[];
};

export type DeliveryHubDeferredPlannerIssue = {
  connection_id: string;
  provider_code: string;
  code: string;
  message: string;
  mode_code: string | null;
};

export type DeliveryHubDeferredShippingOption = {
  status: "deferred";
  mode_code: string;
  data: DeliveryHubShippingOptionData;
  issues: DeliveryHubDeferredPlannerIssue[];
};

export type DeliveryHubShippingOptionConnectionPlan = {
  connection_id: string;
  provider_code: string;
  status: "projected" | "deferred" | "skipped";
  projected_mode_codes: string[];
  issues: Array<{
    code: string;
    message: string;
    mode_code: string | null;
  }>;
};

export type DeliveryHubShippingOptionSnapshot = {
  id: string;
  name?: string | null;
  provider_id?: string | null;
  data?: Record<string, unknown> | null;
};

export type DeliveryHubShippingOptionPreviewSummary = {
  current_option_count: number;
  desired_option_count: number;
  deferred_option_count: number;
  deferred_issue_count: number;
  connection_plan_count: number;
  create_candidate_count: number;
  update_candidate_count: number;
  unchanged_count: number;
  orphaned_managed_option_count: number;
  ignored_foreign_option_count: number;
};

export type DeliveryHubShippingOptionPreview = {
  provider_code: string;
  provider_id: string;
  current_options: DeliveryHubShippingOptionSnapshot[];
  plan: {
    provider_code: string;
    provider_id: string;
    desired_options: DeliveryHubProjectedShippingOption[];
    deferred_options: DeliveryHubDeferredShippingOption[];
    connection_plans: DeliveryHubShippingOptionConnectionPlan[];
  };
  reconciliation: {
    provider_code: string;
    provider_id: string;
    create_candidates: Array<{
      desired: DeliveryHubProjectedShippingOption;
    }>;
    update_candidates: Array<{
      desired: DeliveryHubProjectedShippingOption;
      current: DeliveryHubShippingOptionSnapshot;
      normalized_current_data: DeliveryHubShippingOptionData;
      reasons: string[];
    }>;
    unchanged: Array<{
      desired: DeliveryHubProjectedShippingOption;
      current: DeliveryHubShippingOptionSnapshot;
      normalized_current_data: DeliveryHubShippingOptionData;
    }>;
    orphaned_managed_options: Array<{
      current: DeliveryHubShippingOptionSnapshot;
      normalized_current_data: DeliveryHubShippingOptionData;
      reason: string;
    }>;
    ignored_foreign_options: Array<{
      current: DeliveryHubShippingOptionSnapshot;
    }>;
  };
  summary: DeliveryHubShippingOptionPreviewSummary;
};

export type DeliveryHubShippingOptionManualSyncExecutionMode = {
  requested_mode: "dry_run" | "execute";
  effective_mode: "dry_run" | "execute";
  execute_requested: boolean;
  execute_confirmed: boolean;
  execute_guard: string;
  is_dry_run: boolean;
};

export type DeliveryHubShippingOptionManualSyncDesiredPlanSummary = {
  desired_option_count: number;
  deferred_option_count: number;
  deferred_issue_count: number;
  connection_plan_count: number;
};

export type DeliveryHubShippingOptionManualSyncReconciliationSummary = {
  create_candidate_count: number;
  update_candidate_count: number;
  unchanged_count: number;
  orphaned_managed_option_count: number;
  ignored_foreign_option_count: number;
};

export type DeliveryHubShippingOptionSyncOperationPlanSummary = {
  create_operation_count: number;
  update_operation_count: number;
  archive_operation_count: number;
  noop_count: number;
  mutation_operation_count: number;
  ignored_foreign_option_count: number;
  managed_option_count: number;
};

export type DeliveryHubShippingOptionSyncExecutionSummary = {
  create_operation_count: number;
  update_operation_count: number;
  archive_operation_count: number;
  mutation_operation_count: number;
  noop_count: number;
  ignored_foreign_option_count: number;
  attempted_operation_count: number;
  succeeded_operation_count: number;
  failed_operation_count: number;
  not_executed_operation_count: number;
};

export type DeliveryHubShippingOptionSyncExecutionReport = {
  outcome: "succeeded" | "failed" | "partial_failure";
  aborted: boolean;
  error_mode: "abort" | "continue";
  summary: DeliveryHubShippingOptionSyncExecutionSummary;
  create_results: unknown[];
  update_results: unknown[];
  archive_results: unknown[];
  executed_operations: unknown[];
};

export type DeliveryHubShippingOptionManualSyncResponse = {
  provider_code: string;
  provider_id: string;
  current_options: DeliveryHubShippingOptionSnapshot[];
  desired_plan: DeliveryHubShippingOptionPreview["plan"];
  desired_plan_summary: DeliveryHubShippingOptionManualSyncDesiredPlanSummary;
  reconciliation: DeliveryHubShippingOptionPreview["reconciliation"];
  reconciliation_summary: DeliveryHubShippingOptionManualSyncReconciliationSummary;
  operation_plan: {
    provider_code: string;
    provider_id: string;
    create_operations: unknown[];
    update_operations: unknown[];
    archive_operations: unknown[];
    noops: unknown[];
    ignored_foreign_options: unknown[];
    summary: DeliveryHubShippingOptionSyncOperationPlanSummary;
  };
  execution: {
    mode: DeliveryHubShippingOptionManualSyncExecutionMode;
    report: DeliveryHubShippingOptionSyncExecutionReport | null;
  };
};

export type ApiErrorPayload = {
  status: number;
  code: string;
  message: string;
  details: unknown;
};

export function getDeliveryHubApiErrorSafeLines(error: ApiErrorPayload | null) {
  if (!error) {
    return [];
  }

  const details = asRecord(error.details);
  const nestedDetails = asRecord(details.details);
  const providerResponse = asRecord(nestedDetails.response);
  const diagnosticsSummary = asRecord(details.diagnostics_summary);
  const nestedDiagnosticsSummary = asRecord(nestedDetails.diagnostics_summary);
  const request = asRecord(nestedDetails.request);

  const lines = [
    `status=${error.status}`,
    `code=${error.code}`,
    normalizeSafeErrorValue(
      nestedDetails.provider_status ?? details.provider_status,
      "provider_status",
    ),
    normalizeSafeErrorValue(
      nestedDetails.error_category ?? details.error_category,
      "category",
    ),
    normalizeSafeErrorValue(providerResponse.code, "provider_code"),
    normalizeSafeErrorValue(providerResponse.message, "provider_message"),
    normalizeSafeErrorValue(request.path, "provider_path"),
    normalizeSafeErrorValue(
      nestedDetails.operator_hint ?? details.operator_hint,
      "operator_hint",
    ),
    normalizeSafeErrorValue(
      nestedDetails.correlation_id ??
        details.correlation_id ??
        diagnosticsSummary.correlation_id ??
        nestedDiagnosticsSummary.correlation_id,
      "correlation",
    ),
  ];

  return lines.filter((line): line is string => Boolean(line));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeSafeErrorValue(value: unknown, label: string) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${label}=${value}`;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return `${label}=${value.trim()}`;
}

export type DeliveryHubPickupPointLookupPoint = {
  id: string;
  code: string | null;
  operator_id: string | null;
  network_label: string | null;
  station_type: string | null;
  is_yandex_branded: boolean | null;
  is_market_partner: boolean | null;
  name: string;
  address: string;
  city: string | null;
  postal_code: string | null;
  available_for_dropoff: boolean;
  coordinates: {
    lat: number | null;
    lng: number | null;
  };
};

export type DeliveryHubPickupPointLookupResponse = {
  ok: true;
  connection: DeliveryConnection;
  points: DeliveryHubPickupPointLookupPoint[];
  limit: number;
  total_available: number;
  returned_count: number;
  truncated: boolean;
  correlation_id: string;
};

export type DeliveryHubPickupPointLookupForm = {
  connection_id: string;
  city: string;
  country_code: string;
  geo_id: string;
  pickup_point_id: string;
  operator_id: "" | "market_l4g" | "5post";
  station_type: "" | "pickup_point" | "terminal" | "warehouse";
  available_for_dropoff: "" | "true" | "false";
  is_yandex_branded: "" | "true" | "false";
  is_not_branded_partner_station: "" | "true" | "false";
  limit: string;
};

export const YANDEX_VERIFIED_SANDBOX_PVZ = {
  id: "e1139f6d-e34f-47a9-a55f-31f032a861a6",
  label: "Пункт выдачи заказов Яндекс Маркета, Ленинградский проспект 27",
  geo_id: "213",
  operator_id: "market_l4g" as const,
  station_type: "pickup_point" as const,
  is_yandex_branded: "true" as const,
};

export type DeliveryHubPickupWindowLookupWindow = {
  date: string;
  time_from: string | null;
  time_to: string | null;
  interval_utc: {
    from: string;
    to: string;
  };
  label: string;
};

export type DeliveryHubPickupWindowLookupResponse = {
  ok: true;
  connection: DeliveryConnection;
  warehouse_id: string;
  destination_point_id: string | null;
  windows: DeliveryHubPickupWindowLookupWindow[];
  limit: number;
  total_available: number;
  returned_count: number;
  truncated: boolean;
  correlation_id: string;
};

export type DeliveryHubPickupWindowLookupForm = {
  connection_id: string;
  warehouse_id: string;
  destination_point_id: string;
  limit: string;
};

export type DeliveryHubTestConnectionCapability = {
  canTest: boolean;
  helperText: string;
  errorMessage: string | null;
};

export type DeliveryHubTestQuoteValidationInput = {
  connection_id?: string | null;
  mode_code?:
    | "warehouse_to_pickup_point"
    | "dropoff_point_to_pickup_point"
    | string
    | null;
  destination_point_id?: string | null;
  origin_point_id?: string | null;
  warehouse_id?: string | null;
  interval_from?: string | null;
  interval_to?: string | null;
  item_quantity?: string | null;
  item_weight_grams?: string | null;
  item_price?: string | null;
};

export type DeliveryHubTestQuoteCapability = {
  canTest: boolean;
  blockingReasons: string[];
  helperText: string;
  errorMessage: string | null;
};

export const defaultPickupPointLookupForm: DeliveryHubPickupPointLookupForm = {
  connection_id: "",
  city: "",
  country_code: "RU",
  geo_id: YANDEX_VERIFIED_SANDBOX_PVZ.geo_id,
  pickup_point_id: "",
  operator_id: YANDEX_VERIFIED_SANDBOX_PVZ.operator_id,
  station_type: YANDEX_VERIFIED_SANDBOX_PVZ.station_type,
  available_for_dropoff: "",
  is_yandex_branded: YANDEX_VERIFIED_SANDBOX_PVZ.is_yandex_branded,
  is_not_branded_partner_station: "",
  limit: "20",
};

export const defaultPickupWindowLookupForm: DeliveryHubPickupWindowLookupForm =
  {
    connection_id: "",
    warehouse_id: "",
    destination_point_id: "",
    limit: "20",
  };

export const yandexApiBaseUrlOptions = [
  {
    value: "",
    label: "Авто по режиму (test → sandbox, live → production)",
  },
  {
    value: "https://b2b.taxi.tst.yandex.net/api/b2b/platform",
    label: "Yandex sandbox/test host",
  },
  {
    value: "https://b2b-authproxy.taxi.yandex.net/api/b2b/platform",
    label: "Yandex production host",
  },
];

const yandexApiBaseUrlAliases: Record<string, string> = {
  "https://b2b.taxi.tst.yandex.net/b2b/cargo/integration/v2":
    "https://b2b.taxi.tst.yandex.net/api/b2b/platform",
  "https://b2b.taxi.yandex.net/b2b/cargo/integration/v2":
    "https://b2b-authproxy.taxi.yandex.net/api/b2b/platform",
};

export function normalizeYandexApiBaseUrlForForm(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().replace(/\/+$/, "");

  if (!normalized) {
    return "";
  }

  return yandexApiBaseUrlAliases[normalized] ?? normalized;
}

export function buildPickupPointLookupQuery(
  form: DeliveryHubPickupPointLookupForm,
) {
  const params = new URLSearchParams();

  params.set("connection_id", form.connection_id.trim());

  if (form.city.trim()) {
    params.set("city", form.city.trim());
  }

  if (form.country_code.trim()) {
    params.set("country_code", form.country_code.trim().toUpperCase());
  }

  if (form.geo_id.trim()) {
    params.set("geo_id", form.geo_id.trim());
  }

  if (form.pickup_point_id.trim()) {
    params.set("pickup_point_id", form.pickup_point_id.trim());
  }

  if (form.operator_id) {
    params.set("operator_id", form.operator_id);
  }

  if (form.station_type) {
    params.set("station_type", form.station_type);
  }

  if (form.available_for_dropoff) {
    params.set("available_for_dropoff", form.available_for_dropoff);
  }

  if (form.is_yandex_branded) {
    params.set("is_yandex_branded", form.is_yandex_branded);
  }

  if (form.is_not_branded_partner_station) {
    params.set(
      "is_not_branded_partner_station",
      form.is_not_branded_partner_station,
    );
  }

  if (form.limit.trim()) {
    params.set("limit", form.limit.trim());
  }

  return params.toString();
}

export function buildPickupWindowLookupQuery(
  form: DeliveryHubPickupWindowLookupForm,
) {
  const params = new URLSearchParams();

  params.set("connection_id", form.connection_id.trim());
  params.set("warehouse_id", form.warehouse_id.trim());
  params.set("destination_point_id", form.destination_point_id.trim());

  if (form.limit.trim()) {
    params.set("limit", form.limit.trim());
  }

  return params.toString();
}

export function isVerifiedYandexSandboxPickupPoint(pointId: string | null | undefined) {
  return pointId?.trim() === YANDEX_VERIFIED_SANDBOX_PVZ.id;
}

export function buildYandexSandboxPickupPointLookupForm(
  current: DeliveryHubPickupPointLookupForm,
): DeliveryHubPickupPointLookupForm {
  return {
    ...current,
    geo_id: YANDEX_VERIFIED_SANDBOX_PVZ.geo_id,
    pickup_point_id: YANDEX_VERIFIED_SANDBOX_PVZ.id,
    operator_id: YANDEX_VERIFIED_SANDBOX_PVZ.operator_id,
    station_type: YANDEX_VERIFIED_SANDBOX_PVZ.station_type,
    available_for_dropoff: "",
    is_yandex_branded: YANDEX_VERIFIED_SANDBOX_PVZ.is_yandex_branded,
    is_not_branded_partner_station: "",
    limit: "1",
  };
}

export function getProviderCodeOperatorHint(providerCode: string | null | undefined) {
  switch (providerCode?.trim()) {
    case "pickups_not_configured":
      return "Yandex не нашёл pickup-настройку для выбранного склада/интервала. Для sandbox используйте проверенный тестовый PVZ Яндекс Маркета или запросите у Yandex корректные pickup intervals/warehouse→PVZ настройки.";
    case "no_delivery_options":
      return "Yandex не нашёл delivery options для выбранной пары/интервала. Для sandbox сначала проверьте market_l4g PVZ и попробуйте без ручного interval_utc.";
    default:
      return null;
  }
}


export function buildRoutePointAddressFromPickupPoint(
  point: DeliveryHubPickupPointLookupPoint,
) {
  const fullname = [point.postal_code, point.city, point.address]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim())
    .join(", ");
  const lat = Number.isFinite(point.coordinates.lat) ? point.coordinates.lat : null;
  const lng = Number.isFinite(point.coordinates.lng) ? point.coordinates.lng : null;

  if (!fullname) {
    return null;
  }

  return {
    fullname,
    coordinates: lng !== null && lat !== null ? [lng, lat] as [number, number] : undefined,
  };
}

export function getPickupPointOptionLabel(
  point: DeliveryHubPickupPointLookupPoint,
) {
  const code = point.code ? ` · code=${point.code}` : "";
  const city = point.city ? ` · ${point.city}` : "";
  const operator = point.operator_id ? ` · operator=${point.operator_id}` : "";
  const network = point.network_label ? ` · сеть=${point.network_label}` : "";
  const stationType = point.station_type ? ` · type=${point.station_type}` : "";
  const brand = point.is_yandex_branded ? " · Яндекс-бренд" : "";
  const verified = isVerifiedYandexSandboxPickupPoint(point.id)
    ? " · verified sandbox"
    : "";
  const dropoff = point.available_for_dropoff
    ? " · можно как origin dropoff"
    : "";

  return `${point.id}${code}${operator}${network}${stationType}${brand}${verified}${city}${dropoff} · ${point.name}`;
}

export function getPickupWindowOptionLabel(
  window: DeliveryHubPickupWindowLookupWindow,
) {
  return `${window.label || window.date} · ${window.interval_utc.from} → ${window.interval_utc.to}`;
}

export function getTestConnectionCapability(input: {
  activeConnectionId?: string | null;
  isLoading?: boolean;
  isSaving?: boolean;
}): DeliveryHubTestConnectionCapability {
  if (!input.activeConnectionId) {
    return {
      canTest: false,
      helperText:
        "Сначала сохраните подключение. Токен повторно вводить не нужно: сохранённый sealed token используется безопасно.",
      errorMessage: "Сохраните подключение перед проверкой.",
    };
  }

  if (input.isLoading || input.isSaving) {
    return {
      canTest: false,
      helperText: "Дождитесь завершения загрузки или сохранения.",
      errorMessage: "Операция ещё выполняется.",
    };
  }

  return {
    canTest: true,
    helperText:
      "Проверка использует сохранённый sealed token и не показывает секреты оператору.",
    errorMessage: null,
  };
}

const hasText = (value?: string | null) => !!value && value.trim().length > 0;

const parseDate = (value?: string | null) => {
  if (!hasText(value)) {
    return null;
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

export function getTestQuoteCapability(
  input: DeliveryHubTestQuoteValidationInput,
): DeliveryHubTestQuoteCapability {
  const blockingReasons: string[] = [];

  if (!hasText(input.connection_id)) {
    blockingReasons.push("сохранённое Yandex-подключение");
  }

  if (!hasText(input.destination_point_id)) {
    blockingReasons.push("destination PVZ id из поиска ПВЗ");
  }

  if (input.mode_code === "warehouse_to_pickup_point") {
    if (!hasText(input.warehouse_id)) {
      blockingReasons.push("склад с адресом origin для /offers/calculate");
    }

  }

  if (
    input.mode_code === "dropoff_point_to_pickup_point" &&
    !hasText(input.origin_point_id)
  ) {
    blockingReasons.push("origin dropoff point id с available_for_dropoff=true");
  }

  if (!hasText(input.item_quantity) || Number(input.item_quantity) <= 0) {
    blockingReasons.push("положительное количество товара");
  }

  if (
    !hasText(input.item_weight_grams) ||
    Number(input.item_weight_grams) < 0
  ) {
    blockingReasons.push("вес товара не меньше 0");
  }

  const canTest = blockingReasons.length === 0;

  return {
    canTest,
    blockingReasons,
    helperText: canTest
      ? "Можно запускать диагностический Test quote через Yandex /offers/create. Pickup windows необязательны; shipment не создаётся и оффер не подтверждается."
      : `Заполните перед Test quote: ${blockingReasons.join(", ")}.`,
    errorMessage: canTest
      ? null
      : `Заполните обязательные поля: ${blockingReasons.join(", ")}.`,
  };
}

export const defaultConnectionForm: DeliveryConnectionForm = {
  provider_code: "yandex",
  name: "",
  mode: "test",
  enabled: false,
  country_code: "RU",
  token: "",
  auto_confirm: false,
  label_format: "",
  default_warehouse_id: "",
  api_base_url: "",
};

export const defaultWarehouseForm: DeliveryWarehouseForm = {
  name: "Адрес продавца / склада",
  enabled: true,
  country_code: "RU",
  city: "",
  postal_code: "",
  address_line_1: "",
  latitude: "",
  longitude: "",
  contact_name: "",
  contact_phone: "",
  contact_email: "",
  provider_code: "yandex",
  provider_warehouse_id: "",
};

export const capabilityLabels: Record<string, string> = {
  test_connection: "Проверка подключения",
  list_pickup_points: "Поиск ПВЗ",
  list_pickup_windows: "Диагностика pickup windows",
  quote_warehouse_to_pickup_point: "Расчёт склад → ПВЗ",
  quote_dropoff_point_to_pickup_point: "Расчёт dropoff → ПВЗ",
};

export const modeLabels: Record<string, string> = {
  warehouse_to_pickup_point: "Склад → ПВЗ (warehouse_to_pickup_point)",
  dropoff_point_to_pickup_point: "Dropoff ПВЗ → ПВЗ (dropoff_point_to_pickup_point)",
};

export const labelFormatOptions = ["", "pdf", "zpl"];

const previewSummaryCards: Array<{
  key: keyof DeliveryHubShippingOptionPreviewSummary;
  label: string;
}> = [
  { key: "desired_option_count", label: "Desired options" },
  { key: "deferred_option_count", label: "Deferred options" },
  { key: "deferred_issue_count", label: "Deferred issues" },
  { key: "create_candidate_count", label: "Create candidates" },
  { key: "update_candidate_count", label: "Update candidates" },
  { key: "unchanged_count", label: "Unchanged" },
  { key: "orphaned_managed_option_count", label: "Orphaned managed" },
  { key: "ignored_foreign_option_count", label: "Ignored foreign" },
  { key: "current_option_count", label: "Current options scanned" },
  { key: "connection_plan_count", label: "Connection plans" },
];

const manualSyncDesiredPlanSummaryCards: Array<{
  key: keyof DeliveryHubShippingOptionManualSyncDesiredPlanSummary;
  label: string;
}> = [
  { key: "desired_option_count", label: "Desired options" },
  { key: "deferred_option_count", label: "Deferred options" },
  { key: "deferred_issue_count", label: "Deferred issues" },
  { key: "connection_plan_count", label: "Connection plans" },
];

const manualSyncReconciliationSummaryCards: Array<{
  key: keyof DeliveryHubShippingOptionManualSyncReconciliationSummary;
  label: string;
}> = [
  { key: "create_candidate_count", label: "Create candidates" },
  { key: "update_candidate_count", label: "Update candidates" },
  { key: "unchanged_count", label: "Unchanged" },
  { key: "orphaned_managed_option_count", label: "Orphaned managed" },
  { key: "ignored_foreign_option_count", label: "Ignored foreign" },
];

const manualSyncOperationPlanSummaryCards: Array<{
  key: keyof DeliveryHubShippingOptionSyncOperationPlanSummary;
  label: string;
}> = [
  { key: "create_operation_count", label: "Create ops" },
  { key: "update_operation_count", label: "Update ops" },
  { key: "archive_operation_count", label: "Archive ops" },
  { key: "noop_count", label: "Noops" },
  { key: "mutation_operation_count", label: "Mutation ops" },
  { key: "ignored_foreign_option_count", label: "Ignored foreign" },
  { key: "managed_option_count", label: "Managed total" },
];

const manualSyncExecutionSummaryCards: Array<{
  key: keyof DeliveryHubShippingOptionSyncExecutionSummary;
  label: string;
}> = [
  { key: "attempted_operation_count", label: "Attempted ops" },
  { key: "succeeded_operation_count", label: "Succeeded ops" },
  { key: "failed_operation_count", label: "Failed ops" },
  { key: "not_executed_operation_count", label: "Not executed" },
  { key: "mutation_operation_count", label: "Planned mutation ops" },
  { key: "noop_count", label: "Planned noops" },
];

export type RenderCard<T extends string = string> = {
  key: T;
  label: string;
  value: string;
};

export type PreviewRenderState = {
  headerText: string;
  summaryCards: RenderCard[];
  desiredOptions: Array<{
    key: string;
    modeCode: string;
    id: string;
    supportingConnectionsText: string;
  }>;
  desiredEmptyText: string;
  deferredOptions: Array<{
    key: string;
    modeCode: string;
    id: string;
    issues: Array<{
      key: string;
      code: string;
      message: string;
      connectionText: string;
    }>;
  }>;
  deferredEmptyText: string;
  reconciliationCounts: {
    createCandidates: string;
    updateCandidates: string;
    unchanged: string;
    orphanedManaged: string;
    ignoredForeign: string;
  };
  createCandidates: Array<{
    key: string;
    title: string;
    subtitle: string;
  }>;
  updateCandidates: Array<{
    key: string;
    title: string;
    subtitle: string;
  }>;
  unchangedEntries: Array<{
    key: string;
    title: string;
    subtitle: string;
  }>;
  orphanedManagedEntries: Array<{
    key: string;
    title: string;
    subtitle: string;
  }>;
  ignoredForeignEntries: Array<{
    key: string;
    title: string;
    subtitle: string;
  }>;
  connectionPlans: Array<{
    key: string;
    connectionId: string;
    providerCode: string;
    status: string;
    projectedModesText: string;
    issues: Array<{
      key: string;
      code: string;
      message: string;
    }>;
  }>;
  connectionPlansEmptyText: string;
};

export type ManualSyncExecutionReportRenderState = {
  outcome: string;
  outcomeToneIsSuccess: boolean;
  aborted: string;
  errorMode: string;
  executedOperationCount: string;
  summaryCards: RenderCard[];
};

export type ManualSyncRenderState = {
  headerText: string;
  guardConfirmed: boolean;
  canExecute: boolean;
  modeFields: Array<{
    label: string;
    value: string;
  }>;
  desiredPlanSummaryCards: RenderCard[];
  reconciliationSummaryCards: RenderCard[];
  operationPlanSummaryCards: RenderCard[];
  executionReport: ManualSyncExecutionReportRenderState | null;
  noExecutionReportText: string;
  noResultText: string;
};

export type DeliveryHubFulfillmentBridgePreviewStep = {
  key: string;
  ready: boolean;
  message: string;
};

export type DeliveryHubFulfillmentBridgeModePreview = {
  mode_code: string;
  status: "ready" | "error";
  rollout_status: "projected" | "deferred" | "unconfigured";
  supporting_connection_ids: string[];
  blocking_issues: Array<{
    connection_id: string;
    provider_code: string;
    code: string;
    message: string;
    mode_code: string | null;
  }>;
  steps: DeliveryHubFulfillmentBridgePreviewStep[];
  selection: Record<string, unknown> | null;
  shipping_option_data: Record<string, unknown> | null;
  fulfillment_payload: Record<string, unknown> | null;
  create_fulfillment_payload: Record<string, unknown> | null;
  shipment_execution: {
    materialized: false;
    reason: string;
  };
  error: {
    message: string;
  } | null;
};

export type DeliveryHubFulfillmentBridgeReadinessPreview = {
  provider_code: string;
  provider_id: string;
  shipping_option_preview: DeliveryHubShippingOptionPreview;
  bridge_preview: {
    version: number;
    provider_code: string;
    provider_id: string;
    mode_previews: DeliveryHubFulfillmentBridgeModePreview[];
    summary: {
      mode_count: number;
      ready_mode_count: number;
      error_mode_count: number;
      projected_mode_count: number;
      deferred_mode_count: number;
    };
  };
  summary: {
    mode_count: number;
    ready_mode_count: number;
    error_mode_count: number;
    projected_mode_count: number;
    deferred_mode_count: number;
  };
};

export type FulfillmentBridgePreviewRenderState = {
  headerText: string;
  summaryCards: RenderCard[];
  modePreviews: Array<{
    key: string;
    modeCode: string;
    status: string;
    rolloutStatus: string;
    supportingConnectionsText: string;
    stepReadinessText: string;
    issueBadges: Array<{
      key: string;
      label: string;
    }>;
    errorText: string | null;
    shipmentExecutionText: string;
  }>;
  emptyText: string;
};

export type DeliveryHubExecutionPlanObservabilityStep = {
  key: string;
  ready: boolean;
  message: string;
};

export type DeliveryHubExecutionPersistenceAuditPreview = {
  version: number;
  redacted: true;
  status: "ready" | "blocked";
  metadata_patch: {
    target: "fulfillment_execution_shadow";
    action: "merge";
    fields: Array<{
      field: string;
      value_preview: string;
    }>;
  };
  execution_record: {
    ready: boolean;
    record_type: "deliveryhub_shipment_execution";
    operation: "create_shipment";
    provider_code: string;
    provider_id: string;
    connection_id: string | null;
    mode_code: string | null;
    execution_reference: string | null;
    idempotency_key_preview: string | null;
    initial_status: string | null;
  };
  idempotency_reservation: {
    ready: boolean;
    dedupe_scope: "deliveryhub:create_shipment";
    reservation_key_preview: string | null;
    matched_fields: Array<{
      field: string;
      value_preview: string;
    }>;
  };
  status_transitions: Array<{
    from: string;
    to: string;
    reason: string;
  }>;
  audit_log_entries: Array<{
    kind: string;
    message: string;
    payload: Record<string, string | number | boolean | null>;
  }>;
  blocked: Array<{
    key: string;
    reason: string;
  }>;
  deferred: Array<{
    key: string;
    reason: string;
  }>;
};

export type DeliveryHubExecutionPlanObservabilityIssue = {
  code: string;
  message: string;
  field_path: string | null;
};

export type DeliveryHubExecutionPreflightEligibilityPreview = {
  version: number;
  redacted: true;
  current_mode: "preview_only";
  decision: "eligible_when_enabled" | "not_ready";
  real_execution_enabled: false;
  future_execution_flag: {
    name: "DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED";
    status: "future_inert_not_read";
    description: string;
  };
  reasons: Array<{
    code: string;
    message: string;
  }>;
  required_prerequisites: Array<{
    code: string;
    label: string;
    status: "required_future_work";
  }>;
  confirmations: {
    shipment_execution_disabled: true;
    provider_calls_disabled: true;
    persistence_writes_disabled: true;
    checkout_cutover_disabled: true;
  };
  blocked_live_actions: Array<{
    code: string;
    label: string;
    blocked: true;
  }>;
};

export type DeliveryHubProviderDispatchPreview = {
  version: number;
  redacted: true;
  current_mode: "preview_only";
  dispatch_decision: "ready_for_future_dispatch" | "not_dispatched";
  provider: {
    provider_code: string;
    provider_id: string;
    provider_key: string;
    adapter_operation: "create_shipment";
    adapter_operation_label: string;
  };
  command_identity: {
    provider_operation_reference: string | null;
    idempotency_key_preview: string | null;
    plan_fingerprint: string | null;
    execution_fingerprint: string | null;
  };
  command_envelope_summary: {
    connection_id_present: boolean;
    mode_code: string | null;
    origin_kind: "fulfillment_location" | "dropoff_point" | "unknown";
    destination_kind: "pickup_point" | "unknown";
    quote_reference_present: boolean;
    offer_reference_present: boolean;
    package_reference_present: boolean;
    order_reference_present: boolean;
    fulfillment_reference_present: boolean;
    pickup_scheduling_reference_present: boolean;
    dropoff_scheduling_reference_present: boolean;
    item_count: number;
  };
  blocked_dispatch_actions: Array<{
    code: string;
    label: string;
    reason: string;
    blocked: true;
  }>;
  confirmations: {
    adapter_invocation_disabled: true;
    provider_network_calls_disabled: true;
    shipment_creation_disabled: true;
    label_creation_disabled: true;
    order_mutation_disabled: true;
    persistence_writes_disabled: true;
    checkout_cutover_disabled: true;
  };
};

export type DeliveryHubFailureHandlingPreview = {
  version: number;
  redacted: true;
  current_mode: "preview_only";
  failure_path_decision: "projected_retry_policy" | "no_live_failure_path";
  projected_failure_status:
    | "manual_intervention_required_when_enabled"
    | "not_applicable_in_preview";
  failure_classes: Array<{
    code:
      | "provider_dispatch_failure"
      | "provider_timeout"
      | "provider_response_invalid"
      | "shipment_result_rejected"
      | "application_projection_blocked";
    retry_eligibility: "eligible_when_enabled" | "blocked";
    compensation_requirement: "required_when_enabled" | "not_required";
    manual_intervention: "required_when_enabled" | "not_required";
    reason_bucket:
      | "dispatch_transport"
      | "provider_timeout"
      | "response_normalization"
      | "result_semantics"
      | "application_projection";
  }>;
  identity_linkage: {
    provider_operation_reference: string | null;
    idempotency_key_preview: string | null;
    plan_fingerprint: string | null;
    execution_fingerprint: string | null;
  };
  retry_projection: {
    eligibility: "eligible_when_enabled" | "blocked";
    policy: "deterministic_preview_only";
    retry_block_reasons: string[];
    scheduling_status: "disabled";
  };
  compensation_projection: {
    requirement: "required_when_enabled" | "not_required";
    write_plan_status: "disabled";
    rollback_status: "disabled";
    blocked_actions: string[];
  };
  manual_intervention_projection: {
    status: "required_when_enabled" | "not_required";
    reason_markers: string[];
  };
  blocked_failure_actions: Array<{
    code: string;
    label: string;
    reason: string;
    blocked: true;
  }>;
  confirmations: {
    retry_scheduling_disabled: true;
    rollback_disabled: true;
    compensation_writes_disabled: true;
    order_mutation_disabled: true;
    fulfillment_mutation_disabled: true;
    event_persistence_disabled: true;
    provider_redispatch_disabled: true;
    checkout_cutover_disabled: true;
  };
};

export type DeliveryHubExecutionLifecyclePreview = {
  version: 1;
  redacted: true;
  current_mode: "preview_only";
  lifecycle_status: "projected_for_future_execution" | "blocked_in_preview";
  readiness_posture: "ready_when_enabled" | "blocked_in_preview";
  phase_sequence: Array<
    | "preflight_eligibility"
    | "provider_dispatch"
    | "shipment_result_normalization"
    | "fulfillment_application"
    | "failure_handling"
  >;
  identity_correlation: {
    provider_operation_reference: string | null;
    idempotency_key_preview: string | null;
    plan_fingerprint: string | null;
    execution_fingerprint: string | null;
  };
  phases: Array<{
    code:
      | "preflight_eligibility"
      | "provider_dispatch"
      | "shipment_result_normalization"
      | "fulfillment_application"
      | "failure_handling";
    order: number;
    status: "projected_for_future_execution" | "blocked_in_preview";
    readiness_posture: "ready_when_enabled" | "blocked_in_preview";
    block_reasons: string[];
    disabled_live_actions: string[];
    linked_preview_artifacts: string[];
  }>;
  confirmations: {
    preview_only: true;
    orchestration_scheduling_disabled: true;
    shipment_execution_disabled: true;
    provider_calls_disabled: true;
    persistence_writes_disabled: true;
    retry_scheduling_disabled: true;
    compensation_writes_disabled: true;
    order_mutation_disabled: true;
    fulfillment_mutation_disabled: true;
    checkout_cutover_disabled: true;
  };
};

export type DeliveryHubExecutionPlanObservabilityModePreview = {
  mode_code: string;
  status: "ready" | "blocked";
  rollout_status: "projected" | "deferred" | "unconfigured";
  supporting_connection_ids: string[];
  blocking_issues: Array<{
    connection_id: string;
    provider_code: string;
    code: string;
    message: string;
    mode_code: string | null;
  }>;
  readiness_verdict: {
    status: "ready" | "blocked";
    blocked_reasons: string[];
  };
  blocked_reasons: string[];
  issues: DeliveryHubExecutionPlanObservabilityIssue[];
  steps: DeliveryHubExecutionPlanObservabilityStep[];
  execution_plan: {
    version: number;
    operation: "create_shipment";
    connection_id: string;
    mode_code: string;
    quote_reference: {
      id: string;
      version: number;
    };
    order: {
      id: string | null;
      display_id: string | number | null;
      currency_code: string | null;
    };
    fulfillment: {
      id: string | null;
      location_id: string | null;
    };
    items: Array<{
      line_item_id: string | null;
      quantity: number;
    }>;
    outbound_request: {
      method: "POST";
      path: "/shipments";
      headers: {
        authorization: string;
        "content-type": "application/json";
      };
    };
  } | null;
  execution_identity: {
    version: number;
    redacted: true;
    operation: "create_shipment";
    provider_operation_label: string;
    provider_operation_reference: string;
    plan_fingerprint: string;
    execution_fingerprint: string;
    idempotency_key_preview: string;
  } | null;
  outbound_payload_preview: {
    redacted: true;
    request: Record<string, unknown> | null;
  };
  persistence_audit_preview: DeliveryHubExecutionPersistenceAuditPreview;
  preflight_eligibility: DeliveryHubExecutionPreflightEligibilityPreview;
  provider_dispatch_preview: DeliveryHubProviderDispatchPreview;
  shipment_result_preview: {
    version: number;
    redacted: true;
    current_mode: "preview_only";
    result_decision: "projected_for_future_execution" | "not_materialized";
    projected_result_status:
      | "projected_for_future_execution"
      | "not_materialized";
    result_kind: "shipment_result";
    normalization_target: "deliveryhub_shipment_result";
    provider_normalization_target: "create_shipment_response";
    identity_linkage: {
      provider_operation_reference: string | null;
      idempotency_key_preview: string | null;
      plan_fingerprint: string | null;
      execution_fingerprint: string | null;
    };
    artifact_summary: {
      external_shipment_reference_present: boolean;
      tracking_reference_present: boolean;
      label_document_present: boolean;
      pickup_booking_present: boolean;
      pickup_interval_present: boolean;
      status_timeline_present: boolean;
      failure_placeholder_present: boolean;
      rollback_placeholder_present: boolean;
    };
    blocked_materialization_actions: Array<{
      code: string;
      label: string;
      reason: string;
      blocked: true;
    }>;
    confirmations: {
      provider_response_fetch_disabled: true;
      adapter_invocation_disabled: true;
      shipment_creation_disabled: true;
      label_persistence_disabled: true;
      order_mutation_disabled: true;
      fulfillment_persistence_disabled: true;
      checkout_cutover_disabled: true;
    };
  };
  failure_handling_preview: DeliveryHubFailureHandlingPreview;
  fulfillment_application_preview: {
    version: number;
    redacted: true;
    current_mode: "preview_only";
    application_decision: "projected_for_future_application" | "not_applied";
    projected_application_status:
      | "projected_for_future_application"
      | "not_applied";
    application_target: "medusa_fulfillment_mutation_plan";
    application_scope: "backend_admin_only";
    mutation_semantics: {
      fulfillment_data_patch_present: boolean;
      shipment_reference_linkage_present: boolean;
      tracking_projection_present: boolean;
      label_document_reference_linkage_present: boolean;
      status_transition_application_present: boolean;
      audit_linkage_present: boolean;
    };
    identity_linkage: {
      provider_operation_reference: string | null;
      idempotency_key_preview: string | null;
      plan_fingerprint: string | null;
      execution_fingerprint: string | null;
    };
    persistence_linkage: {
      execution_reference_present: boolean;
      idempotency_reservation_present: boolean;
      audit_log_reference_present: boolean;
    };
    blocked_application_actions: Array<{
      code: string;
      label: string;
      reason: string;
      blocked: true;
    }>;
    confirmations: {
      order_mutation_disabled: true;
      fulfillment_persistence_disabled: true;
      shipment_persistence_disabled: true;
      label_persistence_disabled: true;
      event_persistence_disabled: true;
      checkout_cutover_disabled: true;
    };
  };
  execution_lifecycle_preview: DeliveryHubExecutionLifecyclePreview;
  shipment_execution: {
    materialized: false;
    reason: string;
  };
};

export type DeliveryHubExecutionPlanObservabilityReadModel = {
  provider_code: string;
  provider_id: string;
  shipping_option_preview: DeliveryHubShippingOptionPreview;
  execution_plan_preview: {
    version: number;
    provider_code: string;
    provider_id: string;
    mode_previews: DeliveryHubExecutionPlanObservabilityModePreview[];
    summary: {
      mode_count: number;
      ready_mode_count: number;
      blocked_mode_count: number;
      projected_mode_count: number;
      deferred_mode_count: number;
      unconfigured_mode_count: number;
    };
  };
  summary: {
    mode_count: number;
    ready_mode_count: number;
    blocked_mode_count: number;
    projected_mode_count: number;
    deferred_mode_count: number;
    unconfigured_mode_count: number;
  };
};

export type ExecutionPlanObservabilityRenderState = {
  headerText: string;
  summaryCards: RenderCard[];
  modePreviews: Array<{
    key: string;
    modeCode: string;
    status: string;
    rolloutStatus: string;
    supportingConnectionsText: string;
    readinessText: string;
    blockedReasonsText: string;
    issueBadges: Array<{
      key: string;
      label: string;
    }>;
    stepReadinessText: string;
    executionPlanText: string;
    executionIdentityText: string;
    outboundRequestText: string;
    persistenceAuditText: string;
    preflightEligibilityText: string;
    preflightPrerequisitesText: string;
    blockedLiveActionsText: string;
    providerDispatchText: string;
    blockedDispatchActionsText: string;
    shipmentResultText: string;
    blockedMaterializationActionsText: string;
    applicationPreviewText: string;
    blockedApplicationActionsText: string;
    lifecycleStatusText: string;
    lifecyclePhaseSequenceText: string;
    lifecycleIdentityText: string;
    lifecycleDisabledActionsText: string;
    lifecyclePhaseRows: Array<{
      key: string;
      code: string;
      order: string;
      status: string;
      readiness: string;
      linkedArtifactsText: string;
      blockReasonsText: string;
      disabledActionsText: string;
    }>;
    failureHandlingText: string;
    retryPostureText: string;
    compensationPostureText: string;
    blockedFailureActionsText: string;
    shipmentExecutionText: string;
  }>;
  emptyText: string;
};

export type DeliveryHubShipmentOperationsForm = {
  execution_reference: string;
};

export type DeliveryHubShipmentOperationsStatusSummary = {
  provider_code: "yandex" | null;
  operation: "get_shipment_status" | null;
  attempted: boolean;
  succeeded: boolean;
  status_category: string | null;
  neutral_status:
    | "accepted"
    | "in_transit"
    | "ready_for_pickup"
    | "delivered"
    | "cancelled"
    | "failed"
    | "returned"
    | "unknown"
    | null;
  provider_status_known: boolean;
  provider_status_present: boolean;
  provider_status_normalized: string | null;
  provider_status_code: number | null;
  correlation_id_present: boolean;
  provider_shipment_reference_present: boolean;
  safe_message: string | null;
  redacted: true;
};

export type DeliveryHubShipmentOperationsSnapshot = {
  version: 1;
  safe: true;
  reference: {
    lookup_kind: "execution_reference";
    execution_reference_preview: string | null;
  };
  lifecycle: {
    classification: string;
    accepted: boolean;
    blocked_reason_code: string | null;
  };
  provider: {
    provider_code: string | null;
    mode_code: string | null;
    dispatch_status: string | null;
    dispatch_outcome: string | null;
    provider_shipment_reference_present: boolean;
    provider_correlation_reference_present: boolean;
  };
  status: {
    current: DeliveryHubShipmentOperationsStatusSummary | null;
    refresh: {
      available: boolean;
      blocked_reason_code: string | null;
      blocked_reason: string | null;
      last_outcome: "not_refreshed" | "refreshed" | "failed" | null;
      status_refreshed_at: string | null;
    };
  };
  ledger: {
    linked: boolean;
    state: string | null;
    terminal_completed: boolean;
    terminal_blocked: boolean;
    execution_reference_preview: string | null;
    idempotency_key_preview: string | null;
    transition_count: number;
    audit_event_count: number;
  };
  shipment: {
    id: string | null;
    accepted: boolean;
    status: "dispatch_accepted" | null;
    label_document_present: boolean;
    attachment_document_present: boolean;
  };
  context: {
    connection_id: string | null;
    order_id: string | null;
    fulfillment_id: string | null;
    cart_id: string | null;
    shipping_option_id: string | null;
    location_id: string | null;
    quote_reference: {
      id: string | null;
      version: number | null;
    };
    correlation_id_present: boolean;
  };
  timestamps: {
    created_at: string | null;
    updated_at: string | null;
    status_refreshed_at: string | null;
  };
  cancel: {
    readiness: {
      version: 1;
      available: boolean;
      blocked_reason_code: string | null;
      blocked_reason: string | null;
      lifecycle_classification: string | null;
      accepted: boolean;
      provider_code: string | null;
      provider_shipment_reference_present: boolean;
      status_neutral: string | null;
      redacted: true;
      anti_leak_confirmations: Record<string, false>;
    };
    last_result: {
      status: "not_requested";
      safe_message: string;
      redacted: true;
    };
  };
  retry: {
    readiness: {
      version: 1;
      available: boolean;
      blocked_reason_code: string | null;
      blocked_reason: string | null;
      lifecycle_classification: string | null;
      ledger_state: string | null;
      terminal_completed: boolean;
      terminal_blocked: boolean;
      idempotency_linked: boolean;
      persisted_shipment_present: boolean;
      accepted_shipment_present: boolean;
      provider_shipment_reference_present: boolean;
      redacted: true;
      anti_leak_confirmations: Record<string, false>;
    };
    last_result: {
      status: "not_requested";
      safe_message: string;
      redacted: true;
    };
  };
  action_posture: {
    refresh_status: "available" | "blocked";
    cancel: "available" | "blocked";
    retry: "available" | "blocked";
    webhooks: "not_materialized";
    scheduler: "not_materialized";
  };
  anti_leak_confirmations: {
    raw_provider_payloads_included: false;
    raw_provider_request_included: false;
    raw_provider_response_included: false;
    auth_headers_included: false;
    credentials_included: false;
    raw_quote_key_included: false;
    raw_provider_identifier_included: false;
    raw_execution_secret_included: false;
  };
};

export type DeliveryHubShipmentOperationsResponse = {
  ok: true;
  operations: DeliveryHubShipmentOperationsSnapshot;
};

export type DeliveryHubShipmentOperationsRefreshResponse =
  DeliveryHubShipmentOperationsResponse & {
    refresh: Record<string, unknown>;
  };

export type DeliveryHubShipmentOperationsCancelResponse =
  DeliveryHubShipmentOperationsResponse & {
    cancel: Record<string, unknown>;
  };

export type DeliveryHubShipmentOperationsRetryResponse =
  DeliveryHubShipmentOperationsResponse & {
    retry: Record<string, unknown>;
  };

export type ShipmentOperationsRenderState = {
  headerText: string;
  hasSnapshot: boolean;
  lookupReady: boolean;
  canRefreshStatus: boolean;
  canCancelShipment: boolean;
  canRetryShipment: boolean;
  refreshButtonText: string;
  cancelButtonText: string;
  retryButtonText: string;
  refreshStatusTone: string;
  statusBadgeText: string;
  actionBadges: Array<{
    key: string;
    label: string;
    available: boolean;
  }>;
  summaryCards: RenderCard[];
  detailRows: Array<{
    key: string;
    label: string;
    value: string;
  }>;
  statusRefreshRows: Array<{
    key: string;
    label: string;
    value: string;
  }>;
  cancelRows: Array<{
    key: string;
    label: string;
    value: string;
  }>;
  ledgerRows: Array<{
    key: string;
    label: string;
    value: string;
  }>;
  contextRows: Array<{
    key: string;
    label: string;
    value: string;
  }>;
  emptyText: string;
};

export const defaultShipmentOperationsForm: DeliveryHubShipmentOperationsForm =
  {
    execution_reference: "",
  };

export function normalizeShipmentOperationsExecutionReference(value: string) {
  return value.trim();
}

export function buildShipmentOperationsSnapshotUrl(executionReference: string) {
  const normalized =
    normalizeShipmentOperationsExecutionReference(executionReference);

  if (!normalized) {
    throw new Error(
      "execution_reference is required to load shipment operations",
    );
  }

  return `/admin/delivery/shipments/${encodeURIComponent(normalized)}/operations`;
}

export function buildShipmentOperationsRefreshStatusUrl(
  executionReference: string,
) {
  return `${buildShipmentOperationsSnapshotUrl(executionReference)}/refresh-status`;
}

export function buildShipmentOperationsCancelUrl(executionReference: string) {
  return `${buildShipmentOperationsSnapshotUrl(executionReference)}/cancel`;
}

export function buildShipmentOperationsRetryUrl(executionReference: string) {
  return `${buildShipmentOperationsSnapshotUrl(executionReference)}/retry`;
}

export function buildShipmentOperationsRefreshStatusRequestBody(
  correlationId?: string | null,
) {
  const normalized =
    typeof correlationId === "string" ? correlationId.trim() : "";

  return normalized ? { correlation_id: normalized } : {};
}

export function buildShipmentOperationsCancelRequestBody(
  correlationId?: string | null,
) {
  const normalized =
    typeof correlationId === "string" ? correlationId.trim() : "";

  return normalized ? { correlation_id: normalized } : {};
}

export function deriveShipmentOperationsRenderState(input: {
  form: DeliveryHubShipmentOperationsForm;
  snapshot: DeliveryHubShipmentOperationsSnapshot | null;
}): ShipmentOperationsRenderState {
  const normalizedReference = normalizeShipmentOperationsExecutionReference(
    input.form.execution_reference,
  );
  const snapshot = input.snapshot;
  const refresh = snapshot?.status.refresh ?? null;
  const currentStatus = snapshot?.status.current ?? null;
  const cancelReadiness = snapshot?.cancel.readiness ?? null;
  const retryReadiness = snapshot?.retry.readiness ?? null;

  return {
    headerText: snapshot
      ? `${snapshot.lifecycle.classification} · ${snapshot.reference.execution_reference_preview ?? "execution reference masked"}`
      : "No shipment operations snapshot loaded",
    hasSnapshot: !!snapshot,
    lookupReady: !!normalizedReference,
    canRefreshStatus:
      snapshot?.action_posture.refresh_status === "available" &&
      refresh?.available === true,
    canCancelShipment:
      snapshot?.action_posture.cancel === "available" &&
      cancelReadiness?.available === true,
    canRetryShipment:
      snapshot?.action_posture.retry === "available" &&
      retryReadiness?.available === true,
    refreshButtonText: refresh?.available
      ? "Refresh status"
      : "Refresh status blocked",
    cancelButtonText: cancelReadiness?.available
      ? "Cancel shipment"
      : "Cancel blocked",
    retryButtonText: retryReadiness?.available
      ? "Retry execution"
      : "Retry blocked",
    refreshStatusTone: refresh?.available ? "projected" : "deferred",
    statusBadgeText: snapshot
      ? snapshot.lifecycle.accepted
        ? "accepted shipment"
        : `blocked: ${snapshot.lifecycle.blocked_reason_code ?? "not accepted"}`
      : "not loaded",
    actionBadges: snapshot
      ? [
          {
            key: "refresh_status",
            label: `refresh_status: ${snapshot.action_posture.refresh_status}`,
            available: snapshot.action_posture.refresh_status === "available",
          },
          {
            key: "cancel",
            label: `cancel: ${snapshot.action_posture.cancel}`,
            available:
              snapshot.action_posture.cancel === "available" &&
              snapshot.cancel.readiness.available,
          },
          {
            key: "retry",
            label: `retry: ${snapshot.action_posture.retry}`,
            available:
              snapshot.action_posture.retry === "available" &&
              snapshot.retry.readiness.available,
          },
          {
            key: "webhooks",
            label: `webhooks: ${snapshot.action_posture.webhooks}`,
            available: false,
          },
          {
            key: "scheduler",
            label: `scheduler: ${snapshot.action_posture.scheduler}`,
            available: false,
          },
        ]
      : [],
    summaryCards: snapshot
      ? [
          {
            key: "lifecycle",
            label: "Lifecycle",
            value: snapshot.lifecycle.classification,
          },
          {
            key: "accepted",
            label: "Accepted",
            value: snapshot.lifecycle.accepted ? "yes" : "no",
          },
          {
            key: "provider_mode",
            label: "Provider / mode",
            value: `${snapshot.provider.provider_code ?? "—"} / ${snapshot.provider.mode_code ?? "—"}`,
          },
          {
            key: "dispatch",
            label: "Dispatch",
            value: `${snapshot.provider.dispatch_status ?? "—"} / ${snapshot.provider.dispatch_outcome ?? "—"}`,
          },
          {
            key: "neutral_status",
            label: "Neutral status",
            value: currentStatus?.neutral_status ?? "—",
          },
          {
            key: "refresh",
            label: "Refresh available",
            value: refresh?.available ? "yes" : "no",
          },
          {
            key: "cancel",
            label: "Cancel available",
            value: cancelReadiness?.available ? "yes" : "no",
          },
          {
            key: "retry",
            label: "Retry available",
            value: retryReadiness?.available ? "yes" : "no",
          },
        ]
      : [],
    detailRows: snapshot
      ? [
          {
            key: "shipment_id",
            label: "Shipment id",
            value: snapshot.shipment.id ?? "—",
          },
          {
            key: "shipment_status",
            label: "Shipment status",
            value: snapshot.shipment.status ?? "—",
          },
          {
            key: "provider_shipment_reference_present",
            label: "Provider shipment reference stored",
            value: snapshot.provider.provider_shipment_reference_present
              ? "yes"
              : "no",
          },
          {
            key: "provider_correlation_reference_present",
            label: "Provider correlation reference stored",
            value: snapshot.provider.provider_correlation_reference_present
              ? "yes"
              : "no",
          },
          {
            key: "label_document_present",
            label: "Label document present",
            value: snapshot.shipment.label_document_present ? "yes" : "no",
          },
          {
            key: "attachment_document_present",
            label: "Attachment document present",
            value: snapshot.shipment.attachment_document_present ? "yes" : "no",
          },
          {
            key: "blocked_reason",
            label: "Blocked reason",
            value:
              refresh?.blocked_reason ??
              snapshot.lifecycle.blocked_reason_code ??
              "—",
          },
          {
            key: "created_at",
            label: "Created at",
            value: formatTimestamp(snapshot.timestamps.created_at),
          },
          {
            key: "updated_at",
            label: "Updated at",
            value: formatTimestamp(snapshot.timestamps.updated_at),
          },
        ]
      : [],
    statusRefreshRows: snapshot
      ? [
          {
            key: "refresh_available",
            label: "Available",
            value: refresh?.available ? "yes" : "no",
          },
          {
            key: "blocked_reason_code",
            label: "Blocked reason code",
            value: refresh?.blocked_reason_code ?? "—",
          },
          {
            key: "last_outcome",
            label: "Last outcome",
            value: refresh?.last_outcome ?? "—",
          },
          {
            key: "status_refreshed_at",
            label: "Status refreshed at",
            value: formatTimestamp(refresh?.status_refreshed_at ?? null),
          },
          {
            key: "provider_status",
            label: "Provider status",
            value: currentStatus?.provider_status_normalized ?? "—",
          },
          {
            key: "status_category",
            label: "Status category",
            value: currentStatus?.status_category ?? "—",
          },
          {
            key: "safe_message",
            label: "Safe message",
            value: currentStatus?.safe_message ?? "—",
          },
        ]
      : [],
    cancelRows: snapshot
      ? [
          {
            key: "cancel_available",
            label: "Available",
            value: cancelReadiness?.available ? "yes" : "no",
          },
          {
            key: "blocked_reason_code",
            label: "Blocked reason code",
            value: cancelReadiness?.blocked_reason_code ?? "—",
          },
          {
            key: "blocked_reason",
            label: "Blocked reason",
            value: cancelReadiness?.blocked_reason ?? "—",
          },
          {
            key: "status_neutral",
            label: "Neutral status gate",
            value: cancelReadiness?.status_neutral ?? "—",
          },
          {
            key: "provider_reference",
            label: "Backend provider reference stored",
            value: cancelReadiness?.provider_shipment_reference_present
              ? "yes"
              : "no",
          },
          {
            key: "last_result",
            label: "Last result",
            value: snapshot.cancel.last_result.safe_message,
          },
        ]
      : [],
    ledgerRows: snapshot
      ? [
          {
            key: "linked",
            label: "Ledger linked",
            value: snapshot.ledger.linked ? "yes" : "no",
          },
          {
            key: "state",
            label: "Ledger state",
            value: snapshot.ledger.state ?? "—",
          },
          {
            key: "execution_reference_preview",
            label: "Execution reference preview",
            value:
              snapshot.ledger.execution_reference_preview ??
              snapshot.reference.execution_reference_preview ??
              "—",
          },
          {
            key: "idempotency_key_preview",
            label: "Idempotency key preview",
            value: snapshot.ledger.idempotency_key_preview ?? "—",
          },
          {
            key: "transition_count",
            label: "Transition count",
            value: String(snapshot.ledger.transition_count),
          },
          {
            key: "audit_event_count",
            label: "Audit event count",
            value: String(snapshot.ledger.audit_event_count),
          },
          {
            key: "terminal_completed",
            label: "Terminal completed",
            value: snapshot.ledger.terminal_completed ? "yes" : "no",
          },
          {
            key: "terminal_blocked",
            label: "Terminal blocked",
            value: snapshot.ledger.terminal_blocked ? "yes" : "no",
          },
        ]
      : [],
    contextRows: snapshot
      ? [
          {
            key: "connection_id",
            label: "Connection id",
            value: snapshot.context.connection_id ?? "—",
          },
          {
            key: "order_id",
            label: "Order id",
            value: snapshot.context.order_id ?? "—",
          },
          {
            key: "fulfillment_id",
            label: "Fulfillment id",
            value: snapshot.context.fulfillment_id ?? "—",
          },
          {
            key: "cart_id",
            label: "Cart id",
            value: snapshot.context.cart_id ?? "—",
          },
          {
            key: "shipping_option_id",
            label: "Shipping option id",
            value: snapshot.context.shipping_option_id ?? "—",
          },
          {
            key: "location_id",
            label: "Location id",
            value: snapshot.context.location_id ?? "—",
          },
          {
            key: "quote_reference",
            label: "Quote reference",
            value: snapshot.context.quote_reference.id
              ? `${snapshot.context.quote_reference.id} v${snapshot.context.quote_reference.version ?? "?"}`
              : "—",
          },
          {
            key: "correlation_id_present",
            label: "Correlation id present",
            value: snapshot.context.correlation_id_present ? "yes" : "no",
          },
        ]
      : [],
    emptyText:
      "Paste an execution_reference from the controlled fulfillment result or execution ledger, then load the safe operator snapshot.",
  };
}

export function formatTimestamp(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function normalizeConfig(form: DeliveryConnectionForm): DeliveryConfig {
  const nextConfig: DeliveryConfig = {};

  if (form.auto_confirm) {
    nextConfig.auto_confirm = true;
  }

  if (form.label_format.trim()) {
    nextConfig.label_format = form.label_format.trim();
  }

  if (form.default_warehouse_id.trim()) {
    nextConfig.default_warehouse_id = form.default_warehouse_id.trim();
  }

  const normalizedApiBaseUrl = normalizeYandexApiBaseUrlForForm(
    form.api_base_url,
  );

  if (normalizedApiBaseUrl) {
    nextConfig.api_base_url = normalizedApiBaseUrl;
  }

  return nextConfig;
}

export function connectionToForm(
  connection: DeliveryConnection,
): DeliveryConnectionForm {
  const config = connection.config as DeliveryConfig;

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
      typeof config.default_warehouse_id === "string" &&
      config.default_warehouse_id.trim()
        ? config.default_warehouse_id
        : "",
    api_base_url: normalizeYandexApiBaseUrlForForm(config.api_base_url),
  };
}

export function warehouseToForm(
  warehouse: DeliveryWarehouse,
): DeliveryWarehouseForm {
  const coordinates = getWarehouseCoordinates(warehouse);

  return {
    name: warehouse.name,
    enabled: warehouse.enabled,
    country_code: warehouse.country_code,
    city: warehouse.city || "",
    postal_code: getWarehousePostalCode(warehouse),
    address_line_1: warehouse.address_line_1 || "",
    latitude: coordinates?.lat != null ? String(coordinates.lat) : "",
    longitude: coordinates?.lng != null ? String(coordinates.lng) : "",
    contact_name: warehouse.contact_name || "",
    contact_phone: warehouse.contact_phone || "",
    contact_email: getWarehouseContactEmail(warehouse),
    provider_code: warehouse.provider_code || "yandex",
    provider_warehouse_id: warehouse.provider_warehouse_id || "",
  };
}

export function getWarehouseOptionLabel(warehouse: DeliveryWarehouse) {
  const location = [getWarehousePostalCode(warehouse), warehouse.city, warehouse.address_line_1]
    .filter(Boolean)
    .join(", ");
  const providerRef = warehouse.provider_warehouse_id
    ? ` · station: ${warehouse.provider_warehouse_id}`
    : " · station optional for price";

  return `${warehouse.name}${location ? ` · ${location}` : ""}${providerRef}`;
}

export function getWarehousePostalCode(warehouse: DeliveryWarehouse) {
  const value = warehouse.metadata?.postal_code;
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function getWarehouseContactEmail(warehouse: DeliveryWarehouse) {
  const value = warehouse.metadata?.contact_email;
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function getWarehouseCoordinates(warehouse: DeliveryWarehouse) {
  const coordinates = warehouse.metadata?.coordinates;

  if (Array.isArray(coordinates) && coordinates.length === 2) {
    const lng = Number(coordinates[0]);
    const lat = Number(coordinates[1]);

    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      return { lat, lng };
    }
  }

  const lat = Number(warehouse.metadata?.lat);
  const lng = Number(warehouse.metadata?.lng);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  return null;
}

export function buildWarehouseMetadataFromForm(
  form: DeliveryWarehouseForm,
  current: DeliveryWarehouseMetadata = {},
): DeliveryWarehouseMetadata {
  const metadata: DeliveryWarehouseMetadata = { ...current };
  const postalCode = form.postal_code.trim();
  const contactEmail = form.contact_email.trim();
  const lat = Number(form.latitude);
  const lng = Number(form.longitude);

  delete metadata.postal_code;
  delete metadata.contact_email;
  delete metadata.coordinates;
  delete metadata.lat;
  delete metadata.lng;
  delete metadata.fullname;

  if (postalCode) {
    metadata.postal_code = postalCode;
  }

  if (contactEmail) {
    metadata.contact_email = contactEmail;
  }

  if (form.latitude.trim() && form.longitude.trim() && Number.isFinite(lat) && Number.isFinite(lng)) {
    metadata.lat = lat;
    metadata.lng = lng;
    metadata.coordinates = [lng, lat];
  }

  return metadata;
}

export function statusToneClass(value: string) {
  if (value === "active" || value === "sealed") {
    return "border-green-200 bg-green-50 text-green-700";
  }

  if (value === "error" || value === "invalid") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (value === "disabled") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-ui-border-base bg-ui-bg-subtle text-ui-fg-subtle";
}

export function logSuccessToneClass(success: boolean) {
  return success
    ? "border-green-200 bg-green-50 text-green-700"
    : "border-red-200 bg-red-50 text-red-700";
}

export function plannerStatusToneClass(value: string) {
  if (value === "projected") {
    return "border-green-200 bg-green-50 text-green-700";
  }

  if (value === "deferred") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-ui-border-base bg-ui-bg-subtle text-ui-fg-subtle";
}

export function getYandexConnections(connections: DeliveryConnection[]) {
  return connections.filter(
    (connection) => connection.provider_code === "yandex",
  );
}

export function getYandexWarehouses(warehouses: DeliveryWarehouse[]) {
  return warehouses.filter(
    (warehouse) =>
      !warehouse.provider_code || warehouse.provider_code === "yandex",
  );
}

export function getFilteredEventLogs(
  eventLogs: DeliveryEventLog[],
  activeConnectionId: string | null,
) {
  if (!activeConnectionId) {
    return eventLogs;
  }

  return eventLogs.filter((log) => log.connection_id === activeConnectionId);
}

export function getObservedEncryptionDisabled(input: {
  connections: DeliveryConnection[];
  activeConnection: DeliveryConnection | null;
  formError: Pick<ApiErrorPayload, "code"> | null;
  testConnectionError: Pick<ApiErrorPayload, "code"> | null;
}) {
  return (
    input.connections.some(
      (connection) => connection.credentials_state === "disabled",
    ) ||
    input.activeConnection?.credentials_state === "disabled" ||
    input.formError?.code === "DELIVERY_HUB_ENCRYPTION_DISABLED" ||
    input.testConnectionError?.code === "DELIVERY_HUB_ENCRYPTION_DISABLED"
  );
}

export function getShippingOptionSyncCapability(input: {
  executeGuard: string;
  serviceZoneId: string;
  shippingProfileId: string;
}) {
  const guardConfirmed = isDeliveryHubShippingOptionManualSyncGuardConfirmed(
    input.executeGuard,
  );

  return {
    guardConfirmed,
    canExecute: Boolean(
      guardConfirmed &&
      input.serviceZoneId.trim() &&
      input.shippingProfileId.trim(),
    ),
  };
}

export function deriveShippingOptionPreviewRenderState(
  preview: DeliveryHubShippingOptionPreview | null,
): PreviewRenderState {
  return {
    headerText: preview
      ? `${preview.provider_code} · ${preview.provider_id}`
      : "Preview unavailable",
    summaryCards: preview
      ? previewSummaryCards.map((card) => ({
          key: String(card.key),
          label: card.label,
          value: String(preview.summary[card.key]),
        }))
      : [],
    desiredOptions: preview
      ? preview.plan.desired_options.map((option) => ({
          key: option.data.id,
          modeCode: option.mode_code,
          id: option.data.id,
          supportingConnectionsText:
            option.supporting_connection_ids.join(", ") || "—",
        }))
      : [],
    desiredEmptyText:
      "Planner has no rollout-ready desired deliveryhub options yet.",
    deferredOptions: preview
      ? preview.plan.deferred_options.map((option) => ({
          key: option.data.id,
          modeCode: option.mode_code,
          id: option.data.id,
          issues: option.issues.map((issue, index) => ({
            key: `${option.data.id}-${issue.connection_id}-${issue.code}-${index}`,
            code: issue.code,
            message: issue.message,
            connectionText: `connection: ${issue.connection_id} · provider: ${issue.provider_code}`,
          })),
        }))
      : [],
    deferredEmptyText:
      "No deferred deliveryhub mode projections currently reported by planner.",
    reconciliationCounts: {
      createCandidates: String(
        preview?.reconciliation.create_candidates.length ?? 0,
      ),
      updateCandidates: String(
        preview?.reconciliation.update_candidates.length ?? 0,
      ),
      unchanged: String(preview?.reconciliation.unchanged.length ?? 0),
      orphanedManaged: String(
        preview?.reconciliation.orphaned_managed_options.length ?? 0,
      ),
      ignoredForeign: String(
        preview?.reconciliation.ignored_foreign_options.length ?? 0,
      ),
    },
    createCandidates: preview
      ? preview.reconciliation.create_candidates.map((candidate) => ({
          key: candidate.desired.data.id,
          title: candidate.desired.mode_code,
          subtitle: candidate.desired.data.id,
        }))
      : [],
    updateCandidates: preview
      ? preview.reconciliation.update_candidates.map((candidate) => ({
          key: candidate.current.id,
          title: candidate.current.id,
          subtitle: `desired: ${candidate.desired.data.id} · reasons: ${candidate.reasons.join(", ")}`,
        }))
      : [],
    unchangedEntries: preview
      ? preview.reconciliation.unchanged.map((entry) => ({
          key: entry.current.id,
          title: entry.current.id,
          subtitle: `desired: ${entry.desired.data.id}`,
        }))
      : [],
    orphanedManagedEntries: preview
      ? preview.reconciliation.orphaned_managed_options.map((entry) => ({
          key: entry.current.id,
          title: entry.current.id,
          subtitle: `${entry.normalized_current_data.id} · reason: ${entry.reason}`,
        }))
      : [],
    ignoredForeignEntries: preview
      ? preview.reconciliation.ignored_foreign_options.map((entry) => ({
          key: entry.current.id,
          title: entry.current.id,
          subtitle: `provider: ${entry.current.provider_id || "—"}`,
        }))
      : [],
    connectionPlans: preview
      ? preview.plan.connection_plans.map((plan) => ({
          key: plan.connection_id,
          connectionId: plan.connection_id,
          providerCode: plan.provider_code,
          status: plan.status,
          projectedModesText: plan.projected_mode_codes.join(", ") || "—",
          issues: plan.issues.map((issue, index) => ({
            key: `${plan.connection_id}-${issue.code}-${index}`,
            code: issue.code,
            message: issue.message,
          })),
        }))
      : [],
    connectionPlansEmptyText:
      "No delivery connection planner state returned by backend.",
  };
}

export function deriveShippingOptionManualSyncRenderState(input: {
  result: DeliveryHubShippingOptionManualSyncResponse | null;
  executeGuard: string;
  serviceZoneId: string;
  shippingProfileId: string;
}): ManualSyncRenderState {
  const capability = getShippingOptionSyncCapability({
    executeGuard: input.executeGuard,
    serviceZoneId: input.serviceZoneId,
    shippingProfileId: input.shippingProfileId,
  });
  const result = input.result;
  const report = result?.execution.report ?? null;

  return {
    headerText: result
      ? `${result.provider_code} · ${result.provider_id}`
      : "No manual sync run yet",
    guardConfirmed: capability.guardConfirmed,
    canExecute: capability.canExecute,
    modeFields: result
      ? [
          {
            label: "Requested mode",
            value: result.execution.mode.requested_mode,
          },
          {
            label: "Effective mode",
            value: result.execution.mode.effective_mode,
          },
          {
            label: "Dry-run",
            value: result.execution.mode.is_dry_run ? "yes" : "no",
          },
          {
            label: "Execute requested",
            value: result.execution.mode.execute_requested ? "yes" : "no",
          },
          {
            label: "Execute confirmed",
            value: result.execution.mode.execute_confirmed ? "yes" : "no",
          },
          {
            label: "Execute guard",
            value: result.execution.mode.execute_guard,
          },
        ]
      : [],
    desiredPlanSummaryCards: result
      ? manualSyncDesiredPlanSummaryCards.map((card) => ({
          key: String(card.key),
          label: card.label,
          value: String(result.desired_plan_summary[card.key]),
        }))
      : [],
    reconciliationSummaryCards: result
      ? manualSyncReconciliationSummaryCards.map((card) => ({
          key: String(card.key),
          label: card.label,
          value: String(result.reconciliation_summary[card.key]),
        }))
      : [],
    operationPlanSummaryCards: result
      ? manualSyncOperationPlanSummaryCards.map((card) => ({
          key: String(card.key),
          label: card.label,
          value: String(result.operation_plan.summary[card.key]),
        }))
      : [],
    executionReport: report
      ? {
          outcome: report.outcome,
          outcomeToneIsSuccess: report.outcome === "succeeded",
          aborted: report.aborted ? "yes" : "no",
          errorMode: report.error_mode,
          executedOperationCount: String(report.executed_operations.length),
          summaryCards: manualSyncExecutionSummaryCards.map((card) => ({
            key: String(card.key),
            label: card.label,
            value: String(report.summary[card.key] ?? "0"),
          })),
        }
      : null,
    noExecutionReportText:
      "This is expected for default dry-run mode or for execute requests that never passed confirmation into backend write mode.",
    noResultText:
      "Run the default dry-run to materialize a truthful manual sync result snapshot before considering execute mode.",
  };
}

export function deriveFulfillmentBridgePreviewRenderState(
  preview: DeliveryHubFulfillmentBridgeReadinessPreview | null,
): FulfillmentBridgePreviewRenderState {
  return {
    headerText: preview
      ? `${preview.provider_code} · ${preview.provider_id}`
      : "Preview unavailable",
    summaryCards: preview
      ? [
          ["mode_count", "Modes"],
          ["ready_mode_count", "Ready modes"],
          ["error_mode_count", "Error modes"],
          ["projected_mode_count", "Projected modes"],
          ["deferred_mode_count", "Deferred modes"],
        ].map(([key, label]) => ({
          key,
          label,
          value: String(
            preview.summary[
              key as keyof DeliveryHubFulfillmentBridgeReadinessPreview["summary"]
            ],
          ),
        }))
      : [],
    modePreviews: preview
      ? preview.bridge_preview.mode_previews.map((mode) => ({
          key: mode.mode_code,
          modeCode: mode.mode_code,
          status: mode.status,
          rolloutStatus: mode.rollout_status,
          supportingConnectionsText:
            mode.supporting_connection_ids.join(", ") || "—",
          stepReadinessText: `${mode.steps.filter((step) => step.ready).length}/${mode.steps.length}`,
          issueBadges: mode.blocking_issues.map((issue, index) => ({
            key: `${mode.mode_code}-${issue.connection_id}-${issue.code}-${index}`,
            label: `${issue.code} · ${issue.connection_id}`,
          })),
          errorText: mode.error?.message ?? null,
          shipmentExecutionText: mode.shipment_execution.reason,
        }))
      : [],
    emptyText:
      "Fulfillment bridge readiness preview is unavailable until backend returns a diagnostic-only bridge preview payload.",
  };
}

export function deriveExecutionPlanObservabilityRenderState(
  preview: DeliveryHubExecutionPlanObservabilityReadModel | null,
): ExecutionPlanObservabilityRenderState {
  return {
    headerText: preview
      ? `${preview.provider_code} · ${preview.provider_id}`
      : "Preview unavailable",
    summaryCards: preview
      ? [
          ["mode_count", "Modes"],
          ["ready_mode_count", "Ready previews"],
          ["blocked_mode_count", "Blocked previews"],
          ["projected_mode_count", "Projected modes"],
          ["deferred_mode_count", "Deferred modes"],
          ["unconfigured_mode_count", "Unconfigured modes"],
        ].map(([key, label]) => ({
          key,
          label,
          value: String(
            preview.summary[
              key as keyof DeliveryHubExecutionPlanObservabilityReadModel["summary"]
            ],
          ),
        }))
      : [],
    modePreviews: preview
      ? preview.execution_plan_preview.mode_previews.map((mode) => ({
          key: mode.mode_code,
          modeCode: mode.mode_code,
          status: mode.status,
          rolloutStatus: mode.rollout_status,
          supportingConnectionsText:
            mode.supporting_connection_ids.join(", ") || "—",
          readinessText: `${mode.readiness_verdict.status} · blocked reasons: ${mode.readiness_verdict.blocked_reasons.length}`,
          blockedReasonsText: mode.blocked_reasons.join("; ") || "—",
          issueBadges: [...mode.blocking_issues, ...mode.issues].map(
            (issue, index) => ({
              key: `${mode.mode_code}-${issue.code}-${index}`,
              label:
                "connection_id" in issue
                  ? `${issue.code} · ${issue.connection_id}`
                  : issue.field_path
                    ? `${issue.code} · ${issue.field_path}`
                    : issue.code,
            }),
          ),
          stepReadinessText: `${mode.steps.filter((step) => step.ready).length}/${mode.steps.length}`,
          executionPlanText: mode.execution_plan
            ? `${mode.execution_plan.operation} · ${mode.execution_plan.outbound_request.method} ${mode.execution_plan.outbound_request.path}`
            : "Execution plan remains blocked",
          executionIdentityText: mode.execution_identity
            ? [
                `label=${mode.execution_identity.provider_operation_label}`,
                `reference=${mode.execution_identity.provider_operation_reference}`,
                `plan=${mode.execution_identity.plan_fingerprint}`,
                `execution=${mode.execution_identity.execution_fingerprint}`,
                `idempotency=${mode.execution_identity.idempotency_key_preview}`,
              ].join("\n")
            : "Deterministic execution identity preview unavailable.",
          outboundRequestText: mode.outbound_payload_preview.request
            ? JSON.stringify(mode.outbound_payload_preview.request, null, 2)
            : "Redacted outbound payload preview unavailable.",
          persistenceAuditText: JSON.stringify(
            {
              status: mode.persistence_audit_preview.status,
              metadata_patch: mode.persistence_audit_preview.metadata_patch,
              execution_record: mode.persistence_audit_preview.execution_record,
              idempotency_reservation:
                mode.persistence_audit_preview.idempotency_reservation,
              status_transitions:
                mode.persistence_audit_preview.status_transitions,
              audit_log_entries:
                mode.persistence_audit_preview.audit_log_entries,
              blocked: mode.persistence_audit_preview.blocked,
              deferred: mode.persistence_audit_preview.deferred,
            },
            null,
            2,
          ),
          preflightEligibilityText: [
            `mode=${mode.preflight_eligibility.current_mode}`,
            `decision=${mode.preflight_eligibility.decision}`,
            `real_execution_enabled=${mode.preflight_eligibility.real_execution_enabled ? "yes" : "no"}`,
            `reasons=${mode.preflight_eligibility.reasons.map((reason) => reason.code).join(", ") || "—"}`,
          ].join(" · "),
          preflightPrerequisitesText:
            mode.preflight_eligibility.required_prerequisites
              .map((entry) => `${entry.code}: ${entry.status}`)
              .join("; ") || "—",
          blockedLiveActionsText:
            mode.preflight_eligibility.blocked_live_actions
              .map((entry) => entry.code)
              .join(", ") || "—",
          providerDispatchText: [
            `mode=${mode.provider_dispatch_preview.current_mode}`,
            `decision=${mode.provider_dispatch_preview.dispatch_decision}`,
            `provider=${mode.provider_dispatch_preview.provider.provider_key}`,
            `adapter=${mode.provider_dispatch_preview.provider.adapter_operation_label}`,
            `identity=${mode.provider_dispatch_preview.command_identity.provider_operation_reference || "—"}`,
            `idempotency=${mode.provider_dispatch_preview.command_identity.idempotency_key_preview || "—"}`,
            `origin=${mode.provider_dispatch_preview.command_envelope_summary.origin_kind}`,
            `destination=${mode.provider_dispatch_preview.command_envelope_summary.destination_kind}`,
          ].join(" · "),
          blockedDispatchActionsText:
            mode.provider_dispatch_preview.blocked_dispatch_actions
              .map((entry) => entry.code)
              .join(", ") || "—",
          shipmentResultText: [
            `mode=${mode.shipment_result_preview.current_mode}`,
            `decision=${mode.shipment_result_preview.result_decision}`,
            `status=${mode.shipment_result_preview.projected_result_status}`,
            `target=${mode.shipment_result_preview.normalization_target}`,
            `provider_target=${mode.shipment_result_preview.provider_normalization_target}`,
            `identity=${mode.shipment_result_preview.identity_linkage.provider_operation_reference || "—"}`,
            `tracking=${mode.shipment_result_preview.artifact_summary.tracking_reference_present ? "yes" : "no"}`,
            `label=${mode.shipment_result_preview.artifact_summary.label_document_present ? "yes" : "no"}`,
          ].join(" · "),
          blockedMaterializationActionsText:
            mode.shipment_result_preview.blocked_materialization_actions
              .map((entry) => entry.code)
              .join(", ") || "—",
          applicationPreviewText: [
            `mode=${mode.fulfillment_application_preview.current_mode}`,
            `decision=${mode.fulfillment_application_preview.application_decision}`,
            `status=${mode.fulfillment_application_preview.projected_application_status}`,
            `target=${mode.fulfillment_application_preview.application_target}`,
            `identity=${mode.fulfillment_application_preview.identity_linkage.provider_operation_reference || "—"}`,
            `fulfillment_patch=${mode.fulfillment_application_preview.mutation_semantics.fulfillment_data_patch_present ? "yes" : "no"}`,
            `tracking=${mode.fulfillment_application_preview.mutation_semantics.tracking_projection_present ? "yes" : "no"}`,
            `audit=${mode.fulfillment_application_preview.mutation_semantics.audit_linkage_present ? "yes" : "no"}`,
          ].join(" · "),
          blockedApplicationActionsText:
            mode.fulfillment_application_preview.blocked_application_actions
              .map((entry) => entry.code)
              .join(", ") || "—",
          lifecycleStatusText: [
            `mode=${mode.execution_lifecycle_preview.current_mode}`,
            `status=${mode.execution_lifecycle_preview.lifecycle_status}`,
            `readiness=${mode.execution_lifecycle_preview.readiness_posture}`,
          ].join(" · "),
          lifecyclePhaseSequenceText:
            mode.execution_lifecycle_preview.phase_sequence.join(" → ") || "—",
          lifecycleIdentityText: [
            `identity=${mode.execution_lifecycle_preview.identity_correlation.provider_operation_reference || "—"}`,
            `idempotency=${mode.execution_lifecycle_preview.identity_correlation.idempotency_key_preview || "—"}`,
            `plan=${mode.execution_lifecycle_preview.identity_correlation.plan_fingerprint || "—"}`,
            `execution=${mode.execution_lifecycle_preview.identity_correlation.execution_fingerprint || "—"}`,
          ].join(" · "),
          lifecycleDisabledActionsText: Object.entries(
            mode.execution_lifecycle_preview.confirmations,
          )
            .filter(([, value]) => value)
            .map(([key]) => key)
            .join(", "),
          lifecyclePhaseRows: mode.execution_lifecycle_preview.phases.map(
            (phase) => ({
              key: `${mode.mode_code}-${phase.code}`,
              code: phase.code,
              order: String(phase.order),
              status: phase.status,
              readiness: phase.readiness_posture,
              linkedArtifactsText:
                phase.linked_preview_artifacts.join(", ") || "—",
              blockReasonsText: phase.block_reasons.join("; ") || "—",
              disabledActionsText:
                phase.disabled_live_actions.join(", ") || "—",
            }),
          ),
          failureHandlingText: [
            `mode=${mode.failure_handling_preview.current_mode}`,
            `decision=${mode.failure_handling_preview.failure_path_decision}`,
            `status=${mode.failure_handling_preview.projected_failure_status}`,
            `identity=${mode.failure_handling_preview.identity_linkage.provider_operation_reference || "—"}`,
            `manual=${mode.failure_handling_preview.manual_intervention_projection.status}`,
          ].join(" · "),
          retryPostureText: [
            `eligibility=${mode.failure_handling_preview.retry_projection.eligibility}`,
            `policy=${mode.failure_handling_preview.retry_projection.policy}`,
            `scheduling=${mode.failure_handling_preview.retry_projection.scheduling_status}`,
            `reasons=${mode.failure_handling_preview.retry_projection.retry_block_reasons.join(", ") || "—"}`,
          ].join(" · "),
          compensationPostureText: [
            `requirement=${mode.failure_handling_preview.compensation_projection.requirement}`,
            `writes=${mode.failure_handling_preview.compensation_projection.write_plan_status}`,
            `rollback=${mode.failure_handling_preview.compensation_projection.rollback_status}`,
            `manual_markers=${mode.failure_handling_preview.manual_intervention_projection.reason_markers.join(", ") || "—"}`,
          ].join(" · "),
          blockedFailureActionsText:
            mode.failure_handling_preview.blocked_failure_actions
              .map((entry) => entry.code)
              .join(", ") || "—",
          shipmentExecutionText: mode.shipment_execution.reason,
        }))
      : [],
    emptyText:
      "Execution-plan observability preview is unavailable until backend returns a diagnostic-only admin preview payload.",
  };
}
