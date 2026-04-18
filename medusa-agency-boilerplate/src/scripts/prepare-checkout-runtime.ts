import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  linkProductsToSalesChannelWorkflow,
} from "@medusajs/medusa/core-flows"

type ProductRecord = {
  id: string
  handle?: string | null
  status?: string | null
  variants?: { id: string; title?: string | null }[] | null
}

const DEFAULT_COUNTRY_CODE = "ru"
const DEFAULT_SALES_CHANNEL_NAME = "Default Sales Channel"
const DEFAULT_SHIPPING_PROFILE_TYPE = "default"
const RUNTIME_PRODUCT_HANDLE = "runtime-validation-checkout-item"
const RUNTIME_PRODUCT_TITLE = "Runtime Validation Item"
const RUNTIME_VARIANT_TITLE = "Default"
const RUNTIME_OPTION_TITLE = "Format"
const RUNTIME_OPTION_VALUE = "Default"
const RUNTIME_PRICE_AMOUNT = 1000
const RUNTIME_PRICE_CURRENCY = "rub"

export default async function prepareCheckoutRuntime({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)

  logger.info("Ensuring minimal checkout-ready runtime data...")

  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "status", "variants.id", "variants.title"],
    filters: {
      handle: RUNTIME_PRODUCT_HANDLE,
    },
  })

  const existingProduct = (existingProducts as ProductRecord[] | undefined)?.[0]

  if (existingProduct?.id && existingProduct.variants?.[0]?.id) {
    logger.info(`Reusing runtime product: ${existingProduct.id}`)
    logger.info(`RUNTIME_VALIDATION_PRODUCT_ID=${existingProduct.id}`)
    logger.info(`RUNTIME_VALIDATION_VARIANT_ID=${existingProduct.variants[0].id}`)
    return
  }

  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: DEFAULT_SHIPPING_PROFILE_TYPE,
  })

  const shippingProfile = shippingProfiles[0]

  if (!shippingProfile?.id) {
    throw new Error(
      "No default shipping profile found. Run the base seed before preparing checkout runtime data."
    )
  }

  const salesChannels = await salesChannelModuleService.listSalesChannels({
    name: DEFAULT_SALES_CHANNEL_NAME,
  })

  const salesChannel = salesChannels[0]

  if (!salesChannel?.id) {
    throw new Error(
      "No default sales channel found. Run the base seed before preparing checkout runtime data."
    )
  }

  const { result: createdProducts } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: RUNTIME_PRODUCT_TITLE,
          handle: RUNTIME_PRODUCT_HANDLE,
          description:
            "Minimal checkout-ready product for YooKassa runtime validation.",
          status: "published",
          is_giftcard: false,
          discountable: true,
          shipping_profile_id: shippingProfile.id,
          sales_channels: [{ id: salesChannel.id }],
          options: [
            {
              title: RUNTIME_OPTION_TITLE,
              values: [RUNTIME_OPTION_VALUE],
            },
          ],
          variants: [
            {
              title: RUNTIME_VARIANT_TITLE,
              sku: RUNTIME_PRODUCT_HANDLE,
              manage_inventory: false,
              allow_backorder: false,
              options: {
                [RUNTIME_OPTION_TITLE]: RUNTIME_OPTION_VALUE,
              },
              prices: [
                {
                  amount: RUNTIME_PRICE_AMOUNT,
                  currency_code: RUNTIME_PRICE_CURRENCY,
                },
              ],
            },
          ],
          metadata: {
            runtime_validation: true,
            country_code: DEFAULT_COUNTRY_CODE,
          },
        },
      ],
    },
  })

  const createdProduct = createdProducts[0]

  if (!createdProduct?.id) {
    throw new Error("Runtime validation product was not created.")
  }

  await linkProductsToSalesChannelWorkflow(container).run({
    input: {
      id: salesChannel.id,
      add: [createdProduct.id],
    },
  })

  const { data: createdProductsData } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "status", "variants.id", "variants.title"],
    filters: {
      id: createdProduct.id,
    },
  })

  const product = (createdProductsData as ProductRecord[] | undefined)?.[0]
  const variantId = product?.variants?.[0]?.id

  if (!product?.id || !variantId) {
    throw new Error(
      "Runtime validation product was created but the variant could not be retrieved."
    )
  }

  logger.info(`Created runtime product: ${product.id}`)
  logger.info(`RUNTIME_VALIDATION_PRODUCT_ID=${product.id}`)
  logger.info(`RUNTIME_VALIDATION_VARIANT_ID=${variantId}`)
}
