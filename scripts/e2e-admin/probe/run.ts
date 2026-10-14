// scripts/e2e-admin/probe/run.ts: the chat probe's browser leg (T-0174). Boots vite and Chromium through
// the e2e-admin runner, opens the real agent-admin app on a preset, picks the model and effort through the
// composer's own pickers, plays the steps, and records each turn: the request the page sent, the wire
// lines it got back, the trace line (live), the surfaces, the chat prose, the render lint and a screenshot.
//
// Live: model calls pass through to the dev proxy (`route.fetch`), which holds the key server-side and
// writes the trace; this process never reads a key. Replay: the e2e-admin intercept answers every model
// call from the fixture's lines, so nothing leaves the machine.

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Browser, BrowserContext, Page } from 'playwright'
import { CFG } from '../../../packages/agent-ui/shared/src/tokens/scale.mjs'
import RULES from '../../dogfood-rules.json' with { type: 'json' }
import { ADMIN_SELECTORS, openAdmin, pollUntil, setDefaultWaitMs, type AdminPage } from '../admin-page.ts'
import { classifyRequest, installIntercept, parseBody } from '../intercept.ts'
import type { RecordRouteLike } from '../record.ts'
import { bootVite, launchChromium, newFlowContext, stopVite, type DevServerKit, type ViteHandle } from '../runner.ts'
import { scrubJson, type AdminScenario } from '../scenario.ts'
import { formatTable, runChecks, type CheckResult, type ProbeFixture, type ProbeRound, type ProbeStep, type TurnRecord } from './model.ts'
import { readTraceEntries, toProbeRounds, traceRef, TRACE_DIR, type TraceEntry } from './trace.ts'

export interface ProbePlan {
  mode: 'live' | 'replay'
  name: string
  agent: string
  model?: string
  effort?: string
  steps: ProbeStep[]
  expectComponents: string[]
  out: string
  /** Replay only: the fixture whose turns answer the page. */
  fixture?: ProbeFixture
}

export interface ProbeReport {
  kind: 'agent-ui-chat-probe-report'
  version: 1
  name: string
  mode: 'live' | 'replay'
  agent: string
  model?: string
  effort?: string
  at: string
  turns: TurnRecord[]
  checks: CheckResult[]
  verdict: 'pass' | 'fail'
}

const LIVE_WAIT_MS = 150_000
const LIVE_FETCH_TIMEOUT_MS = 180_000
const TRACE_SETTLE_MS = 5000

/** One produce exchange at the network edge: the projected request and the answer. */
interface Exchange {
  request: NonNullable<TurnRecord['request']>
  status: number
  lines: string[]
}

function project(body: unknown): NonNullable<TurnRecord['request']> {
  const b = (body ?? {}) as Record<string, unknown> & { input?: { kind?: unknown; message?: { action?: { surfaceId?: unknown } } } }
  const pick = (k: string): string | undefined => (typeof b[k] === 'string' ? (b[k] as string) : undefined)
  const out: NonNullable<TurnRecord['request']> = {}
  for (const k of ['model', 'effort', 'agent', 'catalogId'] as const) {
    const v = pick(k)
    if (v !== undefined) out[k] = v
  }
  if (typeof b.input?.kind === 'string') out.inputKind = b.input.kind
  const actionSurface = b.input?.message?.action?.surfaceId
  if (typeof actionSurface === 'string') out.actionSurface = actionSurface
  return out
}

/** Live edge: model calls go out to the dev proxy and are teed; status and integrations pass through;
 *  any request off the vite origin is aborted. */
function installLiveEdge(context: BrowserContext, origin: string, exchanges: Exchange[]): Promise<unknown> {
  return context.route('**/*', async (raw) => {
    const route = raw as unknown as RecordRouteLike
    const request = route.request()
    const endpoint = classifyRequest(origin, request.method(), request.url())
    if (endpoint === undefined || endpoint === 'status' || endpoint === 'integrations' || endpoint === 'other-a2ui') return route.continue()
    if (endpoint === 'external') return route.abort()
    let response
    try {
      response = await route.fetch({ timeout: LIVE_FETCH_TIMEOUT_MS })
    } catch {
      return route.abort()
    }
    const text = await response.text()
    if (endpoint === 'produce') {
      exchanges.push({ request: project(parseBody(request)), status: response.status(), lines: text.split('\n').filter((l) => l.trim() !== '') })
    }
    return route.fulfill({ status: response.status(), contentType: response.headers()['content-type'] ?? 'application/octet-stream', body: text })
  })
}

