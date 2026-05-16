import path from 'node:path'
import { fileURLToPath } from 'node:url'
import minimist from '../node_modules/minimist/index.js'
import { migrate } from '../node_modules/payload/dist/bin/migrate.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const rootDir = path.resolve(dirname, '..')

process.chdir(rootDir)

const configModule = await import('../src/payload.config.ts')
let config = configModule.default ?? configModule

if (config && typeof config.then === 'function') {
  config = await config
}

// Replicate the Payload CLI invocation for `migrate:*` commands. We bypass the
// stock `payload` bin because the Payload CLI uses `require()` to load
// `payload.config.ts`, which fails on Node 24 when the config has top-level
// await (`buildConfig` returns a Promise). Re-implementing the entrypoint is
// the same pattern we already use in `generate-types.mjs` /
// `generate-importmap.mjs`.
const parsedArgs = minimist(process.argv.slice(2))

if (!parsedArgs._.length) {
  console.error('Usage: migrate <migrate|migrate:create|migrate:status|...> [name]')
  process.exit(1)
}

await migrate({
  config,
  parsedArgs,
})

process.exit(0)
