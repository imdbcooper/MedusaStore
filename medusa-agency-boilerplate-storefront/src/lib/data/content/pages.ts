import 'server-only'
import { PAYLOAD_CONTENT_TAGS } from '@lib/content/constants'
import { ContentPage } from '@lib/content/types'
import { fetchPayloadAPI } from './client'

type PayloadDocsResponse<T> = {
  docs?: T[]
}

export const getContentPageBySlug = async (slug: string) => {
  const response = await fetchPayloadAPI<PayloadDocsResponse<ContentPage>>('/pages', {
    searchParams: {
      limit: 1,
      depth: 2,
      'where[slug][equals]': slug,
    },
    tags: [
      PAYLOAD_CONTENT_TAGS.all,
      PAYLOAD_CONTENT_TAGS.pages,
      PAYLOAD_CONTENT_TAGS.page(slug),
    ],
  })

  return response?.docs?.[0] || null
}
