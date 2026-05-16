/**
 * Static copy for the Medusa Admin product-reviews moderation views.
 *
 * Phase 4 / step 2 — ported one-to-one from
 * [`payload-cms/src/views/product-reviews-moderation/copy.ts`](payload-cms/src/views/product-reviews-moderation/copy.ts:1)
 * minus the Payload-only `dashboardWidget` block (the Medusa counter
 * widget is added later, in Phase 4 / step 5, with its own copy).
 *
 * Plan §10.2 mandates plain-text rendering everywhere — these strings
 * are shown via React's normal text interpolation, never via
 * `dangerouslySetInnerHTML`, so XSS protection is enforced by React's
 * automatic escaping.
 *
 * The export name `moderationCopy` is intentionally preserved so the
 * eventual move of the Payload-side imports to this module is a single
 * specifier change.
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
      transport:
        'Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз.',
      unauthorized:
        'Сессия истекла или недостаточно прав. Перезайдите в админку.',
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
      images: 'Фотографии',
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
      imageAltLabel: 'Фото №{index}',
      imageOpenLabel: 'Открыть в новой вкладке',
    },
    actions: {
      approve: 'Одобрить',
      reject: 'Отклонить',
      delete: 'Удалить',
    },
    /**
     * Phase 4 / step 2 — exposed under `detail.reject.*` to mirror the
     * Payload `detail.rejectForm.*` namespace verbatim. The shorter
     * `reject` key here matches the user-supplied
     * [`error-mapping.ts`](medusa-agency-boilerplate/src/admin/routes/product-reviews/lib/error-mapping.ts:1)
     * spec, while `rejectForm` is kept as an alias so future component
     * code can import either label set without churn.
     */
    reject: {
      heading: 'Причина отклонения',
      placeholder:
        'Опишите, почему отзыв отклонён (видно только модераторам)',
      submit: 'Отклонить отзыв',
      cancel: 'Отмена',
      hint: 'Обязательно. Не более 500 символов.',
      reasonRequired: 'Введите причину отклонения.',
      reasonTooLong: 'Причина не должна превышать 500 символов.',
    },
    rejectForm: {
      heading: 'Причина отклонения',
      placeholder:
        'Опишите, почему отзыв отклонён (видно только модераторам)',
      submit: 'Отклонить отзыв',
      cancel: 'Отмена',
      hint: 'Обязательно. Не более 500 символов.',
      validationRequired: 'Введите причину отклонения.',
      validationLength: 'Причина не должна превышать 500 символов.',
    },
    /**
     * «Ответ магазина» секция в детальной view. `{current}` / `{max}`
     * подставляются client-side через `String.replace`, как и
     * `rating.starsAria(n)`.
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
      bodyWithImages:
        'У отзыва прикреплены фотографии — они также будут удалены из хранилища.',
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
    /**
     * Phase 4 / step 2 — error namespace consumed by
     * [`error-mapping.ts`](medusa-agency-boilerplate/src/admin/routes/product-reviews/lib/error-mapping.ts:1).
     * `transport` is new to the Medusa port (Payload had it under the
     * `list.error.transport` namespace only) and surfaces both
     * `transport_error` and `aborted` cases from the shared fetch wrapper.
     */
    error: {
      notFound: 'Отзыв не найден.',
      transport: 'Не удалось связаться с сервером.',
      unauthorized:
        'Сессия истекла или недостаточно прав. Перезайдите в админку.',
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
} as const

export type ModerationCopy = typeof moderationCopy
