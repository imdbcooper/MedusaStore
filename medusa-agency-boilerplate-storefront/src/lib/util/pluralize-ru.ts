/**
 * Pick the correct Russian plural form for a count.
 *
 * Russian has three plural forms:
 *   - one     — singular (1, 21, 31, …)        e.g. «отзыв»
 *   - few     — 2–4 (and 22–24, …)             e.g. «отзыва»
 *   - many    — 0, 5–20, etc.                  e.g. «отзывов»
 *
 * @example
 *   pluralizeRu(1, ["отзыв", "отзыва", "отзывов"]) // "отзыв"
 *   pluralizeRu(2, ["отзыв", "отзыва", "отзывов"]) // "отзыва"
 *   pluralizeRu(5, ["отзыв", "отзыва", "отзывов"]) // "отзывов"
 *   pluralizeRu(21, ["отзыв", "отзыва", "отзывов"]) // "отзыв"
 */
export function pluralizeRu(
  count: number,
  forms: readonly [string, string, string]
): string {
  const absolute = Math.abs(Math.trunc(count))
  const mod10 = absolute % 10
  const mod100 = absolute % 100

  if (mod100 >= 11 && mod100 <= 14) {
    return forms[2]
  }
  if (mod10 === 1) {
    return forms[0]
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return forms[1]
  }
  return forms[2]
}
