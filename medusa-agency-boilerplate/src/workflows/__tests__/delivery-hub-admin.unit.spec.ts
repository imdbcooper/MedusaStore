import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import * as deliveryConnectionsRoute from "../../api/admin/delivery/connections/route"
import * as deliveryConnectionRoute from "../../api/admin/delivery/connections/[id]/route"
import * as deliveryConnectionTestRoute from "../../api/admin/delivery/connections/[id]/test/route"
import * as deliveryLogsRoute from "../../api/admin/delivery/logs/route"
import * as deliveryProvidersRoute from "../../api/admin/delivery/providers/route"
import * as deliveryExecutionPlanPreviewRoute from "../../api/admin/delivery/execution-plan/preview/route"
import * as deliveryFulfillmentBridgePreviewRoute from "../../api/admin/delivery/fulfillment-bridge/preview/route"
import * as deliveryShippingOptionsPreviewRoute from "../../api/admin/delivery/shipping-options/preview/route"
import * as deliveryShippingOptionsSyncRoute from "../../api/admin/delivery/shipping-options/sync/route"
import * as deliveryShared from "../../api/admin/delivery/shared"
import * as deliveryPickupPointsRoute from "../../api/admin/delivery/pickup-points/route"
import * as deliveryPickupWindowsRoute from "../../api/admin/delivery/pickup-windows/route"
import * as deliveryTestQuoteRoute from "../../api/admin/delivery/test-quote/route"
import * as deliveryWarehousesRoute from "../../api/admin/delivery/warehouses/route"
import * as deliveryWarehouseRoute from "../../api/admin/delivery/warehouses/[id]/route"
import { DeliveryHubError } from "../../modules/delivery-hub/errors"
import { DeliveryHubService } from "../../modules/delivery-hub/service"

