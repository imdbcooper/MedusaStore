import React from 'react'
import { ContentRichTextNode, ContentRichTextValue } from '@lib/content/types'

const hasFormat = (format: ContentRichTextNode['format'], bit: number) =>
  typeof format === 'number' && (format & bit) === bit

const renderTextNode = (node: ContentRichTextNode, key: string) => {
  let content: React.ReactNode = node.text || ''

  if (hasFormat(node.format, 1)) {
    content = <strong>{content}</strong>
  }

  if (hasFormat(node.format, 2)) {
    content = <em>{content}</em>
  }

  if (hasFormat(node.format, 8)) {
    content = <u>{content}</u>
  }

  return <React.Fragment key={key}>{content}</React.Fragment>
}

const renderNodes = (nodes?: ContentRichTextNode[], prefix = 'node'): React.ReactNode[] =>
  (nodes || [])
    .map((node, index) => renderNode(node, `${prefix}-${index}`))
    .filter(Boolean) as React.ReactNode[]

const renderNode = (node: ContentRichTextNode, key: string): React.ReactNode => {
  const children = renderNodes(node.children, key)

  if (node.type === 'text') {
    return renderTextNode(node, key)
  }

  if (node.type === 'linebreak') {
    return <br key={key} />
  }

  if (node.type === 'paragraph') {
    return (
      <p key={key} className="text-base leading-7 text-ui-fg-base">
        {children}
      </p>
    )
  }

  if (node.type === 'heading') {
    const tag = node.tag || 'h2'

    if (tag === 'h1') {
      return <h1 key={key} className="text-4xl font-semibold tracking-tight">{children}</h1>
    }

    if (tag === 'h3') {
      return <h3 key={key} className="text-2xl font-semibold tracking-tight">{children}</h3>
    }

    if (tag === 'h4') {
      return <h4 key={key} className="text-xl font-semibold tracking-tight">{children}</h4>
    }

    return <h2 key={key} className="text-3xl font-semibold tracking-tight">{children}</h2>
  }

  if (node.type === 'quote') {
    return (
      <blockquote key={key} className="border-l-4 border-ui-border-base pl-4 italic text-ui-fg-subtle">
        {children}
      </blockquote>
    )
  }

  if (node.type === 'list') {
    const Tag = node.listType === 'number' ? 'ol' : 'ul'
    const className =
      node.listType === 'number'
        ? 'list-decimal pl-5 space-y-2'
        : 'list-disc pl-5 space-y-2'

    return <Tag key={key} className={className}>{children}</Tag>
  }

  if (node.type === 'listitem') {
    return <li key={key}>{children}</li>
  }

  if (node.type === 'link') {
    const href = node.fields?.url || node.url

    if (!href) {
      return <React.Fragment key={key}>{children}</React.Fragment>
    }

    return (
      <a
        key={key}
        href={href}
        target={node.fields?.newTab ? '_blank' : undefined}
        rel={node.fields?.newTab ? 'noreferrer' : undefined}
        className="text-ui-fg-interactive hover:underline"
      >
        {children}
      </a>
    )
  }

  if (node.text) {
    return renderTextNode(node, key)
  }

  return <React.Fragment key={key}>{children}</React.Fragment>
}

export default function ContentRichText({ value }: { value?: ContentRichTextValue }) {
  const nodes = Array.isArray(value) ? value : value?.root?.children

  if (!nodes?.length) {
    return null
  }

  return <div className="flex flex-col gap-4">{renderNodes(nodes)}</div>
}
