import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { Footer } from './globals/Footer.ts'
import { Navigation } from './globals/Navigation.ts'
import { SiteSettings } from './globals/SiteSettings.ts'
import { Media } from './collections/Media.ts'
import { Pages } from './collections/Pages.ts'
import { Posts } from './collections/Posts.ts'
import { Users } from './collections/Users.ts'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const parseList = (value?: string) =>
  value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean) || []

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || '',
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || process.env.PAYLOAD_CMS_URL,
  db: postgresAdapter({
    pool: {
      connectionString: process.env.PAYLOAD_DATABASE_URL || process.env.DATABASE_URL,
    },
  }),
  editor: lexicalEditor(),
  collections: [Users, Media, Pages, Posts],
  globals: [SiteSettings, Navigation, Footer],
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
      importMapFile: path.resolve(dirname, 'app', '(payload)', 'importMap.js'),
    },
    components: {
      // Plan plans/product-reviews-module.md §5.1 + §1.4: «Модерация
      // отзывов» is a custom view (data lives in Medusa DB, Payload only
      // provides the moderation UI). Both routes point at the same
      // server component which dispatches between list and detail by
      // inspecting URL segments — see
      // [`Page.tsx`](payload-cms/src/views/product-reviews-moderation/Page.tsx:1).
      views: {
        productReviewsModeration: {
          path: '/product-reviews/moderation',
          Component: '@/views/product-reviews-moderation/Page.tsx#default',
          exact: true,
        },
        productReviewsModerationDetail: {
          path: '/product-reviews/moderation/:id',
          Component: '@/views/product-reviews-moderation/Page.tsx#default',
          exact: true,
        },
      },
      beforeNavLinks: [
        '@/views/product-reviews-moderation/NavLink.tsx#default',
      ],
      // Plan plans/product-reviews-module.md §5.3 + §9 Phase 2 step 3 —
      // мини-виджет «Отзывы на модерации: N» на главной Payload Admin.
      // `beforeDashboard` ставит карточку над `ModularDashboard`, чтобы
      // модератор видел очередь сразу при заходе. Server component
      // переиспользует
      // [`listProductReviewsAdmin`](payload-cms/src/lib/product-reviews-admin-client.ts:1)
      // и не дублирует Medusa Admin API логику.
      beforeDashboard: [
        '@/views/product-reviews-moderation/DashboardWidget.tsx#default',
      ],
    },
  },
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types'),
  },
  cors: parseList(process.env.PAYLOAD_CORS),
  csrf: parseList(process.env.PAYLOAD_CSRF),
  sharp,
})
