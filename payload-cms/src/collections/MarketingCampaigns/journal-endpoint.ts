import type { Endpoint, PayloadRequest } from 'payload'

/**
 * GET /api/marketing-campaigns/:id/journal
 *
 * Read-only proxy from Payload to Medusa's
 * `GET /admin/marketing/campaigns/:medusaId`. Returns the `journal` array
 * unchanged so the Payload UI can render the delivery log without going
 * through the Medusa Admin app or talking to Postgres directly.
 *
 * Behaviour:
 *   - 401 if the request is not authenticated as a Payload admin user.
 *   - 400 if the route param is missing.
 *   - 404 if the Payload doc does not exist.
 *   - 200 `{ ok: true, journal: [] }` if the campaign has no
 *     `medusaCampaignId` yet (the launch never happened or is still
 *     in-flight). The UI uses this to render an empty-state.
 *   - 502 if Medusa is unreachable / returns an error. The original
 *     Medusa error code is forwarded for debugging.
 */

type CampaignDoc = {
  id: string | number
  medusaCampaignId?: string | null
}

type MedusaCampaignResponse = {
  ok?: boolean
  campaign?: unknown
  journal?: unknown[]
}

const COLLECTION_SLUG = 'marketing-campaigns'

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function loadCampaign(
  req: PayloadRequest,
  id: string | number,
): Promise<CampaignDoc | null> {
  try {
    const doc = await req.payload.findByID({
      collection: COLLECTION_SLUG,
      id,
      overrideAccess: true,
      depth: 0,
      req,
    })
    return doc as CampaignDoc
  } catch {
    return null
  }
}

export const journalEndpoint: Omit<Endpoint, 'root'> = {
  method: 'get',
  path: '/:id/journal',
  handler: async (req) => {
    if (!req.user) {
      return jsonResponse({ ok: false, error: 'unauthorized' }, 401)
    }

    const rawId = req.routeParams?.id
    const id =
      typeof rawId === 'string'
        ? rawId
        : typeof rawId === 'number'
          ? rawId
          : null

    if (id === null || id === '') {
      return jsonResponse({ ok: false, error: 'campaign_id_required' }, 400)
    }

    const doc = await loadCampaign(req, id)
    if (!doc) {
      return jsonResponse({ ok: false, error: 'campaign_not_found' }, 404)
    }

    if (!doc.medusaCampaignId) {
      // Campaign was never launched — surface an empty journal rather
      // than a 404 so the UI can show "ничего не отправлено".
      return jsonResponse({ ok: true, journal: [] }, 200)
    }

    // The medusa admin client is loaded lazily — see the same comment in
    // `launch-endpoint.ts`. `import 'server-only'` would otherwise blow up
    // when Payload config is loaded by the standalone Node CLI scripts
    // (`generate:types`, `generate:importmap`).
    const { medusaAdminFetch } = await import('../../lib/medusa-admin-client.ts')

    const result = await medusaAdminFetch<MedusaCampaignResponse>(
      `/admin/marketing/campaigns/${encodeURIComponent(doc.medusaCampaignId)}`,
      { method: 'GET' },
    )

    if (!result.ok) {
      return jsonResponse(
        {
          ok: false,
          error: 'medusa_journal_fetch_failed',
          medusa_error: result.error,
          ...(result.message ? { message: result.message } : {}),
        },
        502,
      )
    }

    const journal = Array.isArray(result.data?.journal) ? result.data!.journal : []
    return jsonResponse({ ok: true, journal }, 200)
  },
}
