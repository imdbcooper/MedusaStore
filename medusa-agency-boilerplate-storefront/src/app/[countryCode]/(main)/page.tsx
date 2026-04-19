import { Metadata } from "next"

import { storefrontConfig } from "@lib/storefront-config"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"
import HomeSectionRenderer from "@modules/storefront-customization/components/home-section-renderer"

export const metadata: Metadata = {
  title: storefrontConfig.defaultTitle,
  description: storefrontConfig.defaultDescription,
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params

  const { countryCode } = params

  const region = await getRegion(countryCode)

  const { collections } = await listCollections({
    fields: "id, handle, title",
  })

  if (!collections || !region) {
    return null
  }

  return (
    <HomeSectionRenderer collections={collections} region={region} />
  )
}
