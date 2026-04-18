export type ContentMedia = {
  id?: string | number
  url?: string | null
  alt?: string | null
  caption?: string | null
  width?: number | null
  height?: number | null
}

export type ContentSEO = {
  title?: string | null
  description?: string | null
  image?: ContentMedia | null
}

export type ContentLink = {
  type?: 'custom' | 'page' | 'post' | 'product' | 'collection' | 'category'
  label?: string | null
  url?: string | null
  pageSlug?: string | null
  postSlug?: string | null
  productHandle?: string | null
  collectionHandle?: string | null
  categoryHandle?: string | null
  newTab?: boolean | null
}

export type ContentLinkRow = {
  id?: string | number
  link?: ContentLink | null
}

export type ContentRichTextNode = {
  type?: string
  tag?: string
  text?: string
  format?: number | string
  url?: string
  listType?: 'bullet' | 'number' | string
  children?: ContentRichTextNode[]
  fields?: {
    url?: string
    newTab?: boolean
  }
}

export type ContentRichTextValue =
  | {
      root?: {
        children?: ContentRichTextNode[]
      }
    }
  | ContentRichTextNode[]
  | null
  | undefined

export type HeroBannerBlock = {
  id?: string
  blockType: 'heroBanner'
  eyebrow?: string | null
  heading?: string | null
  body?: string | null
  backgroundImage?: ContentMedia | null
  actions?: ContentLinkRow[] | null
}

export type RichTextBlock = {
  id?: string
  blockType: 'richText'
  content?: ContentRichTextValue
}

export type ImageTextBlock = {
  id?: string
  blockType: 'imageText'
  layout?: 'imageLeft' | 'imageRight' | null
  image?: ContentMedia | null
  title?: string | null
  body?: ContentRichTextValue
  actions?: ContentLinkRow[] | null
}

export type CtaSectionBlock = {
  id?: string
  blockType: 'ctaSection'
  heading?: string | null
  body?: string | null
  theme?: 'default' | 'accent' | null
  actions?: ContentLinkRow[] | null
}

export type FaqItem = {
  id?: string
  question?: string | null
  answer?: ContentRichTextValue
}

export type FaqBlock = {
  id?: string
  blockType: 'faq'
  heading?: string | null
  items?: FaqItem[] | null
}

export type ContentBlock =
  | HeroBannerBlock
  | RichTextBlock
  | ImageTextBlock
  | CtaSectionBlock
  | FaqBlock

export type ContentPage = {
  id?: string | number
  title?: string | null
  slug?: string | null
  pageType?: 'marketing' | 'informational' | null
  excerpt?: string | null
  seo?: ContentSEO | null
  layout?: ContentBlock[] | null
}

export type ContentPost = {
  id?: string | number
  title?: string | null
  slug?: string | null
  excerpt?: string | null
  publishedAt?: string | null
  coverImage?: ContentMedia | null
  seo?: ContentSEO | null
  layout?: ContentBlock[] | null
}

export type ContentSiteSettings = {
  siteName?: string | null
  tagline?: string | null
  logo?: ContentMedia | null
  seo?: ContentSEO | null
}

export type ContentNavigation = {
  items?: ContentLinkRow[] | null
}

export type ContentFooterColumn = {
  id?: string
  title?: string | null
  links?: ContentLinkRow[] | null
}

export type ContentFooter = {
  contactEmail?: string | null
  contactPhone?: string | null
  columns?: ContentFooterColumn[] | null
  socialLinks?: ContentLinkRow[] | null
}
