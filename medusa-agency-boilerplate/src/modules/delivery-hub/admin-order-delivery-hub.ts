import { DeliveryHubError } from "./errors"
import { readDeliveryHubCartSelection } from "./cart-selection"
import { parseDeliveryHubFulfillmentData } from "./provider-surface"
import type { DeliveryConnectionRecord } from "./domain/connection"
import type { DeliveryWarehouseRecord } from "./domain/warehouse"
import type { DeliveryHubAdminShipmentOperationsViewModel } from "./admin-shipment-operations"
import type { DeliveryHubShipmentRecord } from "./storage/shipments-repository"

export const DELIVERY_HUB_ADMIN_ORDER_DELIVERY_HUB_VIEW_VERSION = 1

export type DeliveryHubAdminOrderDeliveryHubActionPosture = "available" | "blocked"

export type DeliveryHubAdminOrderDeliveryHubReadinessStatus =
  | "ready"
  | "blocked"
  | "already_created"

export type DeliveryHubAdminOrderDeliveryHubReadinessBlockCode =
  | "delivery_selection_required"
  | "delivery_hub_fulfillment_required"
  | "delivery_hub_fulfillment_data_required"
  | "package_items_required"
  | "shipment_execution_disabled"
  | "shipment_already_created"

export type DeliveryHubAdminOrderDeliveryHubShipmentEntry = {
  id: string
  operations: DeliveryHubAdminShipmentOperationsViewModel
}

export type DeliveryHubAdminOrderDeliveryHubSnapshot = {
  version: typeof DELIVERY_HUB_ADMIN_ORDER_DELIVERY_HUB_VIEW_VERSION
  safe: true
  order: {
    id: string
    display_id: string | number | null
    email_present: boolean
    customer_contact: {
      name: string | null
      email_present: boolean
      phone_present: boolean
    }
    shipping_address: {
      city: string | null
      address_line_1: string | null
      postal_code: string | null
      country_code: string | null
    }
  }
  delivery: {
    selection_present: boolean
    selection_source:
      | "fulfillment_data"
      | "shipping_method_data"
      | "order_metadata"
      | "shipment_record"
      | "absent"
    method: {
      provider_code: string | null
      mode_code: string | null
      carrier_label: string | null
      amount: number | null
      currency_code: string | null
    }
    pickup_point: {
      name: string | null
      address: string | null
      city: string | null
      postal_code: string | null
    } | null
    pickup_window: {
      date: string
      time_from: string | null
      time_to: string | null
      label: string
    } | null
    connection_id: string | null
    quote_reference: {
      present: boolean
      version: number | null
    }
  }
  source: {
    warehouse: {
      id: string
      name: string
      city: string | null
      address_line_1: string | null
      contact_phone_present: boolean
    } | null
    location_id: string | null
  }
  fulfillment: {
    id: string | null
    status: string | null
    provider_id: string | null
    location_id: string | null
    delivery_data_present: boolean
  }
  package: {
    item_count: number
    total_quantity: number
    ready: boolean
    blockers: string[]
    items: Array<{
      id: string | null
      title: string | null
      sku: string | null
      quantity: number
      requires_shipping: boolean | null
    }>
  }
  shipment_readiness: {
    available: boolean
    status: DeliveryHubAdminOrderDeliveryHubReadinessStatus
    blocked_reason_code: DeliveryHubAdminOrderDeliveryHubReadinessBlockCode | null
    blocked_reason: string | null
    execution_enabled: boolean
  }
  shipments: DeliveryHubAdminOrderDeliveryHubShipmentEntry[]
  safe_logs: Array<{
    code: string
    message: string
    redacted: true
  }>
  action_posture: {
    create_shipment: DeliveryHubAdminOrderDeliveryHubActionPosture
    refresh_status: DeliveryHubAdminOrderDeliveryHubActionPosture
    cancel: DeliveryHubAdminOrderDeliveryHubActionPosture
    retry: DeliveryHubAdminOrderDeliveryHubActionPosture
  }
  anti_leak_confirmations: {
    raw_provider_payloads_included: false
    raw_provider_request_included: false
    raw_provider_response_included: false
    auth_headers_included: false
    credentials_included: false
    raw_quote_key_included: false
    raw_offer_id_included: false
    raw_provider_identifier_included: false
    raw_execution_secret_included: false
  }
}

