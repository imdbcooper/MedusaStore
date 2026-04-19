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
import StorefrontActionLinkButton from "../action-link"

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

const HeroSection = ({ section }: { section: HomeHeroSection }) => (
  <section className="content-container py-6 small:py-10">
    <div
      className="overflow-hidden border px-8 py-12 small:px-12 small:py-16"
      style={{
        borderColor: "var(--theme-border)",
        borderRadius: "var(--theme-radius-shell)",
        background:
          "linear-gradient(135deg, var(--theme-hero-start), var(--theme-hero-end))",
        boxShadow: "var(--theme-shadow-shell)",
      }}
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)] lg:items-end">
        <div className="flex flex-col gap-6">
          {section.eyebrow ? (
            <span className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--theme-muted)]">
              {section.eyebrow}
            </span>
          ) : null}
          <div className="flex flex-col gap-4">
            <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-[var(--theme-foreground)] small:text-5xl">
              {section.title}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[var(--theme-muted)]">
              {section.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <StorefrontActionLinkButton action={section.primaryAction} />
            <StorefrontActionLinkButton
              action={section.secondaryAction}
              variant="secondary"
            />
          </div>
        </div>
        {!!section.highlights?.length && (
          <div
            className="grid gap-3 border p-6"
            style={{
              borderColor: "rgba(34, 31, 26, 0.08)",
              borderRadius: "var(--theme-radius-card)",
              background: "rgba(255, 253, 248, 0.72)",
            }}
          >
            {section.highlights.map((item) => (
              <div
                key={item}
                className="rounded-[var(--theme-radius-card)] border bg-[var(--theme-surface)] px-4 py-4 text-sm leading-6 text-[var(--theme-foreground)]"
                style={{ borderColor: "rgba(34, 31, 26, 0.08)" }}
              >
                {item}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </section>
)

const TrustGridSection = ({ section }: { section: HomeTrustGridSection }) => (
  <section className="py-6 small:py-10">
    <HomeSectionHeading title={section.title} description={section.description} />
    <div className="content-container pt-8">
      <div className="grid gap-4 lg:grid-cols-3">
        {section.items.map((item) => (
          <div
            key={item.title}
            className="border p-6"
            style={{
              borderColor: "var(--theme-border)",
              borderRadius: "var(--theme-radius-card)",
              background: "var(--theme-surface)",
              boxShadow: "var(--theme-shadow-card)",
            }}
          >
            <h3 className="text-xl font-semibold text-[var(--theme-foreground)]">
              {item.title}
            </h3>
            <p className="pt-3 text-sm leading-7 text-[var(--theme-muted)]">
              {item.description}
            </p>
          </div>
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
    <section className="py-6 small:py-10">
      <HomeSectionHeading title={section.title} description={section.description} />
      <div className="pt-2">
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
  <section className="content-container py-6 small:py-10">
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
      <div
        className="border p-8 small:p-10"
        style={{
          borderColor: "var(--theme-border)",
          borderRadius: "var(--theme-radius-shell)",
          background: "var(--theme-surface)",
          boxShadow: "var(--theme-shadow-card)",
        }}
      >
        {section.eyebrow ? (
          <span className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--theme-muted)]">
            {section.eyebrow}
          </span>
        ) : null}
        <h2 className="pt-4 text-3xl font-semibold tracking-tight text-[var(--theme-foreground)] small:text-4xl">
          {section.title}
        </h2>
        <p className="pt-4 text-base leading-7 text-[var(--theme-muted)]">
          {section.description}
        </p>
        {!!section.highlights?.length && (
          <ul className="grid gap-3 pt-6 text-sm leading-6 text-[var(--theme-foreground)]">
            {section.highlights.map((item) => (
              <li
                key={item}
                className="rounded-[var(--theme-radius-card)] border bg-[var(--theme-surface-muted)] px-4 py-3"
                style={{ borderColor: "var(--theme-border)" }}
              >
                {item}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-3 pt-8">
          <StorefrontActionLinkButton action={section.primaryAction} />
          <StorefrontActionLinkButton
            action={section.secondaryAction}
            variant="secondary"
          />
        </div>
      </div>
      <div
        className="flex min-h-[340px] flex-col justify-between border p-8 text-[var(--theme-foreground)]"
        style={{
          borderColor: "var(--theme-border)",
          borderRadius: "var(--theme-radius-shell)",
          background:
            "radial-gradient(circle at top left, var(--theme-accent-soft), transparent 55%), var(--theme-surface)",
          boxShadow: "var(--theme-shadow-card)",
        }}
      >
        <div className="text-sm uppercase tracking-[0.24em] text-[var(--theme-muted)]">
          Shared Commerce Core
        </div>
        <div className="grid gap-4">
          <div>
            <div className="text-4xl font-semibold">1 core</div>
            <p className="pt-2 text-sm leading-6 text-[var(--theme-muted)]">
              Cart, checkout, account и provider integrations не дробятся по клиентам.
            </p>
          </div>
          <div>
            <div className="text-4xl font-semibold">3 слоя</div>
            <p className="pt-2 text-sm leading-6 text-[var(--theme-muted)]">
              Tokens, shell variants и section registry дают управляемую вариативность.
            </p>
          </div>
          <div>
            <div className="text-4xl font-semibold">0 форков</div>
            <p className="pt-2 text-sm leading-6 text-[var(--theme-muted)]">
              Клиентская адаптация не должна требовать дублирования storefront core.
            </p>
          </div>
        </div>
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
  <section className="content-container py-6 pb-16 small:py-10 small:pb-20">
    <div
      className="border px-8 py-10 text-[var(--theme-accent-contrast)] small:px-12"
      style={{
        borderColor: "var(--theme-border)",
        borderRadius: "var(--theme-radius-shell)",
        background: "var(--theme-accent)",
        boxShadow: "var(--theme-shadow-shell)",
      }}
    >
      {section.eyebrow ? (
        <span className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--theme-accent-contrast)]/80">
          {section.eyebrow}
        </span>
      ) : null}
      <div className="grid gap-6 pt-4 lg:grid-cols-[minmax(0,1.3fr)_auto] lg:items-end">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight small:text-4xl">
            {section.title}
          </h2>
          <p className="pt-4 max-w-2xl text-base leading-7 text-[var(--theme-accent-contrast)]/85">
            {section.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <StorefrontActionLinkButton action={section.primaryAction} />
          <StorefrontActionLinkButton
            action={section.secondaryAction}
            variant="secondary"
          />
        </div>
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
  return resolveHomeLandingSurface().sections.map((section, index) => {
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
      return <FaqSection key={key} section={section} />
    }

    if (section.type === "cta") {
      return <CtaSection key={key} section={section} />
    }

    return null
  })
}
