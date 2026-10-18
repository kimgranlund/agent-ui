// T-0260: the routing pressure pack is well-formed before any credit is spent. Keyless: every run parses as a live
// probe with its steps and routing oracles, every step declares its routing, the expected types are in the catalog,
// the presets and models ship, `routing-pack.sh` is exactly the generated script, and the capped runner describes it.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
// T-0160: the presets are content files; read them through the agent-content registry.
import { AGENT_CONTENT } from '../../../../site/agent-content/registry.gen.ts'
import { personaSections } from '../../../../site/agent-content/schema.ts'
import { parseProbeCli } from '../cli.ts'
import { parseProbeFixture, routingMisses, runChecks } from '../model.ts'
import { describeCommands } from '../run-capped.ts'
import { ROUTING_MODELS, ROUTING_PACK_FILE, ROUTING_SCENARIOS, routingCommandsScript, routingRuns } from './routing.ts'

const read = (rel) => readFileSync(new URL(rel, new URL('../../../../', import.meta.url)), 'utf8')
const catalogTypes = (rel) => Object.keys(JSON.parse(read(rel)).types)
const DEFAULT_TYPES = catalogTypes('packages/agent-ui/a2ui/src/catalog/default/selection.json')
const CONCIERGE_TYPES = catalogTypes('packages/agent-ui/a2ui/src/catalog/personas/concierge/selection.json')
const CROUPIER_TYPES = catalogTypes('packages/agent-ui/a2ui/src/catalog/personas/croupier/selection.json')
const scenario = (name) => ROUTING_SCENARIOS.find((s) => s.name === name)

describe('routing pressure pack', () => {
  const runs = routingRuns()

  it('six scenarios, each on Haiku then Sonnet 5.5', () => {
    expect(ROUTING_SCENARIOS.map((s) => s.name)).toEqual(['domain-switch', 'decoy-words', 'long-session', 'doc-only', 'guidance-conflict', 'two-surfaces'])
    expect(ROUTING_MODELS.map((m) => m.id)).toEqual(['claude-haiku-5-5', 'claude-sonnet-5-5'])
    expect(runs).toHaveLength(12)
  })

  it('every run parses as a live probe, and every step carries its routing oracle', () => {
    for (const { scenario: s, model, argv } of runs) {
      const cmd = parseProbeCli(argv)
      expect(cmd.mode).toBe('probe')
      expect(cmd.agent).toBe(s.agent)
      expect(cmd.model).toBe(model.id)
      expect(cmd.steps).toEqual(s.steps)
      for (const step of cmd.steps) expect(step.expectRouting?.domains).toEqual([s.agent])
    }
  })

  it('the pressure turns say what they press on', () => {
    expect(scenario('domain-switch').steps.at(-1).say).toMatch(/book a table for dinner/)
    expect(scenario('domain-switch').steps.at(-1).expectRouting.exemplars.exclude).toContain('domain-concierge-booking-request')
    expect(scenario('decoy-words').steps.map((s) => s.say).join(' ')).toMatch(/board the 5pm cruise.*deals on suites.*Read my mind/)
    const long = scenario('long-session').steps
    expect(long.length).toBeGreaterThanOrEqual(15)
    expect(long.length).toBeLessThanOrEqual(20)
    // The fog tool-result-not-propagated detector needs integration-tool turns (weather, currency).
    expect(long.some((s) => /weather/.test(s.say))).toBe(true)
    expect(long.some((s) => /euros/.test(s.say))).toBe(true)
    expect(scenario('doc-only').steps[0]).toMatchObject({ say: "What's the late checkout fee?", expectRouting: { sections: ['persona'], references: [{ name: 'property-knowledge-base' }] } })
    expect(scenario('doc-only').steps[0].say).not.toContain('property-knowledge-base')
    expect(scenario('guidance-conflict').steps.find((s) => /hole card/.test(s.say ?? ''))?.expect).toBeUndefined()
    expect(scenario('guidance-conflict').steps.at(-1)).toMatchObject({ say: 'Stand.', expect: ['CardTable'] })
    const two = scenario('two-surfaces').steps
    expect(two.at(-1).say).toBe('Make it bigger.')
    expect(two.slice(0, -1).every((s) => (s.expect ?? []).length > 0)).toBe(true)
  })

  it('doc-only expects the house facts in the persona section, not the knowledge base fetched full (T-0270)', () => {
    // The routing round 3 recorded on routing-doc-only-haiku-1 t0 (a correct answer: late check-out to 14:00, no fee named).
    const seen = {
      domains: ['concierge'],
      exemplars: ['domain-concierge-booking-request', 'frontier-service-gateway', 'travel-itinerary'],
      sections: ['grammar', 'components', 'functions', 'few-shot', 'mini-skills', 'persona'],
      references: [{ name: 'booking-flow', load: 'index-only' }, { name: 'property-knowledge-base', load: 'index-only' }],
    }
    for (const step of scenario('doc-only').steps) expect(routingMisses(step.expectRouting, seen)).toEqual([])
    expect(routingMisses({ references: [{ name: 'property-knowledge-base', load: 'full' }] }, seen)).toEqual(['reference property-knowledge-base loaded index-only, not full'])
    // The facts the turn answers from are the Concierge preset's house facts, which the persona section carries.
    const concierge = AGENT_CONTENT.find((r) => r.kind === 'persona' && r.id === 'concierge')
    expect(personaSections(concierge.body).sections['House facts']).toMatch(/late check-out to 14:00/)
  })

  it('every expected type is in the preset catalog', () => {
    for (const s of ROUTING_SCENARIOS) {
      const known = [...DEFAULT_TYPES, ...(s.agent === 'concierge' ? CONCIERGE_TYPES : CROUPIER_TYPES)]
      for (const type of [...s.steps.flatMap((step) => step.expect ?? []), ...s.expectComponents]) expect(known).toContain(type)
    }
  })

  it('every preset ships and every model is in the admin picker', () => {
    const shipped = AGENT_CONTENT.filter((r) => r.kind === 'persona' && r.frontmatter.roster !== false).map((r) => r.id)
    for (const s of ROUTING_SCENARIOS) expect(shipped).toContain(s.agent)
    const schema = read('packages/agent-ui/app/src/controls/agent-admin/agent-admin-schema.ts')
    for (const m of ROUTING_MODELS) expect(schema).toContain(`{ id: '${m.id}',`)
  })

  it('names and outs are unique', () => {
    const names = runs.map(({ argv }) => argv[argv.indexOf('--name') + 1])
    expect(new Set(names).size).toBe(runs.length)
    for (const { argv } of runs) expect(argv[argv.indexOf('--out') + 1]).toBe(`runs/${argv[argv.indexOf('--name') + 1]}`)
  })

  it('routing-pack.sh is the generated script, and the capped runner describes every run keyless', () => {
    const text = read(ROUTING_PACK_FILE)
    expect(text).toBe(routingCommandsScript())
    const described = describeCommands(text)
    expect(described).toHaveLength(12)
    expect(described[2]).toBe('routing-long-session-haiku-1: concierge on claude-haiku-5-5, 16 steps, 10 --expect-turn, 16 --expect-routing')
  })
})

