import {
  StorefrontSurfaceCtaSection,
  StorefrontSurfaceInfoGridSection,
} from "@lib/storefront-client-config"
import StorefrontActionLinkButton from "../action-link"

export function LandingSurfaceInfoGrid({
  section,
}: {
  section: StorefrontSurfaceInfoGridSection
}) {
  return (
    <section className="content-container py-6 small:py-8">
      <div
        className="border px-6 py-8 small:px-8"
        style={{
          borderColor: "var(--theme-border)",
          borderRadius: "var(--theme-radius-shell)",
          background: "var(--theme-surface)",
          boxShadow: "var(--theme-shadow-card)",
        }}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-4 text-center">
          {section.eyebrow ? (
            <span className="text-sm font-medium uppercase tracking-[0.24em] text-[var(--theme-muted)]">
              {section.eyebrow}
            </span>
          ) : null}
          <h2 className="text-3xl font-semibold tracking-tight text-[var(--theme-foreground)] small:text-4xl">
            {section.title}
          </h2>
          {section.description ? (
            <p className="text-base leading-7 text-[var(--theme-muted)]">
              {section.description}
            </p>
          ) : null}
        </div>
        <div className="grid gap-4 pt-8 lg:grid-cols-3">
          {section.items.map((item) => (
            <div
              key={item.title}
              className="border p-5"
              style={{
                borderColor: "var(--theme-border)",
                borderRadius: "var(--theme-radius-card)",
                background: "var(--theme-surface-muted)",
              }}
            >
              <h3 className="text-lg font-semibold text-[var(--theme-foreground)]">
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
}

export function LandingSurfaceCta({
  section,
}: {
  section: StorefrontSurfaceCtaSection
}) {
  return (
    <section className="content-container py-6 pb-12 small:py-8 small:pb-16">
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
}
