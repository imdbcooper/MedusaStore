import { describe, expect, it } from "@jest/globals"
import {
  DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD,
  buildDeliveryHubShippingOptionManualSyncDryRunRequest,
  buildDeliveryHubShippingOptionManualSyncExecuteRequest,
  getDeliveryHubShippingOptionDefaultCreateName,
  isDeliveryHubShippingOptionManualSyncGuardConfirmed,
} from "../../admin/routes/settings/delivery/manual-sync"

describe("Delivery Hub admin manual sync helper", () => {
  it("builds dry-run request in safe default mode", () => {
    expect(buildDeliveryHubShippingOptionManualSyncDryRunRequest()).toEqual({
      mode: "dry_run",
      on_error: "abort",
    })

    expect(
      buildDeliveryHubShippingOptionManualSyncDryRunRequest({
        on_error: "continue",
      })
    ).toEqual({
      mode: "dry_run",
      on_error: "continue",
    })
  })

  it("confirms execute guard only on exact trimmed backend-compatible value", () => {
    expect(
      isDeliveryHubShippingOptionManualSyncGuardConfirmed(
        ` ${DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD} `
      )
    ).toBe(true)
    expect(isDeliveryHubShippingOptionManualSyncGuardConfirmed("deliveryhub:wrong")).toBe(false)
    expect(isDeliveryHubShippingOptionManualSyncGuardConfirmed("")).toBe(false)
  })

  it("builds execute request with explicit create mutation context for supported modes", () => {
    expect(
      buildDeliveryHubShippingOptionManualSyncExecuteRequest({
        confirm_execute: DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD,
        service_zone_id: " serzo_deliveryhub ",
        shipping_profile_id: " sp_deliveryhub ",
        on_error: "continue",
      })
    ).toEqual({
      mode: "execute",
      confirm_execute: DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD,
      on_error: "continue",
      mutation_context: {
        create: {
          warehouse_to_pickup_point: {
            name: "Delivery Hub — Со склада в пункт выдачи",
            service_zone_id: "serzo_deliveryhub",
            shipping_profile_id: "sp_deliveryhub",
          },
          dropoff_point_to_pickup_point: {
            name: "Delivery Hub — Из дроп-офф пункта в пункт выдачи",
            service_zone_id: "serzo_deliveryhub",
            shipping_profile_id: "sp_deliveryhub",
          },
        },
      },
    })
  })

  it("supports scoped mode selection and custom names for execute payload shaping", () => {
    expect(
      buildDeliveryHubShippingOptionManualSyncExecuteRequest({
        confirm_execute: DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD,
        service_zone_id: "serzo_deliveryhub",
        shipping_profile_id: "sp_deliveryhub",
        mode_codes: ["warehouse_to_pickup_point"],
        names: {
          warehouse_to_pickup_point: "Custom pickup option",
        },
      })
    ).toEqual({
      mode: "execute",
      confirm_execute: DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD,
      on_error: "abort",
      mutation_context: {
        create: {
          warehouse_to_pickup_point: {
            name: "Custom pickup option",
            service_zone_id: "serzo_deliveryhub",
            shipping_profile_id: "sp_deliveryhub",
          },
        },
      },
    })
  })

  it("throws before execute payload creation when guard or context is incomplete", () => {
    expect(() =>
      buildDeliveryHubShippingOptionManualSyncExecuteRequest({
        confirm_execute: "wrong",
        service_zone_id: "serzo_deliveryhub",
        shipping_profile_id: "sp_deliveryhub",
      })
    ).toThrow("delivery_hub_manual_sync_execute_guard_mismatch")

    expect(() =>
      buildDeliveryHubShippingOptionManualSyncExecuteRequest({
        confirm_execute: DELIVERY_HUB_MANUAL_SYNC_EXECUTE_GUARD,
        service_zone_id: "  ",
        shipping_profile_id: "sp_deliveryhub",
      })
    ).toThrow("delivery_hub_manual_sync_execute_context_incomplete")
  })

  it("returns truthful default names for known and unknown modes", () => {
    expect(getDeliveryHubShippingOptionDefaultCreateName("warehouse_to_pickup_point")).toBe(
      "Delivery Hub — Со склада в пункт выдачи"
    )
    expect(getDeliveryHubShippingOptionDefaultCreateName("dropoff_point_to_pickup_point")).toBe(
      "Delivery Hub — Из дроп-офф пункта в пункт выдачи"
    )
    expect(getDeliveryHubShippingOptionDefaultCreateName("custom_mode")).toBe(
      "Delivery Hub — custom_mode"
    )
  })
})
