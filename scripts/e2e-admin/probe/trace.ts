// scripts/e2e-admin/probe/trace.ts: the chat probe's trace side (T-0174). Reads the dev proxy's trace log
// (`.agent-traces/*.jsonl`, T-0151) with stable ids, turns trace lines into a probe fixture, and replays a
// fixture keyless through the REAL `produce()` with the kit's scripted provider.
//
// A trace id is `<day file>:<1-based line>`. A fixture's wire lines are never hand-built: each turn's
// recorded rounds run through `produce()` (the testkit producer leg), so self-correct, halts and the
// surface it ships are today's code. The offline replay re-derives the lines the same way, so a producer
// fix turns a red generated regression green with no fixture edit.
//
// Node only: produce.ts reads prompt files from the repo-root cwd at module load.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AgentTraceLine } from '../../../packages/agent-ui/a2ui/tools/agent/trace-log.ts'
import type { TurnInput, Turn } from '../../../packages/agent-ui/a2ui/src/agent/agent-transport.ts'
import type { Catalog } from '../../../packages/agent-ui/a2ui/src/catalog/catalog.ts'
import { splitCatalogId } from '../../../packages/agent-ui/a2ui/src/catalog/catalog-id.ts'
import { conciergeSemanticChecks } from '../../../packages/agent-ui/a2ui/src/catalog/personas/concierge/checks.ts'
import { croupierSemanticChecks } from '../../../packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts'
import { HIDDEN_STATE_CHECKS } from '../../../packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts'
import { compositeMomentChecks } from '../../../packages/agent-ui/a2ui/src/catalog/composite-moments.ts'
import { framedChoiceCheck } from '../../../packages/agent-ui/a2ui/src/catalog/framed-choice-check.ts'
import { gateChecksOnCatalog, type SemanticCheck } from '../../../packages/agent-ui/a2ui/src/catalog/semantic-check.ts'
import { runProducerTurn } from '../../../packages/agent-ui/a2ui/tools/testkit/producer-leg.ts'
import { nodeCatalogResolver } from '../../../packages/agent-ui/a2ui/tools/testkit/load.node.ts'
import type { ScriptedToolRound } from '../../../packages/agent-ui/a2ui/tools/testkit/scenario.ts'
import { SetupError } from '../setup-error.ts'
import {
  metaOf,
  runChecks,
  shippedComponent,
  type CheckResult,
  type ProbeFixture,
  type ProbeRound,
  type ProbeStep,
  type ProbeTurn,
  type RoutingSeen,
  type TraceRef,
  type TurnRecord,
} from './model.ts'

export const TRACE_DIR = '.agent-traces'

export interface TraceEntry {
  id: string
  line: AgentTraceLine
}

/** Every parsed trace line in `dir` with its id, oldest first. A torn line is skipped, never fatal. */
export function readTraceEntries(dir: string): TraceEntry[] {
  if (!existsSync(dir)) return []
  const out: TraceEntry[] = []
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.jsonl')).sort()) {
    readFileSync(join(dir, name), 'utf8')
      .split('\n')
      .forEach((raw, i) => {
        if (raw.trim() === '') return
        try {
          out.push({ id: `${name}:${i + 1}`, line: JSON.parse(raw) as AgentTraceLine })
        } catch {
          // a torn last line (a crash mid-append) is skipped
        }
      })
  }
  return out
}

/** The produce entries a `--from-trace` spec names: `last`, `last:<k>` (the last k, oldest first), or a
 *  comma list of ids. Throws on an id the log does not hold or a non-produce line. */
export function resolveTraceSpec(entries: readonly TraceEntry[], spec: string): TraceEntry[] {
  const produce = entries.filter((e) => e.line.route === 'produce')
  const last = /^last(?::(\d+))?$/.exec(spec)
  if (last) {
    const k = last[1] === undefined ? 1 : Number(last[1])
    if (k < 1 || produce.length < k) throw new Error(`the trace log holds ${produce.length} produce turn(s), --from-trace ${spec} needs ${k}`)
    return produce.slice(-k)
  }
  return spec.split(',').map((id) => {
    const found = entries.find((e) => e.id === id.trim())
    if (found === undefined) throw new Error(`no trace line ${id.trim()} (ids look like 2026-10-14.jsonl:3)`)
    if (found.line.route !== 'produce') throw new Error(`trace line ${found.id} is a ${found.line.route} turn, not produce`)
    return found
  })
}

