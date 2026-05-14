import { login } from "@lib/data/customer"
import { VK_ID_ENABLED } from "@lib/config"
import { storefrontConfig } from "@lib/storefront-config"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import Input from "@modules/common/components/input"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import VkLoginButton from "@modules/account/components/vk-login-button"
import { useActionState } from "react"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
  countryCode?: string | null
  vkLoginError?: string | null
  vkRegistered?: string | null
}

function getVkLoginErrorMessage(error: string | null | undefined) {
  if (!error) {
    return null
  }

  switch (error) {
    case "not_linked":
      return "Этот VK ID не привязан ни к одному аккаунту. Войдите по email и паролю, затем привяжите VK в профиле."
    case "auth_identity_not_found":
      return "Не удалось войти через VK: у этого аккаунта нет email-пароля. Свяжитесь с поддержкой."
    // Phase 5.2: VK didn't return an email and `VK_ID_REQUIRE_EMAIL=true`.
    // The user can still register through the classic email/password form.
    case "email_required":
      return "ВКонтакте не передал ваш email. Зарегистрируйтесь через email и пароль, а затем привяжите VK в профиле."
    // Phase 5.2: the VK email collides with an existing email/password
    // account. Phase 5.3 replaces this dead-end banner with a redirect to
    // the `/ru/account/vk-link-conflict` page, but we keep the copy as a
    // fallback — the callback falls back to this code only if the pending
    // token mint fails (e.g. no signing secret configured).
    case "email_exists":
      return "Email, полученный от ВКонтакте, уже используется другим аккаунтом. Войдите по паролю и привяжите VK в профиле."
    // Phase 5.3: `VK_ID_EMAIL_TRUST_POLICY=reject` is active and refuses
    // to seed accounts from VK-provided emails.
    case "email_trust_policy_reject":
      return "Вход через ВКонтакте временно недоступен. Зарегистрируйтесь по email и паролю."
    // Phase 5.2: internal failures coming back from the register helper.
    case "auth_identity_creation_failed":
    case "customer_account_creation_failed":
      return "Не удалось создать аккаунт через ВКонтакте. Попробуйте позже или зарегистрируйтесь по email и паролю."
    case "vk_id_login_disabled":
      return "Вход через VK сейчас отключён. Используйте email и пароль."
    case "vk_id_disabled":
      return "VK ID сейчас отключён. Используйте email и пароль."
    case "missing_vk_peer_id":
      return "VK не вернул идентификатор пользователя. Попробуйте ещё раз."
    case "invalid_or_expired_state":
      return "Сессия VK ID устарела. Попробуйте войти заново."
    case "access_denied":
      return "Вы отменили вход через VK. Чтобы продолжить, разрешите доступ или войдите по email и паролю."
    case "customer_auth_required":
      return "Для открытия профиля войдите в аккаунт."
    case "missing_callback_params":
      return "Параметры VK ID callback неполные. Попробуйте ещё раз."
    case "token_exchange_failed":
      return "Не удалось обменять код VK ID на токен. Попробуйте позже."
    case "jwt_secret_missing":
    case "jwt_signing_failed":
      return "Не удалось выпустить токен сессии. Попробуйте войти по email/паролю."
    // Server misconfiguration: no VK_ID_STOREFRONT_RETURN_ORIGINS / STORE_CORS.
    // Surfaced explicitly so support can triage without reading the log.
    case "vk_id_return_origin_unconfigured":
      return "Сервис входа через VK временно недоступен. Пожалуйста, обратитесь в поддержку."
    // The public /store/auth/vk-id/start endpoint refused the request because
    // its Origin/Referer is outside the storefront allowlist. Users normally
    // never see this in a correctly-configured deployment; show a friendly
    // generic message instead of leaking the policy detail.
    case "vk_id_origin_not_allowed":
      return "Запрос на вход через VK был отклонён. Откройте страницу снова из нашего сайта и попробуйте ещё раз."
    default:
      return "Не удалось войти через ВКонтакте. Попробуйте ещё раз."
  }
}

const Login = ({
  setCurrentView,
  countryCode,
  vkLoginError,
  vkRegistered,
}: Props) => {
  const [message, formAction] = useActionState(login, null)
  const accountCopy = storefrontConfig.copy.account
  const cartCopy = storefrontConfig.copy.cart
  const vkLoginErrorMessage = getVkLoginErrorMessage(vkLoginError)
  const showVkRegisteredBanner = vkRegistered === "success"
  const resolvedCountryCode = countryCode || "ru"

  return (
    <div className="w-full flex flex-col" data-testid="login-page">
      <div className="mb-6 flex flex-col gap-y-1 text-center">
        <h1 className="text-xl-semi">{accountCopy.signInTitle}</h1>
        <p className="text-small-regular text-ui-fg-subtle">
          {accountCopy.signInDescription}
        </p>
      </div>
      {showVkRegisteredBanner ? (
        <div
          role="status"
          data-testid="vk-registered-success-banner"
          className="mb-4 rounded-rounded border border-green-200 bg-green-50 px-4 py-3 text-small-regular text-green-800"
        >
          Аккаунт создан через ВКонтакте. Добро пожаловать! Чтобы добавить пароль
          для входа без VK, воспользуйтесь ссылкой «Забыли пароль?».
        </div>
      ) : null}
      {vkLoginErrorMessage ? (
        <div
          role="alert"
          data-testid="vk-login-error-banner"
          className="mb-4 rounded-rounded border border-red-200 bg-red-50 px-4 py-3 text-small-regular text-red-800"
        >
          {vkLoginErrorMessage}
        </div>
      ) : null}
      <form className="w-full" action={formAction}>
        <div className="flex flex-col w-full gap-y-2">
          <Input
            label="Email"
            name="email"
            type="email"
            title="Введите корректный email."
            autoComplete="email"
            required
            data-testid="email-input"
          />
          <Input
            label="Пароль"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            data-testid="password-input"
          />
        </div>
        <div className="flex justify-end mt-2">
          <LocalizedClientLink
            href="/account/forgot-password"
            className="text-small-regular text-ui-fg-subtle hover:text-ui-fg-base hover:underline underline-offset-4"
            data-testid="forgot-password-link"
          >
            Забыли пароль?
          </LocalizedClientLink>
        </div>
        <ErrorMessage error={message} data-testid="login-error-message" />
        <SubmitButton data-testid="sign-in-button" className="w-full mt-6">
          {cartCopy.signIn}
        </SubmitButton>
      </form>
      {VK_ID_ENABLED ? (
        <div className="mt-6 flex flex-col gap-y-3">
          <div className="flex items-center gap-x-3 text-ui-fg-subtle">
            <span className="h-px flex-1 bg-ui-border-base" aria-hidden />
            <span className="text-xsmall-regular uppercase tracking-wider">
              или
            </span>
            <span className="h-px flex-1 bg-ui-border-base" aria-hidden />
          </div>
          <VkLoginButton countryCode={resolvedCountryCode} />
        </div>
      ) : null}
      <p className="text-center text-ui-fg-subtle text-small-regular mt-6">
        {accountCopy.notMember}{" "}
        <button
          type="button"
          onClick={() => setCurrentView(LOGIN_VIEW.REGISTER)}
          className="text-ui-fg-base font-semibold hover:underline underline-offset-4"
          data-testid="register-button"
        >
          {accountCopy.join}
        </button>
      </p>
    </div>
  )
}

export default Login
