import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"

const mockUpdateCustomersRun = jest.fn(async ({ input }) => ({ result: input }))

jest.mock("@medusajs/medusa/core-flows", () => ({
  updateCustomersWorkflow: () => ({
    run: mockUpdateCustomersRun,
  }),
}))

import { asValue, createContainer } from "awilix"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  buildCustomerMarketingMetadata,
  resolveMarketingPreferences,
} from "../../modules/marketing-preferences"
import {
  DEFAULT_MARKETING_FREQUENCY_CAP_COUNT,
  createMarketingCampaign,
  getMarketingCampaignById,
  listMarketingDeliveryJournalByCampaignId,
  normalizeMarketingAudienceFilters,
  resolveMarketingAudience,
} from "../../modules/marketing-layer"
import sendMarketingCampaignWorkflow from "../send-marketing-campaign"

describe("marketing preferences contract", () => {
  it("normalizes customer bindings into metadata-first marketing preferences", () => {
    const customer = {
      id: "cust_1",
      email: " Customer@Example.com ",
      phone: "8 (999) 123-45-67",
      metadata: {
        vk_peer_id: "2000000001",
      },
    }

    const resolution = resolveMarketingPreferences(customer.metadata, customer)

    expect(resolution.preferences.version).toBe(1)
    expect(resolution.preferences.global_status).toBe("subscribed")
    expect(resolution.preferences.channels.email.status).toBe("subscribed")
    expect(resolution.preferences.channels.sms.recipient_snapshot).toEqual({
      phone: "+79991234567",
    })
    expect(resolution.preferences.channels.vk.recipient_snapshot).toEqual({
      vk_peer_id: "2000000001",
      linked: true,
    })
  })

  it("writes explicit admin updates back into customer marketing metadata", () => {
    const nextMetadata = buildCustomerMarketingMetadata(
      {
        id: "cust_2",
        email: "customer@example.com",
        phone: null,
        metadata: {},
      },
      {
        global_status: "unsubscribed",
        channels: {
          email: { status: "unsubscribed" },
          sms: { status: "pending" },
        },
        source: "admin",
        updated_at: "2026-04-18T20:00:00.000Z",
      }
    )

    const resolution = resolveMarketingPreferences(nextMetadata, {
      email: "customer@example.com",
      phone: null,
      metadata: nextMetadata,
    })

    expect(resolution.preferences.global_status).toBe("unsubscribed")
    expect(resolution.preferences.channels.email.status).toBe("unsubscribed")
    expect(resolution.preferences.channels.email.source).toBe("admin")
    expect(resolution.preferences.channels.sms.status).toBe("pending")
    expect(resolution.preferences.channels.vk.status).toBe("unavailable")
  })
})

