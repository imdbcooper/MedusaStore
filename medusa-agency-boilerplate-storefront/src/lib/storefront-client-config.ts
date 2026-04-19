import type { CSSProperties } from "react"

import {
  STOREFRONT_PRESET,
  STOREFRONT_PRESET_IS_VALID,
  STOREFRONT_PRESET_RAW,
} from "@lib/env"

export type StorefrontPreset = "atelier" | "market"

export type StorefrontActionLink = {
  label: string
  href: string
  newTab?: boolean
}

export type StorefrontTheme = {
  colors: {
    canvas: string
    surface: string
    surfaceMuted: string
    border: string
    foreground: string
    muted: string
    accent: string
    accentContrast: string
    accentSoft: string
  }
  radius: {
    shell: string
    card: string
    pill: string
  }
  shadow: {
    shell: string
    card: string
  }
  layout: {
    contentMaxWidth: string
  }
  hero: {
    gradientFrom: string
    gradientTo: string
  }
}

export type StorefrontShellConfig = {
  nav: {
    variant: "bordered" | "floating"
  }
  footer: {
    variant: "default" | "editorial"
  }
}

export type HomeHeroSection = {
  type: "hero"
  eyebrow?: string
  title: string
  description: string
  primaryAction?: StorefrontActionLink
  secondaryAction?: StorefrontActionLink
  highlights?: string[]
}

export type HomeFeaturedCollectionsSection = {
  type: "featuredCollections"
  title: string
  description?: string
  collectionHandles?: string[]
  maxCollections?: number
  maxProductsPerCollection?: number
}

export type HomeTrustGridSection = {
  type: "trustGrid"
  title: string
  description?: string
  items: {
    title: string
    description: string
  }[]
}

export type HomeImageTextSection = {
  type: "imageText"
  eyebrow?: string
  title: string
  description: string
  highlights?: string[]
  primaryAction?: StorefrontActionLink
  secondaryAction?: StorefrontActionLink
}

export type HomeFaqSection = {
  type: "faq"
  title: string
  items: {
    question: string
    answer: string
  }[]
}

export type HomeCtaSection = {
  type: "cta"
  eyebrow?: string
  title: string
  description: string
  primaryAction?: StorefrontActionLink
  secondaryAction?: StorefrontActionLink
}

export type StorefrontHomeSection =
  | HomeHeroSection
  | HomeFeaturedCollectionsSection
  | HomeTrustGridSection
  | HomeImageTextSection
  | HomeFaqSection
  | HomeCtaSection

export type StorefrontTitleDescriptionItem = {
  title: string
  description: string
}

export type StorefrontCollectionLandingHeaderSlot = {
  slot: "header"
  variant: "compact" | "editorial"
  eyebrow: string
  descriptionTemplate: string
  productCountLabel: string
  metaPills?: string[]
}

export type StorefrontCollectionLandingSupportPillarsSlot = {
  slot: "supportPillars"
  items: StorefrontTitleDescriptionItem[]
}

export type StorefrontContentPageHeaderSlot = {
  slot: "header"
  variant: "simple" | "editorial"
  eyebrow: string
  labels: {
    marketing: string
    informational: string
  }
}

export type StorefrontPostPageHeaderSlot = {
  slot: "header"
  variant: "simple" | "editorial"
  eyebrow: string
  label: string
  publishedDateLocale: string
}

export type StorefrontHomeLandingSurface = {
  mode: "sections"
  sections: StorefrontHomeSection[]
}

export type StorefrontCollectionLandingSurface = {
  mode: "slots"
  slots: (
    | StorefrontCollectionLandingHeaderSlot
    | StorefrontCollectionLandingSupportPillarsSlot
  )[]
}

export type StorefrontContentPageLandingSurface = {
  mode: "slots"
  slots: StorefrontContentPageHeaderSlot[]
}

export type StorefrontPostPageLandingSurface = {
  mode: "slots"
  slots: StorefrontPostPageHeaderSlot[]
}

