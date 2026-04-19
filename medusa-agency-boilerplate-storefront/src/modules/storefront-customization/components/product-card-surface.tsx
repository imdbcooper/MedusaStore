import { HttpTypes } from "@medusajs/types"
import { Text, clx } from "@medusajs/ui"

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

const getImageFrameClassName = (surface: StorefrontListingCardSurface) =>
  clx({
    "bg-ui-bg-subtle shadow-elevation-card-rest rounded-large group-hover:shadow-elevation-card-hover transition-shadow ease-in-out duration-150":
      surface.image.frame === "subtle",
    "bg-[var(--theme-surface)] border shadow-[var(--theme-shadow-card)] rounded-[var(--theme-radius-card)] transition-transform duration-150 ease-in-out group-hover:-translate-y-0.5":
      surface.image.frame === "elevated",
  })

const getThumbnailAspectRatio = (
  aspectRatio: StorefrontListingCardAspectRatio
): "portrait" | "feature" =>
  aspectRatio === "feature" ? "feature" : "portrait"

const getContentWrapperClassName = (surface: StorefrontListingCardSurface) =>
  clx("flex txt-compact-medium justify-between", {
    "mt-3": surface.content.density === "compact",
    "mt-4": surface.content.density === "comfortable",
  })

const getTitleClassName = (surface: StorefrontListingCardSurface) =>
  clx({
    "text-ui-fg-subtle": surface.content.titleTone === "subtle",
    "text-ui-fg-base": surface.content.titleTone === "default",
  })

const getPriceContainerClassName = (surface: StorefrontListingCardSurface) =>
  clx("flex items-center gap-x-2", {
    "pt-0.5": surface.content.density === "compact",
  })

const getPriceToneClassName = (surface: StorefrontListingCardSurface) =>
  clx({
    "text-ui-fg-muted": surface.content.priceTone === "muted",
    "text-[var(--theme-accent)]": surface.content.priceTone === "accent",
  })

export default function ProductCardSurface({
  product,
  price,
  surface,
}: ProductCardSurfaceProps) {
  return (
    <LocalizedClientLink href={`/products/${product.handle}`} className="group block">
      <div data-testid="product-wrapper">
        <Thumbnail
          thumbnail={product.thumbnail}
          images={product.images}
          size="full"
          aspectRatio={getThumbnailAspectRatio(surface.image.aspectRatio)}
          frameClassName={getImageFrameClassName(surface)}
        />
        <div className={getContentWrapperClassName(surface)}>
          <Text className={getTitleClassName(surface)} data-testid="product-title">
            {product.title}
          </Text>
          <div className={getPriceContainerClassName(surface)}>
            {price && (
              <PreviewPrice
                price={price}
                className={getPriceToneClassName(surface)}
              />
            )}
          </div>
        </div>
      </div>
    </LocalizedClientLink>
  )
}
