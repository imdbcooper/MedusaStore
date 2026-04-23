/// <reference types="node" />

import assert from "node:assert/strict"
// @ts-ignore -- runtime uses Node 24 test runner via --experimental-strip-types
import test from "node:test"
import { readFileSync } from "node:fs"
import {
  buildDeliveryHubHandoffContractMatrixPreviewModel,
  buildDeliveryHubHandoffPreviewModel,
  buildDeliveryHubNeutralSelectionRehearsalModel,
  buildDeliveryHubPersistedSelectionContractParityPreviewModel,
  buildDeliveryHubPersistedSelectionPreviewModel,
  buildDeliveryHubProjectedCommitParityPreviewModel,
  buildDeliveryHubReadinessPreviewModel,
  buildDeliveryHubSelectionPayloadParityPreviewModel,
  buildDeliveryHubSelectionSaveCutInPayload,
  buildDeliveryHubSelectionWriteSeamPreviewModel,
  buildDeliveryHubShadowCatalogPreviewModel,
  buildDeliveryHubWriteIntentContractPreviewModel,
  buildDeliveryHubShadowCutoverBlockersPreviewModel,
  buildDeliveryHubShadowCutoverNextStepsPreviewModel,
  buildDeliveryHubShadowOrchestrationRecommendationPreviewModel,
  buildDeliveryHubShadowPickupPointPreviewModel,
  buildDeliveryHubShadowPickupWindowPreviewModel,
  buildDeliveryHubShadowQuotePreviewModel,
  buildDeliveryHubShadowSelectionActionabilityPreviewModel,
  buildDeliveryHubShadowSelectionParityPreviewModel,
  buildDeliveryHubShadowOrchestrationVerdictPreviewModel,
  buildDeliveryHubShadowCutoverReadinessPreviewModel,
  buildDeliveryHubShadowCutoverSummaryPreviewModel,
  buildDeliveryHubShadowCutoverEvidencePreviewModel,
  buildDeliveryHubShadowCutoverRolloutPreviewModel,
  buildDeliveryHubShadowCutoverGatePreviewModel,
  buildDeliveryHubShadowCutoverChecklistPreviewModel,
  buildDeliveryHubShadowCutoverDecisionPreviewModel,
  buildDeliveryHubShadowSettingsPreviewModel,
  buildDeliveryHubShadowShippingOptionParityPreviewModel,
  buildDeliveryHubShippingOptionParityPreviewModel,
  evaluateDeliveryHubNeutralSelectionRehearsalActionability,
  normalizeDeliveryHubCatalogResponse,
  normalizeDeliveryHubPickupPointsResponse,
  normalizeDeliveryHubQuotesResponse,
  normalizeDeliveryHubReadinessResponse,
  normalizeDeliveryHubSettingsResponse,
  shapeDeliveryHubQuotesQuery,
  shapeDeliveryHubSaveSelectionPayload,
} from "./delivery-hub.ts"
import {
  buildDeliveryHubReadinessPreviewModel as buildDeliveryHubReadinessOnlyPreviewModel,
  buildDeliveryHubSummaryPreviewModel,
  hasDeliveryHubSelectionIssues,
  isDeliveryHubSelectionReady,
  type DeliveryHubReadinessResponse as DeliveryHubPreviewReadinessResponse,
} from "./delivery-hub-preview.ts"

test("normalizeDeliveryHubQuotesResponse keeps neutral fields and rejects provider internals", () => {
  const response = normalizeDeliveryHubQuotesResponse({
    ok: true,
    quotes: [
      {
        carrier_code: "yandex",
        carrier_label: "Yandex Delivery",
        mode_code: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_quote_1",
          version: 1,
        },
        amount: 499,
        currency_code: "RUB",
        delivery_eta_min: 1,
        delivery_eta_max: 2,
        pickup_point_required: true,
        pickup_point_ids: ["pvz_1"],
        pickup_window_required: false,
        quote_key: "internal_quote_key",
        raw_reference: {
          provider_quote_id: "raw_1",
        },
        pickup_points_embedded: [{ provider_point_id: "embedded_1" }],
      },
    ],
  })

  assert.deepEqual(response, {
    ok: true,
    quotes: [
      {
        carrier_code: "yandex",
        carrier_label: "Yandex Delivery",
        mode_code: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_quote_1",
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
  })

  assert.equal("quote_key" in response.quotes[0], false)
  assert.equal("raw_reference" in response.quotes[0], false)
  assert.equal("pickup_points_embedded" in response.quotes[0], false)
})

test("normalizeDeliveryHubCatalogResponse keeps only neutral connection summary fields", () => {
  const response = normalizeDeliveryHubCatalogResponse({
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
        credentials_state: "sealed",
        enabled: true,
      },
    ],
  })

  assert.deepEqual(response, {
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
      },
    ],
  })

  assert.equal("provider_code" in response.connections[0], false)
  assert.equal("credentials_state" in response.connections[0], false)
  assert.equal("enabled" in response.connections[0], false)
})

test("normalizeDeliveryHubSettingsResponse keeps only neutral shopper-safe settings fields", () => {
  const response = normalizeDeliveryHubSettingsResponse({
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
        provider_code: "yandex",
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
      hints: ["Settings currently expose read-only neutral storefront visibility."],
      secrets: {
        token: "redacted",
      },
    },
  })

  assert.deepEqual(response, {
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
      hints: ["Settings currently expose read-only neutral storefront visibility."],
    },
  })

  assert.equal("provider_code" in response.settings.summary, false)
  assert.equal("secrets" in response.settings, false)
})

test("shapeDeliveryHubQuotesQuery serializes interval and items for neutral store route contract", () => {
  const query = shapeDeliveryHubQuotesQuery({
    connection_id: "conn_1",
    mode_code: "warehouse_to_pickup_point",
    currency_code: "RUB",
    destination_point_id: "pvz_1",
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

  assert.deepEqual(query, {
    connection_id: "conn_1",
    mode_code: "warehouse_to_pickup_point",
    currency_code: "RUB",
    destination_point_id: "pvz_1",
    warehouse_id: "wh_1",
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
  })
})

test("shapeDeliveryHubSaveSelectionPayload preserves neutral selection structure", () => {
  const payload = shapeDeliveryHubSaveSelectionPayload({
    cart_id: "cart_1",
    connection_id: "conn_1",
    quote_type: "warehouse_to_pickup_point",
    quote_reference: {
      id: "dhsel_quote_1",
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
  })

  assert.deepEqual(payload, {
    cart_id: "cart_1",
    connection_id: "conn_1",
    quote_type: "warehouse_to_pickup_point",
    quote_reference: {
      id: "dhsel_quote_1",
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
    correlation_id: null,
  })
  assert.equal("provider_code" in payload, false)
})

test("shapeDeliveryHubSaveSelectionPayload omits absent provider_code but preserves explicit valid provider_code", () => {
  const baseSelection = {
    cart_id: "cart_provider_shape",
    connection_id: "conn_provider_shape",
    quote_type: "warehouse_to_pickup_point" as const,
    quote_reference: { id: "dhsel_quote_provider_shape", version: 1 },
    quote: {
      carrier_code: "neutral_carrier",
      carrier_label: "Neutral Carrier",
      amount: 499,
      currency_code: "RUB",
      delivery_eta_min: 1,
      delivery_eta_max: 2,
      pickup_point_required: true,
      pickup_window_required: false,
    },
    pickup_point: {
      provider_point_id: "pvz_provider_shape",
      provider_point_code: null,
      name: "Provider Shape PVZ",
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
  }

  const omittedProviderPayload = shapeDeliveryHubSaveSelectionPayload(baseSelection)
  const nullProviderPayload = shapeDeliveryHubSaveSelectionPayload({
    ...baseSelection,
    provider_code: null,
  })
  const explicitProviderPayload = shapeDeliveryHubSaveSelectionPayload({
    ...baseSelection,
    provider_code: "yandex",
  })

  assert.equal("provider_code" in omittedProviderPayload, false)
  assert.equal("provider_code" in nullProviderPayload, false)
  assert.notDeepEqual(Object.keys(omittedProviderPayload), ["provider_code"])
  assert.equal(explicitProviderPayload.provider_code, "yandex")
})

test("normalizeDeliveryHubPickupPointsResponse strips metadata and readiness helpers stay neutral", () => {
  const points = normalizeDeliveryHubPickupPointsResponse({
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
        metadata: {
          provider: "internal",
        },
      },
    ],
  })

  assert.deepEqual(points, {
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
      },
    ],
  })

  assert.equal("metadata" in points.points[0], false)
})

test("delivery-hub preview-only helpers keep readiness and summary semantics for shipping summary", () => {
  const readiness: DeliveryHubPreviewReadinessResponse = {
    ok: true,
    cart_id: "cart_1",
    status: "not_ready",
    issues: [
      {
        code: "pickup_point_missing",
        message: "Pickup point required",
        field: "pickup_point",
      },
    ],
    selection: {
      version: 1,
      connection_id: "conn_1",
      quote_type: "warehouse_to_pickup_point",
      quote_reference: {
        id: "dhsel_quote_1",
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
        provider_point_code: null,
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
      updated_at: "2026-04-22T07:00:00.000Z",
    },
    quote_context: null,
  }

  assert.equal(isDeliveryHubSelectionReady({ status: "ready" }), true)
  assert.equal(isDeliveryHubSelectionReady({ status: "not_ready" }), false)
  assert.equal(hasDeliveryHubSelectionIssues({ issues: [] }), false)
  assert.equal(hasDeliveryHubSelectionIssues(readiness), true)

  assert.deepEqual(buildDeliveryHubReadinessOnlyPreviewModel(readiness), {
    tone: "warning",
    status_label: "Selection not ready",
    connection_label: "conn_1",
    quote_type_label: "Warehouse → pickup point",
    issue_messages: ["Pickup point required"],
    updated_at: "2026-04-22T07:00:00.000Z",
  })

  assert.deepEqual(buildDeliveryHubSummaryPreviewModel(readiness), {
    tone: "warning",
    status_label: "Selection not ready",
    modality_label: "Warehouse → pickup point",
    issue_messages: ["Pickup point required"],
    updated_at: "2026-04-22T07:00:00.000Z",
  })
})

test("normalizeDeliveryHubReadinessResponse preserves neutral readiness summary only", () => {
  const readiness = normalizeDeliveryHubReadinessResponse({
    ok: true,
    cart_id: "cart_1",
    status: "not_ready",
    issues: [
      {
        code: "pickup_window_missing",
        message: "Pickup window is required",
        field: "pickup_window",
      },
    ],
    selection: {
      version: 1,
      provider_code: "yandex",
      connection_id: "conn_1",
      quote_type: "warehouse_to_pickup_point",
      quote_reference: {
        id: "dhsel_quote_1",
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
        provider_point_code: null,
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
        provider_code: "yandex",
      },
      quote_type: "warehouse_to_pickup_point",
      quote_reference: {
        id: "dhsel_quote_1",
        version: 1,
      },
      pickup_point_required: true,
      pickup_window_required: true,
      updated_at: "2026-04-21T03:00:00.000Z",
    },
  })

  assert.equal(readiness.cart_id, "cart_1")
  assert.equal(readiness.status, "not_ready")
  assert.deepEqual(readiness.issues, [
    {
      code: "pickup_window_missing",
      message: "Pickup window is required",
      field: "pickup_window",
    },
  ])
  assert.equal(readiness.quote_context?.connection.connection_id, "conn_1")
  assert.equal(readiness.quote_context?.connection.state, "ready")
  assert.equal(readiness.quote_context?.connection.ready, true)
  assert.equal(
    "provider_code" in (readiness.quote_context?.connection ?? {}),
    false
  )
})

test("buildDeliveryHubReadinessPreviewModel produces read-only checkout preview state", () => {
  const readyPreview = buildDeliveryHubReadinessPreviewModel({
    ok: true,
    cart_id: "cart_ready",
    status: "ready",
    issues: [],
    selection: {
      version: 1,
      connection_id: "conn_ready",
      quote_type: "warehouse_to_pickup_point",
      quote_reference: {
        id: "dhsel_quote_ready",
        version: 2,
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
        provider_point_code: null,
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
      updated_at: "2026-04-21T10:00:00.000Z",
    },
    quote_context: {
      connection: {
        connection_id: "conn_ready",
        state: "ready",
        ready: true,
      },
      quote_type: "warehouse_to_pickup_point",
      quote_reference: {
        id: "dhsel_quote_ready",
        version: 2,
      },
      pickup_point_required: true,
      pickup_window_required: false,
      updated_at: "2026-04-21T10:00:00.000Z",
    },
  })

  assert.deepEqual(readyPreview, {
    tone: "positive",
    status_label: "Selection ready",
    connection_label: "conn_ready",
    quote_type_label: "Warehouse → pickup point",
    issue_messages: [],
    updated_at: "2026-04-21T10:00:00.000Z",
  })

  const missingPreview = buildDeliveryHubReadinessPreviewModel(null)
  assert.deepEqual(missingPreview, {
    tone: "neutral",
    status_label: "Readiness unavailable",
    connection_label: null,
    quote_type_label: null,
    issue_messages: [],
    updated_at: null,
  })

  const warningPreview = buildDeliveryHubReadinessPreviewModel({
    ok: true,
    cart_id: "cart_warn",
    status: "not_ready",
    issues: [
      {
        code: "pickup_window_missing",
        message: "Pickup window is required",
        field: "pickup_window",
      },
    ],
    selection: null,
    quote_context: {
      connection: {
        connection_id: "conn_warn",
        state: "credentials_not_ready",
        ready: false,
      },
      quote_type: "dropoff_point_to_pickup_point",
      quote_reference: {
        id: "dhsel_quote_warn",
        version: 1,
      },
      pickup_point_required: true,
      pickup_window_required: true,
      updated_at: "2026-04-21T11:00:00.000Z",
    },
  })

  assert.deepEqual(warningPreview, {
    tone: "warning",
    status_label: "Selection not ready",
    connection_label: "conn_warn",
    quote_type_label: "Dropoff point → pickup point",
    issue_messages: ["Pickup window is required"],
    updated_at: "2026-04-21T11:00:00.000Z",
  })
})

test("buildDeliveryHubSummaryPreviewModel keeps summary contour read-only and neutral", () => {
  const summaryPreview = buildDeliveryHubSummaryPreviewModel({
    ok: true,
    cart_id: "cart_summary",
    status: "ready",
    issues: [],
    selection: {
      version: 3,
      connection_id: "conn_summary",
      quote_type: "warehouse_to_pickup_point",
      quote_reference: {
        id: "dhsel_quote_summary",
        version: 7,
      },
      quote: {
        carrier_code: "yandex",
        carrier_label: "Yandex Delivery",
        amount: 650,
        currency_code: "RUB",
        delivery_eta_min: 2,
        delivery_eta_max: 3,
        pickup_point_required: true,
        pickup_window_required: false,
      },
      pickup_point: {
        provider_point_id: "pvz_summary",
        provider_point_code: "A-1",
        name: "Summary PVZ",
        address: "Tverskaya 10",
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
      updated_at: "2026-04-21T12:00:00.000Z",
    },
    quote_context: {
      connection: {
        connection_id: "conn_summary",
        state: "ready",
        ready: true,
      },
      quote_type: "warehouse_to_pickup_point",
      quote_reference: {
        id: "dhsel_quote_summary",
        version: 7,
      },
      pickup_point_required: true,
      pickup_window_required: false,
      updated_at: "2026-04-21T12:00:00.000Z",
    },
  })

  assert.deepEqual(summaryPreview, {
    tone: "positive",
    status_label: "Selection ready",
    modality_label: "Warehouse → pickup point",
    issue_messages: [],
    updated_at: "2026-04-21T12:00:00.000Z",
  })

  const warningSummaryPreview = buildDeliveryHubSummaryPreviewModel({
    ok: true,
    cart_id: "cart_summary_warn",
    status: "not_ready",
    issues: [
      {
        code: "pickup_point_missing",
        message: "Pickup point is required",
        field: "pickup_point",
      },
    ],
    selection: null,
    quote_context: {
      connection: {
        connection_id: "conn_summary_warn",
        state: "inactive",
        ready: false,
      },
      quote_type: "dropoff_point_to_pickup_point",
      quote_reference: {
        id: "dhsel_quote_summary_warn",
        version: 1,
      },
      pickup_point_required: true,
      pickup_window_required: false,
      updated_at: "2026-04-21T12:30:00.000Z",
    },
  })

  assert.deepEqual(warningSummaryPreview, {
    tone: "warning",
    status_label: "Selection not ready",
    modality_label: "Dropoff point → pickup point",
    issue_messages: ["Pickup point is required"],
    updated_at: "2026-04-21T12:30:00.000Z",
  })
})

test("buildDeliveryHubPersistedSelectionPreviewModel keeps persisted selection preview neutral and read-only", () => {
  const readyPreview = buildDeliveryHubPersistedSelectionPreviewModel(
    {
      ok: true,
      cart_id: "cart_selection_preview",
      selection: {
        version: 2,
        connection_id: "conn_selection_preview",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_quote_selection_preview",
          version: 3,
        },
        quote: {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: true,
        },
        pickup_point: {
          provider_point_id: "point_selection_preview",
          provider_point_code: null,
          name: "North pickup point",
          address: "Nevsky 1",
          city: "Saint Petersburg",
          region: "Saint Petersburg",
          postal_code: "190000",
          lat: 59.93,
          lng: 30.33,
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
          label: "22 Apr · 10:00–14:00",
        },
        updated_at: "2026-04-21T12:45:00.000Z",
      },
    },
    {
      ok: true,
      cart_id: "cart_selection_preview",
      status: "ready",
      issues: [],
      selection: null,
      quote_context: null,
    }
  )

  assert.deepEqual(readyPreview, {
    tone: "positive",
    status_label: "Persisted selection available",
    modality_label: "Warehouse → pickup point",
    quote_amount: 499,
    currency_code: "RUB",
    quote_eta_label: "ETA 1–2 days",
    pickup_point_label: "North pickup point",
    pickup_window_label: "22 Apr · 10:00–14:00",
    readiness_label: "Selection ready",
    hint_messages: ["Persisted selection currently passes readiness checks."],
    updated_at: "2026-04-21T12:45:00.000Z",
  })

  const warningPreview = buildDeliveryHubPersistedSelectionPreviewModel(
    {
      ok: true,
      cart_id: "cart_selection_preview_warn",
      selection: {
        version: 1,
        connection_id: "conn_selection_preview_warn",
        quote_type: "dropoff_point_to_pickup_point",
        quote_reference: {
          id: "dhsel_quote_selection_preview_warn",
          version: 1,
        },
        quote: {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          amount: 0,
          currency_code: "RUB",
          delivery_eta_min: null,
          delivery_eta_max: 5,
          pickup_point_required: true,
          pickup_window_required: false,
        },
        pickup_point: {
          provider_point_id: "point_selection_preview_warn",
          provider_point_code: null,
          name: "South pickup point",
          address: "Sadovaya 5",
          city: "Moscow",
          region: "Moscow",
          postal_code: "101000",
          lat: 55.75,
          lng: 37.61,
          is_origin_dropoff_allowed: true,
          is_destination_pickup_allowed: true,
          payment_methods: [],
        },
        pickup_window: null,
        updated_at: "2026-04-21T13:00:00.000Z",
      },
    },
    {
      ok: true,
      cart_id: "cart_selection_preview_warn",
      status: "not_ready",
      issues: [
        {
          code: "pickup_window_missing",
          message: "Pickup window is required",
          field: "pickup_window",
        },
      ],
      selection: null,
      quote_context: null,
    }
  )

  assert.deepEqual(warningPreview, {
    tone: "warning",
    status_label: "Persisted selection requires attention",
    modality_label: "Dropoff point → pickup point",
    quote_amount: 0,
    currency_code: "RUB",
    quote_eta_label: "ETA up to 5 days",
    pickup_point_label: "South pickup point",
    pickup_window_label: null,
    readiness_label: "Selection not ready",
    hint_messages: [
      "Persisted selection is stored but still needs additional checkout context before it can become ready.",
      "Pickup window is required",
    ],
    updated_at: "2026-04-21T13:00:00.000Z",
  })

  const missingPreview = buildDeliveryHubPersistedSelectionPreviewModel(
    {
      ok: true,
      cart_id: "cart_selection_preview_missing",
      selection: null,
    },
    {
      ok: true,
      cart_id: "cart_selection_preview_missing",
      status: "missing_selection",
      issues: [],
      selection: null,
      quote_context: null,
    }
  )

  assert.deepEqual(missingPreview, {
    tone: "neutral",
    status_label: "Persisted selection missing",
    modality_label: null,
    quote_amount: null,
    currency_code: null,
    quote_eta_label: null,
    pickup_point_label: null,
    pickup_window_label: null,
    readiness_label: "Selection missing",
    hint_messages: [
      "Readiness currently agrees that no neutral persisted selection is stored for this cart.",
    ],
    updated_at: null,
  })
})

test("buildDeliveryHubHandoffPreviewModel returns ready shopper-safe handoff preview", () => {
  const preview = buildDeliveryHubHandoffPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_handoff_ready",
      status: "ready",
      issues: [],
      selection: {
        version: 1,
        connection_id: "conn_handoff_ready",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_quote_handoff_ready",
          version: 2,
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
          provider_point_id: "pvz_handoff_ready",
          provider_point_code: null,
          name: "Ready PVZ",
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
          label: "22 Apr · 10:00–14:00",
        },
        updated_at: "2026-04-22T09:00:00.000Z",
      },
      quote_context: {
        connection: {
          connection_id: "conn_handoff_ready",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_quote_handoff_ready",
          version: 2,
        },
        pickup_point_required: true,
        pickup_window_required: true,
        updated_at: "2026-04-22T09:00:00.000Z",
      },
    },
  })

  assert.deepEqual(preview, {
    tone: "positive",
    verdict: "ready_for_handoff_preview",
    verdict_label: "Ready for backend handoff preview",
    readiness_summary_label:
      "Shopper-safe handoff preview shape is structurally complete for candidate backend validation.",
    connection_id: "conn_handoff_ready",
    mode_code: "warehouse_to_pickup_point",
    mode_label: "Warehouse → pickup point",
    quote_reference_present: true,
    pickup_point_required: true,
    pickup_point_present: true,
    pickup_window_required: true,
    pickup_window_present: true,
    blocker_codes: [],
    hint_messages: [
      "Pre-cutin read-only handoff preview seam only: no save, clear, submit, or shipping-method mutation is performed here.",
      "The active checkout commit path remains legacy ApiShip.",
    ],
    dry_run_only: true,
    mutation_intent: false,
  })
})

test("buildDeliveryHubShippingOptionParityPreviewModel reports aligned structural parity", () => {
  const preview = buildDeliveryHubShippingOptionParityPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_parity_ready",
      status: "ready",
      issues: [],
      selection: {
        version: 1,
        connection_id: "conn_parity_ready",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_quote_parity_ready",
          version: 2,
        },
        quote: {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: true,
        },
        pickup_point: {
          provider_point_id: "pvz_parity_ready",
          provider_point_code: null,
          name: "Ready PVZ",
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
          label: "22 Apr · 10:00–14:00",
        },
        updated_at: "2026-04-22T09:00:00.000Z",
      },
      quote_context: {
        connection: {
          connection_id: "conn_parity_ready",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_quote_parity_ready",
          version: 2,
        },
        pickup_point_required: true,
        pickup_window_required: true,
        updated_at: "2026-04-22T09:00:00.000Z",
      },
    },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "pickup_point",
      legacy_selection_fresh: true,
      legacy_method_label: "ApiShip pickup",
    },
  })

  assert.equal(preview.verdict, "parity_aligned")
  assert.equal(preview.connection_id_signal.status, "aligned")
  assert.equal(preview.mode_code_signal.status, "aligned")
  assert.equal(preview.quote_reference_signal.status, "aligned")
  assert.equal(preview.pickup_point_signal.status, "aligned")
  assert.equal(preview.pickup_window_signal.status, "aligned")
  assert.deepEqual(preview.gap_codes, [])
  assert.equal(preview.mutation_intent, false)
  assert.equal(preview.dry_run_only, true)
})

test("buildDeliveryHubShippingOptionParityPreviewModel reports partial parity when pickup point is missing", () => {
  const preview = buildDeliveryHubShippingOptionParityPreviewModel({
    quotes: {
      ok: true,
      quotes: [
        {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          mode_code: "warehouse_to_pickup_point",
          quote_reference: { id: "quote_ref_pickup_gap", version: 1 },
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: null,
          delivery_eta_max: null,
          pickup_point_required: true,
          pickup_point_ids: [],
          pickup_window_required: false,
        },
      ],
    },
    pickup_points: { ok: true, points: [] },
    readiness: {
      ok: true,
      cart_id: "cart_parity_pickup_gap",
      status: "missing_selection",
      issues: [],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_pickup_gap",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_ref_pickup_gap", version: 1 },
        pickup_point_required: true,
        pickup_window_required: false,
        updated_at: "2026-04-22T09:00:00.000Z",
      },
    },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "pickup_point",
      legacy_selection_fresh: true,
      legacy_method_label: "ApiShip pickup",
    },
  })

  assert.equal(preview.verdict, "parity_partial")
  assert.equal(preview.pickup_point_signal.status, "missing")
  assert.ok(preview.gap_codes.includes("missing_pickup_point"))
})

test("buildDeliveryHubShippingOptionParityPreviewModel reports partial parity when pickup window is missing", () => {
  const preview = buildDeliveryHubShippingOptionParityPreviewModel({
    quotes: {
      ok: true,
      quotes: [
        {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          mode_code: "warehouse_to_pickup_point",
          quote_reference: { id: "quote_ref_window_gap", version: 1 },
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: null,
          delivery_eta_max: null,
          pickup_point_required: false,
          pickup_point_ids: [],
          pickup_window_required: true,
        },
      ],
    },
    pickup_windows: { ok: true, pickup_windows: [] },
    readiness: {
      ok: true,
      cart_id: "cart_parity_window_gap",
      status: "missing_selection",
      issues: [],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_window_gap",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_ref_window_gap", version: 1 },
        pickup_point_required: false,
        pickup_window_required: true,
        updated_at: "2026-04-22T09:00:00.000Z",
      },
    },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "pickup_point",
      legacy_selection_fresh: true,
      legacy_method_label: "ApiShip pickup",
    },
  })

  assert.equal(preview.verdict, "parity_partial")
  assert.equal(preview.pickup_window_signal.status, "missing")
  assert.ok(preview.gap_codes.includes("missing_pickup_window"))
})

test("buildDeliveryHubShippingOptionParityPreviewModel reports blocked parity when readiness or mode alignment fails", () => {
  const blockedByConnection = buildDeliveryHubShippingOptionParityPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_parity_blocked_connection",
      status: "not_ready",
      issues: [
        {
          code: "connection_credentials_not_ready",
          message: "Connection credentials are not ready",
          field: "connection_id",
        },
      ],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_blocked",
          state: "credentials_not_ready",
          ready: false,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_ref_blocked", version: 1 },
        pickup_point_required: false,
        pickup_window_required: false,
        updated_at: "2026-04-22T09:00:00.000Z",
      },
    },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "pickup_point",
      legacy_selection_fresh: true,
      legacy_method_label: "ApiShip pickup",
    },
  })

  const blockedByMode = buildDeliveryHubShippingOptionParityPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_parity_blocked_mode",
      status: "ready",
      issues: [],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_mode_mismatch",
          state: "ready",
          ready: true,
        },
        quote_type: "dropoff_point_to_pickup_point",
        quote_reference: { id: "quote_ref_mode_mismatch", version: 1 },
        pickup_point_required: false,
        pickup_window_required: false,
        updated_at: "2026-04-22T09:00:00.000Z",
      },
    },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "door_delivery",
      legacy_selection_fresh: true,
      legacy_method_label: "ApiShip door",
    },
  })

  assert.equal(blockedByConnection.verdict, "blocked")
  assert.equal(blockedByConnection.connection_id_signal.status, "blocked")
  assert.ok(blockedByConnection.gap_codes.includes("connection_not_ready"))

  assert.equal(blockedByMode.verdict, "blocked")
  assert.equal(blockedByMode.mode_code_signal.status, "mismatch")
  assert.ok(blockedByMode.gap_codes.includes("mode_mismatch"))
})

test("buildDeliveryHubShippingOptionParityPreviewModel keeps preview-only wording and no internal leakage", () => {
  const preview = buildDeliveryHubShippingOptionParityPreviewModel({
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: false,
      legacy_flow_kind: null,
      legacy_selection_fresh: false,
      legacy_method_label: null,
    },
  })
  const serialized = JSON.stringify(preview).toLowerCase()

  assert.equal(preview.verdict, "informational_only")
  assert.equal(preview.mutation_intent, false)
  assert.equal(preview.dry_run_only, true)
  assert.equal(serialized.includes("activation"), false)
  for (const forbidden of [
    "provider_code",
    "quote_key",
    "raw_reference",
    "token",
    "secret",
    "credentials",
    "yandex",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden)
  }
})

test("buildDeliveryHubHandoffPreviewModel marks missing quote_reference", () => {
  const preview = buildDeliveryHubHandoffPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_handoff_missing_quote_reference",
      status: "ready",
      issues: [],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_handoff_missing_quote_reference",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: null as never,
        pickup_point_required: false,
        pickup_window_required: false,
        updated_at: "2026-04-22T09:15:00.000Z",
      },
    } as any,
  })

  assert.equal(preview.verdict, "missing_required_fragment")
  assert.deepEqual(preview.blocker_codes, ["missing_quote", "missing_quote_reference"])
  assert.equal(preview.quote_reference_present, false)
})

test("buildDeliveryHubHandoffPreviewModel marks missing pickup point when required", () => {
  const preview = buildDeliveryHubHandoffPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_handoff_missing_point",
      status: "not_ready",
      issues: [
        {
          code: "pickup_point_missing",
          message: "Pickup point is required",
          field: "pickup_point",
        },
      ],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_handoff_missing_point",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_quote_handoff_missing_point",
          version: 1,
        },
        pickup_point_required: true,
        pickup_window_required: false,
        updated_at: "2026-04-22T09:20:00.000Z",
      },
    },
  })

  assert.equal(preview.verdict, "missing_required_fragment")
  assert.equal(preview.pickup_point_required, true)
  assert.equal(preview.pickup_point_present, false)
  assert.ok(preview.blocker_codes.includes("missing_pickup_point"))
})

test("buildDeliveryHubHandoffPreviewModel marks missing pickup window when required", () => {
  const preview = buildDeliveryHubHandoffPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_handoff_missing_window",
      status: "not_ready",
      issues: [
        {
          code: "pickup_window_missing",
          message: "Pickup window is required",
          field: "pickup_window",
        },
      ],
      selection: {
        version: 1,
        connection_id: "conn_handoff_missing_window",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_quote_handoff_missing_window",
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
          provider_point_id: "pvz_handoff_missing_window",
          provider_point_code: null,
          name: "PVZ",
          address: "Tverskaya 1",
          city: "Moscow",
          region: "Moscow",
          postal_code: "101000",
          lat: 55.75,
          lng: 37.61,
          is_origin_dropoff_allowed: false,
          is_destination_pickup_allowed: true,
          payment_methods: [],
        },
        pickup_window: null,
        updated_at: "2026-04-22T09:25:00.000Z",
      },
      quote_context: {
        connection: {
          connection_id: "conn_handoff_missing_window",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_quote_handoff_missing_window",
          version: 1,
        },
        pickup_point_required: true,
        pickup_window_required: true,
        updated_at: "2026-04-22T09:25:00.000Z",
      },
    },
  })

  assert.equal(preview.verdict, "missing_required_fragment")
  assert.equal(preview.pickup_window_required, true)
  assert.equal(preview.pickup_window_present, false)
  assert.ok(preview.blocker_codes.includes("missing_pickup_window"))
})

test("buildDeliveryHubHandoffPreviewModel blocks degraded readiness when connection is not ready", () => {
  const preview = buildDeliveryHubHandoffPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_handoff_blocked",
      status: "not_ready",
      issues: [
        {
          code: "connection_credentials_not_ready",
          message: "Connection credentials are not ready",
          field: "connection",
        },
      ],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_handoff_blocked",
          state: "credentials_not_ready",
          ready: false,
        },
        quote_type: "dropoff_point_to_pickup_point",
        quote_reference: {
          id: "dhsel_quote_handoff_blocked",
          version: 1,
        },
        pickup_point_required: true,
        pickup_window_required: false,
        updated_at: "2026-04-22T09:30:00.000Z",
      },
    },
  })

  assert.equal(preview.verdict, "blocked")
  assert.ok(preview.blocker_codes.includes("connection_not_ready"))
  assert.equal(preview.connection_id, "conn_handoff_blocked")
  assert.equal(preview.mode_code, "dropoff_point_to_pickup_point")
})

test("buildDeliveryHubHandoffPreviewModel remains preview-only and does not leak internal fields", () => {
  const preview = buildDeliveryHubHandoffPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_handoff_safe",
      status: "ready",
      issues: [],
      selection: {
        version: 1,
        connection_id: "conn_handoff_safe",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_quote_handoff_safe",
          version: 1,
        },
        quote: {
          carrier_code: "yandex",
          carrier_label: "Yandex Delivery",
          amount: 399,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: false,
          pickup_window_required: false,
        },
        pickup_point: {
          provider_point_id: "pvz_handoff_safe",
          provider_point_code: null,
          name: "Safe PVZ",
          address: "Safe street 1",
          city: "Moscow",
          region: "Moscow",
          postal_code: "101000",
          lat: 55.75,
          lng: 37.61,
          is_origin_dropoff_allowed: false,
          is_destination_pickup_allowed: true,
          payment_methods: [],
        },
        pickup_window: null,
        updated_at: "2026-04-22T09:35:00.000Z",
      },
      quote_context: {
        connection: {
          connection_id: "conn_handoff_safe",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_quote_handoff_safe",
          version: 1,
        },
        pickup_point_required: false,
        pickup_window_required: false,
        updated_at: "2026-04-22T09:35:00.000Z",
      },
    },
  }) as Record<string, unknown>

  assert.equal(preview.mutation_intent, false)
  assert.equal(preview.dry_run_only, true)
  assert.equal("provider_code" in preview, false)
  assert.equal("quote_key" in preview, false)
  assert.equal("raw_reference" in preview, false)
  assert.equal("saveDeliveryHubSelection" in preview, false)
  assert.equal("clearDeliveryHubSelection" in preview, false)
})

test("buildDeliveryHubHandoffContractMatrixPreviewModel reports complete contract matrix", () => {
  const preview = buildDeliveryHubHandoffContractMatrixPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_matrix_complete",
      status: "ready",
      issues: [],
      selection: {
        version: 1,
        connection_id: "conn_matrix_complete",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_matrix_complete", version: 2 },
        quote: {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: true,
        },
        pickup_point: {
          provider_point_id: "pvz_complete",
          provider_point_code: null,
          name: "Complete PVZ",
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
          label: "22 Apr · 10:00–14:00",
        },
        updated_at: "2026-04-22T09:00:00.000Z",
      },
      quote_context: {
        connection: {
          connection_id: "conn_matrix_complete",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_matrix_complete", version: 2 },
        pickup_point_required: true,
        pickup_window_required: true,
        updated_at: "2026-04-22T09:00:00.000Z",
      },
    },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "pickup_point",
      legacy_selection_fresh: true,
      legacy_method_label: "ApiShip pickup",
    },
  })

  assert.equal(preview.verdict, "contract_complete")
  assert.deepEqual(preview.missing_fragment_keys, [])
  assert.deepEqual(preview.blocked_readiness_codes, [])
  assert.deepEqual(preview.blocked_parity_codes, [])
  assert.equal(preview.fragments.every((fragment) => fragment.status === "present"), true)
})

test("buildDeliveryHubPersistedSelectionContractParityPreviewModel reports matched projected contract parity", () => {
  const preview = buildDeliveryHubPersistedSelectionContractParityPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_contract_parity_match",
      status: "ready",
      issues: [],
      selection: {
        version: 1,
        connection_id: "conn_contract_parity_match",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_contract_parity_match", version: 2 },
        quote: {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: true,
        },
        pickup_point: {
          provider_point_id: "pvz_contract_parity_match",
          provider_point_code: null,
          name: "Contract PVZ",
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
          label: "22 Apr · 10:00–14:00",
        },
        updated_at: "2026-04-22T10:30:00.000Z",
      },
      quote_context: {
        connection: {
          connection_id: "conn_contract_parity_match",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_contract_parity_match", version: 2 },
        pickup_point_required: true,
        pickup_window_required: true,
        updated_at: "2026-04-22T10:30:00.000Z",
      },
    },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "pickup_point",
      legacy_selection_fresh: true,
      legacy_method_label: "ApiShip pickup",
    },
  })

  assert.equal(preview.verdict, "contract_matched")
  assert.equal(preview.matched_field_count, 5)
  assert.equal(preview.mismatched_field_count, 0)
  assert.deepEqual(preview.blocked_readiness_codes, [])
  assert.deepEqual(preview.blocked_parity_codes, [])
  assert.equal(preview.fields.every((field) => ["matched", "not_required"].includes(field.status)), true)
})

test("buildDeliveryHubPersistedSelectionContractParityPreviewModel reports mismatch for missing connection_id", () => {
  const preview = buildDeliveryHubPersistedSelectionContractParityPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_contract_missing_connection",
      status: "ready",
      issues: [],
      selection: null,
      quote_context: {
        connection: {
          connection_id: null as never,
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_contract_missing_connection", version: 1 },
        pickup_point_required: false,
        pickup_window_required: false,
        updated_at: "2026-04-22T10:40:00.000Z",
      },
    } as any,
  })

  assert.equal(preview.verdict, "contract_mismatched")
  assert.ok(preview.mismatch_reasons.some((reason) => reason.includes("connection_id")))
  assert.equal(preview.fields.find((field) => field.key === "connection_id")?.status, "mismatched")
})