describe("marketing layer storage and audience selection", () => {
  const campaignStore = new Map<string, any>()
  const journalStore: any[] = []

  const pgConnection = {
    raw: jest.fn(async (sql: string, bindings?: unknown[]) => {
      const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase()

      if (normalized.startsWith("create table") || normalized.startsWith("create index")) {
        return { rows: [] }
      }

      if (normalized.includes("insert into marketing_campaign")) {
        const row = {
          id: String(bindings?.[0]),
          name: bindings?.[1],
          description: bindings?.[2],
          channel: bindings?.[3],
          audience_type: bindings?.[4],
          audience_filters: bindings?.[5],
          template: bindings?.[6],
          subject: bindings?.[7],
          content: bindings?.[8],
          status: "draft",
          created_by: bindings?.[9],
          frequency_cap_window_hours: bindings?.[10],
          frequency_cap_count: bindings?.[11],
          total_selected: 0,
          total_sent: 0,
          total_skipped: 0,
          created_at: "2026-04-18T20:00:00.000Z",
          updated_at: "2026-04-18T20:00:00.000Z",
        }
        campaignStore.set(row.id, row)
        return { rows: [row] }
      }

      if (normalized.includes("select * from marketing_campaign where id =")) {
        return { rows: [campaignStore.get(String(bindings?.[0]))].filter(Boolean) }
      }

      if (normalized.includes("select * from marketing_campaign order by")) {
        return { rows: Array.from(campaignStore.values()) }
      }

      if (normalized.includes("insert into marketing_delivery_journal")) {
        const row = {
          id: String(bindings?.[0]),
          campaign_id: bindings?.[1],
          customer_id: bindings?.[2],
          channel: bindings?.[3],
          recipient: bindings?.[4],
          recipient_snapshot: bindings?.[5],
          delivery_status: bindings?.[6],
          decision_reason: bindings?.[7],
          notification_id: bindings?.[8],
          template: bindings?.[9],
          payload: bindings?.[10],
          created_at: "2026-04-18T20:05:00.000Z",
          updated_at: "2026-04-18T20:05:00.000Z",
        }
        journalStore.push(row)
        return { rows: [row] }
      }

      if (normalized.includes("select * from marketing_delivery_journal where campaign_id =")) {
        return {
          rows: journalStore.filter((row) => row.campaign_id === bindings?.[0]),
        }
      }

      if (normalized.includes("select count(*)::int as count from marketing_delivery_journal")) {
        return { rows: [{ count: 0 }] }
      }

      throw new Error(`Unhandled SQL: ${sql}`)
    }),
  }

  it("creates campaign records with normalized manual audience filters", async () => {
    const campaign = await createMarketingCampaign(pgConnection as any, {
      name: "Manual VK campaign",
      channel: "vk",
      audience_type: "manual",
      audience_filters: {
        customer_ids: ["cust_1", "cust_1", "cust_2"],
      },
      template: "marketing-vk-v1",
      subject: null,
      content: {
        text: "hello",
      },
      created_by: "user_1",
    })

    const stored = await getMarketingCampaignById(pgConnection as any, campaign.id)

    expect(stored?.audience_type).toBe("manual")
    expect(normalizeMarketingAudienceFilters(stored?.audience_filters).customer_ids).toEqual([
      "cust_1",
      "cust_2",
    ])
    expect(stored?.frequency_cap_count).toBe(DEFAULT_MARKETING_FREQUENCY_CAP_COUNT)
  })

  it("selects audience by consent and vk binding variants", async () => {
    const query = {
      graph: jest.fn(async () => ({
        data: [
          {
            id: "cust_email",
            email: "email@example.com",
            phone: null,
            metadata: {},
          },
          {
            id: "cust_vk",
            email: null,
            phone: null,
            metadata: {
              vk_peer_id: "2000000002",
            },
          },
        ],
      })),
    }

    const emailAudience = await resolveMarketingAudience(query as any, {
      audience_type: "email_consent",
      audience_filters: {},
      channel: "email",
    })
    const vkAudience = await resolveMarketingAudience(query as any, {
      audience_type: "vk_linked",
      audience_filters: {},
      channel: "vk",
    })

    expect(emailAudience.map((entry) => entry.customer.id)).toEqual(["cust_email"])
    expect(vkAudience.map((entry) => entry.customer.id)).toEqual(["cust_vk"])
  })

  it("reads journal rows by campaign id", async () => {
    const campaign = await createMarketingCampaign(pgConnection as any, {
      name: "Email campaign",
      channel: "email",
      audience_type: "all",
      audience_filters: {},
      template: "marketing-email-v1",
      content: {
        text: "hello",
      },
    })

    await pgConnection.raw(
      `
        insert into marketing_delivery_journal (
          id,
          campaign_id,
          customer_id,
          channel,
          recipient,
          recipient_snapshot,
          delivery_status,
          decision_reason,
          notification_id,
          template,
          payload
        )
        values (?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?::jsonb)
        returning *
      `,
      [
        "mdj_fixed",
        campaign.id,
        "cust_fixed",
        "email",
        "customer@example.com",
        JSON.stringify({ email: "customer@example.com" }),
        "sent",
        null,
        "noti_1",
        "marketing-email-v1",
        JSON.stringify({ ok: true }),
      ]
    )

    const journal = await listMarketingDeliveryJournalByCampaignId(
      pgConnection as any,
      campaign.id
    )

    expect(journal).toHaveLength(1)
    expect(journal[0].notification_id).toBe("noti_1")
  })
})

