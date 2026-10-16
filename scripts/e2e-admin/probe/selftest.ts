// scripts/e2e-admin/probe/selftest.ts: the chat probe's keyless selftests (T-0174).
//
// `selftest` (fast, no browser, rides `check:scripts`): argument parsing, the fixture parser, every named
// check over canned turn records, the trace-id resolver, and the offline replay of the eight fixtures
// through the real `produce()`: green-button and recorded-haiku-hello (the live smoke's trace, its Card-per-choice round
// repaired to a Row of Buttons by the framed-choice check, T-0258) are green, seeded-json-prose fails `no-json-as-prose` (and
// `no-surface-loss`, since the surface the model wrote as prose never ships; its JSON is pretty-printed, the
// shape the producer's prose routing leaves as text, T-0172), seeded-dropped-surface fails
// exactly `no-surface-loss`, seeded-click-no-update exactly `action-updates-surface`, and seeded-no-reply
// (a `render_surface` call with no text and no `reply`, T-0194) exactly `reply-text`, and seeded-wrong-routing (the
// green button turn with a booking exemplar framed against its `expectRouting`, T-0260) exactly `routing-expect`.
// recorded-haiku-hello-cards (the live smoke verbatim, T-0258) is green offline, where render-lint has no DOM, but its
// one round must trip the producer's FRAMED_CHOICE check.
//
// `selftest --browser` (slow, local): the same eight fixtures replayed in the real agent-admin page behind
// the e2e-admin intercept, with the same verdicts, except recorded-haiku-hello-cards fails exactly `render-lint`
// (its `lone-button-frame` rule).

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AgentTraceLine } from '../../../packages/agent-ui/a2ui/tools/agent/trace-log.ts'
import { SetupError, type DevServerKit } from '../runner.ts'
import { parseProbeCli } from './cli.ts'
import { CHECK_NAMES, clickMissingDetail, FixtureError, ownExchange, pageStep, parseProbeFixture, runChecks, type CheckResult, type ProbeFixture, type TurnRecord } from './model.ts'
import { fixtureFromTrace, offlineReplay, resolveTraceSpec, typedText, type TraceEntry } from './trace.ts'

export const PROBE_FIXTURES_DIR = fileURLToPath(new URL('./fixtures/', import.meta.url))

/** Each selftest fixture and the exact set of checks it must fail (none for the green one); `browserFails` overrides
 *  `fails` in the browser, for a render-lint finding the offline replay cannot see. */
