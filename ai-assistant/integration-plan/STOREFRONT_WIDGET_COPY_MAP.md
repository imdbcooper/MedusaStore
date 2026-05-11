# Storefront Widget Copy Map

Safe production-launch preparation artifact for adding an AI Assistant chat widget to the real Next.js storefront after explicit approval.

## Scope and current repository reality

- Target storefront is `medusa-agency-boilerplate-storefront/`.
- The storefront is Next.js `15.3.9`, React `19.0.5`, and uses the App Router under `src/app/[countryCode]/`.
- Main shopper shell is `src/app/[countryCode]/(main)/layout.tsx`, which renders `Nav`, optional cart banners/nudges, page children, and `Footer`.
- Current public proxy routes in production Caddy send `/store/*` to Medusa backend and `/api/content/*` to storefront. There is no current `/api/assistant/*` Caddy special case.
- Storefront server-side Medusa URL resolution already prefers `MEDUSA_BACKEND_URL` over `NEXT_PUBLIC_MEDUSA_BACKEND_URL` in `src/lib/env.ts`.

No real storefront files are changed by this document.

## Recommended integration shape

Use the Medusa Store API proxy first:

```text
Browser widget -> POST ${MEDUSA_BACKEND_URL}/store/assistant/chat -> Medusa adapter -> AI Assistant FastAPI
```

Rationale:

- The browser never receives `AI_ASSISTANT_API_TOKEN` or `AI_ASSISTANT_SERVER_TOKEN`.
- Existing Caddy already routes `/store/*` to `medusastore-backend`.
- Storefront can reuse existing Medusa backend URL conventions.
- The adapter supports regular JSON and SSE passthrough via `Accept: text/event-stream`.

A same-origin Next.js route is still possible, but would require an additional storefront server route and server-only env handling. That should be a separate explicit patch if chosen.

## Suggested widget file map

Create a new module namespace in the real storefront:

| Target | Purpose |
| --- | --- |
| `medusa-agency-boilerplate-storefront/src/modules/assistant/types.ts` | Shared request/response/product/action types copied from `ai-assistant/API_CONTRACT.md` semantics. |
| `medusa-agency-boilerplate-storefront/src/modules/assistant/lib/session.ts` | Client-side anonymous `assistant_session_id` storage in `localStorage` or first-party cookie. No secrets. |
| `medusa-agency-boilerplate-storefront/src/modules/assistant/lib/client.ts` | Browser-safe fetch/SSE client that calls `/store/assistant/chat` through the configured public Medusa backend origin or relative same-origin URL. |
| `medusa-agency-boilerplate-storefront/src/modules/assistant/components/assistant-widget/index.tsx` | Client component for launcher, panel, messages, product cards, add-to-cart proposals, feedback controls. |
| `medusa-agency-boilerplate-storefront/src/modules/assistant/components/assistant-product-card/index.tsx` | Optional product card renderer using existing product URL conventions. |
| `medusa-agency-boilerplate-storefront/src/modules/assistant/components/assistant-markdown/index.tsx` | Minimal safe Markdown renderer or restricted text renderer. Avoid raw HTML. |

Optional same-origin proxy alternative, only if explicitly approved:

| Target | Purpose |
| --- | --- |
| `medusa-agency-boilerplate-storefront/src/app/api/assistant/chat/route.ts` | Server route that forwards to Medusa `/store/assistant/chat` or directly to assistant with a server-only token. Must not expose tokens. |
| `medusa-agency-boilerplate-storefront/src/app/api/assistant/chat/stream/route.ts` | Optional SSE route if not using Medusa SSE proxy directly. |

## Where to mount the widget

Preferred first patch target:

```tsx
// medusa-agency-boilerplate-storefront/src/app/[countryCode]/(main)/layout.tsx
<Nav />
...
{props.children}
<AssistantWidget />
<Footer />
```

Mount before `Footer` or after `Footer` depending on z-index/positioning. A floating fixed launcher should be rendered once in `(main)/layout.tsx` so product, category, cart, content, and account pages can share one session.

Do not mount in checkout layout during the first patch unless checkout-specific UX is approved. Cart mutation stays outside the assistant backend; add-to-cart proposals must use existing trusted storefront cart flow only after explicit user confirmation.

## Endpoint and env contract

Browser-safe values only:

```env
NEXT_PUBLIC_AI_ASSISTANT_WIDGET_ENABLED=false
NEXT_PUBLIC_AI_ASSISTANT_CHAT_ENDPOINT=/store/assistant/chat
```

If the widget uses existing Medusa URL resolution, no new token is needed in storefront env. The widget can build the endpoint from:

