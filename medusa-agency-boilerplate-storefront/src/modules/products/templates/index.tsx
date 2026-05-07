import React, { Suspense } from "react"

import ImageGallery from "@modules/products/components/image-gallery"
import ProductActions from "@modules/products/components/product-actions"
import ProductNicheSelector from "@modules/products/components/product-niche-selector"
import ProductOfferBenefits from "@modules/products/components/product-offer-benefits"
import ProductTabs from "@modules/products/components/product-tabs"
import RelatedProducts from "@modules/products/components/related-products"
import ProductInfo from "@modules/products/templates/product-info"
import ProductSupportHighlights from "@modules/storefront-customization/components/product-support-highlights"
import { StitchProductTechSpecs } from "@modules/storefront-customization/components/stitch-surfaces"
import SkeletonRelatedProducts from "@modules/skeletons/templates/skeleton-related-products"
import { notFound } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import ProductActionsWrapper from "./product-actions-wrapper"

type ProductTemplateProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
  images: HttpTypes.StoreProductImage[]
}

const ProductTemplate: React.FC<ProductTemplateProps> = ({
  product,
  region,
  countryCode,
  images,
}) => {
  if (!product || !product.id) {
    return notFound()
  }

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
              Request Consultation
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
          <ProductOfferBenefits />
        </div>
      </section>
      <ProductTabs product={product} />
      <StitchProductTechSpecs
        title="Описание и характеристики"
        description={`Detailed insights into the technical foundation and functional scope of ${product.title}.`}
      />
      <Suspense fallback={<SkeletonRelatedProducts />}>
        <RelatedProducts product={product} countryCode={countryCode} />
      </Suspense>
    </>
  )
}

export default ProductTemplate
