import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSiteSettings } from '@lib/data/content/globals'
import { getContentPostBySlug } from '@lib/data/content/posts'
import { buildContentMetadata } from '@lib/content/metadata'
import { PAYLOAD_ENABLED } from '@lib/env'
import ContentPostTemplate from '@modules/content/templates/post-page'

type Props = {
  params: Promise<{ countryCode: string; slug: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { countryCode, slug } = await props.params
  const [post, siteSettings] = await Promise.all([
    getContentPostBySlug(slug),
    getSiteSettings(),
  ])

  if (!post) {
    notFound()
  }

  return buildContentMetadata({
    title: post.title,
    description: post.excerpt,
    seo: post.seo,
    image: post.coverImage,
    siteSettings,
    path: `/${countryCode}/news/${slug}`,
  })
}

export default async function NewsArticlePage(props: Props) {
  if (!PAYLOAD_ENABLED) {
    notFound()
  }

  const { slug } = await props.params
  const post = await getContentPostBySlug(slug)

  if (!post) {
    notFound()
  }

  return <ContentPostTemplate post={post} />
}
