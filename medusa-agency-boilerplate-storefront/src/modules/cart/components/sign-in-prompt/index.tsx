import { Button, Heading, Text } from "@medusajs/ui"
import { storefrontConfig } from "@lib/storefront-config"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const SignInPrompt = () => {
  const cartCopy = storefrontConfig.copy.cart

  return (
    <div className="bg-white flex items-center justify-between">
      <div>
        <Heading level="h2" className="txt-xlarge">
          {cartCopy.signInTitle}
        </Heading>
        <Text className="txt-medium text-ui-fg-subtle mt-2">
          {cartCopy.signInDescription}
        </Text>
      </div>
      <div>
        <LocalizedClientLink href="/account">
          <Button variant="secondary" className="h-10" data-testid="sign-in-button">
            {cartCopy.signIn}
          </Button>
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default SignInPrompt