test("buildDeliveryHubPersistedSelectionContractParityPreviewModel reports mismatch for missing quote_reference", () => {
  const preview = buildDeliveryHubPersistedSelectionContractParityPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_contract_missing_quote_reference",
      status: "ready",
      issues: [],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_contract_missing_quote_reference",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: null as never,
        pickup_point_required: false,
        pickup_window_required: false,
        updated_at: "2026-04-22T10:45:00.000Z",
      },
    } as any,
  })

  assert.equal(preview.verdict, "contract_mismatched")
  assert.equal(preview.quote_reference_present, false)
  assert.equal(preview.fields.find((field) => field.key === "quote_reference")?.status, "mismatched")
})

test("buildDeliveryHubPersistedSelectionContractParityPreviewModel reports pickup point mismatch when required and absent", () => {
  const preview = buildDeliveryHubPersistedSelectionContractParityPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_contract_missing_pickup_point",
      status: "ready",
      issues: [],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_contract_missing_pickup_point",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_contract_missing_pickup_point", version: 1 },
        pickup_point_required: true,
        pickup_window_required: false,
        updated_at: "2026-04-22T10:50:00.000Z",
      },
    },
    pickup_points: { ok: true, points: [] },
  })

  assert.equal(preview.verdict, "contract_mismatched")
  assert.equal(preview.pickup_point_required, true)
  assert.equal(preview.pickup_point_present, false)
  assert.equal(preview.fields.find((field) => field.key === "pickup_point")?.status, "mismatched")
})

test("buildDeliveryHubPersistedSelectionContractParityPreviewModel reports pickup window mismatch when required and absent", () => {
  const preview = buildDeliveryHubPersistedSelectionContractParityPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_contract_missing_pickup_window",
      status: "ready",
      issues: [],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_contract_missing_pickup_window",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_contract_missing_pickup_window", version: 1 },
        pickup_point_required: false,
        pickup_window_required: true,
        updated_at: "2026-04-22T10:55:00.000Z",
      },
    },
    pickup_windows: { ok: true, pickup_windows: [] },
  })

  assert.equal(preview.verdict, "contract_mismatched")
  assert.equal(preview.pickup_window_required, true)
  assert.equal(preview.pickup_window_present, false)
  assert.equal(preview.fields.find((field) => field.key === "pickup_window")?.status, "mismatched")
})

test("buildDeliveryHubPersistedSelectionContractParityPreviewModel reports sanitized readiness blockers for blocked projected contract", () => {
  const preview = buildDeliveryHubPersistedSelectionContractParityPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_contract_parity_blocked",
      status: "not_ready",
      issues: [
        {
          code: "connection_credentials_not_ready",
          message: "Connection credentials are not ready",
          field: "connection_id",
        },
      ],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_contract_parity_blocked",
          state: "credentials_not_ready",
          ready: false,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_contract_parity_blocked", version: 1 },
        pickup_point_required: false,
        pickup_window_required: false,
        updated_at: "2026-04-22T11:00:00.000Z",
      },
    },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "pickup_point",
      legacy_selection_fresh: true,
      legacy_method_label: "ApiShip pickup",
    },
  })
  const serialized = JSON.stringify(preview).toLowerCase()

  assert.equal(preview.verdict, "blocked")
  assert.deepEqual(preview.blocked_readiness_codes, ["connection_unavailable"])
  assert.equal(preview.fields.find((field) => field.key === "connection_id")?.status, "blocked")
  assert.equal(serialized.includes("credentials"), false)
  assert.equal(serialized.includes("connection_credentials_not_ready"), false)
})

test("buildDeliveryHubPersistedSelectionContractParityPreviewModel reports sanitized parity blockers for blocked projected contract", () => {
  const preview = buildDeliveryHubPersistedSelectionContractParityPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_contract_parity_parity_blocked",
      status: "ready",
      issues: [],
      selection: {
        version: 1,
        connection_id: "conn_contract_parity_parity_blocked",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_contract_parity_parity_blocked", version: 1 },
        quote: {
          carrier_code: "carrier_contract_parity_parity_blocked",
          carrier_label: "Carrier parity blocked",
          amount: 500,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: false,
          pickup_window_required: false,
        },
        pickup_point: {
          provider_point_id: "point_contract_parity_parity_blocked",
          provider_point_code: null,
          name: "Pickup point parity blocked",
          address: "Parity blocked street 1",
          city: "Moscow",
          region: null,
          postal_code: null,
          lat: null,
          lng: null,
          is_origin_dropoff_allowed: false,
          is_destination_pickup_allowed: true,
          payment_methods: [],
        },
        pickup_window: null,
        updated_at: "2026-04-22T11:05:00.000Z",
      },
      quote_context: {
        connection: {
          connection_id: "conn_contract_parity_parity_blocked",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_contract_parity_parity_blocked", version: 1 },
        pickup_point_required: false,
        pickup_window_required: false,
        updated_at: "2026-04-22T11:05:00.000Z",
      },
    },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "door_delivery",
      legacy_selection_fresh: false,
      legacy_method_label: "ApiShip courier",
    },
  })
  const serialized = JSON.stringify(preview).toLowerCase()

  assert.equal(preview.verdict, "blocked")
  assert.deepEqual(preview.blocked_parity_codes, ["selection_alignment_unavailable"])
  assert.equal(preview.fields.find((field) => field.key === "mode_code")?.status, "blocked")
  assert.equal(serialized.includes("legacy_context_stale"), false)
})

test("buildDeliveryHubPersistedSelectionContractParityPreviewModel stays shopper-safe and preview-only", () => {
  const preview = buildDeliveryHubPersistedSelectionContractParityPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_contract_parity_safe_preview",
      status: "not_ready",
      issues: [
        {
          code: "connection_credentials_not_ready",
          message: "Connection credentials are not ready",
          field: "connection_id",
        },
      ],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_contract_parity_safe_preview",
          state: "credentials_not_ready",
          ready: false,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_contract_parity_safe_preview", version: 1 },
        pickup_point_required: false,
        pickup_window_required: false,
        updated_at: "2026-04-22T11:10:00.000Z",
      },
    },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "door_delivery",
      legacy_selection_fresh: false,
      legacy_method_label: "ApiShip courier",
    },
  }) as Record<string, unknown>
  const serialized = JSON.stringify(preview).toLowerCase()

  assert.equal(preview.mutation_intent, false)
  assert.equal(preview.dry_run_only, true)
  assert.equal(serialized.includes("activation"), false)
  assert.equal(serialized.includes("save"), false)
  assert.equal(serialized.includes("submit"), false)
  for (const forbidden of [
    "provider_code",
    "quote_key",
    "raw_reference",
    "token",
    "secret",
    "credentials",
    "connection_credentials_not_ready",
    "legacy_context_stale",
    "yandex",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden)
  }
})

test("delivery-hub util preview stack remains no-network only for persisted contract parity seam", () => {
  const source = readFileSync(new URL("./delivery-hub.ts", import.meta.url), "utf8")

  assert.equal(source.includes("fetch("), false)
  assert.equal(source.includes("axios"), false)
  assert.equal(source.includes("XMLHttpRequest"), false)
})

test("buildDeliveryHubProjectedCommitParityPreviewModel reports matched projected commit parity", () => {
  const preview = buildDeliveryHubProjectedCommitParityPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_projected_commit_match",
      status: "ready",
      issues: [],
      selection: {
        version: 1,
        connection_id: "conn_projected_commit_match",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_projected_commit_match", version: 2 },
        quote: {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: true,
        },
        pickup_point: {
          provider_point_id: "pvz_projected_commit_match",
          provider_point_code: null,
          name: "Projected commit PVZ",
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
          label: "22 Apr · 10:00–14:00",
        },
        updated_at: "2026-04-22T10:30:00.000Z",
      },
      quote_context: {
        connection: {
          connection_id: "conn_projected_commit_match",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_projected_commit_match", version: 2 },
        pickup_point_required: true,
        pickup_window_required: true,
        updated_at: "2026-04-22T10:30:00.000Z",
      },
    },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "pickup_point",
      legacy_selection_fresh: true,
      legacy_method_label: "ApiShip pickup",
    },
  })

  assert.equal(preview.verdict, "projected_commit_matched")
  assert.equal(preview.commit_payload_readiness, "matched")
  assert.equal(preview.matched_field_count, 6)
  assert.equal(preview.mismatched_field_count, 0)
  assert.deepEqual(preview.blocked_readiness_codes, [])
  assert.deepEqual(preview.blocked_parity_codes, [])
})

test("buildDeliveryHubProjectedCommitParityPreviewModel reports mismatch for missing connection_id", () => {
  const preview = buildDeliveryHubProjectedCommitParityPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_projected_commit_missing_connection",
      status: "ready",
      issues: [],
      selection: null,
      quote_context: {
        connection: {
          connection_id: null as never,
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_projected_commit_missing_connection", version: 1 },
        pickup_point_required: false,
        pickup_window_required: false,
        updated_at: "2026-04-22T10:40:00.000Z",
      },
    } as any,
  })

  assert.equal(preview.verdict, "projected_commit_mismatched")
  assert.equal(preview.fields.find((field) => field.key === "connection_id")?.status, "mismatched")
  assert.ok(preview.mismatch_reasons.some((reason) => reason.includes("connection_id")))
})

test("buildDeliveryHubProjectedCommitParityPreviewModel reports mismatch for missing quote_reference", () => {
  const preview = buildDeliveryHubProjectedCommitParityPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_projected_commit_missing_quote_reference",
      status: "ready",
      issues: [],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_projected_commit_missing_quote_reference",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: null as never,
        pickup_point_required: false,
        pickup_window_required: false,
        updated_at: "2026-04-22T10:45:00.000Z",
      },
    } as any,
  })

  assert.equal(preview.verdict, "projected_commit_mismatched")
  assert.equal(preview.quote_reference_present, false)
  assert.equal(preview.fields.find((field) => field.key === "quote_reference")?.status, "mismatched")
})

test("buildDeliveryHubProjectedCommitParityPreviewModel reports pickup point mismatch when required and absent", () => {
  const preview = buildDeliveryHubProjectedCommitParityPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_projected_commit_missing_pickup_point",
      status: "ready",
      issues: [],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_projected_commit_missing_pickup_point",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_projected_commit_missing_pickup_point", version: 1 },
        pickup_point_required: true,
        pickup_window_required: false,
        updated_at: "2026-04-22T10:50:00.000Z",
      },
    },
    pickup_points: { ok: true, points: [] },
  })

  assert.equal(preview.verdict, "projected_commit_mismatched")
  assert.equal(preview.pickup_point_required, true)
  assert.equal(preview.pickup_point_present, false)
  assert.equal(preview.fields.find((field) => field.key === "pickup_point")?.status, "mismatched")
  assert.equal(preview.fields.find((field) => field.key === "commit_payload_readiness")?.status, "mismatched")
})

test("buildDeliveryHubProjectedCommitParityPreviewModel reports pickup window mismatch when required and absent", () => {
  const preview = buildDeliveryHubProjectedCommitParityPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_projected_commit_missing_pickup_window",
      status: "ready",
      issues: [],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_projected_commit_missing_pickup_window",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_projected_commit_missing_pickup_window", version: 1 },
        pickup_point_required: false,
        pickup_window_required: true,
        updated_at: "2026-04-22T10:55:00.000Z",
      },
    },
    pickup_windows: { ok: true, pickup_windows: [] },
  })

  assert.equal(preview.verdict, "projected_commit_mismatched")
  assert.equal(preview.pickup_window_required, true)
  assert.equal(preview.pickup_window_present, false)
  assert.equal(preview.fields.find((field) => field.key === "pickup_window")?.status, "mismatched")
  assert.equal(preview.fields.find((field) => field.key === "commit_payload_readiness")?.status, "mismatched")
})

test("buildDeliveryHubProjectedCommitParityPreviewModel reports readiness-blocked projected commit parity", () => {
  const preview = buildDeliveryHubProjectedCommitParityPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_projected_commit_blocked",
      status: "not_ready",
      issues: [
        {
          code: "connection_credentials_not_ready",
          message: "Connection credentials are not ready",
          field: "connection_id",
        },
      ],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_projected_commit_blocked",
          state: "credentials_not_ready",
          ready: false,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_projected_commit_blocked", version: 1 },
        pickup_point_required: false,
        pickup_window_required: false,
        updated_at: "2026-04-22T11:00:00.000Z",
      },
    },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "pickup_point",
      legacy_selection_fresh: true,
      legacy_method_label: "ApiShip pickup",
    },
  })
  const serialized = JSON.stringify(preview).toLowerCase()

  assert.equal(preview.verdict, "blocked")
  assert.equal(preview.commit_payload_readiness, "blocked")
  assert.deepEqual(preview.blocked_readiness_codes, ["connection_unavailable"])
  assert.equal(preview.fields.find((field) => field.key === "connection_id")?.status, "blocked")
  assert.equal(serialized.includes("credentials"), false)
  assert.equal(serialized.includes("connection_credentials_not_ready"), false)
})

test("buildDeliveryHubProjectedCommitParityPreviewModel stays shopper-safe and preview-only", () => {
  const preview = buildDeliveryHubProjectedCommitParityPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_projected_commit_safe_preview",
      status: "not_ready",
      issues: [
        {
          code: "connection_credentials_not_ready",
          message: "Connection credentials are not ready",
          field: "connection_id",
        },
      ],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_projected_commit_safe_preview",
          state: "credentials_not_ready",
          ready: false,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_projected_commit_safe_preview", version: 1 },
        pickup_point_required: false,
        pickup_window_required: false,
        updated_at: "2026-04-22T11:10:00.000Z",
      },
    },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "door_delivery",
      legacy_selection_fresh: false,
      legacy_method_label: "ApiShip courier",
    },
  }) as Record<string, unknown>
  const serialized = JSON.stringify(preview).toLowerCase()

  assert.equal(preview.mutation_intent, false)
  assert.equal(preview.dry_run_only, true)
  assert.equal(serialized.includes("activation"), false)
  assert.equal(serialized.includes("save"), false)
  assert.equal(serialized.includes("submit"), false)
  for (const forbidden of [
    "provider_code",
    "quote_key",
    "raw_reference",
    "token",
    "secret",
    "credentials",
    "connection_credentials_not_ready",
    "legacy_context_stale",
    "yandex",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden)
  }
})

test("buildDeliveryHubSelectionWriteSeamPreviewModel reports fully derivable shopper-safe write shape", () => {
  const preview = buildDeliveryHubSelectionWriteSeamPreviewModel({
    cart_id: "cart_write_preview_ready",
    readiness: {
      ok: true,
      cart_id: "cart_write_preview_ready",
      status: "ready",
      issues: [],
      selection: {
        version: 3,
        connection_id: "conn_write_preview_ready",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_write_preview_ready", version: 4 },
        quote: {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: true,
        },
        pickup_point: {
          provider_point_id: "pvz_write_ready",
          provider_point_code: null,
          name: "Write ready PVZ",
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
          label: "22 Apr · 10:00–14:00",
        },
        updated_at: "2026-04-22T11:30:00.000Z",
      },
      quote_context: {
        connection: {
          connection_id: "conn_write_preview_ready",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_write_preview_ready", version: 4 },
        pickup_point_required: true,
        pickup_window_required: true,
        updated_at: "2026-04-22T11:30:00.000Z",
      },
    },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "pickup_point",
      legacy_selection_fresh: true,
      legacy_method_label: "ApiShip pickup",
    },
  })

  assert.equal(preview.verdict, "write_shape_preview_available")
  assert.equal(preview.shape_completeness, "complete")
  assert.equal(preview.projected_payload?.cart_id, "cart_write_preview_ready")
  assert.equal(preview.projected_payload?.connection_id, "conn_write_preview_ready")
  assert.equal(preview.projected_payload?.quote_type, "warehouse_to_pickup_point")
  assert.equal(preview.projected_payload?.quote_reference?.id, "quote_write_preview_ready")
  assert.equal(preview.projected_payload?.pickup_point?.provider_point_id, "pvz_write_ready")
  assert.equal(preview.projected_payload?.pickup_window?.date, "2026-04-22")
  assert.equal(preview.selection_version, 3)
  assert.equal(preview.mutation_intent, false)
  assert.equal(preview.dry_run_only, true)
})

test("buildDeliveryHubSelectionWriteSeamPreviewModel reports incomplete shape when required pickup point is missing", () => {
  const preview = buildDeliveryHubSelectionWriteSeamPreviewModel({
    cart_id: "cart_write_preview_missing_point",
    readiness: {
      ok: true,
      cart_id: "cart_write_preview_missing_point",
      status: "not_ready",
      issues: [
        {
          code: "pickup_point_missing",
          message: "Pickup point is required",
          field: "pickup_point",
        },
      ],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_write_preview_missing_point",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_write_preview_missing_point", version: 1 },
        pickup_point_required: true,
        pickup_window_required: false,
        updated_at: "2026-04-22T11:40:00.000Z",
      },
    },
    quotes: {
      ok: true,
      quotes: [
        {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          mode_code: "warehouse_to_pickup_point",
          quote_reference: { id: "quote_write_preview_missing_point", version: 1 },
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_point_ids: [],
          pickup_window_required: false,
        },
      ],
    },
    pickup_points: { ok: true, points: [] },
  })

  assert.equal(preview.verdict, "write_shape_preview_incomplete")
  assert.equal(preview.shape_completeness, "partial")
  assert.equal(preview.pickup_point_required, true)
  assert.equal(preview.pickup_point_present, false)
  assert.equal(preview.fields.find((field) => field.key === "pickup_point")?.status, "missing")
})

test("buildDeliveryHubSelectionWriteSeamPreviewModel reports incomplete shape when required pickup window is missing", () => {
  const preview = buildDeliveryHubSelectionWriteSeamPreviewModel({
    cart_id: "cart_write_preview_missing_window",
    readiness: {
      ok: true,
      cart_id: "cart_write_preview_missing_window",
      status: "not_ready",
      issues: [
        {
          code: "pickup_window_missing",
          message: "Pickup window is required",
          field: "pickup_window",
        },
      ],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_write_preview_missing_window",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_write_preview_missing_window", version: 1 },
        pickup_point_required: false,
        pickup_window_required: true,
        updated_at: "2026-04-22T11:50:00.000Z",
      },
    },
    quotes: {
      ok: true,
      quotes: [
        {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          mode_code: "warehouse_to_pickup_point",
          quote_reference: { id: "quote_write_preview_missing_window", version: 1 },
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: false,
          pickup_point_ids: [],
          pickup_window_required: true,
        },
      ],
    },
    pickup_windows: { ok: true, pickup_windows: [] },
  })

  assert.equal(preview.verdict, "write_shape_preview_incomplete")
  assert.equal(preview.shape_completeness, "partial")
  assert.equal(preview.pickup_window_required, true)
  assert.equal(preview.pickup_window_present, false)
  assert.equal(preview.fields.find((field) => field.key === "pickup_window")?.status, "missing")
})

test("buildDeliveryHubSelectionWriteSeamPreviewModel reports incomplete shape for missing quote reference or connection context", () => {
  const missingQuoteReference = buildDeliveryHubSelectionWriteSeamPreviewModel({
    cart_id: "cart_write_preview_missing_quote_reference",
    readiness: {
      ok: true,
      cart_id: "cart_write_preview_missing_quote_reference",
      status: "ready",
      issues: [],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_write_preview_missing_quote_reference",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: null as never,
        pickup_point_required: false,
        pickup_window_required: false,
        updated_at: "2026-04-22T12:00:00.000Z",
      },
    } as any,
  })

  const missingConnection = buildDeliveryHubSelectionWriteSeamPreviewModel({
    cart_id: "cart_write_preview_missing_connection",
    readiness: {
      ok: true,
      cart_id: "cart_write_preview_missing_connection",
      status: "ready",
      issues: [],
      selection: null,
      quote_context: {
        connection: {
          connection_id: null as never,
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_write_preview_missing_connection", version: 1 },
        pickup_point_required: false,
        pickup_window_required: false,
        updated_at: "2026-04-22T12:05:00.000Z",
      },
    } as any,
  })

  assert.equal(missingQuoteReference.verdict, "write_shape_preview_incomplete")
  assert.equal(missingQuoteReference.quote_reference_present, false)
  assert.equal(
    missingQuoteReference.fields.find((field) => field.key === "quote_reference")?.status,
    "missing"
  )

  assert.equal(missingConnection.verdict, "write_shape_preview_incomplete")
  assert.equal(missingConnection.connection_id, null)
  assert.equal(
    missingConnection.fields.find((field) => field.key === "connection_id")?.status,
    "missing"
  )
})

test("buildDeliveryHubSelectionWriteSeamPreviewModel stays shopper-safe preview-only with no mutation wording or network intent", () => {
  const preview = buildDeliveryHubSelectionWriteSeamPreviewModel({
    cart_id: "cart_write_preview_safe",
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: false,
      legacy_flow_kind: null,
      legacy_selection_fresh: false,
      legacy_method_label: null,
    },
  }) as Record<string, unknown>
  const serialized = JSON.stringify(preview).toLowerCase()

  assert.equal(preview["mutation_intent"], false)
  assert.equal(preview["dry_run_only"], true)
  assert.equal(serialized.includes("activation"), false)
  assert.equal(serialized.includes("save"), false)
  assert.equal(serialized.includes("submit"), false)
  for (const forbidden of [
    "provider_code",
    "quote_key",
    "raw_reference",
    "token",
    "secret",
    "credentials",
    "provider_quote_id",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden)
  }
})

test("buildDeliveryHubWriteIntentContractPreviewModel reports intent shape available from existing preview surfaces", () => {
  const preview = buildDeliveryHubWriteIntentContractPreviewModel({
    cart_id: "cart_write_intent_ready",
    readiness: {
      ok: true,
      cart_id: "cart_write_intent_ready",
      status: "ready",
      issues: [],
      selection: {
        version: 7,
        connection_id: "conn_write_intent_ready",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_write_intent_ready", version: 2 },
        quote: {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: true,
        },
        pickup_point: {
          provider_point_id: "pvz_write_intent_ready",
          provider_point_code: null,
          name: "Write intent PVZ",
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
          date: "2026-04-23",
          time_from: "10:00",
          time_to: "14:00",
          interval_utc: {
            from: "2026-04-23T07:00:00.000Z",
            to: "2026-04-23T11:00:00.000Z",
          },
          label: "23 Apr · 10:00–14:00",
        },
        updated_at: "2026-04-23T10:00:00.000Z",
      },
      quote_context: {
        connection: {
          connection_id: "conn_write_intent_ready",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_write_intent_ready", version: 2 },
        pickup_point_required: true,
        pickup_window_required: true,
        updated_at: "2026-04-23T10:00:00.000Z",
      },
    },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "pickup_point",
      legacy_selection_fresh: true,
      legacy_method_label: "ApiShip pickup",
    },
  })

  assert.equal(preview.status, "intent_shape_available")
  assert.equal(preview.mutation_intent, false)
  assert.equal(preview.submit_enabled, false)
  assert.equal(preview.network_required_now, false)
  assert.equal(preview.blocked_reasons.length, 0)
  assert.equal(preview.disabled_actions.includes("network_request"), true)
})

test("buildDeliveryHubWriteIntentContractPreviewModel reports incomplete state for missing quote_reference", () => {
  const preview = buildDeliveryHubWriteIntentContractPreviewModel({
    cart_id: "cart_write_intent_missing_quote_reference",
    readiness: {
      ok: true,
      cart_id: "cart_write_intent_missing_quote_reference",
      status: "ready",
      issues: [],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_write_intent_missing_quote_reference",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: null as never,
        pickup_point_required: false,
        pickup_window_required: false,
        updated_at: "2026-04-23T10:05:00.000Z",
      },
    } as any,
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "pickup_point",
      legacy_selection_fresh: true,
      legacy_method_label: "ApiShip pickup",
    },
  })

  assert.equal(preview.status, "intent_incomplete")
  assert.equal(preview.blocked_reasons.includes("quote_reference_missing"), true)
  assert.equal(
    preview.prerequisites.find((prerequisite) => prerequisite.key === "quote_reference")?.status,
    "missing"
  )
})

test("buildDeliveryHubWriteIntentContractPreviewModel reports incomplete state for missing pickup point or pickup window", () => {
  const missingPickupPoint = buildDeliveryHubWriteIntentContractPreviewModel({
    cart_id: "cart_write_intent_missing_pickup_point",
    readiness: {
      ok: true,
      cart_id: "cart_write_intent_missing_pickup_point",
      status: "not_ready",
      issues: [
        {
          code: "pickup_point_missing",
          message: "Pickup point is required",
          field: "pickup_point",
        },
      ],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_write_intent_missing_pickup_point",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_write_intent_missing_pickup_point", version: 1 },
        pickup_point_required: true,
        pickup_window_required: false,
        updated_at: "2026-04-23T10:10:00.000Z",
      },
    },
    quotes: {
      ok: true,
      quotes: [
        {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          mode_code: "warehouse_to_pickup_point",
          quote_reference: { id: "quote_write_intent_missing_pickup_point", version: 1 },
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_point_ids: [],
          pickup_window_required: false,
        },
      ],
    },
    pickup_points: { ok: true, points: [] },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "pickup_point",
      legacy_selection_fresh: true,
      legacy_method_label: "ApiShip pickup",
    },
  })

  const missingPickupWindow = buildDeliveryHubWriteIntentContractPreviewModel({
    cart_id: "cart_write_intent_missing_pickup_window",
    readiness: {
      ok: true,
      cart_id: "cart_write_intent_missing_pickup_window",
      status: "not_ready",
      issues: [
        {
          code: "pickup_window_missing",
          message: "Pickup window is required",
          field: "pickup_window",
        },
      ],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_write_intent_missing_pickup_window",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_write_intent_missing_pickup_window", version: 1 },
        pickup_point_required: false,
        pickup_window_required: true,
        updated_at: "2026-04-23T10:15:00.000Z",
      },
    },
    quotes: {
      ok: true,
      quotes: [
        {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          mode_code: "warehouse_to_pickup_point",
          quote_reference: { id: "quote_write_intent_missing_pickup_window", version: 1 },
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: false,
          pickup_point_ids: [],
          pickup_window_required: true,
        },
      ],
    },
    pickup_windows: { ok: true, pickup_windows: [] },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "pickup_point",
      legacy_selection_fresh: true,
      legacy_method_label: "ApiShip pickup",
    },
  })

  assert.equal(missingPickupPoint.status, "intent_incomplete")
  assert.equal(missingPickupPoint.blocked_reasons.includes("pickup_point_missing"), true)
  assert.equal(
    missingPickupPoint.prerequisites.find((prerequisite) => prerequisite.key === "pickup_point")
      ?.status,
    "missing"
  )

  assert.equal(missingPickupWindow.status, "intent_incomplete")
  assert.equal(missingPickupWindow.blocked_reasons.includes("pickup_window_missing"), true)
  assert.equal(
    missingPickupWindow.prerequisites.find((prerequisite) => prerequisite.key === "pickup_window")
      ?.status,
    "missing"
  )
})

test("buildDeliveryHubWriteIntentContractPreviewModel reports blocked state for degraded readiness or parity blockers", () => {
  const preview = buildDeliveryHubWriteIntentContractPreviewModel({
    cart_id: "cart_write_intent_blocked",
    readiness: {
      ok: true,
      cart_id: "cart_write_intent_blocked",
      status: "not_ready",
      issues: [
        {
          code: "connection_disabled",
          message: "Connection disabled",
          field: "connection_id",
        },
      ],
      selection: {
        version: 2,
        connection_id: "conn_write_intent_blocked",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_write_intent_blocked", version: 1 },
        quote: {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: false,
          pickup_window_required: false,
        },
        pickup_point: {
          provider_point_id: "pvz_write_intent_blocked",
          provider_point_code: null,
          name: "Blocked PVZ",
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
        updated_at: "2026-04-23T10:20:00.000Z",
      },
      quote_context: {
        connection: {
          connection_id: "conn_write_intent_blocked",
          state: "disabled",
          ready: false,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_write_intent_blocked", version: 1 },
        pickup_point_required: false,
        pickup_window_required: false,
        updated_at: "2026-04-23T10:20:00.000Z",
      },
    },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "pickup_point",
      legacy_selection_fresh: false,
      legacy_method_label: "ApiShip pickup",
    },
  })

  assert.equal(preview.status, "blocked")
  assert.ok(preview.blocked_reasons.length > 0)
  assert.equal(preview.blocked_prerequisite_count > 0, true)
})

test("buildDeliveryHubWriteIntentContractPreviewModel stays shopper-safe preview-only with no submit wording or network intent", () => {
  const preview = buildDeliveryHubWriteIntentContractPreviewModel({
    cart_id: "cart_write_intent_safe",
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: false,
      legacy_flow_kind: null,
      legacy_selection_fresh: false,
      legacy_method_label: null,
    },
  }) as Record<string, unknown>
  const textSurface = [
    preview["status_label"],
    preview["summary_label"],
    preview["preview_label"],
    preview["intent_target_label"],
    ...(Array.isArray(preview["hint_messages"]) ? (preview["hint_messages"] as string[]) : []),
    ...(Array.isArray(preview["blocked_reasons"]) ? (preview["blocked_reasons"] as string[]) : []),
    ...(Array.isArray(preview["disabled_actions"]) ? (preview["disabled_actions"] as string[]) : []),
    ...((Array.isArray(preview["prerequisites"])
      ? (preview["prerequisites"] as Array<Record<string, unknown>>).flatMap((prerequisite) => [
          prerequisite["label"],
          prerequisite["status"],
          prerequisite["detail_label"],
        ])
      : []) as Array<string | unknown>),
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase()

  assert.equal(preview["mutation_intent"], false)
  assert.equal(preview["submit_enabled"], false)
  assert.equal(preview["network_required_now"], false)
  assert.equal(textSurface.includes("activation"), false)
  assert.equal(textSurface.includes("save"), false)
  assert.equal(textSurface.includes("submit"), false)
  for (const forbidden of [
    "provider_code",
    "quote_key",
    "raw_reference",
    "token",
    "secret",
    "credentials",
    "provider_quote_id",
    "yandex",
  ]) {
    assert.equal(textSurface.includes(forbidden), false, forbidden)
  }
})

test("buildDeliveryHubSelectionPayloadParityPreviewModel reports matched payload parity", () => {
  const preview = buildDeliveryHubSelectionPayloadParityPreviewModel({
    cart_id: "cart_payload_parity_ready",
    readiness: {
      ok: true,
      cart_id: "cart_payload_parity_ready",
      status: "ready",
      issues: [],
      selection: {
        version: 5,
        connection_id: "conn_payload_parity_ready",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_payload_parity_ready", version: 2 },
        quote: {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: true,
        },
        pickup_point: {
          provider_point_id: "pvz_payload_parity_ready",
          provider_point_code: null,
          name: "Payload parity PVZ",
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
          date: "2026-04-23",
          time_from: "10:00",
          time_to: "14:00",
          interval_utc: {
            from: "2026-04-23T07:00:00.000Z",
            to: "2026-04-23T11:00:00.000Z",
          },
          label: "23 Apr · 10:00–14:00",
        },
        updated_at: "2026-04-23T10:30:00.000Z",
      },
      quote_context: {
        connection: {
          connection_id: "conn_payload_parity_ready",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_payload_parity_ready", version: 2 },
        pickup_point_required: true,
        pickup_window_required: true,
        updated_at: "2026-04-23T10:30:00.000Z",
      },
    },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "pickup_point",
      legacy_selection_fresh: true,
      legacy_method_label: "ApiShip pickup",
    },
  })

  assert.equal(preview.verdict, "matched")
  assert.equal(preview.matched_field_count > 0, true)
  assert.equal(preview.incomplete_field_count, 0)
  assert.equal(preview.blocked_field_count, 0)
  assert.equal(preview.selection_version, 5)
  assert.equal(preview.network_required_now, false)
  assert.equal(preview.mutation_intent, false)
})

test("buildDeliveryHubSelectionPayloadParityPreviewModel reports incomplete state for missing quote_reference", () => {
  const preview = buildDeliveryHubSelectionPayloadParityPreviewModel({
    cart_id: "cart_payload_parity_missing_quote_reference",
    readiness: {
      ok: true,
      cart_id: "cart_payload_parity_missing_quote_reference",
      status: "ready",
      issues: [],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_payload_parity_missing_quote_reference",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: null as never,
        pickup_point_required: false,
        pickup_window_required: false,
        updated_at: "2026-04-23T10:35:00.000Z",
      },
    } as any,
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "pickup_point",
      legacy_selection_fresh: true,
      legacy_method_label: "ApiShip pickup",
    },
  })

  assert.equal(preview.verdict, "incomplete")
  assert.equal(preview.quote_reference_present, false)
  assert.equal(preview.blocked_reasons.includes("quote_reference_missing"), true)
  assert.equal(preview.fields.find((field) => field.key === "quote_reference")?.status, "incomplete")
})

test("buildDeliveryHubSelectionPayloadParityPreviewModel reports incomplete state for missing required pickup_point", () => {
  const preview = buildDeliveryHubSelectionPayloadParityPreviewModel({
    cart_id: "cart_payload_parity_missing_pickup_point",
    readiness: {
      ok: true,
      cart_id: "cart_payload_parity_missing_pickup_point",
      status: "not_ready",
      issues: [
        {
          code: "pickup_point_missing",
          message: "Pickup point is required",
          field: "pickup_point",
        },
      ],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_payload_parity_missing_pickup_point",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_payload_parity_missing_pickup_point", version: 1 },
        pickup_point_required: true,
        pickup_window_required: false,
        updated_at: "2026-04-23T10:40:00.000Z",
      },
    },
    quotes: {
      ok: true,
      quotes: [
        {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          mode_code: "warehouse_to_pickup_point",
          quote_reference: { id: "quote_payload_parity_missing_pickup_point", version: 1 },
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_point_ids: [],
          pickup_window_required: false,
        },
      ],
    },
    pickup_points: { ok: true, points: [] },
  })

  assert.equal(preview.verdict, "incomplete")
  assert.equal(preview.pickup_point_required, true)
  assert.equal(preview.pickup_point_present, false)
  assert.equal(preview.blocked_reasons.includes("pickup_point_missing"), true)
  assert.equal(preview.fields.find((field) => field.key === "pickup_point")?.status, "incomplete")
})

test("buildDeliveryHubSelectionPayloadParityPreviewModel reports incomplete state for missing required pickup_window", () => {
  const preview = buildDeliveryHubSelectionPayloadParityPreviewModel({
    cart_id: "cart_payload_parity_missing_pickup_window",
    readiness: {
      ok: true,
      cart_id: "cart_payload_parity_missing_pickup_window",
      status: "not_ready",
      issues: [
        {
          code: "pickup_window_missing",
          message: "Pickup window is required",
          field: "pickup_window",
        },
      ],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_payload_parity_missing_pickup_window",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_payload_parity_missing_pickup_window", version: 1 },
        pickup_point_required: false,
        pickup_window_required: true,
        updated_at: "2026-04-23T10:45:00.000Z",
      },
    },
    quotes: {
      ok: true,
      quotes: [
        {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          mode_code: "warehouse_to_pickup_point",
          quote_reference: { id: "quote_payload_parity_missing_pickup_window", version: 1 },
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: false,
          pickup_point_ids: [],
          pickup_window_required: true,
        },
      ],
    },
    pickup_windows: { ok: true, pickup_windows: [] },
  })

  assert.equal(preview.verdict, "incomplete")
  assert.equal(preview.pickup_window_required, true)
  assert.equal(preview.pickup_window_present, false)
  assert.equal(preview.blocked_reasons.includes("pickup_window_missing"), true)
  assert.equal(preview.fields.find((field) => field.key === "pickup_window")?.status, "incomplete")
})

test("buildDeliveryHubSelectionPayloadParityPreviewModel reports blocked state for degraded readiness or parity blockers", () => {
  const preview = buildDeliveryHubSelectionPayloadParityPreviewModel({
    cart_id: "cart_payload_parity_blocked",
    readiness: {
      ok: true,
      cart_id: "cart_payload_parity_blocked",
      status: "not_ready",
      issues: [
        {
          code: "connection_disabled",
          message: "Connection disabled",
          field: "connection_id",
        },
      ],
      selection: {
        version: 2,
        connection_id: "conn_payload_parity_blocked",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_payload_parity_blocked", version: 1 },
        quote: {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: false,
          pickup_window_required: false,
        },
        pickup_point: {
          provider_point_id: "pvz_payload_parity_blocked",
          provider_point_code: null,
          name: "Blocked PVZ",
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
        updated_at: "2026-04-23T10:50:00.000Z",
      },
      quote_context: {
        connection: {
          connection_id: "conn_payload_parity_blocked",
          state: "disabled",
          ready: false,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_payload_parity_blocked", version: 1 },
        pickup_point_required: false,
        pickup_window_required: false,
        updated_at: "2026-04-23T10:50:00.000Z",
      },
    },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "pickup_point",
      legacy_selection_fresh: false,
      legacy_method_label: "ApiShip pickup",
    },
  })

  assert.equal(preview.verdict, "blocked")
  assert.equal(preview.blocked_field_count > 0, true)
  assert.equal(preview.blocked_reasons.length > 0, true)
})

test("buildDeliveryHubSelectionPayloadParityPreviewModel stays shopper-safe preview-only with no leaked fields or mutation wording", () => {
  const preview = buildDeliveryHubSelectionPayloadParityPreviewModel({
    cart_id: "cart_payload_parity_safe",
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: false,
      legacy_flow_kind: null,
      legacy_selection_fresh: false,
      legacy_method_label: null,
    },
  }) as Record<string, unknown>
  const textSurface = JSON.stringify(preview).toLowerCase()

  assert.equal(preview["mutation_intent"], false)
  assert.equal(preview["network_required_now"], false)
  assert.equal(textSurface.includes("activation"), false)
  assert.equal(textSurface.includes("submit"), false)
  assert.equal(textSurface.includes("save("), false)
  assert.equal(textSurface.includes("save delivery"), false)
  for (const forbidden of [
    "provider_code",
    "quote_key",
    "raw_reference",
    "token",
    "secret",
    "credentials",
    "provider_quote_id",
    "yandex",
  ]) {
    assert.equal(textSurface.includes(forbidden), false, forbidden)
  }
})

