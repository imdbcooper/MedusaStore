import { HttpTypes } from "@medusajs/types"

import { StorefrontCollectionLandingHeaderSection } from "@lib/storefront-client-config"
import { storefrontConfig } from "@lib/storefront-config"
import { formatLandingSurfaceCopy } from "../landing-surface-resolver"

const getCollectionDescription = (
  template: string,
  collection: HttpTypes.StoreCollection
) =>
  formatLandingSurfaceCopy(template, {
    storeName: storefrontConfig.storeName.toLowerCase(),
    collectionTitle: collection.title || "",
  })

export default function CollectionLandingHeader({
  collection,
  section,
}: {
  collection: HttpTypes.StoreCollection
  section: StorefrontCollectionLandingHeaderSection
}) {
  const productCount = collection.products?.length || 0

  const description = getCollectionDescription(
    section.descriptionTemplate,
    collection
  )

  if (section.variant === "compact") {
    return (
      <section className="content-container py-6 small:py-8">
        <div
          className="border-b pb-6"
          style={{ borderColor: "var(--theme-border)" }}
        >
          <span className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--theme-muted)]">
            {section.eyebrow}
          </span>
          <div className="pt-3 flex flex-col gap-3 small:flex-row small:items-end small:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--theme-foreground)]">
                {collection.title}
              </h1>
              <p className="pt-2 max-w-2xl text-sm leading-7 text-[var(--theme-muted)]">
                {description}
              </p>
            </div>
            <div className="text-sm text-[var(--theme-muted)]">
              {productCount} {section.productCountLabel}
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="content-container py-6 small:py-8">
      <div
        className="overflow-hidden border"
        style={{ borderColor: "var(--theme-border)" }}
      >
        <div
          className="px-8 py-8 small:px-10 small:py-10"
          style={{
            borderRadius: "var(--theme-radius-shell)",
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--theme-surface) 68%, var(--theme-accent-soft) 32%), var(--theme-surface))",
            boxShadow: "var(--theme-shadow-shell)",
          }}
        >
          <div className="flex flex-col gap-4">
            <span className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--theme-muted)]">
              {section.eyebrow}
            </span>
            <div className="flex flex-col gap-3">
              <h1 className="text-4xl font-semibold tracking-tight text-[var(--theme-foreground)]">
                {collection.title}
              </h1>
              <p className="max-w-2xl text-base leading-8 text-[var(--theme-muted)]">
                {description}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 pt-2 text-sm text-[var(--theme-muted)]">
              <span
                className="border px-4 py-2"
                style={{
                  borderColor: "var(--theme-border)",
                  borderRadius: "var(--theme-radius-pill)",
                  background: "rgba(255, 253, 248, 0.72)",
                }}
              >
                {productCount} {section.productCountLabel}
              </span>
              {section.metaPills?.map((pill) => (
                <span
                  key={pill}
                  className="border px-4 py-2"
                  style={{
                    borderColor: "var(--theme-border)",
                    borderRadius: "var(--theme-radius-pill)",
                    background: "rgba(255, 253, 248, 0.72)",
                  }}
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
