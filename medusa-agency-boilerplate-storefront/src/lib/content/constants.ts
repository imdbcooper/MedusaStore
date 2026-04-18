export const DEFAULT_CONTENT_REVALIDATE_SECONDS = 60

export const PAYLOAD_CONTENT_TAGS = {
  all: 'content',
  globals: 'content:globals',
  pages: 'content:pages',
  posts: 'content:posts',
  page: (slug: string) => `content:page:${slug}`,
  post: (slug: string) => `content:post:${slug}`,
  global: (slug: string) => `content:global:${slug}`,
}

export const RESERVED_CONTENT_SEGMENTS = new Set([
  'account',
  'cart',
  'categories',
  'checkout',
  'collections',
  'news',
  'order',
  'products',
  'store',
])
