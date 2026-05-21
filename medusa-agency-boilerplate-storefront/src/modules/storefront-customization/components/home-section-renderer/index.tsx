import { HttpTypes } from "@medusajs/types"

import {
  HomeCtaSection,
  HomeFaqSection,
  HomeFeaturedCollectionsSection,
  HomeHeroSection,
  HomeImageTextSection,
  HomeTrustGridSection,
} from "@lib/storefront-client-config"
import { resolveHomeLandingSurface } from "../landing-surface-resolver"
import ProductRail from "@modules/home/components/featured-products/product-rail"
import TopReviewsWidget from "@modules/home/components/top-reviews-widget"
import StorefrontActionLinkButton from "../action-link"
import {
  StitchArchitecturePanel,
  StitchHeroShowcase,
  StitchProcessTimeline,
} from "../stitch-surfaces"

const HomeSectionHeading = ({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string
  title: string
  description?: string
}) => (
  <div className="content-container">
    <div className="mx-auto flex max-w-3xl flex-col gap-4 text-center">
      {eyebrow ? (
        <span className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--theme-muted)]">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="text-3xl font-semibold tracking-tight text-[var(--theme-foreground)] small:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="text-base leading-7 text-[var(--theme-muted)]">
          {description}
        </p>
      ) : null}
    </div>
  </div>
)

const HeroSection = ({ section }: { section: HomeHeroSection }) => {
  const [title, accentTitle] = section.title.includes("Без лишних")
    ? section.title.split(" Без лишних")
    : [section.title, undefined]

  return (
    <StitchHeroShowcase
      eyebrow={section.eyebrow}
      title={title}
      accentTitle={accentTitle ? `Без лишних${accentTitle}` : undefined}
      description={section.description}
      primaryAction={section.primaryAction}
      secondaryAction={section.secondaryAction}
    />
  )
}

const TrustGridSection = ({ section }: { section: HomeTrustGridSection }) => (
  <section className="bg-[var(--theme-canvas)] py-16 small:py-24">
    <HomeSectionHeading title={section.title} description={section.description} />
    <div className="content-container pt-12">
      <div className="grid gap-6 lg:grid-cols-3">
        {section.items.map((item) => (
          <article key={item.title} className="stitch-card p-8 small:p-10">
            <div className="mb-10 flex h-14 w-14 items-center justify-center rounded-[var(--theme-radius-card)] bg-[var(--theme-surface-muted)] text-2xl text-[var(--theme-accent)]">
              ◇
            </div>
            <h3 className="text-2xl font-bold tracking-[-0.02em] text-[var(--theme-foreground)]">
              {item.title}
            </h3>
            <p className="pt-5 text-base leading-8 text-[var(--theme-muted)]">
              {item.description}
            </p>
          </article>
        ))}
      </div>
    </div>
  </section>
)

const FeaturedCollectionsSection = ({
  section,
  collections,
  region,
}: {
  section: HomeFeaturedCollectionsSection
  collections: HttpTypes.StoreCollection[]
  region: HttpTypes.StoreRegion
}) => {
  const requestedHandles = new Set(section.collectionHandles || [])

  const resolvedCollections = collections
    .filter((collection) =>
      requestedHandles.size > 0 ? requestedHandles.has(collection.handle || "") : true
    )
    .slice(0, section.maxCollections || collections.length)

  if (!resolvedCollections.length) {
    return null
  }

  return (
    <section className="bg-[var(--theme-hero-start)] py-16 small:py-24">
      <div className="content-container">
        <div className="mb-10 flex flex-col gap-4 small:flex-row small:items-end small:justify-between">
          <HomeSectionHeading title={section.title} description={section.description} />
          <StorefrontActionLinkButton
            action={section.primaryAction}
            variant="secondary"
          />
        </div>
      </div>
      <div>
        {resolvedCollections.map((collection) => (
          <ProductRail
            key={collection.id}
            collection={collection}
            region={region}
            maxProducts={section.maxProductsPerCollection}
          />
        ))}
      </div>
    </section>
  )
}

