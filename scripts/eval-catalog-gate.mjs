#!/usr/bin/env node
/**
 * scripts/eval-catalog-gate.mjs — promotes `npm run eval:catalog` to a standing gate (GH #1356).
 *
 * `npm run eval:catalog` (scripts/eval-a2ui-catalog.mjs, rubric .claude/docs/rubrics/
 * a2ui-catalog-example.md §5) already reads 60/60 green on main as of 2026-08-19 (#1322 + #1334),
 * but until now it only ran on-demand — nothing failed a build when a card regressed. This script
 * wraps it as an exit-coded, standing gate in the `test:browser` family, MIRRORING
 * scripts/e2e-devtools.mjs's own boot-a-server pattern: boot a real `vite dev` on an OS-allocated
 * free port (never 5174 — that's Kim's own live dev server), wait for the a2ui-catalog page to
 * answer, run the real eval runner against that server with `--no-shots`, then tear the vite
 * process tree down provably (killTree's own survivor verification) before exiting with the
 * runner's own exit code.
 *
 * The freePort/waitForHttp/killTree machinery below is a DELIBERATE, self-contained COPY of
 * e2e-devtools.mjs's own functions rather than an import of that module: e2e-devtools.mjs runs its
 * own smoke()/selftest() unconditionally at the bottom of the file (no ESM main-module guard), so
 * importing it from a second entry point re-executes ITS OWN top-level `process.argv`-driven branch
 * as a side effect of the import (confirmed directly while authoring this script — an `import` of
 * e2e-devtools.mjs silently re-ran that script's own selftest under this script's argv). Copying the
 * small, already-selftested machinery keeps this gate fully self-contained and avoids adding an
 * entry guard to e2e-devtools.mjs for a usage it was never designed for.
 *
 * BASELINE STORY (rubric §5.7): this gate is gate-verdicts-only — it asserts the eval runner's own
 * pass/fail exit code (every card's A1/A2/A4/B1/B2/B3g/C1/C2 checks green), never stores or
 * pixel-diffs PNGs. `--no-shots` is passed deliberately: no screenshot artifacts are written or
 * compared here. The stored-PNG + pixel-diff baseline tier the rubric also describes stays an
 * opt-in, on-demand path (`npm run eval:catalog` without `--no-shots`) — never part of this gate.
 *
 * Usage:
 *   node scripts/eval-catalog-gate.mjs            # run the gate; exit 0 green / 1 red / 2 setup
 *   node scripts/eval-catalog-gate.mjs selftest   # prove the script's own machinery
 *
 * Wired as `npm run test:eval-catalog`, appended LAST to the `test:browser` chain (after
 * `test:visual`) — a real dev server + real playwright browser gate, the same shard family as
 * `e2e:devtools`'s own boot-a-server shape, deliberately never folded into a vitest project (a
 * vitest project doesn't own a server lifecycle the way this gate needs to).
 *
 * Exit codes: 0 = pass · 1 = failure · 2 = setup/usage failure.
 */

import { existsSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VITE_BIN = path.join(ROOT, 'node_modules', '.bin', 'vite')
const EVAL_SCRIPT = path.join(ROOT, 'scripts', 'eval-a2ui-catalog.mjs')

// ── small machinery (selftested below; mirrors e2e-devtools.mjs's own copy verbatim) ───────────────

/** Ask the OS for a free ephemeral port — never squat a fixed number (5174 belongs to Kim's dev loop). */
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
 *  throwing past `timeoutMs`. */
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

// ── the gate ──────────────────────────────────────────────────────────────────────────────────────

async function gate() {
  if (!existsSync(EVAL_SCRIPT)) {
    console.error(`[eval-catalog-gate] FAIL: missing ${EVAL_SCRIPT}`)
    process.exit(2)
  }

  const port = await freePort()
  const base = `http://127.0.0.1:${port}`
  console.log(`[eval-catalog-gate] vite dev on OS-allocated port ${port}`)

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

  let runner
  try {
    // Readiness = the actual page the eval runner will load answers over real HTTP.
    await Promise.race([
      waitForHttp(`${base}/a2ui-catalog.html`, { timeoutMs: 60_000, anyStatus: true }),
      earlyExit,
    ])
    console.log('[eval-catalog-gate] a2ui-catalog.html ready')

    runner = spawnSync(process.execPath, [EVAL_SCRIPT, '--base', base, '--no-shots'], {
      cwd: ROOT,
      stdio: 'inherit',
    })
  } finally {
    vite.removeAllListeners('exit') // earlyExit's rejection is teardown noise from here on
    vite.once('exit', () => {})
    await killTree(vite)
  }

  if (typeof runner?.status !== 'number') {
    console.error('[eval-catalog-gate] FAIL: eval-a2ui-catalog.mjs produced no exit code')
    process.exit(2)
  }
  console.log(`[eval-catalog-gate] ${runner.status === 0 ? 'PASS' : 'FAIL'} (runner exit ${runner.status})`)
  console.log('[eval-catalog-gate] teardown verified: process tree dead')
  process.exit(runner.status)
}

// ── selftest (negative controls for the machinery, per script-writing-rules) ──────────────────────

async function selftest() {
  let failures = 0
  const check = (name, ok) => {
    console.log(`${ok ? 'ok' : 'FAIL'} - ${name}`)
    if (!ok) failures += 1
  }

  check('EVAL_SCRIPT resolves to a real file', existsSync(EVAL_SCRIPT))

  // freePort returns a genuinely bindable port.
  const p = await freePort()
  const bindable = await new Promise((resolve) => {
    const s = net.createServer()
    s.once('error', () => resolve(false))
    s.listen(p, '127.0.0.1', () => s.close(() => resolve(true)))
  })
  check('freePort returns a bindable port', Number.isInteger(p) && p > 0 && bindable)

  // waitForHttp: NEGATIVE control — a dead port with anyStatus:true still rejects within its
  // timeout, so the readiness probe fails closed rather than hanging forever.
  const dead = await freePort()
  const t0 = Date.now()
  const timedOut = await waitForHttp(`http://127.0.0.1:${dead}/a2ui-catalog.html`, {
    timeoutMs: 700,
    intervalMs: 100,
    anyStatus: true,
  }).then(
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
    await gate()
  } catch (err) {
    console.error(`[eval-catalog-gate] FAIL: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }
} else {
  console.error('usage: node scripts/eval-catalog-gate.mjs [selftest]')
  process.exit(2)
}
