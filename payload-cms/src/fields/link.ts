import type { Field } from 'payload'

export const contentLinkField = (name = 'link', label = 'Link'): Field => ({
  name,
  label,
  type: 'group',
  fields: [
    {
      name: 'type',
      type: 'select',
      defaultValue: 'custom',
      options: [
        { label: 'Custom URL', value: 'custom' },
        { label: 'Page slug', value: 'page' },
        { label: 'Post slug', value: 'post' },
        { label: 'Product handle', value: 'product' },
        { label: 'Collection handle', value: 'collection' },
        { label: 'Category handle', value: 'category' },
      ],
      required: true,
    },
    {
      name: 'label',
      type: 'text',
      required: true,
    },
    {
      name: 'url',
      type: 'text',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'custom',
      },
    },
    {
      name: 'pageSlug',
      type: 'text',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'page',
      },
    },
    {
      name: 'postSlug',
      type: 'text',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'post',
      },
    },
    {
      name: 'productHandle',
      type: 'text',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'product',
      },
    },
    {
      name: 'collectionHandle',
      type: 'text',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'collection',
      },
    },
    {
      name: 'categoryHandle',
      type: 'text',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'category',
      },
    },
    {
      name: 'newTab',
      type: 'checkbox',
      defaultValue: false,
    },
  ],
})
