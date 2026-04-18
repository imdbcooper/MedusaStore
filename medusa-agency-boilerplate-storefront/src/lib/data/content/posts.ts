import 'server-only'
import { PAYLOAD_CONTENT_TAGS } from '@lib/content/constants'
import { ContentPost } from '@lib/content/types'
import { fetchPayloadAPI } from './client'

type PayloadDocsResponse<T> = {
  docs?: T[]
}

export const listContentPosts = async (limit = 12) => {
  const response = await fetchPayloadAPI<PayloadDocsResponse<ContentPost>>('/posts', {
    searchParams: {
      depth: 2,
      limit,
      sort: '-publishedAt',
    },
    tags: [PAYLOAD_CONTENT_TAGS.all, PAYLOAD_CONTENT_TAGS.posts],
  })

  return response?.docs || []
}

export const getContentPostBySlug = async (slug: string) => {
  const response = await fetchPayloadAPI<PayloadDocsResponse<ContentPost>>('/posts', {
    searchParams: {
      limit: 1,
      depth: 2,
      'where[slug][equals]': slug,
    },
    tags: [
      PAYLOAD_CONTENT_TAGS.all,
      PAYLOAD_CONTENT_TAGS.posts,
      PAYLOAD_CONTENT_TAGS.post(slug),
    ],
  })

  return response?.docs?.[0] || null
}
