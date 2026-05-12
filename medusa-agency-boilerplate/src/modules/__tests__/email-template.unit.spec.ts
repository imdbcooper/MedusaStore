import { afterEach, describe, expect, it } from "@jest/globals"
import {
  DEFAULT_BRAND_ACCENT_COLOR,
  DEFAULT_BRAND_BACKGROUND_COLOR,
  DEFAULT_BRAND_NAME,
  DEFAULT_BRAND_PRIMARY_COLOR,
  DEFAULT_BRAND_TEXT_COLOR,
  escapeHtml,
  getBrandEmailConfig,
  renderBrandedEmail,
} from "../email-template"

const ORIGINAL_ENV = { ...process.env }

describe("email-template helpers", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  describe("escapeHtml", () => {
    it("escapes all dangerous characters", () => {
      expect(escapeHtml("<script>alert(1)</script>")).toBe(
        "&lt;script&gt;alert(1)&lt;/script&gt;"
      )
      expect(escapeHtml("'\"&<>")).toBe("&#39;&quot;&amp;&lt;&gt;")
    })

    it("coerces non-string values", () => {
      expect(escapeHtml(String(42))).toBe("42")
    })
  })

  describe("getBrandEmailConfig", () => {
    it("returns defaults when env is empty", () => {
      const config = getBrandEmailConfig({})

      expect(config.brandName).toBe(DEFAULT_BRAND_NAME)
      expect(config.logoUrl).toBeNull()
      expect(config.primaryColor).toBe(DEFAULT_BRAND_PRIMARY_COLOR)
      expect(config.accentColor).toBe(DEFAULT_BRAND_ACCENT_COLOR)
      expect(config.textColor).toBe(DEFAULT_BRAND_TEXT_COLOR)
      expect(config.backgroundColor).toBe(DEFAULT_BRAND_BACKGROUND_COLOR)
      expect(config.footerHtml).toBeNull()
      expect(config.storefrontUrl).toBeNull()
    })

    it("reads overrides from env and sanitizes them", () => {
      const config = getBrandEmailConfig({
        BRAND_NAME: "  Acme\nStudio  ",
        BRAND_LOGO_URL: "https://cdn.example.com/logo.png",
        BRAND_PRIMARY_COLOR: "#abcdef",
        BRAND_ACCENT_COLOR: "#123",
        BRAND_TEXT_COLOR: "not-a-color",
        BRAND_BACKGROUND_COLOR: "#ffffff",
        BRAND_FOOTER_HTML: "<p>Legal info</p>",
        STOREFRONT_URL: "https://shop.example.com/",
      })

      expect(config.brandName).toBe("Acme Studio")
      expect(config.logoUrl).toBe("https://cdn.example.com/logo.png")
      expect(config.primaryColor).toBe("#abcdef")
      expect(config.accentColor).toBe("#123")
      // Invalid hex falls back to default rather than leaking the raw value.
      expect(config.textColor).toBe(DEFAULT_BRAND_TEXT_COLOR)
      expect(config.backgroundColor).toBe("#ffffff")
      expect(config.footerHtml).toBe("<p>Legal info</p>")
      expect(config.storefrontUrl).toBe("https://shop.example.com/")
    })

    it("rejects non-http URLs for logo and storefront", () => {
      const config = getBrandEmailConfig({
        BRAND_LOGO_URL: "javascript:alert(1)",
        STOREFRONT_URL: "ftp://example.com",
      })

      expect(config.logoUrl).toBeNull()
      expect(config.storefrontUrl).toBeNull()
    })

    it("strips <script>, <style>, <iframe> and inline handlers from footer html", () => {
      const footer = [
        "<p>Legal info</p>",
        "<script>alert('xss')</script>",
        '<img src=x onerror="alert(1)" />',
        "<style>body{display:none}</style>",
        '<iframe src="evil"></iframe>',
        '<a href="javascript:alert(1)">Bad</a>',
      ].join("")
      const config = getBrandEmailConfig({ BRAND_FOOTER_HTML: footer })

      expect(config.footerHtml).not.toContain("<script")
      expect(config.footerHtml).not.toContain("<style")
      expect(config.footerHtml).not.toContain("<iframe")
      expect(config.footerHtml).not.toContain("onerror")
      expect(config.footerHtml).not.toContain("javascript:")
      expect(config.footerHtml).toContain("<p>Legal info</p>")
    })

    it("strips <object> tags from footer html", () => {
      const footer =
        '<p>ok</p><object data="evil.swf" type="application/x-shockwave-flash"></object>'
      const config = getBrandEmailConfig({ BRAND_FOOTER_HTML: footer })

      expect(config.footerHtml).not.toContain("<object")
      expect(config.footerHtml).not.toContain("</object")
      expect(config.footerHtml).toContain("<p>ok</p>")
    })

    it("strips <embed> tags from footer html", () => {
      const footer = '<p>ok</p><embed src="evil.swf" />'
      const config = getBrandEmailConfig({ BRAND_FOOTER_HTML: footer })

      expect(config.footerHtml).not.toContain("<embed")
      expect(config.footerHtml).toContain("<p>ok</p>")
    })

    it("strips <base> tags from footer html", () => {
      const footer = '<base href="https://evil.example.com/" /><p>ok</p>'
      const config = getBrandEmailConfig({ BRAND_FOOTER_HTML: footer })

      expect(config.footerHtml).not.toContain("<base")
      expect(config.footerHtml).toContain("<p>ok</p>")
    })

    it("strips <link> tags from footer html", () => {
      const footer =
        '<link rel="stylesheet" href="https://evil.example.com/x.css" /><p>ok</p>'
      const config = getBrandEmailConfig({ BRAND_FOOTER_HTML: footer })

      expect(config.footerHtml).not.toContain("<link")
      expect(config.footerHtml).toContain("<p>ok</p>")
    })

    it("strips vbscript: URLs from footer html", () => {
      const footer = '<a href="vbscript:msgbox(1)">x</a><p>ok</p>'
      const config = getBrandEmailConfig({ BRAND_FOOTER_HTML: footer })

      expect(config.footerHtml).not.toContain("vbscript:")
      expect(config.footerHtml).toContain("<p>ok</p>")
    })

    it("strips data: URLs from footer html", () => {
      const footer =
        '<a href="data:text/html,<script>alert(1)</script>">x</a><p>ok</p>'
      const config = getBrandEmailConfig({ BRAND_FOOTER_HTML: footer })

      expect(config.footerHtml).not.toContain("data:")
      expect(config.footerHtml).toContain("<p>ok</p>")
    })

    it("caps unreasonably long env values", () => {
      const longName = "X".repeat(500)
      const config = getBrandEmailConfig({ BRAND_NAME: longName })

      expect(config.brandName.length).toBeLessThanOrEqual(120)
    })
  })

  describe("renderBrandedEmail happy path", () => {
    it("renders heading, intro, action and body", () => {
      const { html, text } = renderBrandedEmail({
        preheader: "Подтвердите email",
        heading: "Добро пожаловать",
        intro: ["Здравствуйте!", "Это тестовое письмо."],
        action: {
          label: "Подтвердить email",
          url: "https://shop.example.com/ru/account/verify-email?token=abc",
        },
        body: [
          "Ссылка действительна 24 ч.",
          "Если вы не регистрировались, игнорируйте.",
        ],
      })

      expect(html).toContain("Добро пожаловать")
      expect(html).toContain("Здравствуйте!")
      expect(html).toContain("Это тестовое письмо.")
      expect(html).toContain("Подтвердить email")
      expect(html).toContain(
        "https://shop.example.com/ru/account/verify-email?token=abc"
      )
      expect(html).toContain("Ссылка действительна 24 ч.")

      expect(text).toContain("Добро пожаловать")
      expect(text).toContain("Здравствуйте!")
      expect(text).toContain("Подтвердить email:")
      // Action URL MUST be alone on its own line in the text version.
      expect(text).toMatch(
        /\nhttps:\/\/shop\.example\.com\/ru\/account\/verify-email\?token=abc\n/
      )
      expect(text).toContain(`— Команда ${DEFAULT_BRAND_NAME}`)
    })

    it("renders sectioned body with subheading", () => {
      const { html, text } = renderBrandedEmail({
        preheader: "Заказ подтверждён",
        heading: "Заказ принят",
        intro: "Спасибо за заказ.",
        body: [
          {
            subheading: "Что дальше",
            paragraphs: ["Мы передадим заказ в обработку."],
          },
          {
            subheading: "Связь с нами",
            paragraphs: ["Ответьте на это письмо при вопросах."],
          },
        ],
      })

      expect(html).toContain("Что дальше")
      expect(html).toContain("Связь с нами")
      expect(text).toContain("Что дальше")
      expect(text).toContain("Связь с нами")
    })
  })

  describe("renderBrandedEmail security", () => {
    it("escapes dangerous characters in heading/intro/body", () => {
      const { html } = renderBrandedEmail({
        preheader: "<hack>",
        heading: `<script>alert("h")</script>`,
        intro: `<img src=x onerror="alert(1)">`,
        body: [`'"&<>`],
      })

      expect(html).not.toContain("<script>alert")
      expect(html).not.toContain(`<img src=x onerror=`)
      expect(html).toContain("&lt;script&gt;")
      expect(html).toContain("&lt;img src=x onerror=")
      expect(html).toContain("&#39;&quot;&amp;&lt;&gt;")
    })

    it("escapes dangerous characters in action label and keeps URL as href attribute only", () => {
      const { html } = renderBrandedEmail({
        preheader: "p",
        heading: "h",
        intro: "i",
        action: {
          label: `<script>alert(1)</script>`,
          url: `https://example.com/?a=1&b=<script>`,
        },
      })

      expect(html).not.toContain("<script>alert(1)</script>")
      expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;")
      // URL passes through `new URL().toString()` first, so `<script>` gets
      // percent-encoded (`%3Cscript%3E`) before escapeHtml is applied.
      expect(html).toContain(
        "https://example.com/?a=1&amp;b=%3Cscript%3E"
      )
      expect(html).not.toContain("<script>")
    })

    it("omits the CTA block when action is null or incomplete", () => {
      const { html: withoutAction } = renderBrandedEmail({
        preheader: "p",
        heading: "h",
        intro: "i",
        action: null,
      })

      const { html: withEmptyAction } = renderBrandedEmail({
        preheader: "p",
        heading: "h",
        intro: "i",
        action: { label: "", url: "https://example.com" },
      })

      expect(withoutAction).not.toContain("Если кнопка не работает")
      expect(withEmptyAction).not.toContain("Если кнопка не работает")
    })

    it("rejects action URLs with javascript: scheme", () => {
      const { html, text } = renderBrandedEmail({
        preheader: "p",
        heading: "h",
        intro: "i",
        action: { label: "Go", url: "javascript:alert(1)" },
      })

      expect(html).not.toContain("javascript:alert")
      expect(html).not.toContain('href="javascript:')
      expect(html).not.toContain("Если кнопка не работает")
      expect(text).not.toContain("javascript:")
      expect(text).not.toContain("Go:")
    })

    it("rejects action URLs with data: scheme", () => {
      const { html, text } = renderBrandedEmail({
        preheader: "p",
        heading: "h",
        intro: "i",
        action: {
          label: "Open",
          url: "data:text/html,<script>alert(1)</script>",
        },
      })

      expect(html).not.toContain("data:text/html")
      expect(html).not.toContain('href="data:')
      expect(html).not.toContain("Если кнопка не работает")
      expect(text).not.toContain("data:text/html")
    })

    it("rejects action URLs with vbscript: scheme", () => {
      const { html, text } = renderBrandedEmail({
        preheader: "p",
        heading: "h",
        intro: "i",
        action: { label: "Click", url: "vbscript:msgbox(1)" },
      })

      expect(html).not.toContain("vbscript:")
      expect(html).not.toContain('href="vbscript:')
      expect(html).not.toContain("Если кнопка не работает")
      expect(text).not.toContain("vbscript:")
    })

    it("accepts valid https URLs (positive control)", () => {
      const { html, text } = renderBrandedEmail({
        preheader: "p",
        heading: "h",
        intro: "i",
        action: {
          label: "Open",
          url: "https://shop.example.com/ru/account",
        },
      })

      expect(html).toContain('href="https://shop.example.com/ru/account"')
      expect(html).toContain("Если кнопка не работает")
      expect(text).toContain("https://shop.example.com/ru/account")
    })

    it("accepts valid http URLs (positive control)", () => {
      const { html } = renderBrandedEmail({
        preheader: "p",
        heading: "h",
        intro: "i",
        action: { label: "Open", url: "http://shop.example.com/" },
      })

      expect(html).toContain('href="http://shop.example.com/"')
    })
  })

  describe("renderBrandedEmail accessibility / email client compat", () => {
    it("includes dark-mode meta, viewport meta and hidden preheader", () => {
      const { html } = renderBrandedEmail({
        preheader: "Секретный preheader текст",
        heading: "h",
        intro: "i",
      })

      expect(html).toContain('name="color-scheme"')
      expect(html).toContain('name="supported-color-schemes"')
      expect(html).toContain('name="viewport"')
      expect(html).toContain("max-width:600px")
      // The preheader must be rendered but hidden via inline CSS.
      expect(html).toContain("Секретный preheader текст")
      expect(html).toMatch(/display:none[^;]*;visibility:hidden/)
    })

    it("uses table-based layout without external stylesheet or script tags", () => {
      const { html } = renderBrandedEmail({
        preheader: "p",
        heading: "h",
        intro: "i",
      })

      expect(html).toContain("<table")
      expect(html).not.toContain("<link rel=\"stylesheet\"")
      expect(html).not.toContain("<script")
    })

    it("renders a logo img with alt text when BRAND_LOGO_URL is provided", () => {
      const { html } = renderBrandedEmail(
        {
          preheader: "p",
          heading: "h",
          intro: "i",
        },
        {
          ...getBrandEmailConfig({}),
          logoUrl: "https://cdn.example.com/logo.png",
        }
      )

      expect(html).toContain('src="https://cdn.example.com/logo.png"')
      expect(html).toContain(`alt="${DEFAULT_BRAND_NAME}"`)
    })
  })

  describe("renderBrandedEmail text version", () => {
    it("wraps long lines to the safe width while keeping URLs intact", () => {
      const longUrl =
        "https://example.com/very/long/path/that/is/longer/than/seventy-eight-characters-for-sure?token=abcdef"
      const { text } = renderBrandedEmail({
        preheader: "p",
        heading: "h",
        intro: "i",
        action: {
          label: "Открыть",
          url: longUrl,
        },
      })

      const lines = text.split("\n")
      expect(lines).toContain(longUrl)

      for (const line of lines) {
        // Allow a single long token (a URL) to overflow on its own line,
        // but disallow multi-word lines from running over 78 chars.
        if (line.includes(" ")) {
          expect(line.length).toBeLessThanOrEqual(78)
        }
      }
    })

    it("omits body when not provided and still renders signoff", () => {
      const { text } = renderBrandedEmail({
        preheader: "p",
        heading: "Привет",
        intro: "Добро пожаловать!",
      })

      expect(text).toContain("Привет")
      expect(text).toContain(`— Команда ${DEFAULT_BRAND_NAME}`)
    })
  })

  describe("brand config overrides", () => {
    it("applies custom brand name to signoff and colors to HTML", () => {
      const config = {
        ...getBrandEmailConfig({}),
        brandName: "Acme",
        primaryColor: "#ff0000",
        accentColor: "#00ff00",
        textColor: "#123456",
        backgroundColor: "#abcdef",
      }

      const { html, text } = renderBrandedEmail(
        {
          preheader: "p",
          heading: "h",
          intro: "i",
          action: { label: "Go", url: "https://example.com" },
        },
        config
      )

      expect(text).toContain("— Команда Acme")
      expect(html).toContain("#ff0000")
      expect(html).toContain("#00ff00")
      expect(html).toContain("#123456")
      expect(html).toContain("#abcdef")
    })
  })
})
