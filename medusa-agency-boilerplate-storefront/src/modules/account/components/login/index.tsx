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
    <div
      className="max-w-sm w-full flex flex-col items-center"
      data-testid="login-page"
    >
      <h1 className="text-large-semi uppercase mb-6">{accountCopy.signInTitle}</h1>
      <p className="text-center text-base-regular text-ui-fg-base mb-8">
        {accountCopy.signInDescription}
      </p>
      <form className="w-full" action={formAction}>
        <div className="flex flex-col w-full gap-y-2">
          <Input
            label="Email"
            name="email"
            type="email"
            title="Enter a valid email address."
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
            className="text-small-regular text-ui-fg-subtle hover:text-ui-fg-base underline"
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
      <span className="text-center text-ui-fg-base text-small-regular mt-6">
        {accountCopy.notMember}{" "}
        <button
          onClick={() => setCurrentView(LOGIN_VIEW.REGISTER)}
          className="underline"
          data-testid="register-button"
        >
          {accountCopy.join}
        </button>
        .
      </span>
    </div>
  )
}

export default Login
