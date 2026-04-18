import { Metadata } from "next"

import { getMetadataTitle, storefrontConfig } from "@lib/storefront-config"
import LoginTemplate from "@modules/account/templates/login-template"

export const metadata: Metadata = {
  title: getMetadataTitle("Вход"),
  description: `Вход в аккаунт ${storefrontConfig.storeName}.`,
}

export default function Login() {
  return <LoginTemplate />
}
