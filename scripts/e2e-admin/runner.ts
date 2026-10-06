// scripts/e2e-admin/runner.ts: argument parsing, the vite and Chromium lifecycle, per-flow isolation,
// the post-flow wire checks and the negative-control verdict for `scripts/e2e-admin.mjs`.
//
// One vite per run (detached, OS-allocated port, teardown verified), one Chromium per run, a fresh
// 1440x900 context per flow behind `installIntercept`. The boot helpers come from
// `scripts/lib/dev-server.mjs`, injected by the entry as a `DevServerKit` so this tree stays pure TS.
// `chromium` is loaded only inside the run path, never at import, so the selftest launches no browser.

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Browser, BrowserContext, Page } from 'playwright'
import { openAdmin } from './admin-page.ts'
import { installIntercept, unconsumedTurns, type WireLog } from './intercept.ts'
import { FlowAssertion, parseScenario, type AdminScenario } from './scenario.ts'

// ── flow and run types ────────────────────────────────────────────────────────────────────────────────

export interface FlowContext {
  page: Page
  wire: WireLog
  scenario: AdminScenario
  /** The vite origin, for example `http://127.0.0.1:53211`. */
  base: string
}

export interface AdminFlow {
  name: string
  /** `<flow>.json`, resolved under `scripts/e2e-admin/fixtures/`. */
  fixture: string
  run(ctx: FlowContext): Promise<void>
}

export interface NegativeControl {
  flow: string
  /** A wrong-behavior fixture, relative to `scripts/e2e-admin/fixtures/`. */
  fixture: string
}

export interface DevServerKit {
  freePort(): Promise<number>
  waitForHttp(url: string, options?: { timeoutMs?: number; intervalMs?: number; anyStatus?: boolean }): Promise<unknown>
  killTree(child: ChildProcess): Promise<void>
  assertPortReleased(port: number): Promise<void>
}

export const FIXTURES_DIR = fileURLToPath(new URL('./fixtures/', import.meta.url))
export const PER_FLOW_TIMEOUT_MS = 60_000
export const VIEWPORT = { width: 1440, height: 900 } as const
const VITE_READY_TIMEOUT_MS = 90_000
const WARM_UP_TIMEOUT_MS = 120_000

/** A usage or setup problem: the run exits 2. */
export class SetupError extends Error {
  override name = 'SetupError'
}

// ── argument parsing (all of it runs before vite boots) ───────────────────────────────────────────────

export type Command =
  | { mode: 'run'; only?: string[]; fixture?: string }
  | { mode: 'list' }
  | { mode: 'selftest' }
  | { mode: 'record'; flow: string; out: string }

export const USAGE = [
  'usage: node scripts/e2e-admin.mjs [run] [--only <glob>[,<glob>...]] [--fixture <path>]',
  '       node scripts/e2e-admin.mjs list',
  '       node scripts/e2e-admin.mjs record --flow <name> --out <path>',
  '       node scripts/e2e-admin.mjs selftest',
].join('\n')

function readFlags(args: readonly string[], allowed: readonly string[]): Map<string, string> {
  const flags = new Map<string, string>()
  for (let i = 0; i < args.length; i += 1) {
    const flag = args[i]!
    if (!allowed.includes(flag)) throw new SetupError(`unknown argument "${flag}"`)
    if (flags.has(flag)) throw new SetupError(`${flag} given twice`)
    const value = args[i + 1]
    if (value === undefined || value === '') throw new SetupError(`${flag} needs a value`)
    flags.set(flag, value)
    i += 1
  }
  return flags
}

/** Parse argv (without node and the script path). Throws `SetupError` on any usage problem. */
export function parseCli(argv: readonly string[]): Command {
  const [first, ...rest] = argv
  if (first === 'list' || first === 'selftest') {
    if (rest.length > 0) throw new SetupError(`${first} takes no arguments`)
    return { mode: first }
  }
  if (first === 'record') {
    const flags = readFlags(rest, ['--flow', '--out'])
    const flow = flags.get('--flow')
    const out = flags.get('--out')
    if (flow === undefined || out === undefined) throw new SetupError('record needs both --flow and --out')
    return { mode: 'record', flow, out }
  }
  let args: readonly string[]
  if (first === undefined) args = []
  else if (first === 'run') args = rest
  else if (first.startsWith('--')) args = argv
  else throw new SetupError(`unknown mode "${first}"`)
  const flags = readFlags(args, ['--only', '--fixture'])
  const only = flags.get('--only')
  const fixture = flags.get('--fixture')
  const globs = only?.split(',').map((g) => g.trim())
  if (globs !== undefined && globs.some((g) => g === '')) throw new SetupError('--only holds an empty glob')
  return {
    mode: 'run',
    ...(globs !== undefined ? { only: globs } : {}),
    ...(fixture !== undefined ? { fixture } : {}),
  }
}

