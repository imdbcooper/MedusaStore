/**
 * PR 4 — error-mapping для admin-страницы AI-ассистента.
 *
 * Backend возвращает коды ошибок из
 * [`AssistantSettingsError`](medusa-agency-boilerplate/src/modules/assistant-settings.ts:174):
 * `not_found`, `already_exists`, `validation`, `encryption_failure`,
 * `encryption_not_configured`, `active_required`, `provider_disabled`,
 * `version_mismatch`. К ним добавляются синтетические коды из
 * [`api.ts`](medusa-agency-boilerplate/src/admin/routes/settings/assistant/lib/api.ts:1):
 * `unauthorized`, `network`, `http_<n>`.
 *
 * Если код неизвестен — фолбэк на `message` от backend, иначе на
 * generic-копи. Это сохраняет полезные сообщения от Zod / Medusa
 * без необходимости заводить отдельный код для каждой ошибки валидации.
 */

import { assistantCopy } from "./copy"

const fallbackMessages: Record<string, string> = {
  not_found: "Запись не найдена. Возможно, её уже удалили.",
  already_exists: "Запись с таким именем уже существует.",
  validation: "Проверьте введённые значения — некоторые из них некорректны.",
  encryption_failure:
    "Не удалось зашифровать или расшифровать API-ключ. Проверьте серверную конфигурацию шифрования.",
  encryption_not_configured:
    "На сервере не настроен ASSISTANT_SETTINGS_ENCRYPTION_KEY. Без него API-ключи нельзя сохранять.",
  active_required:
    "Невозможно удалить единственного включённого провайдера, пока он активен. Сначала добавьте другого.",
  provider_disabled:
    "Этот провайдер отключён и не может быть сделан активным.",
  version_mismatch: assistantCopy.general.toasts.versionMismatch,
  unauthorized:
    "Сессия истекла или нет прав доступа. Перезайдите в админку.",
  network: "Не удалось связаться с сервером. Проверьте соединение.",
}

/**
 * Преобразует код ошибки backend / синтетический код transport-уровня
 * в человекочитаемое сообщение для toast/alert.
 *
 * Фолбэк-цепочка:
 * 1. Точное совпадение по коду из `fallbackMessages`.
 * 2. Если статус 401/403 — «unauthorized».
 * 3. Если статус 0 — «network».
 * 4. Текст `message` от backend, если он не пустой.
 * 5. Generic «Не удалось выполнить действие.»
 */
export function mapAssistantError(
  error: string,
  status: number,
  message?: string,
): string {
  if (error in fallbackMessages) {
    return fallbackMessages[error]
  }
  if (status === 401 || status === 403) {
    return fallbackMessages.unauthorized
  }
  if (status === 0) {
    return fallbackMessages.network
  }
  if (typeof message === "string" && message.trim()) {
    return message.trim()
  }
  return "Не удалось выполнить действие."
}
