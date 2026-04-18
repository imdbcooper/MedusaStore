import { Metadata } from 'next'
import { storefrontConfig } from '@lib/storefront-config'
import { toAbsolutePayloadURL } from '@lib/data/content/client'
import {
  ContentMedia,
  ContentSEO,
  ContentSiteSettings,
} from './types'

type BuildContentMetadataArgs = {
  title?: string | null
  description?: string | null
  seo?: ContentSEO | null
  siteSettings?: ContentSiteSettings | null
  path: string
  image?: ContentMedia | null
}

const resolveImageURL = (image?: ContentMedia | null) =>
  toAbsolutePayloadURL(image?.url || null) || undefined

export const buildContentMetadata = ({
  title,
  description,
  seo,
  siteSettings,
  path,
  image,
}: BuildContentMetadataArgs): Metadata => {
  const resolvedTitle = seo?.title || title || siteSettings?.siteName || storefrontConfig.defaultTitle
  const resolvedDescription =
    seo?.description ||
    description ||
    siteSettings?.seo?.description ||
    storefrontConfig.defaultDescription
  const resolvedImage =
    resolveImageURL(seo?.image) ||
    resolveImageURL(image) ||
    resolveImageURL(siteSettings?.seo?.image)

  return {
    title: resolvedTitle,
    description: resolvedDescription,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: resolvedTitle,
      description: resolvedDescription,
      url: path,
      images: resolvedImage ? [resolvedImage] : undefined,
    },
  }
}
