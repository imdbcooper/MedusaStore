import crypto from "node:crypto"
import {
  DELIVERY_HUB_CONNECTION_STATUS,
  DELIVERY_HUB_CREDENTIALS_STATE,
  DELIVERY_HUB_LOG_KIND,
  DELIVERY_HUB_MODE_CODE,
} from "./constants"
import type {
  DeliveryConnectionPublic,
  DeliveryConnectionRecord,
  DeliveryConnectionUpsertInput,
} from "./domain/connection"
import type { DeliveryTestQuoteInput } from "./domain/test-dto"
import { DeliveryHubError, isDeliveryHubError } from "./errors"
import { getDeliveryHubAdapter, listDeliveryHubProviders } from "./registry"
import {
  createCredentialsFingerprint,
  encryptDeliveryHubCredentials,
  getDeliveryHubEncryptionState,
} from "./security/encryption"
import { redactRecord } from "./security/redaction"
import {
  getDeliveryConnectionById,
  listDeliveryConnections,
  upsertDeliveryConnection,
} from "./storage/connections-repository"
import {
  appendDeliveryEventLog,
  listDeliveryEventLogs,
  type DeliveryHubEventLogRecord,
} from "./storage/event-log-repository"
import { type DeliveryHubPgConnection } from "./storage/pg"
import { serializeDeliveryConnectionPublic } from "./storage/serializers"

export type DeliveryHubEventLogListInput = {
  connection_id?: string | null
  provider_code?: string | null
  limit?: number | null
}

export type DeliveryHubEventLogPublic = DeliveryHubEventLogRecord

export class DeliveryHubService {
  constructor(private readonly pg: DeliveryHubPgConnection) {}

  async listProviders() {
    return listDeliveryHubProviders()
  }

  async listConnections(): Promise<DeliveryConnectionPublic[]> {
    const records = await listDeliveryConnections(this.pg)
    return records.map(serializeDeliveryConnectionPublic)
  }

  async listEventLogs(input: DeliveryHubEventLogListInput = {}): Promise<DeliveryHubEventLogPublic[]> {
    const logs = await listDeliveryEventLogs(this.pg, {
      connection_id: input.connection_id,
      provider_code: input.provider_code,
      limit: input.limit,
    })

    return logs.map((log) => ({
      ...log,
      request_summary: redactRecord(log.request_summary),
      response_summary: redactRecord(log.response_summary),
    }))
  }

  async createConnection(input: DeliveryConnectionUpsertInput) {
    return this.saveConnection(input)
  }

  async updateConnection(id: string, input: Partial<DeliveryConnectionUpsertInput>) {
    const current = await this.requireConnection(id)

    return this.saveConnection(
      {
        id: current.id,
        provider_code: input.provider_code ?? current.provider_code,
        name: input.name ?? current.name,
        status: input.status ?? current.status,
        mode: input.mode ?? current.mode,
        enabled: input.enabled ?? current.enabled,
        country_code: input.country_code ?? current.country_code,
        credentials: input.credentials,
        config: input.config ?? current.config,
        metadata: input.metadata ?? current.metadata,
      },
      current
    )
  }

  async testConnection(id: string, input?: { include_pickup_points?: boolean }) {
    const connection = await this.requireConnection(id)
    const adapter = getDeliveryHubAdapter(connection.provider_code)
    const correlationId = crypto.randomUUID()

    try {
      const result = await adapter.testConnection(
        this.buildAdapterContext(connection, correlationId)
      )
      let pickupPointsCount: number | null = null

      if (input?.include_pickup_points) {
        const points = await adapter.listPickupPoints(
          this.buildAdapterContext(connection, correlationId),
          {
            country_code: connection.country_code,
          }
        )
        pickupPointsCount = points.length
      }

      await this.appendLog({
        connection,
        kind: DELIVERY_HUB_LOG_KIND.connectionTest,
        correlation_id: correlationId,
        success: true,
        request_summary: {
          include_pickup_points: !!input?.include_pickup_points,
        },
        response_summary: {
          ...result.diagnostics,
          pickup_points_count: pickupPointsCount,
        },
      })

      await upsertDeliveryConnection(this.pg, {
        id: connection.id,
        provider_code: connection.provider_code,
        name: connection.name,
        status: DELIVERY_HUB_CONNECTION_STATUS.active,
        mode: connection.mode,
        enabled: connection.enabled,
        country_code: connection.country_code,
        config: connection.config,
        metadata: connection.metadata,
        credentials_envelope: connection.credentials_envelope,
        credentials_state: connection.credentials_state,
        credentials_fingerprint: connection.credentials_fingerprint,
        credentials_last_validated_at: new Date().toISOString(),
        credentials_last_error_code: null,
      })

      return {
        ...result,
        diagnostics: {
          ...result.diagnostics,
          pickup_points_count: pickupPointsCount,
          correlation_id: correlationId,
        },
      }
    } catch (error) {
      const normalized = normalizeDeliveryHubError(error)

      await this.appendLog({
        connection,
        kind: DELIVERY_HUB_LOG_KIND.connectionTest,
        correlation_id: correlationId,
        success: false,
        error_code: normalized.code,
        request_summary: {
          include_pickup_points: !!input?.include_pickup_points,
        },
        response_summary: redactRecord({
          message: normalized.message,
          details: normalized.details ?? {},
        }),
      })

      await this.materializeConnectionFailure(connection, normalized, {
        status: DELIVERY_HUB_CONNECTION_STATUS.error,
      })

      throw normalized
    }
  }

