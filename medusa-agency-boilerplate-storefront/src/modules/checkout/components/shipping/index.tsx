"use client"

import { Radio, RadioGroup } from "@headlessui/react"
import { setShippingMethod } from "@lib/data/cart"
import {
  clearDeliveryHubSelection,
  listDeliveryHubCatalog,
  listDeliveryHubPickupPoints,
  previewDeliveryHubQuotes,
  retrieveDeliveryHubCutoverApprovalArtifact,
  retrieveDeliveryHubCutoverCandidate,
  retrieveDeliveryHubCutoverPreconditions,
  retrieveDeliveryHubReadiness,
  retrieveDeliveryHubSelection,
  retrieveDeliveryHubSettings,
  saveDeliveryHubSelection,
} from "@lib/data/delivery-hub"
import { calculatePriceForShippingOption } from "@lib/data/fulfillment"
import {
  DELIVERY_HUB_CHECKOUT_CUTOVER_ENABLED,
  DELIVERY_HUB_PREVIEW_DEFAULT_CONNECTION_ID,
  DELIVERY_HUB_PREVIEW_DEFAULT_DESTINATION_POINT_ID,
  DELIVERY_HUB_PREVIEW_DEFAULT_ORIGIN_POINT_ID,
  DELIVERY_HUB_PREVIEW_DEFAULT_WAREHOUSE_ID,
  DELIVERY_HUB_PREVIEW_DEV_DEFAULTS_ENABLED,
  DELIVERY_HUB_PREVIEW_ENABLED,
} from "@lib/config"
import { storefrontConfig } from "@lib/storefront-config"
import {
  buildDeliveryHubBuyerDeliveryCardModel,
  buildDeliveryHubCheckoutAddressContext,
  buildDeliveryHubCheckoutCutoverGateStatus,
  buildDeliveryHubPickupPointSelectorModel,
  getDeliveryHubPickupPointBuyerCategory,
  buildDeliveryHubCommitEligibilityModel,
  buildDeliveryHubCutoverApprovalArtifactPreviewModel,
  buildDeliveryHubCutoverCandidatePreviewModel,
  buildDeliveryHubCutoverPreconditionsPreviewModel,
  buildDeliveryHubNeutralSelectionRehearsalModel,
  buildDeliveryHubSavedSelectionSummaryModel,
  buildDeliveryHubSelectionSaveCutInPayload,
  evaluateDeliveryHubNeutralSelectionRehearsalActionability,
  type DeliveryHubCutoverApprovalArtifactResponse,
  type DeliveryHubCutoverCandidateResponse,
  type DeliveryHubCutoverPreconditionsResponse,
  type DeliveryHubCheckoutQuoteInput,
  type DeliveryHubNeutralSelectionRehearsalInput,
  type DeliveryHubNeutralSelectionRehearsalModel,
  type DeliveryHubPickupPoint,
  type DeliveryHubPickupPointSelectorQuoteStatus,
  type DeliveryHubPickupPointsResponse,
  type DeliveryHubQuote,
  type DeliveryHubQuoteType,
  type DeliveryHubQuotesResponse,
  type DeliveryHubSelectionResponse,
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
import { useEffect, useMemo, useRef, useState } from "react"

type CheckoutShippingOption = HttpTypes.StoreCartShippingOption & {
  provider?: {
    is_enabled?: boolean
  } | null
}

type ShippingProps = {
  cart: HttpTypes.StoreCart
  availableShippingMethods: HttpTypes.StoreCartShippingOption[] | null
}

type DeliveryHubRehearsalState = {
  status: "idle" | "loading" | "ready" | "error"
  model: DeliveryHubNeutralSelectionRehearsalModel
  preview_input: DeliveryHubNeutralSelectionRehearsalInput
  issue_message: string | null
}

type DeliveryHubCutoverPreconditionsState = {
  status: "idle" | "loading" | "ready" | "unavailable"
  preconditions: DeliveryHubCutoverPreconditionsResponse | null
}

type DeliveryHubCutoverCandidateState = {
  status: "idle" | "loading" | "ready" | "unavailable"
  candidate: DeliveryHubCutoverCandidateResponse | null
}

type DeliveryHubCutoverApprovalArtifactState = {
  status: "idle" | "loading" | "ready" | "unavailable"
  artifact: DeliveryHubCutoverApprovalArtifactResponse | null
}

type DeliveryHubSelectionCutInState = {
  status:
    | "idle"
    | "saving"
    | "saved"
    | "clearing"
    | "cleared"
    | "committing"
    | "committed"
    | "blocked"
    | "error"
  message: string | null
}

type DeliveryHubNeutralPreviewFormState = {
  quote_type: DeliveryHubQuoteType
  connection_id: string
  destination_point_id: string
  origin_point_id: string
  warehouse_id: string
}

type DeliveryHubNeutralPreviewState = {
  status: "idle" | "loading" | "ready" | "saved" | "cleared" | "blocked" | "error"
  quotes: DeliveryHubQuotesResponse | null
  selected_quote_reference_id: string | null
  selection: DeliveryHubSelectionResponse | null
  message: string | null
}

type DeliveryHubPickupPointCategory = "yandex" | "partner"

type DeliveryHubPickupPointState = {
  status: "idle" | "loading" | "ready" | "error"
  points: DeliveryHubPickupPointsResponse | null
  selected_point_id: string | null
  selected_category: DeliveryHubPickupPointCategory
  search_query: string
  quote_retry_nonce: number
  last_request_key: string | null
}

type DeliveryHubBuyerQuoteState = {
  status: DeliveryHubPickupPointSelectorQuoteStatus
  quotes: DeliveryHubQuotesResponse | null
  message: string | null
  request_key: string | null
}

function getDeliveryHubAddressRequestKey(
  addressContext: ReturnType<typeof buildDeliveryHubCheckoutAddressContext>
) {
  if (!addressContext.is_complete) {
    return null
  }

  return [
    addressContext.country_code_upper,
    addressContext.city,
    addressContext.postal_code,
    addressContext.address_1,
  ]
    .filter(Boolean)
    .join("|")
}

function getDeliveryHubDestinationPoints(
  points: DeliveryHubPickupPointsResponse | null | undefined
) {
  return (points?.points ?? []).filter((point) => point.is_destination_pickup_allowed)
}

function getDeliveryHubDestinationPointsByCategory(
  points: DeliveryHubPickupPointsResponse | null | undefined,
  category: DeliveryHubPickupPointCategory
) {
  return getDeliveryHubDestinationPoints(points).filter(
    (point) => getDeliveryHubPickupPointBuyerCategory(point) === category
  )
}

function getDeliveryHubSelectedPickupPoint(
  points: DeliveryHubPickupPointsResponse | null | undefined,
  selectedPointId: string | null | undefined,
  selectedCategory: DeliveryHubPickupPointCategory
) {
  const destinationPoints = getDeliveryHubDestinationPointsByCategory(points, selectedCategory)

  return (
    destinationPoints.find((point) => point.provider_point_id === selectedPointId) ??
    destinationPoints[0] ??
    null
  )
}

function getDeliveryHubSelectedPickupPointId(
  points: DeliveryHubPickupPointsResponse | null | undefined,
  currentPointId: string | null | undefined,
  persistedPointId: string | null | undefined,
  selectedCategory: DeliveryHubPickupPointCategory
) {
  const destinationPoints = getDeliveryHubDestinationPointsByCategory(points, selectedCategory)

  return (
    destinationPoints.find((point) => point.provider_point_id === currentPointId)
      ?.provider_point_id ??
    destinationPoints.find((point) => point.provider_point_id === persistedPointId)
      ?.provider_point_id ??
    destinationPoints[0]?.provider_point_id ??
    null
  )
}

function getDeliveryHubPickupPointLabel(point: DeliveryHubPickupPoint) {
  return [point.name, point.address].filter(Boolean).join(" · ")
}

function buildDeliveryHubQuoteDestinationAddress(
  point: DeliveryHubPickupPoint,
  addressContext: ReturnType<typeof buildDeliveryHubCheckoutAddressContext>
) {
  const fullname = [
    point.postal_code ?? addressContext.postal_code,
    point.city ?? addressContext.city,
    point.address,
  ]
    .filter(Boolean)
    .join(", ")

  return {
    fullname,
    coordinates:
      typeof point.lng === "number" && typeof point.lat === "number"
        ? [point.lng, point.lat] as [number, number]
        : null,
    contact: {
      name: addressContext.recipient_label,
      phone: addressContext.phone,
    },
  }
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


const Shipping: React.FC<ShippingProps> = ({
  cart,
  availableShippingMethods,
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingPrices, setIsLoadingPrices] = useState(true)
  const [calculatedPricesMap, setCalculatedPricesMap] = useState<
    Record<string, number>
  >({})
  const [deliveryHubRehearsalState, setDeliveryHubRehearsalState] =
    useState<DeliveryHubRehearsalState>({
      status: "idle",
      model: buildDeliveryHubNeutralSelectionRehearsalModel({
        legacy_context: {
          active_commit_path: "delivery_hub",
          legacy_is_committed: false,
          legacy_flow_kind: null,
          legacy_selection_fresh: false,
          legacy_method_label: null,
        },
      }),
      preview_input: {
        legacy_context: {
          active_commit_path: "delivery_hub",
          legacy_is_committed: false,
          legacy_flow_kind: null,
          legacy_selection_fresh: false,
          legacy_method_label: null,
        },
      },
      issue_message: null,
    })
  const [deliveryHubSelectionCutInState, setDeliveryHubSelectionCutInState] =
    useState<DeliveryHubSelectionCutInState>({
      status: "idle",
      message: null,
    })
  const [deliveryHubCutoverPreconditionsState, setDeliveryHubCutoverPreconditionsState] =
    useState<DeliveryHubCutoverPreconditionsState>({
      status: "idle",
      preconditions: null,
    })
  const [deliveryHubCutoverCandidateState, setDeliveryHubCutoverCandidateState] =
    useState<DeliveryHubCutoverCandidateState>({
      status: "idle",
      candidate: null,
    })
  const [deliveryHubCutoverApprovalArtifactState, setDeliveryHubCutoverApprovalArtifactState] =
    useState<DeliveryHubCutoverApprovalArtifactState>({
      status: "idle",
      artifact: null,
    })
  const [deliveryHubNeutralPreviewForm, setDeliveryHubNeutralPreviewForm] =
    useState<DeliveryHubNeutralPreviewFormState>({
      quote_type: "warehouse_to_pickup_point",
      connection_id: DELIVERY_HUB_PREVIEW_DEV_DEFAULTS_ENABLED
        ? DELIVERY_HUB_PREVIEW_DEFAULT_CONNECTION_ID
        : "",
      destination_point_id: DELIVERY_HUB_PREVIEW_DEV_DEFAULTS_ENABLED
        ? DELIVERY_HUB_PREVIEW_DEFAULT_DESTINATION_POINT_ID
        : "",
      origin_point_id: DELIVERY_HUB_PREVIEW_DEV_DEFAULTS_ENABLED
        ? DELIVERY_HUB_PREVIEW_DEFAULT_ORIGIN_POINT_ID
        : "",
      warehouse_id: DELIVERY_HUB_PREVIEW_DEV_DEFAULTS_ENABLED
        ? DELIVERY_HUB_PREVIEW_DEFAULT_WAREHOUSE_ID
        : "",
    })
  const [deliveryHubNeutralPreviewState, setDeliveryHubNeutralPreviewState] =
    useState<DeliveryHubNeutralPreviewState>({
      status: "idle",
      quotes: null,
      selected_quote_reference_id: null,
      selection: null,
      message: null,
    })
  const [deliveryHubPickupPointState, setDeliveryHubPickupPointState] =
    useState<DeliveryHubPickupPointState>({
      status: "idle",
      points: null,
      selected_point_id: null,
      selected_category: "yandex",
      search_query: "",
      quote_retry_nonce: 0,
      last_request_key: null,
    })
  const [deliveryHubBuyerQuoteState, setDeliveryHubBuyerQuoteState] =
    useState<DeliveryHubBuyerQuoteState>({
      status: "idle",
      quotes: null,
      message: null,
      request_key: null,
    })
  const deliveryHubCompletedRequestKeysRef = useRef<Set<string>>(new Set())
  const deliveryHubLastReadyQuoteRef = useRef<{
    target_key: string
    request_key: string
    quotes: DeliveryHubQuotesResponse
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const isOpen = searchParams.get("step") === "delivery"

  const checkoutCopy = storefrontConfig.copy.checkout
  const commonCopy = storefrontConfig.copy.common
  const cartShippingMethod = cart.shipping_methods?.at(-1)
  const deliveryHubAddressContext = useMemo(
    () => buildDeliveryHubCheckoutAddressContext(cart.shipping_address),
    [
      cart.shipping_address?.address_1,
      cart.shipping_address?.address_2,
      cart.shipping_address?.city,
      cart.shipping_address?.country_code,
      cart.shipping_address?.first_name,
      cart.shipping_address?.last_name,
      cart.shipping_address?.phone,
      cart.shipping_address?.postal_code,
      cart.shipping_address?.province,
    ]
  )
  const shippingMethods = useMemo(
    () => (availableShippingMethods ?? []).filter(isCheckoutEligibleShippingOption),
    [availableShippingMethods]
  )
  const preferredCartShippingMethodId = cartShippingMethod?.shipping_option_id ?? null
  const [shippingMethodId, setShippingMethodId] = useState<string | null>(
    preferredCartShippingMethodId
  )


  useEffect(() => {
    setShippingMethodId((current) =>
      current === preferredCartShippingMethodId ? current : preferredCartShippingMethodId
    )
  }, [preferredCartShippingMethodId])

  useEffect(() => {
    setIsLoadingPrices(true)

    if (!shippingMethods.length) {
      setCalculatedPricesMap({})
      setIsLoadingPrices(false)
      return
    }

    Promise.allSettled(
      shippingMethods
        .filter((option: HttpTypes.StoreCartShippingOption) => option.price_type === "calculated")
        .map((option: HttpTypes.StoreCartShippingOption) => calculatePriceForShippingOption(option.id, cart.id))
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
  }, [cart.id, shippingMethods])



  useEffect(() => {
    let cancelled = false
    const requestKey = getDeliveryHubAddressRequestKey(deliveryHubAddressContext)
    const effectRequestKey = [
      cart.id,
      cart.currency_code,
      String(cart.subtotal ?? ""),
      requestKey ?? "missing_address",
      deliveryHubPickupPointState.selected_category,
      deliveryHubPickupPointState.selected_point_id ?? "auto_pickup_point",
      String(deliveryHubPickupPointState.quote_retry_nonce),
      preferredCartShippingMethodId ?? "no_shipping_method",
      cartShippingMethod?.name ?? "no_shipping_method_name",
    ].join("|")

    if (deliveryHubCompletedRequestKeysRef.current.has(effectRequestKey)) {
      return
    }

    setDeliveryHubRehearsalState((current) => ({
      ...current,
      status: "loading",
      issue_message: null,
    }))

    setDeliveryHubCutoverPreconditionsState({
      status: "loading",
      preconditions: null,
    })

    setDeliveryHubCutoverCandidateState({
      status: "loading",
      candidate: null,
    })

    setDeliveryHubCutoverApprovalArtifactState({
      status: "loading",
      artifact: null,
    })

    setDeliveryHubPickupPointState((current) => ({
      ...current,
      status: deliveryHubAddressContext.is_complete ? "loading" : "idle",
      points:
        deliveryHubAddressContext.is_complete && current.last_request_key === requestKey
          ? current.points
          : null,
      selected_point_id:
        deliveryHubAddressContext.is_complete && current.last_request_key === requestKey
          ? current.selected_point_id
          : null,
      search_query:
        deliveryHubAddressContext.is_complete && current.last_request_key === requestKey
          ? current.search_query
          : "",
      quote_retry_nonce:
        deliveryHubAddressContext.is_complete && current.last_request_key === requestKey
          ? current.quote_retry_nonce
          : 0,
      selected_category:
        deliveryHubAddressContext.is_complete && current.last_request_key === requestKey
          ? current.selected_category
          : "yandex",
      last_request_key: deliveryHubAddressContext.is_complete ? current.last_request_key : null,
    }))
    setDeliveryHubBuyerQuoteState(() => ({
      status: deliveryHubAddressContext.is_complete ? "loading" : "blocked",
      quotes: null,
      message: deliveryHubAddressContext.is_complete
        ? "Рассчитываем стоимость для выбранного ПВЗ."
        : "Укажите город и страну, чтобы найти ПВЗ и рассчитать доставку.",
      request_key: null,
    }))

    const pickupPointsRequest = deliveryHubAddressContext.is_complete
      ? listDeliveryHubPickupPoints({
          city: deliveryHubAddressContext.city,
          country_code: deliveryHubAddressContext.country_code_upper,
        })
      : Promise.resolve(null)

    Promise.allSettled([
      retrieveDeliveryHubSettings(),
      retrieveDeliveryHubSelection(cart.id),
      retrieveDeliveryHubReadiness(cart.id),
      pickupPointsRequest,
      retrieveDeliveryHubCutoverPreconditions(),
      retrieveDeliveryHubCutoverCandidate(cart.id),
      retrieveDeliveryHubCutoverApprovalArtifact(cart.id),
    ])
      .then(async (results) => {
        if (cancelled) {
          return
        }

        const settings = results[0].status === "fulfilled" ? results[0].value : null
        const catalog = await listDeliveryHubCatalog()

        if (cancelled) {
          return
        }

        const selection = results[1].status === "fulfilled" ? results[1].value : null
        const readiness = results[2].status === "fulfilled" ? results[2].value : null
        const fetchedPickupPoints = results[3].status === "fulfilled" ? results[3].value : null
        const cachedPickupPoints =
          deliveryHubAddressContext.is_complete &&
          deliveryHubPickupPointState.last_request_key === requestKey
            ? deliveryHubPickupPointState.points
            : null
        const pickupPoints = fetchedPickupPoints ?? cachedPickupPoints
        const cutoverPreconditions = results[4].status === "fulfilled" ? results[4].value : null
        const cutoverCandidate = results[5].status === "fulfilled" ? results[5].value : null
        const cutoverApprovalArtifact = results[6].status === "fulfilled" ? results[6].value : null
        setDeliveryHubCutoverPreconditionsState({
          status: cutoverPreconditions ? "ready" : "unavailable",
          preconditions: cutoverPreconditions,
        })
        setDeliveryHubCutoverCandidateState({
          status: cutoverCandidate ? "ready" : "unavailable",
          candidate: cutoverCandidate,
        })
        setDeliveryHubCutoverApprovalArtifactState({
          status: cutoverApprovalArtifact ? "ready" : "unavailable",
          artifact: cutoverApprovalArtifact,
        })
        const selectedCategory = deliveryHubPickupPointState.selected_category
        const selectedPointId = getDeliveryHubSelectedPickupPointId(
          pickupPoints,
          deliveryHubPickupPointState.selected_point_id,
          selection?.selection?.pickup_point.provider_point_id,
          selectedCategory
        )
        const destinationPoint = getDeliveryHubSelectedPickupPoint(
          pickupPoints,
          selectedPointId,
          selectedCategory
        )
        setDeliveryHubPickupPointState((current) => ({
          ...current,
          status: pickupPoints
            ? "ready"
            : deliveryHubAddressContext.is_complete
              ? current.points?.points.length && current.last_request_key === requestKey
                ? "ready"
                : "error"
              : "idle",
          points: pickupPoints,
          selected_point_id:
            selectedPointId ??
            (current.last_request_key === requestKey && deliveryHubAddressContext.is_complete
              ? current.selected_point_id
              : null),
          selected_category: selectedCategory,
          last_request_key: pickupPoints
            ? requestKey
            : deliveryHubAddressContext.is_complete
              ? current.last_request_key
              : null,
        }))
        const defaultConnection = catalog?.connections.find(
          (connection) => connection.connection_id === catalog.default_connection_id
        )
        const modeCode: DeliveryHubQuoteType = "warehouse_to_pickup_point"
        const quoteInput: DeliveryHubCheckoutQuoteInput | null =
          deliveryHubAddressContext.is_complete && destinationPoint
            ? {
                cart_id: cart.id,
                currency_code: cart.currency_code,
                destination_point_id: destinationPoint.provider_point_id,
                destination_address: buildDeliveryHubQuoteDestinationAddress(
                  destinationPoint,
                  deliveryHubAddressContext
                ),
              }
            : null
        const quotes = quoteInput ? await previewDeliveryHubQuotes(quoteInput) : null
        const quoteTargetKey = [
          requestKey ?? "missing_address",
          selectedCategory,
          selectedPointId ?? "no_pickup_point",
          modeCode,
          quoteInput?.cart_id ?? "no_cart",
          quoteInput?.destination_point_id ?? "no_destination",
          cart.currency_code,
          String(cart.subtotal ?? ""),
        ].join("|")
        const quoteRequestKey = [
          quoteTargetKey,
          String(deliveryHubPickupPointState.quote_retry_nonce),
        ].join("|")
        const stableQuotes =
          quotes ??
          (deliveryHubLastReadyQuoteRef.current?.target_key === quoteTargetKey &&
          deliveryHubLastReadyQuoteRef.current.request_key === quoteRequestKey
            ? deliveryHubLastReadyQuoteRef.current.quotes
            : null)

        if (quotes) {
          deliveryHubLastReadyQuoteRef.current = {
            target_key: quoteTargetKey,
            request_key: quoteRequestKey,
            quotes,
          }
        }

        const quoteMessage = !destinationPoint
          ? "Выберите ПВЗ, чтобы рассчитать доставку."
          : !quoteInput
            ? "Не хватает адреса доставки или выбранного ПВЗ для расчёта."
            : stableQuotes
                ? `Стоимость получена для выбранного ПВЗ: ${getDeliveryHubPickupPointLabel(destinationPoint)}.`
                : `Стоимость временно недоступна для выбранного пункта: ${getDeliveryHubPickupPointLabel(destinationPoint)}. Попробуйте повторить расчёт или выберите другой ПВЗ.`
        setDeliveryHubBuyerQuoteState({
          status: stableQuotes
            ? "ready"
            : destinationPoint && quoteInput
              ? "unavailable"
              : "blocked",
          quotes: stableQuotes,
          message: quoteMessage,
          request_key: quoteRequestKey,
        })

        if (cancelled) {
          return
        }

        const previewInput: DeliveryHubNeutralSelectionRehearsalInput = {
          cart_id: cart.id,
          settings,
          catalog,
          quotes: stableQuotes,
          pickup_points: pickupPoints,
          selected_pickup_point_id: selectedPointId,
          pickup_windows: null,
          address_context: deliveryHubAddressContext,
          persisted_selection: selection,
          readiness,
          legacy_context: {
            active_commit_path: "delivery_hub",
            legacy_is_committed: Boolean(preferredCartShippingMethodId),
            legacy_flow_kind: null,
            legacy_selection_fresh: Boolean(preferredCartShippingMethodId),
            legacy_method_label: cartShippingMethod?.name ?? null,
          },
        }

        setDeliveryHubRehearsalState({
          status: "ready",
          model: buildDeliveryHubNeutralSelectionRehearsalModel(previewInput),
          preview_input: previewInput,
          issue_message: null,
        })

        deliveryHubCompletedRequestKeysRef.current.add(effectRequestKey)
        if (selectedPointId) {
          deliveryHubCompletedRequestKeysRef.current.add(
            [
              cart.id,
              cart.currency_code,
              String(cart.subtotal ?? ""),
              requestKey ?? "missing_address",
              selectedCategory,
              selectedPointId,
              String(deliveryHubPickupPointState.quote_retry_nonce),
              preferredCartShippingMethodId ?? "no_shipping_method",
              cartShippingMethod?.name ?? "no_shipping_method_name",
            ].join("|")
          )
        }
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        setDeliveryHubCutoverPreconditionsState({
          status: "unavailable",
          preconditions: null,
        })
        setDeliveryHubCutoverCandidateState({
          status: "unavailable",
          candidate: null,
        })

        const previewInput: DeliveryHubNeutralSelectionRehearsalInput = {
          cart_id: cart.id,
          address_context: deliveryHubAddressContext,
          legacy_context: {
            active_commit_path: "delivery_hub",
            legacy_is_committed: Boolean(preferredCartShippingMethodId),
            legacy_flow_kind: null,
            legacy_selection_fresh: Boolean(preferredCartShippingMethodId),
            legacy_method_label: cartShippingMethod?.name ?? null,
          },
        }

        setDeliveryHubRehearsalState({
          status: "error",
          model: buildDeliveryHubNeutralSelectionRehearsalModel(previewInput),
          preview_input: previewInput,
          issue_message: "Advanced Delivery Hub validation is currently unavailable.",
        })
      })

    return () => {
      cancelled = true
    }
  }, [
    cart.currency_code,
    cart.id,
    cart.subtotal,
    cartShippingMethod?.name,
    deliveryHubAddressContext,
    deliveryHubPickupPointState.quote_retry_nonce,
    deliveryHubPickupPointState.selected_category,
    deliveryHubPickupPointState.selected_point_id,
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

  const updateDeliveryHubNeutralPreviewField = (
    field: keyof DeliveryHubNeutralPreviewFormState,
    value: string
  ) => {
    setDeliveryHubNeutralPreviewForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const buildDeliveryHubNeutralPreviewQuoteInput = (): DeliveryHubCheckoutQuoteInput | null => {
    const destinationPointId = deliveryHubNeutralPreviewForm.destination_point_id.trim()

    if (!deliveryHubAddressContext.is_complete) {
      setDeliveryHubNeutralPreviewState((current) => ({
        ...current,
        status: "blocked",
        message:
          "Fill the checkout shipping address before requesting Delivery Hub validation quotes; hidden dev/default address values are not used.",
      }))
      return null
    }

    if (!destinationPointId) {
      setDeliveryHubNeutralPreviewState((current) => ({
        ...current,
        status: "blocked",
        message: "Destination pickup point id is required for Delivery Hub validation quotes.",
      }))
      return null
    }

    const selectedDestinationPoint = getDeliveryHubDestinationPoints(deliveryHubPickupPointState.points)
      .find((point) => point.provider_point_id === destinationPointId) ?? null
    const selectedDestinationPointHasCoordinates =
      typeof selectedDestinationPoint?.lng === "number" &&
      typeof selectedDestinationPoint?.lat === "number"

    if (
      deliveryHubNeutralPreviewForm.quote_type === "warehouse_to_pickup_point" &&
      !selectedDestinationPointHasCoordinates
    ) {
      setDeliveryHubNeutralPreviewState((current) => ({
        ...current,
        status: "blocked",
        message:
          "Selected Yandex pickup point has no coordinates. Re-run pickup-points/list and choose a PVZ with position.longitude/latitude before requesting /check-price.",
      }))
      return null
    }

    return {
      cart_id: cart.id,
      currency_code: cart.currency_code,
      destination_point_id: destinationPointId,
      destination_address: selectedDestinationPoint
        ? buildDeliveryHubQuoteDestinationAddress(
            selectedDestinationPoint,
            deliveryHubAddressContext
          )
        : {
            fullname: deliveryHubAddressContext.address_label ?? destinationPointId,
            coordinates: null,
            contact: {
              name: deliveryHubAddressContext.recipient_label,
              phone: deliveryHubAddressContext.phone,
            },
          },
    }
  }

  const handleDeliveryHubNeutralPreviewQuote = async () => {
    const quoteInput = buildDeliveryHubNeutralPreviewQuoteInput()

    if (!quoteInput) {
      return
    }

    setDeliveryHubNeutralPreviewState({
      status: "loading",
      quotes: null,
      selected_quote_reference_id: null,
      selection: null,
      message:
        "Requesting Delivery Hub validation quotes. Active checkout delivery flow remains unchanged.",
    })

    const quotes = await previewDeliveryHubQuotes(quoteInput)

    if (!quotes) {
      setDeliveryHubNeutralPreviewState({
        status: "error",
        quotes: null,
        selected_quote_reference_id: null,
        selection: null,
        message: "Delivery Hub validation quote request failed or returned an unsafe payload.",
      })
      return
    }

    setDeliveryHubNeutralPreviewState({
      status: "ready",
      quotes,
      selected_quote_reference_id: quotes.quotes[0]?.quote_reference.id ?? null,
      selection: null,
      message: `Delivery Hub validation returned ${quotes.quotes.length} neutral quote(s). Active checkout delivery flow remains unchanged.`,
    })
  }

  const getSelectedDeliveryHubNeutralPreviewQuote = (): DeliveryHubQuote | null => {
    const quotes = deliveryHubNeutralPreviewState.quotes?.quotes ?? []

    return (
      quotes.find(
        (quote) =>
          quote.quote_reference.id ===
          deliveryHubNeutralPreviewState.selected_quote_reference_id
      ) ??
      quotes[0] ??
      null
    )
  }

  const handleSaveDeliveryHubNeutralPreviewSelection = async () => {
    const selectedQuote = getSelectedDeliveryHubNeutralPreviewQuote()
    const destinationPointId = deliveryHubNeutralPreviewForm.destination_point_id.trim()
    const connectionId = deliveryHubNeutralPreviewForm.connection_id.trim()

    if (!selectedQuote) {
      setDeliveryHubNeutralPreviewState((current) => ({
        ...current,
        status: "blocked",
        message: "Run Delivery Hub validation quote before saving selection metadata.",
      }))
      return
    }

    if (!connectionId) {
      setDeliveryHubNeutralPreviewState((current) => ({
        ...current,
        status: "blocked",
        message: "Connection id is required to save Delivery Hub validation selection metadata.",
      }))
      return
    }

    setDeliveryHubNeutralPreviewState((current) => ({
      ...current,
      status: "loading",
      message:
        "Saving Delivery Hub neutral selection metadata only. Medusa shipping method is not changed.",
    }))

    await saveDeliveryHubSelection({
      cart_id: cart.id,
      connection_id: connectionId,
      quote_type: selectedQuote.mode_code,
      quote_reference: selectedQuote.quote_reference,
      quote: {
        carrier_code: selectedQuote.carrier_code,
        carrier_label: selectedQuote.carrier_label,
        amount: selectedQuote.customer_price?.amount ?? selectedQuote.amount,
        currency_code: selectedQuote.customer_price?.currency_code ?? selectedQuote.currency_code,
        customer_price: selectedQuote.customer_price ?? {
          amount: selectedQuote.amount,
          currency_code: selectedQuote.currency_code,
          source: "provider_quote",
          policy_id: null,
        },
        delivery_eta_min: selectedQuote.delivery_eta_min,
        delivery_eta_max: selectedQuote.delivery_eta_max,
        pickup_point_required: selectedQuote.pickup_point_required,
        pickup_window_required: selectedQuote.pickup_window_required,
      },
      pickup_point: {
        provider_point_id: destinationPointId,
        provider_point_code: null,
        name: `Validation pickup point ${destinationPointId}`,
        address: deliveryHubAddressContext.address_label ?? "Validation/sandbox pickup point id supplied by operator",
        city: deliveryHubAddressContext.city,
        region: deliveryHubAddressContext.province,
        postal_code: deliveryHubAddressContext.postal_code,
        lat: null,
        lng: null,
        is_origin_dropoff_allowed:
          deliveryHubNeutralPreviewForm.quote_type === "dropoff_point_to_pickup_point",
        is_destination_pickup_allowed: true,
        payment_methods: [],
      },
      pickup_window: null,
      correlation_id: deliveryHubNeutralPreviewState.quotes?.diagnostics?.correlation_id ?? null,
    })
      .then(async (selection) => {
        const [candidate, artifact] = await Promise.all([
          retrieveDeliveryHubCutoverCandidate(cart.id),
          retrieveDeliveryHubCutoverApprovalArtifact(cart.id),
        ])
        setDeliveryHubCutoverCandidateState({
          status: candidate ? "ready" : "unavailable",
          candidate,
        })
        setDeliveryHubCutoverApprovalArtifactState({
          status: artifact ? "ready" : "unavailable",
          artifact,
        })
        setDeliveryHubNeutralPreviewState((current) => ({
          ...current,
          status: "saved",
          selection,
          message:
            "Delivery Hub validation selection metadata saved. Active checkout delivery flow remains unchanged.",
        }))
        router.refresh()
      })
      .catch((err) => {
        setDeliveryHubNeutralPreviewState((current) => ({
          ...current,
          status: "error",
          message: err.message ?? "Unable to save Delivery Hub validation selection.",
        }))
      })
  }

  const handleClearDeliveryHubNeutralPreviewSelection = async () => {
    setDeliveryHubNeutralPreviewState((current) => ({
      ...current,
      status: "loading",
      message:
        "Clearing Delivery Hub neutral selection metadata only. Medusa shipping method is not changed.",
    }))

    await clearDeliveryHubSelection({ cart_id: cart.id })
      .then(async (selection) => {
        const [candidate, artifact] = await Promise.all([
          retrieveDeliveryHubCutoverCandidate(cart.id),
          retrieveDeliveryHubCutoverApprovalArtifact(cart.id),
        ])
        setDeliveryHubCutoverCandidateState({
          status: candidate ? "ready" : "unavailable",
          candidate,
        })
        setDeliveryHubCutoverApprovalArtifactState({
          status: artifact ? "ready" : "unavailable",
          artifact,
        })
        setDeliveryHubNeutralPreviewState((current) => ({
          ...current,
          status: "cleared",
          selection,
          message:
            "Delivery Hub validation selection metadata cleared. Active checkout delivery flow remains unchanged.",
        }))
        router.refresh()
      })
      .catch((err) => {
        setDeliveryHubNeutralPreviewState((current) => ({
          ...current,
          status: "error",
          message: err.message ?? "Unable to clear Delivery Hub validation selection.",
        }))
      })
  }

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

  const handleSaveDeliveryHubSelectionCutIn = async () => {
    const guard = buildDeliveryHubSelectionSaveCutInPayload(
      deliveryHubRehearsalState.preview_input
    )

    if (guard.status !== "ready") {
      setDeliveryHubSelectionCutInState({
        status: "blocked",
        message: guard.message,
      })
      return
    }

    setError(null)
    setDeliveryHubSelectionCutInState({
      status: "saving",
      message: "Сохраняем выбранный пункт выдачи…",
    })

    await saveDeliveryHubSelection(guard.payload)
      .then(async () => {
        const [readiness, candidate] = await Promise.all([
          retrieveDeliveryHubReadiness(cart.id),
          retrieveDeliveryHubCutoverCandidate(cart.id),
        ])
        const commitEligibility = buildDeliveryHubCommitEligibilityModel({
          cutover_enabled: DELIVERY_HUB_CHECKOUT_CUTOVER_ENABLED,
          cutover_candidate: candidate,
          persisted_selection: await retrieveDeliveryHubSelection(cart.id),
          readiness,
          available_shipping_options: shippingMethods,
          current_shipping_method: cartShippingMethod,
        })

        if (!commitEligibility.canCommitShippingMethod || !commitEligibility.shipping_option_id) {
          setDeliveryHubSelectionCutInState({
            status: "blocked",
            message: "Нужно обновить доставку. Выберите пункт выдачи ещё раз или попробуйте позже.",
          })
          router.refresh()
          return
        }

        const committed = await commitShippingMethod(commitEligibility.shipping_option_id)

        setDeliveryHubSelectionCutInState({
          status: committed ? "committed" : "error",
          message: committed
            ? "Способ доставки сохранён."
            : "Не удалось сохранить способ доставки. Попробуйте ещё раз.",
        })
        router.refresh()
      })
      .catch((err) => {
        setDeliveryHubSelectionCutInState({
          status: "error",
          message: err.message ?? "Не удалось сохранить доставку. Попробуйте ещё раз.",
        })
      })
  }

  const handleClearDeliveryHubSelectionCutIn = async () => {
    if (!cart.id) {
      setDeliveryHubSelectionCutInState({
        status: "blocked",
        message: "Не удалось обновить выбор доставки. Обновите страницу и попробуйте ещё раз.",
      })
      return
    }

    setError(null)
    setDeliveryHubSelectionCutInState({
      status: "clearing",
      message: "Очищаем выбранный пункт выдачи…",
    })

    await clearDeliveryHubSelection({ cart_id: cart.id })
      .then(() => {
        setDeliveryHubSelectionCutInState({
          status: "cleared",
          message: "Выбор очищен. Выберите новый пункт выдачи.",
        })
        router.refresh()
      })
      .catch((err) => {
        setDeliveryHubSelectionCutInState({
          status: "error",
          message: err.message ?? "Не удалось очистить выбор. Попробуйте ещё раз.",
        })
      })
  }

  const handleDeliveryHubCheckoutCutoverCommit = async () => {
    if (!deliveryHubCommitEligibility.canCommitShippingMethod || !deliveryHubCommitEligibility.shipping_option_id) {
      setDeliveryHubSelectionCutInState({
        status: "blocked",
        message:
          "Delivery Hub delivery is not ready yet: quote/selection readiness is blocked, so checkout cannot continue to payment. Retry after Delivery Hub is ready or ask an operator to resolve delivery setup.",
      })
      return
    }

    setDeliveryHubSelectionCutInState({
      status: "committing",
      message:
        "Saving the matched Delivery Hub shipping option. No provider payloads or shipment execution are sent.",
    })

    const committed = await commitShippingMethod(deliveryHubCommitEligibility.shipping_option_id)

    if (!committed) {
      setDeliveryHubSelectionCutInState({
        status: "error",
        message:
          "Delivery Hub shipping option could not be saved. Retry after refreshing delivery readiness or ask an operator to resolve Delivery Hub setup.",
      })
      return
    }

    setDeliveryHubSelectionCutInState({
      status: "committed",
      message:
        "Delivery Hub shipping option saved through Medusa. Shipment creation/execution remains disabled unless separately enabled by operators.",
    })
    router.refresh()
  }



  const getOptionPriceLabel = (option: HttpTypes.StoreCartShippingOption) => {
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

  const visibleShippingMethods = shippingMethods
  const isDeliveryHubShippingMethodId = (id: string | null | undefined) =>
    Boolean(
      id?.startsWith("deliveryhub:") ||
        shippingMethods.some((option) => {
          if (option.id !== id) {
            return false
          }

          const optionData = option.data as Record<string, unknown> | null | undefined
          return (
            option.provider_id === "deliveryhub_deliveryhub" ||
            optionData?.provider_code === "deliveryhub"
          )
        })
    )
  const isSelectionCommitted = shippingMethodId
    ? cartShippingMethod?.shipping_option_id === shippingMethodId &&
      isDeliveryHubShippingMethodId(shippingMethodId)
    : false

  const deliveryHubRehearsalActionability =
    evaluateDeliveryHubNeutralSelectionRehearsalActionability(
      deliveryHubRehearsalState.model
    )
  const deliveryHubSavedSelectionSummary = buildDeliveryHubSavedSelectionSummaryModel(
    deliveryHubRehearsalState.preview_input.persisted_selection,
    deliveryHubRehearsalState.preview_input.readiness
  )
  const deliveryHubSelectionSaveCutInGuard =
    buildDeliveryHubSelectionSaveCutInPayload(
      deliveryHubRehearsalState.preview_input
    )
  const hasPersistedDeliveryHubSelection = Boolean(
    deliveryHubRehearsalState.preview_input.persisted_selection?.selection
  )
  const deliveryHubSelectionMutationInFlight =
    deliveryHubSelectionCutInState.status === "saving" ||
    deliveryHubSelectionCutInState.status === "clearing"
  const deliveryHubBuyerDeliveryCard = buildDeliveryHubBuyerDeliveryCardModel(
    deliveryHubRehearsalState.preview_input,
    {
      is_loading: deliveryHubRehearsalState.status === "loading",
      save_in_flight: deliveryHubSelectionMutationInFlight,
      address_context: deliveryHubAddressContext,
    }
  )
  const deliveryHubCommitEligibility = buildDeliveryHubCommitEligibilityModel({
    cutover_enabled: DELIVERY_HUB_CHECKOUT_CUTOVER_ENABLED,
    cutover_candidate: deliveryHubCutoverCandidateState.candidate,
    persisted_selection: deliveryHubRehearsalState.preview_input.persisted_selection,
    readiness: deliveryHubRehearsalState.preview_input.readiness,
    available_shipping_options: shippingMethods,
    current_shipping_method: cartShippingMethod,
  })
  const deliveryHubCheckoutCutoverGateStatus =
    buildDeliveryHubCheckoutCutoverGateStatus({
      enabled: DELIVERY_HUB_CHECKOUT_CUTOVER_ENABLED,
      candidate: deliveryHubCutoverCandidateState.candidate,
      available_shipping_options: shippingMethods,
    })
  const deliveryHubCutoverPreconditionsPreview =
    buildDeliveryHubCutoverPreconditionsPreviewModel(
      deliveryHubCutoverPreconditionsState.preconditions
    )
  const deliveryHubCutoverCandidatePreview =
    buildDeliveryHubCutoverCandidatePreviewModel(
      deliveryHubCutoverCandidateState.candidate
    )
  const deliveryHubCutoverApprovalArtifactPreview =
    buildDeliveryHubCutoverApprovalArtifactPreviewModel(
      deliveryHubCutoverApprovalArtifactState.artifact
    )
  const deliveryHubPickupPointSelector = buildDeliveryHubPickupPointSelectorModel({
    pickup_points: deliveryHubPickupPointState.points,
    selected_pickup_point_id: deliveryHubPickupPointState.selected_point_id,
    selected_category: deliveryHubPickupPointState.selected_category,
    search_query: deliveryHubPickupPointState.search_query,
    address_context: deliveryHubAddressContext,
    is_loading:
      deliveryHubRehearsalState.status === "loading" ||
      deliveryHubPickupPointState.status === "loading",
    quote_status: deliveryHubBuyerQuoteState.status,
    quote_message: deliveryHubBuyerQuoteState.message,
  })
  const deliveryHubDisplayedPickupPoints = deliveryHubPickupPointSelector.visible_points.slice(0, 12)
  const deliveryHubNeutralPreviewQuotes =
    deliveryHubNeutralPreviewState.quotes?.quotes ?? []
  const selectedDeliveryHubNeutralPreviewQuote =
    getSelectedDeliveryHubNeutralPreviewQuote()
  const deliveryHubNeutralPreviewBusy =
    deliveryHubNeutralPreviewState.status === "loading"

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
            className={clx(
              "mb-6 rounded-rounded border px-5 py-4",
              {
                "border-ui-border-interactive bg-ui-bg-base":
                  deliveryHubBuyerDeliveryCard.tone === "positive",
                "border-ui-tag-orange-border bg-ui-tag-orange-bg":
                  deliveryHubBuyerDeliveryCard.tone === "warning",
                "border-ui-border-base bg-ui-bg-subtle":
                  deliveryHubBuyerDeliveryCard.tone === "neutral",
              }
            )}
            data-testid="delivery-hub-customer-delivery-card"
          >
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-col gap-y-2 small:flex-row small:items-start small:justify-between">
                <div className="flex flex-col gap-y-1">
                  <Text
                    className="text-ui-fg-base txt-medium-plus"
                    data-testid="delivery-hub-customer-method-label"
                  >
                    {deliveryHubBuyerDeliveryCard.method_label}
                  </Text>
                  <Text className="text-ui-fg-muted txt-small">
                    {deliveryHubBuyerDeliveryCard.headline_label}
                  </Text>
                </div>
                <span
                  className="w-fit rounded-rounded border border-ui-border-base bg-ui-bg-base px-2 py-1 text-ui-fg-muted txt-compact-small"
                  data-testid="delivery-hub-customer-selection-status"
                >
                  {deliveryHubBuyerDeliveryCard.status_label}
                </span>
              </div>

              {deliveryHubBuyerDeliveryCard.status === "loading" ? (
                <div className="flex items-center gap-x-2 text-ui-fg-muted txt-small">
                  <Loader />
                  <span>{deliveryHubBuyerDeliveryCard.detail_label}</span>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 small:grid-cols-3">
                    <div className="rounded-rounded border border-ui-border-base bg-ui-bg-base p-3">
                      <Text className="text-ui-fg-muted txt-small">Стоимость</Text>
                      <Text
                        className="text-ui-fg-base txt-medium-plus"
                        data-testid="delivery-hub-buyer-visible-delivery-cost"
                      >
                        {deliveryHubBuyerDeliveryCard.quote_amount !== null ?
                          formatPrice(
                            deliveryHubBuyerDeliveryCard.quote_amount,
                            deliveryHubBuyerDeliveryCard.currency_code
                          ) :
                          "Уточняется"}
                      </Text>
                    </div>
                    <div className="rounded-rounded border border-ui-border-base bg-ui-bg-base p-3">
                      <Text className="text-ui-fg-muted txt-small">Срок</Text>
                      <Text
                        className="text-ui-fg-base txt-medium-plus"
                        data-testid="delivery-hub-customer-eta"
                      >
                        {deliveryHubBuyerDeliveryCard.quote_eta_label ?? "Уточняется"}
                      </Text>
                    </div>
                    <div className="rounded-rounded border border-ui-border-base bg-ui-bg-base p-3">
                      <Text className="text-ui-fg-muted txt-small">Пункт выдачи</Text>
                      <Text
                        className="text-ui-fg-base txt-medium-plus"
                        data-testid="delivery-hub-customer-pickup-point"
                      >
                        {deliveryHubBuyerDeliveryCard.pickup_point_label ?? "Подбирается"}
                      </Text>
                    </div>
                  </div>

                  {deliveryHubBuyerDeliveryCard.buyer_address_label && (
                    <Text
                      className="text-ui-fg-muted txt-small"
                      data-testid="delivery-hub-customer-buyer-address-context"
                    >
                      Расчёт по адресу покупателя: {deliveryHubBuyerDeliveryCard.buyer_address_label}
                    </Text>
                  )}
                  {deliveryHubBuyerDeliveryCard.pickup_point_address_label && (
                    <Text
                      className="text-ui-fg-muted txt-small"
                      data-testid="delivery-hub-customer-pickup-address"
                    >
                      Адрес ПВЗ: {deliveryHubBuyerDeliveryCard.pickup_point_address_label}
                    </Text>
                  )}

                  <div
                    className="rounded-rounded border border-ui-border-base bg-ui-bg-base p-4"
                    data-testid="delivery-hub-pickup-point-selector"
                  >
                    <div className="flex flex-col gap-y-3">
                      <div className="flex flex-col gap-y-1 small:flex-row small:items-start small:justify-between">
                        <div className="flex flex-col gap-y-1">
                          <Text className="text-ui-fg-base txt-medium-plus">
                            Выберите пункт выдачи
                          </Text>
                          <Text
                            className="text-ui-fg-muted txt-small"
                            data-testid="delivery-hub-pickup-point-selector-status"
                          >
                            {deliveryHubPickupPointSelector.status_label}
                          </Text>
                        </div>
                        {deliveryHubPickupPointSelector.quote_status_label && (
                          <span
                            className="w-fit rounded-rounded border border-ui-border-base bg-ui-bg-subtle px-2 py-1 text-ui-fg-muted txt-compact-small"
                            data-testid="delivery-hub-selected-pickup-point-quote-status"
                          >
                            {deliveryHubPickupPointSelector.quote_status_label}
                          </span>
                        )}
                      </div>

                      <Text className="text-ui-fg-muted txt-small">
                        {deliveryHubPickupPointSelector.detail_label}
                      </Text>

                      <div
                        className="grid gap-3 small:grid-cols-2"
                        data-testid="delivery-hub-pickup-point-category-tiles"
                      >
                        {deliveryHubPickupPointSelector.category_tiles.map((tile) => (
                          <button
                            key={tile.category}
                            type="button"
                            className={clx(
                              "flex min-h-[112px] items-center gap-x-4 rounded-rounded border p-4 text-left transition-colors",
                              tile.selected
                                ? "border-ui-border-interactive bg-ui-bg-base shadow-borders-interactive-with-active"
                                : "border-ui-border-base bg-ui-bg-subtle hover:bg-ui-bg-base"
                            )}
                            onClick={() => {
                              setDeliveryHubPickupPointState((current) => ({
                                ...current,
                                selected_category: tile.category,
                                selected_point_id: null,
                                search_query: "",
                              }))
                            }}
                            data-testid="delivery-hub-pickup-point-category-tile"
                          >
                            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ui-bg-base text-ui-fg-base txt-xlarge-plus">
                              {tile.logo_mark}
                            </span>
                            <span className="flex flex-col gap-y-1">
                              <span className="text-ui-fg-base txt-medium-plus">{tile.title}</span>
                              <span className="text-ui-fg-muted txt-small">{tile.subtitle}</span>
                              <span className="text-ui-fg-base txt-small-plus">{tile.count} пунктов</span>
                            </span>
                          </button>
                        ))}
                      </div>

                      <input
                        className="rounded-rounded border border-ui-border-base bg-ui-bg-base px-3 py-2 text-ui-fg-base txt-small"
                        value={deliveryHubPickupPointState.search_query}
                        onChange={(event) => {
                          setDeliveryHubPickupPointState((current) => ({
                            ...current,
                            search_query: event.target.value,
                          }))
                        }}
                        placeholder="Поиск по названию, адресу, бренду или типу пункта"
                        data-testid="delivery-hub-pickup-point-search"
                      />

                      {deliveryHubDisplayedPickupPoints.length > 0 ? (
                        <div className="grid gap-y-2" data-testid="delivery-hub-pickup-point-list">
                          {deliveryHubDisplayedPickupPoints.map((point) => (
                            <label
                              key={point.provider_point_id}
                              className={clx(
                                "flex cursor-pointer flex-col gap-y-1 rounded-rounded border p-3 text-ui-fg-muted txt-small",
                                point.is_selected
                                  ? "border-ui-border-interactive bg-ui-bg-base"
                                  : "border-ui-border-base bg-ui-bg-subtle"
                              )}
                              data-testid="delivery-hub-pickup-point-option"
                            >
                              <span className="flex items-start gap-x-2 text-ui-fg-base">
                                <input
                                  type="radio"
                                  name="delivery-hub-pickup-point"
                                  checked={point.is_selected}
                                  onChange={() => {
                                    setDeliveryHubPickupPointState((current) => ({
                                      ...current,
                                      selected_point_id: point.provider_point_id,
                                    }))
                                  }}
                                  data-testid="delivery-hub-pickup-point-radio"
                                />
                                <span className="flex flex-col gap-y-1">
                                  <span>{point.name}</span>
                                  <span className="text-ui-fg-muted">{point.address}</span>
                                </span>
                              </span>
                              <span className="flex flex-wrap gap-2">
                                <span className="w-fit rounded-rounded border border-ui-border-base bg-ui-bg-base px-2 py-1 text-ui-fg-muted txt-compact-small">
                                  {point.category_label}
                                </span>
                                {point.network_label && (
                                  <span className="w-fit rounded-rounded border border-ui-border-base bg-ui-bg-base px-2 py-1 text-ui-fg-muted txt-compact-small">
                                    {point.network_label}
                                  </span>
                                )}
                              </span>
                              <span>{point.availability_label}</span>
                              {point.quote_status_label && (
                                <span data-testid="delivery-hub-pickup-point-option-quote-status">
                                  {point.quote_status_label}
                                </span>
                              )}
                              {point.is_quote_target && deliveryHubBuyerQuoteState.status === "unavailable" && (
                                <button
                                  type="button"
                                  className="w-fit text-ui-fg-interactive txt-small-plus hover:text-ui-fg-interactive-hover"
                                  onClick={(event) => {
                                    event.preventDefault()
                                    setDeliveryHubPickupPointState((current) => ({
                                      ...current,
                                      quote_retry_nonce: current.quote_retry_nonce + 1,
                                    }))
                                  }}
                                  data-testid="delivery-hub-pickup-point-retry-quote"
                                >
                                  Повторить расчёт стоимости
                                </button>
                              )}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <Text
                          className="text-ui-fg-muted txt-small"
                          data-testid="delivery-hub-pickup-point-empty"
                        >
                          {deliveryHubPickupPointSelector.status === "no_search_results"
                            ? "По вашему запросу ПВЗ не найдены."
                            : deliveryHubPickupPointSelector.status === "no_category_points" &&
                                deliveryHubPickupPointSelector.selected_category === "yandex"
                              ? "Для этого адреса пункты Яндекс не найдены. Партнёрские ПВЗ доступны во вкладке «Партнёры»."
                              : "Для указанного адреса ПВЗ не найдены."}
                        </Text>
                      )}

                      {deliveryHubPickupPointSelector.hint_messages.slice(0, 2).map((message) => (
                        <Text
                          key={message}
                          className="text-ui-fg-muted txt-small"
                          data-testid="delivery-hub-pickup-point-hint"
                        >
                          {message}
                        </Text>
                      ))}
                    </div>
                  </div>

                  {deliveryHubBuyerDeliveryCard.pickup_window_label && (
                    <Text className="text-ui-fg-muted txt-small">
                      Окно передачи: {deliveryHubBuyerDeliveryCard.pickup_window_label}
                    </Text>
                  )}
                  <Text className="text-ui-fg-subtle txt-small">
                    {deliveryHubBuyerDeliveryCard.detail_label}
                  </Text>
                  {deliveryHubBuyerDeliveryCard.unavailable_reason_label && (
                    <Text
                      className="text-ui-fg-muted txt-small"
                      data-testid="delivery-hub-customer-unavailable-reason"
                    >
                      {deliveryHubBuyerDeliveryCard.unavailable_reason_label}
                    </Text>
                  )}
                </>
              )}

              {deliveryHubSelectionCutInState.message && (
                <Text
                  className="text-ui-fg-muted txt-small"
                  data-testid="delivery-hub-customer-save-message"
                >
                  {deliveryHubSelectionCutInState.message}
                </Text>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="small"
                  variant="secondary"
                  type="button"
                  disabled={!deliveryHubBuyerDeliveryCard.can_save_selection}
                  onClick={() => {
                    void handleSaveDeliveryHubSelectionCutIn()
                  }}
                  data-testid="delivery-hub-customer-save-selection-button"
                >
                  {deliveryHubSelectionCutInState.status === "saving" ? (
                    <span className="flex items-center gap-x-2">
                      <Loader /> Сохраняем доставку
                    </span>
                  ) : (
                    deliveryHubBuyerDeliveryCard.action_label
                  )}
                </Button>
                {hasPersistedDeliveryHubSelection && (
                  <Button
                    size="small"
                    variant="transparent"
                    type="button"
                    disabled={deliveryHubSelectionMutationInFlight}
                    onClick={() => {
                      void handleClearDeliveryHubSelectionCutIn()
                    }}
                    data-testid="delivery-hub-customer-clear-selection-button"
                  >
                    {deliveryHubSelectionCutInState.status === "clearing" ?
                      "Очищаем выбор" :
                      "Изменить выбор"}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {DELIVERY_HUB_PREVIEW_ENABLED && (
            <details
              className="mb-6 rounded-rounded border border-ui-border-base bg-ui-bg-subtle px-5 py-4"
              data-testid="delivery-hub-dev-diagnostics"
            >
              <summary className="cursor-pointer text-ui-fg-muted txt-small-plus">
                Advanced Delivery Hub diagnostics
              </summary>
              <div className="mt-4">
                <div
                  className="rounded-rounded border border-ui-border-base bg-ui-bg-base p-4"
                  data-testid="delivery-hub-advanced-diagnostics-block"
                >
                  <div className="flex flex-col gap-y-3">
                    <div className="flex flex-col gap-y-2">
                      <Text
                        className="text-ui-fg-base txt-medium-plus"
                        data-testid="delivery-hub-diagnostics-heading"
                      >
                        Delivery Hub advanced validation
                      </Text>
                      <Text className="text-ui-fg-muted txt-small">
                        Dev-only validation surface for safe Delivery Hub quote, selection, readiness, and shipping-method handoff checks. It is collapsed by default, uses sanitized Store API responses, and does not create shipments or expose provider payloads.
                      </Text>
                    </div>

                    <div
                      className="grid gap-y-1 rounded-rounded border border-ui-border-base bg-ui-bg-subtle p-3 text-ui-fg-muted txt-small"
                      data-testid="delivery-hub-diagnostics-guardrails"
                    >
                      <span data-testid="delivery-hub-diagnostics-feature-flag-status">
                        Diagnostics flag: NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_ENABLED=true.
                      </span>
                      <span data-testid="delivery-hub-diagnostics-dev-defaults-status">
                        Sandbox defaults: {DELIVERY_HUB_PREVIEW_DEV_DEFAULTS_ENABLED ? "enabled for local/dev ids" : "disabled; enter non-secret ids manually"}.
                      </span>
                      <span data-testid="delivery-hub-diagnostics-active-flow-guardrail">
                        Active checkout flow: Delivery Hub quote/PVZ selection, saved delivery method, matched Medusa shipping option, then payment only after delivery is ready.
                      </span>
                      <span data-testid="delivery-hub-diagnostics-no-provider-raw-guardrail">
                        Diagnostics are shopper-safe only: quote/selection status, count, price, ETA and safe correlation id; no raw provider body, token, auth header, ciphertext or publishable key value is displayed.
                      </span>
                    </div>

                    <div className="grid gap-y-1 text-ui-fg-muted txt-small">
                      <span>{deliveryHubRehearsalState.model.status_label}</span>
                      <span>{deliveryHubRehearsalState.model.active_commit_path_label}</span>
                      <span>Validation status: {deliveryHubRehearsalActionability.verdict}</span>
                      {deliveryHubRehearsalState.issue_message && (
                        <span>{deliveryHubRehearsalState.issue_message}</span>
                      )}
                      {deliveryHubRehearsalState.status === "loading" && (
                        <span className="flex items-center gap-x-2">
                          <Loader /> Loading advanced validation…
                        </span>
                      )}
                      {deliveryHubSavedSelectionSummary.state !== "missing" && (
                        <span data-testid="delivery-hub-diagnostics-saved-selection">
                          {deliveryHubSavedSelectionSummary.title}: {deliveryHubSavedSelectionSummary.status_label}
                        </span>
                      )}
                      {deliveryHubSavedSelectionSummary.pickup_point_label && (
                        <span>Saved pickup point: {deliveryHubSavedSelectionSummary.pickup_point_label}</span>
                      )}
                      {deliveryHubSavedSelectionSummary.readiness_label && (
                        <span>Readiness: {deliveryHubSavedSelectionSummary.readiness_label}</span>
                      )}
                    </div>

                    <div
                      className="grid gap-y-1 rounded-rounded border border-ui-border-base bg-ui-bg-subtle p-3 text-ui-fg-muted txt-small"
                      data-testid="delivery-hub-checkout-commit-guard"
                    >
                      <span data-testid="delivery-hub-checkout-commit-guard-status">
                        Shipping-method handoff guard: {deliveryHubCommitEligibility.status}; canCommitShippingMethod={String(deliveryHubCommitEligibility.canCommitShippingMethod)}.
                      </span>
                      <span>{deliveryHubCommitEligibility.status_label}</span>
                      <span>{deliveryHubCommitEligibility.detail_label}</span>
                      <span>Candidate shipping option: {deliveryHubCommitEligibility.shipping_option_id ?? "none"}</span>
                      <span>Current shipping option: {deliveryHubCommitEligibility.current_shipping_option_id ?? "none"}</span>
                      {deliveryHubCommitEligibility.reason_codes.length > 0 && (
                        <span>Handoff blockers: {deliveryHubCommitEligibility.reason_codes.join(", ")}</span>
                      )}
                      <Button
                        size="small"
                        variant="secondary"
                        type="button"
                        disabled={
                          !deliveryHubCommitEligibility.canCommitShippingMethod ||
                          isLoading ||
                          deliveryHubSelectionMutationInFlight ||
                          deliveryHubSelectionCutInState.status === "committing"
                        }
                        onClick={() => {
                          void handleDeliveryHubCheckoutCutoverCommit()
                        }}
                        data-testid="delivery-hub-checkout-commit-button"
                      >
                        {deliveryHubSelectionCutInState.status === "committing" ? (
                          <span className="flex items-center gap-x-2">
                            <Loader /> Saving Delivery Hub shipping
                          </span>
                        ) : (
                          "Save Delivery Hub shipping option"
                        )}
                      </Button>
                    </div>

                    <div
                      className="grid gap-y-1 rounded-rounded border border-ui-border-base bg-ui-bg-subtle p-3 text-ui-fg-muted txt-small"
                      data-testid="delivery-hub-advanced-readiness-status"
                    >
                      <span data-testid="delivery-hub-advanced-readiness-flag-status">
                        Checkout handoff flag: NEXT_PUBLIC_DELIVERY_HUB_CHECKOUT_CUTOVER_ENABLED={deliveryHubCheckoutCutoverGateStatus.enabled ? "true" : "false"}.
                      </span>
                      <span data-testid="delivery-hub-advanced-readiness-mode">
                        Handoff mode: {deliveryHubCheckoutCutoverGateStatus.mode}; canCommitShippingMethod={String(deliveryHubCheckoutCutoverGateStatus.canCommitShippingMethod)}.
                      </span>
                      <span data-testid="delivery-hub-advanced-readiness-summary">
                        {deliveryHubCheckoutCutoverGateStatus.status_label}
                      </span>
                      <span data-testid="delivery-hub-advanced-readiness-detail">
                        {deliveryHubCheckoutCutoverGateStatus.detail_label}
                      </span>
                    </div>

                    <div
                      className="grid gap-y-1 rounded-rounded border border-ui-border-base bg-ui-bg-subtle p-3 text-ui-fg-muted txt-small"
                      data-testid="delivery-hub-advanced-preconditions-status"
                    >
                      <span data-testid="delivery-hub-advanced-preconditions-availability">
                        Readiness verifier: {deliveryHubCutoverPreconditionsPreview.availability}; load status={deliveryHubCutoverPreconditionsState.status}.
                      </span>
                      <span data-testid="delivery-hub-advanced-preconditions-summary">
                        {deliveryHubCutoverPreconditionsPreview.status_label} · {deliveryHubCutoverPreconditionsPreview.summary_label}
                      </span>
                      <span data-testid="delivery-hub-advanced-preconditions-commit-status">
                        {deliveryHubCutoverPreconditionsPreview.commit_label}; canCommitShippingMethod={String(deliveryHubCutoverPreconditionsPreview.canCommitShippingMethod)}.
                      </span>
                      <span data-testid="delivery-hub-advanced-preconditions-guardrails">
                        Guardrails: {deliveryHubCutoverPreconditionsPreview.guardrail_labels.join("; ")}.
                      </span>
                    </div>

                    <div
                      className="grid gap-y-1 rounded-rounded border border-ui-border-base bg-ui-bg-subtle p-3 text-ui-fg-muted txt-small"
                      data-testid="delivery-hub-advanced-candidate-status"
                    >
                      <span data-testid="delivery-hub-advanced-candidate-availability">
                        Shipping option planner: {deliveryHubCutoverCandidatePreview.availability}; load status={deliveryHubCutoverCandidateState.status}.
                      </span>
                      <span data-testid="delivery-hub-advanced-candidate-summary">
                        {deliveryHubCutoverCandidatePreview.status_label} · {deliveryHubCutoverCandidatePreview.detail_label}
                      </span>
                      <span data-testid="delivery-hub-advanced-candidate-commit-status">
                        Planning evidence only; checkout handoff requires the explicit flag plus local readiness guard; canCommitShippingMethod={String(deliveryHubCommitEligibility.canCommitShippingMethod)}.
                      </span>
                      {deliveryHubCutoverCandidatePreview.candidate_label && (
                        <span data-testid="delivery-hub-advanced-candidate-option">
                          Candidate shipping option: {deliveryHubCutoverCandidatePreview.candidate_label}
                        </span>
                      )}
                      {deliveryHubCutoverCandidatePreview.amount_label && (
                        <span data-testid="delivery-hub-advanced-candidate-amount">
                          Candidate amount: {deliveryHubCutoverCandidatePreview.amount_label}
                        </span>
                      )}
                    </div>

                    <div
                      className="grid gap-y-1 rounded-rounded border border-ui-border-base bg-ui-bg-subtle p-3 text-ui-fg-muted txt-small"
                      data-testid="delivery-hub-advanced-approval-record"
                    >
                      <span data-testid="delivery-hub-advanced-approval-record-availability">
                        Approval record: {deliveryHubCutoverApprovalArtifactPreview.availability}; load status={deliveryHubCutoverApprovalArtifactState.status}.
                      </span>
                      <span data-testid="delivery-hub-advanced-approval-record-status">
                        {deliveryHubCutoverApprovalArtifactPreview.status_label} · {deliveryHubCutoverApprovalArtifactPreview.detail_label}
                      </span>
                      <span data-testid="delivery-hub-advanced-approval-record-evidence">
                        Evidence snapshot: {deliveryHubCutoverApprovalArtifactPreview.evidence_label}
                      </span>
                      <span data-testid="delivery-hub-advanced-approval-record-commit-controls">
                        Commit controls: {deliveryHubCutoverApprovalArtifactPreview.commit_control_labels.join("; ")}; canCommitShippingMethod={String(deliveryHubCutoverApprovalArtifactPreview.canCommitShippingMethod)}.
                      </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="flex flex-col gap-y-1 text-ui-fg-muted txt-small">
                        Quote type
                        <select
                          className="rounded-rounded border border-ui-border-base bg-ui-bg-base px-3 py-2 text-ui-fg-base"
                          value={deliveryHubNeutralPreviewForm.quote_type}
                          onChange={(event) =>
                            updateDeliveryHubNeutralPreviewField(
                              "quote_type",
                              event.target.value as DeliveryHubQuoteType
                            )
                          }
                          data-testid="delivery-hub-diagnostics-quote-type"
                        >
                          <option value="warehouse_to_pickup_point">
                            Warehouse → pickup point (shopper default)
                          </option>
                          <option value="dropoff_point_to_pickup_point">
                            Dropoff point → pickup point (advanced)
                          </option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-y-1 text-ui-fg-muted txt-small">
                        Connection id
                        <input
                          className="rounded-rounded border border-ui-border-base bg-ui-bg-base px-3 py-2 text-ui-fg-base"
                          value={deliveryHubNeutralPreviewForm.connection_id}
                          onChange={(event) =>
                            updateDeliveryHubNeutralPreviewField(
                              "connection_id",
                              event.target.value
                            )
                          }
                          placeholder="Optional default connection id"
                          data-testid="delivery-hub-diagnostics-connection-id"
                        />
                      </label>
                      <label className="flex flex-col gap-y-1 text-ui-fg-muted txt-small">
                        Destination pickup point id
                        <input
                          className="rounded-rounded border border-ui-border-base bg-ui-bg-base px-3 py-2 text-ui-fg-base"
                          value={deliveryHubNeutralPreviewForm.destination_point_id}
                          onChange={(event) =>
                            updateDeliveryHubNeutralPreviewField(
                              "destination_point_id",
                              event.target.value
                            )
                          }
                          placeholder="PVZ/provider point id"
                          data-testid="delivery-hub-diagnostics-destination-point-id"
                        />
                      </label>
                      <label className="flex flex-col gap-y-1 text-ui-fg-muted txt-small">
                        Origin dropoff point id
                        <input
                          className="rounded-rounded border border-ui-border-base bg-ui-bg-base px-3 py-2 text-ui-fg-base"
                          value={deliveryHubNeutralPreviewForm.origin_point_id}
                          onChange={(event) =>
                            updateDeliveryHubNeutralPreviewField(
                              "origin_point_id",
                              event.target.value
                            )
                          }
                          placeholder="Required for dropoff → pickup"
                          data-testid="delivery-hub-diagnostics-origin-point-id"
                        />
                      </label>
                      <label className="flex flex-col gap-y-1 text-ui-fg-muted txt-small">
                        Warehouse id (advanced override; empty uses backend default warehouse)
                        <input
                          className="rounded-rounded border border-ui-border-base bg-ui-bg-base px-3 py-2 text-ui-fg-base"
                          value={deliveryHubNeutralPreviewForm.warehouse_id}
                          onChange={(event) =>
                            updateDeliveryHubNeutralPreviewField(
                              "warehouse_id",
                              event.target.value
                            )
                          }
                          placeholder="Optional override for warehouse → pickup"
                          data-testid="delivery-hub-diagnostics-warehouse-id"
                        />
                      </label>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="small"
                        variant="secondary"
                        type="button"
                        disabled={deliveryHubNeutralPreviewBusy}
                        onClick={() => {
                          void handleDeliveryHubNeutralPreviewQuote()
                        }}
                        data-testid="delivery-hub-diagnostics-get-quotes-button"
                      >
                        {deliveryHubNeutralPreviewBusy ? (
                          <span className="flex items-center gap-x-2">
                            <Loader /> Loading validation quotes
                          </span>
                        ) : (
                          "Get validation quotes"
                        )}
                      </Button>
                      <Button
                        size="small"
                        variant="secondary"
                        type="button"
                        disabled={
                          deliveryHubNeutralPreviewBusy ||
                          !selectedDeliveryHubNeutralPreviewQuote
                        }
                        onClick={() => {
                          void handleSaveDeliveryHubNeutralPreviewSelection()
                        }}
                        data-testid="delivery-hub-diagnostics-save-selection-button"
                      >
                        Save validation metadata
                      </Button>
                      <Button
                        size="small"
                        variant="transparent"
                        type="button"
                        disabled={deliveryHubNeutralPreviewBusy}
                        onClick={() => {
                          void handleClearDeliveryHubNeutralPreviewSelection()
                        }}
                        data-testid="delivery-hub-diagnostics-clear-selection-button"
                      >
                        Clear validation metadata
                      </Button>
                    </div>

                    <div
                      className="grid gap-y-1 text-ui-fg-muted txt-small"
                      data-testid="delivery-hub-diagnostics-results"
                    >
                      <span data-testid="delivery-hub-diagnostics-active-flow-status">
                        Active checkout flow remains Delivery Hub delivery.
                      </span>
                      <span data-testid="delivery-hub-diagnostics-operation-status">
                        Operation status: {deliveryHubNeutralPreviewState.status}
                      </span>
                      <span data-testid="delivery-hub-diagnostics-quote-count">
                        Quote count: {deliveryHubNeutralPreviewQuotes.length}
                      </span>
                      <span data-testid="delivery-hub-diagnostics-quote-correlation-id">
                        Quote correlation id: {deliveryHubNeutralPreviewState.quotes?.diagnostics?.correlation_id ?? "not returned"}
                      </span>
                      <span data-testid="delivery-hub-diagnostics-selection-status">
                        Selection saved status: {deliveryHubNeutralPreviewState.selection?.selection ? "saved" : deliveryHubNeutralPreviewState.selection ? "cleared" : "not saved in this validation session"}
                      </span>
                      <span data-testid="delivery-hub-diagnostics-selection-correlation-id">
                        Selection correlation id: {deliveryHubNeutralPreviewState.selection?.diagnostics?.correlation_id ?? "not returned"}
                      </span>
                      {deliveryHubNeutralPreviewState.message && (
                        <span data-testid="delivery-hub-diagnostics-message">
                          {deliveryHubNeutralPreviewState.message}
                        </span>
                      )}
                    </div>

                    {deliveryHubNeutralPreviewQuotes.length > 0 && (
                      <div className="grid gap-y-2" data-testid="delivery-hub-diagnostics-quotes-list">
                        <Text className="text-ui-fg-base txt-small-plus">
                          Validation quotes
                        </Text>
                        {deliveryHubNeutralPreviewQuotes.slice(0, 6).map((quote) => (
                          <label
                            key={quote.quote_reference.id}
                            className="flex cursor-pointer flex-col gap-y-1 rounded-rounded border border-ui-border-base bg-ui-bg-subtle p-3 text-ui-fg-muted txt-small"
                            data-testid="delivery-hub-diagnostics-quote-option"
                          >
                            <span className="flex items-center gap-x-2 text-ui-fg-base">
                              <input
                                type="radio"
                                name="delivery-hub-diagnostics-quote"
                                checked={
                                  deliveryHubNeutralPreviewState.selected_quote_reference_id ===
                                  quote.quote_reference.id
                                }
                                onChange={() =>
                                  setDeliveryHubNeutralPreviewState((current) => ({
                                    ...current,
                                    selected_quote_reference_id: quote.quote_reference.id,
                                  }))
                                }
                                data-testid="delivery-hub-diagnostics-quote-radio"
                              />
                              {quote.carrier_label} · {formatPrice(quote.customer_price?.amount ?? quote.amount, quote.customer_price?.currency_code ?? quote.currency_code)}
                            </span>
                            <span>
                              ETA: {quote.delivery_eta_min ?? "?"}–{quote.delivery_eta_max ?? "?"} days
                            </span>
                            <span>Pickup point id: {deliveryHubNeutralPreviewForm.destination_point_id || quote.pickup_point_ids[0] || "not supplied"}</span>
                            <span>Quote reference v{quote.quote_reference.version}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </details>
          )}

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
                <ShippingSummary
                  cart={cart}
                  availableShippingMethods={shippingMethods}
                  deliveryHubSavedSelectionSummary={deliveryHubSavedSelectionSummary}
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
