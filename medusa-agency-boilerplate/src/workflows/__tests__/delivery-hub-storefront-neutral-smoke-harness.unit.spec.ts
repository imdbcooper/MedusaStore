import { afterEach, describe, expect, it, jest } from "@jest/globals"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import deliveryHubStorefrontNeutralSmoke, {
  buildDeliveryHubStorefrontNeutralSmokeSafeSummary,
  parseDeliveryHubStorefrontNeutralSmokeArgs,
  resolveDeliveryHubStorefrontNeutralSmokeInputs,
  runDeliveryHubStorefrontNeutralSmoke,
} from "../../scripts/delivery-hub-storefront-neutral-smoke"

const originalFetch = global.fetch
const mockCreateApiKeysWorkflowRun = jest.fn(async () => ({
  result: [
    {
      id: "apk_created",
      title: "Local Delivery Hub Store Smoke",
      token: "pk_created_secret_like_value",
    },
  ],
}))
const mockLinkSalesChannelsToApiKeyWorkflowRun = jest.fn(async () => ({ result: [] }))

jest.mock("@medusajs/medusa/core-flows", () => ({
  createApiKeysWorkflow: () => ({ run: mockCreateApiKeysWorkflowRun }),
  linkSalesChannelsToApiKeyWorkflow: () => ({ run: mockLinkSalesChannelsToApiKeyWorkflowRun }),
}))

const defaultKeyDiscovery = {
  attempted: false,
  source: "input_env_or_arg" as const,
  found: true,
  created: false,
  publishable_key_provided: true,
  publishable_key_value_printed: false as const,
  linked_sales_channel: null,
  existing_publishable_key_count: null,
  selected_key_title: null,
  error_code: null,
  error_message: null,
}

const defaultInputDiscovery = {
  attempted: false,
  connection_source: "input_env_or_arg" as const,
  warehouse_source: "not_required" as const,
  resolved_connection_id: "conn_1",
  resolved_warehouse_id: null,
}

