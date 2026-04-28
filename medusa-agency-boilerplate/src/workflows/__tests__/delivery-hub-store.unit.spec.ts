import { afterEach, describe, expect, it, jest } from "@jest/globals"
import * as deliveryCatalogRoute from "../../api/store/delivery/catalog/route"
import * as deliveryPickupPointsRoute from "../../api/store/delivery/pickup-points/route"
import * as deliveryPickupWindowsRoute from "../../api/store/delivery/pickup-windows/route"
import * as deliveryQuotesRoute from "../../api/store/delivery/quotes/route"
import * as deliveryReadinessRoute from "../../api/store/delivery/readiness/route"
import * as deliverySelectionRoute from "../../api/store/delivery/selection/route"
import * as deliverySettingsRoute from "../../api/store/delivery/settings/route"
import * as deliveryCutoverPreconditionsRoute from "../../api/store/delivery/cutover-preconditions/route"
import * as deliveryCutoverCandidateRoute from "../../api/store/delivery/cutover-candidate/route"
import { DeliveryHubError } from "../../modules/delivery-hub/errors"
import { DeliveryHubService } from "../../modules/delivery-hub/service"

const originalStoreDeliverySelectionDeps = {
  ...deliverySelectionRoute.storeDeliverySelectionDeps,
}

const originalStoreDeliverySelectionReadinessDeps = {
  ...deliveryReadinessRoute.storeDeliverySelectionReadinessDeps,
}

const originalStoreDeliveryCutoverCandidateDeps = {
  ...deliveryCutoverCandidateRoute.storeDeliveryCutoverCandidateDeps,
}

