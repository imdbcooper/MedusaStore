import { describe, expect, it } from "@jest/globals"
import { DeliveryHubError } from "../../modules/delivery-hub/errors"
import { DELIVERY_HUB_MODE_CODE } from "../../modules/delivery-hub/constants"
import {
  buildYandexCreateShipmentDispatchRequest,
  executeYandexCreateShipmentDispatch,
  type YandexCreateShipmentDispatchClientLike,
  YANDEX_CREATE_SHIPMENT_API_PATH,
} from "../../modules/delivery-hub/adapters/yandex/create-shipment-dispatch-port"

describe("Yandex create-shipment dispatch port executable layer", () => {
  it("builds executable warehouse-mode request payload from backend-only inputs", () => {
    const result = buildYandexCreateShipmentDispatchRequest(buildValidWarehouseInput())

    expect(result.status).toBe("ready")
    expect(result.blocked_reasons).toEqual([])
    expect(result.request).toEqual({
      version: 1,
      provider_code: "yandex",
      operation: "create_shipment",
      mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
      path: YANDEX_CREATE_SHIPMENT_API_PATH,
      correlation_id: "corr_dispatch_wh_123456",
      request_payload: {
        source: {
          platform_station: {
            platform_id: "yandex_warehouse_77",
          },
          interval_utc: {
            from: "2026-04-23T07:00:00.000Z",
            to: "2026-04-23T11:00:00.000Z",
          },
        },
        destination: {
          platform_station: {
            platform_id: "pvz_destination_77",
          },
        },
        recipient: {
          full_name: "Ivan Petrov",
          email: "ivan@example.com",
          phone: "+79990000010",
        },
        items: [
          {
            title: "Test product",
            sku: "sku-1",
            quantity: 1,
            price: 1499,
            assessed_unit_price: 1499,
            currency: "RUB",
            weight: 500,
          },
        ],
        places: [
          {
            reference: "pkg_123456",
            weight: 500,
            dimensions: {
              length: 20,
              width: 10,
              height: 5,
            },
            items: [
              {
                title: "Test product",
                sku: "sku-1",
                quantity: 1,
                price: 1499,
                assessed_unit_price: 1499,
                currency: "RUB",
                weight: 500,
              },
            ],
          },
        ],
        contact: {
          email: "ivan@example.com",
          phone: "+79990000010",
        },
        route: {
          destination: {
            address: {
              country_code: "RU",
              locality: "Moscow",
              region: "Moscow",
              postal_code: "101000",
              address_line: "Tverskaya 1",
            },
          },
        },
        external_order_id: "order_123456",
        order_reference: "ext-order-warehouse-1",
        display_order_id: "42",
        currency: "RUB",
        total_assessed_value: 1499,
        comment: "pickup:PVZ 77 | connection:conn_wh_1",
      },
    })
  })

  it("builds executable dropoff-mode request payload from backend-only inputs", () => {
    const result = buildYandexCreateShipmentDispatchRequest(buildValidDropoffInput())

    expect(result.status).toBe("ready")
    expect(result.request).toEqual(
      expect.objectContaining({
        mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
        correlation_id: "corr_dispatch_dropoff_654321",
        request_payload: expect.objectContaining({
          source: {
            platform_station: {
              platform_id: "dropoff_origin_42",
            },
          },
          destination: {
            platform_station: {
              platform_id: "pvz_destination_42",
            },
          },
          recipient: {
            full_name: "Maria Ivanova",
            email: undefined,
            phone: "+79990000042",
          },
          items: [
            expect.objectContaining({
              sku: "sku-dropoff-1",
              quantity: 2,
              assessed_unit_price: 999,
            }),
          ],
          places: [
            expect.objectContaining({
              reference: "pkg_dropoff_1",
            }),
          ],
          external_order_id: "order_dropoff_42",
          order_reference: "order_dropoff_42",
          display_order_id: "108",
          currency: "RUB",
          total_assessed_value: 1998,
          comment: "pickup:PVZ 42 | connection:conn_dropoff_1",
        }),
      })
    )
    expect(result.request?.request_payload.source).not.toHaveProperty("interval_utc")
  })

  it("executes create_shipment success path through mocked Yandex client post", async () => {
    const requestResult = buildYandexCreateShipmentDispatchRequest(buildValidDropoffInput())
    if (requestResult.status !== "ready") {
      throw new Error("Expected ready request for success-path test")
    }

    const successClient = createMockPostSuccess({
      data: {
        shipment_id: "shipment_123456789",
        request_id: "provider_corr_123456789",
        labels: [{ url: "https://example.test/label.pdf" }],
        documents: [{ url: "https://example.test/act.pdf" }],
      },
    })

    const result = await executeYandexCreateShipmentDispatch({
      client: { post: successClient.post },
      request: requestResult.request,
    })

    expect(successClient.calls).toEqual([
      [
        YANDEX_CREATE_SHIPMENT_API_PATH,
        requestResult.request.request_payload,
        "corr_dispatch_dropoff_654321",
      ],
    ])
    expect(result).toEqual({
      version: 1,
      provider_code: "yandex",
      operation: "create_shipment",
      attempted: true,
      accepted: true,
      succeeded: true,
      status_category: "accepted",
      provider_status_code: null,
      correlation_id_present: true,
      correlation_id_masked: "pr***89",
      provider_shipment_reference_present: true,
      provider_shipment_reference_masked: "sh***89",
      label_available: true,
      documents_available: true,
      blocked_reason_code: null,
      blocked_reason: null,
      error_code: null,
      redacted: true,
      credentials_included: false,
      auth_headers_included: false,
      raw_provider_request_included: false,
      raw_provider_response_included: false,
      raw_execution_token_included: false,
      raw_quote_key_included: false,
    })
  })

  it("normalizes provider failure without leaking request or response internals", async () => {
    const requestResult = buildYandexCreateShipmentDispatchRequest(buildValidWarehouseInput())
    if (requestResult.status !== "ready") {
      throw new Error("Expected ready request for failure-path test")
    }

    const post = createMockPostFailure(
      new DeliveryHubError({
        code: "DELIVERY_HUB_PROVIDER_ERROR",
        message: "Yandex Delivery request failed with status 422",
        status: 502,
        details: {
          provider_status: 422,
          error_category: "provider_rejected",
          correlation_id: "provider_corr_failed_9999",
          request: {
            path: "/shipments/create",
            headers: {
              Authorization: "Bearer secret-token",
            },
            payload: {
              quote_key: "raw_quote_key_should_not_leak",
            },
          },
          response: {
            shipment_id: "provider_rejected_shipment_7777",
            label_url: "https://example.test/failed-label.pdf",
            quote_key: "raw_quote_key_should_not_leak",
            body: "Authorization: Bearer secret-token",
          },
        },
      })
    )

    const result = await executeYandexCreateShipmentDispatch({
      client: { post },
      request: requestResult.request,
    })

    expect(result).toEqual({
      version: 1,
      provider_code: "yandex",
      operation: "create_shipment",
      attempted: true,
      accepted: false,
      succeeded: false,
      status_category: "provider_rejected",
      provider_status_code: 422,
      correlation_id_present: true,
      correlation_id_masked: "pr***99",
      provider_shipment_reference_present: true,
      provider_shipment_reference_masked: "pr***77",
      label_available: true,
      documents_available: false,
      blocked_reason_code: null,
      blocked_reason: null,
      error_code: "DELIVERY_HUB_PROVIDER_ERROR",
      redacted: true,
      credentials_included: false,
      auth_headers_included: false,
      raw_provider_request_included: false,
      raw_provider_response_included: false,
      raw_execution_token_included: false,
      raw_quote_key_included: false,
    })
  })

  it("keeps normalized dispatch result redacted on both success and failure", async () => {
    const requestResult = buildYandexCreateShipmentDispatchRequest(buildValidWarehouseInput())
    if (requestResult.status !== "ready") {
      throw new Error("Expected ready request for anti-leak test")
    }

    const antiLeakSuccessClient = createMockPostSuccess({
      shipment_id: "shipment_secret_123456",
      request_id: "corr_secret_654321",
      body: "Authorization: Bearer super-secret",
      quote_key: "raw_quote_key_should_not_leak",
    })

    const success = await executeYandexCreateShipmentDispatch({
      client: {
        post: antiLeakSuccessClient.post,
      },
      request: requestResult.request,
    })

    const failure = await executeYandexCreateShipmentDispatch({
      client: {
        post: createMockPostFailure(
          new DeliveryHubError({
            code: "DELIVERY_HUB_PROVIDER_ERROR",
            message: "provider unavailable",
            details: {
              provider_status: 503,
              error_category: "provider_unavailable",
              correlation_id: "corr_secret_654321",
              request: {
                headers: { Authorization: "Bearer super-secret" },
                payload: { quote_key: "raw_quote_key_should_not_leak" },
              },
              response: {
                body: "Authorization: Bearer super-secret",
                token: "raw_execution_token_should_not_leak",
              },
            },
          })
        ),
      },
      request: requestResult.request,
    })

    for (const result of [success, failure]) {
      const json = JSON.stringify(result)

      expect(json).not.toContain("Bearer")
      expect(json).not.toContain("Authorization")
      expect(json).not.toContain("super-secret")
      expect(json).not.toContain("raw_quote_key_should_not_leak")
      expect(json).not.toContain("raw_execution_token_should_not_leak")
      expect(json).not.toContain("shipment_secret_123456")
      expect(json).not.toContain("corr_secret_654321")
      expect(result).toEqual(
        expect.objectContaining({
          redacted: true,
          credentials_included: false,
          auth_headers_included: false,
          raw_provider_request_included: false,
          raw_provider_response_included: false,
          raw_execution_token_included: false,
          raw_quote_key_included: false,
        })
      )
    }
  })
})

