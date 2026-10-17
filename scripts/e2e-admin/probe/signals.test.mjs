// T-0342: eval signals over the round archive, keyless. Two fixture round folders stand in for the archive: `base`
// has no ledger (an r1-style round, read from report.json alone, cost unknown) and `next` has a ledger, trace lines
// and a run that wrote no report. The committed r8 and r9 rounds pin the numbers r9's hand-written report.md gives.
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runNameParts } from './ledger.ts'
import { aggregate, churn, gate, main, readRound, readRounds, renderSignals } from './signals.ts'

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
    expect(runNameParts('t0329-mix-17')).toEqual({ scenario: 't0329-mix', sample: 17 })
    expect(runNameParts('t0329-mix-pontoon')).toEqual({ scenario: 't0329-mix-pontoon', sample: 1 })
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

    expect(cli('--round', '2026-01-02-next', '--floor', 'regression=0.66').code).toBe(1)
    expect(cli('--round', '2026-01-02-next', '--against', '2026-01-01-base', '--max-drop', '0.5').code).toBe(1)
    expect(cli('--round', '2026-01-02-next', '--floor', 'all=0.3').code).toBe(0)
    expect(cli('--round', 'no-such-round').code).toBe(2)
    expect(cli('--round', '2026-01-02-next', '--floor', 'regression').code).toBe(2)
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

  it.runIf(existsSync(join(ROUNDS, '2026-10-17-t0329-mix', 'ledger.jsonl')))('groups the T-0329 samples into one scenario per arm, the pontoon witness apart', () => {
    for (const arm of ['old', 'new', 'mix']) {
      const s = aggregate(readRound(join(ROUNDS, `2026-10-17-t0329-${arm}`)))
      expect(s.cells.map((c) => [c.scenario, c.runs])).toEqual([[`t0329-${arm}`, 30], [`t0329-${arm}-pontoon`, 1]])
    }
  })
})
