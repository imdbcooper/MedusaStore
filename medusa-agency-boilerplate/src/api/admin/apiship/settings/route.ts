import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import {
  getApiShipPgConnection,
  getApiShipSettings,
  upsertApiShipSettings,
} from "../../../../modules/apiship-settings"

export const AdminUpdateApiShipSettingsSchema = z.object({
  enabled: z.boolean(),
  modes: z.object({
    door_to_door: z.boolean(),
    dropoff_to_door: z.boolean(),
    door_to_point: z.boolean(),
    dropoff_to_point: z.boolean(),
  }),
})

type AdminUpdateApiShipSettingsBody = z.infer<typeof AdminUpdateApiShipSettingsSchema>

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const pgConnection = getApiShipPgConnection(req.scope)
  const settings = await getApiShipSettings(pgConnection)

  res.status(200).json({
    settings,
  })
}

export async function POST(
  req: AuthenticatedMedusaRequest<AdminUpdateApiShipSettingsBody>,
  res: MedusaResponse
) {
  const pgConnection = getApiShipPgConnection(req.scope)
  const settings = await upsertApiShipSettings(pgConnection, req.validatedBody)

  res.status(200).json({
    settings,
  })
}
