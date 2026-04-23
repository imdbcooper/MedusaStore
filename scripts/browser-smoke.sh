#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/common.sh"

load_root_env

BROWSER_SMOKE_URL="${BROWSER_SMOKE_URL:-${STOREFRONT_URL}/ru/account}"
BROWSER_SMOKE_PATH_EXPECTATION="${BROWSER_SMOKE_PATH_EXPECTATION:-/ru/account}"
BROWSER_SMOKE_TIMEOUT_MS="${BROWSER_SMOKE_TIMEOUT_MS:-20000}"
BROWSER_SMOKE_BROWSER_BIN="${BROWSER_SMOKE_BROWSER_BIN:-$(command -v google-chrome-stable || command -v google-chrome || true)}"

if [[ -z "$BROWSER_SMOKE_BROWSER_BIN" ]]; then
  log_error "Minimal browser smoke requires google-chrome or google-chrome-stable in PATH."
  exit 1
fi

if ! command_exists node; then
  log_error "Minimal browser smoke requires node in PATH."
  exit 1
fi

if ! curl -fsS "$BROWSER_SMOKE_URL" >/dev/null; then
  log_error "Storefront is not reachable for browser smoke: $BROWSER_SMOKE_URL"
  exit 1
fi

BROWSER_BIN="$BROWSER_SMOKE_BROWSER_BIN" \
TARGET_URL="$BROWSER_SMOKE_URL" \
EXPECTED_PATH="$BROWSER_SMOKE_PATH_EXPECTATION" \
TIMEOUT_MS="$BROWSER_SMOKE_TIMEOUT_MS" \
node <<'EOF'
const { spawn } = require('node:child_process')
const http = require('node:http')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { URL } = require('node:url')

const browserBinary = process.env.BROWSER_BIN
const targetUrl = process.env.TARGET_URL
const expectedPath = process.env.EXPECTED_PATH
const timeoutMs = Number(process.env.TIMEOUT_MS || 20000)

if (!browserBinary) {
  console.error('[error] Missing browser binary for browser smoke.')
  process.exit(1)
}

new URL(targetUrl)
const browserProfileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-smoke-'))
let browserProcess = null
let websocketUrl = null
let nextMessageId = 0
const pending = new Map()
const pageSessions = new Map()
let browserWs = null
let closed = false

function cleanupAndExit(code, message) {
  if (closed) {
    process.exit(code)
  }

  closed = true

  if (message) {
    const writer = code === 0 ? process.stdout : process.stderr
    writer.write(`${message}\n`)
  }

  for (const [, reject] of pending.values()) {
    reject(new Error('Browser smoke aborted'))
  }
  pending.clear()

  try {
    if (browserWs && browserWs.readyState === 1) {
      browserWs.close()
    }
  } catch {}

  if (browserProcess && !browserProcess.killed) {
    browserProcess.kill('SIGTERM')
  }

  try {
    fs.rmSync(browserProfileDir, { recursive: true, force: true })
  } catch {}

  process.exit(code)
}

function waitForChromeDebuggerUrl() {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs

    const probe = () => {
      http.get('http://127.0.0.1:9222/json/version', (response) => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', (chunk) => {
          body += chunk
        })
        response.on('end', () => {
          if (response.statusCode !== 200) {
            retry(new Error(`Unexpected status ${response.statusCode}`))
            return
          }

          try {
            const parsed = JSON.parse(body)
            if (!parsed.webSocketDebuggerUrl) {
              retry(new Error('webSocketDebuggerUrl is missing in /json/version response'))
              return
            }
            resolve(parsed.webSocketDebuggerUrl)
          } catch (error) {
            retry(error)
          }
        })
      }).on('error', retry)
    }

    const retry = (error) => {
      if (Date.now() >= deadline) {
        reject(error)
        return
      }
      setTimeout(probe, 250)
    }

    probe()
  })
}

function createWebSocket(url) {
  return new Promise((resolve, reject) => {
    const wsModulePath = require.resolve('next/dist/compiled/ws', {
      paths: [path.join(process.cwd(), 'medusa-agency-boilerplate-storefront')],
    })
    const WebSocket = require(wsModulePath)
    const ws = new WebSocket(url)

    ws.once('open', () => resolve(ws))
    ws.once('error', reject)
  })
}

