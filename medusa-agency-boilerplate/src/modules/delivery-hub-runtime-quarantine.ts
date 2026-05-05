import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

export const DELIVERY_HUB_RUNTIME_QUARANTINE_ERROR_CODE =
  "delivery_hub_runtime_quarantined" as const

export const DELIVERY_HUB_RUNTIME_QUARANTINE_STATUS = 410 as const

const DELIVERY_HUB_RUNTIME_QUARANTINE_MESSAGE =
  "Delivery Hub runtime endpoints are quarantined after the ApiShip/Gorgo baseline migration. Use the ApiShip/Gorgo checkout and fulfillment baseline instead."

export function buildDeliveryHubRuntimeQuarantineResponse(input: {
  path?: unknown
  method?: unknown
}) {
  return {
    error: {
      code: DELIVERY_HUB_RUNTIME_QUARANTINE_ERROR_CODE,
      message: DELIVERY_HUB_RUNTIME_QUARANTINE_MESSAGE,
      details: {
        baseline: "apiship_gorgo",
        previous_baseline: "delivery_hub",
        path: typeof input.path === "string" ? input.path : null,
        method: typeof input.method === "string" ? input.method : null,
        live_shipment_execution_enabled: false,
      },
    },
  }
}

export function enforceDeliveryHubRuntimeQuarantine(
  req: MedusaRequest,
  res: MedusaResponse,
  _next: MedusaNextFunction
) {
  res.status(DELIVERY_HUB_RUNTIME_QUARANTINE_STATUS).json(
    buildDeliveryHubRuntimeQuarantineResponse({
      path: req.path,
      method: req.method,
    })
  )
}
