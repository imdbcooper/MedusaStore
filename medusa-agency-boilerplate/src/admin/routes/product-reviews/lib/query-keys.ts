/**
 * Phase 4 / step 2 — TanStack Query key factory for the Medusa Admin
 * moderation surface. Centralised here so list/detail/widget components
 * share the exact same cache keys; mutation handlers in step 4 will
 * call `queryClient.invalidateQueries({ queryKey: productReviewQueryKeys.all })`
 * to refetch every active subscription in one go.
 *
 * The factory pattern (root tuple + spread into nested keys) follows
 * the TanStack Query
 * [Effective React Query Keys](https://tkdodo.eu/blog/effective-react-query-keys)
 * recipe — partial keys (e.g. `productReviewQueryKeys.all`) match every
 * descendant query.
 */

import type { AdminReviewListFilters } from './api'

export const productReviewQueryKeys = {
  all: ['product-reviews'] as const,
  list: (filters?: AdminReviewListFilters) =>
    [...productReviewQueryKeys.all, 'list', filters ?? {}] as const,
  detail: (id: string) =>
    [...productReviewQueryKeys.all, 'detail', id] as const,
  pendingCount: () =>
    [...productReviewQueryKeys.all, 'pending-count'] as const,
}
