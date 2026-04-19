import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { clx } from "@medusajs/ui"

import { StorefrontActionLink } from "@lib/storefront-client-config"

const isExternalHref = (href: string) =>
  href.startsWith("http://") || href.startsWith("https://")

export default function StorefrontActionLinkButton({
  action,
  variant = "primary",
}: {
  action?: StorefrontActionLink
  variant?: "primary" | "secondary"
}) {
  if (!action?.label || !action.href) {
    return null
  }

  const className = clx(
    "inline-flex items-center justify-center px-5 py-3 text-sm font-medium transition",
    variant === "primary"
      ? "rounded-[var(--theme-radius-pill)] bg-[var(--theme-accent)] text-[var(--theme-accent-contrast)] hover:opacity-90"
      : "rounded-[var(--theme-radius-pill)] border border-[var(--theme-border)] bg-transparent text-[var(--theme-foreground)] hover:bg-[var(--theme-surface-muted)]"
  )

  if (isExternalHref(action.href)) {
    return (
      <a
        href={action.href}
        target={action.newTab ? "_blank" : undefined}
        rel={action.newTab ? "noreferrer" : undefined}
        className={className}
      >
        {action.label}
      </a>
    )
  }

  return (
    <LocalizedClientLink href={action.href} className={className}>
      {action.label}
    </LocalizedClientLink>
  )
}
