import { login } from "@lib/data/customer"
import { storefrontConfig } from "@lib/storefront-config"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"
import Input from "@modules/common/components/input"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useActionState } from "react"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
}

const Login = ({ setCurrentView }: Props) => {
  const [message, formAction] = useActionState(login, null)
  const accountCopy = storefrontConfig.copy.account
  const cartCopy = storefrontConfig.copy.cart

  return (
    <div className="w-full flex flex-col" data-testid="login-page">
      <div className="mb-6 flex flex-col gap-y-1 text-center">
        <h1 className="text-xl-semi">{accountCopy.signInTitle}</h1>
        <p className="text-small-regular text-ui-fg-subtle">
          {accountCopy.signInDescription}
        </p>
      </div>
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
