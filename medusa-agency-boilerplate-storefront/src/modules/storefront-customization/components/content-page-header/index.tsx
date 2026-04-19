import {
  StorefrontContentPageHeaderSection,
  StorefrontPostPageHeaderSection,
} from "@lib/storefront-client-config"

type SharedHeaderProps = {
  title?: string | null
  excerpt?: string | null
  label: string
  eyebrow: string
  meta?: string | null
}

export function InformationalPageHeader({
  title,
  excerpt,
  pageType,
  section,
}: {
  title?: string | null
  excerpt?: string | null
  pageType?: "marketing" | "informational" | null
  section: StorefrontContentPageHeaderSection
}) {
  const label =
    pageType === "marketing"
      ? section.labels.marketing
      : section.labels.informational

  return (
    <SharedContentHeader
      variant={section.variant}
      title={title}
      excerpt={excerpt}
      label={label}
      eyebrow={section.eyebrow}
    />
  )
}

export function EditorialPostHeader({
  title,
  excerpt,
  publishedAt,
  section,
}: {
  title?: string | null
  excerpt?: string | null
  publishedAt?: string | null
  section: StorefrontPostPageHeaderSection
}) {
  const meta = publishedAt
    ? new Date(publishedAt).toLocaleDateString(section.publishedDateLocale)
    : null

  return (
    <SharedContentHeader
      variant={section.variant}
      title={title}
      excerpt={excerpt}
      label={section.label}
      eyebrow={section.eyebrow}
      meta={meta}
    />
  )
}

function SharedContentHeader({
  variant,
  title,
  excerpt,
  label,
  eyebrow,
  meta,
}: SharedHeaderProps & { variant: "simple" | "editorial" }) {
  if (variant === "simple") {
    return (
      <section className="content-container py-16">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <span className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--theme-muted)]">
            {eyebrow}
          </span>
          <div className="flex flex-wrap gap-3 text-sm text-[var(--theme-muted)]">
            <span>{label}</span>
            {meta ? <span>{meta}</span> : null}
          </div>
          {title ? (
            <h1 className="text-4xl font-semibold tracking-tight text-[var(--theme-foreground)]">
              {title}
            </h1>
          ) : null}
          {excerpt ? (
            <p className="text-lg leading-8 text-[var(--theme-muted)]">{excerpt}</p>
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <section className="content-container py-10">
      <div
        className="border px-8 py-10 small:px-12"
        style={{
          borderColor: "var(--theme-border)",
          borderRadius: "var(--theme-radius-shell)",
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--theme-surface) 80%, var(--theme-accent-soft) 20%), var(--theme-surface))",
          boxShadow: "var(--theme-shadow-shell)",
        }}
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-5">
          <span className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--theme-muted)]">
            {eyebrow}
          </span>
          <div className="flex flex-wrap gap-3 text-sm text-[var(--theme-muted)]">
            <span
              className="border px-4 py-2"
              style={{
                borderColor: "var(--theme-border)",
                borderRadius: "var(--theme-radius-pill)",
                background: "rgba(255, 253, 248, 0.72)",
              }}
            >
              {label}
            </span>
            {meta ? (
              <span
                className="border px-4 py-2"
                style={{
                  borderColor: "var(--theme-border)",
                  borderRadius: "var(--theme-radius-pill)",
                  background: "rgba(255, 253, 248, 0.72)",
                }}
              >
                {meta}
              </span>
            ) : null}
          </div>
          {title ? (
            <h1 className="text-4xl font-semibold tracking-tight text-[var(--theme-foreground)] small:text-5xl">
              {title}
            </h1>
          ) : null}
          {excerpt ? (
            <p className="max-w-3xl text-lg leading-8 text-[var(--theme-muted)]">
              {excerpt}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
