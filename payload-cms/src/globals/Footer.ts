import type { GlobalConfig } from 'payload'
import { publishedOrPreviewAccess } from '../access/publishedOrPreview.ts'
import { contentLinkField } from '../fields/link.ts'
import { triggerStorefrontRevalidation } from '../lib/revalidate.ts'

export const Footer: GlobalConfig = {
  slug: 'footer',
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
          slug: 'footer',
          operation: 'update',
        })
      },
    ],
  },
  fields: [
    {
      name: 'contactEmail',
      type: 'text',
    },
    {
      name: 'contactPhone',
      type: 'text',
    },
    {
      name: 'columns',
      type: 'array',
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
        },
        {
          name: 'links',
          type: 'array',
          fields: [contentLinkField()],
        },
      ],
    },
    {
      name: 'socialLinks',
      type: 'array',
      fields: [contentLinkField('link', 'Social link')],
    },
  ],
}