const ImageTextSection = ({ section }: { section: HomeImageTextSection }) => (
  <section className="border-b border-[var(--theme-border)] bg-[var(--theme-surface)] py-16 small:py-24">
    <div className="content-container grid gap-12 lg:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)] lg:items-start">
      <StitchArchitecturePanel />
      <div className="flex flex-col gap-10">
        <div>
          {section.eyebrow ? (
            <span className="stitch-eyebrow">{section.eyebrow}</span>
          ) : null}
          <h2 className="max-w-3xl pt-4 text-4xl font-bold tracking-[-0.03em] text-[var(--theme-foreground)] small:text-5xl">
            {section.title}
          </h2>
          <p className="max-w-3xl pt-5 text-lg leading-8 text-[var(--theme-muted)]">
            {section.description}
          </p>
        </div>
        {!!section.highlights?.length && (
          <div className="grid gap-5 md:grid-cols-2">
            {section.highlights.map((item) => {
              const [title, description] = item.split(":")

              return (
                <article key={item} className="stitch-card p-6">
                  <div className="text-3xl text-[var(--theme-accent)]">↗</div>
                  <h3 className="pt-6 text-xl font-semibold text-[var(--theme-foreground)]">
                    {title}
                  </h3>
                  <p className="pt-3 text-sm leading-6 text-[var(--theme-muted)]">
                    {description || item}
                  </p>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  </section>
)

const FaqSection = ({ section }: { section: HomeFaqSection }) => (
  <section className="py-6 small:py-10">
    <HomeSectionHeading title={section.title} />
    <div className="content-container pt-8">
      <div
        className="mx-auto max-w-3xl overflow-hidden border"
        style={{
          borderColor: "var(--theme-border)",
          borderRadius: "var(--theme-radius-shell)",
          background: "var(--theme-surface)",
        }}
      >
        {section.items.map((item) => (
          <details
            key={item.question}
            className="border-b px-6 py-5 last:border-b-0"
            style={{ borderColor: "var(--theme-border)" }}
          >
            <summary className="cursor-pointer list-none text-lg font-medium text-[var(--theme-foreground)]">
              {item.question}
            </summary>
            <p className="pt-4 text-sm leading-7 text-[var(--theme-muted)]">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </div>
  </section>
)

const CtaSection = ({ section }: { section: HomeCtaSection }) => (
  <section className="content-container py-16 small:py-24">
    <div className="rounded-[var(--theme-radius-shell)] bg-[var(--theme-foreground)] px-8 py-14 text-center text-[var(--theme-accent-contrast)] shadow-[var(--theme-shadow-shell)] small:px-16 small:py-20">
      {section.eyebrow ? (
        <span className="text-xs font-bold uppercase tracking-[0.24em] text-white/60">
          {section.eyebrow}
        </span>
      ) : null}
      <h2 className="mx-auto max-w-4xl pt-4 text-4xl font-bold tracking-[-0.03em] small:text-5xl">
        {section.title}
      </h2>
      <p className="mx-auto max-w-3xl pt-5 text-lg leading-8 text-white/75">
        {section.description}
      </p>
      <div className="flex flex-wrap justify-center gap-4 pt-8">
        <StorefrontActionLinkButton action={section.primaryAction} />
        <StorefrontActionLinkButton
          action={section.secondaryAction}
          variant="secondary"
        />
      </div>
    </div>
  </section>
)

export default function HomeSectionRenderer({
  collections,
  region,
}: {
  collections: HttpTypes.StoreCollection[]
  region: HttpTypes.StoreRegion
}) {
  const sections = resolveHomeLandingSurface().sections.map(
    (section, index) => {
      const key = `${section.type}-${index}`

      if (section.type === "hero") {
        return <HeroSection key={key} section={section} />
      }

      if (section.type === "trustGrid") {
        return <TrustGridSection key={key} section={section} />
      }

      if (section.type === "featuredCollections") {
        return (
          <FeaturedCollectionsSection
            key={key}
            section={section}
            collections={collections}
            region={region}
          />
        )
      }

      if (section.type === "imageText") {
        return <ImageTextSection key={key} section={section} />
      }

      if (section.type === "faq") {
        return (
          <div key={key}>
            <StitchProcessTimeline />
            <FaqSection section={section} />
          </div>
        )
      }

      if (section.type === "cta") {
        return <CtaSection key={key} section={section} />
      }

      return null
    }
  )

  return (
    <>
      {sections}
      {/*
        Phase 3 / step 3 — homepage «Лучшие отзывы» widget. Rendered as a
        sibling server component after the configured landing sections.
        Next.js parallelises sibling server fetches automatically, so the
        widget's own server fetch (`getTopApprovedProductReviews`) runs in
        parallel with `listProducts`/`getProductRatingSummariesByIds` from
        the rails above and does not block the page (plan §9 Phase 3 п.5
        / 3.7). When there are no qualifying reviews the component returns
        `null` and the section is hidden completely.
      */}
      <TopReviewsWidget />
    </>
  )
}
