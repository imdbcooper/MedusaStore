"use client"

import { Radio, RadioGroup } from "@headlessui/react"
import {
  getApiShipStorefrontSettings,
  listApiShipPoints,
  listApiShipRates,
} from "@lib/data/apiship"
import { setShippingMethod } from "@lib/data/cart"
import {
  listDeliveryHubPickupPoints,
  listDeliveryHubPickupWindows,
  listDeliveryHubQuotes,
  retrieveDeliveryHubReadiness,
  retrieveDeliveryHubSelection,
  retrieveDeliveryHubSettings,
} from "@lib/data/delivery-hub"
import { calculatePriceForShippingOption } from "@lib/data/fulfillment"
import { storefrontConfig } from "@lib/storefront-config"
import {
  apiShipSelectionsEqual,
  buildApiShipAddressFingerprint,
  buildApiShipShippingSelectionData,
  formatApiShipEtaLabel,
  getApiShipPointLabel,
  getApiShipQuoteTitle,
  getApiShipShippingOptionLabel,
  getApiShipStorefrontModeSettings,
  isApiShipSelectionFresh,
  isApiShipShippingOption,
  quoteMatchesApiShipSelection,
  readApiShipShippingSelectionData,
  type ApiShipPoint,
  type ApiShipRateGroup,
  type ApiShipRateQuote,
  type ApiShipShopperModeKey,
  type ApiShipStorefrontSettings,
} from "@lib/util/apiship"
import {
  buildDeliveryHubHandoffContractMatrixPreviewModel,
  buildDeliveryHubHandoffPreviewModel,
  buildDeliveryHubNeutralSelectionRehearsalModel,
  buildDeliveryHubPersistedSelectionContractParityPreviewModel,
  buildDeliveryHubShippingOptionParityPreviewModel,
  evaluateDeliveryHubNeutralSelectionRehearsalActionability,
  type DeliveryHubNeutralSelectionRehearsalInput,
  type DeliveryHubNeutralSelectionRehearsalModel,
} from "@lib/util/delivery-hub"
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

type ApiShipSettingsState = {
  status: "idle" | "loading" | "ready" | "error"
  settings: ApiShipStorefrontSettings | null
}

type ApiShipRatesState = {
  status: "idle" | "loading" | "ready" | "error"
  groupedQuotes: ApiShipRateGroup[]
  selectedProviderKey: string | null
  selectedQuoteKey: string | null
  requestKey: string | null
  code: string | null
  message: string | null
}

type ApiShipPointsState = {
  status: "idle" | "loading" | "ready" | "error"
  points: ApiShipPoint[]
  selectedPointId: number | null
  requestKey: string | null
  code: string | null
  message: string | null
}