- `NEXT_PUBLIC_MEDUSA_BACKEND_URL` for browser calls, for example `https://slavx.mooo.com` in production;
- or a relative same-origin `/store/assistant/chat` path when served through the same public Caddy origin.

Recommended production browser endpoint:

```text
/store/assistant/chat
```

because `https://slavx.mooo.com/store/*` is already routed to Medusa backend by Caddy.

Server-only assistant secrets must stay outside storefront public env:

```env
# Do not add these to NEXT_PUBLIC_* variables.
AI_ASSISTANT_API_TOKEN=<assistant-service-token>
AI_ASSISTANT_SERVER_TOKEN=<backend-adapter-token>
```

## Request payload guidance

Send only safe context from the browser:

```json
{
  "message": "Помоги выбрать товар",
  "session_id": "<anonymous-assistant-session-id>",
  "store_id": "default",
  "locale": "ru",
  "region_id": "<current-region-id-if-known>",
  "currency_code": "rub",
  "mode": "auto",
  "page_context": {
    "type": "product",
    "url": "/ru/products/<handle>",
    "product_handle": "<handle>"
  }
}
```

Do not send:

- raw auth/session cookies in JSON;
- `AI_ASSISTANT_API_TOKEN`;
- `AI_ASSISTANT_SERVER_TOKEN`;
- untrusted `cart_id` as an authority for mutation. The current Medusa adapter discards browser-supplied `cart_id` by design.

## Product cards and actions

- Render product cards only from `products[]` returned by assistant.
- Show price/availability only when the response safety/tool-call state indicates live Medusa grounding, especially `safety.live_data_checked=true`.
- If price is `null` or availability is `unknown`, label it as unavailable/needs checking rather than inventing values.
- Treat `add_to_cart_proposal` as UI-only. On user confirmation, call the existing storefront cart actions in `src/lib/data/cart.ts` or current product-action flow, not the assistant backend.

## Feedback path

Initial safe options:

1. Post tokenless feedback directly to assistant only if CORS and public feedback policy are intentionally configured.
2. Prefer a future same-origin server route if feedback needs ownership/session checks beyond anonymous session id.

Never include raw PII, auth tokens, provider keys, order secrets, or card data in feedback comments.

## Smoke scenarios after approved widget patch

Local/dev prerequisites:

- Assistant service running on `localhost:8000`.
- Medusa backend running on `localhost:9000` with adapter env configured.
- Storefront running on `localhost:8000` or another configured `STOREFRONT_PORT`.

Commands:

```bash
curl -fsS http://localhost:8000/api/v1/health
curl -fsS -X POST http://localhost:9000/store/assistant/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Какая доставка доступна?","store_id":"default","locale":"ru","mode":"auto"}'
```

Browser smoke checklist:

- Chat launcher visible and keyboard accessible on `/ru`.
- Open/close works without layout shift breaking nav/cart.
- Anonymous session persists after reload.
- Markdown/policy answer renders safely.
- Product recommendation prompt returns cards linking to `/ru/products/<handle>`.
- Price/stock display is hidden or marked unknown unless live grounding succeeds.
- Add-to-cart proposal requires explicit confirmation and uses existing cart flow.
- Browser DevTools show no `AI_ASSISTANT_API_TOKEN` or `AI_ASSISTANT_SERVER_TOKEN` in JavaScript bundles, network requests, or responses.
- Excess chat requests eventually return `429`/`Retry-After` if rate limits are configured.

Production smoke after approved deploy:

```bash
curl -I https://slavx.mooo.com/healthz
curl -fsS -X POST https://slavx.mooo.com/store/assistant/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Помоги выбрать товар","store_id":"default","locale":"ru","mode":"auto"}'
```

Then run a manual browser smoke on:

```text
https://slavx.mooo.com/ru
https://slavx.mooo.com/ru/products/<real-product-handle>
https://slavx.mooo.com/ru/cart
```

## Risks and assumptions

- The real widget implementation does not yet exist; this is a copy/patch map, not a completed UI patch.
- The Medusa adapter must be installed first if using `/store/assistant/chat`.
- Public Caddy currently routes `/store/*` to Medusa, so no Caddy change is required for the preferred endpoint.
- If a same-origin `/api/assistant/*` route is chosen later, Caddy route ownership and storefront env/docs must be reviewed separately.
- The storefront uses React `19.0.5`; any third-party Markdown or chat UI dependency must be checked for React 19 compatibility before adding dependencies.
- Do not install dependencies in the integration patch unless explicitly approved.
