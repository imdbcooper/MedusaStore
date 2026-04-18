import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateTypes } from '../node_modules/payload/dist/bin/generateTypes.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const rootDir = path.resolve(dirname, '..')

process.chdir(rootDir)

const configModule = await import('../src/payload.config.ts')
let config = configModule.default ?? configModule

if (config && typeof config.then === 'function') {
  config = await config
}

await generateTypes(config)