describe("Delivery Hub storefront-neutral smoke harness", () => {
  afterEach(() => {
    jest.restoreAllMocks()
    global.fetch = originalFetch
    delete process.exitCode
  })

  it("runs quote then selection and prints only safe summary fields", async () => {
    const fetchMock = jest.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      const href = String(url)
      const requestBody = JSON.parse(String(init?.body ?? "{}"))

      if (href.endsWith("/store/delivery/quotes")) {
        expect(requestBody).toEqual({
          connection_id: "conn_1",
          mode_code: "dropoff_point_to_pickup_point",
          currency_code: "RUB",
          destination_point_id: "pvz_1",
          origin_point_id: "origin_1",
          warehouse_id: undefined,
          items: [
            {
              quantity: 1,
              weight_grams: 500,
              price: 2000,
            },
          ],
        })

        return buildJsonResponse(200, buildQuoteResponse())
      }

      if (href.endsWith("/store/delivery/selection")) {
        expect(requestBody).toEqual(
          expect.objectContaining({
            cart_id: "cart_1",
            connection_id: "conn_1",
            provider_code: "yandex",
            quote_type: "dropoff_point_to_pickup_point",
            quote_reference: {
              id: "dhsel_11111111111111111111111111111111",
              version: 1,
            },
            quote: {
              carrier_code: "yandex",
              carrier_label: "Yandex Delivery",
              amount: 181.9,
              currency_code: "RUB",
              delivery_eta_min: 3,
              delivery_eta_max: 4,
              pickup_point_required: true,
              pickup_window_required: false,
            },
            pickup_point: expect.objectContaining({
              provider_point_id: "pvz_1",
              name: "Smoke selected pickup point",
              address: "Smoke pickup point address placeholder",
              is_destination_pickup_allowed: true,
            }),
            pickup_window: null,
            correlation_id: "corr_quote_1",
          })
        )

        return buildJsonResponse(200, buildSelectionResponse())
      }

      throw new Error(`Unexpected URL: ${href}`)
    }) as unknown as typeof fetch

    global.fetch = fetchMock

    const result = await runDeliveryHubStorefrontNeutralSmoke(
      parseDeliveryHubStorefrontNeutralSmokeArgs([
        "--backend-url=http://localhost:9000",
        "--publishable-api-key=pk_test_secret_like_value",
        "--connection-id=conn_1",
        "--cart-id=cart_1",
        "--mode=dropoff_point_to_pickup_point",
        "--origin-point-id=origin_1",
        "--destination-point-id=pvz_1",
      ])
    )
    const summary = buildDeliveryHubStorefrontNeutralSmokeSafeSummary(result)

    expect(result.status).toBe("success")
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(summary.status).toBe("success")
    expect(summary.quote.quotes_count).toBe(1)
    expect(summary.quote.selected_quote_reference.id).toBe("dhsel_11111111111111111111111111111111")
    expect(summary.quote.selected_quote_price).toEqual({ amount: 181.9, currency_code: "RUB" })
    expect(summary.selection.saved).toBe(true)
    expect(summary.selection.checkout_source_of_truth).toBe("unchanged")
    expect(summary.diagnostics.source_of_truth_unchanged).toBe(true)

    expect(summary.harness.canonical_invocation).toBe("env_vars")

    const json = JSON.stringify(summary)
    expect(json).not.toContain("pk_test_secret_like_value")
    expect(json).not.toContain("Authorization")
    expect(json).not.toContain("Bearer ")
    expect(json).not.toContain("raw_reference")
    expect(json).not.toContain("quote_key")
    expect(json).not.toContain("provider_offer_id")
    expect(summary.safety.raw_provider_body_printed).toBe(false)
    expect(summary.safety.ciphertext_printed).toBe(false)
  })

  it("blocks missing required inputs before network calls", async () => {
    const fetchMock = jest.fn() as unknown as typeof fetch
    global.fetch = fetchMock

    const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined)

    await deliveryHubStorefrontNeutralSmoke({
      args: [
        "--connection-id=conn_1",
        "--cart-id=cart_1",
        "--mode=warehouse_to_pickup_point",
        "--destination-point-id=pvz_1",
      ],
      container: {} as never,
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(2)

    const output = JSON.parse(String(logSpy.mock.calls[0]?.[0] ?? "{}"))
    expect(output.status).toBe("blocked_missing_input")
    expect(output.error.message).toContain("warehouse-id")
    expect(output.safety.credential_values_printed).toBe(false)
    expect(output.safety.ciphertext_printed).toBe(false)
    expect(JSON.stringify(output)).not.toMatch(/authorization|raw_reference|quote_key/i)
  })

  it("supports env-var canonical invocation without printing publishable key value", () => {
    const args = parseDeliveryHubStorefrontNeutralSmokeArgs([], {
      DELIVERY_HUB_STORE_SMOKE_BACKEND_URL: "http://localhost:9000",
      MEDUSA_PUBLISHABLE_KEY: "pk_test_secret_like_value",
      DELIVERY_HUB_STORE_SMOKE_CONNECTION_ID: "conn_1",
      DELIVERY_HUB_STORE_SMOKE_CART_ID: "cart_1",
      DELIVERY_HUB_STORE_SMOKE_MODE: "dropoff_point_to_pickup_point",
      DELIVERY_HUB_STORE_SMOKE_ORIGIN_POINT_ID: "origin_1",
      DELIVERY_HUB_STORE_SMOKE_DESTINATION_POINT_ID: "pvz_1",
      DELIVERY_HUB_STORE_SMOKE_CURRENCY_CODE: "RUB",
      DELIVERY_HUB_STORE_SMOKE_ITEMS_JSON: '[{"quantity":1,"weight_grams":500,"price":2000}]',
    })

    const summary = buildDeliveryHubStorefrontNeutralSmokeSafeSummary({
      generated_at: "2026-04-27T00:00:00.000Z",
      input: args,
      key_discovery: defaultKeyDiscovery,
      input_discovery: defaultInputDiscovery,
      quote_http_status: null,
      quote_body: null,
      selection_http_status: null,
      selection_body: null,
      selected_quote: null,
      status: "blocked_missing_input",
      error: null,
    })

    expect(args.publishable_api_key).toBe("pk_test_secret_like_value")
    expect(summary.harness.canonical_invocation).toBe("env_vars")
    expect(summary.invocation.publishable_key_provided).toBe(true)
    expect(JSON.stringify(summary)).not.toContain("pk_test_secret_like_value")
  })

  it("keeps failed provider-like responses sanitized in summary", () => {
    const args = parseDeliveryHubStorefrontNeutralSmokeArgs([
      "--connection-id=conn_1",
      "--cart-id=cart_1",
      "--mode=dropoff_point_to_pickup_point",
      "--origin-point-id=origin_1",
      "--destination-point-id=pvz_1",
    ])

    const summary = buildDeliveryHubStorefrontNeutralSmokeSafeSummary({
      generated_at: "2026-04-27T00:00:00.000Z",
      input: args,
      key_discovery: defaultKeyDiscovery,
      input_discovery: defaultInputDiscovery,
      quote_http_status: 502,
      quote_body: {
        error: {
          code: "DELIVERY_HUB_PROVIDER_ERROR",
          message:
            "authorization: Bearer provider-secret-token token=raw-token ciphertext=sealed raw_reference provider_offer_id",
        },
      },
      selection_http_status: null,
      selection_body: null,
      selected_quote: null,
      status: "failed_quote_request",
      error: {
        stage: "quote",
        code: "DELIVERY_HUB_PROVIDER_ERROR",
        message:
          "authorization: Bearer provider-secret-token token=raw-token ciphertext=sealed raw_reference provider_offer_id",
      },
    })

    const json = JSON.stringify(summary)
    expect(json).toContain("authorization: *** *** token=*** ciphertext=***")
    expect(json).not.toContain("provider-secret-token")
    expect(json).not.toContain("raw-token")
    expect(json).not.toContain("sealed raw_reference")
    expect(summary.safety.checkout_cutover_performed).toBe(false)
    expect(summary.safety.shipment_create_cancel_status_retry_performed).toBe(false)
    expect(summary.safety.api_ship_or_legacy_provider_touched).toBe(false)
  })
  it("surfaces top-level Medusa store middleware 400 safely", async () => {
    global.fetch = jest.fn(async (url: URL | RequestInfo) => {
      const href = String(url)

      if (href.endsWith("/store/delivery/quotes")) {
        return buildJsonResponse(400, {
          type: "not_allowed",
          message: "Publishable API key required in the request header: x-publishable-api-key. You can manage your keys in settings in the dashboard.",
        })
      }

      throw new Error(`Unexpected URL: ${href}`)
    }) as unknown as typeof fetch

    const result = await runDeliveryHubStorefrontNeutralSmoke(
      parseDeliveryHubStorefrontNeutralSmokeArgs([
        "--connection-id=conn_1",
        "--cart-id=cart_1",
        "--mode=dropoff_point_to_pickup_point",
        "--origin-point-id=origin_1",
        "--destination-point-id=pvz_1",
      ])
    )
    const summary = buildDeliveryHubStorefrontNeutralSmokeSafeSummary(result)

    expect(result.status).toBe("failed_quote_request")
    expect(result.quote_http_status).toBe(400)
    expect(result.error).toEqual(expect.objectContaining({
      stage: "quote",
      code: "not_allowed",
      type: "not_allowed",
      message: expect.stringContaining("Publishable API key required"),
    }))
    expect(summary.error).toEqual({
      stage: "quote",
      code: "not_allowed",
      message: expect.stringContaining("Publishable API key required"),
    })
    const summaryJson = JSON.stringify(summary)
    expect(summaryJson).not.toContain("Bearer ")
    expect(summaryJson).not.toContain("authorization:")
    expect(summaryJson).not.toContain("ciphertext=")
    expect(summaryJson).not.toMatch(/raw_reference|quote_key|provider_offer_id/i)
    expect(summary.safety.request_headers_printed).toBe(false)
  })

  it("discovers an existing publishable key in memory without exposing its value", async () => {
    const resolution = await resolveDeliveryHubStorefrontNeutralSmokeInputs(
      parseDeliveryHubStorefrontNeutralSmokeArgs([
        "--connection-id=conn_1",
        "--cart-id=cart_1",
        "--mode=dropoff_point_to_pickup_point",
        "--origin-point-id=origin_1",
        "--destination-point-id=pvz_1",
      ]),
      buildContainer({
        apiKeys: [
          {
            id: "apk_existing",
            title: "Webshop",
            token: "pk_test_secret_like_value",
          },
        ],
        salesChannels: [{ id: "sc_default", name: "Default Sales Channel" }],
      }) as never
    )

    expect(resolution.key_discovery.error_message).toBeNull()
    expect(resolution.input.publishable_api_key).toBe("pk_test_secret_like_value")
    expect(resolution.key_discovery).toEqual(expect.objectContaining({
      source: "existing_publishable_key",
      found: true,
      created: false,
      publishable_key_provided: true,
      publishable_key_value_printed: false,
      linked_sales_channel: true,
      existing_publishable_key_count: 1,
      selected_key_title: "Webshop",
    }))
    expect(JSON.stringify(resolution.key_discovery)).not.toContain("pk_test_secret_like_value")
  })

  it("creates a local publishable key only when none exists and keeps output value-free", async () => {
    const resolution = await resolveDeliveryHubStorefrontNeutralSmokeInputs(
      parseDeliveryHubStorefrontNeutralSmokeArgs([
        "--connection-id=conn_1",
        "--cart-id=cart_1",
        "--mode=dropoff_point_to_pickup_point",
        "--origin-point-id=origin_1",
        "--destination-point-id=pvz_1",
      ]),
      buildContainer({
        apiKeys: [],
        salesChannels: [{ id: "sc_default", name: "Default Sales Channel" }],
      }) as never
    )

    expect(resolution.key_discovery.error_message).toBeNull()
    expect(resolution.input.publishable_api_key).toBe("pk_created_secret_like_value")
    expect(resolution.key_discovery).toEqual(expect.objectContaining({
      found: true,
      publishable_key_provided: true,
      publishable_key_value_printed: false,
      linked_sales_channel: true,
      selected_key_title: "Local Delivery Hub Store Smoke",
    }))
    expect(JSON.stringify(resolution.key_discovery)).not.toContain("pk_created_secret_like_value")
  })
})

