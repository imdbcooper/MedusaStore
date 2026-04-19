import { ReactNode } from "react"

import { HttpTypes } from "@medusajs/types"
import { Text, clx } from "@medusajs/ui"

import type {
  StorefrontCatalogResultsShellSurface,
  StorefrontCategoryCatalogIntroSurface,
  StorefrontFeaturedRailShellSurface,
  StorefrontStoreCatalogIntroSurface,
} from "@lib/storefront-client-config"
import InteractiveLink from "@modules/common/components/interactive-link"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type CatalogTone = "surface" | "muted"

type CatalogSpacing = "compact" | "comfortable"

type CatalogIntroSurfaceProps = {
  surface: StorefrontStoreCatalogIntroSurface
}

type CategoryCatalogIntroSurfaceProps = {
  surface: StorefrontCategoryCatalogIntroSurface
  category: HttpTypes.StoreProductCategory
  parents: HttpTypes.StoreProductCategory[]
}

type CatalogResultsShellSurfaceProps = {
  surface: StorefrontCatalogResultsShellSurface
  children: ReactNode
}

type FeaturedRailCatalogShellSurfaceProps = {
  surface: StorefrontFeaturedRailShellSurface
  title: string
  href: string
  actionLabel: string
  children: ReactNode
}

const getToneClassName = (tone: CatalogTone) =>
  clx({
    "bg-[var(--theme-surface)]": tone === "surface",
    "bg-[var(--theme-surface-muted)]": tone === "muted",
  })

const getFramePaddingClassName = (spacing: CatalogSpacing) =>
  clx({
    "p-4 small:p-6": spacing === "compact",
    "p-6 small:p-8": spacing === "comfortable",
  })

const getSectionSpacingClassName = (spacing: CatalogSpacing) =>
  clx({
    "py-8 small:py-10": spacing === "compact",
    "py-12 small:py-20": spacing === "comfortable",
  })

const getIntroWrapperClassName = ({
  tone,
  variant,
}: {
  tone: CatalogTone
  variant: "simple" | "editorial"
}) =>
  clx(
    "border",
    getToneClassName(tone),
    variant === "editorial"
      ? "rounded-[var(--theme-radius-shell)] px-6 py-8 small:px-8 small:py-10 shadow-[var(--theme-shadow-shell)]"
      : "rounded-[var(--theme-radius-card)] px-5 py-6 small:px-6 small:py-7"
  )

const getIntroTitleClassName = (variant: "simple" | "editorial") =>
  clx("font-semibold tracking-tight text-[var(--theme-foreground)]", {
    "text-2xl small:text-4xl": variant === "editorial",
    "text-2xl": variant === "simple",
  })

const getIntroDescriptionClassName = (variant: "simple" | "editorial") =>
  clx("max-w-3xl text-[var(--theme-muted)]", {
    "pt-3 text-base leading-8": variant === "editorial",
    "pt-2 text-sm leading-7": variant === "simple",
  })

export function StoreCatalogIntroSurface({
  surface,
}: CatalogIntroSurfaceProps) {
  const wrapperClassName = getIntroWrapperClassName(surface)

  return (
    <section className="mb-8">
      <div
        className={wrapperClassName}
        style={{
          borderColor: "var(--theme-border)",
        }}
      >
        {surface.eyebrow && (
          <span className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--theme-muted)]">
            {surface.eyebrow}
          </span>
        )}
        <div className={surface.eyebrow ? "pt-3" : undefined}>
          <h1
            className={getIntroTitleClassName(surface.variant)}
            data-testid="store-page-title"
          >
            {surface.title}
          </h1>
          {surface.description && (
            <Text className={getIntroDescriptionClassName(surface.variant)}>
              {surface.description}
            </Text>
          )}
        </div>
      </div>
    </section>
  )
}

export function CategoryCatalogIntroSurface({
  surface,
  category,
  parents,
}: CategoryCatalogIntroSurfaceProps) {
  const wrapperClassName = getIntroWrapperClassName(surface)

  return (
    <section className="mb-8">
      <div
        className={wrapperClassName}
        style={{
          borderColor: "var(--theme-border)",
        }}
      >
        {surface.eyebrow && (
          <span className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--theme-muted)]">
            {surface.eyebrow}
          </span>
        )}
        <div className={surface.eyebrow ? "pt-3" : undefined}>
          {parents.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-[var(--theme-muted)]">
              {parents.map((parent) => (
                <span key={parent.id} className="inline-flex items-center gap-2">
                  <LocalizedClientLink
                    className="transition-colors hover:text-[var(--theme-foreground)]"
                    href={`/categories/${parent.handle}`}
                    data-testid="category-parent-link"
                  >
                    {parent.name}
                  </LocalizedClientLink>
                  <span>/</span>
                </span>
              ))}
            </div>
          )}
          <h1
            className={getIntroTitleClassName(surface.variant)}
            data-testid="category-page-title"
          >
            {category.name}
          </h1>
          {category.description && (
            <Text className={getIntroDescriptionClassName(surface.variant)}>
              {category.description}
            </Text>
          )}
          {category.category_children && category.category_children.length > 0 && (
            <div className="pt-6 text-base-large">
              <ul className="grid grid-cols-1 gap-2">
                {category.category_children.map((child) => (
                  <li key={child.id}>
                    <InteractiveLink href={`/categories/${child.handle}`}>
                      {child.name}
                    </InteractiveLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export function CatalogResultsShellSurface({
  surface,
  children,
}: CatalogResultsShellSurfaceProps) {
  if (surface.variant === "plain") {
    return <div className={clx("w-full", getSectionSpacingClassName(surface.spacing))}>{children}</div>
  }

  return (
    <div className={clx("w-full", getSectionSpacingClassName(surface.spacing))}>
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
        {children}
      </div>
    </div>
  )
}

export function FeaturedRailCatalogShellSurface({
  surface,
  title,
  href,
  actionLabel,
  children,
}: FeaturedRailCatalogShellSurfaceProps) {
  const headerClassName = clx("mb-8 flex gap-4", {
    "flex-col small:flex-row small:items-center small:justify-between":
      surface.variant === "split",
    "flex-col": surface.variant === "stacked",
  })

  const body = (
    <>
      <div className={headerClassName}>
        <Text className="txt-xlarge text-[var(--theme-foreground)]">{title}</Text>
        <InteractiveLink href={href}>{actionLabel}</InteractiveLink>
      </div>
      {children}
    </>
  )

  if (surface.variant === "stacked") {
    return (
      <section className={clx("content-container", getSectionSpacingClassName(surface.spacing))}>
        <div className={getToneClassName(surface.tone)}>{body}</div>
      </section>
    )
  }

  return (
    <section className={clx("content-container", getSectionSpacingClassName(surface.spacing))}>
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
