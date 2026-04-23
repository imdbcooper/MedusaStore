import { HttpTypes } from "@medusajs/types"
import { Container } from "@medusajs/ui"
import { storefrontConfig } from "@lib/storefront-config"
import { ComparableAddress } from "@lib/util/compare-addresses"
import Checkbox from "@modules/common/components/checkbox"
import Input from "@modules/common/components/input"
import React, { useEffect, useMemo, useRef, useState } from "react"
import AddressSelect from "../address-select"
import CountrySelect from "../country-select"

type ShippingAddressFormData = {
  "shipping_address.first_name": string
  "shipping_address.last_name": string
  "shipping_address.address_1": string
  "shipping_address.company": string
  "shipping_address.postal_code": string
  "shipping_address.city": string
  "shipping_address.country_code": string
  "shipping_address.province": string
  "shipping_address.phone": string
  email: string
}

const buildShippingAddressFormData = (
  cart: HttpTypes.StoreCart | null
): ShippingAddressFormData => ({
  "shipping_address.first_name": cart?.shipping_address?.first_name || "",
  "shipping_address.last_name": cart?.shipping_address?.last_name || "",
  "shipping_address.address_1": cart?.shipping_address?.address_1 || "",
  "shipping_address.company": cart?.shipping_address?.company || "",
  "shipping_address.postal_code": cart?.shipping_address?.postal_code || "",
  "shipping_address.city": cart?.shipping_address?.city || "",
  "shipping_address.country_code": cart?.shipping_address?.country_code || "",
  "shipping_address.province": cart?.shipping_address?.province || "",
  "shipping_address.phone": cart?.shipping_address?.phone || "",
  email: cart?.email || "",
})

