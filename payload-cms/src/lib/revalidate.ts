const getCollectionPath = (collection: string, slug?: string | null) => {
  if (collection === 'posts') {
    return slug ? `/news/${slug}` : '/news'
  }

  if (collection === 'pages') {
    if (!slug || slug === 'home') {
      return '/'
    }

    return `/${slug}`
  }

  return '/'
}

type RevalidateArgs = {
  collection: string
  slug?: string | null
  operation: string
}

export const triggerStorefrontRevalidation = async ({
  collection,
  slug,
  operation,
}: RevalidateArgs) => {
  const revalidateURL = process.env.STOREFRONT_REVALIDATE_URL
  const secret = process.env.PAYLOAD_REVALIDATE_SECRET

  if (!revalidateURL || !secret) {
    return
  }

  await fetch(revalidateURL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-revalidate-secret': secret,
    },
    body: JSON.stringify({
      collection,
      slug,
      operation,
      path: getCollectionPath(collection, slug),
    }),
    cache: 'no-store',
  }).catch(() => undefined)
}
