import type { ReactNode } from 'react'
import type { ServerFunctionClient } from 'payload'
import config from '@payload-config'
import {
  handleServerFunctions,
  metadata,
  RootLayout,
} from '@payloadcms/next/layouts'
import { importMap } from './importMap'

export { metadata }

const serverFunction: ServerFunctionClient = async (args) =>
  handleServerFunctions({
    ...args,
    config,
    importMap,
  })

export default function PayloadLayout(props: { children: ReactNode }) {
  return RootLayout({
    children: props.children,
    config,
    importMap,
    serverFunction,
  })
}