test("buildDeliveryHubSelectionSaveCutInPayload returns backend-ready neutral save payload", () => {
  const guard = buildDeliveryHubSelectionSaveCutInPayload({
    cart_id: "cart_save_cut_in_ready",
    readiness: {
      ok: true,
      cart_id: "cart_save_cut_in_ready",
      status: "ready",
      issues: [],
      selection: {
        version: 1,
        connection_id: "conn_save_cut_in_ready",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "dhsel_quote_save_cut_in_ready", version: 3 },
        quote: {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: true,
        },
        pickup_point: {
          provider_point_id: "pvz_save_cut_in_ready",
          provider_point_code: null,
          name: "Ready PVZ",
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
          date: "2026-04-24",
          time_from: "10:00",
          time_to: "14:00",
          interval_utc: {
            from: "2026-04-24T07:00:00.000Z",
            to: "2026-04-24T11:00:00.000Z",
          },
          label: "24 Apr · 10:00–14:00",
        },
        updated_at: "2026-04-23T10:55:00.000Z",
      },
      quote_context: {
        connection: {
          connection_id: "conn_save_cut_in_ready",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "dhsel_quote_save_cut_in_ready", version: 3 },
        pickup_point_required: true,
        pickup_window_required: true,
        updated_at: "2026-04-23T10:55:00.000Z",
      },
    },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "pickup_point",
      legacy_selection_fresh: true,
      legacy_method_label: "ApiShip pickup",
    },
  })

  assert.equal(guard.status, "ready")
  assert.deepEqual(guard.reason_codes, [])
  assert.deepEqual(guard.payload, {
    cart_id: "cart_save_cut_in_ready",
    connection_id: "conn_save_cut_in_ready",
    quote_type: "warehouse_to_pickup_point",
    quote_reference: { id: "dhsel_quote_save_cut_in_ready", version: 3 },
    quote: {
      carrier_code: "neutral_carrier",
      carrier_label: "Neutral Carrier",
      amount: 499,
      currency_code: "RUB",
      delivery_eta_min: 1,
      delivery_eta_max: 2,
      pickup_point_required: true,
      pickup_window_required: true,
    },
    pickup_point: {
      provider_point_id: "pvz_save_cut_in_ready",
      provider_point_code: null,
      name: "Ready PVZ",
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
      date: "2026-04-24",
      time_from: "10:00",
      time_to: "14:00",
      interval_utc: {
        from: "2026-04-24T07:00:00.000Z",
        to: "2026-04-24T11:00:00.000Z",
      },
      label: "24 Apr · 10:00–14:00",
    },
    correlation_id: null,
  })
  assert.equal("provider_code" in (guard.payload ?? {}), false)
})

test("buildDeliveryHubSelectionSaveCutInPayload blocks incomplete or stale save input", () => {
  const guard = buildDeliveryHubSelectionSaveCutInPayload({
    cart_id: "cart_save_cut_in_blocked",
    readiness: {
      ok: true,
      cart_id: "cart_save_cut_in_blocked",
      status: "not_ready",
      issues: [
        {
          code: "pickup_window_missing",
          message: "Pickup window is required",
          field: "pickup_window",
        },
      ],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_save_cut_in_blocked",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "dhsel_quote_save_cut_in_blocked", version: 1 },
        pickup_point_required: true,
        pickup_window_required: true,
        updated_at: "2026-04-23T11:00:00.000Z",
      },
    },
    quotes: {
      ok: true,
      quotes: [
        {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          mode_code: "warehouse_to_pickup_point",
          quote_reference: { id: "dhsel_quote_save_cut_in_blocked", version: 1 },
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_point_ids: ["pvz_save_cut_in_blocked"],
          pickup_window_required: true,
        },
      ],
    },
    pickup_points: {
      ok: true,
      points: [
        {
          provider_point_id: "pvz_save_cut_in_blocked",
          provider_point_code: null,
          name: "Blocked PVZ",
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
      ],
    },
    pickup_windows: { ok: true, pickup_windows: [] },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: false,
      legacy_flow_kind: null,
      legacy_selection_fresh: false,
      legacy_method_label: null,
    },
  })

  assert.equal(guard.status, "blocked")
  assert.equal(guard.payload, null)
  assert.equal(guard.reason_codes.includes("pickup_window_missing"), true)
  assert.equal(guard.reason_codes.includes("readiness_blocked"), true)
  assert.equal(guard.reason_codes.includes("legacy_parity_mismatch"), false)
})

test("buildDeliveryHubSelectionSaveCutInPayload exposes no provider raw payload or secret-like fields", () => {
  const guard = buildDeliveryHubSelectionSaveCutInPayload({
    cart_id: "cart_save_cut_in_safe",
    readiness: {
      ok: true,
      cart_id: "cart_save_cut_in_safe",
      status: "ready",
      issues: [],
      selection: {
        version: 1,
        connection_id: "conn_save_cut_in_safe",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "dhsel_quote_save_cut_in_safe", version: 1 },
        quote: {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: false,
        },
        pickup_point: {
          provider_point_id: "pvz_save_cut_in_safe",
          provider_point_code: null,
          name: "Safe PVZ",
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
        updated_at: "2026-04-23T11:05:00.000Z",
        raw_reference: { provider_offer_id: "raw_offer_1" },
        metadata: { secret: "should_not_leak" },
        authorization: "Bearer secret",
      } as any,
      quote_context: {
        connection: {
          connection_id: "conn_save_cut_in_safe",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "dhsel_quote_save_cut_in_safe", version: 1 },
        pickup_point_required: true,
        pickup_window_required: false,
        updated_at: "2026-04-23T11:05:00.000Z",
      },
    } as any,
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "pickup_point",
      legacy_selection_fresh: true,
      legacy_method_label: "ApiShip pickup",
    },
  })

  assert.equal(guard.status, "ready")
  const serialized = JSON.stringify(guard).toLowerCase()

  for (const forbidden of [
    "raw_reference",
    "quote_key",
    "provider_offer_id",
    "metadata",
    "authorization",
    "credential",
    "secret",
    "token",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden)
  }
})

test("delivery-hub util preview stack remains no-network only for selection payload parity seam", () => {
  const source = readFileSync(new URL("./delivery-hub.ts", import.meta.url), "utf8")

  assert.equal(source.includes("fetch("), false)
  assert.equal(source.includes("axios"), false)
  assert.equal(source.includes("XMLHttpRequest"), false)
})

test("delivery-hub util preview stack remains no-network only for write intent contract seam", () => {
  const source = readFileSync(new URL("./delivery-hub.ts", import.meta.url), "utf8")

  assert.equal(source.includes("fetch("), false)
  assert.equal(source.includes("axios"), false)
  assert.equal(source.includes("XMLHttpRequest"), false)
})

test("delivery-hub util preview stack remains no-network only for projected commit parity seam", () => {
  const source = readFileSync(new URL("./delivery-hub.ts", import.meta.url), "utf8")

  assert.equal(source.includes("fetch("), false)
  assert.equal(source.includes("axios"), false)
  assert.equal(source.includes("XMLHttpRequest"), false)
})

test("buildDeliveryHubHandoffContractMatrixPreviewModel marks missing quote reference", () => {
  const preview = buildDeliveryHubHandoffContractMatrixPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_matrix_missing_quote_reference",
      status: "ready",
      issues: [],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_matrix_missing_quote_reference",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: null as never,
        pickup_point_required: false,
        pickup_window_required: false,
        updated_at: "2026-04-22T10:00:00.000Z",
      },
    } as any,
  })

  assert.equal(preview.verdict, "contract_incomplete")
  assert.ok(preview.missing_fragment_keys.includes("quote_reference"))
  assert.equal(
    preview.fragments.find((fragment) => fragment.key === "quote_reference")?.status,
    "required_missing"
  )
})

test("buildDeliveryHubHandoffContractMatrixPreviewModel marks missing pickup point when required", () => {
  const preview = buildDeliveryHubHandoffContractMatrixPreviewModel({
    quotes: {
      ok: true,
      quotes: [
        {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          mode_code: "warehouse_to_pickup_point",
          quote_reference: { id: "quote_matrix_missing_point", version: 1 },
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: null,
          delivery_eta_max: null,
          pickup_point_required: true,
          pickup_point_ids: [],
          pickup_window_required: false,
        },
      ],
    },
    pickup_points: { ok: true, points: [] },
    readiness: {
      ok: true,
      cart_id: "cart_matrix_missing_point",
      status: "missing_selection",
      issues: [],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_matrix_missing_point",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_matrix_missing_point", version: 1 },
        pickup_point_required: true,
        pickup_window_required: false,
        updated_at: "2026-04-22T10:15:00.000Z",
      },
    },
  })

  assert.equal(preview.verdict, "contract_incomplete")
  assert.ok(preview.missing_fragment_keys.includes("pickup_point"))
  assert.equal(
    preview.fragments.find((fragment) => fragment.key === "pickup_point")?.status,
    "required_missing"
  )
})

test("buildDeliveryHubHandoffContractMatrixPreviewModel marks missing pickup window when required", () => {
  const preview = buildDeliveryHubHandoffContractMatrixPreviewModel({
    quotes: {
      ok: true,
      quotes: [
        {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          mode_code: "warehouse_to_pickup_point",
          quote_reference: { id: "quote_matrix_missing_window", version: 1 },
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: null,
          delivery_eta_max: null,
          pickup_point_required: false,
          pickup_point_ids: [],
          pickup_window_required: true,
        },
      ],
    },
    pickup_windows: { ok: true, pickup_windows: [] },
    readiness: {
      ok: true,
      cart_id: "cart_matrix_missing_window",
      status: "missing_selection",
      issues: [],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_matrix_missing_window",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_matrix_missing_window", version: 1 },
        pickup_point_required: false,
        pickup_window_required: true,
        updated_at: "2026-04-22T10:20:00.000Z",
      },
    },
  })

  assert.equal(preview.verdict, "contract_incomplete")
  assert.ok(preview.missing_fragment_keys.includes("pickup_window"))
  assert.equal(
    preview.fragments.find((fragment) => fragment.key === "pickup_window")?.status,
    "required_missing"
  )
})

test("buildDeliveryHubHandoffContractMatrixPreviewModel reports readiness-blocked case", () => {
  const preview = buildDeliveryHubHandoffContractMatrixPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_matrix_readiness_blocked",
      status: "not_ready",
      issues: [
        {
          code: "connection_credentials_not_ready",
          message: "Connection credentials are not ready",
          field: "connection_id",
        },
      ],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_matrix_readiness_blocked",
          state: "credentials_not_ready",
          ready: false,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: { id: "quote_matrix_readiness_blocked", version: 1 },
        pickup_point_required: false,
        pickup_window_required: false,
        updated_at: "2026-04-22T10:30:00.000Z",
      },
    },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "pickup_point",
      legacy_selection_fresh: true,
      legacy_method_label: "ApiShip pickup",
    },
  })

  assert.equal(preview.verdict, "contract_blocked")
  assert.ok(preview.blocked_readiness_codes.includes("connection_credentials_not_ready"))
  assert.equal(
    preview.fragments.find((fragment) => fragment.key === "readiness_gate")?.status,
    "blocked_by_readiness"
  )
})

test("buildDeliveryHubHandoffContractMatrixPreviewModel reports parity-blocked case", () => {
  const preview = buildDeliveryHubHandoffContractMatrixPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_matrix_parity_blocked",
      status: "ready",
      issues: [],
      selection: null,
      quote_context: {
        connection: {
          connection_id: "conn_matrix_parity_blocked",
          state: "ready",
          ready: true,
        },
        quote_type: "dropoff_point_to_pickup_point",
        quote_reference: { id: "quote_matrix_parity_blocked", version: 1 },
        pickup_point_required: false,
        pickup_window_required: false,
        updated_at: "2026-04-22T10:35:00.000Z",
      },
    },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "door_delivery",
      legacy_selection_fresh: true,
      legacy_method_label: "ApiShip door",
    },
  })

  assert.equal(preview.verdict, "contract_blocked")
  assert.ok(preview.blocked_parity_codes.includes("mode_mismatch"))
  assert.equal(
    preview.fragments.find((fragment) => fragment.key === "parity_gate")?.status,
    "blocked_by_parity"
  )
})

test("buildDeliveryHubHandoffContractMatrixPreviewModel stays informational for legacy-only context", () => {
  const preview = buildDeliveryHubHandoffContractMatrixPreviewModel({
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: false,
      legacy_flow_kind: null,
      legacy_selection_fresh: false,
      legacy_method_label: null,
    },
  })

  assert.equal(preview.verdict, "informational_only")
  assert.equal(preview.missing_fragment_keys.length, 0)
  assert.equal(
    preview.fragments.every((fragment) => fragment.status === "informational_only"),
    true
  )
})

test("buildDeliveryHubHandoffContractMatrixPreviewModel stays shopper-safe and preview-only", () => {
  const preview = buildDeliveryHubHandoffContractMatrixPreviewModel({
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: false,
      legacy_flow_kind: null,
      legacy_selection_fresh: false,
      legacy_method_label: null,
    },
  }) as Record<string, unknown>
  const serialized = JSON.stringify(preview).toLowerCase()

  assert.equal(preview.mutation_intent, false)
  assert.equal(preview.dry_run_only, true)
  for (const forbidden of [
    "provider_code",
    "quote_key",
    "raw_reference",
    "token",
    "secret",
    "credentials",
    "activation",
    "save",
    "submit",
    "network",
    "yandex",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden)
  }
})

test("checkout shipping source wires delivery-hub save/clear without Delivery Hub shipping method commit", () => {
  const source = readFileSync(
    new URL("../../modules/checkout/components/shipping/index.tsx", import.meta.url),
    "utf8"
  )

  assert.equal(source.includes("saveDeliveryHubSelection"), true)
  assert.equal(source.includes("clearDeliveryHubSelection"), true)
  assert.equal(source.includes("buildDeliveryHubSelectionSaveCutInPayload"), true)
  assert.equal(source.includes("setShippingMethod({\n      cartId: cart.id"), true)
  assert.equal(source.includes("shippingMethodId: guard.payload"), false)
  assert.equal(source.includes("shippingMethodId: deliveryHubSelectionSaveCutInGuard"), false)
})

test("buildDeliveryHubShadowSelectionActionabilityPreviewModel derives neutral read-only actionability states", () => {
  const readyPreview = buildDeliveryHubShadowSelectionActionabilityPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_action_ready",
      status: "ready",
      issues: [],
      selection: {
        version: 1,
        connection_id: "conn_action_ready",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_quote_action_ready",
          version: 1,
        },
        quote: {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          amount: 490,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_window_required: true,
        },
        pickup_point: {
          provider_point_id: "point_action_ready",
          provider_point_code: null,
          name: "Ready point",
          address: "Lenina 1",
          city: "Moscow",
          region: "Moscow",
          postal_code: "101000",
          lat: 55.75,
          lng: 37.61,
          is_origin_dropoff_allowed: false,
          is_destination_pickup_allowed: true,
          payment_methods: [],
        },
        pickup_window: {
          date: "2026-04-22",
          time_from: "10:00",
          time_to: "14:00",
          interval_utc: {
            from: "2026-04-22T07:00:00.000Z",
            to: "2026-04-22T11:00:00.000Z",
          },
          label: "22 Apr · 10:00–14:00",
        },
        updated_at: "2026-04-21T14:00:00.000Z",
      },
      quote_context: {
        connection: {
          connection_id: "conn_action_ready",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_quote_action_ready",
          version: 1,
        },
        pickup_point_required: true,
        pickup_window_required: true,
        updated_at: "2026-04-21T14:00:00.000Z",
      },
    },
    selection_response: null,
    settings_status: "ready",
    settings_enabled: true,
    settings_surface_status: "available",
    ready_connection_count: 1,
    settings_issue_message: null,
    quote_preview_status: "ready",
    quote_count: 2,
    quote_issue_message: null,
    pickup_point_preview_status: "ready",
    destination_pickup_point_count: 2,
    pickup_point_issue_message: null,
    pickup_window_preview_status: "ready",
    pickup_window_required_quote_count: 1,
    pickup_window_count: 3,
    pickup_window_issue_message: null,
  })

  assert.deepEqual(readyPreview, {
    tone: "positive",
    actionability_status: "ready",
    status_label: "Action-ready preview",
    connection_label: "conn_action_ready",
    modality_label: "Warehouse → pickup point",
    readiness_label: "Selection ready",
    hint_messages: [
      "Persisted neutral selection currently passes readiness checks and sampled shadow data does not signal a stale checkout constellation.",
      "Sampled pickup-window preview remains available for the current checkout context.",
    ],
  })

  const needsQuotePreview = buildDeliveryHubShadowSelectionActionabilityPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_action_quote",
      status: "missing_selection",
      issues: [],
      selection: null,
      quote_context: null,
    },
    selection_response: {
      ok: true,
      cart_id: "cart_action_quote",
      selection: null,
    },
    settings_status: "ready",
    settings_enabled: true,
    settings_surface_status: "available",
    ready_connection_count: 1,
    settings_issue_message: null,
    quote_preview_status: "ready",
    quote_count: 2,
    quote_issue_message: null,
    pickup_point_preview_status: "ready",
    destination_pickup_point_count: 2,
    pickup_point_issue_message: null,
    pickup_window_preview_status: "idle",
    pickup_window_required_quote_count: 0,
    pickup_window_count: 0,
    pickup_window_issue_message: null,
  })

  assert.deepEqual(needsQuotePreview, {
    tone: "neutral",
    actionability_status: "needs_quote",
    status_label: "Quote context still needed",
    connection_label: null,
    modality_label: null,
    readiness_label: "Selection missing",
    hint_messages: [
      "Sampled neutral quotes are available, but no neutral selection is currently persisted for this cart.",
    ],
  })

  const needsPickupWindowPreview = buildDeliveryHubShadowSelectionActionabilityPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_action_window",
      status: "not_ready",
      issues: [
        {
          code: "pickup_window_missing",
          message: "Pickup window is required",
          field: "pickup_window",
        },
      ],
      selection: {
        version: 1,
        connection_id: "conn_action_window",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_quote_action_window",
          version: 1,
        },
        quote: {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          amount: 520,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 3,
          pickup_point_required: true,
          pickup_window_required: true,
        },
        pickup_point: {
          provider_point_id: "point_action_window",
          provider_point_code: null,
          name: "Window point",
          address: "Tverskaya 1",
          city: "Moscow",
          region: "Moscow",
          postal_code: "101000",
          lat: 55.75,
          lng: 37.61,
          is_origin_dropoff_allowed: false,
          is_destination_pickup_allowed: true,
          payment_methods: [],
        },
        pickup_window: null,
        updated_at: "2026-04-21T14:10:00.000Z",
      },
      quote_context: {
        connection: {
          connection_id: "conn_action_window",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_quote_action_window",
          version: 1,
        },
        pickup_point_required: true,
        pickup_window_required: true,
        updated_at: "2026-04-21T14:10:00.000Z",
      },
    },
    selection_response: null,
    settings_status: "ready",
    settings_enabled: true,
    settings_surface_status: "available",
    ready_connection_count: 1,
    settings_issue_message: null,
    quote_preview_status: "ready",
    quote_count: 2,
    quote_issue_message: null,
    pickup_point_preview_status: "ready",
    destination_pickup_point_count: 2,
    pickup_point_issue_message: null,
    pickup_window_preview_status: "ready",
    pickup_window_required_quote_count: 1,
    pickup_window_count: 2,
    pickup_window_issue_message: null,
  })

  assert.deepEqual(needsPickupWindowPreview, {
    tone: "warning",
    actionability_status: "needs_pickup_window",
    status_label: "Pickup-window context still needed",
    connection_label: "conn_action_window",
    modality_label: "Warehouse → pickup point",
    readiness_label: "Selection not ready",
    hint_messages: [
      "Pickup window is required",
      "Sampled pickup-window preview indicates that neutral pickup-window options are available.",
    ],
  })

  const stalePreview = buildDeliveryHubShadowSelectionActionabilityPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_action_stale",
      status: "ready",
      issues: [],
      selection: {
        version: 1,
        connection_id: "conn_action_stale",
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_quote_action_stale",
          version: 1,
        },
        quote: {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          amount: 560,
          currency_code: "RUB",
          delivery_eta_min: 2,
          delivery_eta_max: 4,
          pickup_point_required: true,
          pickup_window_required: false,
        },
        pickup_point: {
          provider_point_id: "point_action_stale",
          provider_point_code: null,
          name: "Stale point",
          address: "Arbat 1",
          city: "Moscow",
          region: "Moscow",
          postal_code: "101000",
          lat: 55.75,
          lng: 37.61,
          is_origin_dropoff_allowed: false,
          is_destination_pickup_allowed: true,
          payment_methods: [],
        },
        pickup_window: null,
        updated_at: "2026-04-21T14:20:00.000Z",
      },
      quote_context: {
        connection: {
          connection_id: "conn_action_stale",
          state: "ready",
          ready: true,
        },
        quote_type: "warehouse_to_pickup_point",
        quote_reference: {
          id: "dhsel_quote_action_stale",
          version: 1,
        },
        pickup_point_required: true,
        pickup_window_required: false,
        updated_at: "2026-04-21T14:20:00.000Z",
      },
    },
    selection_response: null,
    settings_status: "ready",
    settings_enabled: true,
    settings_surface_status: "available",
    ready_connection_count: 1,
    settings_issue_message: null,
    quote_preview_status: "ready",
    quote_count: 0,
    quote_issue_message: null,
    pickup_point_preview_status: "ready",
    destination_pickup_point_count: 2,
    pickup_point_issue_message: null,
    pickup_window_preview_status: "idle",
    pickup_window_required_quote_count: 0,
    pickup_window_count: 0,
    pickup_window_issue_message: null,
  })

  assert.deepEqual(stalePreview, {
    tone: "warning",
    actionability_status: "stale",
    status_label: "Sampled context looks stale",
    connection_label: "conn_action_stale",
    modality_label: "Warehouse → pickup point",
    readiness_label: "Selection ready",
    hint_messages: [
      "Persisted neutral selection exists, but sampled shadow quotes are no longer returned for the current checkout context.",
    ],
  })

  const blockedPreview = buildDeliveryHubShadowSelectionActionabilityPreviewModel({
    readiness: {
      ok: true,
      cart_id: "cart_action_blocked",
      status: "invalid_selection",
      issues: [
        {
          code: "selection_invalid",
          message: "Persisted selection shape is invalid",
          field: "selection",
        },
      ],
      selection: null,
      quote_context: null,
    },
    selection_response: {
      ok: true,
      cart_id: "cart_action_blocked",
      selection: null,
    },
    settings_status: "ready",
    settings_enabled: true,
    settings_surface_status: "available",
    ready_connection_count: 1,
    settings_issue_message: null,
    quote_preview_status: "ready",
    quote_count: 1,
    quote_issue_message: null,
    pickup_point_preview_status: "ready",
    destination_pickup_point_count: 1,
    pickup_point_issue_message: null,
    pickup_window_preview_status: "idle",
    pickup_window_required_quote_count: 0,
    pickup_window_count: 0,
    pickup_window_issue_message: null,
  })

  assert.deepEqual(blockedPreview, {
    tone: "warning",
    actionability_status: "blocked_by_readiness",
    status_label: "Blocked by readiness",
    connection_label: null,
    modality_label: null,
    readiness_label: "Selection invalid",
    hint_messages: ["Persisted selection shape is invalid"],
  })
})

test("buildDeliveryHubShadowSettingsPreviewModel keeps settings preview neutral and read-only", () => {
  const loadingPreview = buildDeliveryHubShadowSettingsPreviewModel({
    status: "loading",
    enabled: false,
    settings_status: null,
    enabled_connection_count: 0,
    ready_connection_count: 0,
    default_connection_label: null,
    modality_labels: [],
    supports_pickup_points: false,
    supports_pickup_windows: false,
    supports_dropoff: false,
    preview_visibility_labels: [],
    hint_messages: [],
    issue_message: null,
  })

  assert.deepEqual(loadingPreview, {
    tone: "neutral",
    status_label: "Shadow settings preview loading",
    default_connection_label: null,
    availability_label: null,
    modality_label: null,
    visibility_label: null,
    hint_messages: [
      "Checking neutral settings visibility for the current checkout context.",
    ],
  })

  const readyPreview = buildDeliveryHubShadowSettingsPreviewModel({
    status: "ready",
    enabled: true,
    settings_status: "available",
    enabled_connection_count: 2,
    ready_connection_count: 1,
    default_connection_label: "Primary neutral connection",
    modality_labels: ["Warehouse → pickup point", "Dropoff point → pickup point"],
    supports_pickup_points: true,
    supports_pickup_windows: true,
    supports_dropoff: false,
    preview_visibility_labels: ["settings", "readiness", "catalog", "quotes"],
    hint_messages: ["Settings currently expose read-only neutral storefront visibility."],
    issue_message: null,
  })

  assert.deepEqual(readyPreview, {
    tone: "positive",
    status_label: "Shadow settings available",
    default_connection_label: "Primary neutral connection",
    availability_label: "1 ready connection of 2 visible connections visible",
    modality_label: "Warehouse → pickup point · Dropoff point → pickup point",
    visibility_label: "settings · readiness · catalog · quotes",
    hint_messages: [
      "Default neutral settings connection is Primary neutral connection.",
      "Settings indicate pickup-point preview visibility is enabled.",
      "Settings indicate pickup-window preview visibility is enabled.",
      "Settings currently expose read-only neutral storefront visibility.",
    ],
  })

  const informationalPreview = buildDeliveryHubShadowSettingsPreviewModel({
    status: "ready",
    enabled: true,
    settings_status: "informational_only",
    enabled_connection_count: 1,
    ready_connection_count: 0,
    default_connection_label: null,
    modality_labels: ["Warehouse → pickup point"],
    supports_pickup_points: false,
    supports_pickup_windows: false,
    supports_dropoff: true,
    preview_visibility_labels: ["settings", "catalog"],
    hint_messages: ["Settings currently expose read-only neutral storefront visibility."],
    issue_message: null,
  })

  assert.deepEqual(informationalPreview, {
    tone: "neutral",
    status_label: "Shadow settings informational only",
    default_connection_label: null,
    availability_label: "1 visible connection visible · 0 ready",
    modality_label: "Warehouse → pickup point",
    visibility_label: "settings · catalog",
    hint_messages: [
      "Settings did not nominate a default neutral connection.",
      "Settings indicate dropoff-origin modality visibility is enabled.",
      "Settings currently expose read-only neutral storefront visibility.",
      "Returned settings are currently informational only and do not claim a ready neutral checkout path.",
    ],
  })

  const errorPreview = buildDeliveryHubShadowSettingsPreviewModel({
    status: "error",
    enabled: false,
    settings_status: null,
    enabled_connection_count: 0,
    ready_connection_count: 0,
    default_connection_label: null,
    modality_labels: [],
    supports_pickup_points: false,
    supports_pickup_windows: false,
    supports_dropoff: false,
    preview_visibility_labels: [],
    hint_messages: [],
    issue_message: "Read-only shadow settings preview is currently unavailable.",
  })

  assert.deepEqual(errorPreview, {
    tone: "warning",
    status_label: "Shadow settings preview unavailable",
    default_connection_label: null,
    availability_label: null,
    modality_label: null,
    visibility_label: null,
    hint_messages: ["Read-only shadow settings preview is currently unavailable."],
  })
})

test("buildDeliveryHubShadowCatalogPreviewModel keeps catalog preview neutral and read-only", () => {
  const loadingPreview = buildDeliveryHubShadowCatalogPreviewModel({
    status: "loading",
    default_connection_label: null,
    connection_count: 0,
    ready_connection_count: 0,
    modality_labels: [],
    supports_pickup_points: false,
    supports_pickup_windows: false,
    supports_dropoff: false,
    issue_message: null,
  })

  assert.deepEqual(loadingPreview, {
    tone: "neutral",
    status_label: "Shadow catalog preview loading",
    default_connection_label: null,
    availability_label: null,
    modality_label: null,
    hint_messages: [
      "Checking neutral catalog availability for the current checkout context.",
    ],
  })

  const readyPreview = buildDeliveryHubShadowCatalogPreviewModel({
    status: "ready",
    default_connection_label: "Primary neutral connection",
    connection_count: 2,
    ready_connection_count: 1,
    modality_labels: ["Warehouse → pickup point", "Dropoff point → pickup point"],
    supports_pickup_points: true,
    supports_pickup_windows: true,
    supports_dropoff: false,
    issue_message: null,
  })

  assert.deepEqual(readyPreview, {
    tone: "positive",
    status_label: "Shadow catalog available",
    default_connection_label: "Primary neutral connection",
    availability_label: "1 ready connection of 2 connections available",
    modality_label: "Warehouse → pickup point · Dropoff point → pickup point",
    hint_messages: [
      "Default neutral catalog connection is Primary neutral connection.",
      "Catalog indicates pickup-point support in the returned neutral connection set.",
      "Catalog indicates pickup-window support in the returned neutral connection set.",
    ],
  })

  const informationalPreview = buildDeliveryHubShadowCatalogPreviewModel({
    status: "ready",
    default_connection_label: null,
    connection_count: 1,
    ready_connection_count: 0,
    modality_labels: ["Warehouse → pickup point"],
    supports_pickup_points: false,
    supports_pickup_windows: false,
    supports_dropoff: true,
    issue_message: null,
  })

  assert.deepEqual(informationalPreview, {
    tone: "neutral",
    status_label: "Shadow catalog returned without ready connections",
    default_connection_label: null,
    availability_label: "1 connection available · 0 ready",
    modality_label: "Warehouse → pickup point",
    hint_messages: [
      "Catalog did not nominate a default neutral connection.",
      "Catalog indicates dropoff-origin support in the returned neutral connection set.",
      "Returned catalog is informational only and does not currently expose a ready neutral connection.",
    ],
  })

  const emptyPreview = buildDeliveryHubShadowCatalogPreviewModel({
    status: "ready",
    default_connection_label: null,
    connection_count: 0,
    ready_connection_count: 0,
    modality_labels: [],
    supports_pickup_points: false,
    supports_pickup_windows: false,
    supports_dropoff: false,
    issue_message: "Neutral catalog returned no connections for preview visibility.",
  })

  assert.deepEqual(emptyPreview, {
    tone: "warning",
    status_label: "Shadow catalog unavailable",
    default_connection_label: null,
    availability_label: "0 connections returned",
    modality_label: null,
    hint_messages: ["Neutral catalog returned no connections for preview visibility."],
  })

  const errorPreview = buildDeliveryHubShadowCatalogPreviewModel({
    status: "error",
    default_connection_label: null,
    connection_count: 0,
    ready_connection_count: 0,
    modality_labels: [],
    supports_pickup_points: false,
    supports_pickup_windows: false,
    supports_dropoff: false,
    issue_message: "Read-only shadow catalog preview is currently unavailable.",
  })

  assert.deepEqual(errorPreview, {
    tone: "warning",
    status_label: "Shadow catalog preview unavailable",
    default_connection_label: null,
    availability_label: null,
    modality_label: null,
    hint_messages: ["Read-only shadow catalog preview is currently unavailable."],
  })
})

test("buildDeliveryHubShadowQuotePreviewModel keeps shadow quote preview neutral and read-only", () => {
  const loadingPreview = buildDeliveryHubShadowQuotePreviewModel({
    status: "loading",
    connection_label: null,
    quote_type: "warehouse_to_pickup_point",
    quote_count: 0,
    pickup_point_count: 0,
    issue_message: null,
  })

  assert.deepEqual(loadingPreview, {
    tone: "neutral",
    status_label: "Shadow quote preview loading",
    connection_label: null,
    modality_label: "Warehouse → pickup point",
    availability_label: null,
    hint_messages: [
      "Checking neutral quote availability for the current checkout context.",
    ],
  })

  const readyPreview = buildDeliveryHubShadowQuotePreviewModel({
    status: "ready",
    connection_label: null,
    quote_type: "warehouse_to_pickup_point",
    quote_count: 2,
    pickup_point_count: 5,
    issue_message: null,
  })

  assert.deepEqual(readyPreview, {
    tone: "positive",
    status_label: "Shadow quotes available",
    connection_label: null,
    modality_label: "Warehouse → pickup point",
    availability_label: "2 quotes available",
    hint_messages: [
      "Preview is sampled against 1 of 5 pickup points available for the current city.",
    ],
  })

  const emptyPreview = buildDeliveryHubShadowQuotePreviewModel({
    status: "ready",
    connection_label: null,
    quote_type: "warehouse_to_pickup_point",
    quote_count: 0,
    pickup_point_count: 1,
    issue_message: "No neutral quotes returned for sampled checkout context.",
  })

  assert.deepEqual(emptyPreview, {
    tone: "warning",
    status_label: "Shadow quotes unavailable",
    connection_label: null,
    modality_label: "Warehouse → pickup point",
    availability_label: "0 quotes available",
    hint_messages: [
      "No neutral quotes returned for sampled checkout context.",
      "Preview is sampled against 1 of 1 pickup point available for the current city.",
    ],
  })

  const errorPreview = buildDeliveryHubShadowQuotePreviewModel({
    status: "error",
    connection_label: null,
    quote_type: "warehouse_to_pickup_point",
    quote_count: 0,
    pickup_point_count: 0,
    issue_message: "Shadow quote preview is unavailable.",
  })

  assert.deepEqual(errorPreview, {
    tone: "warning",
    status_label: "Shadow quote preview unavailable",
    connection_label: null,
    modality_label: "Warehouse → pickup point",
    availability_label: null,
    hint_messages: ["Shadow quote preview is unavailable."],
  })
})

test("buildDeliveryHubShadowPickupPointPreviewModel keeps pickup-point preview neutral and read-only", () => {
  const loadingPreview = buildDeliveryHubShadowPickupPointPreviewModel({
    status: "loading",
    connection_label: null,
    quote_type: "warehouse_to_pickup_point",
    pickup_point_count: 0,
    destination_pickup_point_count: 0,
    issue_message: null,
  })

  assert.deepEqual(loadingPreview, {
    tone: "neutral",
    status_label: "Shadow pickup-point preview loading",
    connection_label: null,
    modality_label: "Warehouse → pickup point",
    availability_label: null,
    hint_messages: [
      "Checking neutral pickup-point availability for the current checkout context.",
    ],
  })

  const readyPreview = buildDeliveryHubShadowPickupPointPreviewModel({
    status: "ready",
    connection_label: null,
    quote_type: "warehouse_to_pickup_point",
    pickup_point_count: 4,
    destination_pickup_point_count: 3,
    issue_message: null,
  })

  assert.deepEqual(readyPreview, {
    tone: "positive",
    status_label: "Shadow pickup points available",
    connection_label: null,
    modality_label: "Warehouse → pickup point",
    availability_label: "4 pickup points available",
    hint_messages: [
      "3 pickup point matches current destination pickup flow expectations.",
    ],
  })

  const informationalPreview = buildDeliveryHubShadowPickupPointPreviewModel({
    status: "ready",
    connection_label: null,
    quote_type: "warehouse_to_pickup_point",
    pickup_point_count: 2,
    destination_pickup_point_count: 0,
    issue_message: null,
  })

  assert.deepEqual(informationalPreview, {
    tone: "neutral",
    status_label: "Shadow pickup points available",
    connection_label: null,
    modality_label: "Warehouse → pickup point",
    availability_label: "2 pickup points available",
    hint_messages: [
      "Current pickup-point sample is informational only and does not confirm destination-pickup eligibility.",
    ],
  })

  const emptyPreview = buildDeliveryHubShadowPickupPointPreviewModel({
    status: "ready",
    connection_label: null,
    quote_type: "warehouse_to_pickup_point",
    pickup_point_count: 0,
    destination_pickup_point_count: 0,
    issue_message: "No neutral pickup points returned for sampled checkout context.",
  })

  assert.deepEqual(emptyPreview, {
    tone: "warning",
    status_label: "Shadow pickup points unavailable",
    connection_label: null,
    modality_label: "Warehouse → pickup point",
    availability_label: "0 pickup points available",
    hint_messages: ["No neutral pickup points returned for sampled checkout context."],
  })

  const errorPreview = buildDeliveryHubShadowPickupPointPreviewModel({
    status: "error",
    connection_label: null,
    quote_type: "warehouse_to_pickup_point",
    pickup_point_count: 0,
    destination_pickup_point_count: 0,
    issue_message: "Shadow pickup-point preview is unavailable.",
  })

  assert.deepEqual(errorPreview, {
    tone: "warning",
    status_label: "Shadow pickup-point preview unavailable",
    connection_label: null,
    modality_label: "Warehouse → pickup point",
    availability_label: null,
    hint_messages: ["Shadow pickup-point preview is unavailable."],
  })
})

