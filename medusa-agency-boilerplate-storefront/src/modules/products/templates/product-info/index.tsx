import { HttpTypes } from "@medusajs/types"
import { Heading, Text } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

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
