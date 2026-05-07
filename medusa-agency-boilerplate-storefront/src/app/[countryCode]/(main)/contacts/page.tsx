import { Metadata } from "next"

import { getMetadataTitle } from "@lib/storefront-config"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { StitchContactSurface } from "@modules/storefront-customization/components/stitch-surfaces"

export const metadata: Metadata = {
  title: getMetadataTitle("Контакты"),
  description:
    "Обсудите запуск сайта, интернет-магазина или корпоративного решения со StudioPro.",
}

export default function ContactsPage() {
  return (
    <main>
      <StitchContactSurface />

      <section className="content-container pb-14 small:pb-24">
        <div className="mx-auto grid max-w-6xl gap-5 medium:grid-cols-3">
          <div className="stitch-card p-6">
            <p className="stitch-eyebrow">Формат</p>
            <h2 className="pt-3 text-2xl font-bold tracking-[-0.02em] text-[var(--theme-foreground)]">
              Созвон или бриф
            </h2>
            <p className="pt-4 text-base leading-7 text-[var(--theme-muted)]">
              Начинаем с целей, ниши, сроков и требований к каталогу, оплате, контенту и CRM.
            </p>
          </div>
          <div className="stitch-card p-6">
            <p className="stitch-eyebrow">Ответ</p>
            <h2 className="pt-3 text-2xl font-bold tracking-[-0.02em] text-[var(--theme-foreground)]">
              В течение дня
            </h2>
            <p className="pt-4 text-base leading-7 text-[var(--theme-muted)]">
              Возвращаемся с понятным планом: состав страниц, интеграции, этапы и ориентир бюджета.
            </p>
          </div>
          <div className="stitch-card p-6">
            <p className="stitch-eyebrow">Навигация</p>
            <h2 className="pt-3 text-2xl font-bold tracking-[-0.02em] text-[var(--theme-foreground)]">
              Изучить решения
            </h2>
            <p className="pt-4 text-base leading-7 text-[var(--theme-muted)]">
              Если нужно сравнить готовые направления, каталог остается рабочей точкой входа.
            </p>
            <LocalizedClientLink
              href="/store"
              className="mt-6 inline-flex rounded-[var(--theme-radius-card)] bg-[var(--theme-accent)] px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[var(--theme-accent-strong)]"
            >
              Перейти в каталог
            </LocalizedClientLink>
          </div>
        </div>
      </section>
    </main>
  )
}
