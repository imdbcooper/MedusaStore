import { Metadata } from "next"

import Overview from "@modules/account/components/overview"
import LoginTemplate from "@modules/account/templates/login-template"
import { retrieveCustomer } from "@lib/data/customer"
import { listOrders } from "@lib/data/orders"
import { getMetadataTitle, storefrontConfig } from "@lib/storefront-config"

type AccountPageProps = {
  params?: Promise<{ countryCode: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function readSearchParam(
  value: string | string[] | undefined
): string | null {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : null
  }

  return typeof value === "string" ? value : null
}

export async function generateMetadata(): Promise<Metadata> {
  const customer = await retrieveCustomer().catch(() => null)

  if (customer) {
    return {
      title: getMetadataTitle(storefrontConfig.copy.account.title),
      description: storefrontConfig.copy.account.dashboardDescription,
    }
  }

  return {
    title: getMetadataTitle("Вход"),
    description: `Вход в аккаунт ${storefrontConfig.storeName}.`,
  }
}

export default async function AccountPage(props: AccountPageProps) {
  const customer = await retrieveCustomer().catch(() => null)
  const params = props.params ? await props.params : undefined
  const searchParams = props.searchParams ? await props.searchParams : {}

  if (!customer) {
    const vkLoginError = readSearchParam(searchParams.vk_login_error)
    const vkRegistered = readSearchParam(searchParams.vk_registered)
    const countryCode = params?.countryCode || null

    return (
      <LoginTemplate
        countryCode={countryCode}
        vkLoginError={vkLoginError}
        vkRegistered={vkRegistered}
      />
    )
  }

  const orders = (await listOrders().catch(() => null)) || null
  const passwordResetStatus = readSearchParam(searchParams.password_reset)
  const vkRegistered = readSearchParam(searchParams.vk_registered)
  const countryCode = params?.countryCode || null

  return (
    <div className="flex w-full flex-col gap-y-4">
      {passwordResetStatus === "success" ? (
        <div
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          role="status"
          data-testid="password-reset-success-banner"
        >
          Пароль успешно обновлён.
        </div>
      ) : null}
      {vkRegistered === "success" ? (
        <div
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          role="status"
          data-testid="vk-registered-success-banner"
        >
          Аккаунт создан через ВКонтакте. Добро пожаловать! Чтобы задать пароль
          для входа без VK, воспользуйтесь ссылкой «Забыли пароль?».
        </div>
      ) : null}
      <Overview
        customer={customer}
        orders={orders || null}
        countryCode={countryCode}
      />
    </div>
  )
}
