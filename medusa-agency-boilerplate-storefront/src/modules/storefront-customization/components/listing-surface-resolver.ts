import {
  StorefrontClientConfig,
  StorefrontListingCardSurface,
  StorefrontRelatedProductsRailSurface,
  storefrontClientConfig,
} from "@lib/storefront-client-config"

export type StorefrontListingSurfaceKey =
  keyof StorefrontClientConfig["listingSurfaces"]

const resolveListingSurface = <TKey extends StorefrontListingSurfaceKey>(
  surfaceKey: TKey
) => storefrontClientConfig.listingSurfaces[surfaceKey]

export const resolveDefaultProductCardSurface = (): StorefrontListingCardSurface =>
  resolveListingSurface("productCard").default as StorefrontListingCardSurface

export const resolveFeaturedProductCardSurface = (): StorefrontListingCardSurface =>
  resolveListingSurface("productCard").featured as StorefrontListingCardSurface

export const resolveRelatedProductsRailSurface = (): StorefrontRelatedProductsRailSurface =>
  resolveListingSurface("relatedProductsRail") as StorefrontRelatedProductsRailSurface
