import { describe, expect, it, jest } from "@jest/globals"
import { asValue, createContainer } from "awilix"
import { Modules } from "@medusajs/framework/utils"

const runMock = jest.fn()

jest.mock("../send-notification-smoke", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    run: runMock,
  })),
}))

import { AdminNotificationSmokeSchema } from "../../api/admin/notifications/smoke/route"
import { POST } from "../../api/admin/notifications/smoke/route"
import sendNotificationSmokeWorkflow from "../send-notification-smoke"

describe("admin notification smoke route", () => {
  it("uses the SMTP envelope sender for real SMTP smoke notifications", async () => {
    const originalEnv = { ...process.env }
    process.env.NOTIFICATION_EMAIL_PROVIDER = "smtp"
    process.env.NOTIFICATION_EMAIL_FROM = "notifications@example.com"
    process.env.SMTP_HOST = "smtp.slavx.ru"
    process.env.SMTP_PORT = "587"
    process.env.SMTP_USER = "noreply@notify.slavx.ru"
    process.env.SMTP_PASSWORD = "test-password"
    process.env.SMTP_FROM = "noreply@notify.slavx.ru"

    const notificationModuleService = {
      createNotifications: jest.fn(async (payload: Record<string, unknown>) => ({
        ...payload,
        id: "noti_test",
        status: "sent",
        provider_id: "smtp",
        created_at: new Date().toISOString(),
      })),
    }
    const container = createContainer()
    container.register({
      [Modules.NOTIFICATION]: asValue(notificationModuleService),
    })

    try {
      await sendNotificationSmokeWorkflow(container as any).run({
        input: {
          to: "ops@example.com",
          subject: "SMTP smoke",
          text: "SMTP smoke body.",
          html: "<p>SMTP smoke body.</p>",
        },
      })

      expect(notificationModuleService.createNotifications).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "noreply@notify.slavx.ru",
          to: "ops@example.com",
          channel: "email",
        })
      )
    } finally {
      process.env = originalEnv
    }
  })

  it("accepts dry_run payloads without executing notification workflow", async () => {
    const req = {
      auth_context: {
        actor_id: "apk_test",
        actor_type: "api-key",
      },
      scope: {
        resolve: jest.fn(() => ({
          graph: jest.fn(async () => ({
            data: [
              {
                created_by: null,
              },
            ],
          })),
        })),
      },
      secret_key_context: {
        created_by: null,
      },
      validatedBody: AdminNotificationSmokeSchema.parse({
        to: "ops@example.com",
        subject: "Auth smoke",
        message: "Validate admin route auth only.",
        dry_run: true,
      }),
    } as any
    const statusMock = jest.fn().mockReturnThis()
    const jsonMock = jest.fn()
    const res = {
      status: statusMock,
      json: jsonMock,
    } as any

    await POST(req, res)

    expect(runMock).not.toHaveBeenCalled()
    expect(statusMock).toHaveBeenCalledWith(200)
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        request: expect.objectContaining({
          dry_run: true,
          to: "ops@example.com",
        }),
        auth: expect.objectContaining({
          actor_type: "api-key",
          secret_api_key: true,
        }),
        notification: null,
      })
    )
  })
})
