import { Button } from "@medusajs/ui"
import { useMemo } from "react"

import Thumbnail from "@modules/products/components/thumbnail"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"

type OrderCardProps = {
  order: HttpTypes.StoreOrder
}

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info"

type StatusInfo = {
  label: string
  tone: BadgeTone
}

const TONE_CLASSNAMES: Record<BadgeTone, string> = {
  neutral: "bg-gray-100 text-gray-800 border-gray-200",
  success: "bg-emerald-50 text-emerald-800 border-emerald-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  danger: "bg-rose-50 text-rose-800 border-rose-200",
  info: "bg-sky-50 text-sky-800 border-sky-200",
}

function resolvePaymentStatus(
  status: string | null | undefined
): StatusInfo | null {
  if (!status) return null

  const normalized = status.toLowerCase()
  const map: Record<string, StatusInfo> = {
    captured: { label: "Оплачен", tone: "success" },
    partially_captured: { label: "Частично оплачен", tone: "info" },
    authorized: { label: "Авторизован", tone: "info" },
    awaiting: { label: "Ожидает оплату", tone: "warning" },
    not_paid: { label: "Не оплачен", tone: "warning" },
    canceled: { label: "Отменён", tone: "danger" },
    refunded: { label: "Возврат", tone: "neutral" },
    partially_refunded: { label: "Частичный возврат", tone: "neutral" },
    requires_action: { label: "Требуется действие", tone: "warning" },
  }

  return map[normalized] || { label: status, tone: "neutral" }
}

function resolveOrderStatus(
  status: string | null | undefined
): StatusInfo | null {
  if (!status) return null

  const normalized = status.toLowerCase()
  const map: Record<string, StatusInfo> = {
    pending: { label: "В обработке", tone: "warning" },
    completed: { label: "Выполнен", tone: "success" },
    canceled: { label: "Отменён", tone: "danger" },
    archived: { label: "В архиве", tone: "neutral" },
    requires_action: { label: "Требуется действие", tone: "warning" },
    draft: { label: "Черновик", tone: "neutral" },
  }

  return map[normalized] || { label: status, tone: "neutral" }
}

const StatusBadge = ({ info }: { info: StatusInfo }) => (
  <span
    className={
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide " +
      TONE_CLASSNAMES[info.tone]
    }
  >
    {info.label}
  </span>
)

const OrderCard = ({ order }: OrderCardProps) => {
  const numberOfLines = useMemo(() => {
    return (
      order.items?.reduce((acc, item) => {
        return acc + item.quantity
      }, 0) ?? 0
    )
  }, [order])

  const numberOfProducts = useMemo(() => {
    return order.items?.length ?? 0
  }, [order])

  const paymentInfo = resolvePaymentStatus(order.payment_status)
  const orderInfo = resolveOrderStatus(order.status)

  return (
    <div
      className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-gray-300 hover:shadow-sm"
      data-testid="order-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="flex flex-col">
          <div className="uppercase text-large-semi">
            #<span data-testid="order-display-id">{order.display_id}</span>
          </div>
          <span
            className="text-small-regular text-ui-fg-subtle"
            data-testid="order-created-at"
          >
            {new Date(order.created_at).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {orderInfo ? <StatusBadge info={orderInfo} /> : null}
          {paymentInfo ? <StatusBadge info={paymentInfo} /> : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small-regular text-ui-fg-subtle mb-3">
        <span className="font-semibold text-ui-fg-base" data-testid="order-amount">
          {convertToLocale({
            amount: order.total,
            currency_code: order.currency_code,
          })}
        </span>
        <span aria-hidden="true" className="h-1 w-1 rounded-full bg-gray-300" />
        <span>
          {numberOfLines} {numberOfLines === 1 ? "товар" : "товаров"}
        </span>
      </div>

      <div className="grid grid-cols-2 small:grid-cols-4 gap-3 my-4">
        {order.items?.slice(0, 3).map((i) => {
          return (
            <div
              key={i.id}
              className="flex flex-col gap-y-2"
              data-testid="order-item"
            >
              <Thumbnail thumbnail={i.thumbnail} images={[]} size="full" />
              <div className="flex items-center text-small-regular text-ui-fg-base">
                <span
                  className="text-ui-fg-base font-semibold truncate"
                  data-testid="item-title"
                  title={i.title}
                >
                  {i.title}
                </span>
                <span className="ml-2">×</span>
                <span data-testid="item-quantity">{i.quantity}</span>
              </div>
            </div>
          )
        })}
        {numberOfProducts > 4 && (
          <div className="flex h-full w-full flex-col items-center justify-center rounded-md border border-dashed border-gray-200 bg-gray-50 p-3 text-center">
            <span className="text-small-regular text-ui-fg-base">
              + {numberOfLines - 4}
            </span>
            <span className="text-small-regular text-ui-fg-subtle">ещё</span>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <LocalizedClientLink href={`/account/orders/details/${order.id}`}>
          <Button data-testid="order-details-link" variant="secondary">
            Подробнее
          </Button>
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default OrderCard
