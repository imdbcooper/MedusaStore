import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const scriptPath = path.join(rootDir, "scripts", "env-contract.mjs")

function parseEnv(text) {
  return new Map(
    text
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("=")
        return [line.slice(0, separator), line.slice(separator + 1)]
      }),
  )
}

test("render-staging keeps assistant topology on compose-internal URLs", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "env-contract-"))
  const contractPath = path.join(tempDir, ".env.contract")
  const outputPath = path.join(tempDir, ".env.generated")

  fs.writeFileSync(
    contractPath,
    [
      "DEPLOY_DOMAIN=studio.slavx.ru",
      "ACME_EMAIL=",
      "POSTGRES_USER=postgres",
      "POSTGRES_PASSWORD=secret",
      "POSTGRES_DB=medusa",
      "JWT_SECRET=jwtsecret",
      "COOKIE_SECRET=cookiesecret",
      "DATABASE_URL=",
      "REDIS_URL=redis://medusa-redis:6379",
      "STORE_CORS=",
      "ADMIN_CORS=",
      "AUTH_CORS=",
      "MEDUSA_BACKEND_URL=",
      "NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://studio.slavx.ru",
      "NEXT_PUBLIC_BASE_URL=",
      "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_test_staging",
      "STOREFRONT_URL=",
      "PAYLOAD_ENABLED=false",
      "PAYLOAD_PUBLIC_SERVER_URL=https://cms.slavx.ru",
      "STOREFRONT_REVALIDATE_SECRET=revalidate",
      "REVALIDATE_SECRET=revalidate",
      "SMOKE_BACKEND_URL=https://admin.slavx.ru/app",
      "SMOKE_PAYLOAD_URL=https://cms.slavx.ru/api/pages",
      "PAYLOAD_CORS=https://cms.slavx.ru,https://studio.slavx.ru",
      "PAYLOAD_CSRF=https://cms.slavx.ru,https://studio.slavx.ru",
      "VK_ID_ENABLED=false",
      "NEXT_PUBLIC_YOOKASSA_ENABLED=false",
      "AI_ASSISTANT_ENABLED=true",
      "AI_ASSISTANT_BASE_URL=https://stale.example/api/v1",
      "AI_ASSISTANT_API_TOKEN=apitoken",
      "AI_ASSISTANT_SERVER_TOKEN=servertoken",
      "AI_ASSISTANT_CORS_ORIGINS=https://studio.slavx.ru,https://admin.slavx.ru",
      "ASSISTANT_POSTGRES_URI=postgresql://postgres:secret@medusa-db:5432/assistant?sslmode=disable",
      "MEDUSA_INTERNAL_URL=https://stale-medusa.example",
    ].join("\n"),
  )

  execFileSync(process.execPath, [scriptPath, "render-staging", "--contract", contractPath, "--output", outputPath], {
    cwd: rootDir,
    env: {
      PATH: process.env.PATH,
      AI_ASSISTANT_BASE_URL: "https://different-stale.example/api/v1",
      MEDUSA_INTERNAL_URL: "https://different-stale-medusa.example",
    },
    stdio: "pipe",
  })

  const rendered = parseEnv(fs.readFileSync(outputPath, "utf8"))

  assert.equal(rendered.get("AI_ASSISTANT_BASE_URL"), "http://ai-assistant:8000/api/v1")
  assert.equal(rendered.get("MEDUSA_INTERNAL_URL"), "http://medusa-backend:9000")
})
