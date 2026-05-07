import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  stitchArchitectureItems,
  stitchContactPrinciples,
  stitchProcessSteps,
  stitchTechnicalSpecs,
  stitchVisualAssets,
} from "../../../../data/mockData"

export type StitchAction = Readonly<{
  label: string
  href: string
}>

export type StitchHeroShowcaseProps = Readonly<{
  eyebrow?: string
  title: string
  accentTitle?: string
  description: string
  primaryAction?: StitchAction
  secondaryAction?: StitchAction
}>

export type StitchSectionHeadingProps = Readonly<{
  eyebrow?: string
  title: string
  description?: string
  align?: "left" | "center"
}>

export type StitchArchitecturePanelProps = Readonly<{
  className?: string
}>

export type StitchProcessTimelineProps = Readonly<{
  title?: string
  description?: string
}>

export type StitchContactSurfaceProps = Readonly<{
  title?: string
  description?: string
}>

export type StitchProductTechSpecsProps = Readonly<{
  title?: string
  description?: string
}>

const buttonBaseClassName =
  "inline-flex items-center justify-center rounded-[var(--theme-radius-card)] px-6 py-3 text-sm font-bold tracking-wide transition duration-200 hover:-translate-y-0.5"

export function StitchPrimaryButton({ action }: Readonly<{ action?: StitchAction }>) {
  if (!action) {
    return null
  }

  return (
    <LocalizedClientLink
      href={action.href}
      className={`${buttonBaseClassName} bg-[var(--theme-accent)] text-[var(--theme-accent-contrast)] shadow-[0_12px_28px_rgba(47,125,120,0.18)] hover:bg-[var(--theme-accent-strong)]`}
    >
      {action.label}
    </LocalizedClientLink>
  )
}

export function StitchSecondaryButton({ action }: Readonly<{ action?: StitchAction }>) {
  if (!action) {
    return null
  }

  return (
    <LocalizedClientLink
      href={action.href}
      className={`${buttonBaseClassName} border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-foreground)] hover:border-[var(--theme-foreground)]`}
    >
      {action.label}
    </LocalizedClientLink>
  )
}

