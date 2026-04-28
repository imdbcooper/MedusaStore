#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const rootDir = path.resolve(path.dirname(__filename), "..")

const ARTIFACT_TYPE = "delivery_hub_checkout_cutover_evidence_bundle"
const DEFAULT_ARTIFACT_DIR = ".delivery-hub-cutover-evidence"
const DEFAULT_MARKDOWN_NAME = "delivery-hub-cutover-evidence-bundle.md"
const DEFAULT_JSON_NAME = "delivery-hub-cutover-evidence-bundle.json"

const requiredFiles = [
  "Docs/delivery_hub_checkout_cutover_plan.md",
  "Docs/delivery_hub_manual_testing_plan.md",
  "Docs/delivery_hub_cutover_decision_record_template.md",
  "scripts/delivery-hub-preview-browser-smoke.mjs",
  "package.json",
  "medusa-agency-boilerplate/src/api/store/delivery/cutover-preconditions/route.ts",
  "medusa-agency-boilerplate/src/api/store/delivery/cutover-candidate/route.ts",
  "medusa-agency-boilerplate/src/api/store/delivery/cutover-approval-template/route.ts",
  "medusa-agency-boilerplate-storefront/src/lib/util/delivery-hub.ts",
  "medusa-agency-boilerplate-storefront/src/lib/data/cart.ts",
]

const requiredPackageScripts = [
  "smoke:delivery-hub-preview:browser",
  "smoke:delivery-hub-rollback:browser",
]

const forbiddenOutputPatterns = [
  { label: "authorization-header-value", pattern: /authorization\s*:\s*\S+/i },
  { label: "bearer-token-value", pattern: /bearer\s+[a-z0-9._~+/=-]{8,}/i },
  { label: "token-field-value", pattern: /\b(token|access_token|refresh_token|api_token)\s*[:=]\s*[^\s`|,]+/i },
  { label: "ciphertext-field-value", pattern: /\bciphertext\s*[:=]\s*[^\s`|,]+/i },
  { label: "publishable-key-value", pattern: /\b(pk_live|pk_test|pk_[a-z0-9_]{10,})\b/i },
  { label: "secret-key-value", pattern: /\b(sk_live|sk_test|sk_[a-z0-9_]{10,})\b/i },
  { label: "raw-reference-field", pattern: /\b(raw_reference|rawReference)\b/ },
  { label: "quote-key-field", pattern: /\b(quote_key|quoteKey)\b/ },
  { label: "raw-provider-offer-field", pattern: /\b(raw_provider_offer_id|rawProviderOfferId|provider_offer_id|providerOfferId)\b/ },
  { label: "raw-provider-body-field", pattern: /\b(raw_provider_body|rawProviderBody|provider_body|providerBody)\b/ },
  { label: "backend-execution-token-field", pattern: /\b(backend_execution_reference|backendExecutionReference|execution_token|executionToken)\b/ },
]

const safeRuntimeStatuses = new Set([
  "not_run_by_exporter",
  "operator_to_run",
  "pending_operator_evidence",
  "passed_operator_recorded",
  "failed_operator_recorded",
  "blocked_operator_recorded",
])

function parseArgs(argv) {
  const options = {
    check: false,
    format: "markdown",
    out: null,
    outputDir: null,
    stdout: false,
    previewSmokeStatus: "pending_operator_evidence",
    rollbackSmokeStatus: "pending_operator_evidence",
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
    } else if (arg === "--preview-smoke-status") {
      options.previewSmokeStatus = requireValue(argv, index, arg)
      index += 1
    } else if (arg.startsWith("--preview-smoke-status=")) {
      options.previewSmokeStatus = arg.slice("--preview-smoke-status=".length)
    } else if (arg === "--rollback-smoke-status") {
      options.rollbackSmokeStatus = requireValue(argv, index, arg)
      index += 1
    } else if (arg.startsWith("--rollback-smoke-status=")) {
      options.rollbackSmokeStatus = arg.slice("--rollback-smoke-status=".length)
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

  for (const [name, status] of [
    ["--preview-smoke-status", options.previewSmokeStatus],
    ["--rollback-smoke-status", options.rollbackSmokeStatus],
  ]) {
    if (!safeRuntimeStatuses.has(status)) {
      throw new Error(
        `${name} must be one of: ${Array.from(safeRuntimeStatuses).join(", ")}`
      )
    }
  }

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
  process.stdout.write(`Delivery Hub checkout cutover evidence bundle exporter\n\n`)
  process.stdout.write(`Usage:\n`)
  process.stdout.write(`  node scripts/delivery-hub-cutover-evidence-bundle.mjs --check\n`)
  process.stdout.write(`  node scripts/delivery-hub-cutover-evidence-bundle.mjs --stdout\n`)
  process.stdout.write(`  node scripts/delivery-hub-cutover-evidence-bundle.mjs --output-dir .delivery-hub-cutover-evidence\n`)
  process.stdout.write(`  node scripts/delivery-hub-cutover-evidence-bundle.mjs --format json --stdout\n\n`)
  process.stdout.write(`The exporter is read-only and performs no network/provider calls.\n`)
}

function readPackageJson() {
  const packageJsonPath = path.join(rootDir, "package.json")
  return JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))
}

