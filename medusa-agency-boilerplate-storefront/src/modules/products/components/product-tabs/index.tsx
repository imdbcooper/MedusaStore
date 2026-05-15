"use client"

import { storefrontConfig } from "@lib/storefront-config"
import FastDelivery from "@modules/common/icons/fast-delivery"
import Refresh from "@modules/common/icons/refresh"
import Back from "@modules/common/icons/back"

import Accordion from "./accordion"
import { HttpTypes } from "@medusajs/types"
import * as React from "react"

type ProductTabsProps = {
  product: HttpTypes.StoreProduct
  /**
   * Phase 1 / step 6 — server-rendered content for the «Отзывы» tab.
   *
   * The host page (`ProductTemplate`) prepares
   * `<ProductReviewsSummary>` + `<ProductReviewsList>` as a server `ReactNode`
   * and passes it down. When `undefined` the tab is not rendered at all so
   * pages that have not enabled reviews yet keep the existing two-tab shape
   * (plan §6.1).
   */
  reviewsContent?: React.ReactNode
}

const ProductTabs = ({ product, reviewsContent }: ProductTabsProps) => {
  const productCopy = storefrontConfig.copy.product
  const reviewsCopy = storefrontConfig.copy.reviews

  type Tab = {
    id: string
    label: string
    component: React.ReactNode
  }

  const tabs: Tab[] = [
    {
      id: "details",
      label: productCopy.details,
      component: <ProductInfoTab product={product} />,
    },
    {
      id: "service-terms",
      label: productCopy.shippingAndReturns,
      component: <ServiceTermsTab product={product} />,
    },
  ]

  if (reviewsContent !== undefined) {
    tabs.push({
      id: "reviews",
      label: reviewsCopy.tabTitle,
      component: reviewsContent,
    })
  }

  return (
    <section className="border-y border-[var(--theme-border)] bg-[var(--theme-surface)]">
      <div className="content-container py-14">
        <div className="mb-10 max-w-2xl">
          <h2 className="mb-4 text-3xl font-semibold leading-tight tracking-[-0.01em] text-[var(--theme-foreground)]">
            Детали предложения
          </h2>
          <p className="text-lg leading-8 text-[var(--theme-muted)]">
            Подробное описание услуги, условия работы и гарантии.
          </p>
        </div>
        <div className="rounded-[var(--theme-radius-card)] border border-[var(--theme-border)] bg-[var(--theme-canvas)] p-2">
          <Accordion type="multiple">
            {tabs.map((tab) => (
              // `id={tab.id}` exposes a stable DOM anchor for in-page links
              // (e.g. `<a href="#reviews">` on `ProductRatingBadge`). Radix
              // forwards unknown props onto the underlying `Accordion.Item`
              // root element. Phase 1 only scrolls; auto-expanding the
              // accordion when the anchor matches is deferred to Phase 2.
              // TODO(Phase 2): автораскрытие вкладки `reviews` по anchor.
              <Accordion.Item
                key={tab.id}
                id={tab.id}
                title={tab.label}
                headingSize="medium"
                value={tab.id}
              >
                {tab.component}
              </Accordion.Item>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}

const ProductInfoTab = ({ product }: ProductTabsProps) => {
  const productCopy = storefrontConfig.copy.product
  const metadata = (product.metadata || {}) as Record<string, unknown>

  // Extract relevant metadata fields for IT services
  const metadataFields: { label: string; value: string }[] = []

  if (metadata["срок"] || metadata["deadline"]) {
    metadataFields.push({
      label: productCopy.metadataDeadline,
      value: String(metadata["срок"] || metadata["deadline"]),
    })
  }

  if (metadata["результат"] || metadata["result"]) {
    metadataFields.push({
      label: productCopy.metadataResult,
      value: String(metadata["результат"] || metadata["result"]),
    })
  }

  if (metadata["формат"] || metadata["format"]) {
    metadataFields.push({
      label: productCopy.metadataFormat,
      value: String(metadata["формат"] || metadata["format"]),
    })
  }

  return (
    <div className="py-8 text-sm leading-6 text-[var(--theme-muted)]">
      {/* Full description */}
      {product.description && (
        <div className="mb-6 whitespace-pre-line text-base leading-7 text-[var(--theme-muted)]">
          {product.description}
        </div>
      )}

      {/* Metadata specs for IT services */}
      {metadataFields.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {metadataFields.map((field) => (
            <SpecRow key={field.label} label={field.label} value={field.value} />
          ))}
        </div>
      )}
    </div>
  )
}

const SpecRow = ({ label, value }: Readonly<{ label: string; value: string }>) => (
  <div className="flex items-center justify-between gap-4 rounded-[8px] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
    <span className="font-semibold text-[var(--theme-foreground)]">{label}</span>
    <span className="text-right text-[var(--theme-muted)]">{value}</span>
  </div>
)

type ServiceTermsTabProps = {
  product: HttpTypes.StoreProduct
}

const ServiceTermsTab = ({ product }: ServiceTermsTabProps) => {
  const productCopy = storefrontConfig.copy.product
  const metadata = (product.metadata || {}) as Record<string, unknown>

  // Use metadata values if available, otherwise fall back to generic copy
  const termsDescription = metadata["условия_сроки"]
    ? String(metadata["условия_сроки"])
    : productCopy.serviceTermsDescription

  const guaranteeDescription = metadata["гарантии"]
    ? String(metadata["гарантии"])
    : productCopy.serviceGuaranteeDescription

  const supportDescription = metadata["поддержка"]
    ? String(metadata["поддержка"])
    : productCopy.serviceSupportDescription

  return (
    <div className="py-8">
      <div className="grid grid-cols-1 gap-4">
        <div className="flex items-start gap-4 rounded-[8px] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
          <FastDelivery />
          <div>
            <span className="font-semibold text-[var(--theme-foreground)]">
              {productCopy.serviceTermsTitle}
            </span>
            <p className="max-w-sm pt-1 text-sm leading-6 text-[var(--theme-muted)]">
              {termsDescription}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-4 rounded-[8px] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
          <Refresh />
          <div>
            <span className="font-semibold text-[var(--theme-foreground)]">
              {productCopy.serviceGuaranteeTitle}
            </span>
            <p className="max-w-sm pt-1 text-sm leading-6 text-[var(--theme-muted)]">
              {guaranteeDescription}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-4 rounded-[8px] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
          <Back />
          <div>
            <span className="font-semibold text-[var(--theme-foreground)]">
              {productCopy.serviceSupportTitle}
            </span>
            <p className="max-w-sm pt-1 text-sm leading-6 text-[var(--theme-muted)]">
              {supportDescription}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductTabs
