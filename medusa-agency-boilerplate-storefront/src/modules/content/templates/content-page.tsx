import { ContentPage } from "@lib/content/types"
import ContentBlockRenderer from "@modules/content/components/block-renderer"
import ContentPageSurface from "@modules/storefront-customization/components/content-page-surface"

export default function ContentPageTemplate({ page }: { page: ContentPage }) {
  return (
    <main>
      <ContentPageSurface page={page} />
      <ContentBlockRenderer blocks={page.layout} />
    </main>
  )
}
