"use client"

import React, { useEffect, useActionState } from "react";

import Input from "@modules/common/components/input"

import AccountInfo from "../account-info"
import { HttpTypes } from "@medusajs/types"
// import { updateCustomer } from "@lib/data/customer"

type ProfileEmailState = {
  success: boolean
  error: string | null
}

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer
}

const ProfileEmail: React.FC<MyInformationProps> = ({ customer }) => {
  const [successState, setSuccessState] = React.useState(false)

  // TODO: It seems we don't support updating emails now?
  const updateCustomerEmail = (
    currentState: ProfileEmailState,
    formData: FormData
  ) => {
    const email = formData.get("email") as string

    if (!email || email === customer.email) {
      return currentState
    }

    try {
      // await updateCustomer(customer)
      return { success: true, error: null }
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.toString() : String(error),
      }
    }
  }

  const [state, formAction] = useActionState(updateCustomerEmail, {
    error: null,
    success: false,
  })

  const clearState = () => {
    setSuccessState(false)
  }

  useEffect(() => {
    setSuccessState(state.success)
  }, [state])

  return (
    <form action={formAction} className="w-full">
      <AccountInfo
        label="Email"
        currentInfo={`${customer.email}`}
        isSuccess={successState}
        isError={!!state.error}
        errorMessage={state.error ?? undefined}
        clearState={clearState}
        data-testid="account-email-editor"
      >
        <div className="grid grid-cols-1 gap-y-2">
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={customer.email}
            data-testid="email-input"
          />
        </div>
      </AccountInfo>
    </form>
  )
}

export default ProfileEmail
