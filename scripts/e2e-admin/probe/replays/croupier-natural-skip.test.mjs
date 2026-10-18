// T-0347 (live round 10 cluster D). Keyless pins for the two replays beside this file, cut from the round 10 runs
// regress-croupier-blackjack-rounds-haiku-3 (:80) and regress-croupier-pontoon-haiku-1 (:101 to :103): a natural settled
// the hand on the deal and the scripted next steps had no button. The steps carry the current scenario's
// `skipIfPhase` marks and a skipped step has no turn, so the page plays what is left. The browser leg, from the
// repo root: `npm run chat:probe -- --replay scripts/e2e-admin/probe/replays/croupier-blackjack-natural-skip.json`
// (and `croupier-pontoon-natural-skip.json`); both exit 0 (the pontoon one ends at the skipped Stick).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseProbeFixture, stepSkip, TablePhase } from '../model.ts'
import { CROUPIER_ROUND_SCENARIOS } from '../scenarios/croupier.ts'
import { offlineReplay } from '../trace.ts'

const fixtureOf = (name) => parseProbeFixture(readFileSync(new URL(`./${name}.json`, import.meta.url), 'utf8'))
const stepsOf = (scenario) => CROUPIER_ROUND_SCENARIOS.find((s) => s.name === scenario).steps

/** Which steps are skipped, and which turn each played step takes, when the recorded turns answer the played steps in order. */
function walk(steps, turns) {
  const table = new TablePhase()
  const skipped = []
  let next = 0
  steps.forEach((step, i) => {
    if (stepSkip(step, table.phase())) return skipped.push(i)
    table.feed(turns[next]?.lines ?? [])
    next += 1
  })
  return { skipped, played: next }
}

describe.each([
  ['croupier-blackjack-natural-skip', 'blackjack-rounds', [6, 9]],
  ['croupier-pontoon-natural-skip', 'pontoon', [6, 7]],
])('%s', (name, scenario, skippedAt) => {
  const fixture = fixtureOf(name)

  it('plays the current scenario steps with its marks', () => {
    const current = stepsOf(scenario)
    expect(fixture.steps.map((s) => [s.say ?? s.click, s.skipIfPhase])).toEqual(current.slice(0, fixture.steps.length).map((s) => [s.say ?? s.click, s.skipIfPhase]))
  })

  it('skips exactly the steps a settled table leaves, and the recorded turns answer every other step', () => {
    const { skipped, played } = walk(fixture.steps, fixture.turns)
    expect(skipped).toEqual(skippedAt)
    expect(played).toBe(fixture.turns.length)
  })

  it('the steps without their marks would play every step, one more than the recorded turns answer', () => {
    const bare = fixture.steps.map(({ skipIfPhase, ...step }) => step)
    const { skipped, played } = walk(bare, fixture.turns)
    expect(skipped).toEqual([])
    expect(played).toBeGreaterThan(fixture.turns.length)
  })
})

// T-0350: turn 5 is :101, whose round-2 repair sent only updateDataModel, so table-2 settled with no Deal again.
// DEAL_AGAIN_MISSING now sends it back; the fixture records no clean round, so the replay ships it tallied.
it('croupier-pontoon-natural-skip: the settled natural with no Deal again gets DEAL_AGAIN_MISSING', async () => {
  const report = await offlineReplay(fixtureOf('croupier-pontoon-natural-skip'), process.cwd())
  expect(report.failed.map((c) => `${c.check}:${c.turn}`)).toEqual([])
  const trace = report.records[5].lines.map((l) => JSON.parse(l).a2uiMeta?.trace).find((t) => t !== undefined)
  expect(trace.failureCodes).toEqual(['DEAL_AGAIN_MISSING', 'SEMANTIC_UNCORRECTED'])
})