/** `*` is the only wildcard; everything else matches literally. */
export function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${escaped}$`)
}

/** Read and parse one scenario file; a missing or invalid file is a `SetupError`. */
export function loadScenario(file: string): AdminScenario {
  if (!existsSync(file)) throw new SetupError(`fixture not found: ${file}`)
  try {
    return parseScenario(readFileSync(file, 'utf8'))
  } catch (err) {
    throw new SetupError(`${file}: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export interface PlannedFlow {
  flow: AdminFlow
  scenario: AdminScenario
  fixtureLabel: string
}

export interface RunPlan {
  flows: PlannedFlow[]
  negatives: PlannedFlow[]
}

/** Resolve `--only` and `--fixture` into the flows to run and load every scenario. */
export function planRun(
  command: { only?: string[]; fixture?: string },
  flows: readonly AdminFlow[],
  negatives: readonly NegativeControl[],
  cwd: string,
): RunPlan {
  const patterns = command.only?.map(globToRegExp)
  const selected = patterns === undefined ? [...flows] : flows.filter((f) => patterns.some((p) => p.test(f.name)))
  if (selected.length === 0) throw new SetupError(`--only ${command.only?.join(',')} matched no flow`)
  if (command.fixture !== undefined && selected.length !== 1) {
    throw new SetupError(`--fixture needs exactly one matched flow (matched ${selected.length})`)
  }
  const planned = selected.map((flow) => {
    const file = command.fixture !== undefined ? path.resolve(cwd, command.fixture) : path.join(FIXTURES_DIR, flow.fixture)
    return { flow, scenario: loadScenario(file), fixtureLabel: command.fixture ?? flow.fixture }
  })
  const plannedNegatives =
    command.only === undefined
      ? negatives.map((control) => {
          const flow = flows.find((f) => f.name === control.flow)
          if (flow === undefined) throw new SetupError(`negative control names an unknown flow "${control.flow}"`)
          return { flow, scenario: loadScenario(path.join(FIXTURES_DIR, control.fixture)), fixtureLabel: control.fixture }
        })
      : []
  return { flows: planned, negatives: plannedNegatives }
}

// ── flow outcome, wire checks and the negative-control verdict ────────────────────────────────────────

export type FlowOutcome =
  | { kind: 'pass' }
  | { kind: 'assertion'; message: string }
  | { kind: 'crash'; message: string }
  | { kind: 'timeout'; message: string }

/** Red the flow when its wire log holds an unmatched or exhausted entry or a scripted turn stayed unused. */
export function assertWireClean(wire: WireLog): void {
  const bad = wire.entries.filter((e) => e.outcome === 'unmatched' || e.outcome === 'exhausted')
  if (bad.length > 0) {
    const list = bad.map((e) => `${e.outcome} ${e.endpoint} #${e.seq}${e.turnIndex !== undefined ? ` (turns[${e.turnIndex}])` : ''}`)
    throw new FlowAssertion(`wire log holds ${list.join(', ')}`)
  }
  const left = unconsumedTurns(wire)
  if (left.length > 0) throw new FlowAssertion(`scripted turn(s) never consumed: ${left.map((i) => `turns[${i}]`).join(', ')}`)
}

/** Run one flow body under a timeout, then the post-flow check, and classify the result. */
export async function guardFlow(
  run: () => Promise<void>,
  timeoutMs: number,
  after?: () => void,
): Promise<FlowOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs)
  })
  try {
    const result = await Promise.race([run().then(() => 'done' as const), timeout])
    if (result === 'timeout') return { kind: 'timeout', message: `timed out after ${timeoutMs} ms` }
    after?.()
    return { kind: 'pass' }
  } catch (err) {
    if (err instanceof FlowAssertion) return { kind: 'assertion', message: err.message }
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return { kind: 'crash', message }
  } finally {
    clearTimeout(timer)
  }
}

