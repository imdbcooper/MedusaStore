import { describe, expect, it, jest } from "@jest/globals"
import { MedusaError } from "@medusajs/framework/utils"
import { DeliveryHubFulfillmentProvider } from "../../modules/deliveryhub"
import { DELIVERY_HUB_MODE_CODE } from "../../modules/delivery-hub/constants"
import { createDeliveryHubQuoteReference } from "../../modules/delivery-hub/cart-selection"

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}

describe("Delivery Hub provider validation seam", () => {
  it("keeps validateFulfillmentData and createFulfillment aligned for valid input while preserving execution block", async () => {
    const provider = buildProvider()
    const optionData = buildValidOptionData()
    const fulfillmentData = buildValidFulfillmentData()

    await expect(provider.validateFulfillmentData(optionData, fulfillmentData)).resolves.toEqual(
      expect.objectContaining({
        ...fulfillmentData,
        quote_reference: expect.objectContaining(fulfillmentData.quote_reference),
      })
    )

    await expect(
      provider.createFulfillment(
        fulfillmentData,
        [
          {
            line_item_id: "item_1",
            quantity: 1,
          },
        ],
        {
          id: "order_1",
          display_id: 42,
          currency_code: "RUB",
        },
        {
          id: "ful_1",
          location_id: "sloc_1",
        }
      )
    ).rejects.toThrow(
      "Delivery Hub shipment automation is not materialized in the current provider scaffold; order-side diagnostics validate backend bridge input only."
    )
    const executionPreviewLog = logger.info.mock.calls.find((call) =>
      String(call[0]).includes("execution-plan preview seam evaluated")
    )

    await expect(executionPreviewLog).toBeDefined()
    expect(String(executionPreviewLog?.[0])).toContain('"execution_status":"blocked"')
    expect(String(executionPreviewLog?.[0])).toContain('"readiness_status":"ready"')
    await expect(
      logger.info.mock.calls.some((call) =>
        String(call[0]).includes("execution-plan preview seam evaluated")
      )
    ).toBe(true)
  })
 
  it("blocks missing required fulfillment fragment through the same validation verdict", async () => {
    const provider = buildProvider()
    const optionData = buildValidOptionData()
    const fulfillmentData = {
      ...buildValidFulfillmentData(),
      quote: {
        ...buildValidFulfillmentData().quote,
        currency_code: "",
      },
    }

    await expect(provider.validateFulfillmentData(optionData, fulfillmentData)).rejects.toThrow(
      'Delivery Hub fulfillment data is blocked: Delivery Hub field "quote.currency_code" is required.'
    )

    await expect(
      provider.createFulfillment(
        fulfillmentData,
        [
          {
            line_item_id: "item_1",
            quantity: 1,
          },
        ],
        {
          id: "order_1",
          display_id: 42,
          currency_code: "RUB",
        },
        {
          id: "ful_1",
          location_id: "sloc_1",
        }
      )
    ).rejects.toThrow(
      'Delivery Hub createFulfillment input is blocked: Delivery Hub field "quote.currency_code" is required.; Shipment execution remains intentionally unavailable; diagnostics validate payload assembly and block live shipment automation.'
    )
  })

  it("blocks provider and shape drift through the same normalized diagnostic seam", async () => {
    const provider = buildProvider()
    const optionData = {
      id: "foreign:pickup",
      provider_code: "foreign_provider",
      provider_id: "fp_foreign",
      mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
    }
    const fulfillmentData = {
      provider_code: "foreign_provider",
      delivery: {
        version: 1,
        option: {
          id: "foreign:pickup",
        },
      },
    }

    await expect(provider.validateFulfillmentData(optionData, fulfillmentData)).rejects.toMatchObject({
      type: MedusaError.Types.INVALID_DATA,
      message: expect.stringContaining("Delivery Hub fulfillment data is blocked:"),
    })

    await expect(
      provider.createFulfillment(
        fulfillmentData,
        [
          {
            line_item_id: "item_1",
            quantity: 1,
          },
        ],
        {
          id: "order_1",
          display_id: 42,
          currency_code: "RUB",
        },
        {
          id: "ful_1",
          location_id: "sloc_1",
        }
      )
    ).rejects.toMatchObject({
      type: MedusaError.Types.INVALID_DATA,
      message: expect.stringContaining("Delivery Hub createFulfillment input is blocked:"),
    })

    await expect(provider.validateFulfillmentData(optionData, fulfillmentData)).rejects.toMatchObject({
      type: MedusaError.Types.INVALID_DATA,
      message: expect.stringContaining('Delivery Hub option_data.provider_code expected "deliveryhub" but received "foreign_provider".'),
    })
  })
})

function buildProvider() {
  return new DeliveryHubFulfillmentProvider({
    logger: logger as never,
  })
}

function buildValidOptionData() {
  return {
    id: "deliveryhub:dropoff_point_to_pickup_point",
    provider_code: "deliveryhub",
    provider_id: "deliveryhub_deliveryhub",
    mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
  }
}

function buildValidFulfillmentData() {
  return {
    version: 1,
    connection_id: "conn_ready",
    mode_code: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
    quote_reference: createDeliveryHubQuoteReference({
      connection_id: "conn_ready",
      quote_type: DELIVERY_HUB_MODE_CODE.dropoffPointToPickupPoint,
      quote_key: "quote_provider_validation",
    }),
    quote: {
      carrier_code: "yandex",
      carrier_label: "Yandex Delivery",
      amount: 299,
      currency_code: "RUB",
      delivery_eta_min: 1,
      delivery_eta_max: 1,
      pickup_point_required: true,
      pickup_window_required: false,
    },
    pickup_point: {
      provider_point_id: "pvz_2",
      provider_point_code: "code_2",
      name: "PVZ 2",
      address: "Arbat 10",
      city: "Moscow",
      region: "Moscow",
      postal_code: "119019",
      lat: 55.75,
      lng: 37.6,
      is_origin_dropoff_allowed: true,
      is_destination_pickup_allowed: true,
      payment_methods: ["card"],
    },
    pickup_window: null,
  }
}
