import config from '@payload-config'
import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import { importMap } from './importMap'

type PayloadPageProps = {
  params: Promise<{ segments: string[] }>
  searchParams: Promise<Record<string, string | string[]>>
}

export default async function Page(props: PayloadPageProps) {
  return RootPage({
    config,
    importMap,
    params: props.params,
    searchParams: props.searchParams,
  })
}

export async function generateMetadata(props: PayloadPageProps) {
  return generatePageMetadata({
    config,
    params: props.params,
    searchParams: props.searchParams,
  })
}
