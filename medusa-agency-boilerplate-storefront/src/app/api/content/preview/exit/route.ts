import crypto from 'node:crypto'
import { draftMode } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { PAYLOAD_PREVIEW_SECRET } from '@lib/env'

const encoder = new TextEncoder()

const hasValidExitSignature = (params: {
  redirect: string
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
    redirect: params.redirect,
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

const redirectToTarget = (request: NextRequest, redirectTo?: string | null) => {
  const redirectPath = redirectTo && redirectTo.startsWith('/') ? redirectTo : '/'

  return NextResponse.redirect(new URL(redirectPath, request.nextUrl.origin))
}

export async function GET(request: NextRequest) {
  const redirectTo = request.nextUrl.searchParams.get('redirect') || '/'
  const exp = request.nextUrl.searchParams.get('exp') || ''
  const sig = request.nextUrl.searchParams.get('sig') || ''

  if (!hasValidExitSignature({ redirect: redirectTo, exp, sig })) {
    return NextResponse.json({ message: 'Invalid preview exit signature.' }, { status: 401 })
  }

  const draft = await draftMode()
  draft.disable()

  return redirectToTarget(request, redirectTo)
}

export async function POST(request: NextRequest) {
  const draft = await draftMode()
  draft.disable()

  return redirectToTarget(request, request.nextUrl.searchParams.get('redirect'))
}