function createMockPostSuccess(value: Record<string, unknown>) {
  const calls: Array<[string, Record<string, unknown>, string]> = []
  const post = (async (path: string, payload: Record<string, unknown>, correlationId: string) => {
    calls.push([path, payload, correlationId])
    return value
  }) as YandexCreateShipmentDispatchClientLike["post"]

  return {
    post,
    calls,
  }
}

function createMockPostFailure(error: unknown): YandexCreateShipmentDispatchClientLike["post"] {
  return (async () => {
    throw error
  }) as YandexCreateShipmentDispatchClientLike["post"]
}

function buildValidWarehouseInput() {
  return {
    mode: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
    provider_origin_dispatch_context: {
      mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
      provider_warehouse_id: "yandex_warehouse_77",
    },
    destination_pickup_point: {
      provider_point_id: "pvz_destination_77",
      provider_point_code: "PVZ-77",
      name: "PVZ 77",
      address: "Tverskaya 1",
      city: "Moscow",
    },
    pickup_interval_utc: {
      from: "2026-04-23T07:00:00.000Z",
      to: "2026-04-23T11:00:00.000Z",
    },
    order: {
      order_id: "order_123456",
      external_order_reference: "ext-order-warehouse-1",
      display_id: 42,
      currency_code: "RUB",
      total: 1499,
    },
    recipient: {
      full_name: "Ivan Petrov",
      email: "ivan@example.com",
      phone: "+79990000010",
    },
    address: {
      country_code: "RU",
      city: "Moscow",
      region: "Moscow",
      postal_code: "101000",
      address_line: "Tverskaya 1",
    },
    packages: [
      {
        package_reference: "pkg_123456",
        weight_grams: 500,
        length_cm: 20,
        width_cm: 10,
        height_cm: 5,
        items: [
          {
            title: "Test product",
            sku: "sku-1",
            quantity: 1,
            price: 1499,
            currency_code: "RUB",
            weight_grams: 500,
          },
        ],
      },
    ],
    connection: {
      connection_id: "conn_wh_1",
      provider_code: "yandex",
      mode: "live",
      provider_account_reference: "account_wh_1",
    },
    quote_reference: {
      id: "dhsel_t1_backend_exec_ref_warehouse",
      version: 1,
    },
    correlation_id: "corr_dispatch_wh_123456",
  }
}

