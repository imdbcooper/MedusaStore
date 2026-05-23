/// <reference types="node" />

import assert from "node:assert/strict"
// @ts-expect-error -- runtime uses Node 24 test runner via --experimental-strip-types
import test from "node:test"

import { mergeAssistantMessages } from "./history.ts"

test("mergeAssistantMessages replaces an optimistic local user message with the persisted remote copy", () => {
  const merged = mergeAssistantMessages(
    [
      {
        id: "user_local_1",
        role: "user",
        content: "Помогите выбрать кофемашину",
        created_at: "2026-05-23T12:00:00.000Z",
        pending: true,
      },
      {
        id: "assistant_local_1",
        role: "assistant",
        content: "Сейчас помогу.",
      },
    ],
    [
      {
        id: "remote_user_1",
        role: "user",
        content: "Помогите выбрать кофемашину",
        created_at: "2026-05-23T12:00:04.000Z",
      },
      {
        id: "remote_assistant_1",
        role: "assistant",
        content: "Вот несколько моделей для начала.",
      },
    ]
  )

  assert.deepEqual(
    merged.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      pending: message.pending,
    })),
    [
      {
        id: "remote_user_1",
        role: "user",
        content: "Помогите выбрать кофемашину",
        pending: undefined,
      },
      {
        id: "assistant_local_1",
        role: "assistant",
        content: "Сейчас помогу.",
        pending: undefined,
      },
      {
        id: "remote_assistant_1",
        role: "assistant",
        content: "Вот несколько моделей для начала.",
        pending: undefined,
      },
    ]
  )
})

test("mergeAssistantMessages keeps repeated same-content user messages outside the optimistic replacement window", () => {
  const merged = mergeAssistantMessages(
    [
      {
        id: "user_local_1",
        role: "user",
        content: "Да",
        created_at: "2026-05-23T12:00:00.000Z",
        pending: true,
      },
    ],
    [
      {
        id: "remote_user_1",
        role: "user",
        content: "Да",
        created_at: "2026-05-23T12:03:30.000Z",
      },
    ]
  )

  assert.deepEqual(
    merged.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      pending: message.pending,
    })),
    [
      {
        id: "user_local_1",
        role: "user",
        content: "Да",
        pending: true,
      },
      {
        id: "remote_user_1",
        role: "user",
        content: "Да",
        pending: undefined,
      },
    ]
  )
})
