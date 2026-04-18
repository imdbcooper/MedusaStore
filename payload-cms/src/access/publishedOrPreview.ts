import type { Access } from 'payload'

const getHeader = (req: any, key: string) => {
  if (typeof req?.headers?.get === 'function') {
    return req.headers.get(key)
  }

  const value = req?.headers?.[key]
  return Array.isArray(value) ? value[0] : value
}

export const isPreviewRequest = (req: any) => {
  const previewToken = process.env.PAYLOAD_CONTENT_PREVIEW_TOKEN
  const header = getHeader(req, 'x-payload-preview-token')

  return Boolean(previewToken && header && header === previewToken)
}

export const publishedOrPreviewAccess: Access = ({ req }) => {
  if (req.user || isPreviewRequest(req)) {
    return true
  }

  return {
    _status: {
      equals: 'published',
    },
  }
}