export const SELFTEST_CASES: ReadonlyArray<{ fixture: string; fails: readonly string[]; browserFails?: readonly string[] }> = [
  { fixture: 'green-button.json', fails: [] },
  { fixture: 'recorded-haiku-hello.json', fails: [] },
  { fixture: 'recorded-haiku-hello-cards.json', fails: [], browserFails: ['render-lint'] },
  { fixture: 'seeded-json-prose.json', fails: ['no-json-as-prose', 'no-surface-loss'] },
  { fixture: 'seeded-dropped-surface.json', fails: ['no-surface-loss'] },
  { fixture: 'seeded-click-no-update.json', fails: ['action-updates-surface'] },
  { fixture: 'seeded-no-reply.json', fails: ['reply-text'] },
  { fixture: 'seeded-wrong-routing.json', fails: ['routing-expect'] },
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

const ROUTED = { domains: ['croupier'], exemplars: ['domain-croupier-card-table-round'], sections: ['grammar', 'persona'], references: [{ name: 'house-rules', load: 'full' }] }

function record(over: Partial<TurnRecord> = {}): TurnRecord {
  return {
    index: 0,
    step: { say: 'hi', expectRouting: { domains: ['croupier'], exemplars: { include: ['domain-croupier-card-table-round'], exclude: ['booking-reservation'] }, sections: ['persona'], references: [{ name: 'house-rules', load: 'full' }] } },
    routing: ROUTED,
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
  const traced = parseProbeCli(['--from-trace', 'last', '--agent', 'lexicographer'])
  expectThat(traced.mode === 'from-trace' && traced.agent === 'lexicographer', 'cli: --from-trace takes --agent')
  const turnExpect = parseProbeCli(['--agent', 'croupier', '--say', 'deal', '--expect-turn', 'CardTable', '--click', 'Stand'])
  expectThat(turnExpect.mode === 'probe' && JSON.stringify(turnExpect.steps) === '[{"say":"deal","expect":["CardTable"]},{"click":"Stand"}]', 'cli: --expect-turn attaches to the step before it')
  const routed = parseProbeCli(['--agent', 'croupier', '--say', 'deal', '--expect-routing', '{"domains":["croupier"],"exemplars":{"exclude":["booking-reservation"]}}', '--click', 'Stand'])
  expectThat(routed.mode === 'probe' && JSON.stringify(routed.steps) === '[{"say":"deal","expectRouting":{"domains":["croupier"],"exemplars":{"exclude":["booking-reservation"]}}},{"click":"Stand"}]', 'cli: --expect-routing attaches to the step before it')
  for (const bad of [['--agent', 'x', '--expect-routing', '{"domains":["a"]}', '--say', 'hi'], ['--agent', 'x', '--say', 'hi', '--expect-routing', '{domains'], ['--agent', 'x', '--say', 'hi', '--expect-routing', '{"domain":["a"]}'], ['--agent', 'x', '--say', 'hi', '--expect-routing', '{}'], ['--say', 'hi'], ['--agent', 'x'], ['--agent', 'x', '--click', 'y'], ['--bogus', '1'], ['--from-trace', 'last', '--say', 'x'], ['--agent', 'x', '--expect-turn', 'T', '--say', 'hi']]) {
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
  // T-0271: a listed button that was clicked and started no turn says so, never "no surface button".
  const dead = runChecks([record(), { ...click([]), lines: [], rounds: undefined, roundsSource: 'none', clickMissing: { label: 'Deal again', available: ['Deal again', 'Deal'], clicked: true, inNewestSurface: false } }], opts)
  const deadDetail = dead.find((c) => c.check === 'click-target' && c.status === 'fail')?.detail ?? ''
  expectThat(caseVerdict(dead, ['click-target']) === undefined && deadDetail === 'clicked "Deal again" on an older surface in the log, not the newest, but no produce request followed (buttons: Deal again, Deal)', `checks: a click that landed and started no turn fails click-target and says it landed (${deadDetail})`)
  const unsettled = clickMissingDetail({ label: 'Hit', available: ['Hit'], clicked: true, inNewestSurface: true, requested: true })
  expectThat(unsettled === 'clicked "Hit", its action request went out, but the turn never settled (buttons: Hit)', `checks: a click whose request went out and never settled says so (${unsettled})`)
  const prose = runChecks([record(), click([])], opts)
  expectThat(caseVerdict(prose, ['action-updates-surface']) === undefined, `checks: a click answered with prose alone fails action-updates-surface (${caseVerdict(prose, ['action-updates-surface'])})`)
  const NEXT_ROUND = ['{"version":"v1.0","createSurface":{"surfaceId":"table-2","catalogId":"agent-ui"}}', '{"version":"v1.0","updateComponents":{"surfaceId":"table-2","components":[{"id":"root","component":"Text","text":"Round 2"}]}}']
  expectThat(statusOf(runChecks([record(), click(NEXT_ROUND)], opts), 'action-updates-surface') === 'skip,pass', 'checks: a click that opens the next surface passes action-updates-surface')
  // T-0214: a say turn whose meta-line targets an open surface is judged like a click on it.
  const typed = (lines: string[]): TurnRecord =>
    record({ index: 1, step: { say: 'Bet 50.' }, lines: ['{"a2uiMeta":{"note":"You win.","target":{"surfaceId":"canvas"}}}', ...lines], rounds: [{ text: lines.join('\n'), tools: [] }] })
  expectThat(statusOf(runChecks([record(), typed([])], opts), 'action-updates-surface') === 'skip,fail', 'checks: a targeted say turn answered with prose alone fails action-updates-surface')
  expectThat(statusOf(runChecks([record(), typed([UPDATE_LINE])], opts), 'action-updates-surface') === 'skip,pass', 'checks: a targeted say turn that updates its surface passes action-updates-surface')
  const seeded: Array<[string, TurnRecord, string, typeof opts?]> = [
    ['halt', record({ lines: ['{"a2uiMeta":{"error":"produce: no valid surface"}}'], trace: { id: 'd:1', outcome: 'halt', retries: [], thinkingChars: [1] } }), 'no-halt', { ...opts, expectComponents: [] }],
    ['json prose', record({ proseText: 'Here: {"version":"v1.0","createSurface":{"surfaceId":"t"}}' }), 'no-json-as-prose'],
    ['meta-line prose', record({ proseText: '{"a2uiMeta":{"note":"Seven-card stud it is."}}' }), 'no-json-as-prose'],
    ['dropped', record({ rounds: [{ text: `${BUTTON_LINES.join('\n')}\n{"version":"v1.0","createSurface":{"surfaceId":"ask-1"`, tools: [] }] }), 'no-surface-loss'],
    ['unmounted', record({ domHosts: 0 }), 'no-surface-loss'],
    ['missing type', record(), 'expect-component', { ...opts, expectComponents: ['CardTable'] }],
    ['model not applied', record({ request: { model: 'other', effort: 'medium' } }), 'model-pick'],
    ['lint', record({ lint: [{ rule: 'nested-card', detail: 'ui-card inside a ui-card' }] }), 'render-lint'],
    ['no reply', record({ lines: BUTTON_LINES, proseText: '' }), 'reply-text'],
    ['tally shown', record({ proseText: 'Here. Emitted 2 A2UI message(s): createSurface, updateComponents.' }), 'reply-text'],
    ['correction note', record({ proseText: 'Corrected: the 250 bet is now taken out of your bankroll, which leaves 750.' }), 'no-internal-leak'],
    ['surface id', record({ proseText: 'Table-3 is open. Set your bet and deal.' }), 'no-internal-leak'],
    // T-0260: each part of an `expectRouting` oracle bites on its own.
    ['off-domain', record({ routing: { ...ROUTED, domains: ['concierge'] } }), 'routing-expect'],
    ['exemplar missing', record({ routing: { ...ROUTED, exemplars: [] } }), 'routing-expect'],
    ['exemplar excluded', record({ routing: { ...ROUTED, exemplars: [...ROUTED.exemplars, 'booking-reservation'] } }), 'routing-expect'],
    ['section missing', record({ routing: { ...ROUTED, sections: ['grammar'] } }), 'routing-expect'],
    ['reference index-only', record({ routing: { ...ROUTED, references: [{ name: 'house-rules', load: 'index-only' }] } }), 'routing-expect'],
  ]
  for (const [label, rec, check, o] of seeded) {
    const verdict = caseVerdict(runChecks([rec], o ?? opts), [check])
    expectThat(verdict === undefined, `checks: the ${label} record fails exactly ${check} (${verdict})`)
  }
  // T-0235: live prose is the whole chat log, so a leak in turn 1 is still there on turn 2 and 3. Each prose check
  // judges what the turn added: the old leak fails turn 1 only, and a new leak (or the same id again) fails its turn.
  const LEAK = 'Here: {"version":"v1.0","createSurface":{"surfaceId":"t"}} Table-3 is open.'
  const logTurn = (index: number, proseText: string): TurnRecord => record({ index, proseScope: 'log', proseText })
  const liveChecks = runChecks([logTurn(0, 'Hi.'), logTurn(1, `Hi. ${LEAK}`), logTurn(2, `Hi. ${LEAK} Dealt.`), logTurn(3, `Hi. ${LEAK} Dealt. ${LEAK}`)], opts)
  const failTurns = (name: string): string => liveChecks.filter((c) => c.check === name && c.status === 'fail').map((c) => c.turn).join(',')
  for (const name of ['no-json-as-prose', 'no-internal-leak'])
    expectThat(failTurns(name) === '1,3', `checks: a live leak fails ${name} on its own turn, a later new leak on its turn (failed turns ${failTurns(name)})`)
  // T-0222: a step that names its own expected component (`--expect-turn`) fails when its turn leaves no surface
  // holding it: hold'em Haiku dealt its opening hand in prose and passed, since a later turn shipped PlayingCard.
  // A step without one (a refused illegal move, answered in prose on purpose) is never judged per turn.
  const deal = (step: TurnRecord['step'], lines: string[]): TurnRecord => record({ index: 1, step, lines: ['{"a2uiMeta":{"note":"Dealt."}}', ...lines], rounds: [{ text: lines.join('\n') || 'Dealt.', tools: [] }], proseText: 'Dealt.' })
  const proseDeal = runChecks([record(), deal({ say: 'Deal.', expect: ['Button'] }, [])], { ...opts, expectComponents: [] })
  expectThat(caseVerdict(proseDeal, ['expect-component']) === undefined, `checks: a turn-expected component answered in prose fails exactly expect-component (${caseVerdict(proseDeal, ['expect-component'])})`)
  expectThat(proseDeal.some((c) => c.check === 'expect-component' && c.turn === 1 && c.status === 'fail'), 'checks: the expect-component fail names the turn')
  expectThat(caseVerdict(runChecks([record(), deal({ say: 'Deal.' }, [])], opts), []) === undefined, 'checks: a prose turn with no turn expectation passes expect-component')
  expectThat(statusOf(runChecks([record(), deal({ say: 'Deal.', expect: ['Button'] }, [UPDATE_LINE])], opts), 'expect-component') === 'skip,pass,pass', 'checks: a turn that updates a surface holding its expected component passes')
  // T-0222: a step's own exchange among the page's. Five-card draw on Sonnet: the Discard turn's renderer rejection
  // fired two error turns (:113, :114) before Bet 50's answer (:115), and the record took :114 as Bet 50's.
  const window = [{ inputKind: 'client', inputError: 'VALIDATION_FAILED' }, { inputKind: 'client', inputError: 'VALIDATION_FAILED' }, { inputKind: 'intent' }]
  expectThat(ownExchange({ say: 'Bet 50.' }, window) === 2, 'desync: a say step owns the intent, never a page-fired error turn')
  expectThat(ownExchange({ click: 'Deal again' }, [...window.slice(0, 2), { inputKind: 'client' }]) === 2, 'desync: a click step owns the action, never a page-fired error turn')
  expectThat(ownExchange({ click: 'Deal again' }, window) === -1, 'desync: a click with no action in the window owns nothing yet')
  expectThat(JSON.stringify(pageStep(window[0]!)) === '{"page":"VALIDATION_FAILED"}', 'desync: a page-fired turn is its own row, a page step')
  const pageRow = record({ index: 1, step: { page: 'VALIDATION_FAILED' }, request: { model: 'm', effort: 'medium', inputKind: 'client', inputError: 'VALIDATION_FAILED' }, lines: ['{"a2uiMeta":{"note":"Fixed."}}', UPDATE_LINE] })
  const pageChecks = runChecks([record(), pageRow], opts)
  expectThat(caseVerdict(pageChecks, []) === undefined && ['click-target', 'action-updates-surface'].every((n) => statusOf(pageChecks, n) === 'skip,skip'), `desync: a page row is judged like a turn, never as a click (${caseVerdict(pageChecks, [])})`)
  let pageParsed = false
  try {
    pageParsed = 'page' in parseProbeFixture('{"kind":"agent-ui-chat-probe","version":1,"name":"x","agent":"a","steps":[{"say":"hi"},{"page":"VALIDATION_FAILED"}],"turns":[]}').steps[1]!
  } catch {
    pageParsed = false
  }
  expectThat(pageParsed, 'desync: a fixture keeps its page steps')
  const quiet = runChecks([record({ trace: { id: 'd:1', outcome: 'ok', retries: [], thinkingChars: [0] } })], opts)
  expectThat(statusOf(quiet, 'reasoning') === 'warn' && caseVerdict(quiet, []) === undefined, 'checks: no thinking text is a warn, never a fail')
  expectThat(statusOf(runChecks([record({ routing: undefined })], opts), 'routing-expect') === 'skip', 'checks: a replayed turn with no saved routing skips routing-expect (never a vacuous pass)')
  // A live turn with an oracle and no trace line for its run fails: the routing is unknown, and a skip would hide the gap.
  const untraced = runChecks([record({ routing: undefined, trace: undefined })], { ...opts, runId: 'probe-x-1a2b' })
  const untracedRow = untraced.find((c) => c.check === 'routing-expect')
  expectThat(caseVerdict(untraced, ['routing-expect']) === undefined && untracedRow?.detail === 'no trace line for runId probe-x-1a2b', `checks: a live oracle with no trace line fails routing-expect, naming the run id (${untracedRow?.detail})`)
  const unrouted = runChecks([record({ routing: undefined })], { ...opts, runId: 'probe-x-1a2b' })
  expectThat(statusOf(unrouted, 'routing-expect') === 'fail', 'checks: a live oracle whose trace line has no routing block fails routing-expect')
  expectThat(statusOf(runChecks([record({ step: { say: 'hi' }, routing: undefined, trace: undefined })], { ...opts, runId: 'probe-x-1a2b' }), 'routing-expect') === 'skip', 'checks: a live step with no oracle still skips routing-expect')
  // T-0264: only the last round ships. A surface a rejected round created and the shipped round replaced (Haiku 5.5:
  // ask-1 rejected BET_TABLE_MISSING, table-1 shipped) is dropped by the repair, never lost; a turn that ships none fails.
  const renamed = record({ rounds: [{ text: '{"version":"v1.0","createSurface":{"surfaceId":"ask-1","catalogId":"agent-ui"}}', tools: [] }, { text: BUTTON_LINES.join('\n'), tools: [] }] })
  expectThat(statusOf(runChecks([renamed], opts), 'no-surface-loss') === 'pass', 'checks: a rejected round\'s surface the shipped round replaced passes no-surface-loss')
  const shippedNone = record({ lines: ['{"a2uiMeta":{"note":"Sorry."}}'], proseText: 'Sorry.', rounds: renamed.rounds })
  expectThat(statusOf(runChecks([shippedNone], { ...opts, expectComponents: [] }), 'no-surface-loss') === 'fail', 'checks: a turn that ships no surface after a round created one fails no-surface-loss')
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
  // T-0236: the dev proxy logs no agent for a preset on the base catalog (a Lexicographer turn); the conversion asks
  // for --agent and never guesses croupier.
  const baseTurn: TraceEntry[] = [{ id: 'c.jsonl:1', line: { ...line('produce', 'Define ephemeral.'), model: 'm', catalogId: 'agent-ui' } }]
  let unnamed: string
  try {
    unnamed = `agent ${(await fixtureFromTrace(baseTurn, 'x', process.cwd())).agent}`
  } catch (err) {
    unnamed = err instanceof SetupError && err.message.includes('--agent') ? 'refused' : `threw ${String(err)}`
  }
  expectThat(unnamed === 'refused', `trace: a line with no agent on the base catalog asks for --agent (${unnamed})`)
  expectThat((await fixtureFromTrace(baseTurn, 'x', process.cwd(), { agent: 'lexicographer' })).agent === 'lexicographer', 'trace: --agent names the preset of a line with no agent')

  // the offline replay of the fixtures through the real produce()
  for (const c of SELFTEST_CASES) {
    const report = await offlineReplay(loadProbeFixture(path.join(PROBE_FIXTURES_DIR, c.fixture)), process.cwd())
    const verdict = caseVerdict(report.checks, c.fails)
    expectThat(verdict === undefined, `offline ${c.fixture}: ${verdict}`)
  }
  // T-0258: the live Haiku hello framed each starter choice in its own Card. Its one round trips FRAMED_CHOICE (the
  // scripted model repeats it, so it ships tallied); the repaired fixture's second round ships the Row of Buttons.
  const helloTrace = async (fixture: string): Promise<{ rounds: unknown; codes: string; cards: number }> => {
    const report = await offlineReplay(loadProbeFixture(path.join(PROBE_FIXTURES_DIR, fixture)), process.cwd())
    const lines = report.records[0]!.lines
    const trace = lines.map((l) => (JSON.parse(l) as { a2uiMeta?: { trace?: { rounds?: unknown; failureCodes?: string[] } } }).a2uiMeta?.trace).find((t) => t !== undefined)
    return { rounds: trace?.rounds, codes: (trace?.failureCodes ?? []).join(), cards: lines.join('\n').split('"component":"Card"').length - 1 }
  }
  const framed = await helloTrace('recorded-haiku-hello-cards.json')
  expectThat(framed.codes.startsWith('FRAMED_CHOICE') && framed.cards === 3, `offline recorded-haiku-hello-cards: its Card per choice trips FRAMED_CHOICE (${JSON.stringify(framed)})`)
  const repaired = await helloTrace('recorded-haiku-hello.json')
  expectThat(repaired.rounds === 2 && repaired.codes === 'FRAMED_CHOICE' && repaired.cards === 0, `offline recorded-haiku-hello: the repair round ships a Row of Buttons, no Card (${JSON.stringify(repaired)})`)

  for (const f of failures) console.log(`FAIL ${f}`)
  console.log(`chat-probe selftest: ${failures.length === 0 ? 'ok' : `${failures.length} failed`}`)
  return failures.length === 0 ? 0 : 1
}

/** The browser leg: one vite, the eight fixtures replayed in the real page. */
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
    const own = SELFTEST_CASES.find((c) => c.fixture === `${plan.name}.json`)
    const want = own?.browserFails ?? own?.fails ?? []
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
