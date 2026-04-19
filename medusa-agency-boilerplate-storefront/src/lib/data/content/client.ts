import 'server-only'
import { draftMode } from 'next/headers'
import {
  PAYLOAD_CMS_URL,
  PAYLOAD_CONTENT_PREVIEW_TOKEN,
  PAYLOAD_ENABLED,
} from '@lib/env'
import { DEFAULT_CONTENT_REVALIDATE_SECONDS } from '@lib/content/constants'

type FetchPayloadAPIOptions = {
  draft?: boolean
  tags?: string[]
  searchParams?: Record<string, string | number | boolean | null | undefined>
}

export const isPayloadConfigured = () => PAYLOAD_ENABLED && Boolean(PAYLOAD_CMS_URL)

export const toAbsolutePayloadURL = (value?: string | null) => {
  if (!value) {
    return null
  }

  if (/^https?:\/\//i.test(value)) {
    return value
  }

  if (!PAYLOAD_CMS_URL) {
    return value
  }

  return new URL(value, PAYLOAD_CMS_URL).toString()
}

export async function fetchPayloadAPI<T>(
  path: string,
  options: FetchPayloadAPIOptions = {}
): Promise<T | null> {
  if (!isPayloadConfigured()) {
    return null
  }

  const draftState = await draftMode()
  const isDraft = options.draft ?? draftState.isEnabled
  const url = new URL(`/api${path.startsWith('/') ? path : `/${path}`}`, PAYLOAD_CMS_URL)

  Object.entries(options.searchParams || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })

  if (isDraft) {
    url.searchParams.set('draft', 'true')
  }

  const headers: HeadersInit = {
    accept: 'application/json',
  }

  if (isDraft && PAYLOAD_CONTENT_PREVIEW_TOKEN) {
    headers['x-payload-preview-token'] = PAYLOAD_CONTENT_PREVIEW_TOKEN
  }

  try {
    const response = await fetch(url, isDraft
      ? {
          cache: 'no-store',
          headers,
        }
      : {
          cache: 'force-cache',
          headers,
          next: {
            revalidate: DEFAULT_CONTENT_REVALIDATE_SECONDS,
            tags: options.tags || [],
          },
        })

    if (!response.ok) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`Payload request failed: ${response.status} ${url.toString()}`)
      }

      return null
    }

    return (await response.json()) as T
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error(
        `Payload request failed with network error: ${url.toString()}`,
        error
      )
    }

    return null
  }
}
