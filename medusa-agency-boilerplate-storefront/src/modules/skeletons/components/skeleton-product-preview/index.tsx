import type { StorefrontListingCardSurface } from "@lib/storefront-client-config"
import { clx } from "@medusajs/ui"
import {
  getProductCardContentWrapperClassName,
  getProductCardImageContainerClassName,
  getProductCardPriceContainerClassName,
} from "@modules/storefront-customization/components/product-card-surface"

type SkeletonProductPreviewProps = {
  surface: StorefrontListingCardSurface
}

const SkeletonProductPreview = ({ surface }: SkeletonProductPreviewProps) => {
  return (
    <div className="animate-pulse" aria-hidden="true">
      <div className={getProductCardImageContainerClassName(surface)}>
        <div className="absolute inset-0 bg-gray-100 bg-ui-bg-subtle" />
      </div>
      <div className={getProductCardContentWrapperClassName(surface)}>
        <div className="flex min-w-0 flex-1 items-start">
          <div
            className={clx("h-5 rounded bg-gray-100 bg-ui-bg-subtle", {
              "w-3/5": surface.content.density === "compact",
              "w-2/3": surface.content.density === "comfortable",
            })}
          />
        </div>
        <div className={getProductCardPriceContainerClassName(surface)}>
          <div
            className={clx("h-5 rounded bg-gray-100 bg-ui-bg-subtle", {
              "w-10": surface.content.density === "compact",
              "w-12": surface.content.density === "comfortable",
            })}
          />
        </div>
      </div>
    </div>
  )
}

export default SkeletonProductPreview
