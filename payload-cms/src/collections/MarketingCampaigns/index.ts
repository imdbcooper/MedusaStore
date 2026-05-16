import type { CollectionConfig, Field } from 'payload'
import { journalEndpoint } from './journal-endpoint.ts'
import { launchEndpoint } from './launch-endpoint.ts'

/**
 * MarketingCampaigns — Phase 1 of the marketing UI plan
 * (`plans/marketing-ui-payload-cms.md`).
 *
 * Stores email campaign drafts and a snapshot of the Medusa launch result.
 * Drafts are mutable in Payload; once a draft is launched and a
 * `medusaCampaignId` is persisted, the document becomes read-only — both in
 * the UI (`admin.readOnly` per field) and on the server (collection-level
 * `access.update` + `beforeChange` hook). The launch workflow updates the
 * document via `payload.update({ overrideAccess: true })`, which bypasses
 * those access rules by design.
 */

const STATUS_OPTIONS = [
  { label: 'Черновик', value: 'draft' },
  { label: 'Отправляется', value: 'launching' },
  { label: 'Завершена', value: 'completed' },
  { label: 'Ошибка', value: 'failed' },
] as const

const AUDIENCE_OPTIONS = [
  { label: 'Все клиенты', value: 'all' },
  { label: 'С согласием на email', value: 'email_consent' },
  { label: 'Список customer_id', value: 'manual' },
] as const

/**
 * Content fields that must be frozen once a Medusa campaign exists.
 * Used by the `beforeChange` guard to reject updates that would mutate
 * already-launched drafts.
 */
const FROZEN_CONTENT_FIELDS: ReadonlyArray<keyof MarketingCampaignDocShape> = [
  'name',
  'subject',
  'channel',
  'audienceType',
  'audienceCustomerIds',
  'htmlContent',
  'plainText',
  'frequencyCapHours',
  'frequencyCapCount',
]

type MarketingCampaignDocShape = {
  name?: string
  subject?: string
  channel?: 'email'
  audienceType?: 'all' | 'email_consent' | 'manual'
  audienceCustomerIds?: Array<{ id?: string | null }> | null
  htmlContent?: string
  plainText?: string | null
  frequencyCapHours?: number | null
  frequencyCapCount?: number | null
  status?: 'draft' | 'launching' | 'completed' | 'failed'
  medusaCampaignId?: string | null
  idempotencyKey?: string | null
  medusaStatus?: string | null
  totalSelected?: number | null
  totalSent?: number | null
  totalSkipped?: number | null
  totalFailed?: number | null
  launchedAt?: string | null
  completedAt?: string | null
  lastError?: string | null
  launchResult?: unknown
}

const contentFields: Field[] = [
  {
    name: 'name',
    type: 'text',
    required: true,
    label: 'Название (для маркетолога)',
    admin: {
      description: 'Внутреннее имя кампании. Не показывается получателям.',
    },
  },
  {
    name: 'subject',
    type: 'text',
    required: true,
    label: 'Тема письма',
    admin: {
      description: 'Subject строка email — то, что увидит получатель в инбоксе.',
    },
  },
  {
    name: 'channel',
    type: 'select',
    required: true,
    defaultValue: 'email',
    label: 'Канал',
    options: [{ label: 'Email', value: 'email' }],
    admin: {
      readOnly: true,
      description: 'В Phase 1 поддерживается только email.',
    },
  },
  {
    name: 'htmlContent',
    type: 'textarea',
    required: true,
    label: 'HTML письма',
    admin: {
      rows: 18,
      description:
        'Готовый HTML email. В Phase 1 редактор HTML отсутствует, вставляется текстом.',
    },
  },
  {
    name: 'plainText',
    type: 'textarea',
    label: 'Plain text fallback',
    admin: {
      rows: 6,
      description:
        'Резервный plain-text вариант для клиентов без HTML. Если пусто, backend возьмёт текст из HTML.',
    },
  },
]

const audienceFields: Field[] = [
  {
    name: 'audienceType',
    type: 'select',
    required: true,
    defaultValue: 'email_consent',
    label: 'Тип аудитории',
    options: [...AUDIENCE_OPTIONS],
    admin: {
      description:
        'email_consent — только подписанные на email; all — все с email; manual — указанные customer_id.',
    },
  },
  {
    name: 'audienceCustomerIds',
    type: 'array',
    label: 'Customer IDs',
    labels: {
      singular: 'Customer ID',
      plural: 'Customer IDs',
    },
    admin: {
      description: 'Список Medusa customer_id, по одному на строку.',
      condition: (data) =>
        (data as MarketingCampaignDocShape | undefined)?.audienceType === 'manual',
    },
    fields: [
      {
        name: 'id',
        type: 'text',
        required: true,
        label: 'customer_id',
      },
    ],
  },
]

const limitFields: Field[] = [
  {
    name: 'frequencyCapHours',
    type: 'number',
    label: 'Окно frequency cap (часы)',
    min: 1,
    admin: {
      description: 'Период, в котором действует ограничение по числу отправок одному клиенту.',
    },
  },
  {
    name: 'frequencyCapCount',
    type: 'number',
    label: 'Лимит отправок в окне',
    min: 1,
    max: 100,
    admin: {
      description: 'Сколько писем максимум одному клиенту в окне выше.',
    },
  },
]