describe("Delivery Hub admin routes", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("returns list payload for admin delivery connections GET", async () => {
    const connections = [
      {
        id: "conn_1",
        provider_code: "yandex",
        name: "Yandex test",
        status: "draft",
        mode: "test",
        enabled: false,
        country_code: "RU",
        credentials_state: "sealed",
        credentials_fingerprint: "fingerprint",
        credentials_last_validated_at: null,
        credentials_last_error_code: null,
        credentials_present: true,
        config: {},
        metadata: {},
        created_at: "2026-04-20T00:00:00.000Z",
        updated_at: "2026-04-20T00:00:00.000Z",
      },
    ]

    jest
      .spyOn(DeliveryHubService.prototype, "listConnections")
      .mockResolvedValue(connections as any)

    const res = createMockResponse()

    await deliveryConnectionsRoute.GET(createMockRequest() as any, res as any)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      connections,
    })
  })

  it("returns admin delivery providers payload", async () => {
    const providers = [
      {
        code: "yandex",
        label: "Yandex Delivery",
        supported_mode_codes: [
          "warehouse_to_pickup_point",
          "dropoff_point_to_pickup_point",
        ],
        capabilities: [
          "test_connection",
          "list_pickup_points",
          "list_pickup_windows",
          "quote_warehouse_to_pickup_point",
          "quote_dropoff_point_to_pickup_point",
        ],
      },
    ]

    const providersSpy = jest
      .spyOn(DeliveryHubService.prototype, "listProviders")
      .mockResolvedValue(providers as any)

    const res = createMockResponse()

    await deliveryProvidersRoute.GET(createMockRequest() as any, res as any)

    expect(providersSpy).toHaveBeenCalledWith()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      providers,
    })
  })

  it("rejects polluted admin delivery providers payload before it crosses the boundary", async () => {
    jest.spyOn(DeliveryHubService.prototype, "listProviders").mockResolvedValue([
      {
        code: "yandex",
        label: "Yandex Delivery",
        supported_mode_codes: ["warehouse_to_pickup_point"],
        capabilities: ["test_connection"],
        client_secret: "leaked-client-secret",
      },
    ] as any)

    const res = createMockResponse()

    await deliveryProvidersRoute.GET(createMockRequest() as any, res as any)

    expect(res.status).toHaveBeenCalledWith(500)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.error.code).toBe("DELIVERY_HUB_UNEXPECTED_ERROR")
    expect(payload.error.message).toContain("client_secret")
  })

  it("creates connection and returns admin contract payload", async () => {
    const body = {
      provider_code: "yandex",
      name: "Yandex test",
      mode: "test",
      config: {
        api_base_url: "https://b2b.taxi.tst.yandex.net/b2b/cargo/integration/v2",
      },
      credentials: {
        token: "token-value",
      },
    }
    const connection = {
      id: "conn_1",
      provider_code: "yandex",
      name: "Yandex test",
      status: "draft",
      mode: "test",
      enabled: false,
      country_code: "RU",
      credentials_state: "sealed",
      credentials_fingerprint: "fingerprint",
      credentials_last_validated_at: null,
      credentials_last_error_code: null,
      credentials_present: true,
      config: {},
      metadata: {},
      created_at: "2026-04-20T00:00:00.000Z",
      updated_at: "2026-04-20T00:00:00.000Z",
    }

    const createSpy = jest
      .spyOn(DeliveryHubService.prototype, "createConnection")
      .mockResolvedValue(connection as any)

    const res = createMockResponse()

    await deliveryConnectionsRoute.POST(
      createMockRequest({ validatedBody: body }) as any,
      res as any
    )

    expect(createSpy).toHaveBeenCalledWith(body)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      connection,
    })
  })

  it("actively strips secret-like fragments from created connection response boundary", async () => {
    jest.spyOn(DeliveryHubService.prototype, "createConnection").mockResolvedValue({
      id: "conn_1",
      provider_code: "yandex",
      name: "Yandex hardened",
      status: "draft",
      mode: "test",
      enabled: false,
      country_code: "RU",
      credentials_state: "sealed",
      credentials_fingerprint: "fingerprint",
      credentials_last_validated_at: null,
      credentials_last_error_code: null,
      credentials_present: true,
      config: {
        auto_confirm: true,
        token: "leaked-token",
        authorization: "Bearer leaked-auth",
      },
      metadata: {
        keep: true,
      },
      credentials: {
        token: "leaked-token",
      },
      token: "leaked-token",
      created_at: "2026-04-20T00:00:00.000Z",
      updated_at: "2026-04-20T00:00:00.000Z",
    } as any)

    const res = createMockResponse()

    await deliveryConnectionsRoute.POST(
      createMockRequest({
        validatedBody: {
          provider_code: "yandex",
          name: "Yandex hardened",
          mode: "test",
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(500)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload).toEqual({
      ok: false,
      error: {
        code: "DELIVERY_HUB_UNEXPECTED_ERROR",
        message: expect.stringContaining("Unrecognized key(s) in object"),
        details: null,
      },
    })
    expect(payload.error.message).toContain("credentials")
    expect(payload.error.message).toContain("token")
  })

  it("updates connection using route id and returns admin contract payload", async () => {
    const body = {
      name: "Yandex updated",
      enabled: true,
      config: {
        auto_confirm: true,
        default_warehouse_id: "wh_1",
      },
    }
    const connection = {
      id: "conn_1",
      provider_code: "yandex",
      name: "Yandex updated",
      status: "active",
      mode: "test",
      enabled: true,
      country_code: "RU",
      credentials_state: "sealed",
      credentials_fingerprint: "fingerprint",
      credentials_last_validated_at: null,
      credentials_last_error_code: null,
      credentials_present: true,
      config: {
        auto_confirm: true,
        default_warehouse_id: "wh_1",
      },
      metadata: {},
      created_at: "2026-04-20T00:00:00.000Z",
      updated_at: "2026-04-21T00:00:00.000Z",
    }

    const updateSpy = jest
      .spyOn(DeliveryHubService.prototype, "updateConnection")
      .mockResolvedValue(connection as any)

    const res = createMockResponse()

    await deliveryConnectionRoute.PUT(
      createMockRequest({
        url: "/admin/delivery/connections/conn_1",
        validatedBody: body,
      }) as any,
      res as any
    )

    expect(updateSpy).toHaveBeenCalledWith("conn_1", body)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      connection,
    })
  })

  it("deletes connection using route id and returns deleted admin contract payload", async () => {
    const connection = {
      id: "conn_1",
      provider_code: "yandex",
      name: "Yandex deleted",
      status: "error",
      mode: "test",
      enabled: true,
      country_code: "RU",
      credentials_state: "sealed",
      credentials_fingerprint: "fingerprint",
      credentials_last_validated_at: "2026-04-21T00:00:00.000Z",
      credentials_last_error_code: "PROVIDER_ERROR",
      credentials_present: true,
      config: {},
      metadata: {},
      created_at: "2026-04-20T00:00:00.000Z",
      updated_at: "2026-04-21T00:00:00.000Z",
    }

    const deleteSpy = jest
      .spyOn(DeliveryHubService.prototype, "deleteConnection")
      .mockResolvedValue({ deleted: true, connection } as any)

    const res = createMockResponse()

    await deliveryConnectionRoute.DELETE(
      createMockRequest({
        url: "/admin/delivery/connections/conn_1",
      }) as any,
      res as any
    )

    expect(deleteSpy).toHaveBeenCalledWith("conn_1")
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      deleted: true,
      connection,
    })
  })

  it("normalizes legacy Yandex base URL in admin connection response", async () => {
    const connection = {
      id: "conn_1",
      provider_code: "yandex",
      name: "Yandex updated",
      status: "active",
      mode: "test",
      enabled: true,
      country_code: "RU",
      credentials_state: "sealed",
      credentials_fingerprint: "fingerprint",
      credentials_last_validated_at: null,
      credentials_last_error_code: null,
      credentials_present: true,
      config: {
        api_base_url: "https://b2b.taxi.tst.yandex.net/b2b/cargo/integration/v2",
      },
      metadata: {},
      created_at: "2026-04-20T00:00:00.000Z",
      updated_at: "2026-04-21T00:00:00.000Z",
    }

    jest
      .spyOn(DeliveryHubService.prototype, "updateConnection")
      .mockResolvedValue(connection as any)

    const res = createMockResponse()

    await deliveryConnectionRoute.PUT(
      createMockRequest({
        url: "/admin/delivery/connections/conn_1",
        validatedBody: {
          name: "Yandex updated",
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      connection: {
        ...connection,
        config: {
          api_base_url: "https://b2b.taxi.tst.yandex.net/api/b2b/platform",
        },
      },
    })
  })

  it("rejects polluted admin connection update responses before they cross the boundary", async () => {
    jest.spyOn(DeliveryHubService.prototype, "updateConnection").mockResolvedValue({
      id: "conn_1",
      provider_code: "yandex",
      name: "Yandex updated",
      status: "active",
      mode: "test",
      enabled: true,
      country_code: "RU",
      credentials_state: "sealed",
      credentials_fingerprint: "fingerprint",
      credentials_last_validated_at: null,
      credentials_last_error_code: null,
      credentials_present: true,
      config: {
        auto_confirm: true,
        api_key: "leaked-api-key",
      },
      metadata: {},
      credentials: {
        token: "leaked-token",
      },
      created_at: "2026-04-20T00:00:00.000Z",
      updated_at: "2026-04-21T00:00:00.000Z",
    } as any)

    const res = createMockResponse()

    await deliveryConnectionRoute.PUT(
      createMockRequest({
        url: "/admin/delivery/connections/conn_1",
        validatedBody: {
          enabled: true,
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(500)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.error.code).toBe("DELIVERY_HUB_UNEXPECTED_ERROR")
    expect(payload.error.message).toContain("credentials")
    expect(payload.error.message).toContain("api_key")
  })

  it("passes route id and body into admin connection test flow", async () => {
    const body = {
      include_pickup_points: true,
    }
    const result = {
      ok: true,
      provider_code: "yandex",
      diagnostics: {
        correlation_id: "corr-connection-test",
        pickup_points_count: 3,
      },
      diagnostics_summary: {
        status: "ok",
        provider_status: "ok",
        error_category: null,
        message: null,
        correlation_id: "corr-connection-test",
        checked_at: "2026-04-21T10:00:00.000Z",
        redacted: true,
      },
    }

    const testSpy = jest
      .spyOn(DeliveryHubService.prototype, "testConnection")
      .mockResolvedValue(result as any)

    const res = createMockResponse()

    await deliveryConnectionTestRoute.POST(
      createMockRequest({
        url: "/admin/delivery/connections/conn_1/test",
        validatedBody: body,
      }) as any,
      res as any
    )

    expect(testSpy).toHaveBeenCalledWith("conn_1", body)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      result,
    })
  })

  it("redacts secret-like connection test diagnostics before they cross the admin boundary", async () => {
    jest.spyOn(DeliveryHubService.prototype, "testConnection").mockResolvedValue({
      ok: true,
      provider_code: "yandex",
      diagnostics: {
        correlation_id: "corr-connection-test",
        request: {
          headers: {
            Authorization: "Bearer leaked-token",
            xApiKey: "leaked-api-key",
          },
        },
        response: {
          body: '{"access_token":"leaked-token"}',
        },
      },
    } as any)

    const res = createMockResponse()

    await deliveryConnectionTestRoute.POST(
      createMockRequest({
        url: "/admin/delivery/connections/conn_1/test",
        validatedBody: {
          include_pickup_points: true,
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      result: {
        ok: true,
        provider_code: "yandex",
        diagnostics: {
          correlation_id: "corr-connection-test",
          request: {
            headers: {
              Authorization: "***",
              xApiKey: "***",
            },
          },
          response: {
            body: '{"access_token":"***"}',
          },
        },
      },
    })
  })


  it("creates and updates warehouse seller origin address through admin routes", async () => {
    const warehouse = {
      id: "wh_origin_1",
      name: "Адрес продавца / склада",
      enabled: true,
      country_code: "RU",
      city: "Москва",
      address_line_1: "Тверская 1",
      contact_name: "Оператор склада",
      contact_phone: "+79990000000",
      provider_code: "yandex",
      provider_warehouse_id: "YANDEX-WH-01",
      metadata: {
        postal_code: "125009",
        contact_email: "warehouse@example.test",
        coordinates: [37.6173, 55.7558],
      },
      created_at: "2026-04-20T00:00:00.000Z",
      updated_at: "2026-04-21T00:00:00.000Z",
    }
    const createBody = {
      name: warehouse.name,
      enabled: true,
      country_code: "RU",
      city: "Москва",
      address_line_1: "Тверская 1",
      contact_name: "Оператор склада",
      contact_phone: "+79990000000",
      provider_code: "yandex",
      provider_warehouse_id: "YANDEX-WH-01",
      metadata: warehouse.metadata,
    }

    const createSpy = jest
      .spyOn(DeliveryHubService.prototype, "createWarehouse")
      .mockResolvedValue(warehouse as any)
    const updateSpy = jest
      .spyOn(DeliveryHubService.prototype, "updateWarehouse")
      .mockResolvedValue({
        ...warehouse,
        city: "Москва",
        address_line_1: "Тверская 2",
        updated_at: "2026-04-22T00:00:00.000Z",
      } as any)

    const createRes = createMockResponse()
    await deliveryWarehousesRoute.POST(
      createMockRequest({ validatedBody: createBody }) as any,
      createRes as any
    )

    expect(createSpy).toHaveBeenCalledWith(createBody)
    expect(createRes.status).toHaveBeenCalledWith(201)
    expect(createRes.json).toHaveBeenCalledWith({ ok: true, warehouse })

    const updateRes = createMockResponse()
    await deliveryWarehouseRoute.PUT(
      createMockRequest({
        url: "/admin/delivery/warehouses/wh_origin_1",
        validatedBody: {
          ...createBody,
          address_line_1: "Тверская 2",
        },
      }) as any,
      updateRes as any
    )

    expect(updateSpy).toHaveBeenCalledWith("wh_origin_1", {
      ...createBody,
      address_line_1: "Тверская 2",
    })
    expect(updateRes.status).toHaveBeenCalledWith(200)
    expect(updateRes.json).toHaveBeenCalledWith({
      ok: true,
      warehouse: {
        ...warehouse,
        city: "Москва",
        address_line_1: "Тверская 2",
        updated_at: "2026-04-22T00:00:00.000Z",
      },
    })
  })

  it("rejects warehouse admin response with secret-like fragments before boundary", async () => {
    jest.spyOn(DeliveryHubService.prototype, "createWarehouse").mockResolvedValue({
      id: "wh_leaky",
      name: "Leaky warehouse",
      enabled: true,
      country_code: "RU",
      city: "Москва",
      address_line_1: "Тверская 1",
      contact_name: null,
      contact_phone: null,
      provider_code: "yandex",
      provider_warehouse_id: "YANDEX-WH-01",
      metadata: {
        postal_code: "125009",
        token: "must-not-cross-boundary",
      },
      credentials: {
        token: "must-not-cross-boundary",
      },
      created_at: "2026-04-20T00:00:00.000Z",
      updated_at: "2026-04-21T00:00:00.000Z",
    } as any)

    const res = createMockResponse()
    await deliveryWarehousesRoute.POST(
      createMockRequest({
        validatedBody: {
          name: "Leaky warehouse",
          country_code: "RU",
          city: "Москва",
          address_line_1: "Тверская 1",
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(500)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.error.code).toBe("DELIVERY_HUB_UNEXPECTED_ERROR")
    expect(payload.error.message).toContain("credentials")
  })

  it("returns sanitized admin pickup point lookup payload without provider raw body", async () => {
    jest.spyOn(DeliveryHubService.prototype, "listAdminPickupPoints").mockResolvedValue({
      ok: true,
      connection: {
        id: "conn_1",
        provider_code: "yandex",
        name: "Yandex test",
        status: "active",
        mode: "test",
        enabled: true,
        country_code: "RU",
        credentials_state: "sealed",
        credentials_fingerprint: "fingerprint",
        credentials_last_validated_at: null,
        credentials_last_error_code: null,
        credentials_present: true,
        config: {},
        metadata: {},
        created_at: "2026-04-20T00:00:00.000Z",
        updated_at: "2026-04-20T00:00:00.000Z",
      },
      points: [
        {
          id: "pvz_1",
          code: "code_1",
          operator_id: "market_l4g",
          network_label: "Яндекс Маркет",
          station_type: "pickup_point",
          is_yandex_branded: true,
          is_market_partner: true,
          name: "PVZ 1",
          address: "Tverskaya 1",
          city: "Moscow",
          postal_code: "125009",
          available_for_dropoff: true,
          coordinates: {
            lat: 55.75,
            lng: 37.61,
          },
        },
      ],
      limit: 20,
      total_available: 1079,
      returned_count: 1,
      truncated: true,
      correlation_id: "corr-pickup-lookup",
    } as any)

    const res = createMockResponse()

    await deliveryPickupPointsRoute.GET(
      createMockRequest({
        url: "/admin/delivery/pickup-points?connection_id=conn_1&limit=20",
        validatedQuery: {
          connection_id: "conn_1",
          limit: 20,
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      returned_count: 1,
      total_available: 1079,
      points: [
        {
          id: "pvz_1",
          code: "code_1",
          operator_id: "market_l4g",
          network_label: "Яндекс Маркет",
          station_type: "pickup_point",
          is_yandex_branded: true,
          is_market_partner: true,
          name: "PVZ 1",
          address: "Tverskaya 1",
          city: "Moscow",
          postal_code: "125009",
          available_for_dropoff: true,
          coordinates: {
            lat: 55.75,
            lng: 37.61,
          },
        },
      ],
    }))
  })

  it("rejects admin pickup point lookup payloads with raw provider fragments", async () => {
    jest.spyOn(DeliveryHubService.prototype, "listAdminPickupPoints").mockResolvedValue({
      ok: true,
      connection: {
        id: "conn_1",
        provider_code: "yandex",
        name: "Yandex test",
        status: "active",
        mode: "test",
        enabled: true,
        country_code: "RU",
        credentials_state: "sealed",
        credentials_fingerprint: "fingerprint",
        credentials_last_validated_at: null,
        credentials_last_error_code: null,
        credentials_present: true,
        config: {},
        metadata: {},
        created_at: "2026-04-20T00:00:00.000Z",
        updated_at: "2026-04-20T00:00:00.000Z",
      },
      points: [
        {
          id: "pvz_1",
          code: null,
          operator_id: null,
          network_label: null,
          station_type: null,
          is_yandex_branded: null,
          is_market_partner: null,
          name: "PVZ 1",
          address: "Tverskaya 1",
          city: "Moscow",
          postal_code: null,
          available_for_dropoff: false,
          coordinates: { lat: null, lng: null },
          raw_response: { token: "secret" },
        },
      ],
      limit: 20,
      total_available: 1,
      returned_count: 1,
      truncated: false,
      correlation_id: "corr-pickup-lookup",
    } as any)

    const res = createMockResponse()

    await deliveryPickupPointsRoute.GET(
      createMockRequest({
        url: "/admin/delivery/pickup-points?connection_id=conn_1",
        validatedQuery: {
          connection_id: "conn_1",
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(500)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.error.code).toBe("DELIVERY_HUB_UNEXPECTED_ERROR")
    expect(payload.error.message).toContain("raw_response")
  })

  it("returns sanitized admin pickup windows lookup payload", async () => {
    jest.spyOn(DeliveryHubService.prototype, "listAdminPickupWindows").mockResolvedValue({
      ok: true,
      connection: {
        id: "conn_1",
        provider_code: "yandex",
        name: "Yandex test",
        status: "active",
        mode: "test",
        enabled: true,
        country_code: "RU",
        credentials_state: "sealed",
        credentials_fingerprint: "fingerprint",
        credentials_last_validated_at: null,
        credentials_last_error_code: null,
        credentials_present: true,
        config: {},
        metadata: {},
        created_at: "2026-04-20T00:00:00.000Z",
        updated_at: "2026-04-20T00:00:00.000Z",
      },
      warehouse_id: "wh_1",
      destination_point_id: "pvz_1",
      windows: [
        {
          date: "2026-04-28",
          time_from: "10:00",
          time_to: "14:00",
          interval_utc: {
            from: "2026-04-28T07:00:00.000Z",
            to: "2026-04-28T11:00:00.000Z",
          },
          label: "2026-04-28 10:00-14:00",
        },
      ],
      limit: 20,
      total_available: 1,
      returned_count: 1,
      truncated: false,
      correlation_id: "corr-pickup-windows",
    } as any)

    const res = createMockResponse()

    await deliveryPickupWindowsRoute.GET(
      createMockRequest({
        url: "/admin/delivery/pickup-windows?connection_id=conn_1&warehouse_id=wh_1&destination_point_id=pvz_1",
        validatedQuery: {
          connection_id: "conn_1",
          warehouse_id: "wh_1",
          destination_point_id: "pvz_1",
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      returned_count: 1,
      windows: [
        {
          date: "2026-04-28",
          time_from: "10:00",
          time_to: "14:00",
          interval_utc: {
            from: "2026-04-28T07:00:00.000Z",
            to: "2026-04-28T11:00:00.000Z",
          },
          label: "2026-04-28 10:00-14:00",
        },
      ],
    }))
  })

  it("rejects admin pickup windows lookup payloads with raw provider fragments", async () => {
    jest.spyOn(DeliveryHubService.prototype, "listAdminPickupWindows").mockResolvedValue({
      ok: true,
      connection: {
        id: "conn_1",
        provider_code: "yandex",
        name: "Yandex test",
        status: "active",
        mode: "test",
        enabled: true,
        country_code: "RU",
        credentials_state: "sealed",
        credentials_fingerprint: "fingerprint",
        credentials_last_validated_at: null,
        credentials_last_error_code: null,
        credentials_present: true,
        config: {},
        metadata: {},
        created_at: "2026-04-20T00:00:00.000Z",
        updated_at: "2026-04-20T00:00:00.000Z",
      },
      warehouse_id: "wh_1",
      destination_point_id: "pvz_1",
      windows: [
        {
          date: "2026-04-28",
          time_from: "10:00",
          time_to: "14:00",
          interval_utc: {
            from: "2026-04-28T07:00:00.000Z",
            to: "2026-04-28T11:00:00.000Z",
          },
          label: "2026-04-28 10:00-14:00",
          raw_response: { token: "secret" },
        },
      ],
      limit: 20,
      total_available: 1,
      returned_count: 1,
      truncated: false,
      correlation_id: "corr-pickup-windows",
    } as any)

    const res = createMockResponse()

    await deliveryPickupWindowsRoute.GET(
      createMockRequest({
        url: "/admin/delivery/pickup-windows?connection_id=conn_1&warehouse_id=wh_1",
        validatedQuery: {
          connection_id: "conn_1",
          warehouse_id: "wh_1",
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(500)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.error.code).toBe("DELIVERY_HUB_UNEXPECTED_ERROR")
    expect(payload.error.message).toContain("raw_response")
  })

  it("redacts secret-like quote raw references and preserves structured quote diagnostics", async () => {
    jest.spyOn(DeliveryHubService.prototype, "testQuote").mockResolvedValue({
      ok: true,
      connection: {
        id: "conn_1",
        provider_code: "yandex",
        name: "Yandex test",
        status: "active",
        mode: "test",
        enabled: true,
        country_code: "RU",
        credentials_state: "sealed",
        credentials_fingerprint: "fingerprint",
        credentials_last_validated_at: null,
        credentials_last_error_code: null,
        credentials_present: true,
        config: {},
        metadata: {},
        created_at: "2026-04-20T00:00:00.000Z",
        updated_at: "2026-04-20T00:00:00.000Z",
      },
      quotes: [
        {
          quote_key: "quote_1",
          raw_reference: { authorization: "Bearer leaked-token" },
        },
      ],
      correlation_id: "corr-test-quote",
      input_echo: {
        connection_id: "conn_1",
        mode_code: "warehouse_to_pickup_point",
        destination_point_id: "pvz_1",
        origin_point_id: null,
        warehouse_id: "wh_1",
        interval_utc: null,
        currency_code: "RUB",
        item_count: 0,
      },
      diagnostics_summary: {
        status: "ok",
        provider_status: null,
        error_category: null,
        message: null,
        correlation_id: "corr-test-quote",
        checked_at: "2026-04-21T10:00:00.000Z",
        redacted: true,
      },
    } as any)

    const res = createMockResponse()

    await deliveryTestQuoteRoute.POST(
      createMockRequest({
        url: "/admin/delivery/test-quote",
        validatedBody: {
          connection_id: "conn_1",
          mode_code: "warehouse_to_pickup_point",
          warehouse_id: "wh_1",
          destination_point_id: "pvz_1",
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      input_echo: expect.objectContaining({ mode_code: "warehouse_to_pickup_point" }),
      diagnostics_summary: expect.objectContaining({ status: "ok", redacted: true }),
      quotes: [
        expect.objectContaining({
          raw_reference: { authorization: "***" },
        }),
      ],
    }))
  })

  it("returns warehouse list payload for admin delivery warehouses GET", async () => {
    const warehouses = [
      {
        id: "wh_1",
        name: "Main warehouse",
        enabled: true,
        country_code: "RU",
        city: "Moscow",
        address_line_1: "Tverskaya 1",
        contact_name: "Ops",
        contact_phone: "+79990000000",
        provider_code: "yandex",
        provider_warehouse_id: "ya-wh-1",
        metadata: {},
        created_at: "2026-04-20T00:00:00.000Z",
        updated_at: "2026-04-20T00:00:00.000Z",
      },
    ]

    jest
      .spyOn(DeliveryHubService.prototype, "listWarehouses")
      .mockResolvedValue(warehouses as any)

    const res = createMockResponse()

    await deliveryWarehousesRoute.GET(createMockRequest() as any, res as any)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      warehouses,
    })
  })

  it("rejects polluted warehouse list responses before they cross the boundary", async () => {
    jest.spyOn(DeliveryHubService.prototype, "listWarehouses").mockResolvedValue([
      {
        id: "wh_1",
        name: "Main warehouse",
        enabled: true,
        country_code: "RU",
        city: "Moscow",
        address_line_1: "Tverskaya 1",
        contact_name: "Ops",
        contact_phone: "+79990000000",
        provider_code: "yandex",
        provider_warehouse_id: "ya-wh-1",
        metadata: {},
        secret_token: "leaked-token",
        created_at: "2026-04-20T00:00:00.000Z",
        updated_at: "2026-04-20T00:00:00.000Z",
      },
    ] as any)

    const res = createMockResponse()

    await deliveryWarehousesRoute.GET(createMockRequest() as any, res as any)

    expect(res.status).toHaveBeenCalledWith(500)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.error.code).toBe("DELIVERY_HUB_UNEXPECTED_ERROR")
    expect(payload.error.message).toContain("secret_token")
  })

  it("creates warehouse and returns admin contract payload", async () => {
    const body = {
      name: "Main warehouse",
      enabled: true,
      country_code: "RU",
      city: "Moscow",
      address_line_1: "Tverskaya 1",
      provider_code: "yandex",
      provider_warehouse_id: "ya-wh-1",
    }
    const warehouse = {
      id: "wh_1",
      ...body,
      contact_name: null,
      contact_phone: null,
      metadata: {},
      created_at: "2026-04-20T00:00:00.000Z",
      updated_at: "2026-04-20T00:00:00.000Z",
    }

    const createSpy = jest
      .spyOn(DeliveryHubService.prototype, "createWarehouse")
      .mockResolvedValue(warehouse as any)

    const res = createMockResponse()

    await deliveryWarehousesRoute.POST(
      createMockRequest({ validatedBody: body }) as any,
      res as any
    )

    expect(createSpy).toHaveBeenCalledWith(body)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      warehouse,
    })
  })

  it("rejects polluted warehouse create responses before they cross the boundary", async () => {
    jest.spyOn(DeliveryHubService.prototype, "createWarehouse").mockResolvedValue({
      id: "wh_1",
      name: "Main warehouse",
      enabled: true,
      country_code: "RU",
      city: "Moscow",
      address_line_1: "Tverskaya 1",
      contact_name: null,
      contact_phone: null,
      provider_code: "yandex",
      provider_warehouse_id: "ya-wh-1",
      metadata: {},
      secret_token: "leaked-token",
      created_at: "2026-04-20T00:00:00.000Z",
      updated_at: "2026-04-20T00:00:00.000Z",
    } as any)

    const res = createMockResponse()

    await deliveryWarehousesRoute.POST(
      createMockRequest({
        validatedBody: {
          name: "Main warehouse",
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(500)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.error.code).toBe("DELIVERY_HUB_UNEXPECTED_ERROR")
    expect(payload.error.message).toContain("secret_token")
  })

  it("updates warehouse using route id", async () => {
    const body = {
      name: "Updated warehouse",
      provider_warehouse_id: "ya-wh-2",
    }
    const warehouse = {
      id: "wh_1",
      name: "Updated warehouse",
      enabled: true,
      country_code: "RU",
      city: "Moscow",
      address_line_1: "Tverskaya 2",
      contact_name: null,
      contact_phone: null,
      provider_code: "yandex",
      provider_warehouse_id: "ya-wh-2",
      metadata: {},
      created_at: "2026-04-20T00:00:00.000Z",
      updated_at: "2026-04-20T00:00:00.000Z",
    }

    const updateSpy = jest
      .spyOn(DeliveryHubService.prototype, "updateWarehouse")
      .mockResolvedValue(warehouse as any)

    const res = createMockResponse()

    await deliveryWarehouseRoute.PUT(
      createMockRequest({
        url: "/admin/delivery/warehouses/wh_1",
        validatedBody: body,
      }) as any,
      res as any
    )

    expect(updateSpy).toHaveBeenCalledWith("wh_1", body)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      warehouse,
    })
  })

  it("deletes warehouse through admin route", async () => {
    const warehouse = {
      id: "wh_1",
      name: "Warehouse",
      enabled: true,
      country_code: "RU",
      city: "Москва",
      address_line_1: "Льва Толстого, 16",
      contact_name: null,
      contact_phone: null,
      provider_code: "yandex",
      provider_warehouse_id: null,
      metadata: {
        coordinates: [37.588144, 55.733842],
      },
      created_at: "2026-04-20T00:00:00.000Z",
      updated_at: "2026-04-20T00:00:00.000Z",
    }
    const deleteSpy = jest
      .spyOn(DeliveryHubService.prototype, "deleteWarehouse")
      .mockResolvedValue({ deleted: true, warehouse } as any)

    const res = createMockResponse()

    await deliveryWarehouseRoute.DELETE(
      createMockRequest({
        url: "/admin/delivery/warehouses/wh_1",
      }) as any,
      res as any
    )

    expect(deleteSpy).toHaveBeenCalledWith("wh_1")
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      deleted: true,
      warehouse,
    })
  })

  it("rejects polluted warehouse update responses before they cross the boundary", async () => {
    jest.spyOn(DeliveryHubService.prototype, "updateWarehouse").mockResolvedValue({
      id: "wh_1",
      name: "Updated warehouse",
      enabled: true,
      country_code: "RU",
      city: "Moscow",
      address_line_1: "Tverskaya 2",
      contact_name: null,
      contact_phone: null,
      provider_code: "yandex",
      provider_warehouse_id: "ya-wh-2",
      metadata: {},
      provider_secret: "leaked-secret",
      created_at: "2026-04-20T00:00:00.000Z",
      updated_at: "2026-04-20T00:00:00.000Z",
    } as any)

    const res = createMockResponse()

    await deliveryWarehouseRoute.PUT(
      createMockRequest({
        url: "/admin/delivery/warehouses/wh_1",
        validatedBody: {
          name: "Updated warehouse",
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(500)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.error.code).toBe("DELIVERY_HUB_UNEXPECTED_ERROR")
    expect(payload.error.message).toContain("provider_secret")
  })

  it("returns admin delivery logs list payload", async () => {
    const logs = [
      {
        id: "log_1",
        connection_id: "conn_1",
        provider_code: "yandex",
        kind: "connection_test",
        correlation_id: "corr-log-1",
        success: true,
        request_summary: {
          include_pickup_points: true,
        },
        response_summary: {
          pickup_points_count: 3,
        },
        error_code: null,
        created_at: "2026-04-20T00:00:00.000Z",
      },
    ]

    const listLogsSpy = jest
      .spyOn(DeliveryHubService.prototype, "listEventLogs")
      .mockResolvedValue(logs as any)

    const res = createMockResponse()

    await deliveryLogsRoute.GET(
      createMockRequest({
        url: "/admin/delivery/logs?provider_code=yandex&limit=20",
        validatedQuery: {
          provider_code: "yandex",
          limit: 20,
        },
      }) as any,
      res as any
    )

    expect(listLogsSpy).toHaveBeenCalledWith({
      provider_code: "yandex",
      limit: 20,
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      logs,
    })
  })

  it("redacts secret-like admin delivery log summaries at the response boundary", async () => {
    jest.spyOn(DeliveryHubService.prototype, "listEventLogs").mockResolvedValue([
      {
        id: "log_1",
        connection_id: "conn_1",
        provider_code: "yandex",
        kind: "connection_test",
        correlation_id: "corr-log-1",
        success: false,
        request_summary: {
          headers: {
            Authorization: "Bearer leaked-token",
          },
        },
        response_summary: {
          body: '{"refresh_token":"leaked-token"}',
        },
        error_code: "DELIVERY_HUB_PROVIDER_ERROR",
        created_at: "2026-04-20T00:00:00.000Z",
      },
    ] as any)

    const res = createMockResponse()

    await deliveryLogsRoute.GET(
      createMockRequest({
        url: "/admin/delivery/logs?provider_code=yandex&limit=20",
        validatedQuery: {
          provider_code: "yandex",
          limit: 20,
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      logs: [
        {
          id: "log_1",
          connection_id: "conn_1",
          provider_code: "yandex",
          kind: "connection_test",
          correlation_id: "corr-log-1",
          success: false,
          request_summary: {
            headers: {
              Authorization: "***",
            },
          },
          response_summary: {
            body: '{"refresh_token":"***"}',
          },
          error_code: "DELIVERY_HUB_PROVIDER_ERROR",
          created_at: "2026-04-20T00:00:00.000Z",
        },
      ],
    })
  })

  it("returns shipping-option preview payload for admin read-only preview route", async () => {
    const currentOptions = [
      {
        id: "so_deliveryhub_existing",
        name: "Delivery Hub Pickup",
        provider_id: "deliveryhub_deliveryhub",
        data: {
          version: 1,
          provider_code: "deliveryhub",
          provider_id: "deliveryhub_deliveryhub",
          id: "deliveryhub:warehouse_to_pickup_point",
          mode_code: "warehouse_to_pickup_point",
        },
      },
    ]
    const preview = {
      provider_code: "deliveryhub",
      provider_id: "deliveryhub_deliveryhub",
      current_options: currentOptions,
      plan: {
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
        desired_options: [],
        deferred_options: [],
        connection_plans: [],
      },
      reconciliation: {
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
        create_candidates: [],
        update_candidates: [],
        unchanged: [],
        orphaned_managed_options: [],
        ignored_foreign_options: [],
      },
      summary: {
        current_option_count: 1,
        desired_option_count: 0,
        deferred_option_count: 0,
        deferred_issue_count: 0,
        connection_plan_count: 0,
        create_candidate_count: 0,
        update_candidate_count: 0,
        unchanged_count: 0,
        orphaned_managed_option_count: 0,
        ignored_foreign_option_count: 0,
      },
    }

    const buildPreviewSpy = jest
      .spyOn(DeliveryHubService.prototype, "buildShippingOptionPreview")
      .mockResolvedValue(preview as any)

    const res = createMockResponse()
    const req = createMockRequest({
      url: "/admin/delivery/shipping-options/preview",
      scope: {
        resolve: jest.fn((key: string) => {
          if (key === ContainerRegistrationKeys.QUERY) {
            return {
              graph: jest.fn().mockImplementation(async () => ({
                data: currentOptions,
              })),
            }
          }

          return { raw: jest.fn() }
        }),
      },
    })

    await deliveryShippingOptionsPreviewRoute.GET(req as any, res as any)

    expect(buildPreviewSpy).toHaveBeenCalledWith(currentOptions)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      preview,
    })
  })

  it("rejects polluted shipping-option preview responses before they cross the boundary", async () => {
    const currentOptions = [
      {
        id: "so_deliveryhub_existing",
        name: "Delivery Hub Pickup",
        provider_id: "deliveryhub_deliveryhub",
        data: {
          version: 1,
          provider_code: "deliveryhub",
          provider_id: "deliveryhub_deliveryhub",
          id: "deliveryhub:warehouse_to_pickup_point",
          mode_code: "warehouse_to_pickup_point",
        },
      },
    ]

    jest.spyOn(DeliveryHubService.prototype, "buildShippingOptionPreview").mockResolvedValue({
      provider_code: "deliveryhub",
      provider_id: "deliveryhub_deliveryhub",
      current_options: [
        {
          ...currentOptions[0],
          provider_secret: "leaked-secret",
        },
      ],
      plan: {
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
        desired_options: [],
        deferred_options: [],
        connection_plans: [],
      },
      reconciliation: {
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
        create_candidates: [],
        update_candidates: [],
        unchanged: [],
        orphaned_managed_options: [],
        ignored_foreign_options: [],
      },
      summary: {
        current_option_count: 1,
        desired_option_count: 0,
        deferred_option_count: 0,
        deferred_issue_count: 0,
        connection_plan_count: 0,
        create_candidate_count: 0,
        update_candidate_count: 0,
        unchanged_count: 0,
        orphaned_managed_option_count: 0,
        ignored_foreign_option_count: 0,
      },
    } as any)

    const res = createMockResponse()
    const req = createMockRequest({
      url: "/admin/delivery/shipping-options/preview",
      scope: {
        resolve: jest.fn((key: string) => {
          if (key === ContainerRegistrationKeys.QUERY) {
            return {
              graph: jest.fn().mockImplementation(async () => ({
                data: currentOptions,
              })),
            }
          }

          return { raw: jest.fn() }
        }),
      },
    })

    await deliveryShippingOptionsPreviewRoute.GET(req as any, res as any)

    expect(res.status).toHaveBeenCalledWith(500)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.error.code).toBe("DELIVERY_HUB_UNEXPECTED_ERROR")
    expect(payload.error.message).toContain("provider_secret")
  })

  it("returns fulfillment bridge readiness preview payload", async () => {
    const currentOptions = [
      {
        id: "so_deliveryhub_existing",
        name: "Delivery Hub Pickup",
        provider_id: "deliveryhub_deliveryhub",
        data: {
          version: 1,
          provider_code: "deliveryhub",
          provider_id: "deliveryhub_deliveryhub",
          id: "deliveryhub:warehouse_to_pickup_point",
          mode_code: "warehouse_to_pickup_point",
        },
      },
    ]
    const preview = {
      provider_code: "deliveryhub",
      provider_id: "deliveryhub_deliveryhub",
      shipping_option_preview: {
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
        current_options: currentOptions,
        plan: {
          provider_code: "deliveryhub",
          provider_id: "deliveryhub_deliveryhub",
          desired_options: [],
          deferred_options: [],
          connection_plans: [],
        },
        reconciliation: {
          provider_code: "deliveryhub",
          provider_id: "deliveryhub_deliveryhub",
          create_candidates: [],
          update_candidates: [],
          unchanged: [],
          orphaned_managed_options: [],
          ignored_foreign_options: [],
        },
        summary: {
          current_option_count: 1,
          desired_option_count: 0,
          deferred_option_count: 0,
          deferred_issue_count: 0,
          connection_plan_count: 0,
          create_candidate_count: 0,
          update_candidate_count: 0,
          unchanged_count: 0,
          orphaned_managed_option_count: 0,
          ignored_foreign_option_count: 0,
        },
      },
      bridge_preview: {
        version: 1,
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
        mode_previews: [
          {
            mode_code: "warehouse_to_pickup_point",
            status: "ready",
            rollout_status: "projected",
            supporting_connection_ids: ["conn_ready"],
            blocking_issues: [],
            steps: [
              {
                key: "shipping_option_contract",
                ready: true,
                message: "Contract materialized",
              },
            ],
            selection: {
              version: 1,
              connection_id: "conn_ready",
              quote_type: "warehouse_to_pickup_point",
              quote_reference: {
                id: "ref_1",
                version: 1,
                internal_secret: "should-not-cross",
              },
              quote: {
                carrier_code: "deliveryhub_preview",
                carrier_label: "Delivery Hub Preview",
                amount: 499,
                currency_code: "RUB",
                delivery_eta_min: 1,
                delivery_eta_max: 2,
                pickup_point_required: true,
                pickup_window_required: true,
                internal_note: "strip-me",
              },
              pickup_point: {
                provider_point_id: "pvz_1",
                provider_point_code: "token=abc123",
                name: "PVZ 1",
                address: "Authorization: Bearer bridge-secret",
                city: "Moscow",
                region: "Moscow",
                postal_code: "101000",
                lat: 55.75,
                lng: 37.61,
                is_origin_dropoff_allowed: false,
                is_destination_pickup_allowed: true,
                payment_methods: ["card"],
                internal_fragment: {
                  keep_out: true,
                },
              },
              pickup_window: {
                date: "2026-04-22",
                time_from: "10:00",
                time_to: "14:00",
                interval_utc: {
                  from: "2026-04-22T07:00:00.000Z",
                  to: "2026-04-22T11:00:00.000Z",
                  token: "nested-secret",
                },
                label: "Authorization: Bearer nested-window-secret",
              },
              updated_at: "2026-04-22T04:00:00.000Z",
              internal_extra: true,
            },
            shipping_option_data: {
              version: 1,
              provider_code: "deliveryhub",
              provider_id: "deliveryhub_deliveryhub",
              id: "deliveryhub:warehouse_to_pickup_point",
              mode_code: "warehouse_to_pickup_point",
              internal_flag: true,
            },
            fulfillment_payload: {
              version: 1,
              option: {
                version: 1,
                provider_code: "deliveryhub",
                provider_id: "deliveryhub_deliveryhub",
                id: "deliveryhub:warehouse_to_pickup_point",
                mode_code: "warehouse_to_pickup_point",
                secret: "keep-out",
              },
              fulfillment_data: {
                version: 1,
                connection_id: "conn_ready",
                mode_code: "warehouse_to_pickup_point",
                quote_reference: {
                  id: "ref_1",
                  version: 1,
                },
                quote: {
                  carrier_code: "deliveryhub_preview",
                  carrier_label: "Delivery Hub Preview",
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
                  label: "Window label",
                },
                internal_fragment: "strip-me",
              },
              calculated_price_data: {
                version: 1,
                provider_code: "deliveryhub",
                connection_id: "conn_ready",
                mode_code: "warehouse_to_pickup_point",
                quote_reference: {
                  id: "ref_1",
                  version: 1,
                },
                quote: {
                  carrier_code: "deliveryhub_preview",
                  carrier_label: "Delivery Hub Preview",
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
                  label: "Window label",
                },
                debug_fragment: {
                  should_not_cross: true,
                },
              },
              hidden_payload: {
                should_not_cross: true,
              },
            },
            create_fulfillment_payload: {
              version: 1,
              delivery: {
                version: 1,
                option: {
                  version: 1,
                  provider_code: "deliveryhub",
                  provider_id: "deliveryhub_deliveryhub",
                  id: "deliveryhub:warehouse_to_pickup_point",
                  mode_code: "warehouse_to_pickup_point",
                },
                fulfillment_data: {
                  version: 1,
                  connection_id: "conn_ready",
                  mode_code: "warehouse_to_pickup_point",
                  quote_reference: {
                    id: "ref_1",
                    version: 1,
                  },
                  quote: {
                    carrier_code: "deliveryhub_preview",
                    carrier_label: "Delivery Hub Preview",
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
                    label: "Window label",
                  },
                },
                calculated_price_data: {
                  version: 1,
                  provider_code: "deliveryhub",
                  connection_id: "conn_ready",
                  mode_code: "warehouse_to_pickup_point",
                  quote_reference: {
                    id: "ref_1",
                    version: 1,
                  },
                  quote: {
                    carrier_code: "deliveryhub_preview",
                    carrier_label: "Delivery Hub Preview",
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
                    label: "Window label",
                  },
                },
              },
              order: {
                id: null,
                display_id: "Authorization: Bearer order-secret",
                currency_code: "RUB",
                internal: true,
              },
              fulfillment: {
                id: null,
                location_id: null,
                extra: "strip-me",
              },
              items: [
                {
                  line_item_id: "item_1",
                  quantity: 1,
                  debug: true,
                },
              ],
              execution_secret: "strip-me",
            },
            shipment_execution: {
              materialized: false,
              reason: "Authorization: Bearer hidden-shipment-token is intentionally disabled",
            },
            error: null,
          },
        ],
        summary: {
          mode_count: 1,
          ready_mode_count: 1,
          error_mode_count: 0,
          projected_mode_count: 1,
          deferred_mode_count: 0,
        },
      },
      summary: {
        mode_count: 1,
        ready_mode_count: 1,
        error_mode_count: 0,
        projected_mode_count: 1,
        deferred_mode_count: 0,
      },
    }

    const buildPreviewSpy = jest
      .spyOn(DeliveryHubService.prototype, "buildFulfillmentBridgeReadinessPreview")
      .mockResolvedValue(preview as any)

    const res = createMockResponse()
    const req = createMockRequest({
      url: "/admin/delivery/fulfillment-bridge/preview",
      scope: {
        resolve: jest.fn((key: string) => {
          if (key === ContainerRegistrationKeys.QUERY) {
            return {
              graph: jest.fn().mockImplementation(async () => ({
                data: currentOptions,
              })),
            }
          }

          return { raw: jest.fn() }
        }),
      },
    })

    await deliveryFulfillmentBridgePreviewRoute.GET(req as any, res as any)

    expect(buildPreviewSpy).toHaveBeenCalledWith(currentOptions)
    expect(res.status).toHaveBeenCalledWith(200)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.ok).toBe(true)
    expect(payload.preview.bridge_preview.mode_previews[0]).toEqual({
      mode_code: "warehouse_to_pickup_point",
      status: "ready",
      rollout_status: "projected",
      supporting_connection_ids: ["conn_ready"],
      blocking_issues: [],
      steps: [
        {
          key: "shipping_option_contract",
          ready: true,
          message: "Contract materialized",
        },
      ],
      selection: {
        version: 1,
        connection_id: "conn_ready",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "ref_1",
          version: 1,
        },
        quote: {
          carrier_code: "deliveryhub_preview",
          carrier_label: "Delivery Hub Preview",
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: true,
        },
        pickup_point: {
          provider_point_id: "pvz_1",
          provider_point_code: "token=***",
          name: "PVZ 1",
          address: "Authorization: Bearer ***",
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
          label: "Authorization: Bearer ***",
        },
        updated_at: "2026-04-22T04:00:00.000Z",
      },
      shipping_option_data: {
        version: 1,
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
        id: "deliveryhub:warehouse_to_pickup_point",
        mode_code: "warehouse_to_pickup_point",
      },
      fulfillment_payload: {
        version: 1,
        option: {
          version: 1,
          provider_code: "deliveryhub",
          provider_id: "deliveryhub_deliveryhub",
          id: "deliveryhub:warehouse_to_pickup_point",
          mode_code: "warehouse_to_pickup_point",
        },
        fulfillment_data: {
          version: 1,
          connection_id: "conn_ready",
          mode_code: "warehouse_to_pickup_point",
          quote_reference: {
            id: "ref_1",
            version: 1,
          },
          quote: {
            carrier_code: "deliveryhub_preview",
            carrier_label: "Delivery Hub Preview",
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
            label: "Window label",
          },
        },
        calculated_price_data: {
          version: 1,
          provider_code: "deliveryhub",
          connection_id: "conn_ready",
          mode_code: "warehouse_to_pickup_point",
          quote_reference: {
            id: "ref_1",
            version: 1,
          },
          quote: {
            carrier_code: "deliveryhub_preview",
            carrier_label: "Delivery Hub Preview",
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
            label: "Window label",
          },
        },
      },
      create_fulfillment_payload: {
        version: 1,
        delivery: {
          version: 1,
          option: {
            version: 1,
            provider_code: "deliveryhub",
            provider_id: "deliveryhub_deliveryhub",
            id: "deliveryhub:warehouse_to_pickup_point",
            mode_code: "warehouse_to_pickup_point",
          },
          fulfillment_data: {
            version: 1,
            connection_id: "conn_ready",
            mode_code: "warehouse_to_pickup_point",
            quote_reference: {
              id: "ref_1",
              version: 1,
            },
            quote: {
              carrier_code: "deliveryhub_preview",
              carrier_label: "Delivery Hub Preview",
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
              label: "Window label",
            },
          },
          calculated_price_data: {
            version: 1,
            provider_code: "deliveryhub",
            connection_id: "conn_ready",
            mode_code: "warehouse_to_pickup_point",
            quote_reference: {
              id: "ref_1",
              version: 1,
            },
            quote: {
              carrier_code: "deliveryhub_preview",
              carrier_label: "Delivery Hub Preview",
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
              label: "Window label",
            },
          },
        },
        order: {
          id: null,
          display_id: "Authorization: Bearer ***",
          currency_code: "RUB",
        },
        fulfillment: {
          id: null,
          location_id: null,
        },
        items: [
          {
            line_item_id: "item_1",
            quantity: 1,
          },
        ],
      },
      shipment_execution: {
        materialized: false,
        reason: "Authorization: Bearer *** is intentionally disabled",
      },
      error: null,
    })
  })

  it("returns admin execution-plan observability payload and redacts internal fragments", async () => {
    const currentOptions = [{ id: "so_1", provider_id: "manual", data: { id: "foreign:option" } }]
    const preview = {
      provider_code: "deliveryhub",
      provider_id: "deliveryhub_deliveryhub",
      shipping_option_preview: {
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
        current_options: [],
        plan: {
          provider_code: "deliveryhub",
          provider_id: "deliveryhub_deliveryhub",
          desired_options: [],
          deferred_options: [],
          connection_plans: [],
        },
        reconciliation: {
          provider_code: "deliveryhub",
          provider_id: "deliveryhub_deliveryhub",
          create_candidates: [],
          update_candidates: [],
          unchanged: [],
          orphaned_managed_options: [],
          ignored_foreign_options: [],
        },
        summary: {
          current_option_count: 0,
          desired_option_count: 0,
          deferred_option_count: 0,
          deferred_issue_count: 0,
          connection_plan_count: 0,
          create_candidate_count: 0,
          update_candidate_count: 0,
          unchanged_count: 0,
          orphaned_managed_option_count: 0,
          ignored_foreign_option_count: 0,
        },
      },
      execution_plan_preview: {
        version: 1,
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
        mode_previews: [
          {
            mode_code: "warehouse_to_pickup_point",
            status: "ready",
            rollout_status: "projected",
            supporting_connection_ids: ["conn_ready"],
            blocking_issues: [],
            readiness_verdict: {
              status: "ready",
              blocked_reasons: [],
            },
            blocked_reasons: ["Authorization: Bearer hidden-shipment-token is intentionally disabled"],
            issues: [
              {
                code: "DELIVERY_HUB_SHAPE_DRIFT",
                message: "Authorization: Bearer hidden-issue-token",
                field_path: "fulfillment_data.internal_secret",
                extra: true,
              },
            ],
            repository_assembly_summary: {
              version: 1,
              mode: "assembly_plan_only",
              repository_status: "pg_repository_implementation_available",
              table_name: "deliveryhub_execution_ledger",
              persistence_readiness_contour: {
                stages: [
                  "artifact_defined",
                  "manual_application_external",
                  "snapshot_verification_available",
                  "activation_blocked",
                ],
                current_stage: "activation_blocked",
                review_preparation_available_now: [
                  "descriptor_bundle_defined",
                  "migration_artifact_reviewable",
                  "snapshot_schema_verifier_available",
                  "snapshot_schema_check_plan_available",
                ],
                external_manual_application_remaining: [
                  "manual_migration_review",
                  "manual_table_creation_or_migration_execution",
                  "manual_schema_snapshot_capture",
                ],
                activation_blocked_until: [
                  "migration_or_table_creation",
                  "transaction_runner",
                  "explicit_runtime_wiring",
                  "operational_runbook",
                  "safety_review",
                ],
              },
              missing_activation_prerequisites: [
                "migration_or_table_creation",
                "transaction_runner",
                "explicit_runtime_wiring",
                "operational_runbook",
                "safety_review",
              ],
              disabled_confirmations: {
                query_execution: false,
                transaction_execution: false,
                transaction_open: false,
                transaction_commit: false,
                transaction_rollback: false,
                production_writes: false,
                runtime_wiring: false,
                live_execution: false,
                provider_dispatch: false,
                shipment_creation: false,
                label_or_document_generation: false,
                order_or_fulfillment_mutation: false,
                retry_scheduling: false,
                compensation_or_rollback_writes: false,
                checkout_or_storefront_cutover: false,
                connection_factory_invocation: false,
                migration_or_table_creation: false,
              },
            },
            steps: [
              {
                key: "provider_execution_plan",
                ready: true,
                message: "Authorization: Bearer hidden-plan-token is ready",
              },
              {
                key: "execution_identity",
                ready: true,
                message: "Authorization: Bearer hidden-identity-token is ready",
              },
              {
                key: "persistence_audit_preview",
                ready: true,
                message: "Authorization: Bearer hidden-persistence-token is ready",
              },
              {
                key: "preflight_eligibility",
                ready: true,
                message: "Authorization: Bearer hidden-gate-step-token is ready",
              },
            ],
            execution_plan: {
              version: 1,
              operation: "create_shipment",
              connection_id: "conn_ready",
              mode_code: "warehouse_to_pickup_point",
              quote_reference: {
                id: "ref_1",
                version: 1,
              },
              order: {
                id: null,
                display_id: "Authorization: Bearer order-secret",
                currency_code: "RUB",
                internal: true,
              },
              fulfillment: {
                id: null,
                location_id: null,
                extra: true,
              },
              items: [
                {
                  line_item_id: "item_1",
                  quantity: 1,
                  debug: true,
                },
              ],
              outbound_request: {
                method: "POST",
                path: "/shipments",
                headers: {
                  authorization: "Bearer hidden-provider-token",
                  "content-type": "application/json",
                  debug: true,
                },
              },
            },
            execution_identity: {
              version: 1,
              redacted: true,
              operation: "create_shipment",
              provider_operation_label: "Authorization: Bearer hidden-op-label",
              provider_operation_reference: "Authorization: Bearer hidden-op-reference",
              plan_fingerprint: "Authorization: Bearer hidden-plan-fingerprint",
              execution_fingerprint: "Authorization: Bearer hidden-execution-fingerprint",
              idempotency_key_preview: "Authorization: Bearer hidden-idempotency-key",
              debug: true,
            },
            outbound_payload_preview: {
              redacted: true,
              request: {
                headers: {
                  authorization: "Bearer hidden-provider-token",
                  "content-type": "application/json",
                },
                body: {
                  token: "hidden-body-token",
                },
              },
            },
            persistence_audit_preview: {
              version: 1,
              redacted: true,
              status: "ready",
              metadata_patch: {
                target: "fulfillment_execution_shadow",
                action: "merge",
                fields: [
                  {
                    field: "execution_reference",
                    value_preview: "Authorization: Bearer hidden-metadata-token",
                    extra: true,
                  },
                ],
              },
              execution_record: {
                ready: true,
                record_type: "deliveryhub_shipment_execution",
                operation: "create_shipment",
                provider_code: "deliveryhub",
                provider_id: "deliveryhub_deliveryhub",
                connection_id: "conn_ready",
                mode_code: "warehouse_to_pickup_point",
                execution_reference: "Authorization: Bearer hidden-record-token",
                idempotency_key_preview: "Authorization: Bearer hidden-idempotency-token",
                initial_status: "planned",
                debug: true,
              },
              idempotency_reservation: {
                ready: true,
                dedupe_scope: "deliveryhub:create_shipment",
                reservation_key_preview: "Authorization: Bearer hidden-reservation-token",
                reservation_fingerprint: "Authorization: Bearer hidden-reservation-fingerprint",
                matched_fields: [
                  {
                    field: "execution_fingerprint",
                    value_preview: "Authorization: Bearer hidden-match-token",
                  },
                ],
              },
              status_transitions: [
                {
                  from: "planned",
                  to: "persisted",
                  reason: "Authorization: Bearer hidden-transition-token",
                  debug: true,
                },
              ],
              audit_log_entries: [
                {
                  version: 1,
                  event_type: "Authorization: Bearer hidden-audit-event",
                  execution_reference: "Authorization: Bearer hidden-audit-reference",
                  current_state: "Authorization: Bearer hidden-audit-state",
                  summary: "Authorization: Bearer hidden-audit-token",
                  correlation: {
                    connection_id: "Authorization: Bearer hidden-correlation-token",
                    quote_reference_id: "ref_1",
                    display_id: 1,
                    fulfillment_id: null,
                    extra: { nope: true },
                  },
                  identity: {
                    execution_fingerprint: "Authorization: Bearer hidden-identity-token",
                    reservation_fingerprint: "Authorization: Bearer hidden-reservation-audit-token",
                  },
                  debug: true,
                },
              ],
              blocked: [
                {
                  key: "provider_dispatch",
                  reason: "Authorization: Bearer hidden-blocked-token",
                },
              ],
              deferred: [
                {
                  key: "audit_log_commit",
                  reason: "Authorization: Bearer hidden-deferred-token",
                },
              ],
            },
            preflight_eligibility: {
              version: 1,
              redacted: true,
              current_mode: "preview_only",
              decision: "eligible_when_enabled",
              real_execution_enabled: false,
              future_execution_flag: {
                name: "DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED",
                status: "future_inert_not_read",
                description: "Authorization: Bearer hidden-flag-token is future inert",
                token: "must-strip",
              },
              reasons: [
                {
                  code: "EXECUTION_PREVIEW_ONLY",
                  message: "Authorization: Bearer hidden-gate-token",
                  debug: true,
                },
              ],
              required_prerequisites: [
                {
                  code: "operator_approval",
                  label: "Authorization: Bearer hidden-approval-token",
                  status: "required_future_work",
                  debug: true,
                },
              ],
              confirmations: {
                shipment_execution_disabled: true,
                provider_calls_disabled: true,
                persistence_writes_disabled: true,
                checkout_cutover_disabled: true,
                internal: "strip",
              },
              blocked_live_actions: [
                {
                  code: "provider_create_shipment_call",
                  label: "Authorization: Bearer hidden-action-token",
                  blocked: true,
                  debug: true,
                },
              ],
              internal_secret: "must-strip",
            },
      provider_dispatch_preview: {
        version: 1,
        redacted: true,
        current_mode: "preview_only",
        dispatch_decision: "ready_for_future_dispatch",
        provider: {
          provider_code: "deliveryhub",
          provider_id: "deliveryhub_deliveryhub",
          provider_key: "deliveryhub",
          adapter_operation: "create_shipment",
          adapter_operation_label: "Authorization: Bearer hidden-dispatch-token",
          internal_secret: "must-strip",
        },
        command_identity: {
          provider_operation_reference: "Authorization: Bearer hidden-dispatch-token",
          idempotency_key_preview: "Authorization: Bearer hidden-idempotency-token",
          plan_fingerprint: "Authorization: Bearer hidden-plan-token",
          execution_fingerprint: "Authorization: Bearer hidden-execution-token",
          raw_payload: "must-strip",
        },
        command_envelope_summary: {
          connection_id_present: true,
          mode_code: "warehouse_to_pickup_point",
          origin_kind: "fulfillment_location",
          destination_kind: "pickup_point",
          quote_reference_present: true,
          offer_reference_present: true,
          package_reference_present: true,
          order_reference_present: true,
          fulfillment_reference_present: false,
          pickup_scheduling_reference_present: false,
          dropoff_scheduling_reference_present: false,
          item_count: 1,
          headers: { authorization: "must-strip" },
        },
        blocked_dispatch_actions: [
          {
            code: "adapter_invocation",
            label: "Authorization: Bearer hidden-action-token",
            reason: "Authorization: Bearer hidden-reason-token",
            blocked: true,
            token: "must-strip",
          },
        ],
        confirmations: {
          adapter_invocation_disabled: true,
          provider_network_calls_disabled: true,
          shipment_creation_disabled: true,
          label_creation_disabled: true,
          order_mutation_disabled: true,
          persistence_writes_disabled: true,
          checkout_cutover_disabled: true,
          internal: "must-strip",
        },
        raw_provider_payload: { token: "must-strip" },
      },
      shipment_result_preview: {
        version: 1,
        redacted: true,
        current_mode: "preview_only",
        result_decision: "projected_for_future_execution",
        projected_result_status: "projected_for_future_execution",
        result_kind: "shipment_result",
        normalization_target: "deliveryhub_shipment_result",
        provider_normalization_target: "create_shipment_response",
        identity_linkage: {
          provider_operation_reference: "Authorization: Bearer hidden-result-token",
          idempotency_key_preview: "Authorization: Bearer hidden-idempotency-token",
          plan_fingerprint: "Authorization: Bearer hidden-plan-token",
          execution_fingerprint: "Authorization: Bearer hidden-execution-token",
          internal: "must-strip",
        },
        artifact_summary: {
          external_shipment_reference_present: true,
          tracking_reference_present: true,
          label_document_present: true,
          pickup_booking_present: true,
          pickup_interval_present: true,
          status_timeline_present: true,
          failure_placeholder_present: true,
          rollback_placeholder_present: true,
          raw_document_base64: "must-strip",
        },
        blocked_materialization_actions: [
          {
            code: "provider_response_fetch",
            label: "Authorization: Bearer hidden-action-token",
            reason: "Authorization: Bearer hidden-reason-token",
            blocked: true,
            secret_token: "must-strip",
          },
        ],
        confirmations: {
          provider_response_fetch_disabled: true,
          adapter_invocation_disabled: true,
          shipment_creation_disabled: true,
          label_persistence_disabled: true,
          order_mutation_disabled: true,
          fulfillment_persistence_disabled: true,
          checkout_cutover_disabled: true,
          internal: "must-strip",
        },
        raw_provider_payload: { token: "must-strip" },
      },
      fulfillment_application_preview: {
        version: 1,
        redacted: true,
        current_mode: "preview_only",
        application_decision: "projected_for_future_application",
        projected_application_status: "projected_for_future_application",
        application_target: "medusa_fulfillment_mutation_plan",
        application_scope: "backend_admin_only",
        mutation_semantics: {
          fulfillment_data_patch_present: true,
          shipment_reference_linkage_present: true,
          tracking_projection_present: true,
          label_document_reference_linkage_present: true,
          status_transition_application_present: true,
          audit_linkage_present: true,
          internal: "must-strip",
        },
        identity_linkage: {
          provider_operation_reference: "Authorization: Bearer hidden-application-token",
          idempotency_key_preview: "Authorization: Bearer hidden-idempotency-token",
          plan_fingerprint: "Authorization: Bearer hidden-plan-token",
          execution_fingerprint: "Authorization: Bearer hidden-execution-token",
          internal: "must-strip",
        },
        persistence_linkage: {
          execution_reference_present: true,
          idempotency_reservation_present: true,
          audit_log_reference_present: true,
          internal: "must-strip",
        },
        blocked_application_actions: [
          {
            code: "order_mutation",
            label: "Authorization: Bearer hidden-action-token",
            reason: "Authorization: Bearer hidden-reason-token",
            blocked: true,
            secret_token: "must-strip",
          },
        ],
        confirmations: {
          order_mutation_disabled: true,
          fulfillment_persistence_disabled: true,
          shipment_persistence_disabled: true,
          label_persistence_disabled: true,
          event_persistence_disabled: true,
          checkout_cutover_disabled: true,
          internal: "must-strip",
        },
        raw_provider_payload: { token: "must-strip" },
      },
      failure_handling_preview: {
        version: 1,
        redacted: true,
        current_mode: "preview_only",
        failure_path_decision: "projected_retry_policy",
        projected_failure_status: "manual_intervention_required_when_enabled",
        failure_classes: [
          {
            code: "provider_dispatch_failure",
            retry_eligibility: "eligible_when_enabled",
            compensation_requirement: "required_when_enabled",
            manual_intervention: "required_when_enabled",
            reason_bucket: "dispatch_transport",
            internal: "must-strip",
          },
        ],
        identity_linkage: {
          provider_operation_reference: "Authorization: Bearer hidden-failure-token",
          idempotency_key_preview: "Authorization: Bearer hidden-failure-idempotency",
          plan_fingerprint: "Authorization: Bearer hidden-failure-plan",
          execution_fingerprint: "Authorization: Bearer hidden-failure-execution",
          internal: "must-strip",
        },
        retry_projection: {
          eligibility: "eligible_when_enabled",
          policy: "deterministic_preview_only",
          retry_block_reasons: ["Authorization: Bearer hidden-retry-reason"],
          scheduling_status: "disabled",
          internal: "must-strip",
        },
        compensation_projection: {
          requirement: "required_when_enabled",
          write_plan_status: "disabled",
          rollback_status: "disabled",
          blocked_actions: ["Authorization: Bearer hidden-compensation-reason"],
          internal: "must-strip",
        },
        manual_intervention_projection: {
          status: "required_when_enabled",
          reason_markers: ["Authorization: Bearer hidden-manual-reason"],
          internal: "must-strip",
        },
        blocked_failure_actions: [
          {
            code: "retry_scheduling",
            label: "Authorization: Bearer hidden-failure-action",
            reason: "Authorization: Bearer hidden-failure-action-reason",
            blocked: true,
            secret_token: "must-strip",
          },
        ],
        confirmations: {
          retry_scheduling_disabled: true,
          rollback_disabled: true,
          compensation_writes_disabled: true,
          order_mutation_disabled: true,
          fulfillment_mutation_disabled: true,
          event_persistence_disabled: true,
          provider_redispatch_disabled: true,
          checkout_cutover_disabled: true,
          internal: "must-strip",
        },
        raw_provider_payload: { token: "must-strip" },
      },
      execution_lifecycle_preview: {
        version: 1,
        redacted: true,
        current_mode: "preview_only",
        lifecycle_status: "projected_for_future_execution",
        readiness_posture: "ready_when_enabled",
        phase_sequence: [
          "preflight_eligibility",
          "provider_dispatch",
          "shipment_result_normalization",
          "fulfillment_application",
          "failure_handling",
        ],
        identity_correlation: {
          provider_operation_reference: "Authorization: Bearer hidden-lifecycle-provider-token",
          idempotency_key_preview: "Authorization: Bearer hidden-lifecycle-idempotency-token",
          plan_fingerprint: "Authorization: Bearer hidden-lifecycle-plan-token",
          execution_fingerprint: "Authorization: Bearer hidden-lifecycle-execution-token",
          internal: "must-strip",
        },
        phases: [
          {
            code: "preflight_eligibility",
            order: 1,
            status: "projected_for_future_execution",
            readiness_posture: "ready_when_enabled",
            block_reasons: ["Authorization: Bearer hidden-lifecycle-gate-reason"],
            disabled_live_actions: ["provider_create_shipment_call"],
            linked_preview_artifacts: ["preflight_eligibility"],
            internal: "must-strip",
          },
          {
            code: "provider_dispatch",
            order: 2,
            status: "projected_for_future_execution",
            readiness_posture: "ready_when_enabled",
            block_reasons: ["Authorization: Bearer hidden-lifecycle-dispatch-reason"],
            disabled_live_actions: ["adapter_invocation"],
            linked_preview_artifacts: ["provider_dispatch_preview"],
            internal: "must-strip",
          },
          {
            code: "shipment_result_normalization",
            order: 3,
            status: "projected_for_future_execution",
            readiness_posture: "ready_when_enabled",
            block_reasons: ["Authorization: Bearer hidden-lifecycle-result-reason"],
            disabled_live_actions: ["provider_response_fetch"],
            linked_preview_artifacts: ["shipment_result_preview"],
            internal: "must-strip",
          },
          {
            code: "fulfillment_application",
            order: 4,
            status: "projected_for_future_execution",
            readiness_posture: "ready_when_enabled",
            block_reasons: ["Authorization: Bearer hidden-lifecycle-application-reason"],
            disabled_live_actions: ["order_mutation"],
            linked_preview_artifacts: ["fulfillment_application_preview"],
            internal: "must-strip",
          },
          {
            code: "failure_handling",
            order: 5,
            status: "projected_for_future_execution",
            readiness_posture: "ready_when_enabled",
            block_reasons: ["Authorization: Bearer hidden-lifecycle-failure-reason"],
            disabled_live_actions: ["retry_scheduling"],
            linked_preview_artifacts: ["failure_handling_preview"],
            internal: "must-strip",
          },
        ],
        confirmations: {
          preview_only: true,
          orchestration_scheduling_disabled: true,
          shipment_execution_disabled: true,
          provider_calls_disabled: true,
          persistence_writes_disabled: true,
          retry_scheduling_disabled: true,
          compensation_writes_disabled: true,
          order_mutation_disabled: true,
          fulfillment_mutation_disabled: true,
          checkout_cutover_disabled: true,
          internal: "must-strip",
        },
        raw_provider_payload: { token: "must-strip" },
      },
      shipment_execution: {
        materialized: false,
        reason: "Authorization: Bearer hidden-shipment-token is intentionally disabled",
      },
    },
  ],
  summary: {
    mode_count: 1,
    ready_mode_count: 1,
    blocked_mode_count: 0,
    projected_mode_count: 1,
    deferred_mode_count: 0,
    unconfigured_mode_count: 0,
  },
},
      summary: {
        mode_count: 1,
        ready_mode_count: 1,
        blocked_mode_count: 0,
        projected_mode_count: 1,
        deferred_mode_count: 0,
        unconfigured_mode_count: 0,
      },
    }

    const buildPreviewSpy = jest
      .spyOn(DeliveryHubService.prototype, "buildExecutionPlanObservabilityPreview")
      .mockResolvedValue(preview as any)

    const res = createMockResponse()
    const req = createMockRequest({
      url: "/admin/delivery/execution-plan/preview",
      scope: {
        resolve: jest.fn((key: string) => {
          if (key === ContainerRegistrationKeys.QUERY) {
            return {
              graph: jest.fn().mockImplementation(async () => ({
                data: currentOptions,
              })),
            }
          }

          return { raw: jest.fn() }
        }),
      },
    })

    await deliveryExecutionPlanPreviewRoute.GET(req as any, res as any)

    expect(buildPreviewSpy).toHaveBeenCalledWith(currentOptions)
    expect(res.status).toHaveBeenCalledWith(200)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.ok).toBe(true)
    expect(payload.preview.execution_plan_preview.mode_previews[0]).toEqual({
      mode_code: "warehouse_to_pickup_point",
      status: "ready",
      rollout_status: "projected",
      supporting_connection_ids: ["conn_ready"],
      blocking_issues: [],
      readiness_verdict: {
        status: "ready",
        blocked_reasons: [],
      },
      blocked_reasons: ["Authorization: Bearer *** is intentionally disabled"],
      issues: [
        {
          code: "DELIVERY_HUB_SHAPE_DRIFT",
          message: "Authorization: Bearer ***",
          field_path: "fulfillment_data.internal_secret",
        },
      ],
      repository_assembly_summary: {
        version: 1,
        mode: "assembly_plan_only",
        repository_status: "pg_repository_implementation_available",
        table_name: "deliveryhub_execution_ledger",
        persistence_readiness_contour: {
          stages: [
            "artifact_defined",
            "manual_application_external",
            "snapshot_verification_available",
            "activation_blocked",
          ],
          current_stage: "activation_blocked",
          review_preparation_available_now: [
            "descriptor_bundle_defined",
            "migration_artifact_reviewable",
            "snapshot_schema_verifier_available",
            "snapshot_schema_check_plan_available",
          ],
          external_manual_application_remaining: [
            "manual_migration_review",
            "manual_table_creation_or_migration_execution",
            "manual_schema_snapshot_capture",
          ],
          activation_blocked_until: [
            "migration_or_table_creation",
            "transaction_runner",
            "explicit_runtime_wiring",
            "operational_runbook",
            "safety_review",
          ],
        },
        missing_activation_prerequisites: [
          "migration_or_table_creation",
          "transaction_runner",
          "explicit_runtime_wiring",
          "operational_runbook",
          "safety_review",
        ],
        disabled_confirmations: {
          query_execution: false,
          transaction_execution: false,
          transaction_open: false,
          transaction_commit: false,
          transaction_rollback: false,
          production_writes: false,
          runtime_wiring: false,
          live_execution: false,
          provider_dispatch: false,
          shipment_creation: false,
          label_or_document_generation: false,
          order_or_fulfillment_mutation: false,
          retry_scheduling: false,
          compensation_or_rollback_writes: false,
          checkout_or_storefront_cutover: false,
          connection_factory_invocation: false,
          migration_or_table_creation: false,
        },
      },
      steps: [
        {
          key: "provider_execution_plan",
          ready: true,
          message: "Authorization: Bearer *** is ready",
        },
        {
          key: "execution_identity",
          ready: true,
          message: "Authorization: Bearer *** is ready",
        },
        {
          key: "persistence_audit_preview",
          ready: true,
          message: "Authorization: Bearer *** is ready",
        },
        {
          key: "preflight_eligibility",
          ready: true,
          message: "Authorization: Bearer *** is ready",
        },
      ],
      execution_plan: {
        version: 1,
        operation: "create_shipment",
        connection_id: "conn_ready",
        mode_code: "warehouse_to_pickup_point",
        quote_reference: {
          id: "ref_1",
          version: 1,
        },
        order: {
          id: null,
          display_id: "Authorization: Bearer ***",
          currency_code: "RUB",
        },
        fulfillment: {
          id: null,
          location_id: null,
        },
        items: [
          {
            line_item_id: "item_1",
            quantity: 1,
          },
        ],
        outbound_request: {
          method: "POST",
          path: "/shipments",
          headers: {
            authorization: "Bearer ***",
            "content-type": "application/json",
          },
        },
      },
      execution_identity: {
        version: 1,
        redacted: true,
        operation: "create_shipment",
        provider_operation_label: "Authorization: Bearer ***",
        provider_operation_reference: "Authorization: Bearer ***",
        plan_fingerprint: "Authorization: Bearer ***",
        execution_fingerprint: "Authorization: Bearer ***",
        idempotency_key_preview: "Authorization: Bearer ***",
      },
      persistence_audit_preview: {
        version: 1,
        redacted: true,
        status: "ready",
        metadata_patch: {
          target: "fulfillment_execution_shadow",
          action: "merge",
          fields: [
            {
              field: "execution_reference",
              value_preview: "Authorization: Bearer ***",
            },
          ],
        },
        execution_record: {
          ready: true,
          draft: null,
          record_type: "deliveryhub_shipment_execution",
          operation: "create_shipment",
          provider_code: "deliveryhub",
          provider_id: "deliveryhub_deliveryhub",
          connection_id: "conn_ready",
          mode_code: "warehouse_to_pickup_point",
          execution_reference: "Authorization: Bearer ***",
          idempotency_key_preview: "Authorization: Bearer ***",
          initial_status: "planned",
        },
        idempotency_reservation: {
          ready: true,
          draft: null,
          dedupe_scope: "deliveryhub:create_shipment",
          reservation_key_preview: "Authorization: Bearer ***",
          reservation_fingerprint: "Authorization: Bearer ***",
          matched_fields: [
            {
              field: "execution_fingerprint",
              value_preview: "Authorization: Bearer ***",
            },
          ],
        },
        status_transitions: [
          {
            from: "planned",
            to: "persisted",
            reason: "Authorization: Bearer ***",
          },
        ],
        audit_log_entries: [
          {
            version: 1,
            event_type: "Authorization: Bearer ***",
            execution_reference: "Authorization: Bearer ***",
            current_state: "Authorization: Bearer ***",
            summary: "Authorization: Bearer ***",
            correlation: {
              connection_id: "Authorization: Bearer ***",
              quote_reference_id: "ref_1",
              display_id: 1,
              fulfillment_id: null,
            },
            identity: {
              execution_fingerprint: "Authorization: Bearer ***",
              reservation_fingerprint: "Authorization: Bearer ***",
            },
          },
        ],
        blocked: [
          {
            key: "provider_dispatch",
            reason: "Authorization: Bearer ***",
          },
        ],
        deferred: [
          {
            key: "audit_log_commit",
            reason: "Authorization: Bearer ***",
          },
        ],
      },
      outbound_payload_preview: {
        redacted: true,
        request: {
          headers: {
            authorization: "***",
            "content-type": "application/json",
          },
          body: {
            token: "***",
          },
        },
      },
      preflight_eligibility: {
        version: 1,
        redacted: true,
        current_mode: "preview_only",
        decision: "eligible_when_enabled",
        real_execution_enabled: false,
        future_execution_flag: {
          name: "DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED",
          status: "future_inert_not_read",
          description: "Authorization: Bearer *** is future inert",
        },
        reasons: [
          {
            code: "EXECUTION_PREVIEW_ONLY",
            message: "Authorization: Bearer ***",
          },
        ],
        required_prerequisites: [
          {
            code: "operator_approval",
            label: "Authorization: Bearer ***",
            status: "required_future_work",
          },
        ],
        confirmations: {
          shipment_execution_disabled: true,
          provider_calls_disabled: true,
          persistence_writes_disabled: true,
          checkout_cutover_disabled: true,
        },
        blocked_live_actions: [
          {
            code: "provider_create_shipment_call",
            label: "Authorization: Bearer ***",
            blocked: true,
          },
        ],
      },
      provider_dispatch_preview: {
        version: 1,
        redacted: true,
        current_mode: "preview_only",
        dispatch_decision: "ready_for_future_dispatch",
        provider: {
          provider_code: "deliveryhub",
          provider_id: "deliveryhub_deliveryhub",
          provider_key: "deliveryhub",
          adapter_operation: "create_shipment",
          adapter_operation_label: "Authorization: Bearer ***",
        },
        command_identity: {
          provider_operation_reference: "Authorization: Bearer ***",
          idempotency_key_preview: "Authorization: Bearer ***",
          plan_fingerprint: "Authorization: Bearer ***",
          execution_fingerprint: "Authorization: Bearer ***",
        },
        command_envelope_summary: {
          connection_id_present: true,
          mode_code: "warehouse_to_pickup_point",
          origin_kind: "fulfillment_location",
          destination_kind: "pickup_point",
          quote_reference_present: true,
          offer_reference_present: true,
          package_reference_present: true,
          order_reference_present: true,
          fulfillment_reference_present: false,
          pickup_scheduling_reference_present: false,
          dropoff_scheduling_reference_present: false,
          item_count: 1,
        },
        blocked_dispatch_actions: [
          {
            code: "adapter_invocation",
            label: "Authorization: Bearer ***",
            reason: "Authorization: Bearer ***",
            blocked: true,
          },
        ],
        confirmations: {
          adapter_invocation_disabled: true,
          provider_network_calls_disabled: true,
          shipment_creation_disabled: true,
          label_creation_disabled: true,
          order_mutation_disabled: true,
          persistence_writes_disabled: true,
          checkout_cutover_disabled: true,
        },
      },
      shipment_result_preview: {
        version: 1,
        redacted: true,
        current_mode: "preview_only",
        result_decision: "projected_for_future_execution",
        projected_result_status: "projected_for_future_execution",
        result_kind: "shipment_result",
        normalization_target: "deliveryhub_shipment_result",
        provider_normalization_target: "create_shipment_response",
        identity_linkage: {
          provider_operation_reference: "Authorization: Bearer ***",
          idempotency_key_preview: "Authorization: Bearer ***",
          plan_fingerprint: "Authorization: Bearer ***",
          execution_fingerprint: "Authorization: Bearer ***",
        },
        artifact_summary: {
          external_shipment_reference_present: true,
          tracking_reference_present: true,
          label_document_present: true,
          pickup_booking_present: true,
          pickup_interval_present: true,
          status_timeline_present: true,
          failure_placeholder_present: true,
          rollback_placeholder_present: true,
        },
        blocked_materialization_actions: [
          {
            code: "provider_response_fetch",
            label: "Authorization: Bearer ***",
            reason: "Authorization: Bearer ***",
            blocked: true,
          },
        ],
        confirmations: {
          provider_response_fetch_disabled: true,
          adapter_invocation_disabled: true,
          shipment_creation_disabled: true,
          label_persistence_disabled: true,
          order_mutation_disabled: true,
          fulfillment_persistence_disabled: true,
          checkout_cutover_disabled: true,
        },
      },
      failure_handling_preview: {
        version: 1,
        redacted: true,
        current_mode: "preview_only",
        failure_path_decision: "projected_retry_policy",
        projected_failure_status: "manual_intervention_required_when_enabled",
        failure_classes: [
          {
            code: "provider_dispatch_failure",
            retry_eligibility: "eligible_when_enabled",
            compensation_requirement: "required_when_enabled",
            manual_intervention: "required_when_enabled",
            reason_bucket: "dispatch_transport",
          },
        ],
        identity_linkage: {
          provider_operation_reference: "Authorization: Bearer ***",
          idempotency_key_preview: "Authorization: Bearer ***",
          plan_fingerprint: "Authorization: Bearer ***",
          execution_fingerprint: "Authorization: Bearer ***",
        },
        retry_projection: {
          eligibility: "eligible_when_enabled",
          policy: "deterministic_preview_only",
          retry_block_reasons: ["Authorization: Bearer ***"],
          scheduling_status: "disabled",
        },
        compensation_projection: {
          requirement: "required_when_enabled",
          write_plan_status: "disabled",
          rollback_status: "disabled",
          blocked_actions: ["Authorization: Bearer ***"],
        },
        manual_intervention_projection: {
          status: "required_when_enabled",
          reason_markers: ["Authorization: Bearer ***"],
        },
        blocked_failure_actions: [
          {
            code: "retry_scheduling",
            label: "Authorization: Bearer ***",
            reason: "Authorization: Bearer ***",
            blocked: true,
          },
        ],
        confirmations: {
          retry_scheduling_disabled: true,
          rollback_disabled: true,
          compensation_writes_disabled: true,
          order_mutation_disabled: true,
          fulfillment_mutation_disabled: true,
          event_persistence_disabled: true,
          provider_redispatch_disabled: true,
          checkout_cutover_disabled: true,
        },
      },
      fulfillment_application_preview: {
        version: 1,
        redacted: true,
        current_mode: "preview_only",
        application_decision: "projected_for_future_application",
        projected_application_status: "projected_for_future_application",
        application_target: "medusa_fulfillment_mutation_plan",
        application_scope: "backend_admin_only",
        mutation_semantics: {
          fulfillment_data_patch_present: true,
          shipment_reference_linkage_present: true,
          tracking_projection_present: true,
          label_document_reference_linkage_present: true,
          status_transition_application_present: true,
          audit_linkage_present: true,
        },
        identity_linkage: {
          provider_operation_reference: "Authorization: Bearer ***",
          idempotency_key_preview: "Authorization: Bearer ***",
          plan_fingerprint: "Authorization: Bearer ***",
          execution_fingerprint: "Authorization: Bearer ***",
        },
        persistence_linkage: {
          execution_reference_present: true,
          idempotency_reservation_present: true,
          audit_log_reference_present: true,
        },
        blocked_application_actions: [
          {
            code: "order_mutation",
            label: "Authorization: Bearer ***",
            reason: "Authorization: Bearer ***",
            blocked: true,
          },
        ],
        confirmations: {
          order_mutation_disabled: true,
          fulfillment_persistence_disabled: true,
          shipment_persistence_disabled: true,
          label_persistence_disabled: true,
          event_persistence_disabled: true,
          checkout_cutover_disabled: true,
        },
      },
      execution_lifecycle_preview: {
        version: 1,
        redacted: true,
        current_mode: "preview_only",
        lifecycle_status: "projected_for_future_execution",
        readiness_posture: "ready_when_enabled",
        phase_sequence: [
          "preflight_eligibility",
          "provider_dispatch",
          "shipment_result_normalization",
          "fulfillment_application",
          "failure_handling",
        ],
        identity_correlation: {
          provider_operation_reference: "Authorization: Bearer ***",
          idempotency_key_preview: "Authorization: Bearer ***",
          plan_fingerprint: "Authorization: Bearer ***",
          execution_fingerprint: "Authorization: Bearer ***",
        },
        phases: [
          {
            code: "preflight_eligibility",
            order: 1,
            status: "projected_for_future_execution",
            readiness_posture: "ready_when_enabled",
            block_reasons: ["Authorization: Bearer ***"],
            disabled_live_actions: ["provider_create_shipment_call"],
            linked_preview_artifacts: ["preflight_eligibility"],
          },
          {
            code: "provider_dispatch",
            order: 2,
            status: "projected_for_future_execution",
            readiness_posture: "ready_when_enabled",
            block_reasons: ["Authorization: Bearer ***"],
            disabled_live_actions: ["adapter_invocation"],
            linked_preview_artifacts: ["provider_dispatch_preview"],
          },
          {
            code: "shipment_result_normalization",
            order: 3,
            status: "projected_for_future_execution",
            readiness_posture: "ready_when_enabled",
            block_reasons: ["Authorization: Bearer ***"],
            disabled_live_actions: ["provider_response_fetch"],
            linked_preview_artifacts: ["shipment_result_preview"],
          },
          {
            code: "fulfillment_application",
            order: 4,
            status: "projected_for_future_execution",
            readiness_posture: "ready_when_enabled",
            block_reasons: ["Authorization: Bearer ***"],
            disabled_live_actions: ["order_mutation"],
            linked_preview_artifacts: ["fulfillment_application_preview"],
          },
          {
            code: "failure_handling",
            order: 5,
            status: "projected_for_future_execution",
            readiness_posture: "ready_when_enabled",
            block_reasons: ["Authorization: Bearer ***"],
            disabled_live_actions: ["retry_scheduling"],
            linked_preview_artifacts: ["failure_handling_preview"],
          },
        ],
        confirmations: {
          preview_only: true,
          orchestration_scheduling_disabled: true,
          shipment_execution_disabled: true,
          provider_calls_disabled: true,
          persistence_writes_disabled: true,
          retry_scheduling_disabled: true,
          compensation_writes_disabled: true,
          order_mutation_disabled: true,
          fulfillment_mutation_disabled: true,
          checkout_cutover_disabled: true,
        },
      },
      shipment_execution: {
        materialized: false,
        reason: "Authorization: Bearer *** is intentionally disabled",
      },
    })
    expect(JSON.stringify(payload.preview.execution_plan_preview.mode_previews[0])).not.toContain(
      "must-strip"
    )
    expect(JSON.stringify(payload.preview.execution_plan_preview.mode_previews[0])).not.toContain(
      "hidden-gate-token"
    )
    expect(JSON.stringify(payload.preview.execution_plan_preview.mode_previews[0])).not.toContain(
      "hidden-dispatch-token"
    )
    expect(JSON.stringify(payload.preview.execution_plan_preview.mode_previews[0])).not.toContain(
      "raw_provider_payload"
    )
    expect(JSON.stringify(payload.preview.execution_plan_preview.mode_previews[0])).not.toContain(
      "hidden-application-token"
    )
    expect(JSON.stringify(payload.preview.execution_plan_preview.mode_previews[0])).not.toContain(
      "hidden-failure-token"
    )
    expect(JSON.stringify(payload.preview.execution_plan_preview.mode_previews[0])).not.toContain(
      "raw_document_base64"
    )
    expect(JSON.stringify(payload.preview.execution_plan_preview.mode_previews[0])).not.toContain(
      "secret_token"
    )
  })

  it("rejects admin execution preflight eligibility payload with blocked decision", async () => {
    const currentOptions = [{ id: "so_1", provider_id: "manual", data: { id: "foreign:option" } }]
    const preview = {
      provider_code: "deliveryhub",
      provider_id: "deliveryhub_deliveryhub",
      shipping_option_preview: {
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
        current_options: [],
        plan: {
          provider_code: "deliveryhub",
          provider_id: "deliveryhub_deliveryhub",
          desired_options: [],
          deferred_options: [],
          connection_plans: [],
        },
        reconciliation: {
          provider_code: "deliveryhub",
          provider_id: "deliveryhub_deliveryhub",
          create_candidates: [],
          update_candidates: [],
          unchanged: [],
          orphaned_managed_options: [],
          ignored_foreign_options: [],
        },
        summary: {
          current_option_count: 0,
          desired_option_count: 0,
          deferred_option_count: 0,
          deferred_issue_count: 0,
          connection_plan_count: 0,
          create_candidate_count: 0,
          update_candidate_count: 0,
          unchanged_count: 0,
          orphaned_managed_option_count: 0,
          ignored_foreign_option_count: 0,
        },
      },
      execution_plan_preview: {
        version: 1,
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
        mode_previews: [
          {
            mode_code: "warehouse_to_pickup_point",
            status: "ready",
            rollout_status: "projected",
            supporting_connection_ids: ["conn_ready"],
            blocking_issues: [],
            readiness_verdict: {
              status: "ready",
              blocked_reasons: [],
            },
            blocked_reasons: ["Shipment execution remains intentionally disabled"],
            issues: [],
            repository_assembly_summary: {
              version: 1,
              mode: "assembly_plan_only",
              repository_status: "pg_repository_implementation_available",
              table_name: "deliveryhub_execution_ledger",
              persistence_readiness_contour: {
                stages: [
                  "artifact_defined",
                  "manual_application_external",
                  "snapshot_verification_available",
                  "activation_blocked",
                ],
                current_stage: "activation_blocked",
                review_preparation_available_now: [
                  "descriptor_bundle_defined",
                  "migration_artifact_reviewable",
                  "snapshot_schema_verifier_available",
                  "snapshot_schema_check_plan_available",
                ],
                external_manual_application_remaining: [
                  "manual_migration_review",
                  "manual_table_creation_or_migration_execution",
                  "manual_schema_snapshot_capture",
                ],
                activation_blocked_until: [
                  "migration_or_table_creation",
                  "transaction_runner",
                  "explicit_runtime_wiring",
                  "operational_runbook",
                  "safety_review",
                ],
              },
              missing_activation_prerequisites: [
                "migration_or_table_creation",
                "transaction_runner",
                "explicit_runtime_wiring",
                "operational_runbook",
                "safety_review",
              ],
              disabled_confirmations: {
                query_execution: false,
                transaction_execution: false,
                transaction_open: false,
                transaction_commit: false,
                transaction_rollback: false,
                production_writes: false,
                runtime_wiring: false,
                live_execution: false,
                provider_dispatch: false,
                shipment_creation: false,
                label_or_document_generation: false,
                order_or_fulfillment_mutation: false,
                retry_scheduling: false,
                compensation_or_rollback_writes: false,
                checkout_or_storefront_cutover: false,
                connection_factory_invocation: false,
                migration_or_table_creation: false,
              },
            },
            steps: [
              {
                key: "preflight_eligibility",
                ready: false,
                message: "Gate decision drift must not pass as valid.",
              },
            ],
            execution_plan: null,
            execution_identity: null,
            outbound_payload_preview: {
              redacted: true,
              request: null,
            },
            persistence_audit_preview: {
              version: 1,
              redacted: true,
              status: "blocked",
              metadata_patch: {
                target: "fulfillment_execution_shadow",
                action: "merge",
                fields: [],
              },
              execution_record: {
                ready: false,
                draft: null,
                record_type: "deliveryhub_shipment_execution",
                operation: "create_shipment",
                provider_code: "deliveryhub",
                provider_id: "deliveryhub_deliveryhub",
                connection_id: null,
                mode_code: null,
                execution_reference: null,
                idempotency_key_preview: null,
                initial_status: null,
              },
              idempotency_reservation: {
                ready: false,
                draft: null,
                dedupe_scope: "deliveryhub:create_shipment",
                reservation_key_preview: null,
                reservation_fingerprint: null,
                matched_fields: [],
              },
              status_transitions: [],
              audit_log_entries: [],
              blocked: [],
              deferred: [],
            },
            preflight_eligibility: {
              version: 1,
              redacted: true,
              current_mode: "preview_only",
              decision: "blocked",
              real_execution_enabled: false,
              future_execution_flag: {
                name: "DELIVERY_HUB_SHIPMENT_EXECUTION_ENABLED",
                status: "future_inert_not_read",
                description: "Future inert flag name only.",
              },
              reasons: [
                {
                  code: "EXECUTION_PREVIEW_ONLY",
                  message: "Preview-only execution gate.",
                },
              ],
              required_prerequisites: [],
              confirmations: {
                shipment_execution_disabled: true,
                provider_calls_disabled: true,
                persistence_writes_disabled: true,
                checkout_cutover_disabled: true,
              },
              blocked_live_actions: [],
            },
            provider_dispatch_preview: {
              version: 1,
              redacted: true,
              current_mode: "preview_only",
              dispatch_decision: "not_dispatched",
              provider: {
                provider_code: "deliveryhub",
                provider_id: "deliveryhub_deliveryhub",
                provider_key: "deliveryhub",
                adapter_operation: "create_shipment",
                adapter_operation_label: "create_shipment",
              },
              command_identity: {
                provider_operation_reference: null,
                idempotency_key_preview: null,
                plan_fingerprint: null,
                execution_fingerprint: null,
              },
              command_envelope_summary: {
                connection_id_present: false,
                mode_code: null,
                origin_kind: "unknown",
                destination_kind: "unknown",
                quote_reference_present: false,
                offer_reference_present: false,
                package_reference_present: false,
                order_reference_present: false,
                fulfillment_reference_present: false,
                pickup_scheduling_reference_present: false,
                dropoff_scheduling_reference_present: false,
                item_count: 0,
              },
              blocked_dispatch_actions: [
                {
                  code: "adapter_invocation",
                  label: "Adapter invocation",
                  reason: "Adapter disabled.",
                  blocked: true,
                },
              ],
              confirmations: {
                adapter_invocation_disabled: true,
                provider_network_calls_disabled: true,
                shipment_creation_disabled: true,
                label_creation_disabled: true,
                order_mutation_disabled: true,
                persistence_writes_disabled: true,
                checkout_cutover_disabled: true,
              },
            },
            shipment_result_preview: {
              version: 1,
              redacted: true,
              current_mode: "preview_only",
              result_decision: "not_materialized",
              projected_result_status: "not_materialized",
              result_kind: "shipment_result",
              normalization_target: "deliveryhub_shipment_result",
              provider_normalization_target: "create_shipment_response",
              identity_linkage: {
                provider_operation_reference: null,
                idempotency_key_preview: null,
                plan_fingerprint: null,
                execution_fingerprint: null,
              },
              artifact_summary: {
                external_shipment_reference_present: false,
                tracking_reference_present: false,
                label_document_present: false,
                pickup_booking_present: false,
                pickup_interval_present: false,
                status_timeline_present: false,
                failure_placeholder_present: true,
                rollback_placeholder_present: true,
              },
              blocked_materialization_actions: [
                {
                  code: "provider_response_fetch",
                  label: "Provider response fetch",
                  reason: "Provider response fetch disabled.",
                  blocked: true,
                },
              ],
              confirmations: {
                provider_response_fetch_disabled: true,
                adapter_invocation_disabled: true,
                shipment_creation_disabled: true,
                label_persistence_disabled: true,
                order_mutation_disabled: true,
                fulfillment_persistence_disabled: true,
                checkout_cutover_disabled: true,
              },
            },
            shipment_execution: {
              materialized: false,
              reason: "Shipment execution remains intentionally disabled",
            },
          },
        ],
        summary: {
          mode_count: 1,
          ready_mode_count: 1,
          blocked_mode_count: 0,
          projected_mode_count: 1,
          deferred_mode_count: 0,
          unconfigured_mode_count: 0,
        },
      },
      summary: {
        mode_count: 1,
        ready_mode_count: 1,
        blocked_mode_count: 0,
        projected_mode_count: 1,
        deferred_mode_count: 0,
        unconfigured_mode_count: 0,
      },
    }

    jest
      .spyOn(DeliveryHubService.prototype, "buildExecutionPlanObservabilityPreview")
      .mockResolvedValue(preview as any)

    const res = createMockResponse()
    const req = createMockRequest({
      url: "/admin/delivery/execution-plan/preview",
      scope: {
        resolve: jest.fn((key: string) => {
          if (key === ContainerRegistrationKeys.QUERY) {
            return {
              graph: jest.fn().mockImplementation(async () => ({
                data: currentOptions,
              })),
            }
          }

          return { raw: jest.fn() }
        }),
      },
    })

    await deliveryExecutionPlanPreviewRoute.GET(req as any, res as any)

    expect(res.status).toHaveBeenCalledWith(500)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.error.code).toBe("DELIVERY_HUB_UNEXPECTED_ERROR")
    expect(payload.error.message).toContain("Invalid enum value")
    expect(payload.error.message).toContain("eligible_when_enabled")
    expect(payload.error.message).toContain("not_ready")
    expect(JSON.stringify(payload)).not.toContain('"decision":"blocked"')
  })

  it("returns manual shipping-option sync payload in dry-run mode by default", async () => {
    const currentOptions = [
      {
        id: "so_deliveryhub_existing",
        name: "Delivery Hub Pickup",
        provider_id: "deliveryhub_deliveryhub",
        data: {
          version: 1,
          provider_code: "deliveryhub",
          provider_id: "deliveryhub_deliveryhub",
          id: "deliveryhub:warehouse_to_pickup_point",
          mode_code: "warehouse_to_pickup_point",
        },
      },
    ]
    const sync = {
      provider_code: "deliveryhub",
      provider_id: "deliveryhub_deliveryhub",
      current_options: currentOptions,
      desired_plan: {
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
        desired_options: [],
        deferred_options: [],
        connection_plans: [],
      },
      desired_plan_summary: {
        desired_option_count: 0,
        deferred_option_count: 0,
        deferred_issue_count: 0,
        connection_plan_count: 0,
      },
      reconciliation: {
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
        create_candidates: [],
        update_candidates: [],
        unchanged: [],
        orphaned_managed_options: [],
        ignored_foreign_options: [],
      },
      reconciliation_summary: {
        create_candidate_count: 0,
        update_candidate_count: 0,
        unchanged_count: 0,
        orphaned_managed_option_count: 0,
        ignored_foreign_option_count: 0,
      },
      operation_plan: {
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
        create_operations: [],
        update_operations: [],
        archive_operations: [],
        noops: [],
        ignored_foreign_options: [],
        summary: {
          create_operation_count: 0,
          update_operation_count: 0,
          archive_operation_count: 0,
          noop_count: 0,
          mutation_operation_count: 0,
          ignored_foreign_option_count: 0,
          managed_option_count: 0,
        },
      },
      execution: {
        mode: {
          requested_mode: "dry_run",
          effective_mode: "dry_run",
          execute_requested: false,
          execute_confirmed: false,
          execute_guard: "deliveryhub:execute_shipping_option_sync",
          is_dry_run: true,
        },
        report: null,
      },
    }
    const pgRaw = jest.fn(async () => ({ rows: [] }))
    const runSyncSpy = jest
      .spyOn(
        deliveryShippingOptionsSyncRoute.deliveryHubShippingOptionManualSyncRouteDeps,
        "runDeliveryHubShippingOptionManualSync"
      )
      .mockImplementation(async (input: any) => {
        expect(input.audit_log).toEqual(expect.any(Function))

        await input.audit_log({
          request: input.request,
          current_option_count: input.current_options.length,
          execution_mode: sync.execution.mode,
          desired_plan_summary: sync.desired_plan_summary,
          reconciliation_summary: sync.reconciliation_summary,
          operation_plan: sync.operation_plan,
          execution_report: sync.execution.report,
        })

        return sync as any
      })

    const res = createMockResponse()
    const req = createMockRequest({
      url: "/admin/delivery/shipping-options/sync",
      validatedBody: {},
      scope: {
        resolve: jest.fn((key: string) => {
          if (key === ContainerRegistrationKeys.QUERY) {
            return {
              graph: jest.fn().mockImplementation(async () => ({
                data: currentOptions,
              })),
            }
          }

          if (key === ContainerRegistrationKeys.PG_CONNECTION) {
            return {
              raw: pgRaw,
            }
          }

          return { raw: jest.fn() }
        }),
      },
    })

    await deliveryShippingOptionsSyncRoute.POST(req as any, res as any)

    expect(runSyncSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        current_options: currentOptions,
        request: {
          mode: "dry_run",
          on_error: "abort",
        },
        mutation_service: undefined,
        audit_log: expect.any(Function),
      })
    )
    expect(pgRaw).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      sync,
    })
  })

  it("passes explicit execute request into manual sync route with mutation service wiring", async () => {
    const currentOptions: any[] = []
    const sync = {
      provider_code: "deliveryhub",
      provider_id: "deliveryhub_deliveryhub",
      current_options: currentOptions,
      desired_plan: {
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
        desired_options: [],
        deferred_options: [],
        connection_plans: [],
      },
      desired_plan_summary: {
        desired_option_count: 0,
        deferred_option_count: 0,
        deferred_issue_count: 0,
        connection_plan_count: 0,
      },
      reconciliation: {
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
        create_candidates: [],
        update_candidates: [],
        unchanged: [],
        orphaned_managed_options: [],
        ignored_foreign_options: [],
      },
      reconciliation_summary: {
        create_candidate_count: 0,
        update_candidate_count: 0,
        unchanged_count: 0,
        orphaned_managed_option_count: 0,
        ignored_foreign_option_count: 0,
      },
      operation_plan: {
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
        create_operations: [],
        update_operations: [],
        archive_operations: [],
        noops: [],
        ignored_foreign_options: [],
        summary: {
          create_operation_count: 0,
          update_operation_count: 0,
          archive_operation_count: 0,
          noop_count: 0,
          mutation_operation_count: 0,
          ignored_foreign_option_count: 0,
          managed_option_count: 0,
        },
      },
      execution: {
        mode: {
          requested_mode: "execute",
          effective_mode: "execute",
          execute_requested: true,
          execute_confirmed: true,
          execute_guard: "deliveryhub:execute_shipping_option_sync",
          is_dry_run: false,
        },
        report: {
          provider_code: "deliveryhub",
          provider_id: "deliveryhub_deliveryhub",
          outcome: "succeeded",
          aborted: false,
          error_mode: "continue",
          summary: {
            create_operation_count: 0,
            update_operation_count: 0,
            archive_operation_count: 0,
            mutation_operation_count: 0,
            noop_count: 0,
            ignored_foreign_option_count: 0,
            attempted_operation_count: 0,
            succeeded_operation_count: 0,
            failed_operation_count: 0,
            not_executed_operation_count: 0,
          },
          create_results: [],
          update_results: [],
          archive_results: [],
          executed_operations: [],
        },
      },
    }
    const runSyncSpy = jest
      .spyOn(
        deliveryShippingOptionsSyncRoute.deliveryHubShippingOptionManualSyncRouteDeps,
        "runDeliveryHubShippingOptionManualSync"
      )
      .mockResolvedValue(sync as any)

    const res = createMockResponse()
    const req = createMockRequest({
      url: "/admin/delivery/shipping-options/sync",
      validatedBody: {
        mode: "execute",
        confirm_execute: "deliveryhub:execute_shipping_option_sync",
        on_error: "continue",
        mutation_context: {
          create: {
            warehouse_to_pickup_point: {
              name: "Delivery Hub — Со склада в пункт выдачи",
              service_zone_id: "serzo_deliveryhub",
              shipping_profile_id: "sp_deliveryhub",
            },
          },
        },
      },
      scope: {
        resolve: jest.fn((key: string) => {
          if (key === ContainerRegistrationKeys.QUERY) {
            return {
              graph: jest.fn().mockImplementation(async () => ({
                data: currentOptions,
              })),
            }
          }

          return { raw: jest.fn() }
        }),
      },
    })

    await deliveryShippingOptionsSyncRoute.POST(req as any, res as any)

    expect(runSyncSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        current_options: currentOptions,
        request: expect.objectContaining({
          mode: "execute",
          confirm_execute: "deliveryhub:execute_shipping_option_sync",
          on_error: "continue",
        }),
        mutation_service: expect.any(Object),
      })
    )
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      sync,
    })
  })

  it("redacts secret-like manual sync execution fragments before they cross the admin boundary", async () => {
    const currentOptions: any[] = []
    const desired = {
      status: "projected",
      mode_code: "warehouse_to_pickup_point",
      data: {
        version: 1,
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
        id: "deliveryhub:warehouse_to_pickup_point",
        mode_code: "warehouse_to_pickup_point",
      },
      supporting_connection_ids: ["conn_1"],
    }
    const createOperation = {
      type: "create",
      provider_code: "deliveryhub",
      provider_id: "deliveryhub_deliveryhub",
      mode_code: "warehouse_to_pickup_point",
      desired,
      target_data: desired.data,
      supporting_connection_ids: ["conn_1"],
    }

    jest
      .spyOn(
        deliveryShippingOptionsSyncRoute.deliveryHubShippingOptionManualSyncRouteDeps,
        "runDeliveryHubShippingOptionManualSync"
      )
      .mockResolvedValue({
        provider_code: "deliveryhub",
        provider_id: "deliveryhub_deliveryhub",
        current_options: currentOptions,
        desired_plan: {
          provider_code: "deliveryhub",
          provider_id: "deliveryhub_deliveryhub",
          desired_options: [desired],
          deferred_options: [],
          connection_plans: [],
        },
        desired_plan_summary: {
          desired_option_count: 1,
          deferred_option_count: 0,
          deferred_issue_count: 0,
          connection_plan_count: 0,
        },
        reconciliation: {
          provider_code: "deliveryhub",
          provider_id: "deliveryhub_deliveryhub",
          create_candidates: [{ desired }],
          update_candidates: [],
          unchanged: [],
          orphaned_managed_options: [],
          ignored_foreign_options: [],
        },
        reconciliation_summary: {
          create_candidate_count: 1,
          update_candidate_count: 0,
          unchanged_count: 0,
          orphaned_managed_option_count: 0,
          ignored_foreign_option_count: 0,
        },
        operation_plan: {
          provider_code: "deliveryhub",
          provider_id: "deliveryhub_deliveryhub",
          create_operations: [createOperation],
          update_operations: [],
          archive_operations: [],
          noops: [],
          ignored_foreign_options: [],
          summary: {
            create_operation_count: 1,
            update_operation_count: 0,
            archive_operation_count: 0,
            noop_count: 0,
            mutation_operation_count: 1,
            ignored_foreign_option_count: 0,
            managed_option_count: 1,
          },
        },
        execution: {
          mode: {
            requested_mode: "execute",
            effective_mode: "execute",
            execute_requested: true,
            execute_confirmed: true,
            execute_guard: "deliveryhub:execute_shipping_option_sync",
            is_dry_run: false,
          },
          report: {
            provider_code: "deliveryhub",
            provider_id: "deliveryhub_deliveryhub",
            outcome: "failed",
            aborted: true,
            error_mode: "abort",
            summary: {
              create_operation_count: 1,
              update_operation_count: 0,
              archive_operation_count: 0,
              mutation_operation_count: 1,
              noop_count: 0,
              ignored_foreign_option_count: 0,
              attempted_operation_count: 1,
              succeeded_operation_count: 0,
              failed_operation_count: 1,
              not_executed_operation_count: 0,
            },
            create_results: [
              {
                type: "create",
                status: "failed",
                operation: createOperation,
                error: {
                  request: {
                    headers: {
                      Authorization: "Bearer leaked-token",
                    },
                  },
                  response: {
                    body: '{"api_key":"leaked-api-key"}',
                  },
                },
              },
            ],
            update_results: [],
            archive_results: [],
            executed_operations: [
              {
                type: "create",
                status: "failed",
                operation: createOperation,
                error: {
                  request: {
                    headers: {
                      Authorization: "Bearer leaked-token",
                    },
                  },
                  response: {
                    body: '{"api_key":"leaked-api-key"}',
                  },
                },
              },
            ],
          },
        },
      } as any)

    const res = createMockResponse()
    const req = createMockRequest({
      url: "/admin/delivery/shipping-options/sync",
      validatedBody: {
        mode: "execute",
        confirm_execute: "deliveryhub:execute_shipping_option_sync",
        mutation_context: {
          create: {
            warehouse_to_pickup_point: {
              name: "Delivery Hub — Со склада в пункт выдачи",
              service_zone_id: "serzo_deliveryhub",
              shipping_profile_id: "sp_deliveryhub",
            },
          },
        },
      },
      scope: {
        resolve: jest.fn((key: string) => {
          if (key === ContainerRegistrationKeys.QUERY) {
            return {
              graph: jest.fn().mockImplementation(async () => ({
                data: currentOptions,
              })),
            }
          }

          return { raw: jest.fn() }
        }),
      },
    })

    await deliveryShippingOptionsSyncRoute.POST(req as any, res as any)

    expect(res.status).toHaveBeenCalledWith(200)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(
      payload.sync.execution.report.create_results[0].error.request.headers.Authorization
    ).toBe("***")
    expect(payload.sync.execution.report.create_results[0].error.response.body).toBe(
      '{"api_key":"***"}'
    )
    expect(
      payload.sync.execution.report.executed_operations[0].error.request.headers.Authorization
    ).toBe("***")
  })

  it("returns test quote result with correlation context on success", async () => {
    const body = {
      connection_id: "conn_1",
      mode_code: "warehouse_to_pickup_point",
      warehouse_id: "wh_1",
      destination_point_id: "pvz_1",
      currency_code: "RUB",
    }
    const result = {
      ok: true,
      connection: {
        id: "conn_1",
        provider_code: "yandex",
        name: "Yandex test",
        status: "active",
        mode: "test",
        enabled: true,
        country_code: "RU",
        credentials_state: "sealed",
        credentials_fingerprint: "fingerprint",
        credentials_last_validated_at: null,
        credentials_last_error_code: null,
        credentials_present: true,
        config: {},
        metadata: {},
        created_at: "2026-04-20T00:00:00.000Z",
        updated_at: "2026-04-20T00:00:00.000Z",
      },
      quotes: [
        {
          quote_key: "quote_1",
          price: 499,
        },
      ],
      correlation_id: "corr-test-quote",
      input_echo: {
        connection_id: "conn_1",
        mode_code: "warehouse_to_pickup_point",
        destination_point_id: "pvz_1",
        origin_point_id: null,
        warehouse_id: "wh_1",
        interval_utc: null,
        currency_code: "RUB",
        item_count: 0,
      },
      diagnostics_summary: {
        status: "ok",
        provider_status: null,
        error_category: null,
        message: null,
        correlation_id: "corr-test-quote",
        checked_at: "2026-04-21T10:00:00.000Z",
        redacted: true,
      },
    }

    const quoteSpy = jest
      .spyOn(DeliveryHubService.prototype, "testQuote")
      .mockResolvedValue(result as any)

    const res = createMockResponse()

    await deliveryTestQuoteRoute.POST(
      createMockRequest({
        url: "/admin/delivery/test-quote",
        validatedBody: body,
      }) as any,
      res as any
    )

    expect(quoteSpy).toHaveBeenCalledWith(body)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(result)
  })

  it("rejects test quote responses that try to leak admin-only connection fragments", async () => {
    jest.spyOn(DeliveryHubService.prototype, "testQuote").mockResolvedValue({
      ok: true,
      connection: {
        id: "conn_1",
        provider_code: "yandex",
        name: "Yandex test",
        status: "active",
        mode: "test",
        enabled: true,
        country_code: "RU",
        credentials_state: "sealed",
        credentials_fingerprint: "fingerprint",
        credentials_last_validated_at: null,
        credentials_last_error_code: null,
        credentials_present: true,
        config: {},
        metadata: {},
        credentials: {
          token: "secret",
        },
        created_at: "2026-04-20T00:00:00.000Z",
        updated_at: "2026-04-20T00:00:00.000Z",
      },
      quotes: [],
      correlation_id: "corr-test-quote",
      input_echo: {
        connection_id: "conn_1",
        mode_code: "warehouse_to_pickup_point",
        destination_point_id: "pvz_1",
        origin_point_id: null,
        warehouse_id: "wh_1",
        interval_utc: null,
        currency_code: "RUB",
        item_count: 0,
      },
      diagnostics_summary: {
        status: "ok",
        provider_status: null,
        error_category: null,
        message: null,
        correlation_id: "corr-test-quote",
        checked_at: "2026-04-21T10:00:00.000Z",
        redacted: true,
      },
    } as any)

    const res = createMockResponse()

    await deliveryTestQuoteRoute.POST(
      createMockRequest({
        url: "/admin/delivery/test-quote",
        validatedBody: {
          connection_id: "conn_1",
          mode_code: "warehouse_to_pickup_point",
          warehouse_id: "wh_1",
          destination_point_id: "pvz_1",
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(500)
    const payload = (res.json as jest.Mock).mock.calls[0][0] as any
    expect(payload.error.code).toBe("DELIVERY_HUB_UNEXPECTED_ERROR")
    expect(payload.error.message).toContain("credentials")
  })

  it("returns controlled admin validation payload for missing required test quote fields", async () => {
    jest.spyOn(DeliveryHubService.prototype, "testQuote").mockRejectedValue(
      new DeliveryHubError({
        code: "DELIVERY_HUB_VALIDATION_ERROR",
        message: 'Field "connection_id" is required',
        status: 400,
        details: {
          field: "connection_id",
          token: "secret-token-123",
        },
      })
    )

    const res = createMockResponse()

    await deliveryTestQuoteRoute.POST(
      createMockRequest({
        url: "/admin/delivery/test-quote",
        validatedBody: {
          connection_id: "",
          mode_code: "warehouse_to_pickup_point",
          destination_point_id: "",
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: "DELIVERY_HUB_VALIDATION_ERROR",
        message: 'Field "connection_id" is required',
        details: {
          field: "connection_id",
          token: "***",
        },
      },
    })
  })

  it("returns controlled admin error payload for missing connection test entity", async () => {
    jest.spyOn(DeliveryHubService.prototype, "testConnection").mockRejectedValue(
      new DeliveryHubError({
        code: "DELIVERY_HUB_NOT_FOUND",
        message: "Delivery connection not found",
        status: 404,
        details: {
          entity: "connection",
          id: "conn_missing",
          token: "secret-token-123",
        },
      })
    )

    const res = createMockResponse()

    await deliveryConnectionTestRoute.POST(
      createMockRequest({
        url: "/admin/delivery/connections/conn_missing/test",
        validatedBody: {
          include_pickup_points: false,
        },
      }) as any,
      res as any
    )

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: "DELIVERY_HUB_NOT_FOUND",
        message: "Delivery connection not found",
        details: {
          entity: "connection",
          id: "conn_missing",
          token: "***",
        },
      },
    })
  })

  it("wires admin auth middleware for connection DELETE route", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs")
    const { resolve } = require("node:path") as typeof import("node:path")
    const middlewaresSource = readFileSync(
      resolve(process.cwd(), "src/api/middlewares.ts"),
      "utf8"
    )
    const adminPageSource = readFileSync(
      resolve(process.cwd(), "src/admin/routes/settings/delivery/page.tsx"),
      "utf8"
    )

    expect(middlewaresSource).toContain('matcher: "/admin/delivery/connections/:id"')
    expect(middlewaresSource).toContain('methods: ["DELETE"]')
    expect(adminPageSource).toContain("handleDeleteConnection")
    expect(adminPageSource).toContain('method: "DELETE"')
    expect(adminPageSource).toContain('variant="danger"')
    expect(adminPageSource).toContain("window.confirm")
  })

  it("wires admin auth middleware and query validation for pickup point lookup route", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs")
    const { resolve } = require("node:path") as typeof import("node:path")
    const middlewaresSource = readFileSync(
      resolve(process.cwd(), "src/api/middlewares.ts"),
      "utf8"
    )

    expect(middlewaresSource).toContain('matcher: "/admin/delivery/pickup-points"')
    expect(middlewaresSource).toContain("validateAndTransformQuery(AdminDeliveryPickupPointsQuerySchema")
    expect(middlewaresSource).toContain('matcher: "/admin/delivery/pickup-windows"')
    expect(middlewaresSource).toContain("validateAndTransformQuery(AdminDeliveryPickupWindowsQuerySchema")
  })

  it("wires admin auth middleware for shipping-option preview route", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs")
    const { resolve } = require("node:path") as typeof import("node:path")
    const middlewaresSource = readFileSync(
      resolve(process.cwd(), "src/api/middlewares.ts"),
      "utf8"
    )

    expect(middlewaresSource).toContain('matcher: "/admin/delivery/shipping-options/preview"')
    expect(middlewaresSource).toMatch(
      /matcher:\s*"\/admin\/delivery\/shipping-options\/preview"[\s\S]*?methods:\s*\["GET"\][\s\S]*?middlewares:\s*\[adminAuth\]/
    )
  })

  it("wires admin auth middleware for fulfillment bridge preview route", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs")
    const { resolve } = require("node:path") as typeof import("node:path")
    const middlewaresSource = readFileSync(
      resolve(process.cwd(), "src/api/middlewares.ts"),
      "utf8"
    )

    expect(middlewaresSource).toContain('matcher: "/admin/delivery/fulfillment-bridge/preview"')
    expect(middlewaresSource).toMatch(
      /matcher:\s*"\/admin\/delivery\/fulfillment-bridge\/preview"[\s\S]*?methods:\s*\["GET"\][\s\S]*?middlewares:\s*\[adminAuth\]/
    )
  })

  it("wires admin auth middleware for execution-plan preview route", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs")
    const { resolve } = require("node:path") as typeof import("node:path")
    const middlewaresSource = readFileSync(
      resolve(process.cwd(), "src/api/middlewares.ts"),
      "utf8"
    )

    expect(middlewaresSource).toContain('matcher: "/admin/delivery/execution-plan/preview"')
    expect(middlewaresSource).toMatch(
      /matcher:\s*"\/admin\/delivery\/execution-plan\/preview"[\s\S]*?methods:\s*\["GET"\][\s\S]*?middlewares:\s*\[adminAuth\]/
    )
  })

  it("wires admin auth middleware and body validation for shipping-option manual sync route", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs")
    const { resolve } = require("node:path") as typeof import("node:path")
    const middlewaresSource = readFileSync(
      resolve(process.cwd(), "src/api/middlewares.ts"),
      "utf8"
    )

    expect(middlewaresSource).toContain('matcher: "/admin/delivery/shipping-options/sync"')
    expect(middlewaresSource).toMatch(
      /matcher:\s*"\/admin\/delivery\/shipping-options\/sync"[\s\S]*?methods:\s*\["POST"\][\s\S]*?middlewares:\s*\[adminAuth, validateAndTransformBody\(AdminDeliveryShippingOptionManualSyncSchema\)\]/
    )
  })
})

