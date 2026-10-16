// Pinned from round 2026-10-15-r4-fixes, regress-concierge-facilities-then-tour-sonnet-1, with turn 0's oracle
// rewritten to Kim's T-0285 ruling (a compact info card: one Card holding a DescriptionList). Keyless: the recorded
// model rounds replay through the real produce(), then the probe checks run with no browser.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseProbeFixture } from '../model.ts'
import { offlineReplay } from '../trace.ts'

const load = () => parseProbeFixture(readFileSync(new URL('./concierge-sonnet-facility-hours.json', import.meta.url), 'utf8'))
const turn0 = (report) => report.checks.find((c) => c.check === 'expect-component' && c.turn === 0)

// Sonnet answered "What are the opening hours of the pool, gym and spa?" with one Card holding a DescriptionList.
it('concierge-sonnet-facility-hours: the recorded facility answer passes the ruled DescriptionList oracle', async () => {
  const report = await offlineReplay(load(), process.cwd())
  expect(turn0(report)?.status).toBe('pass')
  expect(report.failed.filter((c) => c.turn === 0)).toEqual([])
})

// Control: the same recorded answer fails the retired ServiceCard oracle, so the pass above is the ruling's.
it('concierge-sonnet-facility-hours: the same answer fails the retired ServiceCard oracle', async () => {
  const fixture = load()
  fixture.steps[0].expect = ['ServiceCard']
  const report = await offlineReplay(fixture, process.cwd())
  expect(turn0(report)?.status).toBe('fail')
})
