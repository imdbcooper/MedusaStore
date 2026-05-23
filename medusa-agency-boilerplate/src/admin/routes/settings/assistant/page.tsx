/**
 * PR 4 — Admin-страница «AI Ассистент».
 *
 * `defineRouteConfig` помещает запись в боковую панель. URL формируется
 * из директории: `routes/settings/assistant/page.tsx` → `/app/settings/assistant`.
 *
 * Страница состоит из пяти вкладок (Tabs из `@medusajs/ui`):
 *   - «Провайдеры» — таблица + drawer + drag-and-drop fallback;
 *   - «Общие настройки» — форма для singleton с optimistic concurrency;
 *   - «Telegram / Handoff» — настройки Telegram handoff, diagnostics и live connection test;
 *   - «Индексация и статус» — reindex каталога, sync knowledge и runtime;
 *   - «Состояние» — массовый probe + снапшот последних тестов.
 *
 * Каждая вкладка — отдельный feature-component из `./components/*`.
 * Здесь только Tabs-обёртка и общий заголовок страницы.
 *
 * `Toaster` рендерится один раз на странице — все toast-вызовы из
 * вложенных компонентов попадают в этот общий контейнер.
 */

import { defineRouteConfig } from "@medusajs/admin-sdk"
import { AiAssistent } from "@medusajs/icons"
import { Container, Heading, Tabs, Text, Toaster } from "@medusajs/ui"

import GeneralTab from "./components/general-tab"
import HealthTab from "./components/health-tab"
import OperationsTab from "./components/operations-tab"
import ProvidersTab from "./components/providers-tab"
import TelegramHandoffTab from "./components/telegram-handoff-tab"
import { assistantCopy } from "./lib/copy"

const AssistantSettingsPage = () => {
  return (
    <Container className="p-0">
      <Toaster />

      <div className="flex flex-col gap-1 px-6 pt-6 pb-4">
        <Heading level="h1">{assistantCopy.pageTitle}</Heading>
        <Text className="text-ui-fg-subtle" size="small">
          {assistantCopy.pageSubtitle}
        </Text>
      </div>

      <Tabs defaultValue="providers">
        <div className="border-b border-ui-border-base px-6">
          <Tabs.List>
            <Tabs.Trigger value="providers">
              {assistantCopy.tabs.providers}
            </Tabs.Trigger>
            <Tabs.Trigger value="general">
              {assistantCopy.tabs.general}
            </Tabs.Trigger>
            <Tabs.Trigger value="telegram-handoff">
              {assistantCopy.tabs.telegramHandoff}
            </Tabs.Trigger>
            <Tabs.Trigger value="operations">
              {assistantCopy.tabs.operations}
            </Tabs.Trigger>
            <Tabs.Trigger value="health">
              {assistantCopy.tabs.health}
            </Tabs.Trigger>
          </Tabs.List>
        </div>
        <Tabs.Content value="providers">
          <ProvidersTab />
        </Tabs.Content>
        <Tabs.Content value="general">
          <GeneralTab />
        </Tabs.Content>
        <Tabs.Content value="telegram-handoff">
          <TelegramHandoffTab />
        </Tabs.Content>
        <Tabs.Content value="operations">
          <OperationsTab />
        </Tabs.Content>
        <Tabs.Content value="health">
          <HealthTab />
        </Tabs.Content>
      </Tabs>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: assistantCopy.pageTitle,
  icon: AiAssistent,
})

export default AssistantSettingsPage
