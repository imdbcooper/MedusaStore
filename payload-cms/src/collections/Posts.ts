import type { CollectionConfig } from 'payload'
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

export const Posts: CollectionConfig = {
  slug: 'posts',
  access: {
    read: publishedOrPreviewAccess,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'publishedAt', 'updatedAt'],
    livePreview: {
      url: ({ data }) =>
        buildPreviewURL({ collection: 'posts', slug: data?.slug as string | null }),
    },
    preview: (data) =>
      buildPreviewURL({ collection: 'posts', slug: data?.slug as string | null }),
  },
  versions: {
    drafts: true,
  },
  hooks: {
    afterChange: [
      async ({ doc, operation }) => {
        await triggerStorefrontRevalidation({
          collection: 'posts',
          slug: doc.slug,
          operation,
        })
      },
    ],
    afterDelete: [
      async ({ doc }) => {
        await triggerStorefrontRevalidation({
          collection: 'posts',
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
    slugField,
    {
      name: 'excerpt',
      type: 'textarea',
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
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
