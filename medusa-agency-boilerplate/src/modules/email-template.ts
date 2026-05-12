/**
 * Shared email template engine.
 *
 * Renders a branded HTML + plain-text body that is safe across major
 * email clients (Gmail, Yandex, Mail.ru, Outlook-like). It is intentionally
 * minimal: inline CSS, table-based layout, no external stylesheets, no JS.
 *
 * Security: every dynamic value rendered into HTML passes through
 * `escapeHtml`, so customer name, email, links, order numbers are safe
 * even when they contain `<script>`, `"`, `'`, `&` etc.
 */

export type EmailTemplateAction = {
  label: string
  url: string
}

export type EmailTemplateSection = {
  subheading?: string
  paragraphs: string[]
}

export type EmailTemplateBody = string[] | EmailTemplateSection[]

export type EmailTemplateInput = {
  preheader: string
  heading: string
  intro: string | string[]
  action?: EmailTemplateAction | null
  body?: EmailTemplateBody | null
  footer?: string | null
  footerAppend?: EmailTemplateFooterAppend | null
}

/**
 * Optional per-recipient/per-campaign footer appendix that is rendered
 * after the standard brand footer. Only safe http(s) URLs are allowed;
 * `url` is validated with the same guard used for action buttons.
 */
export type EmailTemplateFooterAppend = {
  text: string
  html?: string | null
  url?: string | null
  linkLabel?: string | null
}

export type BrandEmailConfig = {
  brandName: string
  logoUrl: string | null
  primaryColor: string
  accentColor: string
  textColor: string
  backgroundColor: string
  footerHtml: string | null
  storefrontUrl: string | null
}

export type RenderedEmail = {
  html: string
  text: string
}

/**
 * Defaults have been picked to be safe and legible on both light
 * and dark backgrounds.
 */
export const DEFAULT_BRAND_NAME = "SLAVX Studio"
export const DEFAULT_BRAND_PRIMARY_COLOR = "#111827"
export const DEFAULT_BRAND_ACCENT_COLOR = "#10b981"
export const DEFAULT_BRAND_TEXT_COLOR = "#111827"
export const DEFAULT_BRAND_BACKGROUND_COLOR = "#f9fafb"

const PLAIN_TEXT_WRAP_WIDTH = 78
const MAX_ENV_STRING_LENGTH = 512
const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/**
 * HTML-escape a value so it is safe to embed in any HTML context.
 * Exported so other modules can re-use the exact same escaping.
 */
export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function sanitizeEnvString(
  value: string | null | undefined,
  options?: { maxLength?: number }
): string | null {
  if (typeof value !== "string") {
    return null
  }

  const withoutNewlines = value.replace(/[\r\n\t]+/g, " ").trim()

  if (!withoutNewlines) {
    return null
  }

  const maxLength = options?.maxLength ?? MAX_ENV_STRING_LENGTH

  return withoutNewlines.slice(0, maxLength)
}

function sanitizeHexColor(
  value: string | null | undefined,
  fallback: string
): string {
  const cleaned = sanitizeEnvString(value, { maxLength: 16 })

  if (!cleaned) {
    return fallback
  }

  return HEX_COLOR_REGEX.test(cleaned) ? cleaned : fallback
}

function sanitizeHttpUrl(value: string | null | undefined): string | null {
  const cleaned = sanitizeEnvString(value, { maxLength: 2048 })

  if (!cleaned) {
    return null
  }

  try {
    const url = new URL(cleaned)

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null
    }

    return url.toString()
  } catch {
    return null
  }
}

function sanitizeFooterHtml(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  // Drop anything that could execute JS, load remote scripts/styles,
  // rebase URLs, or embed arbitrary plugin/object payloads.
  // Keep basic formatting tags.
  return trimmed
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?<\/embed>/gi, "")
    // Self-closing / void variants of the same dangerous tags.
    .replace(/<script\b[^>]*\/?>/gi, "")
    .replace(/<style\b[^>]*\/?>/gi, "")
    .replace(/<iframe\b[^>]*\/?>/gi, "")
    .replace(/<object\b[^>]*\/?>/gi, "")
    .replace(/<embed\b[^>]*\/?>/gi, "")
    .replace(/<base\b[^>]*\/?>/gi, "")
    .replace(/<link\b[^>]*\/?>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/vbscript:/gi, "")
    .replace(/data:/gi, "")
    .slice(0, 4096)
}

