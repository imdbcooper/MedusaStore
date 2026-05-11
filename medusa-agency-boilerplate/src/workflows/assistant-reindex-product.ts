import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { requireAssistantBackendClient } from "../modules/assistant-runtime"

export type AssistantReindexProductWorkflowInput = {
  productIds: string[]
  storeId?: string
  locale?: string
  regionId?: string
  currencyCode?: string
  reason?: string
  action?: "reindex" | "delete"
  maxRetries?: number
}

export type AssistantReindexProductWorkflowOutput = {
  status: "completed" | "skipped"
  action: "reindex" | "delete"
  product_ids: string[]
  assistant_job_id?: string
  reason?: string
  result?: unknown
}

const assistantReindexProductStep = createStep(
  "assistant-reindex-product-step",
  async (input: AssistantReindexProductWorkflowInput) => {
    const productIds = uniqueNonEmpty(input.productIds)
    const action = input.action || "reindex"

    if (!productIds.length) {
      return new StepResponse<AssistantReindexProductWorkflowOutput>({
        status: "skipped",
        action,
        product_ids: [],
        reason: "no_product_ids",
      })
    }

    const client = requireAssistantBackendClient()
    const result = await withAssistantRetry(
      async () => {
        if (action === "delete") {
          const deletions: Record<string, unknown>[] = []
          for (const productId of productIds) {
            deletions.push(
              await client.deleteProductFromIndex({
                product_id: productId,
                store_id: input.storeId || "default",
                locale: input.locale || "ru",
              })
            )
          }
          return { deletions }
        }

        return client.reindex({
          store_id: input.storeId || "default",
          locale: input.locale || "ru",
          full: false,
          product_ids: productIds,
          region_id: input.regionId,
          currency_code: input.currencyCode,
        })
      },
      input.maxRetries ?? 2
    )

    return new StepResponse<AssistantReindexProductWorkflowOutput>({
      status: "completed",
      action,
      product_ids: productIds,
      assistant_job_id: extractAssistantJobId(result),
      reason: input.reason,
      result,
    })
  }
)

const assistantReindexProductWorkflow = createWorkflow(
  "assistant-reindex-product-workflow",
  (input: AssistantReindexProductWorkflowInput) => {
    const result = assistantReindexProductStep(input)

    return new WorkflowResponse<{ result: AssistantReindexProductWorkflowOutput }>({
      result,
    })
  }
)

export default assistantReindexProductWorkflow

export async function withAssistantRetry<T>(operation: () => Promise<T>, maxRetries: number): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt >= maxRetries || !isRetryableAssistantError(error)) {
        throw error
      }
      await delay(250 * (attempt + 1))
    }
  }

  throw lastError
}

function uniqueNonEmpty(values: string[] = []) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function extractAssistantJobId(result: unknown): string | undefined {
  if (!result || typeof result !== "object" || !("job" in result)) {
    return undefined
  }

  const job = (result as { job?: { job_id?: string } }).job
  return job?.job_id
}

function isRetryableAssistantError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "retryable" in error &&
      (error as { retryable?: unknown }).retryable === true
  )
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
