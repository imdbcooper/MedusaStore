import { DELIVERY_HUB_PROVIDER_YANDEX } from "./constants"
import type { DeliveryHubAdapter } from "./adapters/types"
import { createYandexDeliveryAdapter } from "./adapters/yandex"
import { DeliveryHubError } from "./errors"

const deliveryHubRegistry = new Map<string, DeliveryHubAdapter>([
  [DELIVERY_HUB_PROVIDER_YANDEX, createYandexDeliveryAdapter()],
])

export function listDeliveryHubProviders() {
  return Array.from(deliveryHubRegistry.values()).map((adapter) => adapter.definition)
}

export function getDeliveryHubAdapter(providerCode: string) {
  const adapter = deliveryHubRegistry.get(providerCode)

  if (!adapter) {
    throw new DeliveryHubError({
      code: "DELIVERY_HUB_PROVIDER_NOT_SUPPORTED",
      message: `Delivery Hub provider \"${providerCode}\" is not supported`,
      status: 404,
    })
  }

  return adapter
}
