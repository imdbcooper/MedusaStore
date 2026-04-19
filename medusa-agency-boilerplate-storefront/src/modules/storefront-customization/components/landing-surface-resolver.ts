import {
  StorefrontClientConfig,
  StorefrontCollectionLandingSurface,
  StorefrontContentPageLandingSurface,
  StorefrontPostPageLandingSurface,
  storefrontClientConfig,
} from "@lib/storefront-client-config"

export type StorefrontLandingSurfaceKey =
  keyof StorefrontClientConfig["landingSurfaces"]

const resolveLandingSurface = <TKey extends StorefrontLandingSurfaceKey>(
  surfaceKey: TKey
) => storefrontClientConfig.landingSurfaces[surfaceKey]

export const resolveHomeLandingSurface = () => resolveLandingSurface("home")

export const resolveCollectionLandingSurface = (): StorefrontCollectionLandingSurface =>
  resolveLandingSurface("collectionLanding") as StorefrontCollectionLandingSurface

export const resolveContentPageLandingSurface = (): StorefrontContentPageLandingSurface =>
  resolveLandingSurface("contentPage") as StorefrontContentPageLandingSurface

export const resolvePostPageLandingSurface = (): StorefrontPostPageLandingSurface =>
  resolveLandingSurface("postPage") as StorefrontPostPageLandingSurface

export const formatLandingSurfaceCopy = (
  template: string,
  values: Record<string, string | number>
) =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template
  )