const resultFields: Field[] = [
  {
    name: 'status',
    type: 'select',
    defaultValue: 'draft',
    required: true,
    label: 'Статус (Payload)',
    options: [...STATUS_OPTIONS],
    admin: {
      readOnly: true,
      description: 'Управляется автоматически кнопкой «Отправить» и backend-launch.',
    },
  },
  {
    name: 'medusaCampaignId',
    type: 'text',
    label: 'ID кампании в Medusa',
    admin: { readOnly: true },
  },
  {
    name: 'idempotencyKey',
    type: 'text',
    label: 'Idempotency key',
    admin: {
      // Internal — used by the launch endpoint to deduplicate retries.
      // Not surfaced in the UI; kept on the document so a re-submit with
      // the same key short-circuits instead of creating a duplicate.
      hidden: true,
      readOnly: true,
    },
  },
  {
    name: 'medusaStatus',
    type: 'text',
    label: 'Статус в Medusa',
    admin: { readOnly: true },
  },
  {
    name: 'totalSelected',
    type: 'number',
    label: 'Выбрано аудиторией',
    admin: { readOnly: true },
  },
  {
    name: 'totalSent',
    type: 'number',
    label: 'Отправлено',
    admin: { readOnly: true },
  },
  {
    name: 'totalSkipped',
    type: 'number',
    label: 'Пропущено',
    admin: { readOnly: true },
  },
  {
    name: 'totalFailed',
    type: 'number',
    label: 'Ошибки',
    admin: { readOnly: true },
  },
  {
    name: 'launchedAt',
    type: 'date',
    label: 'Запущена в',
    admin: { readOnly: true },
  },
  {
    name: 'completedAt',
    type: 'date',
    label: 'Завершена в',
    admin: { readOnly: true },
  },
  {
    name: 'lastError',
    type: 'textarea',
    label: 'Последняя ошибка / причина',
    admin: { readOnly: true },
  },
  {
    name: 'launchResult',
    type: 'json',
    label: 'Raw launch result (Medusa)',
    admin: { readOnly: true },
  },
]

export const MarketingCampaigns: CollectionConfig = {
  slug: 'marketing-campaigns',
  labels: {
    singular: 'Маркетинговая рассылка',
    plural: 'Маркетинговые рассылки',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: [
      'name',
      'subject',
      'status',
      'audienceType',
      'totalSent',
      'totalFailed',
      'launchedAt',
      'updatedAt',
    ],
    description:
      'Email-рассылки. Сначала создаём черновик, заполняем содержимое и аудиторию, потом нажимаем «Отправить». До запуска документ можно править свободно; после — он становится read-only.',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req, data }) => {
      if (!req.user) return false
      // `data` is the candidate update payload — without an id we cannot
      // tell whether the document is already locked, so allow the request
      // through and let the `beforeChange` hook + per-field `readOnly`
      // catch any mutation of frozen content.
      const candidate = data as MarketingCampaignDocShape | undefined
      if (candidate?.medusaCampaignId) return false
      if (candidate?.status && candidate.status !== 'draft') return false
      return true
    },
    delete: () => false,
  },
  hooks: {
    beforeChange: [
      ({ data, originalDoc, operation }) => {
        if (operation !== 'update' || !originalDoc) {
          return data
        }
        const previous = originalDoc as MarketingCampaignDocShape
        const next = data as MarketingCampaignDocShape

        if (!previous.medusaCampaignId) {
          return data
        }

        for (const field of FROZEN_CONTENT_FIELDS) {
          const before = previous[field]
          const after = next[field]
          if (after === undefined) continue
          if (JSON.stringify(before ?? null) !== JSON.stringify(after ?? null)) {
            throw new Error(
              `Кампания уже отправлена в Medusa (id ${previous.medusaCampaignId}). Поле "${field}" нельзя менять.`,
            )
          }
        }
        return data
      },
    ],
  },
  endpoints: [launchEndpoint, journalEndpoint],
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Содержимое',
          description: 'Тема, HTML и plain-text fallback письма.',
          fields: contentFields,
        },
        {
          label: 'Аудитория',
          description: 'Кому уйдёт рассылка. backend всё равно применит consent-проверки.',
          fields: audienceFields,
        },
        {
          label: 'Ограничения',
          description: 'Frequency cap — защита от спама одного и того же клиента.',
          fields: limitFields,
        },
        {
          label: 'Результат',
          description:
            'Заполняется автоматически после нажатия «Отправить». До запуска поля пустые.',
          fields: [
            {
              name: 'launchAction',
              type: 'ui',
              admin: {
                components: {
                  Field:
                    '@/components/MarketingCampaignLaunchButton/index.tsx#MarketingCampaignLaunchButton',
                },
              },
            },
            ...resultFields,
            {
              name: 'deliveryJournal',
              type: 'ui',
              admin: {
                // Only show the journal once Medusa has acknowledged the
                // campaign — before that there is nothing to render.
                condition: (data) =>
                  Boolean(
                    (data as MarketingCampaignDocShape | undefined)
                      ?.medusaCampaignId,
                  ),
                components: {
                  Field:
                    '@/components/MarketingCampaignDeliveryJournal/index.tsx#MarketingCampaignDeliveryJournal',
                },
              },
            },
          ],
        },
      ],
    },
  ],
}
