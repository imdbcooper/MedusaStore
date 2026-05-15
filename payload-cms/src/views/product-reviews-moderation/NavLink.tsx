import Link from 'next/link'
import type { ServerProps } from 'payload'
import { moderationCopy } from './copy.ts'

/**
 * Sidebar entry for the moderation view.
 *
 * Plan §1.4: register a navigation link via
 * [`admin.components.beforeNavLinks`](payload-cms/src/payload.config.ts:1)
 * so moderators can find the page from any admin screen.
 *
 * Payload passes `ServerProps` (including `payload`) to all
 * `beforeNavLinks` components — that's our source of truth for the admin
 * route prefix instead of hard-coding `/admin` (which breaks projects
 * that override `routes.admin`).
 *
 * Class-name choice (m8 in the review): Payload's own nav links use
 * `${baseClass}__link` where `baseClass = 'nav'` — see
 * [`@payloadcms/next/dist/elements/Nav/index.client.js`](payload-cms/node_modules/@payloadcms/next/dist/elements/Nav/index.client.js:11).
 * They are rendered inside a `NavGroup`, but `beforeNavLinks` slots are
 * rendered above the groups by Payload itself, so we don't need to wrap
 * with `NavGroup` here. We use the same `nav__link` class so hover /
 * focus styling matches the surrounding entries.
 *
 * TODO(Phase 3): полная visual parity с Payload `NavGroup` — добавить
 * active-state (`nav__link--active` + `nav__link-indicator`) через
 * client-island с `usePathname`. Требует разделения на server-shell
 * (получает `adminRoute` из `ServerProps`) и client-child (читает
 * pathname и навешивает active-классы). Не блокирует Phase 2: ссылка
 * визуально согласуется с соседними entries даже без active-state.
 */
export default function ProductReviewsModerationNavLink(
  props: Partial<ServerProps>,
) {
  const adminRoute = props?.payload?.config?.routes?.admin || '/admin'
  const href = `${adminRoute}/product-reviews/moderation`

  return (
    <Link href={href} className="nav__link" prefetch={false}>
      <span className="nav__link-label">{moderationCopy.nav.label}</span>
    </Link>
  )
}
