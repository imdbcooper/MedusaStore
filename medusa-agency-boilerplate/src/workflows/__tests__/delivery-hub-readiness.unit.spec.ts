import { describe, expect, it } from "@jest/globals"
import {
  DELIVERY_HUB_CART_METADATA_NAMESPACE,
  buildDeliveryHubCartSelectionMetadata,
  createDeliveryHubQuoteReference,
  readDeliveryHubCartSelection,
} from "../../modules/delivery-hub/cart-selection"
import {
  buildDeliveryHubCartSelectionValidationContext,
  buildDeliveryHubStoreSelectionConnectionSummary,
  buildDeliveryHubStoreSelectionReadiness,
  createMissingDeliveryHubSelectionConnectionSummary,
} from "../../modules/delivery-hub/selection-readiness"

const NOW = "2026-04-30T12:00:00.000Z"
const AFTER_QUOTE_EXPIRATION = "2026-04-30T12:31:00.000Z"

describe("Delivery Hub selection readiness", () => {
  it("returns missing_selection when cart has no persisted delivery selection", () => {
    const result = buildDeliveryHubStoreSelectionReadiness({
      metadata: {
        keep: true,
      },
    })

    expect(result).toEqual({
      status: "missing_selection",
      issues: [
        {
          code: "selection_missing",
          message: "Delivery selection is not saved for this cart",
          field: "selection",
        },
      ],
      selection: null,
      quote_context: null,
    })
  })

  it("returns invalid_selection when persisted selection is structurally broken", () => {
    const result = buildDeliveryHubStoreSelectionReadiness({
      metadata: {
        [DELIVERY_HUB_CART_METADATA_NAMESPACE]: {
          selection: {
            version: 1,
            connection_id: "conn_1",
            quote_type: "warehouse_to_pickup_point",
          },
        },
      },
    })

    expect(result).toEqual({
      status: "invalid_selection",
      issues: [
        {
          code: "selection_invalid",
          message: "Persisted delivery selection is structurally invalid",
          field: "selection",
        },
      ],
      selection: null,
      quote_context: null,
    })
  })

  it("returns ready when persisted selection, cart context, price, connection and shipping option are valid", () => {
    const cart = buildReadinessCart()
    const metadata = buildReadySelectionMetadata({ cart })

    const result = buildDeliveryHubStoreSelectionReadiness({
      metadata,
      connection: buildReadyConnection(),
      cart,
      current_shipping_options: [buildWarehousePickupShippingOption()],
      now: NOW,
    })

    expect(result.status).toBe("ready")
    expect(result.issues).toEqual([])
    expect(result.selection).toEqual(
      expect.objectContaining({
        connection_id: "conn_1",
        quote_type: "warehouse_to_pickup_point",
      })
    )
    expect(result.quote_context).toEqual({
      connection: {
        connection_id: "conn_1",
        state: "ready",
        ready: true,
      },
      quote_type: "warehouse_to_pickup_point",
      quote_reference: {
        id: expect.stringMatching(/^dhsel_[a-f0-9]{32}$/),
        version: 1,
      },
      pickup_point_required: true,
      pickup_window_required: true,
      updated_at: expect.any(String),
    })
    expect(result.quote_context?.connection).not.toHaveProperty("provider_code")
    expect(result.quote_context?.connection).not.toHaveProperty("enabled")
    expect(result.quote_context?.connection).not.toHaveProperty("status")
    expect(result.quote_context?.connection).not.toHaveProperty("credentials_state")
  })

  it("keeps backend validation context out of the public persisted selection response", () => {
    const cart = buildReadinessCart()
    const metadata = buildReadySelectionMetadata({ cart })
    const selection = readDeliveryHubCartSelection(metadata)

    expect(selection).not.toHaveProperty("validation_context")
    expect(selection).not.toHaveProperty("backend_execution_reference")
  })

  it("returns not_ready when connection is not found without leaking connection internals", () => {
    const cart = buildReadinessCart()
    const metadata = buildReadySelectionMetadata({
      cart,
      connection_id: "conn_missing",
    })

    const result = buildDeliveryHubStoreSelectionReadiness({
      metadata,
      connection: createMissingDeliveryHubSelectionConnectionSummary(
        "conn_missing",
        "not_found"
      ),
      cart,
      current_shipping_options: [buildWarehousePickupShippingOption()],
      now: NOW,
    })

    expect(result.status).toBe("not_ready")
    expect(result.issues).toEqual([
      {
        code: "connection_not_found",
        message: "Delivery connection referenced by the saved selection was not found",
        field: "connection_id",
      },
    ])
    expect(result.quote_context?.connection).toEqual({
      connection_id: "conn_missing",
      state: "not_found",
      ready: false,
    })
  })

  it("returns not_ready when required pickup window is missing", () => {
    const cart = buildReadinessCart()
    const metadata = buildReadySelectionMetadata({
      cart,
      pickup_window: null,
    })

    const result = buildDeliveryHubStoreSelectionReadiness({
      metadata,
      connection: buildReadyConnection(),
      cart,
      current_shipping_options: [buildWarehousePickupShippingOption()],
      now: NOW,
    })

    expect(result.status).toBe("not_ready")
    expect(result.issues).toEqual([
      {
        code: "pickup_window_missing",
        message: "Pickup window is required for the selected delivery quote",
        field: "pickup_window",
      },
    ])
  })

  it("requires refreshed validation context on persisted selections", () => {
    const cart = buildReadinessCart()
    const metadata = buildReadySelectionMetadata({
      cart,
      validation_context: null,
    })

    const result = buildDeliveryHubStoreSelectionReadiness({
      metadata,
      connection: buildReadyConnection(),
      cart,
      current_shipping_options: [buildWarehousePickupShippingOption()],
      now: NOW,
    })

    expect(result.status).toBe("not_ready")
    expect(result.issues).toEqual([
      {
        code: "cart_context_missing",
        message: "Saved delivery selection needs refreshed cart validation context",
        field: "validation_context",
      },
    ])
  })

  it("returns not_ready when saved quote price has expired", () => {
    const cart = buildReadinessCart()
    const metadata = buildReadySelectionMetadata({ cart })

    const result = buildDeliveryHubStoreSelectionReadiness({
      metadata,
      connection: buildReadyConnection(),
      cart,
      current_shipping_options: [buildWarehousePickupShippingOption()],
      now: AFTER_QUOTE_EXPIRATION,
    })

    expect(result.status).toBe("not_ready")
    expect(result.issues).toEqual([
      {
        code: "quote_expired",
        message: "Saved delivery price has expired and must be refreshed",
        field: "validation_context.quote_expires_at",
      },
    ])
  })

  it("returns not_ready when cart contents changed after delivery was saved", () => {
    const cart = buildReadinessCart()
    const metadata = buildReadySelectionMetadata({ cart })

    const result = buildDeliveryHubStoreSelectionReadiness({
      metadata,
      connection: buildReadyConnection(),
      cart: buildReadinessCart({ subtotal: 1500, total: 1999, item_subtotal: 1500 }),
      current_shipping_options: [buildWarehousePickupShippingOption()],
      now: NOW,
    })

    expect(result.status).toBe("not_ready")
    expect(result.issues).toEqual([
      {
        code: "cart_context_mismatch",
        message: "Cart contents changed after delivery was saved",
        field: "validation_context.cart_fingerprint",
      },
    ])
  })

  it("returns not_ready when shipping address changed after delivery was saved", () => {
    const cart = buildReadinessCart()
    const metadata = buildReadySelectionMetadata({ cart })

    const result = buildDeliveryHubStoreSelectionReadiness({
      metadata,
      connection: buildReadyConnection(),
      cart: buildReadinessCart({
        shipping_address: {
          country_code: "ru",
          city: "Saint Petersburg",
          province: "Saint Petersburg",
          postal_code: "190000",
          address_1: "Nevsky 1",
          address_2: null,
          phone: "+79990000000",
        },
      }),
      current_shipping_options: [buildWarehousePickupShippingOption()],
      now: NOW,
    })

    expect(result.status).toBe("not_ready")
    expect(result.issues).toEqual([
      {
        code: "address_context_mismatch",
        message: "Shipping address changed after delivery was saved",
        field: "validation_context.address_fingerprint",
      },
    ])
  })

  it("returns not_ready when selected pickup point is no longer destination-eligible", () => {
    const cart = buildReadinessCart()
    const metadata = buildReadySelectionMetadata({
      cart,
      pickup_point: {
        ...buildPickupPoint(),
        is_destination_pickup_allowed: false,
      },
    })

    const result = buildDeliveryHubStoreSelectionReadiness({
      metadata,
      connection: buildReadyConnection(),
      cart,
      current_shipping_options: [buildWarehousePickupShippingOption()],
      now: NOW,
    })

    expect(result.status).toBe("not_ready")
    expect(result.issues).toEqual([
      {
        code: "pickup_point_mismatch",
        message: "Saved pickup point is no longer available for receiving orders",
        field: "pickup_point",
      },
    ])
  })

  it("returns not_ready when Delivery Hub shipping option is missing", () => {
    const cart = buildReadinessCart()
    const metadata = buildReadySelectionMetadata({ cart })

    const result = buildDeliveryHubStoreSelectionReadiness({
      metadata,
      connection: buildReadyConnection(),
      cart,
      current_shipping_options: [],
      now: NOW,
    })

    expect(result.status).toBe("not_ready")
    expect(result.issues).toEqual([
      {
        code: "shipping_option_missing",
        message: "Delivery Hub shipping option is not available for the saved selection",
        field: "shipping_option",
      },
    ])
  })

  it("blocks buyer checkout modes that are not warehouse-to-pickup", () => {
    const cart = buildReadinessCart()
    const metadata = buildReadySelectionMetadata({
      cart,
      quote_type: "dropoff_point_to_pickup_point",
      pickup_window: null,
    })

    const result = buildDeliveryHubStoreSelectionReadiness({
      metadata,
      connection: buildReadyConnection(),
      cart,
      current_shipping_options: [
        {
          id: "deliveryhub:dropoff_point_to_pickup_point",
          name: "Delivery Hub Dropoff Pickup",
          provider_id: "deliveryhub_deliveryhub",
          data: {
            provider_code: "deliveryhub",
            id: "deliveryhub:dropoff_point_to_pickup_point",
            mode_code: "dropoff_point_to_pickup_point",
          },
        },
      ],
      now: NOW,
    })

    expect(result.status).toBe("not_ready")
    expect(result.issues).toEqual([
      {
        code: "unsupported_checkout_mode",
        message: "Saved delivery mode is not available in buyer checkout",
        field: "quote_type",
      },
    ])
  })

  it("returns not_ready when customer price is missing from an older saved selection", () => {
    const cart = buildReadinessCart()
    const metadata = buildReadySelectionMetadata({ cart }) as Record<string, any>
    delete metadata[DELIVERY_HUB_CART_METADATA_NAMESPACE].selection.quote.customer_price

    const result = buildDeliveryHubStoreSelectionReadiness({
      metadata,
      connection: buildReadyConnection(),
      cart,
      current_shipping_options: [buildWarehousePickupShippingOption()],
      now: NOW,
    })

    expect(result.status).toBe("not_ready")
    expect(result.issues).toEqual([
      {
        code: "customer_price_missing",
        message: "Customer delivery price is missing for the saved selection",
        field: "quote.customer_price",
      },
    ])
  })

  it("maps disabled and invalid credential connection states to neutral issues", () => {
    const disabled = buildDeliveryHubStoreSelectionConnectionSummary({
      id: "conn_disabled",
      enabled: false,
      status: "active",
      credentials_state: "sealed",
    })
    const invalidCredentials = buildDeliveryHubStoreSelectionConnectionSummary({
      id: "conn_invalid",
      enabled: true,
      status: "active",
      credentials_state: "invalid",
    })

    expect(disabled).toEqual({
      connection_id: "conn_disabled",
      state: "disabled",
      ready: false,
    })
    expect(invalidCredentials).toEqual({
      connection_id: "conn_invalid",
      state: "credentials_not_ready",
      ready: false,
    })
  })

  it("keeps public readiness connection context neutral for inactive and credentials-not-ready states", () => {
    const cart = buildReadinessCart()
    const metadata = buildReadySelectionMetadata({ cart })

    const inactive = buildDeliveryHubStoreSelectionReadiness({
      metadata,
      connection: createMissingDeliveryHubSelectionConnectionSummary("conn_1", "inactive"),
      cart,
      current_shipping_options: [buildWarehousePickupShippingOption()],
      now: NOW,
    })
    const credentialsNotReady = buildDeliveryHubStoreSelectionReadiness({
      metadata,
      connection: createMissingDeliveryHubSelectionConnectionSummary(
        "conn_1",
        "credentials_not_ready"
      ),
      cart,
      current_shipping_options: [buildWarehousePickupShippingOption()],
      now: NOW,
    })

    expect(inactive.status).toBe("not_ready")
    expect(inactive.issues).toEqual([
      {
        code: "connection_inactive",
        message: "Delivery connection is not active for shopper-facing use",
        field: "connection_id",
      },
    ])
    expect(inactive.quote_context?.connection).toEqual({
      connection_id: "conn_1",
      state: "inactive",
      ready: false,
    })

    expect(credentialsNotReady.status).toBe("not_ready")
    expect(credentialsNotReady.issues).toEqual([
      {
        code: "connection_credentials_not_ready",
        message: "Delivery connection credentials are not ready for shopper-facing use",
        field: "connection_id",
      },
    ])
    expect(credentialsNotReady.quote_context?.connection).toEqual({
      connection_id: "conn_1",
      state: "credentials_not_ready",
      ready: false,
    })
    expect(credentialsNotReady.quote_context?.connection).not.toHaveProperty("provider_code")
    expect(credentialsNotReady.quote_context?.connection).not.toHaveProperty("enabled")
    expect(credentialsNotReady.quote_context?.connection).not.toHaveProperty("status")
    expect(credentialsNotReady.quote_context?.connection).not.toHaveProperty("credentials_state")
  })
})

