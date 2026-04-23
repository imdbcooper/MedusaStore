import { describe, expect, it } from "@jest/globals"
import {
  DELIVERY_HUB_CART_METADATA_NAMESPACE,
  buildDeliveryHubCartSelectionMetadata,
  createDeliveryHubQuoteReference,
} from "../../modules/delivery-hub/cart-selection"
import {
  buildDeliveryHubStoreSelectionConnectionSummary,
  buildDeliveryHubStoreSelectionReadiness,
  createMissingDeliveryHubSelectionConnectionSummary,
} from "../../modules/delivery-hub/selection-readiness"

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

  it("returns ready when persisted selection and connection are shopper-ready", () => {
    const metadata = buildDeliveryHubCartSelectionMetadata(
      {},
      {
        connection_id: "conn_1",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: createDeliveryHubQuoteReference({
          connection_id: "conn_1",
          quote_type: "warehouse_to_pickup_point",
          quote_key: "offer_123",
        }),
        quote: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: true,
        },
        pickup_point: {
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
        },
        pickup_window: {
          date: "2026-04-22",
          time_from: "10:00",
          time_to: "14:00",
          interval_utc: {
            from: "2026-04-22T07:00:00.000Z",
            to: "2026-04-22T11:00:00.000Z",
          },
          label: "22 Apr, 10:00-14:00",
        },
      }
    )

    const connection = buildDeliveryHubStoreSelectionConnectionSummary({
      id: "conn_1",
      enabled: true,
      status: "active",
      credentials_state: "sealed",
    })

    const result = buildDeliveryHubStoreSelectionReadiness({
      metadata,
      connection,
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

  it("returns not_ready when connection is not found", () => {
    const metadata = buildDeliveryHubCartSelectionMetadata(
      {},
      {
        connection_id: "conn_missing",
        quote_type: "dropoff_point_to_pickup_point",
        quote_reference: createDeliveryHubQuoteReference({
          connection_id: "conn_missing",
          quote_type: "dropoff_point_to_pickup_point",
          quote_key: "offer_123",
        }),
        quote: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: false,
        },
        pickup_point: {
          provider_point_id: "pvz_1",
          provider_point_code: null,
          name: "PVZ 1",
          address: "Tverskaya 1",
          city: "Moscow",
          region: null,
          postal_code: null,
          lat: null,
          lng: null,
          is_origin_dropoff_allowed: true,
          is_destination_pickup_allowed: true,
          payment_methods: [],
        },
      }
    )

    const result = buildDeliveryHubStoreSelectionReadiness({
      metadata,
      connection: createMissingDeliveryHubSelectionConnectionSummary(
        "conn_missing",
        "not_found"
      ),
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
    const metadata = buildDeliveryHubCartSelectionMetadata(
      {},
      {
        connection_id: "conn_1",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: createDeliveryHubQuoteReference({
          connection_id: "conn_1",
          quote_type: "warehouse_to_pickup_point",
          quote_key: "offer_123",
        }),
        quote: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: true,
        },
        pickup_point: {
          provider_point_id: "pvz_1",
          provider_point_code: null,
          name: "PVZ 1",
          address: "Tverskaya 1",
          city: null,
          region: null,
          postal_code: null,
          lat: null,
          lng: null,
          is_origin_dropoff_allowed: false,
          is_destination_pickup_allowed: true,
          payment_methods: [],
        },
        pickup_window: null,
      }
    )

    const connection = buildDeliveryHubStoreSelectionConnectionSummary({
      id: "conn_1",
      enabled: true,
      status: "active",
      credentials_state: "sealed",
    })

    const result = buildDeliveryHubStoreSelectionReadiness({
      metadata,
      connection,
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
    const metadata = buildDeliveryHubCartSelectionMetadata(
      {},
      {
        connection_id: "conn_1",
        quote_type: "dropoff_point_to_pickup_point",
        quote_reference: createDeliveryHubQuoteReference({
          connection_id: "conn_1",
          quote_type: "dropoff_point_to_pickup_point",
          quote_key: "offer_123",
        }),
        quote: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: false,
        },
        pickup_point: {
          provider_point_id: "pvz_1",
          provider_point_code: null,
          name: "PVZ 1",
          address: "Tverskaya 1",
          city: "Moscow",
          region: null,
          postal_code: null,
          lat: null,
          lng: null,
          is_origin_dropoff_allowed: true,
          is_destination_pickup_allowed: true,
          payment_methods: [],
        },
      }
    )

    const inactive = buildDeliveryHubStoreSelectionReadiness({
      metadata,
      connection: createMissingDeliveryHubSelectionConnectionSummary("conn_1", "inactive"),
    })
    const credentialsNotReady = buildDeliveryHubStoreSelectionReadiness({
      metadata,
      connection: createMissingDeliveryHubSelectionConnectionSummary(
        "conn_1",
        "credentials_not_ready"
      ),
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
