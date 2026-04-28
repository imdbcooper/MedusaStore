export const YANDEX_DELIVERY_PRODUCTION_API_BASE_URL = "https://b2b-authproxy.taxi.yandex.net/api/b2b/platform"
export const YANDEX_DELIVERY_SANDBOX_API_BASE_URL = "https://b2b.taxi.tst.yandex.net/api/b2b/platform"

export const YANDEX_DELIVERY_LEGACY_PRODUCTION_API_BASE_URL = "https://b2b.taxi.yandex.net/b2b/cargo/integration/v2"
export const YANDEX_DELIVERY_LEGACY_SANDBOX_API_BASE_URL = "https://b2b.taxi.tst.yandex.net/b2b/cargo/integration/v2"

export const YANDEX_DELIVERY_API_BASE_URL_MIGRATIONS = new Map<string, string>([
  [YANDEX_DELIVERY_LEGACY_PRODUCTION_API_BASE_URL, YANDEX_DELIVERY_PRODUCTION_API_BASE_URL],
  [YANDEX_DELIVERY_LEGACY_SANDBOX_API_BASE_URL, YANDEX_DELIVERY_SANDBOX_API_BASE_URL],
])

export const YANDEX_DELIVERY_ALLOWED_API_BASE_URLS = new Set([
  YANDEX_DELIVERY_PRODUCTION_API_BASE_URL,
  YANDEX_DELIVERY_SANDBOX_API_BASE_URL,
])

export const YANDEX_DELIVERY_API_PATH = {
  pickupPointsList: "/pickup-points/list",
  offersInfo: "/offers/info",
  pricingCalculator: "/pricing-calculator",
  offersCreate: "/offers/create",
  requestCreate: "/request/create",
  requestInfo: "/request/info",
  requestCancel: "/request/cancel",
} as const
