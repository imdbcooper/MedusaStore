"use server"

import { cookies as nextCookies } from "next/headers"

export async function clearOnboardingState() {
  const cookies = await nextCookies()

  cookies.set("_medusa_onboarding", "false", { maxAge: -1 })
}
