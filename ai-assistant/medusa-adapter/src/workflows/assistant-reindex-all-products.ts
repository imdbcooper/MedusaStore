import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { requireAssistantBackendClient } from "../modules/assistant-runtime"
import { withAssistantRetry } from "./assistant-reindex-product"

export type AssistantReindexAllProductsWorkflowInput = {
  storeId?: string
  locale?: string
  regionId?: string
  currencyCode?: string
  reason?: string
  maxRetries?: number
}

export type AssistantReindexAllProductsWorkflowOutput = {
  status: "completed"
  scope: "all_products"
  assistant_job_id?: string
  reason?: string
  result?: unknown
}

const assistantReindexAllProductsStep = createStep(
  "assistant-reindex-all-products-step",
  async (input: AssistantReindexAllProductsWorkflowInput) => {
    const client = requireAssistantBackendClient()
    const result = await withAssistantRetry(
      () =>
        client.reindex({
          store_id: input.storeId || "default",
          locale: input.locale || "ru",
          full: true,
          region_id: input.regionId,
          currency_code: input.currencyCode,
        }),
      input.maxRetries ?? 2
    )

    return new StepResponse<AssistantReindexAllProductsWorkflowOutput>({
      status: "completed",
      scope: "all_products",
      assistant_job_id: extractAssistantJobId(result),
      reason: input.reason,
      result,
    })
  }
)

const assistantReindexAllProductsWorkflow = createWorkflow(
  "assistant-reindex-all-products-workflow",
  (input: AssistantReindexAllProductsWorkflowInput) => {
    const result = assistantReindexAllProductsStep(input)

    return new WorkflowResponse<{ result: AssistantReindexAllProductsWorkflowOutput }>({
      result,
    })
  }
)

export default assistantReindexAllProductsWorkflow

function extractAssistantJobId(result: unknown): string | undefined {
  if (!result || typeof result !== "object" || !("job" in result)) {
    return undefined
  }

  const job = (result as { job?: { job_id?: string } }).job
  return job?.job_id
}
