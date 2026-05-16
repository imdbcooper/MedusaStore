import type { Endpoint, PayloadRequest } from 'payload'
import type { RateLimitChecker } from '../../lib/rate-limit.ts'

/**
 * POST /api/marketing-campaigns/:id/launch
 *
 * Synchronous launcher for a Payload marketing-campaigns draft. The full flow
 * is documented in `plans/marketing-ui-payload-cms.md` §8. In short:
 *
 *   1. Authenticated Payload admin user only.
 *   2. Load the draft via `payload.findByID(..., overrideAccess: true)`.
 *   3. Refuse if the campaign already has a Medusa id or is not in draft.
 *   4. Flip status → 'launching' so the UI blocks parallel clicks.
 *   5. Re-read the doc as a lite idempotency guard against a double click
 *      racing the previous step (a full Idempotency-Key is Phase 1.1).
 *   6. POST /admin/marketing/campaigns to create the Medusa campaign and
 *      persist `medusaCampaignId` immediately (so a failed launch still
 *      keeps the link to the Medusa-side record).
 *   7. POST /admin/marketing/campaigns/:medusaId to run the workflow.
 *   8. Persist totals + status + `launchResult` snapshot.
 *
 * On any uncaught error the document is forced into `status='failed'` so it
 * never gets stuck in `launching`.
 */

type ManualCustomerId = { id?: string | null }

type CampaignDoc = {
  id: string | number
  name: string
  subject: string
  audienceType: 'all' | 'email_consent' | 'manual'
  audienceCustomerIds?: ManualCustomerId[] | null
  htmlContent: string
  plainText?: string | null
  frequencyCapHours?: number | null
  frequencyCapCount?: number | null
  status: 'draft' | 'launching' | 'completed' | 'failed'
  medusaCampaignId?: string | null
  idempotencyKey?: string | null
}

type MedusaCreateResponse = {
  ok?: boolean
  campaign?: {
    id?: string
  }
}

/**
 * Medusa returns the workflow output as `{ ok: true, result: WorkflowOutput }`,
 * and the workflow itself wraps the step output as `WorkflowResponse({ result })`,
 * so the actual `SendMarketingCampaignResult` lives at `result.result`.
 *
 * Earlier versions of this endpoint read `data.result.status` directly, which
 * always landed on `undefined` and forced `finalStatus = 'failed'` with all
 * totals at 0 — even when the workflow finished `completed` with real numbers.
 */
type MedusaLaunchResult = {
  status?: 'completed' | 'failed'
  reason?: string | null
  campaign_id?: string
  campaign_status?: string | null
  total_selected?: number
  total_sent?: number
  total_skipped?: number
  total_failed?: number
  launched_at?: string | null
  journal?: unknown[]
}

type MedusaLaunchResponse = {
  ok?: boolean
  result?: {
    result?: MedusaLaunchResult
  }
}

const COLLECTION_SLUG = 'marketing-campaigns'

/**
 * Per-user sliding-window limiter. Phase 1.1 spec: 3 launch requests per
 * 60 seconds. Lazily instantiated on first request so that CLI scripts
 * (`generate:types`, `generate:importmap`, `migrate`) do not pull in the
 * `server-only` import via `lib/rate-limit.ts` when Payload config is
 * evaluated outside the Next.js runtime — same pattern as
 * `medusa-admin-client.ts`. The bucket then lives for the lifetime of
 * the Payload process.
 */
let launchRateLimitChecker: RateLimitChecker | null = null
async function getLaunchRateLimit(): Promise<RateLimitChecker> {
  if (launchRateLimitChecker) return launchRateLimitChecker
  const { createRateLimit } = await import('../../lib/rate-limit.ts')
  launchRateLimitChecker = createRateLimit({ windowMs: 60_000, max: 3 })
  return launchRateLimitChecker
}

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key'
const IDEMPOTENCY_KEY_MAX_LENGTH = 200

function jsonResponse(
  payload: unknown,
  status: number,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(extraHeaders ?? {}),
    },
  })
}

function readIdempotencyKey(req: PayloadRequest): string | null {
  const headers = req.headers
  if (!headers || typeof headers.get !== 'function') return null
  const raw = headers.get(IDEMPOTENCY_KEY_HEADER)
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.length > IDEMPOTENCY_KEY_MAX_LENGTH) return null
  return trimmed
}

function summariseDoc(doc: CampaignDoc) {
  return {
    status: doc.status,
    medusaStatus: undefined as string | null | undefined,
    totals: {
      // Use loose `any` reads — these are optional on `CampaignDoc` but the
      // Medusa-side flow always populates them. Tests stay green even
      // before Phase 4 changes the shape.
      totalSelected: 0,
      totalSent: 0,
      totalSkipped: 0,
      totalFailed: 0,
    },
  }
}

function manualCustomerIds(rows?: ManualCustomerId[] | null): string[] {
  if (!Array.isArray(rows)) return []
  return rows
    .map((row) => (typeof row?.id === 'string' ? row.id.trim() : ''))
    .filter((value): value is string => value.length > 0)
}

