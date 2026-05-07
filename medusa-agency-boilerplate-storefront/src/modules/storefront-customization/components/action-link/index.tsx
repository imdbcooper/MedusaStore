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
    "inline-flex items-center justify-center px-6 py-3 text-sm font-bold tracking-wide transition duration-200 hover:-translate-y-0.5",
    variant === "primary"
      ? "rounded-[var(--theme-radius-card)] bg-[var(--theme-accent)] text-[var(--theme-accent-contrast)] shadow-[0_12px_28px_rgba(47,125,120,0.18)] hover:bg-[var(--theme-accent-strong)]"
      : "rounded-[var(--theme-radius-card)] border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-foreground)] hover:border-[var(--theme-foreground)]"
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
