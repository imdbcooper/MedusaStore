import { ReactNode } from "react"

import { Text, clx } from "@medusajs/ui"

import type {
  StorefrontCatalogResultsShellSurface,
  StorefrontFeaturedRailShellSurface,
  StorefrontStoreCatalogIntroSurface,
} from "@lib/storefront-client-config"
import InteractiveLink from "@modules/common/components/interactive-link"

type CatalogTone = "surface" | "muted"

type CatalogSpacing = "compact" | "comfortable"

type CatalogIntroSurfaceProps = {
  surface: StorefrontStoreCatalogIntroSurface
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

export function StoreCatalogIntroSurface({
  surface,
}: CatalogIntroSurfaceProps) {
  const wrapperClassName = clx(
    "border",
    getToneClassName(surface.tone),
    surface.variant === "editorial"
      ? "rounded-[var(--theme-radius-shell)] px-6 py-8 small:px-8 small:py-10 shadow-[var(--theme-shadow-shell)]"
      : "rounded-[var(--theme-radius-card)] px-5 py-6 small:px-6 small:py-7"
  )

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
            className={clx(
              "font-semibold tracking-tight text-[var(--theme-foreground)]",
              {
                "text-2xl small:text-4xl": surface.variant === "editorial",
                "text-2xl": surface.variant === "simple",
              }
            )}
            data-testid="store-page-title"
          >
            {surface.title}
          </h1>
          {surface.description && (
            <Text
              className={clx("max-w-3xl text-[var(--theme-muted)]", {
                "pt-3 text-base leading-8": surface.variant === "editorial",
                "pt-2 text-sm leading-7": surface.variant === "simple",
              })}
            >
              {surface.description}
            </Text>
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
