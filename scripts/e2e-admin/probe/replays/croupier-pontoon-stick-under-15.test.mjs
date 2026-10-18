// T-0370 (live round 11 cluster J). Keyless pin for the replay beside this file, cut from the round 11 run
// regress-croupier-pontoon-haiku-1 (traces 2026-10-18.jsonl:31 to :38): after "Buy a card." the hand is 14, pontoon
// forbids sticking under 15, the agent refused "Stick." (right) and the hand stayed in play, so the scripted Deal
// again found no button on the newest table. Turns 0 to 7 are the recorded run; turn 8 (the new follow-up step twists
// to 19, sticks, the table settles) and turn 9 (Deal again opens table-3) are authored, the recorded round is untouched.
// The browser leg, from the repo root: `npm run chat:probe -- --replay scripts/e2e-admin/probe/replays/croupier-pontoon-stick-under-15.json`
// (exit 0; the recorded fixture, replayed as it was, still ends on the failed Deal again).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { newestTablePhase, parseProbeFixture, quote, stepArgv, stepSkip, TablePhase } from '../model.ts'
import { CROUPIER_ROUND_SCENARIOS, CROUPIER_SCENARIOS, TWIST_TO_STICK, withoutSkipMarks } from '../scenarios/croupier.ts'
import { offlineReplay } from '../trace.ts'

const fixture = parseProbeFixture(readFileSync(new URL('./croupier-pontoon-stick-under-15.json', import.meta.url), 'utf8'))
const scenario = CROUPIER_ROUND_SCENARIOS.find((s) => s.name === 'pontoon').steps
const FOLLOW_UP = 8

describe('the live-round pontoon steps survive a refusal to stick under 15 (T-0370)', () => {
  it('the follow-up step comes after round 2\'s Stick, marked to skip on a settled table', () => {
    expect(scenario[FOLLOW_UP]).toEqual({ say: TWIST_TO_STICK, skipIfPhase: 'settled' })
    expect(scenario[FOLLOW_UP - 1].say).toBe('Stick.')
    expect(scenario[FOLLOW_UP + 1].click).toBe('Deal again')
    expect(scenario.filter((step) => step.say === TWIST_TO_STICK)).toHaveLength(1)
  })

  it('the frozen T-0184 pontoon steps do not carry it', () => {
    expect(CROUPIER_SCENARIOS.find((s) => s.name === 'pontoon').steps.some((step) => step.say === TWIST_TO_STICK)).toBe(false)
  })

  it('a finished round\'s pin sees the script without the follow-up and the skip marks', () => {
    const line = ['npm', 'run', 'chat:probe', '--', ...scenario.slice(6, 10).flatMap(stepArgv)].map(quote).join(' ')
    expect(line).toContain(TWIST_TO_STICK)
    expect(withoutSkipMarks(line)).toBe('npm run chat:probe -- --say "Buy a card." --say Stick. --click "Deal again" --expect-turn CardTable')
  })
})

describe('croupier-pontoon-stick-under-15', () => {
  it('plays the current scenario steps with its marks', () => {
    expect(fixture.steps.map((s) => [s.say ?? s.click, s.skipIfPhase])).toEqual(scenario.slice(0, fixture.steps.length).map((s) => [s.say ?? s.click, s.skipIfPhase]))
  })

  it('the refused Stick leaves the table in play, so the follow-up plays and settles it before Deal again', () => {
    const table = new TablePhase()
    const skipped = []
    fixture.steps.forEach((step, i) => {
      if (stepSkip(step, table.phase())) return skipped.push(i)
      if (i === FOLLOW_UP) expect(table.phase(), 'the refused stick leaves the hand in play').toBe('playing')
      if (step.click === 'Deal again') expect(table.phase(), `Deal again at ${i} finds a settled table`).toBe('settled')
      table.feed(fixture.turns[i - skipped.length]?.lines ?? [])
    })
    expect(skipped).toEqual([])
    expect(fixture.turns).toHaveLength(fixture.steps.length)
  })

  it('a stick that settles the hand skips the follow-up', () => {
    expect(stepSkip(scenario[FOLLOW_UP], 'settled')).toBe(true)
    expect(stepSkip(scenario[FOLLOW_UP], 'playing')).toBe(false)
  })

  it('the table is in play after the recorded refusal and settled after the authored turn', () => {
    const through = (n) => newestTablePhase(fixture.turns.slice(0, n + 1).flatMap((t) => t.lines))
    expect(through(7)).toBe('playing')
    expect(through(8)).toBe('settled')
  })

  it('replays through the real produce() with every probe check green', async () => {
    const report = await offlineReplay(fixture, process.cwd())
    expect(report.failed.map((c) => `${c.check}:${c.turn}`)).toEqual([])
  })
})
