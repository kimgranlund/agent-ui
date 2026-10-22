// T-0303: live round 7 is well-formed before any credit is spent. Keyless: the reruns are exactly round 6's failed
// runs per its ledger, every Haiku long flow runs once, runs go cheapest first by round 6 cost, and
// `live-commands.sh` is exactly the generated script, which the capped runner describes.
import { readFileSync } from 'node:fs'
import { asArchivedBookingConfirmation } from './concierge.ts'
import { withoutSkipMarks } from './croupier.ts'
import { asArchivedConciergeDomain } from './routing.ts'
import { describe, expect, it } from 'vitest'
import { parseProbeCli } from '../cli.ts'
import { describeCommands } from '../run-capped.ts'
import { ROUND6_DIR, ROUND6_LONG_FLOWS, round6Runs } from './round6.ts'
import { R6_COST, R6_FAILED, ROUND7_DIR, ROUND7_FILE, round7CommandsScript, round7ExpectedUsd, round7Runs } from './round7.ts'

const root = new URL('../../../../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, root), 'utf8')
const ledger = read(`${ROUND6_DIR}/ledger.jsonl`)
  .split('\n')
  .filter((l) => l.trim() !== '')
  .map((l) => JSON.parse(l))

describe('live round 7', () => {
  const runs = round7Runs()
  const names = runs.map((r) => r.name)

  it("reruns exactly round 6's 11 failed runs, in its ledger order", () => {
    expect(R6_FAILED).toEqual(ledger.filter((r) => r.verdict === 'fail').map((r) => r.name))
    expect(runs.filter((r) => r.part === 'rerun').map((r) => r.name).sort()).toEqual([...R6_FAILED].sort())
  })

  it('every Haiku long flow runs once: 11 reruns plus 4 long flows that passed in round 6', () => {
    const haikuLong = ROUND6_LONG_FLOWS.map((f) => `long-${f.agent}-${f.scenario.name}-haiku-1`)
    for (const n of haikuLong) expect(names.filter((x) => x === n)).toHaveLength(1)
    expect(runs.filter((r) => r.part === 'long')).toHaveLength(4)
    expect(runs).toHaveLength(15)
    expect(new Set(names).size).toBe(runs.length)
  })

  it('each run is round 6 argv for the same scenario, model and name, out under the round 7 folder', () => {
    const r6 = new Map(round6Runs().map((r) => [r.name, r]))
    for (const { agent, model, name, argv } of runs) {
      const prior = r6.get(name)
      expect(prior.model.id).toBe(model.id)
      const out = argv.indexOf('--out') + 1
      expect(argv[out]).toBe(`${ROUND7_DIR}/runs/${name}`)
      expect(argv.filter((_, i) => i !== out)).toEqual(prior.argv.filter((_, i) => i !== out))
      const cmd = parseProbeCli(argv)
      expect(cmd.mode).toBe('probe')
      expect(cmd.agent).toBe(agent)
      expect(cmd.model).toBe(model.id)
      expect(cmd.name).toBe(name)
    }
  })

  it('costs are the round 6 ledger costs, and runs go cheapest first', () => {
    const ledgerCost = new Map(ledger.map((r) => [r.name, r.costUsd]))
    expect(Object.keys(R6_COST).sort()).toEqual([...names].sort())
    for (const n of names) expect(R6_COST[n]).toBe(ledgerCost.get(n))
    const costs = names.map((n) => R6_COST[n])
    expect(costs).toEqual([...costs].sort((a, b) => a - b))
    expect(round7ExpectedUsd()).toBeLessThan(6)
  })

  it('live-commands.sh is the generated script, and the capped runner describes every run keyless', () => {
    const text = read(ROUND7_FILE)
    expect(text).toBe(withoutSkipMarks(asArchivedBookingConfirmation(asArchivedConciergeDomain(round7CommandsScript()))))
    expect(text).toContain('run-capped.ts .sdlc/evals/rounds/2026-10-16-r7-fails/live-commands.sh --cap 6 --round r7-fails')
    const described = describeCommands(text)
    expect(described).toHaveLength(15)
    expect(described.at(-1)).toMatch(/^regress-croupier-five-card-draw-opus-1: croupier on claude-opus-5-5, /)
  })
})
