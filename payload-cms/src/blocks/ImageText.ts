import type { Block } from 'payload'
import { contentLinkField } from '../fields/link.ts'

export const ImageTextBlock: Block = {
  slug: 'imageText',
  interfaceName: 'ImageTextBlock',
  fields: [
    {
      name: 'layout',
      type: 'select',
      defaultValue: 'imageLeft',
      options: [
        { label: 'Image left', value: 'imageLeft' },
        { label: 'Image right', value: 'imageRight' },
      ],
      required: true,
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'body',
      type: 'richText',
    },
    {
      name: 'actions',
      type: 'array',
      fields: [contentLinkField()],
    },
  ],
}