const ShippingAddress = ({
  customer,
  cart,
  checked,
  onChange,
}: {
  customer: HttpTypes.StoreCustomer | null
  cart: HttpTypes.StoreCart | null
  checked: boolean
  onChange: () => void
}) => {
  const [formData, setFormData] = useState<ShippingAddressFormData>(() =>
    buildShippingAddressFormData(cart)
  )
  const hasUserEditedEmailRef = useRef(false)
  const cartAddressFormData = useMemo(
    () => ({
      "shipping_address.first_name": cart?.shipping_address?.first_name || "",
      "shipping_address.last_name": cart?.shipping_address?.last_name || "",
      "shipping_address.address_1": cart?.shipping_address?.address_1 || "",
      "shipping_address.company": cart?.shipping_address?.company || "",
      "shipping_address.postal_code": cart?.shipping_address?.postal_code || "",
      "shipping_address.city": cart?.shipping_address?.city || "",
      "shipping_address.country_code": cart?.shipping_address?.country_code || "",
      "shipping_address.province": cart?.shipping_address?.province || "",
      "shipping_address.phone": cart?.shipping_address?.phone || "",
    }),
    [
      cart?.shipping_address?.first_name,
      cart?.shipping_address?.last_name,
      cart?.shipping_address?.address_1,
      cart?.shipping_address?.company,
      cart?.shipping_address?.postal_code,
      cart?.shipping_address?.city,
      cart?.shipping_address?.country_code,
      cart?.shipping_address?.province,
      cart?.shipping_address?.phone,
    ]
  )

  const countriesInRegion = useMemo(
    () => cart?.region?.countries?.map((c) => c.iso_2),
    [cart?.region]
  )

  const addressesInRegion = useMemo(
    () =>
      customer?.addresses.filter(
        (a) => a.country_code && countriesInRegion?.includes(a.country_code)
      ),
    [customer?.addresses, countriesInRegion]
  )

  const comparableAddressInput = useMemo<ComparableAddress>(
    () => ({
      first_name: formData["shipping_address.first_name"],
      last_name: formData["shipping_address.last_name"],
      address_1: formData["shipping_address.address_1"],
      company: formData["shipping_address.company"],
      postal_code: formData["shipping_address.postal_code"],
      city: formData["shipping_address.city"],
      country_code: formData["shipping_address.country_code"],
      province: formData["shipping_address.province"],
      phone: formData["shipping_address.phone"],
    }),
    [formData]
  )

  const setFormAddress = (
    address?: HttpTypes.StoreCartAddress,
    email?: string
  ) => {
    address &&
      setFormData((prevState) => ({
        ...prevState,
        "shipping_address.first_name": address?.first_name || "",
        "shipping_address.last_name": address?.last_name || "",
        "shipping_address.address_1": address?.address_1 || "",
        "shipping_address.company": address?.company || "",
        "shipping_address.postal_code": address?.postal_code || "",
        "shipping_address.city": address?.city || "",
        "shipping_address.country_code": address?.country_code || "",
        "shipping_address.province": address?.province || "",
        "shipping_address.phone": address?.phone || "",
      }))

    if (email) {
      hasUserEditedEmailRef.current = false
      setFormData((prevState) => ({
        ...prevState,
        email,
      }))
    }
  }

  useEffect(() => {
    setFormData((prevState) => {
      const nextState = cartAddressFormData
      const nextEmail = cart?.email || prevState.email

      if (
        prevState["shipping_address.first_name"] ===
          nextState["shipping_address.first_name"] &&
        prevState["shipping_address.last_name"] ===
          nextState["shipping_address.last_name"] &&
        prevState["shipping_address.address_1"] ===
          nextState["shipping_address.address_1"] &&
        prevState["shipping_address.company"] ===
          nextState["shipping_address.company"] &&
        prevState["shipping_address.postal_code"] ===
          nextState["shipping_address.postal_code"] &&
        prevState["shipping_address.city"] === nextState["shipping_address.city"] &&
        prevState["shipping_address.country_code"] ===
          nextState["shipping_address.country_code"] &&
        prevState["shipping_address.province"] ===
          nextState["shipping_address.province"] &&
        prevState["shipping_address.phone"] === nextState["shipping_address.phone"] &&
        prevState.email === nextEmail
      ) {
        return prevState
      }

      return {
        ...prevState,
        ...nextState,
        email: nextEmail,
      }
    })

    if (cart?.email) {
      hasUserEditedEmailRef.current = false
    }
  }, [cart?.email, cartAddressFormData])

  useEffect(() => {
    if (cart?.email || !customer?.email || hasUserEditedEmailRef.current) {
      return
    }

    setFormData((prevState) => {
      if (prevState.email) {
        return prevState
      }

      return {
        ...prevState,
        email: customer.email,
      }
    })
  }, [cart?.email, customer?.email])

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLInputElement | HTMLSelectElement
    >
  ) => {
    if (e.target.name === "email") {
      hasUserEditedEmailRef.current = true
    }

    setFormData((prevState) => ({
      ...prevState,
      [e.target.name]: e.target.value,
    }))
  }

  const checkoutCopy = storefrontConfig.copy.checkout

  return (
    <>
      {customer && (addressesInRegion?.length || 0) > 0 && (
        <Container className="mb-6 flex flex-col gap-y-4 p-5">
          <p className="text-small-regular">
            {customer.first_name
              ? `${customer.first_name}, использовать один из сохранённых адресов?`
              : "Использовать один из сохранённых адресов?"}
          </p>
          <AddressSelect
            addresses={customer.addresses}
            addressInput={comparableAddressInput}
            onSelect={setFormAddress}
          />
        </Container>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Имя"
          name="shipping_address.first_name"
          autoComplete="given-name"
          value={formData["shipping_address.first_name"]}
          onChange={handleChange}
          required
          data-testid="shipping-first-name-input"
        />
        <Input
          label="Фамилия"
          name="shipping_address.last_name"
          autoComplete="family-name"
          value={formData["shipping_address.last_name"]}
          onChange={handleChange}
          required
          data-testid="shipping-last-name-input"
        />
        <Input
          label="Адрес"
          name="shipping_address.address_1"
          autoComplete="address-line1"
          value={formData["shipping_address.address_1"]}
          onChange={handleChange}
          required
          data-testid="shipping-address-input"
        />
        <Input
          label="Компания"
          name="shipping_address.company"
          value={formData["shipping_address.company"]}
          onChange={handleChange}
          autoComplete="organization"
          data-testid="shipping-company-input"
        />
        <Input
          label="Почтовый индекс"
          name="shipping_address.postal_code"
          autoComplete="postal-code"
          value={formData["shipping_address.postal_code"]}
          onChange={handleChange}
          required
          data-testid="shipping-postal-code-input"
        />
        <Input
          label="Город"
          name="shipping_address.city"
          autoComplete="address-level2"
          value={formData["shipping_address.city"]}
          onChange={handleChange}
          required
          data-testid="shipping-city-input"
        />
        <CountrySelect
          name="shipping_address.country_code"
          autoComplete="country"
          region={cart?.region}
          value={formData["shipping_address.country_code"]}
          onChange={handleChange}
          required
          data-testid="shipping-country-select"
        />
        <Input
          label="Регион / область"
          name="shipping_address.province"
          autoComplete="address-level1"
          value={formData["shipping_address.province"]}
          onChange={handleChange}
          data-testid="shipping-province-input"
        />
      </div>
      <div className="my-8">
        <Checkbox
          label="Платёжный адрес совпадает с адресом доставки"
          name="same_as_billing"
          checked={checked}
          onChange={onChange}
          data-testid="billing-address-checkbox"
        />
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Input
          label="Email"
          name="email"
          type="email"
          title="Введите корректный email адрес."
          autoComplete="email"
          value={formData.email}
          onChange={handleChange}
          required
          data-testid="shipping-email-input"
        />
        <Input
          label="Телефон"
          name="shipping_address.phone"
          autoComplete="tel"
          value={formData["shipping_address.phone"]}
          onChange={handleChange}
          data-testid="shipping-phone-input"
        />
      </div>
    </>
  )
}

export default ShippingAddress