test("buildDeliveryHubShadowPickupWindowPreviewModel keeps pickup-window preview neutral and read-only", () => {
  const loadingPreview = buildDeliveryHubShadowPickupWindowPreviewModel({
    status: "loading",
    connection_label: null,
    quote_type: "warehouse_to_pickup_point",
    quote_count: 2,
    pickup_window_required_quote_count: 1,
    pickup_window_count: 0,
    issue_message: null,
  })

  assert.deepEqual(loadingPreview, {
    tone: "neutral",
    status_label: "Shadow pickup-window preview loading",
    connection_label: null,
    modality_label: "Warehouse → pickup point",
    availability_label: null,
    hint_messages: [
      "Checking neutral pickup-window availability for the current checkout context.",
    ],
  })

  const readyPreview = buildDeliveryHubShadowPickupWindowPreviewModel({
    status: "ready",
    connection_label: null,
    quote_type: "warehouse_to_pickup_point",
    quote_count: 2,
    pickup_window_required_quote_count: 1,
    pickup_window_count: 3,
    issue_message: null,
  })

  assert.deepEqual(readyPreview, {
    tone: "positive",
    status_label: "Shadow pickup windows available",
    connection_label: null,
    modality_label: "Warehouse → pickup point",
    availability_label: "3 pickup windows available",
    hint_messages: [
      "1 sampled quote requires pickup-window context before a neutral selection can become ready.",
    ],
  })

  const skippedPreview = buildDeliveryHubShadowPickupWindowPreviewModel({
    status: "ready",
    connection_label: null,
    quote_type: "warehouse_to_pickup_point",
    quote_count: 2,
    pickup_window_required_quote_count: 0,
    pickup_window_count: 0,
    issue_message: "Sampled neutral quotes currently do not require pickup-window context.",
  })

  assert.deepEqual(skippedPreview, {
    tone: "neutral",
    status_label: "Shadow pickup windows unavailable",
    connection_label: null,
    modality_label: "Warehouse → pickup point",
    availability_label: "0 pickup windows available",
    hint_messages: [
      "Sampled neutral quotes currently do not require pickup-window context.",
      "Sampled neutral quotes currently do not indicate pickup-window requirement.",
    ],
  })

  const errorPreview = buildDeliveryHubShadowPickupWindowPreviewModel({
    status: "error",
    connection_label: null,
    quote_type: "warehouse_to_pickup_point",
    quote_count: 1,
    pickup_window_required_quote_count: 1,
    pickup_window_count: 0,
    issue_message: "Shadow pickup-window preview is unavailable.",
  })

  assert.deepEqual(errorPreview, {
    tone: "warning",
    status_label: "Shadow pickup-window preview unavailable",
    connection_label: null,
    modality_label: "Warehouse → pickup point",
    availability_label: null,
    hint_messages: ["Shadow pickup-window preview is unavailable."],
  })
})

test("buildDeliveryHubShadowShippingOptionParityPreviewModel reports aligned sampled pickup-point parity", () => {
  const preview = buildDeliveryHubShadowShippingOptionParityPreviewModel({
    legacy_is_committed: true,
    legacy_flow_kind: "pickup_point",
    legacy_method_label: "Pickup delivery",
    legacy_selection_fresh: true,
    shadow_quote_type: "warehouse_to_pickup_point",
    shadow_settings_status: "ready",
    shadow_settings_enabled: true,
    shadow_settings_surface_status: "available",
    shadow_ready_connection_count: 1,
    shadow_quote_preview_status: "ready",
    shadow_quote_count: 2,
    shadow_pickup_point_preview_status: "ready",
    shadow_destination_pickup_point_count: 3,
    issue_messages: [],
  })

  assert.deepEqual(preview, {
    tone: "positive",
    parity_state: "aligned",
    status_label: "Sampled shadow parity aligns",
    legacy_method_label: "Pickup delivery",
    shadow_modality_label: "Warehouse → pickup point",
    detail_label: "2 sampled quotes · 3 destination-compatible pickup points",
    hint_messages: [
      "Legacy checkout currently has a committed pickup-point method, and the sampled neutral shadow context also returns pickup-point availability plus sampled quotes for the same checkout context.",
    ],
  })
})

test("buildDeliveryHubShadowShippingOptionParityPreviewModel reports divergent pickup parity when sampled shadow pickup points are absent", () => {
  const preview = buildDeliveryHubShadowShippingOptionParityPreviewModel({
    legacy_is_committed: true,
    legacy_flow_kind: "pickup_point",
    legacy_method_label: "Pickup delivery",
    legacy_selection_fresh: true,
    shadow_quote_type: "warehouse_to_pickup_point",
    shadow_settings_status: "ready",
    shadow_settings_enabled: true,
    shadow_settings_surface_status: "available",
    shadow_ready_connection_count: 1,
    shadow_quote_preview_status: "ready",
    shadow_quote_count: 1,
    shadow_pickup_point_preview_status: "ready",
    shadow_destination_pickup_point_count: 0,
    issue_messages: [],
  })

  assert.equal(preview.tone, "warning")
  assert.equal(preview.parity_state, "divergent")
  assert.equal(preview.status_label, "Sampled pickup-point parity diverges")
  assert.equal(preview.detail_label, "1 sampled quote · 0 destination-compatible pickup points")
})

test("buildDeliveryHubShadowShippingOptionParityPreviewModel keeps door-delivery legacy commit out of sampled pickup scope", () => {
  const preview = buildDeliveryHubShadowShippingOptionParityPreviewModel({
    legacy_is_committed: true,
    legacy_flow_kind: "door_delivery",
    legacy_method_label: "Door delivery",
    legacy_selection_fresh: true,
    shadow_quote_type: "warehouse_to_pickup_point",
    shadow_settings_status: "ready",
    shadow_settings_enabled: true,
    shadow_settings_surface_status: "available",
    shadow_ready_connection_count: 1,
    shadow_quote_preview_status: "ready",
    shadow_quote_count: 2,
    shadow_pickup_point_preview_status: "ready",
    shadow_destination_pickup_point_count: 4,
    issue_messages: [],
  })

  assert.equal(preview.tone, "neutral")
  assert.equal(preview.parity_state, "not_applicable")
  assert.equal(preview.status_label, "Current legacy method is outside sampled shadow scope")
})

test("buildDeliveryHubShadowSelectionParityPreviewModel reports aligned pickup-point selection parity", () => {
  const preview = buildDeliveryHubShadowSelectionParityPreviewModel({
    legacy_is_committed: true,
    legacy_method_label: "Pickup delivery",
    legacy_flow_kind: "pickup_point",
    legacy_selection_fresh: true,
    legacy_reference_label: "Pickup point A",
    legacy_reference_detail_label: "Main street 10",
    neutral_selection_status: "ready",
    neutral_selection: {
      version: 1,
      connection_id: "conn_1",
      quote_type: "warehouse_to_pickup_point",
      quote_reference: {
        id: "quote_1",
        version: 2,
      },
      quote: {
        carrier_code: "carrier",
        carrier_label: "Neutral carrier",
        amount: 499,
        currency_code: "RUB",
        delivery_eta_min: 1,
        delivery_eta_max: 2,
        pickup_point_required: true,
        pickup_window_required: false,
      },
      pickup_point: {
        provider_point_id: "point_1",
        provider_point_code: null,
        name: "Pickup point A",
        address: "Main street 10",
        city: "Moscow",
        region: null,
        postal_code: null,
        lat: null,
        lng: null,
        is_origin_dropoff_allowed: false,
        is_destination_pickup_allowed: true,
        payment_methods: [],
      },
      pickup_window: null,
      updated_at: "2026-04-21T18:00:00.000Z",
    },
    readiness_status: "ready",
    issue_messages: [],
  })

  assert.deepEqual(preview, {
    tone: "positive",
    parity_status: "aligned",
    status_label: "Committed legacy selection aligns with neutral selection preview",
    legacy_method_label: "Pickup delivery",
    legacy_modality_label: "Pickup point",
    neutral_modality_label: "Pickup point",
    legacy_reference_label: "Pickup point A",
    neutral_reference_label: "Pickup point A",
    readiness_label: "Selection ready",
    hint_messages: [
      "Committed legacy shipping context and persisted neutral selection currently align on shopper-visible modality and pickup reference.",
    ],
  })
})

test("buildDeliveryHubShadowSelectionParityPreviewModel reports missing neutral selection against committed legacy method", () => {
  const preview = buildDeliveryHubShadowSelectionParityPreviewModel({
    legacy_is_committed: true,
    legacy_method_label: "Pickup delivery",
    legacy_flow_kind: "pickup_point",
    legacy_selection_fresh: true,
    legacy_reference_label: "Pickup point A",
    legacy_reference_detail_label: "Main street 10",
    neutral_selection_status: "ready",
    neutral_selection: null,
    readiness_status: "missing_selection",
    issue_messages: [],
  })

  assert.equal(preview.tone, "warning")
  assert.equal(preview.parity_status, "missing_neutral_selection")
  assert.equal(preview.status_label, "Neutral persisted selection missing")
  assert.equal(preview.readiness_label, "Selection missing")
})

test("buildDeliveryHubShadowSelectionParityPreviewModel reports reference mismatch for sampled pickup parity", () => {
  const preview = buildDeliveryHubShadowSelectionParityPreviewModel({
    legacy_is_committed: true,
    legacy_method_label: "Pickup delivery",
    legacy_flow_kind: "pickup_point",
    legacy_selection_fresh: true,
    legacy_reference_label: "Pickup point A",
    legacy_reference_detail_label: "Main street 10",
    neutral_selection_status: "ready",
    neutral_selection: {
      version: 1,
      connection_id: "conn_1",
      quote_type: "warehouse_to_pickup_point",
      quote_reference: {
        id: "quote_2",
        version: 1,
      },
      quote: {
        carrier_code: "carrier",
        carrier_label: "Neutral carrier",
        amount: 499,
        currency_code: "RUB",
        delivery_eta_min: 1,
        delivery_eta_max: 2,
        pickup_point_required: true,
        pickup_window_required: false,
      },
      pickup_point: {
        provider_point_id: "point_2",
        provider_point_code: null,
        name: "Pickup point B",
        address: "Second street 15",
        city: "Moscow",
        region: null,
        postal_code: null,
        lat: null,
        lng: null,
        is_origin_dropoff_allowed: false,
        is_destination_pickup_allowed: true,
        payment_methods: [],
      },
      pickup_window: null,
      updated_at: "2026-04-21T18:00:00.000Z",
    },
    readiness_status: "ready",
    issue_messages: [],
  })

  assert.equal(preview.tone, "warning")
  assert.equal(preview.parity_status, "reference_mismatch")
  assert.equal(
    preview.status_label,
    "Committed legacy pickup reference differs from neutral selection"
  )
  assert.equal(preview.legacy_reference_label, "Pickup point A")
  assert.equal(preview.neutral_reference_label, "Pickup point B")
})

test("buildDeliveryHubShadowOrchestrationVerdictPreviewModel reports aligned verdict from ready shadow constellation", () => {
  const preview = buildDeliveryHubShadowOrchestrationVerdictPreviewModel({
    readiness_preview: {
      tone: "positive",
      status_label: "Selection ready",
      connection_label: "conn_1",
      quote_type_label: "Warehouse → pickup point",
      issue_messages: [],
      updated_at: "2026-04-21T18:00:00.000Z",
    },
    persisted_selection_preview: {
      tone: "positive",
      status_label: "Persisted selection available",
      modality_label: "Warehouse → pickup point",
      quote_amount: 499,
      currency_code: "RUB",
      quote_eta_label: "ETA 1–2 days",
      pickup_point_label: "Pickup point A",
      pickup_window_label: null,
      readiness_label: "Selection ready",
      hint_messages: ["Persisted selection currently passes readiness checks."],
      updated_at: "2026-04-21T18:00:00.000Z",
    },
    shadow_catalog_preview: {
      tone: "positive",
      status_label: "Shadow catalog available",
      default_connection_label: "Primary",
      availability_label: "1 ready connection of 1 connection available",
      modality_label: "Warehouse → pickup point",
      hint_messages: ["Default neutral catalog connection is Primary."],
    },
    shadow_settings_preview: {
      tone: "positive",
      status_label: "Shadow settings available",
      default_connection_label: "Primary",
      availability_label: "1 ready connection of 1 visible connection visible",
      modality_label: "Warehouse → pickup point",
      visibility_label: "settings · readiness",
      hint_messages: ["Default neutral settings connection is Primary."],
    },
    shadow_quote_preview: {
      tone: "positive",
      status_label: "Shadow quotes available",
      connection_label: "conn_1",
      modality_label: "Warehouse → pickup point",
      availability_label: "2 quotes available",
      hint_messages: [
        "Preview is sampled against 1 of 3 pickup points available for the current city.",
      ],
    },
    shadow_pickup_point_preview: {
      tone: "positive",
      status_label: "Shadow pickup points available",
      connection_label: "conn_1",
      modality_label: "Warehouse → pickup point",
      availability_label: "3 pickup points available",
      hint_messages: ["3 pickup point matches current destination pickup flow expectations."],
    },
    shadow_pickup_window_preview: {
      tone: "neutral",
      status_label: "Shadow pickup windows available",
      connection_label: "conn_1",
      modality_label: "Warehouse → pickup point",
      availability_label: "0 pickup windows available",
      hint_messages: ["Sampled neutral quotes currently do not indicate pickup-window requirement."],
    },
    shadow_selection_actionability_preview: {
      tone: "positive",
      actionability_status: "ready",
      status_label: "Action-ready preview",
      connection_label: "conn_1",
      modality_label: "Warehouse → pickup point",
      readiness_label: "Selection ready",
      hint_messages: [
        "Persisted neutral selection currently passes readiness checks and sampled shadow data does not signal a stale checkout constellation.",
      ],
    },
    shadow_shipping_option_parity_preview: {
      tone: "positive",
      parity_state: "aligned",
      status_label: "Sampled shadow parity aligns",
      legacy_method_label: "Pickup delivery",
      shadow_modality_label: "Warehouse → pickup point",
      detail_label: "2 sampled quotes · 3 destination-compatible pickup points",
      hint_messages: [
        "Legacy checkout currently has a committed pickup-point method, and the sampled neutral shadow context also returns pickup-point availability plus sampled quotes for the same checkout context.",
      ],
    },
    shadow_selection_parity_preview: {
      tone: "positive",
      parity_status: "aligned",
      status_label: "Committed legacy selection aligns with neutral selection preview",
      legacy_method_label: "Pickup delivery",
      legacy_modality_label: "Pickup point",
      neutral_modality_label: "Pickup point",
      legacy_reference_label: "Pickup point A",
      neutral_reference_label: "Pickup point A",
      readiness_label: "Selection ready",
      hint_messages: [
        "Committed legacy shipping context and persisted neutral selection currently align on shopper-visible modality and pickup reference.",
      ],
    },
  })

  assert.deepEqual(preview, {
    tone: "positive",
    verdict_code: "aligned",
    status_label: "Shadow orchestration verdict aligned",
    signal_summary_label: "9 positive · 0 attention · 1 informational",
    actionability_label: "action-ready",
    shipping_option_parity_label: "aligned",
    selection_parity_label: "aligned",
    hint_messages: [
      "Current read-only shadow constellation agrees across readiness, actionability, and parity previews for the sampled legacy checkout context.",
      "Persisted neutral selection currently passes readiness checks and sampled shadow data does not signal a stale checkout constellation.",
      "Legacy checkout currently has a committed pickup-point method, and the sampled neutral shadow context also returns pickup-point availability plus sampled quotes for the same checkout context.",
      "Committed legacy shipping context and persisted neutral selection currently align on shopper-visible modality and pickup reference.",
    ],
  })
})

test("buildDeliveryHubShadowOrchestrationVerdictPreviewModel reports blocked verdict from readiness block", () => {
  const preview = buildDeliveryHubShadowOrchestrationVerdictPreviewModel({
    readiness_preview: {
      tone: "warning",
      status_label: "Selection invalid",
      connection_label: "conn_1",
      quote_type_label: "Warehouse → pickup point",
      issue_messages: ["Connection is not ready"],
      updated_at: "2026-04-21T18:00:00.000Z",
    },
    persisted_selection_preview: {
      tone: "warning",
      status_label: "Persisted selection requires attention",
      modality_label: "Warehouse → pickup point",
      quote_amount: 499,
      currency_code: "RUB",
      quote_eta_label: "ETA 1–2 days",
      pickup_point_label: "Pickup point A",
      pickup_window_label: null,
      readiness_label: "Selection invalid",
      hint_messages: ["Persisted selection is stored but backend now marks it invalid for the current cart context."],
      updated_at: "2026-04-21T18:00:00.000Z",
    },
    shadow_catalog_preview: {
      tone: "neutral",
      status_label: "Shadow catalog available",
      default_connection_label: "Primary",
      availability_label: "1 connection returned",
      modality_label: "Warehouse → pickup point",
      hint_messages: [],
    },
    shadow_settings_preview: {
      tone: "warning",
      status_label: "Shadow settings unavailable",
      default_connection_label: null,
      availability_label: "0 connections visible",
      modality_label: "Warehouse → pickup point",
      visibility_label: null,
      hint_messages: ["Neutral storefront settings do not currently expose a shopper-visible delivery connection."],
    },
    shadow_quote_preview: {
      tone: "warning",
      status_label: "Shadow quotes unavailable",
      connection_label: "conn_1",
      modality_label: "Warehouse → pickup point",
      availability_label: "0 quotes available",
      hint_messages: ["No neutral shadow quotes were returned for the sampled checkout context."],
    },
    shadow_pickup_point_preview: {
      tone: "warning",
      status_label: "Shadow pickup points unavailable",
      connection_label: "conn_1",
      modality_label: "Warehouse → pickup point",
      availability_label: "0 pickup points available",
      hint_messages: ["No neutral pickup points were returned for the current checkout context."],
    },
    shadow_pickup_window_preview: {
      tone: "neutral",
      status_label: "Shadow pickup windows not requested",
      connection_label: "conn_1",
      modality_label: "Warehouse → pickup point",
      availability_label: null,
      hint_messages: [],
    },
    shadow_selection_actionability_preview: {
      tone: "warning",
      actionability_status: "blocked_by_readiness",
      status_label: "Blocked by readiness",
      connection_label: "conn_1",
      modality_label: "Warehouse → pickup point",
      readiness_label: "Selection invalid",
      hint_messages: ["Neutral storefront settings do not currently expose a ready delivery connection."],
    },
    shadow_shipping_option_parity_preview: {
      tone: "neutral",
      parity_state: "insufficient_context",
      status_label: "Shadow parity context unavailable",
      legacy_method_label: "Pickup delivery",
      shadow_modality_label: "Warehouse → pickup point",
      detail_label: null,
      hint_messages: ["One or more read-only shadow previews are currently unavailable, so parity cannot be compared for the current checkout context."],
    },
    shadow_selection_parity_preview: {
      tone: "neutral",
      parity_status: "insufficient_data",
      status_label: "Persisted neutral selection preview unavailable",
      legacy_method_label: "Pickup delivery",
      legacy_modality_label: "Pickup point",
      neutral_modality_label: null,
      legacy_reference_label: "Pickup point A",
      neutral_reference_label: null,
      readiness_label: "Selection invalid",
      hint_messages: ["Persisted neutral selection preview is unavailable, so this comparison remains informational only."],
    },
  })

  assert.equal(preview.tone, "warning")
  assert.equal(preview.verdict_code, "blocked")
  assert.equal(preview.status_label, "Shadow orchestration verdict blocked")
  assert.equal(preview.actionability_label, "blocked by readiness")
  assert.equal(preview.shipping_option_parity_label, "insufficient context")
  assert.equal(preview.selection_parity_label, "insufficient data")
  assert.equal(preview.signal_summary_label, "0 positive · 6 attention · 4 informational")
})

test("buildDeliveryHubShadowOrchestrationRecommendationPreviewModel reports shopper-safe shadow recommendation when shadow constellation aligns", () => {
  const preview = buildDeliveryHubShadowOrchestrationRecommendationPreviewModel({
    readiness_preview: {
      tone: "positive",
      status_label: "Selection ready",
      connection_label: "conn_1",
      quote_type_label: "Warehouse → pickup point",
      issue_messages: [],
      updated_at: "2026-04-21T18:00:00.000Z",
    },
    persisted_selection_preview: {
      tone: "positive",
      status_label: "Persisted selection available",
      modality_label: "Warehouse → pickup point",
      quote_amount: 499,
      currency_code: "RUB",
      quote_eta_label: "ETA 1–2 days",
      pickup_point_label: "Pickup point A",
      pickup_window_label: "22 Apr · 10:00–14:00",
      readiness_label: "Selection ready",
      hint_messages: ["Persisted selection currently passes readiness checks."],
      updated_at: "2026-04-21T18:00:00.000Z",
    },
    shadow_selection_actionability_preview: {
      tone: "positive",
      actionability_status: "ready",
      status_label: "Action-ready preview",
      connection_label: "conn_1",
      modality_label: "Warehouse → pickup point",
      readiness_label: "Selection ready",
      hint_messages: [
        "Persisted neutral selection currently passes readiness checks and sampled shadow data does not signal a stale checkout constellation.",
      ],
    },
    shadow_shipping_option_parity_preview: {
      tone: "positive",
      parity_state: "aligned",
      status_label: "Sampled shadow parity aligns",
      legacy_method_label: "Pickup delivery",
      shadow_modality_label: "Warehouse → pickup point",
      detail_label: "2 sampled quotes · 3 destination-compatible pickup points",
      hint_messages: [
        "Legacy checkout currently has a committed pickup-point method, and the sampled neutral shadow context also returns pickup-point availability plus sampled quotes for the same checkout context.",
      ],
    },
    shadow_selection_parity_preview: {
      tone: "positive",
      parity_status: "aligned",
      status_label: "Committed legacy selection aligns with neutral selection preview",
      legacy_method_label: "Pickup delivery",
      legacy_modality_label: "Pickup point",
      neutral_modality_label: "Pickup point",
      legacy_reference_label: "Pickup point A",
      neutral_reference_label: "Pickup point A",
      readiness_label: "Selection ready",
      hint_messages: [
        "Committed legacy shipping context and persisted neutral selection currently align on shopper-visible modality and pickup reference.",
      ],
    },
    shadow_orchestration_verdict_preview: {
      tone: "positive",
      verdict_code: "aligned",
      status_label: "Shadow orchestration verdict aligned",
      signal_summary_label: "9 positive · 0 attention · 1 informational",
      actionability_label: "action-ready",
      shipping_option_parity_label: "aligned",
      selection_parity_label: "aligned",
      hint_messages: [
        "Current read-only shadow constellation agrees across readiness, actionability, and parity previews for the sampled legacy checkout context.",
      ],
    },
  })

  assert.deepEqual(preview, {
    tone: "positive",
    recommendation_status: "recommended",
    status_label: "Shadow recommendation preview available",
    recommended_modality_label: "Warehouse → pickup point",
    recommended_pickup_point_label: "Pickup point A",
    recommended_pickup_window_label: "22 Apr · 10:00–14:00",
    recommended_quote_amount: 499,
    currency_code: "RUB",
    recommended_quote_eta_label: "ETA 1–2 days",
    readiness_label: "Selection ready",
    detail_label: "action-ready · aligned · aligned",
    hint_messages: [
      "Read-only shadow recommendation only. Current checkout keeps the committed legacy shipping flow and does not switch shipping method or save any neutral selection from this preview.",
      "If shadow orchestration were active for the current cart context, it would currently favor the persisted neutral selection summary shown below.",
      "Current read-only shadow constellation agrees across readiness, actionability, and parity previews for the sampled legacy checkout context.",
      "Persisted selection currently passes readiness checks.",
    ],
  })
})

test("buildDeliveryHubShadowOrchestrationRecommendationPreviewModel stays neutral when shadow recommendation lacks enough comparable context", () => {
  const preview = buildDeliveryHubShadowOrchestrationRecommendationPreviewModel({
    readiness_preview: {
      tone: "neutral",
      status_label: "Readiness unavailable",
      connection_label: null,
      quote_type_label: null,
      issue_messages: [],
      updated_at: null,
    },
    persisted_selection_preview: {
      tone: "neutral",
      status_label: "Persisted selection missing",
      modality_label: null,
      quote_amount: null,
      currency_code: null,
      quote_eta_label: null,
      pickup_point_label: null,
      pickup_window_label: null,
      readiness_label: "Selection missing",
      hint_messages: [
        "Readiness currently agrees that no neutral persisted selection is stored for this cart.",
      ],
      updated_at: null,
    },
    shadow_selection_actionability_preview: {
      tone: "neutral",
      actionability_status: "incomplete",
      status_label: "Neutral preview context incomplete",
      connection_label: null,
      modality_label: null,
      readiness_label: null,
      hint_messages: [
        "Current shadow selection actionability remains informational because sampled preview context is incomplete.",
      ],
    },
    shadow_shipping_option_parity_preview: {
      tone: "neutral",
      parity_state: "not_applicable",
      status_label: "No committed legacy method to compare",
      legacy_method_label: null,
      shadow_modality_label: "Warehouse → pickup point",
      detail_label: null,
      hint_messages: [
        "Parity preview activates only when checkout already has a committed legacy shipping method.",
      ],
    },
    shadow_selection_parity_preview: {
      tone: "neutral",
      parity_status: "missing_legacy_method",
      status_label: "No committed legacy method to compare",
      legacy_method_label: null,
      legacy_modality_label: null,
      neutral_modality_label: null,
      legacy_reference_label: null,
      neutral_reference_label: null,
      readiness_label: "Selection missing",
      hint_messages: [
        "Selection parity preview activates only when checkout already has a committed legacy shipping method.",
      ],
    },
    shadow_orchestration_verdict_preview: {
      tone: "neutral",
      verdict_code: "insufficient_data",
      status_label: "Shadow orchestration verdict informational only",
      signal_summary_label: "0 positive · 0 attention · 10 informational",
      actionability_label: "incomplete",
      shipping_option_parity_label: "not applicable",
      selection_parity_label: "missing legacy method",
      hint_messages: [
        "Current read-only shadow constellation is still informational and does not yet provide enough comparable context for a stronger rollout verdict.",
      ],
    },
  })

  assert.deepEqual(preview, {
    tone: "neutral",
    recommendation_status: "insufficient_data",
    status_label: "Shadow recommendation preview needs more context",
    recommended_modality_label: null,
    recommended_pickup_point_label: null,
    recommended_pickup_window_label: null,
    recommended_quote_amount: null,
    currency_code: null,
    recommended_quote_eta_label: null,
    readiness_label: "Selection missing",
    detail_label: "incomplete · not applicable · missing legacy method",
    hint_messages: [
      "Current shadow constellation is still informational only and does not yet have enough shopper-safe context to describe a recommendation.",
      "The active checkout commit path remains the legacy ApiShip flow; this preview does not save, clear, or commit anything.",
      "Current read-only shadow constellation is still informational and does not yet provide enough comparable context for a stronger rollout verdict.",
      "Current shadow selection actionability remains informational because sampled preview context is incomplete.",
    ],
  })
})

test("buildDeliveryHubShadowCutoverReadinessPreviewModel reports ready shadow contour only when recommendation and parity align", () => {
  const preview = buildDeliveryHubShadowCutoverReadinessPreviewModel({
    readiness_preview: {
      tone: "positive",
      status_label: "Selection ready",
      connection_label: "conn_1",
      quote_type_label: "Warehouse → pickup point",
      issue_messages: [],
      updated_at: "2026-04-21T18:00:00.000Z",
    },
    persisted_selection_preview: {
      tone: "positive",
      status_label: "Persisted selection available",
      modality_label: "Warehouse → pickup point",
      quote_amount: 499,
      currency_code: "RUB",
      quote_eta_label: "ETA 1–2 days",
      pickup_point_label: "Pickup point A",
      pickup_window_label: "22 Apr · 10:00–14:00",
      readiness_label: "Selection ready",
      hint_messages: ["Persisted selection currently passes readiness checks."],
      updated_at: "2026-04-21T18:00:00.000Z",
    },
    shadow_selection_actionability_preview: {
      tone: "positive",
      actionability_status: "ready",
      status_label: "Action-ready preview",
      connection_label: "conn_1",
      modality_label: "Warehouse → pickup point",
      readiness_label: "Selection ready",
      hint_messages: [
        "Persisted neutral selection currently passes readiness checks and sampled shadow data does not signal a stale checkout constellation.",
      ],
    },
    shadow_shipping_option_parity_preview: {
      tone: "positive",
      parity_state: "aligned",
      status_label: "Sampled shadow parity aligns",
      legacy_method_label: "Pickup delivery",
      shadow_modality_label: "Warehouse → pickup point",
      detail_label: "2 sampled quotes · 3 destination-compatible pickup points",
      hint_messages: [
        "Legacy checkout currently has a committed pickup-point method, and the sampled neutral shadow context also returns pickup-point availability plus sampled quotes for the same checkout context.",
      ],
    },
    shadow_selection_parity_preview: {
      tone: "positive",
      parity_status: "aligned",
      status_label: "Committed legacy selection aligns with neutral selection preview",
      legacy_method_label: "Pickup delivery",
      legacy_modality_label: "Pickup point",
      neutral_modality_label: "Pickup point",
      legacy_reference_label: "Pickup point A",
      neutral_reference_label: "Pickup point A",
      readiness_label: "Selection ready",
      hint_messages: [
        "Committed legacy shipping context and persisted neutral selection currently align on shopper-visible modality and pickup reference.",
      ],
    },
    shadow_orchestration_verdict_preview: {
      tone: "positive",
      verdict_code: "aligned",
      status_label: "Shadow orchestration verdict aligned",
      signal_summary_label: "9 positive · 0 attention · 1 informational",
      actionability_label: "action-ready",
      shipping_option_parity_label: "aligned",
      selection_parity_label: "aligned",
      hint_messages: [
        "Current read-only shadow constellation agrees across readiness, actionability, and parity previews for the sampled legacy checkout context.",
      ],
    },
    shadow_orchestration_recommendation_preview: {
      tone: "positive",
      recommendation_status: "recommended",
      status_label: "Shadow recommendation preview available",
      recommended_modality_label: "Warehouse → pickup point",
      recommended_pickup_point_label: "Pickup point A",
      recommended_pickup_window_label: "22 Apr · 10:00–14:00",
      recommended_quote_amount: 499,
      currency_code: "RUB",
      recommended_quote_eta_label: "ETA 1–2 days",
      readiness_label: "Selection ready",
      detail_label: "action-ready · aligned · aligned",
      hint_messages: [
        "Read-only shadow recommendation only. Current checkout keeps the committed legacy shipping flow and does not switch shipping method or save any neutral selection from this preview.",
      ],
    },
  })

  assert.deepEqual(preview, {
    tone: "positive",
    cutover_readiness_status: "ready",
    status_label: "Shadow cutover readiness preview indicates ready contour",
    readiness_label: "Selection ready",
    recommendation_label: "shadow recommendation recommended",
    modality_label: "Warehouse → pickup point",
    detail_label:
      "verdict aligned · shadow recommendation recommended · action-ready · aligned · aligned",
    hint_messages: [
      "Shadow-only cutover readiness preview indicates that the current checkout contour looks internally aligned for a future Delivery Hub cutover.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, or switch anything.",
      "Current read-only shadow constellation agrees across readiness, actionability, and parity previews for the sampled legacy checkout context.",
      "Read-only shadow recommendation only. Current checkout keeps the committed legacy shipping flow and does not switch shipping method or save any neutral selection from this preview.",
    ],
  })
})

test("buildDeliveryHubShadowCutoverReadinessPreviewModel stays non-cutover when shadow context is insufficient or degraded", () => {
  const insufficientPreview = buildDeliveryHubShadowCutoverReadinessPreviewModel({
    readiness_preview: {
      tone: "neutral",
      status_label: "Readiness unavailable",
      connection_label: null,
      quote_type_label: null,
      issue_messages: [],
      updated_at: null,
    },
    persisted_selection_preview: {
      tone: "neutral",
      status_label: "Persisted selection missing",
      modality_label: null,
      quote_amount: null,
      currency_code: null,
      quote_eta_label: null,
      pickup_point_label: null,
      pickup_window_label: null,
      readiness_label: "Selection missing",
      hint_messages: [
        "Readiness currently agrees that no neutral persisted selection is stored for this cart.",
      ],
      updated_at: null,
    },
    shadow_selection_actionability_preview: {
      tone: "neutral",
      actionability_status: "incomplete",
      status_label: "Neutral preview context incomplete",
      connection_label: null,
      modality_label: null,
      readiness_label: null,
      hint_messages: [
        "Current shadow selection actionability remains informational because sampled preview context is incomplete.",
      ],
    },
    shadow_shipping_option_parity_preview: {
      tone: "neutral",
      parity_state: "not_applicable",
      status_label: "No committed legacy method to compare",
      legacy_method_label: null,
      shadow_modality_label: null,
      detail_label: null,
      hint_messages: [
        "Parity preview activates only when checkout already has a committed legacy shipping method.",
      ],
    },
    shadow_selection_parity_preview: {
      tone: "neutral",
      parity_status: "missing_legacy_method",
      status_label: "No committed legacy method to compare",
      legacy_method_label: null,
      legacy_modality_label: null,
      neutral_modality_label: null,
      legacy_reference_label: null,
      neutral_reference_label: null,
      readiness_label: null,
      hint_messages: [
        "Selection parity preview activates only when checkout already has a committed legacy shipping method.",
      ],
    },
    shadow_orchestration_verdict_preview: {
      tone: "neutral",
      verdict_code: "insufficient_data",
      status_label: "Shadow orchestration verdict informational only",
      signal_summary_label: "0 positive · 0 attention · 4 informational",
      actionability_label: "incomplete",
      shipping_option_parity_label: "not applicable",
      selection_parity_label: "missing legacy method",
      hint_messages: [
        "Current read-only shadow constellation is still informational and does not yet provide enough comparable context for a stronger rollout verdict.",
      ],
    },
    shadow_orchestration_recommendation_preview: {
      tone: "neutral",
      recommendation_status: "insufficient_data",
      status_label: "Shadow recommendation preview needs more context",
      recommended_modality_label: null,
      recommended_pickup_point_label: null,
      recommended_pickup_window_label: null,
      recommended_quote_amount: null,
      currency_code: null,
      recommended_quote_eta_label: null,
      readiness_label: "Selection missing",
      detail_label: "incomplete · not applicable · missing legacy method",
      hint_messages: [
        "Current shadow constellation is still informational only and does not yet have enough shopper-safe context to describe a recommendation.",
      ],
    },
  })

  assert.deepEqual(insufficientPreview, {
    tone: "neutral",
    cutover_readiness_status: "insufficient_data",
    status_label: "Shadow cutover readiness preview needs more context",
    readiness_label: "Selection missing",
    recommendation_label: "shadow recommendation insufficient data",
    modality_label: null,
    detail_label:
      "verdict insufficient data · shadow recommendation insufficient data · incomplete · not applicable · missing legacy method",
    hint_messages: [
      "Shadow-only cutover readiness preview does not yet have enough comparable context to claim future cutover readiness for this checkout.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, or switch anything.",
      "Current read-only shadow constellation is still informational and does not yet provide enough comparable context for a stronger rollout verdict.",
      "Current shadow constellation is still informational only and does not yet have enough shopper-safe context to describe a recommendation.",
    ],
  })

  const notReadyPreview = buildDeliveryHubShadowCutoverReadinessPreviewModel({
    readiness_preview: {
      tone: "warning",
      status_label: "Selection not ready",
      connection_label: "conn_2",
      quote_type_label: "Warehouse → pickup point",
      issue_messages: ["Pickup point is required"],
      updated_at: "2026-04-21T19:00:00.000Z",
    },
    persisted_selection_preview: {
      tone: "warning",
      status_label: "Persisted selection requires attention",
      modality_label: "Warehouse → pickup point",
      quote_amount: 450,
      currency_code: "RUB",
      quote_eta_label: "ETA 1–3 days",
      pickup_point_label: "Pickup point B",
      pickup_window_label: null,
      readiness_label: "Selection not ready",
      hint_messages: [
        "Persisted selection is stored but still needs additional checkout context before it can become ready.",
      ],
      updated_at: "2026-04-21T19:00:00.000Z",
    },
    shadow_selection_actionability_preview: {
      tone: "warning",
      actionability_status: "needs_pickup_point",
      status_label: "Pickup-point context still needed",
      connection_label: "conn_2",
      modality_label: "Warehouse → pickup point",
      readiness_label: "Selection not ready",
      hint_messages: ["Pickup point is required"],
    },
    shadow_shipping_option_parity_preview: {
      tone: "warning",
      parity_state: "divergent",
      status_label: "Sampled pickup-point parity diverges",
      legacy_method_label: "Pickup delivery",
      shadow_modality_label: "Warehouse → pickup point",
      detail_label: "0 destination-compatible pickup points",
      hint_messages: [
        "Legacy checkout currently has a committed pickup-point method, but sampled neutral pickup-point availability is not currently returned for the same checkout context.",
      ],
    },
    shadow_selection_parity_preview: {
      tone: "warning",
      parity_status: "missing_neutral_selection",
      status_label: "Neutral persisted selection missing",
      legacy_method_label: "Pickup delivery",
      legacy_modality_label: "Pickup point",
      neutral_modality_label: null,
      legacy_reference_label: "Pickup point B",
      neutral_reference_label: null,
      readiness_label: "Selection not ready",
      hint_messages: [
        "Legacy checkout currently has a committed shipping method, but no neutral persisted selection is stored for this cart.",
      ],
    },
    shadow_orchestration_verdict_preview: {
      tone: "warning",
      verdict_code: "degraded",
      status_label: "Shadow orchestration verdict degraded",
      signal_summary_label: "0 positive · 6 attention · 0 informational",
      actionability_label: "needs pickup-point context",
      shipping_option_parity_label: "degraded",
      selection_parity_label: "missing neutral selection",
      hint_messages: [
        "Current read-only shadow constellation shows degradation or parity drift, so rollout observability remains watch-only.",
      ],
    },
    shadow_orchestration_recommendation_preview: {
      tone: "warning",
      recommendation_status: "unavailable",
      status_label: "Shadow recommendation preview unavailable",
      recommended_modality_label: null,
      recommended_pickup_point_label: null,
      recommended_pickup_window_label: null,
      recommended_quote_amount: null,
      currency_code: null,
      recommended_quote_eta_label: null,
      readiness_label: "Selection not ready",
      detail_label:
        "needs pickup-point context · degraded · missing neutral selection",
      hint_messages: [
        "Current shadow constellation does not support a shopper-safe recommendation for this cart context, so this block remains informational only.",
      ],
    },
  })

  assert.deepEqual(notReadyPreview, {
    tone: "warning",
    cutover_readiness_status: "not_ready",
    status_label: "Shadow cutover readiness preview indicates not-ready contour",
    readiness_label: "Selection not ready",
    recommendation_label: "shadow recommendation unavailable",
    modality_label: "Warehouse → pickup point",
    detail_label:
      "verdict degraded · shadow recommendation unavailable · needs pickup-point context · degraded · missing neutral selection",
    hint_messages: [
      "Shadow-only cutover readiness preview currently indicates that the checkout contour is not ready for a future Delivery Hub cutover.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, or switch anything.",
      "Current read-only shadow constellation shows degradation or parity drift, so rollout observability remains watch-only.",
      "Current shadow constellation does not support a shopper-safe recommendation for this cart context, so this block remains informational only.",
    ],
  })
})

