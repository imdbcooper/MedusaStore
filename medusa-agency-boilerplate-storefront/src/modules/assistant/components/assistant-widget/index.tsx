"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"

import { fetchAssistantHistory, sendAssistantMessage } from "../../lib/client"
import { loadAssistantHistory, mergeAssistantMessages, saveAssistantHistory } from "../../lib/history"
import { getAssistantSessionId } from "../../lib/session"
import type { AssistantChatResponse, AssistantHistoryMessage, AssistantMessage } from "../../types"
import AssistantActionCard from "../assistant-action-card"
import AssistantMarkdown from "../assistant-markdown"
import AssistantProductCard from "../assistant-product-card"

type AssistantWidgetProps = {
  countryCode: string
  locale?: string
  storeId?: string
  currencyCode?: string
}

const INITIAL_MESSAGE: AssistantMessage = {
  id: "assistant-welcome",
  role: "assistant",
  content: "Здравствуйте! Я помогу подобрать товар, объяснить доставку или сориентироваться по магазину.",
}

function createMessageId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function toAssistantMessage(response: AssistantChatResponse): AssistantMessage {
  return {
    id: response.message_id || createMessageId("assistant"),
    role: "assistant",
    content: response.answer,
    products: response.products,
    actions: response.actions,
    safety: response.safety,
  }
}

function toVisibleMessage(message: AssistantHistoryMessage): AssistantMessage | null {
  if (message.role === "tool") {
    return null
  }

  return {
    id: message.id,
    role: message.role,
    content: message.content,
    products: message.products,
    actions: message.actions,
    safety: message.safety,
  }
}

function hasActionType(message: AssistantMessage, type: string) {
  return message.actions?.some((action) => action.type === type) === true
}

