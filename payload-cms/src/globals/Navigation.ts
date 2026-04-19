import type { GlobalConfig } from 'payload'
import { publishedOrPreviewAccess } from '../access/publishedOrPreview.ts'
import { contentLinkField } from '../fields/link.ts'
import { triggerStorefrontRevalidation } from '../lib/revalidate.ts'

export const Navigation: GlobalConfig = {
  slug: 'navigation',
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
          slug: 'navigation',
          operation: 'update',
        })
      },
    ],
  },
  fields: [
    {
      name: 'items',
      type: 'array',
      fields: [contentLinkField()],
    },
  ],
}
