import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { buildApishipOperatorDiagnosticsSnapshot } from "../../../../modules/apiship-operator-diagnostics"

export async function GET(
  _req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  res.status(200).json(buildApishipOperatorDiagnosticsSnapshot())
}