test("buildDeliveryHubShadowCutoverBlockersPreviewModel reports known blockers only when they already follow from shadow previews", () => {
  const preview = buildDeliveryHubShadowCutoverBlockersPreviewModel({
    readiness_preview: {
      tone: "warning",
      status_label: "Selection not ready",
      connection_label: "conn_2",
      quote_type_label: "Warehouse → pickup point",
      issue_messages: ["Pickup point is required"],
      updated_at: "2026-04-21T19:00:00.000Z",
    },
    persisted_selection_preview: {
      tone: "warning",
      status_label: "Persisted selection requires attention",
      modality_label: "Warehouse → pickup point",
      quote_amount: 450,
      currency_code: "RUB",
      quote_eta_label: "ETA 1–3 days",
      pickup_point_label: "Pickup point B",
      pickup_window_label: null,
      readiness_label: "Selection not ready",
      hint_messages: [
        "Persisted selection is stored but still needs additional checkout context before it can become ready.",
      ],
      updated_at: "2026-04-21T19:00:00.000Z",
    },
    shadow_selection_actionability_preview: {
      tone: "warning",
      actionability_status: "needs_pickup_point",
      status_label: "Pickup-point context still needed",
      connection_label: "conn_2",
      modality_label: "Warehouse → pickup point",
      readiness_label: "Selection not ready",
      hint_messages: ["Pickup point is required"],
    },
    shadow_shipping_option_parity_preview: {
      tone: "warning",
      parity_state: "divergent",
      status_label: "Sampled pickup-point parity diverges",
      legacy_method_label: "Pickup delivery",
      shadow_modality_label: "Warehouse → pickup point",
      detail_label: "0 destination-compatible pickup points",
      hint_messages: [
        "Legacy checkout currently has a committed pickup-point method, but sampled neutral pickup-point availability is not currently returned for the same checkout context.",
      ],
    },
    shadow_selection_parity_preview: {
      tone: "warning",
      parity_status: "missing_neutral_selection",
      status_label: "Neutral persisted selection missing",
      legacy_method_label: "Pickup delivery",
      legacy_modality_label: "Pickup point",
      neutral_modality_label: null,
      legacy_reference_label: "Pickup point B",
      neutral_reference_label: null,
      readiness_label: "Selection not ready",
      hint_messages: [
        "Legacy checkout currently has a committed shipping method, but no neutral persisted selection is stored for this cart.",
      ],
    },
    shadow_orchestration_verdict_preview: {
      tone: "warning",
      verdict_code: "degraded",
      status_label: "Shadow orchestration verdict degraded",
      signal_summary_label: "0 positive · 4 attention · 0 informational",
      actionability_label: "needs pickup-point context",
      shipping_option_parity_label: "degraded",
      selection_parity_label: "missing neutral selection",
      hint_messages: [
        "Current read-only shadow constellation shows degradation or parity drift, so rollout observability remains watch-only.",
      ],
    },
    shadow_orchestration_recommendation_preview: {
      tone: "warning",
      recommendation_status: "unavailable",
      status_label: "Shadow recommendation preview unavailable",
      recommended_modality_label: null,
      recommended_pickup_point_label: null,
      recommended_pickup_window_label: null,
      recommended_quote_amount: null,
      currency_code: null,
      recommended_quote_eta_label: null,
      readiness_label: "Selection not ready",
      detail_label: "needs pickup-point context · degraded · missing neutral selection",
      hint_messages: [
        "Current shadow constellation does not support a shopper-safe recommendation for this cart context, so this block remains informational only.",
      ],
    },
    shadow_cutover_readiness_preview: {
      tone: "warning",
      cutover_readiness_status: "not_ready",
      status_label: "Shadow cutover readiness preview indicates not-ready contour",
      readiness_label: "Selection not ready",
      recommendation_label: "shadow recommendation unavailable",
      modality_label: "Warehouse → pickup point",
      detail_label:
        "verdict degraded · shadow recommendation unavailable · needs pickup-point context · degraded · missing neutral selection",
      hint_messages: [
        "Shadow-only cutover readiness preview currently indicates that the checkout contour is not ready for a future Delivery Hub cutover.",
      ],
    },
  })

  assert.deepEqual(preview, {
    tone: "warning",
    blockers_status: "known_blockers",
    status_label: "Known shadow cutover blockers visible",
    readiness_label: "Selection not ready",
    verdict_label: "shadow verdict degraded",
    recommendation_label: "shadow recommendation unavailable",
    blocker_count_label: "3 known blockers visible",
    blockers: [
      {
        code: "needs_pickup_point",
        label: "Neutral pickup-point context is still missing",
        detail_label: "Pickup point is required",
      },
      {
        code: "shipping_option_parity_divergent",
        label: "Committed legacy shipping option diverges from sampled shadow parity",
        detail_label:
          "Legacy checkout currently has a committed pickup-point method, but sampled neutral pickup-point availability is not currently returned for the same checkout context.",
      },
      {
        code: "missing_neutral_selection",
        label: "Neutral persisted selection is missing",
        detail_label:
          "Legacy checkout currently has a committed shipping method, but no neutral persisted selection is stored for this cart.",
      },
    ],
    hint_messages: [
      "Read-only shadow cutover blockers preview only. Known blocker points below are derived from existing shadow previews for the current checkout context and do not change shopper state.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, or switch anything.",
      "Shadow-only cutover readiness preview currently indicates that the checkout contour is not ready for a future Delivery Hub cutover.",
    ],
  })
})

test("buildDeliveryHubShadowCutoverBlockersPreviewModel stays neutral when no known blockers are visible or context is still insufficient", () => {
  const noKnownBlockersPreview = buildDeliveryHubShadowCutoverBlockersPreviewModel({
    readiness_preview: {
      tone: "positive",
      status_label: "Selection ready",
      connection_label: "conn_1",
      quote_type_label: "Warehouse → pickup point",
      issue_messages: [],
      updated_at: "2026-04-21T18:00:00.000Z",
    },
    persisted_selection_preview: {
      tone: "positive",
      status_label: "Persisted selection available",
      modality_label: "Warehouse → pickup point",
      quote_amount: 499,
      currency_code: "RUB",
      quote_eta_label: "ETA 1–2 days",
      pickup_point_label: "Pickup point A",
      pickup_window_label: null,
      readiness_label: "Selection ready",
      hint_messages: ["Persisted selection currently passes readiness checks."],
      updated_at: "2026-04-21T18:00:00.000Z",
    },
    shadow_selection_actionability_preview: {
      tone: "positive",
      actionability_status: "ready",
      status_label: "Action-ready preview",
      connection_label: "conn_1",
      modality_label: "Warehouse → pickup point",
      readiness_label: "Selection ready",
      hint_messages: [
        "Persisted neutral selection currently passes readiness checks and sampled shadow data does not signal a stale checkout constellation.",
      ],
    },
    shadow_shipping_option_parity_preview: {
      tone: "positive",
      parity_state: "aligned",
      status_label: "Sampled shadow parity aligns",
      legacy_method_label: "Pickup delivery",
      shadow_modality_label: "Warehouse → pickup point",
      detail_label: "2 sampled quotes · 3 destination-compatible pickup points",
      hint_messages: [
        "Legacy checkout currently has a committed pickup-point method, and the sampled neutral shadow context also returns pickup-point availability plus sampled quotes for the same checkout context.",
      ],
    },
    shadow_selection_parity_preview: {
      tone: "positive",
      parity_status: "aligned",
      status_label: "Committed legacy selection aligns with neutral selection preview",
      legacy_method_label: "Pickup delivery",
      legacy_modality_label: "Pickup point",
      neutral_modality_label: "Pickup point",
      legacy_reference_label: "Pickup point A",
      neutral_reference_label: "Pickup point A",
      readiness_label: "Selection ready",
      hint_messages: [
        "Committed legacy shipping context and persisted neutral selection currently align on shopper-visible modality and pickup reference.",
      ],
    },
    shadow_orchestration_verdict_preview: {
      tone: "positive",
      verdict_code: "aligned",
      status_label: "Shadow orchestration verdict aligned",
      signal_summary_label: "4 positive · 0 attention · 0 informational",
      actionability_label: "action-ready",
      shipping_option_parity_label: "aligned",
      selection_parity_label: "aligned",
      hint_messages: [
        "Current read-only shadow constellation agrees across readiness, actionability, and parity previews for the sampled legacy checkout context.",
      ],
    },
    shadow_orchestration_recommendation_preview: {
      tone: "positive",
      recommendation_status: "recommended",
      status_label: "Shadow recommendation preview available",
      recommended_modality_label: "Warehouse → pickup point",
      recommended_pickup_point_label: "Pickup point A",
      recommended_pickup_window_label: null,
      recommended_quote_amount: 499,
      currency_code: "RUB",
      recommended_quote_eta_label: "ETA 1–2 days",
      readiness_label: "Selection ready",
      detail_label: "action-ready · aligned · aligned",
      hint_messages: [
        "Read-only shadow recommendation only. Current checkout keeps the committed legacy shipping flow and does not switch shipping method or save any neutral selection from this preview.",
      ],
    },
    shadow_cutover_readiness_preview: {
      tone: "positive",
      cutover_readiness_status: "ready",
      status_label: "Shadow cutover readiness preview indicates ready contour",
      readiness_label: "Selection ready",
      recommendation_label: "shadow recommendation recommended",
      modality_label: "Warehouse → pickup point",
      detail_label:
        "verdict aligned · shadow recommendation recommended · action-ready · aligned · aligned",
      hint_messages: [
        "Shadow-only cutover readiness preview indicates that the current checkout contour looks internally aligned for a future Delivery Hub cutover.",
      ],
    },
  })

  assert.deepEqual(noKnownBlockersPreview, {
    tone: "neutral",
    blockers_status: "no_known_blockers",
    status_label: "No known shadow cutover blockers visible",
    readiness_label: "Selection ready",
    verdict_label: "shadow verdict aligned",
    recommendation_label: "shadow recommendation recommended",
    blocker_count_label: null,
    blockers: [],
    hint_messages: [
      "Read-only shadow cutover blockers preview only. No known blocker points are currently visible in existing shadow previews for this checkout context.",
      "This neutral result does not claim that checkout is already cut over or that the active shipping commit path has changed.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, or switch anything.",
    ],
  })

  const insufficientPreview = buildDeliveryHubShadowCutoverBlockersPreviewModel({
    readiness_preview: {
      tone: "neutral",
      status_label: "Readiness unavailable",
      connection_label: null,
      quote_type_label: null,
      issue_messages: [],
      updated_at: null,
    },
    persisted_selection_preview: {
      tone: "neutral",
      status_label: "Persisted selection missing",
      modality_label: null,
      quote_amount: null,
      currency_code: null,
      quote_eta_label: null,
      pickup_point_label: null,
      pickup_window_label: null,
      readiness_label: "Selection missing",
      hint_messages: [
        "Readiness currently agrees that no neutral persisted selection is stored for this cart.",
      ],
      updated_at: null,
    },
    shadow_selection_actionability_preview: {
      tone: "neutral",
      actionability_status: "incomplete",
      status_label: "Neutral preview context incomplete",
      connection_label: null,
      modality_label: null,
      readiness_label: null,
      hint_messages: [
        "Current shadow selection actionability remains informational because sampled preview context is incomplete.",
      ],
    },
    shadow_shipping_option_parity_preview: {
      tone: "neutral",
      parity_state: "not_applicable",
      status_label: "No committed legacy method to compare",
      legacy_method_label: null,
      shadow_modality_label: null,
      detail_label: null,
      hint_messages: [
        "Parity preview activates only when checkout already has a committed legacy shipping method.",
      ],
    },
    shadow_selection_parity_preview: {
      tone: "neutral",
      parity_status: "missing_legacy_method",
      status_label: "No committed legacy method to compare",
      legacy_method_label: null,
      legacy_modality_label: null,
      neutral_modality_label: null,
      legacy_reference_label: null,
      neutral_reference_label: null,
      readiness_label: null,
      hint_messages: [
        "Selection parity preview activates only when checkout already has a committed legacy shipping method.",
      ],
    },
    shadow_orchestration_verdict_preview: {
      tone: "neutral",
      verdict_code: "insufficient_data",
      status_label: "Shadow orchestration verdict informational only",
      signal_summary_label: "0 positive · 0 attention · 4 informational",
      actionability_label: "incomplete",
      shipping_option_parity_label: "not applicable",
      selection_parity_label: "missing legacy method",
      hint_messages: [
        "Current read-only shadow constellation is still informational and does not yet provide enough comparable context for a stronger rollout verdict.",
      ],
    },
    shadow_orchestration_recommendation_preview: {
      tone: "neutral",
      recommendation_status: "insufficient_data",
      status_label: "Shadow recommendation preview needs more context",
      recommended_modality_label: null,
      recommended_pickup_point_label: null,
      recommended_pickup_window_label: null,
      recommended_quote_amount: null,
      currency_code: null,
      recommended_quote_eta_label: null,
      readiness_label: "Selection missing",
      detail_label: "incomplete · not applicable · missing legacy method",
      hint_messages: [
        "Current shadow constellation is still informational only and does not yet have enough shopper-safe context to describe a recommendation.",
      ],
    },
    shadow_cutover_readiness_preview: {
      tone: "neutral",
      cutover_readiness_status: "insufficient_data",
      status_label: "Shadow cutover readiness preview needs more context",
      readiness_label: "Selection missing",
      recommendation_label: "shadow recommendation insufficient data",
      modality_label: null,
      detail_label:
        "verdict insufficient data · shadow recommendation insufficient data · incomplete · not applicable · missing legacy method",
      hint_messages: [
        "Shadow-only cutover readiness preview does not yet have enough comparable context to claim future cutover readiness for this checkout.",
      ],
    },
  })

  assert.deepEqual(insufficientPreview, {
    tone: "neutral",
    blockers_status: "insufficient_data",
    status_label: "Shadow cutover blockers preview needs more context",
    readiness_label: "Selection missing",
    verdict_label: "shadow verdict insufficient data",
    recommendation_label: "shadow recommendation insufficient data",
    blocker_count_label: null,
    blockers: [],
    hint_messages: [
      "Read-only shadow cutover blockers preview does not yet have enough comparable context to list blocker points for the current checkout.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, or switch anything.",
      "Shadow-only cutover readiness preview does not yet have enough comparable context to claim future cutover readiness for this checkout.",
      "Current shadow constellation is still informational only and does not yet have enough shopper-safe context to describe a recommendation.",
    ],
  })
})

test("buildDeliveryHubShadowCutoverNextStepsPreviewModel reports known next steps only when they already follow from shadow blockers", () => {
  const preview = buildDeliveryHubShadowCutoverNextStepsPreviewModel({
    readiness_preview: {
      tone: "warning",
      status_label: "Selection not ready",
      connection_label: "conn_2",
      quote_type_label: "Warehouse → pickup point",
      issue_messages: ["Pickup point is required"],
      updated_at: "2026-04-21T19:00:00.000Z",
    },
    persisted_selection_preview: {
      tone: "warning",
      status_label: "Persisted selection requires attention",
      modality_label: "Warehouse → pickup point",
      quote_amount: 450,
      currency_code: "RUB",
      quote_eta_label: "ETA 1–3 days",
      pickup_point_label: "Pickup point B",
      pickup_window_label: null,
      readiness_label: "Selection not ready",
      hint_messages: [
        "Persisted selection is stored but still needs additional checkout context before it can become ready.",
      ],
      updated_at: "2026-04-21T19:00:00.000Z",
    },
    shadow_selection_actionability_preview: {
      tone: "warning",
      actionability_status: "needs_pickup_point",
      status_label: "Pickup-point context still needed",
      connection_label: "conn_2",
      modality_label: "Warehouse → pickup point",
      readiness_label: "Selection not ready",
      hint_messages: ["Pickup point is required"],
    },
    shadow_shipping_option_parity_preview: {
      tone: "warning",
      parity_state: "divergent",
      status_label: "Sampled pickup-point parity diverges",
      legacy_method_label: "Pickup delivery",
      shadow_modality_label: "Warehouse → pickup point",
      detail_label: "0 destination-compatible pickup points",
      hint_messages: [
        "Legacy checkout currently has a committed pickup-point method, but sampled neutral pickup-point availability is not currently returned for the same checkout context.",
      ],
    },
    shadow_selection_parity_preview: {
      tone: "warning",
      parity_status: "missing_neutral_selection",
      status_label: "Neutral persisted selection missing",
      legacy_method_label: "Pickup delivery",
      legacy_modality_label: "Pickup point",
      neutral_modality_label: null,
      legacy_reference_label: "Pickup point B",
      neutral_reference_label: null,
      readiness_label: "Selection not ready",
      hint_messages: [
        "Legacy checkout currently has a committed shipping method, but no neutral persisted selection is stored for this cart.",
      ],
    },
    shadow_orchestration_recommendation_preview: {
      tone: "warning",
      recommendation_status: "unavailable",
      status_label: "Shadow recommendation preview unavailable",
      recommended_modality_label: null,
      recommended_pickup_point_label: null,
      recommended_pickup_window_label: null,
      recommended_quote_amount: null,
      currency_code: null,
      recommended_quote_eta_label: null,
      readiness_label: "Selection not ready",
      detail_label: "needs pickup-point context · degraded · missing neutral selection",
      hint_messages: [
        "Current shadow constellation does not support a shopper-safe recommendation for this cart context, so this block remains informational only.",
      ],
    },
    shadow_cutover_readiness_preview: {
      tone: "warning",
      cutover_readiness_status: "not_ready",
      status_label: "Shadow cutover readiness preview indicates not-ready contour",
      readiness_label: "Selection not ready",
      recommendation_label: "shadow recommendation unavailable",
      modality_label: "Warehouse → pickup point",
      detail_label:
        "verdict degraded · shadow recommendation unavailable · needs pickup-point context · degraded · missing neutral selection",
      hint_messages: [
        "Shadow-only cutover readiness preview currently indicates that the checkout contour is not ready for a future Delivery Hub cutover.",
      ],
    },
    shadow_cutover_blockers_preview: {
      tone: "warning",
      blockers_status: "known_blockers",
      status_label: "Known shadow cutover blockers visible",
      readiness_label: "Selection not ready",
      verdict_label: "shadow verdict degraded",
      recommendation_label: "shadow recommendation unavailable",
      blocker_count_label: "3 known blockers visible",
      blockers: [
        {
          code: "needs_pickup_point",
          label: "Neutral pickup-point context is still missing",
          detail_label: "Pickup point is required",
        },
        {
          code: "shipping_option_parity_divergent",
          label: "Committed legacy shipping option diverges from sampled shadow parity",
          detail_label:
            "Legacy checkout currently has a committed pickup-point method, but sampled neutral pickup-point availability is not currently returned for the same checkout context.",
        },
        {
          code: "missing_neutral_selection",
          label: "Neutral persisted selection is missing",
          detail_label:
            "Legacy checkout currently has a committed shipping method, but no neutral persisted selection is stored for this cart.",
        },
      ],
      hint_messages: [
        "Read-only shadow cutover blockers preview only. Known blocker points below are derived from existing shadow previews for the current checkout context and do not change shopper state.",
      ],
    },
  })

  assert.deepEqual(preview, {
    tone: "warning",
    next_steps_status: "known_next_steps",
    status_label: "Known shadow cutover next steps visible",
    readiness_label: "Selection not ready",
    blocker_status_label: "blockers known blockers",
    recommendation_label: "shadow recommendation unavailable",
    next_step_count_label: "3 next steps visible",
    next_steps: [
      {
        code: "observe_shadow_pickup_point_context",
        label:
          "Wait for comparable shadow pickup-point context before planning any future cutover step",
        detail_label: "Pickup point is required",
      },
      {
        code: "investigate_shipping_option_parity",
        label: "Investigate the shipping-option parity drift already visible in shadow previews",
        detail_label:
          "Legacy checkout currently has a committed pickup-point method, but sampled neutral pickup-point availability is not currently returned for the same checkout context.",
      },
      {
        code: "observe_neutral_selection",
        label:
          "Observe a persisted neutral selection in shadow before planning any future cutover step",
        detail_label:
          "Legacy checkout currently has a committed shipping method, but no neutral persisted selection is stored for this cart.",
      },
    ],
    hint_messages: [
      "Read-only shadow cutover next-steps preview only. Suggested next steps below simply restate issues already visible in existing shadow previews for the current checkout context.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, or switch anything.",
      "Read-only shadow cutover blockers preview only. Known blocker points below are derived from existing shadow previews for the current checkout context and do not change shopper state.",
      "Shadow-only cutover readiness preview currently indicates that the checkout contour is not ready for a future Delivery Hub cutover.",
    ],
  })
})

test("buildDeliveryHubShadowCutoverNextStepsPreviewModel stays neutral when next steps are unclear or context is insufficient", () => {
  const noClearNextStepsPreview = buildDeliveryHubShadowCutoverNextStepsPreviewModel({
    readiness_preview: {
      tone: "positive",
      status_label: "Selection ready",
      connection_label: "conn_1",
      quote_type_label: "Warehouse → pickup point",
      issue_messages: [],
      updated_at: "2026-04-21T18:00:00.000Z",
    },
    persisted_selection_preview: {
      tone: "positive",
      status_label: "Persisted selection available",
      modality_label: "Warehouse → pickup point",
      quote_amount: 499,
      currency_code: "RUB",
      quote_eta_label: "ETA 1–2 days",
      pickup_point_label: "Pickup point A",
      pickup_window_label: null,
      readiness_label: "Selection ready",
      hint_messages: ["Persisted selection currently passes readiness checks."],
      updated_at: "2026-04-21T18:00:00.000Z",
    },
    shadow_selection_actionability_preview: {
      tone: "positive",
      actionability_status: "ready",
      status_label: "Action-ready preview",
      connection_label: "conn_1",
      modality_label: "Warehouse → pickup point",
      readiness_label: "Selection ready",
      hint_messages: [
        "Persisted neutral selection currently passes readiness checks and sampled shadow data does not signal a stale checkout constellation.",
      ],
    },
    shadow_shipping_option_parity_preview: {
      tone: "positive",
      parity_state: "aligned",
      status_label: "Sampled shadow parity aligns",
      legacy_method_label: "Pickup delivery",
      shadow_modality_label: "Warehouse → pickup point",
      detail_label: "2 sampled quotes · 3 destination-compatible pickup points",
      hint_messages: [
        "Legacy checkout currently has a committed pickup-point method, and the sampled neutral shadow context also returns pickup-point availability plus sampled quotes for the same checkout context.",
      ],
    },
    shadow_selection_parity_preview: {
      tone: "positive",
      parity_status: "aligned",
      status_label: "Committed legacy selection aligns with neutral selection preview",
      legacy_method_label: "Pickup delivery",
      legacy_modality_label: "Pickup point",
      neutral_modality_label: "Pickup point",
      legacy_reference_label: "Pickup point A",
      neutral_reference_label: "Pickup point A",
      readiness_label: "Selection ready",
      hint_messages: [
        "Committed legacy shipping context and persisted neutral selection currently align on shopper-visible modality and pickup reference.",
      ],
    },
    shadow_orchestration_recommendation_preview: {
      tone: "positive",
      recommendation_status: "recommended",
      status_label: "Shadow recommendation preview available",
      recommended_modality_label: "Warehouse → pickup point",
      recommended_pickup_point_label: "Pickup point A",
      recommended_pickup_window_label: null,
      recommended_quote_amount: 499,
      currency_code: "RUB",
      recommended_quote_eta_label: "ETA 1–2 days",
      readiness_label: "Selection ready",
      detail_label: "action-ready · aligned · aligned",
      hint_messages: [
        "Read-only shadow recommendation only. Current checkout keeps the committed legacy shipping flow and does not switch shipping method or save any neutral selection from this preview.",
      ],
    },
    shadow_cutover_readiness_preview: {
      tone: "positive",
      cutover_readiness_status: "ready",
      status_label: "Shadow cutover readiness preview indicates ready contour",
      readiness_label: "Selection ready",
      recommendation_label: "shadow recommendation recommended",
      modality_label: "Warehouse → pickup point",
      detail_label:
        "verdict aligned · shadow recommendation recommended · action-ready · aligned · aligned",
      hint_messages: [
        "Shadow-only cutover readiness preview indicates that the current checkout contour looks internally aligned for a future Delivery Hub cutover.",
      ],
    },
    shadow_cutover_blockers_preview: {
      tone: "neutral",
      blockers_status: "no_known_blockers",
      status_label: "No known shadow cutover blockers visible",
      readiness_label: "Selection ready",
      verdict_label: "shadow verdict aligned",
      recommendation_label: "shadow recommendation recommended",
      blocker_count_label: null,
      blockers: [],
      hint_messages: [
        "Read-only shadow cutover blockers preview only. No known blocker points are currently visible in existing shadow previews for this checkout context.",
      ],
    },
  })

  assert.deepEqual(noClearNextStepsPreview, {
    tone: "neutral",
    next_steps_status: "no_clear_next_steps",
    status_label: "No clear shadow cutover next steps visible",
    readiness_label: "Selection ready",
    blocker_status_label: "blockers no known blockers",
    recommendation_label: "shadow recommendation recommended",
    next_step_count_label: null,
    next_steps: [],
    hint_messages: [
      "Read-only shadow cutover next-steps preview only. Existing shadow previews do not currently point to a single clear next step for this checkout context.",
      "This neutral result does not claim that checkout is already cut over or that the active shipping commit path has changed.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, or switch anything.",
    ],
  })

  const insufficientPreview = buildDeliveryHubShadowCutoverNextStepsPreviewModel({
    readiness_preview: {
      tone: "neutral",
      status_label: "Readiness unavailable",
      connection_label: null,
      quote_type_label: null,
      issue_messages: [],
      updated_at: null,
    },
    persisted_selection_preview: {
      tone: "neutral",
      status_label: "Persisted selection missing",
      modality_label: null,
      quote_amount: null,
      currency_code: null,
      quote_eta_label: null,
      pickup_point_label: null,
      pickup_window_label: null,
      readiness_label: "Selection missing",
      hint_messages: [
        "Readiness currently agrees that no neutral persisted selection is stored for this cart.",
      ],
      updated_at: null,
    },
    shadow_selection_actionability_preview: {
      tone: "neutral",
      actionability_status: "incomplete",
      status_label: "Neutral preview context incomplete",
      connection_label: null,
      modality_label: null,
      readiness_label: null,
      hint_messages: [
        "Current shadow selection actionability remains informational because sampled preview context is incomplete.",
      ],
    },
    shadow_shipping_option_parity_preview: {
      tone: "neutral",
      parity_state: "not_applicable",
      status_label: "No committed legacy method to compare",
      legacy_method_label: null,
      shadow_modality_label: null,
      detail_label: null,
      hint_messages: [
        "Parity preview activates only when checkout already has a committed legacy shipping method.",
      ],
    },
    shadow_selection_parity_preview: {
      tone: "neutral",
      parity_status: "missing_legacy_method",
      status_label: "No committed legacy method to compare",
      legacy_method_label: null,
      legacy_modality_label: null,
      neutral_modality_label: null,
      legacy_reference_label: null,
      neutral_reference_label: null,
      readiness_label: null,
      hint_messages: [
        "Selection parity preview activates only when checkout already has a committed legacy shipping method.",
      ],
    },
    shadow_orchestration_recommendation_preview: {
      tone: "neutral",
      recommendation_status: "insufficient_data",
      status_label: "Shadow recommendation preview needs more context",
      recommended_modality_label: null,
      recommended_pickup_point_label: null,
      recommended_pickup_window_label: null,
      recommended_quote_amount: null,
      currency_code: null,
      recommended_quote_eta_label: null,
      readiness_label: "Selection missing",
      detail_label: "incomplete · not applicable · missing legacy method",
      hint_messages: [
        "Current shadow constellation is still informational only and does not yet have enough shopper-safe context to describe a recommendation.",
      ],
    },
    shadow_cutover_readiness_preview: {
      tone: "neutral",
      cutover_readiness_status: "insufficient_data",
      status_label: "Shadow cutover readiness preview needs more context",
      readiness_label: "Selection missing",
      recommendation_label: "shadow recommendation insufficient data",
      modality_label: null,
      detail_label:
        "verdict insufficient data · shadow recommendation insufficient data · incomplete · not applicable · missing legacy method",
      hint_messages: [
        "Shadow-only cutover readiness preview does not yet have enough comparable context to claim future cutover readiness for this checkout.",
      ],
    },
    shadow_cutover_blockers_preview: {
      tone: "neutral",
      blockers_status: "insufficient_data",
      status_label: "Shadow cutover blockers preview needs more context",
      readiness_label: "Selection missing",
      verdict_label: "shadow verdict insufficient data",
      recommendation_label: "shadow recommendation insufficient data",
      blocker_count_label: null,
      blockers: [],
      hint_messages: [
        "Read-only shadow cutover blockers preview does not yet have enough comparable context to list blocker points for the current checkout.",
      ],
    },
  })

  assert.deepEqual(insufficientPreview, {
    tone: "neutral",
    next_steps_status: "insufficient_data",
    status_label: "Shadow cutover next-steps preview needs more context",
    readiness_label: "Selection missing",
    blocker_status_label: "blockers insufficient data",
    recommendation_label: "shadow recommendation insufficient data",
    next_step_count_label: null,
    next_steps: [],
    hint_messages: [
      "Read-only shadow cutover next-steps preview does not yet have enough comparable context to suggest meaningful next steps for the current checkout.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, or switch anything.",
      "Shadow-only cutover readiness preview does not yet have enough comparable context to claim future cutover readiness for this checkout.",
      "Current shadow constellation is still informational only and does not yet have enough shopper-safe context to describe a recommendation.",
    ],
  })
})

test("buildDeliveryHubShadowCutoverSummaryPreviewModel reports aligned, attention, and insufficient-data shadow summaries truthfully", () => {
  const readyPreview = buildDeliveryHubShadowCutoverSummaryPreviewModel({
    shadow_orchestration_recommendation_preview: {
      tone: "positive",
      recommendation_status: "recommended",
      status_label: "Shadow recommendation preview available",
      recommended_modality_label: "Warehouse → pickup point",
      recommended_pickup_point_label: "Pickup point A",
      recommended_pickup_window_label: null,
      recommended_quote_amount: 499,
      currency_code: "RUB",
      recommended_quote_eta_label: "ETA 1–2 days",
      readiness_label: "Selection ready",
      detail_label: "action-ready · aligned · aligned",
      hint_messages: [
        "Read-only shadow recommendation only. Current checkout keeps the committed legacy shipping flow and does not switch shipping method or save any neutral selection from this preview.",
      ],
    },
    shadow_cutover_readiness_preview: {
      tone: "positive",
      cutover_readiness_status: "ready",
      status_label: "Shadow cutover readiness preview indicates ready contour",
      readiness_label: "Selection ready",
      recommendation_label: "shadow recommendation recommended",
      modality_label: "Warehouse → pickup point",
      detail_label:
        "verdict aligned · shadow recommendation recommended · action-ready · aligned · aligned",
      hint_messages: [
        "Shadow-only cutover readiness preview indicates that the current checkout contour looks internally aligned for a future Delivery Hub cutover.",
      ],
    },
    shadow_cutover_blockers_preview: {
      tone: "neutral",
      blockers_status: "no_known_blockers",
      status_label: "No known shadow cutover blockers visible",
      readiness_label: "Selection ready",
      verdict_label: "shadow verdict aligned",
      recommendation_label: "shadow recommendation recommended",
      blocker_count_label: null,
      blockers: [],
      hint_messages: [
        "Read-only shadow cutover blockers preview only. No known blocker points are currently visible in existing shadow previews for this checkout context.",
      ],
    },
    shadow_cutover_next_steps_preview: {
      tone: "neutral",
      next_steps_status: "no_clear_next_steps",
      status_label: "No clear shadow cutover next steps visible",
      readiness_label: "Selection ready",
      blocker_status_label: "blockers no known blockers",
      recommendation_label: "shadow recommendation recommended",
      next_step_count_label: null,
      next_steps: [],
      hint_messages: [
        "Read-only shadow cutover next-steps preview only. Existing shadow previews do not currently point to a single clear next step for this checkout context.",
      ],
    },
  })

  assert.deepEqual(readyPreview, {
    tone: "positive",
    summary_status: "ready_shadow_contour",
    status_label: "Shadow cutover summary preview indicates aligned shadow contour",
    readiness_label: "Selection ready",
    modality_label: "Warehouse → pickup point",
    recommendation_label: "shadow recommendation recommended",
    blocker_count_label: null,
    next_step_count_label: null,
    detail_label: "readiness ready · blockers no known blockers · next steps no clear next steps",
    headline_messages: [
      "Readiness preview currently shows an aligned shadow contour.",
      "No known shadow blockers are currently visible.",
      "No clear shadow next step is currently visible.",
    ],
    hint_messages: [
      "Read-only shadow cutover summary preview only. This compact block aggregates already visible shadow readiness, blockers, and next-step previews for future Delivery Hub cutover planning only.",
      "Aligned shadow contour here means that the currently materialized shadow previews do not show readiness drift, known blockers, or a clear follow-up step for this checkout context; it does not mean checkout is already cut over.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
      "Shadow-only cutover readiness preview indicates that the current checkout contour looks internally aligned for a future Delivery Hub cutover.",
    ],
  })

  const attentionPreview = buildDeliveryHubShadowCutoverSummaryPreviewModel({
    shadow_orchestration_recommendation_preview: {
      tone: "warning",
      recommendation_status: "unavailable",
      status_label: "Shadow recommendation preview unavailable",
      recommended_modality_label: null,
      recommended_pickup_point_label: null,
      recommended_pickup_window_label: null,
      recommended_quote_amount: null,
      currency_code: null,
      recommended_quote_eta_label: null,
      readiness_label: "Selection not ready",
      detail_label:
        "needs pickup-point context · degraded · missing neutral selection",
      hint_messages: [
        "Current shadow constellation does not support a shopper-safe recommendation for this cart context, so this block remains informational only.",
      ],
    },
    shadow_cutover_readiness_preview: {
      tone: "warning",
      cutover_readiness_status: "not_ready",
      status_label: "Shadow cutover readiness preview indicates not-ready contour",
      readiness_label: "Selection not ready",
      recommendation_label: "shadow recommendation unavailable",
      modality_label: "Warehouse → pickup point",
      detail_label:
        "verdict degraded · shadow recommendation unavailable · needs pickup-point context · degraded · missing neutral selection",
      hint_messages: [
        "Shadow-only cutover readiness preview currently indicates that the checkout contour is not ready for a future Delivery Hub cutover.",
      ],
    },
    shadow_cutover_blockers_preview: {
      tone: "warning",
      blockers_status: "known_blockers",
      status_label: "Known shadow cutover blockers visible",
      readiness_label: "Selection not ready",
      verdict_label: "shadow verdict degraded",
      recommendation_label: "shadow recommendation unavailable",
      blocker_count_label: "3 known blockers visible",
      blockers: [
        {
          code: "needs_pickup_point",
          label: "Neutral pickup-point context is still missing",
          detail_label: "Pickup point is required",
        },
      ],
      hint_messages: [
        "Read-only shadow cutover blockers preview only. Known blocker points below are derived from existing shadow previews for the current checkout context and do not change shopper state.",
      ],
    },
    shadow_cutover_next_steps_preview: {
      tone: "warning",
      next_steps_status: "known_next_steps",
      status_label: "Known shadow cutover next steps visible",
      readiness_label: "Selection not ready",
      blocker_status_label: "blockers known blockers",
      recommendation_label: "shadow recommendation unavailable",
      next_step_count_label: "3 next steps visible",
      next_steps: [
        {
          code: "observe_shadow_pickup_point_context",
          label:
            "Wait for comparable shadow pickup-point context before planning any future cutover step",
          detail_label: "Pickup point is required",
        },
      ],
      hint_messages: [
        "Read-only shadow cutover next-steps preview only. Suggested next steps below simply restate issues already visible in existing shadow previews for the current checkout context.",
      ],
    },
  })

  assert.deepEqual(attentionPreview, {
    tone: "warning",
    summary_status: "attention_required",
    status_label: "Shadow cutover summary preview shows attention points",
    readiness_label: "Selection not ready",
    modality_label: "Warehouse → pickup point",
    recommendation_label: "shadow recommendation unavailable",
    blocker_count_label: "3 known blockers visible",
    next_step_count_label: "3 next steps visible",
    detail_label: "readiness not ready · blockers known blockers · next steps known next steps",
    headline_messages: [
      "Readiness preview still shows a not-ready shadow contour.",
      "3 known blockers visible",
      "3 next steps visible",
    ],
    hint_messages: [
      "Read-only shadow cutover summary preview only. This compact block highlights attention points already visible across existing shadow readiness, blockers, and next-step previews.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
      "This summary does not claim that Delivery Hub checkout cutover has started; it only restates currently visible shadow signals for future planning.",
      "Shadow-only cutover readiness preview currently indicates that the checkout contour is not ready for a future Delivery Hub cutover.",
    ],
  })

  const insufficientPreview = buildDeliveryHubShadowCutoverSummaryPreviewModel({
    shadow_orchestration_recommendation_preview: {
      tone: "neutral",
      recommendation_status: "insufficient_data",
      status_label: "Shadow recommendation preview needs more context",
      recommended_modality_label: null,
      recommended_pickup_point_label: null,
      recommended_pickup_window_label: null,
      recommended_quote_amount: null,
      currency_code: null,
      recommended_quote_eta_label: null,
      readiness_label: "Selection missing",
      detail_label: "incomplete · not applicable · missing legacy method",
      hint_messages: [
        "Current shadow constellation is still informational only and does not yet have enough shopper-safe context to describe a recommendation.",
      ],
    },
    shadow_cutover_readiness_preview: {
      tone: "neutral",
      cutover_readiness_status: "insufficient_data",
      status_label: "Shadow cutover readiness preview needs more context",
      readiness_label: "Selection missing",
      recommendation_label: "shadow recommendation insufficient data",
      modality_label: null,
      detail_label:
        "verdict insufficient data · shadow recommendation insufficient data · incomplete · not applicable · missing legacy method",
      hint_messages: [
        "Shadow-only cutover readiness preview does not yet have enough comparable context to claim future cutover readiness for this checkout.",
      ],
    },
    shadow_cutover_blockers_preview: {
      tone: "neutral",
      blockers_status: "insufficient_data",
      status_label: "Shadow cutover blockers preview needs more context",
      readiness_label: "Selection missing",
      verdict_label: "shadow verdict insufficient data",
      recommendation_label: "shadow recommendation insufficient data",
      blocker_count_label: null,
      blockers: [],
      hint_messages: [
        "Read-only shadow cutover blockers preview does not yet have enough comparable context to list blocker points for the current checkout.",
      ],
    },
    shadow_cutover_next_steps_preview: {
      tone: "neutral",
      next_steps_status: "insufficient_data",
      status_label: "Shadow cutover next-steps preview needs more context",
      readiness_label: "Selection missing",
      blocker_status_label: "blockers insufficient data",
      recommendation_label: "shadow recommendation insufficient data",
      next_step_count_label: null,
      next_steps: [],
      hint_messages: [
        "Read-only shadow cutover next-steps preview does not yet have enough comparable context to suggest meaningful next steps for the current checkout.",
      ],
    },
  })

  assert.deepEqual(insufficientPreview, {
    tone: "neutral",
    summary_status: "insufficient_data",
    status_label: "Shadow cutover summary preview needs more context",
    readiness_label: "Selection missing",
    modality_label: null,
    recommendation_label: "shadow recommendation insufficient data",
    blocker_count_label: null,
    next_step_count_label: null,
    detail_label:
      "readiness insufficient data · blockers insufficient data · next steps insufficient data",
    headline_messages: [
      "Readiness preview still needs more comparable shadow context.",
      "Blocker visibility still needs more comparable shadow context.",
      "Next-step visibility still needs more comparable shadow context.",
    ],
    hint_messages: [
      "Read-only shadow cutover summary preview does not yet have enough comparable context to describe a future cutover summary for this checkout.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
      "Shadow-only cutover readiness preview does not yet have enough comparable context to claim future cutover readiness for this checkout.",
      "Read-only shadow cutover blockers preview does not yet have enough comparable context to list blocker points for the current checkout.",
    ],
  })
})

