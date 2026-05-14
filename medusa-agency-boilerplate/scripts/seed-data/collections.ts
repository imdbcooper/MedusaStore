/**
 * 9 коллекций IT-услуг для seed-скрипта.
 * Источник: plans/product-catalog-plan.md
 */

export interface CollectionDefinition {
  handle: string;
  title: string;
}

export const COLLECTIONS: CollectionDefinition[] = [
  { handle: "web-development", title: "Разработка сайтов и веб-приложений" },
  { handle: "mobile-development", title: "Мобильная разработка" },
  { handle: "chatbots-ai", title: "Чат-боты и ИИ" },
  { handle: "integrations", title: "Интеграции с учётными и российскими системами" },
  { handle: "devops-infrastructure", title: "DevOps и серверная инфраструктура" },
  { handle: "security-qa", title: "Безопасность и QA" },
  { handle: "analytics-seo-martech", title: "Аналитика, SEO и MarTech" },
  { handle: "support-refactoring-ux", title: "Поддержка, рефакторинг и UX" },
  { handle: "it-consulting", title: "IT-консалтинг и аудит" },
];
