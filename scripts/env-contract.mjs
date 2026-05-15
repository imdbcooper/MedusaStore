#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import process from "node:process"

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")

const args = process.argv.slice(2)
const command = args[0]

function option(name, fallback = "") {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

function parseEnvFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8")
  const entries = []
  const values = new Map()

  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    let line = rawLine.trim()
    if (!line || line.startsWith("#")) {
      continue
    }
    if (line.startsWith("export ")) {
      line = line.slice("export ".length).trimStart()
    }
    const equalsIndex = line.indexOf("=")
    if (equalsIndex < 1) {
      continue
    }
    const key = line.slice(0, equalsIndex).trim()
    let value = line.slice(equalsIndex + 1).trimStart()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue
    }
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1)
    } else {
      value = value.trimEnd()
    }
    entries.push({ key, value, line: index + 1 })
    values.set(key, value)
  }

  return { entries, values }
}

function bool(value) {
  return String(value || "").trim().toLowerCase() === "true"
}

function present(value) {
  return typeof value === "string" && value.trim() !== ""
}

function isPlaceholder(value) {
  const trimmed = String(value || "").trim()
  return (
    trimmed === "supersecret" ||
    trimmed === "pk_build_placeholder" ||
    trimmed === "REPLACE_WITH_ROOT_BOOTSTRAP" ||
    /\bCHANGE_ME\b/.test(trimmed) ||
    trimmed.includes("CHANGE_ME_")
  )
}

