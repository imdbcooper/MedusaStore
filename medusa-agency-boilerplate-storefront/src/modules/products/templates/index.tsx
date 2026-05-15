import React, { Suspense } from "react"

import ImageGallery from "@modules/products/components/image-gallery"
import ProductActions from "@modules/products/components/product-actions"
import ProductNicheSelector from "@modules/products/components/product-niche-selector"
import ProductOfferBenefits from "@modules/products/components/product-offer-benefits"
import ProductTabs from "@modules/products/components/product-tabs"
import ProductReviewsSummary from "@modules/products/components/product-reviews-summary"
import ProductReviewsList from "@modules/products/components/product-reviews-list"
import RelatedProducts from "@modules/products/components/related-products"
import ProductInfo from "@modules/products/templates/product-info"
import ProductSupportHighlights from "@modules/storefront-customization/components/product-support-highlights"
import { StitchProductTechSpecs } from "@modules/storefront-customization/components/stitch-surfaces"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import { retrieveCustomer } from "@lib/data/customer"

import ProductActionsWrapper from "./product-actions-wrapper"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  images: HttpTypes.StoreProductImage[]
}

const ProductTemplate = async ({
  product,
  region,
  countryCode,
  images,
}: ProductTemplateProps) => {
  if (!product || !product.id) {
    return notFound()
  }

  // Phase 1 / step 8 — fetch the authenticated customer (if any) once so the
  // reviews CTA can decide whether to enable the «Написать отзыв» button or
  // disable it with the `reviews.form.authRequired` hint (plan §6.4).
  // `retrieveCustomer` returns `null` for anonymous visitors and never
  // throws. The page already opts into runtime rendering via
  // `dynamic = "force-dynamic"` in
  // [`page.tsx`](medusa-agency-boilerplate-storefront/src/app/[countryCode]/(main)/products/[handle]/page.tsx:4),
  // so reading auth headers here does not change the page's static/dynamic
  // contract.
  const customer = await retrieveCustomer().catch(() => null)

  // Phase 1 / step 6 — assemble the «Отзывы» tab content as a server
  // `ReactNode` and hand it to the client `ProductTabs` via prop. Both
  // children are server components, so they fetch with the
  // `product-rating-${id}` / `product-reviews-${id}` cache tags before the
  // client tab switcher hydrates (plan §6.1, §6.6).
  const reviewsContent = (
    <div className="flex flex-col gap-y-8 py-8">
      <ProductReviewsSummary productId={product.id} customer={customer} />
      <ProductReviewsList productId={product.id} />
    </div>
  )

  return (
    <>
      <section
        className="content-container grid gap-12 py-16 lg:grid-cols-12 lg:items-start small:py-[120px]"
        data-testid="product-container"
      >
        <div className="flex flex-col gap-8 lg:col-span-5 lg:sticky lg:top-32">
          <ProductInfo product={product} />
          <div className="rounded-[var(--theme-radius-card)] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 shadow-[0_4px_24px_rgba(23,26,31,0.04)] small:p-8">
            <h2 className="mb-6 text-2xl font-semibold leading-tight text-[var(--theme-foreground)]">
              Запросить консультацию
            </h2>
            <Suspense
              fallback={
                <ProductActions
                  disabled={true}
                  product={product}
                  region={region}
                />
              }
            >
              <ProductActionsWrapper id={product.id} region={region} />
            </Suspense>
          </div>
          <ProductSupportHighlights />
        </div>
        <div className="flex flex-col gap-6 lg:col-span-7">
          <ImageGallery images={images} productTitle={product.title} />
          <ProductNicheSelector product={product} />
          <ProductOfferBenefits product={product} />
        </div>
      </section>
      <ProductTabs product={product} reviewsContent={reviewsContent} />
      <StitchProductTechSpecs
        title="Описание и характеристики"
        description={`Подробная информация о технической основе и функциональных возможностях ${product.title}.`}
      />
      <Suspense fallback={<SkeletonRelatedProducts />}>
        <RelatedProducts product={product} countryCode={countryCode} />
      </Suspense>
    </>
  )
}

export default ProductTemplate
