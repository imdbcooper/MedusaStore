import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import * as deliveryConnectionsRoute from "../../api/admin/delivery/connections/route"
import * as deliveryConnectionTestRoute from "../../api/admin/delivery/connections/[id]/test/route"
import * as deliveryShared from "../../api/admin/delivery/shared"
import * as deliveryTestQuoteRoute from "../../api/admin/delivery/test-quote/route"
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

  it("creates connection and returns admin contract payload", async () => {
    const body = {
      provider_code: "yandex",
      name: "Yandex test",
      mode: "test",
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
      },
      quotes: [
        {
          quote_key: "quote_1",
          price: 499,
        },
      ],
      correlation_id: "corr-test-quote",
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
})

describe("Delivery Hub admin shared helpers", () => {
  it("extracts connection id from params or route path", () => {
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

function createMockRequest(input?: {
  url?: string
  validatedBody?: Record<string, unknown>
  params?: Record<string, string>
}) {
  return {
    scope: {
      resolve: jest.fn(() => ({
        raw: async () => ({ rows: [] }),
      })),
    },
    url: input?.url ?? "/admin/delivery",
    validatedBody: input?.validatedBody ?? {},
    params: input?.params,
  }
}

function createMockResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }
}