async function loadCampaign(req: PayloadRequest, id: string | number): Promise<CampaignDoc | null> {
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

async function markFailed(
  req: PayloadRequest,
  id: string | number,
  message: string,
  partial: Partial<CampaignDoc> = {},
): Promise<void> {
  try {
    await req.payload.update({
      collection: COLLECTION_SLUG,
      id,
      overrideAccess: true,
      req,
      data: {
        ...partial,
        status: 'failed',
        lastError: message,
      },
    })
  } catch (err) {
    req.payload.logger?.error?.(
      `[marketing-campaigns] failed to persist failure state for campaign=${String(id)}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
  }
}

export const launchEndpoint: Omit<Endpoint, 'root'> = {
  method: 'post',
  path: '/:id/launch',
  handler: async (req) => {
    // 1. Auth — only authenticated Payload admin users may launch.
    if (!req.user) {
      return jsonResponse({ ok: false, error: 'unauthorized' }, 401)
    }

    // 2. Per-user rate limit (3 / 60s). Cheap, in-memory, resets on restart.
    const userId = String(req.user.id ?? '')
    const limited = (await getLaunchRateLimit())(`launch:${userId}`)
    if (!limited.ok) {
      const retryAfterSec = Math.max(1, Math.ceil(limited.retryAfterMs / 1000))
      return jsonResponse(
        {
          ok: false,
          error: 'rate_limited',
          retry_after_ms: limited.retryAfterMs,
        },
        429,
        { 'Retry-After': String(retryAfterSec) },
      )
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

    // Optional `Idempotency-Key` header — if present we use it as a claim
    // token. A repeat with the same key is a no-op; a different key on a
    // claimed campaign is a 409.
    const incomingIdempotencyKey = readIdempotencyKey(req)

    // 2a. Load the document.
    const doc = await loadCampaign(req, id)
    if (!doc) {
      return jsonResponse({ ok: false, error: 'campaign_not_found' }, 404)
    }

    // 2b. Idempotent short-circuits before we even validate the draft.
    if (incomingIdempotencyKey && doc.idempotencyKey) {
      if (doc.idempotencyKey !== incomingIdempotencyKey) {
        return jsonResponse(
          { ok: false, error: 'idempotency_key_mismatch' },
          409,
        )
      }
      // Same key. If the campaign is already launched → return current
      // state with 200 so the client can refresh quietly. If it is still
      // `launching` we tell the client it is in progress (409).
      if (doc.status === 'completed' || doc.status === 'failed') {
        return jsonResponse(
          {
            ok: true,
            status: doc.status,
            medusaStatus: null,
            totals: summariseDoc(doc).totals,
            idempotent: true,
          },
          200,
        )
      }
      if (doc.status === 'launching') {
        return jsonResponse(
          { ok: false, error: 'campaign_in_progress' },
          409,
        )
      }
    }

    // 3. Validate.
    if (doc.medusaCampaignId) {
      return jsonResponse(
        { ok: false, error: 'campaign_already_launched' },
        409,
      )
    }
    if (doc.status !== 'draft') {
      return jsonResponse(
        { ok: false, error: 'campaign_not_in_draft', status: doc.status },
        409,
      )
    }

    if (!doc.htmlContent?.trim()) {
      return jsonResponse({ ok: false, error: 'html_content_required' }, 400)
    }

    if (
      doc.audienceType === 'manual' &&
      manualCustomerIds(doc.audienceCustomerIds).length === 0
    ) {
      return jsonResponse(
        { ok: false, error: 'manual_audience_requires_customer_ids' },
        400,
      )
    }

    // 4. Claim — flip status → 'launching' and (if provided) write our
    //    idempotency key. Payload `update` does not support WHERE-clauses,
    //    so we approximate atomicity by writing then re-reading: if a
    //    competing request raced us with a different key we will see the
    //    other key in the re-read and bail out.
    try {
      await req.payload.update({
        collection: COLLECTION_SLUG,
        id,
        overrideAccess: true,
        req,
        data: {
          status: 'launching',
          lastError: null,
          ...(incomingIdempotencyKey
            ? { idempotencyKey: incomingIdempotencyKey }
            : {}),
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'failed_to_lock_for_launch'
      return jsonResponse({ ok: false, error: 'lock_failed', message }, 500)
    }

    // 5. Idempotency check — re-read to guarantee that
    //    (a) a concurrent click did not already create a Medusa campaign,
    //    (b) our idempotency key actually won the race.
    const reread = await loadCampaign(req, id)
    if (reread?.medusaCampaignId) {
      return jsonResponse(
        { ok: false, error: 'campaign_already_launched' },
        409,
      )
    }
    if (
      incomingIdempotencyKey &&
      reread?.idempotencyKey &&
      reread.idempotencyKey !== incomingIdempotencyKey
    ) {
      // A concurrent request with a different key claimed first — refuse
      // so we do not double-launch. Note: this is best-effort, the
      // window is tiny but non-zero. A full distributed lock is Phase 4.
      return jsonResponse(
        { ok: false, error: 'idempotency_key_mismatch' },
        409,
      )
    }

    // 6. Build the Medusa create payload (plan §7).
    const createBody: Record<string, unknown> = {
      name: doc.name,
      channel: 'email',
      audience_type: doc.audienceType,
      audience_filters:
        doc.audienceType === 'manual'
          ? { customer_ids: manualCustomerIds(doc.audienceCustomerIds) }
          : { customer_ids: [] },
      template: 'marketing-v1',
      subject: doc.subject,
      content: {
        subject: doc.subject,
        html: doc.htmlContent,
        ...(doc.plainText?.trim() ? { text: doc.plainText } : {}),
      },
      ...(typeof doc.frequencyCapHours === 'number' && doc.frequencyCapHours > 0
        ? { frequency_cap_window_hours: doc.frequencyCapHours }
        : {}),
      ...(typeof doc.frequencyCapCount === 'number' && doc.frequencyCapCount > 0
        ? { frequency_cap_count: doc.frequencyCapCount }
        : {}),
    }

    // The medusa admin client is loaded lazily so `import 'server-only'`
    // (which guards the module against client bundles) does not run when
    // Payload config is evaluated by standalone Node scripts (`generate:types`,
    // `generate:importmap`). At request time we are already on the server.
    const { medusaAdminFetch } = await import('../../lib/medusa-admin-client.ts')

    // 7. Create the Medusa campaign.
    const createResult = await medusaAdminFetch<MedusaCreateResponse>(
      '/admin/marketing/campaigns',
      { method: 'POST', body: createBody },
    )

    if (!createResult.ok) {
      const message =
        createResult.message ||
        createResult.error ||
        'medusa_create_failed'
      await markFailed(req, id, `medusa_create_failed: ${message}`)
      return jsonResponse(
        { ok: false, error: 'medusa_create_failed', message },
        502,
      )
    }

    const medusaCampaignId = createResult.data?.campaign?.id
    if (!medusaCampaignId) {
      await markFailed(req, id, 'medusa_create_returned_no_id')
      return jsonResponse(
        { ok: false, error: 'medusa_create_returned_no_id' },
        502,
      )
    }

    // Persist the Medusa id immediately so we never lose the link.
    try {
      await req.payload.update({
        collection: COLLECTION_SLUG,
        id,
        overrideAccess: true,
        req,
        data: { medusaCampaignId },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'failed_to_persist_medusa_id'
      await markFailed(req, id, `persist_medusa_id_failed: ${message}`, {
        medusaCampaignId,
      })
      return jsonResponse(
        { ok: false, error: 'persist_medusa_id_failed', message },
        500,
      )
    }

    // 8. Trigger the launch workflow on Medusa.
    const launchResult = await medusaAdminFetch<MedusaLaunchResponse>(
      `/admin/marketing/campaigns/${medusaCampaignId}`,
      { method: 'POST', body: {}, timeoutMs: 60_000 },
    )

    if (!launchResult.ok) {
      const message =
        launchResult.message ||
        launchResult.error ||
        'medusa_launch_failed'
      await markFailed(req, id, `medusa_launch_failed: ${message}`)
      return jsonResponse(
        { ok: false, error: 'medusa_launch_failed', message },
        502,
      )
    }

    const result = launchResult.data?.result?.result
    const medusaStatus =
      typeof result?.campaign_status === 'string'
        ? result.campaign_status
        : typeof result?.status === 'string'
          ? result.status
          : null

    const totals = {
      totalSelected: typeof result?.total_selected === 'number' ? result.total_selected : 0,
      totalSent: typeof result?.total_sent === 'number' ? result.total_sent : 0,
      totalSkipped: typeof result?.total_skipped === 'number' ? result.total_skipped : 0,
      totalFailed: typeof result?.total_failed === 'number' ? result.total_failed : 0,
    }

    const finalStatus = result?.status === 'completed' ? 'completed' : 'failed'
    const launchedAt = (typeof result?.launched_at === 'string' ? result.launched_at : null) || new Date().toISOString()
    const completedAt = new Date().toISOString()

    const lastError =
      finalStatus === 'failed'
        ? (typeof result?.reason === 'string' && result.reason
            ? result.reason
            : 'campaign_failed_without_reason')
        : null

    try {
      await req.payload.update({
        collection: COLLECTION_SLUG,
        id,
        overrideAccess: true,
        req,
        data: {
          status: finalStatus,
          medusaStatus,
          ...totals,
          launchedAt,
          completedAt,
          lastError,
          launchResult: launchResult.data ?? null,
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'failed_to_persist_result'
      await markFailed(req, id, `persist_result_failed: ${message}`, {
        medusaCampaignId,
      })
      return jsonResponse(
        { ok: false, error: 'persist_result_failed', message },
        500,
      )
    }

    return jsonResponse(
      {
        ok: true,
        status: finalStatus,
        medusaStatus,
        totals,
      },
      200,
    )
  },
}
