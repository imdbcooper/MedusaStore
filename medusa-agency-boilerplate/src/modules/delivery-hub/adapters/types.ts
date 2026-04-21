import type { DeliveryConnectionRecord } from "../domain/connection"
import type { DeliveryQuote } from "../domain/quote"
import type { DeliveryPickupPoint } from "../domain/pickup-point"
import type { DeliveryPickupWindow } from "../domain/pickup-window"
import type { DeliveryConnectionTestResult } from "../domain/test-dto"
import type { DeliveryHubProviderDefinition } from "../domain/capabilities"

export type DeliveryHubAdapterContext = {
  connection: DeliveryConnectionRecord
  correlation_id: string
}

export type DeliveryHubListPickupPointsInput = {
  city?: string | null
  country_code?: string | null
}

export type DeliveryHubListPickupWindowsInput = {
  warehouse_id: string
}

export type DeliveryHubQuoteWarehouseToPickupPointInput = {
  warehouse_id: string
  destination_point_id: string
  interval_utc?: {
    from: string
    to: string
  } | null
  currency_code?: string
  items?: Array<{
    quantity?: number
    weight_grams?: number
    price?: number
  }>
}

export type DeliveryHubQuoteDropoffToPickupPointInput = {
  origin_point_id: string
  destination_point_id: string
  currency_code?: string
  items?: Array<{
    quantity?: number
    weight_grams?: number
    price?: number
  }>
}

export type DeliveryHubAdapter = {
  definition: DeliveryHubProviderDefinition
  testConnection(context: DeliveryHubAdapterContext): Promise<DeliveryConnectionTestResult>
  listPickupPoints(
    context: DeliveryHubAdapterContext,
    input: DeliveryHubListPickupPointsInput
  ): Promise<DeliveryPickupPoint[]>
  listPickupWindows(
    context: DeliveryHubAdapterContext,
    input: DeliveryHubListPickupWindowsInput
  ): Promise<DeliveryPickupWindow[]>
  quoteWarehouseToPickupPoint(
    context: DeliveryHubAdapterContext,
    input: DeliveryHubQuoteWarehouseToPickupPointInput
  ): Promise<DeliveryQuote[]>
  quoteDropoffPointToPickupPoint(
    context: DeliveryHubAdapterContext,
    input: DeliveryHubQuoteDropoffToPickupPointInput
  ): Promise<DeliveryQuote[]>
}
