import {
  getApiShipSelectionDetails,
  getApiShipShippingOptionLabel,
  isApiShipShippingOption,
  readApiShipShippingSelectionData,
} from "@lib/util/apiship"
import { type DeliveryHubSavedSelectionSummaryModel } from "@lib/util/delivery-hub"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { Text } from "@medusajs/ui"

type ShippingSummaryProps = {
  cart: HttpTypes.StoreCart
  availableShippingMethods?: HttpTypes.StoreCartShippingOption[] | null
  deliveryHubSavedSelectionSummary?: DeliveryHubSavedSelectionSummaryModel | null
  className?: string
}

const ShippingSummary = ({
  cart,
  availableShippingMethods,
  deliveryHubSavedSelectionSummary,
  className,
}: ShippingSummaryProps) => {
  const shippingMethod = cart.shipping_methods?.at(-1)

  if (!shippingMethod && !deliveryHubSavedSelectionSummary) {
    return null
  }

  const apiShipSelection = shippingMethod
    ? readApiShipShippingSelectionData(shippingMethod)
    : null
  const shippingOption = shippingMethod
    ? availableShippingMethods?.find(
        (option) => option.id === shippingMethod.shipping_option_id
      ) ??
      (apiShipSelection?.shipping_option_id
        ? availableShippingMethods?.find(
            (option) => option.id === apiShipSelection.shipping_option_id
          )
        : undefined)
    : undefined
  const isApiShipSelection =
    isApiShipShippingOption(shippingOption) || Boolean(apiShipSelection)
  const apiShipDetails = isApiShipSelection
    ? getApiShipSelectionDetails(apiShipSelection)
    : null
  const title = shippingMethod
    ? isApiShipSelection
      ? getApiShipShippingOptionLabel(
          shippingOption ?? apiShipSelection?.mode_key ?? null
        )
      : shippingMethod.name
    : null

  return (
    <div className={className}>
      {shippingMethod && title && (
        <Text className="txt-medium text-ui-fg-subtle">
          {title}{" "}
          {convertToLocale({
            amount: shippingMethod.amount ?? 0,
            currency_code: cart.currency_code,
          })}
        </Text>
      )}

      {apiShipDetails?.modeLabel && (
        <Text className="mt-1 text-ui-fg-muted txt-small">
          {apiShipDetails.modeLabel}
        </Text>
      )}

      {apiShipDetails?.providerLabel && (
        <Text className="mt-1 text-ui-fg-muted txt-small">
          {apiShipDetails.providerLabel}
          {apiShipDetails.tariffLabel ? ` · ${apiShipDetails.tariffLabel}` : ""}
          {apiShipDetails.etaLabel ? ` · ${apiShipDetails.etaLabel}` : ""}
        </Text>
      )}

      {apiShipDetails?.pointLabel && (
        <Text className="mt-1 text-ui-fg-muted txt-small">
          {apiShipDetails.pointLabel}
          {apiShipDetails.pointAddress ? ` · ${apiShipDetails.pointAddress}` : ""}
        </Text>
      )}

      {deliveryHubSavedSelectionSummary &&
        deliveryHubSavedSelectionSummary.state !== "missing" && (
          <div className="mt-3 rounded-rounded border border-ui-border-base bg-ui-bg-subtle px-3 py-2">
            <Text className="txt-small-plus text-ui-fg-base">
              {deliveryHubSavedSelectionSummary.title}: {deliveryHubSavedSelectionSummary.status_label}
            </Text>
            <Text className="mt-1 text-ui-fg-muted txt-small">
              {deliveryHubSavedSelectionSummary.finality_label}
            </Text>
            <div className="mt-2 grid gap-y-1 text-ui-fg-muted txt-small">
              {deliveryHubSavedSelectionSummary.modality_label && (
                <span>{deliveryHubSavedSelectionSummary.modality_label}</span>
              )}
              {deliveryHubSavedSelectionSummary.quote_amount !== null && (
                <span>
                  Saved quote: {convertToLocale({
                    amount: deliveryHubSavedSelectionSummary.quote_amount,
                    currency_code:
                      deliveryHubSavedSelectionSummary.currency_code ?? cart.currency_code,
                  })}
                  {deliveryHubSavedSelectionSummary.quote_eta_label
                    ? ` · ${deliveryHubSavedSelectionSummary.quote_eta_label}`
                    : ""}
                </span>
              )}
              {deliveryHubSavedSelectionSummary.pickup_point_label && (
                <span>
                  Pickup point: {deliveryHubSavedSelectionSummary.pickup_point_label}
                  {deliveryHubSavedSelectionSummary.pickup_point_address_label
                    ? ` · ${deliveryHubSavedSelectionSummary.pickup_point_address_label}`
                    : ""}
                  {deliveryHubSavedSelectionSummary.pickup_point_code_label
                    ? ` · ${deliveryHubSavedSelectionSummary.pickup_point_code_label}`
                    : ""}
                </span>
              )}
              {deliveryHubSavedSelectionSummary.pickup_window_label && (
                <span>Pickup window: {deliveryHubSavedSelectionSummary.pickup_window_label}</span>
              )}
              {deliveryHubSavedSelectionSummary.readiness_label && (
                <span>Reconciliation: {deliveryHubSavedSelectionSummary.readiness_label}</span>
              )}
              {deliveryHubSavedSelectionSummary.saved_at_label && (
                <span>{deliveryHubSavedSelectionSummary.saved_at_label}</span>
              )}
              {deliveryHubSavedSelectionSummary.correlation_id_label && (
                <span>{deliveryHubSavedSelectionSummary.correlation_id_label}</span>
              )}
            </div>
            {deliveryHubSavedSelectionSummary.reconciliation_messages.length > 0 && (
              <ul className="mt-2 list-disc pl-4 text-ui-fg-muted txt-small">
                {deliveryHubSavedSelectionSummary.reconciliation_messages
                  .slice(0, 3)
                  .map((message) => (
                    <li key={message}>{message}</li>
                  ))}
              </ul>
            )}
            {deliveryHubSavedSelectionSummary.action_label && (
              <Text className="mt-2 text-ui-fg-muted txt-small">
                {deliveryHubSavedSelectionSummary.action_label}
              </Text>
            )}
          </div>
        )}
    </div>
  )
}

export default ShippingSummary
