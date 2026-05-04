import { type ApishipPoint } from "@lib/util/apiship"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"
import { Text } from "@medusajs/ui"

type ShippingSummaryProps = {
  cart: HttpTypes.StoreCart
  availableShippingMethods?: HttpTypes.StoreCartShippingOption[] | null
  className?: string
}

function getApishipSummaryPointLabel(point?: ApishipPoint | null) {
  return [point?.name, point?.address].filter(Boolean).join(" · ")
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

  const title = shippingMethod?.name ?? null
  const apishipData = shippingMethod.data?.apishipData as
    | { point?: ApishipPoint | null }
    | undefined
  const apishipPointLabel = getApishipSummaryPointLabel(apishipData?.point)

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
      {apishipPointLabel && (
        <Text className="txt-medium text-ui-fg-subtle">
          ApiShip ПВЗ: {apishipPointLabel}
        </Text>
      )}
    </div>
  )
}

export default ShippingSummary
