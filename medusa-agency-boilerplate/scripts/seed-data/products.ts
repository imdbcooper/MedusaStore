/**
 * Данные 39 товаров IT-услуг для seed-скрипта.
 * Источник: plans/product-catalog-plan.md
 *
 * Цены указаны в копейках (1₽ = 100 копеек).
 * manage_inventory: false — это услуги, не физические товары.
 */

export interface VariantDefinition {
  title: string;
  prices: { amount: number; currency_code: string }[];
  options: Record<string, string>;
  manage_inventory: boolean;
}

export interface ProductDefinition {
  handle: string;
  title: string;
  subtitle: string;
  description: string;
  collection_handle: string;
  status: "published" | "draft";
  is_giftcard: boolean;
  options: { title: string; values: string[] }[];
  variants: VariantDefinition[];
  metadata: Record<string, string>;
}

const RUB = "rub";

// Товары разбиты по коллекциям для читаемости.
// Экспорт единого массива в конце файла.

const webDevelopment: ProductDefinition[] = [
  {
    handle: "landing-page-pod-klyuch",
    title: "Landing Page «под ключ» для лидогенерации",
    subtitle: "Одностраничный сайт с высокой конверсией под рекламу",
    description: "Закажите разработку лендинга с конверсией выше рынка. Индивидуальный дизайн Mobile First, мгновенная загрузка на JAMstack-стеке, интеграция с CRM и рекламными системами. Передача лидов в amoCRM, Bitrix24 или RetailCRM через API. Защита форм от ботов, оценки PageSpeed 90+. Идеально для запуска продукта, тестирования ниши и подготовки к рекламным кампаниям.",
    collection_handle: "web-development",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Пакет", values: ["Стандарт", "Премиум"] }],
    variants: [
      { title: "Стандарт", prices: [{ amount: 15_000_00, currency_code: RUB }], options: { "Пакет": "Стандарт" }, manage_inventory: false },
      { title: "Премиум", prices: [{ amount: 30_000_00, currency_code: RUB }], options: { "Пакет": "Премиум" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Запуск нового продукта, тестирование ниши, рекламные кампании", tech_stack: "JAMstack, Next.js 15, Astro, Nuxt 3, headless-CMS", integrations: "amoCRM, Bitrix24, RetailCRM, Яндекс Метрика, VK Реклама", performance: "PageSpeed 90+, WebP/AVIF, Lazy Load" },
  },
  {
    handle: "korporativnyj-sajt",
    title: "Корпоративный сайт (B2B/B2C портал)",
    subtitle: "Многостраничный сайт с CMS, блогом и личным кабинетом",
    description: "Разработка корпоративного сайта с продуманной информационной архитектурой. CMS с визуальным конструктором страниц, каталог услуг, блог, портфолио, личный кабинет. SEO-база из коробки: XML-карты, микроразметка Schema.org, шаблоны мета-тегов. Ролевая модель администрирования, аудит-журнал правок. Безопасность: SSL, защита от брутфорса, строгая CSP.",
    collection_handle: "web-development",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Масштаб", values: ["До 30 страниц", "До 100 страниц", "Безлимит"] }],
    variants: [
      { title: "До 30 страниц", prices: [{ amount: 35_000_00, currency_code: RUB }], options: { "Масштаб": "До 30 страниц" }, manage_inventory: false },
      { title: "До 100 страниц", prices: [{ amount: 60_000_00, currency_code: RUB }], options: { "Масштаб": "До 100 страниц" }, manage_inventory: false },
      { title: "Безлимит", prices: [{ amount: 100_000_00, currency_code: RUB }], options: { "Масштаб": "Безлимит" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Компании, формирующие репутацию и органический трафик", tech_stack: "1С-Битрикс, WordPress, Payload, Strapi, Directus, Next.js, Nuxt", seo: "XML-карты, Schema.org JSON-LD, ЧПУ, hreflang, canonical", security: "SSL, fail2ban, rate limiting, CSP" },
  },
  {
    handle: "internet-magazin-basic",
    title: "Интернет-магазин (E-commerce Basic)",
    subtitle: "Готовый магазин с каталогом, корзиной и онлайн-оплатой",
    description: "Запуск интернет-магазина с полным циклом продаж: иерархический каталог с фильтрами, одностраничный чекаут, подключение ЮKassa, Т-Касса, СБП. Интеграция с СДЭК, Почтой России, Boxberry для автоматического расчёта доставки. Онлайн-касса по 54-ФЗ. Поиск с учётом морфологии русского языка. Email и SMS-уведомления клиентам и менеджерам.",
    collection_handle: "web-development",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Платформа", values: ["Medusa.js", "1С-Битрикс", "WooCommerce"] }],
    variants: [
      { title: "Medusa.js", prices: [{ amount: 40_000_00, currency_code: RUB }], options: { "Платформа": "Medusa.js" }, manage_inventory: false },
      { title: "1С-Битрикс", prices: [{ amount: 35_000_00, currency_code: RUB }], options: { "Платформа": "1С-Битрикс" }, manage_inventory: false },
      { title: "WooCommerce", prices: [{ amount: 25_000_00, currency_code: RUB }], options: { "Платформа": "WooCommerce" }, manage_inventory: false },
    ],
    metadata: { target_audience: "SMB с ассортиментом до 10 000 позиций", tech_stack: "Medusa.js, 1С-Битрикс, WooCommerce, InSales", payments: "ЮKassa, Т-Касса, CloudPayments, Robokassa, СБП", logistics: "СДЭК, Почта России, Boxberry, Яндекс Доставка, DPD" },
  },
  {
    handle: "ecommerce-enterprise",
    title: "E-commerce платформа Enterprise",
    subtitle: "Масштабируемый магазин для маркетплейсов и крупного ритейла",
    description: "Enterprise-платформа электронной коммерции для высоконагруженных проектов. Микросервисная архитектура, кэширование Redis, полнотекстовый поиск Elasticsearch с учётом опечаток. Двусторонний обмен с 1С:ERP и SAP в реальном времени. Docker + Kubernetes с автомасштабированием. Промо-движок: программы лояльности, динамические промокоды, мультипрайсы.",
    collection_handle: "web-development",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Конфигурация", values: ["Стандарт", "Highload", "Маркетплейс"] }],
    variants: [
      { title: "Стандарт", prices: [{ amount: 200_000_00, currency_code: RUB }], options: { "Конфигурация": "Стандарт" }, manage_inventory: false },
      { title: "Highload", prices: [{ amount: 400_000_00, currency_code: RUB }], options: { "Конфигурация": "Highload" }, manage_inventory: false },
      { title: "Маркетплейс", prices: [{ amount: 600_000_00, currency_code: RUB }], options: { "Конфигурация": "Маркетплейс" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Маркетплейсы, крупные ритейлеры, B2B-платформы", tech_stack: "Node.js, Go, Java, Python, Next.js, Nuxt, Remix", infrastructure: "Docker, Kubernetes, Redis, Elasticsearch", integrations: "1С:ERP, SAP, Microsoft Dynamics" },
  },
  {
    handle: "veb-prilozhenie-spa-saas",
    title: "Веб-приложение (SPA / SaaS)",
    subtitle: "Интерактивный сервис уровня нативного приложения",
    description: "Разработка SPA и SaaS-приложений с логикой уровня нативного софта. React/Vue/Svelte на фронте, NestJS/FastAPI/Go на бэкенде. Аутентификация через Яндекс ID, VK ID, T-ID с двухфакторной защитой. Real-time обновления через WebSockets. Полное покрытие тестами: Unit, Integration, E2E. CI/CD-пайплайны для автоматического деплоя.",
    collection_handle: "web-development",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Сложность", values: ["MVP", "Продукт", "Enterprise"] }],
    variants: [
      { title: "MVP", prices: [{ amount: 80_000_00, currency_code: RUB }], options: { "Сложность": "MVP" }, manage_inventory: false },
      { title: "Продукт", prices: [{ amount: 250_000_00, currency_code: RUB }], options: { "Сложность": "Продукт" }, manage_inventory: false },
      { title: "Enterprise", prices: [{ amount: 500_000_00, currency_code: RUB }], options: { "Сложность": "Enterprise" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Продуктовые команды, SaaS-сервисы, кастомные CRM", tech_stack: "React, Vue, Svelte, NestJS, Fastify, Go, FastAPI, Django", auth: "JWT, OAuth 2.0, Яндекс ID, VK ID, T-ID, 2FA", realtime: "WebSockets, Server-Sent Events" },
  },
];

const mobileDevelopment: ProductDefinition[] = [
  {
    handle: "nativnye-ios-android",
    title: "Нативные iOS и Android приложения",
    subtitle: "Премиальный UX с максимальной производительностью",
    description: "Нативная разработка мобильных приложений на Swift/SwiftUI для iOS и Kotlin/Jetpack Compose для Android. Архитектура MVVM/TCA, шифрование данных через Keychain/Keystore. Публикация в App Store, Google Play, RuStore и AppGallery с прохождением модерации. Push-уведомления, ASO-оптимизация страниц в сторах.",
    collection_handle: "mobile-development",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Платформа", values: ["iOS", "Android", "iOS + Android"] }],
    variants: [
      { title: "iOS", prices: [{ amount: 150_000_00, currency_code: RUB }], options: { "Платформа": "iOS" }, manage_inventory: false },
      { title: "Android", prices: [{ amount: 120_000_00, currency_code: RUB }], options: { "Платформа": "Android" }, manage_inventory: false },
      { title: "iOS + Android", prices: [{ amount: 240_000_00, currency_code: RUB }], options: { "Платформа": "iOS + Android" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Продукты с требованиями к производительности и аппаратным возможностям", tech_stack: "Swift 5+, SwiftUI, Kotlin, Jetpack Compose, MVVM, TCA", stores: "App Store, Google Play, RuStore, AppGallery", push: "APNs, FCM, RuStore SDK, HMS Push" },
  },
  {
    handle: "kross-platformennoe-prilozhenie",
    title: "Кросс-платформенное приложение (React Native / Flutter)",
    subtitle: "Одно приложение для двух платформ с экономией 30-50%",
    description: "Кросс-платформенная разработка на React Native или Flutter — одна кодовая база для iOS и Android. Экономия 30-50% бюджета при UX, близком к нативному. Нативные bridge-модули для сканеров, BLE, биометрии. CI/CD через Fastlane и EAS Build. Мониторинг через Sentry и AppMetrica.",
    collection_handle: "mobile-development",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Стек", values: ["React Native", "Flutter"] }],
    variants: [
      { title: "React Native", prices: [{ amount: 100_000_00, currency_code: RUB }], options: { "Стек": "React Native" }, manage_inventory: false },
      { title: "Flutter", prices: [{ amount: 110_000_00, currency_code: RUB }], options: { "Стек": "Flutter" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Стартапы и SMB для быстрого выхода на iOS и Android", tech_stack: "React Native, Expo, Flutter 3+, Redux, Zustand, Riverpod, Bloc", ci_cd: "Fastlane, EAS Build, Codemagic", monitoring: "Sentry, AppMetrica, Firebase Crashlytics" },
  },
  {
    handle: "publikaciya-aso",
    title: "Публикация, обновление и ASO-оптимизация",
    subtitle: "Сопровождение приложений в магазинах без привязки к разработке",
    description: "Профессиональная публикация и ASO-оптимизация мобильных приложений. Прохождение модерации App Store, Google Play, RuStore. Анализ ключевых запросов, A/B-тестирование иконок и скриншотов. Фазированная раскатка обновлений, атрибуция установок через AppsFlyer и AppMetrica.",
    collection_handle: "mobile-development",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Пакет", values: ["Разовая публикация", "Ежемесячное сопровождение"] }],
    variants: [
      { title: "Разовая публикация", prices: [{ amount: 5_000_00, currency_code: RUB }], options: { "Пакет": "Разовая публикация" }, manage_inventory: false },
      { title: "Ежемесячное сопровождение", prices: [{ amount: 8_000_00, currency_code: RUB }], options: { "Пакет": "Ежемесячное сопровождение" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Владельцы существующих приложений", tools: "ASOdesk, AppFollow, AppTweak, AppMetrica, Firebase, AppsFlyer", stores: "App Store, Google Play, RuStore, AppGallery" },
  },
];

const chatbotsAi: ProductDefinition[] = [
  {
    handle: "chat-bot-lidogenerator",
    title: "Чат-бот-лидогенератор",
    subtitle: "Бот для квалификации лидов и передачи в CRM",
    description: "Разработка чат-бота для лидогенерации в Telegram, VK, WhatsApp и Avito. Квиз-воронки с ветвлением, сбор контактов, мгновенная передача лидов в amoCRM или Bitrix24. Webhook-архитектура на VPS или облачных функциях Yandex Cloud.",
    collection_handle: "chatbots-ai",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Платформа", values: ["Telegram", "Мультиканальный"] }],
    variants: [
      { title: "Telegram", prices: [{ amount: 12_000_00, currency_code: RUB }], options: { "Платформа": "Telegram" }, manage_inventory: false },
      { title: "Мультиканальный", prices: [{ amount: 25_000_00, currency_code: RUB }], options: { "Платформа": "Мультиканальный" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Компании, собирающие заявки в мессенджерах", platforms: "Telegram, VK, WhatsApp, Max, Avito", integrations: "amoCRM, Bitrix24, RetailCRM" },
  },
  {
    handle: "telegram-mini-app",
    title: "Telegram Mini App (магазин внутри мессенджера)",
    subtitle: "Каталог, корзина и платежи без выхода из Telegram",
    description: "Telegram Mini App — полноценный магазин внутри мессенджера. Каталог товаров, корзина, оплата через ЮKassa и Т-Касса без перехода в браузер. Криптографическая валидация initData, админ-панель для управления заказами. Адаптация под нативную тему Telegram.",
    collection_handle: "chatbots-ai",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Тип", values: ["Магазин", "Сервис бронирования"] }],
    variants: [
      { title: "Магазин", prices: [{ amount: 30_000_00, currency_code: RUB }], options: { "Тип": "Магазин" }, manage_inventory: false },
      { title: "Сервис бронирования", prices: [{ amount: 35_000_00, currency_code: RUB }], options: { "Тип": "Сервис бронирования" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Бренды, продающие через Telegram", tech_stack: "Telegram Web Apps SDK, Telegram.WebApp API", payments: "Telegram Payments, ЮKassa, Т-Касса, CloudPayments" },
  },
  {
    handle: "bot-helpdesk",
    title: "Бот-автоматизатор техподдержки (HelpDesk)",
    subtitle: "Первая линия поддержки с маршрутизацией тикетов",
    description: "Бот первой линии техподдержки: нечёткий и семантический поиск по базе знаний, автоматическая генерация тикетов с SLA-таймерами. Интеграция с Usedesk, Jira Service Management. Эскалация по SLA, аналитика CSAT и FRT. Снижение нагрузки на операторов до 60%.",
    collection_handle: "chatbots-ai",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Масштаб", values: ["До 1000 обращений/мес", "Безлимит"] }],
    variants: [
      { title: "До 1000 обращений/мес", prices: [{ amount: 20_000_00, currency_code: RUB }], options: { "Масштаб": "До 1000 обращений/мес" }, manage_inventory: false },
      { title: "Безлимит", prices: [{ amount: 45_000_00, currency_code: RUB }], options: { "Масштаб": "Безлимит" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Компании с высоким потоком типовых обращений", integrations: "Usedesk, Omnidesk, HappyFox, Jira Service Management", analytics: "CSAT, FRT, среднее время решения" },
  },
  {
    handle: "ii-assistent-llm-rag",
    title: "ИИ-ассистент для бизнеса (LLM + RAG)",
    subtitle: "LLM-ассистент на корпоративных данных",
    description: "ИИ-ассистент на базе LLM с RAG-архитектурой: парсинг корпоративной базы знаний, генерация эмбеддингов, семантический поиск через Qdrant. Модели Claude, GPT-4o, YandexGPT или локальные open-source. Мультиканальность: сайт, Telegram, WhatsApp. Guardrails от prompt injection и галлюцинаций.",
    collection_handle: "chatbots-ai",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Модель", values: ["Облачная LLM", "Локальная модель"] }],
    variants: [
      { title: "Облачная LLM", prices: [{ amount: 50_000_00, currency_code: RUB }], options: { "Модель": "Облачная LLM" }, manage_inventory: false },
      { title: "Локальная модель", prices: [{ amount: 80_000_00, currency_code: RUB }], options: { "Модель": "Локальная модель" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Компании с большой базой знаний", models: "Claude Opus 4, GPT-4o, YandexGPT, GigaChat, Llama, Qwen, DeepSeek", rag: "Qdrant, pgvector, Weaviate", channels: "Виджет на сайте, Telegram, WhatsApp, VK" },
  },
  {
    handle: "bot-buking",
    title: "Бот-букинг (запись на услуги)",
    subtitle: "Автоматическая запись клиентов с синхронизацией расписания",
    description: "Бот для автоматической записи клиентов на услуги. Синхронизация с YClients, Altegio, Google Calendar. Предотвращение overbooking, каскадные напоминания о визите, предоплата через СБП для снижения no-show. Сбор отзывов после визита.",
    collection_handle: "chatbots-ai",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Интеграция", values: ["YClients", "Собственная логика"] }],
    variants: [
      { title: "YClients", prices: [{ amount: 15_000_00, currency_code: RUB }], options: { "Интеграция": "YClients" }, manage_inventory: false },
      { title: "Собственная логика", prices: [{ amount: 28_000_00, currency_code: RUB }], options: { "Интеграция": "Собственная логика" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Салоны красоты, клиники, автосервисы, коворкинги", integrations: "YClients, Altegio, Dikidi, Google Calendar, Яндекс Календарь", payments: "СБП, ЮKassa, Т-Касса" },
  },
];

// Продолжение в этом же файле — Collections 4-9
// (добавляется через edit_file)

const integrations: ProductDefinition[] = [
  {
    handle: "vnedrenie-crm",
    title: "Внедрение CRM (amoCRM, Bitrix24, RetailCRM)",
    subtitle: "Настройка CRM «в одно окно» с автоматизацией рутины",
    description: "Внедрение CRM-системы с нуля: проектирование воронок продаж, подключение всех каналов коммуникации в единый inbox. Интеграция телефонии Mango Office, UIS, Телфин. Digital-воронка с триггерами автосообщений. Ролевая модель доступа и аудит действий менеджеров.",
    collection_handle: "integrations",
    status: "published",
    is_giftcard: false,
    options: [{ title: "CRM", values: ["amoCRM", "Bitrix24", "RetailCRM"] }],
    variants: [
      { title: "amoCRM", prices: [{ amount: 18_000_00, currency_code: RUB }], options: { "CRM": "amoCRM" }, manage_inventory: false },
      { title: "Bitrix24", prices: [{ amount: 25_000_00, currency_code: RUB }], options: { "CRM": "Bitrix24" }, manage_inventory: false },
      { title: "RetailCRM", prices: [{ amount: 20_000_00, currency_code: RUB }], options: { "CRM": "RetailCRM" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Отделы продаж, теряющие лиды", channels: "Email, Telegram, WhatsApp, VK, Авито", telephony: "Mango Office, UIS, Телфин, Sipuni" },
  },
  {
    handle: "korporativnyj-portal",
    title: "Корпоративный портал (Bitrix24, ELMA365, SimpleOne)",
    subtitle: "Единая платформа для проектов, задач и согласований",
    description: "Развёртывание корпоративного портала: визуальные маршруты согласования, экстранет для подрядчиков, интеграция с 1С:ЗУП и системами ЭДО. Автоматизация учёта активов, генерация договоров по шаблонам. Единая точка для коммуникации, задач и документов.",
    collection_handle: "integrations",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Платформа", values: ["Bitrix24", "ELMA365"] }],
    variants: [
      { title: "Bitrix24", prices: [{ amount: 40_000_00, currency_code: RUB }], options: { "Платформа": "Bitrix24" }, manage_inventory: false },
      { title: "ELMA365", prices: [{ amount: 60_000_00, currency_code: RUB }], options: { "Платформа": "ELMA365" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Компании от 50 сотрудников", integrations: "1С:ЗУП, 1С:Бухгалтерия, SAP, Диадок, СБИС" },
  },
  {
    handle: "integracija-1c-erp",
    title: "Интеграция с 1С и ERP",
    subtitle: "Двусторонняя синхронизация 1С с сайтом и CRM",
    description: "Интеграция 1С с сайтом, CRM и маркетплейсами: двусторонний обмен каталогом, заказами, остатками и контрагентами. Поддержка CommerceML, REST API, OData. Дельта-обмен через RabbitMQ/Kafka для снижения нагрузки. Мониторинг расхождений и алерты.",
    collection_handle: "integrations",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Сложность", values: ["Базовая", "Расширенная"] }],
    variants: [
      { title: "Базовая", prices: [{ amount: 20_000_00, currency_code: RUB }], options: { "Сложность": "Базовая" }, manage_inventory: false },
      { title: "Расширенная", prices: [{ amount: 50_000_00, currency_code: RUB }], options: { "Сложность": "Расширенная" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Ритейл, оптовая торговля, производство", protocols: "CommerceML, REST API, OData, SOAP", optimization: "Дельта-обмен, очереди RabbitMQ/Kafka" },
  },
  {
    handle: "integracija-marketplejsy",
    title: "Интеграция с маркетплейсами (WB, Ozon, Яндекс Маркет)",
    subtitle: "Централизованное управление товарами на всех площадках",
    description: "Интеграция с маркетплейсами Wildberries, Ozon, Яндекс Маркет и Мегамаркет через API. Массовая выгрузка карточек, синхронизация остатков и цен с 1С в реальном времени. Единый инбокс заказов, маршрутизация FBS/FBO, аналитика по площадкам.",
    collection_handle: "integrations",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Количество площадок", values: ["1-2", "3-5"] }],
    variants: [
      { title: "1-2 площадки", prices: [{ amount: 18_000_00, currency_code: RUB }], options: { "Количество площадок": "1-2" }, manage_inventory: false },
      { title: "3-5 площадок", prices: [{ amount: 40_000_00, currency_code: RUB }], options: { "Количество площадок": "3-5" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Продавцы на нескольких площадках", marketplaces: "Wildberries, Ozon, Яндекс Маркет, Мегамаркет, Lamoda" },
  },
  {
    handle: "api-shlyuzy-middleware",
    title: "API-шлюзы и middleware",
    subtitle: "Промежуточный слой для связи несовместимых систем",
    description: "Разработка API-шлюзов и middleware для связи несовместимых систем. Трансформация XML/JSON/CSV на лету, асинхронная обработка через RabbitMQ и Kafka. Rate Limiting, валидация схем, OAuth 2.0 и mTLS для безопасности внутренних интеграций.",
    collection_handle: "integrations",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Масштаб", values: ["До 5 интеграций", "Корпоративный"] }],
    variants: [
      { title: "До 5 интеграций", prices: [{ amount: 30_000_00, currency_code: RUB }], options: { "Масштаб": "До 5 интеграций" }, manage_inventory: false },
      { title: "Корпоративный", prices: [{ amount: 70_000_00, currency_code: RUB }], options: { "Масштаб": "Корпоративный" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Компании с разрозненным IT-ландшафтом", tech_stack: "Node.js, NestJS, Fastify, Go, Python FastAPI", security: "Rate Limiting, JSON Schema, OAuth 2.0, mTLS" },
  },
  {
    handle: "platezhnye-integracii",
    title: "Платёжные интеграции и фискализация",
    subtitle: "Подключение платёжных систем и онлайн-касс по 54-ФЗ",
    description: "Подключение российских платёжных систем: ЮKassa, Т-Касса, CloudPayments, СБП. Рекуррентные платежи с токенизацией по PCI DSS. Фискализация через АТОЛ Онлайн и Orange Data по 54-ФЗ. Безопасная обработка webhook-коллбеков с проверкой подписи.",
    collection_handle: "integrations",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Тип", values: ["Разовые платежи", "Подписки + рекуррент"] }],
    variants: [
      { title: "Разовые платежи", prices: [{ amount: 10_000_00, currency_code: RUB }], options: { "Тип": "Разовые платежи" }, manage_inventory: false },
      { title: "Подписки + рекуррент", prices: [{ amount: 25_000_00, currency_code: RUB }], options: { "Тип": "Подписки + рекуррент" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Интернет-магазины, подписочные сервисы", processors: "ЮKassa, Т-Касса, CloudPayments, Robokassa, Stripe", fiscalization: "АТОЛ Онлайн, Orange Data, Ferma" },
  },
];
const devopsInfrastructure: ProductDefinition[] = [
  {
    handle: "razvertyvanie-serverov",
    title: "Развёртывание и тюнинг выделенных серверов",
    subtitle: "Подготовка VPS/Dedicated под production",
    description: "Развёртывание и тюнинг серверов на Selectel, Yandex Cloud, VK Cloud или Hetzner. Настройка Nginx, PostgreSQL, Docker. Сетевая безопасность: iptables, fail2ban, SSH по ключам. Let's Encrypt SSL, HSTS. Автоматические бэкапы в S3 через restic/borg.",
    collection_handle: "devops-infrastructure",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Тип", values: ["VPS", "Dedicated", "Kubernetes"] }],
    variants: [
      { title: "VPS", prices: [{ amount: 5_000_00, currency_code: RUB }], options: { "Тип": "VPS" }, manage_inventory: false },
      { title: "Dedicated", prices: [{ amount: 10_000_00, currency_code: RUB }], options: { "Тип": "Dedicated" }, manage_inventory: false },
      { title: "Kubernetes", prices: [{ amount: 25_000_00, currency_code: RUB }], options: { "Тип": "Kubernetes" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Проекты, выходящие с shared-хостинга", providers: "Selectel, Yandex Cloud, VK Cloud, Hetzner", security: "iptables, fail2ban, CrowdSec, SSH по ключам" },
  },
  {
    handle: "ci-cd-konvejer",
    title: "CI/CD-конвейер",
    subtitle: "Автоматизация сборки, тестирования и деплоя",
    description: "Настройка CI/CD-конвейера: автоматическая сборка Docker-образов, статический анализ, unit/E2E тесты, Zero-Downtime деплой. GitHub Actions, GitLab CI или Jenkins. Стратегии Blue-Green и Canary. Уведомления о статусах в Telegram.",
    collection_handle: "devops-infrastructure",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Платформа", values: ["GitHub Actions", "GitLab CI", "Jenkins"] }],
    variants: [
      { title: "GitHub Actions", prices: [{ amount: 8_000_00, currency_code: RUB }], options: { "Платформа": "GitHub Actions" }, manage_inventory: false },
      { title: "GitLab CI", prices: [{ amount: 10_000_00, currency_code: RUB }], options: { "Платформа": "GitLab CI" }, manage_inventory: false },
      { title: "Jenkins", prices: [{ amount: 12_000_00, currency_code: RUB }], options: { "Платформа": "Jenkins" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Команды, деплоящие вручную", tools: "GitLab CI, GitHub Actions, Jenkins, TeamCity", strategies: "Blue-Green, Canary, Rolling, GitOps" },
  },
  {
    handle: "masshtabirovanie-highload",
    title: "Масштабирование Highload-систем",
    subtitle: "Подготовка архитектуры к тысячам RPS",
    description: "Масштабирование highload-систем: балансировка через Nginx/HAProxy, кэширование Redis и Varnish, CDN для статики. Primary-Replica репликация PostgreSQL, шардирование через Citus. Подготовка к пиковым нагрузкам без деградации.",
    collection_handle: "devops-infrastructure",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Масштаб", values: ["До 1000 RPS", "1000-10000 RPS", "10000+ RPS"] }],
    variants: [
      { title: "До 1000 RPS", prices: [{ amount: 20_000_00, currency_code: RUB }], options: { "Масштаб": "До 1000 RPS" }, manage_inventory: false },
      { title: "1000-10000 RPS", prices: [{ amount: 50_000_00, currency_code: RUB }], options: { "Масштаб": "1000-10000 RPS" }, manage_inventory: false },
      { title: "10000+ RPS", prices: [{ amount: 120_000_00, currency_code: RUB }], options: { "Масштаб": "10000+ RPS" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Проекты с пиковыми нагрузками", tech: "Nginx, HAProxy, Redis, Varnish, CDN, Citus, Vitess" },
  },
  {
    handle: "monitoring-alerting",
    title: "Мониторинг и алертинг (Observability)",
    subtitle: "Метрики, логи, трейсы и система алертов",
    description: "Внедрение полного стека observability: Prometheus + Grafana для метрик, Loki для логов, Sentry + OpenTelemetry для трейсинга. Каскадные алерты в Telegram и SMS по степени критичности. Дашборды бизнес-метрик и SLA.",
    collection_handle: "devops-infrastructure",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Стек", values: ["Базовый", "Полный observability"] }],
    variants: [
      { title: "Базовый", prices: [{ amount: 10_000_00, currency_code: RUB }], options: { "Стек": "Базовый" }, manage_inventory: false },
      { title: "Полный observability", prices: [{ amount: 30_000_00, currency_code: RUB }], options: { "Стек": "Полный observability" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Команды без системы мониторинга", stack: "Prometheus, Grafana, VictoriaMetrics, Loki, Sentry, OpenTelemetry" },
  },
];
const securityQa: ProductDefinition[] = [
  {
    handle: "informacionnaya-bezopasnost",
    title: "Информационная безопасность (DevSecOps и WAF)",
    subtitle: "Защита от взломов, DDoS и утечек ПДн",
    description: "Комплексная информационная безопасность: аудит OWASP Top 10, SAST/DAST сканирование, WAF от Qrator и DDoS-Guard. Anti-DDoS L3/L4/L7, управление секретами через HashiCorp Vault. Соответствие 152-ФЗ, подготовка к проверкам Роскомнадзора.",
    collection_handle: "security-qa",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Пакет", values: ["Аудит", "Аудит + внедрение защиты"] }],
    variants: [
      { title: "Аудит", prices: [{ amount: 15_000_00, currency_code: RUB }], options: { "Пакет": "Аудит" }, manage_inventory: false },
      { title: "Аудит + внедрение защиты", prices: [{ amount: 40_000_00, currency_code: RUB }], options: { "Пакет": "Аудит + внедрение защиты" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Проекты с ПДн и платежами", tools: "Semgrep, SonarQube, OWASP ZAP, Trivy, Snyk", waf: "Qrator, DDoS-Guard, StormWall, Nemesida WAF", compliance: "152-ФЗ, Роскомнадзор" },
  },
  {
    handle: "qa-ruchnoe-testirovanie",
    title: "QA — ручное тестирование и тест-менеджмент",
    subtitle: "Полный цикл ручного тестирования и приёмки релизов",
    description: "Ручное тестирование полного цикла: тест-планы в TestRail/Qase, функциональное и регрессионное тестирование, smoke и usability. Баг-репорты в Jira с приоритизацией. UAT-сценарии и приёмка релизов со стейкхолдерами.",
    collection_handle: "security-qa",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Формат", values: ["Разовый прогон", "Ежемесячная поддержка"] }],
    variants: [
      { title: "Разовый прогон", prices: [{ amount: 8_000_00, currency_code: RUB }], options: { "Формат": "Разовый прогон" }, manage_inventory: false },
      { title: "Ежемесячная поддержка", prices: [{ amount: 15_000_00, currency_code: RUB }], options: { "Формат": "Ежемесячная поддержка" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Команды без выделенного QA", tools: "TestRail, Qase, Allure TestOps, Jira, YouTrack, Kaiten" },
  },
  {
    handle: "avtotestirovanie",
    title: "Автотестирование (E2E, API, Mobile)",
    subtitle: "Автотесты в CI/CD для сокращения регрессии",
    description: "Написание автотестов и интеграция в CI/CD: Playwright и Cypress для E2E, Postman/Newman для API, Appium для мобильных. Визуальная регрессия через Percy. Allure Report с историей запусков. Параллелизация и работа с flaky-тестами.",
    collection_handle: "security-qa",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Тип", values: ["E2E Web", "API", "Mobile", "Комплекс"] }],
    variants: [
      { title: "E2E Web", prices: [{ amount: 15_000_00, currency_code: RUB }], options: { "Тип": "E2E Web" }, manage_inventory: false },
      { title: "API", prices: [{ amount: 10_000_00, currency_code: RUB }], options: { "Тип": "API" }, manage_inventory: false },
      { title: "Mobile", prices: [{ amount: 20_000_00, currency_code: RUB }], options: { "Тип": "Mobile" }, manage_inventory: false },
      { title: "Комплекс", prices: [{ amount: 40_000_00, currency_code: RUB }], options: { "Тип": "Комплекс" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Зрелые команды с длинной регрессией", tools: "Playwright, Cypress, Selenium, Appium, Postman, Allure" },
  },
  {
    handle: "nagruzochnoe-testirovanie",
    title: "Нагрузочное и стресс-тестирование",
    subtitle: "Симуляция трафика для выявления узких мест",
    description: "Нагрузочное тестирование через k6, JMeter или Яндекс.Танк: профили стабильной нагрузки, ramp-up, spike и soak. Метрики RPS, p95/p99 latency, error rate. Отчёт с выявлением узких мест и рекомендациями по тюнингу.",
    collection_handle: "security-qa",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Сценарий", values: ["Базовый", "Комплексный с рекомендациями"] }],
    variants: [
      { title: "Базовый", prices: [{ amount: 10_000_00, currency_code: RUB }], options: { "Сценарий": "Базовый" }, manage_inventory: false },
      { title: "Комплексный с рекомендациями", prices: [{ amount: 25_000_00, currency_code: RUB }], options: { "Сценарий": "Комплексный с рекомендациями" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Сервисы перед пиковыми событиями", tools: "k6, JMeter, Gatling, Locust, Яндекс.Танк", metrics: "RPS, p95/p99 latency, error rate" },
  },
];
const analyticsSeoMartech: ProductDefinition[] = [
  {
    handle: "tekhnicheskoe-seo",
    title: "Техническое SEO",
    subtitle: "Настройка технической базы под Яндекс и Google",
    description: "Техническое SEO для Яндекса и Google: настройка robots.txt, генерация XML-sitemap, микроразметка Schema.org JSON-LD. Шаблоны мета-тегов, canonical, hreflang. Устранение битых ссылок, корректные редиректы, работа с дублями.",
    collection_handle: "analytics-seo-martech",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Объём", values: ["До 500 страниц", "500+ страниц"] }],
    variants: [
      { title: "До 500 страниц", prices: [{ amount: 8_000_00, currency_code: RUB }], options: { "Объём": "До 500 страниц" }, manage_inventory: false },
      { title: "500+ страниц", prices: [{ amount: 20_000_00, currency_code: RUB }], options: { "Объём": "500+ страниц" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Сайты с амбициями на органический трафик", tools: "Яндекс.Вебмастер, Google Search Console, Schema.org JSON-LD" },
  },
  {
    handle: "skvoznaya-biznes-analitika",
    title: "Сквозная бизнес-аналитика",
    subtitle: "Связь рекламных расходов с выручкой в CRM",
    description: "Сквозная аналитика: агрегация данных из Яндекс Директ, VK Реклама, CRM в единый DWH на ClickHouse. Коллтрекинг с динамической подменой номеров. Дашборды в Yandex DataLens или Power BI с расчётом реального ROMI.",
    collection_handle: "analytics-seo-martech",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Масштаб", values: ["Базовая", "С коллтрекингом и DWH"] }],
    variants: [
      { title: "Базовая", prices: [{ amount: 15_000_00, currency_code: RUB }], options: { "Масштаб": "Базовая" }, manage_inventory: false },
      { title: "С коллтрекингом и DWH", prices: [{ amount: 40_000_00, currency_code: RUB }], options: { "Масштаб": "С коллтрекингом и DWH" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Компании с несколькими рекламными каналами", tools: "Roistat, Calltouch, CoMagic, ClickHouse, DataLens, Superset" },
  },
  {
    handle: "server-side-tracking",
    title: "Server-Side Tracking",
    subtitle: "Серверный сбор аналитики без потерь от блокировщиков",
    description: "Server-Side Tracking: перенос сбора событий на сервер. Server-side GTM на собственном поддомене, обход ITP/ETP. Обогащение данных бизнес-метриками. API-интеграции с Яндекс Метрикой и GA4 Measurement Protocol.",
    collection_handle: "analytics-seo-martech",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Тип", values: ["Базовый SST", "SST + обогащение данных"] }],
    variants: [
      { title: "Базовый SST", prices: [{ amount: 12_000_00, currency_code: RUB }], options: { "Тип": "Базовый SST" }, manage_inventory: false },
      { title: "SST + обогащение данных", prices: [{ amount: 28_000_00, currency_code: RUB }], options: { "Тип": "SST + обогащение данных" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Проекты, теряющие до 30% данных из-за блокировщиков" },
  },
  {
    handle: "web-performance-optimization",
    title: "Web Performance Optimization (Core Web Vitals)",
    subtitle: "Ускорение до топ-показателей Core Web Vitals",
    description: "Оптимизация Core Web Vitals: LCP, INP, CLS. Конвертация медиа в WebP/AVIF, responsive images, инлайнинг critical CSS. Code splitting через Vite/Turbopack, preload ключевых ресурсов. Локальный хостинг шрифтов.",
    collection_handle: "analytics-seo-martech",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Глубина", values: ["Аудит + quick wins", "Полная оптимизация"] }],
    variants: [
      { title: "Аудит + quick wins", prices: [{ amount: 6_000_00, currency_code: RUB }], options: { "Глубина": "Аудит + quick wins" }, manage_inventory: false },
      { title: "Полная оптимизация", prices: [{ amount: 18_000_00, currency_code: RUB }], options: { "Глубина": "Полная оптимизация" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Сайты с проблемами скорости", metrics: "LCP, INP, CLS" },
  },
];
const supportRefactoringUx: ProductDefinition[] = [
  {
    handle: "code-review-refaktoring",
    title: "Code Review и рефакторинг",
    subtitle: "Аудит кода и модернизация для ускорения разработки",
    description: "Независимый аудит кода: выявление антипаттернов, узких мест, избыточных зависимостей. Внедрение линтеров и строгой типизации. Рефакторинг по DDD, оптимизация запросов к БД. OpenAPI-спецификации и ADR.",
    collection_handle: "support-refactoring-ux",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Формат", values: ["Аудит-отчёт", "Аудит + рефакторинг"] }],
    variants: [
      { title: "Аудит-отчёт", prices: [{ amount: 10_000_00, currency_code: RUB }], options: { "Формат": "Аудит-отчёт" }, manage_inventory: false },
      { title: "Аудит + рефакторинг", prices: [{ amount: 35_000_00, currency_code: RUB }], options: { "Формат": "Аудит + рефакторинг" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Проекты с накопленным техдолгом" },
  },
  {
    handle: "sla-podderzhka",
    title: "SLA-поддержка IT-инфраструктуры",
    subtitle: "Аутсорс поддержки с гарантированным Uptime",
    description: "SLA-поддержка с гарантированным Uptime 99.9-99.99%. Фиксированные сроки реакции P1-P4, Patch Management с тестированием на staging. Инцидент-менеджмент с Root Cause Analysis. Disaster Recovery учения.",
    collection_handle: "support-refactoring-ux",
    status: "published",
    is_giftcard: false,
    options: [{ title: "SLA", values: ["99.9%", "99.95%", "99.99%"] }],
    variants: [
      { title: "99.9%", prices: [{ amount: 8_000_00, currency_code: RUB }], options: { "SLA": "99.9%" }, manage_inventory: false },
      { title: "99.95%", prices: [{ amount: 15_000_00, currency_code: RUB }], options: { "SLA": "99.95%" }, manage_inventory: false },
      { title: "99.99%", prices: [{ amount: 30_000_00, currency_code: RUB }], options: { "SLA": "99.99%" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Бизнесы, для которых простой критичен", sla: "99.9% / 99.95% / 99.99% Uptime" },
  },
  {
    handle: "ux-ui-audit-redizajn",
    title: "UX/UI аудит и редизайн",
    subtitle: "Исследование UX на данных и проектирование нового интерфейса",
    description: "UX/UI аудит на данных: записи сессий Webvisor, тепловые карты, CJM. A/B-тесты через VWO и GrowthBook. Дизайн-система в Figma. Проверка доступности по WCAG 2.2 AA. Измеримый рост конверсии.",
    collection_handle: "support-refactoring-ux",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Глубина", values: ["Аудит", "Аудит + редизайн"] }],
    variants: [
      { title: "Аудит", prices: [{ amount: 12_000_00, currency_code: RUB }], options: { "Глубина": "Аудит" }, manage_inventory: false },
      { title: "Аудит + редизайн", prices: [{ amount: 40_000_00, currency_code: RUB }], options: { "Глубина": "Аудит + редизайн" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Продукты с низкой конверсией" },
  },
  {
    handle: "vosstanovlenie-posle-vzloma",
    title: "Восстановление после взлома и очистка сайта",
    subtitle: "Экстренная очистка, устранение уязвимостей, снятие санкций",
    description: "Экстренное восстановление после взлома: изоляция, поиск веб-шеллов и бэкдоров. Анализ access.log для определения вектора атаки. Снятие санкций в Яндекс.Вебмастере и Google Search Console. Усиление защиты.",
    collection_handle: "support-refactoring-ux",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Срочность", values: ["Стандарт 48ч", "Экстренный 4ч"] }],
    variants: [
      { title: "Стандарт 48ч", prices: [{ amount: 8_000_00, currency_code: RUB }], options: { "Срочность": "Стандарт 48ч" }, manage_inventory: false },
      { title: "Экстренный 4ч", prices: [{ amount: 20_000_00, currency_code: RUB }], options: { "Срочность": "Экстренный 4ч" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Экстренные случаи: заражение, санкции поисковиков" },
  },
  {
    handle: "hr-obuchayushchie-boty",
    title: "HR- и обучающие чат-боты",
    subtitle: "Автоматизация онбординга и тестирования знаний",
    description: "HR-бот для автоматизации онбординга: drip-кампании с материалами по должности, интерактивное тестирование с геймификацией. Интеграция с 1С:ЗУП и LDAP. Автоматический отзыв прав при увольнении.",
    collection_handle: "support-refactoring-ux",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Функционал", values: ["Онбординг", "Онбординг + тестирование"] }],
    variants: [
      { title: "Онбординг", prices: [{ amount: 18_000_00, currency_code: RUB }], options: { "Функционал": "Онбординг" }, manage_inventory: false },
      { title: "Онбординг + тестирование", prices: [{ amount: 32_000_00, currency_code: RUB }], options: { "Функционал": "Онбординг + тестирование" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Компании с активным наймом и обучением" },
  },
];
const itConsulting: ProductDefinition[] = [
  {
    handle: "tekhnicheskij-audit",
    title: "Технический аудит перед разработкой",
    subtitle: "Независимая оценка задачи: стек, архитектура, бюджет, риски",
    description: "Технический аудит перед разработкой: перевод бизнес-целей в требования, рекомендации по стеку и архитектуре. Декомпозиция задач, оценка трудозатрат, анализ рисков. ТЗ в формате для тендера с критериями приёмки.",
    collection_handle: "it-consulting",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Глубина", values: ["Экспресс-аудит", "Полный аудит с ТЗ"] }],
    variants: [
      { title: "Экспресс-аудит", prices: [{ amount: 5_000_00, currency_code: RUB }], options: { "Глубина": "Экспресс-аудит" }, manage_inventory: false },
      { title: "Полный аудит с ТЗ", prices: [{ amount: 15_000_00, currency_code: RUB }], options: { "Глубина": "Полный аудит с ТЗ" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Владельцы бизнеса перед выбором подрядчика" },
  },
  {
    handle: "cto-as-a-service",
    title: "CTO as a Service",
    subtitle: "Выделенные часы технического директора в месяц",
    description: "CTO as a Service: технологическая дорожная карта, помощь в найме и техническом интервью, ревью архитектурных решений. Аудит кода подрядчиков, участие в переговорах с инвесторами.",
    collection_handle: "it-consulting",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Пакет часов", values: ["20 ч/мес", "40 ч/мес"] }],
    variants: [
      { title: "20 ч/мес", prices: [{ amount: 20_000_00, currency_code: RUB }], options: { "Пакет часов": "20 ч/мес" }, manage_inventory: false },
      { title: "40 ч/мес", prices: [{ amount: 35_000_00, currency_code: RUB }], options: { "Пакет часов": "40 ч/мес" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Стартапы и SMB без штатного CTO" },
  },
  {
    handle: "importozameshchenie-po",
    title: "Импортозамещение ПО",
    subtitle: "Миграция с западного ПО на отечественные аналоги",
    description: "Импортозамещение ПО: миграция с Windows Server на Astra Linux, с Oracle на PostgreSQL, с SAP на 1С:ERP. Замена Microsoft 365 на МойОфис. Подбор ПО из реестра Минцифры, соответствие 187-ФЗ.",
    collection_handle: "it-consulting",
    status: "published",
    is_giftcard: false,
    options: [{ title: "Масштаб", values: ["Частичное", "Полное"] }],
    variants: [
      { title: "Частичное", prices: [{ amount: 30_000_00, currency_code: RUB }], options: { "Масштаб": "Частичное" }, manage_inventory: false },
      { title: "Полное", prices: [{ amount: 150_000_00, currency_code: RUB }], options: { "Масштаб": "Полное" }, manage_inventory: false },
    ],
    metadata: { target_audience: "Госсектор, КИИ, компании под санкциями", compliance: "Реестр Минцифры, 187-ФЗ, ФСТЭК, ФСБ" },
  },
];

export const PRODUCTS: ProductDefinition[] = [
  ...webDevelopment,
  ...mobileDevelopment,
  ...chatbotsAi,
  ...integrations,
  ...devopsInfrastructure,
  ...securityQa,
  ...analyticsSeoMartech,
  ...supportRefactoringUx,
  ...itConsulting,
];
