import Image from 'next/image'
import { toAbsolutePayloadURL } from '@lib/data/content/client'
import { isExternalHref, resolveContentLinkHref, unwrapContentLink } from '@lib/content/links'
import {
  ContentBlock,
  ContentLinkRow,
  ContentMedia,
} from '@lib/content/types'
import LocalizedClientLink from '@modules/common/components/localized-client-link'
import ContentRichText from '../rich-text'

const getMediaDimensions = (media?: ContentMedia | null) => ({
  width: media?.width || 1600,
  height: media?.height || 900,
})

const ContentActionLink = ({
  item,
  variant = 'primary',
}: {
  item?: ContentLinkRow | null
  variant?: 'primary' | 'secondary'
}) => {
  const link = unwrapContentLink(item)
  const href = resolveContentLinkHref(link)

  if (!link?.label || !href) {
    return null
  }

  const className =
    variant === 'secondary'
      ? 'inline-flex items-center justify-center rounded-full border border-ui-border-base px-5 py-3 text-sm font-medium text-ui-fg-base transition hover:bg-ui-bg-subtle'
      : 'inline-flex items-center justify-center rounded-full bg-ui-fg-base px-5 py-3 text-sm font-medium text-ui-bg-base transition hover:opacity-90'

  if (isExternalHref(href)) {
    return (
      <a
        href={href}
        target={link.newTab ? '_blank' : undefined}
        rel={link.newTab ? 'noreferrer' : undefined}
        className={className}
      >
        {link.label}
      </a>
    )
  }

  return (
    <LocalizedClientLink href={href} className={className}>
      {link.label}
    </LocalizedClientLink>
  )
}

const ContentMediaAsset = ({
  media,
  className,
  priority = false,
}: {
  media?: ContentMedia | null
  className?: string
  priority?: boolean
}) => {
  const src = toAbsolutePayloadURL(media?.url)

  if (!src) {
    return null
  }

  const { width, height } = getMediaDimensions(media)

  return (
    <Image
      src={src}
      alt={media?.alt || ''}
      width={width}
      height={height}
      className={className || 'h-auto w-full rounded-3xl object-cover'}
      priority={priority}
    />
  )
}

export default function ContentBlockRenderer({ blocks }: { blocks?: ContentBlock[] | null }) {
  if (!blocks?.length) {
    return null
  }

  return (
    <div className="flex flex-col gap-12 pb-16">
      {blocks.map((block, index) => {
        if (block.blockType === 'heroBanner') {
          return (
            <section key={block.id || index} className="content-container py-10">
              <div className="overflow-hidden rounded-[32px] border border-ui-border-base bg-ui-bg-subtle">
                {block.backgroundImage && (
                  <ContentMediaAsset
                    media={block.backgroundImage}
                    className="h-[320px] w-full object-cover"
                    priority={index === 0}
                  />
                )}
                <div className="flex flex-col gap-6 px-8 py-10 small:px-12">
                  {block.eyebrow && (
                    <span className="text-sm font-medium uppercase tracking-[0.2em] text-ui-fg-subtle">
                      {block.eyebrow}
                    </span>
                  )}
                  {block.heading && (
                    <h1 className="max-w-4xl text-4xl font-semibold tracking-tight small:text-5xl">
                      {block.heading}
                    </h1>
                  )}
                  {block.body && (
                    <p className="max-w-2xl text-lg leading-8 text-ui-fg-subtle">
                      {block.body}
                    </p>
                  )}
                  {!!block.actions?.length && (
                    <div className="flex flex-wrap gap-3">
                      {block.actions.map((item, actionIndex) => (
                        <ContentActionLink
                          key={item.id || actionIndex}
                          item={item}
                          variant={actionIndex === 0 ? 'primary' : 'secondary'}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )
        }

        if (block.blockType === 'richText') {
          return (
            <section key={block.id || index} className="content-container">
              <div className="mx-auto max-w-3xl">
                <ContentRichText value={block.content} />
              </div>
            </section>
          )
        }

        if (block.blockType === 'imageText') {
          const reverse = block.layout === 'imageRight'

          return (
            <section key={block.id || index} className="content-container">
              <div className={`grid gap-8 lg:grid-cols-2 lg:items-center ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
                <ContentMediaAsset media={block.image} />
                <div className="flex flex-col gap-5">
                  {block.title && <h2 className="text-3xl font-semibold tracking-tight">{block.title}</h2>}
                  <ContentRichText value={block.body} />
                  {!!block.actions?.length && (
                    <div className="flex flex-wrap gap-3 pt-2">
                      {block.actions.map((item, actionIndex) => (
                        <ContentActionLink
                          key={item.id || actionIndex}
                          item={item}
                          variant={actionIndex === 0 ? 'primary' : 'secondary'}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )
        }

        if (block.blockType === 'ctaSection') {
          const accent = block.theme === 'accent'

          return (
            <section key={block.id || index} className="content-container">
              <div
                className={`rounded-[32px] px-8 py-10 small:px-12 ${
                  accent ? 'bg-black text-white' : 'border border-ui-border-base bg-ui-bg-subtle'
                }`}
              >
                <div className="flex flex-col gap-6">
                  {block.heading && <h2 className="text-3xl font-semibold tracking-tight">{block.heading}</h2>}
                  {block.body && (
                    <p className={`max-w-2xl text-lg leading-8 ${accent ? 'text-white/80' : 'text-ui-fg-subtle'}`}>
                      {block.body}
                    </p>
                  )}
                  {!!block.actions?.length && (
                    <div className="flex flex-wrap gap-3">
                      {block.actions.map((item, actionIndex) => (
                        <ContentActionLink
                          key={item.id || actionIndex}
                          item={item}
                          variant={actionIndex === 0 ? 'primary' : 'secondary'}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )
        }

        if (block.blockType === 'faq') {
          return (
            <section key={block.id || index} className="content-container">
              <div className="mx-auto flex max-w-3xl flex-col gap-6">
                {block.heading && <h2 className="text-3xl font-semibold tracking-tight">{block.heading}</h2>}
                <div className="flex flex-col divide-y divide-ui-border-base rounded-3xl border border-ui-border-base bg-white">
                  {(block.items || []).map((item, itemIndex) => (
                    <details key={item.id || itemIndex} className="group px-6 py-5">
                      <summary className="cursor-pointer list-none text-lg font-medium">
                        {item.question}
                      </summary>
                      <div className="pt-4 text-ui-fg-subtle">
                        <ContentRichText value={item.answer} />
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            </section>
          )
        }

        return null
      })}
    </div>
  )
}
