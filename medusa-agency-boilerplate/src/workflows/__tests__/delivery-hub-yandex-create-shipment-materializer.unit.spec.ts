import { describe, expect, it } from "@jest/globals"
import { DELIVERY_HUB_MODE_CODE } from "../../modules/delivery-hub/constants"
import { materializeYandexCreateShipmentPayloadPreview } from "../../modules/delivery-hub/adapters/yandex/create-shipment-materializer"

describe("Yandex create-shipment payload materializer", () => {
  it("materializes a ready redacted warehouse-to-PVZ payload preview", () => {
    const result = materializeYandexCreateShipmentPayloadPreview(buildValidWarehouseInput())

    expect(result.status).toBe("ready")
    expect(result.blocked_reasons).toEqual([])
    expect(result.preview).toEqual(
      expect.objectContaining({
        provider_code: "yandex",
        operation: "create_shipment",
        redacted: true,
        network_dispatch_performed: false,
        credentials_included: false,
        auth_headers_included: false,
        raw_execution_token_included: false,
        raw_provider_payload_included: false,
        payload: expect.objectContaining({
          source: {
            type: "warehouse",
            provider_warehouse_id: "ya***77",
            origin_point_id: null,
          },
          destination: expect.objectContaining({
            pickup_point_id: "pv***77",
          }),
          pickup_interval_utc: {
            from: "2026-04-23T07:00:00.000Z",
            to: "2026-04-23T11:00:00.000Z",
          },
          recipient_contact: {
            name_present: true,
            email: "i***@example.com",
            phone: "+7***10",
          },
        }),
      })
    )
  })

  it("materializes a ready redacted dropoff-to-PVZ payload preview", () => {
    const result = materializeYandexCreateShipmentPayloadPreview(buildValidDropoffInput())

    expect(result.status).toBe("ready")
    expect(result.preview?.payload.source).toEqual({
      type: "dropoff_point",
      provider_warehouse_id: null,
      origin_point_id: "dr***42",
    })
    expect(result.preview?.payload.pickup_interval_utc).toBeNull()
  })

  it("blocks warehouse mode with dropoff origin context", () => {
    const result = materializeYandexCreateShipmentPayloadPreview({
      ...buildValidWarehouseInput(),
      provider_origin_dispatch_context: {
        mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
        origin_point_id: "dropoff_wrong",
      },
    })

    expect(result.status).toBe("blocked")
    expect(result.blocked_reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "wrong_origin_context_for_mode" }),
      ])
    )
    expect(result.preview).toBeNull()
  })

  it("blocks dropoff mode with warehouse origin context", () => {
    const result = materializeYandexCreateShipmentPayloadPreview({
      ...buildValidDropoffInput(),
      provider_origin_dispatch_context: {
        mode_code: DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint,
        provider_warehouse_id: "warehouse_wrong",
      },
    })

    expect(result.status).toBe("blocked")
    expect(result.blocked_reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "wrong_origin_context_for_mode" }),
      ])
    )
  })

  it("blocks missing destination pickup point", () => {
    const result = materializeYandexCreateShipmentPayloadPreview({
      ...buildValidWarehouseInput(),
      destination_pickup_point: {
        provider_point_id: " ",
        name: "PVZ",
      },
    })

    expect(result.status).toBe("blocked")
    expect(result.blocked_reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing_destination_pickup_point" }),
      ])
    )
  })

  it("blocks missing pickup interval/window for warehouse mode", () => {
    const result = materializeYandexCreateShipmentPayloadPreview({
      ...buildValidWarehouseInput(),
      pickup_interval_utc: null,
    })

    expect(result.status).toBe("blocked")
    expect(result.blocked_reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing_pickup_interval_window" }),
      ])
    )
  })

  it("blocks missing recipient/contact", () => {
    const result = materializeYandexCreateShipmentPayloadPreview({
      ...buildValidWarehouseInput(),
      recipient: {
        full_name: "Ivan Petrov",
        email: " ",
        phone: null,
      },
    })

    expect(result.status).toBe("blocked")
    expect(result.blocked_reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing_recipient_contact" }),
      ])
    )
  })

  it("blocks missing package/items", () => {
    const result = materializeYandexCreateShipmentPayloadPreview({
      ...buildValidWarehouseInput(),
      packages: [
        {
          package_reference: "pkg-empty",
          items: [],
        },
      ],
    })

    expect(result.status).toBe("blocked")
    expect(result.blocked_reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing_package_items" }),
      ])
    )
  })

  it("does not leak secret/auth header/raw execution token/raw provider payload values in preview JSON", () => {
    const result = materializeYandexCreateShipmentPayloadPreview({
      ...buildValidWarehouseInput(),
      connection: {
        connection_id: "conn_secret_should_be_masked",
        provider_code: "yandex",
        mode: "live",
        provider_account_reference: "account_secret_should_be_masked",
      },
      quote_reference: {
        id: "dhsel_t1_raw_execution_token_should_not_appear",
        version: 1,
      },
      correlation_id: "corr_secret_should_be_masked",
      packages: [
        {
          package_reference: "pkg_secret_should_be_masked",
          weight_grams: 500,
          items: [
            {
              title: "Test product",
              sku: "sku_secret_should_be_masked",
              quantity: 1,
              price: 1000,
              currency_code: "RUB",
              weight_grams: 500,
            },
          ],
        },
      ],
    })

    expect(result.status).toBe("ready")
    const json = JSON.stringify(result.preview)

    expect(json).not.toContain("secret-token")
    expect(json).not.toContain("Authorization")
    expect(json).not.toContain("Bearer")
    expect(json).not.toContain("x-api-key")
    expect(json).not.toContain("raw_execution_token_should_not_appear")
    expect(json).not.toContain("raw provider payload secret")
    expect(json).not.toContain("provider_offer_id")
    expect(json).not.toContain("conn_secret_should_be_masked")
    expect(json).not.toContain("account_secret_should_be_masked")
    expect(json).not.toContain("corr_secret_should_be_masked")
    expect(json).not.toContain("pkg_secret_should_be_masked")
    expect(json).not.toContain("sku_secret_should_be_masked")
    expect(result.preview).toEqual(
      expect.objectContaining({
        credentials_included: false,
        auth_headers_included: false,
        raw_execution_token_included: false,
        raw_provider_payload_included: false,
      })
    )
  })
})

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
            sku: "sku_123456",
            quantity: 1,
            price: 1499,
            currency_code: "RUB",
            weight_grams: 500,
          },
        ],
      },
    ],
    connection: {
      connection_id: "conn_123456",
      provider_code: "yandex",
      mode: "test",
      provider_account_reference: "account_123456",
    },
    quote_reference: {
      id: "dhsel_0123456789abcdef0123456789abcdef",
      version: 1,
    },
    correlation_id: "corr_123456",
  }
}

function buildValidDropoffInput() {
  return {
    ...buildValidWarehouseInput(),
    mode: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
    provider_origin_dispatch_context: {
      mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
      origin_point_id: "dropoff_origin_42",
    },
    pickup_interval_utc: null,
  }
}
