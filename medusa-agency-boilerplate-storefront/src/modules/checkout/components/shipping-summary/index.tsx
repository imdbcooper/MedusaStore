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

  const title = shippingMethod?.name ?? null

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
      {deliveryHubSavedSelectionSummary &&
        deliveryHubSavedSelectionSummary.state !== "missing" && (
          <Text className="txt-medium text-ui-fg-subtle">
            {deliveryHubSavedSelectionSummary.pickup_point_label
              ? `${deliveryHubSavedSelectionSummary.title}: ${deliveryHubSavedSelectionSummary.pickup_point_label}`
              : `${deliveryHubSavedSelectionSummary.title}: ${deliveryHubSavedSelectionSummary.status_label}`}
            {deliveryHubSavedSelectionSummary.quote_amount !== null &&
              deliveryHubSavedSelectionSummary.currency_code
              ? ` · ${convertToLocale({
                  amount: deliveryHubSavedSelectionSummary.quote_amount,
                  currency_code: deliveryHubSavedSelectionSummary.currency_code,
                })}`
              : ""}
            {deliveryHubSavedSelectionSummary.quote_eta_label
              ? ` · ${deliveryHubSavedSelectionSummary.quote_eta_label}`
              : ""}
          </Text>
        )}
    </div>
  )
}

export default ShippingSummary
