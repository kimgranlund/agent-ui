// scripts/e2e-admin/probe/scenarios/round10.ts: live round 10 (T-0341), a targeted round after the round 9 fixes
// (T-0328, T-0330 to T-0335). One `live-commands.sh` in `.sdlc/evals/rounds/2026-10-17-r10-targeted/` (Kim 2026-10-17:
// round 9 failures plus the runs each fix touches, 3 samples on unstable runs, about $10; the next round is the full
// matrix). Everything is derived from the round 8 and round 9 records, nothing is a hand table:
//
// - Failed: the round 9 ledger rows whose verdict is fail.
// - Touched: per fix, the round 9 runs with a trace line carrying the signal that fix changed (`FIX_SIGNALS`: a retry
//   code, the read-back shape or the retrieved records), so the fix's mechanism metric can be read from them.
// - Unstable: the Haiku runs where a blackjack opening failed BET_TABLE_MISSING on round 1 (a round 2 retry). They run
//   `R10_SAMPLES` samples, named `-1` to `-3`; every other run is sample 1 under its round 9 name.
// - Excluded: a failed run that carries no fix signal (no fix can move it), then, dearest first, a touched run whose
//   every fix keeps at least `MIN_PER_FIX` other selected runs, until the estimate is at most `R10_TARGET`.
//
// A run's cost is the larger of its round 8 and round 9 ledger `costUsd` (a round 9 run that halted on turn 0 cost
// less than its full script). Runs go cheapest first, each command preceded by `# est $<usd>`, which `../run-capped.ts`
// reads to skip a run that would take the spend past the $10 cap.
//
// Run `node --experimental-strip-types scripts/e2e-admin/probe/scenarios/round10.ts` to print the script;
// `round10.test.mjs` pins the file to this generator and the derived sets to their trace evidence.

import { readFileSync } from 'node:fs'
import { quote } from '../model.ts'
import type { RoundModel } from './round.ts'
import { ROUND8_DIR } from './round8.ts'
import { ROUND9_DIR, round9Runs } from './round9.ts'

export const ROUND10_DIR = '.sdlc/evals/rounds/2026-10-17-r10-targeted'
export const ROUND10_FILE = `${ROUND10_DIR}/live-commands.sh`
export const ROUND10_CAP = 10
/** The estimate the exclusions trim to, leaving headroom under the cap for estimate error. */
export const R10_TARGET = 8
export const R10_SAMPLES = 3
/** A touched run is dropped for cost only when each of its fixes keeps this many other selected runs. */
export const MIN_PER_FIX = 2

const ROOT = new URL('../../../../', import.meta.url)
const read = (rel: string): string => readFileSync(new URL(rel, ROOT), 'utf8')

interface LedgerRow {
  name: string
  verdict: 'pass' | 'fail' | null
  costUsd: number
  traces: Array<{ file: string; from: number; to: number }>
}

interface Component {
  component?: string
  action?: { action?: string; submit?: boolean }
}

/** The fields of a trace line the signals read. */
export interface TraceLine {
  model: string
  user?: string
  retries?: Array<{ round: number; failures?: Array<{ code: string }> }>
  /** `messages` is an array of envelopes, or a string when the model sent it as one (T-0320). */
  rounds?: Array<{ round: number; tools?: Array<{ input?: { messages?: unknown } }> }>
  trace?: { exemplarIds?: string[] }
}

const ledger = (dir: string): LedgerRow[] =>
  read(`${dir}/ledger.jsonl`)
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as LedgerRow)

/** Every round 9 trace line with its 1-based number in its day file and the run it belongs to. */
export function round9Lines(): Array<{ n: number; run: string; line: TraceLine }> {
  const files = new Map<string, string[]>()
  const out: Array<{ n: number; run: string; line: TraceLine }> = []
  for (const row of ledger(ROUND9_DIR)) {
    for (const t of row.traces) {
      if (!files.has(t.file)) files.set(t.file, read(`${ROUND9_DIR}/${t.file}`).split('\n'))
      const text = files.get(t.file) as string[]
      for (let n = t.from; n <= t.to; n++) out.push({ n, run: row.name, line: JSON.parse(text[n - 1]) as TraceLine })
    }
  }
  return out.sort((a, b) => a.n - b.n)
}

const codes = (l: TraceLine): Set<string> => new Set((l.retries ?? []).flatMap((r) => (r.failures ?? []).map((f) => f.code)))
const lastSay = (l: TraceLine): string => (l.user ?? '').split('\n').at(-1) ?? ''

