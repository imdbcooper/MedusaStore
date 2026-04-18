import { Button, Heading, Text } from "@medusajs/ui"

import { storefrontConfig } from "@lib/storefront-config"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const Hero = () => {
  const heroCopy = storefrontConfig.copy.hero

  return (
    <div className="h-[75vh] w-full border-b border-ui-border-base relative bg-ui-bg-subtle">
      <div className="absolute inset-0 z-10 flex flex-col justify-center items-center text-center small:p-32 gap-6">
        <span className="flex flex-col gap-y-3">
          <Heading
            level="h1"
            className="text-3xl leading-10 text-ui-fg-base font-normal"
          >
            {storefrontConfig.storeName}
          </Heading>
          <Heading
            level="h2"
            className="text-3xl leading-10 text-ui-fg-subtle font-normal"
          >
            {storefrontConfig.tagline}
          </Heading>
        </span>
        <Text className="max-w-2xl text-base-regular text-ui-fg-subtle">
          {storefrontConfig.defaultDescription}
        </Text>
        <div className="flex flex-col small:flex-row gap-3">
          <LocalizedClientLink href="/store">
            <Button>{heroCopy.browseCatalog}</Button>
          </LocalizedClientLink>
          <LocalizedClientLink href="/account">
            <Button variant="secondary">{heroCopy.openAccount}</Button>
          </LocalizedClientLink>
        </div>
      </div>
    </div>
  )
}

export default Hero
