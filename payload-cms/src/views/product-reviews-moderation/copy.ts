/**
 * Static copy for the product-reviews moderation view.
 *
 * Plan §10.2 mandates plain-text rendering everywhere — these strings are
 * shown via React's normal text interpolation, never via
 * `dangerouslySetInnerHTML`, so XSS protection is enforced by the
 * framework's automatic escaping.
 *
 * Payload CMS does not yet have a project-wide i18n facility for custom
 * view labels; if/when one lands (likely shared with marketing UI per
 * plans/marketing-ui-payload-cms.md), this object becomes the migration
 * source.
 */
export const moderationCopy = {
  meta: {
    title: 'Модерация отзывов',
    description: 'Очередь отзывов о товарах',
  },
  nav: {
    label: 'Модерация отзывов',
  },
  list: {
    heading: 'Модерация отзывов',
    subheading:
      'Просмотр, одобрение и отклонение отзывов покупателей о товарах.',
    filters: {
      status: 'Статус',
      statusAll: 'Все',
      statusPending: 'На модерации',
      statusApproved: 'Опубликованы',
      statusRejected: 'Отклонены',
      rating: 'Рейтинг',
      ratingAny: 'Любой',
      productId: 'ID товара',
      productIdPlaceholder: 'prod_…',
      dateFrom: 'Дата с',
      dateTo: 'Дата по',
      submit: 'Применить',
      reset: 'Сбросить',
    },
    columns: {
      product: 'Товар',
      customer: 'Покупатель',
      rating: 'Рейтинг',
      text: 'Текст',
      status: 'Статус',
      createdAt: 'Дата',
      actions: 'Действия',
    },
    actions: {
      open: 'Открыть',
      approve: 'Одобрить',
      reject: 'Отклонить',
    },
    empty: 'Нет отзывов по выбранным фильтрам.',
    pagination: {
      previous: 'Назад',
      next: 'Вперёд',
      pageOf: (page: number, totalPages: number) =>
        `Страница ${page} из ${Math.max(totalPages, 1)}`,
      total: (total: number) => `Всего: ${total}`,
    },
    error: {
      configMissing:
        'Не удалось загрузить. Проверьте конфигурацию (MEDUSA_BACKEND_URL / MEDUSA_ADMIN_SECRET_API_KEY).',
      transport:
        'Не удалось связаться с Medusa. Проверьте, что бэкенд запущен и доступен.',
      unauthorized:
        'Нет доступа. Проверьте, что у MEDUSA_ADMIN_SECRET_API_KEY роль admin.',
      generic: 'Не удалось загрузить отзывы.',
      retry: 'Повторить',
    },
    notes: {
      ratingClientFilter:
        'Фильтр по рейтингу применён только к текущей странице — поля «Всего» и пагинация считаются по остальным фильтрам.',
    },
  },
  detail: {
    backToList: 'Назад к списку',
    heading: 'Отзыв',
    sections: {
      review: 'Отзыв',
      meta: 'Метаданные',
      customer: 'Покупатель',
    },
    fields: {
      title: 'Заголовок',
      text: 'Текст',
      pros: 'Достоинства',
      cons: 'Недостатки',
      rating: 'Рейтинг',
      status: 'Статус',
      product: 'Товар',
      customerName: 'Имя',
      customerId: 'ID покупателя',
      orderId: 'ID заказа',
      createdAt: 'Создан',
      moderatedBy: 'Модератор',
      moderatedAt: 'Дата модерации',
      rejectionReason: 'Причина отклонения',
      verifiedPurchase: 'Подтверждённая покупка',
      anonymous: 'Анонимизирован',
      none: '—',
      yes: 'Да',
      no: 'Нет',
    },
    actions: {
      approve: 'Одобрить',
      reject: 'Отклонить',
      delete: 'Удалить',
    },
    rejectForm: {
      heading: 'Причина отклонения',
      placeholder: 'Опишите, почему отзыв отклонён (видно только модераторам)',
      submit: 'Отклонить отзыв',
      cancel: 'Отмена',
      hint: 'Обязательно. Не более 500 символов.',
      validationRequired: 'Введите причину отклонения.',
      validationLength: 'Причина не должна превышать 500 символов.',
    },
    /**
     * Phase 3 / step 4 — «Ответ магазина» секция в детальной view.
     * Текст храниться в едином `moderationCopy` объекте, чтобы будущая
     * миграция на i18n затронула один файл (см. comment в `copy.ts`).
     * `{current}` / `{max}` подставляются client-side через
     * `String.replace`, как и `rating.starsAria(n)`.
     */
    reply: {
      title: 'Ответ магазина',
      empty: 'Ответ не оставлен',
      authorPrefix: 'От:',
      datePrefix: 'Опубликовано:',
      addCta: 'Добавить ответ',
      editCta: 'Изменить ответ',
      removeCta: 'Удалить ответ',
      submit: 'Сохранить ответ',
      cancel: 'Отмена',
      hint: 'Будет отображаться публично под отзывом покупателя.',
      placeholder: 'Например, спасибо за отзыв и обратную связь…',
      charCounter: '{current} / {max}',
      removeConfirm: 'Удалить ответ магазина?',
      success: {
        saved: 'Ответ сохранён.',
        removed: 'Ответ удалён.',
      },
      errors: {
        required: 'Введите текст ответа.',
        tooLong: 'Ответ не должен превышать 1000 символов.',
        generic: 'Не удалось сохранить ответ.',
      },
    },
    deleteConfirm: {
      heading: 'Удалить отзыв?',
      body: 'Действие необратимо. Если отзыв был опубликован, рейтинг товара будет пересчитан.',
      confirm: 'Удалить',
      cancel: 'Отмена',
    },
    success: {
      approved: 'Отзыв одобрен.',
      rejected: 'Отзыв отклонён.',
      deleted: 'Отзыв удалён.',
      replySaved: 'Ответ сохранён.',
      replyRemoved: 'Ответ удалён.',
    },
    error: {
      notFound: 'Отзыв не найден.',
      configMissing:
        'Не удалось выполнить действие. Проверьте MEDUSA_BACKEND_URL / MEDUSA_ADMIN_SECRET_API_KEY.',
      transport: 'Не удалось связаться с Medusa.',
      unauthorized:
        'Нет доступа. Проверьте, что у MEDUSA_ADMIN_SECRET_API_KEY роль admin.',
      generic: 'Не удалось выполнить действие.',
    },
    notFoundView: {
      heading: 'Отзыв не найден',
      body: 'Возможно, его уже удалили или ID указан неверно.',
    },
  },
  status: {
    pending: 'На модерации',
    approved: 'Опубликован',
    rejected: 'Отклонён',
  },
  rating: {
    starsAria: (n: number) => `Рейтинг ${n} из 5`,
  },
  /**
   * Plan §5.3 + §9 Phase 2 step 3 — мини-виджет «Отзывы на модерации: N»
   * на дашборде Payload. Полностью статичная копия; счётчик и ссылка
   * формируются в server component
   * [`DashboardWidget.tsx`](payload-cms/src/views/product-reviews-moderation/DashboardWidget.tsx:1).
   */
  dashboardWidget: {
    title: 'Отзывы на модерации',
    empty: 'Нет отзывов на модерации',
    action: 'Перейти к очереди',
    errors: {
      configMissing:
        'Не настроено: MEDUSA_BACKEND_URL / MEDUSA_ADMIN_SECRET_API_KEY',
      unauthorized: 'Нет доступа. Проверьте роль admin у API-ключа.',
      generic: 'Не удалось загрузить счётчик',
    },
  },
} as const

export type ModerationCopy = typeof moderationCopy
