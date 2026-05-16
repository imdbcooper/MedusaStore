import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { Footer } from './globals/Footer.ts'
import { Navigation } from './globals/Navigation.ts'
import { SiteSettings } from './globals/SiteSettings.ts'
import { MarketingCampaigns } from './collections/MarketingCampaigns/index.ts'
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
  collections: [Users, Media, Pages, Posts, MarketingCampaigns],
  globals: [SiteSettings, Navigation, Footer],
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
      importMapFile: path.resolve(dirname, 'app', '(payload)', 'importMap.js'),
    },
  },
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types'),
  },
  cors: parseList(process.env.PAYLOAD_CORS),
  csrf: parseList(process.env.PAYLOAD_CSRF),
  sharp,
})
