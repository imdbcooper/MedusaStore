export type AssistantMode = "markdown" | "vector" | "auto" | "lightrag"

export type AssistantPageContext = {
  type?: "product" | "category" | "cart" | "home" | string
  product_id?: string
  product_handle?: string
  category_handle?: string
  url?: string
  [key: string]: unknown
}

export type AssistantChatRequest = {
  message: string
  session_id?: string
  store_id?: string
  region_id?: string
  currency_code?: string
  locale?: string
  mode?: AssistantMode
  page_context?: AssistantPageContext
}

export type AssistantProduct = {
  id?: string
  product_id?: string
  handle?: string
  title?: string
  description?: string
  thumbnail?: string
  price?: string | number | null
  currency_code?: string | null
  availability?: "in_stock" | "out_of_stock" | "unknown" | string
  url?: string
  metadata?: Record<string, unknown>
}

export type AssistantAction = {
  type?: string
  product_id?: string
  variant_id?: string
  quantity?: number
  requires_confirmation?: boolean
  [key: string]: unknown
}

export type AssistantChatResponse = {
  session_id: string
  message_id?: string
  answer: string
  intent?: string
  products?: AssistantProduct[]
  citations?: unknown[]
  actions?: AssistantAction[]
  tool_calls?: unknown[]
  safety?: {
    live_data_checked?: boolean
    [key: string]: unknown
  }
}

export type AssistantHistoryRequest = {
  session_id: string
  store_id?: string
  locale?: string
  limit?: number
}

export type AssistantHistoryResponse = {
  session_id: string
  messages: AssistantHistoryMessage[]
}

export type AssistantHistoryMessage = {
  id: string
  session_id?: string
  role: "user" | "assistant" | "tool" | "system"
  content: string
  intent?: string | null
  products?: AssistantProduct[]
  actions?: AssistantAction[]
  safety?: AssistantChatResponse["safety"]
  created_at?: string
}

export type AssistantMessage = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  products?: AssistantProduct[]
  actions?: AssistantAction[]
  safety?: AssistantChatResponse["safety"]
  pending?: boolean
  error?: string
}
