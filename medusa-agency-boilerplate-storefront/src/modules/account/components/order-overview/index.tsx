"use client"

import { Button } from "@medusajs/ui"

import OrderCard from "../order-card"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"

const OrderOverview = ({ orders }: { orders: HttpTypes.StoreOrder[] }) => {
  if (orders?.length) {
    return (
      <div className="flex flex-col gap-y-4 w-full">
        {orders.map((o) => (
          <OrderCard key={o.id} order={o} />
        ))}
      </div>
    )
  }

  return (
    <div
      className="flex w-full flex-col items-center gap-y-3 rounded-xl border border-dashed border-gray-300 bg-gray-50/60 px-6 py-10 text-center"
      data-testid="no-orders-container"
    >
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-ui-fg-subtle">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" />
          <path d="M16 3v5h5" />
          <path d="M8 13h8M8 17h5" />
        </svg>
      </div>
      <h2 className="text-large-semi">Пока нечего показывать</h2>
      <p className="text-small-regular text-ui-fg-subtle">
        У вас ещё нет заказов. Загляните в каталог и соберите первую корзину.
      </p>
      <div className="mt-2">
        <LocalizedClientLink href="/" passHref>
          <Button data-testid="continue-shopping-button">
            Перейти в каталог
          </Button>
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default OrderOverview
