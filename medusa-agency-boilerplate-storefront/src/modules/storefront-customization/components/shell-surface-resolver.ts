import {
  StorefrontClientConfig,
  StorefrontFooterShellSurface,
  StorefrontNavShellSurface,
  StorefrontSideMenuShellSurface,
  storefrontClientConfig,
} from "@lib/storefront-client-config"

export type StorefrontShellSurfaceKey = keyof StorefrontClientConfig["shell"]

const resolveShellSurface = <TKey extends StorefrontShellSurfaceKey>(
  surfaceKey: TKey
) => storefrontClientConfig.shell[surfaceKey]

export const resolveNavShellSurface = (): StorefrontNavShellSurface =>
  resolveShellSurface("nav") as StorefrontNavShellSurface

export const resolveSideMenuShellSurface = (): StorefrontSideMenuShellSurface =>
  resolveShellSurface("sideMenu") as StorefrontSideMenuShellSurface

export const resolveFooterShellSurface = (): StorefrontFooterShellSurface =>
  resolveShellSurface("footer") as StorefrontFooterShellSurface
