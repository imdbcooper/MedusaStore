"use client"

import * as React from "react"

/**
 * `<ReviewStarsInput>` — interactive variant of `<ReviewStars>` used inside
 * [`ProductReviewForm`](medusa-agency-boilerplate-storefront/src/modules/products/components/product-review-form/index.tsx:1)
 * (Phase 1 — created later in step 8; this client component is exposed
 * eagerly so the form can import it without further refactoring).
 *
 * Each star is a focusable button; the keyboard contract follows native
 * radiogroup semantics:
 *   - ←/↓: decrement
 *   - →/↑: increment
 *   - 1–5: jump to that rating
 */

export type ReviewStarsInputSize = "sm" | "md" | "lg"

const SIZE_PX: Record<ReviewStarsInputSize, number> = {
  sm: 18,
  md: 24,
  lg: 32,
}

const STAR_PATH =
  "M12 2.25l2.92 6.18 6.83.79-5.05 4.66 1.39 6.62L12 17.27l-6.09 3.23 1.39-6.62L2.25 9.22l6.83-.79L12 2.25z"

type ReviewStarsInputProps = {
  value: number
  onChange: (next: number) => void
  size?: ReviewStarsInputSize
  name?: string
  className?: string
  disabled?: boolean
}

const ReviewStarsInput: React.FC<ReviewStarsInputProps> = ({
  value,
  onChange,
  size = "lg",
  name,
  className,
  disabled = false,
}) => {
  const px = SIZE_PX[size]
  const current = Math.max(0, Math.min(5, Math.round(value)))

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    const key = event.key
    if (key === "ArrowLeft" || key === "ArrowDown") {
      event.preventDefault()
      onChange(Math.max(1, current - 1))
      return
    }
    if (key === "ArrowRight" || key === "ArrowUp") {
      event.preventDefault()
      onChange(Math.min(5, current + 1))
      return
    }
    const numeric = Number.parseInt(key, 10)
    if (!Number.isNaN(numeric) && numeric >= 1 && numeric <= 5) {
      event.preventDefault()
      onChange(numeric)
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Оценка от 1 до 5"
      onKeyDown={handleKeyDown}
      className={
        "inline-flex items-center gap-1" + (className ? ` ${className}` : "")
      }
    >
      {[1, 2, 3, 4, 5].map((rating) => {
        const filled = rating <= current
        return (
          <button
            key={rating}
            type="button"
            role="radio"
            aria-checked={current === rating}
            aria-label={`${rating} из 5`}
            tabIndex={current === rating || (current === 0 && rating === 1) ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(rating)}
            className="rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)]"
            style={{
              color: filled
                ? "var(--theme-accent, #f5a524)"
                : "rgba(0,0,0,0.18)",
              cursor: disabled ? "not-allowed" : "pointer",
              background: "transparent",
              padding: 0,
              lineHeight: 0,
            }}
          >
            <svg
              width={px}
              height={px}
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d={STAR_PATH} fill="currentColor" />
            </svg>
          </button>
        )
      })}
      {name ? <input type="hidden" name={name} value={current} /> : null}
    </div>
  )
}

export default ReviewStarsInput
