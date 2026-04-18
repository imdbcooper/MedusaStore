import { ContentPage } from '@lib/content/types'
import ContentBlockRenderer from '@modules/content/components/block-renderer'

export default function ContentPageTemplate({ page }: { page: ContentPage }) {
  const hasHero = page.layout?.[0]?.blockType === 'heroBanner'

  return (
    <main>
      {!hasHero && (
        <section className="content-container py-16">
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {page.title && <h1 className="text-4xl font-semibold tracking-tight">{page.title}</h1>}
            {page.excerpt && (
              <p className="text-lg leading-8 text-ui-fg-subtle">{page.excerpt}</p>
            )}
          </div>
        </section>
      )}
      <ContentBlockRenderer blocks={page.layout} />
    </main>
  )
}
