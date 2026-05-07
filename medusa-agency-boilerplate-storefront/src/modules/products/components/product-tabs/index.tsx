"use client"

import { storefrontConfig } from "@lib/storefront-config"
import Back from "@modules/common/icons/back"
import FastDelivery from "@modules/common/icons/fast-delivery"
import Refresh from "@modules/common/icons/refresh"

import Accordion from "./accordion"
import { HttpTypes } from "@medusajs/types"

type ProductTabsProps = {
  product: HttpTypes.StoreProduct
}

const ProductTabs = ({ product }: ProductTabsProps) => {
  const productCopy = storefrontConfig.copy.product

  const tabs = [
    {
      label: productCopy.details,
      component: <ProductInfoTab product={product} />,
    },
    {
      label: productCopy.shippingAndReturns,
      component: <ShippingInfoTab />,
    },
  ]

  return (
    <section className="border-y border-[var(--theme-border)] bg-[var(--theme-surface)]">
      <div className="content-container py-14">
        <div className="mb-10 max-w-2xl">
          <h2 className="mb-4 text-3xl font-semibold leading-tight tracking-[-0.01em] text-[var(--theme-foreground)]">
            Детали предложения
          </h2>
          <p className="text-lg leading-8 text-[var(--theme-muted)]">
            Реальные параметры товара, доставка и возвраты сохранены из Medusa storefront logic.
          </p>
        </div>
        <div className="rounded-[var(--theme-radius-card)] border border-[var(--theme-border)] bg-[var(--theme-canvas)] p-2">
          <Accordion type="multiple">
            {tabs.map((tab, i) => (
              <Accordion.Item
                key={i}
                title={tab.label}
                headingSize="medium"
                value={tab.label}
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

  return (
    <div className="py-8 text-sm leading-6 text-[var(--theme-muted)]">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <SpecRow label={productCopy.material} value={product.material ? product.material : "-"} />
          <SpecRow
            label={productCopy.countryOfOrigin}
            value={product.origin_country ? product.origin_country : "-"}
          />
          <SpecRow label={productCopy.type} value={product.type ? product.type.value : "-"} />
        </div>
        <div className="flex flex-col gap-4">
          <SpecRow label={productCopy.weight} value={product.weight ? `${product.weight} g` : "-"} />
          <SpecRow
            label={productCopy.dimensions}
            value={
              product.length && product.width && product.height
                ? `${product.length} × ${product.width} × ${product.height}`
                : "-"
            }
          />
        </div>
      </div>
    </div>
  )
}

const SpecRow = ({ label, value }: Readonly<{ label: string; value: string }>) => (
  <div className="flex items-center justify-between gap-4 rounded-[8px] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
    <span className="font-semibold text-[var(--theme-foreground)]">{label}</span>
    <span className="text-right text-[var(--theme-muted)]">{value}</span>
  </div>
)

const ShippingInfoTab = () => {
  const productCopy = storefrontConfig.copy.product

  return (
    <div className="py-8">
      <div className="grid grid-cols-1 gap-4">
        <div className="flex items-start gap-4 rounded-[8px] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
          <FastDelivery />
          <div>
            <span className="font-semibold text-[var(--theme-foreground)]">{productCopy.shippingTitle}</span>
            <p className="max-w-sm pt-1 text-sm leading-6 text-[var(--theme-muted)]">{productCopy.shippingDescription}</p>
          </div>
        </div>
        <div className="flex items-start gap-4 rounded-[8px] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
          <Refresh />
          <div>
            <span className="font-semibold text-[var(--theme-foreground)]">{productCopy.exchangeTitle}</span>
            <p className="max-w-sm pt-1 text-sm leading-6 text-[var(--theme-muted)]">{productCopy.exchangeDescription}</p>
          </div>
        </div>
        <div className="flex items-start gap-4 rounded-[8px] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4">
          <Back />
          <div>
            <span className="font-semibold text-[var(--theme-foreground)]">{productCopy.returnsTitle}</span>
            <p className="max-w-sm pt-1 text-sm leading-6 text-[var(--theme-muted)]">{productCopy.returnsDescription}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductTabs
