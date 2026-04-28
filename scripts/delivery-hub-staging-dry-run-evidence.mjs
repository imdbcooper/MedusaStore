#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const rootDir = path.resolve(path.dirname(__filename), "..")

const ARTIFACT_TYPE = "delivery_hub_staging_dry_run_evidence_bundle"
const DEFAULT_ARTIFACT_DIR = ".delivery-hub-cutover-evidence/staging-dry-run"
const DEFAULT_MARKDOWN_NAME = "delivery-hub-staging-dry-run-evidence.md"
const DEFAULT_JSON_NAME = "delivery-hub-staging-dry-run-evidence.json"

const statusValues = new Set(["PASS", "FAIL", "NOT_RUN"])
const flagStateValues = new Set(["true", "false", "unknown"])

const requiredPackageScripts = [
  "smoke:delivery-hub-cutover:browser",
  "smoke:delivery-hub-rollback:browser",
]

const requiredFiles = [
  "scripts/delivery-hub-preview-browser-smoke.mjs",
  "Docs/delivery_hub_manual_testing_plan.md",
  "Docs/delivery_hub_cutover_evidence_bundle.md",
  "Docs/delivery_hub_checkout_cutover_plan.md",
  "medusa-agency-boilerplate-storefront/.env.local.example",
]

const fieldValuePrefix = String.raw`(?:^|[\s{,;|` + "`" + String.raw`])`
const fieldValueSeparator = String.raw`["']?\s*[:=]\s*["']?`
const fieldValueTail = String.raw`[^\s` + "`" + String.raw`|,}\]]+`

function quotedFieldValuePattern(fieldNames) {
  return new RegExp(`${fieldValuePrefix}["']?(?:${fieldNames.join("|")})${fieldValueSeparator}${fieldValueTail}`, "i")
}

const forbiddenOutputPatterns = [
  {
    label: "authorization-header-value",
    pattern: quotedFieldValuePattern([
      "authorization",
      "auth",
      "auth_header",
      "auth_headers",
      "authHeader",
      "authHeaders",
      "x-api-key",
      "x_api_key",
    ]),
  },
  { label: "bearer-token-value", pattern: /bearer\s+[a-z0-9._~+/=-]{8,}/i },
  {
    label: "token-field-value",
    pattern: quotedFieldValuePattern(["token", "access_token", "refresh_token", "id_token", "api_token"]),
  },
  {
    label: "password-field-value",
    pattern: quotedFieldValuePattern(["password", "passwd", "pwd"]),
  },
  {
    label: "secret-field-value",
    pattern: quotedFieldValuePattern(["secret", "client_secret", "api_secret"]),
  },
  {
    label: "key-field-value",
    pattern: quotedFieldValuePattern(["api_key", "apikey", "api-key", "secret_key", "publishable_key", "private_key", "key"]),
  },
  {
    label: "ciphertext-field-value",
    pattern: quotedFieldValuePattern(["ciphertext", "encrypted_credentials", "credential", "credentials"]),
  },
  { label: "publishable-key-value", pattern: /\b(pk_live|pk_test|pk_[a-z0-9_]{10,})\b/i },
  { label: "secret-key-value", pattern: /\b(sk_live|sk_test|sk_[a-z0-9_]{10,})\b/i },
  { label: "jwt-like-value", pattern: /\beyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\b/i },
  { label: "raw-reference-field", pattern: /\b(raw_reference|rawReference)\b/ },
  { label: "quote-key-field", pattern: /\b(quote_key|quoteKey)\b/ },
  { label: "raw-provider-offer-field", pattern: /\b(raw_provider_offer_id|rawProviderOfferId|provider_offer_id|providerOfferId)\b/ },
  { label: "raw-provider-body-field", pattern: /\b(raw_provider_body|rawProviderBody|provider_body|providerBody)\b/ },
  { label: "backend-execution-token-field", pattern: /\b(backend_execution_reference|backendExecutionReference|execution_token|executionToken)\b/ },
  { label: "raw-yandex-dto", pattern: /\b(yandex.*dto|dto.*yandex)\b/i },
  { label: "raw-provider-json-shape", pattern: /\{\s*"(?:offers|raw|provider|yandex|request|response)"\s*:/i },
  { label: "offer-id-like-value", pattern: /\b(offer[_-]?id|offerId)\s*[:=]\s*[a-z0-9_-]{6,}/i },
  { label: "quote-key-like-value", pattern: /\b(quote[_-]?key|quoteKey)\s*[:=]\s*[a-z0-9._~+/=-]{6,}/i },
]

const unsafeNotePatterns = [
  ...forbiddenOutputPatterns,
  { label: "env-file-reference", pattern: /(^|[\s/])\.env(\.|\s|$)/i },
  { label: "private-key-block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { label: "long-base64-like-value", pattern: /\b[A-Za-z0-9+/]{80,}={0,2}\b/ },
  { label: "long-hex-like-value", pattern: /\b[a-f0-9]{48,}\b/i },
  { label: "request-response-body", pattern: /\b(request_body|response_body|request body|response body|raw body|payload dump)\b/i },
]

const sanitizerSelfCheckSamples = [
  { label: "quoted-json-token", value: '{"token": "dummy-token-value"}', expectedSafe: false },
  { label: "quoted-json-password", value: '{"password": "dummy-password-value"}', expectedSafe: false },
  { label: "quoted-json-api-key", value: '{"api_key": "dummy-api-key-value"}', expectedSafe: false },
  { label: "quoted-json-ciphertext", value: '{"ciphertext": "dummy-ciphertext-value"}', expectedSafe: false },
  { label: "quoted-json-authorization", value: '{"Authorization": "Bearer dummy-token-value"}', expectedSafe: false },
  { label: "legacy-token", value: "token=dummy-token-value", expectedSafe: false },
  { label: "legacy-password", value: "password=dummy-password-value", expectedSafe: false },
  { label: "legacy-api-key", value: "api_key=dummy-api-key-value", expectedSafe: false },
  { label: "legacy-ciphertext", value: "ciphertext=dummy-ciphertext-value", expectedSafe: false },
  { label: "safe-note", value: "Controlled staging cart/order dry run passed with sanitized summaries only.", expectedSafe: true },
]

function parseArgs(argv) {
  const options = {
    check: false,
    format: "markdown",
    out: null,
    outputDir: null,
    stdout: false,
    cutoverSmokeStatus: process.env.STAGING_CUTOVER_SMOKE_STATUS || "NOT_RUN",
    rollbackSmokeStatus: process.env.STAGING_ROLLBACK_SMOKE_STATUS || "NOT_RUN",
    stagingFlagState: process.env.STAGING_DELIVERY_HUB_CUTOVER_FLAG_STATE || "unknown",
    manualStagingNote: process.env.STAGING_DELIVERY_HUB_MANUAL_NOTE || "NOT_PROVIDED",
    rollbackVerificationNote: process.env.STAGING_DELIVERY_HUB_ROLLBACK_NOTE || "NOT_PROVIDED",
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--check") {
      options.check = true
    } else if (arg === "--stdout") {
      options.stdout = true
    } else if (arg === "--json") {
      options.format = "json"
    } else if (arg === "--markdown") {
      options.format = "markdown"
    } else if (arg === "--format") {
      options.format = requireValue(argv, index, arg)
      index += 1
    } else if (arg.startsWith("--format=")) {
      options.format = arg.slice("--format=".length)
    } else if (arg === "--out") {
      options.out = requireValue(argv, index, arg)
      index += 1
    } else if (arg.startsWith("--out=")) {
      options.out = arg.slice("--out=".length)
    } else if (arg === "--output-dir") {
      options.outputDir = requireValue(argv, index, arg)
      index += 1
    } else if (arg.startsWith("--output-dir=")) {
      options.outputDir = arg.slice("--output-dir=".length)
    } else if (arg === "--cutover-smoke-status") {
      options.cutoverSmokeStatus = requireValue(argv, index, arg)
      index += 1
    } else if (arg.startsWith("--cutover-smoke-status=")) {
      options.cutoverSmokeStatus = arg.slice("--cutover-smoke-status=".length)
    } else if (arg === "--rollback-smoke-status") {
      options.rollbackSmokeStatus = requireValue(argv, index, arg)
      index += 1
    } else if (arg.startsWith("--rollback-smoke-status=")) {
      options.rollbackSmokeStatus = arg.slice("--rollback-smoke-status=".length)
    } else if (arg === "--staging-flag-state") {
      options.stagingFlagState = requireValue(argv, index, arg)
      index += 1
    } else if (arg.startsWith("--staging-flag-state=")) {
      options.stagingFlagState = arg.slice("--staging-flag-state=".length)
    } else if (arg === "--manual-staging-note") {
      options.manualStagingNote = requireValue(argv, index, arg)
      index += 1
    } else if (arg.startsWith("--manual-staging-note=")) {
      options.manualStagingNote = arg.slice("--manual-staging-note=".length)
    } else if (arg === "--rollback-verification-note") {
      options.rollbackVerificationNote = requireValue(argv, index, arg)
      index += 1
    } else if (arg.startsWith("--rollback-verification-note=")) {
      options.rollbackVerificationNote = arg.slice("--rollback-verification-note=".length)
    } else if (arg === "--help" || arg === "-h") {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!["markdown", "json"].includes(options.format)) {
    throw new Error("--format must be markdown or json")
  }

  validateStatus("--cutover-smoke-status/STAGING_CUTOVER_SMOKE_STATUS", options.cutoverSmokeStatus)
  validateStatus("--rollback-smoke-status/STAGING_ROLLBACK_SMOKE_STATUS", options.rollbackSmokeStatus)
  validateFlagState(options.stagingFlagState)
  options.manualStagingNote = sanitizeNote("manual staging cart/order note", options.manualStagingNote)
  options.rollbackVerificationNote = sanitizeNote("rollback verification note", options.rollbackVerificationNote)

  return options
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1]
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`)
  }
  return value
}

function printHelp() {
  process.stdout.write(`Delivery Hub staging dry-run evidence bundle exporter\n\n`)
  process.stdout.write(`Usage:\n`)
  process.stdout.write(`  node scripts/delivery-hub-staging-dry-run-evidence.mjs --check\n`)
  process.stdout.write(`  node scripts/delivery-hub-staging-dry-run-evidence.mjs --stdout\n`)
  process.stdout.write(`  node scripts/delivery-hub-staging-dry-run-evidence.mjs --cutover-smoke-status PASS --rollback-smoke-status PASS --staging-flag-state true --manual-staging-note "sanitized note" --rollback-verification-note "sanitized rollback note"\n\n`)
  process.stdout.write(`Statuses: PASS, FAIL, NOT_RUN. Flag state: true, false, unknown.\n`)
  process.stdout.write(`The exporter is local-only and performs no browser, backend, Medusa, Yandex, or provider calls.\n`)
}

function validateStatus(label, value) {
  if (!statusValues.has(value)) {
    throw new Error(`${label} must be one of: ${Array.from(statusValues).join(", ")}`)
  }
}

function validateFlagState(value) {
  if (!flagStateValues.has(value)) {
    throw new Error(`--staging-flag-state/STAGING_DELIVERY_HUB_CUTOVER_FLAG_STATE must be one of: ${Array.from(flagStateValues).join(", ")}`)
  }
}

function sanitizeNote(label, value) {
  const normalized = String(value || "NOT_PROVIDED")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()

  const safe = normalized || "NOT_PROVIDED"
  if (safe.length > 600) {
    throw new Error(`${label} must be 600 characters or less`)
  }
  const findings = scanPatterns(safe, unsafeNotePatterns)
  if (findings.length > 0) {
    throw new Error(`${label} rejected by sanitization guardrail(s): ${findings.join(", ")}`)
  }
  return safe
}

function readPackageJson() {
  const packageJsonPath = path.join(rootDir, "package.json")
  return JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))
}

function getGitSummary() {
  const statusShort = safeGitValue(["status", "--short"])
  const statusLines = statusShort === "clean" ? [] : statusShort.split("\n").filter(Boolean)

  return {
    commit: safeGitValue(["rev-parse", "HEAD"]),
    short_commit: safeGitValue(["rev-parse", "--short", "HEAD"]),
    branch: safeGitValue(["rev-parse", "--abbrev-ref", "HEAD"]),
    working_tree_status: statusLines.length === 0 ? "clean" : "dirty",
    status_entry_count: statusLines.length,
    diff_dump_included: false,
  }
}

function safeGitValue(args) {
  try {
    const raw = execFileSync("git", args, {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
    return sanitizeGitScalar(raw)
  } catch (_error) {
    return "unavailable"
  }
}

function sanitizeGitScalar(value) {
  const normalized = String(value || "").trim()
  if (!normalized) {
    return "clean"
  }
  return normalized
    .split("\n")
    .slice(0, 100)
    .map((line) => line.replace(/[^\w ./@:+-]/g, "_").slice(0, 180))
    .join("\n")
}

function checkRequiredInputs() {
  const missingFiles = requiredFiles.filter((relativePath) => {
    return !fs.existsSync(path.join(rootDir, relativePath))
  })
  const packageJson = readPackageJson()
  const missingScripts = requiredPackageScripts.filter((scriptName) => {
    return !packageJson.scripts || typeof packageJson.scripts[scriptName] !== "string"
  })

  return {
    ok: missingFiles.length === 0 && missingScripts.length === 0,
    missing_files: missingFiles,
    missing_package_scripts: missingScripts,
  }
}

function buildBundle(options = {}) {
  const generatedAt = new Date().toISOString()
  const git = getGitSummary()
  const packageJson = readPackageJson()

  return {
    artifact_type: ARTIFACT_TYPE,
    generated_at: generatedAt,
    exporter: {
      script: "scripts/delivery-hub-staging-dry-run-evidence.mjs",
      mode: "local_only_sanitized_staging_dry_run_evidence",
      output_policy: "operator_assertions_and_safe_summaries_only",
      network_calls_performed: false,
      browser_smokes_executed_by_exporter: false,
      provider_payloads_captured: false,
      env_file_contents_included: false,
      production_enablement_performed: false,
    },
    git,
    staging_assertions: {
      cutover_smoke_status: options.cutoverSmokeStatus || "NOT_RUN",
      rollback_smoke_status: options.rollbackSmokeStatus || "NOT_RUN",
      staging_delivery_hub_cutover_flag_state: options.stagingFlagState || "unknown",
      manual_staging_cart_order_note: options.manualStagingNote || "NOT_PROVIDED",
      rollback_verification_note: options.rollbackVerificationNote || "NOT_PROVIDED",
      note_policy: "operator_entered_values_are_rejected_if_they_match_secret_raw_provider_or_payload_patterns",
    },
    expected_commands: [
      {
        command: "npm run smoke:delivery-hub-cutover:browser",
        package_script: packageJson.scripts?.["smoke:delivery-hub-cutover:browser"] || null,
        expected_scope: "local_mock_no_network_flag_true_actual_storefront_cta_commit_rehearsal",
        operator_status: options.cutoverSmokeStatus || "NOT_RUN",
        exporter_behavior: "not_executed_by_exporter",
      },
      {
        command: "npm run smoke:delivery-hub-rollback:browser",
        package_script: packageJson.scripts?.["smoke:delivery-hub-rollback:browser"] || null,
        expected_scope: "local_mock_no_network_flag_off_rollback_fallback_proof",
        operator_status: options.rollbackSmokeStatus || "NOT_RUN",
        exporter_behavior: "not_executed_by_exporter",
      },
    ],
    guardrails: {
      production_default_unchanged: true,
      committed_examples_templates_must_remain_false: true,
      staging_flag_state_is_operator_assertion_not_template_proof: true,
      no_secrets_or_credentials: true,
      no_auth_headers: true,
      no_ciphertext: true,
      no_publishable_key_values: true,
      no_env_file_contents: true,
      no_raw_provider_payloads: true,
      no_raw_yandex_dtos: true,
      no_provider_offer_identifiers: true,
      no_backend_quote_lookup_keys: true,
      no_live_provider_payload_captured: true,
      no_live_yandex_or_provider_calls: true,
      no_shipment_create_cancel_status_retry_execution: true,
      apiship_medusa_fallback_preserved: true,
      official_medusa_admin_internals_untouched: true,
    },
    review_posture: {
      production_rollout_approval: "not_granted",
      staging_enablement_decision_input: true,
      separate_review_required: true,
      review_status: "pending_separate_review",
    },
  }
}

function renderMarkdown(bundle) {
  const commandRows = bundle.expected_commands
    .map((entry) => `| ${escapeCell(entry.command)} | ${escapeCell(entry.operator_status)} | ${escapeCell(entry.expected_scope)} | ${escapeCell(entry.exporter_behavior)} |`)
    .join("\n")

  return `# Delivery Hub staging dry-run evidence bundle\n\n` +
    `artifact_type=\`${bundle.artifact_type}\`\n\n` +
    `Generated at: \`${bundle.generated_at}\`\n\n` +
    `## Exporter posture\n\n` +
    renderObjectBullets(bundle.exporter) +
    `\n## Safe git summary\n\n` +
    `- Commit: \`${bundle.git.commit}\`\n` +
    `- Short commit: \`${bundle.git.short_commit}\`\n` +
    `- Branch: \`${bundle.git.branch}\`\n` +
    `- Working tree status: \`${bundle.git.working_tree_status}\`\n` +
    `- Status entry count: \`${bundle.git.status_entry_count}\`\n` +
    `- Diff dump included: \`${bundle.git.diff_dump_included}\`\n\n` +
    `## Expected smoke commands and operator statuses\n\n` +
    `The exporter records operator-provided statuses only. It does not run browser smokes, backend servers, storefront servers, Medusa runtime, Yandex, or any provider.\n\n` +
    `| Command | Operator status | Expected scope | Exporter behavior |\n| --- | --- | --- | --- |\n${commandRows}\n\n` +
    `## Operator staging assertions\n\n` +
    `- Cutover smoke status: \`${bundle.staging_assertions.cutover_smoke_status}\`\n` +
    `- Rollback smoke status: \`${bundle.staging_assertions.rollback_smoke_status}\`\n` +
    `- Staging cutover flag state assertion: \`${bundle.staging_assertions.staging_delivery_hub_cutover_flag_state}\`\n` +
    `- Manual staging cart/order note: ${formatNote(bundle.staging_assertions.manual_staging_cart_order_note)}\n` +
    `- Rollback verification note: ${formatNote(bundle.staging_assertions.rollback_verification_note)}\n` +
    `- Note policy: \`${bundle.staging_assertions.note_policy}\`\n\n` +
    `## Hard guardrails\n\n` +
    renderObjectBullets(bundle.guardrails) +
    `\n## Review posture\n\n` +
    renderObjectBullets(bundle.review_posture)
}

function formatNote(value) {
  return `\`${String(value).replace(/`/g, "'").replace(/\n/g, " / ")}\``
}

function escapeCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, "<br>")
}

function renderObjectBullets(value) {
  return Object.entries(value)
    .map(([key, entry]) => `- ${key}: \`${entry}\``)
    .join("\n") + "\n"
}

function scanPatterns(output, patterns) {
  return patterns
    .filter((entry) => entry.pattern.test(output))
    .map((entry) => entry.label)
}

function scanUnsafeOutput(output) {
  return scanPatterns(output, forbiddenOutputPatterns)
}

function resolveOutputPath(options) {
  if (options.out) {
    return path.resolve(rootDir, options.out)
  }

  if (options.outputDir) {
    const name = options.format === "json" ? DEFAULT_JSON_NAME : DEFAULT_MARKDOWN_NAME
    return path.resolve(rootDir, options.outputDir, name)
  }

  if (options.stdout) {
    return null
  }

  const name = options.format === "json" ? DEFAULT_JSON_NAME : DEFAULT_MARKDOWN_NAME
  return path.resolve(rootDir, DEFAULT_ARTIFACT_DIR, name)
}

function assertInsideWorkspace(filePath) {
  const relative = path.relative(rootDir, filePath)
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Output path must stay inside the repository workspace")
  }
}

function runSanitizerSelfCheck() {
  const sampleResults = sanitizerSelfCheckSamples.map((sample) => {
    try {
      sanitizeNote(`sanitizer self-check ${sample.label}`, sample.value)
      return {
        label: sample.label,
        expected_safe: sample.expectedSafe,
        actual_safe: true,
        ok: sample.expectedSafe === true,
        findings: [],
      }
    } catch (error) {
      const findings = String(error.message || "")
        .split("guardrail(s): ")[1]
        ?.split(", ")
        .filter(Boolean) || []

      return {
        label: sample.label,
        expected_safe: sample.expectedSafe,
        actual_safe: false,
        ok: sample.expectedSafe === false,
        findings,
      }
    }
  })

  return {
    ok: sampleResults.every((sample) => sample.ok),
    samples_total: sampleResults.length,
    unsafe_samples_rejected: sampleResults.filter((sample) => sample.expected_safe === false && sample.actual_safe === false).length,
    safe_samples_accepted: sampleResults.filter((sample) => sample.expected_safe === true && sample.actual_safe === true).length,
    sample_results: sampleResults,
  }
}