type SnapshotInput = {
  order_id: string
  order?: Record<string, unknown> | null
  shipments?: DeliveryHubShipmentRecord[] | null
  shipment_operations?: DeliveryHubAdminOrderDeliveryHubShipmentEntry[] | null
  connections?: DeliveryConnectionRecord[] | null
  warehouses?: DeliveryWarehouseRecord[] | null
  execution_enabled?: boolean
}

type DeliverySelectionSummary = Pick<
  DeliveryHubAdminOrderDeliveryHubSnapshot,
  "delivery"
>["delivery"]

export function buildDeliveryHubAdminOrderDeliveryHubSnapshot(
  input: SnapshotInput
): DeliveryHubAdminOrderDeliveryHubSnapshot {
  const order = asRecord(input.order)
  const orderId = normalizeNullableText(input.order_id) ?? normalizeNullableText(order.id) ?? "unknown_order"
  const shipments = input.shipments ?? []
  const shipmentOperations = input.shipment_operations ?? []
  const fulfillment = selectDeliveryHubFulfillment(order, shipments)
  const selection = resolveDeliverySelection({
    order,
    fulfillment,
    shipment: shipments[0] ?? null,
  })
  const packageSummary = buildPackageSummary(order)
  const connection = selection.connection_id
    ? (input.connections ?? []).find((entry) => entry.id === selection.connection_id) ?? null
    : null
  const warehouse = resolveWarehouseSummary({
    connection,
    warehouses: input.warehouses ?? [],
  })
  const readiness = resolveShipmentReadiness({
    selection,
    fulfillment,
    package_ready: packageSummary.ready,
    package_blockers: packageSummary.blockers,
    shipment_count: shipments.length,
    execution_enabled: input.execution_enabled === true,
  })
  const refreshAvailable = shipmentOperations.some(
    (entry) => entry.operations.status.refresh.available
  )
  const cancelAvailable = shipmentOperations.some(
    (entry) => entry.operations.cancel.readiness.available
  )
  const retryAvailable = shipmentOperations.some(
    (entry) => entry.operations.retry.readiness.available
  )

  return {
    version: DELIVERY_HUB_ADMIN_ORDER_DELIVERY_HUB_VIEW_VERSION,
    safe: true,
    order: {
      id: orderId,
      display_id: normalizeDisplayId(order.display_id),
      email_present: !!normalizeNullableText(order.email),
      customer_contact: buildCustomerContact(order),
      shipping_address: buildShippingAddress(order.shipping_address),
    },
    delivery: selection,
    source: {
      warehouse,
      location_id: normalizeNullableText(fulfillment.location_id) ?? shipments[0]?.location_id ?? null,
    },
    fulfillment: {
      id: normalizeNullableText(fulfillment.id),
      status: normalizeNullableText(fulfillment.status),
      provider_id: normalizeNullableText(fulfillment.provider_id),
      location_id: normalizeNullableText(fulfillment.location_id),
      delivery_data_present: !!resolveFulfillmentDeliveryData(fulfillment),
    },
    package: packageSummary,
    shipment_readiness: readiness,
    shipments: shipmentOperations,
    safe_logs: buildSafeLogs({
      readiness,
      shipment_count: shipments.length,
      selection,
    }),
    action_posture: {
      create_shipment: readiness.available ? "available" : "blocked",
      refresh_status: refreshAvailable ? "available" : "blocked",
      cancel: cancelAvailable ? "available" : "blocked",
      retry: retryAvailable ? "available" : "blocked",
    },
    anti_leak_confirmations: buildAntiLeakConfirmations(),
  }
}

export function assertDeliveryHubAdminOrderShipmentCreateAllowed(
  snapshot: DeliveryHubAdminOrderDeliveryHubSnapshot
) {
  if (snapshot.shipment_readiness.available) {
    return
  }

  throw new DeliveryHubError({
    code: "DELIVERY_HUB_VALIDATION_ERROR",
    message: snapshot.shipment_readiness.blocked_reason ?? "Delivery Hub shipment creation is not ready for this order.",
    status: 409,
    details: {
      order_id: snapshot.order.id,
      blocked_reason_code: snapshot.shipment_readiness.blocked_reason_code,
      redacted: true,
    },
  })
}

