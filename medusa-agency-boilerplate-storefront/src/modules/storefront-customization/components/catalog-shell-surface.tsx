import { ReactNode } from "react"

import { stitchCatalogPills } from "../../../data/mockData"
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
  sortControl?: ReactNode
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
  sortControl,
}: CatalogIntroSurfaceProps) {
  return (
    <>
      <section className="py-24 small:py-[120px]" data-testid="store-catalog-hero">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
          <div>
            <h1
              className="max-w-3xl text-[44px] font-bold leading-[1.1] tracking-[-0.02em] text-[#171A1F] small:text-[48px]"
              data-testid="store-page-title"
            >
              {surface.title}
            </h1>
            {surface.description && (
              <Text className="max-w-[560px] pt-6 text-lg leading-[1.6] text-[#4A607D] small:text-[18px]">
                {surface.description}
              </Text>
            )}
          </div>
          <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-8">
            <div className="flex items-start gap-8 small:gap-6">
              <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-lg bg-[var(--theme-surface-muted)] text-3xl text-[var(--theme-accent)]">
                ◴
              </div>
              <div>
                <h2 className="text-[32px] font-semibold leading-[1.2] tracking-[-0.01em] text-[#171A1F]">
                  Быстрый запуск
                </h2>
                <p className="pt-4 text-[18px] leading-[1.6] text-[#4A607D]">
                  Вам не нужно ждать месяцами. Системный подход позволяет запустить проект в 3 раза быстрее.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="mb-12 border-b border-[var(--theme-border)] pb-6" data-testid="store-catalog-controls">
        <div className="flex flex-wrap items-center gap-4">
          <span className="mr-2 text-xs font-semibold uppercase leading-none tracking-[0.2em] text-[#737780]">
            {surface.eyebrow || "Категории:"}
          </span>
          {stitchCatalogPills.map((pill, index) => (
            <button
              key={pill}
              className={clx(
                "rounded-full border px-4 py-2 text-xs font-semibold uppercase leading-none tracking-[0.18em] transition-colors",
                index === 0
                  ? "border-[var(--theme-accent)] bg-[var(--theme-accent)] text-[var(--theme-accent-contrast)]"
                  : "border-[var(--theme-border)] bg-[var(--theme-surface)] text-[#4A607D] hover:border-[#171A1F]"
              )}
              type="button"
            >
              {pill}
            </button>
          ))}
          {sortControl ? <div className="ml-auto">{sortControl}</div> : null}
        </div>
      </section>
    </>
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
    return <div className="w-full">{children}</div>
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

export function CatalogTrustSection() {
  return (
    <section className="pb-24 pt-20 small:pb-[120px] small:pt-[120px]" data-testid="store-catalog-trust">
      <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-8 small:p-10">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div className="max-w-[900px]">
            <h2 className="text-[32px] font-semibold leading-[1.2] tracking-[-0.01em] text-[#171A1F]">
              Профессиональный контроль качества
            </h2>
            <p className="pt-4 text-[18px] leading-[1.6] text-[#4A607D]">
              Каждое решение проходит ручную модерацию экспертами. Мы не просто продаем шаблоны — мы обеспечиваем техническую надежность и соответствие современным стандартам UI/UX. Человеческая экспертиза поверх системной эффективности.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-xl bg-[#6F8F7A] px-6 py-4 text-[#171A1F]">
            <span className="text-3xl" aria-hidden="true">▣</span>
            <span className="text-2xl font-semibold leading-[1.3]">Expert Check</span>
          </div>
        </div>
      </div>
    </section>
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