function buildQuoteResponse() {
  return {
    ok: true,
    quotes: [
      {
        carrier_code: "yandex",
        carrier_label: "Yandex Delivery",
        mode_code: "dropoff_point_to_pickup_point",
        quote_reference: {
          id: "dhsel_11111111111111111111111111111111",
          version: 1,
        },
        amount: 181.9,
        currency_code: "RUB",
        delivery_eta_min: 3,
        delivery_eta_max: 4,
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
}

function buildSelectionResponse() {
  return {
    ok: true,
    cart_id: "cart_1",
    selection: {
      provider_code: "yandex",
      connection_id: "conn_1",
      quote_type: "dropoff_point_to_pickup_point",
      quote_reference: {
        id: "dhsel_11111111111111111111111111111111",
        version: 1,
      },
    },
    diagnostics: {
      correlation_id: "corr_quote_1",
      checkout_source_of_truth: "unchanged",
      contour: "delivery_hub_storefront_preview",
    },
  }
}

function buildJsonResponse(status: number, body: unknown) {
  return {
    status,
    text: async () => JSON.stringify(body),
  } as Response
}

function buildContainer({
  apiKeys,
  salesChannels,
}: {
  apiKeys: Array<{ id: string; title: string; token: string }>
  salesChannels: Array<{ id: string; name: string }>
}) {
  return {
    resolve: jest.fn((key: string) => {
      if (key === ContainerRegistrationKeys.QUERY || key === "query") {
        return {
          graph: jest.fn(async ({ entity }: { entity: string }) => {
            if (entity === "api_key") {
              return {
                data: apiKeys.length
                  ? apiKeys
                  : [
                    {
                      id: "apk_created",
                      title: "Local Delivery Hub Store Smoke",
                      token: "pk_created_secret_like_value",
                    },
                  ],
              }
            }

            if (entity === "sales_channel") {
              return { data: salesChannels }
            }

            return { data: [] }
          }),
        }
      }

      if (key === ContainerRegistrationKeys.PG_CONNECTION || key === "pg_connection") {
        return {
          raw: jest.fn(async () => ({ rows: [] })),
        }
      }

      return {}
    }),
  }
}
