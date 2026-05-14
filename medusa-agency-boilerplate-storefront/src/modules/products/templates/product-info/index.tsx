import { HttpTypes } from "@medusajs/types"
import { Heading, Text } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import ProductRatingBadge from "@modules/products/components/product-rating-badge"

type ProductInfoProps = {
  product: HttpTypes.StoreProduct
}

const ProductInfo = ({ product }: ProductInfoProps) => {
  return (
    <div id="product-info">
      <div className="flex flex-col items-start gap-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-[var(--theme-accent-muted)] px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--theme-accent-contrast)]">
            Expert Setup
          </span>
          {product.collection && (
            <LocalizedClientLink
              href={`/collections/${product.collection.handle}`}
              className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)]"
            >
              {product.collection.title}
            </LocalizedClientLink>
          )}
        </div>
        <Heading
          level="h1"
          className="max-w-[560px] text-5xl font-bold leading-[1.1] tracking-[-0.035em] text-[var(--theme-foreground)]"
          data-testid="product-title"
        >
          {product.title}
        </Heading>

        {/*
          Phase 1 / step 7 — compact rating badge under the title (plan §6.2).
          The badge is a server component, fetches via the same cache-tagged
          server fetch used by `ProductReviewsSummary`; Next.js dedupes the
          two within a render. Empty-state ("Нет отзывов") is owned by the
          badge itself — no condition needed here.
        */}
        <ProductRatingBadge productId={product.id} variant="product-info" />

        {product.subtitle && (
          <Text
            className="max-w-[560px] whitespace-pre-line text-lg leading-8 text-[var(--theme-muted)]"
            data-testid="product-subtitle"
          >
            {product.subtitle}
          </Text>
        )}
      </div>
    </div>
  )
}

export default ProductInfo
