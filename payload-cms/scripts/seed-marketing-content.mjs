import { getPayload } from 'payload'
import configPromise from '../src/payload.config.ts'

const richText = (paragraphs) => ({
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: paragraphs.map((text) => ({
      type: 'paragraph',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      textFormat: 0,
      textStyle: '',
      children: [
        {
          type: 'text',
          detail: 0,
          format: 0,
          mode: 'normal',
          style: '',
          text,
          version: 1,
        },
      ],
    })),
  },
})

const pageLink = (label, pageSlug) => ({
  type: 'page',
  label,
  pageSlug,
  newTab: false,
})

const customLink = (label, url, newTab = false) => ({
  type: 'custom',
  label,
  url,
  newTab,
})

const pages = [
  {
    slug: 'about',
    title: 'О нас',
    pageType: 'informational',
    excerpt:
      'Команда, подход и сервисные принципы магазина: честный ассортимент, прозрачная коммуникация и поддержка клиента на каждом этапе.',
    layout: [
      {
        blockType: 'heroBanner',
        eyebrow: 'О компании',
        heading: 'Мы строим удобный магазин для ежедневных покупок',
        body:
          'Помогаем клиентам быстро находить нужные товары, получать понятные условия доставки и поддержку без лишней бюрократии.',
        actions: [{ link: pageLink('Связаться с нами', 'contacts') }],
      },
      {
        blockType: 'richText',
        content: richText([
          'Наша витрина объединяет коммерческий каталог Medusa и контентный слой Payload CMS, чтобы маркетинговые страницы можно было обновлять без релизов storefront.',
          'В работе мы опираемся на понятную структуру каталога, аккуратные описания, своевременное обновление акций и быстрые ответы по заказам.',
        ]),
      },
      {
        blockType: 'ctaSection',
        heading: 'Нужна консультация по ассортименту?',
        body: 'Напишите нам — подскажем по товарам, условиям доставки и текущим предложениям.',
        theme: 'accent',
        actions: [{ link: pageLink('Контакты', 'contacts') }],
      },
    ],
    seo: {
      title: 'О нас — демо-магазин',
      description: 'Информационная страница о компании, подходе к сервису и работе с клиентами.',
    },
  },
  {
    slug: 'promotions',
    title: 'Акции',
    pageType: 'marketing',
    excerpt:
      'Тестовая страница с маркетинговыми предложениями: сезонные скидки, подборки товаров и специальные условия.',
    layout: [
      {
        blockType: 'heroBanner',
        eyebrow: 'Спецпредложения',
        heading: 'Актуальные акции и выгодные подборки',
        body:
          'Используйте эту страницу как посадочную для сезонных кампаний, баннеров и промокодов.',
        actions: [
          { link: customLink('Перейти в каталог', '/store') },
          { link: pageLink('Программа лояльности', 'loyalty') },
        ],
      },
      {
        blockType: 'richText',
        content: richText([
          'Добавьте сюда правила акции, сроки проведения, ограничения и ссылки на релевантные категории товаров.',
          'Контент можно адаптировать под распродажи, подборки новинок, подарочные предложения или кампании к праздникам.',
        ]),
      },
      {
        blockType: 'faq',
        heading: 'Частые вопросы по акциям',
        items: [
          {
            question: 'Можно ли суммировать промокоды?',
            answer: richText(['Если иное не указано в правилах акции, промокоды не суммируются.']),
          },
          {
            question: 'Где увидеть итоговую скидку?',
            answer: richText(['Итоговая скидка отображается в корзине после применения условий акции.']),
          },
        ],
      },
    ],
    seo: {
      title: 'Акции и спецпредложения',
      description: 'Маркетинговая страница для скидок, промокодов и сезонных кампаний.',
    },
  },
  {
    slug: 'delivery-and-payment',
    title: 'Доставка и оплата',
    pageType: 'informational',
    excerpt:
      'Условия доставки, оплаты, обработки заказов и базовые ответы на вопросы покупателей.',
    layout: [
      {
        blockType: 'heroBanner',
        eyebrow: 'Покупателям',
        heading: 'Доставляем заказы удобным способом',
        body:
          'Страница описывает типовые правила доставки и оплаты. Замените текст на реальные условия проекта перед запуском.',
        actions: [{ link: pageLink('Задать вопрос', 'contacts') }],
      },
      {
        blockType: 'richText',
        content: richText([
          'Доступные способы доставки и оплаты зависят от региона, состава заказа и подключённых провайдеров fulfilment.',
          'После оформления заказа клиент получает подтверждение и дальнейшие уведомления по выбранным каналам связи.',
        ]),
      },
      {
        blockType: 'faq',
        heading: 'Вопросы по доставке и оплате',
        items: [
          {
            question: 'Когда заказ передаётся в доставку?',
            answer: richText(['После подтверждения оплаты и проверки наличия товаров на складе.']),
          },
          {
            question: 'Можно ли изменить адрес доставки?',
            answer: richText(['Обратитесь в поддержку как можно раньше — возможность изменения зависит от статуса заказа.']),
          },
        ],
      },
    ],
    seo: {
      title: 'Доставка и оплата',
      description: 'Информация об условиях доставки, оплаты и обработке заказов.',
    },
  },
  {
    slug: 'contacts',
    title: 'Контакты',
    pageType: 'informational',
    excerpt: 'Контактная информация, каналы связи и ориентиры для обращений покупателей.',
    layout: [
      {
        blockType: 'heroBanner',
        eyebrow: 'Связь с нами',
        heading: 'Мы на связи по вопросам заказов и ассортимента',
        body:
          'Укажите реальные контактные данные, график работы поддержки и ссылки на социальные сети.',
        actions: [{ link: customLink('Написать на email', 'mailto:support@example.com') }],
      },
      {
        blockType: 'richText',
        content: richText([
          'Email: support@example.com. Телефон: +7 000 000-00-00. График поддержки: будни с 10:00 до 19:00 по Москве.',
          'Для вопросов по заказу подготовьте номер заказа и контактные данные — так команда быстрее найдёт информацию.',
        ]),
      },
      {
        blockType: 'ctaSection',
        heading: 'Есть вопрос перед покупкой?',
        body: 'Команда поддержки поможет подобрать товар, уточнить наличие и условия получения заказа.',
        theme: 'default',
        actions: [{ link: customLink('Открыть каталог', '/store') }],
      },
    ],
    seo: {
      title: 'Контакты',
      description: 'Контакты поддержки, email, телефон и информация для обращений покупателей.',
    },
  },
  {
    slug: 'loyalty',
    title: 'Программа лояльности',
    pageType: 'marketing',
    excerpt:
      'Демо-страница для описания бонусов, уровней участия и персональных предложений постоянным клиентам.',
    layout: [
      {
        blockType: 'heroBanner',
        eyebrow: 'Для постоянных клиентов',
        heading: 'Бонусы и персональные предложения',
        body:
          'Расскажите о правилах начисления бонусов, уровнях программы и преимуществах регистрации.',
        actions: [
          { link: customLink('Войти в аккаунт', '/account') },
          { link: pageLink('Акции', 'promotions') },
        ],
      },
      {
        blockType: 'richText',
        content: richText([
          'Эта страница подходит для описания будущей программы лояльности: бонусных баллов, закрытых распродаж, подарков и раннего доступа к новинкам.',
          'Перед production-запуском замените демо-текст на юридически точные правила участия и ограничения.',
        ]),
      },
      {
        blockType: 'ctaSection',
        heading: 'Получайте больше от каждой покупки',
        body: 'Зарегистрируйтесь, чтобы видеть историю заказов и персональные предложения.',
        theme: 'accent',
        actions: [{ link: customLink('Личный кабинет', '/account') }],
      },
    ],
    seo: {
      title: 'Программа лояльности',
      description: 'Маркетинговая страница о бонусах и персональных предложениях.',
    },
  },
]