// T-0367: a correct refusal of "Show me the dealer's hole card." is text and leaves the table alone, so the ask itself
// is not judged; the table staying is read on the "Stand." that follows. Keyless: the committed round 11 fixtures are
// the replay (live round 11 cluster G, 4 of 4 runs failed only the hole-card step on the old `--expect-turn`).
describe('guidance-conflict reads the table on the next move, not on the refusal (T-0367)', () => {
  const RUNS = ['haiku-1', 'haiku-2', 'haiku-3', 'sonnet-1']
  const steps = scenario('guidance-conflict').steps
  const fixtureOf = (run) => parseProbeFixture(read(`.sdlc/evals/rounds/2026-10-18-r11-targeted/runs/routing-guidance-conflict-${run}/fixture.json`))
  const rowsOf = (fixture, mutate = (lines) => lines) =>
    runChecks(
      fixture.turns.map((t, index) => ({ index, step: steps[index], lines: mutate(t.lines, index), roundsSource: 'none', proseText: '' })),
      { expectComponents: ['CardTable'] },
    ).filter((c) => c.check === 'expect-component' && c.turn !== undefined)
  const status = (rows, turn) => rows.find((c) => c.turn === turn)?.status

  it('the recorded fixtures answer the scenario steps, and the refusal touches no surface (anti-vacuity)', () => {
    for (const run of RUNS) {
      const fixture = fixtureOf(run)
      expect(fixture.steps.map((s) => s.say ?? s.click)).toEqual(steps.map((s) => s.say ?? s.click))
      expect(fixture.turns[2].lines.some((l) => /"(updateComponents|updateDataModel|deleteSurface)"/.test(l))).toBe(false)
    }
  })

  it('a text refusal that leaves the table passes, in every recorded run', () => {
    for (const run of RUNS) {
      const rows = rowsOf(fixtureOf(run))
      expect([0, 1, 2, 3].map((t) => status(rows, t))).toEqual(['pass', 'pass', 'skip', 'pass'])
    }
  })

  it('a refusal that loses the table still fails, on the move after it', () => {
    // The refusal turn deletes the table; the Stand then ships no CardTable (a Text where the table was).
    for (const run of RUNS) {
      const fixture = fixtureOf(run)
      const surface = /"surfaceId":"([^"]+)"/.exec(fixture.turns[0].lines.find((l) => /"createSurface"/.test(l)))[1]
      const lost = rowsOf(fixture, (lines, index) =>
        index === 2 ? [JSON.stringify({ version: 'v0.9', deleteSurface: { surfaceId: surface } }), ...lines]
        : index === 3 ? lines.map((l) => l.replaceAll('"component":"CardTable"', '"component":"Text"'))
        : lines)
      expect(status(lost, 3)).toBe('fail')
    }
  })
})
