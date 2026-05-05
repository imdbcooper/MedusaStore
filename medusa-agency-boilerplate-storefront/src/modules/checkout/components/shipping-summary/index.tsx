import { buildDeliveryCheckoutSummary } from "@lib/util/delivery-checkout"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { Text } from "@medusajs/ui"

type ShippingSummaryProps = {
  cart: HttpTypes.StoreCart
  className?: string
}

const ShippingSummary = ({ cart, className }: ShippingSummaryProps) => {
  const shippingMethod = cart.shipping_methods?.at(-1)

  if (!shippingMethod) {
    return null
  }

  const title = shippingMethod?.name ?? null
  const deliverySummary = buildDeliveryCheckoutSummary(shippingMethod)

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
      {deliverySummary?.point_label && (
        <Text className="txt-medium text-ui-fg-subtle">
          {deliverySummary.label} ПВЗ: {deliverySummary.point_label}
        </Text>
      )}
    </div>
  )
}

export default ShippingSummary
