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
  buildDeliveryHubHandoffContractMatrixPreviewModel,
  buildDeliveryHubHandoffPreviewModel,
  buildDeliveryHubNeutralSelectionRehearsalModel,
  buildDeliveryHubPersistedSelectionContractParityPreviewModel,
  buildDeliveryHubProjectedCommitParityPreviewModel,
  buildDeliveryHubSavedSelectionSummaryModel,
  buildDeliveryHubSelectionPayloadParityPreviewModel,
  buildDeliveryHubSelectionSaveCutInPayload,
  buildDeliveryHubSelectionWriteSeamPreviewModel,
  buildDeliveryHubShippingOptionParityPreviewModel,
  buildDeliveryHubWriteIntentContractPreviewModel,
  evaluateDeliveryHubNeutralSelectionRehearsalActionability,
  type DeliveryHubCutoverApprovalArtifactResponse,
  type DeliveryHubCutoverCandidateResponse,
  type DeliveryHubCutoverPreconditionsResponse,
  type DeliveryHubListQuotesInput,
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
      quote_type: "dropoff_point_to_pickup_point",
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
    })
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
      selected_category:
        deliveryHubAddressContext.is_complete && current.last_request_key === requestKey
          ? current.selected_category
          : "yandex",
      last_request_key: deliveryHubAddressContext.is_complete ? current.last_request_key : null,
    }))
    setDeliveryHubBuyerQuoteState({
      status: deliveryHubAddressContext.is_complete ? "loading" : "blocked",
      quotes: null,
      message: deliveryHubAddressContext.is_complete
        ? "Рассчитываем стоимость для выбранного ПВЗ."
        : "Укажите город и страну, чтобы найти ПВЗ и рассчитать доставку.",
    })

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
        const modeCode =
          readiness?.quote_context?.quote_type ??
          selection?.selection?.quote_type ??
          (defaultConnection?.quote_types.includes("warehouse_to_pickup_point")
            ? "warehouse_to_pickup_point"
            : defaultConnection?.quote_types[0]) ??
          "warehouse_to_pickup_point"
        const originPoint =
          modeCode === "dropoff_point_to_pickup_point"
            ? pickupPoints?.points.find(
                (point) =>
                  point.is_origin_dropoff_allowed &&
                  point.provider_point_id !== destinationPoint?.provider_point_id
              ) ?? null
            : null
        const quoteInput: DeliveryHubListQuotesInput | null =
          deliveryHubAddressContext.is_complete && destinationPoint
            ? {
                connection_id:
                  readiness?.quote_context?.connection.connection_id ??
                  selection?.selection?.connection_id ??
                  catalog?.default_connection_id ??
                  null,
                mode_code: modeCode,
                currency_code: cart.currency_code,
                destination_point_id: destinationPoint.provider_point_id,
                destination_address: buildDeliveryHubQuoteDestinationAddress(
                  destinationPoint,
                  deliveryHubAddressContext
                ),
                warehouse_id:
                  modeCode === "warehouse_to_pickup_point" &&
                  DELIVERY_HUB_PREVIEW_DEFAULT_WAREHOUSE_ID
                    ? DELIVERY_HUB_PREVIEW_DEFAULT_WAREHOUSE_ID
                    : null,
                origin_point_id:
                  modeCode === "dropoff_point_to_pickup_point"
                    ? originPoint?.provider_point_id ?? null
                    : null,
                items: [
                  {
                    quantity: 1,
                    weight_grams: 500,
                    price: typeof cart.subtotal === "number" ? cart.subtotal : undefined,
                  },
                ],
              }
            : null
        const quotes =
          quoteInput &&
          (modeCode !== "dropoff_point_to_pickup_point" || quoteInput.origin_point_id)
            ? await previewDeliveryHubQuotes(quoteInput)
            : null
        const quoteMessage = !destinationPoint
          ? "Выберите ПВЗ, чтобы рассчитать доставку."
          : !quoteInput
            ? "Не хватает адреса доставки или выбранного ПВЗ для расчёта."
            : modeCode === "dropoff_point_to_pickup_point" && !quoteInput.origin_point_id
              ? "Для выбранного способа не найден безопасный пункт передачи отправления."
              : quotes
                ? `Стоимость получена для выбранного ПВЗ: ${getDeliveryHubPickupPointLabel(destinationPoint)}.`
                : `Стоимость временно недоступна для выбранного пункта: ${getDeliveryHubPickupPointLabel(destinationPoint)}. Попробуйте повторить расчёт или выберите другой ПВЗ.`
        setDeliveryHubBuyerQuoteState({
          status: quotes
            ? "ready"
            : destinationPoint && quoteInput
              ? "unavailable"
              : "blocked",
          quotes,
          message: quoteMessage,
        })

        if (cancelled) {
          return
        }

        const previewInput: DeliveryHubNeutralSelectionRehearsalInput = {
          cart_id: cart.id,
          settings,
          catalog,
          quotes,
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
          issue_message: "Delivery Hub rehearsal preview is currently unavailable.",
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
    deliveryHubPickupPointState.last_request_key,
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

  const buildDeliveryHubNeutralPreviewQuoteInput = (): DeliveryHubListQuotesInput | null => {
    const connectionId = deliveryHubNeutralPreviewForm.connection_id.trim()
    const destinationPointId = deliveryHubNeutralPreviewForm.destination_point_id.trim()
    const originPointId = deliveryHubNeutralPreviewForm.origin_point_id.trim()
    const warehouseId = deliveryHubNeutralPreviewForm.warehouse_id.trim()

    if (!deliveryHubAddressContext.is_complete) {
      setDeliveryHubNeutralPreviewState((current) => ({
        ...current,
        status: "blocked",
        message:
          "Fill the checkout shipping address before requesting Delivery Hub preview quotes; hidden dev/default address values are not used.",
      }))
      return null
    }

    if (!destinationPointId) {
      setDeliveryHubNeutralPreviewState((current) => ({
        ...current,
        status: "blocked",
        message: "Destination pickup point id is required for Delivery Hub preview quotes.",
      }))
      return null
    }

    if (
      deliveryHubNeutralPreviewForm.quote_type === "dropoff_point_to_pickup_point" &&
      !originPointId
    ) {
      setDeliveryHubNeutralPreviewState((current) => ({
        ...current,
        status: "blocked",
        message: "Origin dropoff point id is required for dropoff → pickup preview quotes.",
      }))
      return null
    }

    if (
      deliveryHubNeutralPreviewForm.quote_type === "warehouse_to_pickup_point" &&
      !warehouseId
    ) {
      setDeliveryHubNeutralPreviewState((current) => ({
        ...current,
        status: "blocked",
        message: "Warehouse id is required for warehouse → pickup preview quotes.",
      }))
      return null
    }

    const selectedDestinationPoint = getDeliveryHubDestinationPoints(deliveryHubPickupPointState.points)
      .find((point) => point.provider_point_id === destinationPointId) ?? null

    return {
      connection_id: connectionId || null,
      mode_code: deliveryHubNeutralPreviewForm.quote_type,
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
      origin_point_id:
        deliveryHubNeutralPreviewForm.quote_type === "dropoff_point_to_pickup_point"
          ? originPointId
          : null,
      warehouse_id:
        deliveryHubNeutralPreviewForm.quote_type === "warehouse_to_pickup_point"
          ? warehouseId
          : null,
      items: [
        {
          quantity: 1,
          weight_grams: 500,
          price: typeof cart.subtotal === "number" ? cart.subtotal : undefined,
        },
      ],
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
        "Requesting neutral Delivery Hub quotes. Checkout source-of-truth remains unchanged.",
    })

    const quotes = await previewDeliveryHubQuotes(quoteInput)

    if (!quotes) {
      setDeliveryHubNeutralPreviewState({
        status: "error",
        quotes: null,
        selected_quote_reference_id: null,
        selection: null,
        message: "Delivery Hub preview quote request failed or returned an unsafe payload.",
      })
      return
    }

    setDeliveryHubNeutralPreviewState({
      status: "ready",
      quotes,
      selected_quote_reference_id: quotes.quotes[0]?.quote_reference.id ?? null,
      selection: null,
      message: `Delivery Hub preview returned ${quotes.quotes.length} neutral quote(s). Checkout source-of-truth unchanged.`,
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
        message: "Run Delivery Hub preview quote before saving selection metadata.",
      }))
      return
    }

    if (!connectionId) {
      setDeliveryHubNeutralPreviewState((current) => ({
        ...current,
        status: "blocked",
        message: "Connection id is required to save Delivery Hub preview selection metadata.",
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
        amount: selectedQuote.amount,
        currency_code: selectedQuote.currency_code,
        delivery_eta_min: selectedQuote.delivery_eta_min,
        delivery_eta_max: selectedQuote.delivery_eta_max,
        pickup_point_required: selectedQuote.pickup_point_required,
        pickup_window_required: selectedQuote.pickup_window_required,
      },
      pickup_point: {
        provider_point_id: destinationPointId,
        provider_point_code: null,
        name: `Preview pickup point ${destinationPointId}`,
        address: deliveryHubAddressContext.address_label ?? "Preview/sandbox pickup point id supplied by operator",
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
            "Delivery Hub preview selection metadata saved. checkout source-of-truth unchanged.",
        }))
        router.refresh()
      })
      .catch((err) => {
        setDeliveryHubNeutralPreviewState((current) => ({
          ...current,
          status: "error",
          message: err.message ?? "Unable to save Delivery Hub preview selection.",
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
            "Delivery Hub preview selection metadata cleared. checkout source-of-truth unchanged.",
        }))
        router.refresh()
      })
      .catch((err) => {
        setDeliveryHubNeutralPreviewState((current) => ({
          ...current,
          status: "error",
          message: err.message ?? "Unable to clear Delivery Hub preview selection.",
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
      message: "Saving neutral Delivery Hub selection to the cart metadata…",
    })

    await saveDeliveryHubSelection(guard.payload)
      .then(() => {
        setDeliveryHubSelectionCutInState({
          status: "saved",
          message:
            "Neutral Delivery Hub selection saved to the cart metadata. Shipping method commit remains disabled for Delivery Hub.",
        })
        router.refresh()
      })
      .catch((err) => {
        setDeliveryHubSelectionCutInState({
          status: "error",
          message: err.message ?? "Unable to save Delivery Hub selection.",
        })
      })
  }

  const handleClearDeliveryHubSelectionCutIn = async () => {
    if (!cart.id) {
      setDeliveryHubSelectionCutInState({
        status: "blocked",
        message: "Cart id is required before Delivery Hub selection can be cleared.",
      })
      return
    }

    setError(null)
    setDeliveryHubSelectionCutInState({
      status: "clearing",
      message: "Clearing neutral Delivery Hub selection from the cart metadata…",
    })

    await clearDeliveryHubSelection({ cart_id: cart.id })
      .then(() => {
        setDeliveryHubSelectionCutInState({
          status: "cleared",
          message: "Neutral Delivery Hub selection cleared from the cart metadata.",
        })
        router.refresh()
      })
      .catch((err) => {
        setDeliveryHubSelectionCutInState({
          status: "error",
          message: err.message ?? "Unable to clear Delivery Hub selection.",
        })
      })
  }

  const handleDeliveryHubCheckoutCutoverCommit = async () => {
    if (!deliveryHubCommitEligibility.canCommitShippingMethod || !deliveryHubCommitEligibility.shipping_option_id) {
      setDeliveryHubSelectionCutInState({
        status: "blocked",
        message:
          "Delivery Hub checkout is fail-closed: quote/selection readiness is blocked, so no fallback shipping method is selected automatically. Retry after Delivery Hub is ready or ask an operator to resolve delivery setup.",
      })
      return
    }

    setDeliveryHubSelectionCutInState({
      status: "committing",
      message:
        "Committing the matched Delivery Hub Medusa shipping option. No provider payloads or shipment execution are sent.",
    })

    const committed = await commitShippingMethod(deliveryHubCommitEligibility.shipping_option_id)

    if (!committed) {
      setDeliveryHubSelectionCutInState({
        status: "error",
        message:
          "Delivery Hub checkout commit failed safely. No fallback shipping method is selected automatically; retry after refreshing the candidate or ask an operator to resolve Delivery Hub readiness.",
      })
      return
    }

    setDeliveryHubSelectionCutInState({
      status: "committed",
      message:
        "Delivery Hub shipping option committed through Medusa. Shipment creation/execution remains disabled and rollback is flag-off.",
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
  const deliveryHubProjectedCommitParityPreview =
    buildDeliveryHubProjectedCommitParityPreviewModel(
      deliveryHubRehearsalState.preview_input
    )
  const deliveryHubSelectionPayloadParityPreview =
    buildDeliveryHubSelectionPayloadParityPreviewModel(
      deliveryHubRehearsalState.preview_input
    )
  const deliveryHubSelectionWriteSeamPreview =
    buildDeliveryHubSelectionWriteSeamPreviewModel(
      deliveryHubRehearsalState.preview_input
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
  const deliveryHubWriteIntentContractPreview =
    buildDeliveryHubWriteIntentContractPreviewModel(
      deliveryHubRehearsalState.preview_input
    )
  const deliveryHubHandoffContractMatrixPreview =
    buildDeliveryHubHandoffContractMatrixPreviewModel(
      deliveryHubRehearsalState.preview_input
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
                {!deliveryHubCommitEligibility.canCommitShippingMethod && (
                  <Text
                    className="text-ui-fg-muted txt-small"
                    data-testid="delivery-hub-customer-payment-blocker"
                  >
                    Переход к оплате остаётся закрыт до включения системного Delivery Hub shipping-method commit.
                  </Text>
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
                Delivery Hub diagnostics / dev-only validation
              </summary>
              <div className="mt-4">
          <div className="mb-6 rounded-rounded border border-ui-border-base bg-ui-bg-subtle px-5 py-4">
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-col gap-y-2">
                <Text className="text-ui-fg-base txt-medium-plus">
                  Delivery Hub neutral selection rehearsal
                </Text>
                <Text className="text-ui-fg-muted txt-small">
                  Controlled save/clear cut-in for the neutral cart selection contract. Delivery Hub selection metadata can be saved or cleared, while shipping-method commit and live dispatch remain disabled.
                </Text>
                {deliveryHubSavedSelectionSummary.state !== "missing" && (
                  <div className="rounded-rounded border border-ui-border-base bg-ui-bg-base p-3">
                    <div className="grid gap-y-1 text-ui-fg-muted txt-small">
                      <span className="text-ui-fg-base">
                        {deliveryHubSavedSelectionSummary.title}: {deliveryHubSavedSelectionSummary.status_label}
                      </span>
                      <span>{deliveryHubSavedSelectionSummary.finality_label}</span>
                      {deliveryHubSavedSelectionSummary.modality_label && (
                        <span>Saved modality: {deliveryHubSavedSelectionSummary.modality_label}</span>
                      )}
                      {deliveryHubSavedSelectionSummary.quote_amount !== null && (
                        <span>
                          Saved quote: {formatPrice(
                            deliveryHubSavedSelectionSummary.quote_amount,
                            deliveryHubSavedSelectionSummary.currency_code
                          )}
                          {deliveryHubSavedSelectionSummary.quote_eta_label
                            ? ` · ${deliveryHubSavedSelectionSummary.quote_eta_label}`
                            : ""}
                        </span>
                      )}
                      {deliveryHubSavedSelectionSummary.pickup_point_label && (
                        <span>
                          Saved pickup point: {deliveryHubSavedSelectionSummary.pickup_point_label}
                          {deliveryHubSavedSelectionSummary.pickup_point_address_label
                            ? ` · ${deliveryHubSavedSelectionSummary.pickup_point_address_label}`
                            : ""}
                          {deliveryHubSavedSelectionSummary.pickup_point_code_label
                            ? ` · ${deliveryHubSavedSelectionSummary.pickup_point_code_label}`
                            : ""}
                        </span>
                      )}
                      {deliveryHubSavedSelectionSummary.pickup_window_label && (
                        <span>Saved pickup window: {deliveryHubSavedSelectionSummary.pickup_window_label}</span>
                      )}
                      {deliveryHubSavedSelectionSummary.readiness_label && (
                        <span>Readiness: {deliveryHubSavedSelectionSummary.readiness_label}</span>
                      )}
                      {deliveryHubSavedSelectionSummary.saved_at_label && (
                        <span>{deliveryHubSavedSelectionSummary.saved_at_label}</span>
                      )}
                      {deliveryHubSavedSelectionSummary.correlation_id_label && (
                        <span>{deliveryHubSavedSelectionSummary.correlation_id_label}</span>
                      )}
                    </div>
                    {deliveryHubSavedSelectionSummary.reconciliation_messages.length > 0 && (
                      <ul className="mt-2 list-disc pl-4 text-ui-fg-muted txt-small">
                        {deliveryHubSavedSelectionSummary.reconciliation_messages
                          .slice(0, 4)
                          .map((message) => (
                            <li key={message}>{message}</li>
                          ))}
                      </ul>
                    )}
                    {deliveryHubSavedSelectionSummary.action_label && (
                      <Text className="mt-2 text-ui-fg-muted txt-small">
                        {deliveryHubSavedSelectionSummary.action_label}
                      </Text>
                    )}
                  </div>
                )}
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
                    <span data-testid="delivery-hub-buyer-visible-delivery-cost">
                      Delivery Hub delivery cost: {formatPrice(
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
                <div className="rounded-rounded border border-ui-border-base bg-ui-bg-base p-3">
                    <div className="flex flex-col gap-y-3">
                      <div className="grid gap-y-1 text-ui-fg-muted txt-small">
                        <span>
                          Save cut-in guard: {deliveryHubSelectionSaveCutInGuard.status}
                        </span>
                        <span>{deliveryHubSelectionSaveCutInGuard.message}</span>
                        {deliveryHubSelectionSaveCutInGuard.status === "ready" && (
                          <span>
                            POST payload is shaped from neutral cart id, connection id, quote reference, quote summary, pickup point and pickup window only.
                          </span>
                        )}
                        {deliveryHubSelectionSaveCutInGuard.status === "blocked" && (
                          <span>
                            Blockers: {deliveryHubSelectionSaveCutInGuard.reason_codes.join(", ")}
                          </span>
                        )}
                        {deliveryHubSelectionCutInState.message && (
                          <span>{deliveryHubSelectionCutInState.message}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="small"
                          variant="secondary"
                          type="button"
                          disabled={
                            deliveryHubSelectionSaveCutInGuard.status !== "ready" ||
                            deliveryHubSelectionMutationInFlight
                          }
                          onClick={() => {
                            void handleSaveDeliveryHubSelectionCutIn()
                          }}
                        >
                          {deliveryHubSelectionCutInState.status === "saving" ? (
                            <span className="flex items-center gap-x-2">
                              <Loader /> Saving neutral selection
                            </span>
                          ) : (
                            "Save neutral selection"
                          )}
                        </Button>
                        <Button
                          size="small"
                          variant="transparent"
                          type="button"
                          disabled={
                            (!hasPersistedDeliveryHubSelection &&
                              deliveryHubSelectionCutInState.status !== "saved") ||
                            deliveryHubSelectionMutationInFlight
                          }
                          onClick={() => {
                            void handleClearDeliveryHubSelectionCutIn()
                          }}
                        >
                          {deliveryHubSelectionCutInState.status === "clearing" ? (
                            <span className="flex items-center gap-x-2">
                              <Loader /> Clearing neutral selection
                            </span>
                          ) : (
                            "Clear neutral selection"
                          )}
                        </Button>
                      </div>
                      <div
                        className="grid gap-y-1 rounded-rounded border border-ui-border-base bg-ui-bg-subtle p-3 text-ui-fg-muted txt-small"
                        data-testid="delivery-hub-checkout-commit-guard"
                      >
                        <span data-testid="delivery-hub-checkout-commit-guard-status">
                          Commit guard: {deliveryHubCommitEligibility.status}; canCommitShippingMethod={String(deliveryHubCommitEligibility.canCommitShippingMethod)}.
                        </span>
                        <span>{deliveryHubCommitEligibility.status_label}</span>
                        <span>{deliveryHubCommitEligibility.detail_label}</span>
                        <span>Candidate shipping option: {deliveryHubCommitEligibility.shipping_option_id ?? "none"}</span>
                        <span>Current shipping option: {deliveryHubCommitEligibility.current_shipping_option_id ?? "none"}</span>
                        {deliveryHubCommitEligibility.reason_codes.length > 0 && (
                          <span>Commit blockers: {deliveryHubCommitEligibility.reason_codes.join(", ")}</span>
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
                              <Loader /> Committing Delivery Hub shipping
                            </span>
                          ) : (
                            "Commit Delivery Hub shipping option"
                          )}
                        </Button>
                      </div>
                    </div>
</div>
              </div>

              <div className="border-t border-ui-border-base pt-4">
                <div className="flex flex-col gap-y-2">
                  <Text className="text-ui-fg-base txt-medium-plus">
                    Delivery Hub neutral shipping-option parity preview
                  </Text>
                  <Text className="text-ui-fg-muted txt-small">
                    Preview-only parity seam. This block compares the neutral delivery candidate with the current storefront shipping-option context using shopper-safe structural signals only.
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
                    Delivery Hub projected commit parity preview
                  </Text>
                  <Text className="text-ui-fg-muted txt-small">
                    Preview-only projected commit seam. This block compares the current neutral delivery-hub selection preview with the future shipping-option commit contract shape using shopper-safe diagnostic fields only.
                  </Text>
                  <div className="grid gap-y-1 text-ui-fg-muted txt-small">
                    <span>{deliveryHubProjectedCommitParityPreview.verdict_label}</span>
                    <span>{deliveryHubProjectedCommitParityPreview.summary_label}</span>
                    <span>{deliveryHubProjectedCommitParityPreview.projected_commit_label}</span>
                    <span>Preview verdict: {deliveryHubProjectedCommitParityPreview.verdict}</span>
                    <span>
                      commit payload readiness: {deliveryHubProjectedCommitParityPreview.commit_payload_readiness}
                    </span>
                    <span>
                      matched fields: {deliveryHubProjectedCommitParityPreview.matched_field_count}
                      {` · mismatched fields: ${deliveryHubProjectedCommitParityPreview.mismatched_field_count}`}
                    </span>
                    <span>
                      connection_id: {deliveryHubProjectedCommitParityPreview.connection_id ?? "missing"}
                    </span>
                    <span>
                      mode_code: {deliveryHubProjectedCommitParityPreview.mode_code ?? "missing"}
                    </span>
                    {deliveryHubProjectedCommitParityPreview.mode_label && (
                      <span>Mode label: {deliveryHubProjectedCommitParityPreview.mode_label}</span>
                    )}
                    <span>
                      quote_reference: {deliveryHubProjectedCommitParityPreview.quote_reference_present ? "present" : "missing"}
                    </span>
                    <span>
                      pickup point: {deliveryHubProjectedCommitParityPreview.pickup_point_present ? "present" : "missing"}
                      {deliveryHubProjectedCommitParityPreview.pickup_point_required
                        ? " · required"
                        : " · not required"}
                    </span>
                    <span>
                      pickup window: {deliveryHubProjectedCommitParityPreview.pickup_window_present ? "present" : "missing"}
                      {deliveryHubProjectedCommitParityPreview.pickup_window_required
                        ? " · required"
                        : " · not required"}
                    </span>
                    {deliveryHubProjectedCommitParityPreview.fields.map((field) => (
                      <span key={field.key}>
                        {field.label}: {field.status} · {field.detail_label}
                      </span>
                    ))}
                  </div>
                  {deliveryHubProjectedCommitParityPreview.mismatch_reasons.length > 0 && (
                    <div className="text-ui-fg-muted txt-small">
                      Mismatch reasons: {deliveryHubProjectedCommitParityPreview.mismatch_reasons.join(" | ")}
                    </div>
                  )}
                  {deliveryHubProjectedCommitParityPreview.blocked_readiness_codes.length > 0 && (
                    <div className="text-ui-fg-muted txt-small">
                      Readiness blockers: shopper-safe projected commit preview remains unavailable until the current delivery selection context is ready.
                    </div>
                  )}
                  {deliveryHubProjectedCommitParityPreview.blocked_parity_codes.length > 0 && (
                    <div className="text-ui-fg-muted txt-small">
                      Parity blockers: shopper-safe projected commit preview remains unavailable until the current delivery option aligns with the committed checkout context.
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-ui-border-base pt-4">
                <div className="flex flex-col gap-y-2">
                  <Text className="text-ui-fg-base txt-medium-plus">
                    Delivery Hub selection payload parity preview
                  </Text>
                  <Text className="text-ui-fg-muted txt-small">
                    Preview-only selection payload parity seam. This block compares the projected storefront payload shape for POST /store/delivery/selection with the expected neutral save-contract shape using shopper-safe diagnostic fields only.
                  </Text>
                  <div className="grid gap-y-1 text-ui-fg-muted txt-small">
                    <span>{deliveryHubSelectionPayloadParityPreview.verdict_label}</span>
                    <span>{deliveryHubSelectionPayloadParityPreview.summary_label}</span>
                    <span>{deliveryHubSelectionPayloadParityPreview.projected_payload_label}</span>
                    <span>{deliveryHubSelectionPayloadParityPreview.expected_contract_label}</span>
                    <span>{deliveryHubSelectionPayloadParityPreview.payload_target_label}</span>
                    <span>Preview verdict: {deliveryHubSelectionPayloadParityPreview.verdict}</span>
                    <span>
                      matched fields: {deliveryHubSelectionPayloadParityPreview.matched_field_count}
                      {` · incomplete fields: ${deliveryHubSelectionPayloadParityPreview.incomplete_field_count}`}
                      {` · blocked fields: ${deliveryHubSelectionPayloadParityPreview.blocked_field_count}`}
                    </span>
                    <span>
                      connection_id: {deliveryHubSelectionPayloadParityPreview.connection_id ?? "missing"}
                    </span>
                    <span>
                      quote_type: {deliveryHubSelectionPayloadParityPreview.quote_type ?? "missing"}
                    </span>
                    {deliveryHubSelectionPayloadParityPreview.quote_type_label && (
                      <span>
                        Quote type label: {deliveryHubSelectionPayloadParityPreview.quote_type_label}
                      </span>
                    )}
                    <span>
                      quote_reference: {deliveryHubSelectionPayloadParityPreview.quote_reference_present ? "present" : "missing"}
                    </span>
                    <span>
                      pickup point: {deliveryHubSelectionPayloadParityPreview.pickup_point_present ? "present" : "missing"}
                      {deliveryHubSelectionPayloadParityPreview.pickup_point_required
                        ? " · required"
                        : " · not required"}
                    </span>
                    <span>
                      pickup window: {deliveryHubSelectionPayloadParityPreview.pickup_window_present ? "present" : "missing"}
                      {deliveryHubSelectionPayloadParityPreview.pickup_window_required
                        ? " · required"
                        : " · not required"}
                    </span>
                    <span>
                      selection_version: {deliveryHubSelectionPayloadParityPreview.selection_version ?? "missing"}
                    </span>
                    <span>
                      shape completeness: {deliveryHubSelectionPayloadParityPreview.shape_completeness}
                    </span>
                    {deliveryHubSelectionPayloadParityPreview.fields.map((field) => (
                      <span key={field.key}>
                        {field.label}: {field.status} · {field.detail_label}
                      </span>
                    ))}
                  </div>
                  {deliveryHubSelectionPayloadParityPreview.blocked_reasons.length > 0 && (
                    <div className="text-ui-fg-muted txt-small">
                      Parity notes: {deliveryHubSelectionPayloadParityPreview.blocked_reasons.join(", ")}
                    </div>
                  )}
                  {deliveryHubSelectionPayloadParityPreview.hint_messages.length > 0 && (
                    <ul className="list-disc pl-4 text-ui-fg-muted txt-small">
                      {deliveryHubSelectionPayloadParityPreview.hint_messages
                        .slice(0, 4)
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
                    Delivery Hub selection write seam preview
                  </Text>
                  <Text className="text-ui-fg-muted txt-small">
                    Preview-only selection write seam. This block shows which shopper-safe request shape could someday be prepared for POST /store/delivery/selection using existing read-only preview surfaces only.
                  </Text>
                  <div className="grid gap-y-1 text-ui-fg-muted txt-small">
                    <span>{deliveryHubSelectionWriteSeamPreview.verdict_label}</span>
                    <span>{deliveryHubSelectionWriteSeamPreview.summary_label}</span>
                    <span>{deliveryHubSelectionWriteSeamPreview.projected_request_label}</span>
                    <span>Preview verdict: {deliveryHubSelectionWriteSeamPreview.verdict}</span>
                    <span>
                      shape completeness: {deliveryHubSelectionWriteSeamPreview.shape_completeness}
                    </span>
                    <span>
                      projected fields: {deliveryHubSelectionWriteSeamPreview.projected_field_count}
                      {` · missing fields: ${deliveryHubSelectionWriteSeamPreview.missing_field_count}`}
                    </span>
                    <span>cart_id: {deliveryHubSelectionWriteSeamPreview.cart_id ?? "missing"}</span>
                    <span>
                      connection_id: {deliveryHubSelectionWriteSeamPreview.connection_id ?? "missing"}
                    </span>
                    <span>
                      quote_type: {deliveryHubSelectionWriteSeamPreview.quote_type ?? "missing"}
                    </span>
                    {deliveryHubSelectionWriteSeamPreview.quote_type_label && (
                      <span>
                        Quote type label: {deliveryHubSelectionWriteSeamPreview.quote_type_label}
                      </span>
                    )}
                    <span>
                      quote_reference: {deliveryHubSelectionWriteSeamPreview.quote_reference_present ? "present" : "missing"}
                    </span>
                    <span>
                      quote: {deliveryHubSelectionWriteSeamPreview.quote_present ? "present" : "missing"}
                    </span>
                    <span>
                      pickup point: {deliveryHubSelectionWriteSeamPreview.pickup_point_present ? "present" : "missing"}
                      {deliveryHubSelectionWriteSeamPreview.pickup_point_required
                        ? " · required"
                        : " · not required"}
                    </span>
                    <span>
                      pickup window: {deliveryHubSelectionWriteSeamPreview.pickup_window_present ? "present" : "missing"}
                      {deliveryHubSelectionWriteSeamPreview.pickup_window_required
                        ? " · required"
                        : " · not required"}
                    </span>
                    <span>
                      selection_version: {deliveryHubSelectionWriteSeamPreview.selection_version ?? "missing"}
                    </span>
                    {deliveryHubSelectionWriteSeamPreview.fields.map((field) => (
                      <span key={field.key}>
                        {field.label}: {field.status} · {field.detail_label}
                      </span>
                    ))}
                  </div>
                  {deliveryHubSelectionWriteSeamPreview.mismatch_reasons.length > 0 && (
                    <div className="text-ui-fg-muted txt-small">
                      Shape notes: {deliveryHubSelectionWriteSeamPreview.mismatch_reasons.join(" | ")}
                    </div>
                  )}
                  {deliveryHubSelectionWriteSeamPreview.blocked_codes.length > 0 && (
                    <div className="text-ui-fg-muted txt-small">
                      Preview blockers: {deliveryHubSelectionWriteSeamPreview.blocked_codes.join(", ")}
                    </div>
                  )}
                </div>
              </div>

              {DELIVERY_HUB_PREVIEW_ENABLED && (
                <div
                  className="border-t border-ui-border-base pt-4"
                  data-testid="delivery-hub-preview-shadow-block"
                >
                  <div className="flex flex-col gap-y-3 rounded-rounded border border-ui-border-base bg-ui-bg-base p-4">
                    <div className="flex flex-col gap-y-2">
                      <Text
                        className="text-ui-fg-base txt-medium-plus"
                        data-testid="delivery-hub-preview-heading"
                      >
                        Delivery Hub Preview/Shadow UI
                      </Text>
                      <Text className="text-ui-fg-muted txt-small">
                        Operator/dev validation surface. It calls neutral Delivery Hub store endpoints and can save neutral metadata. The active checkout path is Delivery Hub only: shipping-method commit can call setShippingMethod() only when the explicit cutover flag is true and a ready Delivery Hub candidate maps to an available Medusa shipping option; otherwise checkout delivery fails closed with retry/operator action and no automatic legacy delivery fallback.
                      </Text>
                      <div
                        className="grid gap-y-1 rounded-rounded border border-ui-border-base bg-ui-bg-subtle p-3 text-ui-fg-muted txt-small"
                        data-testid="delivery-hub-preview-guardrails"
                      >
                        <span data-testid="delivery-hub-preview-feature-flag-status">
                          Feature flag: NEXT_PUBLIC_DELIVERY_HUB_PREVIEW_ENABLED=true.
                        </span>
                        <span data-testid="delivery-hub-preview-dev-defaults-status">
                          Sandbox defaults: {DELIVERY_HUB_PREVIEW_DEV_DEFAULTS_ENABLED ? "enabled for local/dev ids" : "disabled; enter non-secret ids manually"}.
                        </span>
                        <span data-testid="delivery-hub-preview-source-of-truth-guardrail">
                          Guardrail: checkout source-of-truth unchanged; Delivery Hub preview metadata does not commit a Medusa shipping method.
                        </span>
                        <span data-testid="delivery-hub-preview-no-provider-raw-guardrail">
                          Diagnostics are shopper-safe only: quote/selection status, count, price, ETA and safe correlation id; no raw provider body, token, auth header, ciphertext or publishable key value is displayed.
                        </span>
                        <div
                          className="mt-2 grid gap-y-1 rounded-rounded border border-ui-border-base bg-ui-bg-base p-3"
                          data-testid="delivery-hub-cutover-gate-status"
                        >
                          <span data-testid="delivery-hub-cutover-gate-flag-status">
                            Checkout cutover flag: NEXT_PUBLIC_DELIVERY_HUB_CHECKOUT_CUTOVER_ENABLED={deliveryHubCheckoutCutoverGateStatus.enabled ? "true" : "false"}.
                          </span>
                          <span data-testid="delivery-hub-cutover-gate-mode">
                            Cutover gate mode: {deliveryHubCheckoutCutoverGateStatus.mode}; canCommitShippingMethod={String(deliveryHubCheckoutCutoverGateStatus.canCommitShippingMethod)}.
                          </span>
                          <span data-testid="delivery-hub-cutover-gate-summary">
                            {deliveryHubCheckoutCutoverGateStatus.status_label}
                          </span>
                          <span data-testid="delivery-hub-cutover-gate-detail">
                            {deliveryHubCheckoutCutoverGateStatus.detail_label}
                          </span>
                          <span>
                            Required readiness evidence: {deliveryHubCheckoutCutoverGateStatus.required_readiness_evidence.map((item) => item.label).join("; ")}.
                          </span>
                          <span>
                            Commit guardrails: {deliveryHubCheckoutCutoverGateStatus.canCommitShippingMethod ? "ready candidate can commit matched shipping option" : deliveryHubCheckoutCutoverGateStatus.blocker_labels.join(" ")}
                          </span>
                        </div>
                        <div
                          className="mt-2 grid gap-y-1 rounded-rounded border border-ui-border-base bg-ui-bg-base p-3"
                          data-testid="delivery-hub-cutover-preconditions-status"
                        >
                          <span data-testid="delivery-hub-cutover-preconditions-availability">
                            Preconditions verifier: {deliveryHubCutoverPreconditionsPreview.availability}; load status={deliveryHubCutoverPreconditionsState.status}.
                          </span>
                          <span data-testid="delivery-hub-cutover-preconditions-summary">
                            {deliveryHubCutoverPreconditionsPreview.status_label} · {deliveryHubCutoverPreconditionsPreview.summary_label}
                          </span>
                          <span data-testid="delivery-hub-cutover-preconditions-commit-status">
                            {deliveryHubCutoverPreconditionsPreview.commit_label}; canCommitShippingMethod={String(deliveryHubCutoverPreconditionsPreview.canCommitShippingMethod)}.
                          </span>
                          <span data-testid="delivery-hub-cutover-preconditions-guardrails">
                            Guardrails: {deliveryHubCutoverPreconditionsPreview.guardrail_labels.join("; ")}.
                          </span>
                          <span data-testid="delivery-hub-cutover-preconditions-missing">
                            Missing/required/blocked: {[
                              ...deliveryHubCutoverPreconditionsPreview.missing_codes,
                              ...deliveryHubCutoverPreconditionsPreview.required_codes,
                              ...deliveryHubCutoverPreconditionsPreview.blocked_codes,
                            ].join(", ") || "none"}.
                          </span>
                          {deliveryHubCutoverPreconditionsPreview.preconditions.slice(0, 10).map((precondition) => (
                            <span key={precondition.code}>
                              {precondition.code}: {precondition.status} · {precondition.detail}
                            </span>
                          ))}
                        </div>
                        <div
                          className="mt-2 grid gap-y-1 rounded-rounded border border-ui-border-base bg-ui-bg-base p-3"
                          data-testid="delivery-hub-cutover-candidate-status"
                        >
                          <span data-testid="delivery-hub-cutover-candidate-availability">
                            Candidate planner: {deliveryHubCutoverCandidatePreview.availability}; load status={deliveryHubCutoverCandidateState.status}.
                          </span>
                          <span data-testid="delivery-hub-cutover-candidate-summary">
                            {deliveryHubCutoverCandidatePreview.status_label} · {deliveryHubCutoverCandidatePreview.detail_label}
                          </span>
                          <span data-testid="delivery-hub-cutover-candidate-commit-status">
                            candidate evidence only; checkout commit requires explicit flag plus local commit guard; canCommitShippingMethod={String(deliveryHubCommitEligibility.canCommitShippingMethod)}.
                          </span>
                          {deliveryHubCutoverCandidatePreview.candidate_label && (
                            <span data-testid="delivery-hub-cutover-candidate-option">
                              Candidate shipping option: {deliveryHubCutoverCandidatePreview.candidate_label}
                            </span>
                          )}
                          {deliveryHubCutoverCandidatePreview.amount_label && (
                            <span data-testid="delivery-hub-cutover-candidate-amount">
                              Candidate amount: {deliveryHubCutoverCandidatePreview.amount_label}
                            </span>
                          )}
                          {deliveryHubCutoverCandidatePreview.pickup_point_label && (
                            <span data-testid="delivery-hub-cutover-candidate-pickup-point">
                              Candidate pickup point: {deliveryHubCutoverCandidatePreview.pickup_point_label}
                            </span>
                          )}
                          <span data-testid="delivery-hub-cutover-candidate-blockers">
                            Blocked reasons: {deliveryHubCutoverCandidatePreview.blocked_reasons.join(", ") || "none"}.
                          </span>
                          <span data-testid="delivery-hub-cutover-candidate-preconditions">
                            Required preconditions: {deliveryHubCutoverCandidatePreview.required_preconditions.join(", ") || "none"}.
                          </span>
                          <span data-testid="delivery-hub-cutover-candidate-guardrails">
                            Guardrails: {deliveryHubCutoverCandidatePreview.guardrail_labels.join("; ")}.
                          </span>
                          {deliveryHubCutoverCandidatePreview.hint_messages.slice(0, 4).map((message) => (
                            <span key={message}>{message}</span>
                          ))}
                        </div>
                        <div
                          className="mt-2 grid gap-y-1 rounded-rounded border border-ui-border-base bg-ui-bg-base p-3"
                          data-testid="delivery-hub-cutover-approval-artifact"
                        >
                          <span data-testid="delivery-hub-cutover-approval-artifact-availability">
                            Approval artifact: {deliveryHubCutoverApprovalArtifactPreview.availability}; load status={deliveryHubCutoverApprovalArtifactState.status}.
                          </span>
                          <span data-testid="delivery-hub-cutover-approval-artifact-status">
                            {deliveryHubCutoverApprovalArtifactPreview.status_label} · {deliveryHubCutoverApprovalArtifactPreview.detail_label}
                          </span>
                          <span data-testid="delivery-hub-cutover-approval-artifact-evidence">
                            Evidence snapshot: {deliveryHubCutoverApprovalArtifactPreview.evidence_label}
                          </span>
                          {deliveryHubCutoverApprovalArtifactPreview.cart_label && (
                            <span data-testid="delivery-hub-cutover-approval-artifact-cart">
                              Artifact cart scope: {deliveryHubCutoverApprovalArtifactPreview.cart_label}.
                            </span>
                          )}
                          <span data-testid="delivery-hub-cutover-approval-artifact-candidate">
                            Candidate summary: {deliveryHubCutoverApprovalArtifactPreview.candidate_label}
                          </span>
                          <span data-testid="delivery-hub-cutover-approval-artifact-commit-controls">
                            Commit controls: {deliveryHubCutoverApprovalArtifactPreview.commit_control_labels.join("; ")}; canCommitShippingMethod={String(deliveryHubCutoverApprovalArtifactPreview.canCommitShippingMethod)}.
                          </span>
                          <span data-testid="delivery-hub-cutover-approval-artifact-signoffs">
                            Required signoffs: {deliveryHubCutoverApprovalArtifactPreview.signoff_labels.join("; ")}.
                          </span>
                          <span data-testid="delivery-hub-cutover-approval-artifact-acknowledgements">
                            Required acknowledgements placeholders: {deliveryHubCutoverApprovalArtifactPreview.acknowledgement_labels.join("; ")}.
                          </span>
                          {deliveryHubCutoverApprovalArtifactPreview.hint_messages.slice(0, 4).map((message) => (
                            <span key={message}>{message}</span>
                          ))}
                        </div>
                      </div>
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
                          data-testid="delivery-hub-preview-quote-type"
                        >
                          <option value="dropoff_point_to_pickup_point">
                            Dropoff point → pickup point
                          </option>
                          <option value="warehouse_to_pickup_point">
                            Warehouse → pickup point
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
                          data-testid="delivery-hub-preview-connection-id"
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
                          data-testid="delivery-hub-preview-destination-point-id"
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
                          data-testid="delivery-hub-preview-origin-point-id"
                        />
                      </label>
                      <label className="flex flex-col gap-y-1 text-ui-fg-muted txt-small">
                        Warehouse id
                        <input
                          className="rounded-rounded border border-ui-border-base bg-ui-bg-base px-3 py-2 text-ui-fg-base"
                          value={deliveryHubNeutralPreviewForm.warehouse_id}
                          onChange={(event) =>
                            updateDeliveryHubNeutralPreviewField(
                              "warehouse_id",
                              event.target.value
                            )
                          }
                          placeholder="Required for warehouse → pickup"
                          data-testid="delivery-hub-preview-warehouse-id"
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
                        data-testid="delivery-hub-preview-get-quotes-button"
                      >
                        {deliveryHubNeutralPreviewBusy ? (
                          <span className="flex items-center gap-x-2">
                            <Loader /> Loading preview quotes
                          </span>
                        ) : (
                          "Get neutral preview quotes"
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
                        data-testid="delivery-hub-preview-save-selection-button"
                      >
                        Save preview metadata
                      </Button>
                      <Button
                        size="small"
                        variant="transparent"
                        type="button"
                        disabled={deliveryHubNeutralPreviewBusy}
                        onClick={() => {
                          void handleClearDeliveryHubNeutralPreviewSelection()
                        }}
                        data-testid="delivery-hub-preview-clear-selection-button"
                      >
                        Clear preview metadata
                      </Button>
                    </div>

                    <div
                      className="grid gap-y-1 text-ui-fg-muted txt-small"
                      data-testid="delivery-hub-preview-results"
                    >
                      <span data-testid="delivery-hub-preview-source-of-truth-status">
                        checkout source-of-truth unchanged
                      </span>
                      <span data-testid="delivery-hub-preview-operation-status">
                        Operation status: {deliveryHubNeutralPreviewState.status}
                      </span>
                      <span data-testid="delivery-hub-preview-quote-count">
                        Quote count: {deliveryHubNeutralPreviewQuotes.length}
                      </span>
                      <span data-testid="delivery-hub-preview-quote-correlation-id">
                        Quote correlation id: {deliveryHubNeutralPreviewState.quotes?.diagnostics?.correlation_id ?? "not returned"}
                      </span>
                      <span data-testid="delivery-hub-preview-selection-status">
                        Selection saved status: {deliveryHubNeutralPreviewState.selection?.selection ? "saved" : deliveryHubNeutralPreviewState.selection ? "cleared" : "not saved in this preview session"}
                      </span>
                      <span data-testid="delivery-hub-preview-selection-correlation-id">
                        Selection correlation id: {deliveryHubNeutralPreviewState.selection?.diagnostics?.correlation_id ?? "not returned"}
                      </span>
                      {deliveryHubNeutralPreviewState.message && (
                        <span data-testid="delivery-hub-preview-message">
                          {deliveryHubNeutralPreviewState.message}
                        </span>
                      )}
                    </div>

                    {deliveryHubNeutralPreviewQuotes.length > 0 && (
                      <div className="grid gap-y-2" data-testid="delivery-hub-preview-quotes-list">
                        <Text className="text-ui-fg-base txt-small-plus">
                          Neutral quotes
                        </Text>
                        {deliveryHubNeutralPreviewQuotes.slice(0, 6).map((quote) => (
                          <label
                            key={quote.quote_reference.id}
                            className="flex cursor-pointer flex-col gap-y-1 rounded-rounded border border-ui-border-base bg-ui-bg-subtle p-3 text-ui-fg-muted txt-small"
                            data-testid="delivery-hub-preview-quote-option"
                          >
                            <span className="flex items-center gap-x-2 text-ui-fg-base">
                              <input
                                type="radio"
                                name="delivery-hub-preview-quote"
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
                                data-testid="delivery-hub-preview-quote-radio"
                              />
                              {quote.carrier_label} · {formatPrice(quote.amount, quote.currency_code)}
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
              )}

              <div className="border-t border-ui-border-base pt-4">
                <div className="flex flex-col gap-y-2">
                  <Text className="text-ui-fg-base txt-medium-plus">
                    Delivery Hub write-intent contract preview
                  </Text>
                  <Text className="text-ui-fg-muted txt-small">
                    Preview-only write-intent contract seam. This block truthfully shows how ready the storefront preview stack is for a future shopper-safe write intent targeting POST /store/delivery/selection, without submit wiring, persistence, or network activity.
                  </Text>
                  <div className="grid gap-y-1 text-ui-fg-muted txt-small">
                    <span>{deliveryHubWriteIntentContractPreview.status_label}</span>
                    <span>{deliveryHubWriteIntentContractPreview.summary_label}</span>
                    <span>{deliveryHubWriteIntentContractPreview.preview_label}</span>
                    <span>{deliveryHubWriteIntentContractPreview.intent_target_label}</span>
                    <span>Preview status: {deliveryHubWriteIntentContractPreview.status}</span>
                    <span>
                      mutation_intent: {String(deliveryHubWriteIntentContractPreview.mutation_intent)}
                      {` · submit_enabled: ${String(deliveryHubWriteIntentContractPreview.submit_enabled)}`}
                      {` · network_required_now: ${String(deliveryHubWriteIntentContractPreview.network_required_now)}`}
                    </span>
                    <span>
                      prerequisites satisfied: {deliveryHubWriteIntentContractPreview.satisfied_prerequisite_count}
                      {` / ${deliveryHubWriteIntentContractPreview.required_prerequisite_count}`}
                      {` · missing: ${deliveryHubWriteIntentContractPreview.missing_prerequisite_count}`}
                      {` · blocked: ${deliveryHubWriteIntentContractPreview.blocked_prerequisite_count}`}
                    </span>
                    <span>
                      intent target: {deliveryHubWriteIntentContractPreview.shopper_safe_intent_target}
                    </span>
                    {deliveryHubWriteIntentContractPreview.prerequisites.map((prerequisite) => (
                      <span key={prerequisite.key}>
                        {prerequisite.label}: {prerequisite.status} · {prerequisite.detail_label}
                      </span>
                    ))}
                  </div>
                  <div className="text-ui-fg-muted txt-small">
                    Disabled actions: {deliveryHubWriteIntentContractPreview.disabled_actions.join(", ")}
                  </div>
                  {deliveryHubWriteIntentContractPreview.blocked_reasons.length > 0 && (
                    <div className="text-ui-fg-muted txt-small">
                      Blocked reasons: {deliveryHubWriteIntentContractPreview.blocked_reasons.join(", ")}
                    </div>
                  )}
                  {deliveryHubWriteIntentContractPreview.hint_messages.length > 0 && (
                    <ul className="list-disc pl-4 text-ui-fg-muted txt-small">
                      {deliveryHubWriteIntentContractPreview.hint_messages
                        .slice(0, 4)
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
