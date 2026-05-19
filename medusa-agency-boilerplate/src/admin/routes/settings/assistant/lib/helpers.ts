/**
 * PR 4 — pure helpers для admin-страницы AI-ассистента.
 *
 * Все функции чистые (без I/O, без React) и покрыты unit-тестами в
 * [`__tests__/helpers.unit.spec.ts`](medusa-agency-boilerplate/src/admin/routes/settings/assistant/__tests__/helpers.unit.spec.ts:1).
 * Никаких импортов из `react`, `@medusajs/ui` и пр.
 */

import { assistantCopy } from "./copy"
import type { LlmProviderRow } from "./types"

// ---------------------------------------------------------------------------
// Date / time
// ---------------------------------------------------------------------------

/**
 * Стабильный форматтер «DD.MM.YYYY HH:mm». Через `Intl.DateTimeFormat`
 * с фиксированной локалью `ru-RU` — результат не зависит от локали
 * пользователя и хорошо читается русскоязычными модераторами.
 *
 * Использует `timeZone: "UTC"` чтобы в тестах ответ не «прыгал» при
 * запуске на разных машинах. Реальные пользователи всё равно увидят
 * ту же ISO-метку — их браузер сам не подменяет timezone.
 */
const RU_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
})

/**
 * Форматирует ISO-метку в `DD.MM.YYYY HH:mm` (UTC). Для пустого/невалидного
 * значения возвращает плейсхолдер `—`.
 *
 * Возвращаемая строка — plain-text; React сам экранирует её при рендере.
 */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) {
    return assistantCopy.common.none
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return assistantCopy.common.none
  }
  // `Intl.DateTimeFormat` для русской локали возвращает строку
  // `12.05.2026, 10:30`. Запятую убираем, чтобы в таблице помещалось
  // в одну колонку без переноса.
  return RU_DATE_TIME_FORMATTER.format(date).replace(",", "")
}

/**
 * Форматирует latency в миллисекундах: `null/undefined` → «—»,
 * целое число → `"123 ms"`. Дробные значения не округляем мы — это
 * job backend (он и так возвращает целое).
 */
export function formatLatency(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) {
    return assistantCopy.common.none
  }
  return `${Math.max(0, Math.trunc(ms))} ms`
}

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

/**
 * Принимает строку, возвращает `true` если это валидный http/https URL.
 *
 * Используем глобальный `URL` для парсинга, но дополнительно проверяем
 * протокол: `URL("file:///etc/passwd")` валиден, но в форме провайдера
 * это бессмысленно и небезопасно — backend всё равно отклонит.
 */
export function validateBaseUrl(value: string): boolean {
  if (typeof value !== "string") {
    return false
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return false
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:"
}

// ---------------------------------------------------------------------------
// Provider — last-test display
// ---------------------------------------------------------------------------

export type LastTestColor = "green" | "red" | "grey"

/**
 * Возвращает label + цвет для колонки «Последний тест» в провайдер-таблице.
 *
 * - `last_test_at === null` → «не запускался» / grey;
 * - `last_test_ok === true` → форматтер времени + зелёный;
 * - `last_test_ok === false` → форматтер времени + «ошибка» + красный.
 */
export function formatLastTest(
  provider: Pick<
    LlmProviderRow,
    "last_test_at" | "last_test_ok"
  >,
): { label: string; color: LastTestColor } {
  if (!provider.last_test_at) {
    return {
      label: assistantCopy.providers.lastTest.never,
      color: "grey",
    }
  }
  const ts = formatTimestamp(provider.last_test_at)
  if (provider.last_test_ok === true) {
    return {
      label: `${ts} · ${assistantCopy.providers.lastTest.okSuffix}`,
      color: "green",
    }
  }
  if (provider.last_test_ok === false) {
    return {
      label: `${ts} · ${assistantCopy.providers.lastTest.errorSuffix}`,
      color: "red",
    }
  }
  return { label: ts, color: "grey" }
}

// ---------------------------------------------------------------------------
// Request headers — text<->object roundtrip
// ---------------------------------------------------------------------------

/**
 * Парсит textarea-значение поля «Доп. заголовки запроса» в объект.
 *
 * Формат: по одной паре `Key: Value` на строку. Ключ обязательно
 * непустой, значение — может быть пустой строкой. Дубликаты ключей
 * допускаются — побеждает последний (как в HTTP-парсерах). Пустые
 * строки и BOM игнорируются.
 *
 * При нарушении формата (нет двоеточия, пустой ключ) вызывает
 * `onError` с номером строки (1-based) — UI может подсветить
 * проблемную строку. Если `onError` не передан — такие строки
 * молча пропускаются.
 */
export function parseRequestHeaders(
  text: string | null | undefined,
  onError?: (lineNumber: number, line: string) => void,
): Record<string, string> {
  if (!text) {
    return {}
  }
  const result: Record<string, string> = {}
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()
    if (!trimmed) {
      continue
    }
    const colonIdx = trimmed.indexOf(":")
    if (colonIdx <= 0) {
      onError?.(i + 1, raw)
      continue
    }
    const key = trimmed.slice(0, colonIdx).trim()
    const value = trimmed.slice(colonIdx + 1).trim()
    if (!key) {
      onError?.(i + 1, raw)
      continue
    }
    result[key] = value
  }
  return result
}

