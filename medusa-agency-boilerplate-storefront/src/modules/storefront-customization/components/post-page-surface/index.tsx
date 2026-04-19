import { ContentPost } from "@lib/content/types"
import {
  StorefrontPostPageHeaderSection,
  StorefrontSurfaceCtaSection,
  StorefrontSurfaceInfoGridSection,
} from "@lib/storefront-client-config"
import { EditorialPostHeader } from "../content-page-header"
import {
  LandingSurfaceCta,
  LandingSurfaceInfoGrid,
} from "../landing-surface-sections"
import { resolvePostPageLandingSurface } from "../landing-surface-resolver"

const renderSection = ({
  post,
  section,
  index,
}: {
  post: ContentPost
  section:
    | StorefrontPostPageHeaderSection
    | StorefrontSurfaceInfoGridSection
    | StorefrontSurfaceCtaSection
  index: number
}) => {
  const key = `${section.type}-${index}`

  if (section.type === "header") {
    return (
      <EditorialPostHeader
        key={key}
        title={post.title}
        excerpt={post.excerpt}
        publishedAt={post.publishedAt}
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

export default function PostPageSurface({ post }: { post: ContentPost }) {
  const hasHero = post.layout?.[0]?.blockType === "heroBanner"

  if (hasHero) {
    return null
  }

  return resolvePostPageLandingSurface().sections.map((section, index) =>
    renderSection({ post, section, index })
  )
}