  async testQuote(input: DeliveryTestQuoteInput) {
    const connection = await this.requireConnection(input.connection_id)
    const adapter = getDeliveryHubAdapter(connection.provider_code)
    const correlationId = crypto.randomUUID()

    try {
      const quotes =
        input.mode_code === DELIVERY_HUB_MODE_CODE.warehouseToPickupPoint
          ? await adapter.quoteWarehouseToPickupPoint(
              this.buildAdapterContext(connection, correlationId),
              {
                warehouse_id: requireString(input.warehouse_id, "warehouse_id"),
                destination_point_id: input.destination_point_id,
                interval_utc: input.interval_utc ?? null,
                currency_code: input.currency_code,
                items: input.items,
              }
            )
          : await adapter.quoteDropoffPointToPickupPoint(
              this.buildAdapterContext(connection, correlationId),
              {
                origin_point_id: requireString(input.origin_point_id, "origin_point_id"),
                destination_point_id: input.destination_point_id,
                currency_code: input.currency_code,
                items: input.items,
              }
            )

      await this.appendLog({
        connection,
        kind: DELIVERY_HUB_LOG_KIND.quote,
        correlation_id: correlationId,
        success: true,
        request_summary: redactRecord({
          mode_code: input.mode_code,
          destination_point_id: input.destination_point_id,
          origin_point_id: input.origin_point_id ?? null,
          warehouse_id: input.warehouse_id ?? null,
          interval_utc: input.interval_utc ?? null,
        }),
        response_summary: {
          quotes_count: quotes.length,
          quote_keys: quotes.map((quote) => quote.quote_key),
        },
      })

      return {
        ok: true,
        connection: serializeDeliveryConnectionPublic(connection),
        quotes,
        correlation_id: correlationId,
      }
    } catch (error) {
      const normalized = normalizeDeliveryHubError(error)

      await this.appendLog({
        connection,
        kind: DELIVERY_HUB_LOG_KIND.quote,
        correlation_id: correlationId,
        success: false,
        error_code: normalized.code,
        request_summary: redactRecord({
          mode_code: input.mode_code,
          destination_point_id: input.destination_point_id,
          origin_point_id: input.origin_point_id ?? null,
          warehouse_id: input.warehouse_id ?? null,
        }),
        response_summary: {
          message: normalized.message,
          details: normalized.details ?? {},
        },
      })

      await this.materializeConnectionFailure(connection, normalized)
 
      throw normalized
    }
  }

  private async saveConnection(
    input: DeliveryConnectionUpsertInput,
    current?: DeliveryConnectionRecord | null
  ) {
    getDeliveryHubAdapter(input.provider_code)

    const encryptionState = getDeliveryHubEncryptionState()
    const hasNewCredentials = !!input.credentials?.token?.trim()

    const credentialsEnvelope = hasNewCredentials
      ? encryptDeliveryHubCredentials(input.credentials!, encryptionState)
      : current?.credentials_envelope

    const credentialsFingerprint = hasNewCredentials
      ? createCredentialsFingerprint(input.credentials!)
      : current?.credentials_fingerprint ?? null

    const credentialsState = hasNewCredentials
      ? DELIVERY_HUB_CREDENTIALS_STATE.sealed
      : current?.credentials_state ??
        (encryptionState.mode === "sealed"
          ? DELIVERY_HUB_CREDENTIALS_STATE.empty
          : DELIVERY_HUB_CREDENTIALS_STATE.disabled)

    const record = await upsertDeliveryConnection(this.pg, {
      id: input.id,
      provider_code: input.provider_code,
      name: input.name,
      status: input.status ?? current?.status ?? DELIVERY_HUB_CONNECTION_STATUS.draft,
      mode: input.mode,
      enabled: input.enabled ?? current?.enabled ?? false,
      country_code: input.country_code ?? current?.country_code,
      config: input.config ?? current?.config ?? {},
      metadata: input.metadata ?? current?.metadata ?? {},
      credentials_envelope: credentialsEnvelope,
      credentials_state: credentialsState,
      credentials_fingerprint: credentialsFingerprint,
      credentials_last_validated_at: hasNewCredentials
        ? null
        : current?.credentials_last_validated_at ?? null,
      credentials_last_error_code: hasNewCredentials
        ? null
        : current?.credentials_last_error_code ?? null,
    })

    if (hasNewCredentials || (!current && credentialsState === DELIVERY_HUB_CREDENTIALS_STATE.disabled)) {
      await this.appendLog({
        connection: record,
        kind: DELIVERY_HUB_LOG_KIND.credentials,
        correlation_id: crypto.randomUUID(),
        success: hasNewCredentials,
        error_code: null,
        request_summary: {
          provider_code: record.provider_code,
        },
        response_summary: {
          credentials_state: record.credentials_state,
          credentials_present: !!record.credentials_envelope,
        },
      })
    }

    return serializeDeliveryConnectionPublic(record)
  }

