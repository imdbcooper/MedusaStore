import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  buildOrderDeliveryHubCancelShipmentUrl,
  buildOrderDeliveryHubCreateShipmentUrl,
  buildOrderDeliveryHubRefreshShipmentUrl,
  buildOrderDeliveryHubRetryShipmentUrl,
  buildOrderDeliveryHubSnapshotUrl,
  deriveOrderDeliveryHubWidgetState,
  type OrderDeliveryHubWidgetSnapshot,
} from "./order-delivery-hub-state"

type ApiResponse = {
  ok: true
  delivery_hub: OrderDeliveryHubWidgetSnapshot
}

const adminFetch = async <T,>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message =
      typeof payload?.error?.message === "string"
        ? payload.error.message
        : `Delivery Hub request failed with HTTP ${response.status}`
    throw new Error(message)
  }

  return payload as T
}

const OrderDeliveryHubWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const orderId = order.id
  const [snapshot, setSnapshot] = useState<OrderDeliveryHubWidgetSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const payload = await adminFetch<ApiResponse>(buildOrderDeliveryHubSnapshotUrl(orderId))
      setSnapshot(payload.delivery_hub)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Delivery Hub snapshot failed")
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void load()
  }, [load])

  const state = useMemo(() => deriveOrderDeliveryHubWidgetState(snapshot), [snapshot])

  const runAction = useCallback(
    async (url: string) => {
      setActionLoading(true)
      setError(null)

      try {
        const payload = await adminFetch<ApiResponse>(url, {
          method: "POST",
          body: JSON.stringify({}),
        })
        setSnapshot(payload.delivery_hub ?? snapshot)
        await load()
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Delivery Hub action failed")
      } finally {
        setActionLoading(false)
      }
    },
    [load, snapshot]
  )

  const shipmentId = state.shipmentId

  return (
    <section style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <h3 style={titleStyle}>Delivery Hub</h3>
          <p style={mutedStyle}>Order-scoped shipment operations</p>
        </div>
        <button style={secondaryButtonStyle} onClick={() => void load()} disabled={loading || actionLoading}>
          Refresh panel
        </button>
      </div>

      {loading ? <p style={mutedStyle}>Loading Delivery Hub order snapshot…</p> : null}
      {error ? <p style={errorStyle}>{error}</p> : null}

      <dl style={gridStyle}>
        <InfoLine label="Delivery method" value={state.method} />
        <InfoLine label="PVZ" value={state.pickupPoint} />
        <InfoLine label="Customer" value={state.customer} />
        <InfoLine label="Warehouse/source" value={state.warehouse} />
        <InfoLine label="Package/items" value={state.packageReadiness} />
        <InfoLine label="Shipment readiness" value={state.shipmentReadiness} />
        <InfoLine label="Provider/status" value={state.providerStatus} />
        <InfoLine label="Labels/tracking" value={formatDocuments(state.labelPresent, state.attachmentPresent)} />
      </dl>

      <div style={actionsStyle}>
        <button
          style={primaryButtonStyle}
          onClick={() => void runAction(buildOrderDeliveryHubCreateShipmentUrl(orderId))}
          disabled={!state.createEnabled || actionLoading}
        >
          Create shipment
        </button>
        <button
          style={secondaryButtonStyle}
          onClick={() => shipmentId && void runAction(buildOrderDeliveryHubRefreshShipmentUrl(orderId, shipmentId))}
          disabled={!shipmentId || !state.refreshEnabled || actionLoading}
        >
          Refresh status
        </button>
        <button
          style={secondaryButtonStyle}
          onClick={() => shipmentId && void runAction(buildOrderDeliveryHubRetryShipmentUrl(orderId, shipmentId))}
          disabled={!shipmentId || !state.retryEnabled || actionLoading}
        >
          Retry
        </button>
        <button
          style={dangerButtonStyle}
          onClick={() => shipmentId && void runAction(buildOrderDeliveryHubCancelShipmentUrl(orderId, shipmentId))}
          disabled={!shipmentId || !state.cancelEnabled || actionLoading}
        >
          Cancel shipment
        </button>
      </div>

      <div style={logsStyle}>
        <strong>Safe logs</strong>
        {state.safeLogLines.length ? (
          <ul style={listStyle}>
            {state.safeLogLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p style={mutedStyle}>No safe Delivery Hub logs for this order snapshot.</p>
        )}
      </div>
    </section>
  )
}

const InfoLine = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt style={labelStyle}>{label}</dt>
    <dd style={valueStyle}>{value}</dd>
  </div>
)

function formatDocuments(labelPresent?: boolean, attachmentPresent?: boolean) {
  const parts = [
    labelPresent ? "label present" : "label unavailable",
    attachmentPresent ? "attachment present" : "attachment unavailable",
  ]

  return parts.join(" · ")
}

const cardStyle = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 16,
  background: "#fff",
  display: "grid",
  gap: 14,
} as const

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
} as const

const titleStyle = {
  margin: 0,
  fontSize: 16,
  fontWeight: 700,
} as const

const mutedStyle = {
  margin: 0,
  color: "#6b7280",
  fontSize: 12,
} as const

const errorStyle = {
  margin: 0,
  color: "#b91c1c",
  fontSize: 12,
} as const

const gridStyle = {
  display: "grid",
  gap: 10,
} as const

const labelStyle = {
  color: "#6b7280",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: 2,
} as const

const valueStyle = {
  margin: 0,
  fontSize: 13,
  color: "#111827",
} as const

const actionsStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
} as const

const primaryButtonStyle = {
  border: 0,
  borderRadius: 8,
  padding: "8px 10px",
  background: "#111827",
  color: "#fff",
  cursor: "pointer",
} as const

const secondaryButtonStyle = {
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: "8px 10px",
  background: "#fff",
  color: "#111827",
  cursor: "pointer",
} as const

const dangerButtonStyle = {
  border: "1px solid #fecaca",
  borderRadius: 8,
  padding: "8px 10px",
  background: "#fff",
  color: "#b91c1c",
  cursor: "pointer",
} as const

const logsStyle = {
  borderTop: "1px solid #e5e7eb",
  paddingTop: 12,
  fontSize: 12,
} as const

const listStyle = {
  margin: "6px 0 0",
  paddingLeft: 18,
} as const

export const config = defineWidgetConfig({
  zone: "order.details.side.after",
})

export default OrderDeliveryHubWidget
