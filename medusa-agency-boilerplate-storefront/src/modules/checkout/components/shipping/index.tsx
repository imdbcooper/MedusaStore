"use client"

import { Radio, RadioGroup } from "@headlessui/react"
import { setShippingMethod } from "@lib/data/cart"
import {
  clearDeliveryHubSelection,
  listDeliveryHubPickupPoints,
  listDeliveryHubPickupWindows,
  listDeliveryHubQuotes,
  retrieveDeliveryHubReadiness,
  retrieveDeliveryHubSelection,
  retrieveDeliveryHubSettings,
  saveDeliveryHubSelection,
} from "@lib/data/delivery-hub"
import { calculatePriceForShippingOption } from "@lib/data/fulfillment"
import { storefrontConfig } from "@lib/storefront-config"
import {
  buildDeliveryHubCommitEligibilityModel,
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

type DeliveryHubRehearsalState = {
  status: "idle" | "loading" | "ready" | "error"
  model: DeliveryHubNeutralSelectionRehearsalModel
  preview_input: DeliveryHubNeutralSelectionRehearsalInput
  issue_message: string | null
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
          cart_id: cart.id,
          settings,
          quotes,
          pickup_points: pickupPoints,
          pickup_windows: pickupWindows,
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

        const previewInput: DeliveryHubNeutralSelectionRehearsalInput = {
          cart_id: cart.id,
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
    cart.shipping_address?.city,
    cart.shipping_address?.country_code,
    cartShippingMethod?.name,
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
    data?: Record<string, unknown>
  ) => {
    setError(null)
    setIsLoading(true)
    const previousId = shippingMethodId
    setShippingMethodId(id)

    await setShippingMethod({
      cartId: cart.id,
      shippingMethodId: id,
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
  const isSelectionCommitted = shippingMethodId
    ? cartShippingMethod?.shipping_option_id === shippingMethodId
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
  const deliveryHubWriteIntentContractPreview =
    buildDeliveryHubWriteIntentContractPreviewModel(
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
