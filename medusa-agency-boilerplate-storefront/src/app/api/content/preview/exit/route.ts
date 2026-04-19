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

type ExitSignatureParams = {
  redirect: string
  exp: string
  sig: string
}

const getSignedExitParamsFromQuery = (
  request: NextRequest
): ExitSignatureParams => ({
  redirect: request.nextUrl.searchParams.get('redirect') || '/',
  exp: request.nextUrl.searchParams.get('exp') || '',
  sig: request.nextUrl.searchParams.get('sig') || '',
})

const getSignedExitParamsFromBody = async (
  request: NextRequest
): Promise<ExitSignatureParams> => {
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => ({} as Record<string, unknown>))

    return {
      redirect: typeof body.redirect === 'string' ? body.redirect : '/',
      exp: typeof body.exp === 'string' ? body.exp : '',
      sig: typeof body.sig === 'string' ? body.sig : '',
    }
  }

  const formData = await request.formData().catch(() => null)

  return {
    redirect: typeof formData?.get('redirect') === 'string'
      ? String(formData?.get('redirect'))
      : '/',
    exp: typeof formData?.get('exp') === 'string' ? String(formData?.get('exp')) : '',
    sig: typeof formData?.get('sig') === 'string' ? String(formData?.get('sig')) : '',
  }
}

export async function GET(request: NextRequest) {
  const signedParams = getSignedExitParamsFromQuery(request)

  if (!hasValidExitSignature(signedParams)) {
    return NextResponse.json({ message: 'Invalid preview exit signature.' }, { status: 401 })
  }

  const draft = await draftMode()
  draft.disable()

  return redirectToTarget(request, signedParams.redirect)
}

export async function POST(request: NextRequest) {
  const signedParams =
    request.nextUrl.searchParams.has('sig') || request.nextUrl.searchParams.has('exp')
      ? getSignedExitParamsFromQuery(request)
      : await getSignedExitParamsFromBody(request)

  if (!hasValidExitSignature(signedParams)) {
    return NextResponse.json({ message: 'Invalid preview exit signature.' }, { status: 401 })
  }

  const draft = await draftMode()
  draft.disable()

  return redirectToTarget(request, signedParams.redirect)
}
