import { HttpTypes } from "@medusajs/types"

import {
  StorefrontCollectionLandingHeaderSection,
  StorefrontSurfaceCtaSection,
  StorefrontSurfaceInfoGridSection,
} from "@lib/storefront-client-config"
import CollectionLandingHeader from "../collection-landing-header"
import {
  LandingSurfaceCta,
  LandingSurfaceInfoGrid,
} from "../landing-surface-sections"
import { resolveCollectionLandingSurface } from "../landing-surface-resolver"

const renderSection = ({
  collection,
  section,
  index,
}: {
  collection: HttpTypes.StoreCollection
  section:
    | StorefrontCollectionLandingHeaderSection
    | StorefrontSurfaceInfoGridSection
    | StorefrontSurfaceCtaSection
  index: number
}) => {
  const key = `${section.type}-${index}`

  if (section.type === "header") {
    return <CollectionLandingHeader key={key} collection={collection} section={section} />
  }

  if (section.type === "infoGrid") {
    return <LandingSurfaceInfoGrid key={key} section={section} />
  }

  if (section.type === "cta") {
    return <LandingSurfaceCta key={key} section={section} />
  }

  return null
}

export default function CollectionLandingSurface({
  collection,
}: {
  collection: HttpTypes.StoreCollection
}) {
  const surface = resolveCollectionLandingSurface()

  return surface.sections.map((section, index) =>
    renderSection({ collection, section, index })
  )
}
