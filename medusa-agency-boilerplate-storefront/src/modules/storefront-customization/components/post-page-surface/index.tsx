import { ContentPost } from "@lib/content/types"
import { EditorialPostHeader } from "../content-page-header"

export default function PostPageSurface({ post }: { post: ContentPost }) {
  const hasHero = post.layout?.[0]?.blockType === "heroBanner"

  if (hasHero) {
    return null
  }

  return (
    <EditorialPostHeader
      title={post.title}
      excerpt={post.excerpt}
      publishedAt={post.publishedAt}
    />
  )
}
