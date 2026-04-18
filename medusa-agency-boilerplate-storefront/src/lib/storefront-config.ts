export type StorefrontLink = {
  label: string
  href: string
}

export const storefrontConfig = {
  storeName: "Интернет-магазин",
  defaultTitle: "Витрина магазина",
  defaultDescription:
    "Готовая витрина для каталога, корзины, оформления заказа и личного кабинета.",
  tagline: "Каталог, корзина и оформление заказа в нейтральном RU-ready baseline.",
  contact: {
    email: "hello@example.com",
    phone: "+7 (000) 000-00-00",
  },
  socialLinks: [
    {
      label: "Telegram",
      href: "https://t.me/your_store",
    },
    {
      label: "VK",
      href: "https://vk.com/your_store",
    },
    {
      label: "WhatsApp",
      href: "https://wa.me/70000000000",
    },
  ] as StorefrontLink[],
  copy: {
    common: {
      allRightsReserved: "Все права защищены.",
      builtWith: "Работает на",
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
      reviewTermsPrefix: "Нажимая кнопку «Оформить заказ», вы подтверждаете согласие с условиями оформления заказа и политикой конфиденциальности",
      reviewTermsStoreSuffix: ".",
      yookassaRedirectHint:
        "После подтверждения статуса кнопка ниже продолжит сценарий оформления заказа.",
      yookassaReturnBanner:
        "Возврат из YooKassa выполнен. После подтверждения статуса кнопка ниже продолжит сценарий оформления заказа.",
      yookassaHostedRedirect:
        "После подтверждения заказа откроется форма оплаты YooKassa.",
      additionalStep: "После подтверждения заказа откроется следующий шаг оплаты.",
      selectPaymentMethod: "Выберите способ оплаты",
      confirmAndGoToYooKassa: "Подтвердить и перейти в YooKassa",
      placeOrder: "Оформить заказ",
      method: "Способ",
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
