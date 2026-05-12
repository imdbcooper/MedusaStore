import { describe, expect, it, jest, afterEach } from "@jest/globals"
import type { Logger, NotificationTypes } from "@medusajs/framework/types"
import smtpNotificationProvider, {
  resetSmtpTransportFactoryForTests,
  setSmtpTransportFactoryForTests,
  SmtpNotificationService,
} from "../notification-smtp"


describe("SmtpNotificationService", () => {
  const createTransport = jest.fn()
  const sendMail = jest.fn(async () => ({ messageId: "smtp-message-1" }))
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as Logger

  afterEach(() => {
    resetSmtpTransportFactoryForTests()
    jest.clearAllMocks()
    sendMail.mockResolvedValue({ messageId: "smtp-message-1" })
  })

  function createService(options = {}) {
    createTransport.mockReturnValue({
      sendMail,
    })
    setSmtpTransportFactoryForTests(createTransport as never)

    return new SmtpNotificationService(
      { logger },
      {
        host: "smtp.slavx.ru",
        port: 587,
        secure: false,
        user: "noreply@notify.slavx.ru",
        password: "test-password",
        from: "noreply@notify.slavx.ru",
        from_name: "MedusaStore",
        reply_to: "support@example.com",
        tls_reject_unauthorized: true,
        ...options,
      }
    )
  }

  it("exports a Medusa notification module provider with iterable services", () => {
    expect(Array.isArray(smtpNotificationProvider.services)).toBe(true)
    expect(smtpNotificationProvider.services).toEqual([SmtpNotificationService])
  })

  it("creates a STARTTLS transport without sending during construction", () => {
    createService()

    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.slavx.ru",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: "noreply@notify.slavx.ru",
        pass: "test-password",
      },
      tls: {
        servername: "smtp.slavx.ru",
        rejectUnauthorized: true,
      },
    })
    expect(sendMail).not.toHaveBeenCalled()
  })

  it("sends text and html notification payload through mocked nodemailer", async () => {
    const service = createService()
    const notification = {
      to: " Shopper@Example.COM ",
      content: {
        subject: "Order placed",
        text: "Thanks for your order",
        html: "<p>Thanks for your order</p>",
      },
      attachments: [
        {
          filename: "receipt.txt",
          content: "receipt",
          content_type: "text/plain",
        },
      ],
    } as NotificationTypes.ProviderSendNotificationDTO

    const result = await service.send(notification)

    expect(result).toEqual({ id: "smtp-message-1" })
    expect(sendMail).toHaveBeenCalledWith({
      from: "MedusaStore <noreply@notify.slavx.ru>",
      to: ["shopper@example.com"],
      replyTo: "support@example.com",
      subject: "Order placed",
      text: "Thanks for your order",
      html: "<p>Thanks for your order</p>",
      attachments: [
        {
          filename: "receipt.txt",
          content: "receipt",
          contentType: "text/plain",
        },
      ],
    })
  })

  it("normalizes semicolon and comma separated recipients", async () => {
    const service = createService({ reply_to: "" })
    const notification = {
      to: "First@Example.com; second@example.com, third@example.com",
      content: {
        subject: "Subject only",
      },
    } as NotificationTypes.ProviderSendNotificationDTO

    await service.send(notification)

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["first@example.com", "second@example.com", "third@example.com"],
        subject: "Subject only",
        text: "Subject only",
        html: "<p>Subject only</p>",
      })
    )
  })

  it("rejects empty recipient without real network calls", async () => {
    const service = createService()
    const notification = {
      to: " ",
      content: {
        subject: "No recipient",
      },
    } as NotificationTypes.ProviderSendNotificationDTO

    await expect(service.send(notification)).rejects.toThrow(
      "At least one email recipient is required"
    )
    expect(sendMail).not.toHaveBeenCalled()
  })
})
