import { ContentPage } from "@lib/content/types"
import { InformationalPageHeader } from "../content-page-header"

export default function ContentPageSurface({ page }: { page: ContentPage }) {
  const hasHero = page.layout?.[0]?.blockType === "heroBanner"

  if (hasHero) {
    return null
  }

  return (
    <InformationalPageHeader
      title={page.title}
      excerpt={page.excerpt}
      pageType={page.pageType}
    />
  )
}
