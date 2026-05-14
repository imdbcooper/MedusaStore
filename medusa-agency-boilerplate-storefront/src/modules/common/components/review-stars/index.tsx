import * as React from "react"

/**
 * `<ReviewStars>` — server-renderable display variant.
 *
 * Renders 5 SVG stars; `value` (0..5) drives the filled portion via an
 * overlay-clip technique (no JavaScript, no `"use client"` required).
 *
 * The interactive `mode="input"` variant lives in
 * [`./input.tsx`](medusa-agency-boilerplate-storefront/src/modules/common/components/review-stars/input.tsx:1)
 * and is `"use client"`. Splitting the two avoids dragging the entire
 * component into the client bundle for read-only displays (cards, summary,
 * thumbnails — see plan §6.1 «server-shell + client-interactive»).
 *
 * For input usage call `<ReviewStarsInput>` directly.
 */

export type ReviewStarsSize = "sm" | "md" | "lg"

const SIZE_PX: Record<ReviewStarsSize, number> = {
  sm: 14,
  md: 18,
  lg: 26,
}

const STAR_PATH =
  "M12 2.25l2.92 6.18 6.83.79-5.05 4.66 1.39 6.62L12 17.27l-6.09 3.23 1.39-6.62L2.25 9.22l6.83-.79L12 2.25z"

type ReviewStarsProps = {
  value: number
  size?: ReviewStarsSize
  /**
   * Optional accessible label override. Defaults to «Оценка X из 5» which is
   * the project-wide Russian convention.
   */
  ariaLabel?: string
  className?: string
}

const ReviewStars: React.FC<ReviewStarsProps> = ({
  value,
  size = "md",
  ariaLabel,
  className,
}) => {
  // Clamp into [0, 5] and round display value to one decimal — consistent
  // with `Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 })` used in
  // the summary card (plan §6.2). Empty-state callers pass `value=0`.
  const clamped = Math.max(0, Math.min(5, Number.isFinite(value) ? value : 0))
  const fillPercent = (clamped / 5) * 100
  const px = SIZE_PX[size]

  const labelText =
    ariaLabel ?? `Оценка ${clamped.toFixed(1)} из 5`

  return (
    <span
      role="img"
      aria-label={labelText}
      className={
        "relative inline-flex items-center" +
        (className ? ` ${className}` : "")
      }
      style={{ height: px }}
    >
      {/* Empty (gray) row */}
      <span
        aria-hidden="true"
        className="flex"
        style={{ height: px }}
      >
        {[0, 1, 2, 3, 4].map((index) => (
          <svg
            key={`empty-${index}`}
            width={px}
            height={px}
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            style={{ display: "block" }}
          >
            <path d={STAR_PATH} fill="currentColor" opacity="0.18" />
          </svg>
        ))}
      </span>
      {/* Filled (accent) overlay clipped by `width` percentage */}
      <span
        aria-hidden="true"
        className="absolute inset-0 flex overflow-hidden"
        style={{
          width: `${fillPercent}%`,
          color: "var(--theme-accent, #f5a524)",
          height: px,
        }}
      >
        {[0, 1, 2, 3, 4].map((index) => (
          <svg
            key={`fill-${index}`}
            width={px}
            height={px}
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            style={{ display: "block", flex: "0 0 auto" }}
          >
            <path d={STAR_PATH} fill="currentColor" />
          </svg>
        ))}
      </span>
    </span>
  )
}

export default ReviewStars
