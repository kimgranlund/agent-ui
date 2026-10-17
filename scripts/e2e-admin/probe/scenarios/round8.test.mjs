// T-0319: live round 8 is well-formed before any credit is spent. Keyless: it is round 6's 87 runs, same scenario,
// model, name and order, out under the round 8 folder; the expected spend is round 6's ledger spend and sits under the
// $42 cap; and `live-commands.sh` is exactly the generated script, which the capped runner describes.
import { readFileSync } from 'node:fs'
import { withoutSkipMarks } from './croupier.ts'
import { describe, expect, it } from 'vitest'
import { parseProbeCli } from '../cli.ts'
import { describeCommands } from '../run-capped.ts'
import { ROUND6_DIR, round6Runs } from './round6.ts'
import { R6_MODEL_COST, ROUND8_CAP, ROUND8_DIR, ROUND8_FILE, round8CommandsScript, round8ExpectedUsd, round8Runs } from './round8.ts'

const root = new URL('../../../../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, root), 'utf8')
const ledger = read(`${ROUND6_DIR}/ledger.jsonl`)
  .split('\n')
  .filter((l) => l.trim() !== '')
  .map((l) => JSON.parse(l))

describe('live round 8', () => {
  const runs = round8Runs()

  it("is round 6's 87 runs in its order, each on the same scenario and model, out under the round 8 folder", () => {
    const r6 = round6Runs()
    expect(runs).toHaveLength(87)
    expect(runs.map((r) => r.name)).toEqual(r6.map((r) => r.name))
    expect(runs.map((r) => r.name)).toEqual(ledger.map((r) => r.name))
    runs.forEach(({ part, agent, model, name, argv }, i) => {
      const prior = r6[i]
      expect([part, agent, model.id]).toEqual([prior.part, prior.agent, prior.model.id])
      const out = argv.indexOf('--out') + 1
      expect(argv[out]).toBe(`${ROUND8_DIR}/runs/${name}`)
      expect(argv.filter((_, j) => j !== out)).toEqual(prior.argv.filter((_, j) => j !== out))
      const cmd = parseProbeCli(argv)
      expect(cmd.mode).toBe('probe')
      expect(cmd.agent).toBe(agent)
      expect(cmd.model).toBe(model.id)
      expect(cmd.name).toBe(name)
    })
  })

  it("the expected spend is round 6's ledger spend per model, under the cap", () => {
    const perModel = {}
    for (const r of ledger) perModel[r.model] = (perModel[r.model] ?? 0) + r.costUsd
    expect(Object.keys(R6_MODEL_COST).sort()).toEqual(Object.keys(perModel).sort())
    for (const [m, c] of Object.entries(perModel)) expect(R6_MODEL_COST[m]).toBeCloseTo(c, 6)
    expect(round8ExpectedUsd()).toBeLessThan(ROUND8_CAP)
  })

  it('live-commands.sh is the generated script, and the capped runner describes every run keyless', () => {
    const text = read(ROUND8_FILE)
    expect(text).toBe(withoutSkipMarks(round8CommandsScript()))
    expect(text).toContain('run-capped.ts .sdlc/evals/rounds/2026-10-16-r8-matrix/live-commands.sh --cap 42 --round r8-matrix')
    const described = describeCommands(text)
    expect(described).toHaveLength(87)
    expect(described.at(-1)).toMatch(/^long-concierge-facility-hours-opus-1: concierge on claude-opus-5-5, /)
  })
})
