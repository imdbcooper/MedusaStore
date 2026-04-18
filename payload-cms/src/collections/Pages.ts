import type { CollectionConfig, TextField } from 'payload'
import { publishedOrPreviewAccess } from '../access/publishedOrPreview.ts'
import { CtaSectionBlock } from '../blocks/CtaSection.ts'
import { FaqBlock } from '../blocks/Faq.ts'
import { HeroBannerBlock } from '../blocks/HeroBanner.ts'
import { ImageTextBlock } from '../blocks/ImageText.ts'
import { RichTextBlock } from '../blocks/RichText.ts'
import { seoFields } from '../fields/seo.ts'
import { slugField } from '../fields/slug.ts'
import { buildPreviewURL } from '../lib/preview.ts'
import { triggerStorefrontRevalidation } from '../lib/revalidate.ts'
import { RESERVED_PAGE_SLUGS } from '../lib/reservedSlugs.ts'

const pageSlugField: TextField = {
  name: slugField.name,
  type: 'text',
  index: slugField.index,
  unique: slugField.unique,
  required: slugField.required,
  admin: slugField.admin,
  hooks: slugField.hooks,
  validate: (value: string | null | undefined) => {
    if (typeof value !== 'string' || !value.trim()) {
      return 'Slug is required.'
    }

    if (RESERVED_PAGE_SLUGS.has(value.trim().toLowerCase())) {
      return 'This slug is reserved by storefront commerce routes.'
    }

    return true
  },
}

export const Pages: CollectionConfig = {
  slug: 'pages',
  access: {
    read: publishedOrPreviewAccess,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'updatedAt'],
    livePreview: {
      url: ({ data }) =>
        buildPreviewURL({ collection: 'pages', slug: data?.slug as string | null }),
    },
    preview: (data) =>
      buildPreviewURL({ collection: 'pages', slug: data?.slug as string | null }),
  },
  versions: {
    drafts: true,
  },
  hooks: {
    afterChange: [
      async ({ doc, operation }) => {
        await triggerStorefrontRevalidation({
          collection: 'pages',
          slug: doc.slug,
          operation,
        })
      },
    ],
    afterDelete: [
      async ({ doc }) => {
        await triggerStorefrontRevalidation({
          collection: 'pages',
          slug: doc?.slug,
          operation: 'delete',
        })
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    pageSlugField,
    {
      name: 'pageType',
      type: 'select',
      defaultValue: 'marketing',
      options: [
        { label: 'Marketing', value: 'marketing' },
        { label: 'Informational', value: 'informational' },
      ],
      required: true,
    },
    {
      name: 'excerpt',
      type: 'textarea',
    },
    {
      name: 'layout',
      type: 'blocks',
      required: true,
      blocks: [
        HeroBannerBlock,
        RichTextBlock,
        ImageTextBlock,
        CtaSectionBlock,
        FaqBlock,
      ],
    },
    ...seoFields,
  ],
}
