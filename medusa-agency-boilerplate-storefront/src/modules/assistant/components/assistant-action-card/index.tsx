"use client"

import { type FormEvent, useState } from "react"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

import { submitAssistantHandoff } from "../../lib/client"
import type { AssistantAction, AssistantHandoffResponse } from "../../types"

type AssistantActionCardProps = {
  action: AssistantAction
  fallbackSummary?: string
  messageId?: string
  storeId?: string
  locale?: string
  onSubmitted?: (response: AssistantHandoffResponse) => void
}

const HANDOFF_REASON_LABELS: Record<string, string> = {
  enterprise_low_confidence_recommendation: "Запрос выглядит консультационным и требует более точного пресейла.",
  enterprise_compare_requires_more_context: "Для полезного сравнения не хватает контекста по целям и критериям выбора.",
  enterprise_retrieval_unavailable: "Нужна ручная проверка, потому что автоматическое извлечение данных сейчас недоступно.",
  enterprise_ungrounded_request: "Запрос не удалось надёжно привязать к текущему каталогу или базе знаний.",
}

function getPayload(action: AssistantAction) {
  return action.payload && typeof action.payload === "object" ? action.payload : undefined
}

function getHandoffReason(action: AssistantAction) {
  const reason = getPayload(action)?.reason

  return typeof reason === "string" && reason in HANDOFF_REASON_LABELS
    ? HANDOFF_REASON_LABELS[reason]
    : "Нужна передача запроса специалисту, чтобы продолжить подбор без догадок."
}

function getSummary(action: AssistantAction, fallbackSummary?: string) {
  const summary = getPayload(action)?.summary
  return typeof summary === "string" && summary.trim() ? summary.trim() : fallbackSummary?.trim() || null
}

function summarizeForPreview(summary: string | null) {
  if (!summary) {
    return null
  }

  return summary.length > 220 ? `${summary.slice(0, 219)}…` : summary
}

function getSessionId(action: AssistantAction) {
  const sessionId = getPayload(action)?.session_id

  return typeof sessionId === "string" && sessionId.trim() ? sessionId.trim() : null
}

function getStoreId(action: AssistantAction, fallback?: string) {
  const storeId = getPayload(action)?.store_id

  return typeof storeId === "string" && storeId.trim() ? storeId.trim() : fallback
}

function getLocale(action: AssistantAction, fallback?: string) {
  const locale = getPayload(action)?.locale

  return typeof locale === "string" && locale.trim() ? locale.trim() : fallback
}

function getReasonCode(action: AssistantAction) {
  const reason = getPayload(action)?.reason

  return typeof reason === "string" && reason.trim() ? reason.trim() : undefined
}

function isUuidLike(value?: string | null) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
}

export default function AssistantActionCard({
  action,
  fallbackSummary,
  messageId,
  storeId,
  locale,
  onSubmitted,
}: AssistantActionCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [note, setNote] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submittedHandoffId, setSubmittedHandoffId] = useState<string | null>(null)

  if (action.type !== "request_human_follow_up") {
    return null
  }

  const summary = getSummary(action, fallbackSummary)
  const summaryPreview = summarizeForPreview(summary)
  const sessionId = getSessionId(action)
  const reasonCode = getReasonCode(action)
  const effectiveStoreId = getStoreId(action, storeId)
  const effectiveLocale = getLocale(action, locale)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!sessionId) {
      setSubmitError("Не удалось определить сессию диалога. Откройте страницу контактов.")
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const response = await submitAssistantHandoff({
        session_id: sessionId,
        message_id: isUuidLike(messageId) ? messageId : undefined,
        store_id: effectiveStoreId,
        locale: effectiveLocale,
        source: "assistant_widget",
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        summary: summary || undefined,
        reason: reasonCode,
        note: note.trim() || undefined,
        metadata: {
          submitted_from: "assistant_action_card",
        },
      })
      setSubmittedHandoffId(response.handoff_id)
      onSubmitted?.(response)
      setExpanded(false)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Не удалось передать запрос специалисту.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-ui-border-base bg-ui-bg-base p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ui-fg-muted">
            Нужна помощь специалиста
          </p>
          <p className="mt-1 text-sm font-medium text-ui-fg-base">
            {action.label || "Передать запрос специалисту"}
          </p>
        </div>
        <span className="rounded-full bg-ui-tag-blue-bg px-2 py-1 text-[11px] font-medium text-ui-fg-base">
          human handoff
        </span>
      </div>

      <p className="mt-2 text-sm leading-6 text-ui-fg-subtle">{getHandoffReason(action)}</p>

      {summaryPreview && (
        <div className="mt-3 rounded-md bg-ui-bg-subtle px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ui-fg-muted">Краткий бриф</p>
          <p className="mt-1 text-sm leading-6 text-ui-fg-base">{summaryPreview}</p>
        </div>
      )}

      {submittedHandoffId ? (
        <div className="mt-3 rounded-md border border-ui-border-base bg-ui-bg-subtle px-3 py-3">
          <p className="text-sm font-medium text-ui-fg-base">Запрос передан специалисту.</p>
          <p className="mt-1 text-xs text-ui-fg-subtle">
            ID обращения: {submittedHandoffId}. Если нужно, продолжайте диалог здесь или перейдите на страницу
            контактов.
          </p>
        </div>
      ) : (
        <>
          {expanded ? (
            <form className="mt-3 space-y-3" onSubmit={onSubmit}>
              <label className="block text-xs font-medium text-ui-fg-muted">
                Имя
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Как к вам обращаться"
                  className="mt-1 w-full rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-2 text-sm text-ui-fg-base outline-none focus:border-ui-border-interactive"
                />
              </label>
              <label className="block text-xs font-medium text-ui-fg-muted">
                Email
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@company.com"
                  className="mt-1 w-full rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-2 text-sm text-ui-fg-base outline-none focus:border-ui-border-interactive"
                />
              </label>
              <label className="block text-xs font-medium text-ui-fg-muted">
                Телефон или Telegram
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+7 ... или @username"
                  className="mt-1 w-full rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-2 text-sm text-ui-fg-base outline-none focus:border-ui-border-interactive"
                />
              </label>
              <label className="block text-xs font-medium text-ui-fg-muted">
                Комментарий
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Что важно учесть при обратной связи"
                  className="mt-1 min-h-[88px] w-full rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-2 text-sm text-ui-fg-base outline-none focus:border-ui-border-interactive"
                />
              </label>
              {submitError && <p className="text-xs text-ui-fg-error">{submitError}</p>}
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex rounded-full bg-ui-button-inverted px-3 py-2 text-xs font-medium text-ui-fg-on-inverted transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Отправляем…" : "Передать запрос"}
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="inline-flex rounded-full border border-ui-border-base px-3 py-2 text-xs font-medium text-ui-fg-base transition hover:bg-ui-bg-subtle"
                >
                  Скрыть форму
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="inline-flex rounded-full bg-ui-button-inverted px-3 py-2 text-xs font-medium text-ui-fg-on-inverted transition hover:opacity-90"
              >
                Оставить контакты
              </button>
              <LocalizedClientLink
                href="/contacts"
                className="inline-flex rounded-full border border-ui-border-base px-3 py-2 text-xs font-medium text-ui-fg-base transition hover:bg-ui-bg-subtle"
              >
                Открыть страницу контактов
              </LocalizedClientLink>
              {sessionId && <span className="text-[11px] text-ui-fg-muted">Сессия: {sessionId}</span>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
