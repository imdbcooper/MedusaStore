import Image from 'next/image'
import { toAbsolutePayloadURL } from '@lib/data/content/client'
import { ContentPost } from '@lib/content/types'
import LocalizedClientLink from '@modules/common/components/localized-client-link'

export default function ContentPostListTemplate({ posts }: { posts: ContentPost[] }) {
  return (
    <main className="content-container py-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight">Новости и статьи</h1>
          <p className="max-w-2xl text-lg leading-8 text-ui-fg-subtle">
            Editorial surface из Payload CMS для маркетинговых и информационных публикаций.
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-ui-border-base px-8 py-12 text-ui-fg-subtle">
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
                  className="overflow-hidden rounded-[28px] border border-ui-border-base bg-white transition hover:-translate-y-1 hover:shadow-md"
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
                        <time className="text-sm uppercase tracking-[0.2em] text-ui-fg-subtle" dateTime={post.publishedAt}>
                          {new Date(post.publishedAt).toLocaleDateString('ru-RU')}
                        </time>
                      )}
                      <h2 className="text-2xl font-semibold tracking-tight">{post.title}</h2>
                      {post.excerpt && (
                        <p className="line-clamp-3 text-base leading-7 text-ui-fg-subtle">{post.excerpt}</p>
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