type DeliveryHubRehearsalState = {
  status: "idle" | "loading" | "ready" | "error"
  model: DeliveryHubNeutralSelectionRehearsalModel
  preview_input: DeliveryHubNeutralSelectionRehearsalInput
  issue_message: string | null
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

function resolveApiShipRatesMessage(code: string | null, fallback: string) {
  switch (code) {
    case "shipping_address_incomplete":
      return "Заполните страну, город и адрес доставки, чтобы получить тарифы ApiShip."
    case "apiship_disabled":
      return "Доставка ApiShip сейчас недоступна."
    case "apiship_calculation_unavailable":
      return "Не удалось получить тарифы ApiShip для текущего адреса. Попробуйте ещё раз чуть позже."
    case "apiship_quotes_unavailable":
      return "Для текущего адреса и корзины не найдено доступных тарифов ApiShip по этому способу доставки."
    case "apiship_option_not_found":
      return "Вариант доставки ApiShip сейчас недоступен."
    case "request_failed":
      return "Не удалось связаться с ApiShip. Попробуйте ещё раз чуть позже."
    default:
      return fallback
  }
}

function resolveApiShipPointsMessage(code: string | null, fallback: string) {
  switch (code) {
    case "shipping_address_incomplete":
      return "Заполните адрес доставки, чтобы загрузить пункты выдачи."
    case "apiship_calculation_unavailable":
      return "Не удалось подготовить список пунктов выдачи для выбранного тарифа. Попробуйте обновить адрес или выбрать другой тариф."
    case "apiship_points_unavailable":
      return "Для выбранного тарифа сейчас нет доступных пунктов выдачи по этому адресу."
    case "request_failed":
      return "Не удалось загрузить пункты выдачи. Попробуйте ещё раз чуть позже."
    default:
      return fallback
  }
}

function getDefaultProviderKey(groups: ApiShipRateGroup[]) {
  return groups[0]?.provider_key ?? null
}

function getApiShipModeKeyFromOption(
  option: HttpTypes.StoreCartShippingOption | null | undefined,
  settings?: ApiShipStorefrontSettings | null
): ApiShipShopperModeKey | null {
  const configuredMode = getApiShipStorefrontModeSettings(settings, option)

  if (configuredMode?.mode_key) {
    return configuredMode.mode_key
  }

  const dataId =
    typeof option?.data?.id === "string" && option.data.id.trim()
      ? option.data.id.trim()
      : null

  if (dataId === "apiship_to_door" || dataId === "apiship_to_point") {
    return dataId
  }

  if (option?.id === "apiship_to_door" || option?.id === "apiship_to_point") {
    return option.id
  }

  return null
}

function findApiShipOptionByModeKey(
  options: HttpTypes.StoreCartShippingOption[],
  modeKey: ApiShipShopperModeKey | null | undefined,
  settings?: ApiShipStorefrontSettings | null
) {
  if (!modeKey) {
    return null
  }

  return (
    options.find((option) => getApiShipModeKeyFromOption(option, settings) === modeKey) ??
    null
  )
}

function resolvePreferredShippingMethodId(input: {
  shippingMethods: HttpTypes.StoreCartShippingOption[]
  shippingMethod: HttpTypes.StoreCartShippingMethod | undefined
  selection: ReturnType<typeof readApiShipShippingSelectionData>
  settings?: ApiShipStorefrontSettings | null
}) {
  const { shippingMethods, shippingMethod, selection, settings } = input
  const persistedShippingOptionId = shippingMethod?.shipping_option_id ?? null

  if (
    persistedShippingOptionId &&
    shippingMethods.some((option) => option.id === persistedShippingOptionId)
  ) {
    return persistedShippingOptionId
  }

  if (selection?.shipping_option_id) {
    const matchingSelectionOption = shippingMethods.find(
      (option) => option.id === selection.shipping_option_id
    )

    if (matchingSelectionOption) {
      return matchingSelectionOption.id
    }
  }

  if (selection?.mode_key) {
    return findApiShipOptionByModeKey(shippingMethods, selection.mode_key, settings)?.id ?? null
  }

  return persistedShippingOptionId
}

function findQuoteByQuoteKey(
  groups: ApiShipRateGroup[],
  quoteKey: string | null
): ApiShipRateQuote | null {
  if (!quoteKey) {
    return null
  }

  for (const group of groups) {
    const quote = group.tariffs.find((entry) => entry.quote_key === quoteKey)

    if (quote) {
      return quote
    }
  }

  return null
}

function findQuoteBySelection(
  groups: ApiShipRateGroup[],
  shippingMethod: HttpTypes.StoreCartShippingMethod | undefined
) {
  const selection = readApiShipShippingSelectionData(shippingMethod)

  if (!selection) {
    return null
  }

  for (const group of groups) {
    const quote = group.tariffs.find((entry) =>
      quoteMatchesApiShipSelection(entry, selection)
    )

    if (quote) {
      return quote
    }
  }

  return null
}

function findPointBySelection(
  points: ApiShipPoint[],
  shippingMethod: HttpTypes.StoreCartShippingMethod | undefined
) {
  const selection = readApiShipShippingSelectionData(shippingMethod)

  if (!selection?.point_out_id) {
    return null
  }

  return points.find((point) => point.id === selection.point_out_id) ?? null
}

function filterApiShipGroupedQuotes(groups: ApiShipRateGroup[]) {
  return groups
    .map((group) => {
      const tariffs = group.tariffs.filter((quote) => {
        if (quote.delivery_type !== 2) {
          return true
        }

        return quote.point_ids.length > 0
      })

      if (!tariffs.length) {
        return null
      }

      return {
        ...group,
        tariffs,
      }
    })
    .filter((group): group is ApiShipRateGroup => group !== null)
}

const Shipping: React.FC<ShippingProps> = ({
  cart,
  availableShippingMethods,
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingPrices, setIsLoadingPrices] = useState(true)
  const [calculatedPricesMap, setCalculatedPricesMap] = useState<
    Record<string, number>
  >({})
  const [apiShipSettingsState, setApiShipSettingsState] =
    useState<ApiShipSettingsState>({
      status: "idle",
      settings: null,
    })
  const [apiShipRatesMap, setApiShipRatesMap] = useState<
    Record<string, ApiShipRatesState>
  >({})
  const [apiShipPointsMap, setApiShipPointsMap] = useState<
    Record<string, ApiShipPointsState>
  >({})
  const [deliveryHubRehearsalState, setDeliveryHubRehearsalState] =
    useState<DeliveryHubRehearsalState>({
      status: "idle",
      model: buildDeliveryHubNeutralSelectionRehearsalModel({
        legacy_context: {
          active_commit_path: "legacy_apiship",
          legacy_is_committed: false,
          legacy_flow_kind: null,
          legacy_selection_fresh: false,
          legacy_method_label: null,
        },
      }),
      preview_input: {
        legacy_context: {
          active_commit_path: "legacy_apiship",
          legacy_is_committed: false,
          legacy_flow_kind: null,
          legacy_selection_fresh: false,
          legacy_method_label: null,
        },
      },
      issue_message: null,
    })
  const [error, setError] = useState<string | null>(null)

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const isOpen = searchParams.get("step") === "delivery"

  const checkoutCopy = storefrontConfig.copy.checkout
  const commonCopy = storefrontConfig.copy.common
  const cartShippingMethod = cart.shipping_methods?.at(-1)
  const cartApiShipSelection = readApiShipShippingSelectionData(cartShippingMethod)
  const addressFingerprint = useMemo(
    () => buildApiShipAddressFingerprint(cart.shipping_address),
    [
      cart.shipping_address?.address_1,
      cart.shipping_address?.city,
      cart.shipping_address?.country_code,
      cart.shipping_address?.postal_code,
      cart.shipping_address?.province,
    ]
  )

  const shippingMethods = useMemo(
    () => (availableShippingMethods ?? []).filter(isCheckoutEligibleShippingOption),
    [availableShippingMethods]
  )
  const standardMethods = useMemo(
    () => shippingMethods.filter((option) => !isApiShipShippingOption(option)),
    [shippingMethods]
  )
  const apiShipMethods = useMemo(
    () => shippingMethods.filter(isApiShipShippingOption),
    [shippingMethods]
  )
  const hasFreshCartApiShipSelection = useMemo(
    () => isApiShipSelectionFresh(cartApiShipSelection, addressFingerprint),
    [cartApiShipSelection, addressFingerprint]
  )
  const preferredCartShippingMethodId = useMemo(
    () =>
      resolvePreferredShippingMethodId({
        shippingMethods,
        shippingMethod: cartShippingMethod,
        selection: cartApiShipSelection,
        settings: apiShipSettingsState.settings,
      }),
    [
      shippingMethods,
      cartShippingMethod,
      cartApiShipSelection,
      apiShipSettingsState.settings,
    ]
  )
  const [shippingMethodId, setShippingMethodId] = useState<string | null>(
    preferredCartShippingMethodId
  )

  useEffect(() => {
    setApiShipSettingsState({
      status: "loading",
      settings: null,
    })

    getApiShipStorefrontSettings()
      .then((settings) => {
        setApiShipSettingsState({
          status: settings ? "ready" : "error",
          settings,
        })
      })
      .catch(() => {
        setApiShipSettingsState({
          status: "error",
          settings: null,
        })
      })
  }, [])

  useEffect(() => {
    setShippingMethodId((current) =>
      current === preferredCartShippingMethodId ? current : preferredCartShippingMethodId
    )
  }, [preferredCartShippingMethodId])

  useEffect(() => {
    setIsLoadingPrices(true)

    if (!standardMethods.length) {
      setCalculatedPricesMap({})
      setIsLoadingPrices(false)
      return
    }

    Promise.allSettled(
      standardMethods
        .filter((option) => option.price_type === "calculated")
        .map((option) => calculatePriceForShippingOption(option.id, cart.id))
    ).then((results) => {
      const pricesMap: Record<string, number> = {}

      results.forEach((result) => {
        if (result.status !== "fulfilled") {
          return
        }

        if (result.value?.id && typeof result.value.amount === "number") {
          pricesMap[result.value.id] = result.value.amount
        }
      })

      setCalculatedPricesMap(pricesMap)
      setIsLoadingPrices(false)
    })
  }, [cart.id, standardMethods])

  useEffect(() => {
    if (!apiShipMethods.length || apiShipSettingsState.status !== "ready") {
      return
    }

    apiShipMethods.forEach((option) => {
      const modeSettings = getApiShipStorefrontModeSettings(
        apiShipSettingsState.settings,
        option
      )

      if (!modeSettings?.enabled) {
        setApiShipRatesMap((current) => ({
          ...current,
          [option.id]: {
            status: "error",
            groupedQuotes: [],
            selectedProviderKey: null,
            selectedQuoteKey: null,
            requestKey: null,
            code: "apiship_disabled",
            message: "Этот способ доставки сейчас отключен продавцом.",
          },
        }))
        return
      }

      const requestKey = `${cart.id}:${option.id}:${addressFingerprint ?? "no-address"}`

      setApiShipRatesMap((current) => ({
        ...current,
        [option.id]: {
          status: "loading",
          groupedQuotes: [],
          selectedProviderKey: null,
          selectedQuoteKey: null,
          requestKey,
          code: null,
          message: null,
        },
      }))

      listApiShipRates(cart.id, option.id)
        .then((response) => {
          if (response?.settings) {
            setApiShipSettingsState((current) =>
              current.settings
                ? current
                : {
                    status: "ready",
                    settings: response.settings ?? null,
                  }
            )
          }

          const groupedQuotes = filterApiShipGroupedQuotes(
            response?.grouped_quotes ?? []
          )
          const cartSelectedQuote =
            preferredCartShippingMethodId === option.id && hasFreshCartApiShipSelection
              ? findQuoteBySelection(groupedQuotes, cartShippingMethod)
              : null
          const code = response?.code ?? (groupedQuotes.length ? null : "apiship_quotes_unavailable")
          const message =
            groupedQuotes.length > 0 && !code
              ? null
              : resolveApiShipRatesMessage(
                  code,
                  "Тарифы ApiShip сейчас недоступны."
                )

          setApiShipRatesMap((current) => {
            if (current[option.id]?.requestKey !== requestKey) {
              return current
            }

            return {
              ...current,
              [option.id]: {
                status: groupedQuotes.length > 0 && !code ? "ready" : "error",
                groupedQuotes,
                selectedProviderKey:
                  cartSelectedQuote?.provider_key ?? getDefaultProviderKey(groupedQuotes),
                selectedQuoteKey: cartSelectedQuote?.quote_key ?? null,
                requestKey,
                code,
                message,
              },
            }
          })
        })
        .catch(() => {
          setApiShipRatesMap((current) => {
            if (current[option.id]?.requestKey !== requestKey) {
              return current
            }

            return {
              ...current,
              [option.id]: {
                status: "error",
                groupedQuotes: [],
                selectedProviderKey: null,
                selectedQuoteKey: null,
                requestKey,
                code: "request_failed",
                message: resolveApiShipRatesMessage(
                  "request_failed",
                  "Тарифы ApiShip сейчас недоступны."
                ),
              },
            }
          })
        })
    })
  }, [
    apiShipMethods,
    apiShipSettingsState.settings,
    apiShipSettingsState.status,
    addressFingerprint,
    cart.id,
    cartShippingMethod,
    hasFreshCartApiShipSelection,
    preferredCartShippingMethodId,
  ])

  useEffect(() => {
    apiShipMethods.forEach((option) => {
      const ratesState = apiShipRatesMap[option.id]
      const currentPointsState = apiShipPointsMap[option.id]
      const selectedProviderGroup =
        ratesState?.groupedQuotes.find(
          (group) => group.provider_key === ratesState.selectedProviderKey
        ) ?? ratesState?.groupedQuotes[0]
      const selectedQuote = findQuoteByQuoteKey(
        ratesState?.groupedQuotes ?? [],
        ratesState?.selectedQuoteKey ?? null
      )
      const quoteForPoints = selectedQuote ?? selectedProviderGroup?.tariffs[0] ?? null

      if (!quoteForPoints || quoteForPoints.delivery_type !== 2) {
        if (
          currentPointsState?.status === "idle" &&
          currentPointsState.requestKey === null &&
          currentPointsState.points.length === 0 &&
          currentPointsState.selectedPointId === null
        ) {
          return
        }

        setApiShipPointsMap((current) => ({
          ...current,
          [option.id]: {
            status: "idle",
            points: [],
            selectedPointId: null,
            requestKey: null,
            code: null,
            message: null,
          },
        }))
        return
      }

      const requestKey = `${cart.id}:${option.id}:${addressFingerprint ?? "no-address"}:${quoteForPoints.quote_key}`

      if (currentPointsState?.requestKey === requestKey) {
        return
      }

      setApiShipPointsMap((current) => ({
        ...current,
        [option.id]: {
          status: "loading",
          points: [],
          selectedPointId: null,
          requestKey,
          code: null,
          message: null,
        },
      }))

      listApiShipPoints({
        cartId: cart.id,
        shippingOptionId: option.id,
        providerKey: quoteForPoints.provider_key,
        tariffId: quoteForPoints.tariff_id,
        pickupType: quoteForPoints.pickup_type,
        deliveryType: quoteForPoints.delivery_type,
      })
        .then((response) => {
          const points = response?.points ?? []
          const cartPoint =
            preferredCartShippingMethodId === option.id && hasFreshCartApiShipSelection
              ? findPointBySelection(points, cartShippingMethod)
              : null
          const code = response?.code ?? (points.length ? null : "apiship_points_unavailable")
          const message =
            points.length > 0 && !code
              ? null
              : resolveApiShipPointsMessage(
                  code,
                  "Пункты выдачи сейчас недоступны."
                )

          setApiShipPointsMap((current) => {
            if (current[option.id]?.requestKey !== requestKey) {
              return current
            }

            return {
              ...current,
              [option.id]: {
                status: points.length > 0 && !code ? "ready" : "error",
                points,
                selectedPointId: cartPoint?.id ?? null,
                requestKey,
                code,
                message,
              },
            }
          })
        })
        .catch(() => {
          setApiShipPointsMap((current) => {
            if (current[option.id]?.requestKey !== requestKey) {
              return current
            }

            return {
              ...current,
              [option.id]: {
                status: "error",
                points: [],
                selectedPointId: null,
                requestKey,
                code: "request_failed",
                message: resolveApiShipPointsMessage(
                  "request_failed",
                  "Пункты выдачи сейчас недоступны."
                ),
              },
            }
          })
        })
    })
  }, [
    apiShipMethods,
    apiShipPointsMap,
    apiShipRatesMap,
    addressFingerprint,
    cart.id,
    cartShippingMethod,
    hasFreshCartApiShipSelection,
    preferredCartShippingMethodId,
  ])

  useEffect(() => {
    let cancelled = false

    setDeliveryHubRehearsalState((current) => ({
      ...current,
      status: "loading",
      issue_message: null,
    }))

    Promise.allSettled([
      retrieveDeliveryHubSettings(),
      retrieveDeliveryHubSelection(cart.id),
      retrieveDeliveryHubReadiness(cart.id),
      listDeliveryHubPickupPoints({
        city: cart.shipping_address?.city,
        country_code: cart.shipping_address?.country_code,
      }),
      listDeliveryHubPickupWindows(),
    ])
      .then(async (results) => {
        if (cancelled) {
          return
        }

        const settings = results[0].status === "fulfilled" ? results[0].value : null
        const selection = results[1].status === "fulfilled" ? results[1].value : null
        const readiness = results[2].status === "fulfilled" ? results[2].value : null
        const pickupPoints = results[3].status === "fulfilled" ? results[3].value : null
        const pickupWindows = results[4].status === "fulfilled" ? results[4].value : null
        const destinationPoint =
          pickupPoints?.points.find((point) => point.is_destination_pickup_allowed) ??
          pickupPoints?.points[0] ??
          null
        const modeCode =
          readiness?.quote_context?.quote_type ??
          selection?.selection?.quote_type ??
          "warehouse_to_pickup_point"
        const quotes = destinationPoint
          ? await listDeliveryHubQuotes({
              mode_code: modeCode,
              currency_code: cart.currency_code,
              destination_point_id: destinationPoint.provider_point_id,
            })
          : null

        if (cancelled) {
          return
        }

        const previewInput: DeliveryHubNeutralSelectionRehearsalInput = {
          settings,
          quotes,
          pickup_points: pickupPoints,
          pickup_windows: pickupWindows,
          persisted_selection: selection,
          readiness,
          legacy_context: {
            active_commit_path: "legacy_apiship",
            legacy_is_committed: Boolean(preferredCartShippingMethodId),
            legacy_flow_kind:
              cartApiShipSelection?.mode_key === "apiship_to_point"
                ? "pickup_point"
                : cartApiShipSelection?.mode_key === "apiship_to_door"
                  ? "door_delivery"
                  : null,
            legacy_selection_fresh: hasFreshCartApiShipSelection,
            legacy_method_label: cartShippingMethod?.name ?? null,
          },
        }

        setDeliveryHubRehearsalState({
          status: "ready",
          model: buildDeliveryHubNeutralSelectionRehearsalModel(previewInput),
          preview_input: previewInput,
          issue_message: null,
        })
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        const previewInput: DeliveryHubNeutralSelectionRehearsalInput = {
          legacy_context: {
            active_commit_path: "legacy_apiship",
            legacy_is_committed: Boolean(preferredCartShippingMethodId),
            legacy_flow_kind:
              cartApiShipSelection?.mode_key === "apiship_to_point"
                ? "pickup_point"
                : cartApiShipSelection?.mode_key === "apiship_to_door"
                  ? "door_delivery"
                  : null,
            legacy_selection_fresh: hasFreshCartApiShipSelection,
            legacy_method_label: cartShippingMethod?.name ?? null,
          },
        }

        setDeliveryHubRehearsalState({
          status: "error",
          model: buildDeliveryHubNeutralSelectionRehearsalModel(previewInput),
          preview_input: previewInput,
          issue_message: "Delivery Hub rehearsal preview is currently unavailable.",
        })
      })

    return () => {
      cancelled = true
    }
  }, [
    cart.currency_code,
    cart.id,
    cart.shipping_address?.city,
    cart.shipping_address?.country_code,
    cartApiShipSelection?.mode_key,
    cartShippingMethod?.name,
    hasFreshCartApiShipSelection,
    preferredCartShippingMethodId,
  ])

  useEffect(() => {
    setError(null)
  }, [isOpen])

  const handleEdit = () => {
    router.push(pathname + "?step=delivery", { scroll: false })
  }

  const handleSubmit = () => {
    router.push(pathname + "?step=payment", { scroll: false })
  }

  const commitShippingMethod = async (
    id: string,
    data?: Record<string, unknown>,
    shopperModeKey?: ApiShipShopperModeKey | null
  ) => {
    setError(null)
    setIsLoading(true)
    const previousId = shippingMethodId
    setShippingMethodId(id)

    await setShippingMethod({
      cartId: cart.id,
      shippingMethodId: id,
      shopperModeKey,
      addressFingerprint,
      data,
    })
      .catch((err) => {
        setShippingMethodId(previousId)
        setError(err.message)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  const handleSelectApiShipProvider = (optionId: string, providerKey: string) => {
    setShippingMethodId(optionId)
    setApiShipRatesMap((current) => {
      const state = current[optionId]
      const providerGroup = state?.groupedQuotes.find(
        (group) => group.provider_key === providerKey
      )
      const firstQuote = providerGroup?.tariffs[0] ?? null

      if (!state) {
        return current
      }

      return {
        ...current,
        [optionId]: {
          ...state,
          selectedProviderKey: providerKey,
          selectedQuoteKey: firstQuote?.quote_key ?? null,
        },
      }
    })
    setError(null)
  }

  const handleSelectApiShipQuote = async (
    optionId: string,
    quote: ApiShipRateQuote
  ) => {
    setShippingMethodId(optionId)
    setApiShipRatesMap((current) => ({
      ...current,
      [optionId]: {
        ...(current[optionId] ?? {
          status: "ready",
          groupedQuotes: [],
          selectedProviderKey: null,
          selectedQuoteKey: null,
          requestKey: null,
          code: null,
          message: null,
        }),
        selectedProviderKey: quote.provider_key,
        selectedQuoteKey: quote.quote_key,
      },
    }))
    setApiShipPointsMap((current) => ({
      ...current,
      [optionId]: {
        ...(current[optionId] ?? {
          status: "idle",
          points: [],
          selectedPointId: null,
          requestKey: null,
          code: null,
          message: null,
        }),
        selectedPointId: null,
      },
    }))
    setError(null)

    if (quote.delivery_type === 1) {
      await commitShippingMethod(
        optionId,
        buildApiShipShippingSelectionData(quote, null, {
          shippingOptionId: optionId,
          addressFingerprint,
        }),
        quote.mode_key
      )
    }
  }

  const handleSelectApiShipPoint = async (optionId: string, point: ApiShipPoint) => {
    const quote = findQuoteByQuoteKey(
      apiShipRatesMap[optionId]?.groupedQuotes ?? [],
      apiShipRatesMap[optionId]?.selectedQuoteKey ?? null
    )

    if (!quote) {
      setError("Сначала выберите службу доставки и тариф.")
      return
    }

    setApiShipPointsMap((current) => ({
      ...current,
      [optionId]: {
        ...(current[optionId] ?? {
          status: "ready",
          points: [],
          selectedPointId: null,
          requestKey: null,
          code: null,
          message: null,
        }),
        selectedPointId: point.id,
      },
    }))

    await commitShippingMethod(
      optionId,
      buildApiShipShippingSelectionData(quote, point, {
        shippingOptionId: optionId,
        addressFingerprint,
      }),
      quote.mode_key
    )
  }

  const getOptionPriceLabel = (option: HttpTypes.StoreCartShippingOption) => {
    if (isApiShipShippingOption(option)) {
      const ratesState = apiShipRatesMap[option.id]
      const selectedQuote = findQuoteByQuoteKey(
        ratesState?.groupedQuotes ?? [],
        ratesState?.selectedQuoteKey ?? null
      )
      const previewQuote = selectedQuote ?? ratesState?.groupedQuotes?.[0]?.tariffs?.[0]

      if (ratesState?.status === "loading" || apiShipSettingsState.status === "loading") {
        return <Loader />
      }

      return previewQuote
        ? formatPrice(previewQuote.amount, cart.currency_code)
        : checkoutCopy.shippingRateUnavailable
    }

    if (option.price_type === "flat") {
      return convertToLocale({
        amount: option.amount!,
        currency_code: cart.currency_code,
      })
    }

    if (typeof calculatedPricesMap[option.id] === "number") {
      return convertToLocale({
        amount: calculatedPricesMap[option.id],
        currency_code: cart.currency_code,
      })
    }

    return isLoadingPrices ? <Loader /> : checkoutCopy.shippingRateUnavailable
  }

  const visibleShippingMethods = shippingMethods.filter((option) => {
    if (!isApiShipShippingOption(option)) {
      return true
    }

    const modeSettings = getApiShipStorefrontModeSettings(
      apiShipSettingsState.settings,
      option
    )

    if (apiShipSettingsState.status === "loading") {
      return true
    }

    return modeSettings?.enabled !== false
  })

  const selectedShippingOption = shippingMethodId
    ? shippingMethods.find((option) => option.id === shippingMethodId) ??
      (cartApiShipSelection
        ? findApiShipOptionByModeKey(
            shippingMethods,
            cartApiShipSelection.mode_key,
            apiShipSettingsState.settings
          )
        : null)
    : null
  const selectedApiShipModeKey =
    getApiShipModeKeyFromOption(selectedShippingOption, apiShipSettingsState.settings) ??
    (shippingMethodId === preferredCartShippingMethodId ? cartApiShipSelection?.mode_key ?? null : null)
  const selectedApiShipOptionId =
    selectedShippingOption && isApiShipShippingOption(selectedShippingOption)
      ? selectedShippingOption.id
      : findApiShipOptionByModeKey(
          apiShipMethods,
          selectedApiShipModeKey,
          apiShipSettingsState.settings
        )?.id ?? null
  const selectedShippingOptionIsApiShip = Boolean(selectedApiShipOptionId)
  const selectedQuote = selectedApiShipOptionId
    ? findQuoteByQuoteKey(
        apiShipRatesMap[selectedApiShipOptionId]?.groupedQuotes ?? [],
        apiShipRatesMap[selectedApiShipOptionId]?.selectedQuoteKey ?? null
      )
    : null
  const selectedPoint =
    selectedApiShipOptionId && apiShipPointsMap[selectedApiShipOptionId]?.selectedPointId
      ? apiShipPointsMap[selectedApiShipOptionId].points.find(
          (point) =>
            point.id === apiShipPointsMap[selectedApiShipOptionId].selectedPointId
        ) ?? null
      : null
  const currentApiShipSelection =
    selectedApiShipOptionId && selectedShippingOptionIsApiShip && selectedQuote
      ? selectedQuote.delivery_type === 2
        ? selectedPoint
          ? buildApiShipShippingSelectionData(selectedQuote, selectedPoint, {
              shippingOptionId: selectedApiShipOptionId,
              addressFingerprint,
            })
          : null
        : buildApiShipShippingSelectionData(selectedQuote, null, {
            shippingOptionId: selectedApiShipOptionId,
            addressFingerprint,
          })
      : null
  const isSelectionCommitted = shippingMethodId
    ? selectedShippingOptionIsApiShip && selectedApiShipOptionId
      ? preferredCartShippingMethodId === selectedApiShipOptionId &&
        hasFreshCartApiShipSelection &&
        apiShipSelectionsEqual(currentApiShipSelection, cartApiShipSelection)
      : cartShippingMethod?.shipping_option_id === shippingMethodId
    : false

  const deliveryHubRehearsalActionability =
    evaluateDeliveryHubNeutralSelectionRehearsalActionability(
      deliveryHubRehearsalState.model
    )
  const deliveryHubHandoffPreview = buildDeliveryHubHandoffPreviewModel(
    deliveryHubRehearsalState.preview_input
  )
  const deliveryHubShippingOptionParityPreview =
    buildDeliveryHubShippingOptionParityPreviewModel(
      deliveryHubRehearsalState.preview_input
    )
  const deliveryHubPersistedSelectionContractParityPreview =
    buildDeliveryHubPersistedSelectionContractParityPreviewModel(
      deliveryHubRehearsalState.preview_input
    )
  const deliveryHubHandoffContractMatrixPreview =
    buildDeliveryHubHandoffContractMatrixPreviewModel(
      deliveryHubRehearsalState.preview_input
    )

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

                    if (isApiShipShippingOption(option)) {
                      setShippingMethodId(option.id)
                      setError(null)
                      return
                    }

                    void commitShippingMethod(option.id)
                  }}
                >
                  {visibleShippingMethods.map((option) => {
                    const isApiShip = isApiShipShippingOption(option)
                    const ratesState = apiShipRatesMap[option.id]
                    const pointsState = apiShipPointsMap[option.id]
                    const selectedProviderGroup =
                      ratesState?.groupedQuotes.find(
                        (group) => group.provider_key === ratesState.selectedProviderKey
                      ) ?? ratesState?.groupedQuotes[0]
                    const optionModeKey = getApiShipModeKeyFromOption(
                      option,
                      apiShipSettingsState.settings
                    )
                    const optionLabel = isApiShip
                      ? getApiShipShippingOptionLabel(
                          option,
                          apiShipSettingsState.settings
                        )
                      : option.name

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
                              {isApiShip && (
                                <span className="mt-1 text-ui-fg-muted txt-small">
                                  {optionModeKey === "apiship_to_point"
                                    ? "Выберите службу, тариф и конкретный пункт выдачи."
                                    : "Выберите службу доставки и тариф ApiShip."}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="justify-self-end text-right text-ui-fg-base">
                            {getOptionPriceLabel(option)}
                          </span>
                        </Radio>

                        {isApiShip && option.id === shippingMethodId && (
                          <div className="rounded-b-rounded border border-t-0 bg-ui-bg-subtle px-6 py-5">
                            {(apiShipSettingsState.status === "loading" ||
                              ratesState?.status === "loading") && (
                              <div className="flex items-center gap-x-2 text-ui-fg-muted txt-small">
                                <Loader />
                                <span>Загружаем варианты ApiShip…</span>
                              </div>
                            )}

                            {apiShipSettingsState.status === "error" && (
                              <Text className="txt-small text-ui-fg-subtle">
                                Не удалось загрузить shopper-настройки ApiShip.
                              </Text>
                            )}

                            {ratesState?.status === "ready" && selectedProviderGroup && (
                              <div className="flex flex-col gap-y-5">
                                <Text className="text-ui-fg-muted txt-small">
                                  {selectedProviderGroup.mode_label}
                                  {isSelectionCommitted &&
                                  selectedApiShipOptionId === option.id
                                    ? " · Выбрано"
                                    : ""}
                                </Text>
                                {!hasFreshCartApiShipSelection &&
                                  preferredCartShippingMethodId === option.id &&
                                  cartApiShipSelection && (
                                    <Text className="rounded-rounded border border-ui-border-base bg-ui-bg-base px-3 py-2 text-ui-fg-muted txt-small">
                                      Адрес доставки изменился. Выберите тариф и, при необходимости, пункт выдачи заново для нового адреса.
                                    </Text>
                                  )}
                                <div>
                                  <Text className="mb-3 text-ui-fg-base txt-medium-plus">
                                    Служба доставки
                                  </Text>
                                  <RadioGroup
                                    value={ratesState.selectedProviderKey}
                                    onChange={(providerKey) => {
                                      if (providerKey) {
                                        handleSelectApiShipProvider(option.id, providerKey)
                                      }
                                    }}
                                  >
                                    <div className="grid gap-2">
                                      {ratesState.groupedQuotes.map((group) => {
                                        const cheapestQuote = group.tariffs[0]
                                        const etaLabel = formatApiShipEtaLabel(
                                          cheapestQuote.eta.min,
                                          cheapestQuote.eta.max
                                        )

                                        return (
                                          <Radio
                                            key={group.provider_key}
                                            value={group.provider_key}
                                            className={clx(
                                              "cursor-pointer rounded-rounded border bg-white px-4 py-3",
                                              {
                                                "border-ui-border-interactive":
                                                  group.provider_key ===
                                                  ratesState.selectedProviderKey,
                                              }
                                            )}
                                          >
                                            <div className="flex items-center justify-between gap-4">
                                              <div className="flex items-center gap-x-3">
                                                <MedusaRadio
                                                  checked={
                                                    group.provider_key ===
                                                    ratesState.selectedProviderKey
                                                  }
                                                />
                                                <div className="flex flex-col">
                                                  <span className="text-base-regular">
                                                    {group.provider_label}
                                                  </span>
                                                  <span className="text-ui-fg-muted txt-small">
                                                    от {formatPrice(cheapestQuote.amount, cart.currency_code)}
                                                    {etaLabel ? ` · ${etaLabel}` : ""}
                                                  </span>
                                                </div>
                                              </div>
                                              <span className="text-ui-fg-muted txt-small">
                                                {group.tariffs.length} тариф.
                                              </span>
                                            </div>
                                          </Radio>
                                        )
                                      })}
                                    </div>
                                  </RadioGroup>
                                </div>

                                <div>
                                  <Text className="mb-3 text-ui-fg-base txt-medium-plus">
                                    Тариф
                                  </Text>
                                  <RadioGroup
                                    value={ratesState.selectedQuoteKey}
                                    onChange={(quoteKey) => {
                                      const quote = selectedProviderGroup.tariffs.find(
                                        (entry) => entry.quote_key === quoteKey
                                      )

                                      if (quote) {
                                        void handleSelectApiShipQuote(option.id, quote)
                                      }
                                    }}
                                  >
                                    <div className="grid gap-2">
                                      {selectedProviderGroup.tariffs.map((quote) => {
                                        const etaLabel = formatApiShipEtaLabel(
                                          quote.eta.min,
                                          quote.eta.max
                                        )
                                        const isSelected =
                                          quote.quote_key === ratesState.selectedQuoteKey

                                        return (
                                          <Radio
                                            key={quote.quote_key}
                                            value={quote.quote_key}
                                            className={clx(
                                              "cursor-pointer rounded-rounded border bg-white px-4 py-3",
                                              {
                                                "border-ui-border-interactive": isSelected,
                                              }
                                            )}
                                          >
                                            <div className="flex items-center justify-between gap-4">
                                              <div className="flex items-center gap-x-3">
                                                <MedusaRadio checked={isSelected} />
                                                <div className="flex flex-col">
                                                  <span className="text-base-regular">
                                                    {getApiShipQuoteTitle(quote)}
                                                  </span>
                                                  <span className="text-ui-fg-muted txt-small">
                                                    {etaLabel ?? "Срок уточняется"}
                                                  </span>
                                                </div>
                                              </div>
                                              <span className="text-base-regular text-right">
                                                {formatPrice(quote.amount, cart.currency_code)}
                                              </span>
                                            </div>
                                          </Radio>
                                        )
                                      })}
                                    </div>
                                  </RadioGroup>
                                </div>

                                {selectedProviderGroup.delivery_type === 2 && (
                                  <div>
                                    <Text className="mb-3 text-ui-fg-base txt-medium-plus">
                                      Пункт выдачи
                                    </Text>

                                    {pointsState?.status === "loading" && (
                                      <div className="flex items-center gap-x-2 text-ui-fg-muted txt-small">
                                        <Loader />
                                        <span>Загружаем пункты выдачи…</span>
                                      </div>
                                    )}

                                    {pointsState?.status === "error" && (
                                      <Text className="txt-small text-ui-fg-subtle">
                                        {pointsState.message}
                                      </Text>
                                    )}

                                    {pointsState?.status === "ready" && (
                                      <div className="grid gap-2">
                                        <Text className="mb-1 text-ui-fg-muted txt-small">
                                          Выберите конкретный пункт выдачи, чтобы сохранить способ доставки.
                                        </Text>
                                        {!ratesState.selectedQuoteKey && (
                                          <Text className="text-ui-fg-muted txt-small">
                                            Список пунктов уже обновлён для текущего адреса. Чтобы сохранить доставку, сначала подтвердите тариф.
                                          </Text>
                                        )}
                                        {pointsState.selectedPointId && (
                                          <Text className="text-ui-fg-muted txt-small">
                                            Выбранный пункт будет сохранён в заказе вместе с тарифом ApiShip.
                                          </Text>
                                        )}
                                        {pointsState.points.map((point) => {
                                          const isSelected =
                                            point.id === pointsState.selectedPointId

                                          return (
                                            <button
                                              key={point.id}
                                              type="button"
                                              onClick={() =>
                                                void handleSelectApiShipPoint(option.id, point)
                                              }
                                              className={clx(
                                                "rounded-rounded border bg-white px-4 py-3 text-left",
                                                {
                                                  "border-ui-border-interactive": isSelected,
                                                }
                                              )}
                                            >
                                              <div className="flex items-start gap-x-3">
                                                <MedusaRadio checked={isSelected} />
                                                <div className="flex flex-col gap-y-1">
                                                  <span className="text-base-regular">
                                                    {getApiShipPointLabel(point)}
                                                  </span>
                                                  {point.address && (
                                                    <span className="text-ui-fg-muted txt-small">
                                                      {point.address}
                                                    </span>
                                                  )}
                                                  {point.timetable && (
                                                    <span className="text-ui-fg-muted txt-small">
                                                      {point.timetable}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            </button>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {ratesState?.status === "error" && (
                              <div className="flex flex-col gap-y-2">
                                <Text className="txt-small text-ui-fg-subtle">
                                  {ratesState.message ?? checkoutCopy.shippingRateUnavailable}
                                </Text>
                                {!hasFreshCartApiShipSelection &&
                                  preferredCartShippingMethodId === option.id &&
                                  cartApiShipSelection && (
                                    <Text className="txt-small text-ui-fg-muted">
                                      Предыдущий тариф для старого адреса больше не считается выбранным. После обновления адреса нужно выбрать новый доступный вариант.
                                    </Text>
                                  )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </RadioGroup>
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-rounded border border-ui-border-base bg-ui-bg-subtle px-5 py-4">
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-col gap-y-2">
                <Text className="text-ui-fg-base txt-medium-plus">
                  Delivery Hub neutral selection rehearsal
                </Text>
                <Text className="text-ui-fg-muted txt-small">
                  Pre-cutin rehearsal/read-only only. The active commit path remains legacy ApiShip; no shopper action is performed here.
                </Text>
                {deliveryHubRehearsalState.status === "loading" && (
                  <div className="flex items-center gap-x-2 text-ui-fg-muted txt-small">
                    <Loader />
                    <span>Loading read-only neutral preview…</span>
                  </div>
                )}
                {deliveryHubRehearsalState.issue_message && (
                  <Text className="text-ui-fg-subtle txt-small">
                    {deliveryHubRehearsalState.issue_message}
                  </Text>
                )}
                <div className="grid gap-y-1 text-ui-fg-muted txt-small">
                  <span>{deliveryHubRehearsalState.model.status_label}</span>
                  <span>{deliveryHubRehearsalState.model.active_commit_path_label}</span>
                  <span>Dry-run guard: {deliveryHubRehearsalActionability.verdict}</span>
                  {deliveryHubRehearsalState.model.modality_label && (
                    <span>Neutral modality: {deliveryHubRehearsalState.model.modality_label}</span>
                  )}
                  {deliveryHubRehearsalState.model.quote_amount !== null && (
                    <span>
                      Quote preview: {formatPrice(
                        deliveryHubRehearsalState.model.quote_amount,
                        deliveryHubRehearsalState.model.currency_code
                      )}
                      {deliveryHubRehearsalState.model.quote_eta_label
                        ? ` · ${deliveryHubRehearsalState.model.quote_eta_label}`
                        : ""}
                    </span>
                  )}
                  {deliveryHubRehearsalState.model.pickup_point_label && (
                    <span>Pickup point preview: {deliveryHubRehearsalState.model.pickup_point_label}</span>
                  )}
                  {deliveryHubRehearsalState.model.pickup_window_label && (
                    <span>Pickup window preview: {deliveryHubRehearsalState.model.pickup_window_label}</span>
                  )}
                </div>
                {deliveryHubRehearsalState.model.hint_messages.length > 0 && (
                  <ul className="list-disc pl-4 text-ui-fg-muted txt-small">
                    {deliveryHubRehearsalState.model.hint_messages.slice(0, 3).map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="border-t border-ui-border-base pt-4">
                <div className="flex flex-col gap-y-2">
                  <Text className="text-ui-fg-base txt-medium-plus">
                    Delivery Hub neutral shipping-option parity preview
                  </Text>
                  <Text className="text-ui-fg-muted txt-small">
                    Preview-only parity seam. This block compares the neutral delivery candidate with the current legacy shipping-option context using shopper-safe structural signals only.
                  </Text>
                  <div className="grid gap-y-1 text-ui-fg-muted txt-small">
                    <span>{deliveryHubShippingOptionParityPreview.verdict_label}</span>
                    <span>{deliveryHubShippingOptionParityPreview.summary_label}</span>
                    <span>Preview verdict: {deliveryHubShippingOptionParityPreview.verdict}</span>
                    <span>
                      candidate: {deliveryHubShippingOptionParityPreview.candidate_present ? "present" : "missing"}
                    </span>
                    <span>
                      connection_id: {deliveryHubShippingOptionParityPreview.connection_id ?? "missing"}
                      {` · ${deliveryHubShippingOptionParityPreview.connection_id_signal.status}`}
                    </span>
                    <span>
                      mode_code: {deliveryHubShippingOptionParityPreview.mode_code ?? "missing"}
                      {` · ${deliveryHubShippingOptionParityPreview.mode_code_signal.status}`}
                    </span>
                    {deliveryHubShippingOptionParityPreview.mode_label && (
                      <span>Mode label: {deliveryHubShippingOptionParityPreview.mode_label}</span>
                    )}
                    <span>
                      quote_reference: {deliveryHubShippingOptionParityPreview.quote_reference_present ? "present" : "missing"}
                      {` · ${deliveryHubShippingOptionParityPreview.quote_reference_signal.status}`}
                    </span>
                    <span>
                      pickup point: {deliveryHubShippingOptionParityPreview.pickup_point_present ? "present" : "missing"}
                      {deliveryHubShippingOptionParityPreview.pickup_point_required ? " · required" : " · optional"}
                      {` · ${deliveryHubShippingOptionParityPreview.pickup_point_signal.status}`}
                    </span>
                    <span>
                      pickup window: {deliveryHubShippingOptionParityPreview.pickup_window_present ? "present" : "missing"}
                      {deliveryHubShippingOptionParityPreview.pickup_window_required ? " · required" : " · optional"}
                      {` · ${deliveryHubShippingOptionParityPreview.pickup_window_signal.status}`}
                    </span>
                  </div>
                  {deliveryHubShippingOptionParityPreview.gap_codes.length > 0 && (
                    <div className="text-ui-fg-muted txt-small">
                      Gaps: {deliveryHubShippingOptionParityPreview.gap_codes.join(", ")}
                    </div>
                  )}
                  {deliveryHubShippingOptionParityPreview.hint_messages.length > 0 && (
                    <ul className="list-disc pl-4 text-ui-fg-muted txt-small">
                      {deliveryHubShippingOptionParityPreview.hint_messages
                        .slice(0, 3)
                        .map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="border-t border-ui-border-base pt-4">
                <div className="flex flex-col gap-y-2">
                  <Text className="text-ui-fg-base txt-medium-plus">
                    Delivery Hub persisted selection contract parity preview
                  </Text>
                  <Text className="text-ui-fg-muted txt-small">
                    Preview-only persisted contract seam. This block compares the current neutral selection surfaces with a future persisted contract artifact using shopper-safe diagnostic fields only.
                  </Text>
                  <div className="grid gap-y-1 text-ui-fg-muted txt-small">
                    <span>{deliveryHubPersistedSelectionContractParityPreview.verdict_label}</span>
                    <span>{deliveryHubPersistedSelectionContractParityPreview.summary_label}</span>
                    <span>{deliveryHubPersistedSelectionContractParityPreview.projected_contract_label}</span>
                    <span>
                      Preview verdict: {deliveryHubPersistedSelectionContractParityPreview.verdict}
                    </span>
                    <span>
                      matched fields: {deliveryHubPersistedSelectionContractParityPreview.matched_field_count}
                      {` · mismatched fields: ${deliveryHubPersistedSelectionContractParityPreview.mismatched_field_count}`}
                    </span>
                    <span>
                      connection_id: {deliveryHubPersistedSelectionContractParityPreview.connection_id ?? "missing"}
                    </span>
                    <span>
                      mode_code: {deliveryHubPersistedSelectionContractParityPreview.mode_code ?? "missing"}
                    </span>
                    {deliveryHubPersistedSelectionContractParityPreview.mode_label && (
                      <span>
                        Mode label: {deliveryHubPersistedSelectionContractParityPreview.mode_label}
                      </span>
                    )}
                    <span>
                      quote_reference: {deliveryHubPersistedSelectionContractParityPreview.quote_reference_present ? "present" : "missing"}
                    </span>
                    <span>
                      pickup point: {deliveryHubPersistedSelectionContractParityPreview.pickup_point_present ? "present" : "missing"}
                      {deliveryHubPersistedSelectionContractParityPreview.pickup_point_required
                        ? " · required"
                        : " · not required"}
                    </span>
                    <span>
                      pickup window: {deliveryHubPersistedSelectionContractParityPreview.pickup_window_present ? "present" : "missing"}
                      {deliveryHubPersistedSelectionContractParityPreview.pickup_window_required
                        ? " · required"
                        : " · not required"}
                    </span>
                    {deliveryHubPersistedSelectionContractParityPreview.fields.map((field) => (
                      <span key={field.key}>
                        {field.label}: {field.status} · {field.detail_label}
                      </span>
                    ))}
                  </div>
                  {deliveryHubPersistedSelectionContractParityPreview.mismatch_reasons.length > 0 && (
                    <div className="text-ui-fg-muted txt-small">
                      Mismatch reasons: {deliveryHubPersistedSelectionContractParityPreview.mismatch_reasons.join(" | ")}
                    </div>
                  )}
                  {deliveryHubPersistedSelectionContractParityPreview.blocked_readiness_codes.length > 0 && (
                    <div className="text-ui-fg-muted txt-small">
                      Readiness blockers: shopper-safe preview remains unavailable until the current delivery selection context is ready.
                    </div>
                  )}
                  {deliveryHubPersistedSelectionContractParityPreview.blocked_parity_codes.length > 0 && (
                    <div className="text-ui-fg-muted txt-small">
                      Parity blockers: shopper-safe preview remains unavailable until the current delivery option aligns with the committed checkout context.
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-ui-border-base pt-4">
                <div className="flex flex-col gap-y-2">
                  <Text className="text-ui-fg-base txt-medium-plus">
                    Delivery Hub storefront-to-backend handoff preview
                  </Text>
                  <Text className="text-ui-fg-muted txt-small">
                    Pre-cutin read-only handoff preview seam only. This block shows shopper-safe structural readiness for a candidate backend handoff preview and does not commit checkout.
                  </Text>
                  <div className="grid gap-y-1 text-ui-fg-muted txt-small">
                    <span>{deliveryHubHandoffPreview.verdict_label}</span>
                    <span>{deliveryHubHandoffPreview.readiness_summary_label}</span>
                    <span>Preview verdict: {deliveryHubHandoffPreview.verdict}</span>
                    <span>connection_id: {deliveryHubHandoffPreview.connection_id ?? "missing"}</span>
                    <span>mode_code: {deliveryHubHandoffPreview.mode_code ?? "missing"}</span>
                    {deliveryHubHandoffPreview.mode_label && (
                      <span>Mode label: {deliveryHubHandoffPreview.mode_label}</span>
                    )}
                    <span>
                      quote_reference: {deliveryHubHandoffPreview.quote_reference_present ? "present" : "missing"}
                    </span>
                    <span>
                      pickup point: {deliveryHubHandoffPreview.pickup_point_present ? "present" : "missing"}
                      {deliveryHubHandoffPreview.pickup_point_required ? " · required" : " · optional"}
                    </span>
                    <span>
                      pickup window: {deliveryHubHandoffPreview.pickup_window_present ? "present" : "missing"}
                      {deliveryHubHandoffPreview.pickup_window_required ? " · required" : " · optional"}
                    </span>
                  </div>
                  {deliveryHubHandoffPreview.hint_messages.length > 0 && (
                    <ul className="list-disc pl-4 text-ui-fg-muted txt-small">
                      {deliveryHubHandoffPreview.hint_messages.slice(0, 3).map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="border-t border-ui-border-base pt-4">
                <div className="flex flex-col gap-y-2">
                  <Text className="text-ui-fg-base txt-medium-plus">
                    Delivery Hub handoff contract matrix preview
                  </Text>
                  <Text className="text-ui-fg-muted txt-small">
                    Preview-only contract matrix seam. This block shows shopper-safe contract fragments, blocked readiness/parity conditions, and a read-only completeness verdict for the future neutral handoff contract.
                  </Text>
                  <div className="grid gap-y-1 text-ui-fg-muted txt-small">
                    <span>{deliveryHubHandoffContractMatrixPreview.verdict_label}</span>
                    <span>{deliveryHubHandoffContractMatrixPreview.completeness_label}</span>
                    <span>Preview verdict: {deliveryHubHandoffContractMatrixPreview.verdict}</span>
                    {deliveryHubHandoffContractMatrixPreview.fragments.map((fragment) => (
                      <span key={fragment.key}>
                        {fragment.key}: {fragment.status} · {fragment.detail_label}
                      </span>
                    ))}
                  </div>
                  {deliveryHubHandoffContractMatrixPreview.blocked_readiness_codes.length > 0 && (
                    <div className="text-ui-fg-muted txt-small">
                      Readiness blockers: {deliveryHubHandoffContractMatrixPreview.blocked_readiness_codes.join(", ")}
                    </div>
                  )}
                  {deliveryHubHandoffContractMatrixPreview.blocked_parity_codes.length > 0 && (
                    <div className="text-ui-fg-muted txt-small">
                      Parity blockers: {deliveryHubHandoffContractMatrixPreview.blocked_parity_codes.join(", ")}
                    </div>
                  )}
                  {deliveryHubHandoffContractMatrixPreview.missing_fragment_keys.length > 0 && (
                    <div className="text-ui-fg-muted txt-small">
                      Missing fragments: {deliveryHubHandoffContractMatrixPreview.missing_fragment_keys.join(", ")}
                    </div>
                  )}
                  {deliveryHubHandoffContractMatrixPreview.hint_messages.length > 0 && (
                    <ul className="list-disc pl-4 text-ui-fg-muted txt-small">
                      {deliveryHubHandoffContractMatrixPreview.hint_messages
                        .slice(0, 3)
                        .map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                    </ul>
                  )}
                </div>
              </div>
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
              isLoading={isLoading}
              disabled={!isSelectionCommitted}
              data-testid="submit-delivery-option-button"
            >
              {checkoutCopy.continueToPayment}
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
              <ShippingSummary cart={cart} availableShippingMethods={shippingMethods} />
            </div>
          )}
        </div>
      )}
      <Divider className="mt-8" />
    </div>
  )
}

export default Shipping
