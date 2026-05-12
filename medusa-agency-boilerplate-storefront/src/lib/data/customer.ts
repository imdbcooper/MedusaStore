"use server"

import { sdk, MEDUSA_BACKEND_URL, STOREFRONT_BASE_URL } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  removeAuthToken,
  removeCartId,
  setAuthToken,
} from "./cookies"

export const retrieveCustomer =
  async (): Promise<HttpTypes.StoreCustomer | null> => {
    const authHeaders = await getAuthHeaders()

    if (!authHeaders) return null

    const headers = {
      ...authHeaders,
    }

    const next = {
      ...(await getCacheOptions("customers")),
    }

    return await sdk.client
      .fetch<{ customer: HttpTypes.StoreCustomer }>(`/store/customers/me`, {
        method: "GET",
        query: {
          fields: "*orders",
        },
        headers,
        next,
        cache: "force-cache",
      })
      .then(({ customer }) => customer)
      .catch(() => null)
  }

export const updateCustomer = async (body: HttpTypes.StoreUpdateCustomer) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const updateRes = await sdk.store.customer
    .update(body, {}, headers)
    .then(({ customer }) => customer)
    .catch(medusaError)

  const cacheTag = await getCacheTag("customers")
  revalidateTag(cacheTag)

  return updateRes
}

export async function signup(_currentState: unknown, formData: FormData) {
  const password = formData.get("password") as string
  const customerForm = {
    email: formData.get("email") as string,
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    phone: formData.get("phone") as string,
  }

  try {
    const token = await sdk.auth.register("customer", "emailpass", {
      email: customerForm.email,
      password: password,
    })

    await setAuthToken(token as string)

    const headers = {
      ...(await getAuthHeaders()),
    }

    const { customer: createdCustomer } = await sdk.store.customer.create(
      customerForm,
      {},
      headers
    )

    const loginToken = await sdk.auth.login("customer", "emailpass", {
      email: customerForm.email,
      password,
    })

    await setAuthToken(loginToken as string)

    const customerCacheTag = await getCacheTag("customers")
    revalidateTag(customerCacheTag)

    await transferCart()

    return createdCustomer
  } catch (error: any) {
    return error.toString()
  }
}

export async function login(_currentState: unknown, formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  try {
    await sdk.auth
      .login("customer", "emailpass", { email, password })
      .then(async (token) => {
        await setAuthToken(token as string)
        const customerCacheTag = await getCacheTag("customers")
        revalidateTag(customerCacheTag)
      })
  } catch (error: any) {
    return error.toString()
  }

  try {
    await transferCart()
  } catch (error: any) {
    return error.toString()
  }
}

export async function signout(countryCode: string) {
  await sdk.auth.logout()

  await removeAuthToken()

  const customerCacheTag = await getCacheTag("customers")
  revalidateTag(customerCacheTag)

  await removeCartId()

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)

  redirect(`/${countryCode}/account`)
}

export async function transferCart() {
  const cartId = await getCartId()

  if (!cartId) {
    return
  }

  const headers = await getAuthHeaders()

  await sdk.store.cart.transferCart(cartId, {}, headers)

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)
}