/** A negative control is green only when its flow failed with a `FlowAssertion`. A pass, a crash or the
 *  per-flow timeout is red. */
export function negativeVerdict(outcome: FlowOutcome): { ok: boolean; message: string } {
  switch (outcome.kind) {
    case 'assertion':
      return { ok: true, message: 'red as expected' }
    case 'pass':
      return { ok: false, message: 'passed against a wrong-behavior fixture' }
    case 'crash':
      return { ok: false, message: `crashed instead of failing an assertion (${outcome.message})` }
    case 'timeout':
      return { ok: false, message: `hit the per-flow timeout instead of failing an assertion (${outcome.message})` }
  }
}

// ── vite lifecycle ────────────────────────────────────────────────────────────────────────────────────

export interface ViteHandle {
  child: ChildProcess
  port: number
  base: string
}

/** Spawn vite detached on an OS-allocated port and wait for the admin page to answer. On failure the
 *  process tree is reaped before the `SetupError` propagates. */
export async function bootVite(kit: DevServerKit, root: string): Promise<ViteHandle> {
  const port = await kit.freePort()
  const base = `http://127.0.0.1:${port}`
  console.log(`[e2e-admin] vite dev on OS-allocated port ${port}`)
  const child = spawn(path.join(root, 'node_modules', '.bin', 'vite'), ['--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    cwd: root,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let viteLog = ''
  child.stdout?.on('data', (d: Buffer) => (viteLog += String(d)))
  child.stderr?.on('data', (d: Buffer) => (viteLog += String(d)))
  const earlyExit = new Promise<never>((_, reject) =>
    child.once('exit', (code, signal) => reject(new SetupError(`vite exited early (${code ?? signal})\n${viteLog.slice(-2000)}`))),
  )
  try {
    await Promise.race([kit.waitForHttp(`${base}/agent-admin-app.html`, { timeoutMs: VITE_READY_TIMEOUT_MS }), earlyExit])
  } catch (err) {
    child.removeAllListeners('exit')
    await kit.killTree(child).catch(() => {})
    throw err instanceof SetupError ? err : new SetupError(`vite did not become ready: ${err instanceof Error ? err.message : String(err)}`)
  }
  child.removeAllListeners('exit')
  child.once('exit', () => {})
  earlyExit.catch(() => {})
  return { child, port, base }
}

/** Kill the vite process tree and prove the port is released. Throws on any survivor. */
export async function stopVite(kit: DevServerKit, vite: ViteHandle): Promise<void> {
  await kit.killTree(vite.child)
  await kit.assertPortReleased(vite.port)
}

// ── browser lifecycle ─────────────────────────────────────────────────────────────────────────────────

export async function launchChromium(): Promise<Browser> {
  const { chromium } = await import('playwright')
  return chromium.launch()
}

export function newFlowContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ viewport: VIEWPORT, serviceWorkers: 'block' })
}

async function closeContext(context: BrowserContext): Promise<void> {
  await context.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {})
  await context.close().catch(() => {})
}

const WARM_UP_SCENARIO: AdminScenario = { kind: 'agent-ui-admin-scenario', version: 1, name: 'warm-up', turns: [] }

/** Load the app once in a throwaway context and wait for the armed runner, so vite's dependency
 *  optimizer settles before any flow; a page that reloads under us gets another attempt. */
