export type StorefrontLink = {
  label: string
  href: string
}

// Mandatory client-init branding and legal-contact replacements live here.
// Keep preset-specific presentation authority in `src/lib/storefront-client-config.ts`.
export const storefrontConfig = {
  storeName: "StudioPro",
  defaultTitle: "StudioPro — премиальные сайты для бизнеса",
  defaultDescription:
    "StudioPro помогает запускать конверсионные сайты, интернет-магазины и корпоративные digital-решения на рабочей storefront-инфраструктуре.",
  tagline: "Премиальные сайты для бизнеса. Без лишних переплат.",
  contact: {
    email: "hello@studiopro.example",
    phone: "+7 (999) 000-00-00",
  },
  socialLinks: [
    {
      label: "Telegram",
      href: "https://t.me/studiopro",
    },
    {
      label: "VK",
      href: "https://vk.com/studiopro",
    },
    {
      label: "WhatsApp",
      href: "https://wa.me/79990000000",
    },
  ] as StorefrontLink[],
  copy: {
    common: {
      allRightsReserved: "Все права защищены.",
      viewAll: "Смотреть все",
      subtotal: "Подытог",
      subtotalExcludingShippingAndTaxes: "Подытог без доставки и налогов",
      subtotalExcludingTaxes: "без налогов",
      shipping: "Доставка",
      discount: "Скидка",
      taxes: "Налоги",
      total: "Итого",
      selectPlaceholder: "Выберите...",
      edit: "Изменить",
      remove: "Удалить",
      cancel: "Отмена",
      save: "Сохранить",
      saveChanges: "Сохранить изменения",
      contact: "Контакты",
      notFoundTitle: "Страница не найдена",
      notFoundDescription: "Запрошенная страница недоступна или была перемещена.",
      returnHome: "Вернуться на главную",
      goBackToCatalog: "Перейти в каталог",
    },
    navigation: {
      menu: "Меню",
      home: "Главная",
      catalog: "Каталог",
      account: "Аккаунт",
      cart: "Корзина",
      back: "Назад",
      backToCart: "Вернуться в корзину",
      shippingTo: "Доставка в:",
    },
    hero: {
      browseCatalog: "Перейти в каталог",
      openAccount: "Открыть аккаунт",
    },
    footer: {
      categories: "Категории",
      collections: "Коллекции",
      information: "Информация",
      customerCare: "Покупателям",
      social: "Соцсети",
    },
    cart: {
      emptyTitle: "Корзина",
      emptyDescription:
        "В корзине пока ничего нет. Перейдите в каталог, чтобы добавить товары.",
      exploreProducts: "Перейти в каталог",
      signInTitle: "Уже есть аккаунт?",
      signInDescription:
        "Войдите, чтобы быстрее оформить заказ и видеть историю покупок.",
      signIn: "Войти",
      summary: "Итого",
      goToCheckout: "Перейти к оформлению",
      goToCart: "Перейти в корзину",
      emptyDropdown: "Ваша корзина пока пуста.",
      goToAllProducts: "Перейти ко всем товарам",
      quantity: "Количество",
      remove: "Удалить",
    },
    checkout: {
      title: "Оформление заказа",
      inYourCart: "В вашей корзине",
      shippingAddress: "Адрес доставки",
      billingAddress: "Платёжный адрес",
      sameAsShipping: "Платёжный адрес совпадает с адресом доставки.",
      delivery: "Доставка",
      shippingMethod: "Способ доставки",
      deliveryMethodHint: "Выберите удобный способ получения заказа",
      pickup: "Самовывоз",
      pickupHint: "Выберите удобную точку самовывоза",
      pickupYourOrder: "Забрать заказ самостоятельно",
      store: "Точка самовывоза",
      continueToDelivery: "Перейти к доставке",
      continueToPayment: "Перейти к оплате",
      payment: "Оплата",
      paymentMethod: "Способ оплаты",
      paymentDetails: "Детали оплаты",
      continueToReview: "Перейти к подтверждению",
      enterCardDetails: "Введите данные карты",
      giftCard: "Подарочная карта",
      review: "Подтверждение",
      reviewTermsPrefix:
        "Нажимая кнопку «Оформить заказ», вы подтверждаете согласие с условиями оформления заказа и политикой конфиденциальности магазина",
      reviewTermsStoreSuffix: ".",
      yookassaRedirectHint:
        "После возврата из YooKassa кнопка ниже завершит оформление, когда платёж получит подтверждение.",
      yookassaReturnBanner:
        "Возврат из YooKassa зафиксирован. Если платёж уже подтверждён, заказ можно завершить этой же кнопкой.",
      yookassaHostedRedirect:
        "После подтверждения заказа откроется защищённая форма оплаты YooKassa.",
      additionalStep:
        "После подтверждения заказа откроется следующий шаг оплаты или подтверждения.",
      manualPaymentDetails:
        "Заказ будет создан без онлайн-оплаты. Дальнейшие инструкции предоставит магазин.",
      selectPaymentMethod: "Выберите способ оплаты",
      confirmAndGoToYooKassa: "Подтвердить и перейти в YooKassa",
      placeOrder: "Оформить заказ",
      method: "Способ",
      shippingRateUnavailable:
        "Стоимость будет уточнена после выбора способа доставки.",
    },
    account: {
      title: "Личный кабинет",
      overview: "Обзор",
      profile: "Профиль",
      addresses: "Адреса",
      orders: "Заказы",
      logOut: "Выйти",
      welcomeBack: "С возвращением",
      signInTitle: "Вход в аккаунт",
      signInDescription:
        "Войдите, чтобы управлять заказами и данными аккаунта.",
      notMember: "Ещё нет аккаунта?",
      join: "Зарегистрироваться",
      hello: "Здравствуйте",
      signedInAs: "Вы вошли как",
      completed: "Заполнено",
      saved: "Сохранено",
      recentOrders: "Последние заказы",
      noRecentOrders: "Заказов пока нет",
      openOrder: "Открыть заказ",
      dashboardDescription: "Обзор активности и данных вашего аккаунта.",
      ordersDescription:
        "Просматривайте историю заказов и их статусы. При необходимости можно запросить передачу заказа.",
      addressesTitle: "Адреса доставки",
      addressesDescription:
        "Просматривайте и обновляйте адреса доставки. Сохранённые адреса будут доступны при оформлении заказа.",
      profileDescription:
        "Обновляйте имя, email, телефон и платёжный адрес в личном кабинете.",
      addressFormTitle: "Редактирование адреса",
      firstName: "Имя",
      lastName: "Фамилия",
      company: "Компания",
      address: "Адрес",
      addressLine2: "Квартира, офис и т. д.",
      postalCode: "Почтовый индекс",
      city: "Город",
      province: "Регион / Область",
      phone: "Телефон",
      updateError: "Не удалось сохранить изменения. Попробуйте ещё раз.",
    },
    order: {
      confirmedTitle: "Спасибо за заказ!",
      confirmedSubtitle: "Заказ успешно оформлен.",
      details: "Детали заказа",
      backToOverview: "Вернуться к списку заказов",
      summary: "Состав и сумма",
      confirmationSentPrefix: "Подтверждение заказа отправлено на",
      date: "Дата заказа",
      number: "Номер заказа",
      orderStatus: "Статус заказа",
      paymentStatus: "Статус оплаты",
      delivery: "Доставка",
      shippingAddress: "Адрес доставки",
      payment: "Оплата",
      paymentMethod: "Способ оплаты",
      paymentDetails: "Детали оплаты",
      method: "Способ",
      paidAt: "Оплачено",
      helpTitle: "Нужна помощь?",
      contactUs: "Связаться с нами",
      returnsAndExchanges: "Возвраты и обмен",
    },
    product: {
      details: "Описание",
      shippingAndReturns: "Условия оказания услуг",
      material: "Материал",
      countryOfOrigin: "Страна происхождения",
      type: "Тип",
      weight: "Вес",
      dimensions: "Габариты",
      /** IT-services specific labels */
      metadataDeadline: "Сроки выполнения",
      metadataResult: "Результат",
      metadataFormat: "Формат работы",
      serviceTermsTitle: "Сроки и формат",
      serviceTermsDescription:
        "Сроки выполнения и формат работы обсуждаются индивидуально на этапе консультации и фиксируются в договоре.",
      serviceGuaranteeTitle: "Гарантии",
      serviceGuaranteeDescription:
        "Мы гарантируем качество выполненных работ и бесплатные корректировки в рамках согласованного ТЗ в течение 30 дней после сдачи проекта.",
      serviceSupportTitle: "Поддержка",
      serviceSupportDescription:
        "После завершения проекта предоставляется техническая поддержка и консультации по эксплуатации решения.",
    },
    reviews: {
      tabTitle: "Отзывы",
      summary: {
        // `{rating}` and `{count}` are placeholders the storefront substitutes
        // before render. The plural-form for `count` is picked client-side via
        // `pluralizeRu` from `lib/util/pluralize-ru.ts`. Plan §6.7.
        average: "★ {rating} · {count} {countPlural}",
        empty: "Пока никто не оставил отзыв",
        // Compact suffix used by `ProductRatingBadge` next to the average
        // rating, e.g. «★ 4.7 (23 отзыва)». Same `{count}` / `{countPlural}`
        // placeholder contract as `summary.average`. Plan §6.2 / §7.
        shortCountTemplate: "({count} {countPlural})",
      },
      empty: {
        shortLabel: "Нет отзывов",
      },
      badge: {
        // Aria-label for the linked rating badge in `ProductInfo`.
        // Placeholders mirror `summary.average` / `summary.shortCountTemplate`.
        ariaLabel:
          "Перейти к отзывам, средний рейтинг {rating} из 5, {count} {countPlural}",
      },
      cta: {
        write: "Написать отзыв",
        helpful: "Полезно",
        helpfulVoted: "Спасибо!",
      },
      form: {
        title: "Написать отзыв",
        submitSuccess: "Спасибо! Ваш отзыв отправлен на модерацию.",
        alreadyExists: "Вы уже оставили отзыв на этот товар",
        requirePurchase: "Отзыв можно оставить только после покупки",
        authRequired: "Войдите, чтобы оставить отзыв",
        rateLimited: "Слишком много отзывов. Попробуйте позже.",
        error: "Не удалось отправить отзыв",
        // `{current}` and `{max}` are substituted client-side by the form
        // component (`product-review-form/index.tsx`).
        fields: {
          rating: "Ваша оценка",
          title: "Заголовок (необязательно)",
          text: "Текст отзыва",
          pros: "Достоинства (необязательно)",
          cons: "Недостатки (необязательно)",
          charCounter: "{current}/{max}",
        },
        // `{min}` / `{max}` are substituted client-side; the limits mirror
        // the backend Zod schema (plan §10.2 / §6.4).
        errors: {
          ratingRequired: "Поставьте оценку",
          textTooShort: "Минимум {min} символов",
          textTooLong: "Максимум {max} символов",
          titleTooLong: "Максимум {max} символов",
          prosTooLong: "Максимум {max} символов",
          consTooLong: "Максимум {max} символов",
        },
        actions: {
          submit: "Отправить отзыв",
          cancel: "Отмена",
          submitting: "Отправляем…",
        },
      },
      status: {
        pending: "На модерации",
        approved: "Опубликован",
        rejected: "Отклонён",
      },
      verified: "Проверенная покупка",
      list: {
        sortNewest: "Новые",
        sortHelpful: "Сначала полезные",
        loadMore: "Показать ещё",
        loading: "Загружаем…",
        error: "Не удалось загрузить отзывы",
        retry: "Попробовать снова",
      },
      // Plural forms used together with `summary.average` and the count badge
      // in catalog/info surfaces. Order is [one, few, many] — see
      // `pluralizeRu` doc.
      reviewWordForms: ["отзыв", "отзыва", "отзывов"],
    },
    freeShipping: {
      unlocked: "Бесплатная доставка доступна",
      unlock: "Откройте бесплатную доставку",
      remainingPrefix: "Осталось",
      remainingSuffix: "до порога",
      viewCart: "Перейти в корзину",
      viewProducts: "Перейти к товарам",
    },
  },
} as const

export const getMetadataTitle = (pageTitle?: string) => {
  if (!pageTitle) {
    return storefrontConfig.defaultTitle
  }

  return `${pageTitle} | ${storefrontConfig.storeName}`
}
