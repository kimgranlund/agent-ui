// T-0326: live round 9 is well-formed before any credit is spent. Keyless: it is round 8's 87 runs, same scenario,
// model, name and order, out under the round 9 folder; the expected spend is round 8's ledger spend and sits under the
// $42 cap; and `live-commands.sh` is exactly the generated script, which the capped runner describes.
import { readFileSync } from 'node:fs'
import { asArchivedBookingConfirmation } from './concierge.ts'
import { withoutSkipMarks } from './croupier.ts'
import { asArchivedConciergeDomain, asArchivedGuidanceConflict } from './routing.ts'
import { describe, expect, it } from 'vitest'
import { parseProbeCli } from '../cli.ts'
import { describeCommands } from '../run-capped.ts'
import { ROUND8_DIR, round8Runs } from './round8.ts'
import { R8_MODEL_COST, ROUND9_CAP, ROUND9_DIR, ROUND9_FILE, round9CommandsScript, round9ExpectedUsd, round9Runs } from './round9.ts'

const root = new URL('../../../../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, root), 'utf8')
const ledger = read(`${ROUND8_DIR}/ledger.jsonl`)
  .split('\n')
  .filter((l) => l.trim() !== '')
  .map((l) => JSON.parse(l))

describe('live round 9', () => {
  const runs = round9Runs()

  it("is round 8's 87 runs in its order, each on the same scenario and model, out under the round 9 folder", () => {
    const r8 = round8Runs()
    expect(runs).toHaveLength(87)
    expect(runs.map((r) => r.name)).toEqual(r8.map((r) => r.name))
    expect(runs.map((r) => r.name)).toEqual(ledger.map((r) => r.name))
    runs.forEach(({ part, agent, model, name, argv }, i) => {
      const prior = r8[i]
      expect([part, agent, model.id]).toEqual([prior.part, prior.agent, prior.model.id])
      const out = argv.indexOf('--out') + 1
      expect(argv[out]).toBe(`${ROUND9_DIR}/runs/${name}`)
      expect(argv.filter((_, j) => j !== out)).toEqual(prior.argv.filter((_, j) => j !== out))
      const cmd = parseProbeCli(argv)
      expect(cmd.mode).toBe('probe')
      expect(cmd.agent).toBe(agent)
      expect(cmd.model).toBe(model.id)
      expect(cmd.name).toBe(name)
    })
  })

  it("the expected spend is round 8's ledger spend per model, under the cap", () => {
    const perModel = {}
    for (const r of ledger) perModel[r.model] = (perModel[r.model] ?? 0) + r.costUsd
    expect(Object.keys(R8_MODEL_COST).sort()).toEqual(Object.keys(perModel).sort())
    for (const [m, c] of Object.entries(perModel)) expect(R8_MODEL_COST[m]).toBeCloseTo(c, 6)
    expect(round9ExpectedUsd()).toBeLessThan(ROUND9_CAP)
  })

  it('live-commands.sh is the generated script, and the capped runner describes every run keyless', () => {
    const text = read(ROUND9_FILE)
    expect(text).toBe(withoutSkipMarks(asArchivedBookingConfirmation(asArchivedConciergeDomain(asArchivedGuidanceConflict(round9CommandsScript())))))
    expect(text).toContain('run-capped.ts .sdlc/evals/rounds/2026-10-17-r9-matrix/live-commands.sh --cap 42 --round r9-matrix')
    const described = describeCommands(text)
    expect(described).toHaveLength(87)
    expect(described.at(-1)).toMatch(/^long-concierge-facility-hours-opus-1: concierge on claude-opus-5-5, /)
  })
})
