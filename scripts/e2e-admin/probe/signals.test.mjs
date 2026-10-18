// T-0342: eval signals over the round archive, keyless. Two fixture round folders stand in for the archive: `base`
// has no ledger (an r1-style round, read from report.json alone, cost unknown) and `next` has a ledger, trace lines
// and a run that wrote no report. The committed r8 and r9 rounds pin the numbers r9's hand-written report.md gives.
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runNameParts } from './ledger.ts'
import { against, aggregate, churn, gate, main, readRound, readRounds, renderSignals, sameCells, tally } from './signals.ts'

const here = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(here, 'fixtures', 'signals', 'rounds')
const BASE = join(FIXTURES, '2026-01-01-base')
const NEXT = join(FIXTURES, '2026-01-02-next')
const ROUNDS = join(here, '..', '..', '..', '.sdlc', 'evals', 'rounds')

/** Run the CLI in-process; returns its exit code and what it printed. */
function cli(...argv) {
  let out = ''
  const code = main(['--rounds-dir', FIXTURES, ...argv], (s) => (out += s))
  return { code, out }
}

describe('signals', () => {
  it('derives the scenario and sample from a run name, keeping a number that is part of the scenario', () => {
    expect(runNameParts('regress-croupier-spanish-21-haiku-1')).toEqual({ scenario: 'regress-croupier-spanish-21', sample: 1 })
    expect(runNameParts('routing-long-session-opus-3')).toEqual({ scenario: 'routing-long-session', sample: 3 })
    // No model family before the number: it is the scenario's own, unless a sibling shares the stem.
    expect(runNameParts('regress-croupier-spanish-21')).toEqual({ scenario: 'regress-croupier-spanish-21', sample: 1 })
    expect(runNameParts('regress-croupier-spanish-21', ['regress-croupier-spanish-21', 'regress-croupier-omaha-haiku-1'])).toEqual({ scenario: 'regress-croupier-spanish-21', sample: 1 })
    expect(runNameParts('t0329-mix-17')).toEqual({ scenario: 't0329-mix-17', sample: 1 })
    expect(runNameParts('t0329-mix-17', ['t0329-mix-1', 't0329-mix-17', 't0329-mix-pontoon'])).toEqual({ scenario: 't0329-mix', sample: 17 })
    expect(runNameParts('t0329-mix-pontoon', ['t0329-mix-1', 't0329-mix-pontoon'])).toEqual({ scenario: 't0329-mix-pontoon', sample: 1 })
  })

  it('reads a ledger round with its reports and trace lines, and a round with no ledger from its reports alone', () => {
    const next = readRound(NEXT)
    expect(next.map((r) => r.name)).toEqual(['regress-a-haiku-1', 'regress-a-haiku-2', 'regress-a-haiku-3', 'regress-b-sonnet-1', 'routing-c-haiku-1', 'routing-c-sonnet-1', 'long-d-opus-1'])
    // The run with no report.json counts as a miss, not a pass and not dropped.
    expect(next.at(-1)).toMatchObject({ verdict: null, checks: [], turns: [], costUsd: 0 })
    expect(next.find((r) => r.name === 'regress-b-sonnet-1').turns).toHaveLength(2)
    const base = readRound(BASE)
    expect(base).toHaveLength(8)
    expect(base.every((r) => r.costUsd === null && r.turns.length === 0)).toBe(true)
  })

  it('counts cells per scenario x model and per preset x model, with sample counts and the mixed cells', () => {
    const s = aggregate(readRound(NEXT))
    expect(s.models).toEqual(['haiku', 'sonnet', 'opus'])
    expect(s.byModel).toEqual({ haiku: { pass: 2, runs: 4 }, sonnet: { pass: 1, runs: 2 }, opus: { pass: 0, runs: 1 } })
    expect(s.cells.map((c) => [c.scenario, c.model, c.pass, c.runs])).toEqual([
      ['long-d', 'opus', 0, 1],
      ['regress-a', 'haiku', 1, 3],
      ['regress-b', 'sonnet', 1, 1],
      ['routing-c', 'haiku', 1, 1],
      ['routing-c', 'sonnet', 0, 1],
    ])
    expect(s.presets.map((p) => [p.agent, p.model, p.pass, p.runs])).toEqual([
      ['concierge', 'sonnet', 1, 1],
      ['concierge', 'opus', 0, 1],
      ['croupier', 'haiku', 2, 4],
      ['croupier', 'sonnet', 0, 1],
    ])
    expect(s.mixed.map((c) => c.key)).toEqual(['regress-a-haiku'])
  })

  it('histograms failing checks, and counts each retry code as fired, saved and extra USD', () => {
    const s = aggregate(readRound(NEXT))
    expect(s.checks).toEqual([
      { check: 'expect-component', fails: 2, runs: 2 },
      { check: 'routing-expect', fails: 2, runs: 1 },
      { check: 'no-halt', fails: 1, runs: 1 },
    ])
    const r = Object.fromEntries(s.retries.map((x) => [x.code, [x.fired, x.turns, x.saved, Math.round(x.extraUsd * 100) / 100]]))
    // PARSE: two failed rounds on two turns, both saved; repairs cost $0.10 (Haiku, 1M in) and $0.50 (Sonnet, 50k out).
    expect(r.PARSE).toEqual([2, 2, 2, 0.6])
    // The halted turn: round 1 failed two codes and its $0.20 repair splits between them; round 2 has no repair.
    expect(r.BET_TABLE_MISSING).toEqual([1, 1, 0, 0.1])
    expect(r.SURFACE_DROPPED).toEqual([2, 1, 0, 0.1])
    // Shipped with SEMANTIC_UNCORRECTED: fired, not saved.
    expect(r.NARRATED_MECHANICS).toEqual([1, 1, 0, 0.05])
  })

  it('reports spend and latency per turn and the section digests per persona, tolerating a halted turn', () => {
    const s = aggregate(readRound(NEXT))
    expect(s.spend.map((x) => [x.model, x.runs, x.turns, x.usd, x.msP50, x.msP90])).toEqual([
      ['haiku', 4, 4, 0.7, 1000, 3000],
      ['sonnet', 2, 3, 3, 5000, 6000],
      ['opus', 1, 0, 0, null, null],
    ])
    expect(aggregate(readRound(BASE)).spend.every((x) => x.usd === null)).toBe(true)
    expect(s.digests).toEqual([
      { agent: 'concierge', section: 'persona', digest: 'q1', turns: 2 },
      { agent: 'croupier', section: 'grammar', digest: 'g1', turns: 1 },
      { agent: 'croupier', section: 'persona', digest: 'p1', turns: 3 },
      { agent: 'croupier', section: 'persona', digest: 'p2', turns: 1 },
    ])
    expect(s.noSections).toEqual({ croupier: 1 })
  })

  it('--against prints the churn of every cell, a mixed or missing-report cell counting as a fail', () => {
    const c = churn(readRound(BASE), readRound(NEXT))
    expect(c.transitions).toEqual({
      'fail to pass': ['routing-c-haiku'],
      'pass to fail': ['regress-a-haiku', 'routing-c-sonnet'],
      'fail to fail': ['long-d-opus'],
      'pass to pass': ['regress-b-sonnet'],
    })
    expect(c.gone).toEqual(['regress-e-haiku'])
    expect(c.added).toEqual([])
    const { code, out } = cli('--round', '2026-01-02-next', '--against', '2026-01-01-base')
    expect(code).toBe(0)
    expect(out).toContain('| fail to pass | 1 |')
    expect(out).toContain('| pass to fail | 2 |')
  })

  it('compares like samples in churn, prints multi-sample cells as rates, and still names baseline-only cells (T-0349)', () => {
    const c = churn(readRound(BASE), readRound(NEXT))
    // regress-a-haiku: 3 of 3 to 1 of 3 is pass to fail as a cell, but sample 1 passed on both sides.
    expect(c.sampleOne).toEqual({
      'fail to pass': ['routing-c-haiku'],
      'pass to fail': ['routing-c-sonnet'],
      'fail to fail': ['long-d-opus'],
      'pass to pass': ['regress-a-haiku', 'regress-b-sonnet'],
    })
    expect(c.rates).toEqual([{ cell: 'regress-a-haiku', base: { pass: 3, runs: 3 }, now: { pass: 1, runs: 3 } }])
    const { out } = cli('--round', '2026-01-02-next', '--against', '2026-01-01-base')
    expect(out).toContain('| pass to fail | 2 | `regress-a-haiku`, `routing-c-sonnet` | 1 | `routing-c-sonnet` |')
    expect(out).toContain('| `regress-a-haiku` | 3 of 3 | 1 of 3 |')
    expect(out).toContain('| only in 2026-01-01-base | 1 | `regress-e-haiku` | | |')
    expect(JSON.parse(cli('--round', '2026-01-02-next', '--against', '2026-01-01-base', '--json').out).against.churn.gone).toEqual(['regress-e-haiku'])
  })

  it('tallies turn outcomes, failure codes, failed rounds, string messages, reply-only repairs and retrieval (T-0349)', () => {
    const t = tally(readRound(NEXT))
    expect(t.turns).toBe(7)
    expect(t.outcomes).toEqual({ halt: 1, ok: 6 })
    expect(t.failureCodes).toEqual({ NARRATED_MECHANICS: 1, PARSE: 2, SEMANTIC_UNCORRECTED: 1 })
    expect(t.failedRounds).toEqual({ BET_TABLE_MISSING: 1, NARRATED_MECHANICS: 1, PARSE: 2, SURFACE_DROPPED: 2 })
    // One round sent `messages` as a string in two tool calls: counted once. An array is not counted.
    expect(t.stringMessages).toBe(1)
    // The NARRATED_MECHANICS repair has an empty `tools` array: reply-only. Both PARSE repairs called a tool. The halted
    // turn is an older trace line whose repair round has no `tools` field: a repair, never reply-only.
    expect(t.repairs).toEqual({ BET_TABLE_MISSING: { repairs: 1, replyOnly: 0 }, NARRATED_MECHANICS: { repairs: 1, replyOnly: 1 }, PARSE: { repairs: 2, replyOnly: 0 }, SURFACE_DROPPED: { repairs: 1, replyOnly: 0 } })
    // An id twice on one turn counts once; three distinct turns made the four retrievals.
    expect(t.retrieval).toEqual([{ agent: 'croupier', exemplar: 'ex-a', turns: 3 }, { agent: 'croupier', exemplar: 'ex-b', turns: 1 }])
    expect(t.retrievalTurns).toEqual({ croupier: 3 })
    expect(aggregate(readRound(NEXT)).tally).toEqual(t)
    const md = renderSignals(readRound(NEXT), { rounds: ['2026-01-02-next'] })
    expect(md).toContain('| outcome halt | 1 |')
    expect(md).toContain('| SEMANTIC_UNCORRECTED | 1 |')
    expect(md).toContain('- String `messages`: 1 rounds')
    expect(md).toContain('| NARRATED_MECHANICS | 1 | 1 |')
    expect(md).toContain('| croupier | 2 | 3 | `ex-a` (3), `ex-b` (1) |')
  })

  it('reads the baseline tallies from the runs in this round\'s cells, sample 1 against sample 1 and all against all (T-0349)', () => {
    const current = readRound(NEXT).filter((r) => r.name !== 'regress-b-sonnet-1')
    // The baseline: the same runs, but routing-c-haiku-1 (a sample 1 run) retrieved nothing.
    const base = readRound(NEXT).map((r) => ({ ...r, round: 'b', turns: r.name === 'routing-c-haiku-1' ? r.turns.map((t) => ({ ...t, exemplarIds: [] })) : r.turns }))
    expect(sameCells(base, current).map((r) => r.name)).toEqual(['regress-a-haiku-1', 'regress-a-haiku-2', 'regress-a-haiku-3', 'routing-c-haiku-1', 'routing-c-sonnet-1', 'long-d-opus-1'])
    const a = against('b', base, current)
    expect([a.tallies.sampleOne.turns, a.tallies.baseSampleOne.turns, a.tallies.all.turns, a.tallies.base.turns]).toEqual([3, 3, 5, 5])
    const md = renderSignals(current, { rounds: ['next'], against: a })
    expect(md).toContain('| Measure | Sample 1 | b sample 1 | All samples | b all |')
    expect(md).toContain('| Turns, outcome halt | 0 | 0 | 1 | 1 |')
    expect(md).toContain('| String `messages` rounds | 1 | 1 | 1 | 1 |')
    expect(md).toContain('| Reply-only repairs, NARRATED_MECHANICS | 0 of 0 | 0 of 0 | 1 of 1 | 1 of 1 |')
    expect(md).toContain('| Failed rounds, PARSE | 2 | 2 | 2 | 2 |')
    expect(md).toContain('| Turns with SEMANTIC_UNCORRECTED | 0 | 0 | 1 | 1 |')
    // A retrieval row prints when a like pair moved: ex-a (sample 1: 2 against 1) does, ex-b (1 everywhere) not.
    expect(md).toContain('| croupier | `ex-a` | 2 | 1 | 3 | 2 |')
    expect(md).not.toContain('| croupier | `ex-b` |')
    // Against an identical baseline nothing moved, though sample 1 (2) and all samples (3) differ for ex-a.
    expect(renderSignals(current, { rounds: ['next'], against: against('b', current, current) })).toContain('Turns retrieving each exemplar, the rows whose count moved sample 1 to sample 1 or all to all.\n\nNone moved.')
  })

  it('exits 1 on a cell under its tag floor or one that drops past the delta, gating only cells with enough samples', () => {
    const base = readRound(BASE)
    const next = readRound(NEXT)
    // regress-a-haiku: 1 of 3 under a 0.66 regression floor. regress-b-sonnet (1 sample) is under the minimum, not
    // gated. regress-e-haiku is in the baseline but has no sample now: zero samples fail the floor, never skipped.
    expect(gate(next, base, { floors: { regression: 0.66 }, minSamples: 3 }).misses.map((m) => m.cell)).toEqual(['regress-a-haiku', 'regress-e-haiku'])
    expect(gate(next, base, { floors: { routing: 1 }, minSamples: 3 }).misses).toEqual([])
    expect(gate(next, base, { floors: { routing: 1 }, minSamples: 1 }).misses.map((m) => m.cell)).toEqual(['routing-c-sonnet'])
    // 3 of 3 down to 1 of 3 is a 0.67 drop.
    expect(gate(next, base, { floors: {}, maxDrop: 0.5, minSamples: 3 }).misses.map((m) => [m.cell, m.reason])).toEqual([['regress-a-haiku', 'dropped 1.00 to 0.33 (more than 0.5)']])
    expect(gate(next, base, { floors: {}, maxDrop: 0.7, minSamples: 3 }).misses).toEqual([])
    // A baseline cell with no sample now is a drop to 0 (regress-e-haiku), under the same sample minimum both sides.
    expect(gate(next, base, { floors: {}, maxDrop: 0.5, minSamples: 1 }).misses.map((m) => m.cell)).toEqual(['regress-a-haiku', 'regress-e-haiku', 'routing-c-sonnet'])
    expect(gate(next, base, { floors: {}, maxDrop: 0.5, minSamples: 3 }).ungated).toContain('regress-e-haiku')

    expect(cli('--round', '2026-01-02-next', '--floor', 'regression=0.66').code).toBe(1)
    expect(cli('--round', '2026-01-02-next', '--against', '2026-01-01-base', '--max-drop', '0.5').code).toBe(1)
    expect(cli('--round', '2026-01-02-next', '--floor', 'all=0.3').code).toBe(0)
    expect(cli('--round', 'no-such-round').code).toBe(2)
    expect(cli('--round', '2026-01-02-next', '--floor', 'regression').code).toBe(2)
    expect(cli('--round', '2026-01-02-next', '--floor', 'regresion=0.5').code).toBe(2)
    // One value per --round: a second folder after it is a stray argument, not silently dropped.
    expect(cli('--round', '2026-01-02-next', '2026-01-01-base').code).toBe(2)
    expect(cli('--round', '2026-01-02-next', '--round', '2026-01-01-base').code).toBe(0)
  })

  it('compares rates at the boundary: a drop of exactly the delta, or a rate exactly at the floor, passes', () => {
    const runs = (round, pass, n) => Array.from({ length: n }, (_, i) => ({ round, name: `regress-x-haiku-${i + 1}`, scenario: 'regress-x', sample: i + 1, agent: 'croupier', model: 'claude-haiku-5-5', effort: 'default', verdict: i < pass ? 'pass' : 'fail', checks: [], costUsd: 0, turns: [] }))
    expect(gate(runs('b', 7, 10), runs('a', 9, 10), { floors: {}, maxDrop: 0.2, minSamples: 3 }).misses).toEqual([])
    expect(gate(runs('b', 6, 10), runs('a', 9, 10), { floors: {}, maxDrop: 0.2, minSamples: 3 }).misses).toHaveLength(1)
    expect(gate(runs('b', 7, 10), undefined, { floors: { regression: 0.7 }, minSamples: 3 }).misses).toEqual([])
    expect(gate(runs('b', 6, 10), undefined, { floors: { regression: 0.7 }, minSamples: 3 }).misses).toHaveLength(1)
  })

  it('renders signals.md deterministically, every section present', () => {
    const md = renderSignals(readRounds([NEXT]), { rounds: ['2026-01-02-next'] })
    expect(md).toBe(renderSignals(readRounds([NEXT]), { rounds: ['2026-01-02-next'] }))
    for (const h of ['## Pass rate, scenario by model', '## Pass rate, preset by model', '## Mixed cells', '## Failing checks', '## Producer retry codes', '## Spend and latency per turn', '## Section digests per persona']) expect(md).toContain(h)
    expect(md).toContain('| regress-a | 1 of 3 | | |')
  })

  // The oracle: r9's report.md, built by hand. Read from the committed archive.
  it.runIf(existsSync(join(ROUNDS, '2026-10-17-r9-matrix', 'ledger.jsonl')))('reproduces the r9 report: 22 / 28 / 27 of 29, churn 6 / 6 / 4 / 71 against r8', () => {
    const r9 = readRound(join(ROUNDS, '2026-10-17-r9-matrix'))
    const s = aggregate(r9)
    expect(s.byModel).toEqual({ haiku: { pass: 22, runs: 29 }, sonnet: { pass: 28, runs: 29 }, opus: { pass: 27, runs: 29 } })
    expect(s.spend.map((x) => x.usd.toFixed(2))).toEqual(['0.75', '12.62', '23.32'])
    expect(Object.fromEntries(s.checks.map((c) => [c.check, c.fails]))).toEqual({ 'render-lint': 20, 'expect-component': 8, 'no-halt': 6, 'click-target': 5, 'routing-expect': 3 })
    const c = churn(readRound(join(ROUNDS, '2026-10-16-r8-matrix')), r9)
    expect(Object.values(c.transitions).map((x) => x.length)).toEqual([6, 6, 4, 71])
  })

  // The oracle: r10's report.md tables, counted by hand against r9's runs in the same cells (T-0349).
  it.runIf(existsSync(join(ROUNDS, '2026-10-17-r10-targeted', 'ledger.jsonl')))('reproduces the r10 report: like-sample churn 7 / 4 / 1 / 11 and the retry-code table against r9', () => {
    const r10 = readRound(join(ROUNDS, '2026-10-17-r10-targeted'))
    const a = against('2026-10-17-r9-matrix', readRound(join(ROUNDS, '2026-10-17-r9-matrix')), r10)
    expect(Object.values(a.churn.sampleOne).map((x) => x.length)).toEqual([7, 4, 1, 11])
    expect(Object.values(a.churn.transitions).map((x) => x.length)).toEqual([5, 4, 3, 11])
    expect(a.churn.gone).toHaveLength(64)
    expect(a.churn.rates.map((r) => [r.cell, r.now.pass])).toEqual([
      ['long-croupier-blackjack-hand-haiku', 2],
      ['regress-croupier-blackjack-moves-haiku', 3],
      ['regress-croupier-blackjack-rounds-haiku', 1],
      ['routing-domain-switch-haiku', 3],
      ['routing-guidance-conflict-haiku', 2],
    ])
    // Round 9 ran one sample per cell, so its sample 1 is all of it.
    expect(a.tallies.baseSampleOne).toEqual(a.tallies.base)
    const { sampleOne: s1, all, base: r9 } = a.tallies
    const row = (f) => [f(s1), f(all), f(r9)]
    expect(row((x) => x.turns)).toEqual([176, 239, 170])
    expect(row((x) => x.outcomes.halt ?? 0)).toEqual([0, 0, 6])
    expect(row((x) => x.failedRounds.PARSE ?? 0)).toEqual([8, 12, 5])
    expect(row((x) => x.stringMessages)).toEqual([8, 10, 4])
    expect(row((x) => x.failureCodes.SURFACE_DEGRADED ?? 0)).toEqual([1, 2, 0])
    expect(row((x) => x.failedRounds.ACTION_NOT_APPLIED ?? 0)).toEqual([10, 17, 8])
    expect(row((x) => x.failedRounds.BANKROLL_MISMATCH ?? 0)).toEqual([3, 7, 6])
    expect(row((x) => x.failedRounds.SURFACE_REQUESTED ?? 0)).toEqual([1, 3, 0])
    expect(row((x) => x.failedRounds.SURFACE_DROPPED ?? 0)).toEqual([0, 0, 13])
    // T-0332: reply-only NARRATED_MECHANICS repairs, 8 of 8 (all 9 of 9), round 9 6 of 14.
    expect(row((x) => `${x.repairs.NARRATED_MECHANICS.replyOnly} of ${x.repairs.NARRATED_MECHANICS.repairs}`)).toEqual(['8 of 8', '9 of 9', '6 of 14'])
    // T-0335 and T-0318: the Concierge retrieval of the rewritten records.
    const ret = (x, id) => x.retrieval.find((r) => r.agent === 'concierge' && r.exemplar === id)?.turns ?? 0
    expect(row((x) => ret(x, 'backable-wizard'))).toEqual([0, 0, 3])
    expect(row((x) => ret(x, 'frontier-booking-receipt'))).toEqual([0, 0, 1])
  })

  it.runIf(existsSync(join(ROUNDS, '2026-10-17-t0329-mix', 'ledger.jsonl')))('groups the T-0329 samples into one scenario per arm, the pontoon witness apart', () => {
    for (const arm of ['old', 'new', 'mix']) {
      const s = aggregate(readRound(join(ROUNDS, `2026-10-17-t0329-${arm}`)))
      expect(s.cells.map((c) => [c.scenario, c.runs])).toEqual([[`t0329-${arm}`, 30], [`t0329-${arm}-pontoon`, 1]])
    }
  })
})
