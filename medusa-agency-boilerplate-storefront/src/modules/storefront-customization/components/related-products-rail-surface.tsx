import { ReactNode } from "react"

import { Text, clx } from "@medusajs/ui"

import type {
  StorefrontCatalogShellTone,
  StorefrontCatalogSpacing,
  StorefrontRelatedProductsRailHeaderAlignment,
  StorefrontRelatedProductsRailSurface,
} from "@lib/storefront-client-config"

type RelatedProductsRailSurfaceProps = {
  surface: StorefrontRelatedProductsRailSurface
  children: ReactNode
}

const getToneClassName = (tone: StorefrontCatalogShellTone) =>
  clx({
    "bg-[var(--theme-surface)]": tone === "surface",
    "bg-[var(--theme-surface-muted)]": tone === "muted",
  })

const getFramePaddingClassName = (spacing: StorefrontCatalogSpacing) =>
  clx({
    "p-4 small:p-6": spacing === "compact",
    "p-6 small:p-8": spacing === "comfortable",
  })

const getSectionSpacingClassName = (spacing: StorefrontCatalogSpacing) =>
  clx({
    "py-8 small:py-10": spacing === "compact",
    "py-12 small:py-20": spacing === "comfortable",
  })

const getHeaderClassName = (
  alignment: StorefrontRelatedProductsRailHeaderAlignment,
  spacing: StorefrontCatalogSpacing
) =>
  clx("flex flex-col", {
    "items-start text-left": alignment === "start",
    "items-center text-center": alignment === "center",
    "mb-8 gap-4": spacing === "compact",
    "mb-10 gap-6": spacing === "comfortable",
  })

const getGridClassName = (spacing: StorefrontCatalogSpacing) =>
  clx("grid grid-cols-2 small:grid-cols-3 medium:grid-cols-4", {
    "gap-x-4 gap-y-6 small:gap-x-6 small:gap-y-8": spacing === "compact",
    "gap-x-6 gap-y-8": spacing === "comfortable",
  })

export default function RelatedProductsRailSurface({
  surface,
  children,
}: RelatedProductsRailSurfaceProps) {
  const body = (
    <>
      <div className={getHeaderClassName(surface.header.alignment, surface.spacing)}>
        {surface.header.eyebrow && (
          <Text className="text-base-regular text-[var(--theme-muted)]">
            {surface.header.eyebrow}
          </Text>
        )}
        <h2 className="text-2xl-regular max-w-lg text-[var(--theme-foreground)]">
          {surface.header.title}
        </h2>
        {surface.header.description && (
          <Text className="max-w-2xl text-base-regular text-[var(--theme-muted)]">
            {surface.header.description}
          </Text>
        )}
      </div>
      <ul className={getGridClassName(surface.grid.density)}>{children}</ul>
    </>
  )

  if (surface.variant === "plain") {
    return (
      <section
        className={clx("content-container", getSectionSpacingClassName(surface.spacing))}
        data-testid="related-products-container"
      >
        <div className={getToneClassName(surface.tone)}>{body}</div>
      </section>
    )
  }

  return (
    <section
      className={clx("content-container", getSectionSpacingClassName(surface.spacing))}
      data-testid="related-products-container"
    >
      <div
        className={clx(
          "border rounded-[var(--theme-radius-shell)] shadow-[var(--theme-shadow-shell)]",
          getToneClassName(surface.tone),
          getFramePaddingClassName(surface.spacing)
        )}
        style={{
          borderColor: "var(--theme-border)",
        }}
      >
        {body}
      </div>
    </section>
  )
}