export const addCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData
): Promise<any> => {
  const isDefaultBilling = (currentState.isDefaultBilling as boolean) || false
  const isDefaultShipping = (currentState.isDefaultShipping as boolean) || false

  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
    phone: formData.get("phone") as string,
    is_default_billing: isDefaultBilling,
    is_default_shipping: isDefaultShipping,
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.customer
    .createAddress(address, {}, headers)
    .then(async ({ customer }) => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export const deleteCustomerAddress = async (
  addressId: string
): Promise<void> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.customer
    .deleteAddress(addressId, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export const updateCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData
): Promise<any> => {
  const addressId =
    (currentState.addressId as string) || (formData.get("addressId") as string)

  if (!addressId) {
    return { success: false, error: "Address ID is required" }
  }

  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
  } as HttpTypes.StoreUpdateCustomerAddress

  const phone = formData.get("phone") as string

  if (phone) {
    address.phone = phone
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.customer
    .updateAddress(addressId, address, {}, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

function hasAuthorizationHeader(
  headers: Awaited<ReturnType<typeof getAuthHeaders>>
): headers is { authorization: string } {
  return typeof (headers as { authorization?: string }).authorization === "string"
}

function buildVkIdProfileUrl(countryCode: string, result?: string, reason?: string) {
  const url = new URL(`/${countryCode}/account/profile`, STOREFRONT_BASE_URL)

  if (result) {
    url.searchParams.set("vk_id_result", result)
  }

  if (reason) {
    url.searchParams.set("vk_id_reason", reason)
  }

  return url.toString()
}

async function parseVkIdResponse(response: Response) {
  const text = await response.text()

  if (!text) {
    return {}
  }

  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return { message: text }
  }
}

export async function startVkIdLink(countryCode: string) {
  const authHeaders = await getAuthHeaders()

  if (!hasAuthorizationHeader(authHeaders)) {
    redirect(buildVkIdProfileUrl(countryCode, "failed", "customer_auth_required"))
  }

  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/customers/me/vk-id/start`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: authHeaders.authorization,
    },
    body: JSON.stringify({
      return_url: buildVkIdProfileUrl(countryCode),
      link_source: "storefront.account.profile",
    }),
    cache: "no-store",
  })

  const payload = await parseVkIdResponse(response)

  if (!response.ok || typeof payload.authorize_url !== "string") {
    const reason =
      (typeof payload.code === "string" && payload.code) || "vk_id_start_failed"

    redirect(buildVkIdProfileUrl(countryCode, "failed", reason))
  }

  redirect(payload.authorize_url)
}

export async function unlinkVkId(countryCode: string) {
  const authHeaders = await getAuthHeaders()

  if (!hasAuthorizationHeader(authHeaders)) {
    redirect(buildVkIdProfileUrl(countryCode, "failed", "customer_auth_required"))
  }

  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/customers/me/vk-id/unlink`, {
    method: "POST",
    headers: {
      authorization: authHeaders.authorization,
    },
    cache: "no-store",
  })

  const payload = await parseVkIdResponse(response)

  if (!response.ok) {
    const reason =
      (typeof payload.code === "string" && payload.code) || "vk_id_unlink_failed"

    redirect(buildVkIdProfileUrl(countryCode, "failed", reason))
  }

  redirect(buildVkIdProfileUrl(countryCode, "unlinked"))
}

function buildStorePublishableHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  }

  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

  if (publishableKey) {
    headers["x-publishable-api-key"] = publishableKey
  }

  return headers
}

export type RequestEmailVerificationResult = {
  ok: boolean
  code?: string
  expires_at?: string | null
  token_ttl_minutes?: number
}

export async function requestEmailVerification(options?: {
  countryCode?: string | null
  reason?: string | null
}): Promise<RequestEmailVerificationResult> {
  const authHeaders = await getAuthHeaders()

  if (!hasAuthorizationHeader(authHeaders)) {
    return { ok: false, code: "customer_auth_required" }
  }

  const response = await fetch(
    `${MEDUSA_BACKEND_URL}/store/customers/me/request-email-verification`,
    {
      method: "POST",
      headers: {
        ...buildStorePublishableHeaders(),
        authorization: authHeaders.authorization,
      },
      body: JSON.stringify({
        country_code: options?.countryCode || null,
        reason: options?.reason || "resend",
      }),
      cache: "no-store",
    }
  )

  let payload: Record<string, unknown> = {}

  try {
    const text = await response.text()

    if (text) {
      payload = JSON.parse(text) as Record<string, unknown>
    }
  } catch {
    payload = {}
  }

  if (!response.ok) {
    return {
      ok: false,
      code:
        (typeof payload.code === "string" && payload.code) ||
        "email_verification_request_failed",
    }
  }

  return {
    ok: true,
    expires_at:
      typeof payload.expires_at === "string" ? payload.expires_at : null,
    token_ttl_minutes:
      typeof payload.token_ttl_minutes === "number"
        ? payload.token_ttl_minutes
        : undefined,
  }
}

