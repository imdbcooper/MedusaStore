import {
  ContentLink,
  ContentLinkRow,
} from "./types"
import { RESERVED_CONTENT_SEGMENTS } from "./constants"

const isContentLinkRow = (
  value: ContentLink | ContentLinkRow
): value is ContentLinkRow => "link" in value

export const INFORMATIONAL_PAGE_LINKS: ContentLinkRow[] = [
  {
    id: "fallback-about",
    link: {
      type: "page",
      label: "О нас",
      pageSlug: "about",
    },
  },
  {
    id: "fallback-promotions",
    link: {
      type: "page",
      label: "Акции",
      pageSlug: "promotions",
    },
  },
  {
    id: "fallback-delivery-and-payment",
    link: {
      type: "page",
      label: "Доставка и оплата",
      pageSlug: "delivery-and-payment",
    },
  },
  {
    id: "fallback-contacts",
    link: {
      type: "page",
      label: "Контакты",
      pageSlug: "contacts",
    },
  },
]

export const unwrapContentLink = (
  value?: ContentLink | ContentLinkRow | null
): ContentLink | null => {
  if (!value) {
    return null
  }

  if (isContentLinkRow(value)) {
    return value.link || null
  }

  return value
}

export const isExternalHref = (href: string) => /^https?:\/\//i.test(href)

const normalizeCustomPath = (value: string) => {
  if (isExternalHref(value)) {
    return value
  }

  return value.startsWith("/") ? value : `/${value}`
}

export const normalizePageSlug = (slug?: string | null) => {
  const normalized = slug?.trim().replace(/^\/+|\/+$/g, "")

  if (!normalized || normalized === "home") {
    return "/"
  }

  return `/${normalized}`
}

export const resolveContentLinkHref = (
  value?: ContentLink | ContentLinkRow | null
) => {
  const link = unwrapContentLink(value)

  if (!link) {
    return null
  }

  switch (link.type) {
    case "page":
      return normalizePageSlug(link.pageSlug)
    case "post":
      return link.postSlug ? `/news/${link.postSlug}` : null
    case "product":
      return link.productHandle ? `/products/${link.productHandle}` : null
    case "collection":
      return link.collectionHandle ? `/collections/${link.collectionHandle}` : null
    case "category":
      return link.categoryHandle ? `/categories/${link.categoryHandle}` : null
    case "custom":
    default:
      return link.url ? normalizeCustomPath(link.url) : null
  }
}

export const appendFallbackContentLinks = (
  items: ContentLinkRow[] = [],
  fallbackItems: ContentLinkRow[] = INFORMATIONAL_PAGE_LINKS
) => {
  const seenHrefs = new Set(
    items
      .map((item) => resolveContentLinkHref(item))
      .filter((href): href is string => Boolean(href))
  )

  const missingFallbackItems = fallbackItems.filter((item) => {
    const href = resolveContentLinkHref(item)

    if (!href || seenHrefs.has(href)) {
      return false
    }

    seenHrefs.add(href)
    return true
  })

  return [...items, ...missingFallbackItems]
}

export const isReservedContentPath = (segments: string[]) => {
  const [first] = segments

  if (!first) {
    return false
  }

  return RESERVED_CONTENT_SEGMENTS.has(first.toLowerCase())
}