/**
 * Сериализует объект заголовков в textarea-формат «Key: Value» по строкам.
 * Пустой объект → пустая строка. Порядок ключей сохраняется как у
 * `Object.entries`.
 */
export function serializeRequestHeaders(
  headers: Record<string, string> | null | undefined,
): string {
  if (!headers || typeof headers !== "object") {
    return ""
  }
  return Object.entries(headers)
    .filter(([key]) => typeof key === "string" && key.length > 0)
    .map(([key, value]) => `${key}: ${value ?? ""}`)
    .join("\n")
}

// ---------------------------------------------------------------------------
// Provider status badge mapping
// ---------------------------------------------------------------------------

export type ProviderStatusKind = "active" | "fallback" | "disabled" | "none"

/**
 * Определяет «статус» провайдера для отображения в `StatusBadge`:
 * - `is_active` → "active";
 * - `!is_enabled` → "disabled";
 * - `fallback_priority !== null` → "fallback";
 * - иначе "none" (включён, не активен, не в цепочке).
 */
export function deriveProviderStatusKind(
  provider: Pick<
    LlmProviderRow,
    "is_active" | "is_enabled" | "fallback_priority"
  >,
): ProviderStatusKind {
  if (provider.is_active) {
    return "active"
  }
  if (!provider.is_enabled) {
    return "disabled"
  }
  if (provider.fallback_priority !== null && provider.fallback_priority !== undefined) {
    return "fallback"
  }
  return "none"
}

/**
 * Форматирует api_key_last4 в маскированную строку `••••<last4>`.
 * Если last4 пустой/отсутствует — возвращает только маску из 8 точек.
 */
export function maskApiKeyLast4(last4: string | null | undefined): string {
  const safe = typeof last4 === "string" ? last4.trim() : ""
  if (!safe) {
    return "••••••••"
  }
  return `••••${safe}`
}

// ---------------------------------------------------------------------------
// Numeric input parsing — для form-полей
// ---------------------------------------------------------------------------

/**
 * Преобразует строковое значение `<input type="number">` в число / null.
 * Пустая строка / `null` / нечисловой вход → `null`. Это удобно для
 * полей вроде `top_p`, `fallback_priority`, у которых null — валидное
 * значение «не задавать».
 */
export function parseOptionalNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null
  }
  const trimmed = String(value).trim()
  if (!trimmed) {
    return null
  }
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * `parseOptionalNumber`, но возвращает целое (через `Math.trunc`).
 * Для полей `max_tokens`, `timeout_ms`, `fallback_priority`.
 */
export function parseOptionalInteger(value: string | null | undefined): number | null {
  const num = parseOptionalNumber(value)
  return num === null ? null : Math.trunc(num)
}
