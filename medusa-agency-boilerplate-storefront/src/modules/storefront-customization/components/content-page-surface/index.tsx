import { ContentPage } from "@lib/content/types"
import {
  StorefrontContentPageHeaderSection,
  StorefrontSurfaceCtaSection,
  StorefrontSurfaceInfoGridSection,
} from "@lib/storefront-client-config"
import { InformationalPageHeader } from "../content-page-header"
import {
  LandingSurfaceCta,
  LandingSurfaceInfoGrid,
} from "../landing-surface-sections"
import { resolveContentPageLandingSurface } from "../landing-surface-resolver"

const renderSection = ({
  page,
  section,
  index,
}: {
  page: ContentPage
  section:
    | StorefrontContentPageHeaderSection
    | StorefrontSurfaceInfoGridSection
    | StorefrontSurfaceCtaSection
  index: number
}) => {
  const key = `${section.type}-${index}`

  if (section.type === "header") {
    return (
      <InformationalPageHeader
        key={key}
        title={page.title}
        excerpt={page.excerpt}
        pageType={page.pageType}
        section={section}
      />
    )
  }

  if (section.type === "infoGrid") {
    return <LandingSurfaceInfoGrid key={key} section={section} />
  }

  if (section.type === "cta") {
    return <LandingSurfaceCta key={key} section={section} />
  }

  return null
}

export default function ContentPageSurface({ page }: { page: ContentPage }) {
  const hasHero = page.layout?.[0]?.blockType === "heroBanner"

  if (hasHero) {
    return null
  }

  return resolveContentPageLandingSurface().sections.map((section, index) =>
    renderSection({ page, section, index })
  )
}
