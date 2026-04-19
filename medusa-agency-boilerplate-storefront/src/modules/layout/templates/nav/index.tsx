import { Suspense } from "react"

import { getNavigation, getSiteSettings } from "@lib/data/content/globals"
import { getLocale } from "@lib/data/locale-actions"
import { listLocales } from "@lib/data/locales"
import { listRegions } from "@lib/data/regions"
import { storefrontConfig } from "@lib/storefront-config"
import { ContentLinkRow } from "@lib/content/types"
import { StoreRegion } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ContentLinkItem from "@modules/content/components/content-link"
import CartButton from "@modules/layout/components/cart-button"
import SideMenu from "@modules/layout/components/side-menu"
import { resolveNavShellSurface } from "@modules/storefront-customization/components/shell-surface-resolver"

export default async function Nav() {
  const [regions, locales, currentLocale, siteSettings, navigation] =
    await Promise.all([
      listRegions().then((regions: StoreRegion[]) => regions),
      listLocales(),
      getLocale(),
      getSiteSettings(),
      getNavigation(),
    ])

  const navigationCopy = storefrontConfig.copy.navigation
  const brandName = siteSettings?.siteName || storefrontConfig.storeName
  const contentItems = (navigation?.items || []).filter(Boolean) as ContentLinkRow[]
  const navSurface = resolveNavShellSurface()
  const isFloating = navSurface.variant === "floating"
  const isInverseTone = navSurface.tone === "inverse"
  const desktopContentItems = contentItems.slice(
    0,
    navSurface.content.desktopContentItemsLimit
  )

  return (
    <div
      className={clx("sticky inset-x-0 z-50 group", isFloating ? "top-0 px-4 pt-4" : "top-0")}
      data-nav-variant={navSurface.variant}
      data-nav-tone={navSurface.tone}
    >
      <header
        className={clx(
          "relative h-16 mx-auto duration-200",
          isFloating ? "max-w-[calc(var(--theme-content-max-width)+2rem)]" : ""
        )}
      >
        <nav
          className={clx(
            "content-container txt-xsmall-plus flex items-center justify-between w-full h-full text-small-regular gap-x-6",
            isFloating ? "border" : "border-b",
            isInverseTone
              ? "bg-[var(--theme-foreground)] text-[var(--theme-accent-contrast)]"
              : "bg-[var(--theme-surface)] text-[var(--theme-muted)]"
          )}
          style={
            isFloating
              ? {
                  borderColor: isInverseTone ? "rgba(255, 255, 255, 0.16)" : "var(--theme-border)",
                  borderRadius: "var(--theme-radius-pill)",
                  boxShadow: "var(--theme-shadow-shell)",
                }
              : {
                  borderColor: isInverseTone ? "rgba(255, 255, 255, 0.12)" : "var(--theme-border)",
                }
          }
        >
          <div className="flex-1 basis-0 h-full flex items-center">
            <div className="h-full">
              <SideMenu
                regions={regions}
                locales={locales}
                currentLocale={currentLocale}
                contentItems={contentItems}
              />
            </div>
          </div>

          <div className="flex items-center h-full">
            <LocalizedClientLink
              href="/"
              className={clx(
                "txt-compact-xlarge-plus uppercase transition hover:opacity-80",
                isInverseTone
                  ? "text-[var(--theme-accent-contrast)]"
                  : "text-[var(--theme-foreground)]"
              )}
              data-testid="nav-store-link"
            >
              {brandName}
            </LocalizedClientLink>
          </div>

          <div className="flex items-center gap-x-6 h-full flex-1 basis-0 justify-end">
            <div className="hidden small:flex items-center gap-x-6 h-full">
              {desktopContentItems.map((item, index) => (
                <ContentLinkItem
                  key={String(item.id || index)}
                  item={item}
                  className={clx(
                    "transition",
                    isInverseTone
                      ? "hover:text-[var(--theme-accent-contrast)]"
                      : "hover:text-[var(--theme-foreground)]"
                  )}
                />
              ))}
              <LocalizedClientLink
                className={clx(
                  "transition",
                  isInverseTone
                    ? "hover:text-[var(--theme-accent-contrast)]"
                    : "hover:text-[var(--theme-foreground)]"
                )}
                href="/account"
                data-testid="nav-account-link"
              >
                {navigationCopy.account}
              </LocalizedClientLink>
            </div>
            <Suspense
              fallback={
                <LocalizedClientLink
                  className={clx(
                    "flex gap-2 transition",
                    isInverseTone
                      ? "hover:text-[var(--theme-accent-contrast)]"
                      : "hover:text-[var(--theme-foreground)]"
                  )}
                  href="/cart"
                  data-testid="nav-cart-link"
                >
                  {`${navigationCopy.cart} (0)`}
                </LocalizedClientLink>
              }
            >
              <CartButton />
            </Suspense>
          </div>
        </nav>
      </header>
    </div>
  )
}
