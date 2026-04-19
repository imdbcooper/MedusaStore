"use client"

import { Locale } from "@lib/data/locales"
import { ContentLinkRow } from "@lib/content/types"
import { storefrontConfig } from "@lib/storefront-config"
import { Popover, PopoverPanel, Transition } from "@headlessui/react"
import { HttpTypes } from "@medusajs/types"
import { ArrowRightMini, XMark } from "@medusajs/icons"
import { Text, clx, useToggleState } from "@medusajs/ui"
import { Fragment } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ContentLinkItem from "@modules/content/components/content-link"
import { resolveSideMenuShellSurface } from "@modules/storefront-customization/components/shell-surface-resolver"
import CountrySelect from "../country-select"
import LanguageSelect from "../language-select"

const getSideMenuItems = (
  navigationCopy: typeof storefrontConfig.copy.navigation
) => [
  {
    label: navigationCopy.home,
    href: "/",
    testId: "home-link",
  },
  {
    label: navigationCopy.catalog,
    href: "/store",
    testId: "store-link",
  },
  {
    label: navigationCopy.account,
    href: "/account",
    testId: "account-link",
  },
  {
    label: navigationCopy.cart,
    href: "/cart",
    testId: "cart-link",
  },
]

type SideMenuProps = {
  regions: HttpTypes.StoreRegion[] | null
  locales: Locale[] | null
  currentLocale: string | null
  contentItems?: ContentLinkRow[]
}

const SideMenu = ({
  regions,
  locales,
  currentLocale,
  contentItems = [],
}: SideMenuProps) => {
  const countryToggleState = useToggleState()
  const languageToggleState = useToggleState()
  const navigationCopy = storefrontConfig.copy.navigation
  const commonCopy = storefrontConfig.copy.common
  const sideMenuSurface = resolveSideMenuShellSurface()
  const isGlassVariant = sideMenuSurface.variant === "glass"
  const isInverseTone = sideMenuSurface.tone === "inverse"
  const shouldShowSupplementalContentItems =
    sideMenuSurface.content.showSupplementalContentItems

  return (
    <div className="h-full">
      <div className="flex items-center h-full">
        <Popover className="h-full flex">
          {({ open, close }) => (
            <>
              <div className="relative flex h-full">
                <Popover.Button
                  data-testid="nav-menu-button"
                  className={clx(
                    "relative h-full flex items-center transition-all ease-out duration-200 focus:outline-none",
                    isInverseTone ? "hover:text-[var(--theme-accent-contrast)]" : "hover:text-ui-fg-base"
                  )}
                >
                  {navigationCopy.menu}
                </Popover.Button>
              </div>

              {open && (
                <div
                  className="fixed inset-0 z-[50] bg-black/0 pointer-events-auto"
                  onClick={close}
                  data-testid="side-menu-backdrop"
                />
              )}

              <Transition
                show={open}
                as={Fragment}
                enter="transition ease-out duration-150"
                enterFrom="opacity-0"
                enterTo="opacity-100 backdrop-blur-2xl"
                leave="transition ease-in duration-150"
                leaveFrom="opacity-100 backdrop-blur-2xl"
                leaveTo="opacity-0"
              >
                <PopoverPanel
                  className={clx(
                    "flex flex-col absolute w-full pr-4 sm:pr-0 sm:w-1/3 2xl:w-1/4 sm:min-w-min h-[calc(100vh-1rem)] z-[51] inset-x-0 text-sm m-2",
                    isGlassVariant && "backdrop-blur-2xl",
                    isInverseTone ? "text-ui-fg-on-color" : "text-[var(--theme-foreground)]"
                  )}
                >
                  <div
                    data-testid="nav-menu-popup"
                    data-side-menu-variant={sideMenuSurface.variant}
                    data-side-menu-tone={sideMenuSurface.tone}
                    className={clx(
                      "flex flex-col h-full justify-between p-6",
                      isGlassVariant ? "rounded-rounded" : "rounded-[var(--theme-radius-shell)] border"
                    )}
                    style={{
                      background: isInverseTone
                        ? "rgba(3, 7, 18, 0.72)"
                        : "var(--theme-surface)",
                      borderColor: isGlassVariant
                        ? "transparent"
                        : isInverseTone
                          ? "rgba(255, 255, 255, 0.12)"
                          : "var(--theme-border)",
                      boxShadow: isGlassVariant ? undefined : "var(--theme-shadow-shell)",
                    }}
                  >
                    <div className="flex justify-end" id="xmark">
                      <button
                        data-testid="close-menu-button"
                        onClick={close}
                        className={clx(
                          "transition",
                          isInverseTone
                            ? "hover:text-[var(--theme-accent-contrast)]"
                            : "hover:text-[var(--theme-foreground)]"
                        )}
                      >
                        <XMark />
                      </button>
                    </div>
                    <div className="flex flex-col gap-8">
                      <ul className="flex flex-col gap-6 items-start justify-start">
                        {getSideMenuItems(navigationCopy).map((item) => {
                          return (
                            <li key={item.href}>
                              <LocalizedClientLink
                                href={item.href}
                                className={clx(
                                  "text-3xl leading-10",
                                  isInverseTone
                                    ? "hover:text-ui-fg-disabled"
                                    : "hover:text-[var(--theme-muted)]"
                                )}
                                onClick={close}
                                data-testid={item.testId}
                              >
                                {item.label}
                              </LocalizedClientLink>
                            </li>
                          )
                        })}
                      </ul>

                      {shouldShowSupplementalContentItems && contentItems.length > 0 && (
                        <ul
                          className={clx(
                            "flex flex-col gap-4 items-start justify-start border-t pt-6",
                            isInverseTone ? "border-white/10" : "border-[var(--theme-border)]"
                          )}
                        >
                          {contentItems.map((item, index) => (
                            <li key={String(item.id || index)}>
                              <ContentLinkItem
                                item={item}
                                onClick={close}
                                className={clx(
                                  "text-lg leading-7",
                                  isInverseTone
                                    ? "hover:text-ui-fg-disabled"
                                    : "hover:text-[var(--theme-muted)]"
                                )}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex flex-col gap-y-6">
                      {!!locales?.length && (
                        <div
                          className="flex justify-between"
                          onMouseEnter={languageToggleState.open}
                          onMouseLeave={languageToggleState.close}
                        >
                          <LanguageSelect
                            toggleState={languageToggleState}
                            locales={locales}
                            currentLocale={currentLocale}
                          />
                          <ArrowRightMini
                            className={clx(
                              "transition-transform duration-150",
                              languageToggleState.state ? "-rotate-90" : ""
                            )}
                          />
                        </div>
                      )}
                      <div
                        className="flex justify-between"
                        onMouseEnter={countryToggleState.open}
                        onMouseLeave={countryToggleState.close}
                      >
                        {regions && (
                          <CountrySelect
                            toggleState={countryToggleState}
                            regions={regions}
                          />
                        )}
                        <ArrowRightMini
                          className={clx(
                            "transition-transform duration-150",
                            countryToggleState.state ? "-rotate-90" : ""
                          )}
                        />
                      </div>
                      <Text
                        className={clx(
                          "flex justify-between txt-compact-small",
                          isInverseTone
                            ? "text-[color:rgba(247,251,255,0.72)]"
                            : "text-[var(--theme-muted)]"
                        )}
                      >
                        © {new Date().getFullYear()} {storefrontConfig.storeName}.{" "}
                        {commonCopy.allRightsReserved}
                      </Text>
                    </div>
                  </div>
                </PopoverPanel>
              </Transition>
            </>
          )}
        </Popover>
      </div>
    </div>
  )
}

export default SideMenu
