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
    "Настройка LLM-провайдеров, параметров рантайма и ручное управление индексом знаний ассистента магазина.",

  tabs: {
    providers: "Провайдеры",
    general: "Общие настройки",
    telegramHandoff: "Telegram / Handoff",
    operations: "Индексация и статус",
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

    encryptionWarning:
      "На сервере не настроен ASSISTANT_SETTINGS_ENCRYPTION_KEY. Пока он не задан в backend env, сохранять и ротировать API-ключи провайдеров из админки нельзя.",

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

  telegramHandoff: {
    heading: "Telegram handoff",
    subheading:
      "Конфигурация и live-проверка Telegram handoff для операторской support-группы.",

    status: {
      disabled: "Disabled",
      notConfigured: "Not configured",
      partiallyConfigured: "Partially configured",
      ready: "Ready for connection test",
      canTest: "Можно запускать live connection test.",
      cannotTest: "Сначала заполните обязательные поля.",
      missing: "Не хватает:",
    },

    sections: {
      diagnostics: "Диагностика",
      connection: "Конфигурация подключения",
      access: "Доступ операторов",
      behavior: "Поведение handoff",
      checklist: "Что подготовить позже",
    },

    fields: {
      enabled: "Включить Telegram handoff",
      enabledHint:
        "Пока выключено — можно сохранить неполную конфигурацию без бота и группы.",
      environmentMode: "Режим окружения",
      environmentModeHint:
        "В `test` можно оставить пустые списки операторов и админов.",
      botToken: "Bot token",
      botTokenHint:
        "Хранится только в зашифрованном виде. Оставьте пустым, чтобы не менять сохранённый токен.",
      botUsername: "Bot username",
      botUsernameHint:
        "Пока можно заполнить вручную или оставить пустым до будущего auto-detect.",
      supportChatId: "Support chat ID",
      supportChatIdHint:
        "Telegram numeric id приватной supergroup, обычно вида `-100…`.",
      topicsRequired: "Topics / Forum обязательны",
      topicsRequiredHint:
        "Для MVP handoff предполагается, что в support-группе включены Topics.",
      webhookUrl: "Webhook URL",
      webhookUrlHint:
        "Webhook URL, который должен быть зарегистрирован у Telegram-бота.",
      webhookSecret: "Webhook secret",
      webhookSecretHint:
        "Секрет хранится зашифрованно. Можно ввести новый вручную, старое значение не раскрывается.",
      allowedOperatorIds: "Allowed operator IDs",
      allowedOperatorIdsHint:
        "Telegram numeric user id операторов. По одному id на строке или через запятую.",
      allowedAdminIds: "Allowed admin IDs",
      allowedAdminIdsHint:
        "Telegram numeric user id администраторов handoff.",
      operatorReplyMode: "Operator reply mode",
      operatorReplyModeHint:
        "Как интерпретировать ответы операторов внутри topic.",
      fallbackMessage: "Fallback message",
      fallbackMessageHint:
        "Сообщение для клиента на случай, если Telegram недоступен или handoff нельзя завершить.",
    },

    placeholders: {
      botTokenEmpty: "123456:ABCDEF…",
      botTokenMasked: (masked: string) => masked,
      botUsername: "shop_support_bot",
      supportChatId: "-1001234567890",
      webhookUrl: "https://example.com/api/telegram/webhook",
      webhookSecretEmpty: "Введите новый secret",
      webhookSecretMasked: (masked: string) => masked,
      ids: "123456789\n987654321",
      fallbackMessage:
        "Telegram handoff временно недоступен. Оставьте контакты, и мы вернёмся к вам другим способом.",
    },

    environmentModes: {
      test: "test",
      production: "production",
    },

    operatorReplyModes: {
      explicitReplyCommand: "explicit_reply_command",
      allTopicMessages: "all_topic_messages",
    },

    checklist: {
      intro:
        "Даже если бот и support-группа ещё не созданы, здесь можно заранее сохранить будущие параметры handoff.",
      items: [
        "Создать Telegram-бота через BotFather.",
        "Подготовить приватную Telegram supergroup для операторов.",
        "Включить Topics / Forum в support-группе.",
        "Добавить бота в группу и выдать ему admin-права.",
        "Получить numeric support chat id группы.",
        "Собрать numeric Telegram user IDs операторов и админов.",
      ],
    },

    lastTest: {
      never: "Проверка соединения ещё не запускалась.",
      at: "Последняя проверка",
    },

    actions: {
      save: "Сохранить настройки",
      revert: "Отменить изменения",
      test: "Test connection",
      testing: "Проверяем…",
    },

    toasts: {
      saved: "Telegram handoff настройки сохранены.",
      testPassed: "Соединение с Telegram подтверждено.",
      testMissing:
        "Проверка завершена с замечаниями. Смотрите результат и детали ниже.",
      saveFirst:
        "Есть несохранённые изменения. Сначала сохраните конфигурацию, если хотите протестировать именно её.",
    },

    errors: {
      load: "Не удалось загрузить Telegram handoff конфигурацию.",
      idsInvalid:
        "Проверьте списки operator/admin ids — нужны только numeric Telegram user ids.",
    },
  },

  operations: {
    heading: "Каталог, знания и runtime",
    subheading:
      "Полный reindex каталога, ручной запуск очереди, синхронизация Markdown-базы знаний и снимок состояния assistant backend.",

    runtime: {
      heading: "Readiness",
      subheading:
        "Безопасная диагностика server-side конфигурации. Значения секретов не показываются, виден только статус readiness.",
      cards: {
        adapter: "Backend adapter",
        encryption: "Шифрование provider secret",
        service: "Assistant backend",
        retrieval: "Retrieval mode",
      },
      configured: "Настроено",
      missing: "Не настроено",
      ok: "Готово",
      degraded: "Degraded",
      disabled: "Отключено",
      missingKeys: "Не хватает:",
    },

    catalog: {
      heading: "Каталог товаров и услуг",
      subheading:
        "Ставит reindex в очередь assistant backend. После enqueue очередь нужно отдельно обработать.",
      fullReindexCta: "Поставить полный reindex каталога",
      selectedReindexCta: "Поставить reindex выбранных товаров",
      processQueueCta: "Обработать очередь",
      productIds: "Product IDs",
      productIdsPlaceholder: "prod_123\\nprod_456",
      productIdsHint:
        "По одному `product_id` на строке или через запятую. Используется для точечного обновления знаний по товарам.",
      storeId: "Store ID",
      locale: "Locale",
      regionId: "Region ID",
      currencyCode: "Currency code",
      processLimit: "Сколько intent обработать за запуск",
      processBackoff: "Retry backoff (секунды)",
    },

    knowledge: {
      heading: "Markdown knowledge и vector index",
      subheading:
        "Можно загрузить или создать Markdown-документ прямо из админки: frontmatter добавляется автоматически, документ сразу синхронизируется в knowledge index. Базовые файлы из `ai-assistant/knowledge/*.md` тоже остаются частью общей базы знаний.",
      markdownSyncCta: "Синхронизировать Markdown knowledge",
      vectorSyncCta: "Пересобрать vector index",
      vectorSourceType: "Source type для vector reindex",
      vectorSourceTypeAll: "Все источники",
      vectorSourceTypeMarkdown: "Только Markdown",
      vectorSourceTypeProducts: "Только товары",
      documentHeading: "Новый Markdown-документ",
      documentSubheading:
        "Загрузите `.md` файл или вставьте текст вручную. Сервис сам сформирует frontmatter с `title` и `description`, сохранит документ в persistent storage assistant backend и сразу переиндексирует его.",
      documentTitle: "Название документа",
      documentTitlePlaceholder: "Доставка и оплата",
      documentDescription: "Описание для ассистента",
      documentDescriptionPlaceholder:
        "Короткая сводка о том, что именно описывает документ и в каких вопросах ассистент должен на него опираться.",
      documentFile: "Файл `.md`",
      documentFileHint:
        "Файл нужен только как источник текста. Даже если в нём уже есть frontmatter, ассистент сохранит документ в canonical-виде и добавит свой frontmatter заново.",
      documentContent: "Markdown-контент",
      documentContentPlaceholder: "# Заголовок\n\nТекст Markdown-документа…",
      documentContentHint:
        "Описание из frontmatter тоже попадёт в retrieval-контекст, поэтому заполняйте его как короткую семантическую сводку.",
      documentAutoFrontmatterHint:
        "Файл будет сохранён с автоматически сгенерированным frontmatter: `title`, `description`, `source_type`, `source_id`, `store_id`, `locale`.",
      documentSelectedFile: (name: string) => `Выбран файл: ${name}`,
      documentSaveCta: "Сохранить документ и синхронизировать",
      documentClearCta: "Очистить форму",
    },

    stats: {
      heading: "Снимок assistant backend",
      subheading:
        "Текущие счётчики документов/чанков и состояние основных компонентов assistant service.",
      noStats: "Статистика assistant backend недоступна, пока backend adapter не готов.",
      documentCount: "Документов",
      chunkCount: "Чанков",
      indexedProducts: "Проиндексировано товаров",
      messages: "Сообщений",
      pendingIntents: "Pending intents",
      errorIntents: "Intents с ошибкой",
    },

    intents: {
      heading: "Очередь reindex intent",
      subheading:
        "Последние intent’ы из assistant backend. Здесь видно, что реально ждёт обработки и какие job уже были запущены.",
      filters: {
        all: "Все",
        pending: "Pending",
        processing: "Processing",
        completed: "Completed",
        error: "Error",
      },
      columns: {
        event: "Событие",
        scope: "Scope",
        products: "Товары",
        status: "Статус",
        attempts: "Попытки",
        updated: "Обновлён",
        job: "Job",
      },
      empty: "Очередь пуста.",
      refreshCta: "Обновить очередь",
      inspectJobCta: "Открыть job",
      noJob: "—",
    },

    job: {
      heading: "Статус выбранного job",
      empty: "Выберите intent с `assistant_job_id`, чтобы посмотреть payload job.",
      status: "Статус",
      source: "Источник",
      createdAt: "Создан",
      error: "Ошибка",
      result: "Result",
    },

    toasts: {
      fullQueued: "Полный reindex каталога поставлен в очередь.",
      selectedQueued: (count: number) =>
        `В очередь поставлен reindex для ${count} товар(ов).`,
      queueProcessed: (count: number) =>
        `Обработка очереди завершена. Claimed: ${count}.`,
      markdownSynced: "Markdown knowledge пересинхронизирован.",
      knowledgeDocumentSaved: (path: string) =>
        `Markdown-документ сохранён и синхронизирован: ${path}.`,
      vectorSynced: "Vector index пересобран.",
      jobLoaded: "Статус job обновлён.",
    },

    errors: {
      runtime: "Не удалось загрузить readiness assistant runtime.",
      stats: "Не удалось загрузить статистику assistant backend.",
      intents: "Не удалось загрузить очередь reindex intent.",
      productIdsRequired:
        "Добавьте хотя бы один product_id или используйте полный reindex каталога.",
      knowledgeTitleRequired: "Добавьте название документа.",
      knowledgeDescriptionRequired:
        "Добавьте короткое описание — оно нужно для frontmatter и retrieval-контекста.",
      knowledgeContentRequired:
        "Добавьте Markdown-контент или загрузите `.md` файл.",
      knowledgeFileRead:
        "Не удалось прочитать выбранный `.md` файл. Проверьте кодировку и попробуйте снова.",
    },
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
