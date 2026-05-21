import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default function OnboardingBanner() {
  return (
    <section
      className="mb-6 flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-4 shadow-sm small:flex-row small:items-center small:justify-between"
      role="status"
      aria-label="Завершите настройку профиля"
      data-testid="onboarding-banner"
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700"
          aria-hidden="true"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
        </span>
        <div className="flex flex-col gap-0.5">
          <strong className="text-base font-semibold text-blue-900">
            Завершите настройку профиля
          </strong>
          <p className="text-small-regular text-blue-900/80">
            Укажите email для получения уведомлений о заказах и оформления покупок.
          </p>
        </div>
      </div>
      <LocalizedClientLink
        href="/account/onboarding"
        className="inline-flex items-center justify-center rounded-md border border-blue-300 bg-white px-4 py-2 text-small-semi text-blue-900 transition-colors hover:bg-blue-100"
        data-testid="onboarding-banner-link"
      >
        Заполнить →
      </LocalizedClientLink>
    </section>
  )
}
