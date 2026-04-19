import {
  getStorefrontThemeStyle,
  storefrontClientConfig,
  storefrontPresetName,
} from "@lib/storefront-client-config"
import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import "styles/globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default function RootLayout(props: { children: React.ReactNode }) {
  const { shell } = storefrontClientConfig

  return (
    <html
      lang="ru"
      data-mode="light"
      data-storefront-preset={storefrontPresetName}
      data-nav-variant={shell.nav.variant}
      data-nav-tone={shell.nav.tone}
      data-side-menu-variant={shell.sideMenu.variant}
      data-side-menu-tone={shell.sideMenu.tone}
      data-footer-variant={shell.footer.variant}
      data-footer-tone={shell.footer.tone}
    >
      <body
        style={getStorefrontThemeStyle()}
        className="bg-[var(--theme-canvas)] text-[var(--theme-foreground)]"
      >
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
