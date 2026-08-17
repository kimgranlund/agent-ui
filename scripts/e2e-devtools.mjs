#!/usr/bin/env node
/**
 * scripts/e2e-devtools.mjs — the REAL end-to-end devtools smoke (GH #1145; ADR-0200).
 *
 * Retires the last unmeasured tier named in #1122's S5 Findings: every prior gate proved the
 * `/__devtools` seam at the handler-direct tier (fabricated req/res) and the harness page against a
 * built bundle with a stubbed seam. THIS script boots a real `vite dev`, hits the real `/__devtools`
 * HTTP seam over a real socket, drives the harness page in headless Chromium via the SHIPPED
 * `@agent-ui/devtools/playwright` helper (one selector list, two consumers — SPEC-R8 AC3), and
 * asserts the capture round-trip byte-for-byte (SPEC-R6 AC3), then tears the vite process tree down
 * provably (the flaky-gates zombie class).
 *
 * Standalone by design (not folded into `npm run check`/`test:browser`): it boots a dev server +
 * Chromium pair (~20-40 s cold), which none of the standing gates do — the sanctioned shape is a
 * separate `npm run e2e:devtools` judged by exit code (#1145 acceptance).
 *
 * Usage:
 *   node scripts/e2e-devtools.mjs            # run the smoke; exit 0 green / 1 red
 *   node scripts/e2e-devtools.mjs selftest   # prove the script's own machinery (negative controls)
 *
 * Exit codes: 0 = pass · 1 = failure · 2 = usage.
 *
 * The vite child is spawned DETACHED in its own process group so teardown can signal the whole tree
 * (`kill(-pid)`) — vite's own esbuild/rolldown/watcher children die with it. Teardown then VERIFIES:
 * the direct pid is gone (ESRCH) and `pgrep -g <pgid>` finds no survivor. Run the smoke twice
 * back-to-back to prove idempotence — nothing squats the port between runs (never 5173: the port is
 * freshly OS-allocated every run).
 *
 * Node ≥ 22.18 (this repo pins 24.x): the native type-stripping loader lets this .mjs import the
 * shipped TS helper directly — the repo's erasableSyntaxOnly law is exactly the strippable subset.
 */

import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VITE_BIN = path.join(ROOT, 'node_modules', '.bin', 'vite')

// ── small machinery (selftested below) ────────────────────────────────────────────────────────────

/** Ask the OS for a free ephemeral port — never squat a fixed number (5173 belongs to Kim's dev loop). */
export function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close((err) => (err ? reject(err) : resolve(port)))
    })
  })
}

/** Poll `url` until fetch resolves ok (any HTTP status counts as "listening" when `anyStatus`),
 *  throwing past `timeoutMs`. The readiness target is /__devtools/status — readiness AND seam-mounted
 *  proven in one probe. */