describe("Delivery Hub admin shared helpers", () => {
  it("extracts connection or warehouse id from params or route path", () => {
    expect(
      deliveryShared.getRouteParam(
        createMockRequest({
          url: "/admin/delivery/connections/conn_from_path/test",
        }) as any,
        "id"
      )
    ).toBe("conn_from_path")

    expect(
      deliveryShared.getRouteParam(
        createMockRequest({
          url: "/admin/delivery/warehouses/wh_from_path",
        }) as any,
        "id"
      )
    ).toBe("wh_from_path")

    expect(
      deliveryShared.getRouteParam(
        createMockRequest({
          params: { id: "conn_from_params" },
        }) as any,
        "id"
      )
    ).toBe("conn_from_params")
  })

  it("serializes delivery hub errors with stable error shape and correlation details", () => {
    const error = new DeliveryHubError({
      code: "DELIVERY_HUB_VALIDATION_ERROR",
      message: 'Field "warehouse_id" is required',
      status: 400,
      details: {
        field: "warehouse_id",
        correlation_id: "corr-error-shape",
      },
    })
    const res = createMockResponse()

    deliveryShared.handleDeliveryHubError(res as any, error)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: "DELIVERY_HUB_VALIDATION_ERROR",
        message: 'Field "warehouse_id" is required',
        details: {
          field: "warehouse_id",
          correlation_id: "corr-error-shape",
        },
      },
    })
  })

  it("redacts token-like details before returning admin error payload", () => {
    const error = new DeliveryHubError({
      code: "DELIVERY_HUB_PROVIDER_ERROR",
      message: "Provider request failed",
      status: 502,
      details: {
        request: {
          headers: {
            Authorization: "Bearer secret-token-123",
            xApiKey: "api-key-456",
          },
        },
        response: {
          body: '{"access_token":"secret-token-123"}',
        },
      },
    })
    const res = createMockResponse()

    deliveryShared.handleDeliveryHubError(res as any, error)

    expect(res.status).toHaveBeenCalledWith(502)
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: {
        code: "DELIVERY_HUB_PROVIDER_ERROR",
        message: "Provider request failed",
        details: {
          request: {
            headers: {
              Authorization: "***",
              xApiKey: "***",
            },
          },
          response: {
            body: '{"access_token":"***"}',
          },
        },
      },
    })
  })
})

function createMockRequest(input?: Record<string, unknown>) {
  return {
    url: "/admin/delivery/connections",
    validatedBody: {},
    validatedQuery: {},
    params: {},
    scope: {
      resolve: jest.fn(() => ({ raw: jest.fn() })),
    },
    ...input,
  }
}

function createMockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }
}