/**
 * Read brand configuration from process.env with safe defaults.
 * All returned values are sanitized (trimmed, newline-stripped,
 * length-limited) and never throw.
 */
export function getBrandEmailConfig(
  env: NodeJS.ProcessEnv = process.env
): BrandEmailConfig {
  const brandName =
    sanitizeEnvString(env.BRAND_NAME, { maxLength: 120 }) || DEFAULT_BRAND_NAME
  const logoUrl = sanitizeHttpUrl(env.BRAND_LOGO_URL)
  const primaryColor = sanitizeHexColor(
    env.BRAND_PRIMARY_COLOR,
    DEFAULT_BRAND_PRIMARY_COLOR
  )
  const accentColor = sanitizeHexColor(
    env.BRAND_ACCENT_COLOR,
    DEFAULT_BRAND_ACCENT_COLOR
  )
  const textColor = sanitizeHexColor(
    env.BRAND_TEXT_COLOR,
    DEFAULT_BRAND_TEXT_COLOR
  )
  const backgroundColor = sanitizeHexColor(
    env.BRAND_BACKGROUND_COLOR,
    DEFAULT_BRAND_BACKGROUND_COLOR
  )
  const footerHtml = sanitizeFooterHtml(env.BRAND_FOOTER_HTML)
  const storefrontUrl = sanitizeHttpUrl(env.STOREFRONT_URL)

  return {
    brandName,
    logoUrl,
    primaryColor,
    accentColor,
    textColor,
    backgroundColor,
    footerHtml,
    storefrontUrl,
  }
}

function toArray(value: string | string[]): string[] {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string")
  }

  return typeof value === "string" ? [value] : []
}

function isSectionArray(value: EmailTemplateBody): value is EmailTemplateSection[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === "object" &&
    value[0] !== null &&
    "paragraphs" in (value[0] as Record<string, unknown>)
  )
}

function renderIntroHtml(intro: string | string[], textColor: string): string {
  const paragraphs = toArray(intro)

  if (!paragraphs.length) {
    return ""
  }

  return paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px 0;padding:0;color:${textColor};font-size:16px;line-height:1.6;">${escapeHtml(
          paragraph
        )}</p>`
    )
    .join("\n")
}

function renderBodyHtml(
  body: EmailTemplateBody | null | undefined,
  textColor: string
): string {
  if (!body) {
    return ""
  }

  if (isSectionArray(body)) {
    return body
      .map((section) => {
        const parts: string[] = []

        if (section.subheading?.trim()) {
          parts.push(
            `<h2 style="margin:24px 0 12px 0;padding:0;color:${textColor};font-family:inherit;font-size:18px;font-weight:600;line-height:1.4;">${escapeHtml(
              section.subheading.trim()
            )}</h2>`
          )
        }

        if (Array.isArray(section.paragraphs)) {
          for (const paragraph of section.paragraphs) {
            if (typeof paragraph === "string" && paragraph.trim()) {
              parts.push(
                `<p style="margin:0 0 16px 0;padding:0;color:${textColor};font-size:15px;line-height:1.6;">${escapeHtml(
                  paragraph
                )}</p>`
              )
            }
          }
        }

        return parts.join("\n")
      })
      .join("\n")
  }

  return (body as string[])
    .filter((paragraph) => typeof paragraph === "string" && paragraph.trim())
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px 0;padding:0;color:${textColor};font-size:15px;line-height:1.6;">${escapeHtml(
          paragraph
        )}</p>`
    )
    .join("\n")
}

