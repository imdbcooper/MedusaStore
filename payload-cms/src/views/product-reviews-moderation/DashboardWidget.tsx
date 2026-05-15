import type { ServerProps } from 'payload'
import { listProductReviewsAdmin } from '../../lib/product-reviews-admin-client.ts'
import { moderationCopy } from './copy.ts'

/**
 * Payload dashboard widget «Отзывы на модерации: N» (plan §5.3 + §9 Phase 2
 * шаг 3).
 *
 * Registered via
 * [`admin.components.beforeDashboard`](payload-cms/src/payload.config.ts:1):
 * Payload renders entries from that array in
 * [`@payloadcms/next/dist/views/Dashboard/Default/index.js`](payload-cms/node_modules/@payloadcms/next/dist/views/Dashboard/Default/index.js:23)
 * by calling `RenderServerComponent` with the standard server props
 * (`i18n`, `locale`, `params`, `payload`, `permissions`, `searchParams`,
 * `user`). We only need `payload?.config?.routes?.admin` to build the
 * link, so the typed prop is `Partial<ServerProps>` — same pattern as
 * the sidebar entry in
 * [`NavLink.tsx`](payload-cms/src/views/product-reviews-moderation/NavLink.tsx:1).
 *
 * Server-only by design: `listProductReviewsAdmin` reads
 * `MEDUSA_ADMIN_SECRET_API_KEY` and must never reach the client. The
 * helper is `import 'server-only'`-guarded
 * (see [`medusa-admin-client.ts`](payload-cms/src/lib/medusa-admin-client.ts:1)),
 * so accidental client imports fail at build time.
 *
 * `pageSize: 1` — мы используем endpoint исключительно как «счётчик»
 * (`total`); тащить полный page никогда не нужно. `cache: 'no-store'`
 * наследуется из `medusaAdminFetch`, что для high-touch очереди модерации
 * ОК.
 *
 * TODO(Phase 3): подумать о коротком кэше (revalidate: 30s) для виджета
 * счётчика, если очередь модерации станет большой и no-store начнёт
 * заметно тормозить открытие дашборда.
 */
export default async function ProductReviewsModerationDashboardWidget(
  props: Partial<ServerProps>,
) {
  const adminRoute = props?.payload?.config?.routes?.admin || '/admin'
  const queueHref = `${adminRoute}/product-reviews/moderation?status=pending`

  const result = await listProductReviewsAdmin({
    status: 'pending',
    page: 1,
    pageSize: 1,
  })

  if (!result.ok) {
    const message =
      result.error === 'config_missing'
        ? moderationCopy.dashboardWidget.errors.configMissing
        : result.error === 'unauthorized' || result.status === 401
          ? moderationCopy.dashboardWidget.errors.unauthorized
          : result.error === 'transport_error'
            ? moderationCopy.dashboardWidget.errors.transport
            : moderationCopy.dashboardWidget.errors.generic

    return (
      <section style={cardStyle} aria-labelledby="prw-dashboard-widget-title">
        <h2 id="prw-dashboard-widget-title" style={titleStyle}>
          {moderationCopy.dashboardWidget.title}
        </h2>
        <div style={errorStyle} role="alert">
          {message}
        </div>
      </section>
    )
  }

  const total = result.data.total ?? 0
  const isEmpty = total === 0

  return (
    <section style={cardStyle} aria-labelledby="prw-dashboard-widget-title">
      <header style={headerStyle}>
        <h2 id="prw-dashboard-widget-title" style={titleStyle}>
          {moderationCopy.dashboardWidget.title}
        </h2>
        {isEmpty ? null : (
          <a href={queueHref} style={linkButtonStyle}>
            {moderationCopy.dashboardWidget.action} →
          </a>
        )}
      </header>

      {isEmpty ? (
        <p style={emptyStyle}>{moderationCopy.dashboardWidget.empty}</p>
      ) : (
        <a href={queueHref} style={countLinkStyle} aria-label={`${moderationCopy.dashboardWidget.title}: ${total}`}>
          <span style={countNumberStyle}>{total}</span>
        </a>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Inline styles. Reuses Payload's CSS variables (`--theme-elevation-*`,
// `--base`, `--style-radius-*`) so the widget reads as part of the
// dashboard rather than a foreign island, matching the rest of
// [`Page.tsx`](payload-cms/src/views/product-reviews-moderation/Page.tsx:1).
// ---------------------------------------------------------------------------

const cardStyle: React.CSSProperties = {
  background: 'var(--theme-elevation-0)',
  border: '1px solid var(--theme-elevation-100)',
  borderRadius: 'var(--style-radius-s, 4px)',
  padding: 'var(--base, 16px)',
  marginBottom: 'var(--base, 16px)',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap',
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.875rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--theme-elevation-500)',
}

const countLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: '8px',
  textDecoration: 'none',
  color: 'var(--theme-elevation-1000)',
}

const countNumberStyle: React.CSSProperties = {
  fontSize: '2.25rem',
  fontWeight: 700,
  lineHeight: 1,
}

const emptyStyle: React.CSSProperties = {
  margin: 0,
  color: 'var(--theme-elevation-500)',
  fontSize: '0.875rem',
}

const linkButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 10px',
  borderRadius: 'var(--style-radius-s, 4px)',
  border: '1px solid var(--theme-elevation-150)',
  background: 'var(--theme-elevation-50)',
  color: 'var(--theme-elevation-1000)',
  textDecoration: 'none',
  fontSize: '0.75rem',
}

const errorStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: 'var(--theme-error-150)',
  color: 'var(--theme-error-750)',
  borderRadius: 'var(--style-radius-s, 4px)',
  fontSize: '0.8rem',
}