test("buildDeliveryHubShadowCutoverEvidencePreviewModel compacts supporting cutover signals when evidence is available", () => {
  const preview = buildDeliveryHubShadowCutoverEvidencePreviewModel({
    shadow_orchestration_recommendation_preview: {
      tone: "positive",
      recommendation_status: "recommended",
      status_label: "Shadow recommendation preview available",
      recommended_modality_label: "Warehouse → pickup point",
      recommended_pickup_point_label: "Pickup point A",
      recommended_pickup_window_label: null,
      recommended_quote_amount: 499,
      currency_code: "RUB",
      recommended_quote_eta_label: "ETA 1–2 days",
      readiness_label: "Selection ready",
      detail_label: "action-ready · aligned · aligned",
      hint_messages: [
        "Read-only shadow recommendation only. Current checkout keeps the committed legacy shipping flow and does not switch shipping method or save any neutral selection from this preview.",
      ],
    },
    shadow_cutover_readiness_preview: {
      tone: "positive",
      cutover_readiness_status: "ready",
      status_label: "Shadow cutover readiness preview indicates ready contour",
      readiness_label: "Selection ready",
      recommendation_label: "shadow recommendation recommended",
      modality_label: "Warehouse → pickup point",
      detail_label:
        "verdict aligned · shadow recommendation recommended · action-ready · aligned · aligned",
      hint_messages: [
        "Shadow-only cutover readiness preview indicates that the current checkout contour looks internally aligned for a future Delivery Hub cutover.",
      ],
    },
    shadow_cutover_blockers_preview: {
      tone: "neutral",
      blockers_status: "no_known_blockers",
      status_label: "No known shadow cutover blockers visible",
      readiness_label: "Selection ready",
      verdict_label: "shadow verdict aligned",
      recommendation_label: "shadow recommendation recommended",
      blocker_count_label: null,
      blockers: [],
      hint_messages: [
        "Read-only shadow cutover blockers preview only. No known blocker points are currently visible in existing shadow previews for this checkout context.",
      ],
    },
    shadow_cutover_next_steps_preview: {
      tone: "neutral",
      next_steps_status: "no_clear_next_steps",
      status_label: "No clear shadow cutover next steps visible",
      readiness_label: "Selection ready",
      blocker_status_label: "blockers no known blockers",
      recommendation_label: "shadow recommendation recommended",
      next_step_count_label: null,
      next_steps: [],
      hint_messages: [
        "Read-only shadow cutover next-steps preview only. Existing shadow previews do not currently point to a single clear next step for this checkout context.",
      ],
    },
    shadow_cutover_summary_preview: {
      tone: "positive",
      summary_status: "ready_shadow_contour",
      status_label: "Shadow cutover summary preview indicates aligned shadow contour",
      readiness_label: "Selection ready",
      modality_label: "Warehouse → pickup point",
      recommendation_label: "shadow recommendation recommended",
      blocker_count_label: null,
      next_step_count_label: null,
      detail_label:
        "readiness ready · blockers no known blockers · next steps no clear next steps",
      headline_messages: [
        "Readiness preview currently shows an aligned shadow contour.",
        "No known shadow blockers are currently visible.",
        "No clear shadow next step is currently visible.",
      ],
      hint_messages: [
        "Read-only shadow cutover summary preview only. This compact block aggregates already visible shadow readiness, blockers, and next-step previews for future Delivery Hub cutover planning only.",
      ],
    },
  })

  assert.deepEqual(preview, {
    tone: "positive",
    evidence_status: "evidence_available",
    status_label: "Shadow cutover evidence preview compacts current supporting signals",
    readiness_label: "Selection ready",
    summary_label: "Shadow cutover summary preview indicates aligned shadow contour",
    recommendation_label: "shadow recommendation recommended",
    evidence_count_label: "5 supporting signals visible",
    detail_label:
      "summary ready shadow contour · readiness ready · blockers no known blockers · next steps no clear next steps",
    evidence_items: [
      {
        code: "summary_signal",
        label: "Shadow summary currently shows an aligned contour",
        detail_label: "Readiness preview currently shows an aligned shadow contour.",
      },
      {
        code: "readiness_signal",
        label: "Readiness preview shows a ready shadow contour",
        detail_label:
          "verdict aligned · shadow recommendation recommended · action-ready · aligned · aligned",
      },
      {
        code: "blocker_signal",
        label: "No known shadow blockers are visible",
        detail_label: "shadow verdict aligned · shadow recommendation recommended",
      },
      {
        code: "next_step_signal",
        label: "No clear shadow next step is visible",
        detail_label: "blockers no known blockers · shadow recommendation recommended",
      },
      {
        code: "recommendation_signal",
        label: "Shadow recommendation preview is available",
        detail_label: "action-ready · aligned · aligned",
      },
    ],
    hint_messages: [
      "Read-only shadow cutover evidence preview only. This compact block aggregates already visible shadow cutover summary, readiness, blockers, next-step, and recommendation previews as supporting evidence for the current shadow picture only.",
      "Supporting signals currently reinforce an aligned shadow cutover picture, but this still does not mean checkout is already cut over.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
      "Read-only shadow cutover summary preview only. This compact block aggregates already visible shadow readiness, blockers, and next-step previews for future Delivery Hub cutover planning only.",
    ],
  })
})

test("buildDeliveryHubShadowCutoverEvidencePreviewModel stays neutral when supporting cutover evidence is still insufficient", () => {
  const preview = buildDeliveryHubShadowCutoverEvidencePreviewModel({
    shadow_orchestration_recommendation_preview: {
      tone: "neutral",
      recommendation_status: "insufficient_data",
      status_label: "Shadow recommendation preview needs more context",
      recommended_modality_label: null,
      recommended_pickup_point_label: null,
      recommended_pickup_window_label: null,
      recommended_quote_amount: null,
      currency_code: null,
      recommended_quote_eta_label: null,
      readiness_label: "Selection missing",
      detail_label: "incomplete · not applicable · missing legacy method",
      hint_messages: [
        "Current shadow constellation is still informational only and does not yet have enough shopper-safe context to describe a recommendation.",
      ],
    },
    shadow_cutover_readiness_preview: {
      tone: "neutral",
      cutover_readiness_status: "insufficient_data",
      status_label: "Shadow cutover readiness preview needs more context",
      readiness_label: "Selection missing",
      recommendation_label: "shadow recommendation insufficient data",
      modality_label: null,
      detail_label:
        "verdict insufficient data · shadow recommendation insufficient data · incomplete · not applicable · missing legacy method",
      hint_messages: [
        "Shadow-only cutover readiness preview does not yet have enough comparable context to claim future cutover readiness for this checkout.",
      ],
    },
    shadow_cutover_blockers_preview: {
      tone: "neutral",
      blockers_status: "insufficient_data",
      status_label: "Shadow cutover blockers preview needs more context",
      readiness_label: "Selection missing",
      verdict_label: "shadow verdict insufficient data",
      recommendation_label: "shadow recommendation insufficient data",
      blocker_count_label: null,
      blockers: [],
      hint_messages: [
        "Read-only shadow cutover blockers preview does not yet have enough comparable context to list blocker points for the current checkout.",
      ],
    },
    shadow_cutover_next_steps_preview: {
      tone: "neutral",
      next_steps_status: "insufficient_data",
      status_label: "Shadow cutover next-steps preview needs more context",
      readiness_label: "Selection missing",
      blocker_status_label: "blockers insufficient data",
      recommendation_label: "shadow recommendation insufficient data",
      next_step_count_label: null,
      next_steps: [],
      hint_messages: [
        "Read-only shadow cutover next-steps preview does not yet have enough comparable context to suggest meaningful next steps for the current checkout.",
      ],
    },
    shadow_cutover_summary_preview: {
      tone: "neutral",
      summary_status: "insufficient_data",
      status_label: "Shadow cutover summary preview needs more context",
      readiness_label: "Selection missing",
      modality_label: null,
      recommendation_label: "shadow recommendation insufficient data",
      blocker_count_label: null,
      next_step_count_label: null,
      detail_label:
        "readiness insufficient data · blockers insufficient data · next steps insufficient data",
      headline_messages: [
        "Readiness preview still needs more comparable shadow context.",
        "Blocker visibility still needs more comparable shadow context.",
        "Next-step visibility still needs more comparable shadow context.",
      ],
      hint_messages: [
        "Read-only shadow cutover summary preview does not yet have enough comparable context to describe a future cutover summary for this checkout.",
      ],
    },
  })

  assert.deepEqual(preview, {
    tone: "neutral",
    evidence_status: "insufficient_data",
    status_label: "Shadow cutover evidence preview needs more context",
    readiness_label: "Selection missing",
    summary_label: "Shadow cutover summary preview needs more context",
    recommendation_label: "shadow recommendation insufficient data",
    evidence_count_label: null,
    detail_label:
      "summary insufficient data · readiness insufficient data · blockers insufficient data · next steps insufficient data",
    evidence_items: [],
    hint_messages: [
      "Read-only shadow cutover evidence preview does not yet have enough comparable context to compact supporting signals for the current checkout.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
      "Read-only shadow cutover summary preview does not yet have enough comparable context to describe a future cutover summary for this checkout.",
      "Shadow-only cutover readiness preview does not yet have enough comparable context to claim future cutover readiness for this checkout.",
    ],
  })
})

test("buildDeliveryHubShadowCutoverRolloutPreviewModel stays observe-only when aligned shadow signals are available without claiming cutover", () => {
  const preview = buildDeliveryHubShadowCutoverRolloutPreviewModel({
    shadow_orchestration_recommendation_preview: {
      tone: "positive",
      recommendation_status: "recommended",
      status_label: "Shadow recommendation preview available",
      recommended_modality_label: "Warehouse → pickup point",
      recommended_pickup_point_label: "Pickup point A",
      recommended_pickup_window_label: null,
      recommended_quote_amount: 499,
      currency_code: "RUB",
      recommended_quote_eta_label: "ETA 1–2 days",
      readiness_label: "Selection ready",
      detail_label: "action-ready · aligned · aligned",
      hint_messages: [
        "Read-only shadow recommendation only. Current checkout keeps the committed legacy shipping flow and does not switch shipping method or save any neutral selection from this preview.",
      ],
    },
    shadow_cutover_readiness_preview: {
      tone: "positive",
      cutover_readiness_status: "ready",
      status_label: "Shadow cutover readiness preview indicates ready contour",
      readiness_label: "Selection ready",
      recommendation_label: "shadow recommendation recommended",
      modality_label: "Warehouse → pickup point",
      detail_label:
        "verdict aligned · shadow recommendation recommended · action-ready · aligned · aligned",
      hint_messages: [
        "Shadow-only cutover readiness preview indicates that the current checkout contour looks internally aligned for a future Delivery Hub cutover.",
      ],
    },
    shadow_cutover_blockers_preview: {
      tone: "neutral",
      blockers_status: "no_known_blockers",
      status_label: "No known shadow cutover blockers visible",
      readiness_label: "Selection ready",
      verdict_label: "shadow verdict aligned",
      recommendation_label: "shadow recommendation recommended",
      blocker_count_label: null,
      blockers: [],
      hint_messages: [
        "Read-only shadow cutover blockers preview only. No known blocker points are currently visible in existing shadow previews for this checkout context.",
      ],
    },
    shadow_cutover_next_steps_preview: {
      tone: "neutral",
      next_steps_status: "no_clear_next_steps",
      status_label: "No clear shadow cutover next steps visible",
      readiness_label: "Selection ready",
      blocker_status_label: "blockers no known blockers",
      recommendation_label: "shadow recommendation recommended",
      next_step_count_label: null,
      next_steps: [],
      hint_messages: [
        "Read-only shadow cutover next-steps preview only. Existing shadow previews do not currently point to a single clear next step for this checkout context.",
      ],
    },
    shadow_cutover_summary_preview: {
      tone: "positive",
      summary_status: "ready_shadow_contour",
      status_label: "Shadow cutover summary preview indicates aligned shadow contour",
      readiness_label: "Selection ready",
      modality_label: "Warehouse → pickup point",
      recommendation_label: "shadow recommendation recommended",
      blocker_count_label: null,
      next_step_count_label: null,
      detail_label:
        "readiness ready · blockers no known blockers · next steps no clear next steps",
      headline_messages: [
        "Readiness preview currently shows an aligned shadow contour.",
        "No known shadow blockers are currently visible.",
        "No clear shadow next step is currently visible.",
      ],
      hint_messages: [
        "Read-only shadow cutover summary preview only. This compact block aggregates already visible shadow readiness, blockers, and next-step previews for future Delivery Hub cutover planning only.",
      ],
    },
    shadow_cutover_evidence_preview: {
      tone: "positive",
      evidence_status: "evidence_available",
      status_label: "Shadow cutover evidence preview compacts current supporting signals",
      readiness_label: "Selection ready",
      summary_label: "Shadow cutover summary preview indicates aligned shadow contour",
      recommendation_label: "shadow recommendation recommended",
      evidence_count_label: "5 supporting signals visible",
      detail_label:
        "summary ready shadow contour · readiness ready · blockers no known blockers · next steps no clear next steps",
      evidence_items: [
        {
          code: "summary_signal",
          label: "Shadow summary currently shows an aligned contour",
          detail_label: "Readiness preview currently shows an aligned shadow contour.",
        },
      ],
      hint_messages: [
        "Read-only shadow cutover evidence preview only. This compact block aggregates already visible shadow cutover summary, readiness, blockers, next-step, and recommendation previews as supporting evidence for the current shadow picture only.",
      ],
    },
  })

  assert.deepEqual(preview, {
    tone: "neutral",
    rollout_status: "observe_only",
    status_label: "Shadow cutover rollout preview remains observe-only",
    readiness_label: "Selection ready",
    summary_label: "Shadow cutover summary preview indicates aligned shadow contour",
    evidence_label: "Shadow cutover evidence preview compacts current supporting signals",
    recommendation_label: "shadow recommendation recommended",
    rollout_reason_label: "5 supporting signals visible",
    detail_label:
      "summary ready shadow contour · evidence evidence available · readiness ready · blockers no known blockers · next steps no clear next steps · recommendation recommended",
    headline_messages: [
      "Current shadow signals can be observed as a compact rollout picture only.",
      "Readiness preview currently shows an aligned shadow contour.",
      "5 supporting signals visible",
    ],
    hint_messages: [
      "Read-only shadow cutover rollout preview only. Even when the current shadow contour looks aligned, this block remains observational and does not indicate that checkout cutover has occurred.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
      "This observe-only result simply compacts already visible shadow rollout signals for future planning and does not start rollout in checkout.",
      "Read-only shadow cutover summary preview only. This compact block aggregates already visible shadow readiness, blockers, and next-step previews for future Delivery Hub cutover planning only.",
    ],
  })
})

test("buildDeliveryHubShadowCutoverRolloutPreviewModel marks rollout as not advised when blockers or not-ready signals remain visible", () => {
  const preview = buildDeliveryHubShadowCutoverRolloutPreviewModel({
    shadow_orchestration_recommendation_preview: {
      tone: "warning",
      recommendation_status: "unavailable",
      status_label: "Shadow recommendation preview unavailable",
      recommended_modality_label: null,
      recommended_pickup_point_label: null,
      recommended_pickup_window_label: null,
      recommended_quote_amount: null,
      currency_code: null,
      recommended_quote_eta_label: null,
      readiness_label: "Selection not ready",
      detail_label: "blocked-by-readiness · divergent · modality mismatch",
      hint_messages: [
        "Current shadow constellation still indicates drift or blockers, so any recommendation remains unavailable.",
      ],
    },
    shadow_cutover_readiness_preview: {
      tone: "warning",
      cutover_readiness_status: "not_ready",
      status_label: "Shadow cutover readiness preview indicates not-ready contour",
      readiness_label: "Selection not ready",
      recommendation_label: "shadow recommendation unavailable",
      modality_label: "Warehouse → pickup point",
      detail_label:
        "verdict degraded · shadow recommendation unavailable · blocked-by-readiness · divergent · modality mismatch",
      hint_messages: [
        "Shadow-only cutover readiness preview currently indicates that the checkout contour is not ready for a future Delivery Hub cutover.",
      ],
    },
    shadow_cutover_blockers_preview: {
      tone: "warning",
      blockers_status: "known_blockers",
      status_label: "Known shadow cutover blockers visible",
      readiness_label: "Selection not ready",
      verdict_label: "shadow verdict degraded",
      recommendation_label: "shadow recommendation unavailable",
      blocker_count_label: "2 known blockers visible",
      blockers: [
        {
          code: "blocked_by_readiness",
          label: "Readiness or settings still block the neutral path",
          detail_label: "Readiness issues remain visible",
        },
        {
          code: "selection_modality_mismatch",
          label: "Legacy and neutral delivery modalities differ",
          detail_label: "Legacy courier vs neutral pickup",
        },
      ],
      hint_messages: [
        "Read-only shadow cutover blockers preview only. Known blocker points below are derived from existing shadow previews for the current checkout context and do not change shopper state.",
      ],
    },
    shadow_cutover_next_steps_preview: {
      tone: "warning",
      next_steps_status: "known_next_steps",
      status_label: "Known shadow cutover next steps visible",
      readiness_label: "Selection not ready",
      blocker_status_label: "blockers known blockers",
      recommendation_label: "shadow recommendation unavailable",
      next_step_count_label: "2 next steps visible",
      next_steps: [
        {
          code: "review_readiness_constraints",
          label: "Review the readiness or settings constraints already visible in shadow previews",
          detail_label: "Readiness issues remain visible",
        },
      ],
      hint_messages: [
        "Read-only shadow cutover next-steps preview only. Suggested next steps below simply restate issues already visible in existing shadow previews for the current checkout context.",
      ],
    },
    shadow_cutover_summary_preview: {
      tone: "warning",
      summary_status: "attention_required",
      status_label: "Shadow cutover summary preview shows attention points",
      readiness_label: "Selection not ready",
      modality_label: "Warehouse → pickup point",
      recommendation_label: "shadow recommendation unavailable",
      blocker_count_label: "2 known blockers visible",
      next_step_count_label: "2 next steps visible",
      detail_label:
        "readiness not ready · blockers known blockers · next steps known next steps",
      headline_messages: [
        "Readiness preview still shows a not-ready shadow contour.",
        "2 known blockers visible",
        "2 next steps visible",
      ],
      hint_messages: [
        "Read-only shadow cutover summary preview only. This compact block highlights attention points already visible across existing shadow readiness, blockers, and next-step previews.",
      ],
    },
    shadow_cutover_evidence_preview: {
      tone: "warning",
      evidence_status: "evidence_available",
      status_label: "Shadow cutover evidence preview compacts current supporting signals",
      readiness_label: "Selection not ready",
      summary_label: "Shadow cutover summary preview shows attention points",
      recommendation_label: "shadow recommendation unavailable",
      evidence_count_label: "5 supporting signals visible",
      detail_label:
        "summary attention required · readiness not ready · blockers known blockers · next steps known next steps",
      evidence_items: [
        {
          code: "summary_signal",
          label: "Shadow summary currently highlights attention points",
          detail_label: "Readiness preview still shows a not-ready shadow contour.",
        },
      ],
      hint_messages: [
        "Read-only shadow cutover evidence preview only. This compact block aggregates already visible shadow cutover summary, readiness, blockers, next-step, and recommendation previews as supporting evidence for the current shadow picture only.",
      ],
    },
  })

  assert.deepEqual(preview, {
    tone: "warning",
    rollout_status: "not_advised",
    status_label: "Shadow cutover rollout preview does not advise rollout",
    readiness_label: "Selection not ready",
    summary_label: "Shadow cutover summary preview shows attention points",
    evidence_label: "Shadow cutover evidence preview compacts current supporting signals",
    recommendation_label: "shadow recommendation unavailable",
    rollout_reason_label: "2 known blockers visible",
    detail_label:
      "summary attention required · evidence evidence available · readiness not ready · blockers known blockers · next steps known next steps · recommendation unavailable",
    headline_messages: [
      "Current shadow signals still point to an observe-only and not-advised rollout picture.",
      "2 known blockers visible",
      "Readiness preview still shows a not-ready shadow contour.",
    ],
    hint_messages: [
      "Read-only shadow cutover rollout preview only. Current shadow signals suggest that rollout should remain observational and should not be treated as an active checkout cutover.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
      "This preview does not change shipping method selection or claim that the shopper path has moved away from legacy ApiShip.",
      "Read-only shadow cutover summary preview only. This compact block highlights attention points already visible across existing shadow readiness, blockers, and next-step previews.",
    ],
  })
})

test("buildDeliveryHubShadowCutoverRolloutPreviewModel stays neutral when rollout context is still insufficient", () => {
  const preview = buildDeliveryHubShadowCutoverRolloutPreviewModel({
    shadow_orchestration_recommendation_preview: {
      tone: "neutral",
      recommendation_status: "insufficient_data",
      status_label: "Shadow recommendation preview needs more context",
      recommended_modality_label: null,
      recommended_pickup_point_label: null,
      recommended_pickup_window_label: null,
      recommended_quote_amount: null,
      currency_code: null,
      recommended_quote_eta_label: null,
      readiness_label: "Selection missing",
      detail_label: "incomplete · not applicable · missing legacy method",
      hint_messages: [
        "Current shadow constellation is still informational only and does not yet have enough shopper-safe context to describe a recommendation.",
      ],
    },
    shadow_cutover_readiness_preview: {
      tone: "neutral",
      cutover_readiness_status: "insufficient_data",
      status_label: "Shadow cutover readiness preview needs more context",
      readiness_label: "Selection missing",
      recommendation_label: "shadow recommendation insufficient data",
      modality_label: null,
      detail_label:
        "verdict insufficient data · shadow recommendation insufficient data · incomplete · not applicable · missing legacy method",
      hint_messages: [
        "Shadow-only cutover readiness preview does not yet have enough comparable context to claim future cutover readiness for this checkout.",
      ],
    },
    shadow_cutover_blockers_preview: {
      tone: "neutral",
      blockers_status: "insufficient_data",
      status_label: "Shadow cutover blockers preview needs more context",
      readiness_label: "Selection missing",
      verdict_label: "shadow verdict insufficient data",
      recommendation_label: "shadow recommendation insufficient data",
      blocker_count_label: null,
      blockers: [],
      hint_messages: [
        "Read-only shadow cutover blockers preview does not yet have enough comparable context to list blocker points for the current checkout.",
      ],
    },
    shadow_cutover_next_steps_preview: {
      tone: "neutral",
      next_steps_status: "insufficient_data",
      status_label: "Shadow cutover next-steps preview needs more context",
      readiness_label: "Selection missing",
      blocker_status_label: "blockers insufficient data",
      recommendation_label: "shadow recommendation insufficient data",
      next_step_count_label: null,
      next_steps: [],
      hint_messages: [
        "Read-only shadow cutover next-steps preview does not yet have enough comparable context to suggest meaningful next steps for the current checkout.",
      ],
    },
    shadow_cutover_summary_preview: {
      tone: "neutral",
      summary_status: "insufficient_data",
      status_label: "Shadow cutover summary preview needs more context",
      readiness_label: "Selection missing",
      modality_label: null,
      recommendation_label: "shadow recommendation insufficient data",
      blocker_count_label: null,
      next_step_count_label: null,
      detail_label:
        "readiness insufficient data · blockers insufficient data · next steps insufficient data",
      headline_messages: [
        "Readiness preview still needs more comparable shadow context.",
        "Blocker visibility still needs more comparable shadow context.",
        "Next-step visibility still needs more comparable shadow context.",
      ],
      hint_messages: [
        "Read-only shadow cutover summary preview does not yet have enough comparable context to describe a future cutover summary for this checkout.",
      ],
    },
    shadow_cutover_evidence_preview: {
      tone: "neutral",
      evidence_status: "insufficient_data",
      status_label: "Shadow cutover evidence preview needs more context",
      readiness_label: "Selection missing",
      summary_label: "Shadow cutover summary preview needs more context",
      recommendation_label: "shadow recommendation insufficient data",
      evidence_count_label: null,
      detail_label:
        "summary insufficient data · readiness insufficient data · blockers insufficient data · next steps insufficient data",
      evidence_items: [],
      hint_messages: [
        "Read-only shadow cutover evidence preview does not yet have enough comparable context to compact supporting signals for the current checkout.",
      ],
    },
  })

  assert.deepEqual(preview, {
    tone: "neutral",
    rollout_status: "insufficient_data",
    status_label: "Shadow cutover rollout preview needs more context",
    readiness_label: "Selection missing",
    summary_label: "Shadow cutover summary preview needs more context",
    evidence_label: "Shadow cutover evidence preview needs more context",
    recommendation_label: "shadow recommendation insufficient data",
    rollout_reason_label: "Comparable shadow rollout context is still incomplete",
    detail_label:
      "summary insufficient data · evidence insufficient data · readiness insufficient data · blockers insufficient data · next steps insufficient data · recommendation insufficient data",
    headline_messages: [
      "Rollout remains preview-only because the current shadow cutover picture still lacks enough comparable context.",
      "Readiness preview still needs more comparable shadow context.",
    ],
    hint_messages: [
      "Read-only shadow cutover rollout preview only. This compact block aggregates already materialized summary, evidence, readiness, blockers, next-step, and recommendation previews into a rollout-oriented picture for observation only.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
      "This preview does not claim that checkout cutover has started or that rollout is already underway.",
      "Read-only shadow cutover summary preview does not yet have enough comparable context to describe a future cutover summary for this checkout.",
    ],
  })
})