/** A round that sends a DescriptionList read-back with a submit or confirm_booking button and no BookingForm. */
function readBack(l: TraceLine): boolean {
  return (l.rounds ?? []).some((r) =>
    (r.tools ?? []).some((t) => {
      const msgs = Array.isArray(t.input?.messages) ? (t.input.messages as Array<{ updateComponents?: { components?: Component[] } } | null>) : []
      const comps = msgs.flatMap((m) => m?.updateComponents?.components ?? [])
      const types = new Set(comps.map((c) => c.component))
      return types.has('DescriptionList') && !types.has('BookingForm') && comps.some((c) => c.component === 'Button' && (c.action?.submit === true || c.action?.action === 'confirm_booking'))
    }),
  )
}

/** Per round 9 fix, the trace signal of what it changed. */
export const FIX_SIGNALS: Readonly<Record<string, { says: string; test: (l: TraceLine) => boolean }>> = {
  'T-0328': { says: 'a SURFACE_DROPPED retry', test: (l) => codes(l).has('SURFACE_DROPPED') },
  'T-0330': { says: 'SURFACE_DROPPED and BOOKING_FORM_MISSING retries on one turn', test: (l) => codes(l).has('SURFACE_DROPPED') && codes(l).has('BOOKING_FORM_MISSING') },
  'T-0331': { says: 'a DescriptionList read-back with a submit or confirm_booking button', test: readBack },
  'T-0332': { says: 'a NARRATED_MECHANICS retry', test: (l) => codes(l).has('NARRATED_MECHANICS') },
  'T-0333': { says: 'a BOOKING_CONFIRMATION_MISSING retry', test: (l) => codes(l).has('BOOKING_CONFIRMATION_MISSING') },
  'T-0334': { says: 'a BANKROLL_MISMATCH or NATURAL_ACTIONS retry', test: (l) => codes(l).has('BANKROLL_MISMATCH') || codes(l).has('NATURAL_ACTIONS') },
  'T-0335': {
    says: 'a confirm turn that retrieved confirmation-view or backable-wizard',
    test: (l) => /\bconfirm/i.test(lastSay(l)) && (l.trace?.exemplarIds ?? []).some((e) => e === 'confirmation-view' || e === 'backable-wizard'),
  },
}

/** Per fix, each round 9 run carrying its signal, with the trace lines. */
export function fixEvidence(): Record<string, Record<string, number[]>> {
  const ev: Record<string, Record<string, number[]>> = {}
  for (const [fix, { test }] of Object.entries(FIX_SIGNALS)) {
    ev[fix] = {}
    for (const { n, run, line } of round9Lines()) if (test(line)) (ev[fix][run] ??= []).push(n)
  }
  return ev
}

/** The unstable runs: a Haiku blackjack opening that failed BET_TABLE_MISSING on round 1, with the trace lines. */
export function unstableEvidence(): Record<string, number[]> {
  const ev: Record<string, number[]> = {}
  for (const { n, run, line } of round9Lines()) {
    const bet = (line.retries ?? []).some((r) => r.round === 2 && (r.failures ?? []).some((f) => f.code === 'BET_TABLE_MISSING'))
    if (line.model.includes('haiku') && bet) (ev[run] ??= []).push(n)
  }
  return ev
}

/** The round 9 failed runs, in ledger order. */
export function r9Failed(): string[] {
  return ledger(ROUND9_DIR)
    .filter((r) => r.verdict === 'fail')
    .map((r) => r.name)
}

/** Per round 9 run, the larger of its round 8 and round 9 ledger `costUsd`. */
export function r10Costs(): Record<string, number> {
  const r8 = new Map(ledger(ROUND8_DIR).map((r) => [r.name, r.costUsd]))
  return Object.fromEntries(ledger(ROUND9_DIR).map((r) => [r.name, Math.max(r8.get(r.name) ?? 0, r.costUsd)]))
}

export interface Round10Plan {
  failed: string[]
  evidence: Record<string, Record<string, number[]>>
  unstable: string[]
  cost: Record<string, number>
  /** The selected round 9 runs. */
  selected: string[]
  /** Left out, and why. */
  excluded: Record<string, string>
  expectedUsd: number
}

const usd = (n: number): string => `$${n.toFixed(2)}`

