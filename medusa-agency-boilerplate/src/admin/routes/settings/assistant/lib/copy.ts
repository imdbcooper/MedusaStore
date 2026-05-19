/**
 * PR 4 — RU-копи для admin-страницы AI-ассистента.
 *
 * Все строки UI собраны здесь и импортируются в JSX. Никаких хардкодных
 * подписей в компонентах — единственный источник для копирайтера.
 *
 * Структура повторяет
 * [`product-reviews/lib/copy.ts`](medusa-agency-boilerplate/src/admin/routes/product-reviews/lib/copy.ts:1):
 * объект `as const` плюс `type AssistantCopy = typeof assistantCopy`.
 *
 * Плейсхолдеры в шаблонах подставляются через `String.replace`
 * (`{count}`, `{n}`) — i18n-фреймворка нет (PR 4: «без i18n»).
 */
export const assistantCopy = {
  pageTitle: "AI Ассистент",
  pageSubtitle:
    "Настройка LLM-провайдеров, fallback-цепочки и параметров AI-ассистента магазина.",

  tabs: {
    providers: "Провайдеры",
    general: "Общие настройки",
    health: "Состояние",
  },

  // -------------------------------------------------------------------------
  // Common
  // -------------------------------------------------------------------------
  common: {
    save: "Сохранить",
    cancel: "Отмена",
    close: "Закрыть",
    edit: "Редактировать",
    delete: "Удалить",
    add: "Добавить",
    refresh: "Обновить",
    retry: "Повторить",
    back: "Назад",
    yes: "Да",
    no: "Нет",
    none: "—",
    loading: "Загрузка…",
    saving: "Сохранение…",
    saved: "Сохранено.",
    revert: "Отменить изменения",
    optional: "необязательно",
  },

  // -------------------------------------------------------------------------
  // Providers tab
  // -------------------------------------------------------------------------
  providers: {
    heading: "Провайдеры",
    subheading:
      "OpenAI-совместимые LLM-эндпоинты. Один помечен «Активный», остальные могут быть в fallback-цепочке.",

    addCta: "Добавить провайдера",
    refreshCta: "Обновить",

    columns: {
      name: "Название",
      baseUrl: "Base URL",
      model: "Модель",
      status: "Статус",
      lastTest: "Последний тест",
      actions: "Действия",
    },

    status: {
      active: "Активный",
      fallback: (n: number) => `Fallback #${n}`,
      disabled: "Отключён",
      none: "—",
    },

    lastTest: {
      never: "не запускался",
      okSuffix: "OK",
      errorSuffix: "ошибка",
    },

    actions: {
      test: "Тест",
      edit: "Редактировать",
      activate: "Сделать активным",
      enable: "Включить",
      disable: "Отключить",
      delete: "Удалить",
      menu: "Действия",
    },

    confirmActivate: {
      title: "Сделать активным?",
      description:
        "Этот провайдер будет использоваться по умолчанию. Текущий активный провайдер потеряет статус.",
      confirm: "Сделать активным",
    },
    confirmEnableDisable: {
      enableTitle: "Включить провайдера?",
      enableDescription:
        "Провайдер сможет использоваться в fallback-цепочке и проходить probe-тест.",
      enableConfirm: "Включить",
      disableTitle: "Отключить провайдера?",
      disableDescription:
        "Провайдер будет исключён из fallback-цепочки. Активным он остаться не может.",
      disableConfirm: "Отключить",
    },
    confirmDelete: {
      title: "Удалить провайдера?",
      description:
        "Действие необратимо. API-ключ и история тестов будут удалены.",
      titleActive: "Этот провайдер активный. Удалить всё равно?",
      descriptionActive:
        "После удаления активного провайдера ассистент будет использовать первого в fallback-цепочке. Если такого нет, чат-сервис вернёт ошибку.",
      confirm: "Удалить",
    },

    toasts: {
      created: "Провайдер создан.",
      updated: "Изменения сохранены.",
      activated: "Провайдер сделан активным.",
      deleted: "Провайдер удалён.",
      enabled: "Провайдер включён.",
      disabled: "Провайдер отключён.",
      testStarted: "Запускаем probe…",
      testOk: (latencyMs: number) =>
        `Соединение работает (${latencyMs} мс).`,
      reorderSaved: "Порядок fallback-цепочки сохранён.",
      reorderEmpty: "Цепочка не изменилась.",
    },

    empty: {
      heading: "Провайдеров пока нет",
      body: "Добавьте OpenAI-совместимый эндпоинт, чтобы запустить ассистента.",
      addCta: "Добавить первого провайдера",
    },

    errors: {
      load: "Не удалось загрузить список провайдеров.",
    },
  },

  // -------------------------------------------------------------------------
  // Provider form drawer
  // -------------------------------------------------------------------------
  providerForm: {
    createTitle: "Новый провайдер",
    editTitle: "Провайдер",
    description:
      "OpenAI-совместимый эндпоинт. API-ключ хранится в зашифрованном виде, plain-text никогда не возвращается на клиент.",

    fields: {
      name: "Название",
      namePlaceholder: "openai-prod",
      nameHint:
        "Уникальное короткое имя. Видно только в админке.",

      baseUrl: "Base URL",
      baseUrlPlaceholder: "https://api.openai.com/v1",
      baseUrlHint:
        "Должен начинаться с http:// или https://. Без `/chat/completions` на конце.",

      apiKey: "API-ключ",
      apiKeyCreatePlaceholder: "sk-…",
      apiKeyEditPlaceholder: (last4: string) => `sk-***${last4}`,
      apiKeyEditHint:
        "Оставьте пустым, чтобы не менять ключ. Чтобы заменить — введите новый полностью.",
      apiKeyCreateHint: "Не хранится в plain-text — шифруется AES-256-GCM.",

      model: "Модель",
      modelPlaceholder: "gpt-4o-mini",
      modelHint: "Имя модели в формате провайдера (gpt-4o-mini, claude-…, и т. п.).",

      temperature: "Temperature",
      temperatureHint: "От 0 до 2. По умолчанию 0.2.",

      maxTokens: "Max tokens",
      maxTokensHint: "От 1 до 32000. По умолчанию 1024.",

      topP: "Top-p",
      topPHint: "От 0 до 1. Оставьте пустым, чтобы не задавать.",

      timeoutMs: "Timeout (мс)",
      timeoutMsHint: "От 1000 до 120000. По умолчанию 30000.",

      requestHeaders: "Доп. заголовки запроса",
      requestHeadersPlaceholder:
        "Authorization: Bearer ...\nX-Org-Id: org_123",
      requestHeadersHint:
        "По одной паре `Key: Value` на строку. Применяются к каждому запросу к LLM.",

      isEnabled: "Включён",
      isEnabledHint:
        "Если выключено — не используется ни активно, ни в fallback.",

      fallbackPriority: "Приоритет в fallback",
      fallbackPriorityPlaceholder: "1, 2, 3…",
      fallbackPriorityHint:
        "Оставьте пустым, чтобы исключить из fallback. От 1 до 20.",
    },

    actions: {
      submitCreate: "Создать провайдера",
      submitEdit: "Сохранить",
      cancel: "Отмена",
    },

    validation: {
      nameRequired: "Название обязательно.",
      baseUrlRequired: "Base URL обязателен.",
      baseUrlInvalid:
        "Base URL должен начинаться с http:// или https://.",
      apiKeyRequired: "API-ключ обязателен для нового провайдера.",
      modelRequired: "Модель обязательна.",
      temperatureRange: "Temperature должно быть в [0, 2].",
      maxTokensRange: "Max tokens должно быть в [1, 32000].",
      topPRange: "Top-p должен быть в [0, 1].",
      timeoutMsRange: "Timeout должен быть в [1000, 120000] мс.",
      fallbackPriorityRange: "Приоритет должен быть в [1, 20].",
      headersFormat:
        "Заголовки должны быть в формате `Key: Value` по одной паре на строку.",
    },
  },

  // -------------------------------------------------------------------------
  // Fallback chain
  // -------------------------------------------------------------------------
  fallback: {
    heading: "Fallback-цепочка",
    subheading:
      "Порядок попыток, если активный провайдер недоступен. Drag & drop, чтобы изменить.",
    emptyState:
      "Ни один провайдер не назначен в fallback. Установите «Приоритет в fallback» в форме провайдера.",
    saveCta: "Сохранить порядок",
    cancelCta: "Отменить",
    saving: "Сохраняем…",
    dragHandleAria: (name: string) => `Перетащить «${name}»`,
    keyboardHint:
      "Используйте Tab для фокуса, пробел для захвата, стрелки для перемещения.",
  },

  // -------------------------------------------------------------------------
  // TestButton
  // -------------------------------------------------------------------------
  test: {
    cta: "Тест",
    running: "Тест…",
    okShort: (ms: number) => `OK · ${ms} мс`,
    failShort: "Ошибка",
  },

  // -------------------------------------------------------------------------
  // General tab
  // -------------------------------------------------------------------------
  general: {
    heading: "Общие настройки",
    subheading:
      "Глобальный system-prompt, RAG-параметры, лимиты и feature-флаги ассистента.",

    sections: {
      prompt: "Промпт",
      retrieval: "Retrieval (RAG)",
      embedding: "Embedding",
      limits: "Лимиты",
      behavior: "Поведение",
      allowedModels: "Разрешённые модели",
      tools: "Инструменты",
      guardrails: "Guardrails",
      rateLimits: "Rate limits",
      observability: "Observability",
      misc: "Прочее",
    },

    fields: {
      systemPrompt: "System prompt",
      systemPromptHint: "Базовая инструкция, передаётся первой каждое обращение.",
      systemPromptCounter: (current: number, max: number) =>
        `${current.toLocaleString("ru-RU")} / ${max.toLocaleString("ru-RU")} символов`,

      retrievalMode: "Режим retrieval",
      retrievalTopK: "Top-K документов",
      retrievalMinScore: "Min score (0..1)",

      embeddingProvider: "Embedding provider",
      embeddingModel: "Embedding model",
      embeddingDimension: "Embedding dimension",

      maxHistoryMessages: "Max history messages",
      maxInputChars: "Max input chars",
      maxOutputTokens: "Max output tokens",

      streamingEnabled: "Streaming",
      defaultLocale: "Default locale",

      allowedModels: "Allowed models (по строке)",
      allowedModelsHint:
        "Если пусто — без ограничений. Иначе ассистент будет использовать только эти модели.",

      usageTrackingEnabled: "Usage tracking",
    },

    actions: {
      save: "Сохранить",
      revert: "Отменить изменения",
    },

    toasts: {
      saved: "Настройки сохранены.",
      versionMismatch:
        "Настройки изменены другим пользователем. Обновите страницу и попробуйте снова.",
    },

    errors: {
      load: "Не удалось загрузить настройки.",
    },

    versionLabel: (n: number) => `Версия #${n}`,
  },

  // -------------------------------------------------------------------------
  // Health tab
  // -------------------------------------------------------------------------
  health: {
    heading: "Состояние",
    subheading:
      "Массовый probe всех включённых провайдеров и снапшот последних тестов.",

    runAllCta: "Проверить все провайдеры",
    running: "Проверяем…",
    summary: (ok: number, total: number) =>
      `Успешно: ${ok} из ${total}`,

    columns: {
      name: "Провайдер",
      latency: "Latency",
      status: "Статус",
      error: "Ошибка",
    },

    statusOk: "OK",
    statusError: "Ошибка",
    statusSkipped: "Пропущен",

    snapshotHeading: "Последние тесты",
    snapshotSubheading:
      "Снимок `last_test_*` по каждому провайдеру (обновляется после ручного probe).",

    empty: "Нет провайдеров для проверки.",
  },
} as const

export type AssistantCopy = typeof assistantCopy
