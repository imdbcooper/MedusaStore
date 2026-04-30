export type OrderDeliveryHubWidgetSnapshot = {
  version: number
  safe: true
  order?: {
    id?: string
    display_id?: string | number | null
    customer_contact?: {
      name?: string | null
      email_present?: boolean
      phone_present?: boolean
    }
  }
  delivery?: {
    selection_present?: boolean
    selection_source?: string
    method?: {
      provider_code?: string | null
      mode_code?: string | null
      carrier_label?: string | null
      amount?: number | null
      currency_code?: string | null
    }
    pickup_point?: {
      name?: string | null
      address?: string | null
      city?: string | null
      postal_code?: string | null
    } | null
    pickup_window?: {
      date?: string
      time_from?: string | null
      time_to?: string | null
      label?: string
    } | null
  }
  source?: {
    warehouse?: {
      id?: string
      name?: string
      city?: string | null
      address_line_1?: string | null
      contact_phone_present?: boolean
    } | null
    location_id?: string | null
  }
  fulfillment?: {
    id?: string | null
    status?: string | null
    provider_id?: string | null
    location_id?: string | null
    delivery_data_present?: boolean
  }
  package?: {
    item_count?: number
    total_quantity?: number
    ready?: boolean
    blockers?: string[]
  }
  shipment_readiness?: {
    available?: boolean
    status?: string
    blocked_reason_code?: string | null
    blocked_reason?: string | null
    execution_enabled?: boolean
  }
  shipments?: Array<{
    id: string
    operations?: {
      provider?: {
        provider_code?: string | null
        mode_code?: string | null
        dispatch_status?: string | null
      }
      status?: {
        current?: {
          neutral_status?: string | null
          safe_message?: string | null
        } | null
        refresh?: {
          available?: boolean
          blocked_reason?: string | null
          status_refreshed_at?: string | null
        }
      }
      cancel?: {
        readiness?: {
          available?: boolean
          blocked_reason?: string | null
        }
      }
      retry?: {
        readiness?: {
          available?: boolean
          blocked_reason?: string | null
        }
      }
      shipment?: {
        label_document_present?: boolean
        attachment_document_present?: boolean
      }
      safe_logs?: unknown[]
    }
  }>
  safe_logs?: Array<{
    code?: string
    message?: string
    redacted?: true
  }>
  action_posture?: {
    create_shipment?: "available" | "blocked"
    refresh_status?: "available" | "blocked"
    cancel?: "available" | "blocked"
    retry?: "available" | "blocked"
  }
}

export function buildOrderDeliveryHubSnapshotUrl(orderId: string) {
  return `/admin/orders/${encodeURIComponent(orderId)}/delivery-hub`
}

export function buildOrderDeliveryHubCreateShipmentUrl(orderId: string) {
  return `/admin/orders/${encodeURIComponent(orderId)}/delivery-hub/shipments`
}

export function buildOrderDeliveryHubRefreshShipmentUrl(orderId: string, shipmentId: string) {
  return `/admin/orders/${encodeURIComponent(orderId)}/delivery-hub/shipments/${encodeURIComponent(shipmentId)}/refresh`
}

export function buildOrderDeliveryHubCancelShipmentUrl(orderId: string, shipmentId: string) {
  return `/admin/orders/${encodeURIComponent(orderId)}/delivery-hub/shipments/${encodeURIComponent(shipmentId)}/cancel`
}

export function deriveOrderDeliveryHubWidgetState(
  snapshot: OrderDeliveryHubWidgetSnapshot | null | undefined
) {
  if (!snapshot) {
    return {
      status: "empty" as const,
      title: "Delivery Hub",
      method: "Delivery selection is not loaded.",
      pickupPoint: "PVZ not available",
      customer: "Customer contact is not loaded",
      warehouse: "Warehouse/source is not loaded",
      packageReadiness: "Package readiness is not loaded",
      shipmentReadiness: "Shipment readiness is not loaded",
      providerStatus: "Provider status is not loaded",
      createEnabled: false,
      refreshEnabled: false,
      cancelEnabled: false,
      safeLogLines: [],
    }
  }

  const delivery = snapshot.delivery ?? {}
  const method = delivery.method ?? {}
  const pickupPoint = delivery.pickup_point ?? null
  const customer = snapshot.order?.customer_contact ?? {}
  const warehouse = snapshot.source?.warehouse ?? null
  const packageInfo = snapshot.package ?? {}
  const readiness = snapshot.shipment_readiness ?? {}
  const firstShipment = snapshot.shipments?.[0]
  const operations = firstShipment?.operations

  return {
    status: readiness.available ? ("ready" as const) : ("blocked" as const),
    title: "Delivery Hub",
    method: delivery.selection_present
      ? [method.carrier_label, method.mode_code, formatMoney(method.amount, method.currency_code)]
          .filter(Boolean)
          .join(" · ") || "Delivery Hub method selected"
      : "Delivery Hub selection is missing",
    pickupPoint: pickupPoint
      ? [pickupPoint.name, pickupPoint.address, pickupPoint.city, pickupPoint.postal_code]
          .filter(Boolean)
          .join(", ") || "PVZ selected"
      : "PVZ not selected",
    customer: [customer.name, customer.email_present ? "email present" : null, customer.phone_present ? "phone present" : null]
      .filter(Boolean)
      .join(" · ") || "Customer contact is incomplete",
    warehouse: warehouse
      ? [warehouse.name, warehouse.city, warehouse.address_line_1, warehouse.contact_phone_present ? "phone present" : null]
          .filter(Boolean)
          .join(" · ")
      : snapshot.source?.location_id
        ? `Source location ${snapshot.source.location_id}`
        : "Warehouse/source is not resolved",
    packageReadiness: packageInfo.ready
      ? `${packageInfo.item_count ?? 0} items / ${packageInfo.total_quantity ?? 0} pcs ready`
      : (packageInfo.blockers ?? ["Package is not ready"]).join("; "),
    shipmentReadiness: readiness.available
      ? "Create shipment is available"
      : readiness.blocked_reason ?? "Create shipment is blocked",
    providerStatus:
      operations?.status?.current?.neutral_status ??
      operations?.provider?.dispatch_status ??
      (firstShipment ? "Shipment linked" : "No shipment linked"),
    createEnabled: snapshot.action_posture?.create_shipment === "available",
    refreshEnabled: snapshot.action_posture?.refresh_status === "available",
    cancelEnabled: snapshot.action_posture?.cancel === "available",
    shipmentId: firstShipment?.id ?? null,
    labelPresent: operations?.shipment?.label_document_present === true,
    attachmentPresent: operations?.shipment?.attachment_document_present === true,
    safeLogLines: (snapshot.safe_logs ?? []).map((entry) => entry.message).filter((entry): entry is string => !!entry),
  }
}

function formatMoney(amount: number | null | undefined, currencyCode: string | null | undefined) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || !currencyCode) {
    return null
  }

  return `${amount} ${currencyCode}`
}
