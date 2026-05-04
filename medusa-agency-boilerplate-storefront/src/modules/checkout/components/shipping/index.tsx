"use client"

import { Radio, RadioGroup } from "@headlessui/react"
import {
  addApishipShippingMethodToCart,
  calculateApishipShippingOption,
  listApishipPoints,
  listApishipProviders,
} from "@lib/data/apiship"
import { setShippingMethod } from "@lib/data/cart"
import { storefrontConfig } from "@lib/storefront-config"
import {
  APISHIP_PICKUP_POINT_PROVIDER_ID,
  APISHIP_PICKUP_POINT_SHIPPING_OPTION_PROVIDER_DATA_ID,
  type ApishipCalculation,
  type ApishipPoint,
  type ApishipProvider,
  type ApishipTariff,
} from "@lib/util/apiship"
import { convertToLocale } from "@lib/util/money"
import { CheckCircleSolid, Loader } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { Button, clx, Heading, Text } from "@medusajs/ui"
import ErrorMessage from "@modules/checkout/components/error-message"
import ShippingSummary from "@modules/checkout/components/shipping-summary"
import Divider from "@modules/common/components/divider"
import MedusaRadio from "@modules/common/components/radio"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

type CheckoutShippingOption = HttpTypes.StoreCartShippingOption & {
  provider?: {
    is_enabled?: boolean
  } | null
}

type ShippingProps = {
  cart: HttpTypes.StoreCart
  availableShippingMethods: HttpTypes.StoreCartShippingOption[] | null
}

type ApishipShippingOption = HttpTypes.StoreCartShippingOption & {
  provider_id?: string | null
  data?: Record<string, unknown> | null
  provider?: {
    id?: string | null
    is_enabled?: boolean
  } | null
}

type ApishipCheckoutState = {
  providers_status: "idle" | "loading" | "ready" | "error"
  providers: ApishipProvider[] | null
  points_status: "idle" | "loading" | "ready" | "error" | "blocked"
  points: ApishipPoint[]
  calculation_status: "idle" | "loading" | "ready" | "error" | "blocked"
  calculation: ApishipCalculation | null
  selected_point_id: string | null
  selected_tariff_id: string | null
  search_query: string
  commit_status: "idle" | "committing" | "committed" | "error" | "blocked"
  message: string | null
  last_context_key: string | null
}

function isCheckoutEligibleShippingOption(
  option: HttpTypes.StoreCartShippingOption
) {
  return (option as CheckoutShippingOption).provider?.is_enabled !== false
}

function formatPrice(
  amount: number,
  currencyCode: string | null | undefined
): string {
  if (!currencyCode) {
    return String(amount)
  }

  return convertToLocale({
    amount,
    currency_code: currencyCode,
  })
}


function getCheckoutAddressRequestKey(cart: HttpTypes.StoreCart) {
  const address = cart.shipping_address

  if (!address?.country_code || !address.city) {
    return null
  }

  return [
    address.country_code.toUpperCase(),
    address.city,
    address.postal_code,
    address.address_1,
  ]
    .filter(Boolean)
    .join("|")
}

function normalizeStorefrontCity(value?: string | null) {
  const normalized = value?.trim().toLocaleLowerCase("ru-RU")

  if (!normalized) {
    return null
  }

  return normalized
    .replace(/^г\.\s*/, "")
    .replace(/^г\s+/, "")
    .replace(/^город\s+/, "")
    .trim()
}

function getApishipPointId(point?: ApishipPoint | null) {
  const id = point?.id ?? point?.code
  return id === undefined || id === null ? null : String(id)
}

function getApishipPointLabel(point: ApishipPoint) {
  return [point.name, point.address].filter(Boolean).join(" · ") || getApishipPointId(point) || "ПВЗ ApiShip"
}

function getApishipPointAddressLabel(point: ApishipPoint) {
  return [point.city, point.street, point.address].filter(Boolean).join(", ") || point.address || "Адрес уточняется"
}

