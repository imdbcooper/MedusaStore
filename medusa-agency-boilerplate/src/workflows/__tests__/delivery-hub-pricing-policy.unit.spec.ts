import { describe, expect, it } from "@jest/globals"
import { evaluateDeliveryHubCustomerPricingPolicy } from "../../modules/delivery-hub/domain/pricing-policy"

describe("Delivery Hub customer pricing policy", () => {
  it("uses safe provider pass-through defaults without delivery secrets", () => {
    expect(
      evaluateDeliveryHubCustomerPricingPolicy({
        provider_quote: {
          amount: 499,
          currency_code: "rub",
          carrier_code: "yandex",
          quote_key_present: true,
        },
        config: null,
      })
    ).toEqual({
      available: true,
      customer_price: {
        amount: 499,
        currency_code: "RUB",
        source: "provider_quote",
        policy_id: "delivery_hub_safe_default_provider_pass_through",
      },
    })
  })

  it("applies fixed buyer pricing instead of exposing the provider operational quote", () => {
    expect(
      evaluateDeliveryHubCustomerPricingPolicy({
        provider_quote: {
          amount: 499,
          currency_code: "RUB",
          carrier_code: "yandex",
          quote_key_present: true,
        },
        config: {
          customer_pricing_policy: {
            id: "policy_fixed_checkout",
            type: "fixed",
            amount: 199,
            currency_code: "RUB",
          },
        },
      })
    ).toEqual({
      available: true,
      customer_price: {
        amount: 199,
        currency_code: "RUB",
        source: "fixed",
        policy_id: "policy_fixed_checkout",
      },
    })
  })

  it("supports free-threshold pricing with a fixed below-threshold fallback", () => {
    const config = {
      customer_pricing_policy: {
        id: "policy_free_threshold",
        type: "free_threshold",
        threshold_amount: 3000,
        below_threshold_amount: 250,
      },
    }

    expect(
      evaluateDeliveryHubCustomerPricingPolicy({
        provider_quote: {
          amount: 499,
          currency_code: "RUB",
          carrier_code: "yandex",
          quote_key_present: true,
        },
        cart_subtotal: 3500,
        config,
      })
    ).toEqual({
      available: true,
      customer_price: {
        amount: 0,
        currency_code: "RUB",
        source: "free_threshold",
        policy_id: "policy_free_threshold",
      },
    })

    expect(
      evaluateDeliveryHubCustomerPricingPolicy({
        provider_quote: {
          amount: 499,
          currency_code: "RUB",
          carrier_code: "yandex",
          quote_key_present: true,
        },
        cart_subtotal: 1000,
        config,
      })
    ).toEqual({
      available: true,
      customer_price: {
        amount: 250,
        currency_code: "RUB",
        source: "fixed",
        policy_id: "policy_free_threshold",
      },
    })
  })

  it("supports provider quote markup and rounding", () => {
    expect(
      evaluateDeliveryHubCustomerPricingPolicy({
        provider_quote: {
          amount: 299,
          currency_code: "RUB",
          carrier_code: "yandex",
          quote_key_present: true,
        },
        config: {
          customer_pricing_policy: {
            id: "policy_markup_rounding",
            type: "provider_quote_markup",
            markup_amount: 50,
            markup_percent: 10,
            rounding: {
              mode: "ceil",
              increment: 10,
            },
          },
        },
      })
    ).toEqual({
      available: true,
      customer_price: {
        amount: 380,
        currency_code: "RUB",
        source: "provider_quote_markup",
        policy_id: "policy_markup_rounding",
      },
    })
  })

  it("fails closed for explicit unavailable or unknown policy configuration", () => {
    expect(
      evaluateDeliveryHubCustomerPricingPolicy({
        provider_quote: {
          amount: 499,
          currency_code: "RUB",
          carrier_code: "yandex",
          quote_key_present: true,
        },
        config: {
          customer_pricing_policy: {
            id: "policy_unknown",
            type: "mystery_policy",
          },
        },
      })
    ).toEqual({
      available: false,
      code: "pricing_policy_unavailable",
      message: "Delivery Hub customer pricing policy is unavailable.",
      policy_id: "policy_unknown",
    })
  })
})
