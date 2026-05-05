import '@payloadcms/next/css'

import type { ReactNode } from 'react'
import type { ServerFunctionClient } from 'payload'
import config from '@payload-config'
import {
  handleServerFunctions,
  metadata,
  RootLayout as PayloadRootLayout,
} from '@payloadcms/next/layouts'
import { importMap } from './(payload)/importMap'

export { metadata }

const serverFunction: ServerFunctionClient = async (args) => {
  'use server'

  return handleServerFunctions({
    ...args,
    config,
    importMap,
  })
}

export default function RootLayout(props: { children: ReactNode }) {
  return PayloadRootLayout({
    children: props.children,
    config,
    importMap,
    serverFunction,
  })
}
