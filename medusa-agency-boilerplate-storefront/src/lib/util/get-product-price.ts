import { HttpTypes } from "@medusajs/types"
import { getPercentageDiff } from "./get-percentage-diff"
import { convertToLocale } from "./money"
import type { VariantPrice } from "types/global"

type StoreProductVariant = NonNullable<HttpTypes.StoreProduct["variants"]>[number]
type VariantWithCalculatedPrice = StoreProductVariant & {
  calculated_price: NonNullable<StoreProductVariant["calculated_price"]> & {
    calculated_amount: number
    original_amount: number
    currency_code: string
  }
}

const hasCalculatedPrice = (
  variant: StoreProductVariant
): variant is VariantWithCalculatedPrice =>
  typeof variant.calculated_price?.calculated_amount === "number" &&
  typeof variant.calculated_price.original_amount === "number" &&
  typeof variant.calculated_price.currency_code === "string"

export const getPricesForVariant = (
  variant: StoreProductVariant | null | undefined
): VariantPrice | null => {
  if (!variant || !hasCalculatedPrice(variant)) {
    return null
  }

  const { calculated_price } = variant

  return {
    calculated_price_number: calculated_price.calculated_amount,
    calculated_price: convertToLocale({
      amount: calculated_price.calculated_amount,
      currency_code: calculated_price.currency_code!,
    }),
    original_price_number: calculated_price.original_amount,
    original_price: convertToLocale({
      amount: calculated_price.original_amount,
      currency_code: calculated_price.currency_code,
    }),
    currency_code: calculated_price.currency_code,
    price_type: calculated_price.calculated_price?.price_list_type || "",
    percentage_diff: getPercentageDiff(
      calculated_price.original_amount,
      calculated_price.calculated_amount
    ),
  }
}

export function getProductPrice({
  product,
  variantId,
}: {
  product: HttpTypes.StoreProduct
  variantId?: string
}) {
  if (!product || !product.id) {
    throw new Error("No product provided")
  }

  const cheapestPrice = () => {
    if (!product || !product.variants?.length) {
      return null
    }

    const cheapestVariant = product.variants
      .filter(hasCalculatedPrice)
      .sort((a, b) => {
        return (
          a.calculated_price.calculated_amount -
          b.calculated_price.calculated_amount
        )
      })[0]

    return getPricesForVariant(cheapestVariant)
  }

  const variantPrice = () => {
    if (!product || !variantId) {
      return null
    }

    const variant = product.variants?.find(
      (v) => v.id === variantId || v.sku === variantId
    )

    if (!variant) {
      return null
    }

    return getPricesForVariant(variant)
  }

  return {
    product,
    cheapestPrice: cheapestPrice(),
    variantPrice: variantPrice(),
  }
}
