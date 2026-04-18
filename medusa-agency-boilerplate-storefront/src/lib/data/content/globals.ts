import 'server-only'
import { PAYLOAD_CONTENT_TAGS } from '@lib/content/constants'
import {
  ContentFooter,
  ContentNavigation,
  ContentSiteSettings,
} from '@lib/content/types'
import { fetchPayloadAPI } from './client'

export const getSiteSettings = async () =>
  fetchPayloadAPI<ContentSiteSettings>('/globals/siteSettings', {
    searchParams: {
      depth: 2,
    },
    tags: [
      PAYLOAD_CONTENT_TAGS.all,
      PAYLOAD_CONTENT_TAGS.globals,
      PAYLOAD_CONTENT_TAGS.global('siteSettings'),
    ],
  })

export const getNavigation = async () =>
  fetchPayloadAPI<ContentNavigation>('/globals/navigation', {
    searchParams: {
      depth: 1,
    },
    tags: [
      PAYLOAD_CONTENT_TAGS.all,
      PAYLOAD_CONTENT_TAGS.globals,
      PAYLOAD_CONTENT_TAGS.global('navigation'),
    ],
  })

export const getFooter = async () =>
  fetchPayloadAPI<ContentFooter>('/globals/footer', {
    searchParams: {
      depth: 1,
    },
    tags: [
      PAYLOAD_CONTENT_TAGS.all,
      PAYLOAD_CONTENT_TAGS.globals,
      PAYLOAD_CONTENT_TAGS.global('footer'),
    ],
  })
