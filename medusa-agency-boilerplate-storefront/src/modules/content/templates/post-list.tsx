import Image from 'next/image'
import { toAbsolutePayloadURL } from '@lib/data/content/client'
import { ContentPost } from '@lib/content/types'
import LocalizedClientLink from '@modules/common/components/localized-client-link'

export default function ContentPostListTemplate({ posts }: { posts: ContentPost[] }) {
  return (
    <main className="content-container py-14 small:py-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="rounded-[var(--theme-radius-shell)] border border-[var(--theme-border)] bg-[var(--theme-hero-start)] px-6 py-10 shadow-[var(--theme-shadow-card)] small:px-10">
          <p className="stitch-eyebrow">Материалы</p>
          <h1 className="max-w-3xl pt-4 text-4xl font-bold tracking-[-0.035em] text-[var(--theme-foreground)] small:text-6xl">
            Новости и статьи
          </h1>
          <p className="max-w-2xl pt-5 text-lg leading-8 text-[var(--theme-muted)]">
            Editorial surface из Payload CMS для маркетинговых и информационных публикаций в общей визуальной системе StudioPro.
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="rounded-[var(--theme-radius-shell)] border border-dashed border-[var(--theme-border)] bg-[var(--theme-surface)] px-8 py-12 text-[var(--theme-muted)]">
            Опубликованные материалы пока отсутствуют.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => {
              const href = post.slug ? `/news/${post.slug}` : '/news'
              const imageURL = toAbsolutePayloadURL(post.coverImage?.url)

              return (
                <LocalizedClientLink
                  key={String(post.id || post.slug)}
                  href={href}
                  className="stitch-card overflow-hidden"
                >
                  <article className="flex h-full flex-col">
                    {imageURL && (
                      <Image
                        src={imageURL}
                        alt={post.coverImage?.alt || post.title || ''}
                        width={post.coverImage?.width || 1200}
                        height={post.coverImage?.height || 800}
                        className="h-56 w-full object-cover"
                      />
                    )}
                    <div className="flex flex-1 flex-col gap-4 px-6 py-6">
                      {post.publishedAt && (
                        <time className="stitch-eyebrow" dateTime={post.publishedAt}>
                          {new Date(post.publishedAt).toLocaleDateString('ru-RU')}
                        </time>
                      )}
                      <h2 className="text-2xl font-bold tracking-[-0.02em] text-[var(--theme-foreground)]">{post.title}</h2>
                      {post.excerpt && (
                        <p className="line-clamp-3 text-base leading-7 text-[var(--theme-muted)]">{post.excerpt}</p>
                      )}
                    </div>
                  </article>
                </LocalizedClientLink>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
