import { describe, expect, it } from "@jest/globals"
import { renderBrandedEmail } from "../email-template"

describe("renderBrandedEmail footerAppend", () => {
  const baseInput = {
    preheader: "pre",
    heading: "Heading",
    intro: "Hello",
  }

  it("renders nothing extra when footerAppend is absent", () => {
    const { html, text } = renderBrandedEmail(baseInput)

    expect(html).not.toContain("Отписаться")
    expect(text).not.toContain("Отписаться")
  })

  it("appends a text-only footer when url is missing", () => {
    const { html, text } = renderBrandedEmail({
      ...baseInput,
      footerAppend: {
        text: "Legal disclaimer",
      },
    })

    expect(html).toContain("Legal disclaimer")
    expect(text).toContain("Legal disclaimer")
    expect(html).not.toContain('href="')
  })

  it("renders a safe http link in the footer appendix", () => {
    const { html, text } = renderBrandedEmail({
      ...baseInput,
      footerAppend: {
        text: "Отписаться от рассылки",
        url: "https://studio.slavx.ru/ru/unsubscribe?token=cust_1.raw",
        linkLabel: "Отписаться",
      },
    })

    expect(html).toContain("Отписаться от рассылки")
    expect(html).toContain(
      'href="https://studio.slavx.ru/ru/unsubscribe?token=cust_1.raw"'
    )
    // Plain-text fallback places URL on its own line for client linkification.
    expect(text).toContain("Отписаться от рассылки:")
    expect(text).toContain("https://studio.slavx.ru/ru/unsubscribe?token=cust_1.raw")
  })

  it("drops javascript: URLs from the footer link", () => {
    const { html } = renderBrandedEmail({
      ...baseInput,
      footerAppend: {
        text: "Follow",
        url: "javascript:alert(1)",
        linkLabel: "click",
      },
    })

    expect(html).not.toContain("javascript:")
    // Without a valid URL the appendix renders text-only.
    expect(html).toContain("Follow")
  })

  it("accepts pre-escaped raw html through sanitized path", () => {
    const { html } = renderBrandedEmail({
      ...baseInput,
      footerAppend: {
        text: "fallback",
        html: "<span>already sanitized</span>",
      },
    })

    expect(html).toContain("<span>already sanitized</span>")
  })

  it("drops scripts from provided raw html", () => {
    const { html } = renderBrandedEmail({
      ...baseInput,
      footerAppend: {
        text: "fallback",
        html: "<script>alert(1)</script><span>kept</span>",
      },
    })

    expect(html).not.toContain("<script>")
    expect(html).toContain("kept")
  })
})
