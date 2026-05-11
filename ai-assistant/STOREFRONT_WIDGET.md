# Storefront Widget Plan

## 1. Purpose

Add customer-facing AI assistant UI to the Next.js storefront.

Primary placements:

- global floating chat widget;
- product page assistant;
- category/store page guided selling assistant;
- cart assistant.

## 2. Target files

Target implementation location:

```text
medusa-agency-boilerplate-storefront/src/modules/assistant/
├── components/
│   ├── assistant-launcher.tsx
│   ├── chat-widget.tsx
│   ├── chat-panel.tsx
│   ├── chat-message.tsx
│   ├── product-suggestion-card.tsx
│   ├── citations.tsx
│   └── quick-prompts.tsx
├── hooks/
│   ├── use-assistant-chat.ts
│   └── use-assistant-session.ts
├── lib/
│   ├── assistant-client.ts
│   ├── stream.ts
│   └── storage.ts
├── types.ts
└── index.ts
```

## 3. UX states

- closed launcher;
- opening animation;
- empty state with quick prompts;
- user message;
- assistant streaming message;
- product suggestions;
- citations/sources;
- action buttons;
- error state;
- feedback state.

## 4. Suggested quick prompts

Generic:

- `Помоги выбрать товар`
- `Что лучше подойдет для подарка?`
- `Расскажи про доставку и возврат`
- `Сравни эти товары`

Product page:

- `Подойдет ли мне этот товар?`
- `Чем он отличается от похожих?`
- `Какие есть альтернативы?`
- `Что купить вместе с ним?`

Cart:

- `Ничего ли я не забыл?`
- `Есть ли более выгодная альтернатива?`
- `Объясни условия доставки`

## 5. Client contract

The widget should call a same-origin endpoint where possible:

```text
POST /api/assistant/chat/stream
```

or Medusa store proxy:

```text
POST {MEDUSA_BACKEND_URL}/store/assistant/chat
```

The browser should not know `AI_ASSISTANT_SERVER_TOKEN`.

## 6. Session management

Store anonymous assistant session id in localStorage or cookie:

```text
assistant_session_id=uuid
```

Attach browser-safe current context when available:

- anonymous assistant `session_id`;
- countryCode;
- locale;
- store/tenant id;
- product id;
- category handle;
- current URL.

The widget must not send `customer_id` or server tokens. When the customer logs in, the existing anonymous `session_id` remains in localStorage and Medusa derives the authenticated customer server-side in `/store/assistant/chat`, then calls the assistant `POST /api/v1/admin/sessions/bind` endpoint. This keeps anonymous-to-authenticated history binding trusted while preserving the browser-only session handoff.

## 7. Product card schema

```ts
export type AssistantProductSuggestion = {
  id: string
  handle: string
  title: string
  thumbnail?: string
  price?: string
  availability?: 'in_stock' | 'out_of_stock' | 'unknown'
  reason: string
  url: string
  actions?: AssistantAction[]
}
```

## 8. Actions

Supported UI actions:

- open product page;
- add to cart;
- ask follow-up;
- compare;
- request human support.

Mutating action flow:

1. Assistant proposes action.
2. User clicks button.
3. UI asks confirmation if needed.
4. Storefront calls Medusa action/API.
5. Assistant receives updated cart context on next turn.

## 9. Visual design direction

- Keep compatible with existing Tailwind storefront.
- Compact floating launcher.
- Product cards should look native to storefront.
- Streaming text should feel responsive.
- Avoid generic SaaS chatbot appearance; assistant should look like part of the shop.

## 10. Accessibility

- Keyboard navigable.
- ARIA labels for launcher and chat panel.
- Focus trap while panel is open.
- Announce streamed messages politely.
- Escape closes panel.