function buildValidDropoffInput() {
  return {
    mode: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
    provider_origin_dispatch_context: {
      mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
      origin_point_id: "dropoff_origin_42",
    },
    destination_pickup_point: {
      provider_point_id: "pvz_destination_42",
      provider_point_code: "PVZ-42",
      name: "PVZ 42",
      address: "Nevsky 10",
      city: "Saint Petersburg",
    },
    pickup_interval_utc: null,
    order: {
      order_id: "order_dropoff_42",
      display_id: 108,
      currency_code: "RUB",
      total: 1998,
    },
    recipient: {
      first_name: "Maria",
      last_name: "Ivanova",
      email: null,
      phone: "+79990000042",
    },
    address: {
      country_code: "RU",
      city: "Saint Petersburg",
      region: "Leningrad Oblast",
      postal_code: "190000",
      address_line: "Nevsky 10",
    },
    packages: [
      {
        package_reference: "pkg_dropoff_1",
        weight_grams: 800,
        length_cm: 30,
        width_cm: 15,
        height_cm: 10,
        items: [
          {
            title: "Dropoff product",
            sku: "sku-dropoff-1",
            quantity: 2,
            price: 999,
            currency_code: "RUB",
            weight_grams: 400,
          },
        ],
      },
    ],
    connection: {
      connection_id: "conn_dropoff_1",
      provider_code: "yandex",
      mode: "test",
      provider_account_reference: "account_dropoff_1",
    },
    quote_reference: {
      id: "dhsel_t1_backend_exec_ref_dropoff",
      version: 1,
    },
    correlation_id: "corr_dispatch_dropoff_654321",
  }
}