export type VerifyEmailResult = {
  ok: boolean
  code?: string
  status?: "verified" | "already_verified"
  customer_id?: string
  email?: string
}

export async function verifyEmail(token: string): Promise<VerifyEmailResult> {
  if (!token?.trim()) {
    return { ok: false, code: "invalid_token_format" }
  }

  const response = await fetch(
    `${MEDUSA_BACKEND_URL}/store/customers/verify-email`,
    {
      method: "POST",
      headers: buildStorePublishableHeaders(),
      body: JSON.stringify({ token: token.trim() }),
      cache: "no-store",
    }
  )

  let payload: Record<string, unknown> = {}

  try {
    const text = await response.text()

    if (text) {
      payload = JSON.parse(text) as Record<string, unknown>
    }
  } catch {
    payload = {}
  }

  if (!response.ok) {
    return {
      ok: false,
      code:
        (typeof payload.code === "string" && payload.code) ||
        "email_verification_failed",
    }
  }

  try {
    const customerCacheTag = await getCacheTag("customers")
    revalidateTag(customerCacheTag)
  } catch {
    // best-effort cache invalidation after verification
  }

  return {
    ok: true,
    status:
      typeof payload.status === "string" &&
      (payload.status === "verified" || payload.status === "already_verified")
        ? (payload.status as "verified" | "already_verified")
        : "verified",
    customer_id:
      typeof payload.customer_id === "string" ? payload.customer_id : undefined,
    email: typeof payload.email === "string" ? payload.email : undefined,
  }
}

export type RequestPasswordResetResult = {
  ok: boolean
  code?: string
}

/**
 * Request a password reset email. Always returns `{ ok: true }` for public
 * requests to avoid user enumeration; only transport-level failures surface
 * as `ok: false`.
 */
export async function requestPasswordReset(options: {
  email: string
  countryCode?: string | null
}): Promise<RequestPasswordResetResult> {
  const email = options.email?.trim()

  if (!email) {
    return { ok: false, code: "invalid_email" }
  }

  try {
    const response = await fetch(
      `${MEDUSA_BACKEND_URL}/store/customers/forgot-password`,
      {
        method: "POST",
        headers: buildStorePublishableHeaders(),
        body: JSON.stringify({
          email,
          country_code: options.countryCode || null,
          reason: "forgot_password",
        }),
        cache: "no-store",
      }
    )

    if (!response.ok) {
      return { ok: false, code: "password_reset_request_failed" }
    }

    return { ok: true }
  } catch {
    return { ok: false, code: "password_reset_request_failed" }
  }
}

export type ApplyPasswordResetResult = {
  ok: boolean
  code?: string
  detail?: string
  customer_id?: string
}

export async function applyPasswordReset(options: {
  token: string
  newPassword: string
}): Promise<ApplyPasswordResetResult> {
  const token = options.token?.trim()

  if (!token) {
    return { ok: false, code: "invalid_or_expired_token" }
  }

  const newPassword = options.newPassword ?? ""

  try {
    const response = await fetch(
      `${MEDUSA_BACKEND_URL}/store/customers/reset-password`,
      {
        method: "POST",
        headers: buildStorePublishableHeaders(),
        body: JSON.stringify({
          token,
          new_password: newPassword,
        }),
        cache: "no-store",
      }
    )

    let payload: Record<string, unknown> = {}

    try {
      const text = await response.text()

      if (text) {
        payload = JSON.parse(text) as Record<string, unknown>
      }
    } catch {
      payload = {}
    }

    if (!response.ok) {
      return {
        ok: false,
        code:
          (typeof payload.code === "string" && payload.code) ||
          "invalid_or_expired_token",
        detail:
          typeof payload.detail === "string" ? payload.detail : undefined,
      }
    }

    return {
      ok: true,
      customer_id:
        typeof payload.customer_id === "string"
          ? payload.customer_id
          : undefined,
    }
  } catch {
    return { ok: false, code: "invalid_or_expired_token" }
  }
}

export type UpdateCustomerPasswordResult = {
  ok: boolean
  code?: string
  detail?: string
}

