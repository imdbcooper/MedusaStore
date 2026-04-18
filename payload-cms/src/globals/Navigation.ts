import type { GlobalConfig } from 'payload'
import { contentLinkField } from '../fields/link.ts'
import { triggerStorefrontRevalidation } from '../lib/revalidate.ts'

export const Navigation: GlobalConfig = {
  slug: 'navigation',
  access: {
    read: () => true,
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
