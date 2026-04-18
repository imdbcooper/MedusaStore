import { Metadata } from "next"

import { storefrontConfig } from "@lib/storefront-config"

export const metadata: Metadata = {
  title: "404",
  description: storefrontConfig.copy.common.notFoundDescription,
}

export default function NotFound() {
  const commonCopy = storefrontConfig.copy.common

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)]">
      <h1 className="text-2xl-semi text-ui-fg-base">{commonCopy.notFoundTitle}</h1>
      <p className="text-small-regular text-ui-fg-base">
        {commonCopy.notFoundDescription}
      </p>
    </div>
  )
}
