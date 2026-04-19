import {
  StorefrontCatalogResultsShellSurface,
  StorefrontCategoryCatalogIntroSurface,
  StorefrontClientConfig,
  StorefrontFeaturedRailShellSurface,
  StorefrontStoreCatalogIntroSurface,
  storefrontClientConfig,
} from "@lib/storefront-client-config"

export type StorefrontCatalogShellKey = keyof StorefrontClientConfig["catalogShell"]

const resolveCatalogShell = <TKey extends StorefrontCatalogShellKey>(
  surfaceKey: TKey
) => storefrontClientConfig.catalogShell[surfaceKey]

export const resolveStoreCatalogIntroSurface = (): StorefrontStoreCatalogIntroSurface =>
  resolveCatalogShell("store").intro as StorefrontStoreCatalogIntroSurface

export const resolveStoreCatalogResultsSurface = (): StorefrontCatalogResultsShellSurface =>
  resolveCatalogShell("store").results as StorefrontCatalogResultsShellSurface

export const resolveCategoryCatalogIntroSurface = (): StorefrontCategoryCatalogIntroSurface =>
  resolveCatalogShell("category").intro as StorefrontCategoryCatalogIntroSurface

export const resolveCategoryCatalogResultsSurface = (): StorefrontCatalogResultsShellSurface =>
  resolveCatalogShell("category").results as StorefrontCatalogResultsShellSurface

export const resolveCollectionCatalogResultsSurface = (): StorefrontCatalogResultsShellSurface =>
  resolveCatalogShell("collection").results as StorefrontCatalogResultsShellSurface

export const resolveFeaturedRailCatalogShellSurface = (): StorefrontFeaturedRailShellSurface =>
  resolveCatalogShell("featuredRail") as StorefrontFeaturedRailShellSurface
