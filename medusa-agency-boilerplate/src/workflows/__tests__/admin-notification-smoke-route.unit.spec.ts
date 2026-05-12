import { describe, expect, it, jest } from "@jest/globals"

const runMock = jest.fn()

jest.mock("../send-notification-smoke", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    run: runMock,
  })),
}))

import { AdminNotificationSmokeSchema } from "../../api/admin/notifications/smoke/route"
import { POST } from "../../api/admin/notifications/smoke/route"

describe("admin notification smoke route", () => {
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
