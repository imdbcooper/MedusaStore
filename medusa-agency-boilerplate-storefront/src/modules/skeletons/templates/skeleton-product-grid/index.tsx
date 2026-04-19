import repeat from "@lib/util/repeat"
import SkeletonProductPreview from "@modules/skeletons/components/skeleton-product-preview"
import { resolveDefaultProductCardSurface } from "@modules/storefront-customization/components/listing-surface-resolver"

const SkeletonProductGrid = ({
  numberOfProducts = 8,
}: {
  numberOfProducts?: number
}) => {
  const surface = resolveDefaultProductCardSurface()

  return (
    <ul
      className="grid grid-cols-2 small:grid-cols-3 medium:grid-cols-4 gap-x-6 gap-y-8 flex-1"
      data-testid="products-list-loader"
    >
      {repeat(numberOfProducts).map((index) => (
        <li key={index}>
          <SkeletonProductPreview surface={surface} />
        </li>
      ))}
    </ul>
  )
}

export default SkeletonProductGrid
