/**
 * PR 4 — TanStack Query keys для admin-страницы AI-ассистента.
 *
 * Один корень `["assistant-settings"]`, под которым сидят providers
 * (с опциональным `enabled_only`-фильтром), отдельные провайдеры
 * по `id` и singleton-настройки. Структура совпадает с рекомендацией
 * tkdodo «effective react-query keys»: партиал-ключ
 * (`assistantKeys.all`) инвалидирует всё дерево.
 */

export const assistantKeys = {
  all: ["assistant-settings"] as const,

  providers: (opts?: { enabledOnly?: boolean }) =>
    [
      ...assistantKeys.all,
      "providers",
      opts?.enabledOnly ? "enabled" : "all",
    ] as const,

  provider: (id: string) =>
    [...assistantKeys.all, "providers", id] as const,

  settings: () => [...assistantKeys.all, "settings"] as const,
}
