import { afterEach, describe, expect, it, jest } from "@jest/globals"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import * as deliveryReadinessRoute from "../../api/store/delivery/readiness/route"
import * as deliverySelectionRoute from "../../api/store/delivery/selection/route"
import { DeliveryHubService } from "../../modules/delivery-hub/service"
import {
  DELIVERY_HUB_CART_METADATA_NAMESPACE,
  buildDeliveryHubCartSelectionMetadata,
  createDeliveryHubQuoteReference,
  readDeliveryHubCartSelection,
} from "../../modules/delivery-hub/cart-selection"

const originalStoreDeliverySelectionDeps = {
  ...deliverySelectionRoute.storeDeliverySelectionDeps,
}
const originalStoreDeliverySelectionReadinessDeps = {
  ...deliveryReadinessRoute.storeDeliverySelectionReadinessDeps,
}

describe("Delivery Hub cart selection contract", () => {
  afterEach(() => {
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
      updated_at: expect.any(String),
    })
    expect(namespace.selection.pickup_point.metadata).toBeUndefined()
    expect(namespace.selection.pickup_window.metadata).toBeUndefined()
    expect((publicSelection?.pickup_point as Record<string, unknown>).metadata).toBeUndefined()
    expect((publicSelection?.pickup_window as Record<string, unknown>).metadata).toBeUndefined()
    expect((nextMetadata as Record<string, unknown>).existing).toBe(true)
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
      selection: {
        version: 1,
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
        updated_at: expect.any(String),
      },
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
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(readinessResult)
  })

  it("rejects nested pickup metadata in public POST schema", () => {
    expect(() =>
      deliverySelectionRoute.StoreDeliveryUpsertCartSelectionBodySchema.parse({
        cart_id: "cart_1",
        connection_id: "conn_1",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_123",
          version: 1,
        },
        quote: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 499,
          currency_code: "rub",
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
  })

  it("sanitizes POST write-path before delegating to persistence helper", async () => {
    const selection = {
      version: 1,
      connection_id: "conn_1",
      quote_type: "warehouse_to_pickup_point",
      quote_reference: {
        id: "dhsel_test",
        version: 1,
      },
      quote: {
        carrier_code: "yandex",
        carrier_label: "Yandex Delivery",
        amount: 499,
        currency_code: "rub",
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
      updated_at: "2026-04-21T03:00:00.000Z",
    }
    const mockUpsertDeliveryHubCartSelection = jest.fn(async () => selection)
    deliverySelectionRoute.storeDeliverySelectionDeps.upsertDeliveryHubCartSelection =
      mockUpsertDeliveryHubCartSelection as any
    const res = createMockResponse()
    const req = createMockRequest({
      validatedBody: {
        cart_id: "cart_1",
        connection_id: "conn_1",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_test",
          version: 1,
        },
        quote: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 499,
          currency_code: "rub",
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
      {
        connection_id: "conn_1",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_test",
          version: 1,
        },
        quote: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 499,
          currency_code: "rub",
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
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      cart_id: "cart_1",
      selection,
    })
  })
})

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
