import { z } from "@medusajs/framework/zod"

/**
 * Shared Zod schemas for the assistant-settings admin API (PR 3).
 *
 * These schemas live in a dedicated `_schemas.ts` so they can be imported
 * BOTH by the route handlers AND by the central
 * [`middlewares.ts`](medusa-agency-boilerplate/src/api/middlewares.ts:1)
 * registration without creating circular type imports between routes.
 *
 * Conventions match the existing admin routes (e.g.
 * [`AdminAssistantReindexSchema`](medusa-agency-boilerplate/src/api/admin/assistant/reindex/route.ts:6)):
 *   - `.strict()` on every object so unknown keys surface as 400 from
 *     `validateAndTransformBody` instead of being silently dropped;
 *   - PATCH schemas use `.partial().strict().refine(...)` to enforce
 *     "at least one field is required";
 *   - body types never include `expected_version` for module-layer fields —
 *     route handlers split it out before delegating.
 */

// ---------------------------------------------------------------------------
// LLM provider — POST/PATCH
// ---------------------------------------------------------------------------

/**
 * Strict body schema for `POST /admin/assistant/settings/providers`.
 *
 * Bounds mirror the validation already enforced by the module layer
 * ([`createLlmProvider`](medusa-agency-boilerplate/src/modules/assistant-settings.ts:776))
 * — defence in depth: the route layer rejects bad payloads early, the
 * module layer protects direct callers (subscribers, scripts, seed jobs).
 *
 * `base_url` is double-validated: `.url()` first (global format check), then
 * `.refine()` to require an `http(s)://` scheme — protects against
 * `file://`, `data:`, etc. that `URL` would otherwise accept.
 */
export const LlmProviderCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    base_url: z
      .string()
      .trim()
      .url()
      .refine((v) => /^https?:\/\//i.test(v), {
        message: "base_url must start with http:// or https://",
      }),
    api_key: z.string().min(1).max(512),
    model: z.string().trim().min(1).max(120),
    temperature: z.number().min(0).max(2).default(0.2),
    max_tokens: z.number().int().min(1).max(32_000).default(1024),
    top_p: z.number().min(0).max(1).nullable().optional(),
    timeout_ms: z.number().int().min(1000).max(120_000).default(30_000),
    request_headers: z.record(z.string(), z.string()).default({}),
    is_enabled: z.boolean().default(true),
    fallback_priority: z.number().int().min(1).max(20).nullable().optional(),
  })
  .strict()

export type LlmProviderCreateBody = z.infer<typeof LlmProviderCreateSchema>

/**
 * Strict body schema for `PATCH /admin/assistant/settings/providers/:id`.
 *
 * `.partial()` makes every field optional; `.refine` enforces that the
 * caller actually wants to change SOMETHING (an empty PATCH is rejected
 * with 400 instead of bumping `updated_at` for nothing).
 */
export const LlmProviderUpdateSchema = LlmProviderCreateSchema.partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: "at least one field is required",
  })

export type LlmProviderUpdateBody = z.infer<typeof LlmProviderUpdateSchema>

// ---------------------------------------------------------------------------
// LLM provider — POST `/test`
// ---------------------------------------------------------------------------

/**
 * Optional `prompt` query for the connectivity probe. The route handler
 * validates this manually (see `providers/[id]/test/route.ts`) instead of
 * routing through `validateAndTransformQuery`, which would force an
 * additional default-binding ceremony for an endpoint that already gracefully
 * defaults to `"ping"`.
 */
export const LlmProviderTestQuerySchema = z
  .object({
    prompt: z.string().min(1).max(500).optional(),
  })
  .strict()

export type LlmProviderTestQuery = z.infer<typeof LlmProviderTestQuerySchema>

// ---------------------------------------------------------------------------
// Reorder fallback chain
// ---------------------------------------------------------------------------

/**
 * Body schema for `POST /admin/assistant/settings/providers/reorder-fallback`.
 *
 * The module's
 * [`reorderFallbackChain`](medusa-agency-boilerplate/src/modules/assistant-settings.ts:1165)
 * also enforces non-empty strings and the 20-entry cap; this schema mirrors
 * the cap so that requests are rejected before a transaction is opened.
 */
export const ReorderFallbackSchema = z
  .object({
    ordered_ids: z.array(z.string().trim().min(1)).max(20),
  })
  .strict()

export type ReorderFallbackBody = z.infer<typeof ReorderFallbackSchema>

// ---------------------------------------------------------------------------
// Global assistant settings — PATCH
// ---------------------------------------------------------------------------

/**
 * Strict body schema for `PATCH /admin/assistant/settings`.
 *
 * `expected_version` is part of the wire body but NOT a column in
 * `assistant_setting`; the route handler peels it off and forwards it as
 * `opts.expectedVersion` to
 * [`updateAssistantSetting`](medusa-agency-boilerplate/src/modules/assistant-settings.ts:1530).
 *
 * `.refine` requires at least one real field beyond `expected_version` so
 * callers cannot bump the optimistic-lock version without changing anything.
 */
export const AssistantSettingUpdateSchema = z
  .object({
    system_prompt: z.string().min(1).max(20_000).optional(),
    retrieval_mode: z
      .enum(["markdown", "vector", "lightrag", "auto"])
      .optional(),
    retrieval_top_k: z.number().int().min(1).max(50).optional(),
    retrieval_min_score: z.number().min(0).max(1).optional(),
    embedding_provider: z.string().min(1).max(40).optional(),
    embedding_model: z.string().max(120).nullable().optional(),
    embedding_dimension: z.number().int().min(8).max(8192).optional(),
    max_history_messages: z.number().int().min(0).max(100).optional(),
    max_input_chars: z.number().int().min(100).max(50_000).optional(),
    max_output_tokens: z.number().int().min(1).max(32_000).optional(),
    streaming_enabled: z.boolean().optional(),
    default_locale: z.string().min(2).max(10).optional(),
    allowed_models: z.array(z.string().min(1).max(120)).max(50).optional(),
    tools_enabled: z.record(z.string(), z.boolean()).optional(),
    guardrails: z.record(z.string(), z.boolean()).optional(),
    rate_limits: z.record(z.string(), z.number().int().min(0)).optional(),
    usage_tracking_enabled: z.boolean().optional(),
    observability: z.record(z.string(), z.boolean()).optional(),
    expected_version: z.number().int().min(1).optional(),
  })
  .strict()
  .refine(
    (v) =>
      Object.keys(v).filter((k) => k !== "expected_version").length > 0,
    { message: "at least one field is required" }
  )

export type AssistantSettingUpdateBody = z.infer<
  typeof AssistantSettingUpdateSchema
>