export type StorefrontClientConfig = {
  meta: {
    preset: StorefrontPreset
    label: string
    description: string
  }
  theme: StorefrontTheme
  shell: StorefrontShellConfig
  landingSurfaces: {
    home: StorefrontHomeLandingSurface
    collectionLanding: StorefrontCollectionLandingSurface
    contentPage: StorefrontContentPageLandingSurface
    postPage: StorefrontPostPageLandingSurface
  }
  surfaces: {
    product: {
      supportHighlights: StorefrontTitleDescriptionItem[]
    }
  }
  overridePolicy: {
    customizable: readonly string[]
    coreLocked: readonly string[]
  }
  guardrails: {
    sanctionedExtensionPath: readonly string[]
    prohibitedPatterns: readonly string[]
  }
}

const sharedOverridePolicy = {
  customizable: [
    "brand tokens",
    "nav/footer variants",
    "landing surfaces (home, collection, content, post)",
    "product support highlights",
  ],
  coreLocked: [
    "cart logic",
    "checkout flow",
    "account flow",
    "order flow",
    "provider integrations",
    "region and locale data layer",
    "Store API contracts",
  ],
} as const

const sharedGuardrails = {
  sanctionedExtensionPath: [
    "Switch client scenarios only through NEXT_PUBLIC_STOREFRONT_PRESET.",
    "Add new client-specific behavior in storefront-client-config.ts and storefront-customization components.",
    "Treat cart, checkout, account, order flow, Store API contracts, and provider integrations as locked core.",
  ],
  prohibitedPatterns: [
    "Do not fork shared storefront core per client.",
    "Do not add client-only logic inside checkout, account, or order flow components.",
    "Do not introduce new backend contracts just to support a visual storefront scenario.",
  ],
} as const

