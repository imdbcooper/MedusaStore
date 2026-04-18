import { HttpTypes } from "@medusajs/types"
import { Text } from "@medusajs/ui"
import { storefrontConfig } from "@lib/storefront-config"

type OrderDetailsProps = {
  order: HttpTypes.StoreOrder
  showStatus?: boolean
}

const STATUS_TRANSLATIONS: Record<string, string> = {
  canceled: "Отменён",
  pending: "В обработке",
  not_fulfilled: "Не выполнен",
  partially_fulfilled: "Частично выполнен",
  fulfilled: "Выполнен",
  shipped: "Отправлен",
  partially_shipped: "Частично отправлен",
  delivered: "Доставлен",
  not_paid: "Не оплачен",
  awaiting: "В ожидании",
  captured: "Оплачен",
  partially_refunded: "Частичный возврат",
  refunded: "Возвращён",
  requires_action: "Требуется действие",
}

const OrderDetails = ({ order, showStatus }: OrderDetailsProps) => {
  const formatStatus = (str: string) => {
    const normalized = STATUS_TRANSLATIONS[str]

    if (normalized) {
      return normalized
    }

    const formatted = str.split("_").join(" ")

    return formatted.slice(0, 1).toUpperCase() + formatted.slice(1)
  }

  const orderCopy = storefrontConfig.copy.order

  return (
    <div>
      <Text>
        {orderCopy.confirmationSentPrefix}{" "}
        <span
          className="text-ui-fg-medium-plus font-semibold"
          data-testid="order-email"
        >
          {order.email}
        </span>
        .
      </Text>
      <Text className="mt-2">
        {orderCopy.date}:{" "}
        <span data-testid="order-date">
          {new Date(order.created_at).toLocaleDateString("ru-RU")}
        </span>
      </Text>
      <Text className="mt-2 text-ui-fg-interactive">
        {orderCopy.number}: <span data-testid="order-id">{order.display_id}</span>
      </Text>

      <div className="flex items-center text-compact-small gap-x-4 mt-4">
        {showStatus && (
          <>
            <Text>
              {orderCopy.orderStatus}:{" "}
              <span className="text-ui-fg-subtle " data-testid="order-status">
                {formatStatus(order.fulfillment_status)}
              </span>
            </Text>
            <Text>
              {orderCopy.paymentStatus}:{" "}
              <span
                className="text-ui-fg-subtle "
                data-testid="order-payment-status"
              >
                {formatStatus(order.payment_status)}
              </span>
            </Text>
          </>
        )}
      </div>
    </div>
  )
}

export default OrderDetails
