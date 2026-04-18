import { Heading, Text } from "@medusajs/ui"

import { storefrontConfig } from "@lib/storefront-config"
import InteractiveLink from "@modules/common/components/interactive-link"

const EmptyCartMessage = () => {
  const cartCopy = storefrontConfig.copy.cart

  return (
    <div
      className="py-48 px-2 flex flex-col justify-center items-start"
      data-testid="empty-cart-message"
    >
      <Heading
        level="h1"
        className="flex flex-row text-3xl-regular gap-x-2 items-baseline"
      >
        {cartCopy.emptyTitle}
      </Heading>
      <Text className="text-base-regular mt-4 mb-6 max-w-[32rem]">
        {cartCopy.emptyDescription}
      </Text>
      <div>
        <InteractiveLink href="/store">{cartCopy.exploreProducts}</InteractiveLink>
      </div>
    </div>
  )
}

export default EmptyCartMessage
