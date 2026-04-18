"use client"

import { Radio, RadioGroup } from "@headlessui/react"
import { setShippingMethod } from "@lib/data/cart"
import { listApiShipCourierRates } from "@lib/data/apiship"
import { calculatePriceForShippingOption } from "@lib/data/fulfillment"
import { storefrontConfig } from "@lib/storefront-config"
import { convertToLocale } from "@lib/util/money"
import { CheckCircleSolid, Loader } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { Button, clx, Heading, Text } from "@medusajs/ui"
import ErrorMessage from "@modules/checkout/components/error-message"
import Divider from "@modules/common/components/divider"
import MedusaRadio from "@modules/common/components/radio"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

const PICKUP_OPTION_ON = "__PICKUP_ON"
const PICKUP_OPTION_OFF = "__PICKUP_OFF"

type ApiShipQuote = {
  amount: number
  currency_code: string
  shipping_option_id: string
  shipping_option_name: string
  provider_key: string | null
  tariff_id: number | null
  provider_label: string
  estimated_days_min: number | null
  estimated_days_max: number | null
}

type ShippingProps = {
  cart: HttpTypes.StoreCart
  availableShippingMethods: HttpTypes.StoreCartShippingOption[] | null
}

function formatAddress(address: HttpTypes.StoreCartAddress) {
  if (!address) {
    return ""
  }

  let ret = ""

  if (address.address_1) {
    ret += ` ${address.address_1}`
  }

  if (address.address_2) {
    ret += `, ${address.address_2}`
  }

  if (address.postal_code) {
    ret += `, ${address.postal_code} ${address.city}`
  }

  if (address.country_code) {
    ret += `, ${address.country_code.toUpperCase()}`
  }

  return ret
}

