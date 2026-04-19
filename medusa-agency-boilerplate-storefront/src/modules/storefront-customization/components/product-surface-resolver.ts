import {
  StorefrontClientConfig,
  StorefrontProductSupportHighlightsSurface,
  storefrontClientConfig,
} from "@lib/storefront-client-config"

export type StorefrontProductSurfaceKey =
  keyof StorefrontClientConfig["productSurfaces"]

const resolveProductSurface = <TKey extends StorefrontProductSurfaceKey>(
  surfaceKey: TKey
) => storefrontClientConfig.productSurfaces[surfaceKey]

export const resolveProductSupportHighlightsSurface = (): StorefrontProductSupportHighlightsSurface =>
  resolveProductSurface(
    "supportHighlights"
  ) as StorefrontProductSupportHighlightsSurface
