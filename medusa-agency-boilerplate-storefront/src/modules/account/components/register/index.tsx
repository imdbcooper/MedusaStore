"use client"

import { signup } from "@lib/data/customer"
import { storefrontConfig } from "@lib/storefront-config"
import { useActionState } from "react"
import { LOGIN_VIEW } from "@modules/account/templates/login-template"
import Input from "@modules/common/components/input"
import ErrorMessage from "@modules/checkout/components/error-message"
import { SubmitButton } from "@modules/checkout/components/submit-button"

type Props = {
  setCurrentView: (view: LOGIN_VIEW) => void
}

const Register = ({ setCurrentView }: Props) => {
  const [message, formAction] = useActionState(signup, null)
  const accountCopy = storefrontConfig.copy.account

  return (
    <div className="w-full flex flex-col" data-testid="register-page">
      <div className="mb-6 flex flex-col gap-y-1 text-center">
        <h1 className="text-xl-semi">Создание аккаунта</h1>
        <p className="text-small-regular text-ui-fg-subtle">
          Сохраняйте данные, отслеживайте заказы и используйте профиль при
          оформлении в {storefrontConfig.storeName}.
        </p>
      </div>
      <form className="w-full flex flex-col" action={formAction}>
        <div className="flex flex-col w-full gap-y-2">
          <Input
            label="Имя"
            name="first_name"
            required
            autoComplete="given-name"
            data-testid="first-name-input"
          />
          <Input
            label="Фамилия"
            name="last_name"
            required
            autoComplete="family-name"
            data-testid="last-name-input"
          />
          <Input
            label="Email"
            name="email"
            required
            type="email"
            autoComplete="email"
            data-testid="email-input"
          />
          <Input
            label="Телефон"
            name="phone"
            type="tel"
            autoComplete="tel"
            data-testid="phone-input"
          />
          <Input
            label="Пароль"
            name="password"
            required
            type="password"
            autoComplete="new-password"
            data-testid="password-input"
          />
        </div>
        <ErrorMessage error={message} data-testid="register-error" />
        <p className="text-center text-ui-fg-subtle text-small-regular mt-4">
          Создавая аккаунт, вы соглашаетесь с политикой конфиденциальности и
          условиями использования {storefrontConfig.storeName}.
        </p>
        <SubmitButton className="w-full mt-6" data-testid="register-button">
          {accountCopy.join}
        </SubmitButton>
      </form>
      <p className="text-center text-ui-fg-subtle text-small-regular mt-6">
        Уже есть аккаунт?{" "}
        <button
          type="button"
          onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
          className="text-ui-fg-base font-semibold hover:underline underline-offset-4"
        >
          Войти
        </button>
      </p>
    </div>
  )
}

export default Register