export async function waitForHttp(url, { timeoutMs = 60_000, intervalMs = 250, anyStatus = false } = {}) {
  const deadline = Date.now() + timeoutMs
  let lastErr = 'no attempt'
  for (;;) {
    try {
      const res = await fetch(url)
      if (anyStatus || res.ok) return res
      lastErr = `HTTP ${res.status}`
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err)
    }
    if (Date.now() > deadline) throw new Error(`waitForHttp: ${url} not ready after ${timeoutMs}ms (${lastErr})`)
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

/** Kill a detached child's WHOLE process group and verify nothing survives. Throws when a survivor
 *  remains — a zombie is a loud failure here, never a silent leak. */
export async function killTree(child, { graceMs = 4000 } = {}) {
  const pid = child.pid
  if (typeof pid !== 'number') throw new Error('killTree: child has no pid')
  const exited = child.exitCode !== null || child.signalCode !== null ? Promise.resolve() : once(child, 'exit')
  try {
    process.kill(-pid, 'SIGTERM') // negative pid ⇒ the whole group (detached ⇒ pgid === pid)
  } catch (err) {
    if (err.code !== 'ESRCH') throw err // already gone is fine
  }
  const timedOut = await Promise.race([
    exited.then(() => false),
    new Promise((r) => setTimeout(() => r(true), graceMs)),
  ])
  if (timedOut) {
    try {
      process.kill(-pid, 'SIGKILL')
    } catch (err) {
      if (err.code !== 'ESRCH') throw err
    }
    await Promise.race([exited, new Promise((r) => setTimeout(r, 2000))])
  }
  // Verification leg 1: the direct pid is gone.
  let direct = true
  try {
    process.kill(pid, 0)
  } catch (err) {
    direct = err.code !== 'ESRCH' ? direct : false
  }
  if (direct) throw new Error(`killTree: pid ${pid} still alive after teardown`)
  // Verification leg 2: no group survivor (macOS/Linux pgrep -g <pgid>; exit 1 = none found).
  const pg = spawnSync('pgrep', ['-g', String(pid)], { encoding: 'utf8' })
  if (pg.status === 0 && pg.stdout.trim() !== '') {
    throw new Error(`killTree: process-group survivors remain: ${pg.stdout.trim().split('\n').join(', ')}`)
  }
}

// ── the smoke ─────────────────────────────────────────────────────────────────────────────────────

async function smoke() {
  // The shipped helper — imported as VALUE TS via node's type-stripping loader: the SAME selector
  // list and drive functions every other consumer uses (SPEC-R8 AC3's one-list law), never a copy.
  const helper = await import('../packages/agent-ui/devtools/src/playwright/index.ts')
  const { openHarness, postTurn, waitForTurnEnd, expectRendered, HARNESS_SELECTORS } = helper
  const { chromium } = await import('playwright')

  const port = await freePort()
  const base = `http://127.0.0.1:${port}`
  console.log(`[e2e] vite dev on OS-allocated port ${port}`)

  const vite = spawn(VITE_BIN, ['--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    cwd: ROOT,
    detached: true, // own process group ⇒ killTree can signal the whole tree
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let viteLog = ''
  vite.stdout.on('data', (d) => (viteLog += String(d)))
  vite.stderr.on('data', (d) => (viteLog += String(d)))
  const earlyExit = new Promise((_, reject) =>
    vite.once('exit', (code, sig) => reject(new Error(`vite exited early (${code ?? sig})\n${viteLog.slice(-2000)}`))),
  )

  let browser
  try {
    // 1 · readiness = the seam itself answers over real HTTP (GET /status, SPEC-R6).
    const statusRes = await Promise.race([waitForHttp(`${base}/__devtools/status`, { timeoutMs: 90_000 }), earlyExit])
    const status = await statusRes.json()
    const ids = (status.backends ?? []).map((b) => b.id).sort()
    assert(
      JSON.stringify(ids) === JSON.stringify(['a2a', 'proxy', 'replay']),
      `GET /__devtools/status backend rows: got ${JSON.stringify(ids)}`,
    )
    console.log('[e2e] seam ready — /__devtools/status rows: ' + ids.join(', '))

    // 2 · POST /turn over the real socket: a canned replay timeline streams back as NDJSON ending in
    //     turn-end{status:'complete'} (SPEC-R6 AC1/AC2 at the real-HTTP tier for the first time).
    const line = JSON.stringify({ version: 'v1.0', createSurface: { surfaceId: 'smoke', catalogId: 'agent-ui' } })
    const turnRes = await fetch(`${base}/__devtools/turn`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ backend: 'replay', input: { text: 'e2e' }, timelines: [[line]] }),
    })
    assert(turnRes.status === 200, `POST /turn status ${turnRes.status}`)
    assert((turnRes.headers.get('content-type') ?? '').includes('x-ndjson'), 'POST /turn content-type is NDJSON')
    const events = (await turnRes.text()).trim().split('\n').map((l) => JSON.parse(l))
    const last = events[events.length - 1]
    assert(events[0]?.kind === 'turn-start', `first event is turn-start (got ${events[0]?.kind})`)
    assert(last?.kind === 'turn-end' && last?.status === 'ok', `last event is turn-end ok (got ${JSON.stringify(last)})`)
    console.log(`[e2e] POST /turn streamed ${events.length} NDJSON events, turn-end ok`)

    // 3 · headless Chromium drives the REAL harness page through the shipped helper.
    browser = await chromium.launch()
    const page = await browser.newPage()
    await openHarness(page, base)
    const since = await postTurn(page, 'run the canned canvas-button turn')
    await waitForTurnEnd(page, { since, timeoutMs: 20_000 })
    await expectRendered(page, 'canvas', { timeoutMs: 10_000 }) // browser truth (SPEC-R9)
    console.log('[e2e] harness page: replay turn complete, canvas verdict data-ok=true')

    // 4 · the capture round-trip, byte-for-byte: Export on the page → POST the page's own raw JSON to
    //     the seam → GET it back → identical bytes (SPEC-R6 AC3 over real HTTP).
    await page.click(HARNESS_SELECTORS.exportButton)
    const raw = await page.$eval(HARNESS_SELECTORS.captureOutput, (el) =>
      el instanceof HTMLTextAreaElement ? el.value : '',
    )
    assert(raw.length > 0, 'Export produced a non-empty capture')
    const postRes = await fetch(`${base}/__devtools/captures`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: raw,
    })
    assert(postRes.status === 200, `POST /captures status ${postRes.status}`)
    const { id } = await postRes.json()
    assert(typeof id === 'string' && id.length > 0, 'POST /captures returned an id')
    const getRes = await fetch(`${base}/__devtools/captures/${id}`)
    assert(getRes.status === 200, `GET /captures/${id} status ${getRes.status}`)
    const roundTripped = await getRes.text()
    assert(roundTripped === raw, `capture round-trip byte-equal (${roundTripped.length} vs ${raw.length} bytes)`)
    const index = await (await fetch(`${base}/__devtools/captures`)).json()
    assert(index.captures?.some((r) => r.id === id), 'GET /captures index lists the posted capture')
    console.log(`[e2e] capture round-trip byte-equal (${raw.length} bytes, id ${id})`)
  } finally {
    if (browser) await browser.close().catch(() => {})
    vite.removeAllListeners('exit') // earlyExit's rejection is teardown noise from here on
    vite.once('exit', () => {})
    await killTree(vite)
  }

  // Post-teardown proof: the port is actually released — the next run (idempotence) starts clean.
  await new Promise((resolve, reject) => {
    const probe = net.connect({ host: '127.0.0.1', port }, () => {
      probe.destroy()
      reject(new Error(`port ${port} still accepting connections after teardown`))
    })
    probe.once('error', () => resolve())
  })
  console.log('[e2e] teardown verified: process tree dead, port released')
}

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`)
}

// ── selftest (negative controls for the machinery, per script-writing-rules) ──────────────────────

async function selftest() {
  let failures = 0
  const check = (name, ok) => {
    console.log(`${ok ? 'ok' : 'FAIL'} - ${name}`)
    if (!ok) failures += 1
  }

  // freePort returns a genuinely bindable port.
  const p = await freePort()
  const bindable = await new Promise((resolve) => {
    const s = net.createServer()
    s.once('error', () => resolve(false))
    s.listen(p, '127.0.0.1', () => s.close(() => resolve(true)))
  })
  check('freePort returns a bindable port', Number.isInteger(p) && p > 0 && bindable)

  // waitForHttp: NEGATIVE control — a dead port times out with a thrown error, never a hang.
  const dead = await freePort()
  const t0 = Date.now()
  const timedOut = await waitForHttp(`http://127.0.0.1:${dead}/nope`, { timeoutMs: 700, intervalMs: 100 }).then(
    () => false,
    () => true,
  )
  check('waitForHttp rejects on a dead port within its timeout', timedOut && Date.now() - t0 < 5000)

  // killTree: kills a real detached tree (parent + backgrounded child) and verifies both dead.
  const tree = spawn('sh', ['-c', 'sleep 60 & sleep 60'], { detached: true, stdio: 'ignore' })
  await new Promise((r) => setTimeout(r, 200)) // let the child fork
  const before = spawnSync('pgrep', ['-g', String(tree.pid)], { encoding: 'utf8' })
  const hadTree = before.status === 0 && before.stdout.trim().split('\n').length >= 2
  let killed = true
  try {
    await killTree(tree)
  } catch {
    killed = false
  }
  check('killTree reaps a detached parent+child tree and verifies it', hadTree && killed)

  // killTree: NEGATIVE control on an already-dead child — idempotent, no throw.
  const gone = spawn('true', { detached: true, stdio: 'ignore' })
  await once(gone, 'exit')
  const idempotent = await killTree(gone).then(
    () => true,
    () => false,
  )
  check('killTree is idempotent on an already-exited child', idempotent)

  // Usage contract: an unknown subcommand exits 2 (self-invocation).
  const usage = spawnSync(process.execPath, [fileURLToPath(import.meta.url), 'bogus'], { encoding: 'utf8' })
  check('unknown subcommand exits 2', usage.status === 2)

  console.log(failures === 0 ? 'selftest: all green' : `selftest: ${failures} failure(s)`)
  return failures === 0 ? 0 : 1
}

// ── entry ─────────────────────────────────────────────────────────────────────────────────────────

const arg = process.argv[2]
if (arg === 'selftest') {
  process.exit(await selftest())
} else if (arg === undefined) {
  try {
    await smoke()
    console.log('[e2e] PASS')
    process.exit(0)
  } catch (err) {
    console.error(`[e2e] FAIL: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }
} else {
  console.error('usage: node scripts/e2e-devtools.mjs [selftest]')
  process.exit(2)
}