/**
 * Validate an action URL so only http(s) links are rendered as clickable
 * CTAs. Any other scheme (javascript:, data:, vbscript:, file:, etc.) is
 * rejected, mirroring the guard used in `sanitizeHttpUrl` /
 * `buildOrderStatusUrl`. If the URL is invalid, `null` is returned and the
 * CTA will not be rendered at all.
 */
function safeActionUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl.trim())

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null
    }

    return parsed.toString()
  } catch {
    return null
  }
}

function renderActionHtml(
  action: EmailTemplateAction | null | undefined,
  primaryColor: string,
  accentColor: string
): string {
  if (!action || !action.label?.trim() || !action.url?.trim()) {
    return ""
  }

  const safeUrl = safeActionUrl(action.url)

  if (!safeUrl) {
    return ""
  }

  const label = escapeHtml(action.label.trim())
  const url = escapeHtml(safeUrl)
  const buttonBackground = accentColor || primaryColor

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr>
    <td align="left" style="border-radius:24px;background-color:${buttonBackground};">
      <a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-family:inherit;font-size:16px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:24px;background-color:${buttonBackground};">
        ${label}
      </a>
    </td>
  </tr>
</table>
<p style="margin:0 0 16px 0;padding:0;color:#6b7280;font-size:13px;line-height:1.5;word-break:break-all;">
  <span style="color:#6b7280;">Если кнопка не работает, откройте ссылку вручную:</span><br/>
  <a href="${url}" target="_blank" rel="noopener noreferrer" style="color:${primaryColor};text-decoration:underline;word-break:break-all;">${url}</a>
</p>`.trim()
}

function renderFooterAppendHtml(
  append: EmailTemplateFooterAppend | null | undefined,
  config: BrandEmailConfig
): string {
  if (!append || typeof append !== "object") {
    return ""
  }

  const text = typeof append.text === "string" ? append.text.trim() : ""

  if (!text) {
    return ""
  }

  // Consumer may provide pre-escaped html. If absent, build from text+url.
  if (append.html && typeof append.html === "string" && append.html.trim()) {
    const sanitized = sanitizeFooterHtml(append.html)

    if (sanitized) {
      return `<div style="margin:12px 0 0 0;padding:0;color:#9ca3af;font-size:12px;line-height:1.5;">${sanitized}</div>`
    }
  }

  const safeUrl =
    typeof append.url === "string" && append.url.trim()
      ? safeActionUrl(append.url)
      : null

  if (!safeUrl) {
    return `<p style="margin:12px 0 0 0;padding:0;color:#9ca3af;font-size:12px;line-height:1.5;">${escapeHtml(
      text
    )}</p>`
  }

  const label =
    typeof append.linkLabel === "string" && append.linkLabel.trim()
      ? escapeHtml(append.linkLabel.trim())
      : escapeHtml(safeUrl)

  return `<p style="margin:12px 0 0 0;padding:0;color:#9ca3af;font-size:12px;line-height:1.5;">${escapeHtml(
    text
  )} — <a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" style="color:${
    config.primaryColor
  };text-decoration:underline;">${label}</a></p>`
}

function renderFooterHtml(
  footer: string | null | undefined,
  config: BrandEmailConfig,
  footerAppend?: EmailTemplateFooterAppend | null
): string {
  const parts: string[] = []

  if (footer?.trim()) {
    parts.push(
      `<p style="margin:0 0 8px 0;padding:0;color:#6b7280;font-size:13px;line-height:1.5;">${escapeHtml(
        footer.trim()
      )}</p>`
    )
  }

  const storefrontLink =
    config.storefrontUrl &&
    `<a href="${escapeHtml(
      config.storefrontUrl
    )}" target="_blank" rel="noopener noreferrer" style="color:${
      config.primaryColor
    };text-decoration:underline;">${escapeHtml(config.brandName)}</a>`

  parts.push(
    `<p style="margin:0 0 8px 0;padding:0;color:#6b7280;font-size:13px;line-height:1.5;">— Команда ${
      storefrontLink || escapeHtml(config.brandName)
    }</p>`
  )

  if (config.footerHtml) {
    parts.push(
      `<div style="margin:16px 0 0 0;padding:0;color:#9ca3af;font-size:12px;line-height:1.5;">${config.footerHtml}</div>`
    )
  }

  const appendHtml = renderFooterAppendHtml(footerAppend, config)

  if (appendHtml) {
    parts.push(appendHtml)
  }

  return parts.join("\n")
}