/** The admin scenario a replay answers from: the fixture's turns in order, seeded on its preset. */
export function replayScenario(fixture: ProbeFixture): AdminScenario {
  return {
    kind: 'agent-ui-admin-scenario',
    version: 1,
    name: fixture.name,
    seed: { localStorage: { 'agent-admin-app.activePreset': JSON.stringify(fixture.agent) } },
    turns: fixture.turns.map((t) => ({ endpoint: 'produce' as const, respond: { lines: t.lines } })),
  }
}

/** Commit a model or effort pick through the composer's own picker (`ui-menu` `select`), the path a click
 *  on a menu item takes. */
async function pick(page: Page, menu: 'models' | 'effort', value: string): Promise<void> {
  const selector = `${ADMIN_SELECTORS.chatPane} ui-conversation-composer [data-part="${menu}-menu"]`
  await pollUntil(() => page.evaluate((s) => document.querySelector(s) !== null, selector), (found) => found, `the chat composer's ${menu} picker`)
  await page.evaluate(
    ({ s, v }) => document.querySelector(s)!.dispatchEvent(new CustomEvent('select', { detail: { value: v }, bubbles: true })),
    { s: selector, v: value },
  )
}

/** The chat log's visible prose: rendered text outside every surface host and outside the activity strip
 *  (whose collapsed "Raw output" detail shows the wire lines on purpose). */
function proseText(page: Page): Promise<string> {
  return page.evaluate((pane) => {
    const log = document.querySelector(`${pane} [data-part="log"]`)
    if (log === null) return ''
    const parts: string[] = []
    const walker = document.createTreeWalker(log, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const parent = node.parentElement
      if (parent === null || parent.closest('ui-surface-host, ui-sandbox-frame, [data-part="narration"]') !== null) continue
      if (parent.getClientRects().length === 0 || (node.textContent ?? '').trim() === '') continue
      parts.push(node.textContent!.trim())
    }
    return parts.join(' ')
  }, ADMIN_SELECTORS.chatPane)
}

const LINT_RUN = ['nested-card', 'type-floor', 'column'] as const

/** The cheap dogfood render rules (`scripts/dogfood-rules.json`) over the chat pane's surface hosts: a card
 *  directly inside a card, text below the type floor, and a box past its surface host's right edge (the
 *  column rule, unless an overflow-x frame holds it). The register and geometry rules need the full
 *  render-lint harness and are reported as not run. */
