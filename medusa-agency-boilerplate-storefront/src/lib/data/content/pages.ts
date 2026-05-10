import 'server-only'
import { PAYLOAD_CONTENT_TAGS } from '@lib/content/constants'
import { ContentPage } from '@lib/content/types'
import { fetchPayloadAPI } from './client'

type PayloadDocsResponse<T> = {
  docs?: T[]
}

const richText = (text: string) => ({
  root: {
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', text }],
      },
    ],
  },
})

const fallbackPages: Record<string, ContentPage> = {
  about: {
    slug: 'about',
    title: 'О нас',
    pageType: 'informational',
    excerpt: 'Команда, подход и сервисные принципы магазина.',
    layout: [
      {
        blockType: 'heroBanner',
        heading: 'Мы строим удобный магазин для ежедневных покупок',
        body: 'Помогаем клиентам быстро находить нужные товары, получать понятные условия доставки и поддержку.',
      },
      {
        blockType: 'richText',
        content: richText('Наша витрина объединяет коммерческий каталог Medusa и контентный слой Payload CMS, чтобы маркетинговые страницы можно было обновлять без релизов storefront.'),
      },
    ],
  },
  promotions: {
    slug: 'promotions',
    title: 'Акции',
    pageType: 'marketing',
    excerpt: 'Сезонные скидки, подборки товаров и специальные условия.',
    layout: [
      {
        blockType: 'heroBanner',
        heading: 'Актуальные акции и выгодные подборки',
        body: 'Используйте эту страницу как посадочную для кампаний, баннеров и промокодов.',
      },
      {
        blockType: 'richText',
        content: richText('Добавьте сюда правила акции, сроки проведения, ограничения и ссылки на релевантные категории товаров.'),
      },
    ],
  },
  'delivery-and-payment': {
    slug: 'delivery-and-payment',
    title: 'Доставка и оплата',
    pageType: 'informational',
    excerpt: 'Условия доставки, оплаты и обработки заказов.',
    layout: [
      {
        blockType: 'heroBanner',
        heading: 'Доставляем заказы удобным способом',
        body: 'Страница описывает типовые правила доставки и оплаты.',
      },
      {
        blockType: 'richText',
        content: richText('Доступные способы доставки и оплаты зависят от региона, состава заказа и подключённых провайдеров.'),
      },
    ],
  },
  loyalty: {
    slug: 'loyalty',
    title: 'Программа лояльности',
    pageType: 'marketing',
    excerpt: 'Бонусы и персональные предложения постоянным клиентам.',
    layout: [
      {
        blockType: 'heroBanner',
        heading: 'Бонусы и персональные предложения',
        body: 'Расскажите о правилах начисления бонусов и преимуществах регистрации.',
      },
      {
        blockType: 'richText',
        content: richText('Перед production-запуском замените демо-текст на юридически точные правила участия.'),
      },
    ],
  },
}

export const getFallbackContentPageBySlug = (slug: string) =>
  fallbackPages[slug] || null

export const getContentPageBySlug = async (slug: string) => {
  const response = await fetchPayloadAPI<PayloadDocsResponse<ContentPage>>('/pages', {
    searchParams: {
      limit: 1,
      depth: 2,
      'where[slug][equals]': slug,
    },
    tags: [
      PAYLOAD_CONTENT_TAGS.all,
      PAYLOAD_CONTENT_TAGS.pages,
      PAYLOAD_CONTENT_TAGS.page(slug),
    ],
  })

  if (response?.docs) {
    return response.docs[0] || null
  }

  return getFallbackContentPageBySlug(slug)
}
