import {
  getApiShipSelectionDetails,
  getApiShipShippingOptionLabel,
  isApiShipShippingOption,
  readApiShipShippingSelectionData,
} from "@lib/util/apiship"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { Text } from "@medusajs/ui"

type ShippingSummaryProps = {
  cart: HttpTypes.StoreCart
  availableShippingMethods?: HttpTypes.StoreCartShippingOption[] | null
  className?: string
}

const ShippingSummary = ({
  cart,
  availableShippingMethods,
  className,
}: ShippingSummaryProps) => {
  const shippingMethod = cart.shipping_methods?.at(-1)

  if (!shippingMethod) {
    return null
  }

  const apiShipSelection = readApiShipShippingSelectionData(shippingMethod)
  const shippingOption =
    availableShippingMethods?.find(
      (option) => option.id === shippingMethod.shipping_option_id
    ) ??
    (apiShipSelection?.shipping_option_id
      ? availableShippingMethods?.find(
          (option) => option.id === apiShipSelection.shipping_option_id
        )
      : undefined)
  const isApiShipSelection =
    isApiShipShippingOption(shippingOption) || Boolean(apiShipSelection)
  const apiShipDetails = isApiShipSelection
    ? getApiShipSelectionDetails(apiShipSelection)
    : null
  const title = isApiShipSelection
    ? getApiShipShippingOptionLabel(
        shippingOption ?? apiShipSelection?.mode_key ?? null
      )
    : shippingMethod.name

  return (
    <div className={className}>
      <Text className="txt-medium text-ui-fg-subtle">
        {title}{" "}
        {convertToLocale({
          amount: shippingMethod.amount ?? 0,
          currency_code: cart.currency_code,
        })}
      </Text>

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
    </div>
  )
}

export default ShippingSummary
