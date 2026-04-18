import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getSiteSettings } from '@lib/data/content/globals'
import { getContentPageBySlug } from '@lib/data/content/pages'
import { isReservedContentPath } from '@lib/content/links'
import { buildContentMetadata } from '@lib/content/metadata'
import { PAYLOAD_ENABLED } from '@lib/env'
import ContentPageTemplate from '@modules/content/templates/content-page'

type Props = {
  params: Promise<{ countryCode: string; slug: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { countryCode, slug } = await props.params

  if (isReservedContentPath([slug])) {
    notFound()
  }

  const [page, siteSettings] = await Promise.all([
    getContentPageBySlug(slug),
    getSiteSettings(),
  ])

  if (!page) {
    notFound()
  }

  return buildContentMetadata({
    title: page.title,
    description: page.excerpt,
    seo: page.seo,
    siteSettings,
    path: `/${countryCode}/${slug}`,
  })
}

export default async function ContentPage(props: Props) {
  if (!PAYLOAD_ENABLED) {
    notFound()
  }

  const { slug } = await props.params

  if (isReservedContentPath([slug])) {
    notFound()
  }

  const page = await getContentPageBySlug(slug)

  if (!page) {
    notFound()
  }

  return <ContentPageTemplate page={page} />
}
