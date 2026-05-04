import { listCartShippingMethods } from "@lib/data/fulfillment"
import { storefrontConfig } from "@lib/storefront-config"
import { Heading, Text } from "@medusajs/ui"
import ItemsPreviewTemplate from "@modules/cart/templates/preview"
import DiscountCode from "@modules/checkout/components/discount-code"
import ShippingSummary from "@modules/checkout/components/shipping-summary"
import CartTotals from "@modules/common/components/cart-totals"
import Divider from "@modules/common/components/divider"

const CheckoutSummary = async ({ cart }: { cart: any }) => {
  const shippingMethods = cart?.id ? await listCartShippingMethods(cart.id) : null

  return (
    <div className="sticky top-0 flex flex-col-reverse small:flex-col gap-y-8 py-8 small:py-0 ">
      <div className="w-full bg-white flex flex-col">
        <Divider className="my-6 small:hidden" />
        <Heading
          level="h2"
          className="flex flex-row text-3xl-regular items-baseline"
        >
          {storefrontConfig.copy.checkout.inYourCart}
        </Heading>
        <Divider className="my-6" />
        {(cart.shipping_methods?.length ?? 0) > 0 && (
          <div className="mb-6">
            <Text className="txt-medium-plus text-ui-fg-base mb-1">
              {storefrontConfig.copy.checkout.delivery}
            </Text>
            <ShippingSummary
              cart={cart}
              availableShippingMethods={shippingMethods}
            />
          </div>
        )}
        <CartTotals totals={cart} />
        <ItemsPreviewTemplate cart={cart} />
        <div className="my-6">
          <DiscountCode cart={cart} />
        </div>
      </div>
    </div>
  )
}

export default CheckoutSummary
