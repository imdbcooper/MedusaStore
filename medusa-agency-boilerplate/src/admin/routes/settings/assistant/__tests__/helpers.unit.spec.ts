/**
 * Unit-тесты для [`helpers.ts`](medusa-agency-boilerplate/src/admin/routes/settings/assistant/lib/helpers.ts:1).
 *
 * Подхватываются `jest.config.js` через `**\/src/**\/__tests__/**\/*.unit.spec.[jt]s`
 * (TEST_TYPE=unit). Тесты чистые: без сети, без браузера, без React.
 */

import {
  deriveProviderStatusKind,
  formatLastTest,
  formatLatency,
  formatTimestamp,
  maskApiKeyLast4,
  parseOptionalInteger,
  parseOptionalNumber,
  parseRequestHeaders,
  serializeRequestHeaders,
  validateBaseUrl,
} from "../lib/helpers"

describe("assistant settings helpers", () => {
  // -------------------------------------------------------------------------
  // formatTimestamp
  // -------------------------------------------------------------------------
  describe("formatTimestamp", () => {
    it('возвращает «—» для null/undefined/пустой строки', () => {
      expect(formatTimestamp(null)).toBe("—")
      expect(formatTimestamp(undefined)).toBe("—")
      expect(formatTimestamp("")).toBe("—")
    })

    it("возвращает «—» для невалидной даты", () => {
      expect(formatTimestamp("not-a-date")).toBe("—")
    })

    it("форматирует валидный ISO в DD.MM.YYYY HH:mm (UTC)", () => {
      const out = formatTimestamp("2026-05-18T10:30:00.000Z")
      // UTC-фиксация → строка детерминирована
      expect(out).toBe("18.05.2026 10:30")
    })

    it("режет секунды и доли — отображает только HH:mm", () => {
      const out = formatTimestamp("2026-01-02T03:04:59.999Z")
      expect(out).toBe("02.01.2026 03:04")
    })
  })

  // -------------------------------------------------------------------------
  // formatLatency
  // -------------------------------------------------------------------------
  describe("formatLatency", () => {
    it("возвращает «—» для null/undefined/NaN", () => {
      expect(formatLatency(null)).toBe("—")
      expect(formatLatency(undefined)).toBe("—")
      expect(formatLatency(Number.NaN)).toBe("—")
    })

    it("форматирует целое в `123 ms`", () => {
      expect(formatLatency(123)).toBe("123 ms")
      expect(formatLatency(0)).toBe("0 ms")
    })

    it("обрезает дробную часть и не уходит в отрицательные", () => {
      expect(formatLatency(123.99)).toBe("123 ms")
      expect(formatLatency(-5)).toBe("0 ms")
    })
  })

  // -------------------------------------------------------------------------
  // validateBaseUrl
  // -------------------------------------------------------------------------
  describe("validateBaseUrl", () => {
    it("принимает http/https URL", () => {
      expect(validateBaseUrl("http://example.com")).toBe(true)
      expect(validateBaseUrl("https://api.openai.com/v1")).toBe(true)
      expect(validateBaseUrl("  https://api.example.com  ")).toBe(true)
    })

    it("отклоняет ftp/file/data/невалидные строки", () => {
      expect(validateBaseUrl("ftp://example.com")).toBe(false)
      expect(validateBaseUrl("file:///etc/passwd")).toBe(false)
      expect(validateBaseUrl("data:text/plain;base64,SGVsbG8=")).toBe(false)
      expect(validateBaseUrl("not a url at all")).toBe(false)
    })

    it("отклоняет пустую строку и не-строку", () => {
      expect(validateBaseUrl("")).toBe(false)
      expect(validateBaseUrl("   ")).toBe(false)
      expect(validateBaseUrl(undefined as unknown as string)).toBe(false)
      expect(validateBaseUrl(null as unknown as string)).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // parseRequestHeaders / serializeRequestHeaders
  // -------------------------------------------------------------------------
  describe("parseRequestHeaders", () => {
    it("парсит пары Key: Value по строкам", () => {
      const text = "Authorization: Bearer xyz\nX-Org-Id: org_123"
      expect(parseRequestHeaders(text)).toEqual({
        Authorization: "Bearer xyz",
        "X-Org-Id": "org_123",
      })
    })

    it("игнорирует пустые строки и BOM", () => {
      const text = "\uFEFF\n\nAuthorization: Bearer xyz\n\n"
      expect(parseRequestHeaders(text)).toEqual({
        Authorization: "Bearer xyz",
      })
    })

    it("пустой ввод → пустой объект", () => {
      expect(parseRequestHeaders("")).toEqual({})
      expect(parseRequestHeaders(null)).toEqual({})
      expect(parseRequestHeaders(undefined)).toEqual({})
    })

    it("дубликаты ключей: побеждает последний", () => {
      const text = "X-Foo: a\nX-Foo: b"
      expect(parseRequestHeaders(text)).toEqual({ "X-Foo": "b" })
    })

    it("принимает значения с двоеточием внутри", () => {
      const text = "X-Time: 12:30:00"
      expect(parseRequestHeaders(text)).toEqual({ "X-Time": "12:30:00" })
    })

    it("вызывает onError для строк без двоеточия / без ключа", () => {
      const errors: Array<[number, string]> = []
      const result = parseRequestHeaders(
        "no-colon-here\nAuthorization: ok\n: only-value",
        (line, raw) => errors.push([line, raw]),
      )
      expect(result).toEqual({ Authorization: "ok" })
      expect(errors).toEqual([
        [1, "no-colon-here"],
        [3, ": only-value"],
      ])
    })
  })

  describe("serializeRequestHeaders", () => {
    it("сериализует объект в строки `Key: Value`", () => {
      expect(
        serializeRequestHeaders({
          Authorization: "Bearer xyz",
          "X-Org-Id": "org_123",
        }),
      ).toBe("Authorization: Bearer xyz\nX-Org-Id: org_123")
    })

    it("пустой/null объект → пустая строка", () => {
      expect(serializeRequestHeaders({})).toBe("")
      expect(serializeRequestHeaders(null)).toBe("")
      expect(serializeRequestHeaders(undefined)).toBe("")
    })

    it("делает round-trip с parseRequestHeaders", () => {
      const original = { Authorization: "Bearer xyz", "X-Org": "" }
      const serialized = serializeRequestHeaders(original)
      const parsed = parseRequestHeaders(serialized)
      expect(parsed).toEqual(original)
    })

    it("обрабатывает пустые значения", () => {
      const obj = { "X-Foo": "" }
      expect(serializeRequestHeaders(obj)).toBe("X-Foo: ")
      expect(parseRequestHeaders("X-Foo: ")).toEqual({ "X-Foo": "" })
    })
  })

  // -------------------------------------------------------------------------
  // formatLastTest
  // -------------------------------------------------------------------------
  describe("formatLastTest", () => {
    it("возвращает grey/«не запускался» для пустого last_test_at", () => {
      expect(
        formatLastTest({ last_test_at: null, last_test_ok: null }),
      ).toEqual({ label: "не запускался", color: "grey" })
    })

    it("возвращает зелёный для last_test_ok=true", () => {
      const result = formatLastTest({
        last_test_at: "2026-05-18T10:30:00Z",
        last_test_ok: true,
      })
      expect(result.color).toBe("green")
      expect(result.label).toContain("18.05.2026")
      expect(result.label).toContain("OK")
    })

    it("возвращает красный для last_test_ok=false", () => {
      const result = formatLastTest({
        last_test_at: "2026-05-18T10:30:00Z",
        last_test_ok: false,
      })
      expect(result.color).toBe("red")
      expect(result.label).toContain("ошибка")
    })

    it("возвращает grey, если last_test_ok=null но last_test_at есть", () => {
      const result = formatLastTest({
        last_test_at: "2026-05-18T10:30:00Z",
        last_test_ok: null,
      })
      expect(result.color).toBe("grey")
      expect(result.label).toBe("18.05.2026 10:30")
    })
  })

  // -------------------------------------------------------------------------
  // deriveProviderStatusKind
  // -------------------------------------------------------------------------
  describe("deriveProviderStatusKind", () => {
    it("active побеждает остальные флаги", () => {
      expect(
        deriveProviderStatusKind({
          is_active: true,
          is_enabled: false,
          fallback_priority: 2,
        }),
      ).toBe("active")
    })

    it("disabled — если выключен и не активен", () => {
      expect(
        deriveProviderStatusKind({
          is_active: false,
          is_enabled: false,
          fallback_priority: 2,
        }),
      ).toBe("disabled")
    })

    it("fallback — если включён, не активен, есть приоритет", () => {
      expect(
        deriveProviderStatusKind({
          is_active: false,
          is_enabled: true,
          fallback_priority: 1,
        }),
      ).toBe("fallback")
    })

    it("none — включён, не активен, нет приоритета", () => {
      expect(
        deriveProviderStatusKind({
          is_active: false,
          is_enabled: true,
          fallback_priority: null,
        }),
      ).toBe("none")
    })
  })

  // -------------------------------------------------------------------------
  // maskApiKeyLast4
  // -------------------------------------------------------------------------
  describe("maskApiKeyLast4", () => {
    it("формирует маску `••••<last4>`", () => {
      expect(maskApiKeyLast4("abcd")).toBe("••••abcd")
    })

    it("пустой/null last4 → восемь точек", () => {
      expect(maskApiKeyLast4(null)).toBe("••••••••")
      expect(maskApiKeyLast4("")).toBe("••••••••")
      expect(maskApiKeyLast4("   ")).toBe("••••••••")
    })
  })

  // -------------------------------------------------------------------------
  // parseOptionalNumber / parseOptionalInteger
  // -------------------------------------------------------------------------
  describe("parseOptionalNumber", () => {
    it("парсит число", () => {
      expect(parseOptionalNumber("0.5")).toBe(0.5)
      expect(parseOptionalNumber("42")).toBe(42)
    })

    it("пустая/невалидная строка → null", () => {
      expect(parseOptionalNumber("")).toBeNull()
      expect(parseOptionalNumber("   ")).toBeNull()
      expect(parseOptionalNumber("abc")).toBeNull()
      expect(parseOptionalNumber(null)).toBeNull()
      expect(parseOptionalNumber(undefined)).toBeNull()
    })
  })

  describe("parseOptionalInteger", () => {
    it("обрезает дробную часть", () => {
      expect(parseOptionalInteger("3.99")).toBe(3)
      expect(parseOptionalInteger("3")).toBe(3)
    })

    it("пустая → null", () => {
      expect(parseOptionalInteger("")).toBeNull()
      expect(parseOptionalInteger(null)).toBeNull()
    })
  })
})
