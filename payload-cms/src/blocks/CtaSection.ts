import type { Block } from 'payload'
import { contentLinkField } from '../fields/link.ts'

export const CtaSectionBlock: Block = {
  slug: 'ctaSection',
  interfaceName: 'CtaSectionBlock',
  fields: [
    {
      name: 'heading',
      type: 'text',
      required: true,
    },
    {
      name: 'body',
      type: 'textarea',
    },
    {
      name: 'theme',
      type: 'select',
      defaultValue: 'default',
      options: [
        { label: 'Default', value: 'default' },
        { label: 'Accent', value: 'accent' },
      ],
      required: true,
    },
    {
      name: 'actions',
      type: 'array',
      fields: [contentLinkField()],
    },
  ],
}
