export type DeliveryPickupWindow = {
  date: string
  time_from: string | null
  time_to: string | null
  interval_utc: {
    from: string
    to: string
  }
  label: string
  metadata: Record<string, unknown>
}
