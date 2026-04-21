import { afterEach, describe, expect, it, jest } from "@jest/globals"
import * as deliveryPickupPointsRoute from "../../api/store/delivery/pickup-points/route"
import * as deliveryPickupWindowsRoute from "../../api/store/delivery/pickup-windows/route"
import * as deliveryQuotesRoute from "../../api/store/delivery/quotes/route"
import { DeliveryHubError } from "../../modules/delivery-hub/errors"
import { DeliveryHubService } from "../../modules/delivery-hub/service"

describe("Delivery Hub store routes", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("returns neutral pickup points payload", async () => {
    const result = {
      ok: true,
      points: [
        {
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
          metadata: {},
        },
      ],
    }

    const pickupSpy = jest
      .spyOn(DeliveryHubService.prototype, "listStorePickupPoints")
      .mockResolvedValue(result as any)

    const res = createMockResponse()

    await deliveryPickupPointsRoute.GET(
      createMockRequest({
        validatedQuery: {
          city: "Moscow",
        },
      }) as any,
      res as any
    )

    expect(pickupSpy).toHaveBeenCalledWith({
      city: "Moscow",
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(result)
  })

  it("returns neutral pickup windows payload", async () => {
    const result = {
      ok: true,
      pickup_windows: [
        {
          date: "2026-04-22",
          time_from: "10:00",
          time_to: "14:00",
          interval_utc: {
            from: "2026-04-22T07:00:00.000Z",
            to: "2026-04-22T11:00:00.000Z",
          },
          label: "22 Apr, 10:00-14:00",
          metadata: {},
        },
      ],
    }

    const windowsSpy = jest
      .spyOn(DeliveryHubService.prototype, "listStorePickupWindows")
      .mockResolvedValue(result as any)

    const res = createMockResponse()

    await deliveryPickupWindowsRoute.GET(
      createMockRequest({
        validatedQuery: {
          warehouse_id: "wh_1",
        },
      }) as any,
      res as any
    )

    expect(windowsSpy).toHaveBeenCalledWith({
      warehouse_id: "wh_1",
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(result)
  })

  it("parses JSON query params and returns neutral quotes payload", async () => {
    const result = {
      ok: true,
      quotes: [
        {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          mode_code: "warehouse_to_pickup_point",
          quote_key: "quote_1",
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_point_ids: ["pvz_1"],
          pickup_points_embedded: [],
          pickup_window_required: false,
          pickup_window_options: [],
          raw_reference: {},
        },
      ],
    }

    const quoteSpy = jest
      .spyOn(DeliveryHubService.prototype, "listStoreQuotes")
      .mockResolvedValue(result as any)

    const res = createMockResponse()

    await deliveryQuotesRoute.GET(
      createMockRequest({
        validatedQuery: {
          mode_code: "warehouse_to_pickup_point",
          warehouse_id: "wh_1",
          destination_point_id: "pvz_1",
          currency_code: "RUB",
          interval_utc: JSON.stringify({
            from: "2026-04-22T07:00:00.000Z",
            to: "2026-04-22T11:00:00.000Z",
          }),
          items: JSON.stringify([
            {
              quantity: 1,
              weight_grams: 250,
              price: 1500,
            },
          ]),
        },
      }) as any,
      res as any
    )

    expect(quoteSpy).toHaveBeenCalledWith({
      connection_id: undefined,
      mode_code: "warehouse_to_pickup_point",
      currency_code: "RUB",
      destination_point_id: "pvz_1",
      origin_point_id: undefined,
      warehouse_id: "wh_1",
      interval_utc: {
        from: "2026-04-22T07:00:00.000Z",
        to: "2026-04-22T11:00:00.000Z",
      },
      items: [
        {
          quantity: 1,
          weight_grams: 250,
          price: 1500,
        },
      ],
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(result)
  })

  it("returns controlled error payload for store route failures", async () => {
    jest.spyOn(DeliveryHubService.prototype, "listStorePickupPoints").mockRejectedValue(
      new DeliveryHubError({
        code: "DELIVERY_HUB_VALIDATION_ERROR",
        message: "Delivery connection is not active for store/public use",
        status: 409,
        details: {
          field: "connection_id",
        },
      })
    )

    const res = createMockResponse()

    await deliveryPickupPointsRoute.GET(createMockRequest() as any, res as any)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: "DELIVERY_HUB_VALIDATION_ERROR",
        message: "Delivery connection is not active for store/public use",
        details: {
          field: "connection_id",
        },
      },
    })
  })
})

function createMockRequest(input?: Partial<any>) {
  return {
    scope: {
      resolve: jest.fn(),
    },
    validatedQuery: {},
    ...input,
  }
}

function createMockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }
}
