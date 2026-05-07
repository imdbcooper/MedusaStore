import { HttpTypes } from "@medusajs/types"
import { clx } from "@medusajs/ui"

import type {
  StorefrontListingCardAspectRatio,
  StorefrontListingCardSurface,
} from "@lib/storefront-client-config"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import PreviewPrice from "@modules/products/components/product-preview/price"
import Thumbnail from "@modules/products/components/thumbnail"
import type { VariantPrice } from "types/global"

export type ProductCardSurfaceProps = {
  product: HttpTypes.StoreProduct
  price: VariantPrice | null
  surface: StorefrontListingCardSurface
}

export const getProductCardImageFrameClassName = (
  surface: StorefrontListingCardSurface
) =>
  clx(
    "bg-[var(--theme-surface-muted)] border border-[var(--theme-border)] transition duration-300 group-hover:scale-[1.01]",
    {
      "ring-1 ring-[var(--theme-accent-soft)]": surface.image.frame === "elevated",
    }
  )

export const getProductCardThumbnailAspectRatio = (
  aspectRatio: StorefrontListingCardAspectRatio
): "portrait" | "feature" =>
  aspectRatio === "feature" ? "feature" : "portrait"

export const getProductCardImageContainerClassName = (
  surface: StorefrontListingCardSurface
) =>
  clx("relative w-full overflow-hidden", getProductCardImageFrameClassName(surface), {
    "aspect-[11/14]": surface.image.aspectRatio === "feature",
    "aspect-[9/16]": surface.image.aspectRatio === "portrait",
  })

export const getProductCardContentWrapperClassName = (
  surface: StorefrontListingCardSurface
) =>
  clx("flex txt-compact-medium justify-between", {
    "mt-3": surface.content.density === "compact",
    "mt-4": surface.content.density === "comfortable",
  })

export const getProductCardPriceContainerClassName = (
  surface: StorefrontListingCardSurface
) =>
  clx("flex items-center gap-x-2", {
    "pt-0.5": surface.content.density === "compact",
  })

const getProductEyebrow = (product: HttpTypes.StoreProduct) =>
  product.collection?.title || product.categories?.[0]?.name || "Готовое решение"

const CATALOG_CARD_HEIGHT_CLASS = "h-[520px]"

const FeaturedProductCard = ({ product, price, surface }: ProductCardSurfaceProps) => (
  <LocalizedClientLink href={`/products/${product.handle}`} className="group block">
    <article className={clx("grid overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-[0_4px_12px_rgba(23,26,31,0.04)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(23,26,31,0.08)] md:grid-cols-2", CATALOG_CARD_HEIGHT_CLASS)}>
      <div className="relative h-[220px] shrink-0 overflow-hidden bg-[var(--theme-surface-muted)] md:h-full md:min-h-0">
        <Thumbnail
          thumbnail={product.thumbnail}
          images={product.images}
          size="full"
          aspectRatio={getProductCardThumbnailAspectRatio(surface.image.aspectRatio)}
          frameClassName="!rounded-none !border-0 !shadow-none bg-[var(--theme-surface-muted)]"
          className="!h-full !min-h-0 !p-0 [&_svg]:h-10 [&_svg]:w-10"
        />
        <span className="absolute left-4 top-4 rounded-full bg-[#6F8F7A] px-3 py-1 text-xs font-semibold uppercase leading-none tracking-[0.16em] text-[#171A1F] shadow-sm">
          Popular
        </span>
      </div>
      <div className="flex min-h-0 flex-col justify-between overflow-hidden p-6 small:p-8">
        <div className="min-h-0">
          <span className="mb-3 block text-xs font-semibold uppercase leading-none tracking-[0.18em] text-[#737780]">
            {getProductEyebrow(product)}
          </span>
          <h3 className="line-clamp-2 text-[28px] font-semibold leading-[1.2] tracking-[-0.01em] text-[#171A1F] small:text-[32px]" data-testid="product-title">
            {product.title}
          </h3>
          {product.description ? (
            <p className="line-clamp-3 pt-4 text-base leading-[1.6] text-[#4A607D]">
              {product.description}
            </p>
          ) : null}
        </div>
        <div className="mt-6 flex shrink-0 flex-col gap-4 small:flex-row small:items-center small:justify-between">
          <div className="flex items-center gap-2 text-[20px] font-medium leading-none text-[#171A1F]">
            {price ? (
              <>
                <span>от</span>
                <PreviewPrice price={price} className="!text-[20px] !font-medium !leading-none !text-[#171A1F]" />
              </>
            ) : null}
          </div>
          <span className="inline-flex items-center justify-center rounded-lg bg-[var(--theme-accent)] px-5 py-2.5 text-base font-bold text-[var(--theme-accent-contrast)] transition-colors group-hover:bg-[var(--theme-accent-strong)]">
            Смотреть детали
          </span>
        </div>
      </div>
    </article>
  </LocalizedClientLink>
)

const CompactProductCard = ({ product, price, surface }: ProductCardSurfaceProps) => (
  <LocalizedClientLink href={`/products/${product.handle}`} className="group block">
    <article className={clx("flex overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(23,26,31,0.08)] md:flex-col", CATALOG_CARD_HEIGHT_CLASS)}>
      <div className="relative h-[220px] w-2/5 shrink-0 overflow-hidden bg-[var(--theme-surface-muted)] md:h-[248px] md:w-full">
        <Thumbnail
          thumbnail={product.thumbnail}
          images={product.images}
          size="full"
          aspectRatio={getProductCardThumbnailAspectRatio(surface.image.aspectRatio)}
          frameClassName="!rounded-none !border-0 !shadow-none bg-[var(--theme-surface-muted)]"
          className="!h-full !min-h-0 !p-0 [&_svg]:h-8 [&_svg]:w-8"
        />
        <span className="absolute left-3 top-3 rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-1 text-xs font-semibold uppercase leading-none tracking-[0.16em] text-[#171A1F] md:left-4 md:top-4">
          {getProductEyebrow(product)}
        </span>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-5 md:p-6">
        <h3 className="line-clamp-2 text-xl font-semibold leading-[1.3] text-[#171A1F] md:text-2xl" data-testid="product-title">
          {product.title}
        </h3>
        {product.description ? (
          <p className="line-clamp-2 pt-3 text-base leading-[1.6] text-[#4A607D]">
            {product.description}
          </p>
        ) : null}
        <div className="mt-auto flex shrink-0 flex-col gap-3 pt-5">
          <div className="flex items-center gap-2 text-[20px] font-medium leading-none text-[#171A1F]">
            {price ? (
              <>
                <span>от</span>
                <PreviewPrice price={price} className="!text-[20px] !font-medium !leading-none !text-[#171A1F]" />
              </>
            ) : null}
          </div>
          <span className="inline-flex w-full items-center justify-center rounded-lg border border-[var(--theme-border)] px-4 py-2 text-base text-[#171A1F] transition-colors group-hover:border-[#171A1F]">
            Подробнее
          </span>
        </div>
      </div>
    </article>
  </LocalizedClientLink>
)

export default function ProductCardSurface({
  product,
  price,
  surface,
}: ProductCardSurfaceProps) {
  if (surface.image.aspectRatio === "feature") {
    return <FeaturedProductCard product={product} price={price} surface={surface} />
  }

  return <CompactProductCard product={product} price={price} surface={surface} />
}