function buildReadySelectionMetadata(input: {
  cart: ReturnType<typeof buildReadinessCart>
  connection_id?: string
  quote_type?: "warehouse_to_pickup_point" | "dropoff_point_to_pickup_point"
  pickup_point?: ReturnType<typeof buildPickupPoint>
  pickup_window?: ReturnType<typeof buildPickupWindow> | null
  validation_context?: ReturnType<typeof buildDeliveryHubCartSelectionValidationContext> | null
}) {
  const connectionId = input.connection_id ?? "conn_1"
  const quoteType = input.quote_type ?? "warehouse_to_pickup_point"
  const validationContext = input.validation_context === undefined
    ? buildDeliveryHubCartSelectionValidationContext({ cart: input.cart, now: NOW })
    : input.validation_context

  return buildDeliveryHubCartSelectionMetadata(
    {},
    {
      connection_id: connectionId,
      quote_type: quoteType,
      quote_reference: createDeliveryHubQuoteReference({
        connection_id: connectionId,
        quote_type: quoteType,
        quote_key: "offer_123",
      }),
      quote: {
        carrier_code: "yandex",
        carrier_label: "Yandex Delivery",
        amount: 499,
        currency_code: "RUB",
        customer_price: {
          amount: 499,
          currency_code: "RUB",
          source: "provider_quote",
          policy_id: null,
        },
        delivery_eta_min: 1,
        delivery_eta_max: 2,
        pickup_point_required: true,
        pickup_window_required: true,
      },
      pickup_point: input.pickup_point ?? buildPickupPoint(),
      pickup_window: input.pickup_window === undefined ? buildPickupWindow() : input.pickup_window,
      validation_context: validationContext,
    }
  )
}

