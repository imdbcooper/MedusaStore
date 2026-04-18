import crypto from 'node:crypto'
import { draftMode } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { PAYLOAD_PREVIEW_SECRET } from '@lib/env'

const encoder = new TextEncoder()

const hasValidSignature = (params: {
  collection: string
  slug: string
  path: string
  exp: string
  sig: string
}) => {
  if (!PAYLOAD_PREVIEW_SECRET) {
    return false
  }

  const expiration = Number(params.exp)

  if (!expiration || expiration < Date.now()) {
    return false
  }

  const payload = JSON.stringify({
    collection: params.collection,
    slug: params.slug,
    path: params.path,
    exp: expiration,
  })

  const expected = crypto
    .createHmac('sha256', PAYLOAD_PREVIEW_SECRET)
    .update(payload)
    .digest('hex')

  if (expected.length !== params.sig.length) {
    return false
  }

  return crypto.timingSafeEqual(
    encoder.encode(expected),
    encoder.encode(params.sig)
  )
}

export async function GET(request: NextRequest) {
  const collection = request.nextUrl.searchParams.get('collection') || ''
  const slug = request.nextUrl.searchParams.get('slug') || ''
  const path = request.nextUrl.searchParams.get('path') || '/'
  const exp = request.nextUrl.searchParams.get('exp') || ''
  const sig = request.nextUrl.searchParams.get('sig') || ''

  const isAllowedCollection = collection === 'pages' || collection === 'posts'

  if (!isAllowedCollection || !hasValidSignature({ collection, slug, path, exp, sig })) {
    return NextResponse.json({ message: 'Invalid preview signature.' }, { status: 401 })
  }

  const draft = await draftMode()
  draft.enable()

  const redirectPath = path.startsWith('/') ? path : '/'

  return NextResponse.redirect(new URL(redirectPath, request.nextUrl.origin))
}