  private async requireConnection(id: string): Promise<DeliveryConnectionRecord> {
    const normalizedId = id?.trim()

    if (!normalizedId) {
      throw new DeliveryHubError({
        code: "DELIVERY_HUB_VALIDATION_ERROR",
        message: 'Field "id" is required',
        status: 400,
        details: { field: "id" },
      })
    }

    const connection = await getDeliveryConnectionById(this.pg, normalizedId)

    if (!connection) {
      throw new DeliveryHubError({
        code: "DELIVERY_HUB_NOT_FOUND",
        message: `Delivery Hub connection "${normalizedId}" was not found`,
        status: 404,
      })
    }

    return connection
  }

  private buildAdapterContext(connection: DeliveryConnectionRecord, correlation_id: string) {
    return {
      connection,
      correlation_id,
    }
  }

  private async appendLog(input: {
    connection: DeliveryConnectionRecord
    kind: string
    correlation_id: string
    success: boolean
    request_summary: Record<string, unknown>
    response_summary: Record<string, unknown>
    error_code?: string | null
  }) {
    await appendDeliveryEventLog(this.pg, {
      connection_id: input.connection.id,
      provider_code: input.connection.provider_code,
      kind: input.kind,
      correlation_id: input.correlation_id,
      success: input.success,
      request_summary: redactRecord(input.request_summary),
      response_summary: redactRecord(input.response_summary),
      error_code: input.error_code ?? null,
    })
  }

  private async materializeConnectionFailure(
    connection: DeliveryConnectionRecord,
    error: DeliveryHubError,
    input?: {
      status?: DeliveryConnectionRecord["status"]
    }
  ) {
    const nextCredentialsState =
      error.code === "DELIVERY_HUB_CREDENTIALS_INVALID"
        ? DELIVERY_HUB_CREDENTIALS_STATE.invalid
        : connection.credentials_state

    const nextStatus =
      input?.status ??
      (nextCredentialsState === DELIVERY_HUB_CREDENTIALS_STATE.invalid
        ? DELIVERY_HUB_CONNECTION_STATUS.error
        : connection.status)

    const nextValidatedAt =
      input?.status || error.code === "DELIVERY_HUB_CREDENTIALS_INVALID"
        ? null
        : connection.credentials_last_validated_at

    const shouldPersist =
      nextStatus !== connection.status ||
      nextCredentialsState !== connection.credentials_state ||
      nextValidatedAt !== connection.credentials_last_validated_at ||
      connection.credentials_last_error_code !== error.code

    if (!shouldPersist) {
      return connection
    }

    return upsertDeliveryConnection(this.pg, {
      id: connection.id,
      provider_code: connection.provider_code,
      name: connection.name,
      status: nextStatus,
      mode: connection.mode,
      enabled: connection.enabled,
      country_code: connection.country_code,
      config: connection.config,
      metadata: connection.metadata,
      credentials_envelope: connection.credentials_envelope,
      credentials_state: nextCredentialsState,
      credentials_fingerprint: connection.credentials_fingerprint,
      credentials_last_validated_at: nextValidatedAt,
      credentials_last_error_code: error.code,
    })
  }
}

export function createDeliveryHubService(pg: DeliveryHubPgConnection) {
  return new DeliveryHubService(pg)
}

function normalizeDeliveryHubError(error: unknown) {
  if (isDeliveryHubError(error)) {
    return error
  }

  return new DeliveryHubError({
    code: "DELIVERY_HUB_PROVIDER_ERROR",
    message: error instanceof Error ? error.message : "Unknown Delivery Hub error",
    status: 502,
  })
}

function requireString(value: string | null | undefined, field: string) {
  if (typeof value === "string" && value.trim()) {
    return value.trim()
  }

  throw new DeliveryHubError({
    code: "DELIVERY_HUB_VALIDATION_ERROR",
    message: `Field "${field}" is required`,
    status: 400,
    details: {
      field,
    },
  })
}