function getGitSummary() {
  return {
    commit: safeGitValue(["rev-parse", "--short", "HEAD"]),
    branch: safeGitValue(["rev-parse", "--abbrev-ref", "HEAD"]),
    status: safeGitValue(["status", "--short"]),
  }
}

function safeGitValue(args) {
  try {
    const raw = execFileSync("git", args, {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
    return sanitizeGitOutput(raw)
  } catch (_error) {
    return "unavailable"
  }
}

function sanitizeGitOutput(value) {
  const normalized = String(value || "").trim()
  if (!normalized) {
    return "clean"
  }
  return normalized
    .split("\n")
    .slice(0, 50)
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
      script: "scripts/delivery-hub-cutover-evidence-bundle.mjs",
      mode: "read_only_no_network",
      output_policy: "safe_summary_and_placeholders_only",
      executable_approval_included: false,
      checkout_cutover_included: false,
    },
    git: {
      commit: git.commit,
      branch: git.branch,
      status_summary: git.status,
    },
    referenced_authorities: [
      {
        label: "Cutover readiness plan",
        path: "Docs/delivery_hub_checkout_cutover_plan.md",
      },
      {
        label: "Manual testing plan",
        path: "Docs/delivery_hub_manual_testing_plan.md",
      },
      {
        label: "Human decision record template",
        path: "Docs/delivery_hub_cutover_decision_record_template.md",
      },
      {
        label: "Preconditions verifier endpoint",
        method: "GET",
        endpoint: "/store/delivery/cutover-preconditions",
        source: "medusa-agency-boilerplate/src/api/store/delivery/cutover-preconditions/route.ts",
      },
      {
        label: "Candidate planner endpoint",
        method: "GET",
        endpoint: "/store/delivery/cutover-candidate?cart_id=<cart_id>",
        source: "medusa-agency-boilerplate/src/api/store/delivery/cutover-candidate/route.ts",
      },
      {
        label: "Decision artifact endpoint",
        method: "GET",
        endpoint: "/store/delivery/cutover-approval-template?cart_id=<cart_id>",
        source: "medusa-agency-boilerplate/src/api/store/delivery/cutover-approval-template/route.ts",
      },
    ],
    checklist: buildChecklist(),
    commands_to_run: [
      {
        command: "npm run smoke:delivery-hub-preview:browser",
        package_script: packageJson.scripts?.["smoke:delivery-hub-preview:browser"] || null,
        status: options.previewSmokeStatus || "pending_operator_evidence",
        exporter_behavior: "not_executed_by_exporter",
      },
      {
        command: "npm run smoke:delivery-hub-rollback:browser",
        package_script: packageJson.scripts?.["smoke:delivery-hub-rollback:browser"] || null,
        status: options.rollbackSmokeStatus || "pending_operator_evidence",
        exporter_behavior: "not_executed_by_exporter",
      },
      {
        command: "npm run backend:typecheck",
        status: "operator_to_run_if_backend_scope_changed",
        exporter_behavior: "not_executed_by_exporter",
      },
      {
        command: "npm run storefront:typecheck",
        status: "operator_to_run_if_storefront_scope_changed",
        exporter_behavior: "not_executed_by_exporter",
      },
      {
        command: "git diff --check",
        status: "operator_to_run_before_commit",
        exporter_behavior: "not_executed_by_exporter",
      },
    ],
    security_redaction_guardrails: {
      safe_summary_only: true,
      placeholders_only_for_operator_signoff: true,
      excluded_value_classes: [
        "provider credential values",
        "request authorization material",
        "encrypted secret material",
        "publishable key values",
        "provider response bodies",
        "provider offer identifiers",
        "backend quote lookup keys",
      ],
      scan_policy: "generated bundle is scanned for known unsafe sentinel fields before output",
    },
    invariants: {
      delivery_hub_checkout_cutover_performed: false,
      set_shipping_method_delivery_hub_wiring_added: false,
      can_commit_shipping_method_expected: false,
      storefront_can_commit_shipping_method_expected: false,
      approval_is_executable: false,
      provider_network_calls_performed_by_exporter: false,
      shipment_create_cancel_status_retry_performed: false,
      legacy_delivery_removed_or_functionally_changed: false,
      generated_environment_specific_output_should_be_committed: false,
      review_status: "pending_separate_review",
    },
    remaining_blockers_before_real_cutover: [
      "Separate go/no-go review must complete outside runtime.",
      "Explicit implementation tranche is required before any checkout source-of-truth change.",
      "Commit controls must remain false until a later approved cutover task.",
      "Rollback/fallback evidence must be attached by an operator after running the mock drill.",
      "No shipment lifecycle expansion is implied by this evidence bundle.",
    ],
  }
}