describe("Delivery Hub store routes", () => {
  afterEach(() => {
    Object.assign(
      deliverySelectionRoute.storeDeliverySelectionDeps,
      originalStoreDeliverySelectionDeps
    )
    Object.assign(
      deliveryReadinessRoute.storeDeliverySelectionReadinessDeps,
      originalStoreDeliverySelectionReadinessDeps
    )
    Object.assign(
      deliveryCutoverCandidateRoute.storeDeliveryCutoverCandidateDeps,
      originalStoreDeliveryCutoverCandidateDeps
    )
    jest.restoreAllMocks()
  })

  it("returns neutral shopper-facing delivery catalog payload", async () => {
    const result = {
      ok: true,
      default_connection_id: "conn_ready",
      connections: [
        {
          connection_id: "conn_ready",
          label: "Main delivery",
          state: "ready",
          ready: true,
          quote_types: ["warehouse_to_pickup_point", "dropoff_point_to_pickup_point"],
          supports_pickup_points: true,
          supports_pickup_windows: true,
          supports_dropoff: true,
        },
        {
          connection_id: "conn_not_ready",
          label: "Backup delivery",
          state: "credentials_not_ready",
          ready: false,
          quote_types: ["warehouse_to_pickup_point", "dropoff_point_to_pickup_point"],
          supports_pickup_points: true,
          supports_pickup_windows: true,
          supports_dropoff: true,
        },
      ],
    }

    const catalogSpy = jest
      .spyOn(DeliveryHubService.prototype, "listStoreCatalog")
      .mockResolvedValue(result as any)

    const res = createMockResponse()

    await deliveryCatalogRoute.GET(createMockRequest() as any, res as any)

    expect(catalogSpy).toHaveBeenCalledWith()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(result)
  })

  it("rejects catalog payloads that try to leak provider or admin connection fragments", async () => {
    jest.spyOn(DeliveryHubService.prototype, "listStoreCatalog").mockResolvedValue({
      ok: true,
      default_connection_id: "conn_1",
      connections: [
        {
          connection_id: "conn_1",
          label: "Main delivery",
          state: "ready",
          ready: true,
          quote_types: ["warehouse_to_pickup_point"],
          supports_pickup_points: true,
          supports_pickup_windows: true,
          supports_dropoff: false,
          provider_code: "yandex",
        },
      ],
    } as any)

    const res = createMockResponse()

    await deliveryCatalogRoute.GET(createMockRequest() as any, res as any)

    expect(res.status).toHaveBeenCalledWith(400)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.error.code).toBe("DELIVERY_HUB_VALIDATION_ERROR")
    expect(payload.error.message).toBe("Store delivery request validation failed")
    expect(JSON.stringify(payload.error.details)).toContain("provider_code")
  })

  it("returns neutral shopper-safe store settings payload", async () => {
    const result = {
      ok: true,
      settings: {
        enabled: true,
        status: "available",
        summary: {
          enabled_connection_count: 2,
          ready_connection_count: 1,
          default_connection_label: "Primary neutral connection",
          modality_codes: ["warehouse_to_pickup_point", "dropoff_point_to_pickup_point"],
          supports_pickup_points: true,
          supports_pickup_windows: true,
          supports_dropoff: true,
        },
        preview_visibility: {
          shadow_settings: true,
          readiness: true,
          persisted_selection: true,
          shadow_catalog: true,
          shadow_pickup_points: true,
          shadow_quotes: true,
          shadow_pickup_windows: true,
        },
        hints: [
          "Delivery Hub currently exposes 1 ready connection for read-only storefront visibility.",
          "Default neutral storefront connection is Primary neutral connection.",
        ],
      },
    }

    const settingsSpy = jest
      .spyOn(DeliveryHubService.prototype, "getStoreSettings")
      .mockResolvedValue(result as any)

    const res = createMockResponse()

    await deliverySettingsRoute.GET(createMockRequest() as any, res as any)

    expect(settingsSpy).toHaveBeenCalledWith()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(result)
  })

  it("rejects settings payloads that try to include internal identifiers or secrets", async () => {
    jest.spyOn(DeliveryHubService.prototype, "getStoreSettings").mockResolvedValue({
      ok: true,
      settings: {
        enabled: true,
        status: "available",
        summary: {
          enabled_connection_count: 1,
          ready_connection_count: 1,
          default_connection_label: "Primary neutral connection",
          modality_codes: ["warehouse_to_pickup_point"],
          supports_pickup_points: true,
          supports_pickup_windows: true,
          supports_dropoff: false,
          provider_id: "deliveryhub_deliveryhub",
        },
        preview_visibility: {
          shadow_settings: true,
          readiness: true,
          persisted_selection: true,
          shadow_catalog: true,
          shadow_pickup_points: true,
          shadow_quotes: true,
          shadow_pickup_windows: true,
        },
        hints: [],
      },
    } as any)

    const res = createMockResponse()

    await deliverySettingsRoute.GET(createMockRequest() as any, res as any)

    expect(res.status).toHaveBeenCalledWith(400)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.error.code).toBe("DELIVERY_HUB_VALIDATION_ERROR")
    expect(payload.error.message).toBe("Store delivery request validation failed")
    expect(JSON.stringify(payload.error.details)).toContain("provider_id")
  })

  it("returns neutral pickup points payload", async () => {
    const result = {
      ok: true,
      points: [
        {
          provider_point_id: "pvz_1",
          provider_point_code: "code_1",
          provider_operator_id: null,
          network_label: null,
          is_yandex_branded: null,
          is_market_partner: null,
          station_type: null,
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

  it("rejects pickup point payloads that try to expose secret-like metadata or credentials", async () => {
    jest.spyOn(DeliveryHubService.prototype, "listStorePickupPoints").mockResolvedValue({
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
          token: "secret-token",
        },
      ],
    } as any)

    const res = createMockResponse()

    await deliveryPickupPointsRoute.GET(createMockRequest() as any, res as any)

    expect(res.status).toHaveBeenCalledWith(400)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.error.code).toBe("DELIVERY_HUB_VALIDATION_ERROR")
    expect(payload.error.message).toBe("Store delivery request validation failed")
    expect(JSON.stringify(payload.error.details)).toContain("token")
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

  it("rejects pickup window payloads that try to expose unsupported fragments", async () => {
    jest.spyOn(DeliveryHubService.prototype, "listStorePickupWindows").mockResolvedValue({
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
          token: "secret-token",
        },
      ],
    } as any)

    const res = createMockResponse()

    await deliveryPickupWindowsRoute.GET(createMockRequest() as any, res as any)

    expect(res.status).toHaveBeenCalledWith(400)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.error.code).toBe("DELIVERY_HUB_VALIDATION_ERROR")
    expect(payload.error.message).toBe("Store delivery request validation failed")
    expect(JSON.stringify(payload.error.details)).toContain("token")
  })

  it("parses JSON query params and returns neutral quotes payload", async () => {
    const result = {
      ok: true,
      quotes: [
        {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          mode_code: "warehouse_to_pickup_point",
          quote_reference: {
            id: "dhsel_11111111111111111111111111111111",
            version: 1,
          },
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_point_ids: ["pvz_1"],
          pickup_window_required: false,
        },
      ],
      diagnostics: {
        correlation_id: "corr_quote_1",
        checkout_source_of_truth: "unchanged",
        contour: "delivery_hub_storefront_preview",
      },
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

  it("accepts neutral JSON body quote smoke without checkout cutover", async () => {
    const result = {
      ok: true,
      quotes: [
        {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          mode_code: "dropoff_point_to_pickup_point",
          quote_reference: {
            id: "dhsel_22222222222222222222222222222222",
            version: 1,
          },
          amount: 181.9,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_point_ids: ["pvz_2"],
          pickup_window_required: false,
        },
      ],
      diagnostics: {
        correlation_id: "corr_quote_post_1",
        checkout_source_of_truth: "unchanged",
        contour: "delivery_hub_storefront_preview",
      },
    }

    const quoteSpy = jest
      .spyOn(DeliveryHubService.prototype, "listStoreQuotes")
      .mockResolvedValue(result as any)

    const res = createMockResponse()

    await deliveryQuotesRoute.POST(
      createMockRequest({
        validatedBody: {
          connection_id: "conn_1",
          mode_code: "dropoff_point_to_pickup_point",
          origin_point_id: "dropoff_1",
          destination_point_id: "pvz_2",
          currency_code: "RUB",
          items: [
            {
              quantity: 1,
              weight_grams: 500,
              price: 2000,
            },
          ],
        },
      }) as any,
      res as any
    )

    expect(quoteSpy).toHaveBeenCalledWith({
      connection_id: "conn_1",
      mode_code: "dropoff_point_to_pickup_point",
      currency_code: "RUB",
      destination_point_id: "pvz_2",
      origin_point_id: "dropoff_1",
      warehouse_id: undefined,
      interval_utc: undefined,
      items: [
        {
          quantity: 1,
          weight_grams: 500,
          price: 2000,
        },
      ],
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(result)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(JSON.stringify(payload)).not.toMatch(
      /token|authorization|raw_reference|ciphertext|provider_offer_id/i
    )
    expect(payload.diagnostics.checkout_source_of_truth).toBe("unchanged")
  })

  it("fails closed when store quote POST middleware did not provide a validated JSON body", async () => {
    const quoteSpy = jest.spyOn(DeliveryHubService.prototype, "listStoreQuotes")
    const res = createMockResponse()

    await deliveryQuotesRoute.POST(
      createMockRequest({}) as any,
      res as any
    )

    expect(quoteSpy).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({
          code: "DELIVERY_HUB_VALIDATION_ERROR",
          message: "Store delivery quote request body was not validated",
          details: expect.objectContaining({
            field: "body",
          }),
        }),
      })
    )
    expect(JSON.stringify((res.json as jest.Mock).mock.calls[0][0])).not.toMatch(
      /token|authorization|ciphertext|provider_offer_id/i
    )
  })

  it("validates raw JSON body fallback for store quote POST without accepting provider DTOs", async () => {
    const quoteSpy = jest.spyOn(DeliveryHubService.prototype, "listStoreQuotes")
    const res = createMockResponse()

    await deliveryQuotesRoute.POST(
      createMockRequest({
        body: {
          connection_id: "conn_1",
          mode_code: "dropoff_point_to_pickup_point",
          origin_point_id: "dropoff_1",
          destination_point_id: "pvz_2",
          currency_code: "RUB",
          items: [
            {
              quantity: 1,
              weight_grams: 500,
              price: 2000,
            },
          ],
          provider_offer_id: "raw-provider-fragment",
        },
      }) as any,
      res as any
    )

    expect(quoteSpy).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.error.code).toBe("DELIVERY_HUB_VALIDATION_ERROR")
    expect(JSON.stringify(payload.error.details)).toContain("provider_offer_id")
  })

  it("rejects quote payloads that try to expose internal quote fragments", async () => {
    jest.spyOn(DeliveryHubService.prototype, "listStoreQuotes").mockResolvedValue({
      ok: true,
      quotes: [
        {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          mode_code: "warehouse_to_pickup_point",
          quote_reference: {
            id: "dhsel_11111111111111111111111111111111",
            version: 1,
          },
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_point_ids: ["pvz_1"],
          pickup_window_required: false,
          raw_reference: {
            provider_offer_id: "internal",
          },
        },
      ],
    } as any)

    const res = createMockResponse()

    await deliveryQuotesRoute.GET(
      createMockRequest({
        validatedQuery: {
          mode_code: "warehouse_to_pickup_point",
          warehouse_id: "wh_1",
          destination_point_id: "pvz_1",
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(400)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.error.code).toBe("DELIVERY_HUB_VALIDATION_ERROR")
    expect(payload.error.message).toBe("Store delivery request validation failed")
    expect(JSON.stringify(payload.error.details)).toContain("raw_reference")
  })

  it("returns neutral persisted selection payload", async () => {
    const selection = {
      version: 1,
      provider_code: "yandex",
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
      correlation_id: "corr_store_1",
      updated_at: "2026-04-21T03:00:00.000Z",
    }
    deliverySelectionRoute.storeDeliverySelectionDeps.getDeliveryHubCartById =
      jest.fn(async () => ({
        id: "cart_1",
        metadata: {
          keep: true,
        },
      })) as any
    deliverySelectionRoute.storeDeliverySelectionDeps.requireDeliveryHubCart =
      jest.fn((cart) => cart) as any
    deliverySelectionRoute.storeDeliverySelectionDeps.readDeliveryHubCartSelection =
      jest.fn(() => selection) as any

    const res = createMockResponse()

    await deliverySelectionRoute.GET(
      createMockRequest({
        validatedQuery: {
          cart_id: "cart_1",
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      cart_id: "cart_1",
      selection,
    })
  })

  it("rejects selection GET payloads that try to expose backend-only execution references", async () => {
    deliverySelectionRoute.storeDeliverySelectionDeps.getDeliveryHubCartById =
      jest.fn(async () => ({
        id: "cart_1",
        metadata: {
          keep: true,
        },
      })) as any
    deliverySelectionRoute.storeDeliverySelectionDeps.requireDeliveryHubCart =
      jest.fn((cart) => cart) as any
    deliverySelectionRoute.storeDeliverySelectionDeps.readDeliveryHubCartSelection =
      jest.fn(() => ({
        version: 1,
        provider_code: "yandex",
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
          currency_code: "RUB",
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
        correlation_id: null,
        updated_at: "2026-04-21T03:00:00.000Z",
        backend_execution_reference: {
          version: 1,
          token: "opaque_backend_only_token",
        },
      })) as any

    const res = createMockResponse()

    await deliverySelectionRoute.GET(
      createMockRequest({
        validatedQuery: {
          cart_id: "cart_1",
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(400)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.error.code).toBe("DELIVERY_HUB_VALIDATION_ERROR")
    expect(payload.error.message).toBe("Store delivery request validation failed")
    expect(JSON.stringify(payload.error.details)).toContain("backend_execution_reference")
  })

  it("rejects selection GET payloads that try to expose internal selection fragments", async () => {
    deliverySelectionRoute.storeDeliverySelectionDeps.getDeliveryHubCartById =
      jest.fn(async () => ({
        id: "cart_1",
        metadata: {
          keep: true,
        },
      })) as any
    deliverySelectionRoute.storeDeliverySelectionDeps.requireDeliveryHubCart =
      jest.fn((cart) => cart) as any
    deliverySelectionRoute.storeDeliverySelectionDeps.readDeliveryHubCartSelection =
      jest.fn(() => ({
        version: 1,
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
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: false,
          quote_key: "internal-quote-key",
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
        updated_at: "2026-04-21T03:00:00.000Z",
      })) as any

    const res = createMockResponse()

    await deliverySelectionRoute.GET(
      createMockRequest({
        validatedQuery: {
          cart_id: "cart_1",
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(400)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.error.code).toBe("DELIVERY_HUB_VALIDATION_ERROR")
    expect(payload.error.message).toBe("Store delivery request validation failed")
    expect(JSON.stringify(payload.error.details)).toContain("quote_key")
  })

  it("rejects selection GET payloads with unsupported provider code at response boundary", async () => {
    const selection = createStoreSelection({
      provider_code: "raw_provider",
    })
    deliverySelectionRoute.storeDeliverySelectionDeps.getDeliveryHubCartById =
      jest.fn(async () => ({
        id: "cart_1",
        metadata: {
          keep: true,
        },
      })) as any
    deliverySelectionRoute.storeDeliverySelectionDeps.requireDeliveryHubCart =
      jest.fn((cart) => cart) as any
    deliverySelectionRoute.storeDeliverySelectionDeps.readDeliveryHubCartSelection =
      jest.fn(() => selection) as any

    const res = createMockResponse()

    await deliverySelectionRoute.GET(
      createMockRequest({
        validatedQuery: {
          cart_id: "cart_1",
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(400)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.error.code).toBe("DELIVERY_HUB_VALIDATION_ERROR")
    expect(payload.error.message).toBe("Store delivery request validation failed")
    expect(JSON.stringify(payload.error.details)).toContain("provider_code")
  })

  it("returns neutral persisted selection payload after POST", async () => {
    const selection = {
      version: 1,
      provider_code: "yandex",
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
      correlation_id: "corr_store_1",
      updated_at: "2026-04-21T03:00:00.000Z",
    }
    deliverySelectionRoute.storeDeliverySelectionDeps.getDeliveryHubCartById =
      jest.fn(async () => ({
        id: "cart_1",
        metadata: {
          keep: true,
        },
      })) as any
    deliverySelectionRoute.storeDeliverySelectionDeps.requireDeliveryHubCart =
      jest.fn((cart) => cart) as any
    deliverySelectionRoute.storeDeliverySelectionDeps.upsertDeliveryHubCartSelection =
      jest.fn(async () => selection) as any

    const res = createMockResponse()

    await deliverySelectionRoute.POST(
      createMockRequest({
        validatedBody: {
          cart_id: "cart_1",
          provider_code: "yandex",
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
          correlation_id: "corr_store_1",
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      cart_id: "cart_1",
      selection,
      diagnostics: {
        correlation_id: "corr_store_1",
        checkout_source_of_truth: "unchanged",
        contour: "delivery_hub_storefront_preview",
      },
    })
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(JSON.stringify(payload)).not.toMatch(
      /backend_execution_reference|token|authorization|raw_reference|ciphertext|provider_offer_id/i
    )
    expect(payload.diagnostics.checkout_source_of_truth).toBe("unchanged")
  })

  it("rejects selection POST payloads that try to expose provider-specific fragments", async () => {
    deliverySelectionRoute.storeDeliverySelectionDeps.getDeliveryHubCartById =
      jest.fn(async () => ({
        id: "cart_1",
        metadata: {
          keep: true,
        },
      })) as any
    deliverySelectionRoute.storeDeliverySelectionDeps.requireDeliveryHubCart =
      jest.fn((cart) => cart) as any
    deliverySelectionRoute.storeDeliverySelectionDeps.upsertDeliveryHubCartSelection =
      jest.fn(async () => ({
        version: 1,
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
          metadata: {
            provider_offer_id: "secret",
          },
        },
        pickup_window: null,
        updated_at: "2026-04-21T03:00:00.000Z",
      })) as any

    const res = createMockResponse()

    await deliverySelectionRoute.POST(
      createMockRequest({
        validatedBody: {
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
            currency_code: "RUB",
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
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(400)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.error.code).toBe("DELIVERY_HUB_VALIDATION_ERROR")
    expect(payload.error.message).toBe("Store delivery request validation failed")
    expect(JSON.stringify(payload.error.details)).toContain("metadata")
  })

  it("returns neutral empty selection payload after DELETE", async () => {
    const cart = {
      id: "cart_1",
      metadata: {
        keep: true,
      },
    }
    deliverySelectionRoute.storeDeliverySelectionDeps.getDeliveryHubCartById =
      jest.fn(async () => cart) as any
    deliverySelectionRoute.storeDeliverySelectionDeps.requireDeliveryHubCart =
      jest.fn((existingCart) => existingCart) as any
    deliverySelectionRoute.storeDeliverySelectionDeps.clearDeliveryHubCartSelection =
      jest.fn(async () => null) as any

    const req = createMockRequest({
      validatedBody: {
        cart_id: "cart_1",
      },
    })
    const res = createMockResponse()

    await deliverySelectionRoute.DELETE(req as any, res as any)

    expect(
      deliverySelectionRoute.storeDeliverySelectionDeps.clearDeliveryHubCartSelection
    ).toHaveBeenCalledWith(req.scope, cart)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      cart_id: "cart_1",
      selection: null,
      diagnostics: {
        correlation_id: null,
        checkout_source_of_truth: "unchanged",
        contour: "delivery_hub_storefront_preview",
      },
    })
  })

  it("returns controlled 404 for missing cart in selection route", async () => {
    deliverySelectionRoute.storeDeliverySelectionDeps.getDeliveryHubCartById =
      jest.fn(async () => null) as any
    deliverySelectionRoute.storeDeliverySelectionDeps.requireDeliveryHubCart =
      jest.fn(() => {
        throw new DeliveryHubError({
          code: "DELIVERY_HUB_NOT_FOUND",
          message: 'Cart "cart_missing" was not found',
          status: 404,
          details: {
            field: "cart_id",
          },
        })
      }) as any

    const res = createMockResponse()

    await deliverySelectionRoute.GET(
      createMockRequest({
        validatedQuery: {
          cart_id: "cart_missing",
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: "DELIVERY_HUB_NOT_FOUND",
        message: 'Cart "cart_missing" was not found',
        details: {
          field: "cart_id",
        },
      },
    })
  })

  it("returns neutral readiness payload", async () => {
    const result = {
      ok: true,
      cart_id: "cart_1",
      status: "ready",
      issues: [],
      selection: {
        version: 1,
        provider_code: "yandex",
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
        correlation_id: "corr_store_1",
        updated_at: "2026-04-21T03:00:00.000Z",
      },
      quote_context: {
        connection: {
          connection_id: "conn_1",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_0123456789abcdef0123456789abcdef",
          version: 1,
        },
        pickup_point_required: true,
        pickup_window_required: true,
        updated_at: "2026-04-21T03:00:00.000Z",
      },
    }

    const readinessSpy = jest
      .spyOn(DeliveryHubService.prototype, "getStoreSelectionReadiness")
      .mockResolvedValue(result as any)
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

    expect(readinessSpy).toHaveBeenCalledWith({
      cart_id: "cart_1",
      metadata: {
        keep: true,
      },
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(result)
  })

  it("rejects readiness payloads that try to expose internal selection fragments", async () => {
    jest.spyOn(DeliveryHubService.prototype, "getStoreSelectionReadiness").mockResolvedValue({
      ok: true,
      cart_id: "cart_1",
      status: "ready",
      issues: [],
      selection: {
        version: 1,
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
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: true,
          quote_key: "internal-quote-key",
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
        updated_at: "2026-04-21T03:00:00.000Z",
      },
      quote_context: {
        connection: {
          connection_id: "conn_1",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_0123456789abcdef0123456789abcdef",
          version: 1,
        },
        pickup_point_required: true,
        pickup_window_required: true,
        updated_at: "2026-04-21T03:00:00.000Z",
      },
    } as any)
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

    expect(res.status).toHaveBeenCalledWith(400)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.error.code).toBe("DELIVERY_HUB_VALIDATION_ERROR")
    expect(payload.error.message).toBe("Store delivery request validation failed")
    expect(JSON.stringify(payload.error.details)).toContain("quote_key")
  })

  it("returns read-only checkout cutover preconditions payload", async () => {
    const result = buildCutoverPreconditionsResult()
    const preconditionsSpy = jest
      .spyOn(DeliveryHubService.prototype, "getStoreCutoverPreconditions")
      .mockResolvedValue(result as any)
    const res = createMockResponse()

    await deliveryCutoverPreconditionsRoute.GET(createMockRequest() as any, res as any)

    expect(preconditionsSpy).toHaveBeenCalledWith()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(result)
    expect(JSON.stringify((res.json as jest.Mock).mock.calls[0][0])).not.toMatch(
      /token|authorization|raw_reference|ciphertext|provider_offer_id|quote_key|publishable/i
    )
  })

  it("returns read-only cutover candidate planner payload", async () => {
    const result = buildCutoverCandidateResult()
    const candidateSpy = jest
      .spyOn(DeliveryHubService.prototype, "getStoreCutoverCandidate")
      .mockResolvedValue(result as any)
    deliveryCutoverCandidateRoute.storeDeliveryCutoverCandidateDeps.getDeliveryHubCartById =
      jest.fn(async () => ({
        id: "cart_1",
        metadata: {
          delivery_hub: {
            selection: {
              quote_key: "must-not-leak",
            },
          },
        },
      })) as any
    deliveryCutoverCandidateRoute.storeDeliveryCutoverCandidateDeps.requireDeliveryHubCart =
      jest.fn((cart) => cart) as any
    const res = createMockResponse()

    await deliveryCutoverCandidateRoute.GET(
      createMockRequest({
        validatedQuery: {
          cart_id: "cart_1",
        },
        shippingOptions: [
          {
            id: "deliveryhub:warehouse_to_pickup_point",
            name: "Delivery Hub Pickup",
            provider_id: "deliveryhub_deliveryhub",
            data: {
              raw_reference: "must-not-leak",
            },
          },
        ],
      }) as any,
      res as any
    )

    expect(candidateSpy).toHaveBeenCalledWith({
      cart_id: "cart_1",
      metadata: {
        delivery_hub: {
          selection: {
            quote_key: "must-not-leak",
          },
        },
      },
      current_shipping_options: [
        {
          id: "deliveryhub:warehouse_to_pickup_point",
          name: "Delivery Hub Pickup",
          provider_id: "deliveryhub_deliveryhub",
          data: {
            raw_reference: "must-not-leak",
          },
        },
      ],
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(result)
    expect(JSON.stringify((res.json as jest.Mock).mock.calls[0][0])).not.toMatch(
      /token|authorization|raw_reference|ciphertext|provider_offer_id|quote_key|publishable/i
    )
  })

  it("rejects cutover candidate payloads that try to enable commit or leak provider fragments", async () => {
    jest.spyOn(DeliveryHubService.prototype, "getStoreCutoverCandidate").mockResolvedValue({
      ...buildCutoverCandidateResult(),
      can_commit_shipping_method: true,
      blocked_reasons: ["token=secret-token"],
    } as any)
    deliveryCutoverCandidateRoute.storeDeliveryCutoverCandidateDeps.getDeliveryHubCartById =
      jest.fn(async () => ({
        id: "cart_1",
        metadata: {},
      })) as any
    deliveryCutoverCandidateRoute.storeDeliveryCutoverCandidateDeps.requireDeliveryHubCart =
      jest.fn((cart) => cart) as any
    const res = createMockResponse()

    await deliveryCutoverCandidateRoute.GET(
      createMockRequest({
        validatedQuery: {
          cart_id: "cart_1",
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(400)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.error.code).toBe("DELIVERY_HUB_VALIDATION_ERROR")
    expect(payload.error.message).toBe("Store delivery request validation failed")
    expect(JSON.stringify(payload.error.details)).toContain("can_commit_shipping_method")
    expect(JSON.stringify(payload.error.details)).not.toContain("secret-token")
  })

  it("rejects cutover preconditions payloads that try to enable commit or leak provider fragments", async () => {
    jest.spyOn(DeliveryHubService.prototype, "getStoreCutoverPreconditions").mockResolvedValue({
      ...buildCutoverPreconditionsResult(),
      can_commit_shipping_method: true,
      preconditions: [
        {
          code: "store_quote_contract_ready",
          label: "Store quote contract readiness",
          status: "ready",
          ready: true,
          detail: "Unsafe raw_reference provider_offer_id should not pass",
          evidence: [
            {
              label: "token=secret-token",
              status: "ready",
            },
          ],
        },
      ],
    } as any)
    const res = createMockResponse()

    await deliveryCutoverPreconditionsRoute.GET(createMockRequest() as any, res as any)

    expect(res.status).toHaveBeenCalledWith(400)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.error.code).toBe("DELIVERY_HUB_VALIDATION_ERROR")
    expect(payload.error.message).toBe("Store delivery request validation failed")
    expect(JSON.stringify(payload.error.details)).toContain("can_commit_shipping_method")
    expect(JSON.stringify(payload.error.details)).not.toContain("secret-token")
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

  it("keeps neutral Delivery Hub store route contour available", () => {
    expect(deliveryQuotesRoute).toHaveProperty("GET")
    expect(deliveryQuotesRoute).toHaveProperty("POST")
    expect(deliverySelectionRoute).toHaveProperty("POST")
  })

  it("returns controlled 400 for malformed items JSON", async () => {
    const quoteSpy = jest.spyOn(DeliveryHubService.prototype, "listStoreQuotes")
    const res = createMockResponse()

    await deliveryQuotesRoute.GET(
      createMockRequest({
        validatedQuery: {
          mode_code: "warehouse_to_pickup_point",
          warehouse_id: "wh_1",
          destination_point_id: "pvz_1",
          items: "{bad json",
        },
      }) as any,
      res as any
    )

    expect(quoteSpy).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: "DELIVERY_HUB_VALIDATION_ERROR",
        message: 'Query parameter "items" must be valid JSON',
        details: {
          field: "items",
        },
      },
    })
  })

  it("returns controlled 400 for malformed interval JSON", async () => {
    const quoteSpy = jest.spyOn(DeliveryHubService.prototype, "listStoreQuotes")
    const res = createMockResponse()

    await deliveryQuotesRoute.GET(
      createMockRequest({
        validatedQuery: {
          mode_code: "warehouse_to_pickup_point",
          warehouse_id: "wh_1",
          destination_point_id: "pvz_1",
          interval_utc: "{bad json",
        },
      }) as any,
      res as any
    )

    expect(quoteSpy).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: "DELIVERY_HUB_VALIDATION_ERROR",
        message: 'Query parameter "interval_utc" must be valid JSON',
        details: {
          field: "interval_utc",
        },
      },
    })
  })

  it("returns controlled 404 for missing cart in readiness route", async () => {
    deliveryReadinessRoute.storeDeliverySelectionReadinessDeps.getDeliveryHubCartById =
      jest.fn(async () => null) as any
    deliveryReadinessRoute.storeDeliverySelectionReadinessDeps.requireDeliveryHubCart =
      jest.fn(() => {
        throw new DeliveryHubError({
          code: "DELIVERY_HUB_NOT_FOUND",
          message: 'Cart "cart_missing" was not found',
          status: 404,
          details: {
            entity: "cart",
            cart_id: "cart_missing",
          },
        })
      }) as any

    const readinessSpy = jest.spyOn(DeliveryHubService.prototype, "getStoreSelectionReadiness")
    const res = createMockResponse()

    await deliveryReadinessRoute.GET(
      createMockRequest({
        validatedQuery: {
          cart_id: "cart_missing",
        },
      }) as any,
      res as any
    )

    expect(readinessSpy).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: "DELIVERY_HUB_NOT_FOUND",
        message: 'Cart "cart_missing" was not found',
        details: {
          entity: "cart",
          cart_id: "cart_missing",
        },
      },
    })
  })
})

function buildCutoverCandidateResult() {
  return {
    ok: true,
    version: 1,
    cart_id: "cart_1",
    selection_present: true,
    selection_reference_id: "dhsel_0123456789abcdef0123456789abcdef",
    candidate_status: "ready_for_review",
    candidate_shipping_option_id: "deliveryhub:warehouse_to_pickup_point",
    candidate_shipping_option_name: "Delivery Hub Pickup",
    candidate_amount: 499,
    currency_code: "RUB",
    candidate_pickup_point_id: "pvz_1",
    required_preconditions: [
      "neutral_selection_ready",
      "matching_delivery_hub_shipping_option_present",
      "operator_approval_required",
      "can_commit_shipping_method_false",
    ],
    blocked_reasons: [
      "operator_approval_required",
      "can_commit_shipping_method_false",
    ],
    can_commit_shipping_method: false,
    checkout_source_of_truth: "unchanged",
    guardrails: {
      no_network_calls: true,
      no_provider_payloads: true,
      no_secret_material: true,
      shipment_lifecycle_not_enabled: true,
      can_commit_shipping_method: false,
    },
  }
}

function buildCutoverPreconditionsResult() {
  return {
    ok: true,
    version: 1,
    posture: "evidence_preflight_only",
    status: "preflight_only",
    can_commit_shipping_method: false,
    summary: {
      ready_count: 6,
      missing_count: 1,
      required_count: 1,
      blocked_count: 1,
      not_enabled_count: 1,
      total_count: 10,
    },
    preconditions: [
      {
        code: "store_quote_contract_ready",
        label: "Store quote contract readiness",
        status: "ready",
        ready: true,
        detail: "Read-only planner projects both first-tranche store quote modes.",
        evidence: [
          {
            label: "projected_modes=warehouse_to_pickup_point,dropoff_point_to_pickup_point",
            status: "ready",
          },
        ],
      },
      {
        code: "operator_approval_required",
        label: "Operator approval required",
        status: "required",
        ready: false,
        detail: "Separate approved cutover tranche is required before commit can be enabled.",
        evidence: [
          {
            label: "approval_gate=required_future_cutover_tranche",
            status: "required",
          },
        ],
      },
      {
        code: "can_commit_shipping_method",
        label: "Shipping-method commit remains blocked",
        status: "blocked",
        ready: false,
        detail: "can_commit_shipping_method=false; verifier aggregates evidence only.",
        evidence: [
          {
            label: "can_commit_shipping_method=false",
            status: "blocked",
          },
        ],
      },
    ],
    guardrails: {
      checkout_source_of_truth: "unchanged",
      no_network_calls: true,
      no_provider_payloads: true,
      no_secret_material: true,
      shipment_lifecycle_not_enabled: true,
      can_commit_shipping_method: false,
    },
  }
}

function createStoreSelection(overrides?: Record<string, unknown>) {
  return {
    version: 1,
    provider_code: "yandex",
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
      currency_code: "RUB",
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
    updated_at: "2026-04-21T03:00:00.000Z",
    ...overrides,
  }
}

function createMockRequest(input?: Partial<any>) {
  const shippingOptions = input?.shippingOptions ?? []
  const scope = input?.scope ?? {
    resolve: jest.fn(() => ({
      graph: jest.fn(async () => ({
        data: shippingOptions,
      })),
    })),
  }

  return {
    validatedQuery: {},
    ...input,
    scope,
  }
}

function createMockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }
}
