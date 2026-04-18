"use client"

import { ReactNode } from 'react'
import {
  isExternalHref,
  resolveContentLinkHref,
  unwrapContentLink,
} from '@lib/content/links'
import { ContentLink, ContentLinkRow } from '@lib/content/types'
import LocalizedClientLink from '@modules/common/components/localized-client-link'

type ContentLinkProps = {
  item?: ContentLink | ContentLinkRow | null
  className?: string
  children?: ReactNode
  onClick?: () => void
}

export default function ContentLinkItem({
  item,
  className,
  children,
  onClick,
}: ContentLinkProps) {
  const link = unwrapContentLink(item)
  const href = resolveContentLinkHref(link)
  const label = children || link?.label

  if (!href || !label) {
    return null
  }

  if (isExternalHref(href)) {
    return (
      <a
        href={href}
        target={link?.newTab ? '_blank' : undefined}
        rel={link?.newTab ? 'noreferrer' : undefined}
        className={className}
        onClick={onClick}
      >
        {label}
      </a>
    )
  }

  return (
    <LocalizedClientLink href={href} className={className} onClick={onClick}>
      {label}
    </LocalizedClientLink>
  )
}
