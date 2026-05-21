import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { getAssistantAdapterRuntime } from "../modules/assistant-runtime"

const DEFAULT_LIMIT = 10
const DEFAULT_RETRY_BACKOFF_SECONDS = 60

export default async function assistantReindexQueueDrainJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const runtime = getAssistantAdapterRuntime()

  if (!runtime.enabled || !runtime.client) {
    return
  }

  try {
    const result = await runtime.client.processReindexQueue({
      limit: DEFAULT_LIMIT,
      retry_backoff_seconds: DEFAULT_RETRY_BACKOFF_SECONDS,
    })
    const claimed = numberField(result, "claimed")
    if (claimed > 0) {
      logger.info(
        `[assistant-adapter] scheduled reindex drain claimed=${claimed} pending=${numberField(result, "stats.pending")} error=${numberField(result, "stats.error")}`
      )
    }
  } catch (error) {
    logger.error(
      `[assistant-adapter] scheduled reindex drain failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

export const config = {
  name: "assistant-reindex-queue-drain",
  schedule: "* * * * *",
}

function numberField(value: unknown, path: "claimed" | "stats.pending" | "stats.error") {
  const [head, tail] = path.split(".")
  if (!value || typeof value !== "object" || !(head in value)) {
    return 0
  }

  const current = (value as Record<string, unknown>)[head]
  const target = tail && current && typeof current === "object" ? (current as Record<string, unknown>)[tail] : current
  return typeof target === "number" && Number.isFinite(target) ? target : 0
}