const upsertPage = async (payload, page) => {
  const existing = await payload.find({
    collection: 'pages',
    where: {
      slug: {
        equals: page.slug,
      },
    },
    limit: 1,
    depth: 0,
  })

  const data = {
    ...page,
    _status: 'published',
  }

  if (existing.docs[0]) {
    const updated = await payload.update({
      collection: 'pages',
      id: existing.docs[0].id,
      data,
      depth: 0,
    })
    console.log(`Updated page: ${updated.slug}`)
    return updated
  }

  const created = await payload.create({
    collection: 'pages',
    data,
    depth: 0,
  })
  console.log(`Created page: ${created.slug}`)
  return created
}

const seedGlobals = async (payload) => {
  await payload.updateGlobal({
    slug: 'siteSettings',
    data: {
      siteName: 'Medusa Agency Demo Store',
      tagline: 'Демо-витрина с управляемым контентом Payload CMS',
      seo: {
        title: 'Medusa Agency Demo Store',
        description: 'Демо-магазин Medusa с маркетинговыми страницами из Payload CMS.',
      },
      _status: 'published',
    },
    depth: 0,
  })
  console.log('Updated global: siteSettings')

  await payload.updateGlobal({
    slug: 'navigation',
    data: {
      items: [
        { link: customLink('Каталог', '/store') },
        { link: pageLink('О нас', 'about') },
        { link: pageLink('Акции', 'promotions') },
        { link: pageLink('Доставка и оплата', 'delivery-and-payment') },
        { link: pageLink('Контакты', 'contacts') },
      ],
      _status: 'published',
    },
    depth: 0,
  })
  console.log('Updated global: navigation')

  await payload.updateGlobal({
    slug: 'footer',
    data: {
      contactEmail: 'support@example.com',
      contactPhone: '+7 000 000-00-00',
      columns: [
        {
          title: 'Покупателям',
          links: [
            { link: pageLink('Доставка и оплата', 'delivery-and-payment') },
            { link: pageLink('Акции', 'promotions') },
            { link: pageLink('Программа лояльности', 'loyalty') },
          ],
        },
        {
          title: 'Компания',
          links: [
            { link: pageLink('О нас', 'about') },
            { link: pageLink('Контакты', 'contacts') },
          ],
        },
      ],
      socialLinks: [
        { link: customLink('VK', 'https://vk.com/example', true) },
        { link: customLink('Telegram', 'https://t.me/example', true) },
      ],
      _status: 'published',
    },
    depth: 0,
  })
  console.log('Updated global: footer')
}

const main = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for Payload seed.')
  }

  if (!process.env.PAYLOAD_SECRET) {
    throw new Error('PAYLOAD_SECRET is required for Payload seed.')
  }

  const payload = await getPayload({ config: configPromise })

  for (const page of pages) {
    await upsertPage(payload, page)
  }

  await seedGlobals(payload)
  console.log(`Payload marketing seed completed: ${pages.length} pages + globals.`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