function resolveDeliverySelection(input: {
  order: Record<string, unknown>
  fulfillment: Record<string, unknown>
  shipment: DeliveryHubShipmentRecord | null
}): DeliverySelectionSummary {
  const fulfillmentData = resolveFulfillmentDeliveryData(input.fulfillment)

  if (fulfillmentData) {
    return buildSelectionFromFulfillmentData(fulfillmentData, "fulfillment_data")
  }

  const shippingMethodData = resolveShippingMethodDeliveryData(input.order)

  if (shippingMethodData) {
    return buildSelectionFromFulfillmentData(shippingMethodData, "shipping_method_data")
  }

  const metadataSelection = readDeliveryHubCartSelection(input.order.metadata)

  if (metadataSelection) {
    return buildSelectionFromCartSelection(metadataSelection, "order_metadata")
  }

  if (input.shipment) {
    return {
      selection_present: true,
      selection_source: "shipment_record",
      method: {
        provider_code: input.shipment.provider_code,
        mode_code: input.shipment.mode_code,
        carrier_label: null,
        amount: null,
        currency_code: null,
      },
      pickup_point: null,
      pickup_window: null,
      connection_id: input.shipment.connection_id,
      quote_reference: {
        present: !!input.shipment.quote_reference_id,
        version: input.shipment.quote_reference_version,
      },
    }
  }

  return {
    selection_present: false,
    selection_source: "absent",
    method: {
      provider_code: null,
      mode_code: null,
      carrier_label: null,
      amount: null,
      currency_code: null,
    },
    pickup_point: null,
    pickup_window: null,
    connection_id: null,
    quote_reference: {
      present: false,
      version: null,
    },
  }
}

function buildSelectionFromFulfillmentData(
  value: Record<string, unknown>,
  source: DeliverySelectionSummary["selection_source"]
): DeliverySelectionSummary {
  const parsed = parseDeliveryHubFulfillmentData(value)

  if (!parsed) {
    return {
      selection_present: false,
      selection_source: "absent",
      method: {
        provider_code: null,
        mode_code: null,
        carrier_label: null,
        amount: null,
        currency_code: null,
      },
      pickup_point: null,
      pickup_window: null,
      connection_id: null,
      quote_reference: {
        present: false,
        version: null,
      },
    }
  }

  return {
    selection_present: true,
    selection_source: source,
    method: {
      provider_code: "deliveryhub",
      mode_code: parsed.mode_code,
      carrier_label: parsed.quote.carrier_label,
      amount: parsed.quote.customer_price?.amount ?? parsed.quote.amount,
      currency_code: parsed.quote.customer_price?.currency_code ?? parsed.quote.currency_code,
    },
    pickup_point: {
      name: parsed.pickup_point.name,
      address: parsed.pickup_point.address,
      city: parsed.pickup_point.city,
      postal_code: parsed.pickup_point.postal_code,
    },
    pickup_window: parsed.pickup_window
      ? {
          date: parsed.pickup_window.date,
          time_from: parsed.pickup_window.time_from,
          time_to: parsed.pickup_window.time_to,
          label: parsed.pickup_window.label,
        }
      : null,
    connection_id: parsed.connection_id,
    quote_reference: {
      present: true,
      version: parsed.quote_reference.version,
    },
  }
}

function buildSelectionFromCartSelection(
  value: NonNullable<ReturnType<typeof readDeliveryHubCartSelection>>,
  source: DeliverySelectionSummary["selection_source"]
): DeliverySelectionSummary {
  return {
    selection_present: true,
    selection_source: source,
    method: {
      provider_code: value.provider_code,
      mode_code: value.quote_type,
      carrier_label: value.quote.carrier_label,
      amount: value.quote.customer_price?.amount ?? value.quote.amount,
      currency_code: value.quote.customer_price?.currency_code ?? value.quote.currency_code,
    },
    pickup_point: {
      name: value.pickup_point.name,
      address: value.pickup_point.address,
      city: value.pickup_point.city,
      postal_code: value.pickup_point.postal_code,
    },
    pickup_window: value.pickup_window
      ? {
          date: value.pickup_window.date,
          time_from: value.pickup_window.time_from,
          time_to: value.pickup_window.time_to,
          label: value.pickup_window.label,
        }
      : null,
    connection_id: value.connection_id,
    quote_reference: {
      present: true,
      version: value.quote_reference.version,
    },
  }
}