async function renderLint(page: Page): Promise<{ findings: Array<{ rule: string; detail: string }>; notRun: string[] }> {
  const findings = await page.evaluate(
    ({ pane, floor }) => {
      const out: Array<{ rule: string; detail: string }> = []
      const name = (el: Element): string => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.getAttribute('data-part') ? `[${el.getAttribute('data-part')}]` : ''}`
      for (const host of document.querySelectorAll(`${pane} ui-surface-host`)) {
        for (const card of host.querySelectorAll('ui-card')) {
          if (card.parentElement?.closest('ui-card') && host.contains(card.parentElement.closest('ui-card'))) out.push({ rule: 'nested-card', detail: `${name(card)} inside a ui-card` })
        }
        const edge = host.getBoundingClientRect().right
        for (const el of host.querySelectorAll('*')) {
          const own = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '')
          const glyph = el.closest('ui-glyph') !== null || (el.getAttribute('data-part') ?? '').includes('glyph')
          if (own && !glyph && (el as HTMLElement).getClientRects().length > 0) {
            const size = parseFloat(getComputedStyle(el).fontSize)
            if (size < floor) out.push({ rule: 'type-floor', detail: `${name(el)} at ${size}px` })
          }
          const box = el.getBoundingClientRect()
          if (box.width === 0 || box.right <= edge + 4) continue
          let framed = false
          for (let p = el.parentElement; p !== null && p !== host; p = p.parentElement) {
            const ox = getComputedStyle(p).overflowX
            if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') framed = true
          }
          if (!framed) out.push({ rule: 'column', detail: `${name(el)} right ${Math.round(box.right)} past the host edge ${Math.round(edge)}` })
        }
      }
      return out
    },
    { pane: ADMIN_SELECTORS.chatPane, floor: CFG.floor as number },
  )
  const notRun = (RULES.render as Array<{ id: string }>).map((r) => r.id).filter((id) => !(LINT_RUN as readonly string[]).includes(id))
  // One finding per rule and element is enough for a report.
  const seen = new Set<string>()
  return { findings: findings.filter((f) => !seen.has(`${f.rule}|${f.detail}`) && seen.add(`${f.rule}|${f.detail}`)), notRun }
}

/** Every trace line count, so the lines a turn appends can be told apart. */
const traceCount = (dir: string): number => readTraceEntries(dir).length

async function newTraceLines(dir: string, before: number): Promise<TraceEntry[]> {
  const deadline = Date.now() + TRACE_SETTLE_MS
  for (;;) {
    const entries = readTraceEntries(dir)
    const fresh = entries.slice(before).filter((e) => e.line.route === 'produce')
    if (fresh.length > 0 || Date.now() >= deadline) return fresh
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}

async function playStep(admin: AdminPage, step: ProbeStep): Promise<void> {
  const since = await admin.liveTurnCount()
  if ('say' in step) await admin.sendTestChat(step.say)
  else await admin.clickSurfaceButton(step.click)
  await admin.waitForTurn(since)
}

export interface SharedRun {
  browser: Browser
  vite: ViteHandle
}

/** Play one probe in its own browser context against an already booted vite. */
export async function probeOnce(shared: SharedRun, plan: ProbePlan, root: string): Promise<ProbeReport> {
  const origin = new URL(shared.vite.base).origin
  const context = await newFlowContext(shared.browser)
  const exchanges: Exchange[] = []
  const traceDir = path.join(root, TRACE_DIR)
  mkdirSync(plan.out, { recursive: true })
  const turns: TurnRecord[] = []
  try {
    let wire: ReturnType<typeof installIntercept> | undefined
    const seedScenario: AdminScenario =
      plan.fixture !== undefined
        ? replayScenario(plan.fixture)
        : { kind: 'agent-ui-admin-scenario', version: 1, name: plan.name, seed: { localStorage: { 'agent-admin-app.activePreset': JSON.stringify(plan.agent) } }, turns: [] }
    if (plan.mode === 'replay') {
      wire = installIntercept(context, seedScenario, origin)
      await wire.ready
    } else {
      await installLiveEdge(context, origin, exchanges)
    }
    const page = await context.newPage()
    const admin = await openAdmin(page, shared.vite.base, seedScenario, { timeoutMs: 120_000 })
    const active = await admin.activeAgentId()
    if (active !== plan.agent) throw new Error(`the page opened on agent "${active}", not "${plan.agent}" (is it a preset id?)`)
    if (plan.model !== undefined) await pick(page, 'models', plan.model)
    if (plan.effort !== undefined) await pick(page, 'effort', plan.effort)
    for (const [index, step] of plan.steps.entries()) {
      const traceBefore = plan.mode === 'live' ? traceCount(traceDir) : 0
      const exchangesBefore = plan.mode === 'live' ? exchanges.length : (wire?.entries.filter((e) => e.endpoint === 'produce').length ?? 0)
      await playStep(admin, step)
      await page.waitForTimeout(600) // the surface settles a frame after the turn count moves
      let exchange: Exchange | undefined
      if (plan.mode === 'live') exchange = exchanges.slice(exchangesBefore).at(-1)
      else {
        const entry = wire!.entries.filter((e) => e.endpoint === 'produce').slice(exchangesBefore).at(-1)
        if (entry !== undefined) {
          const respond = seedScenario.turns[entry.turnIndex ?? -1]?.respond
          exchange = { request: project(entry.request), status: 200, lines: respond !== undefined && 'lines' in respond ? respond.lines : [] }
        }
      }
      const traced = plan.mode === 'live' ? (await newTraceLines(traceDir, traceBefore)).at(-1) : undefined
      let rounds: ProbeRound[] | undefined
      let roundsSource: TurnRecord['roundsSource'] = 'none'
      if (traced !== undefined) {
        rounds = toProbeRounds(traced.line)
        roundsSource = 'trace'
      } else if (plan.fixture !== undefined && exchange !== undefined) {
        const turnIndex = wire!.entries.filter((e) => e.endpoint === 'produce').slice(exchangesBefore).at(-1)?.turnIndex
        rounds = turnIndex !== undefined ? plan.fixture.turns[turnIndex]?.rounds : undefined
        if (rounds !== undefined) roundsSource = 'fixture'
      }
      const lint = await renderLint(page)
      const shot = path.join(plan.out, `turn-${index + 1}.png`)
      await page.screenshot({ path: shot, fullPage: true })
      turns.push({
        index,
        step,
        ...(exchange !== undefined ? { request: exchange.request, httpStatus: exchange.status } : {}),
        lines: exchange?.lines ?? [],
        ...(rounds !== undefined ? { rounds } : {}),
        roundsSource,
        ...(traced !== undefined ? { trace: traceRef(traced) } : {}),
        domHosts: await admin.surfaceHostCount('chat'),
        proseText: await proseText(page),
        lint: lint.findings,
        lintNotRun: lint.notRun,
        screenshot: path.basename(shot),
      })
    }
  } finally {
    await context.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {})
    await context.close().catch(() => {})
  }
  const checks = runChecks(turns, { expectComponents: plan.expectComponents, ...(plan.model !== undefined ? { model: plan.model } : {}), ...(plan.effort !== undefined ? { effort: plan.effort } : {}) })
  return {
    kind: 'agent-ui-chat-probe-report',
    version: 1,
    name: plan.name,
    mode: plan.mode,
    agent: plan.agent,
    ...(plan.model !== undefined ? { model: plan.model } : {}),
    ...(plan.effort !== undefined ? { effort: plan.effort } : {}),
    at: new Date().toISOString(),
    turns,
    checks,
    verdict: checks.some((c) => c.status === 'fail') ? 'fail' : 'pass',
  }
}

/** Write `report.json` (scrubbed: a key-shaped string refuses the write) and print the table. */
export function writeReport(report: ProbeReport, out: string): void {
  const text = `${JSON.stringify(scrubJson(report, process.env), null, 2)}\n`
  writeFileSync(path.join(out, 'report.json'), text)
  console.log(formatTable(report.turns, report.checks))
  console.log(`[chat-probe] report: ${path.join(out, 'report.json')}`)
}

/** Boot, run the plans in order, tear down. Exit code: 0 every plan passed, 1 a check failed, 2 setup
 *  (vite, Chromium, the page, or no live model for a live plan), 3 teardown unverified (a red the entry
 *  maps to 1; kept apart so the browser selftest, where 1 is expected, still reds on it). */
export async function runProbes(
  plans: readonly ProbePlan[],
  kit: DevServerKit,
  root: string,
  onReport: (report: ProbeReport, plan: ProbePlan) => void = (r, p) => writeReport(r, p.out),
): Promise<number> {
  let vite: ViteHandle
  try {
    vite = await bootVite(kit, root)
  } catch (err) {
    console.log(`[chat-probe] setup failed: ${err instanceof Error ? err.message : String(err)}`)
    return 2
  }
  let code = 0
  let browser: Browser | undefined
  try {
    if (plans.some((p) => p.mode === 'live')) {
      const status = (await (await fetch(`${vite.base}/__a2ui/agent/status`)).json().catch(() => ({}))) as { available?: unknown }
      if (status.available !== true) throw new Error('a live probe needs a provider key in the repo-root .env (/__a2ui/agent/status is not available)')
      setDefaultWaitMs(LIVE_WAIT_MS)
    }
    browser = await launchChromium()
    for (const plan of plans) {
      const report = await probeOnce({ browser, vite }, plan, root)
      onReport(report, plan)
      if (report.verdict === 'fail') code = 1
    }
  } catch (err) {
    code = 2
    console.log(`[chat-probe] setup failed: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`)
  }
  try {
    if (browser !== undefined) await browser.close()
    await stopVite(kit, vite)
  } catch (err) {
    console.log(`[chat-probe] teardown FAILED: ${err instanceof Error ? err.message : String(err)}`)
    return code === 2 ? 2 : 3
  }
  return code
}

/** The fixture a live run leaves behind, so the run itself replays keyless with `--replay`. */
export function fixtureFromReport(report: ProbeReport): ProbeFixture {
  return {
    kind: 'agent-ui-chat-probe',
    version: 1,
    name: report.name,
    agent: report.agent,
    ...(report.model !== undefined ? { model: report.model } : {}),
    ...(report.effort !== undefined ? { effort: report.effort } : {}),
    source: `probe ${report.mode} run ${report.at}${report.turns.some((t) => t.trace) ? `, traces ${report.turns.map((t) => t.trace?.id ?? '-').join(',')}` : ''}`,
    steps: report.turns.map((t) => t.step),
    turns: report.turns.map((t) => ({ lines: t.lines, ...(t.rounds !== undefined ? { rounds: t.rounds } : {}) })),
  }
}