describe("sendMarketingCampaignWorkflow", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NOTIFICATION_EMAIL_PROVIDER: "local",
      NOTIFICATION_SMS_PROVIDER: "exolve",
      MTS_EXOLVE_API_KEY: "test-api-key",
      MTS_EXOLVE_SENDER: "TEST",
      NOTIFICATION_VK_PROVIDER: "community",
      VK_COMMUNITY_ACCESS_TOKEN: "vk-token",
      VK_COMMUNITY_GROUP_ID: "123456",
    }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    jest.restoreAllMocks()
  })

  it("sends eligible recipients and journals consent/frequency skips", async () => {
    const campaigns = new Map<string, any>([
      [
        "mc_1",
        {
          id: "mc_1",
          name: "Email blast",
          description: null,
          channel: "email",
          audience_type: "all",
          audience_filters: {},
          template: "marketing-email-v1",
          subject: "Hello",
          content: { text: "Hi" },
          status: "draft",
          created_by: "user_1",
          launched_at: null,
          completed_at: null,
          last_error: null,
          frequency_cap_window_hours: 24,
          frequency_cap_count: 1,
          total_selected: 0,
          total_sent: 0,
          total_skipped: 0,
          created_at: "2026-04-18T20:00:00.000Z",
          updated_at: "2026-04-18T20:00:00.000Z",
        },
      ],
    ])
    const journalStore: any[] = []
    const updatedCustomers: Array<{ selector: any; update: any }> = []

    const pgConnection = {
      raw: jest.fn(async (sql: string, bindings?: unknown[]) => {
        const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase()

        if (normalized.startsWith("create table") || normalized.startsWith("create index")) {
          return { rows: [] }
        }

        if (normalized.includes("select * from marketing_campaign where id =")) {
          return { rows: [campaigns.get(String(bindings?.[0]))].filter(Boolean) }
        }

        if (normalized.includes("update marketing_campaign set status =")) {
          const current = campaigns.get(String(bindings?.[7]))
          const next = {
            ...current,
            status: bindings?.[0],
            launched_at: bindings?.[1] || current.launched_at,
            completed_at: bindings?.[2],
            last_error: bindings?.[3],
            total_selected: bindings?.[4] ?? current.total_selected,
            total_sent: bindings?.[5] ?? current.total_sent,
            total_skipped: bindings?.[6] ?? current.total_skipped,
            updated_at: "2026-04-18T20:10:00.000Z",
          }
          campaigns.set(String(bindings?.[7]), next)
          return { rows: [next] }
        }

        if (normalized.includes("insert into marketing_delivery_journal")) {
          const row = {
            id: String(bindings?.[0]),
            campaign_id: bindings?.[1],
            customer_id: bindings?.[2],
            channel: bindings?.[3],
            recipient: bindings?.[4],
            recipient_snapshot: bindings?.[5],
            delivery_status: bindings?.[6],
            decision_reason: bindings?.[7],
            notification_id: bindings?.[8],
            template: bindings?.[9],
            payload: bindings?.[10],
            created_at: "2026-04-18T20:05:00.000Z",
            updated_at: "2026-04-18T20:05:00.000Z",
          }
          journalStore.push(row)
          return { rows: [row] }
        }

        if (normalized.includes("select count(*)::int as count from marketing_delivery_journal")) {
          const customerId = bindings?.[0]
          return {
            rows: [{ count: customerId === "cust_freq" ? 1 : 0 }],
          }
        }

        throw new Error(`Unhandled SQL: ${sql}`)
      }),
    }

    const query = {
      graph: jest.fn(async (args: any) => {
        if (args.entity !== "customer") {
          throw new Error(`Unexpected entity ${args.entity}`)
        }

        return {
          data: [
            {
              id: "cust_sent",
              email: "sent@example.com",
              phone: null,
              metadata: {},
            },
            {
              id: "cust_global",
              email: "global@example.com",
              phone: null,
              metadata: {
                marketing: {
                  global_status: "unsubscribed",
                },
              },
            },
            {
              id: "cust_freq",
              email: "freq@example.com",
              phone: null,
              metadata: {},
            },
          ],
        }
      }),
    }

    const notificationModuleService = {
      createNotifications: jest.fn(async (payload: any) => ({
        id: "noti_marketing_1",
        ...payload,
        status: "pending",
      })),
    }

    mockUpdateCustomersRun.mockImplementation(async ({ input }) => {
      updatedCustomers.push(input)
      return { result: input }
    })

    const container = createContainer()
    container.register({
      [ContainerRegistrationKeys.LOGGER]: asValue({
        info: jest.fn(),
        warn: jest.fn(),
      }),
      [ContainerRegistrationKeys.QUERY]: asValue(query),
      [ContainerRegistrationKeys.PG_CONNECTION]: asValue(pgConnection),
      [Modules.NOTIFICATION]: asValue(notificationModuleService),
    })

    const response = await sendMarketingCampaignWorkflow(container as any).run({
      input: {
        campaignId: "mc_1",
        launchedBy: "user_1",
      },
    })

    const result = response.result.result

    expect(result.status).toBe("completed")
    expect(result.total_selected).toBe(3)
    expect(result.total_sent).toBe(1)
    expect(result.total_skipped).toBe(2)
    expect(notificationModuleService.createNotifications).toHaveBeenCalledTimes(1)
    expect(journalStore.map((row) => row.decision_reason)).toEqual([
      null,
      "global_unsubscribe",
      "frequency_cap_exceeded",
    ])
  })
})