function renderHeaderHtml(config: BrandEmailConfig): string {
  if (config.logoUrl) {
    return `
<tr>
  <td align="left" style="padding:24px 32px 0 32px;">
    <img src="${escapeHtml(config.logoUrl)}" alt="${escapeHtml(
      config.brandName
    )}" width="140" style="display:block;max-width:140px;height:auto;border:0;outline:none;text-decoration:none;" />
  </td>
</tr>`.trim()
  }

  return `
<tr>
  <td align="left" style="padding:24px 32px 0 32px;font-family:inherit;color:${
    config.primaryColor
  };font-size:18px;font-weight:700;letter-spacing:-0.01em;">
    ${escapeHtml(config.brandName)}
  </td>
</tr>`.trim()
}

/**
 * Build the branded HTML email.
 *
 * The layout is a single 600px centered table on a neutral background.
 * Inline styles are used so webmail clients do not strip the look-and-feel.
 * A `preheader` is inserted as the first visible-to-inbox, hidden-in-body
 * text to give a good preview in mailbox lists.
 */
function renderHtml(
  input: EmailTemplateInput,
  config: BrandEmailConfig
): string {
  const preheader = escapeHtml(input.preheader || "")
  const heading = escapeHtml(input.heading || "")
  const header = renderHeaderHtml(config)
  const introHtml = renderIntroHtml(input.intro, config.textColor)
  const actionHtml = renderActionHtml(
    input.action ?? null,
    config.primaryColor,
    config.accentColor
  )
  const bodyHtml = renderBodyHtml(input.body ?? null, config.textColor)
  const footerHtml = renderFooterHtml(
    input.footer ?? null,
    config,
    input.footerAppend ?? null
  )

  return `<!DOCTYPE html>
<html lang="ru" dir="ltr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>${heading || escapeHtml(config.brandName)}</title>
</head>
<body style="margin:0;padding:0;background-color:${
    config.backgroundColor
  };font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;color:${
    config.textColor
  };-webkit-font-smoothing:antialiased;">
<div style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;">
${preheader}
</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${
    config.backgroundColor
  };">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        ${header}
        <tr>
          <td style="padding:8px 32px 0 32px;">
            <hr style="margin:16px 0;padding:0;border:0;border-top:1px solid #e5e7eb;" />
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 8px 32px;">
            <h1 style="margin:0 0 16px 0;padding:0;color:${
              config.primaryColor
            };font-family:inherit;font-size:22px;font-weight:700;line-height:1.3;letter-spacing:-0.01em;">
              ${heading}
            </h1>
            ${introHtml}
            ${actionHtml}
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 24px 32px;">
            <hr style="margin:16px 0;padding:0;border:0;border-top:1px solid #e5e7eb;" />
            ${footerHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

function wrapPlainText(value: string, width = PLAIN_TEXT_WRAP_WIDTH): string {
  if (!value) {
    return ""
  }

  const lines: string[] = []

  for (const rawLine of value.split("\n")) {
    if (rawLine.length <= width) {
      lines.push(rawLine)
      continue
    }

    // Greedy word-wrap at whitespace, but never split a single long token
    // (typically a URL) — leave it on its own line so the mail client
    // can still linkify it.
    const words = rawLine.split(/\s+/)
    let current = ""

    for (const word of words) {
      if (!word) {
        continue
      }

      const candidate = current ? `${current} ${word}` : word

      if (candidate.length <= width) {
        current = candidate
        continue
      }

      if (current) {
        lines.push(current)
      }

      current = word
    }

    if (current) {
      lines.push(current)
    }
  }

  return lines.join("\n")
}

function toIntroArray(intro: string | string[]): string[] {
  return toArray(intro).filter((item) => item.trim().length > 0)
}

function bodyToPlainText(body: EmailTemplateBody | null | undefined): string[] {
  if (!body) {
    return []
  }

  if (isSectionArray(body)) {
    const lines: string[] = []

    for (const section of body) {
      if (section.subheading?.trim()) {
        lines.push(section.subheading.trim())
      }

      if (Array.isArray(section.paragraphs)) {
        for (const paragraph of section.paragraphs) {
          if (typeof paragraph === "string" && paragraph.trim()) {
            lines.push(paragraph.trim())
          }
        }
      }

      lines.push("")
    }

    // Drop trailing blank line if any.
    while (lines.length && lines[lines.length - 1] === "") {
      lines.pop()
    }

    return lines
  }

  return (body as string[])
    .filter((paragraph) => typeof paragraph === "string" && paragraph.trim())
    .map((paragraph) => paragraph.trim())
}

function renderText(
  input: EmailTemplateInput,
  config: BrandEmailConfig
): string {
  const lines: string[] = []

  if (input.heading?.trim()) {
    lines.push(input.heading.trim())
    lines.push("")
  }

  const introLines = toIntroArray(input.intro)

  for (const paragraph of introLines) {
    lines.push(paragraph.trim())
    lines.push("")
  }

  if (input.action && input.action.label?.trim() && input.action.url?.trim()) {
    const safeUrl = safeActionUrl(input.action.url)

    if (safeUrl) {
      lines.push(`${input.action.label.trim()}:`)
      // Action URL MUST be on its own line so email clients linkify it.
      lines.push(safeUrl)
      lines.push("")
    }
  }

  const bodyLines = bodyToPlainText(input.body ?? null)

  for (const line of bodyLines) {
    lines.push(line)
  }

  if (bodyLines.length) {
    lines.push("")
  }

  if (input.footer?.trim()) {
    lines.push(input.footer.trim())
    lines.push("")
  }

  lines.push(`— Команда ${config.brandName}`)

  const append = input.footerAppend
  if (append && typeof append === "object") {
    const appendText = typeof append.text === "string" ? append.text.trim() : ""

    if (appendText) {
      lines.push("")
      const appendUrl =
        typeof append.url === "string" && append.url.trim()
          ? safeActionUrl(append.url)
          : null

      if (appendUrl) {
        lines.push(`${appendText}:`)
        lines.push(appendUrl)
      } else {
        lines.push(appendText)
      }
    }
  }

  // Remove consecutive blank lines that may have been produced by
  // sections with missing parts, to keep the plain text compact.
  const compact: string[] = []

  for (const line of lines) {
    if (line === "" && compact[compact.length - 1] === "") {
      continue
    }

    compact.push(line)
  }

  while (compact.length && compact[compact.length - 1] === "") {
    compact.pop()
  }

  return wrapPlainText(compact.join("\n"))
}

/**
 * Render a branded email into `{ html, text }`.
 *
 * Behavior is purely functional: same input produces same output.
 * Brand configuration is read from `process.env` once per call, so
 * integration code can rely on env overrides without manual wiring.
 */
export function renderBrandedEmail(
  input: EmailTemplateInput,
  config: BrandEmailConfig = getBrandEmailConfig()
): RenderedEmail {
  if (!input || typeof input !== "object") {
    throw new Error("renderBrandedEmail requires an input object")
  }

  const safeInput: EmailTemplateInput = {
    preheader: typeof input.preheader === "string" ? input.preheader : "",
    heading: typeof input.heading === "string" ? input.heading : "",
    intro: input.intro ?? "",
    action: input.action ?? null,
    body: input.body ?? null,
    footer: typeof input.footer === "string" ? input.footer : null,
    footerAppend: input.footerAppend ?? null,
  }

  return {
    html: renderHtml(safeInput, config),
    text: renderText(safeInput, config),
  }
}
