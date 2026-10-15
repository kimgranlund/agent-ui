// scripts/e2e-admin/probe/selftest.ts: the chat probe's keyless selftests (T-0174).
//
// `selftest` (fast, no browser, rides `check:scripts`): argument parsing, the fixture parser, every named
// check over canned turn records, the trace-id resolver, and the offline replay of the six fixtures
// through the real `produce()`: green-button and recorded-haiku-hello (the live smoke's trace) are green, seeded-json-prose fails `no-json-as-prose` (and
// `no-surface-loss`, since the surface the model wrote as prose never ships; its JSON is pretty-printed, the
// shape the producer's prose routing leaves as text, T-0172), seeded-dropped-surface fails
// exactly `no-surface-loss`, seeded-click-no-update exactly `action-updates-surface`, and seeded-no-reply
// (a `render_surface` call with no text and no `reply`, T-0194) exactly `reply-text`.
//
// `selftest --browser` (slow, local): the same six fixtures replayed in the real agent-admin page behind
// the e2e-admin intercept, with the same verdicts.

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AgentTraceLine } from '../../../packages/agent-ui/a2ui/tools/agent/trace-log.ts'
import { SetupError, type DevServerKit } from '../runner.ts'
import { parseProbeCli } from './cli.ts'
import { CHECK_NAMES, FixtureError, parseProbeFixture, runChecks, type CheckResult, type ProbeFixture, type TurnRecord } from './model.ts'
import { offlineReplay, resolveTraceSpec, typedText, type TraceEntry } from './trace.ts'

export const PROBE_FIXTURES_DIR = fileURLToPath(new URL('./fixtures/', import.meta.url))

/** Each selftest fixture and the exact set of checks it must fail (none for the green one). */
export const SELFTEST_CASES: ReadonlyArray<{ fixture: string; fails: readonly string[] }> = [
  { fixture: 'green-button.json', fails: [] },
  { fixture: 'recorded-haiku-hello.json', fails: [] },
  { fixture: 'seeded-json-prose.json', fails: ['no-json-as-prose', 'no-surface-loss'] },
  { fixture: 'seeded-dropped-surface.json', fails: ['no-surface-loss'] },
  { fixture: 'seeded-click-no-update.json', fails: ['action-updates-surface'] },
  { fixture: 'seeded-no-reply.json', fails: ['reply-text'] },
]

export function loadProbeFixture(file: string): ProbeFixture {
  return parseProbeFixture(readFileSync(file, 'utf8'))
}

/** The verdict for one case: the failing checks must be exactly `fails` (empty: all green). */
export function caseVerdict(checks: readonly CheckResult[], fails: readonly string[]): string | undefined {
  const red = [...new Set(checks.filter((c) => c.status === 'fail').map((c) => c.check))].sort()
  const want = [...fails].sort()
  return red.join() === want.join() ? undefined : `expected red [${want.join(', ')}], failed [${red.join(', ')}]`
}

const BUTTON_LINES = [
  '{"version":"v1.0","createSurface":{"surfaceId":"canvas","catalogId":"agent-ui"}}',
  '{"version":"v1.0","updateComponents":{"surfaceId":"canvas","components":[{"id":"root","component":"Column","children":["b"]},{"id":"b","component":"Button","label":"Go"}]}}',
]

function record(over: Partial<TurnRecord> = {}): TurnRecord {
  return {
    index: 0,
    step: { say: 'hi' },
    request: { model: 'm', effort: 'medium' },
    lines: ['{"a2uiMeta":{"note":"Here."}}', ...BUTTON_LINES],
    rounds: [{ text: BUTTON_LINES.join('\n'), tools: [] }],
    roundsSource: 'fixture',
    domHosts: 1,
    proseText: 'Here.',
    lint: [],
    trace: { id: 'd.jsonl:1', outcome: 'ok', retries: [], thinkingChars: [12] },
    ...over,
  }
}