function quoteEnvValue(value) {
  const stringValue = String(value ?? "")
  if (stringValue.includes("\n") || stringValue.includes("\r")) {
    throw new Error("Env values must not contain newlines.")
  }
  if (stringValue === "") {
    return ""
  }
  if (/^[A-Za-z0-9_./:@%+=,\-#]+$/.test(stringValue)) {
    return stringValue
  }
  return `"${stringValue.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
}

function put(map, key, value) {
  map.set(key, String(value ?? ""))
}

function get(map, key) {
  return map.get(key) || ""
}

function effective(map, key, fallback = "") {
  const value = get(map, key)
  return present(value) && !isPlaceholder(value) ? value : fallback
}

function putDefault(map, key, value) {
  if (!present(get(map, key)) || isPlaceholder(get(map, key))) {
    put(map, key, value)
  }
}

function contractValues(contractPath, { useProcessEnv = false } = {}) {
  const contract = parseEnvFile(contractPath)
  const map = new Map()

  for (const { key, value } of contract.entries) {
    const envValue = process.env[key]
    map.set(key, useProcessEnv && present(envValue) ? envValue : value)
  }

  return { contract, map }
}

function deriveStaging(map) {
  const deployDomain = effective(map, "DEPLOY_DOMAIN", "studio.slavx.ru")
  const postgresUser = effective(map, "POSTGRES_USER", "postgres")
  const postgresPassword = effective(map, "POSTGRES_PASSWORD")
  const postgresDb = effective(map, "POSTGRES_DB", "medusa")
  const publicBaseUrl = `https://${deployDomain}`
  const medusaDbUrl = `postgresql://${postgresUser}:${postgresPassword}@medusa-db:5432/${postgresDb}?sslmode=disable`
  const payloadDbUrl = `postgresql://${postgresUser}:${postgresPassword}@medusa-db:5432/payload_cms?sslmode=disable`

  putDefault(map, "DEPLOY_DOMAIN", deployDomain)
  putDefault(map, "ACME_EMAIL", `admin@${deployDomain}`)
  putDefault(map, "HTTP_PORT", "80")
  putDefault(map, "HTTPS_PORT", "443")
  putDefault(map, "COMPOSE_PROJECT_NAME", "medusastore")
  putDefault(map, "NODE_ENV", "production")
  putDefault(map, "POSTGRES_USER", postgresUser)
  putDefault(map, "POSTGRES_DB", postgresDb)
  putDefault(map, "DOCKER_DATABASE_URL", medusaDbUrl)
  putDefault(map, "DATABASE_URL", medusaDbUrl)
  putDefault(map, "DOCKER_PAYLOAD_DATABASE_URL", payloadDbUrl)
  putDefault(map, "PAYLOAD_DATABASE_URL", payloadDbUrl)
  putDefault(map, "DOCKER_REDIS_URL", "redis://medusa-redis:6379")
  putDefault(map, "REDIS_URL", "redis://medusa-redis:6379")
  putDefault(map, "MEDUSA_BACKEND_URL", "http://medusa-backend:9000")
  putDefault(map, "DOCKER_MEDUSA_BACKEND_URL", "http://medusa-backend:9000")
  putDefault(map, "NEXT_PUBLIC_MEDUSA_BACKEND_URL", publicBaseUrl)
  putDefault(map, "DOCKER_NEXT_PUBLIC_MEDUSA_BACKEND_URL", publicBaseUrl)
  putDefault(map, "NEXT_PUBLIC_BASE_URL", publicBaseUrl)
  putDefault(map, "DOCKER_NEXT_PUBLIC_BASE_URL", publicBaseUrl)
  putDefault(map, "NEXT_PUBLIC_DEFAULT_REGION", "ru")
  putDefault(map, "STORE_CORS", publicBaseUrl)
  putDefault(map, "ADMIN_CORS", publicBaseUrl)
  putDefault(map, "AUTH_CORS", publicBaseUrl)
  putDefault(map, "STOREFRONT_URL", publicBaseUrl)
  putDefault(map, "PAYLOAD_PORT", "3100")
  putDefault(map, "PAYLOAD_CMS_URL", "http://payload-cms:3100")
  putDefault(map, "DOCKER_PAYLOAD_CMS_URL", "http://payload-cms:3100")
  putDefault(map, "PAYLOAD_PUBLIC_SERVER_URL", `${publicBaseUrl}/payload`)
  putDefault(map, "STOREFRONT_PREVIEW_URL", publicBaseUrl)
  putDefault(map, "STOREFRONT_PREVIEW_LOCALE", "ru")
  putDefault(map, "STOREFRONT_REVALIDATE_URL", "http://storefront:8000/api/content/revalidate")
  putDefault(map, "PAYLOAD_CORS", publicBaseUrl)
  putDefault(map, "PAYLOAD_CSRF", `${publicBaseUrl},${publicBaseUrl}/payload`)
  putDefault(map, "RUN_MEDUSA_MIGRATIONS", "true")
  putDefault(map, "RUN_PAYLOAD_MIGRATIONS", "false")
  putDefault(map, "RUN_PAYLOAD_SEED", "false")
  putDefault(map, "VK_ID_REDIRECT_URI", `${publicBaseUrl}/api/auth/vk-id/callback`)
  putDefault(map, "VK_ID_STOREFRONT_RETURN_ORIGINS", publicBaseUrl)
  putDefault(map, "YOOKASSA_RETURN_URL", `${publicBaseUrl}/ru/checkout`)
  putDefault(map, "YOOKASSA_STOREFRONT_RETURN_ORIGINS", publicBaseUrl)
  putDefault(map, "YOOKASSA_WEBHOOK_URL", `${publicBaseUrl}/yookassa/webhook`)
  putDefault(map, "AI_ASSISTANT_BASE_URL", "http://ai-assistant:8000/api/v1")
  putDefault(map, "AI_ASSISTANT_TIMEOUT_MS", "60000")
  putDefault(map, "AI_ASSISTANT_CORS_ORIGINS", publicBaseUrl)
  putDefault(map, "NEXT_PUBLIC_AI_ASSISTANT_CHAT_ENDPOINT", "/store/assistant/chat")

  if (!present(effective(map, "REVALIDATE_SECRET")) && present(effective(map, "STOREFRONT_REVALIDATE_SECRET"))) {
    put(map, "REVALIDATE_SECRET", effective(map, "STOREFRONT_REVALIDATE_SECRET"))
  }
  if (!present(effective(map, "STOREFRONT_REVALIDATE_SECRET")) && present(effective(map, "REVALIDATE_SECRET"))) {
    put(map, "STOREFRONT_REVALIDATE_SECRET", effective(map, "REVALIDATE_SECRET"))
  }

  for (const [key, value] of [...map.entries()]) {
    if (isPlaceholder(value)) {
      put(map, key, "")
    }
  }
}

function deriveLocal(map) {
  const postgresUser = effective(map, "POSTGRES_USER", "postgres")
  const postgresPassword = effective(map, "POSTGRES_PASSWORD")
  const postgresDb = effective(map, "POSTGRES_DB", "medusa")
  const postgresPort = effective(map, "POSTGRES_PORT", "5433")
  const redisPort = effective(map, "REDIS_PORT", "6379")
  const backendPort = effective(map, "MEDUSA_BACKEND_PORT", "9000")
  const storefrontPort = effective(map, "STOREFRONT_PORT", "8000")
  const backendUrl = `http://localhost:${backendPort}`
  const storefrontUrl = `http://localhost:${storefrontPort}`

  putDefault(map, "POSTGRES_USER", postgresUser)
  putDefault(map, "POSTGRES_DB", postgresDb)
  putDefault(map, "POSTGRES_PORT", postgresPort)
  putDefault(map, "REDIS_PORT", redisPort)
  putDefault(map, "MEDUSA_BACKEND_PORT", backendPort)
  putDefault(map, "STOREFRONT_PORT", storefrontPort)
  putDefault(map, "DATABASE_URL", `postgresql://${postgresUser}:${postgresPassword}@medusa-db:5432/${postgresDb}`)
  putDefault(map, "REDIS_URL", "redis://medusa-redis:6379")
  putDefault(map, "MEDUSA_BACKEND_URL", backendUrl)
  putDefault(map, "STOREFRONT_URL", storefrontUrl)
  putDefault(map, "NEXT_PUBLIC_BASE_URL", storefrontUrl)
  putDefault(map, "STORE_CORS", `${storefrontUrl},https://docs.medusajs.com`)
  putDefault(map, "ADMIN_CORS", `http://localhost:5173,${backendUrl},https://docs.medusajs.com`)
  putDefault(map, "AUTH_CORS", `http://localhost:5173,${backendUrl},${storefrontUrl},https://docs.medusajs.com`)
  putDefault(map, "YOOKASSA_STOREFRONT_RETURN_ORIGINS", storefrontUrl)
  putDefault(map, "VK_ID_STOREFRONT_RETURN_ORIGINS", storefrontUrl)

  if (!present(get(map, "REVALIDATE_SECRET")) && present(get(map, "STOREFRONT_REVALIDATE_SECRET"))) {
    put(map, "REVALIDATE_SECRET", get(map, "STOREFRONT_REVALIDATE_SECRET"))
  }
}

function validate(map, mode, contract) {
  const errors = []
  const warnings = []
  const required = new Set(
    mode === "staging"
      ? [
          "DEPLOY_DOMAIN",
          "ACME_EMAIL",
          "POSTGRES_USER",
          "POSTGRES_PASSWORD",
          "POSTGRES_DB",
          "JWT_SECRET",
          "COOKIE_SECRET",
          "DATABASE_URL",
          "REDIS_URL",
          "STORE_CORS",
          "ADMIN_CORS",
          "AUTH_CORS",
          "MEDUSA_BACKEND_URL",
          "NEXT_PUBLIC_MEDUSA_BACKEND_URL",
          "NEXT_PUBLIC_BASE_URL",
          "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY",
          "STOREFRONT_URL",
        ]
      : [
          "POSTGRES_USER",
          "POSTGRES_PASSWORD",
          "POSTGRES_DB",
          "DATABASE_URL",
          "REDIS_URL",
          "JWT_SECRET",
          "COOKIE_SECRET",
          "STORE_CORS",
          "ADMIN_CORS",
          "AUTH_CORS",
          "MEDUSA_BACKEND_URL",
          "STOREFRONT_URL",
        ]
  )

  if (bool(get(map, "PAYLOAD_ENABLED"))) {
    for (const key of [
      "PAYLOAD_SECRET",
      "PAYLOAD_DATABASE_URL",
      "PAYLOAD_CMS_URL",
      "PAYLOAD_PUBLIC_SERVER_URL",
    ]) {
      required.add(key)
    }
    if (mode === "staging") {
      required.add("MEDUSA_ADMIN_SECRET_API_KEY")
    }
  }

  if (mode === "staging") {
    required.add("STOREFRONT_REVALIDATE_SECRET")
    required.add("REVALIDATE_SECRET")
  }

  if (bool(get(map, "VK_ID_ENABLED"))) {
    required.add("VK_ID_CLIENT_ID")
    required.add("VK_ID_REDIRECT_URI")
    required.add("VK_ID_SESSION_SECRET")
    required.add("VK_ID_STOREFRONT_RETURN_ORIGINS")
  }

  if (bool(get(map, "NEXT_PUBLIC_YOOKASSA_ENABLED")) || present(get(map, "YOOKASSA_SHOP_ID"))) {
    required.add("YOOKASSA_SHOP_ID")
    required.add("YOOKASSA_SECRET_KEY")
    required.add("YOOKASSA_RETURN_URL")
    required.add("YOOKASSA_STOREFRONT_RETURN_ORIGINS")
  }

  if (bool(get(map, "AI_ASSISTANT_ENABLED"))) {
    required.add("AI_ASSISTANT_BASE_URL")
    required.add("AI_ASSISTANT_API_TOKEN")
    required.add("AI_ASSISTANT_SERVER_TOKEN")
    required.add("AI_ASSISTANT_CORS_ORIGINS")
    required.add("ASSISTANT_POSTGRES_URI")
  }

  if (present(get(map, "S3_ACCESS_KEY_ID")) || present(get(map, "S3_BUCKET")) || present(get(map, "S3_FILE_URL"))) {
    for (const key of [
      "S3_ACCESS_KEY_ID",
      "S3_SECRET_ACCESS_KEY",
      "S3_REGION",
      "S3_BUCKET",
      "S3_ENDPOINT",
      "S3_FILE_URL",
    ]) {
      required.add(key)
    }
  }

  for (const key of required) {
    const value = get(map, key)
    if (!present(value)) {
      errors.push(`${key} is required`)
    } else if (isPlaceholder(value)) {
      errors.push(`${key} still contains a placeholder`)
    }
  }

  if (get(map, "JWT_SECRET") === "supersecret") {
    errors.push('JWT_SECRET="supersecret" is refused')
  }
  if (get(map, "COOKIE_SECRET") === "supersecret") {
    errors.push('COOKIE_SECRET="supersecret" is refused')
  }

  if (
    present(get(map, "REVALIDATE_SECRET")) &&
    present(get(map, "STOREFRONT_REVALIDATE_SECRET")) &&
    get(map, "REVALIDATE_SECRET") !== get(map, "STOREFRONT_REVALIDATE_SECRET")
  ) {
    errors.push("REVALIDATE_SECRET and STOREFRONT_REVALIDATE_SECRET must match")
  }

  if (mode === "staging" && contract) {
    for (const { key } of contract.entries) {
      if (!map.has(key)) {
        errors.push(`${key} is missing from rendered staging env`)
      }
    }
  }

  if (mode === "staging") {
    for (const [key, value] of map.entries()) {
      if (isPlaceholder(value)) {
        errors.push(`${key} still contains a placeholder`)
      }
    }
  }

  return { errors, warnings }
}

function printResult({ errors, warnings }) {
  for (const warning of warnings) {
    console.error(`[warn] ${warning}`)
  }
  if (errors.length > 0) {
    for (const error of [...new Set(errors)]) {
      console.error(`[error] ${error}`)
    }
    process.exit(1)
  }
}

function checkLocal() {
  const envPath = option("--env", path.join(rootDir, ".env"))
  const contractPath = option("--contract", path.join(rootDir, ".env.example"))
  const strict = args.includes("--strict")
  const rootEnv = parseEnvFile(envPath)
  const contract = parseEnvFile(contractPath)
  const map = rootEnv.values
  deriveLocal(map)
  const result = validate(map, "local")

  if (strict) {
    for (const { key } of contract.entries) {
      if (!map.has(key)) {
        result.warnings.push(`${key} is absent from local .env; using defaults may hide local drift`)
      }
    }
  }

  const storefrontPath = path.join(rootDir, "medusa-agency-boilerplate-storefront/.env.local")
  if (fs.existsSync(storefrontPath)) {
    const storefront = parseEnvFile(storefrontPath).values
    if (
      present(get(map, "STOREFRONT_REVALIDATE_SECRET")) &&
      present(get(storefront, "REVALIDATE_SECRET")) &&
      get(map, "STOREFRONT_REVALIDATE_SECRET") !== get(storefront, "REVALIDATE_SECRET")
    ) {
      result.errors.push("storefront REVALIDATE_SECRET must match root STOREFRONT_REVALIDATE_SECRET")
    }
    if (get(storefront, "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY") === "REPLACE_WITH_ROOT_BOOTSTRAP") {
      result.errors.push("storefront NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY still uses bootstrap placeholder")
    }
  }

  printResult(result)
  console.log("[info] local env contract check passed")
}

function renderStaging() {
  const contractPath = option("--contract", path.join(rootDir, ".env.staging.example"))
  const outputPath = option("--output", path.join(rootDir, ".env.staging.generated"))
  const { contract, map } = contractValues(contractPath, { useProcessEnv: true })
  deriveStaging(map)
  const result = validate(map, "staging", contract)
  printResult(result)

  const seen = new Set()
  const lines = []
  for (const { key } of contract.entries) {
    seen.add(key)
    lines.push(`${key}=${quoteEnvValue(get(map, key))}`)
  }
  for (const key of ["REVALIDATE_SECRET"]) {
    if (!seen.has(key) && map.has(key)) {
      lines.push(`${key}=${quoteEnvValue(get(map, key))}`)
    }
  }

  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, { mode: 0o600 })
  console.log(`[info] rendered staging env: ${path.relative(rootDir, outputPath)}`)
}

function checkStaging() {
  const envPath = option("--env")
  if (!envPath) {
    console.error("[error] --env is required")
    process.exit(1)
  }
  const contractPath = option("--contract", path.join(rootDir, ".env.staging.example"))
  const contract = parseEnvFile(contractPath)
  const map = parseEnvFile(envPath).values
  deriveStaging(map)
  printResult(validate(map, "staging", contract))
  console.log("[info] staging env contract check passed")
}

if (command === "check-local") {
  checkLocal()
} else if (command === "render-staging") {
  renderStaging()
} else if (command === "check-staging") {
  checkStaging()
} else {
  console.error("Usage: env-contract.mjs check-local|render-staging|check-staging")
  process.exit(1)
}