function buildChecklist() {
  return [
    {
      item: "Backend Yandex direct quote baseline recorded",
      status: "recorded_in_manual_testing_plan",
      evidence: "warehouse_to_pickup_point and dropoff_point_to_pickup_point quote baselines are documented as readiness evidence only",
    },
    {
      item: "Store-neutral quote/selection smoke baseline recorded",
      status: "recorded_in_current_work_and_manual_plan",
      evidence: "neutral quote plus selection smoke keeps checkout source-of-truth unchanged",
    },
    {
      item: "Storefront preview source/browser smoke status",
      status: "command_record_placeholder",
      evidence: "npm run smoke:delivery-hub-preview:browser must be attached or marked by operator",
    },
    {
      item: "Cutover gate status default-off/preflight-only",
      status: "expected_default_off_or_preflight_only",
      evidence: "NEXT_PUBLIC_DELIVERY_HUB_CHECKOUT_CUTOVER_ENABLED does not enable commit",
    },
    {
      item: "Preconditions verifier endpoint",
      status: "expected_read_only_false_commit",
      evidence: "GET /store/delivery/cutover-preconditions expected can_commit_shipping_method=false",
    },
    {
      item: "Candidate planner endpoint",
      status: "expected_candidate_only",
      evidence: "GET /store/delivery/cutover-candidate?cart_id=<cart_id> expected to summarize candidate without commit",
    },
    {
      item: "Decision artifact endpoint/template",
      status: "expected_non_executable_controls",
      evidence: "GET /store/delivery/cutover-approval-template?cart_id=<cart_id> expected approval_is_executable=false",
    },
    {
      item: "Rollback/fallback browser smoke command/status",
      status: "command_record_placeholder",
      evidence: "npm run smoke:delivery-hub-rollback:browser must be attached or marked by operator",
    },
    {
      item: "Security redaction guardrails",
      status: "safe_summary_only",
      evidence: "bundle contains policy summaries and placeholders instead of secret-bearing runtime values",
    },
    {
      item: "Remaining blockers before real cutover",
      status: "blocked_until_separate_approved_task",
      evidence: "real checkout source-of-truth cutover remains out of scope",
    },
  ]
}