function statusOf(checks: readonly CheckResult[], name: string): string {
  return checks.filter((c) => c.check === name).map((c) => c.status).join(',')
}

export async function runProbeSelftest(): Promise<number> {
  const failures: string[] = []
  const expectThat = (ok: boolean, what: string): void => {
    if (!ok) failures.push(what)
  }

  // cli
  const live = parseProbeCli(['--agent', 'croupier', '--model', 'claude-haiku-5-5', '--say', 'hi', '--click', 'Deal', '--say', 'again'])
  expectThat(live.mode === 'probe' && live.steps.length === 3 && 'click' in live.steps[1]!, 'cli: steps keep their order')
  expectThat(parseProbeCli(['--from-trace', 'last:2']).mode === 'from-trace', 'cli: --from-trace')
  const turnExpect = parseProbeCli(['--agent', 'croupier', '--say', 'deal', '--expect-turn', 'CardTable', '--click', 'Stand'])
  expectThat(turnExpect.mode === 'probe' && JSON.stringify(turnExpect.steps) === '[{"say":"deal","expect":["CardTable"]},{"click":"Stand"}]', 'cli: --expect-turn attaches to the step before it')
  for (const bad of [['--say', 'hi'], ['--agent', 'x'], ['--agent', 'x', '--click', 'y'], ['--bogus', '1'], ['--from-trace', 'last', '--say', 'x'], ['--agent', 'x', '--expect-turn', 'T', '--say', 'hi']]) {
    let threw = false
    try {
      parseProbeCli(bad)
    } catch (err) {
      threw = err instanceof SetupError
    }
    expectThat(threw, `cli: ${bad.join(' ')} is a usage error`)
  }

  // the fixture parser
  let parserBites = false
  try {
    parseProbeFixture('{"kind":"agent-ui-chat-probe","version":1,"name":"x","agent":"a","steps":[],"turns":[]}')
  } catch (err) {
    parserBites = err instanceof FixtureError
  }
  expectThat(parserBites, 'fixture: an empty steps array is refused')

  // the checks over canned records
  const opts = { expectComponents: ['Button'], model: 'm', effort: 'medium' }
  // A click turn that updates the surface it came from (T-0172 action-updates-surface).
  const UPDATE_LINE = '{"version":"v1.0","updateDataModel":{"surfaceId":"canvas","path":"/n","value":1}}'
  const click = (lines: string[]): TurnRecord =>
    record({ index: 1, step: { click: 'Go' }, request: { model: 'm', effort: 'medium', inputKind: 'client', actionSurface: 'canvas' }, lines: ['{"a2uiMeta":{"note":"Done."}}', ...lines], rounds: [{ text: lines.join('\n'), tools: [] }] })
  const green = runChecks([record(), click([UPDATE_LINE])], opts)
  expectThat(caseVerdict(green, []) === undefined, `checks: the canned green record is green (${caseVerdict(green, [])})`)
  expectThat(CHECK_NAMES.every((n) => green.some((c) => c.check === n && c.status !== 'skip')), 'checks: the canned green records exercise every check (each runs at least once)')
  const missing = runChecks([record(), { ...click([]), lines: [], rounds: undefined, roundsSource: 'none', clickMissing: { label: 'Stand', available: ['Deal again'] } }], opts)
  expectThat(caseVerdict(missing, ['click-target']) === undefined, `checks: a click whose button never appeared fails exactly click-target (${caseVerdict(missing, ['click-target'])})`)
  const prose = runChecks([record(), click([])], opts)
  expectThat(caseVerdict(prose, ['action-updates-surface']) === undefined, `checks: a click answered with prose alone fails action-updates-surface (${caseVerdict(prose, ['action-updates-surface'])})`)
  const NEXT_ROUND = ['{"version":"v1.0","createSurface":{"surfaceId":"table-2","catalogId":"agent-ui"}}', '{"version":"v1.0","updateComponents":{"surfaceId":"table-2","components":[{"id":"root","component":"Text","text":"Round 2"}]}}']
  expectThat(statusOf(runChecks([record(), click(NEXT_ROUND)], opts), 'action-updates-surface') === 'skip,pass', 'checks: a click that opens the next surface passes action-updates-surface')
  const seeded: Array<[string, TurnRecord, string, typeof opts?]> = [
    ['halt', record({ lines: ['{"a2uiMeta":{"error":"produce: no valid surface"}}'], trace: { id: 'd:1', outcome: 'halt', retries: [], thinkingChars: [1] } }), 'no-halt', { ...opts, expectComponents: [] }],
    ['json prose', record({ proseText: 'Here: {"version":"v1.0","createSurface":{"surfaceId":"t"}}' }), 'no-json-as-prose'],
    ['dropped', record({ rounds: [{ text: `${BUTTON_LINES.join('\n')}\n{"version":"v1.0","createSurface":{"surfaceId":"ask-1"`, tools: [] }] }), 'no-surface-loss'],
    ['unmounted', record({ domHosts: 0 }), 'no-surface-loss'],
    ['missing type', record(), 'expect-component', { ...opts, expectComponents: ['CardTable'] }],
    ['model not applied', record({ request: { model: 'other', effort: 'medium' } }), 'model-pick'],
    ['lint', record({ lint: [{ rule: 'nested-card', detail: 'ui-card inside a ui-card' }] }), 'render-lint'],
    ['no reply', record({ lines: BUTTON_LINES, proseText: '' }), 'reply-text'],
    ['tally shown', record({ proseText: 'Here. Emitted 2 A2UI message(s): createSurface, updateComponents.' }), 'reply-text'],
  ]
  for (const [label, rec, check, o] of seeded) {
    const verdict = caseVerdict(runChecks([rec], o ?? opts), [check])
    expectThat(verdict === undefined, `checks: the ${label} record fails exactly ${check} (${verdict})`)
  }
  // T-0222: a step that names its own expected component (`--expect-turn`) fails when its turn leaves no surface
  // holding it: hold'em Haiku dealt its opening hand in prose and passed, since a later turn shipped PlayingCard.
  // A step without one (a refused illegal move, answered in prose on purpose) is never judged per turn.
  const deal = (step: TurnRecord['step'], lines: string[]): TurnRecord => record({ index: 1, step, lines: ['{"a2uiMeta":{"note":"Dealt."}}', ...lines], rounds: [{ text: lines.join('\n') || 'Dealt.', tools: [] }], proseText: 'Dealt.' })
  const proseDeal = runChecks([record(), deal({ say: 'Deal.', expect: ['Button'] }, [])], { ...opts, expectComponents: [] })
  expectThat(caseVerdict(proseDeal, ['expect-component']) === undefined, `checks: a turn-expected component answered in prose fails exactly expect-component (${caseVerdict(proseDeal, ['expect-component'])})`)
  expectThat(proseDeal.some((c) => c.check === 'expect-component' && c.turn === 1 && c.status === 'fail'), 'checks: the expect-component fail names the turn')
  expectThat(caseVerdict(runChecks([record(), deal({ say: 'Deal.' }, [])], opts), []) === undefined, 'checks: a prose turn with no turn expectation passes expect-component')
  expectThat(statusOf(runChecks([record(), deal({ say: 'Deal.', expect: ['Button'] }, [UPDATE_LINE])], opts), 'expect-component') === 'skip,pass,pass', 'checks: a turn that updates a surface holding its expected component passes')
  const quiet = runChecks([record({ trace: { id: 'd:1', outcome: 'ok', retries: [], thinkingChars: [0] } })], opts)
  expectThat(statusOf(quiet, 'reasoning') === 'warn' && caseVerdict(quiet, []) === undefined, 'checks: no thinking text is a warn, never a fail')
  const roundless = runChecks([record({ rounds: undefined, roundsSource: 'none' })], opts)
  expectThat(statusOf(roundless, 'no-surface-loss') === 'skip', 'checks: no round data skips the loss check (never a vacuous pass)')

  // trace ids
  const line = (route: 'produce' | 'chat', user: string): AgentTraceLine => ({ route, user, rounds: [], retries: [] }) as unknown as AgentTraceLine
  const entries: TraceEntry[] = [
    { id: 'a.jsonl:1', line: line('produce', 'one') },
    { id: 'a.jsonl:2', line: line('chat', 'two') },
    { id: 'b.jsonl:1', line: line('produce', 'three') },
  ]
  expectThat(resolveTraceSpec(entries, 'last')[0]?.id === 'b.jsonl:1', 'trace: last is the newest produce line')
  expectThat(resolveTraceSpec(entries, 'last:2').map((e) => e.id).join() === 'a.jsonl:1,b.jsonl:1', 'trace: last:2 skips chat lines, oldest first')
  let chatRefused = false
  try {
    resolveTraceSpec(entries, 'a.jsonl:2')
  } catch {
    chatRefused = true
  }
  expectThat(chatRefused, 'trace: a chat line is refused')
  expectThat(typedText('## Referenced for this message\n### x\nbody\n\nBlack jack') === 'Black jack', 'trace: the typed text drops the referenced block')

  // the offline replay of the fixtures through the real produce()
  for (const c of SELFTEST_CASES) {
    const report = await offlineReplay(loadProbeFixture(path.join(PROBE_FIXTURES_DIR, c.fixture)), process.cwd())
    const verdict = caseVerdict(report.checks, c.fails)
    expectThat(verdict === undefined, `offline ${c.fixture}: ${verdict}`)
  }

  for (const f of failures) console.log(`FAIL ${f}`)
  console.log(`chat-probe selftest: ${failures.length === 0 ? 'ok' : `${failures.length} failed`}`)
  return failures.length === 0 ? 0 : 1
}

