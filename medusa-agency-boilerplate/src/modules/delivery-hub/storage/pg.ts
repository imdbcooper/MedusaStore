import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export type RawSqlRowsResult<T> = {
  rows?: T[]
  rowCount?: number
  rowsAffected?: number | number[]
}

export type DeliveryHubPgConnection = {
  raw: <T = unknown>(sql: string, bindings?: unknown[]) => Promise<RawSqlRowsResult<T>>
}

export function getDeliveryHubPgConnection(container: any) {
  return container.resolve(
    ContainerRegistrationKeys.PG_CONNECTION
  ) as DeliveryHubPgConnection
}

export function getRawRows<T>(result: RawSqlRowsResult<T>) {
  return Array.isArray(result?.rows) ? result.rows : []
}