function getApishipTariffId(tariff?: ApishipTariff | null) {
  const id = tariff?.tariffId ?? tariff?.tariff_id ?? tariff?.id
  return id === undefined || id === null ? null : String(id)
}

function getApishipTariffCost(tariff: ApishipTariff) {
  const cost = tariff.deliveryCost ?? tariff.delivery_cost ?? tariff.amount ?? tariff.price
  return typeof cost === "number" ? cost : null
}

function getApishipTariffEtaLabel(tariff: ApishipTariff) {
  const min = tariff.daysMin ?? tariff.days_min ?? tariff.deliveryMin ?? tariff.delivery_min
  const max = tariff.daysMax ?? tariff.days_max ?? tariff.deliveryMax ?? tariff.delivery_max

  if (typeof min === "number" && typeof max === "number") {
    return `${min}–${max} дн.`
  }

  if (typeof min === "number") {
    return `от ${min} дн.`
  }

  if (typeof max === "number") {
    return `до ${max} дн.`
  }

  return null
}

function getApishipTariffs(calculation: ApishipCalculation | null) {
  return (calculation?.deliveryToPoint ?? []).flatMap((entry) => entry.tariffs ?? [])
}

function getApishipOptionProviderDataId(option: HttpTypes.StoreCartShippingOption) {
  const data = (option as ApishipShippingOption).data as Record<string, unknown> | null | undefined
  return data?.id ?? data?.provider_data_id ?? data?.providerDataId ?? data?.code
}

function isApishipPickupPointShippingOption(option: HttpTypes.StoreCartShippingOption) {
  const apishipOption = option as ApishipShippingOption
  const data = apishipOption.data as Record<string, unknown> | null | undefined
  const providerDataId = getApishipOptionProviderDataId(option)

  return Boolean(
    apishipOption.provider_id === APISHIP_PICKUP_POINT_PROVIDER_ID ||
      apishipOption.provider?.id === APISHIP_PICKUP_POINT_PROVIDER_ID ||
      data?.provider_id === APISHIP_PICKUP_POINT_PROVIDER_ID ||
      providerDataId === APISHIP_PICKUP_POINT_SHIPPING_OPTION_PROVIDER_DATA_ID ||
      data?.provider_code === "apiship"
  )
}

function getSavedApishipData(cart: HttpTypes.StoreCart) {
  const methodData = cart.shipping_methods?.at(-1)?.data as
    | Record<string, unknown>
    | null
    | undefined
  const apishipData = methodData?.apishipData as
    | { tariff?: ApishipTariff; point?: ApishipPoint }
    | null
    | undefined

  return apishipData ?? null
}

function getSelectedApishipPoint(
  points: ApishipPoint[],
  selectedPointId: string | null | undefined
) {
  if (!selectedPointId) {
    return null
  }

  return points.find((point) => getApishipPointId(point) === selectedPointId) ?? null
}

function filterApishipPoints(points: ApishipPoint[], city?: string | null, search?: string) {
  const normalizedCity = normalizeStorefrontCity(city)
  const cityScopedPoints = normalizedCity
    ? points.filter((point) => normalizeStorefrontCity(point.city) === normalizedCity)
    : points
  const basePoints = cityScopedPoints.length > 0 ? cityScopedPoints : points
  const normalizedSearch = search?.trim().toLocaleLowerCase("ru-RU")

  if (!normalizedSearch) {
    return basePoints
  }

  return basePoints.filter((point) =>
    [point.name, point.providerName, point.city, point.street, point.address, point.code]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("ru-RU")
      .includes(normalizedSearch)
  )
}