export function StitchSectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: StitchSectionHeadingProps) {
  return (
    <div
      className={`flex flex-col gap-4 ${
        align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-4xl text-left"
      }`}
    >
      {eyebrow ? (
        <span className="text-xs font-bold uppercase tracking-[0.28em] text-[var(--theme-accent)]">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="text-3xl font-bold tracking-[-0.02em] text-[var(--theme-foreground)] small:text-5xl">
        {title}
      </h2>
      {description ? (
        <p className="text-base leading-8 text-[var(--theme-muted)] small:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  )
}

export function StitchHeroShowcase({
  eyebrow,
  title,
  accentTitle,
  description,
  primaryAction,
  secondaryAction,
}: StitchHeroShowcaseProps) {
  return (
    <section className="content-container py-16 small:py-28">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] lg:items-center">
        <div className="flex flex-col items-start gap-7">
          {eyebrow ? (
            <span className="rounded-full bg-[var(--theme-accent-muted)] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--theme-accent-contrast)]">
              {eyebrow}
            </span>
          ) : null}
          <div className="flex flex-col gap-5">
            <h1 className="max-w-5xl text-5xl font-bold leading-[1.08] tracking-[-0.035em] text-[var(--theme-foreground)] small:text-6xl">
              {title}
              {accentTitle ? (
                <span className="block text-[var(--theme-accent)]">{accentTitle}</span>
              ) : null}
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-[var(--theme-muted)] small:text-xl">
              {description}
            </p>
          </div>
          <div className="flex flex-wrap gap-4 pt-2">
            <StitchPrimaryButton action={primaryAction} />
            <StitchSecondaryButton action={secondaryAction} />
          </div>
          <div className="flex items-center gap-4 pt-3 text-sm font-bold tracking-wide text-[var(--theme-muted)]">
            <div className="flex -space-x-2">
              {["А", "Б", "В"].map((item) => (
                <span
                  key={item}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--theme-surface)] bg-[var(--theme-surface-muted)] text-xs text-[var(--theme-accent)]"
                >
                  {item}
                </span>
              ))}
            </div>
            <span>Доверяют 500+ компаний</span>
          </div>
        </div>
        <div className="relative">
          <div className="absolute inset-0 rotate-2 rounded-[var(--theme-radius-shell)] bg-[var(--theme-accent-soft)] opacity-70" />
          <Image
            src={stitchVisualAssets.heroDashboard}
            alt="Dashboard mockup"
            width={1200}
            height={860}
            priority
            className="relative rounded-[var(--theme-radius-shell)] border border-[var(--theme-border)] object-cover shadow-[var(--theme-shadow-shell)]"
          />
          <div className="absolute -bottom-6 left-8 hidden items-center gap-4 rounded-[var(--theme-radius-card)] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-5 shadow-[var(--theme-shadow-card)] small:flex">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--theme-surface-muted)] text-[var(--theme-accent)]">
              ✓
            </span>
            <div>
              <p className="text-sm font-bold text-[var(--theme-foreground)]">Экспертный контроль</p>
              <p className="text-sm text-[var(--theme-muted)]">Гарантия качества</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function StitchArchitecturePanel({ className }: StitchArchitecturePanelProps) {
  return (
    <div
      className={`rounded-[var(--theme-radius-shell)] bg-[var(--theme-foreground)] p-8 text-[var(--theme-accent-contrast)] shadow-[var(--theme-shadow-shell)] ${className || ""}`}
    >
      <p className="pb-8 text-xs font-bold uppercase tracking-[0.28em] text-white/45">
        System Architecture
      </p>
      <div className="grid gap-4">
        {stitchArchitectureItems.map((item) => (
          <div
            key={item.title}
            className="rounded-[var(--theme-radius-card)] border border-white/10 bg-white/10 p-5 backdrop-blur-sm"
          >
            <div className="flex items-center gap-4">
              <span className="text-2xl text-[var(--theme-accent-soft)]">{item.icon}</span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                  {item.label}
                </p>
                <p className="pt-1 text-base font-semibold text-white">{item.title}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="pt-8 text-center text-xs text-white/40">
        Verified Stack • Industrial Standards • High Availability
      </p>
    </div>
  )
}

export function StitchProcessTimeline({
  title = "Процесс работы",
  description = "Системный путь от идеи до запуска мощного цифрового инструмента.",
}: StitchProcessTimelineProps) {
  return (
    <section className="content-container py-16 small:py-24">
      <StitchSectionHeading title={title} description={description} />
      <div className="grid gap-8 pt-12 small:grid-cols-3 large:grid-cols-6">
        {stitchProcessSteps.map((step) => (
          <div key={step.number} className="text-center">
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--theme-accent)] text-2xl text-[var(--theme-accent-contrast)]">
              →
              <span className="absolute -right-1 -top-1 rounded-full bg-[var(--theme-accent)] px-2 py-1 text-xs font-bold text-[var(--theme-accent-contrast)]">
                {step.number}
              </span>
            </div>
            <h3 className="pt-6 text-lg font-bold text-[var(--theme-foreground)]">{step.title}</h3>
            <p className="pt-2 text-sm leading-6 text-[var(--theme-muted)]">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function StitchContactSurface({
  title = "Обсудим ваш будущий сайт",
  description = "Расскажите о вашей задаче. Мы поможем выбрать оптимальное технологическое решение, объективно оценим сроки и предложим прозрачный план работы без лишней воды.",
}: StitchContactSurfaceProps) {
  return (
    <section className="content-container py-16 small:py-28">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] lg:items-start">
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-5">
            <h1 className="text-4xl font-bold tracking-[-0.02em] text-[var(--theme-foreground)] small:text-5xl">
              {title}
            </h1>
            <p className="max-w-4xl text-lg leading-8 text-[var(--theme-muted)] small:text-xl">
              {description}
            </p>
          </div>
          <form className="rounded-[var(--theme-radius-shell)] border border-[var(--theme-border)] bg-[var(--theme-surface)] p-8 shadow-[var(--theme-shadow-card)] small:p-10">
            <div className="grid gap-6">
              <label className="grid gap-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                Имя
                <input
                  className="rounded-[var(--theme-radius-card)] border border-[var(--theme-border)] bg-[var(--theme-canvas)] px-5 py-4 text-base font-normal normal-case tracking-normal text-[var(--theme-foreground)] outline-none transition focus:border-[var(--theme-accent)]"
                  placeholder="Как к вам обращаться?"
                  type="text"
                />
              </label>
              <label className="grid gap-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                Email
                <input
                  className="rounded-[var(--theme-radius-card)] border border-[var(--theme-border)] bg-[var(--theme-canvas)] px-5 py-4 text-base font-normal normal-case tracking-normal text-[var(--theme-foreground)] outline-none transition focus:border-[var(--theme-accent)]"
                  placeholder="Ваш рабочий email"
                  type="email"
                />
              </label>
              <label className="grid gap-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--theme-muted)]">
                Опишите задачу
                <textarea
                  className="min-h-[180px] rounded-[var(--theme-radius-card)] border border-[var(--theme-border)] bg-[var(--theme-canvas)] px-5 py-4 text-base font-normal normal-case tracking-normal text-[var(--theme-foreground)] outline-none transition focus:border-[var(--theme-accent)]"
                  placeholder="Кратко о вашем бизнесе и целях..."
                />
              </label>
              <button
                className="rounded-[var(--theme-radius-card)] bg-[var(--theme-accent)] px-6 py-4 text-lg font-semibold text-[var(--theme-accent-contrast)] transition hover:-translate-y-0.5 hover:bg-[var(--theme-accent-strong)]"
                type="button"
              >
                Отправить запрос →
              </button>
              <p className="text-center text-sm font-bold text-[var(--theme-muted)]">
                Ваши данные надежно защищены
              </p>
            </div>
          </form>
        </div>
        <aside className="flex flex-col gap-10">
          <Image
            src={stitchVisualAssets.studioWorkspace}
            alt="Studio workspace"
            width={1000}
            height={520}
            className="h-72 w-full rounded-[var(--theme-radius-shell)] border border-[var(--theme-border)] object-cover shadow-[var(--theme-shadow-card)]"
          />
          <div className="grid gap-4 border-b border-[var(--theme-border)] pb-10">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--theme-muted)]">
              Прямая связь
            </p>
            <a className="text-xl font-semibold text-[var(--theme-foreground)] hover:text-[var(--theme-accent)]" href="mailto:hello@studiopro.com">
              hello@studiopro.com
            </a>
            <a className="text-xl font-semibold text-[var(--theme-foreground)] hover:text-[var(--theme-accent)]" href="https://t.me/studiopro_contact">
              @studiopro_contact
            </a>
            <a className="text-xl font-semibold text-[var(--theme-foreground)] hover:text-[var(--theme-accent)]" href="tel:+18005550199">
              +1 800 555 0199
            </a>
          </div>
          <div className="grid gap-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--theme-muted)]">
              Наши принципы
            </p>
            {stitchContactPrinciples.map((item) => (
              <div key={item.title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--theme-accent-soft)] text-[var(--theme-accent)]">
                  ✓
                </span>
                <div>
                  <h3 className="font-semibold text-[var(--theme-foreground)]">{item.title}</h3>
                  <p className="pt-1 text-sm leading-6 text-[var(--theme-muted)]">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  )
}

export function StitchProductTechSpecs({
  title = "Описание и характеристики",
  description = "Detailed insights into the technical foundation and functional scope of the selected solution.",
}: StitchProductTechSpecsProps) {
  return (
    <section className="bg-[var(--theme-surface)] py-16 small:py-[120px]">
      <div className="content-container">
        <div className="mb-12">
          <h2 className="mb-4 text-3xl font-semibold leading-tight tracking-[-0.01em] text-[var(--theme-foreground)] small:text-4xl">
            {title}
          </h2>
          <p className="max-w-2xl text-lg leading-8 text-[var(--theme-muted)]">{description}</p>
        </div>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h3 className="mb-6 text-2xl font-semibold text-[var(--theme-foreground)]">System Overview</h3>
            <div className="space-y-6 text-base leading-8 text-[var(--theme-muted)]">
              <p>
                Архитектура решения опирается на headless commerce: frontend остаётся гибким, а каталог, корзина, checkout и аккаунт используют общий стабильный commerce core.
              </p>
              <p>
                Витрина сохраняет реальные Medusa-данные, region-aware цены, варианты товара и add-to-cart flow, а Stitch-макет задаёт только визуальный слой предложения.
              </p>
              <p>
                Presentation-компоненты вынесены в модульные surfaces, чтобы будущие клиентские сценарии не требовали форка checkout, cart или Store API contracts.
              </p>
            </div>
          </div>
          <div>
            <h3 className="mb-6 text-2xl font-semibold text-[var(--theme-foreground)]">Technical Specifications</h3>
            <div className="flex flex-col gap-4">
              {stitchTechnicalSpecs.map(([name, value]) => (
                <div
                  key={name}
                  className="flex items-center justify-between gap-6 rounded-[8px] border border-[var(--theme-border)] bg-[var(--theme-canvas)] p-4 transition-colors hover:border-[var(--theme-muted)]"
                >
                  <span className="font-semibold text-[var(--theme-foreground)]">{name}</span>
                  <span className="text-right text-[var(--theme-muted)]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
