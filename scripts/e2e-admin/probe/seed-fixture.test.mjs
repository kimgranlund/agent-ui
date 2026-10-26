// T-0476: `fixtureFromReport` writes the persona seed into the fixture a live run leaves behind, and the fixture
// parser keeps it. (The seed itself is pinned to the live preset in seed.test.mjs.)
import { describe, expect, it } from 'vitest'
import { parseProbeFixture } from './model.ts'
import { fixtureFromReport } from './run.ts'
import { personaSeedRecord } from './seed.ts'

const report = {
  kind: 'agent-ui-chat-probe-report',
  version: 1,
  name: 'seed-probe',
  mode: 'live',
  agent: 'croupier',
  at: '2026-10-26T00:00:00.000Z',
  turns: [{ step: { say: 'deal me in' }, lines: ['{"version":"v0.9"}'] }],
  checks: [],
  verdict: 'pass',
}

describe('fixtureFromReport seed', () => {
  it('writes the seed into the fixture and the parser keeps it', () => {
    const seed = personaSeedRecord('croupier', process.cwd())
    expect(seed).toBeDefined()
    const fixture = fixtureFromReport(report, seed)
    expect(fixture.seed).toEqual(seed)
    expect(parseProbeFixture(JSON.stringify(fixture)).seed).toEqual(seed)
  })

  it('omits the seed key when none is given, and rejects a malformed one', () => {
    const fixture = fixtureFromReport(report)
    expect('seed' in fixture).toBe(false)
    expect(() => parseProbeFixture(JSON.stringify({ ...fixture, seed: { version: 1, digest: 'abc' } }))).toThrow(/seed must be/)
  })
})