function resolveShipmentReadiness(input: {
  selection: DeliverySelectionSummary
  fulfillment: Record<string, unknown>
  package_ready: boolean
  package_blockers: string[]
  shipment_count: number
  execution_enabled: boolean
}): DeliveryHubAdminOrderDeliveryHubSnapshot["shipment_readiness"] {
  if (input.shipment_count > 0) {
    return {
      available: false,
      status: "already_created",
      blocked_reason_code: "shipment_already_created",
      blocked_reason: "A Delivery Hub shipment is already linked to this order. Duplicate shipment creation is blocked by the order-scoped read model before dispatch.",
      execution_enabled: input.execution_enabled,
    }
  }

  if (!input.selection.selection_present) {
    return blockedReadiness(
      "delivery_selection_required",
      "Delivery Hub selection is required before a shipment can be created from the order.",
      input.execution_enabled
    )
  }

  if (!normalizeNullableText(input.fulfillment.id)) {
    return blockedReadiness(
      "delivery_hub_fulfillment_required",
      "A Delivery Hub fulfillment context is required before shipment creation.",
      input.execution_enabled
    )
  }

  if (!resolveFulfillmentDeliveryData(input.fulfillment)) {
    return blockedReadiness(
      "delivery_hub_fulfillment_data_required",
      "The fulfillment must include normalized Delivery Hub fulfillment data before shipment creation.",
      input.execution_enabled
    )
  }

  if (!input.package_ready) {
    return blockedReadiness(
      "package_items_required",
      input.package_blockers.join("; ") || "Package items are required before shipment creation.",
      input.execution_enabled
    )
  }

  if (!input.execution_enabled) {
    return blockedReadiness(
      "shipment_execution_disabled",
      "DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED is disabled; live shipment creation remains fail-closed.",
      false
    )
  }

  return {
    available: true,
    status: "ready",
    blocked_reason_code: null,
    blocked_reason: null,
    execution_enabled: true,
  }
}

function blockedReadiness(
  code: DeliveryHubAdminOrderDeliveryHubReadinessBlockCode,
  reason: string,
  executionEnabled: boolean
): DeliveryHubAdminOrderDeliveryHubSnapshot["shipment_readiness"] {
  return {
    available: false,
    status: "blocked",
    blocked_reason_code: code,
    blocked_reason: reason,
    execution_enabled: executionEnabled,
  }
}

function selectDeliveryHubFulfillment(
  order: Record<string, unknown>,
  shipments: DeliveryHubShipmentRecord[]
) {
  const fulfillments = asArray(order.fulfillments).map(asRecord)
  const shipmentFulfillmentIds = new Set(
    shipments
      .map((shipment) => shipment.fulfillment_id)
      .filter((value): value is string => !!value)
  )

  return (
    fulfillments.find((entry) => shipmentFulfillmentIds.has(normalizeNullableText(entry.id) ?? "")) ??
    fulfillments.find((entry) => !!resolveFulfillmentDeliveryData(entry)) ??
    fulfillments[0] ??
    {}
  )
}

function resolveFulfillmentDeliveryData(fulfillment: Record<string, unknown>) {
  const data = asRecord(fulfillment.data)
  const delivery = asRecord(data.delivery)

  if (Object.keys(delivery).length) {
    return delivery
  }

  if (looksLikeFulfillmentDeliveryData(data)) {
    return data
  }

  return null
}

function resolveShippingMethodDeliveryData(order: Record<string, unknown>) {
  for (const method of asArray(order.shipping_methods).map(asRecord)) {
    const data = asRecord(method.data)
    const delivery = asRecord(data.delivery)

    if (Object.keys(delivery).length) {
      return delivery
    }

    if (looksLikeFulfillmentDeliveryData(data)) {
      return data
    }
  }

  return null
}

function looksLikeFulfillmentDeliveryData(value: Record<string, unknown>) {
  return !!(
    normalizeNullableText(value.connection_id) &&
    normalizeNullableText(value.mode_code) &&
    asRecord(value.quote_reference).id &&
    Object.keys(asRecord(value.quote)).length &&
    Object.keys(asRecord(value.pickup_point)).length
  )
}

