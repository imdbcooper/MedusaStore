import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  getApiShipPgConnection,
  getApiShipSettings,
  projectApiShipSettingsForStore,
} from "../../../../modules/apiship-settings"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const pgConnection = getApiShipPgConnection(req.scope)
  const settings = await getApiShipSettings(pgConnection)

  res.status(200).json({
    settings: projectApiShipSettingsForStore(settings),
  })
}
