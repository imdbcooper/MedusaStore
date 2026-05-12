import React from "react"

import AddAddress from "../address-card/add-address"
import EditAddress from "../address-card/edit-address-modal"
import { HttpTypes } from "@medusajs/types"

type AddressBookProps = {
  customer: HttpTypes.StoreCustomer
  region: HttpTypes.StoreRegion
}

const AddressBook: React.FC<AddressBookProps> = ({ customer, region }) => {
  const { addresses } = customer
  const hasAddresses = Array.isArray(addresses) && addresses.length > 0

  return (
    <div className="w-full" data-testid="address-book">
      {!hasAddresses ? (
        <p className="mb-4 text-small-regular text-ui-fg-subtle">
          У вас пока нет сохранённых адресов. Добавьте первый адрес —
          он будет предложен при оформлении заказа.
        </p>
      ) : null}
      <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AddAddress region={region} addresses={addresses} />
        {addresses.map((address) => (
          <EditAddress region={region} address={address} key={address.id} />
        ))}
      </div>
    </div>
  )
}

export default AddressBook
