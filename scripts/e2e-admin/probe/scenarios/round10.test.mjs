// T-0341: live round 10 is well-formed before any credit is spent. Keyless: the selection is round 9's failed runs
// plus the runs each round 9 fix touches, minus the exclusions named with a reason; the unstable Haiku blackjack
// openings run 3 samples; every run is round 9's argv apart from `--out` and `--name`; the estimate is pinned to the
// round 8 and 9 ledgers and sits near $8 under the $10 cap; and `live-commands.sh` is exactly the generated script,
// which the capped runner describes.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseProbeCli } from '../cli.ts'
import { describeCommands } from '../run-capped.ts'
import { ROUND8_DIR } from './round8.ts'
import { ROUND9_DIR, round9Runs } from './round9.ts'
import {
  R10_COST,
  R10_EXCLUDED,
  R10_SAMPLES,
  R10_UNSTABLE,
  R9_FAILED,
  R9_FIX_RUNS,
  ROUND10_CAP,
  ROUND10_DIR,
  ROUND10_FILE,
  round10CommandsScript,
  round10ExpectedUsd,
  round10Runs,
} from './round10.ts'

const root = new URL('../../../../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, root), 'utf8')
const ledgerOf = (dir) =>
  read(`${dir}/ledger.jsonl`)
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l))
const r8 = ledgerOf(ROUND8_DIR)
const r9 = ledgerOf(ROUND9_DIR)
const base = (name) => name.replace(/-\d+$/, '-1')

describe('live round 10', () => {
  const runs = round10Runs()
  const names = runs.map((r) => r.name)

  it("R9_FAILED is round 9's 10 failed runs, in its ledger order", () => {
    expect(R9_FAILED).toEqual(r9.filter((r) => r.verdict === 'fail').map((r) => r.name))
    expect(R9_FAILED).toHaveLength(10)
  })

  it('every fix maps to round 9 runs, and each exclusion is a failed or touched run with a reason', () => {
    const r9Names = new Set(r9.map((r) => r.name))
    expect(Object.keys(R9_FIX_RUNS).sort()).toEqual(['T-0328', 'T-0330', 'T-0331', 'T-0332', 'T-0333', 'T-0334', 'T-0335'])
    for (const [ticket, list] of Object.entries(R9_FIX_RUNS)) {
      expect(list.length, ticket).toBeGreaterThan(0)
      for (const n of list) expect(r9Names.has(n), `${ticket}: ${n}`).toBe(true)
    }
    const candidates = new Set([...R9_FAILED, ...Object.values(R9_FIX_RUNS).flat()])
    for (const [n, why] of Object.entries(R10_EXCLUDED)) {
      expect(candidates.has(n), n).toBe(true)
      expect(why.length, n).toBeGreaterThan(20)
    }
  })

  it('selects the round 9 failures plus the runs each fix touches, minus the exclusions, each base run once per sample', () => {
    const candidates = new Set([...R9_FAILED, ...Object.values(R9_FIX_RUNS).flat()])
    const selected = [...candidates].filter((n) => !(n in R10_EXCLUDED)).sort()
    expect([...new Set(names.map(base))].sort()).toEqual(selected)
    expect(new Set(names).size).toBe(runs.length)
    for (const r of runs) expect(r.name).toBe(`${base(r.name).replace(/-1$/, '')}-${r.sample}`)
  })

  it('the unstable Haiku blackjack openings run 3 samples, every other run 1', () => {
    expect(R10_SAMPLES).toBe(3)
    expect([...R10_UNSTABLE].sort()).toEqual(
      [
        'regress-croupier-blackjack-rounds-haiku-1',
        'regress-croupier-blackjack-moves-haiku-1',
        'regress-croupier-spanish-21-haiku-1',
        'regress-croupier-pontoon-haiku-1',
        'routing-domain-switch-haiku-1',
        'routing-guidance-conflict-haiku-1',
        'long-croupier-blackjack-hand-haiku-1',
      ].sort(),
    )
    const count = (b) => names.filter((n) => base(n) === b).length
    for (const b of new Set(names.map(base))) expect(count(b), b).toBe(R10_UNSTABLE.includes(b) ? 3 : 1)
  })

  it("each run is round 9's argv for the same scenario and model, with only --out and --name changed", () => {
    const prior = new Map(round9Runs().map((r) => [r.name, r]))
    for (const { agent, model, name, argv } of runs) {
      const p = prior.get(base(name))
      expect(p, name).toBeDefined()
      expect([agent, model.id]).toEqual([p.agent, p.model.id])
      const out = argv.indexOf('--out') + 1
      const nm = argv.indexOf('--name') + 1
      expect(argv[out]).toBe(`${ROUND10_DIR}/runs/${name}`)
      expect(argv[nm]).toBe(name)
      const keep = (a) => a.filter((_, j) => j !== a.indexOf('--out') + 1 && j !== a.indexOf('--name') + 1)
      expect(keep(argv)).toEqual(keep(p.argv))
      const cmd = parseProbeCli(argv)
      expect(cmd.mode).toBe('probe')
      expect([cmd.agent, cmd.model, cmd.name]).toEqual([agent, model.id, name])
    }
  })

  it('each cost is the larger of the round 8 and round 9 ledger costs, runs go cheapest first, the estimate leaves headroom', () => {
    const c8 = new Map(r8.map((r) => [r.name, r.costUsd]))
    const c9 = new Map(r9.map((r) => [r.name, r.costUsd]))
    expect(Object.keys(R10_COST).sort()).toEqual([...new Set(names.map(base))].sort())
    for (const [n, c] of Object.entries(R10_COST)) expect(c, n).toBeCloseTo(Math.max(c8.get(n) ?? 0, c9.get(n)), 6)
    const costs = names.map((n) => R10_COST[base(n)])
    expect(costs).toEqual([...costs].sort((a, b) => a - b))
    expect(ROUND10_CAP).toBe(10)
    expect(round10ExpectedUsd()).toBeLessThanOrEqual(8)
  })

  it('live-commands.sh is the generated script, and the capped runner describes every run keyless', () => {
    const text = read(ROUND10_FILE)
    expect(text).toBe(round10CommandsScript())
    expect(text).toContain(`run-capped.ts ${ROUND10_FILE} --cap 10 --round r10-targeted`)
    for (const n of Object.keys(R10_EXCLUDED)) expect(text).toContain(n)
    const described = describeCommands(text)
    expect(described).toHaveLength(runs.length)
    expect(described.map((d) => d.split(':')[0])).toEqual(names)
  })
})
