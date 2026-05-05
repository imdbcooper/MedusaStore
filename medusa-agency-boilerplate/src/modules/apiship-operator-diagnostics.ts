import {
  APISHIP_FULFILLMENT_PROVIDER_CODE,
  APISHIP_FULFILLMENT_PROVIDER_ID,
  APISHIP_PRIMARY_ADAPTER,
  getDefaultFulfillmentContourContract,
} from "./fulfillment-contour-contract"
import {
  APISHIP_CHECKOUT_READINESS_ERROR_CODE,
  APISHIP_COURIER_DELIVERY_MODE,
  APISHIP_COURIER_SHIPPING_OPTION_PROVIDER_DATA_ID,
  APISHIP_PICKUP_POINT_DELIVERY_MODE,
  APISHIP_PICKUP_POINT_PROVIDER_ID,
  APISHIP_PICKUP_POINT_SHIPPING_OPTION_PROVIDER_DATA_ID,
} from "./apiship-checkout-readiness"
import {
  APISHIP_SHIPMENT_EXECUTION_ENV,
  isApishipShipmentExecutionEnabled,
} from "./apiship-shipment-execution-guard"
import {
  DELIVERY_HUB_RUNTIME_QUARANTINE_ERROR_CODE,
  DELIVERY_HUB_RUNTIME_QUARANTINE_STATUS,
} from "./delivery-hub-runtime-quarantine"

export const APISHIP_OPERATOR_DIAGNOSTICS_VERSION = 1 as const

export type ApishipOperatorDiagnosticsEnv = Partial<
  Pick<NodeJS.ProcessEnv, typeof APISHIP_SHIPMENT_EXECUTION_ENV>
>

export type ApishipOperatorDiagnosticsSnapshot = ReturnType<
  typeof buildApishipOperatorDiagnosticsSnapshot
>

export function buildApishipOperatorDiagnosticsSnapshot(
  env: ApishipOperatorDiagnosticsEnv = process.env,
  now: Date = new Date()
) {
  const contour = getDefaultFulfillmentContourContract()
  const shipmentExecutionEnabled = isApishipShipmentExecutionEnabled(env)
  const shipmentExecutionEnvPresent =
    env[APISHIP_SHIPMENT_EXECUTION_ENV] !== undefined

  return {
    ok: true,
    version: APISHIP_OPERATOR_DIAGNOSTICS_VERSION,
    redacted: true,
    checked_at: now.toISOString(),
    baseline: {
      contour: contour.contour,
      provider_code: contour.provider_code,
      provider_id: contour.provider_id,
      primary_adapter: contour.primary_adapter,
      buyer_facing_mode: contour.buyer_facing_mode,
      courier_delivery: contour.courier_delivery,
      posture: contour.posture,
    },
    provider_registration: {
      registered: true,
      provider_code: APISHIP_FULFILLMENT_PROVIDER_CODE,
      medusa_fulfillment_provider_id: APISHIP_FULFILLMENT_PROVIDER_ID,
      medusa_config_provider_id: APISHIP_FULFILLMENT_PROVIDER_CODE,
      settings_module_expected: true,
      fulfillment_module_provider_expected: true,
      source: "medusa-config.ts",
    },
    option_contracts: {
      expected_seeded_contracts: true,
      pickup_point: {
        expected: true,
        mode: APISHIP_PICKUP_POINT_DELIVERY_MODE,
        shipping_option_data_id: APISHIP_PICKUP_POINT_SHIPPING_OPTION_PROVIDER_DATA_ID,
        provider_id: APISHIP_PICKUP_POINT_PROVIDER_ID,
        delivery_type: 2,
        pickup_type: 1,
        baseline: "apiship_pickup_point_first",
      },
      courier: {
        expected: true,
        mode: APISHIP_COURIER_DELIVERY_MODE,
        shipping_option_data_id: APISHIP_COURIER_SHIPPING_OPTION_PROVIDER_DATA_ID,
        provider_id: APISHIP_PICKUP_POINT_PROVIDER_ID,
        delivery_type: 1,
        pickup_type: 1,
        baseline: "apiship_courier_optional",
      },
    },
    guards: {
      checkout_readiness: {
        enabled: true,
        error_code: APISHIP_CHECKOUT_READINESS_ERROR_CODE,
        enforced_on: [
          "POST /store/payment-collections/:id/payment-sessions",
          "POST /store/carts/:id/complete",
        ],
      },
      shipment_execution: {
        enabled: shipmentExecutionEnabled,
        status: shipmentExecutionEnabled ? "enabled" : "disabled",
        default: "off",
        source: shipmentExecutionEnvPresent ? "explicit_env" : "default",
        env_name: APISHIP_SHIPMENT_EXECUTION_ENV,
        exact_opt_in_required: true,
        guarded_operations: [
          "POST /admin/fulfillments",
          "POST /admin/fulfillments/:id/cancel",
          "POST /admin/orders/:id/fulfillments",
          "POST /admin/orders/:id/fulfillments/:fulfillment_id/cancel",
        ],
      },
    },
    env: {
      [APISHIP_SHIPMENT_EXECUTION_ENV]: {
        present: shipmentExecutionEnvPresent,
        enabled: shipmentExecutionEnabled,
        source: shipmentExecutionEnvPresent ? "explicit_env" : "default",
        value: shipmentExecutionEnabled ? "enabled" : "disabled",
      },
    },
    delivery_hub_quarantine: {
      status: "quarantined",
      previous_baseline: "delivery_hub",
      active_baseline: "apiship_gorgo",
      runtime_http_status: DELIVERY_HUB_RUNTIME_QUARANTINE_STATUS,
      error_code: DELIVERY_HUB_RUNTIME_QUARANTINE_ERROR_CODE,
      physical_cleanup_performed: true,
      public_store_facade_returned: false,
    },
    limitations: {
      external_apiship_health_call: false,
      live_shipment_execution: false,
      online_auth_validation: false,
      sensitive_values_returned: false,
    },
  } as const
}

export function assertApishipOperatorDiagnosticsSecretSafe(
  snapshot: unknown
): boolean {
  const serialized = JSON.stringify(snapshot).toLowerCase()
  const forbiddenFragments = [
    "api_key",
    "apikey",
    "authorization",
    "bearer ",
    "password",
    "secret",
    "token",
    "credential",
  ]

  return !forbiddenFragments.some((fragment) => serialized.includes(fragment))
}