/** The trace reference a turn record carries. */
export function traceRef(entry: TraceEntry): TraceRef {
  return {
    id: entry.id,
    outcome: entry.line.outcome,
    retries: entry.line.retries.map((r) => ({ round: r.round, codes: r.failures.map((f) => f.code) })),
    thinkingChars: entry.line.rounds.map((r) => r.thinking?.chars ?? 0),
  }
}

/** T-0260: the routing a trace line recorded, flattened for `routing-expect`: the catalog persona and domains,
 *  the framed exemplar ids (T-0259 `events`, else the produce trace's retrieved ids), the composed section ids and
 *  the references. Undefined for a line with no `routing` block (before T-0239, or rejected before the model). */
export function routingSeen(line: AgentTraceLine): RoutingSeen | undefined {
  const r = line.routing
  if (r === undefined) return undefined
  return {
    domains: [...(r.catalog.persona !== undefined ? [r.catalog.persona] : []), ...r.catalog.domains],
    exemplars: [...(line.events?.framedExemplarIds ?? line.trace?.exemplarIds ?? [])],
    sections: (r.sections ?? []).map((s) => s.id),
    references: r.references.map((x) => ({ name: x.name, load: x.load })),
  }
}

export const toProbeRounds = (line: AgentTraceLine): ProbeRound[] => line.rounds.map((r) => ({ text: r.text, tools: r.tools }))

/** The text the user typed: the page prepends a "Referenced for this message" block to an intent that
 *  pulled library entries; the typed text is the last paragraph after it. */
export function typedText(user: string): string {
  if (!user.startsWith('## Referenced')) return user
  const parts = user.split('\n\n')
  return parts[parts.length - 1]!.trim()
}

/** One recorded round as the scripted provider plays it: the last `render_surface` call (the capture)
 *  then the round's text, or the text alone. */
function scriptedRound(round: ProbeRound): string | ScriptedToolRound {
  const capture = round.tools.filter((t) => t.name === 'render_surface').at(-1)
  if (capture === undefined) return round.text
  return { tool: 'render_surface', input: capture.input as Record<string, unknown>, then: round.text }
}

/** T-0222: the persona semantic checks the dev proxy passes `produce()` (`semanticChecksDeps`), by persona id.
 *  Plain Node cannot import the persona manifests (their catalog JSON imports), so this names each persona's
 *  checks module; `trace.test.mjs` pins it to `SHIPPED_PERSONA_CATALOG_MANIFESTS`. */
export const PERSONA_SEMANTIC_CHECKS: Readonly<Record<string, readonly SemanticCheck[]>> = { concierge: conciergeSemanticChecks, croupier: croupierSemanticChecks }

/** The semantic checks a live turn on this catalog ran: its persona's (`<base>--<persona>`), (T-0230) the
 *  hidden game state checks every catalog runs, then (T-0208) the composite-moment checks and (T-0258) the framed-choice check, gated on the types the catalog declares, as `semanticChecksDeps` does. */
export function replaySemanticChecks(catalog: Catalog): readonly SemanticCheck[] {
  const persona = splitCatalogId(catalog.catalogId).tail ?? ''
  return gateChecksOnCatalog([...(PERSONA_SEMANTIC_CHECKS[persona] ?? []), ...HIDDEN_STATE_CHECKS, ...compositeMomentChecks, framedChoiceCheck], catalog)
}

export interface ReplayContext {
  catalogId: string
  resolveCatalog: ReturnType<typeof nodeCatalogResolver>
}

/** Run each turn's rounds through the real `produce()` in order, threading a session the way the page
 *  does (the user turn, then the assistant's shipped lines), and return each turn's wire lines. T-0222: with
 *  the persona's semantic checks, as the dev proxy runs it, so a live retry (ACTION_NOT_APPLIED,
 *  BET_TABLE_MISSING) retries offline too. */
export async function deriveLines(
  turns: ReadonlyArray<{ rounds: ProbeRound[]; input: { kind: 'intent'; text: string } | { kind: 'client'; message: unknown } }>,
  ctx: ReplayContext,
): Promise<string[][]> {
  const catalog = ctx.resolveCatalog(ctx.catalogId)
  if (catalog === undefined) throw new Error(`no catalog ${ctx.catalogId} under the repo`)
  const semanticChecks = replaySemanticChecks(catalog)
  const session: Turn[] = []
  const out: string[][] = []
  for (const turn of turns) {
    const input = { ...turn.input, session: { turns: [...session] } } as TurnInput
    const rounds = turn.rounds.length > 0 ? turn.rounds.map(scriptedRound) : ['']
    const result = await runProducerTurn(input, rounds, catalog, semanticChecks.length > 0 ? { semanticChecks } : {})
    out.push(result.lines)
    session.push({ role: 'user', content: turn.input.kind === 'intent' ? turn.input.text : JSON.stringify(turn.input.message) })
    session.push({ role: 'assistant', content: result.lines.filter((l) => !l.includes('"a2uiMeta"')).join('\n') })
  }
  return out
}

/** The click label a client turn's action names: the source component's `label`, else its `text`, else
 *  the action name. */
function clickLabel(user: string, earlier: readonly string[]): string {
  let action: { name?: unknown; sourceComponentId?: unknown } = {}
  try {
    action = (JSON.parse(user) as { action?: typeof action }).action ?? {}
  } catch {
    // not an action envelope
  }
  const source = typeof action.sourceComponentId === 'string' ? shippedComponent(earlier, action.sourceComponentId) : undefined
  for (const key of ['label', 'text']) if (typeof source?.[key] === 'string') return source[key] as string
  return typeof action.name === 'string' ? action.name : 'unknown action'
}

/** Build a probe fixture from trace entries (oldest first). The first must be an intent turn. The preset is
 *  `opts.agent`, else the trace's `agent`; the dev proxy logs none for a preset on the base catalog, and then the
 *  conversion asks for `--agent` rather than guess one (T-0236). */
export async function fixtureFromTrace(entries: readonly TraceEntry[], name: string, cwd: string, opts: { agent?: string } = {}): Promise<ProbeFixture> {
  const first = entries[0]
  if (first === undefined) throw new Error('no trace entries to convert')
  if (first.line.user.startsWith('{')) throw new Error(`trace line ${first.id} is a client turn; start the conversion at the intent turn (try last:<k>)`)
  const catalogId = first.line.catalogId ?? 'agent-ui'
  const agent = opts.agent ?? first.line.agent
  if (agent === undefined) throw new SetupError(`trace line ${first.id} names no agent (catalog ${catalogId}); pass --agent <preset id>`)
  const plan = entries.map((e) => {
    const client = e.line.user.startsWith('{')
    let message: unknown
    if (client) {
      try {
        message = JSON.parse(e.line.user)
      } catch {
        message = {}
      }
    }
    return {
      rounds: toProbeRounds(e.line),
      input: client ? { kind: 'client' as const, message } : { kind: 'intent' as const, text: e.line.user },
    }
  })
  const lines = await deriveLines(plan, { catalogId, resolveCatalog: nodeCatalogResolver(cwd) })
  // T-0222: a client turn that carries an error, not an action, is page-fired (a renderer rejection's error turn).
  const steps: ProbeStep[] = entries.map((e, i) => {
    if (!e.line.user.startsWith('{')) return { say: typedText(e.line.user) }
    const error = (plan[i]!.input as { message?: { error?: { code?: unknown } } }).message?.error
    return error !== undefined ? { page: typeof error.code === 'string' ? error.code : 'error' } : { click: clickLabel(e.line.user, lines.slice(0, i).flat()) }
  })
  const turns: ProbeTurn[] = entries.map((entry, i) => {
    const routing = routingSeen(entry.line)
    return { lines: lines[i]!, rounds: plan[i]!.rounds, input: plan[i]!.input, ...(routing !== undefined ? { routing } : {}) }
  })
  return {
    kind: 'agent-ui-chat-probe',
    version: 1,
    name,
    agent,
    model: first.line.model,
    ...(first.line.effort !== undefined ? { effort: first.line.effort } : {}),
    source: `${entries.map((e) => e.id).join(',')} (catalog ${catalogId})`,
    steps,
    turns,
  }
}