function buildCheckSummary(options) {
  const inputCheck = checkRequiredInputs()
  const sanitizerSelfCheck = runSanitizerSelfCheck()
  const bundle = buildBundle(options)
  const markdown = renderMarkdown(bundle)
  const json = `${JSON.stringify(bundle, null, 2)}\n`
  const findings = Array.from(new Set([
    ...scanUnsafeOutput(markdown),
    ...scanUnsafeOutput(json),
  ]))

  return {
    artifact_type: ARTIFACT_TYPE,
    check_mode: true,
    generated_at: bundle.generated_at,
    ok: inputCheck.ok && sanitizerSelfCheck.ok && findings.length === 0,
    required_inputs_ok: inputCheck.ok,
    sanitizer_self_check_ok: sanitizerSelfCheck.ok,
    sanitizer_self_check: sanitizerSelfCheck,
    missing_files: inputCheck.missing_files,
    missing_package_scripts: inputCheck.missing_package_scripts,
    unsafe_output_findings: findings,
    network_calls_performed: false,
    browser_smokes_executed: false,
    provider_payloads_captured: false,
    production_enablement_performed: false,
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.check) {
    const summary = buildCheckSummary(options)
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
    if (!summary.ok) {
      process.exitCode = 1
    }
    return
  }

  const bundle = buildBundle(options)
  const output = options.format === "json"
    ? `${JSON.stringify(bundle, null, 2)}\n`
    : renderMarkdown(bundle)
  const findings = scanUnsafeOutput(output)

  if (findings.length > 0) {
    throw new Error(`Unsafe output sentinel(s) detected: ${findings.join(", ")}`)
  }

  const outputPath = resolveOutputPath(options)
  if (!outputPath) {
    process.stdout.write(output)
    return
  }

  assertInsideWorkspace(outputPath)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, output)
  process.stdout.write(JSON.stringify({
    artifact_type: ARTIFACT_TYPE,
    written: path.relative(rootDir, outputPath),
    format: options.format,
    network_calls_performed: false,
    browser_smokes_executed: false,
    provider_payloads_captured: false,
    production_enablement_performed: false,
  }, null, 2) + "\n")
}

try {
  main()
} catch (error) {
  process.stderr.write(`[delivery-hub-staging-dry-run-evidence] ${error.message}\n`)
  process.exitCode = 1
}