test("buildDeliveryHubShadowCutoverGatePreviewModel reports aligned, blocked, and insufficient gate pictures truthfully", () => {
  const alignedPreview = buildDeliveryHubShadowCutoverGatePreviewModel({
    shadow_shipping_option_parity_preview: {
      tone: "positive",
      parity_state: "aligned",
      status_label: "Sampled shadow parity aligns",
      legacy_method_label: "Pickup delivery",
      shadow_modality_label: "Warehouse → pickup point",
      detail_label: "2 sampled quotes · 3 destination-compatible pickup points",
      hint_messages: [
        "Legacy checkout currently has a committed pickup-point method, and the sampled neutral shadow context also returns pickup-point availability plus sampled quotes for the same checkout context.",
      ],
    },
    shadow_selection_parity_preview: {
      tone: "positive",
      parity_status: "aligned",
      status_label: "Committed legacy selection aligns with neutral selection preview",
      legacy_method_label: "Pickup delivery",
      legacy_modality_label: "Pickup point",
      neutral_modality_label: "Pickup point",
      legacy_reference_label: "Pickup point A",
      neutral_reference_label: "Pickup point A",
      readiness_label: "Selection ready",
      hint_messages: [
        "Committed legacy shipping context and persisted neutral selection currently align on shopper-visible modality and pickup reference.",
      ],
    },
    shadow_orchestration_recommendation_preview: {
      tone: "positive",
      recommendation_status: "recommended",
      status_label: "Shadow recommendation preview available",
      recommended_modality_label: "Warehouse → pickup point",
      recommended_pickup_point_label: "Pickup point A",
      recommended_pickup_window_label: null,
      recommended_quote_amount: 499,
      currency_code: "RUB",
      recommended_quote_eta_label: "ETA 1–2 days",
      readiness_label: "Selection ready",
      detail_label: "action-ready · aligned · aligned",
      hint_messages: [
        "Read-only shadow recommendation only. Current checkout keeps the committed legacy shipping flow and does not switch shipping method or save any neutral selection from this preview.",
      ],
    },
    shadow_cutover_readiness_preview: {
      tone: "positive",
      cutover_readiness_status: "ready",
      status_label: "Shadow cutover readiness preview indicates ready contour",
      readiness_label: "Selection ready",
      recommendation_label: "shadow recommendation recommended",
      modality_label: "Warehouse → pickup point",
      detail_label:
        "verdict aligned · shadow recommendation recommended · action-ready · aligned · aligned",
      hint_messages: [
        "Shadow-only cutover readiness preview indicates that the current checkout contour looks internally aligned for a future Delivery Hub cutover.",
      ],
    },
    shadow_cutover_blockers_preview: {
      tone: "neutral",
      blockers_status: "no_known_blockers",
      status_label: "No known shadow cutover blockers visible",
      readiness_label: "Selection ready",
      verdict_label: "shadow verdict aligned",
      recommendation_label: "shadow recommendation recommended",
      blocker_count_label: null,
      blockers: [],
      hint_messages: [
        "Read-only shadow cutover blockers preview only. No known blocker points are currently visible in existing shadow previews for this checkout context.",
      ],
    },
    shadow_cutover_summary_preview: {
      tone: "positive",
      summary_status: "ready_shadow_contour",
      status_label: "Shadow cutover summary preview indicates aligned shadow contour",
      readiness_label: "Selection ready",
      modality_label: "Warehouse → pickup point",
      recommendation_label: "shadow recommendation recommended",
      blocker_count_label: null,
      next_step_count_label: null,
      detail_label:
        "readiness ready · blockers no known blockers · next steps no clear next steps",
      headline_messages: [
        "Readiness preview currently shows an aligned shadow contour.",
        "No known shadow blockers are currently visible.",
        "No clear shadow next step is currently visible.",
      ],
      hint_messages: [
        "Read-only shadow cutover summary preview only. This compact block aggregates already visible shadow readiness, blockers, and next-step previews for future Delivery Hub cutover planning only.",
      ],
    },
    shadow_cutover_evidence_preview: {
      tone: "positive",
      evidence_status: "evidence_available",
      status_label: "Shadow cutover evidence preview compacts current supporting signals",
      readiness_label: "Selection ready",
      summary_label: "Shadow cutover summary preview indicates aligned shadow contour",
      recommendation_label: "shadow recommendation recommended",
      evidence_count_label: "5 supporting signals visible",
      detail_label:
        "summary ready shadow contour · readiness ready · blockers no known blockers · next steps no clear next steps",
      evidence_items: [
        {
          code: "summary_signal",
          label: "Shadow summary currently shows an aligned contour",
          detail_label: "Readiness preview currently shows an aligned shadow contour.",
        },
      ],
      hint_messages: [
        "Read-only shadow cutover evidence preview only. This compact block aggregates already visible shadow cutover summary, readiness, blockers, next-step, and recommendation previews as supporting evidence for the current shadow picture only.",
      ],
    },
    shadow_cutover_rollout_preview: {
      tone: "neutral",
      rollout_status: "observe_only",
      status_label: "Shadow cutover rollout preview remains observe-only",
      readiness_label: "Selection ready",
      summary_label: "Shadow cutover summary preview indicates aligned shadow contour",
      evidence_label: "Shadow cutover evidence preview compacts current supporting signals",
      recommendation_label: "shadow recommendation recommended",
      rollout_reason_label: "5 supporting signals visible",
      detail_label:
        "summary ready shadow contour · evidence evidence available · readiness ready · blockers no known blockers · next steps no clear next steps · recommendation recommended",
      headline_messages: [
        "Current shadow signals can be observed as a compact rollout picture only.",
        "Readiness preview currently shows an aligned shadow contour.",
        "5 supporting signals visible",
      ],
      hint_messages: [
        "Read-only shadow cutover rollout preview only. Even when the current shadow contour looks aligned, this block remains observational and does not indicate that checkout cutover has occurred.",
      ],
    },
  })

  assert.deepEqual(alignedPreview, {
    tone: "positive",
    gate_preview_status: "aligned",
    status_label: "Shadow cutover gate preview shows aligned gates only",
    readiness_label: "Selection ready",
    summary_label: "Shadow cutover summary preview indicates aligned shadow contour",
    rollout_label: "Shadow cutover rollout preview remains observe-only",
    aligned_gate_count_label: "7 aligned gates visible",
    blocked_gate_count_label: null,
    insufficient_gate_count_label: null,
    gate_items: [
      {
        code: "shipping_option_parity",
        gate_status: "aligned",
        label: "Shipping-option parity looks aligned",
        detail_label: "2 sampled quotes · 3 destination-compatible pickup points",
      },
      {
        code: "selection_parity",
        gate_status: "aligned",
        label: "Selection parity looks aligned",
        detail_label: "Committed legacy selection aligns with neutral selection preview",
      },
      {
        code: "readiness_contour",
        gate_status: "aligned",
        label: "Readiness contour looks aligned",
        detail_label:
          "verdict aligned · shadow recommendation recommended · action-ready · aligned · aligned",
      },
      {
        code: "known_blockers",
        gate_status: "aligned",
        label: "No known blockers are currently visible",
        detail_label: "shadow verdict aligned",
      },
      {
        code: "recommendation_signal",
        gate_status: "aligned",
        label: "Recommendation signal is available",
        detail_label: "action-ready · aligned · aligned",
      },
      {
        code: "supporting_evidence",
        gate_status: "aligned",
        label: "Supporting evidence reinforces the aligned shadow picture",
        detail_label: "5 supporting signals visible",
      },
      {
        code: "rollout_picture",
        gate_status: "aligned",
        label: "Rollout picture remains observe-only and internally aligned",
        detail_label: "5 supporting signals visible",
      },
    ],
    headline_messages: [
      "7 aligned gates visible",
      "Readiness preview currently shows an aligned shadow contour.",
      "Current shadow signals can be observed as a compact rollout picture only.",
    ],
    hint_messages: [
      "Read-only shadow cutover gate preview only. Each gate below simply restates already materialized parity, readiness, blocker, recommendation, evidence, and rollout previews for future cutover decision-making only.",
      "Aligned gates here mean that the currently materialized shadow previews look internally consistent for observation; this does not mean checkout is already cut over.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
      "Read-only shadow cutover rollout preview only. Even when the current shadow contour looks aligned, this block remains observational and does not indicate that checkout cutover has occurred.",
    ],
  })

  const blockedPreview = buildDeliveryHubShadowCutoverGatePreviewModel({
    shadow_shipping_option_parity_preview: {
      tone: "warning",
      parity_state: "divergent",
      status_label: "Sampled pickup-point parity diverges",
      legacy_method_label: "Pickup delivery",
      shadow_modality_label: "Warehouse → pickup point",
      detail_label: "0 destination-compatible pickup points",
      hint_messages: [
        "Legacy checkout currently has a committed pickup-point method, but sampled neutral pickup-point availability is not currently returned for the same checkout context.",
      ],
    },
    shadow_selection_parity_preview: {
      tone: "warning",
      parity_status: "missing_neutral_selection",
      status_label: "Neutral persisted selection missing",
      legacy_method_label: "Pickup delivery",
      legacy_modality_label: "Pickup point",
      neutral_modality_label: null,
      legacy_reference_label: "Pickup point B",
      neutral_reference_label: null,
      readiness_label: "Selection not ready",
      hint_messages: [
        "Legacy checkout currently has a committed shipping method, but no neutral persisted selection is stored for this cart.",
      ],
    },
    shadow_orchestration_recommendation_preview: {
      tone: "warning",
      recommendation_status: "unavailable",
      status_label: "Shadow recommendation preview unavailable",
      recommended_modality_label: null,
      recommended_pickup_point_label: null,
      recommended_pickup_window_label: null,
      recommended_quote_amount: null,
      currency_code: null,
      recommended_quote_eta_label: null,
      readiness_label: "Selection not ready",
      detail_label: "needs pickup-point context · degraded · missing neutral selection",
      hint_messages: [
        "Current shadow constellation does not support a shopper-safe recommendation for this cart context, so this block remains informational only.",
      ],
    },
    shadow_cutover_readiness_preview: {
      tone: "warning",
      cutover_readiness_status: "not_ready",
      status_label: "Shadow cutover readiness preview indicates not-ready contour",
      readiness_label: "Selection not ready",
      recommendation_label: "shadow recommendation unavailable",
      modality_label: "Warehouse → pickup point",
      detail_label:
        "verdict degraded · shadow recommendation unavailable · needs pickup-point context · degraded · missing neutral selection",
      hint_messages: [
        "Shadow-only cutover readiness preview currently indicates that the checkout contour is not ready for a future Delivery Hub cutover.",
      ],
    },
    shadow_cutover_blockers_preview: {
      tone: "warning",
      blockers_status: "known_blockers",
      status_label: "Known shadow cutover blockers visible",
      readiness_label: "Selection not ready",
      verdict_label: "shadow verdict degraded",
      recommendation_label: "shadow recommendation unavailable",
      blocker_count_label: "3 known blockers visible",
      blockers: [
        {
          code: "needs_pickup_point",
          label: "Neutral pickup-point context is still missing",
          detail_label: "Pickup point is required",
        },
      ],
      hint_messages: [
        "Read-only shadow cutover blockers preview only. Known blocker points below are derived from existing shadow previews for the current checkout context and do not change shopper state.",
      ],
    },
    shadow_cutover_summary_preview: {
      tone: "warning",
      summary_status: "attention_required",
      status_label: "Shadow cutover summary preview shows attention points",
      readiness_label: "Selection not ready",
      modality_label: "Warehouse → pickup point",
      recommendation_label: "shadow recommendation unavailable",
      blocker_count_label: "3 known blockers visible",
      next_step_count_label: "3 next steps visible",
      detail_label:
        "readiness not ready · blockers known blockers · next steps known next steps",
      headline_messages: [
        "Readiness preview still shows a not-ready shadow contour.",
        "3 known blockers visible",
        "3 next steps visible",
      ],
      hint_messages: [
        "Read-only shadow cutover summary preview only. This compact block highlights attention points already visible across existing shadow readiness, blockers, and next-step previews.",
      ],
    },
    shadow_cutover_evidence_preview: {
      tone: "warning",
      evidence_status: "evidence_available",
      status_label: "Shadow cutover evidence preview compacts current supporting signals",
      readiness_label: "Selection not ready",
      summary_label: "Shadow cutover summary preview shows attention points",
      recommendation_label: "shadow recommendation unavailable",
      evidence_count_label: "5 supporting signals visible",
      detail_label:
        "summary attention required · readiness not ready · blockers known blockers · next steps known next steps",
      evidence_items: [
        {
          code: "summary_signal",
          label: "Shadow summary currently highlights attention points",
          detail_label: "Readiness preview still shows a not-ready shadow contour.",
        },
      ],
      hint_messages: [
        "Read-only shadow cutover evidence preview only. This compact block aggregates already visible shadow cutover summary, readiness, blockers, next-step, and recommendation previews as supporting evidence for the current shadow picture only.",
      ],
    },
    shadow_cutover_rollout_preview: {
      tone: "warning",
      rollout_status: "not_advised",
      status_label: "Shadow cutover rollout preview does not advise rollout",
      readiness_label: "Selection not ready",
      summary_label: "Shadow cutover summary preview shows attention points",
      evidence_label: "Shadow cutover evidence preview compacts current supporting signals",
      recommendation_label: "shadow recommendation unavailable",
      rollout_reason_label: "3 known blockers visible",
      detail_label:
        "summary attention required · evidence evidence available · readiness not ready · blockers known blockers · next steps known next steps · recommendation unavailable",
      headline_messages: [
        "Current shadow signals still point to an observe-only and not-advised rollout picture.",
        "3 known blockers visible",
        "Readiness preview still shows a not-ready shadow contour.",
      ],
      hint_messages: [
        "Read-only shadow cutover rollout preview only. Current shadow signals suggest that rollout should remain observational and should not be treated as an active checkout cutover.",
      ],
    },
  })

  assert.deepEqual(blockedPreview, {
    tone: "warning",
    gate_preview_status: "blocked",
    status_label: "Shadow cutover gate preview shows blocked gates",
    readiness_label: "Selection not ready",
    summary_label: "Shadow cutover summary preview shows attention points",
    rollout_label: "Shadow cutover rollout preview does not advise rollout",
    aligned_gate_count_label: null,
    blocked_gate_count_label: "7 blocked gates visible",
    insufficient_gate_count_label: null,
    gate_items: [
      {
        code: "shipping_option_parity",
        gate_status: "blocked",
        label: "Shipping-option parity still shows drift",
        detail_label:
          "Legacy checkout currently has a committed pickup-point method, but sampled neutral pickup-point availability is not currently returned for the same checkout context.",
      },
      {
        code: "selection_parity",
        gate_status: "blocked",
        label: "Selection parity still shows visible drift",
        detail_label:
          "Legacy checkout currently has a committed shipping method, but no neutral persisted selection is stored for this cart.",
      },
      {
        code: "readiness_contour",
        gate_status: "blocked",
        label: "Readiness contour is still not ready",
        detail_label:
          "Shadow-only cutover readiness preview currently indicates that the checkout contour is not ready for a future Delivery Hub cutover.",
      },
      {
        code: "known_blockers",
        gate_status: "blocked",
        label: "Known blockers are currently visible",
        detail_label: "3 known blockers visible",
      },
      {
        code: "recommendation_signal",
        gate_status: "blocked",
        label: "Recommendation signal is currently unavailable",
        detail_label:
          "Current shadow constellation does not support a shopper-safe recommendation for this cart context, so this block remains informational only.",
      },
      {
        code: "supporting_evidence",
        gate_status: "blocked",
        label: "Supporting evidence still reinforces attention points",
        detail_label: "5 supporting signals visible",
      },
      {
        code: "rollout_picture",
        gate_status: "blocked",
        label: "Rollout picture is currently not advised",
        detail_label: "3 known blockers visible",
      },
    ],
    headline_messages: [
      "7 blocked gates visible",
    ],
    hint_messages: [
      "Read-only shadow cutover gate preview only. Each gate below simply restates already materialized parity, readiness, blocker, recommendation, evidence, and rollout previews for future cutover decision-making only.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
      "Blocked gates below simply highlight attention points already visible in current shadow previews and do not start any checkout cutover.",
      "Read-only shadow cutover rollout preview only. Current shadow signals suggest that rollout should remain observational and should not be treated as an active checkout cutover.",
    ],
  })

  const insufficientPreview = buildDeliveryHubShadowCutoverGatePreviewModel({
    shadow_shipping_option_parity_preview: {
      tone: "neutral",
      parity_state: "not_applicable",
      status_label: "No committed legacy method to compare",
      legacy_method_label: null,
      shadow_modality_label: null,
      detail_label: null,
      hint_messages: [
        "Parity preview activates only when checkout already has a committed legacy shipping method.",
      ],
    },
    shadow_selection_parity_preview: {
      tone: "neutral",
      parity_status: "missing_legacy_method",
      status_label: "No committed legacy method to compare",
      legacy_method_label: null,
      legacy_modality_label: null,
      neutral_modality_label: null,
      legacy_reference_label: null,
      neutral_reference_label: null,
      readiness_label: null,
      hint_messages: [
        "Selection parity preview activates only when checkout already has a committed legacy shipping method.",
      ],
    },
    shadow_orchestration_recommendation_preview: {
      tone: "neutral",
      recommendation_status: "insufficient_data",
      status_label: "Shadow recommendation preview needs more context",
      recommended_modality_label: null,
      recommended_pickup_point_label: null,
      recommended_pickup_window_label: null,
      recommended_quote_amount: null,
      currency_code: null,
      recommended_quote_eta_label: null,
      readiness_label: "Selection missing",
      detail_label: "incomplete · not applicable · missing legacy method",
      hint_messages: [
        "Current shadow constellation is still informational only and does not yet have enough shopper-safe context to describe a recommendation.",
      ],
    },
    shadow_cutover_readiness_preview: {
      tone: "neutral",
      cutover_readiness_status: "insufficient_data",
      status_label: "Shadow cutover readiness preview needs more context",
      readiness_label: "Selection missing",
      recommendation_label: "shadow recommendation insufficient data",
      modality_label: null,
      detail_label:
        "verdict insufficient data · shadow recommendation insufficient data · incomplete · not applicable · missing legacy method",
      hint_messages: [
        "Shadow-only cutover readiness preview does not yet have enough comparable context to claim future cutover readiness for this checkout.",
      ],
    },
    shadow_cutover_blockers_preview: {
      tone: "neutral",
      blockers_status: "insufficient_data",
      status_label: "Shadow cutover blockers preview needs more context",
      readiness_label: "Selection missing",
      verdict_label: "shadow verdict insufficient data",
      recommendation_label: "shadow recommendation insufficient data",
      blocker_count_label: null,
      blockers: [],
      hint_messages: [
        "Read-only shadow cutover blockers preview does not yet have enough comparable context to list blocker points for the current checkout.",
      ],
    },
    shadow_cutover_summary_preview: {
      tone: "neutral",
      summary_status: "insufficient_data",
      status_label: "Shadow cutover summary preview needs more context",
      readiness_label: "Selection missing",
      modality_label: null,
      recommendation_label: "shadow recommendation insufficient data",
      blocker_count_label: null,
      next_step_count_label: null,
      detail_label:
        "readiness insufficient data · blockers insufficient data · next steps insufficient data",
      headline_messages: [
        "Readiness preview still needs more comparable shadow context.",
        "Blocker visibility still needs more comparable shadow context.",
        "Next-step visibility still needs more comparable shadow context.",
      ],
      hint_messages: [
        "Read-only shadow cutover summary preview does not yet have enough comparable context to describe a future cutover summary for this checkout.",
      ],
    },
    shadow_cutover_evidence_preview: {
      tone: "neutral",
      evidence_status: "insufficient_data",
      status_label: "Shadow cutover evidence preview needs more context",
      readiness_label: "Selection missing",
      summary_label: "Shadow cutover summary preview needs more context",
      recommendation_label: "shadow recommendation insufficient data",
      evidence_count_label: null,
      detail_label:
        "summary insufficient data · readiness insufficient data · blockers insufficient data · next steps insufficient data",
      evidence_items: [],
      hint_messages: [
        "Read-only shadow cutover evidence preview does not yet have enough comparable context to compact supporting signals for the current checkout.",
      ],
    },
    shadow_cutover_rollout_preview: {
      tone: "neutral",
      rollout_status: "insufficient_data",
      status_label: "Shadow cutover rollout preview needs more context",
      readiness_label: "Selection missing",
      summary_label: "Shadow cutover summary preview needs more context",
      evidence_label: "Shadow cutover evidence preview needs more context",
      recommendation_label: "shadow recommendation insufficient data",
      rollout_reason_label: "Comparable shadow rollout context is still incomplete",
      detail_label:
        "summary insufficient data · evidence insufficient data · readiness insufficient data · blockers insufficient data · next steps insufficient data · recommendation insufficient data",
      headline_messages: [
        "Rollout remains preview-only because the current shadow cutover picture still lacks enough comparable context.",
        "Readiness preview still needs more comparable shadow context.",
      ],
      hint_messages: [
        "Read-only shadow cutover rollout preview only. This compact block aggregates already materialized summary, evidence, readiness, blockers, next-step, and recommendation previews into a rollout-oriented picture for observation only.",
      ],
    },
  })

  assert.deepEqual(insufficientPreview, {
    tone: "neutral",
    gate_preview_status: "insufficient_data",
    status_label: "Shadow cutover gate preview needs more context",
    readiness_label: "Selection missing",
    summary_label: "Shadow cutover summary preview needs more context",
    rollout_label: "Shadow cutover rollout preview needs more context",
    aligned_gate_count_label: null,
    blocked_gate_count_label: null,
    insufficient_gate_count_label: "7 insufficient gates visible",
    gate_items: [
      {
        code: "shipping_option_parity",
        gate_status: "insufficient_data",
        label: "Shipping-option parity still needs comparable context",
        detail_label:
          "Parity preview activates only when checkout already has a committed legacy shipping method.",
      },
      {
        code: "selection_parity",
        gate_status: "insufficient_data",
        label: "Selection parity still needs comparable context",
        detail_label:
          "Selection parity preview activates only when checkout already has a committed legacy shipping method.",
      },
      {
        code: "readiness_contour",
        gate_status: "insufficient_data",
        label: "Readiness contour still needs more context",
        detail_label:
          "Shadow-only cutover readiness preview does not yet have enough comparable context to claim future cutover readiness for this checkout.",
      },
      {
        code: "known_blockers",
        gate_status: "insufficient_data",
        label: "Blocker visibility still needs more context",
        detail_label:
          "Read-only shadow cutover blockers preview does not yet have enough comparable context to list blocker points for the current checkout.",
      },
      {
        code: "recommendation_signal",
        gate_status: "insufficient_data",
        label: "Recommendation signal still needs more context",
        detail_label:
          "Current shadow constellation is still informational only and does not yet have enough shopper-safe context to describe a recommendation.",
      },
      {
        code: "supporting_evidence",
        gate_status: "insufficient_data",
        label: "Supporting evidence still needs more context",
        detail_label:
          "Read-only shadow cutover evidence preview does not yet have enough comparable context to compact supporting signals for the current checkout.",
      },
      {
        code: "rollout_picture",
        gate_status: "insufficient_data",
        label: "Rollout picture still needs more context",
        detail_label: "Comparable shadow rollout context is still incomplete",
      },
    ],
    headline_messages: [
      "7 insufficient gates visible",
      "Readiness preview still needs more comparable shadow context.",
    ],
    hint_messages: [
      "Read-only shadow cutover gate preview only. Each gate below simply restates already materialized parity, readiness, blocker, recommendation, evidence, and rollout previews for future cutover decision-making only.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
      "Some gates remain informational only because current shadow previews still lack enough comparable context for a fuller future cutover picture.",
      "Read-only shadow cutover rollout preview only. This compact block aggregates already materialized summary, evidence, readiness, blockers, next-step, and recommendation previews into a rollout-oriented picture for observation only.",
    ],
  })
})

test("buildDeliveryHubShadowCutoverDecisionPreviewModel reports hold, observe-only, and insufficient-data verdicts truthfully", () => {
  const observeOnlyPreview = buildDeliveryHubShadowCutoverDecisionPreviewModel({
    shadow_orchestration_recommendation_preview: {
      tone: "positive",
      recommendation_status: "recommended",
      status_label: "Shadow recommendation preview available",
      recommended_modality_label: "Warehouse → pickup point",
      recommended_pickup_point_label: "Pickup point A",
      recommended_pickup_window_label: null,
      recommended_quote_amount: 499,
      currency_code: "RUB",
      recommended_quote_eta_label: "ETA 1–2 days",
      readiness_label: "Selection ready",
      detail_label: "action-ready · aligned · aligned",
      hint_messages: [
        "Read-only shadow recommendation only. Current checkout keeps the committed legacy shipping flow and does not switch shipping method or save any neutral selection from this preview.",
      ],
    },
    shadow_cutover_readiness_preview: {
      tone: "positive",
      cutover_readiness_status: "ready",
      status_label: "Shadow cutover readiness preview indicates ready contour",
      readiness_label: "Selection ready",
      recommendation_label: "shadow recommendation recommended",
      modality_label: "Warehouse → pickup point",
      detail_label:
        "verdict aligned · shadow recommendation recommended · action-ready · aligned · aligned",
      hint_messages: [
        "Shadow-only cutover readiness preview indicates that the current checkout contour looks internally aligned for a future Delivery Hub cutover.",
      ],
    },
    shadow_cutover_blockers_preview: {
      tone: "neutral",
      blockers_status: "no_known_blockers",
      status_label: "No known shadow cutover blockers visible",
      readiness_label: "Selection ready",
      verdict_label: "shadow verdict aligned",
      recommendation_label: "shadow recommendation recommended",
      blocker_count_label: null,
      blockers: [],
      hint_messages: [
        "Read-only shadow cutover blockers preview only. No known blocker points are currently visible in existing shadow previews for this checkout context.",
      ],
    },
    shadow_cutover_summary_preview: {
      tone: "positive",
      summary_status: "ready_shadow_contour",
      status_label: "Shadow cutover summary preview indicates aligned shadow contour",
      readiness_label: "Selection ready",
      modality_label: "Warehouse → pickup point",
      recommendation_label: "shadow recommendation recommended",
      blocker_count_label: null,
      next_step_count_label: null,
      detail_label:
        "readiness ready · blockers no known blockers · next steps no clear next steps",
      headline_messages: [
        "Readiness preview currently shows an aligned shadow contour.",
        "No known shadow blockers are currently visible.",
        "No clear shadow next step is currently visible.",
      ],
      hint_messages: [
        "Read-only shadow cutover summary preview only. This compact block aggregates already visible shadow readiness, blockers, and next-step previews for future Delivery Hub cutover planning only.",
      ],
    },
    shadow_cutover_evidence_preview: {
      tone: "positive",
      evidence_status: "evidence_available",
      status_label: "Shadow cutover evidence preview compacts current supporting signals",
      readiness_label: "Selection ready",
      summary_label: "Shadow cutover summary preview indicates aligned shadow contour",
      recommendation_label: "shadow recommendation recommended",
      evidence_count_label: "5 supporting signals visible",
      detail_label:
        "summary ready shadow contour · readiness ready · blockers no known blockers · next steps no clear next steps",
      evidence_items: [
        {
          code: "summary_signal",
          label: "Shadow summary currently shows an aligned contour",
          detail_label: "Readiness preview currently shows an aligned shadow contour.",
        },
      ],
      hint_messages: [
        "Read-only shadow cutover evidence preview only. This compact block aggregates already visible shadow cutover summary, readiness, blockers, next-step, and recommendation previews as supporting evidence for the current shadow picture only.",
      ],
    },
    shadow_cutover_rollout_preview: {
      tone: "neutral",
      rollout_status: "observe_only",
      status_label: "Shadow cutover rollout preview remains observe-only",
      readiness_label: "Selection ready",
      summary_label: "Shadow cutover summary preview indicates aligned shadow contour",
      evidence_label: "Shadow cutover evidence preview compacts current supporting signals",
      recommendation_label: "shadow recommendation recommended",
      rollout_reason_label: "5 supporting signals visible",
      detail_label:
        "summary ready shadow contour · evidence evidence available · readiness ready · blockers no known blockers · next steps no clear next steps · recommendation recommended",
      headline_messages: [
        "Current shadow signals can be observed as a compact rollout picture only.",
        "Readiness preview currently shows an aligned shadow contour.",
        "5 supporting signals visible",
      ],
      hint_messages: [
        "Read-only shadow cutover rollout preview only. Even when the current shadow contour looks aligned, this block remains observational and does not indicate that checkout cutover has occurred.",
      ],
    },
    shadow_cutover_gate_preview: {
      tone: "positive",
      gate_preview_status: "aligned",
      status_label: "Shadow cutover gate preview shows aligned gates only",
      readiness_label: "Selection ready",
      summary_label: "Shadow cutover summary preview indicates aligned shadow contour",
      rollout_label: "Shadow cutover rollout preview remains observe-only",
      aligned_gate_count_label: "7 aligned gates visible",
      blocked_gate_count_label: null,
      insufficient_gate_count_label: null,
      gate_items: [
        {
          code: "shipping_option_parity",
          gate_status: "aligned",
          label: "Shipping-option parity looks aligned",
          detail_label: "2 sampled quotes · 3 destination-compatible pickup points",
        },
      ],
      headline_messages: [
        "7 aligned gates visible",
        "Readiness preview currently shows an aligned shadow contour.",
        "Current shadow signals can be observed as a compact rollout picture only.",
      ],
      hint_messages: [
        "Read-only shadow cutover gate preview only. Each gate below simply restates already materialized parity, readiness, blocker, recommendation, evidence, and rollout previews for future cutover decision-making only.",
      ],
    },
  })

  assert.deepEqual(observeOnlyPreview, {
    tone: "neutral",
    decision_status: "observe_only",
    status_label: "Shadow cutover decision preview remains observe-only",
    readiness_label: "Selection ready",
    summary_label: "Shadow cutover summary preview indicates aligned shadow contour",
    evidence_label: "Shadow cutover evidence preview compacts current supporting signals",
    rollout_label: "Shadow cutover rollout preview remains observe-only",
    gate_label: "Shadow cutover gate preview shows aligned gates only",
    decision_reason_label: "7 aligned gates visible",
    detail_label:
      "gate aligned · summary ready shadow contour · evidence evidence available · rollout observe only · readiness ready · blockers no known blockers · recommendation recommended",
    headline_messages: [
      "Current shadow cutover picture can be observed from checkout without changing the active commit path.",
      "7 aligned gates visible",
      "Current shadow signals can be observed as a compact rollout picture only.",
    ],
    hint_messages: [
      "Read-only shadow cutover decision preview only. This compact block aggregates already materialized shadow summary, evidence, rollout, and gate previews into a pre-cutover decision verdict for planning only.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
      "An observe-only verdict here means the currently materialized shadow previews look internally consistent enough to monitor, but checkout is not cut over and no shipping method will be switched.",
      "Read-only shadow cutover gate preview only. Each gate below simply restates already materialized parity, readiness, blocker, recommendation, evidence, and rollout previews for future cutover decision-making only.",
    ],
  })

  const holdPreview = buildDeliveryHubShadowCutoverDecisionPreviewModel({
    shadow_orchestration_recommendation_preview: {
      tone: "warning",
      recommendation_status: "unavailable",
      status_label: "Shadow recommendation preview unavailable",
      recommended_modality_label: null,
      recommended_pickup_point_label: null,
      recommended_pickup_window_label: null,
      recommended_quote_amount: null,
      currency_code: null,
      recommended_quote_eta_label: null,
      readiness_label: "Selection not ready",
      detail_label: "needs pickup-point context · degraded · missing neutral selection",
      hint_messages: [
        "Current shadow constellation does not support a shopper-safe recommendation for this cart context, so this block remains informational only.",
      ],
    },
    shadow_cutover_readiness_preview: {
      tone: "warning",
      cutover_readiness_status: "not_ready",
      status_label: "Shadow cutover readiness preview indicates not-ready contour",
      readiness_label: "Selection not ready",
      recommendation_label: "shadow recommendation unavailable",
      modality_label: "Warehouse → pickup point",
      detail_label:
        "verdict degraded · shadow recommendation unavailable · needs pickup-point context · degraded · missing neutral selection",
      hint_messages: [
        "Shadow-only cutover readiness preview currently indicates that the checkout contour is not ready for a future Delivery Hub cutover.",
      ],
    },
    shadow_cutover_blockers_preview: {
      tone: "warning",
      blockers_status: "known_blockers",
      status_label: "Known shadow cutover blockers visible",
      readiness_label: "Selection not ready",
      verdict_label: "shadow verdict degraded",
      recommendation_label: "shadow recommendation unavailable",
      blocker_count_label: "3 known blockers visible",
      blockers: [
        {
          code: "needs_pickup_point",
          label: "Neutral pickup-point context is still missing",
          detail_label: "Pickup point is required",
        },
      ],
      hint_messages: [
        "Read-only shadow cutover blockers preview only. Known blocker points below are derived from existing shadow previews for the current checkout context and do not change shopper state.",
      ],
    },
    shadow_cutover_summary_preview: {
      tone: "warning",
      summary_status: "attention_required",
      status_label: "Shadow cutover summary preview shows attention points",
      readiness_label: "Selection not ready",
      modality_label: "Warehouse → pickup point",
      recommendation_label: "shadow recommendation unavailable",
      blocker_count_label: "3 known blockers visible",
      next_step_count_label: "3 next steps visible",
      detail_label:
        "readiness not ready · blockers known blockers · next steps known next steps",
      headline_messages: [
        "Readiness preview still shows a not-ready shadow contour.",
        "3 known blockers visible",
        "3 next steps visible",
      ],
      hint_messages: [
        "Read-only shadow cutover summary preview only. This compact block highlights attention points already visible across existing shadow readiness, blockers, and next-step previews.",
      ],
    },
    shadow_cutover_evidence_preview: {
      tone: "warning",
      evidence_status: "evidence_available",
      status_label: "Shadow cutover evidence preview compacts current supporting signals",
      readiness_label: "Selection not ready",
      summary_label: "Shadow cutover summary preview shows attention points",
      recommendation_label: "shadow recommendation unavailable",
      evidence_count_label: "5 supporting signals visible",
      detail_label:
        "summary attention required · readiness not ready · blockers known blockers · next steps known next steps",
      evidence_items: [
        {
          code: "summary_signal",
          label: "Shadow summary currently highlights attention points",
          detail_label: "Readiness preview still shows a not-ready shadow contour.",
        },
      ],
      hint_messages: [
        "Read-only shadow cutover evidence preview only. This compact block aggregates already visible shadow cutover summary, readiness, blockers, next-step, and recommendation previews as supporting evidence for the current shadow picture only.",
      ],
    },
    shadow_cutover_rollout_preview: {
      tone: "warning",
      rollout_status: "not_advised",
      status_label: "Shadow cutover rollout preview does not advise rollout",
      readiness_label: "Selection not ready",
      summary_label: "Shadow cutover summary preview shows attention points",
      evidence_label: "Shadow cutover evidence preview compacts current supporting signals",
      recommendation_label: "shadow recommendation unavailable",
      rollout_reason_label: "3 known blockers visible",
      detail_label:
        "summary attention required · evidence evidence available · readiness not ready · blockers known blockers · next steps known next steps · recommendation unavailable",
      headline_messages: [
        "Current shadow signals still point to an observe-only and not-advised rollout picture.",
        "3 known blockers visible",
        "Readiness preview still shows a not-ready shadow contour.",
      ],
      hint_messages: [
        "Read-only shadow cutover rollout preview only. Current shadow signals suggest that rollout should remain observational and should not be treated as an active checkout cutover.",
      ],
    },
    shadow_cutover_gate_preview: {
      tone: "warning",
      gate_preview_status: "blocked",
      status_label: "Shadow cutover gate preview shows blocked gates",
      readiness_label: "Selection not ready",
      summary_label: "Shadow cutover summary preview shows attention points",
      rollout_label: "Shadow cutover rollout preview does not advise rollout",
      aligned_gate_count_label: null,
      blocked_gate_count_label: "7 blocked gates visible",
      insufficient_gate_count_label: null,
      gate_items: [
        {
          code: "shipping_option_parity",
          gate_status: "blocked",
          label: "Shipping-option parity still shows drift",
          detail_label:
            "Legacy checkout currently has a committed pickup-point method, but sampled neutral pickup-point availability is not currently returned for the same checkout context.",
        },
      ],
      headline_messages: ["7 blocked gates visible"],
      hint_messages: [
        "Read-only shadow cutover gate preview only. Each gate below simply restates already materialized parity, readiness, blocker, recommendation, evidence, and rollout previews for future cutover decision-making only.",
      ],
    },
  })

  assert.deepEqual(holdPreview, {
    tone: "warning",
    decision_status: "hold",
    status_label: "Shadow cutover decision preview indicates hold",
    readiness_label: "Selection not ready",
    summary_label: "Shadow cutover summary preview shows attention points",
    evidence_label: "Shadow cutover evidence preview compacts current supporting signals",
    rollout_label: "Shadow cutover rollout preview does not advise rollout",
    gate_label: "Shadow cutover gate preview shows blocked gates",
    decision_reason_label: "7 blocked gates visible",
    detail_label:
      "gate blocked · summary attention required · evidence evidence available · rollout not advised · readiness not ready · blockers known blockers · recommendation unavailable",
    headline_messages: [
      "Current shadow cutover picture still points to hold for future decision planning.",
      "7 blocked gates visible",
      "Readiness preview still shows a not-ready shadow contour.",
    ],
    hint_messages: [
      "Read-only shadow cutover decision preview only. This compact block aggregates already materialized shadow summary, evidence, rollout, and gate previews into a pre-cutover decision verdict for planning only.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
      "A hold verdict here only restates attention points already visible in current shadow previews and does not mean that checkout cutover has started or that any shipping method will be switched.",
      "Read-only shadow cutover gate preview only. Each gate below simply restates already materialized parity, readiness, blocker, recommendation, evidence, and rollout previews for future cutover decision-making only.",
    ],
  })

  const insufficientPreview = buildDeliveryHubShadowCutoverDecisionPreviewModel({
    shadow_orchestration_recommendation_preview: {
      tone: "neutral",
      recommendation_status: "insufficient_data",
      status_label: "Shadow recommendation preview needs more context",
      recommended_modality_label: null,
      recommended_pickup_point_label: null,
      recommended_pickup_window_label: null,
      recommended_quote_amount: null,
      currency_code: null,
      recommended_quote_eta_label: null,
      readiness_label: "Selection missing",
      detail_label: "incomplete · not applicable · missing legacy method",
      hint_messages: [
        "Current shadow constellation is still informational only and does not yet have enough shopper-safe context to describe a recommendation.",
      ],
    },
    shadow_cutover_readiness_preview: {
      tone: "neutral",
      cutover_readiness_status: "insufficient_data",
      status_label: "Shadow cutover readiness preview needs more context",
      readiness_label: "Selection missing",
      recommendation_label: "shadow recommendation insufficient data",
      modality_label: null,
      detail_label:
        "verdict insufficient data · shadow recommendation insufficient data · incomplete · not applicable · missing legacy method",
      hint_messages: [
        "Shadow-only cutover readiness preview does not yet have enough comparable context to claim future cutover readiness for this checkout.",
      ],
    },
    shadow_cutover_blockers_preview: {
      tone: "neutral",
      blockers_status: "insufficient_data",
      status_label: "Shadow cutover blockers preview needs more context",
      readiness_label: "Selection missing",
      verdict_label: "shadow verdict insufficient data",
      recommendation_label: "shadow recommendation insufficient data",
      blocker_count_label: null,
      blockers: [],
      hint_messages: [
        "Read-only shadow cutover blockers preview does not yet have enough comparable context to list blocker points for the current checkout.",
      ],
    },
    shadow_cutover_summary_preview: {
      tone: "neutral",
      summary_status: "insufficient_data",
      status_label: "Shadow cutover summary preview needs more context",
      readiness_label: "Selection missing",
      modality_label: null,
      recommendation_label: "shadow recommendation insufficient data",
      blocker_count_label: null,
      next_step_count_label: null,
      detail_label:
        "readiness insufficient data · blockers insufficient data · next steps insufficient data",
      headline_messages: [
        "Readiness preview still needs more comparable shadow context.",
        "Blocker visibility still needs more comparable shadow context.",
        "Next-step visibility still needs more comparable shadow context.",
      ],
      hint_messages: [
        "Read-only shadow cutover summary preview does not yet have enough comparable context to describe a future cutover summary for this checkout.",
      ],
    },
    shadow_cutover_evidence_preview: {
      tone: "neutral",
      evidence_status: "insufficient_data",
      status_label: "Shadow cutover evidence preview needs more context",
      readiness_label: "Selection missing",
      summary_label: "Shadow cutover summary preview needs more context",
      recommendation_label: "shadow recommendation insufficient data",
      evidence_count_label: null,
      detail_label:
        "summary insufficient data · readiness insufficient data · blockers insufficient data · next steps insufficient data",
      evidence_items: [],
      hint_messages: [
        "Read-only shadow cutover evidence preview does not yet have enough comparable context to compact supporting signals for the current checkout.",
      ],
    },
    shadow_cutover_rollout_preview: {
      tone: "neutral",
      rollout_status: "insufficient_data",
      status_label: "Shadow cutover rollout preview needs more context",
      readiness_label: "Selection missing",
      summary_label: "Shadow cutover summary preview needs more context",
      evidence_label: "Shadow cutover evidence preview needs more context",
      recommendation_label: "shadow recommendation insufficient data",
      rollout_reason_label: "Comparable shadow rollout context is still incomplete",
      detail_label:
        "summary insufficient data · evidence insufficient data · readiness insufficient data · blockers insufficient data · next steps insufficient data · recommendation insufficient data",
      headline_messages: [
        "Rollout remains preview-only because the current shadow cutover picture still lacks enough comparable context.",
        "Readiness preview still needs more comparable shadow context.",
      ],
      hint_messages: [
        "Read-only shadow cutover rollout preview only. This compact block aggregates already materialized summary, evidence, readiness, blockers, next-step, and recommendation previews into a rollout-oriented picture for observation only.",
      ],
    },
    shadow_cutover_gate_preview: {
      tone: "neutral",
      gate_preview_status: "insufficient_data",
      status_label: "Shadow cutover gate preview needs more context",
      readiness_label: "Selection missing",
      summary_label: "Shadow cutover summary preview needs more context",
      rollout_label: "Shadow cutover rollout preview needs more context",
      aligned_gate_count_label: null,
      blocked_gate_count_label: null,
      insufficient_gate_count_label: "7 insufficient gates visible",
      gate_items: [
        {
          code: "shipping_option_parity",
          gate_status: "insufficient_data",
          label: "Shipping-option parity still needs comparable context",
          detail_label:
            "Parity preview activates only when checkout already has a committed legacy shipping method.",
        },
      ],
      headline_messages: [
        "7 insufficient gates visible",
        "Readiness preview still needs more comparable shadow context.",
      ],
      hint_messages: [
        "Read-only shadow cutover gate preview only. Each gate below simply restates already materialized parity, readiness, blocker, recommendation, evidence, and rollout previews for future cutover decision-making only.",
      ],
    },
  })

  assert.deepEqual(insufficientPreview, {
    tone: "neutral",
    decision_status: "insufficient_data",
    status_label: "Shadow cutover decision preview needs more context",
    readiness_label: "Selection missing",
    summary_label: "Shadow cutover summary preview needs more context",
    evidence_label: "Shadow cutover evidence preview needs more context",
    rollout_label: "Shadow cutover rollout preview needs more context",
    gate_label: "Shadow cutover gate preview needs more context",
    decision_reason_label: "7 insufficient gates visible",
    detail_label:
      "gate insufficient data · summary insufficient data · evidence insufficient data · rollout insufficient data · readiness insufficient data · blockers insufficient data · recommendation insufficient data",
    headline_messages: [
      "Current shadow cutover picture still lacks enough context for a fuller decision preview.",
      "7 insufficient gates visible",
      "Readiness preview still needs more comparable shadow context.",
    ],
    hint_messages: [
      "Read-only shadow cutover decision preview only. This compact block aggregates already materialized shadow summary, evidence, rollout, and gate previews into a pre-cutover decision verdict for planning only.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
      "When this decision preview says insufficient data, it means the current shadow previews still lack enough shopper-safe context to describe even an observe-only pre-cutover decision picture.",
      "Read-only shadow cutover gate preview only. Each gate below simply restates already materialized parity, readiness, blocker, recommendation, evidence, and rollout previews for future cutover decision-making only.",
    ],
  })
})

