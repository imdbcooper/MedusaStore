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
