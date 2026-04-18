import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSiteSettings } from '@lib/data/content/globals'
import { listContentPosts } from '@lib/data/content/posts'
import { buildContentMetadata } from '@lib/content/metadata'
import { PAYLOAD_ENABLED } from '@lib/env'
import ContentPostListTemplate from '@modules/content/templates/post-list'

type Props = {
  params: Promise<{ countryCode: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { countryCode } = await props.params
  const siteSettings = await getSiteSettings()

  return buildContentMetadata({
    title: 'Новости и статьи',
    description: 'Editorial surface для публикаций из Payload CMS.',
    siteSettings,
    path: `/${countryCode}/news`,
  })
}

export default async function NewsPage() {
  if (!PAYLOAD_ENABLED) {
    notFound()
  }

  const posts = await listContentPosts()

  return <ContentPostListTemplate posts={posts} />
}
