import React from "react"

import UnderlineLink from "@modules/common/components/interactive-link"
import { storefrontConfig } from "@lib/storefront-config"

import AccountNav from "../components/account-nav"
import { HttpTypes } from "@medusajs/types"

interface AccountLayoutProps {
  customer: HttpTypes.StoreCustomer | null
  countryCode?: string | null
  children: React.ReactNode
}

const AccountLayout: React.FC<AccountLayoutProps> = ({
  customer,
  children,
}) => {
  return (
    <div
      className="flex-1 bg-ui-bg-subtle/40 small:py-12"
      data-testid="account-page"
    >
      <div className="flex-1 content-container mx-auto flex h-full max-w-6xl flex-col">
        {customer ? (
          <div className="grid grid-cols-1 gap-8 py-8 small:grid-cols-[240px_1fr] small:py-12">
            <aside>
              <AccountNav customer={customer} />
            </aside>
            <div className="flex-1 min-w-0">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm small:p-8">
                {children}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 small:py-12">{children}</div>
        )}

        <div className="flex flex-col items-start justify-between gap-6 border-t border-gray-200 py-10 small:flex-row small:items-end small:gap-8">
          <div>
            <h3 className="text-xl-semi mb-2">Остались вопросы?</h3>
            <p className="txt-medium text-ui-fg-subtle max-w-prose">
              Ответы на частые вопросы и контакты поддержки —
              на странице клиентского сервиса
              {storefrontConfig.storeName
                ? ` ${storefrontConfig.storeName}`
                : ""}
              .
            </p>
          </div>
          <div>
            <UnderlineLink href="/customer-service">
              Клиентский сервис
            </UnderlineLink>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AccountLayout
