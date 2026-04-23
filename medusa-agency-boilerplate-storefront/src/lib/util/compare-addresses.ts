import { isEqual, pick } from "lodash"

type ComparableAddressField =
  | "first_name"
  | "last_name"
  | "address_1"
  | "company"
  | "postal_code"
  | "city"
  | "country_code"
  | "province"
  | "phone"

export type ComparableAddress =
  | Partial<Record<ComparableAddressField, string | null>>
  | null
  | undefined

export default function compareAddresses(
  address1: ComparableAddress,
  address2: ComparableAddress
) {
  return isEqual(
    pick(address1, [
      "first_name",
      "last_name",
      "address_1",
      "company",
      "postal_code",
      "city",
      "country_code",
      "province",
      "phone",
    ]),
    pick(address2, [
      "first_name",
      "last_name",
      "address_1",
      "company",
      "postal_code",
      "city",
      "country_code",
      "province",
      "phone",
    ])
  )
}