export async function updateCustomerPassword(options: {
  currentPassword: string
  newPassword: string
}): Promise<UpdateCustomerPasswordResult> {
  const authHeaders = await getAuthHeaders()

  if (!hasAuthorizationHeader(authHeaders)) {
    return { ok: false, code: "customer_auth_required" }
  }

  try {
    const response = await fetch(
      `${MEDUSA_BACKEND_URL}/store/customers/me/password`,
      {
        method: "POST",
        headers: {
          ...buildStorePublishableHeaders(),
          authorization: authHeaders.authorization,
        },
        body: JSON.stringify({
          current_password: options.currentPassword ?? "",
          new_password: options.newPassword ?? "",
        }),
        cache: "no-store",
      }
    )

    let payload: Record<string, unknown> = {}

    try {
      const text = await response.text()

      if (text) {
        payload = JSON.parse(text) as Record<string, unknown>
      }
    } catch {
      payload = {}
    }

    if (!response.ok) {
      return {
        ok: false,
        code:
          (typeof payload.code === "string" && payload.code) ||
          "password_update_failed",
        detail:
          typeof payload.detail === "string" ? payload.detail : undefined,
      }
    }

    try {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
    } catch {
      // best-effort cache invalidation
    }

    return { ok: true }
  } catch {
    return { ok: false, code: "password_update_failed" }
  }
}

export type MarketingChannelId = "email" | "sms" | "vk"

export type ConfirmMarketingSubscriptionResult = {
  ok: boolean
  code?: string
  customer_id?: string
  channel?: MarketingChannelId
}

export async function confirmMarketingSubscription(
  token: string
): Promise<ConfirmMarketingSubscriptionResult> {
  if (!token?.trim()) {
    return { ok: false, code: "invalid_or_expired_token" }
  }

  try {
    const response = await fetch(
      `${MEDUSA_BACKEND_URL}/store/customers/marketing/confirm`,
      {
        method: "POST",
        headers: buildStorePublishableHeaders(),
        body: JSON.stringify({ token: token.trim() }),
        cache: "no-store",
      }
    )

    let payload: Record<string, unknown> = {}

    try {
      const text = await response.text()

      if (text) {
        payload = JSON.parse(text) as Record<string, unknown>
      }
    } catch {
      payload = {}
    }

    if (!response.ok) {
      return {
        ok: false,
        code:
          (typeof payload.code === "string" && payload.code) ||
          "invalid_or_expired_token",
      }
    }

    try {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
    } catch {
      // best-effort cache invalidation after confirmation
    }

    return {
      ok: true,
      customer_id:
        typeof payload.customer_id === "string"
          ? payload.customer_id
          : undefined,
      channel:
        typeof payload.channel === "string"
          ? (payload.channel as MarketingChannelId)
          : undefined,
    }
  } catch {
    return { ok: false, code: "invalid_or_expired_token" }
  }
}

export type UnsubscribeFromMarketingResult = {
  ok: boolean
}

export async function unsubscribeFromMarketing(options: {
  token: string
  channels?: MarketingChannelId[] | null
}): Promise<UnsubscribeFromMarketingResult> {
  const token = options.token?.trim()

  if (!token) {
    // Endpoint is idempotent; still return ok:true so the page
    // shows a generic success message.
    return { ok: true }
  }

  const body: Record<string, unknown> = { token }

  if (
    Array.isArray(options.channels) &&
    options.channels.length &&
    options.channels.every(
      (channel) =>
        typeof channel === "string" &&
        ["email", "sms", "vk"].includes(channel)
    )
  ) {
    body.channels = options.channels
  }

  try {
    await fetch(
      `${MEDUSA_BACKEND_URL}/store/customers/marketing/unsubscribe`,
      {
        method: "POST",
        headers: buildStorePublishableHeaders(),
        body: JSON.stringify(body),
        cache: "no-store",
      }
    )
  } catch {
    // Always succeed from the UI perspective; backend logs failures.
  }

  try {
    const customerCacheTag = await getCacheTag("customers")
    revalidateTag(customerCacheTag)
  } catch {
    // best-effort cache invalidation
  }

  return { ok: true }
}