test("buildDeliveryHubShadowCutoverChecklistPreviewModel reports ready, pending, blocked, and insufficient-data checks truthfully", () => {
  const readyPreview = buildDeliveryHubShadowCutoverChecklistPreviewModel({
    shadow_cutover_readiness_preview: {
      tone: "positive",
      cutover_readiness_status: "ready",
      status_label: "Shadow cutover readiness preview indicates ready contour",
      readiness_label: "Selection ready",
      recommendation_label: "shadow recommendation recommended",
      modality_label: "Warehouse → pickup point",
      detail_label:
        "verdict aligned · shadow recommendation recommended · action-ready · aligned · aligned",
      hint_messages: [
        "Shadow-only cutover readiness preview indicates that the current checkout contour looks internally aligned for a future Delivery Hub cutover.",
      ],
    },
    shadow_cutover_blockers_preview: {
      tone: "neutral",
      blockers_status: "no_known_blockers",
      status_label: "No known shadow cutover blockers visible",
      readiness_label: "Selection ready",
      verdict_label: "shadow verdict aligned",
      recommendation_label: "shadow recommendation recommended",
      blocker_count_label: null,
      blockers: [],
      hint_messages: [
        "Read-only shadow cutover blockers preview only. No known blocker points are currently visible in existing shadow previews for this checkout context.",
      ],
    },
    shadow_cutover_summary_preview: {
      tone: "positive",
      summary_status: "ready_shadow_contour",
      status_label: "Shadow cutover summary preview indicates aligned shadow contour",
      readiness_label: "Selection ready",
      modality_label: "Warehouse → pickup point",
      recommendation_label: "shadow recommendation recommended",
      blocker_count_label: null,
      next_step_count_label: null,
      detail_label:
        "readiness ready · blockers no known blockers · next steps no clear next steps",
      headline_messages: [
        "Readiness preview currently shows an aligned shadow contour.",
        "No known shadow blockers are currently visible.",
        "No clear shadow next step is currently visible.",
      ],
      hint_messages: [
        "Read-only shadow cutover summary preview only. This compact block aggregates already visible shadow readiness, blockers, and next-step previews for future Delivery Hub cutover planning only.",
      ],
    },
    shadow_cutover_evidence_preview: {
      tone: "positive",
      evidence_status: "evidence_available",
      status_label: "Shadow cutover evidence preview compacts current supporting signals",
      readiness_label: "Selection ready",
      summary_label: "Shadow cutover summary preview indicates aligned shadow contour",
      recommendation_label: "shadow recommendation recommended",
      evidence_count_label: "5 supporting signals visible",
      detail_label:
        "summary ready shadow contour · readiness ready · blockers no known blockers · next steps no clear next steps",
      evidence_items: [
        {
          code: "summary_signal",
          label: "Shadow summary currently shows an aligned contour",
          detail_label: "Readiness preview currently shows an aligned shadow contour.",
        },
      ],
      hint_messages: [
        "Read-only shadow cutover evidence preview only. This compact block aggregates already visible shadow cutover summary, readiness, blockers, next-step, and recommendation previews as supporting evidence for the current shadow picture only.",
      ],
    },
    shadow_cutover_rollout_preview: {
      tone: "neutral",
      rollout_status: "observe_only",
      status_label: "Shadow cutover rollout preview remains observe-only",
      readiness_label: "Selection ready",
      summary_label: "Shadow cutover summary preview indicates aligned shadow contour",
      evidence_label: "Shadow cutover evidence preview compacts current supporting signals",
      recommendation_label: "shadow recommendation recommended",
      rollout_reason_label: "5 supporting signals visible",
      detail_label:
        "summary ready shadow contour · evidence evidence available · readiness ready · blockers no known blockers · next steps no clear next steps · recommendation recommended",
      headline_messages: [
        "Current shadow signals can be observed as a compact rollout picture only.",
        "Readiness preview currently shows an aligned shadow contour.",
        "5 supporting signals visible",
      ],
      hint_messages: [
        "Read-only shadow cutover rollout preview only. Even when the current shadow contour looks aligned, this block remains observational and does not indicate that checkout cutover has occurred.",
      ],
    },
    shadow_cutover_gate_preview: {
      tone: "positive",
      gate_preview_status: "aligned",
      status_label: "Shadow cutover gate preview shows aligned gates only",
      readiness_label: "Selection ready",
      summary_label: "Shadow cutover summary preview indicates aligned shadow contour",
      rollout_label: "Shadow cutover rollout preview remains observe-only",
      aligned_gate_count_label: "7 aligned gates visible",
      blocked_gate_count_label: null,
      insufficient_gate_count_label: null,
      gate_items: [
        {
          code: "shipping_option_parity",
          gate_status: "aligned",
          label: "Shipping-option parity looks aligned",
          detail_label: "2 sampled quotes · 3 destination-compatible pickup points",
        },
      ],
      headline_messages: [
        "7 aligned gates visible",
        "Readiness preview currently shows an aligned shadow contour.",
        "Current shadow signals can be observed as a compact rollout picture only.",
      ],
      hint_messages: [
        "Read-only shadow cutover gate preview only. Each gate below simply restates already materialized parity, readiness, blocker, recommendation, evidence, and rollout previews for future cutover decision-making only.",
      ],
    },
    shadow_cutover_decision_preview: {
      tone: "neutral",
      decision_status: "observe_only",
      status_label: "Shadow cutover decision preview remains observe-only",
      readiness_label: "Selection ready",
      summary_label: "Shadow cutover summary preview indicates aligned shadow contour",
      evidence_label: "Shadow cutover evidence preview compacts current supporting signals",
      rollout_label: "Shadow cutover rollout preview remains observe-only",
      gate_label: "Shadow cutover gate preview shows aligned gates only",
      decision_reason_label: "7 aligned gates visible",
      detail_label:
        "gate aligned · summary ready shadow contour · evidence evidence available · rollout observe only · readiness ready · blockers no known blockers · recommendation recommended",
      headline_messages: [
        "Current shadow cutover picture can be observed from checkout without changing the active commit path.",
        "7 aligned gates visible",
        "Current shadow signals can be observed as a compact rollout picture only.",
      ],
      hint_messages: [
        "Read-only shadow cutover decision preview only. This compact block aggregates already materialized shadow summary, evidence, rollout, and gate previews into a pre-cutover decision verdict for planning only.",
      ],
    },
  })

  assert.deepEqual(readyPreview, {
    tone: "positive",
    checklist_status: "ready",
    status_label: "Shadow cutover checklist preview shows ready checks only",
    readiness_label: "Selection ready",
    summary_label: "Shadow cutover summary preview indicates aligned shadow contour",
    decision_label: "Shadow cutover decision preview remains observe-only",
    ready_item_count_label: "7 ready checks visible",
    pending_item_count_label: null,
    blocked_item_count_label: null,
    insufficient_item_count_label: null,
    checklist_items: [
      {
        code: "readiness_contour",
        item_status: "ready",
        label: "Readiness contour currently looks ready",
        detail_label:
          "verdict aligned · shadow recommendation recommended · action-ready · aligned · aligned",
      },
      {
        code: "known_blockers",
        item_status: "ready",
        label: "No known blockers are currently visible",
        detail_label: "shadow verdict aligned",
      },
      {
        code: "shadow_summary",
        item_status: "ready",
        label: "Shadow summary currently looks aligned",
        detail_label:
          "readiness ready · blockers no known blockers · next steps no clear next steps",
      },
      {
        code: "supporting_evidence",
        item_status: "ready",
        label: "Supporting evidence is currently available",
        detail_label: "5 supporting signals visible",
      },
      {
        code: "rollout_picture",
        item_status: "ready",
        label: "Rollout picture remains observe-only",
        detail_label: "5 supporting signals visible",
      },
      {
        code: "gate_alignment",
        item_status: "ready",
        label: "Gate alignment currently looks consistent",
        detail_label: "7 aligned gates visible",
      },
      {
        code: "decision_signal",
        item_status: "ready",
        label: "Decision picture remains observe-only",
        detail_label: "7 aligned gates visible",
      },
    ],
    hint_messages: [
      "Read-only shadow cutover checklist preview only. Ready checklist items simply indicate that the currently materialized pre-cutover shadow checks look internally consistent for observation.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
      "Ready checks here do not mean checkout is already cut over; they only show that current shopper-safe shadow checks have enough aligned context to observe as a checklist.",
      "Read-only shadow cutover decision preview only. This compact block aggregates already materialized shadow summary, evidence, rollout, and gate previews into a pre-cutover decision verdict for planning only.",
    ],
  })

  const pendingPreview = buildDeliveryHubShadowCutoverChecklistPreviewModel({
    shadow_cutover_readiness_preview: {
      tone: "warning",
      cutover_readiness_status: "not_ready",
      status_label: "Shadow cutover readiness preview indicates not-ready contour",
      readiness_label: "Selection not ready",
      recommendation_label: "shadow recommendation recommended",
      modality_label: "Warehouse → pickup point",
      detail_label:
        "verdict degraded · shadow recommendation recommended · needs quote context · aligned · aligned",
      hint_messages: [
        "Shadow-only cutover readiness preview currently indicates that the checkout contour is not ready for a future Delivery Hub cutover.",
      ],
    },
    shadow_cutover_blockers_preview: {
      tone: "neutral",
      blockers_status: "no_known_blockers",
      status_label: "No known shadow cutover blockers visible",
      readiness_label: "Selection not ready",
      verdict_label: "shadow verdict degraded",
      recommendation_label: "shadow recommendation recommended",
      blocker_count_label: null,
      blockers: [],
      hint_messages: [
        "Read-only shadow cutover blockers preview only. No known blocker points are currently visible in existing shadow previews for this checkout context.",
      ],
    },
    shadow_cutover_summary_preview: {
      tone: "warning",
      summary_status: "attention_required",
      status_label: "Shadow cutover summary preview shows attention points",
      readiness_label: "Selection not ready",
      modality_label: "Warehouse → pickup point",
      recommendation_label: "shadow recommendation recommended",
      blocker_count_label: null,
      next_step_count_label: null,
      detail_label:
        "readiness not ready · blockers no known blockers · next steps no clear next steps",
      headline_messages: [
        "Readiness preview still shows a not-ready shadow contour.",
        "No known shadow blockers are currently visible.",
        "No clear shadow next step is currently visible.",
      ],
      hint_messages: [
        "Read-only shadow cutover summary preview only. This compact block highlights attention points already visible across existing shadow readiness, blockers, and next-step previews.",
      ],
    },
    shadow_cutover_evidence_preview: {
      tone: "warning",
      evidence_status: "evidence_available",
      status_label: "Shadow cutover evidence preview compacts current supporting signals",
      readiness_label: "Selection not ready",
      summary_label: "Shadow cutover summary preview shows attention points",
      recommendation_label: "shadow recommendation recommended",
      evidence_count_label: "5 supporting signals visible",
      detail_label:
        "summary attention required · readiness not ready · blockers no known blockers · next steps no clear next steps",
      evidence_items: [
        {
          code: "summary_signal",
          label: "Shadow summary currently highlights attention points",
          detail_label: "Readiness preview still shows a not-ready shadow contour.",
        },
      ],
      hint_messages: [
        "Read-only shadow cutover evidence preview only. This compact block aggregates already visible shadow cutover summary, readiness, blockers, next-step, and recommendation previews as supporting evidence for the current shadow picture only.",
      ],
    },
    shadow_cutover_rollout_preview: {
      tone: "neutral",
      rollout_status: "observe_only",
      status_label: "Shadow cutover rollout preview remains observe-only",
      readiness_label: "Selection not ready",
      summary_label: "Shadow cutover summary preview shows attention points",
      evidence_label: "Shadow cutover evidence preview compacts current supporting signals",
      recommendation_label: "shadow recommendation recommended",
      rollout_reason_label: "5 supporting signals visible",
      detail_label:
        "summary attention required · evidence evidence available · readiness not ready · blockers no known blockers · next steps no clear next steps · recommendation recommended",
      headline_messages: [
        "Current shadow signals can be observed as a compact rollout picture only.",
        "Readiness preview still shows a not-ready shadow contour.",
        "5 supporting signals visible",
      ],
      hint_messages: [
        "Read-only shadow cutover rollout preview only. Even when the current shadow contour looks aligned, this block remains observational and does not indicate that checkout cutover has occurred.",
      ],
    },
    shadow_cutover_gate_preview: {
      tone: "positive",
      gate_preview_status: "aligned",
      status_label: "Shadow cutover gate preview shows aligned gates only",
      readiness_label: "Selection not ready",
      summary_label: "Shadow cutover summary preview shows attention points",
      rollout_label: "Shadow cutover rollout preview remains observe-only",
      aligned_gate_count_label: "7 aligned gates visible",
      blocked_gate_count_label: null,
      insufficient_gate_count_label: null,
      gate_items: [
        {
          code: "readiness_contour",
          gate_status: "aligned",
          label: "Readiness contour looks aligned",
          detail_label: "Legacy and neutral signals stay comparable for observation.",
        },
      ],
      headline_messages: [
        "7 aligned gates visible",
        "Readiness preview still shows a not-ready shadow contour.",
      ],
      hint_messages: [
        "Read-only shadow cutover gate preview only. Each gate below simply restates already materialized parity, readiness, blocker, recommendation, evidence, and rollout previews for future cutover decision-making only.",
      ],
    },
    shadow_cutover_decision_preview: {
      tone: "neutral",
      decision_status: "observe_only",
      status_label: "Shadow cutover decision preview remains observe-only",
      readiness_label: "Selection not ready",
      summary_label: "Shadow cutover summary preview shows attention points",
      evidence_label: "Shadow cutover evidence preview compacts current supporting signals",
      rollout_label: "Shadow cutover rollout preview remains observe-only",
      gate_label: "Shadow cutover gate preview shows aligned gates only",
      decision_reason_label: "7 aligned gates visible",
      detail_label:
        "gate aligned · summary attention required · evidence evidence available · rollout observe only · readiness not ready · blockers no known blockers · recommendation recommended",
      headline_messages: [
        "Current shadow cutover picture can be observed from checkout without changing the active commit path.",
      ],
      hint_messages: [
        "Read-only shadow cutover decision preview only. This compact block aggregates already materialized shadow summary, evidence, rollout, and gate previews into a pre-cutover decision verdict for planning only.",
      ],
    },
  })

  assert.deepEqual(pendingPreview, {
    tone: "neutral",
    checklist_status: "pending",
    status_label: "Shadow cutover checklist preview shows pending checks",
    readiness_label: "Selection not ready",
    summary_label: "Shadow cutover summary preview shows attention points",
    decision_label: "Shadow cutover decision preview remains observe-only",
    ready_item_count_label: "5 ready checks visible",
    pending_item_count_label: "2 pending checks visible",
    blocked_item_count_label: null,
    insufficient_item_count_label: null,
    checklist_items: [
      {
        code: "readiness_contour",
        item_status: "pending",
        label: "Readiness contour still needs follow-up",
        detail_label:
          "Shadow-only cutover readiness preview currently indicates that the checkout contour is not ready for a future Delivery Hub cutover.",
      },
      {
        code: "known_blockers",
        item_status: "ready",
        label: "No known blockers are currently visible",
        detail_label: "shadow verdict degraded",
      },
      {
        code: "shadow_summary",
        item_status: "pending",
        label: "Shadow summary still shows attention points",
        detail_label: "Readiness preview still shows a not-ready shadow contour.",
      },
      {
        code: "supporting_evidence",
        item_status: "ready",
        label: "Supporting evidence is currently available",
        detail_label: "5 supporting signals visible",
      },
      {
        code: "rollout_picture",
        item_status: "ready",
        label: "Rollout picture remains observe-only",
        detail_label: "5 supporting signals visible",
      },
      {
        code: "gate_alignment",
        item_status: "ready",
        label: "Gate alignment currently looks consistent",
        detail_label: "7 aligned gates visible",
      },
      {
        code: "decision_signal",
        item_status: "ready",
        label: "Decision picture remains observe-only",
        detail_label: "7 aligned gates visible",
      },
    ],
    hint_messages: [
      "Read-only shadow cutover checklist preview only. Pending checklist items simply show where the current shadow cutover picture still needs follow-up before any future checkout cutover planning could mature.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
      "Pending checks here do not claim that checkout has already switched away from legacy ApiShip; they only restate shopper-safe shadow signals.",
      "Shadow-only cutover readiness preview currently indicates that the checkout contour is not ready for a future Delivery Hub cutover.",
    ],
  })

  const blockedPreview = buildDeliveryHubShadowCutoverChecklistPreviewModel({
    shadow_cutover_readiness_preview: {
      tone: "warning",
      cutover_readiness_status: "not_ready",
      status_label: "Shadow cutover readiness preview indicates not-ready contour",
      readiness_label: "Selection not ready",
      recommendation_label: "shadow recommendation unavailable",
      modality_label: "Warehouse → pickup point",
      detail_label:
        "verdict degraded · shadow recommendation unavailable · needs pickup-point context · degraded · missing neutral selection",
      hint_messages: [
        "Shadow-only cutover readiness preview currently indicates that the checkout contour is not ready for a future Delivery Hub cutover.",
      ],
    },
    shadow_cutover_blockers_preview: {
      tone: "warning",
      blockers_status: "known_blockers",
      status_label: "Known shadow cutover blockers visible",
      readiness_label: "Selection not ready",
      verdict_label: "shadow verdict degraded",
      recommendation_label: "shadow recommendation unavailable",
      blocker_count_label: "3 known blockers visible",
      blockers: [
        {
          code: "needs_pickup_point",
          label: "Neutral pickup-point context is still missing",
          detail_label: "Pickup point is required",
        },
      ],
      hint_messages: [
        "Read-only shadow cutover blockers preview only. Known blocker points below are derived from existing shadow previews for the current checkout context and do not change shopper state.",
      ],
    },
    shadow_cutover_summary_preview: {
      tone: "warning",
      summary_status: "attention_required",
      status_label: "Shadow cutover summary preview shows attention points",
      readiness_label: "Selection not ready",
      modality_label: "Warehouse → pickup point",
      recommendation_label: "shadow recommendation unavailable",
      blocker_count_label: "3 known blockers visible",
      next_step_count_label: "3 next steps visible",
      detail_label:
        "readiness not ready · blockers known blockers · next steps known next steps",
      headline_messages: [
        "Readiness preview still shows a not-ready shadow contour.",
        "3 known blockers visible",
        "3 next steps visible",
      ],
      hint_messages: [
        "Read-only shadow cutover summary preview only. This compact block highlights attention points already visible across existing shadow readiness, blockers, and next-step previews.",
      ],
    },
    shadow_cutover_evidence_preview: {
      tone: "warning",
      evidence_status: "evidence_available",
      status_label: "Shadow cutover evidence preview compacts current supporting signals",
      readiness_label: "Selection not ready",
      summary_label: "Shadow cutover summary preview shows attention points",
      recommendation_label: "shadow recommendation unavailable",
      evidence_count_label: "5 supporting signals visible",
      detail_label:
        "summary attention required · readiness not ready · blockers known blockers · next steps known next steps",
      evidence_items: [
        {
          code: "summary_signal",
          label: "Shadow summary currently highlights attention points",
          detail_label: "Readiness preview still shows a not-ready shadow contour.",
        },
      ],
      hint_messages: [
        "Read-only shadow cutover evidence preview only. This compact block aggregates already visible shadow cutover summary, readiness, blockers, next-step, and recommendation previews as supporting evidence for the current shadow picture only.",
      ],
    },
    shadow_cutover_rollout_preview: {
      tone: "warning",
      rollout_status: "not_advised",
      status_label: "Shadow cutover rollout preview does not advise rollout",
      readiness_label: "Selection not ready",
      summary_label: "Shadow cutover summary preview shows attention points",
      evidence_label: "Shadow cutover evidence preview compacts current supporting signals",
      recommendation_label: "shadow recommendation unavailable",
      rollout_reason_label: "3 known blockers visible",
      detail_label:
        "summary attention required · evidence evidence available · readiness not ready · blockers known blockers · next steps known next steps · recommendation unavailable",
      headline_messages: [
        "Current shadow signals still point to an observe-only and not-advised rollout picture.",
        "3 known blockers visible",
        "Readiness preview still shows a not-ready shadow contour.",
      ],
      hint_messages: [
        "Read-only shadow cutover rollout preview only. Current shadow signals suggest that rollout should remain observational and should not be treated as an active checkout cutover.",
      ],
    },
    shadow_cutover_gate_preview: {
      tone: "warning",
      gate_preview_status: "blocked",
      status_label: "Shadow cutover gate preview shows blocked gates",
      readiness_label: "Selection not ready",
      summary_label: "Shadow cutover summary preview shows attention points",
      rollout_label: "Shadow cutover rollout preview does not advise rollout",
      aligned_gate_count_label: null,
      blocked_gate_count_label: "7 blocked gates visible",
      insufficient_gate_count_label: null,
      gate_items: [
        {
          code: "shipping_option_parity",
          gate_status: "blocked",
          label: "Shipping-option parity still shows drift",
          detail_label:
            "Legacy checkout currently has a committed pickup-point method, but sampled neutral pickup-point availability is not currently returned for the same checkout context.",
        },
      ],
      headline_messages: ["7 blocked gates visible"],
      hint_messages: [
        "Read-only shadow cutover gate preview only. Each gate below simply restates already materialized parity, readiness, blocker, recommendation, evidence, and rollout previews for future cutover decision-making only.",
      ],
    },
    shadow_cutover_decision_preview: {
      tone: "warning",
      decision_status: "hold",
      status_label: "Shadow cutover decision preview indicates hold",
      readiness_label: "Selection not ready",
      summary_label: "Shadow cutover summary preview shows attention points",
      evidence_label: "Shadow cutover evidence preview compacts current supporting signals",
      rollout_label: "Shadow cutover rollout preview does not advise rollout",
      gate_label: "Shadow cutover gate preview shows blocked gates",
      decision_reason_label: "7 blocked gates visible",
      detail_label:
        "gate blocked · summary attention required · evidence evidence available · rollout not advised · readiness not ready · blockers known blockers · recommendation unavailable",
      headline_messages: [
        "Current shadow cutover picture still points to hold for future decision planning.",
      ],
      hint_messages: [
        "Read-only shadow cutover decision preview only. This compact block aggregates already materialized shadow summary, evidence, rollout, and gate previews into a pre-cutover decision verdict for planning only.",
      ],
    },
  })

  assert.deepEqual(blockedPreview, {
    tone: "warning",
    checklist_status: "blocked",
    status_label: "Shadow cutover checklist preview shows blocked checks",
    readiness_label: "Selection not ready",
    summary_label: "Shadow cutover summary preview shows attention points",
    decision_label: "Shadow cutover decision preview indicates hold",
    ready_item_count_label: "1 ready check visible",
    pending_item_count_label: "2 pending checks visible",
    blocked_item_count_label: "4 blocked checks visible",
    insufficient_item_count_label: null,
    checklist_items: [
      {
        code: "readiness_contour",
        item_status: "pending",
        label: "Readiness contour still needs follow-up",
        detail_label:
          "Shadow-only cutover readiness preview currently indicates that the checkout contour is not ready for a future Delivery Hub cutover.",
      },
      {
        code: "known_blockers",
        item_status: "blocked",
        label: "Known blockers are currently visible",
        detail_label: "3 known blockers visible",
      },
      {
        code: "shadow_summary",
        item_status: "pending",
        label: "Shadow summary still shows attention points",
        detail_label: "Readiness preview still shows a not-ready shadow contour.",
      },
      {
        code: "supporting_evidence",
        item_status: "ready",
        label: "Supporting evidence is currently available",
        detail_label: "5 supporting signals visible",
      },
      {
        code: "rollout_picture",
        item_status: "blocked",
        label: "Rollout picture is not currently advised",
        detail_label: "3 known blockers visible",
      },
      {
        code: "gate_alignment",
        item_status: "blocked",
        label: "Gate alignment currently shows blocked checks",
        detail_label: "7 blocked gates visible",
      },
      {
        code: "decision_signal",
        item_status: "blocked",
        label: "Decision picture currently remains on hold",
        detail_label: "7 blocked gates visible",
      },
    ],
    hint_messages: [
      "Read-only shadow cutover checklist preview only. Each checklist item below simply restates already materialized cutover-related shadow previews for pre-cutover observation only.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
      "Blocked checklist items below only highlight already visible cutover blockers or hold signals and do not mean checkout cutover has started.",
      "Read-only shadow cutover blockers preview only. Known blocker points below are derived from existing shadow previews for the current checkout context and do not change shopper state.",
    ],
  })

  const insufficientPreview = buildDeliveryHubShadowCutoverChecklistPreviewModel({
    shadow_cutover_readiness_preview: {
      tone: "neutral",
      cutover_readiness_status: "insufficient_data",
      status_label: "Shadow cutover readiness preview needs more context",
      readiness_label: "Selection missing",
      recommendation_label: "shadow recommendation insufficient data",
      modality_label: null,
      detail_label:
        "verdict insufficient data · shadow recommendation insufficient data · incomplete · not applicable · missing legacy method",
      hint_messages: [
        "Shadow-only cutover readiness preview does not yet have enough comparable context to claim future cutover readiness for this checkout.",
      ],
    },
    shadow_cutover_blockers_preview: {
      tone: "neutral",
      blockers_status: "insufficient_data",
      status_label: "Shadow cutover blockers preview needs more context",
      readiness_label: "Selection missing",
      verdict_label: "shadow verdict insufficient data",
      recommendation_label: "shadow recommendation insufficient data",
      blocker_count_label: null,
      blockers: [],
      hint_messages: [
        "Read-only shadow cutover blockers preview does not yet have enough comparable context to list blocker points for the current checkout.",
      ],
    },
    shadow_cutover_summary_preview: {
      tone: "neutral",
      summary_status: "insufficient_data",
      status_label: "Shadow cutover summary preview needs more context",
      readiness_label: "Selection missing",
      modality_label: null,
      recommendation_label: "shadow recommendation insufficient data",
      blocker_count_label: null,
      next_step_count_label: null,
      detail_label:
        "readiness insufficient data · blockers insufficient data · next steps insufficient data",
      headline_messages: [
        "Readiness preview still needs more comparable shadow context.",
        "Blocker visibility still needs more comparable shadow context.",
        "Next-step visibility still needs more comparable shadow context.",
      ],
      hint_messages: [
        "Read-only shadow cutover summary preview does not yet have enough comparable context to describe a future cutover summary for this checkout.",
      ],
    },
    shadow_cutover_evidence_preview: {
      tone: "neutral",
      evidence_status: "insufficient_data",
      status_label: "Shadow cutover evidence preview needs more context",
      readiness_label: "Selection missing",
      summary_label: "Shadow cutover summary preview needs more context",
      recommendation_label: "shadow recommendation insufficient data",
      evidence_count_label: null,
      detail_label:
        "summary insufficient data · readiness insufficient data · blockers insufficient data · next steps insufficient data",
      evidence_items: [],
      hint_messages: [
        "Read-only shadow cutover evidence preview does not yet have enough comparable context to compact supporting signals for the current checkout.",
      ],
    },
    shadow_cutover_rollout_preview: {
      tone: "neutral",
      rollout_status: "insufficient_data",
      status_label: "Shadow cutover rollout preview needs more context",
      readiness_label: "Selection missing",
      summary_label: "Shadow cutover summary preview needs more context",
      evidence_label: "Shadow cutover evidence preview needs more context",
      recommendation_label: "shadow recommendation insufficient data",
      rollout_reason_label: "Comparable shadow rollout context is still incomplete",
      detail_label:
        "summary insufficient data · evidence insufficient data · readiness insufficient data · blockers insufficient data · next steps insufficient data · recommendation insufficient data",
      headline_messages: [
        "Rollout remains preview-only because the current shadow cutover picture still lacks enough comparable context.",
        "Readiness preview still needs more comparable shadow context.",
      ],
      hint_messages: [
        "Read-only shadow cutover rollout preview only. This compact block aggregates already materialized summary, evidence, readiness, blockers, next-step, and recommendation previews into a rollout-oriented picture for observation only.",
      ],
    },
    shadow_cutover_gate_preview: {
      tone: "neutral",
      gate_preview_status: "insufficient_data",
      status_label: "Shadow cutover gate preview needs more context",
      readiness_label: "Selection missing",
      summary_label: "Shadow cutover summary preview needs more context",
      rollout_label: "Shadow cutover rollout preview needs more context",
      aligned_gate_count_label: null,
      blocked_gate_count_label: null,
      insufficient_gate_count_label: "7 insufficient gates visible",
      gate_items: [
        {
          code: "shipping_option_parity",
          gate_status: "insufficient_data",
          label: "Shipping-option parity still needs comparable context",
          detail_label:
            "Parity preview activates only when checkout already has a committed legacy shipping method.",
        },
      ],
      headline_messages: [
        "7 insufficient gates visible",
        "Readiness preview still needs more comparable shadow context.",
      ],
      hint_messages: [
        "Read-only shadow cutover gate preview only. Each gate below simply restates already materialized parity, readiness, blocker, recommendation, evidence, and rollout previews for future cutover decision-making only.",
      ],
    },
    shadow_cutover_decision_preview: {
      tone: "neutral",
      decision_status: "insufficient_data",
      status_label: "Shadow cutover decision preview needs more context",
      readiness_label: "Selection missing",
      summary_label: "Shadow cutover summary preview needs more context",
      evidence_label: "Shadow cutover evidence preview needs more context",
      rollout_label: "Shadow cutover rollout preview needs more context",
      gate_label: "Shadow cutover gate preview needs more context",
      decision_reason_label: "7 insufficient gates visible",
      detail_label:
        "gate insufficient data · summary insufficient data · evidence insufficient data · rollout insufficient data · readiness insufficient data · blockers insufficient data · recommendation insufficient data",
      headline_messages: [
        "Current shadow cutover picture still lacks enough context for a fuller decision preview.",
      ],
      hint_messages: [
        "Read-only shadow cutover decision preview only. This compact block aggregates already materialized shadow summary, evidence, rollout, and gate previews into a pre-cutover decision verdict for planning only.",
      ],
    },
  })

  assert.deepEqual(insufficientPreview, {
    tone: "neutral",
    checklist_status: "insufficient_data",
    status_label: "Shadow cutover checklist preview needs more context",
    readiness_label: "Selection missing",
    summary_label: "Shadow cutover summary preview needs more context",
    decision_label: "Shadow cutover decision preview needs more context",
    ready_item_count_label: null,
    pending_item_count_label: null,
    blocked_item_count_label: null,
    insufficient_item_count_label: "7 insufficient checks visible",
    checklist_items: [
      {
        code: "readiness_contour",
        item_status: "insufficient_data",
        label: "Readiness contour still lacks enough context",
        detail_label:
          "Shadow-only cutover readiness preview does not yet have enough comparable context to claim future cutover readiness for this checkout.",
      },
      {
        code: "known_blockers",
        item_status: "insufficient_data",
        label: "Blocker picture still lacks enough context",
        detail_label:
          "Read-only shadow cutover blockers preview does not yet have enough comparable context to list blocker points for the current checkout.",
      },
      {
        code: "shadow_summary",
        item_status: "insufficient_data",
        label: "Shadow summary still lacks enough context",
        detail_label:
          "Read-only shadow cutover summary preview does not yet have enough comparable context to describe a future cutover summary for this checkout.",
      },
      {
        code: "supporting_evidence",
        item_status: "insufficient_data",
        label: "Supporting evidence still lacks enough context",
        detail_label:
          "Read-only shadow cutover evidence preview does not yet have enough comparable context to compact supporting signals for the current checkout.",
      },
      {
        code: "rollout_picture",
        item_status: "insufficient_data",
        label: "Rollout picture still lacks enough context",
        detail_label: "Comparable shadow rollout context is still incomplete",
      },
      {
        code: "gate_alignment",
        item_status: "insufficient_data",
        label: "Gate alignment still lacks enough context",
        detail_label: "7 insufficient gates visible",
      },
      {
        code: "decision_signal",
        item_status: "insufficient_data",
        label: "Decision picture still lacks enough context",
        detail_label: "7 insufficient gates visible",
      },
    ],
    hint_messages: [
      "Read-only shadow cutover checklist preview does not yet have enough comparable context to classify all pre-cutover checks for the current checkout.",
      "Current checkout still commits through the active legacy ApiShip flow. This block does not save, clear, switch, or commit anything.",
      "When checklist items say insufficient data, they simply reflect that already materialized shopper-safe shadow previews still lack comparable context.",
      "Read-only shadow cutover gate preview only. Each gate below simply restates already materialized parity, readiness, blocker, recommendation, evidence, and rollout previews for future cutover decision-making only.",
    ],
  })
})

test("buildDeliveryHubNeutralSelectionRehearsalModel reports aligned candidate without mutation intent", () => {
  const model = buildDeliveryHubNeutralSelectionRehearsalModel({
    settings: {
      ok: true,
      settings: {
        enabled: true,
        status: "available",
        summary: {
          enabled_connection_count: 1,
          ready_connection_count: 1,
          default_connection_label: "Primary",
          modality_codes: ["warehouse_to_pickup_point"],
          supports_pickup_points: true,
          supports_pickup_windows: true,
          supports_dropoff: false,
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
    },
    quotes: {
      ok: true,
      quotes: [
        {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          mode_code: "warehouse_to_pickup_point",
          quote_reference: { id: "quote_ref_1", version: 2 },
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: 1,
          delivery_eta_max: 2,
          pickup_point_required: true,
          pickup_point_ids: ["point_1"],
          pickup_window_required: true,
        },
      ],
    },
    pickup_points: {
      ok: true,
      points: [
        {
          provider_point_id: "point_1",
          provider_point_code: "code_1",
          name: "North pickup point",
          address: "Main street 1",
          city: "Moscow",
          region: null,
          postal_code: null,
          lat: null,
          lng: null,
          is_origin_dropoff_allowed: false,
          is_destination_pickup_allowed: true,
          payment_methods: [],
        },
      ],
    },
    pickup_windows: {
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
          label: "22 Apr · 10:00–14:00",
        },
      ],
    },
    readiness: {
      ok: true,
      cart_id: "cart_1",
      status: "ready",
      issues: [],
      selection: null,
      quote_context: null,
    },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "pickup_point",
      legacy_selection_fresh: true,
      legacy_method_label: "ApiShip pickup",
    },
  })
  const guard = evaluateDeliveryHubNeutralSelectionRehearsalActionability(model)

  assert.equal(model.status, "candidate_available")
  assert.equal(model.tone, "positive")
  assert.deepEqual(model.quote_reference, { id: "quote_ref_1", version: 2 })
  assert.equal(model.quote_reference_label, "backend quote reference v2")
  assert.equal(model.pickup_point_label, "North pickup point")
  assert.equal(model.pickup_window_label, "22 Apr · 10:00–14:00")
  assert.equal(guard.can_shape_future_selection_body, true)
  assert.equal(guard.dry_run_only, true)
  assert.equal(guard.mutation_intent, false)
})

test("neutral selection rehearsal blocks missing quote reference, pickup point, pickup window, readiness, and legacy mismatch", () => {
  const missingQuote = buildDeliveryHubNeutralSelectionRehearsalModel({
    pickup_points: { ok: true, points: [] },
    readiness: {
      ok: true,
      cart_id: "cart_1",
      status: "missing_selection",
      issues: [],
      selection: null,
      quote_context: null,
    },
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: true,
      legacy_flow_kind: "pickup_point",
      legacy_selection_fresh: true,
      legacy_method_label: "ApiShip pickup",
    },
  })
  assert.equal(missingQuote.status, "insufficient_data")
  assert.ok(missingQuote.blocker_codes.includes("missing_quote"))
  assert.ok(missingQuote.blocker_codes.includes("missing_quote_reference"))

  const missingPickupPoint = buildDeliveryHubNeutralSelectionRehearsalModel({
    quotes: {
      ok: true,
      quotes: [
        {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          mode_code: "warehouse_to_pickup_point",
          quote_reference: { id: "quote_ref_pickup", version: 1 },
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: null,
          delivery_eta_max: null,
          pickup_point_required: true,
          pickup_point_ids: [],
          pickup_window_required: false,
        },
      ],
    },
    pickup_points: { ok: true, points: [] },
  })
  assert.equal(missingPickupPoint.status, "insufficient_data")
  assert.ok(missingPickupPoint.blocker_codes.includes("missing_pickup_point"))

  const missingPickupWindow = buildDeliveryHubNeutralSelectionRehearsalModel({
    quotes: {
      ok: true,
      quotes: [
        {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          mode_code: "warehouse_to_pickup_point",
          quote_reference: { id: "quote_ref_window", version: 1 },
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: null,
          delivery_eta_max: null,
          pickup_point_required: false,
          pickup_point_ids: [],
          pickup_window_required: true,
        },
      ],
    },
    pickup_windows: { ok: true, pickup_windows: [] },
  })
  assert.equal(missingPickupWindow.status, "insufficient_data")
  assert.ok(missingPickupWindow.blocker_codes.includes("missing_pickup_window"))

  const degradedReadiness = buildDeliveryHubNeutralSelectionRehearsalModel({
    quotes: {
      ok: true,
      quotes: [
        {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          mode_code: "warehouse_to_pickup_point",
          quote_reference: { id: "quote_ref_blocked", version: 1 },
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: null,
          delivery_eta_max: null,
          pickup_point_required: false,
          pickup_point_ids: [],
          pickup_window_required: false,
        },
      ],
    },
    readiness: {
      ok: true,
      cart_id: "cart_1",
      status: "invalid_selection",
      issues: [{ code: "selection_invalid", message: "Selection invalid", field: null }],
      selection: null,
      quote_context: null,
    },
  })
  assert.equal(degradedReadiness.status, "blocked")
  assert.ok(degradedReadiness.blocker_codes.includes("readiness_blocked"))

  const legacyMismatch = buildDeliveryHubNeutralSelectionRehearsalModel({
    quotes: {
      ok: true,
      quotes: [
        {
          carrier_code: "neutral_carrier",
          carrier_label: "Neutral Carrier",
          mode_code: "warehouse_to_pickup_point",
          quote_reference: { id: "quote_ref_mismatch", version: 1 },
          amount: 499,
          currency_code: "RUB",
          delivery_eta_min: null,
          delivery_eta_max: null,
          pickup_point_required: false,
          pickup_point_ids: [],
          pickup_window_required: false,
        },
      ],
    },
    selection_parity: {
      tone: "warning",
      parity_status: "reference_mismatch",
      status_label: "Mismatch",
      legacy_method_label: "ApiShip pickup",
      legacy_modality_label: "Pickup point",
      neutral_modality_label: "Pickup point",
      legacy_reference_label: "A",
      neutral_reference_label: "B",
      readiness_label: "Selection ready",
      hint_messages: [],
    },
  })
  assert.equal(legacyMismatch.status, "blocked")
  assert.ok(legacyMismatch.blocker_codes.includes("legacy_parity_mismatch"))
})

test("neutral selection rehearsal reports legacy-only and preserves no-leak guarantees", () => {
  const model = buildDeliveryHubNeutralSelectionRehearsalModel({
    legacy_context: {
      active_commit_path: "legacy_apiship",
      legacy_is_committed: false,
      legacy_flow_kind: null,
      legacy_selection_fresh: false,
      legacy_method_label: null,
    },
  })
  const serialized = JSON.stringify(model).toLowerCase()

  assert.equal(model.status, "legacy_only")
  assert.equal(evaluateDeliveryHubNeutralSelectionRehearsalActionability(model).verdict, "dry_run_legacy_only")
  for (const forbidden of [
    "provider_code",
    "raw_reference",
    "quote_key",
    "credentials",
    "credential",
    "secret",
    "token",
    "yandex",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden)
  }
})

test("delivery hub selection cut-in wires only neutral save/clear helpers and keeps util no-network", () => {
  const shippingSource = readFileSync(
    new URL("../../modules/checkout/components/shipping/index.tsx", import.meta.url),
    "utf8"
  )
  const utilSource = readFileSync(new URL("./delivery-hub.ts", import.meta.url), "utf8")

  assert.equal(/saveDeliveryHubSelection\s*[,(]/.test(shippingSource), true)
  assert.equal(/clearDeliveryHubSelection\s*[,(]/.test(shippingSource), true)
  assert.equal(/buildDeliveryHubSelectionSaveCutInPayload\s*\(/.test(shippingSource), true)
  assert.equal(/saveDeliveryHubSelection\s*\(/.test(utilSource), false)
  assert.equal(/clearDeliveryHubSelection\s*\(/.test(utilSource), false)
  assert.equal(/setShippingMethod\s*\(/.test(utilSource), false)
  assert.equal(/setShippingMethod\s*\(\s*\{[^}]*delivery/i.test(shippingSource), false)
  assert.equal(/createFulfillment\s*\(/.test(shippingSource + utilSource), false)
  assert.equal(/activation[_ -]?ready/i.test(utilSource), false)
})