export const storefrontPresetCatalog = {
  atelier: {
    meta: {
      preset: "atelier",
      label: "Atelier Editorial",
      description:
        "Editorial storefront with warm neutrals, floating shell, and content-forward landing surfaces.",
    },
    theme: {
      colors: {
        canvas: "#f6f2ea",
        surface: "#fffdf8",
        surfaceMuted: "#efe6d6",
        border: "#d8cfbe",
        foreground: "#221f1a",
        muted: "#6d6356",
        accent: "#8b5e3c",
        accentContrast: "#fffaf4",
        accentSoft: "#ead4bf",
      },
      radius: {
        shell: "30px",
        card: "26px",
        pill: "999px",
      },
      shadow: {
        shell: "0 20px 50px rgba(34, 31, 26, 0.08)",
        card: "0 18px 40px rgba(34, 31, 26, 0.06)",
      },
      layout: {
        contentMaxWidth: "1440px",
      },
      hero: {
        gradientFrom: "#f3e8d6",
        gradientTo: "#d9c1aa",
      },
    },
    shell: {
      nav: {
        variant: "floating",
      },
      footer: {
        variant: "editorial",
      },
    },
    landingSurfaces: {
      home: {
        mode: "sections",
        sections: [
          {
            type: "hero",
            eyebrow: "Client Customization Layer",
            title: "Один storefront core, который можно адаптировать под разные магазины",
            description:
              "Фаза 6 добавляет управляемый слой кастомизации поверх каталога, корзины, checkout и личного кабинета без дублирования commerce-логики.",
            primaryAction: {
              label: "Открыть каталог",
              href: "/store",
            },
            secondaryAction: {
              label: "Смотреть новости",
              href: "/news",
            },
            highlights: [
              "Design tokens и shell variants живут в одном client config.",
              "Homepage и marketing-entry surfaces собираются из section registry.",
              "Checkout, account, order flow и integrations остаются общим core.",
            ],
          },
          {
            type: "trustGrid",
            title: "Что именно настраивается без форка storefront",
            description:
              "Кастомизация идет по контролируемым поверхностям, а не через переписывание shared-компонентов.",
            items: [
              {
                title: "Brand tokens",
                description:
                  "Цвета, радиусы, surface-тон и визуальный характер shell меняются через единый конфиг.",
              },
              {
                title: "Shell variants",
                description:
                  "Навигация и footer получают управляемые варианты оформления без изменений data layer.",
              },
              {
                title: "Section registry",
                description:
                  "Homepage и дальше landing surfaces можно собирать из типизированных секций.",
              },
            ],
          },
          {
            type: "featuredCollections",
            title: "Текущие подборки магазина",
            description:
              "Catalog-facing sections продолжают использовать существующий Medusa commerce layer и не требуют нового backend API.",
            maxCollections: 3,
            maxProductsPerCollection: 4,
          },
          {
            type: "imageText",
            eyebrow: "Override Surfaces",
            title: "Клиентские вариации живут поверх core, а не внутри checkout-логики",
            description:
              "В первой поставке мы концентрируемся на home, shell и display-only product experience surfaces. Cart, checkout, account и order остаются общими для всех клиентских витрин.",
            highlights: [
              "Homepage sections можно менять порядком и наполнением через config.",
              "Product page получает отдельные support/highlight cards без вмешательства в pricing или cart state.",
              "Informational and collection surfaces закреплены как допустимые future override zones.",
            ],
            primaryAction: {
              label: "Открыть аккаунт",
              href: "/account",
            },
            secondaryAction: {
              label: "Перейти в каталог",
              href: "/store",
            },
          },
          {
            type: "faq",
            title: "Как использовать этот слой дальше",
            items: [
              {
                question: "Нужно ли делать новый storefront под каждого клиента?",
                answer:
                  "Нет. Базовый путь Фазы 6 - переиспользовать один storefront core и менять только контролируемые client-specific surfaces.",
              },
              {
                question: "Можно ли менять checkout под клиента?",
                answer:
                  "Checkout logic не считается частью customization layer v1. Менять можно presentation вокруг core, но не сам flow оплаты, заказа и аккаунта.",
              },
              {
                question: "Payload заменяет этот слой?",
                answer:
                  "Нет. Payload отвечает за content layer, а client customization задает визуальные токены, shell variants и storefront section policy.",
              },
            ],
          },
          {
            type: "cta",
            eyebrow: "Shared Core",
            title: "Кастомизация готовит шаблон к разным клиентам, не разрушая commerce baseline",
            description:
              "Это переход от общего storefront core к управляемой клиентской адаптации. Следом уже можно будет строить template-init и release automation без скрытых фронтовых форков.",
            primaryAction: {
              label: "Перейти к товарам",
              href: "/store",
            },
            secondaryAction: {
              label: "Открыть новости",
              href: "/news",
            },
          },
        ],
      },
      collectionLanding: {
        mode: "slots",
        slots: [
          {
            slot: "header",
            variant: "editorial",
            eyebrow: "Collection Landing",
            descriptionTemplate:
              "Подборка магазина {storeName}, которая использует общий catalog core, но уже живёт в client customization layer как отдельная управляемая presentation surface.",
            productCountLabel: "товаров",
            metaPills: ["Surface override без форка catalog logic"],
          },
          {
            slot: "supportPillars",
            items: [
              {
                title: "Shared catalog core",
                description:
                  "Сортировка, пагинация и product grid остаются частью общего storefront core.",
              },
              {
                title: "Client presentation layer",
                description:
                  "Hero и supporting cards можно менять без переписывания catalog logic.",
              },
              {
                title: "No backend drift",
                description:
                  "Surface использует существующий collection contract и не требует новых Store API.",
              },
            ],
          },
        ],
      },
      contentPage: {
        mode: "slots",
        slots: [
          {
            slot: "header",
            variant: "editorial",
            eyebrow: "Informational Surface",
            labels: {
              marketing: "Marketing page",
              informational: "Informational page",
            },
          },
        ],
      },
      postPage: {
        mode: "slots",
        slots: [
          {
            slot: "header",
            variant: "editorial",
            eyebrow: "Editorial Surface",
            label: "News article",
            publishedDateLocale: "ru-RU",
          },
        ],
      },
    },
    surfaces: {
      product: {
        supportHighlights: [
          {
            title: "Доставка под текущий регион",
            description:
              "Расчет сроков и стоимости остается привязан к существующему provider-aware checkout flow.",
          },
          {
            title: "Поддержка после заказа",
            description:
              "Коммуникация и post-order path продолжают жить в общем operational контуре магазина.",
          },
          {
            title: "Клиентский UX без форка core",
            description:
              "Display-only product surfaces можно настраивать отдельно, не дублируя cart и order logic.",
          },
        ],
      },
    },
    overridePolicy: sharedOverridePolicy,
    guardrails: sharedGuardrails,
  },
  market: {
    meta: {
      preset: "market",
      label: "Market Utility",
      description:
        "Conversion-first storefront with compact headers, bordered shell, and catalog-leaning merchandising.",
    },
    theme: {
      colors: {
        canvas: "#f4f7fb",
        surface: "#ffffff",
        surfaceMuted: "#eaf0f8",
        border: "#cfd9e6",
        foreground: "#162235",
        muted: "#5e7088",
        accent: "#1f5fae",
        accentContrast: "#f7fbff",
        accentSoft: "#d4e6fb",
      },
      radius: {
        shell: "22px",
        card: "18px",
        pill: "999px",
      },
      shadow: {
        shell: "0 14px 32px rgba(22, 34, 53, 0.08)",
        card: "0 12px 24px rgba(22, 34, 53, 0.05)",
      },
      layout: {
        contentMaxWidth: "1380px",
      },
      hero: {
        gradientFrom: "#e6f0fb",
        gradientTo: "#c5daf7",
      },
    },
    shell: {
      nav: {
        variant: "bordered",
      },
      footer: {
        variant: "default",
      },
    },
    landingSurfaces: {
      home: {
        mode: "sections",
        sections: [
          {
            type: "hero",
            eyebrow: "Preset: Market Utility",
            title: "Витрина для магазина, где важны скорость запуска и понятный путь до покупки",
            description:
              "Этот клиентский сценарий делает упор на каталог, подборки и операционный контур магазина без отказа от общего storefront core.",
            primaryAction: {
              label: "Перейти к товарам",
              href: "/store",
            },
            secondaryAction: {
              label: "Открыть подборки",
              href: "/collections",
            },
            highlights: [
              "Более утилитарный shell и компактные landing surfaces.",
              "Catalog-first подача без изменений checkout/account/order logic.",
              "Тот же customization layer, но с другим sanctioned preset.",
            ],
          },
          {
            type: "featuredCollections",
            title: "Основные подборки магазина",
            description:
              "Preset меняет merchandising tone, но продолжает использовать существующий collection и product data layer.",
            maxCollections: 4,
            maxProductsPerCollection: 3,
          },
          {
            type: "trustGrid",
            title: "Почему этот сценарий подходит для клиентского rollout",
            description:
              "Второй preset нужен не для форка storefront, а чтобы доказать реальную переключаемость поверх одного core.",
            items: [
              {
                title: "Preset switch",
                description:
                  "Сценарий выбирается через sanctioned env switch, а не через ручной копипаст storefront.",
              },
              {
                title: "Locked core",
                description:
                  "Cart, checkout, account, order flow и provider integrations остаются неизменными.",
              },
              {
                title: "Client-ready surfaces",
                description:
                  "Home, collection, informational и product display surfaces живут в customization contract.",
              },
            ],
          },
          {
            type: "cta",
            eyebrow: "Anti-Fork Guardrail",
            title: "Если нужно новое оформление, оно сначала оформляется как preset или sanctioned override",
            description:
              "Phase 6 должна вести к тиражируемому шаблону, а не к россыпи клиентских веток с разъехавшимся storefront core.",
            primaryAction: {
              label: "Открыть аккаунт",
              href: "/account",
            },
            secondaryAction: {
              label: "Смотреть новости",
              href: "/news",
            },
          },
        ],
      },
      collectionLanding: {
        mode: "slots",
        slots: [
          {
            slot: "header",
            variant: "compact",
            eyebrow: "Catalog Surface",
            descriptionTemplate:
              "Подборка магазина {storeName} с общим catalog core и управляемой клиентской presentation-layer.",
            productCountLabel: "товаров",
          },
          {
            slot: "supportPillars",
            items: [
              {
                title: "Compact merchandising",
                description:
                  "Collection landing сохраняет catalog-first характер и не раздувает shopper path.",
              },
              {
                title: "Shared product grid",
                description:
                  "Пагинация, sort и product preview по-прежнему опираются на общий store flow.",
              },
              {
                title: "Preset-driven presentation",
                description:
                  "Смена сценария оформляется через preset, а не через отдельный template fork.",
              },
            ],
          },
        ],
      },
      contentPage: {
        mode: "slots",
        slots: [
          {
            slot: "header",
            variant: "simple",
            eyebrow: "Utility Information",
            labels: {
              marketing: "Campaign page",
              informational: "Service page",
            },
          },
        ],
      },
      postPage: {
        mode: "slots",
        slots: [
          {
            slot: "header",
            variant: "simple",
            eyebrow: "Utility Editorial",
            label: "Update",
            publishedDateLocale: "ru-RU",
          },
        ],
      },
    },
    surfaces: {
      product: {
        supportHighlights: [
          {
            title: "Операционный checkout core",
            description:
              "Даже в utility preset продуктовые страницы не вмешиваются в payment или order state.",
          },
          {
            title: "Каталог как главный surface",
            description:
              "Product display layer помогает продаже, но остается отделенным от cart mechanics.",
          },
          {
            title: "Один sanctioned rollout path",
            description:
              "Новый клиентский сценарий должен расширять preset layer, а не дублировать templates.",
          },
        ],
      },
    },
    overridePolicy: sharedOverridePolicy,
    guardrails: sharedGuardrails,
  },
} satisfies Record<StorefrontPreset, StorefrontClientConfig>

