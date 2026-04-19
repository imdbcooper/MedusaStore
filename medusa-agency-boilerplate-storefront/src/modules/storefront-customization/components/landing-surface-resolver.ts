import {
  StorefrontClientConfig,
  StorefrontCollectionLandingSurface,
  StorefrontContentPageLandingSurface,
  StorefrontPostPageLandingSurface,
  storefrontClientConfig,
} from "@lib/storefront-client-config"

export type StorefrontLandingSurfaceKey =
  keyof StorefrontClientConfig["landingSurfaces"]

export type StorefrontCollectionLandingSlot =
  StorefrontCollectionLandingSurface["slots"][number]

export type StorefrontContentPageSlot =
  StorefrontContentPageLandingSurface["slots"][number]

export type StorefrontPostPageSlot =
  StorefrontPostPageLandingSurface["slots"][number]

const resolveLandingSurface = <TKey extends StorefrontLandingSurfaceKey>(
  surfaceKey: TKey
) => storefrontClientConfig.landingSurfaces[surfaceKey]

const resolveSlot = <
  TSlot extends { slot: string },
  TSlotKey extends TSlot["slot"],
>(
  slots: TSlot[],
  slotKey: TSlotKey
): Extract<TSlot, { slot: TSlotKey }> | undefined =>
  slots.find(
    (slot): slot is Extract<TSlot, { slot: TSlotKey }> => slot.slot === slotKey
  )

export const resolveHomeLandingSurface = () => resolveLandingSurface("home")

export const resolveCollectionLandingSurface = (): StorefrontCollectionLandingSurface =>
  resolveLandingSurface("collectionLanding") as StorefrontCollectionLandingSurface

export const resolveCollectionLandingSlot = <
  TSlotKey extends StorefrontCollectionLandingSlot["slot"],
>(
  slotKey: TSlotKey
) => resolveSlot(resolveCollectionLandingSurface().slots, slotKey)

export const resolveContentPageLandingSurface = (): StorefrontContentPageLandingSurface =>
  resolveLandingSurface("contentPage") as StorefrontContentPageLandingSurface

export const resolveContentPageSlot = <
  TSlotKey extends StorefrontContentPageSlot["slot"],
>(
  slotKey: TSlotKey
) => resolveSlot(resolveContentPageLandingSurface().slots, slotKey)

export const resolvePostPageLandingSurface = (): StorefrontPostPageLandingSurface =>
  resolveLandingSurface("postPage") as StorefrontPostPageLandingSurface

export const resolvePostPageSlot = <
  TSlotKey extends StorefrontPostPageSlot["slot"],
>(
  slotKey: TSlotKey
) => resolveSlot(resolvePostPageLandingSurface().slots, slotKey)

export const formatLandingSurfaceCopy = (
  template: string,
  values: Record<string, string | number>
) =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template
  )
