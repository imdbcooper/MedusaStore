/**
 * Unit-тесты для
 * [`error-mapping.ts`](medusa-agency-boilerplate/src/admin/routes/settings/assistant/lib/error-mapping.ts:1).
 */

import { mapAssistantError } from "../lib/error-mapping"

describe("mapAssistantError", () => {
  it.each([
    "not_found",
    "already_exists",
    "validation",
    "encryption_failure",
    "encryption_not_configured",
    "active_required",
    "provider_disabled",
    "version_mismatch",
    "unauthorized",
    "network",
  ])("возвращает непустую копию для известного кода `%s`", (code) => {
    const out = mapAssistantError(code, 400)
    expect(typeof out).toBe("string")
    expect(out.length).toBeGreaterThan(0)
  })

  it("неизвестный код 401/403 без message → unauthorized-копи", () => {
    const out = mapAssistantError("anything", 401)
    expect(out).toMatch(/Сессия истекла|нет прав/i)
  })

  it("неизвестный код, статус 0 → network-копи", () => {
    const out = mapAssistantError("anything", 0)
    expect(out).toMatch(/связаться с сервером|соединение/i)
  })

  it("неизвестный код, осмысленный message → message", () => {
    const out = mapAssistantError("custom_unknown", 500, "Кастомная ошибка")
    expect(out).toBe("Кастомная ошибка")
  })

  it("неизвестный код, пустой message → дефолт", () => {
    const out = mapAssistantError("custom_unknown", 500, "   ")
    expect(out).toBe("Не удалось выполнить действие.")
  })

  it("неизвестный код, отсутствует message → дефолт", () => {
    const out = mapAssistantError("custom_unknown", 500)
    expect(out).toBe("Не удалось выполнить действие.")
  })

  it("version_mismatch имеет отдельную копию про другого пользователя", () => {
    const out = mapAssistantError("version_mismatch", 409)
    expect(out).toMatch(/другим пользователем/i)
  })

  it("active_required — про единственный включённый провайдер", () => {
    const out = mapAssistantError("active_required", 409)
    expect(out).toMatch(/включённого провайдера/i)
  })
})
