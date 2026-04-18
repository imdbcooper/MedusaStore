import type { FieldHook, TextField } from 'payload'

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s-]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

const formatSlug: FieldHook = ({ data, operation, value }) => {
  if (typeof value === 'string' && value.trim()) {
    return slugify(value)
  }

  if (operation === 'create' || operation === 'update') {
    const fallback = data?.title || data?.name

    if (typeof fallback === 'string' && fallback.trim()) {
      return slugify(fallback)
    }
  }

  return value
}

export const slugField: TextField = {
  name: 'slug',
  type: 'text',
  index: true,
  unique: true,
  required: true,
  admin: {
    position: 'sidebar' as const,
  },
  hooks: {
    beforeValidate: [formatSlug],
  },
}