function buildPackageSummary(order: Record<string, unknown>): DeliveryHubAdminOrderDeliveryHubSnapshot["package"] {
  const items = asArray(order.items).map((item) => {
    const root = asRecord(item)
    const variant = asRecord(root.variant)
    const quantity = normalizeQuantity(root.quantity)

    return {
      id: normalizeNullableText(root.id),
      title: normalizeNullableText(root.title),
      sku: normalizeNullableText(variant.sku),
      quantity,
      requires_shipping:
        typeof root.requires_shipping === "boolean" ? root.requires_shipping : null,
    }
  })
  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0)
  const blockers: string[] = []

  if (!items.length) {
    blockers.push("Order items are missing.")
  }

  if (totalQuantity <= 0) {
    blockers.push("Order item quantity must be greater than zero.")
  }

  return {
    item_count: items.length,
    total_quantity: totalQuantity,
    ready: blockers.length === 0,
    blockers,
    items,
  }
}

function resolveWarehouseSummary(input: {
  connection: DeliveryConnectionRecord | null
  warehouses: DeliveryWarehouseRecord[]
}): DeliveryHubAdminOrderDeliveryHubSnapshot["source"]["warehouse"] {
  const defaultWarehouseId = normalizeNullableText(input.connection?.config.default_warehouse_id)
  const warehouse = defaultWarehouseId
    ? input.warehouses.find((entry) => entry.id === defaultWarehouseId) ?? null
    : null

  if (!warehouse) {
    return null
  }

  return {
    id: warehouse.id,
    name: warehouse.name,
    city: warehouse.city,
    address_line_1: warehouse.address_line_1,
    contact_phone_present: !!warehouse.contact_phone,
  }
}

function buildCustomerContact(order: Record<string, unknown>) {
  const shippingAddress = asRecord(order.shipping_address)
  const firstName = normalizeNullableText(shippingAddress.first_name)
  const lastName = normalizeNullableText(shippingAddress.last_name)
  const name = [firstName, lastName].filter(Boolean).join(" ").trim() || null

  return {
    name,
    email_present: !!normalizeNullableText(order.email),
    phone_present: !!normalizeNullableText(shippingAddress.phone),
  }
}

function buildShippingAddress(value: unknown) {
  const root = asRecord(value)

  return {
    city: normalizeNullableText(root.city),
    address_line_1: normalizeNullableText(root.address_1 ?? root.address_line_1),
    postal_code: normalizeNullableText(root.postal_code),
    country_code: normalizeNullableText(root.country_code),
  }
}

function buildSafeLogs(input: {
  readiness: DeliveryHubAdminOrderDeliveryHubSnapshot["shipment_readiness"]
  shipment_count: number
  selection: DeliverySelectionSummary
}): DeliveryHubAdminOrderDeliveryHubSnapshot["safe_logs"] {
  const logs: DeliveryHubAdminOrderDeliveryHubSnapshot["safe_logs"] = []

  if (input.selection.selection_present) {
    logs.push({
      code: "delivery_selection_present",
      message: "Delivery Hub delivery selection is available in the order context.",
      redacted: true,
    })
  } else {
    logs.push({
      code: "delivery_selection_missing",
      message: "No Delivery Hub delivery selection was found in the order context.",
      redacted: true,
    })
  }

  if (input.shipment_count > 0) {
    logs.push({
      code: "shipment_linked",
      message: "At least one Delivery Hub shipment is linked to this order.",
      redacted: true,
    })
  }

  if (!input.readiness.available && input.readiness.blocked_reason_code) {
    logs.push({
      code: input.readiness.blocked_reason_code,
      message: input.readiness.blocked_reason ?? "Shipment creation is blocked.",
      redacted: true,
    })
  }

  return logs
}

function buildAntiLeakConfirmations() {
  return {
    raw_provider_payloads_included: false,
    raw_provider_request_included: false,
    raw_provider_response_included: false,
    auth_headers_included: false,
    credentials_included: false,
    raw_quote_key_included: false,
    raw_offer_id_included: false,
    raw_provider_identifier_included: false,
    raw_execution_secret_included: false,
  } as const
}

function normalizeDisplayId(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value)
  }

  return normalizeNullableText(value)
}

function normalizeQuantity(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value)
  }

  return 0
}

function normalizeNullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}