function buildReadinessCart(overrides: Record<string, unknown> = {}) {
  return {
    cart_id: "cart_1",
    currency_code: "RUB",
    subtotal: 1000,
    total: 1499,
    item_subtotal: 1000,
    shipping_address: {
      country_code: "ru",
      city: "Moscow",
      province: "Moscow",
      postal_code: "101000",
      address_1: "Tverskaya 1",
      address_2: null,
      phone: "+79990000000",
    },
    items: [
      {
        id: "cali_1",
        quantity: 1,
        unit_price: 1000,
        total: 1000,
        subtotal: 1000,
        variant: {
          id: "variant_1",
          sku: "sku_1",
          weight: 100,
          length: 10,
          width: 10,
          height: 10,
        },
      },
    ],
    ...overrides,
  }
}

function buildReadyConnection() {
  return buildDeliveryHubStoreSelectionConnectionSummary({
    id: "conn_1",
    enabled: true,
    status: "active",
    credentials_state: "sealed",
  })
}

function buildWarehousePickupShippingOption() {
  return {
    id: "deliveryhub:warehouse_to_pickup_point",
    name: "Delivery Hub Pickup",
    provider_id: "deliveryhub_deliveryhub",
    data: {
      provider_code: "deliveryhub",
      id: "deliveryhub:warehouse_to_pickup_point",
      mode_code: "warehouse_to_pickup_point",
    },
  }
}

function buildPickupPoint() {
  return {
    provider_point_id: "pvz_1",
    provider_point_code: "code_1",
    name: "PVZ 1",
    address: "Tverskaya 1",
    city: "Moscow",
    region: "Moscow",
    postal_code: "101000",
    lat: 55.75,
    lng: 37.61,
    is_origin_dropoff_allowed: false,
    is_destination_pickup_allowed: true,
    payment_methods: ["card"],
  }
}

function buildPickupWindow() {
  return {
    date: "2026-04-30",
    time_from: "10:00",
    time_to: "14:00",
    interval_utc: {
      from: "2026-04-30T07:00:00.000Z",
      to: "2026-04-30T11:00:00.000Z",
    },
    label: "30 Apr, 10:00-14:00",
  }
}
