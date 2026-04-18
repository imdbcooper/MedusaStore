import Image from 'next/image'
import { toAbsolutePayloadURL } from '@lib/data/content/client'
import { ContentPost } from '@lib/content/types'
import ContentBlockRenderer from '@modules/content/components/block-renderer'

export default function ContentPostTemplate({ post }: { post: ContentPost }) {
  const coverImageURL = toAbsolutePayloadURL(post.coverImage?.url)
  const hasHero = post.layout?.[0]?.blockType === 'heroBanner'

  return (
    <main>
      {!hasHero && (
        <section className="content-container py-16">
          <article className="mx-auto flex max-w-3xl flex-col gap-5">
            {post.publishedAt && (
              <time className="text-sm uppercase tracking-[0.2em] text-ui-fg-subtle" dateTime={post.publishedAt}>
                {new Date(post.publishedAt).toLocaleDateString('ru-RU')}
              </time>
            )}
            {post.title && <h1 className="text-4xl font-semibold tracking-tight">{post.title}</h1>}
            {post.excerpt && <p className="text-lg leading-8 text-ui-fg-subtle">{post.excerpt}</p>}
            {coverImageURL && (
              <Image
                src={coverImageURL}
                alt={post.coverImage?.alt || post.title || ''}
                width={post.coverImage?.width || 1600}
                height={post.coverImage?.height || 900}
                className="h-auto w-full rounded-[32px] object-cover"
                priority
              />
            )}
          </article>
        </section>
      )}
      <ContentBlockRenderer blocks={post.layout} />
    </main>
  )
}
