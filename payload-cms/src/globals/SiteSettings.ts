import type { GlobalConfig } from 'payload'
import { publishedOrPreviewAccess } from '../access/publishedOrPreview.ts'
import { seoFields } from '../fields/seo.ts'
import { triggerStorefrontRevalidation } from '../lib/revalidate.ts'

export const SiteSettings: GlobalConfig = {
  slug: 'siteSettings',
  access: {
    read: publishedOrPreviewAccess,
  },
  versions: {
    drafts: true,
  },
  hooks: {
    afterChange: [
      async () => {
        await triggerStorefrontRevalidation({
          collection: 'globals',
          slug: 'siteSettings',
          operation: 'update',
        })
      },
    ],
  },
  fields: [
    {
      name: 'siteName',
      type: 'text',
      required: true,
    },
    {
      name: 'tagline',
      type: 'text',
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
    },
    ...seoFields,
  ],
}
