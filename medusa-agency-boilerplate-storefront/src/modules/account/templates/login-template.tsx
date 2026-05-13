"use client"

import { useState } from "react"

import Register from "@modules/account/components/register"
import Login from "@modules/account/components/login"

export enum LOGIN_VIEW {
  SIGN_IN = "sign-in",
  REGISTER = "register",
}

type LoginTemplateProps = {
  countryCode?: string | null
  vkLoginError?: string | null
  vkRegistered?: string | null
}

const LoginTemplate = ({
  countryCode,
  vkLoginError,
  vkRegistered,
}: LoginTemplateProps = {}) => {
  const [currentView, setCurrentView] = useState<LOGIN_VIEW>(LOGIN_VIEW.SIGN_IN)

  return (
    <div className="flex w-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm small:p-8">
        <div className="mb-6 inline-flex w-full rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setCurrentView(LOGIN_VIEW.SIGN_IN)}
            className={
              "flex-1 rounded-md px-3 py-2 text-small-semi transition-all " +
              (currentView === LOGIN_VIEW.SIGN_IN
                ? "bg-white text-ui-fg-base shadow-sm"
                : "text-ui-fg-subtle hover:text-ui-fg-base")
            }
            data-testid="toggle-sign-in"
            aria-pressed={currentView === LOGIN_VIEW.SIGN_IN}
          >
            Вход
          </button>
          <button
            type="button"
            onClick={() => setCurrentView(LOGIN_VIEW.REGISTER)}
            className={
              "flex-1 rounded-md px-3 py-2 text-small-semi transition-all " +
              (currentView === LOGIN_VIEW.REGISTER
                ? "bg-white text-ui-fg-base shadow-sm"
                : "text-ui-fg-subtle hover:text-ui-fg-base")
            }
            data-testid="toggle-register"
            aria-pressed={currentView === LOGIN_VIEW.REGISTER}
          >
            Регистрация
          </button>
        </div>

        {currentView === LOGIN_VIEW.SIGN_IN ? (
          <Login
            setCurrentView={setCurrentView}
            countryCode={countryCode || null}
            vkLoginError={vkLoginError || null}
            vkRegistered={vkRegistered || null}
          />
        ) : (
          <Register
            setCurrentView={setCurrentView}
            countryCode={countryCode || null}
          />
        )}
      </div>
    </div>
  )
}

export default LoginTemplate