if (!STOREFRONT_PRESET_IS_VALID && process.env.NODE_ENV === "development") {
  console.warn(
    `Unknown NEXT_PUBLIC_STOREFRONT_PRESET="${STOREFRONT_PRESET_RAW}". Falling back to "${STOREFRONT_PRESET}".`
  )
}

export const storefrontPresetName = STOREFRONT_PRESET
export const storefrontPresetOptions = Object.keys(
  storefrontPresetCatalog
) as StorefrontPreset[]

export const storefrontClientConfig =
  storefrontPresetCatalog[storefrontPresetName]

export const getStorefrontThemeStyle = (
  theme: StorefrontTheme = storefrontClientConfig.theme
) =>
  ({
    "--theme-canvas": theme.colors.canvas,
    "--theme-surface": theme.colors.surface,
    "--theme-surface-muted": theme.colors.surfaceMuted,
    "--theme-border": theme.colors.border,
    "--theme-foreground": theme.colors.foreground,
    "--theme-muted": theme.colors.muted,
    "--theme-accent": theme.colors.accent,
    "--theme-accent-contrast": theme.colors.accentContrast,
    "--theme-accent-soft": theme.colors.accentSoft,
    "--theme-hero-start": theme.hero.gradientFrom,
    "--theme-hero-end": theme.hero.gradientTo,
    "--theme-radius-shell": theme.radius.shell,
    "--theme-radius-card": theme.radius.card,
    "--theme-radius-pill": theme.radius.pill,
    "--theme-shadow-shell": theme.shadow.shell,
    "--theme-shadow-card": theme.shadow.card,
    "--theme-content-max-width": theme.layout.contentMaxWidth,
  }) as CSSProperties