/** The browser leg: one vite, the six fixtures replayed in the real page. */
export async function runBrowserSelftest(kit: DevServerKit, root: string, out: string): Promise<number> {
  const { runProbes, writeReport } = await import('./run.ts')
  const plans = SELFTEST_CASES.map((c) => {
    const fixture = loadProbeFixture(path.join(PROBE_FIXTURES_DIR, c.fixture))
    return {
      mode: 'replay' as const,
      name: fixture.name,
      agent: fixture.agent,
      steps: fixture.steps,
      expectComponents: fixture.expect?.components ?? [],
      out: path.join(out, fixture.name),
      fixture,
    }
  })
  const misses: string[] = []
  const code = await runProbes(plans, kit, root, (report, plan) => {
    writeReport(report, plan.out)
    const want = SELFTEST_CASES.find((c) => c.fixture === `${plan.name}.json`)?.fails ?? []
    const verdict = caseVerdict(report.checks, want)
    const skipped = report.checks.filter((c) => c.status === 'skip' && ['no-surface-loss', 'render-lint', 'no-json-as-prose'].includes(c.check))
    if (verdict !== undefined) misses.push(`${plan.name}: ${verdict}`)
    else if (skipped.length > 0) misses.push(`${plan.name}: ${skipped.map((c) => c.check).join(', ')} skipped in the browser`)
    console.log(`${verdict === undefined && skipped.length === 0 ? 'ok' : 'FAIL'} browser ${plan.name}${want.length ? ` (red on ${want.join(', ')} as expected)` : ''}`)
  })
  if (code === 2) return 2
  if (code === 3) misses.push('teardown unverified (vite tree or port survived)')
  for (const m of misses) console.log(`FAIL ${m}`)
  console.log(`chat-probe selftest --browser: ${misses.length === 0 ? 'ok' : `${misses.length} failed`}`)
  return misses.length === 0 ? 0 : 1
}