const Shipping: React.FC<ShippingProps> = ({
  cart,
  availableShippingMethods,
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [apishipState, setApishipState] = useState<ApishipCheckoutState>({
    providers_status: "idle",
    providers: null,
    points_status: "idle",
    points: [],
    calculation_status: "idle",
    calculation: null,
    selected_point_id: null,
    selected_tariff_id: null,
    search_query: "",
    commit_status: "idle",
    message: null,
    last_context_key: null,
  })
  const [error, setError] = useState<string | null>(null)

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const isOpen = searchParams.get("step") === "delivery"

  const checkoutCopy = storefrontConfig.copy.checkout
  const commonCopy = storefrontConfig.copy.common
  const cartShippingMethod = cart.shipping_methods?.at(-1)
  const shippingMethods = useMemo(
    () => (availableShippingMethods ?? []).filter(isCheckoutEligibleShippingOption),
    [availableShippingMethods]
  )
  const apishipShippingOption = useMemo(
    () => shippingMethods.find(isApishipPickupPointShippingOption) ?? null,
    [shippingMethods]
  )
  const preferredCartShippingMethodId = cartShippingMethod?.shipping_option_id ?? null
  const [shippingMethodId, setShippingMethodId] = useState<string | null>(
    preferredCartShippingMethodId
  )
  const addressRequestKey = useMemo(() => getCheckoutAddressRequestKey(cart), [
    cart.shipping_address?.address_1,
    cart.shipping_address?.city,
    cart.shipping_address?.country_code,
    cart.shipping_address?.postal_code,
  ])
  const apishipContextKey = [
    cart.id,
    cart.currency_code,
    String(cart.subtotal ?? ""),
    addressRequestKey ?? "missing_address",
    apishipShippingOption?.id ?? "missing_apiship_option",
  ].join("|")
  const savedApishipData = getSavedApishipData(cart)

  useEffect(() => {
    setShippingMethodId((current) =>
      current === preferredCartShippingMethodId ? current : preferredCartShippingMethodId
    )
  }, [preferredCartShippingMethodId])

  useEffect(() => {
    setError(null)
  }, [isOpen])

  useEffect(() => {
    let cancelled = false

    if (!isOpen) {
      return
    }

    setApishipState((current) => ({
      ...current,
      providers_status: "loading",
      points_status: addressRequestKey ? "loading" : "blocked",
      calculation_status: apishipShippingOption ? "loading" : "blocked",
      calculation: current.last_context_key === apishipContextKey ? current.calculation : null,
      points: current.last_context_key === apishipContextKey ? current.points : [],
      selected_point_id:
        current.last_context_key === apishipContextKey
          ? current.selected_point_id
          : getApishipPointId(savedApishipData?.point),
      selected_tariff_id:
        current.last_context_key === apishipContextKey
          ? current.selected_tariff_id
          : getApishipTariffId(savedApishipData?.tariff),
      commit_status: "idle",
      message: apishipShippingOption
        ? addressRequestKey
          ? "Загружаем пункты выдачи и тарифы ApiShip."
          : "Укажите город и страну, чтобы найти ПВЗ ApiShip."
        : "ApiShip shipping option не найден среди доступных способов доставки.",
      last_context_key: apishipContextKey,
    }))

    if (!apishipShippingOption) {
      setApishipState((current) => ({
        ...current,
        providers_status: "idle",
        points_status: "blocked",
        calculation_status: "blocked",
      }))
      return
    }

    Promise.allSettled([
      listApishipProviders(),
      addressRequestKey
        ? listApishipPoints({
            filter: cart.shipping_address?.city ?? undefined,
            limit: 100,
          })
        : Promise.resolve(null),
      calculateApishipShippingOption(apishipShippingOption.id, cart.id),
    ]).then((results) => {
      if (cancelled) {
        return
      }

      const providers = results[0].status === "fulfilled" ? results[0].value : null
      const points = results[1].status === "fulfilled" ? results[1].value : null
      const calculation = results[2].status === "fulfilled" ? results[2].value : null
      const tariffs = getApishipTariffs(calculation)
      const savedPointId = getApishipPointId(savedApishipData?.point)
      const savedTariffId = getApishipTariffId(savedApishipData?.tariff)

      setApishipState((current) => ({
        ...current,
        providers_status: providers ? "ready" : "error",
        providers,
        points_status: addressRequestKey ? (points ? "ready" : "error") : "blocked",
        points: points ?? [],
        calculation_status: calculation ? "ready" : "error",
        calculation,
        selected_point_id:
          points?.some((point) => getApishipPointId(point) === current.selected_point_id)
            ? current.selected_point_id
            : points?.some((point) => getApishipPointId(point) === savedPointId)
              ? savedPointId
              : null,
        selected_tariff_id:
          tariffs.some((tariff) => getApishipTariffId(tariff) === current.selected_tariff_id)
            ? current.selected_tariff_id
            : tariffs.some((tariff) => getApishipTariffId(tariff) === savedTariffId)
              ? savedTariffId
              : getApishipTariffId(tariffs[0]),
        message: calculation
          ? "Расчёт ApiShip готов. Выберите ПВЗ и сохраните доставку."
          : "Не удалось рассчитать доставку ApiShip. Попробуйте обновить страницу или проверьте адрес.",
      }))
    })

    return () => {
      cancelled = true
    }
  }, [
    apishipContextKey,
    apishipShippingOption,
    addressRequestKey,
    cart.id,
    cart.shipping_address?.city,
    isOpen,
    savedApishipData?.point,
    savedApishipData?.tariff,
  ])

  const handleEdit = () => {
    router.push(pathname + "?step=delivery", { scroll: false })
  }

  const selectedApishipPoint = getSelectedApishipPoint(
    apishipState.points,
    apishipState.selected_point_id
  )
  const apishipTariffs = getApishipTariffs(apishipState.calculation)
  const selectedApishipTariff =
    apishipTariffs.find(
      (tariff) => getApishipTariffId(tariff) === apishipState.selected_tariff_id
    ) ?? null
  const isApishipSelectionCommitted = Boolean(
    apishipShippingOption?.id &&
      cartShippingMethod?.shipping_option_id === apishipShippingOption.id &&
      savedApishipData?.tariff &&
      (savedApishipData?.point || selectedApishipPoint)
  )
  const apishipMutationInFlight = apishipState.commit_status === "committing"
  const canSaveApishipSelection = Boolean(
    apishipShippingOption && selectedApishipPoint && selectedApishipTariff
  )
  const canContinueToPayment = isApishipSelectionCommitted || canSaveApishipSelection
  const visibleShippingMethods = shippingMethods
  const displayedApishipPoints = filterApishipPoints(
    apishipState.points,
    cart.shipping_address?.city,
    apishipState.search_query
  ).slice(0, 12)
  const selectedApishipTariffCost = selectedApishipTariff
    ? getApishipTariffCost(selectedApishipTariff)
    : null
  const apishipPriceLabel = selectedApishipTariff
    ? selectedApishipTariffCost !== null
      ? formatPrice(selectedApishipTariffCost, cart.currency_code)
      : "Стоимость уточняется"
    : apishipState.calculation_status === "loading"
      ? "Рассчитываем"
      : "Выберите тариф"
  const apishipEtaLabel = selectedApishipTariff
    ? getApishipTariffEtaLabel(selectedApishipTariff) ?? "Уточняется"
    : "Уточняется"
  const deliverySubmitButtonLabel = isApishipSelectionCommitted
    ? checkoutCopy.continueToPayment
    : "Сохранить ApiShip доставку и перейти к оплате"

  const commitShippingMethod = async (
    id: string,
    data?: Record<string, unknown>
  ) => {
    setError(null)
    setIsLoading(true)
    const previousId = shippingMethodId
    setShippingMethodId(id)

    try {
      await setShippingMethod({
        cartId: cart.id,
        shippingMethodId: id,
        data,
      })
      return true
    } catch (err: any) {
      setShippingMethodId(previousId)
      setError(err.message)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveApishipSelection = async (options?: {
    continue_to_payment?: boolean
  }) => {
    if (!apishipShippingOption || !selectedApishipPoint || !selectedApishipTariff) {
      setApishipState((current) => ({
        ...current,
        commit_status: "blocked",
        message: "Выберите валидный тариф и ПВЗ ApiShip перед переходом к оплате.",
      }))
      return false
    }

    setError(null)
    setApishipState((current) => ({
      ...current,
      commit_status: "committing",
      message: "Сохраняем способ доставки ApiShip…",
    }))

    try {
      await addApishipShippingMethodToCart({
        cartId: cart.id,
        shippingOptionId: apishipShippingOption.id,
        apishipData: {
          tariff: selectedApishipTariff,
          point: selectedApishipPoint,
        },
      })
      setShippingMethodId(apishipShippingOption.id)
      setApishipState((current) => ({
        ...current,
        commit_status: "committed",
        message: "ApiShip доставка сохранена.",
      }))

      if (options?.continue_to_payment) {
        router.push(pathname + "?step=payment", { scroll: false })
      }

      router.refresh()
      return true
    } catch (err: any) {
      setApishipState((current) => ({
        ...current,
        commit_status: "error",
        message: err.message ?? "Не удалось сохранить ApiShip доставку. Попробуйте ещё раз.",
      }))
      return false
    }
  }

  const handleSubmit = async () => {
    if (isApishipSelectionCommitted) {
      router.push(pathname + "?step=payment", { scroll: false })
      return
    }

    if (!canSaveApishipSelection) {
      setApishipState((current) => ({
        ...current,
        commit_status: "blocked",
        message: "Выберите тариф ApiShip и ПВЗ, затем сохраните доставку.",
      }))
      return
    }

    await handleSaveApishipSelection({ continue_to_payment: true })
  }

  const getOptionPriceLabel = (option: HttpTypes.StoreCartShippingOption) => {
    if (isApishipPickupPointShippingOption(option)) {
      return apishipShippingOption?.id === option.id ? apishipPriceLabel : checkoutCopy.shippingRateUnavailable
    }

    if (option.price_type === "flat") {
      return convertToLocale({
        amount: option.amount!,
        currency_code: cart.currency_code,
      })
    }

    return checkoutCopy.shippingRateUnavailable
  }

  return (
    <div className="bg-white">
      <div className="mb-6 flex flex-row items-center justify-between">
        <Heading
          level="h2"
          className={clx("flex flex-row items-baseline gap-x-2 text-3xl-regular", {
            "pointer-events-none select-none opacity-50":
              !isOpen && cart.shipping_methods?.length === 0,
          })}
        >
          {checkoutCopy.delivery}
          {!isOpen && (cart.shipping_methods?.length ?? 0) > 0 && <CheckCircleSolid />}
        </Heading>
        {!isOpen && cart.shipping_address && cart.billing_address && cart.email && (
          <Text>
            <button
              onClick={handleEdit}
              className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
              data-testid="edit-delivery-button"
            >
              {commonCopy.edit}
            </button>
          </Text>
        )}
      </div>

      {isOpen ? (
        <>
          <div className="grid">
            <div className="flex flex-col">
              <span className="font-medium txt-medium text-ui-fg-base">
                {checkoutCopy.shippingMethod}
              </span>
              <span className="mb-4 text-ui-fg-muted txt-medium">
                {checkoutCopy.deliveryMethodHint}
              </span>
            </div>

            <div data-testid="delivery-options-container">
              <div className="pb-8 pt-2 md:pt-0">
                <RadioGroup
                  value={shippingMethodId}
                  onChange={(value) => {
                    if (!value) {
                      return
                    }

                    const option = visibleShippingMethods.find((entry) => entry.id === value)

                    if (!option) {
                      return
                    }
                    if (isApishipPickupPointShippingOption(option)) {
                      setShippingMethodId(option.id)
                      setApishipState((current) => ({
                        ...current,
                        commit_status: "blocked",
                        message: "Для ApiShip сначала выберите ПВЗ и тариф, затем сохраните доставку.",
                      }))
                      return
                    }

                    void commitShippingMethod(option.id)
                  }}
                >
                  {visibleShippingMethods.map((option) => {
                    const optionLabel = option.name

                    return (
                      <div key={option.id} className="mb-2">
                        <Radio
                          value={option.id}
                          data-testid="delivery-option-radio"
                          className={clx(
                            "flex cursor-pointer items-center justify-between rounded-rounded border px-8 py-4 text-small-regular hover:shadow-borders-interactive-with-active",
                            {
                              "border-ui-border-interactive": option.id === shippingMethodId,
                            }
                          )}
                        >
                          <div className="flex items-center gap-x-4">
                            <MedusaRadio checked={option.id === shippingMethodId} />
                            <div className="flex flex-col">
                              <span className="text-base-regular">{optionLabel}</span>
                            </div>
                          </div>
                          <span className="justify-self-end text-right text-ui-fg-base">
                            {getOptionPriceLabel(option)}
                          </span>
                        </Radio>
                      </div>
                    )
                  })}
                </RadioGroup>
              </div>
            </div>
          </div>

          <div
            className={clx("mb-6 rounded-rounded border px-5 py-4", {
              "border-ui-border-interactive bg-ui-bg-base": isApishipSelectionCommitted,
              "border-ui-tag-orange-border bg-ui-tag-orange-bg": !isApishipSelectionCommitted,
              "border-ui-border-base bg-ui-bg-subtle": !apishipShippingOption,
            })}
            data-testid="apiship-customer-delivery-card"
          >
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-col gap-y-2 small:flex-row small:items-start small:justify-between">
                <div className="flex flex-col gap-y-1">
                  <Text className="text-ui-fg-base txt-medium-plus">
                    ApiShip ПВЗ
                  </Text>
                  <Text className="text-ui-fg-muted txt-small">
                    Выберите пункт выдачи и тариф ApiShip. Карта ПВЗ будет добавлена отдельным hardening-этапом; сейчас доступен список.
                  </Text>
                </div>
                <span className="w-fit rounded-rounded border border-ui-border-base bg-ui-bg-base px-2 py-1 text-ui-fg-muted txt-compact-small">
                  {isApishipSelectionCommitted ? "Сохранено" : "Требуется выбор"}
                </span>
              </div>

              {!apishipShippingOption && (
                <Text className="text-ui-fg-muted txt-small" data-testid="apiship-option-missing">
                  ApiShip shipping option не найден среди доступных способов доставки. Нужен provider id {APISHIP_PICKUP_POINT_PROVIDER_ID} или data id {APISHIP_PICKUP_POINT_SHIPPING_OPTION_PROVIDER_DATA_ID}.
                </Text>
              )}

              <div className="grid gap-3 small:grid-cols-3">
                <div className="rounded-rounded border border-ui-border-base bg-ui-bg-base p-3">
                  <Text className="text-ui-fg-muted txt-small">Стоимость</Text>
                  <Text className="text-ui-fg-base txt-medium-plus" data-testid="apiship-buyer-visible-delivery-cost">
                    {apishipPriceLabel}
                  </Text>
                </div>
                <div className="rounded-rounded border border-ui-border-base bg-ui-bg-base p-3">
                  <Text className="text-ui-fg-muted txt-small">Срок</Text>
                  <Text className="text-ui-fg-base txt-medium-plus">
                    {apishipEtaLabel}
                  </Text>
                </div>
                <div className="rounded-rounded border border-ui-border-base bg-ui-bg-base p-3">
                  <Text className="text-ui-fg-muted txt-small">Пункт выдачи</Text>
                  <Text className="text-ui-fg-base txt-medium-plus" data-testid="apiship-customer-pickup-point">
                    {selectedApishipPoint ? getApishipPointLabel(selectedApishipPoint) : "Не выбран"}
                  </Text>
                </div>
              </div>

              {selectedApishipPoint && (
                <Text className="text-ui-fg-muted txt-small">
                  Адрес ПВЗ: {getApishipPointAddressLabel(selectedApishipPoint)}
                </Text>
              )}

              <div className="rounded-rounded border border-ui-border-base bg-ui-bg-base p-4" data-testid="apiship-pickup-point-selector">
                <div className="flex flex-col gap-y-3">
                  <div className="flex flex-col gap-y-1 small:flex-row small:items-start small:justify-between">
                    <div className="flex flex-col gap-y-1">
                      <Text className="text-ui-fg-base txt-medium-plus">
                        Выберите пункт выдачи ApiShip
                      </Text>
                      <Text className="text-ui-fg-muted txt-small">
                        {apishipState.points_status === "loading"
                          ? "Загружаем ПВЗ…"
                          : apishipState.points_status === "error"
                            ? "Не удалось загрузить ПВЗ ApiShip."
                            : apishipState.points_status === "blocked"
                              ? "Заполните адрес доставки, чтобы загрузить ПВЗ."
                              : `${displayedApishipPoints.length} пунктов доступно в списке.`}
                      </Text>
                    </div>
                    {(apishipState.providers_status === "loading" || apishipState.calculation_status === "loading") && (
                      <span className="flex items-center gap-x-2 text-ui-fg-muted txt-compact-small">
                        <Loader /> Загружаем ApiShip
                      </span>
                    )}
                  </div>

                  <input
                    className="rounded-rounded border border-ui-border-base bg-ui-bg-base px-3 py-2 text-ui-fg-base txt-small"
                    value={apishipState.search_query}
                    onChange={(event) => {
                      setApishipState((current) => ({
                        ...current,
                        search_query: event.target.value,
                      }))
                    }}
                    placeholder="Поиск по названию, адресу или провайдеру"
                    data-testid="apiship-pickup-point-search"
                  />

                  {displayedApishipPoints.length > 0 ? (
                    <div className="grid gap-y-2" data-testid="apiship-pickup-point-list">
                      {displayedApishipPoints.map((point) => {
                        const pointId = getApishipPointId(point)

                        if (!pointId) {
                          return null
                        }

                        const isSelected = pointId === apishipState.selected_point_id

                        return (
                          <label
                            key={pointId}
                            className={clx(
                              "flex cursor-pointer flex-col gap-y-1 rounded-rounded border p-3 text-ui-fg-muted txt-small",
                              isSelected
                                ? "border-ui-border-interactive bg-ui-bg-base"
                                : "border-ui-border-base bg-ui-bg-subtle"
                            )}
                            data-testid="apiship-pickup-point-option"
                          >
                            <span className="flex items-start gap-x-2 text-ui-fg-base">
                              <input
                                type="radio"
                                name="apiship-pickup-point"
                                checked={isSelected}
                                onChange={() => {
                                  setApishipState((current) => ({
                                    ...current,
                                    selected_point_id: pointId,
                                    commit_status: "idle",
                                  }))
                                }}
                                data-testid="apiship-pickup-point-radio"
                              />
                              <span className="flex flex-col gap-y-1">
                                <span>{getApishipPointLabel(point)}</span>
                                <span className="text-ui-fg-muted">{getApishipPointAddressLabel(point)}</span>
                              </span>
                            </span>
                            <span className="flex flex-wrap gap-2">
                              {point.providerName && (
                                <span className="w-fit rounded-rounded border border-ui-border-base bg-ui-bg-base px-2 py-1 text-ui-fg-muted txt-compact-small">
                                  {point.providerName}
                                </span>
                              )}
                              {point.timetable && (
                                <span className="w-fit rounded-rounded border border-ui-border-base bg-ui-bg-base px-2 py-1 text-ui-fg-muted txt-compact-small">
                                  {point.timetable}
                                </span>
                              )}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    <Text className="text-ui-fg-muted txt-small" data-testid="apiship-pickup-point-empty">
                      {apishipState.points_status === "ready"
                        ? "По указанному адресу ПВЗ ApiShip не найдены."
                        : "Список ПВЗ пока недоступен."}
                    </Text>
                  )}
                </div>
              </div>

              <div className="rounded-rounded border border-ui-border-base bg-ui-bg-base p-4" data-testid="apiship-tariff-selector">
                <div className="flex flex-col gap-y-3">
                  <Text className="text-ui-fg-base txt-medium-plus">
                    Тариф ApiShip
                  </Text>
                  {apishipTariffs.length > 0 ? (
                    <div className="grid gap-y-2">
                      {apishipTariffs.slice(0, 6).map((tariff, index) => {
                        const tariffId = getApishipTariffId(tariff) ?? `tariff-${index}`
                        const isSelected = tariffId === apishipState.selected_tariff_id
                        const cost = getApishipTariffCost(tariff)

                        return (
                          <label
                            key={tariffId}
                            className={clx(
                              "flex cursor-pointer items-center justify-between rounded-rounded border p-3 text-ui-fg-muted txt-small",
                              isSelected
                                ? "border-ui-border-interactive bg-ui-bg-base"
                                : "border-ui-border-base bg-ui-bg-subtle"
                            )}
                            data-testid="apiship-tariff-option"
                          >
                            <span className="flex items-center gap-x-2 text-ui-fg-base">
                              <input
                                type="radio"
                                name="apiship-tariff"
                                checked={isSelected}
                                onChange={() => {
                                  setApishipState((current) => ({
                                    ...current,
                                    selected_tariff_id: tariffId,
                                    commit_status: "idle",
                                  }))
                                }}
                              />
                              Тариф {tariff.tariffId ?? tariffId}
                              {tariff.providerKey ? ` · ${tariff.providerKey}` : ""}
                            </span>
                            <span>
                              {cost !== null ? formatPrice(cost, cart.currency_code) : "Стоимость уточняется"}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    <Text className="text-ui-fg-muted txt-small">
                      {apishipState.calculation_status === "loading"
                        ? "Рассчитываем тарифы ApiShip…"
                        : "Тарифы ApiShip пока недоступны для этого адреса."}
                    </Text>
                  )}
                </div>
              </div>

              {apishipState.message && (
                <Text className="text-ui-fg-muted txt-small" data-testid="apiship-customer-save-message">
                  {apishipState.message}
                </Text>
              )}

              <Button
                size="small"
                variant="secondary"
                type="button"
                disabled={!canSaveApishipSelection || apishipMutationInFlight}
                onClick={() => {
                  void handleSaveApishipSelection()
                }}
                data-testid="apiship-customer-save-selection-button"
              >
                {apishipMutationInFlight ? (
                  <span className="flex items-center gap-x-2">
                    <Loader /> Сохраняем ApiShip доставку
                  </span>
                ) : (
                  "Сохранить ApiShip доставку"
                )}
              </Button>
            </div>
          </div>

          <div>
            <ErrorMessage
              error={error}
              data-testid="delivery-option-error-message"
            />
            <Button
              size="large"
              className="mt"
              onClick={handleSubmit}
              isLoading={isLoading || apishipMutationInFlight}
              disabled={!canContinueToPayment || apishipMutationInFlight}
              data-testid="submit-delivery-option-button"
            >
              {deliverySubmitButtonLabel}
            </Button>
          </div>
        </>
      ) : (
        <div className="text-small-regular">
          {cart && (cart.shipping_methods?.length ?? 0) > 0 && (
            <div className="flex w-full flex-col gap-y-1 small:w-1/3">
              <Text className="mb-1 text-ui-fg-base txt-medium-plus">
                {checkoutCopy.method}
              </Text>
                <ShippingSummary
                  cart={cart}
                  availableShippingMethods={shippingMethods}
                />
            </div>
          )}
        </div>
      )}
      <Divider className="mt-8" />
    </div>
  )
}

export default Shipping
