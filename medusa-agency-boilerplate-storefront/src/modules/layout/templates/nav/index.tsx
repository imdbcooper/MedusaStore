import { Suspense } from "react"

import { appendFallbackContentLinks } from "@lib/content/links"
import { ContentLinkRow } from "@lib/content/types"
import { getNavigation } from "@lib/data/content/globals"
import { getLocale } from "@lib/data/locale-actions"
import { listLocales } from "@lib/data/locales"
import { listRegions } from "@lib/data/regions"
import { storefrontConfig } from "@lib/storefront-config"
import { StoreRegion } from "@medusajs/types"
import { clx } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import SideMenu from "@modules/layout/components/side-menu"
import { resolveNavShellSurface } from "@modules/storefront-customization/components/shell-surface-resolver"

const STITCH_NAV_BRAND = storefrontConfig.storeName

const stitchDesktopNavLinks = [
  { label: "Каталог", href: "/store", active: true },
  { label: "О нас", href: "/about" },
  { label: "Акции", href: "/promotions" },
  { label: "Доставка и оплата", href: "/delivery-and-payment" },
  { label: "Контакты", href: "/contacts" },
]

const stitchDesktopNavLinkClass =
  "relative flex h-full items-center px-[2px] text-[14px] font-medium leading-none text-[#35454F] transition-colors duration-150 hover:text-[#2F7D78]"

const stitchMobileLinkClass =
  "flex min-h-[26px] max-w-[84px] items-center justify-center text-center text-[11px] font-medium leading-[13px] tracking-[-0.01em] text-[var(--theme-foreground)] transition hover:text-[var(--theme-accent-strong)] whitespace-normal"

export default async function Nav() {
  const [regions, locales, currentLocale, navigation] = await Promise.all([
    listRegions().then((regions: StoreRegion[]) => regions),
    listLocales(),
    getLocale(),
    getNavigation(),
  ])

  const contentItems = appendFallbackContentLinks(
    (navigation?.items || []).filter(Boolean) as ContentLinkRow[]
  )
  const navSurface = resolveNavShellSurface()

  return (
    <div
      className="sticky inset-x-0 top-0 z-50 bg-[var(--theme-canvas)]"
      data-nav-variant={navSurface.variant}
      data-nav-tone={navSurface.tone}
    >
      <div className="mx-auto w-full max-w-[var(--theme-content-max-width)] pt-0">
        <header className="relative h-[68px] w-full rounded-b-[10px] rounded-t-none border border-[#DED8CC] bg-[#F7F4EC] shadow-[0_1px_0_rgba(31,24,18,0.02)]">
          <nav
            className="relative flex h-full w-full items-center px-[22px] text-[#111814]"
            aria-label="Main navigation"
          >
            <LocalizedClientLink
              href="/"
              className="hidden whitespace-nowrap text-[22px] font-bold leading-none tracking-[-0.04em] text-[#111814] transition hover:text-[#2F7D78] small:block"
              data-testid="nav-store-link"
            >
              {STITCH_NAV_BRAND}
            </LocalizedClientLink>

            <div className="relative z-10 flex h-full min-w-[72px] items-center justify-start small:hidden">
              <SideMenu
                regions={regions}
                locales={locales}
                currentLocale={currentLocale}
                contentItems={contentItems}
              />
            </div>

            <LocalizedClientLink
              href="/"
              className="absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center text-[18px] font-bold leading-none tracking-[-0.04em] text-[#111814] transition hover:text-[#2F7D78] small:hidden"
              data-testid="nav-store-mobile-link"
            >
              {STITCH_NAV_BRAND}
            </LocalizedClientLink>

            <div className="absolute left-1/2 top-0 hidden h-full -translate-x-1/2 items-center gap-x-[24px] small:flex">
              {stitchDesktopNavLinks.map((item) => (
                <LocalizedClientLink
                  key={item.label}
                  className={clx(
                    stitchDesktopNavLinkClass,
                    item.active && "font-semibold text-[#2F7D78] after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:rounded-full after:bg-[#2F7D78]"
                  )}
                  href={item.href}
                  data-testid={`nav-${item.label.toLowerCase()}-link`}
                >
                  {item.label}
                </LocalizedClientLink>
              ))}
            </div>

            <div className="ml-auto hidden h-full items-center gap-x-[18px] small:flex">
              <LocalizedClientLink
                className="flex h-full items-center text-[14px] font-medium leading-none text-[#1F2B35] transition hover:text-[#2F7D78]"
                href="/account"
                data-testid="nav-account-link"
              >
                Аккаунт
              </LocalizedClientLink>
              <Suspense
                fallback={
                  <LocalizedClientLink
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#DED8CC] bg-white/45 text-[12px] font-semibold text-[#1F2B35] transition hover:border-[#2F7D78]/45 hover:bg-white hover:text-[#2F7D78]"
                    href="/cart"
                    data-testid="nav-cart-link"
                    aria-label="Корзина (0)"
                  >
                    0
                  </LocalizedClientLink>
                }
              >
                <CartButton
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#DED8CC] bg-white/45 text-[#1F2B35] transition hover:border-[#2F7D78]/45 hover:bg-white hover:text-[#2F7D78]"
                  variant="icon"
                />
              </Suspense>
              <LocalizedClientLink
                className="inline-flex h-[36px] w-[144px] items-center justify-center rounded-[8px] bg-[#2F7D78] px-4 text-[14px] font-semibold leading-none text-white shadow-[0_6px_16px_rgba(47,125,120,0.18)] transition hover:bg-[#286D68]"
                href="/contacts"
                data-testid="nav-launch-project-link"
              >
                Контакты
              </LocalizedClientLink>
            </div>

            <div className="ml-auto flex h-full items-center small:hidden">
              <Suspense
                fallback={
                  <LocalizedClientLink
                    className={stitchMobileLinkClass}
                    href="/cart"
                    data-testid="nav-cart-link"
                  >
                    Корзина (0)
                  </LocalizedClientLink>
                }
              >
                <CartButton className={stitchMobileLinkClass} />
              </Suspense>
            </div>
          </nav>
        </header>
      </div>
    </div>
  )
}
