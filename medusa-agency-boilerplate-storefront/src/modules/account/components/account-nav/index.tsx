"use client"

import { clx } from "@medusajs/ui"
import { ArrowRightOnRectangle } from "@medusajs/icons"
import { useParams, usePathname } from "next/navigation"

import { storefrontConfig } from "@lib/storefront-config"
import ChevronDown from "@modules/common/icons/chevron-down"
import User from "@modules/common/icons/user"
import MapPin from "@modules/common/icons/map-pin"
import Package from "@modules/common/icons/package"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HttpTypes } from "@medusajs/types"
import { signout } from "@lib/data/customer"
import { IconProps } from "types/icon"

const HomeIcon: React.FC<IconProps> = ({
  size = 18,
  color = "currentColor",
  ...attributes
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...attributes}
  >
    <path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2h-4a1 1 0 0 1-1-1v-5h-4v5a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2Z" />
  </svg>
)

// Phase 2 / step 5 — sidebar entry «Мои отзывы». Inline like HomeIcon to
// avoid pulling in another icons file for a single use.
const ReviewsIcon: React.FC<IconProps> = ({
  size = 18,
  color = "currentColor",
  ...attributes
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...attributes}
  >
    <path d="M12 2.25l2.92 6.18 6.83.79-5.05 4.66 1.39 6.62L12 17.27l-6.09 3.23 1.39-6.62L2.25 9.22l6.83-.79L12 2.25z" />
  </svg>
)

const AccountNav = ({
  customer,
}: {
  customer: HttpTypes.StoreCustomer | null
}) => {
  const route = usePathname()
  const { countryCode } = useParams() as { countryCode: string }
  const accountCopy = storefrontConfig.copy.account

  const handleLogout = async () => {
    await signout(countryCode)
  }

  const groups: Array<{
    label: string
    items: Array<{
      href: string
      label: string
      icon: React.FC<IconProps>
      testId: string
    }>
  }> = [
    {
      label: accountCopy.overview,
      items: [
        {
          href: "/account",
          label: accountCopy.overview,
          icon: HomeIcon,
          testId: "overview-link",
        },
      ],
    },
    {
      label: "Профиль",
      items: [
        {
          href: "/account/profile",
          label: accountCopy.profile,
          icon: User,
          testId: "profile-link",
        },
        {
          href: "/account/addresses",
          label: accountCopy.addresses,
          icon: MapPin,
          testId: "addresses-link",
        },
      ],
    },
    {
      label: accountCopy.orders,
      items: [
        {
          href: "/account/orders",
          label: accountCopy.orders,
          icon: Package,
          testId: "orders-link",
        },
      ],
    },
    {
      label: accountCopy.reviews,
      items: [
        {
          href: "/account/reviews",
          label: accountCopy.reviews,
          icon: ReviewsIcon,
          testId: "reviews-link",
        },
      ],
    },
  ]

  return (
    <div>
      {/* Mobile */}
      <div className="small:hidden" data-testid="mobile-account-nav">
        {route !== `/${countryCode}/account` ? (
          <LocalizedClientLink
            href="/account"
            className="flex items-center gap-x-2 text-small-regular py-2"
            data-testid="account-main-link"
          >
            <>
              <ChevronDown className="transform rotate-90" />
              <span>{accountCopy.title}</span>
            </>
          </LocalizedClientLink>
        ) : (
          <>
            <div className="text-xl-semi mb-4 px-8">
              {accountCopy.hello}
              {customer?.first_name ? `, ${customer.first_name}` : ""}
            </div>
            <div className="text-base-regular">
              <ul>
                {groups
                  .flatMap((group) => group.items)
                  .filter((item) => item.href !== "/account")
                  .map((item) => {
                    const Icon = item.icon
                    return (
                      <li key={item.href}>
                        <LocalizedClientLink
                          href={item.href}
                          className="flex items-center justify-between py-4 border-b border-gray-200 px-8 transition-colors hover:bg-gray-50"
                          data-testid={item.testId}
                        >
                          <>
                            <div className="flex items-center gap-x-2">
                              <Icon size={20} />
                              <span>{item.label}</span>
                            </div>
                            <ChevronDown className="transform -rotate-90" />
                          </>
                        </LocalizedClientLink>
                      </li>
                    )
                  })}
                <li>
                  <button
                    type="button"
                    className="flex items-center justify-between py-4 border-b border-gray-200 px-8 w-full transition-colors hover:bg-gray-50"
                    onClick={handleLogout}
                    data-testid="logout-button"
                  >
                    <div className="flex items-center gap-x-2">
                      <ArrowRightOnRectangle />
                      <span>{accountCopy.logOut}</span>
                    </div>
                    <ChevronDown className="transform -rotate-90" />
                  </button>
                </li>
              </ul>
            </div>
          </>
        )}
      </div>

      {/* Desktop */}
      <div
        className="hidden small:block sticky top-24"
        data-testid="account-nav"
      >
        <div className="pb-4 mb-4 border-b border-gray-200">
          <p className="text-[11px] uppercase tracking-[0.08em] text-ui-fg-muted mb-1">
            {accountCopy.signedInAs}
          </p>
          <h3 className="text-base-semi truncate" title={customer?.email || undefined}>
            {customer?.first_name
              ? `${customer.first_name}${customer.last_name ? ` ${customer.last_name}` : ""}`
              : customer?.email || accountCopy.title}
          </h3>
        </div>

        <nav aria-label={accountCopy.title}>
          <ul className="flex flex-col gap-y-6">
            {groups.map((group, groupIdx) => (
              <li key={`${group.label}-${groupIdx}`}>
                <ul className="flex flex-col gap-y-1">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <AccountNavLink
                        href={item.href}
                        route={route!}
                        icon={item.icon}
                        data-testid={item.testId}
                      >
                        {item.label}
                      </AccountNavLink>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            <li className="pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-x-3 px-3 py-2 w-full rounded-md text-ui-fg-subtle hover:text-ui-fg-base hover:bg-gray-50 transition-colors text-left"
                data-testid="logout-button"
              >
                <span className="flex-shrink-0">
                  <ArrowRightOnRectangle />
                </span>
                <span>{accountCopy.logOut}</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}

type AccountNavLinkProps = {
  href: string
  route: string
  children: React.ReactNode
  icon: React.FC<IconProps>
  "data-testid"?: string
}

const AccountNavLink = ({
  href,
  route,
  children,
  icon: Icon,
  "data-testid": dataTestId,
}: AccountNavLinkProps) => {
  const { countryCode }: { countryCode: string } = useParams()

  const active = route.split(countryCode)[1] === href

  return (
    <LocalizedClientLink
      href={href}
      className={clx(
        "flex items-center gap-x-3 px-3 py-2 rounded-md border-l-2 transition-colors",
        active
          ? "border-emerald-500 bg-emerald-50 text-ui-fg-base font-semibold"
          : "border-transparent text-ui-fg-subtle hover:text-ui-fg-base hover:bg-gray-50"
      )}
      aria-current={active ? "page" : undefined}
      data-testid={dataTestId}
    >
      <span
        className={clx(
          "flex-shrink-0 transition-colors",
          active ? "text-emerald-600" : "text-ui-fg-muted"
        )}
      >
        <Icon size={18} />
      </span>
      <span>{children}</span>
    </LocalizedClientLink>
  )
}

export default AccountNav