/** The catalog id a fixture's turns ran against: the `createSurface.catalogId` the lines carry, else the
 *  `(catalog <id>)` its source names, else the agent's persona catalog. */
export function fixtureCatalogId(fixture: ProbeFixture): string {
  const named = /\(catalog ([^)]+)\)/.exec(fixture.source ?? '')
  if (named) return named[1]!
  for (const line of fixture.turns.flatMap((t) => t.lines)) {
    const m = /"createSurface"\s*:\s*\{[^}]*"catalogId"\s*:\s*"([^"]+)"/.exec(line)
    if (m) return m[1]!
  }
  return `agent-ui--${fixture.agent}`
}

export interface OfflineReport {
  name: string
  records: TurnRecord[]
  checks: CheckResult[]
  failed: CheckResult[]
}

/** Replay a fixture with no browser: re-derive each turn's lines from its rounds through `produce()`
 *  (a turn with no rounds keeps its recorded lines), then run every check that needs no DOM. */
export async function offlineReplay(fixture: ProbeFixture, cwd: string): Promise<OfflineReport> {
  const catalogId = fixtureCatalogId(fixture)
  const derivable = fixture.turns.every((t) => t.rounds !== undefined && t.rounds.length > 0)
  let lines = fixture.turns.map((t) => t.lines)
  if (derivable) {
    const plan = fixture.turns.map((t, i) => {
      const step = fixture.steps[i]
      const fallback =
        step !== undefined && 'say' in step
          ? { kind: 'intent' as const, text: step.say }
          : step !== undefined && 'page' in step
            ? { kind: 'client' as const, message: { version: 'v1.0', error: { code: step.page } } }
            : { kind: 'client' as const, message: { version: 'v1.0', action: { name: step !== undefined && 'click' in step ? step.click : 'click' } } }
      return { rounds: t.rounds!, input: t.input ?? fallback }
    })
    lines = await deriveLines(plan, { catalogId, resolveCatalog: nodeCatalogResolver(cwd) })
  }
  const actionSurfaceOf = (input: ProbeTurn['input']): string | undefined => {
    const sid = input?.kind === 'client' ? (input.message as { action?: { surfaceId?: unknown } } | null)?.action?.surfaceId : undefined
    return typeof sid === 'string' ? sid : undefined
  }
  const records: TurnRecord[] = fixture.turns.map((t, i) => ({
    index: i,
    step: fixture.steps[i] ?? { say: '' },
    ...(actionSurfaceOf(t.input) !== undefined ? { request: { inputKind: 'client', actionSurface: actionSurfaceOf(t.input)! } } : {}),
    lines: lines[i]!,
    ...(t.rounds !== undefined ? { rounds: t.rounds } : {}),
    roundsSource: t.rounds !== undefined ? 'fixture' : 'none',
    ...(t.routing !== undefined ? { routing: t.routing } : {}),
    proseText: metaOf(lines[i]!).prose.join('\n'),
  }))
  const checks = runChecks(records, { expectComponents: fixture.expect?.components ?? [] })
  return { name: fixture.name, records, checks, failed: checks.filter((c) => c.status === 'fail') }
}

/** The vitest file `--from-trace` writes beside its fixture: the offline replay, every check green. */
export function regressionTestText(name: string, source: string): string {
  return [
    `// Generated by \`npm run chat:probe -- --from-trace\` (T-0174) from ${source}.`,
    '// Keyless: the recorded model rounds replay through the real produce(), then the probe checks run with',
    `// no browser. The browser leg is \`npm run chat:probe -- --replay ${name}.json\` from this folder.`,
    "import { readFileSync } from 'node:fs'",
    "import { expect, it } from 'vitest'",
    "import { parseProbeFixture } from '../model.ts'",
    "import { offlineReplay } from '../trace.ts'",
    '',
    `it('${name}: the recorded turns replay with every probe check green', async () => {`,
    `  const fixture = parseProbeFixture(readFileSync(new URL('./${name}.json', import.meta.url), 'utf8'))`,
    '  const report = await offlineReplay(fixture, process.cwd())',
    '  expect(report.failed).toEqual([])',
    '})',
    '',
  ].join('\n')
}
