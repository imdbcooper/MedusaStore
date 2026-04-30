import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import * as deliveryReadinessRoute from "../../api/store/delivery/readiness/route"
import * as deliverySelectionRoute from "../../api/store/delivery/selection/route"
import { DeliveryHubService } from "../../modules/delivery-hub/service"
import {
  DELIVERY_HUB_CART_METADATA_NAMESPACE,
  buildDeliveryHubCartSelectionMetadata,
  createDeliveryHubProviderExecutionReference,
  createDeliveryHubQuoteReference,
  decryptDeliveryHubProviderExecutionReference,
  readDeliveryHubCartSelection,
  readDeliveryHubCartSelectionBackendExecutionReference,
  readDeliveryHubProviderExecutionReferenceOriginContext,
  validateDeliveryHubProviderExecutionReference,
} from "../../modules/delivery-hub/cart-selection"

const originalStoreDeliverySelectionDeps = {
  ...deliverySelectionRoute.storeDeliverySelectionDeps,
}
const originalStoreDeliverySelectionReadinessDeps = {
  ...deliveryReadinessRoute.storeDeliverySelectionReadinessDeps,
}

describe("Delivery Hub cart selection contract", () => {
  const originalEncryptionKey = process.env.DELIVERY_HUB_ENCRYPTION_KEY

  beforeEach(() => {
    process.env.DELIVERY_HUB_ENCRYPTION_KEY = "test-delivery-hub-key"
  })

  afterEach(() => {
    if (typeof originalEncryptionKey === "string") {
      process.env.DELIVERY_HUB_ENCRYPTION_KEY = originalEncryptionKey
    } else {
      delete process.env.DELIVERY_HUB_ENCRYPTION_KEY
    }
    Object.assign(
      deliverySelectionRoute.storeDeliverySelectionDeps,
      originalStoreDeliverySelectionDeps
    )
    Object.assign(
      deliveryReadinessRoute.storeDeliverySelectionReadinessDeps,
      originalStoreDeliverySelectionReadinessDeps
    )
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })

  it("drops provider-ish nested metadata from persisted and public cart selection payload", () => {
    const nextMetadata = buildDeliveryHubCartSelectionMetadata(
      {
        existing: true,
      },
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
          currency_code: "rub",
          customer_price: {
            amount: 399,
            currency_code: "rub",
            source: "fixed",
            policy_id: "policy_test_fixed",
          },
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
          metadata: {
            raw_provider_payload: {
              token: "secret",
            },
          },
        } as any,
        pickup_window: {
          date: "2026-04-22",
          time_from: "10:00",
          time_to: "14:00",
          interval_utc: {
            from: "2026-04-22T07:00:00.000Z",
            to: "2026-04-22T11:00:00.000Z",
          },
          label: "22 Apr, 10:00-14:00",
          metadata: {
            upstream: {
              slot_id: "slot_1",
            },
          },
        } as any,
      } as any
    )

    const publicSelection = readDeliveryHubCartSelection(nextMetadata)
    const namespace = (nextMetadata as Record<string, any>)[DELIVERY_HUB_CART_METADATA_NAMESPACE]

    expect(namespace.selection.quote_reference).toEqual({
      id: expect.stringMatching(/^dhsel_[a-f0-9]{32}$/),
      version: 1,
    })
    expect(namespace.selection.pickup_point).toEqual({
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
    })
    expect(namespace.selection.pickup_window).toEqual({
      date: "2026-04-22",
      time_from: "10:00",
      time_to: "14:00",
      interval_utc: {
        from: "2026-04-22T07:00:00.000Z",
        to: "2026-04-22T11:00:00.000Z",
      },
      label: "22 Apr, 10:00-14:00",
    })
    expect(publicSelection).toEqual({
      version: 1,
      provider_code: "yandex",
      connection_id: "conn_1",
      quote_type: "warehouse_to_pickup_point",
      quote_reference: {
        id: expect.stringMatching(/^dhsel_[a-f0-9]{32}$/),
        version: 1,
      },
      quote: {
        carrier_code: "yandex",
        carrier_label: "Yandex Delivery",
        amount: 499,
        currency_code: "rub",
        customer_price: {
          amount: 399,
          currency_code: "rub",
          source: "fixed",
          policy_id: "policy_test_fixed",
        },
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
      correlation_id: null,
      updated_at: expect.any(String),
    })
    expect(namespace.selection.pickup_point.metadata).toBeUndefined()
    expect(namespace.selection.pickup_window.metadata).toBeUndefined()
    expect((publicSelection?.pickup_point as Record<string, unknown>).metadata).toBeUndefined()
    expect((publicSelection?.pickup_window as Record<string, unknown>).metadata).toBeUndefined()
    expect((nextMetadata as Record<string, unknown>).existing).toBe(true)
  })

  it("persists backend-only execution reference while keeping the public selection contract opaque", () => {
    const nextMetadata = buildDeliveryHubCartSelectionMetadata(
      {},
      {
        connection_id: "conn_exec",
        quote_type: "warehouse_to_pickup_point",
        quote_key: "offer_backend_only_123",
        quote: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 499,
          currency_code: "rub",
          customer_price: {
            amount: 399,
            currency_code: "rub",
            source: "fixed",
            policy_id: "policy_test_fixed",
          },
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: false,
        },
        pickup_point: {
          provider_point_id: "pvz_exec",
          provider_point_code: null,
          name: "PVZ Exec",
          address: "Tverskaya 10",
          city: "Moscow",
          region: null,
          postal_code: null,
          lat: null,
          lng: null,
          is_origin_dropoff_allowed: false,
          is_destination_pickup_allowed: true,
          payment_methods: [],
        },
      }
    ) as Record<string, any>

    const persistedSelection = nextMetadata[DELIVERY_HUB_CART_METADATA_NAMESPACE].selection
    const publicSelection = readDeliveryHubCartSelection(nextMetadata)
    const backendReference = readDeliveryHubCartSelectionBackendExecutionReference(nextMetadata)

    expect(persistedSelection.backend_execution_reference).toEqual({
      version: 1,
      token: expect.any(String),
    })
    expect(JSON.stringify(persistedSelection)).not.toContain("offer_backend_only_123")
    expect(publicSelection).not.toBeNull()
    expect((publicSelection as Record<string, unknown>).backend_execution_reference).toBeUndefined()
    expect(JSON.stringify(publicSelection)).not.toContain("offer_backend_only_123")
    expect(backendReference).toEqual({
      version: 1,
      token: expect.any(String),
    })
    expect(decryptDeliveryHubProviderExecutionReference(backendReference!)).toEqual({
      connection_id: "conn_exec",
      quote_type: "warehouse_to_pickup_point",
      quote_key: "offer_backend_only_123",
      provider_quote_reference: "offer_backend_only_123",
      provider_origin_dispatch_context: null,
    })
  })

  it("does not materialize backend execution reference when DELIVERY_HUB_ENCRYPTION_KEY is absent", () => {
    delete process.env.DELIVERY_HUB_ENCRYPTION_KEY

    const nextMetadata = buildDeliveryHubCartSelectionMetadata(
      {},
      {
        connection_id: "conn_exec",
        quote_type: "warehouse_to_pickup_point",
        quote_key: "offer_backend_only_123",
        quote: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 499,
          currency_code: "rub",
          customer_price: {
            amount: 399,
            currency_code: "rub",
            source: "fixed",
            policy_id: "policy_test_fixed",
          },
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: false,
        },
        pickup_point: {
          provider_point_id: "pvz_exec",
          provider_point_code: null,
          name: "PVZ Exec",
          address: "Tverskaya 10",
          city: "Moscow",
          region: null,
          postal_code: null,
          lat: null,
          lng: null,
          is_origin_dropoff_allowed: false,
          is_destination_pickup_allowed: true,
          payment_methods: [],
        },
      }
    ) as Record<string, any>

    const persistedSelection = nextMetadata[DELIVERY_HUB_CART_METADATA_NAMESPACE].selection

    expect(persistedSelection.backend_execution_reference).toBeUndefined()
    expect(readDeliveryHubCartSelectionBackendExecutionReference(nextMetadata)).toBeNull()
    expect(readDeliveryHubCartSelection(nextMetadata)).toEqual(
      expect.objectContaining({
        connection_id: "conn_exec",
        quote_type: "warehouse_to_pickup_point",
      })
    )
  })

  it("accepts explicitly supplied backend-only execution reference without leaking it through the public reader", () => {
    const providerExecutionReference = createDeliveryHubProviderExecutionReference({
      connection_id: "conn_exec_manual",
      quote_type: "dropoff_point_to_pickup_point",
      quote_key: "offer_manual_exec_1",
    })
    const nextMetadata = buildDeliveryHubCartSelectionMetadata(
      {},
      {
        connection_id: "conn_exec_manual",
        quote_type: "dropoff_point_to_pickup_point",
        quote_reference: createDeliveryHubQuoteReference({
          connection_id: "conn_exec_manual",
          quote_type: "dropoff_point_to_pickup_point",
          quote_key: "offer_manual_exec_1",
        }),
        provider_execution_reference: providerExecutionReference,
        quote: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 599,
          currency_code: "rub",
          customer_price: {
            amount: 399,
            currency_code: "rub",
            source: "fixed",
            policy_id: "policy_test_fixed",
          },
          delivery_eta_min: 1,
          delivery_eta_max: 3,
          pickup_point_required: true,
          pickup_window_required: false,
        },
        pickup_point: {
          provider_point_id: "pvz_exec_manual",
          provider_point_code: null,
          name: "PVZ Exec Manual",
          address: "Arbat 1",
          city: "Moscow",
          region: null,
          postal_code: null,
          lat: null,
          lng: null,
          is_origin_dropoff_allowed: false,
          is_destination_pickup_allowed: true,
          payment_methods: [],
        },
      }
    ) as Record<string, any>

    const persistedSelection = nextMetadata[DELIVERY_HUB_CART_METADATA_NAMESPACE].selection

    expect(persistedSelection.backend_execution_reference).toEqual(providerExecutionReference)
    expect(readDeliveryHubCartSelectionBackendExecutionReference(nextMetadata)).toEqual(
      providerExecutionReference
    )
    expect((readDeliveryHubCartSelection(nextMetadata) as Record<string, unknown>).backend_execution_reference).toBeUndefined()
  })

  it("materializes backend-only provider-origin dropoff context from quote input without leaking it through public selection or raw quote reference text", () => {
    const quoteReference = createDeliveryHubQuoteReference({
      connection_id: "conn_dropoff",
      quote_type: "dropoff_point_to_pickup_point",
      quote_key: "offer_dropoff_1",
      provider_origin_dispatch_context: {
        mode_code: "dropoff_point_to_pickup_point",
        origin_point_id: "dropoff_origin_1",
      },
    })

    const nextMetadata = buildDeliveryHubCartSelectionMetadata(
      {},
      {
        connection_id: "conn_dropoff",
        quote_type: "dropoff_point_to_pickup_point",
        quote_reference: quoteReference,
        quote: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 699,
          currency_code: "rub",
          customer_price: {
            amount: 399,
            currency_code: "rub",
            source: "fixed",
            policy_id: "policy_test_fixed",
          },
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: false,
        },
        pickup_point: {
          provider_point_id: "pvz_dropoff",
          provider_point_code: null,
          name: "PVZ Dropoff",
          address: "Pokrovka 12",
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
    ) as Record<string, any>

    const backendReference = readDeliveryHubCartSelectionBackendExecutionReference(nextMetadata)
    const publicSelection = readDeliveryHubCartSelection(nextMetadata)

    expect(backendReference).not.toBeNull()
    expect(readDeliveryHubProviderExecutionReferenceOriginContext(backendReference!)).toEqual({
      mode_code: "dropoff_point_to_pickup_point",
      origin_point_id: "dropoff_origin_1",
    })
    expect(JSON.stringify(nextMetadata)).not.toContain("dropoff_origin_1")
    expect(JSON.stringify(publicSelection)).not.toContain("dropoff_origin_1")
    expect(publicSelection?.quote_reference.id).toMatch(/^dhsel_t1_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
  })

  it("materializes backend-only provider-origin warehouse context from quote input without leaking it through public selection", () => {
    const quoteReference = createDeliveryHubQuoteReference({
      connection_id: "conn_wh",
      quote_type: "warehouse_to_pickup_point",
      quote_key: "offer_wh_1",
      provider_origin_dispatch_context: {
        mode_code: "warehouse_to_pickup_point",
        provider_warehouse_id: "ya-wh-1",
      },
    })

    const nextMetadata = buildDeliveryHubCartSelectionMetadata(
      {},
      {
        connection_id: "conn_wh",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: quoteReference,
        quote: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 499,
          currency_code: "rub",
          customer_price: {
            amount: 399,
            currency_code: "rub",
            source: "fixed",
            policy_id: "policy_test_fixed",
          },
          delivery_eta_min: 1,
          delivery_eta_max: 3,
          pickup_point_required: true,
          pickup_window_required: false,
        },
        pickup_point: {
          provider_point_id: "pvz_wh",
          provider_point_code: null,
          name: "PVZ Warehouse",
          address: "Tverskaya 10",
          city: "Moscow",
          region: null,
          postal_code: null,
          lat: null,
          lng: null,
          is_origin_dropoff_allowed: false,
          is_destination_pickup_allowed: true,
          payment_methods: [],
        },
      }
    ) as Record<string, any>

    const backendReference = readDeliveryHubCartSelectionBackendExecutionReference(nextMetadata)
    const publicSelection = readDeliveryHubCartSelection(nextMetadata)

    expect(backendReference).not.toBeNull()
    expect(readDeliveryHubProviderExecutionReferenceOriginContext(backendReference!)).toEqual({
      mode_code: "warehouse_to_pickup_point",
      provider_warehouse_id: "ya-wh-1",
    })
    expect(JSON.stringify(nextMetadata)).not.toContain("ya-wh-1")
    expect(JSON.stringify(publicSelection)).not.toContain("ya-wh-1")
    expect((publicSelection as Record<string, unknown>).backend_execution_reference).toBeUndefined()
  })

  it("rejects warehouse quote with dropoff provider-origin context without backend materialization", () => {
    const quoteReference = createDeliveryHubQuoteReference({
      connection_id: "conn_mismatch_wh",
      quote_type: "warehouse_to_pickup_point",
      quote_key: "offer_mismatch_wh",
      provider_origin_dispatch_context: {
        mode_code: "dropoff_point_to_pickup_point",
        origin_point_id: "dropoff_origin_wrong",
      },
    })

    const nextMetadata = buildDeliveryHubCartSelectionMetadata(
      {},
      {
        connection_id: "conn_mismatch_wh",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: quoteReference,
        quote: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 499,
          currency_code: "rub",
          customer_price: {
            amount: 399,
            currency_code: "rub",
            source: "fixed",
            policy_id: "policy_test_fixed",
          },
          delivery_eta_min: 1,
          delivery_eta_max: 3,
          pickup_point_required: true,
          pickup_window_required: false,
        },
        pickup_point: {
          provider_point_id: "pvz_mismatch_wh",
          provider_point_code: null,
          name: "PVZ Mismatch Warehouse",
          address: "Tverskaya 11",
          city: "Moscow",
          region: null,
          postal_code: null,
          lat: null,
          lng: null,
          is_origin_dropoff_allowed: false,
          is_destination_pickup_allowed: true,
          payment_methods: [],
        },
      }
    ) as Record<string, any>

    expect(readDeliveryHubCartSelectionBackendExecutionReference(nextMetadata)).toBeNull()
    expect(readDeliveryHubCartSelection(nextMetadata)).toEqual(
      expect.objectContaining({
        connection_id: "conn_mismatch_wh",
        quote_type: "warehouse_to_pickup_point",
      })
    )
    expect(JSON.stringify(nextMetadata)).not.toContain("dropoff_origin_wrong")
  })

  it("rejects dropoff quote with warehouse provider-origin context without backend materialization", () => {
    const quoteReference = createDeliveryHubQuoteReference({
      connection_id: "conn_mismatch_dropoff",
      quote_type: "dropoff_point_to_pickup_point",
      quote_key: "offer_mismatch_dropoff",
      provider_origin_dispatch_context: {
        mode_code: "warehouse_to_pickup_point",
        provider_warehouse_id: "provider_wh_wrong",
      },
    })

    const nextMetadata = buildDeliveryHubCartSelectionMetadata(
      {},
      {
        connection_id: "conn_mismatch_dropoff",
        quote_type: "dropoff_point_to_pickup_point",
        quote_reference: quoteReference,
        quote: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 699,
          currency_code: "rub",
          customer_price: {
            amount: 399,
            currency_code: "rub",
            source: "fixed",
            policy_id: "policy_test_fixed",
          },
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: false,
        },
        pickup_point: {
          provider_point_id: "pvz_mismatch_dropoff",
          provider_point_code: null,
          name: "PVZ Mismatch Dropoff",
          address: "Pokrovka 13",
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
    ) as Record<string, any>

    expect(readDeliveryHubCartSelectionBackendExecutionReference(nextMetadata)).toBeNull()
    expect(readDeliveryHubCartSelection(nextMetadata)).toEqual(
      expect.objectContaining({
        connection_id: "conn_mismatch_dropoff",
        quote_type: "dropoff_point_to_pickup_point",
      })
    )
    expect(JSON.stringify(nextMetadata)).not.toContain("provider_wh_wrong")
  })

  it("rejects mismatched backend execution reference context and strips stale persisted token", () => {
    const providerExecutionReference = createDeliveryHubProviderExecutionReference({
      connection_id: "conn_exec_manual",
      quote_type: "dropoff_point_to_pickup_point",
      quote_key: "offer_manual_exec_1",
    })!

    expect(
      validateDeliveryHubProviderExecutionReference(providerExecutionReference, {
        connection_id: "conn_other",
        quote_type: "dropoff_point_to_pickup_point",
        quote_reference: createDeliveryHubQuoteReference({
          connection_id: "conn_other",
          quote_type: "dropoff_point_to_pickup_point",
          quote_key: "offer_manual_exec_1",
        }),
      })
    ).toBeNull()

    expect(() =>
      buildDeliveryHubCartSelectionMetadata(
        {},
        {
          connection_id: "conn_exec_manual",
          quote_type: "dropoff_point_to_pickup_point",
          quote_reference: createDeliveryHubQuoteReference({
            connection_id: "conn_exec_manual",
            quote_type: "dropoff_point_to_pickup_point",
            quote_key: "offer_manual_exec_1",
          }),
          provider_execution_reference: createDeliveryHubProviderExecutionReference({
            connection_id: "conn_other",
            quote_type: "dropoff_point_to_pickup_point",
            quote_key: "offer_manual_exec_1",
          })!,
          quote: {
            carrier_code: "yandex",
            carrier_label: "Yandex Delivery",
            amount: 599,
            currency_code: "rub",
            customer_price: {
              amount: 399,
              currency_code: "rub",
              source: "fixed",
              policy_id: "policy_test_fixed",
            },
            delivery_eta_min: 1,
            delivery_eta_max: 3,
            pickup_point_required: true,
            pickup_window_required: false,
          },
          pickup_point: {
            provider_point_id: "pvz_exec_manual",
            provider_point_code: null,
            name: "PVZ Exec Manual",
            address: "Arbat 1",
            city: "Moscow",
            region: null,
            postal_code: null,
            lat: null,
            lng: null,
            is_origin_dropoff_allowed: false,
            is_destination_pickup_allowed: true,
            payment_methods: [],
          },
        }
      )
    ).toThrow('Field "backend_execution_reference.token" must match the current Delivery Hub selection context')
  })

  it("clears selection while preserving unrelated cart metadata", () => {
    const withSelection = buildDeliveryHubCartSelectionMetadata(
      {
        keep: true,
      },
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
          currency_code: "rub",
          customer_price: {
            amount: 399,
            currency_code: "rub",
            source: "fixed",
            policy_id: "policy_test_fixed",
          },
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
          city: null,
          region: null,
          postal_code: null,
          lat: null,
          lng: null,
          is_origin_dropoff_allowed: false,
          is_destination_pickup_allowed: true,
          payment_methods: [],
        },
      }
    )

    const cleared = buildDeliveryHubCartSelectionMetadata(withSelection, null)

    expect(cleared).toEqual({
      keep: true,
    })
    expect(readDeliveryHubCartSelection(cleared)).toBeNull()
  })

  it("returns selection state for cart through store GET route without metadata leakage", async () => {
    const metadata = buildDeliveryHubCartSelectionMetadata(
      {},
      {
        connection_id: "conn_1",
        quote_type: "warehouse_to_pickup_point",
        quote_key: "offer_123",
        quote: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 499,
          currency_code: "rub",
          customer_price: {
            amount: 399,
            currency_code: "rub",
            source: "fixed",
            policy_id: "policy_test_fixed",
          },
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

    const res = createMockResponse()

    await deliverySelectionRoute.GET(
      createMockRequest({
        validatedQuery: {
          cart_id: "cart_1",
        },
        carts: [
          {
            id: "cart_1",
            metadata,
          },
        ],
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      cart_id: "cart_1",
      selection: expect.objectContaining({
        version: 1,
        provider_code: "yandex",
        connection_id: "conn_1",
        quote_type: "warehouse_to_pickup_point",
        quote: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 499,
          currency_code: "rub",
          customer_price: {
            amount: 399,
            currency_code: "rub",
            source: "fixed",
            policy_id: "policy_test_fixed",
          },
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: true,
        },
        pickup_point: {
          provider_point_id: "pvz_1",
          network_label: null,
          name: "PVZ 1",
          address: "Tverskaya 1",
          city: "Moscow",
          region: "Moscow",
          postal_code: "101000",
          lat: 55.75,
          lng: 37.61,
          is_destination_pickup_allowed: true,
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
        correlation_id: null,
        updated_at: expect.any(String),
      }),
    })
  })

  it("returns missing_selection readiness without 500 when cart has no delivery selection", async () => {
    const readinessResult = {
      ok: true,
      cart_id: "cart_1",
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
    }
    const getStoreSelectionReadiness = jest
      .spyOn(DeliveryHubService.prototype, "getStoreSelectionReadiness")
      .mockResolvedValue(readinessResult as any)
    deliveryReadinessRoute.storeDeliverySelectionReadinessDeps.getDeliveryHubCartById =
      jest.fn(async () => ({
        id: "cart_1",
        metadata: {
          keep: true,
        },
      })) as any
    deliveryReadinessRoute.storeDeliverySelectionReadinessDeps.requireDeliveryHubCart =
      jest.fn((cart) => cart) as any
    const res = createMockResponse()

    await deliveryReadinessRoute.GET(
      createMockRequest({
        validatedQuery: {
          cart_id: "cart_1",
        },
      }) as any,
      res as any
    )

    expect(getStoreSelectionReadiness).toHaveBeenCalledWith({
      cart_id: "cart_1",
      metadata: {
        keep: true,
      },
      cart: {
        id: "cart_1",
        metadata: {
          keep: true,
        },
      },
      current_shipping_options: [],
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(readinessResult)
  })

  it("rejects nested pickup metadata and Yandex-raw fields in public POST schema", () => {
    expect(() =>
      deliverySelectionRoute.StoreDeliveryUpsertCartSelectionBodySchema.parse({
        cart_id: "cart_1",
        connection_id: "conn_1",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_0123456789abcdef0123456789abcdef",
          version: 1,
        },
        quote: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 499,
          currency_code: "rub",
          customer_price: {
            amount: 399,
            currency_code: "rub",
            source: "fixed",
            policy_id: "policy_test_fixed",
          },
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: true,
        },
        pickup_point: {
          provider_point_id: "pvz_1",
          name: "PVZ 1",
          address: "Tverskaya 1",
          is_origin_dropoff_allowed: false,
          is_destination_pickup_allowed: true,
          metadata: {
            provider: {
              leaked: true,
            },
          },
        },
        pickup_window: {
          date: "2026-04-22",
          interval_utc: {
            from: "2026-04-22T07:00:00.000Z",
            to: "2026-04-22T11:00:00.000Z",
          },
          label: "22 Apr, 10:00-14:00",
          metadata: {
            leaked: true,
          },
        },
      })
    ).toThrow()

    expect(() =>
      deliverySelectionRoute.StoreDeliveryUpsertCartSelectionBodySchema.parse({
        cart_id: "cart_1",
        connection_id: "conn_1",
        provider_code: "yandex",
        quote_type: "self_pickup",
        quote_reference: {
          id: "dhsel_0123456789abcdef0123456789abcdef",
          version: 1,
        },
        quote: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 499,
          currency_code: "rub",
          customer_price: {
            amount: 399,
            currency_code: "rub",
            source: "fixed",
            policy_id: "policy_test_fixed",
          },
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: false,
          raw_reference: {
            provider_offer_id: "offer_1",
          },
        },
        pickup_point: {
          provider_point_id: "pvz_1",
          name: "PVZ 1",
          address: "Tverskaya 1",
          is_origin_dropoff_allowed: false,
          is_destination_pickup_allowed: true,
          yandex_payload: {
            type: "pickup_point",
          },
        },
      })
    ).toThrow()
  })

  it("rejects raw provider quote ids at public POST schema boundary", () => {
    const baseBody = createSelectionBody()

    for (const rawId of [
      "offer_123",
      "bXlwcm92aWRlci1vZmZlci1pZA",
      "yandex_offer_20260422_1",
      "token_secret_quote_ref",
    ]) {
      expect(() =>
        deliverySelectionRoute.StoreDeliveryUpsertCartSelectionBodySchema.parse({
          ...baseBody,
          quote_reference: {
            id: rawId,
            version: 1,
          },
        })
      ).toThrow()
    }
  })

  it("rejects raw provider quote ids at persistence helper boundary", () => {
    const baseInput = createSelectionBody()

    for (const rawId of [
      "offer_123",
      "live_offer_123456789",
      "yandex_offer_20260422_1",
      "sk_live_quote_reference_secret",
    ]) {
      expect(() =>
        buildDeliveryHubCartSelectionMetadata(
          {},
          {
            ...baseInput,
            quote_reference: {
              id: rawId,
              version: 1,
            },
          } as any
        )
      ).toThrow('Field "quote_reference.id" must be an opaque Delivery Hub quote reference')
    }
  })

  it("omits persisted selection with unsafe provider code on read boundary", () => {
    const metadata = buildDeliveryHubCartSelectionMetadata({}, createSelectionBody()) as Record<string, any>

    metadata[DELIVERY_HUB_CART_METADATA_NAMESPACE].selection.provider_code = "raw_provider"

    expect(readDeliveryHubCartSelection(metadata)).toBeNull()
  })

  it("accepts canonical quote reference and supported provider code", () => {
    const metadata = buildDeliveryHubCartSelectionMetadata({}, createSelectionBody())
    const selection = readDeliveryHubCartSelection(metadata)

    expect(selection?.provider_code).toBe("yandex")
    expect(selection?.quote_reference).toEqual({
      id: expect.stringMatching(/^dhsel_[a-f0-9]{32}$/),
      version: 1,
    })
  })

  it("sanitizes POST write-path before delegating to persistence helper", async () => {
    const selection = {
      version: 1,
      provider_code: "yandex",
      connection_id: "conn_1",
      quote_type: "warehouse_to_pickup_point",
      quote_reference: {
        id: "dhsel_abcdef0123456789abcdef0123456789",
        version: 1,
      },
      quote: {
        carrier_code: "yandex",
        carrier_label: "Yandex Delivery",
        amount: 499,
        currency_code: "rub",
        customer_price: {
          amount: 399,
          currency_code: "rub",
          source: "fixed",
          policy_id: "policy_test_fixed",
        },
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
      correlation_id: "corr_store_1",
      updated_at: "2026-04-21T03:00:00.000Z",
    }
    const mockUpsertDeliveryHubCartSelection = jest.fn(async () => selection)
    deliverySelectionRoute.storeDeliverySelectionDeps.upsertDeliveryHubCartSelection =
      mockUpsertDeliveryHubCartSelection as any
    const res = createMockResponse()
    const req = createMockRequest({
      validatedBody: {
        cart_id: "cart_1",
        provider_code: "yandex",
        connection_id: "conn_1",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_abcdef0123456789abcdef0123456789",
          version: 1,
        },
        quote: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 499,
          currency_code: "rub",
          customer_price: {
            amount: 399,
            currency_code: "rub",
            source: "fixed",
            policy_id: "policy_test_fixed",
          },
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
          metadata: {
            provider_raw: {
              internal_id: "secret",
            },
          },
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
          metadata: {
            slot: {
              raw: true,
            },
          },
        },
        correlation_id: "corr_store_1",
      },
      carts: [
        {
          id: "cart_1",
          metadata: {
            keep: true,
          },
        },
      ],
    })

    await deliverySelectionRoute.POST(req as any, res as any)

    expect(mockUpsertDeliveryHubCartSelection).toHaveBeenCalledWith(
      req.scope,
      {
        id: "cart_1",
        metadata: {
          keep: true,
        },
      },
      expect.objectContaining({
        provider_code: "yandex",
        connection_id: "conn_1",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_abcdef0123456789abcdef0123456789",
          version: 1,
        },
        quote: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 499,
          currency_code: "rub",
          customer_price: {
            amount: 399,
            currency_code: "rub",
            source: "fixed",
            policy_id: "policy_test_fixed",
          },
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
        correlation_id: "corr_store_1",
        validation_context: expect.objectContaining({
          version: 1,
          cart_id: "cart_1",
          cart_fingerprint: expect.any(String),
          address_fingerprint: expect.any(String),
          quote_expires_at: expect.any(String),
        }),
      })
    )
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      cart_id: "cart_1",
      selection: {
        ...selection,
        pickup_point: {
          provider_point_id: "pvz_1",
          network_label: null,
          name: "PVZ 1",
          address: "Tverskaya 1",
          city: "Moscow",
          region: "Moscow",
          postal_code: "101000",
          lat: 55.75,
          lng: 37.61,
          is_destination_pickup_allowed: true,
        },
      },
      diagnostics: {
        correlation_id: "corr_store_1",
        checkout_source_of_truth: "unchanged",
        contour: "delivery_hub_storefront_preview",
      },
    })
  })

  it("does not mutate checkout source-of-truth fields while persisting smoke selection", async () => {
    const persistedMetadata = buildDeliveryHubCartSelectionMetadata(
      {
        shipping_option_id: "legacy_checkout_shipping_option",
        fulfillment_provider_id: "legacy_fulfillment_provider",
        shipping_methods: [
          {
            id: "ship_legacy",
            shipping_option_id: "legacy_checkout_shipping_option",
          },
        ],
      },
      createSelectionBody()
    ) as Record<string, any>

    expect(persistedMetadata.shipping_option_id).toBe("legacy_checkout_shipping_option")
    expect(persistedMetadata.fulfillment_provider_id).toBe("legacy_fulfillment_provider")
    expect(persistedMetadata.shipping_methods).toEqual([
      {
        id: "ship_legacy",
        shipping_option_id: "legacy_checkout_shipping_option",
      },
    ])
    expect(persistedMetadata[DELIVERY_HUB_CART_METADATA_NAMESPACE].selection).toBeDefined()
    expect(JSON.stringify(readDeliveryHubCartSelection(persistedMetadata))).not.toMatch(
      /backend_execution_reference|token|authorization|raw_reference|ciphertext|provider_offer_id/i
    )
  })
})

function createSelectionBody(): Parameters<typeof buildDeliveryHubCartSelectionMetadata>[1] {
  return {
    provider_code: "yandex",
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
      currency_code: "rub",
      customer_price: {
        amount: 399,
        currency_code: "rub",
        source: "fixed",
        policy_id: "policy_test_fixed",
      },
      delivery_eta_min: 1,
      delivery_eta_max: 2,
      pickup_point_required: true,
      pickup_window_required: false,
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
    pickup_window: null,
    correlation_id: "corr_store_1",
  }
}

function createMockRequest(input?: Partial<any>) {
  const scope = input?.scope ?? createMockScope(input)

  return {
    validatedQuery: {},
    ...input,
    scope,
  }
}

function createMockScope(input?: Partial<any>) {
  const carts = input?.carts ?? []
  const service = input?.service ?? {}

  return {
    resolve: jest.fn((key: string) => {
      if (key === ContainerRegistrationKeys.QUERY) {
        return {
          graph: jest.fn(async ({ filters }: any) => ({
            data: carts.filter((cart: any) => cart.id === filters?.id),
          })),
        }
      }

      if (key === "manager") {
        return {}
      }

      return service
    }),
  }
}

function createMockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }
}
