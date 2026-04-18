import crypto from 'node:crypto'

type PreviewInput = {
  collection: 'pages' | 'posts'
  slug?: string | null
}

const getLocalePrefix = () => {
  const locale = process.env.STOREFRONT_PREVIEW_LOCALE?.trim()
  return locale ? `/${locale.replace(/^\/+|\/+$/g, '')}` : ''
}

const getDocumentPath = ({ collection, slug }: PreviewInput) => {
  if (collection === 'posts') {
    return `${getLocalePrefix()}/news/${slug || ''}`.replace(/\/+$/g, '')
  }

  if (!slug || slug === 'home') {
    return getLocalePrefix() || '/'
  }

  return `${getLocalePrefix()}/${slug}`
}

export const buildPreviewURL = ({ collection, slug }: PreviewInput) => {
  const storefrontURL = process.env.STOREFRONT_PREVIEW_URL
  const secret = process.env.PAYLOAD_PREVIEW_SECRET || process.env.PAYLOAD_SECRET

  if (!storefrontURL || !secret) {
    return storefrontURL || '/'
  }

  const path = getDocumentPath({ collection, slug })
  const exp = Date.now() + 5 * 60 * 1000
  const payload = JSON.stringify({ collection, slug, path, exp })
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  const url = new URL('/api/content/preview', storefrontURL)

  url.searchParams.set('collection', collection)
  url.searchParams.set('slug', slug || '')
  url.searchParams.set('path', path)
  url.searchParams.set('exp', String(exp))
  url.searchParams.set('sig', sig)

  return url.toString()
}
