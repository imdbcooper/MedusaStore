"use client"

import { storefrontConfig } from "@lib/storefront-config"
import { Heading, Text, clx } from "@medusajs/ui"
import { useSearchParams } from "next/navigation"

import PaymentButton from "../payment-button"

const Review = ({
  cart,
  yookassaStatus,
}: {
  cart: any
  yookassaStatus?: string | null
}) => {
  const searchParams = useSearchParams()

  const isOpen = searchParams.get("step") === "review"

  const paidByGiftcard =
    cart?.gift_cards && cart?.gift_cards?.length > 0 && cart?.total === 0

  const previousStepsCompleted =
    cart.shipping_address &&
    cart.shipping_methods.length > 0 &&
    (cart.payment_collection || paidByGiftcard)

  const checkoutCopy = storefrontConfig.copy.checkout

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className={clx(
            "flex flex-row text-3xl-regular gap-x-2 items-baseline",
            {
              "opacity-50 pointer-events-none select-none": !isOpen,
            }
          )}
        >
          {checkoutCopy.review}
        </Heading>
      </div>
      {isOpen && previousStepsCompleted && (
        <>
          {yookassaStatus === "return" && (
            <div className="mb-6 rounded-rounded border border-ui-border-base bg-ui-bg-subtle px-4 py-3">
              <Text className="txt-small text-ui-fg-subtle">
                {checkoutCopy.yookassaReturnBanner}
              </Text>
            </div>
          )}
          <div className="flex items-start gap-x-1 w-full mb-6">
            <div className="w-full">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                {checkoutCopy.reviewTermsPrefix} {storefrontConfig.storeName}
                {checkoutCopy.reviewTermsStoreSuffix}
              </Text>
            </div>
          </div>
          <PaymentButton cart={cart} data-testid="submit-order-button" />
        </>
      )}
    </div>
  )
}

export default Review