export default function AssistantWidget({
  countryCode,
  locale = "ru",
  storeId = "default",
  currencyCode = "rub",
}: AssistantWidgetProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<AssistantMessage[]>([INITIAL_MESSAGE])
  const [isPending, startTransition] = useTransition()
  const messagesViewportRef = useRef<HTMLDivElement | null>(null)
  const sessionId = useMemo(() => getAssistantSessionId(), [])
  const historyScope = useMemo(() => ({ storeId, locale, countryCode }), [countryCode, locale, storeId])

  useEffect(() => {
    const snapshot = loadAssistantHistory(historyScope, sessionId)
    if (snapshot?.messages.length) {
      setMessages(snapshot.messages)
    }
  }, [historyScope, sessionId])

  useEffect(() => {
    saveAssistantHistory(historyScope, sessionId, messages)
  }, [historyScope, messages, sessionId])

  useEffect(() => {
    if (!sessionId) {
      return
    }

    let cancelled = false

    fetchAssistantHistory({
      session_id: sessionId,
      store_id: storeId,
      locale,
      limit: 50,
    })
      .then((history) => {
        if (cancelled || history.session_id !== sessionId) {
          return
        }

        const remoteMessages = history.messages
          .map(toVisibleMessage)
          .filter((message): message is AssistantMessage => Boolean(message))

        if (!remoteMessages.length) {
          return
        }

        setMessages((current) => mergeAssistantMessages(current, remoteMessages))
      })
      .catch(() => {
        // Background sync failures should not interrupt the restored local chat UI.
      })

    return () => {
      cancelled = true
    }
  }, [historyScope, locale, sessionId, storeId])

  useEffect(() => {
    if (!open) {
      return
    }

    const viewport = messagesViewportRef.current
    if (!viewport) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: messages.length > 1 ? "smooth" : "auto",
      })
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [isPending, messages, open])

  const canSend = input.trim().length > 0 && !isPending

  function submitMessage() {
    const message = input.trim()
    if (!message || isPending) {
      return
    }

    const userMessage: AssistantMessage = {
      id: createMessageId("user"),
      role: "user",
      content: message,
    }

    setMessages((current) => [...current, userMessage])
    setInput("")

    startTransition(async () => {
      try {
        const response = await sendAssistantMessage({
          message,
          session_id: sessionId,
          store_id: storeId,
          locale,
          currency_code: currencyCode,
          mode: "auto",
          page_context: {
            type: "storefront",
            url: window.location.pathname,
          },
        })

        setMessages((current) => [...current, toAssistantMessage(response)])
      } catch (error) {
        setMessages((current) => [
          ...current,
          {
            id: createMessageId("assistant_error"),
            role: "assistant",
            content: "Не удалось получить ответ ассистента. Попробуйте повторить позже.",
            error: error instanceof Error ? error.message : "assistant_request_failed",
          },
        ])
      }
    })
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3">
      {open && (
        <section
          aria-label="AI shopping assistant"
          className="flex h-[min(620px,calc(100vh-7rem))] min-h-0 w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-ui-border-base bg-ui-bg-base shadow-elevation-card-rest"
        >
          <header className="flex items-start justify-between gap-4 border-b border-ui-border-base px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-ui-fg-base">AI-помощник</p>
              <p className="text-xs text-ui-fg-subtle">Ответы, подбор товаров и безопасные рекомендации</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full px-2 py-1 text-sm text-ui-fg-subtle hover:bg-ui-bg-subtle"
              aria-label="Закрыть помощника"
            >
              ×
            </button>
          </header>

          <div ref={messagesViewportRef} className="flex-1 min-h-0 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((message) => {
              const isUser = message.role === "user"
              return (
                <article
                  key={message.id}
                  className={`rounded-xl px-3 py-2 ${
                    isUser ? "ml-8 bg-ui-tag-blue-bg text-ui-fg-base" : "mr-3 bg-ui-bg-subtle text-ui-fg-base"
                  }`}
                >
                  <AssistantMarkdown content={message.content} />
                  {message.error && (
                    <p className="mt-2 text-xs text-ui-fg-error">Техническая деталь: {message.error}</p>
                  )}
                  {message.products && message.products.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.products.map((product, index) => (
                        <AssistantProductCard
                          key={product.id || product.product_id || product.handle || index}
                          countryCode={countryCode}
                          product={product}
                          liveDataChecked={message.safety?.live_data_checked === true}
                        />
                      ))}
                    </div>
                  )}
                  {message.actions?.some((action) => action.type === "add_to_cart_proposal") && (
                    <p className="mt-3 rounded-md bg-ui-bg-base px-2 py-1 text-xs text-ui-fg-subtle">
                      Добавление в корзину требует подтверждения. Используйте карточку товара и стандартную кнопку магазина.
                    </p>
                  )}
                  {hasActionType(message, "request_human_follow_up") && (
                    <div className="space-y-2">
                      {message.actions
                        ?.filter((action) => action.type === "request_human_follow_up")
                        .map((action, index) => (
                          <AssistantActionCard
                            key={`${message.id}_handoff_${index}`}
                            action={action}
                            fallbackSummary={message.content}
                            messageId={message.id}
                            storeId={storeId}
                            locale={locale}
                          />
                        ))}
                    </div>
                  )}
                </article>
              )
            })}
            {isPending && (
              <div className="mr-8 rounded-xl bg-ui-bg-subtle px-3 py-2 text-sm text-ui-fg-subtle">
                Помощник печатает…
              </div>
            )}
          </div>

          <form
            className="border-t border-ui-border-base p-3"
            onSubmit={(event) => {
              event.preventDefault()
              submitMessage()
            }}
          >
            <label className="sr-only" htmlFor="assistant-message">
              Сообщение помощнику
            </label>
            <div className="flex gap-2">
              <input
                id="assistant-message"
                value={input}
                maxLength={4000}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Например: помоги выбрать подарок"
                className="min-w-0 flex-1 rounded-full border border-ui-border-base bg-ui-bg-base px-4 py-2 text-sm outline-none focus:border-ui-border-interactive"
              />
              <button
                type="submit"
                disabled={!canSend}
                className="rounded-full bg-ui-button-inverted px-4 py-2 text-sm font-medium text-ui-fg-on-inverted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Отправить
              </button>
            </div>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="rounded-full bg-ui-button-inverted px-5 py-3 text-sm font-semibold text-ui-fg-on-inverted shadow-elevation-card-hover transition hover:opacity-90"
        aria-expanded={open}
      >
        {open ? "Свернуть помощника" : "AI-помощник"}
      </button>
    </div>
  )
}
