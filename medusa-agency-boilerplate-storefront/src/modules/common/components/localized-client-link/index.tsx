"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import React from "react"

type LocalizedClientLinkProps = Omit<React.ComponentProps<typeof Link>, "href"> & {
  href: string
}

/**
 * Use this component to create a Next.js `<Link />` that persists the current country code in the url,
 * without having to explicitly pass it as a prop.
 */
const LocalizedClientLink = ({
  children,
  href,
  ...props
}: LocalizedClientLinkProps) => {
  const { countryCode } = useParams<{ countryCode: string }>()

  return (
    <Link href={`/${countryCode}${href}`} {...props}>
      {children}
    </Link>
  )
}

export default LocalizedClientLink