async function warmUp(browser: Browser, base: string): Promise<void> {
  const context = await newFlowContext(browser)
  try {
    const wire = installIntercept(context, WARM_UP_SCENARIO, new URL(base).origin)
    await wire.ready
    const page = await context.newPage()
    for (let attempt = 1; ; attempt += 1) {
      await openAdmin(page, base, WARM_UP_SCENARIO, { timeoutMs: WARM_UP_TIMEOUT_MS })
      await page.evaluate(() => {
        ;(window as { __e2eAdminWarm?: boolean }).__e2eAdminWarm = true
      })
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const stable = await page
        .evaluate(() => (window as { __e2eAdminWarm?: boolean }).__e2eAdminWarm === true)
        .catch(() => false)
      if (stable) return
      if (attempt >= 3) throw new SetupError('the admin page kept reloading during warm-up')
    }
  } catch (err) {
    throw err instanceof SetupError ? err : new SetupError(`warm-up failed: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    await closeContext(context)
  }
}

/** One flow in its own context behind the scenario's intercept. */
export async function runOneFlow(
  browser: Browser,
  planned: PlannedFlow,
  base: string,
  timeoutMs: number = PER_FLOW_TIMEOUT_MS,
  makeWire: (context: BrowserContext, scenario: AdminScenario, origin: string) => WireLog = installIntercept,
  after: (wire: WireLog) => void = assertWireClean,
): Promise<{ outcome: FlowOutcome; wire: WireLog | undefined; ms: number }> {
  const started = Date.now()
  const context = await newFlowContext(browser)
  let wire: WireLog | undefined
  try {
    const log = makeWire(context, planned.scenario, new URL(base).origin)
    wire = log
    await log.ready
    const page = await context.newPage()
    const outcome = await guardFlow(
      () => planned.flow.run({ page, wire: log, scenario: planned.scenario, base }),
      timeoutMs,
      () => after(log),
    )
    return { outcome, wire, ms: Date.now() - started }
  } finally {
    await closeContext(context)
  }
}

function firstLine(message: string): { head: string; rest: string[] } {
  const [head = '', ...rest] = message.split('\n')
  return { head, rest: rest.filter((line) => line.trim() !== '') }
}

function printDetail(rest: readonly string[]): void {
  for (const line of rest.slice(0, 12)) console.log(`    ${line}`)
}

/** The whole run: boot, warm up, every planned flow, then the negative controls, then verified teardown.
 *  Returns the exit code: 0 pass, 1 red, 2 setup. */
export async function runFlows(plan: RunPlan, kit: DevServerKit, root: string): Promise<number> {
  let vite: ViteHandle
  try {
    vite = await bootVite(kit, root)
  } catch (err) {
    console.log(`[e2e-admin] setup failed: ${err instanceof Error ? err.message : String(err)}`)
    console.log('e2e-admin: 0 passed, 0 failed')
    return 2
  }
  let passed = 0
  let failed = 0
  let setupFailure: string | undefined
  let browser: Browser | undefined
  try {
    browser = await launchChromium()
    await warmUp(browser, vite.base)
  } catch (err) {
    setupFailure = err instanceof Error ? err.message : String(err)
    console.log(`[e2e-admin] setup failed: ${setupFailure}`)
  }
  if (browser !== undefined && setupFailure === undefined) {
    for (const planned of plan.flows) {
      let row: { outcome: FlowOutcome; ms: number }
      try {
        row = await runOneFlow(browser, planned, vite.base)
      } catch (err) {
        row = { outcome: { kind: 'crash', message: err instanceof Error ? err.message : String(err) }, ms: 0 }
      }
      if (row.outcome.kind === 'pass') {
        passed += 1
        console.log(`ok ${planned.flow.name} (${row.ms} ms)`)
      } else {
        failed += 1
        const { head, rest } = firstLine(row.outcome.message)
        console.log(`FAIL ${planned.flow.name}: ${head}`)
        printDetail(rest)
      }
    }
    for (const planned of plan.negatives) {
      let outcome: FlowOutcome
      try {
        outcome = (await runOneFlow(browser, planned, vite.base)).outcome
      } catch (err) {
        outcome = { kind: 'crash', message: err instanceof Error ? err.message : String(err) }
      }
      const verdict = negativeVerdict(outcome)
      const label = `negative ${planned.flow.name} <- ${planned.fixtureLabel}`
      if (verdict.ok) {
        passed += 1
        console.log(`ok ${label} (red as expected)`)
      } else {
        failed += 1
        console.log(`FAIL ${label}: ${firstLine(verdict.message).head}`)
      }
    }
  }
  let teardownOk = true
  try {
    if (browser !== undefined) await browser.close()
  } catch (err) {
    teardownOk = false
    console.log(`[e2e-admin] teardown FAILED: browser close: ${err instanceof Error ? err.message : String(err)}`)
  }
  try {
    await stopVite(kit, vite)
  } catch (err) {
    teardownOk = false
    console.log(`[e2e-admin] teardown FAILED: ${err instanceof Error ? err.message : String(err)}`)
  }
  if (teardownOk) console.log('[e2e-admin] teardown verified: process tree dead, port released')
  console.log(`e2e-admin: ${passed} passed, ${failed} failed`)
  if (setupFailure !== undefined) return 2
  return failed > 0 || !teardownOk ? 1 : 0
}
