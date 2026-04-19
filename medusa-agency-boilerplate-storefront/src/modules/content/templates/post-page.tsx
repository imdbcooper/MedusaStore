import Image from "next/image"

import { ContentPost } from "@lib/content/types"
import { toAbsolutePayloadURL } from "@lib/data/content/client"
import ContentBlockRenderer from "@modules/content/components/block-renderer"
import PostPageSurface from "@modules/storefront-customization/components/post-page-surface"

export default function ContentPostTemplate({ post }: { post: ContentPost }) {
  const coverImageURL = toAbsolutePayloadURL(post.coverImage?.url)
  const hasHero = post.layout?.[0]?.blockType === "heroBanner"

  return (
    <main>
      <PostPageSurface post={post} />
      {!hasHero && coverImageURL && (
        <section className="content-container pb-10">
          <article className="mx-auto flex max-w-4xl flex-col gap-5">
            <Image
              src={coverImageURL}
              alt={post.coverImage?.alt || post.title || ""}
              width={post.coverImage?.width || 1600}
              height={post.coverImage?.height || 900}
              className="h-auto w-full rounded-[32px] object-cover"
              priority
            />
          </article>
        </section>
      )}
      <ContentBlockRenderer blocks={post.layout} />
    </main>
  )
}
