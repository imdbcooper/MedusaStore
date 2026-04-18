import { storefrontConfig } from "@lib/storefront-config"
import { Heading } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import React from "react"

const Help = () => {
  const orderCopy = storefrontConfig.copy.order

  return (
    <div className="mt-6">
      <Heading className="text-base-semi">{orderCopy.helpTitle}</Heading>
      <div className="text-base-regular my-2">
        <ul className="gap-y-2 flex flex-col">
          <li>
            <LocalizedClientLink href="/contact">{orderCopy.contactUs}</LocalizedClientLink>
          </li>
          <li>
            <LocalizedClientLink href="/contact">
              {orderCopy.returnsAndExchanges}
            </LocalizedClientLink>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default Help