const Shipping: React.FC<ShippingProps> = ({
  cart,
  availableShippingMethods,
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingPrices, setIsLoadingPrices] = useState(true)

  const [showPickupOptions, setShowPickupOptions] =
    useState<string>(PICKUP_OPTION_OFF)
  const [calculatedPricesMap, setCalculatedPricesMap] = useState<
    Record<string, number>
  >({})
  const [apishipQuotesMap, setApishipQuotesMap] = useState<
    Record<string, ApiShipQuote[]>
  >({})
  const [error, setError] = useState<string | null>(null)
  const [shippingMethodId, setShippingMethodId] = useState<string | null>(
    cart.shipping_methods?.at(-1)?.shipping_option_id || null
  )

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = searchParams.get("step") === "delivery"

  const shippingMethods = useMemo(
    () => availableShippingMethods ?? [],
    [availableShippingMethods]
  )
  const pickupMethods = useMemo<HttpTypes.StoreCartShippingOption[]>(() => [], [])

  const hasPickupOptions = false
  const checkoutCopy = storefrontConfig.copy.checkout
  const commonCopy = storefrontConfig.copy.common

  useEffect(() => {
    setIsLoadingPrices(true)

    if (shippingMethods.length) {
      const pricePromises = shippingMethods
        .filter((shippingMethod) => shippingMethod.price_type === "calculated")
        .map((shippingMethod) =>
          calculatePriceForShippingOption(shippingMethod.id, cart.id)
        )

      const apishipPromises = shippingMethods
        .filter(
          (shippingMethod) =>
            shippingMethod.price_type === "calculated" &&
            shippingMethod.provider_id === "apiship_apiship"
        )
        .map(async (shippingMethod) => ({
          optionId: shippingMethod.id,
          quotes: await listApiShipCourierRates(cart.id, shippingMethod.id),
        }))

      Promise.allSettled(pricePromises).then((results) => {
        const pricesMap: Record<string, number> = {}

        results
          .filter((result) => result.status === "fulfilled")
          .forEach((result) => {
            pricesMap[result.value?.id || ""] = result.value?.amount!
          })

        setCalculatedPricesMap(pricesMap)
        setIsLoadingPrices(false)
      })

      Promise.allSettled(apishipPromises).then((results) => {
        const quotesMap: Record<string, ApiShipQuote[]> = {}

        results
          .filter((result) => result.status === "fulfilled")
          .forEach((result) => {
            quotesMap[result.value.optionId] = result.value.quotes ?? []
          })

        setApishipQuotesMap(quotesMap)
      })
    } else {
      setIsLoadingPrices(false)
    }

    if (pickupMethods.find((method) => method.id === shippingMethodId)) {
      setShowPickupOptions(PICKUP_OPTION_ON)
    }
  }, [availableShippingMethods, cart.id, shippingMethodId, shippingMethods, pickupMethods])

  const handleEdit = () => {
    router.push(pathname + "?step=delivery", { scroll: false })
  }

  const handleSubmit = () => {
    router.push(pathname + "?step=payment", { scroll: false })
  }

  const handleSetShippingMethod = async (
    id: string,
    variant: "shipping" | "pickup",
    data?: Record<string, unknown>
  ) => {
    setError(null)

    if (variant === "pickup") {
      setShowPickupOptions(PICKUP_OPTION_ON)
    } else {
      setShowPickupOptions(PICKUP_OPTION_OFF)
    }

    let currentId: string | null = null
    setIsLoading(true)
    setShippingMethodId((prev) => {
      currentId = prev
      return id
    })

    await setShippingMethod({ cartId: cart.id, shippingMethodId: id, data })
      .catch((err) => {
        setShippingMethodId(currentId)
        setError(err.message)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  useEffect(() => {
    setError(null)
  }, [isOpen])

  const getOptionPriceLabel = (option: HttpTypes.StoreCartShippingOption) => {
    if (option.price_type === "flat") {
      return convertToLocale({
        amount: option.amount!,
        currency_code: cart?.currency_code,
      })
    }

    if (typeof calculatedPricesMap[option.id] === "number") {
      return convertToLocale({
        amount: calculatedPricesMap[option.id],
        currency_code: cart?.currency_code,
      })
    }

    if (isLoadingPrices) {
      return <Loader />
    }

    return checkoutCopy.shippingRateUnavailable
  }

  const getApiShipHint = (optionId: string) => {
    const quote = apishipQuotesMap[optionId]?.[0]

    if (!quote) {
      return null
    }

    const deliveryWindow = quote.estimated_days_min
      ? ` · ${quote.estimated_days_min}-${quote.estimated_days_max ?? quote.estimated_days_min} дн.`
      : ""

    return `${quote.provider_label}${deliveryWindow} · ${checkoutCopy.apishipCheapestTariff}`
  }

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className={clx(
            "flex flex-row text-3xl-regular gap-x-2 items-baseline",
            {
              "opacity-50 pointer-events-none select-none":
                !isOpen && cart.shipping_methods?.length === 0,
            }
          )}
        >
          {checkoutCopy.delivery}
          {!isOpen && (cart.shipping_methods?.length ?? 0) > 0 && (
            <CheckCircleSolid />
          )}
        </Heading>
        {!isOpen &&
          cart?.shipping_address &&
          cart?.billing_address &&
          cart?.email && (
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
              <div className="pb-8 md:pt-0 pt-2">
                {hasPickupOptions && (
                  <RadioGroup
                    value={showPickupOptions}
                    onChange={() => {
                      const id = pickupMethods.find(
                        (option) => !option.insufficient_inventory
                      )?.id

                      if (id) {
                        handleSetShippingMethod(id, "pickup")
                      }
                    }}
                  >
                    <Radio
                      value={PICKUP_OPTION_ON}
                      data-testid="delivery-option-radio"
                      className={clx(
                        "flex items-center justify-between text-small-regular cursor-pointer py-4 border rounded-rounded px-8 mb-2 hover:shadow-borders-interactive-with-active",
                        {
                          "border-ui-border-interactive":
                            showPickupOptions === PICKUP_OPTION_ON,
                        }
                      )}
                    >
                      <div className="flex items-center gap-x-4">
                        <MedusaRadio
                          checked={showPickupOptions === PICKUP_OPTION_ON}
                        />
                        <span className="text-base-regular">
                          {checkoutCopy.pickupYourOrder}
                        </span>
                      </div>
                      <span className="justify-self-end text-ui-fg-base">-</span>
                    </Radio>
                  </RadioGroup>
                )}
                <RadioGroup
                  value={shippingMethodId}
                  onChange={(value) => {
                    if (value) {
                      const apishipQuote = apishipQuotesMap[value]?.[0]

                      return handleSetShippingMethod(
                        value,
                        "shipping",
                        apishipQuote
                          ? {
                              apishipData: {
                                tariff: {
                                  providerKey: apishipQuote.provider_key,
                                  tariffId: apishipQuote.tariff_id,
                                  deliveryCost: apishipQuote.amount,
                                },
                              },
                            }
                          : undefined
                      )
                    }
                  }}
                >
                  {shippingMethods.map((option) => {
                    const isDisabled =
                      option.price_type === "calculated" &&
                      !isLoadingPrices &&
                      typeof calculatedPricesMap[option.id] !== "number"

                    const apishipHint =
                      option.provider_id === "apiship_apiship"
                        ? getApiShipHint(option.id)
                        : null

                    return (
                      <Radio
                        key={option.id}
                        value={option.id}
                        data-testid="delivery-option-radio"
                        disabled={isDisabled}
                        className={clx(
                          "flex items-center justify-between text-small-regular cursor-pointer py-4 border rounded-rounded px-8 mb-2 hover:shadow-borders-interactive-with-active",
                          {
                            "border-ui-border-interactive":
                              option.id === shippingMethodId,
                            "hover:shadow-brders-none cursor-not-allowed":
                              isDisabled,
                          }
                        )}
                      >
                        <div className="flex items-center gap-x-4">
                          <MedusaRadio checked={option.id === shippingMethodId} />
                          <span className="text-base-regular">{option.name}</span>
                        </div>
                        <span className="justify-self-end text-ui-fg-base text-right">
                          {getOptionPriceLabel(option)}
                          {apishipHint && (
                            <div className="text-ui-fg-muted text-xs mt-1">
                              {apishipHint}
                            </div>
                          )}
                        </span>
                      </Radio>
                    )
                  })}
                </RadioGroup>
              </div>
            </div>
          </div>

          {showPickupOptions === PICKUP_OPTION_ON && (
            <div className="grid">
              <div className="flex flex-col">
                <span className="font-medium txt-medium text-ui-fg-base">
                  {checkoutCopy.store}
                </span>
                <span className="mb-4 text-ui-fg-muted txt-medium">
                  {checkoutCopy.pickupHint}
                </span>
              </div>
              <div data-testid="delivery-options-container">
                <div className="pb-8 md:pt-0 pt-2">
                  <RadioGroup
                    value={shippingMethodId}
                    onChange={(value) => {
                      if (value) {
                        return handleSetShippingMethod(value, "pickup")
                      }
                    }}
                  >
                    {pickupMethods.map((option) => {
                      return (
                        <Radio
                          key={option.id}
                          value={option.id}
                          disabled={option.insufficient_inventory}
                          data-testid="delivery-option-radio"
                          className={clx(
                            "flex items-center justify-between text-small-regular cursor-pointer py-4 border rounded-rounded px-8 mb-2 hover:shadow-borders-interactive-with-active",
                            {
                              "border-ui-border-interactive":
                                option.id === shippingMethodId,
                              "hover:shadow-brders-none cursor-not-allowed":
                                option.insufficient_inventory,
                            }
                          )}
                        >
                          <div className="flex items-start gap-x-4">
                            <MedusaRadio checked={option.id === shippingMethodId} />
                            <div className="flex flex-col">
                              <span className="text-base-regular">
                                {option.name}
                              </span>
                              <span className="text-base-regular text-ui-fg-muted">
                                {formatAddress(undefined as never)}
                              </span>
                            </div>
                          </div>
                          <span className="justify-self-end text-ui-fg-base">
                            {convertToLocale({
                              amount: option.amount!,
                              currency_code: cart?.currency_code,
                            })}
                          </span>
                        </Radio>
                      )
                    })}
                  </RadioGroup>
                </div>
              </div>
            </div>
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
              disabled={!cart.shipping_methods?.[0]}
              data-testid="submit-delivery-option-button"
            >
              {checkoutCopy.continueToPayment}
            </Button>
          </div>
        </>
      ) : (
        <div>
          <div className="text-small-regular">
            {cart && (cart.shipping_methods?.length ?? 0) > 0 && (
              <div className="flex flex-col w-1/3">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">
                  {checkoutCopy.method}
                </Text>
                <Text className="txt-medium text-ui-fg-subtle">
                  {cart.shipping_methods!.at(-1)!.name}{" "}
                  {convertToLocale({
                    amount: cart.shipping_methods!.at(-1)!.amount!,
                    currency_code: cart?.currency_code,
                  })}
                </Text>
              </div>
            )}
          </div>
        </div>
      )}
      <Divider className="mt-8" />
    </div>
  )
}

export default Shipping