/** The whole selection, derived. */
export function round10Plan(): Round10Plan {
  const failed = r9Failed()
  const evidence = fixEvidence()
  const unstable = Object.keys(unstableEvidence())
  const cost = r10Costs()
  const fixesOf = (run: string): string[] => Object.keys(evidence).filter((f) => run in evidence[f])
  const samples = (run: string): number => (unstable.includes(run) ? R10_SAMPLES : 1)
  const candidates = [...new Set([...failed, ...Object.values(evidence).flatMap((e) => Object.keys(e)), ...unstable])]
  const excluded: Record<string, string> = {}
  for (const run of candidates) {
    if (fixesOf(run).length === 0 && !unstable.includes(run)) excluded[run] = `failed in round 9 with no fix signal on its trace lines, so no round 9 fix can move it (${usd(cost[run])})`
  }
  const selected = (): string[] => candidates.filter((r) => !(r in excluded))
  const estimate = (): number => selected().reduce((sum, r) => sum + cost[r] * samples(r), 0)
  const trimmable = selected()
    .filter((r) => !failed.includes(r) && !unstable.includes(r))
    .sort((a, b) => cost[b] - cost[a])
  for (const run of trimmable) {
    const before = estimate()
    if (before <= R10_TARGET) break
    const left = (f: string): number => selected().filter((r) => r !== run && r in evidence[f]).length
    if (!fixesOf(run).every((f) => left(f) >= MIN_PER_FIX)) continue
    excluded[run] = `estimate ${usd(before)} over the ${usd(R10_TARGET)} target; ${fixesOf(run)
      .map((f) => `${f} keeps ${left(f)} selected runs`)
      .join(', ')} (${usd(cost[run])})`
  }
  return { failed, evidence, unstable, cost, selected: selected(), excluded, expectedUsd: estimate() }
}

export interface Round10Run {
  /** The round 9 run it repeats. */
  of: string
  sample: number
  name: string
  agent: string
  model: RoundModel
  argv: string[]
  est: number
}

const rename = (argv: string[], name: string): string[] =>
  argv.map((a, i) => (argv[i - 1] === '--out' ? `${ROUND10_DIR}/runs/${name}` : argv[i - 1] === '--name' ? name : a))

/** Every run in script order: cheapest first, a run's samples together. */
export function round10Runs(plan: Round10Plan = round10Plan()): Round10Run[] {
  const byName = new Map(round9Runs().map((r) => [r.name, r]))
  return [...plan.selected]
    .sort((a, b) => plan.cost[a] - plan.cost[b] || a.localeCompare(b))
    .flatMap((of) => {
      const r = byName.get(of)
      if (r === undefined) throw new Error(`no round 9 run ${of}`)
      const samples = plan.unstable.includes(of) ? R10_SAMPLES : 1
      return Array.from({ length: samples }, (_, i) => {
        const name = `${of.replace(/-1$/, '')}-${i + 1}`
        return { of, sample: i + 1, name, agent: r.agent, model: r.model, argv: rename(r.argv, name), est: plan.cost[of] }
      })
    })
}

/** `.sdlc/evals/rounds/2026-10-17-r10-targeted/live-commands.sh`. */
export function round10CommandsScript(): string {
  const plan = round10Plan()
  const runs = round10Runs(plan)
  const per = (short: string): number => runs.filter((r) => r.model.short === short).length
  const lines = [
    '#!/usr/bin/env bash',
    "# T-0341 live round 10: round 9's failed runs plus the runs each round 9 fix touches (T-0328, T-0330 to T-0335),",
    `# ${R10_SAMPLES} samples on the unstable Haiku blackjack openings. Generated by`,
    '# `node --experimental-strip-types scripts/e2e-admin/probe/scenarios/round10.ts`; do not hand-edit.',
    `# Spends API credit through the dev proxy (key in .env, never printed). Cap: $${ROUND10_CAP} in total (Kim 2026-10-17).`,
    `#   node --experimental-strip-types scripts/e2e-admin/probe/run-capped.ts --describe ${ROUND10_FILE}`,
    `#   node --experimental-strip-types scripts/e2e-admin/probe/run-capped.ts ${ROUND10_FILE} --cap ${ROUND10_CAP} --round r10-targeted`,
    `# ${runs.length} runs (Haiku ${per('haiku')}, Sonnet ${per('sonnet')}, Opus ${per('opus')}), cheapest first by the larger of the round 8`,
    `# and 9 costs (expected about ${usd(plan.expectedUsd)}). Each \`# est\` line is that run's estimate: the runner skips a run`,
    '# whose estimate would take the spend past the cap. A probe exits 1 when a check fails.',
    '# Left out:',
    ...Object.entries(plan.excluded).map(([n, why]) => `#   ${n}: ${why}.`),
    '',
  ]
  for (const run of runs) lines.push(`# est $${run.est}`, ['npm', 'run', 'chat:probe', '--', ...run.argv].map(quote).join(' '))
  return `${lines.join('\n')}\n`
}

if (import.meta.url === `file://${process.argv[1]}`) process.stdout.write(round10CommandsScript())