function send(message, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++nextMessageId
    pending.set(id, [resolve, reject])
    const payload = { id, ...message }
    if (sessionId) {
      payload.sessionId = sessionId
    }
    browserWs.send(JSON.stringify(payload))
  })
}

function listen() {
  browserWs.on('message', (data) => {
    const message = JSON.parse(String(data))

    if (typeof message.id === 'number') {
      const handler = pending.get(message.id)
      if (!handler) {
        return
      }
      pending.delete(message.id)
      const [resolve, reject] = handler
      if (message.error) {
        reject(new Error(message.error.message || 'Chrome DevTools Protocol error'))
      } else {
        resolve(message.result)
      }
      return
    }

    if (message.method === 'Target.attachedToTarget') {
      const { sessionId, targetInfo } = message.params
      pageSessions.set(targetInfo.targetId, sessionId)
    }
  })

  browserWs.on('close', () => {
    if (!closed) {
      cleanupAndExit(1, '[error] Browser smoke connection closed unexpectedly.')
    }
  })
}

async function waitForPageSession(targetId) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const sessionId = pageSessions.get(targetId)
    if (sessionId) {
      return sessionId
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  throw new Error('Timed out waiting for page session attachment.')
}

async function waitForLoadEvent(sessionId) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const result = await send(
      {
        method: 'Runtime.evaluate',
        params: {
          expression: 'document.readyState',
          returnByValue: true,
        },
      },
      sessionId
    )

    if (result?.result?.value === 'complete') {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error('Timed out waiting for document.readyState=complete.')
}

async function main() {
  browserProcess = spawn(
    browserBinary,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=9222',
      `--user-data-dir=${browserProfileDir}`,
      'about:blank',
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  )

  browserProcess.stdout.on('data', () => {})
  browserProcess.stderr.on('data', () => {})
  browserProcess.once('exit', (code) => {
    if (!closed) {
      cleanupAndExit(1, `[error] Browser exited before smoke finished (code ${code ?? 'unknown'}).`)
    }
  })

  websocketUrl = await waitForChromeDebuggerUrl()
  browserWs = await createWebSocket(websocketUrl)
  listen()

  await send({
    method: 'Target.setAutoAttach',
    params: {
      autoAttach: true,
      waitForDebuggerOnStart: false,
      flatten: true,
    },
  })

  const targetResult = await send({
    method: 'Target.createTarget',
    params: {
      url: 'about:blank',
    },
  })

  const targetId = targetResult.targetId
  const sessionId = await waitForPageSession(targetId)

  await send({ method: 'Page.enable' }, sessionId)
  await send({ method: 'Runtime.enable' }, sessionId)
  await send({ method: 'Page.navigate', params: { url: targetUrl } }, sessionId)
  await waitForLoadEvent(sessionId)

  const evaluation = await send(
    {
      method: 'Runtime.evaluate',
      params: {
        expression: `(() => {
          const accountLink = document.querySelector('[data-testid="nav-account-link"]')
          return {
            title: document.title,
            locationHref: window.location.href,
            locationPathname: window.location.pathname,
            bodyText: document.body ? document.body.innerText : '',
            accountLinkHref: accountLink ? accountLink.getAttribute('href') : null,
          }
        })()`,
        returnByValue: true,
      },
    },
    sessionId
  )

  const result = evaluation?.result?.value
  if (!result) {
    throw new Error('Browser smoke could not read storefront page state.')
  }

  if (result.locationPathname !== expectedPath) {
    throw new Error(`Expected browser path ${expectedPath}, got ${result.locationPathname}.`)
  }

  if (!String(result.title || '').trim()) {
    throw new Error('Storefront page title is empty.')
  }

  if (!String(result.bodyText || '').includes('Email')) {
    throw new Error('Account login surface did not expose expected login form content.')
  }

  if (result.accountLinkHref !== '/ru/account') {
    throw new Error(`Expected nav account link href /ru/account, got ${String(result.accountLinkHref)}.`)
  }

  cleanupAndExit(
    0,
    `[info] Browser smoke passed: ${targetUrl} -> ${result.locationPathname} (title: ${result.title})`
  )
}

main().catch((error) => {
  cleanupAndExit(1, `[error] Browser smoke failed: ${error.message}`)
})
EOF
