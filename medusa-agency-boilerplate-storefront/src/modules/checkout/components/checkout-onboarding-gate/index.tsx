import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default function CheckoutOnboardingGate() {
  return (
    <div
      className="flex flex-col items-center gap-6 py-12 text-center"
      data-testid="checkout-onboarding-gate"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-amber-700"
          aria-hidden="true"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-ui-fg-base">
          Для оформления заказа необходимо указать email
        </h2>
        <p className="text-base text-ui-fg-subtle max-w-md mx-auto">
          Заполните профиль, чтобы мы могли отправить подтверждение заказа и
          информацию о доставке.
        </p>
      </div>
      <LocalizedClientLink
        href="/account/onboarding"
        className="inline-flex items-center justify-center rounded-lg bg-ui-fg-base px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-ui-fg-base/90"
        data-testid="checkout-onboarding-gate-link"
      >
        Заполнить профиль →
      </LocalizedClientLink>
    </div>
  )
}
