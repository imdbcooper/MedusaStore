import { appendFallbackContentLinks, INFORMATIONAL_PAGE_LINKS } from "@lib/content/links"
import { listCategories } from "@lib/data/categories"
import { listCollections } from "@lib/data/collections"
import { getFooter, getSiteSettings } from "@lib/data/content/globals"
import { storefrontConfig } from "@lib/storefront-config"
import { Text, clx } from "@medusajs/ui"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ContentLinkItem from "@modules/content/components/content-link"
import MedusaCTA from "@modules/layout/components/medusa-cta"
import { resolveFooterShellSurface } from "@modules/storefront-customization/components/shell-surface-resolver"

export default async function Footer() {
  const [{ collections }, productCategories, payloadFooter, siteSettings] =
    await Promise.all([
      listCollections({
        fields: "*products",
      }),
      listCategories(),
      getFooter(),
      getSiteSettings(),
    ])

  const footerCopy = storefrontConfig.copy.footer
  const navigationCopy = storefrontConfig.copy.navigation
  const commonCopy = storefrontConfig.copy.common

  const brandName = siteSettings?.siteName || storefrontConfig.storeName
  const tagline = siteSettings?.tagline || storefrontConfig.tagline
  const contactEmail = payloadFooter?.contactEmail || storefrontConfig.contact.email
  const contactPhone = payloadFooter?.contactPhone || storefrontConfig.contact.phone
  const footerColumns = payloadFooter?.columns || []
  const socialLinks = payloadFooter?.socialLinks || []
  const footerSurface = resolveFooterShellSurface()
  const isEditorial = footerSurface.variant === "editorial"
  const isInverseTone = footerSurface.tone === "inverse"
  const categoryLinkLimit = footerSurface.content.categoryLinksLimit
  const collectionLinkLimit = footerSurface.content.collectionLinksLimit
  const informationalLinks = appendFallbackContentLinks(
    footerColumns.flatMap((column) => column.links || []),
    INFORMATIONAL_PAGE_LINKS
  ).slice(footerColumns.flatMap((column) => column.links || []).length)

  return (
    <footer
      className={clx(
        "w-full",
        isEditorial ? "pt-6 pb-10" : "border-t",
        isInverseTone && "bg-[var(--theme-foreground)] text-[var(--theme-accent-contrast)]"
      )}
      data-footer-variant={footerSurface.variant}
      data-footer-tone={footerSurface.tone}
      style={
        isEditorial
          ? undefined
          : {
              borderColor: isInverseTone ? "rgba(255, 255, 255, 0.12)" : "var(--theme-border)",
            }
      }
    >
      <div className="content-container flex flex-col w-full">
        <div
          className={clx(
            "flex flex-col gap-y-6 xsmall:flex-row items-start justify-between py-16 px-8 small:px-10",
            isInverseTone && !isEditorial && "text-[var(--theme-accent-contrast)]"
          )}
          style={
            isEditorial
              ? {
                  border: isInverseTone
                    ? "1px solid rgba(255, 255, 255, 0.12)"
                    : "1px solid var(--theme-border)",
                  borderRadius: "var(--theme-radius-shell)",
                  background: isInverseTone
                    ? "var(--theme-foreground)"
                    : "var(--theme-surface)",
                  boxShadow: "var(--theme-shadow-shell)",
                }
              : undefined
          }
        >
          <div className="max-w-sm flex flex-col gap-y-4">
            <LocalizedClientLink
              href="/"
              className={clx(
                "txt-compact-xlarge-plus uppercase transition hover:opacity-80",
                isInverseTone
                  ? "text-[var(--theme-accent-contrast)]"
                  : "text-[var(--theme-foreground)]"
              )}
            >
              {brandName}
            </LocalizedClientLink>
            <Text
              className={clx(
                "txt-small",
                isInverseTone
                  ? "text-[color:rgba(247,251,255,0.72)]"
                  : "text-[var(--theme-muted)]"
              )}
            >
              {tagline}
            </Text>
            <div
              className={clx(
                "flex flex-col gap-y-1 txt-small",
                isInverseTone
                  ? "text-[color:rgba(247,251,255,0.72)]"
                  : "text-[var(--theme-muted)]"
              )}
            >
              <a
                href={`mailto:${contactEmail}`}
                className={clx(
                  "transition",
                  isInverseTone
                    ? "hover:text-[var(--theme-accent-contrast)]"
                    : "hover:text-[var(--theme-foreground)]"
                )}
              >
                {contactEmail}
              </a>
              <a
                href={`tel:${contactPhone.replace(/[^\d+]/g, "")}`}
                className={clx(
                  "transition",
                  isInverseTone
                    ? "hover:text-[var(--theme-accent-contrast)]"
                    : "hover:text-[var(--theme-foreground)]"
                )}
              >
                {contactPhone}
              </a>
            </div>
          </div>
          <div className="text-small-regular gap-10 md:gap-x-16 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5">
            {footerColumns.map((column, index) => (
              <div className="flex flex-col gap-y-2" key={String(column.id || index)}>
                <span
                  className={clx(
                    "txt-small-plus",
                    isInverseTone ? "text-[var(--theme-accent-contrast)]" : "txt-ui-fg-base"
                  )}
                >
                  {column.title}
                </span>
                <ul
                  className={clx(
                    "grid grid-cols-1 gap-y-2 txt-small",
                    isInverseTone
                      ? "text-[color:rgba(247,251,255,0.72)]"
                      : "text-ui-fg-subtle"
                  )}
                >
                  {(column.links || []).map((item, itemIndex) => (
                    <li key={String(item.id || itemIndex)}>
                      <ContentLinkItem
                        item={item}
                        className={clx(
                          "transition",
                          isInverseTone
                            ? "hover:text-[var(--theme-accent-contrast)]"
                            : "hover:text-[var(--theme-foreground)]"
                        )}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {productCategories && productCategories?.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <span
                  className={clx(
                    "txt-small-plus",
                    isInverseTone ? "text-[var(--theme-accent-contrast)]" : "txt-ui-fg-base"
                  )}
                >
                  {footerCopy.categories}
                </span>
                <ul
                  className={clx(
                    "grid grid-cols-1 gap-2",
                    isInverseTone
                      ? "text-[color:rgba(247,251,255,0.72)]"
                      : "text-ui-fg-subtle"
                  )}
                  data-testid="footer-categories"
                >
                  {productCategories?.slice(0, categoryLinkLimit).map((c) => {
                    if (c.parent_category) {
                      return
                    }

                    const children =
                      c.category_children?.map((child) => ({
                        name: child.name,
                        handle: child.handle,
                        id: child.id,
                      })) || null

                    return (
                      <li
                        className={clx(
                          "flex flex-col gap-2 txt-small",
                          isInverseTone
                            ? "text-[color:rgba(247,251,255,0.72)]"
                            : "text-ui-fg-subtle"
                        )}
                        key={c.id}
                      >
                        <LocalizedClientLink
                          className={clx(
                            "transition",
                            children && "txt-small-plus",
                            isInverseTone
                              ? "hover:text-[var(--theme-accent-contrast)]"
                              : "hover:text-[var(--theme-foreground)]"
                          )}
                          href={`/categories/${c.handle}`}
                          data-testid="category-link"
                        >
                          {c.name}
                        </LocalizedClientLink>
                        {children && (
                          <ul className="grid grid-cols-1 ml-3 gap-2">
                            {children.map((child) => (
                              <li key={child.id}>
                                <LocalizedClientLink
                                  className={clx(
                                    "transition",
                                    isInverseTone
                                      ? "hover:text-[var(--theme-accent-contrast)]"
                                      : "hover:text-[var(--theme-foreground)]"
                                  )}
                                  href={`/categories/${child.handle}`}
                                  data-testid="category-link"
                                >
                                  {child.name}
                                </LocalizedClientLink>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            {collections && collections.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <span
                  className={clx(
                    "txt-small-plus",
                    isInverseTone ? "text-[var(--theme-accent-contrast)]" : "txt-ui-fg-base"
                  )}
                >
                  {footerCopy.collections}
                </span>
                <ul
                  className={clx(
                    "grid grid-cols-1 gap-2 txt-small",
                    isInverseTone
                      ? "text-[color:rgba(247,251,255,0.72)]"
                      : "text-ui-fg-subtle",
                    {
                      "grid-cols-2": (collections?.length || 0) > 3,
                    }
                  )}
                >
                  {collections?.slice(0, collectionLinkLimit).map((c) => (
                    <li key={c.id}>
                      <LocalizedClientLink
                        className={clx(
                          "transition",
                          isInverseTone
                            ? "hover:text-[var(--theme-accent-contrast)]"
                            : "hover:text-[var(--theme-foreground)]"
                        )}
                        href={`/collections/${c.handle}`}
                      >
                        {c.title}
                      </LocalizedClientLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {informationalLinks.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <span
                  className={clx(
                    "txt-small-plus",
                    isInverseTone ? "text-[var(--theme-accent-contrast)]" : "txt-ui-fg-base"
                  )}
                >
                  {footerCopy.information}
                </span>
                <ul
                  className={clx(
                    "grid grid-cols-1 gap-y-2 txt-small",
                    isInverseTone
                      ? "text-[color:rgba(247,251,255,0.72)]"
                      : "text-ui-fg-subtle"
                  )}
                >
                  {informationalLinks.map((item, index) => (
                    <li key={String(item.id || index)}>
                      <ContentLinkItem
                        item={item}
                        className={clx(
                          "transition",
                          isInverseTone
                            ? "hover:text-[var(--theme-accent-contrast)]"
                            : "hover:text-[var(--theme-foreground)]"
                        )}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col gap-y-2">
              <span
                className={clx(
                  "txt-small-plus",
                  isInverseTone ? "text-[var(--theme-accent-contrast)]" : "txt-ui-fg-base"
                )}
              >
                {footerCopy.customerCare}
              </span>
              <ul
                className={clx(
                  "grid grid-cols-1 gap-y-2 txt-small",
                  isInverseTone
                    ? "text-[color:rgba(247,251,255,0.72)]"
                    : "text-ui-fg-subtle"
                )}
              >
                <li>
                  <LocalizedClientLink
                    href="/account"
                    className={clx(
                      "transition",
                      isInverseTone
                        ? "hover:text-[var(--theme-accent-contrast)]"
                        : "hover:text-[var(--theme-foreground)]"
                    )}
                  >
                    {navigationCopy.account}
                  </LocalizedClientLink>
                </li>
                <li>
                  <LocalizedClientLink
                    href="/cart"
                    className={clx(
                      "transition",
                      isInverseTone
                        ? "hover:text-[var(--theme-accent-contrast)]"
                        : "hover:text-[var(--theme-foreground)]"
                    )}
                  >
                    {navigationCopy.cart}
                  </LocalizedClientLink>
                </li>
                <li>
                  <LocalizedClientLink
                    href="/store"
                    className={clx(
                      "transition",
                      isInverseTone
                        ? "hover:text-[var(--theme-accent-contrast)]"
                        : "hover:text-[var(--theme-foreground)]"
                    )}
                  >
                    {navigationCopy.catalog}
                  </LocalizedClientLink>
                </li>
              </ul>
            </div>
            <div className="flex flex-col gap-y-2">
              <span
                className={clx(
                  "txt-small-plus",
                  isInverseTone ? "text-[var(--theme-accent-contrast)]" : "txt-ui-fg-base"
                )}
              >
                {footerCopy.social}
              </span>
              <ul
                className={clx(
                  "grid grid-cols-1 gap-y-2 txt-small",
                  isInverseTone
                    ? "text-[color:rgba(247,251,255,0.72)]"
                    : "text-ui-fg-subtle"
                )}
              >
                {socialLinks.length > 0
                  ? socialLinks.map((link, index) => (
                      <li key={String(link.id || index)}>
                        <ContentLinkItem
                          item={link}
                          className={clx(
                            "transition",
                            isInverseTone
                              ? "hover:text-[var(--theme-accent-contrast)]"
                              : "hover:text-[var(--theme-foreground)]"
                          )}
                        />
                      </li>
                    ))
                  : storefrontConfig.socialLinks.map((link) => (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className={clx(
                            "transition",
                            isInverseTone
                              ? "hover:text-[var(--theme-accent-contrast)]"
                              : "hover:text-[var(--theme-foreground)]"
                          )}
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
              </ul>
            </div>
          </div>
        </div>
        <div
          className={clx(
            "flex w-full justify-between gap-4 px-2 pt-6 flex-col small:flex-row",
            isInverseTone
              ? "text-[color:rgba(247,251,255,0.72)]"
              : "text-[var(--theme-muted)]"
          )}
          style={isEditorial ? undefined : { marginBottom: "4rem" }}
        >
          <Text className="txt-compact-small">
            © {new Date().getFullYear()} {brandName}.{" "}
            {commonCopy.allRightsReserved}
          </Text>
          <MedusaCTA />
        </div>
      </div>
    </footer>
  )
}
