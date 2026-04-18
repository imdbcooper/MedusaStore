import { revalidatePath, revalidateTag } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { PAYLOAD_CONTENT_TAGS } from '@lib/content/constants'
import { DEFAULT_REGION, PAYLOAD_REVALIDATE_SECRET } from '@lib/env'

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-revalidate-secret')

  if (!PAYLOAD_REVALIDATE_SECRET || secret !== PAYLOAD_REVALIDATE_SECRET) {
    return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const collection = typeof body.collection === 'string' ? body.collection : ''
  const slug = typeof body.slug === 'string' ? body.slug : ''
  const path = typeof body.path === 'string' ? body.path : '/'

  revalidateTag(PAYLOAD_CONTENT_TAGS.all)

  if (collection === 'pages') {
    revalidateTag(PAYLOAD_CONTENT_TAGS.pages)

    if (slug) {
      revalidateTag(PAYLOAD_CONTENT_TAGS.page(slug))
    }
  }

  if (collection === 'posts') {
    revalidateTag(PAYLOAD_CONTENT_TAGS.posts)

    if (slug) {
      revalidateTag(PAYLOAD_CONTENT_TAGS.post(slug))
    }
  }

  if (collection === 'globals') {
    revalidateTag(PAYLOAD_CONTENT_TAGS.globals)

    if (slug) {
      revalidateTag(PAYLOAD_CONTENT_TAGS.global(slug))
    }
  }

  const localizedPath = `/${DEFAULT_REGION}${path === '/' ? '' : path}`
  revalidatePath(localizedPath)

  return NextResponse.json({ revalidated: true, collection, slug, path: localizedPath })
}