function renderMarkdown(bundle) {
  const checklistRows = bundle.checklist
    .map((entry) => `| ${escapeCell(entry.item)} | ${escapeCell(entry.status)} | ${escapeCell(entry.evidence)} |`)
    .join("\n")
  const authorityRows = bundle.referenced_authorities
    .map((entry) => {
      const target = entry.path || entry.source || entry.endpoint
      const method = entry.method || "n/a"
      return `| ${escapeCell(entry.label)} | ${escapeCell(method)} | ${escapeCell(target)} |`
    })
    .join("\n")
  const commandRows = bundle.commands_to_run
    .map((entry) => `| ${escapeCell(entry.command)} | ${escapeCell(entry.status)} | ${escapeCell(entry.exporter_behavior)} |`)
    .join("\n")
  const blockers = bundle.remaining_blockers_before_real_cutover
    .map((entry) => `- ${entry}`)
    .join("\n")

  return `# Delivery Hub checkout cutover evidence bundle\n\n` +
    `artifact_type=\`${bundle.artifact_type}\`\n\n` +
    `Generated at: \`${bundle.generated_at}\`\n\n` +
    `## Exporter posture\n\n` +
    `- Script: \`${bundle.exporter.script}\`\n` +
    `- Mode: \`${bundle.exporter.mode}\`\n` +
    `- Output policy: \`${bundle.exporter.output_policy}\`\n` +
    `- Checkout cutover included: \`${bundle.exporter.checkout_cutover_included}\`\n` +
    `- Executable approval included: \`${bundle.exporter.executable_approval_included}\`\n\n` +
    `## Safe git summary\n\n` +
    `- Commit: \`${bundle.git.commit}\`\n` +
    `- Branch: \`${bundle.git.branch}\`\n` +
    `- Status summary:\n\n\`\`\`text\n${bundle.git.status_summary}\n\`\`\`\n\n` +
    `## Referenced authorities\n\n` +
    `| Authority | Method | Reference |\n| --- | --- | --- |\n${authorityRows}\n\n` +
    `## Go/no-go evidence checklist\n\n` +
    `| Checklist item | Status | Safe evidence summary |\n| --- | --- | --- |\n${checklistRows}\n\n` +
    `## Commands and operator status placeholders\n\n` +
    `The exporter records command/status placeholders only. It does not run browser smokes, backend servers, storefront servers, Medusa runtime, Yandex, or any provider.\n\n` +
    `| Command | Status | Exporter behavior |\n| --- | --- | --- |\n${commandRows}\n\n` +
    `## Security redaction guardrails\n\n` +
    `- Safe summaries only: \`${bundle.security_redaction_guardrails.safe_summary_only}\`\n` +
    `- Operator signoff fields are placeholders only: \`${bundle.security_redaction_guardrails.placeholders_only_for_operator_signoff}\`\n` +
    `- Excluded value classes: ${bundle.security_redaction_guardrails.excluded_value_classes.map((entry) => `\`${entry}\``).join(", ")}\n` +
    `- Scan policy: ${bundle.security_redaction_guardrails.scan_policy}\n\n` +
    `## Preserved invariants\n\n` +
    renderObjectBullets(bundle.invariants) +
    `\n## Remaining blockers before real cutover\n\n${blockers}\n\n` +
    `## Operator attachment placeholders\n\n` +
    `- Preview browser smoke result: \`attach sanitized PASS/FAIL summary here after separate operator run\`\n` +
    `- Rollback/fallback browser smoke result: \`attach sanitized PASS/FAIL summary here after separate operator run\`\n` +
    `- Decision record: \`attach manually reviewed non-executable decision record here\`\n` +
    `- Reviewer verdict: \`pending separate go/no-go review\`\n`
}

function escapeCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, "<br>")
}

function renderObjectBullets(value) {
  return Object.entries(value)
    .map(([key, entry]) => `- ${key}: \`${entry}\``)
    .join("\n") + "\n"
}

function scanUnsafeOutput(output) {
  return forbiddenOutputPatterns
    .filter((entry) => entry.pattern.test(output))
    .map((entry) => entry.label)
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

function buildCheckSummary(options) {
  const inputCheck = checkRequiredInputs()
  const bundle = buildBundle(options)
  const markdown = renderMarkdown(bundle)
  const json = `${JSON.stringify(bundle, null, 2)}\n`
  const markdownFindings = scanUnsafeOutput(markdown)
  const jsonFindings = scanUnsafeOutput(json)
  const findings = Array.from(new Set([...markdownFindings, ...jsonFindings]))

  return {
    artifact_type: ARTIFACT_TYPE,
    check_mode: true,
    generated_at: bundle.generated_at,
    ok: inputCheck.ok && findings.length === 0,
    required_inputs_ok: inputCheck.ok,
    missing_files: inputCheck.missing_files,
    missing_package_scripts: inputCheck.missing_package_scripts,
    unsafe_output_findings: findings,
    exporter_posture: bundle.exporter.mode,
    network_calls_performed: false,
    checkout_cutover_performed: false,
    executable_approval_included: false,
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
    checkout_cutover_performed: false,
    executable_approval_included: false,
  }, null, 2) + "\n")
}

try {
  main()
} catch (error) {
  process.stderr.write(`[delivery-hub-cutover-evidence-bundle] ${error.message}\n`)
  process.exitCode = 1
}
