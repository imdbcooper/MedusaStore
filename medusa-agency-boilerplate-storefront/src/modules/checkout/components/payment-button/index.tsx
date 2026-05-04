"use client"

import { isManual, isStripeLike, isYooKassa } from "@lib/constants"
import { placeOrder } from "@lib/data/cart"
import { getYooKassaPaymentStatus } from "@lib/data/payment"
import { storefrontConfig } from "@lib/storefront-config"
import {
  getYooKassaConfirmationUrl,
  getYooKassaPaymentId,
} from "@lib/util/yookassa"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@medusajs/ui"
import { useElements, useStripe } from "@stripe/react-stripe-js"
import React, { useState } from "react"
import ErrorMessage from "../error-message"

type PaymentButtonProps = {
  cart: HttpTypes.StoreCart
  "data-testid": string
}

const PaymentButton: React.FC<PaymentButtonProps> = ({
  cart,
  "data-testid": dataTestId,
}) => {
  const notReady =
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cart.shipping_methods?.length ?? 0) < 1

  const paymentSession = cart.payment_collection?.payment_sessions?.[0]
  const checkoutCopy = storefrontConfig.copy.checkout

  switch (true) {
    case isYooKassa(paymentSession?.provider_id):
      return (
        <YooKassaPaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isStripeLike(paymentSession?.provider_id):
      return (
        <StripePaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isManual(paymentSession?.provider_id):
      return (
        <ManualTestPaymentButton cart={cart} notReady={notReady} data-testid={dataTestId} />
      )
    default:
      return <Button disabled>{checkoutCopy.selectPaymentMethod}</Button>
  }
}

const YooKassaPaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const checkoutCopy = storefrontConfig.copy.checkout

  const handlePayment = async () => {
    setSubmitting(true)
    setErrorMessage(null)

    try {
      const paymentId = getYooKassaPaymentId(cart)

      if (!paymentId) {
        throw new Error("YooKassa payment session is missing payment id.")
      }

      const status = await getYooKassaPaymentStatus({
        cartId: cart.id,
        paymentId,
      })

      console.info("[YooKassa checkout] Evaluated hosted payment state", {
        cartId: cart.id,
        paymentId,
        sessionStatus: status.session_status,
        paymentStatus: status.payment_status,
        canPlaceOrder: status.can_place_order,
        confirmationUrl: status.confirmation_url,
      })

      if (status.can_place_order) {
        await placeOrder()
        return
      }

      const confirmationUrl =
        status.confirmation_url || getYooKassaConfirmationUrl(cart)

      if (!confirmationUrl) {
        throw new Error("YooKassa confirmation URL is missing.")
      }

      console.info("[YooKassa checkout] Redirecting to hosted confirmation", {
        cartId: cart.id,
        paymentId,
        confirmationUrl,
      })

      window.location.assign(confirmationUrl)
    } catch (err: any) {
      if (err?.message === "NEXT_REDIRECT") {
        return
      }

      console.error("[YooKassa checkout] Failed to continue checkout", {
        cartId: cart.id,
        message: err?.message,
      })
      setErrorMessage(err.message)
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        disabled={notReady}
        onClick={handlePayment}
        size="large"
        isLoading={submitting}
        data-testid={dataTestId}
      >
        {checkoutCopy.confirmAndGoToYooKassa}
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="yookassa-payment-error-message"
      />
    </>
  )
}

const StripePaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const checkoutCopy = storefrontConfig.copy.checkout

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const stripe = useStripe()
  const elements = useElements()
  const card = elements?.getElement("card")

  const session = cart.payment_collection?.payment_sessions?.find(
    (s) => s.status === "pending"
  )

  const disabled = !stripe || !elements ? true : false

  const handlePayment = async () => {
    setSubmitting(true)
    setErrorMessage(null)

    if (!stripe || !elements || !card || !cart) {
      setSubmitting(false)
      return
    }

    await stripe
      .confirmCardPayment(session?.data.client_secret as string, {
        payment_method: {
          card: card,
          billing_details: {
            name:
              cart.billing_address?.first_name +
              " " +
              cart.billing_address?.last_name,
            address: {
              city: cart.billing_address?.city ?? undefined,
              country: cart.billing_address?.country_code ?? undefined,
              line1: cart.billing_address?.address_1 ?? undefined,
              line2: cart.billing_address?.address_2 ?? undefined,
              postal_code: cart.billing_address?.postal_code ?? undefined,
              state: cart.billing_address?.province ?? undefined,
            },
            email: cart.email,
            phone: cart.billing_address?.phone ?? undefined,
          },
        },
      })
      .then(({ error, paymentIntent }) => {
        if (error) {
          const pi = error.payment_intent

          if (
            (pi && pi.status === "requires_capture") ||
            (pi && pi.status === "succeeded")
          ) {
            onPaymentCompleted()
          }

          setErrorMessage(error.message || null)
          return
        }

        if (
          (paymentIntent && paymentIntent.status === "requires_capture") ||
          paymentIntent.status === "succeeded"
        ) {
          return onPaymentCompleted()
        }

        return
      })
  }

  return (
    <>
      <Button
        disabled={disabled || notReady}
        onClick={handlePayment}
        size="large"
        isLoading={submitting}
        data-testid={dataTestId}
      >
        {checkoutCopy.placeOrder}
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="stripe-payment-error-message"
      />
    </>
  )
}

const ManualTestPaymentButton = ({
  cart,
  notReady,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const checkoutCopy = storefrontConfig.copy.checkout

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const handlePayment = async () => {
    setSubmitting(true)
    setErrorMessage(null)

    onPaymentCompleted()
  }

  return (
    <>
      <Button
        disabled={notReady}
        isLoading={submitting}
        onClick={handlePayment}
        size="large"
        data-testid="submit-order-button"
      >
        {checkoutCopy.placeOrder}
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="manual-payment-error-message"
      />
    </>
  )
}

export default PaymentButton
