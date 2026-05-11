import Link from "next/link"

import type { AssistantProduct } from "../../types"

type AssistantProductCardProps = {
  countryCode: string
  product: AssistantProduct
  liveDataChecked?: boolean
}

function getProductHref(countryCode: string, product: AssistantProduct) {
  if (product.url) {
    return product.url
  }

  if (product.handle) {
    return `/${countryCode}/products/${product.handle}`
  }

  return `/${countryCode}`
}

function getPriceLabel(product: AssistantProduct, liveDataChecked?: boolean) {
  if (!liveDataChecked || product.price === null || typeof product.price === "undefined") {
    return "Цена уточняется"
  }

  if (typeof product.price === "number") {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: product.currency_code || "RUB",
      maximumFractionDigits: 0,
    }).format(product.price)
  }

  return product.price
}

function getAvailabilityLabel(product: AssistantProduct, liveDataChecked?: boolean) {
  if (!liveDataChecked || !product.availability || product.availability === "unknown") {
    return "Наличие нужно проверить"
  }

  if (product.availability === "in_stock") {
    return "Есть в наличии"
  }

  if (product.availability === "out_of_stock") {
    return "Нет в наличии"
  }

  return product.availability
}

export default function AssistantProductCard({
  countryCode,
  product,
  liveDataChecked,
}: AssistantProductCardProps) {
  return (
    <Link
      href={getProductHref(countryCode, product)}
      className="block rounded-lg border border-ui-border-base bg-ui-bg-base p-3 transition hover:border-ui-border-interactive"
    >
      <div className="flex gap-3">
        {product.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.thumbnail}
            alt={product.title || "Товар"}
            className="h-16 w-16 rounded-md object-cover"
            loading="lazy"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ui-fg-base">{product.title || "Товар"}</p>
          {product.description && (
            <p className="mt-1 line-clamp-2 text-xs text-ui-fg-subtle">{product.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-ui-fg-muted">
            <span>{getPriceLabel(product, liveDataChecked)}</span>
            <span>·</span>
            <span>{getAvailabilityLabel(product, liveDataChecked)}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
