// T-0225: live round 2's scenarios are well-formed before any credit is spent. Keyless: every Concierge,
// Lexicographer and Admiral run parses as a live probe with its own steps and per-turn expectations, every
// expected type is in the catalog, every model is in the admin picker, and `.sdlc/live-round-2/live-commands.sh`
// is exactly the generated script, in spend order (Haiku, Sonnet, Opus).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseProbeCli } from '../cli.ts'
import { ADMIRAL_SCENARIOS } from './admiral.ts'
import { CONCIERGE_SCENARIOS } from './concierge.ts'
import { CROUPIER_MODELS, CROUPIER_SCENARIOS } from './croupier.ts'
import { LEXICOGRAPHER_SCENARIOS } from './lexicographer.ts'
import { MODEL_ORDER, ROUND_PRESETS, roundCommandsScript, roundRuns } from './round.ts'

const read = (rel) => readFileSync(new URL(rel, new URL('../../../../', import.meta.url)), 'utf8')
const catalogTypes = (rel) => Object.keys(JSON.parse(read(rel)).types)
const DEFAULT_TYPES = catalogTypes('packages/agent-ui/a2ui/src/catalog/default/selection.json')
const CONCIERGE_TYPES = catalogTypes('packages/agent-ui/a2ui/src/catalog/personas/concierge/selection.json')
const NEW_PRESETS = { concierge: CONCIERGE_SCENARIOS, lexicographer: LEXICOGRAPHER_SCENARIOS, admiral: ADMIRAL_SCENARIOS }

describe('live round 2 scenarios', () => {
  const runs = roundRuns()

  it('every run parses as a live probe with its agent, model, steps and expectations', () => {
    for (const { agent, scenario, model, argv } of runs) {
      const cmd = parseProbeCli(argv)
      expect(cmd.mode).toBe('probe')
      expect(cmd.agent).toBe(agent)
      expect(cmd.model).toBe(model.id)
      expect(cmd.steps).toEqual(scenario.steps)
      expect(cmd.expectComponents).toEqual(scenario.expectComponents)
    }
  })

  it('Croupier runs 8 games on Haiku, Sonnet and Opus 5.5; the other presets 3 scenarios on Haiku and Sonnet', () => {
    expect(CROUPIER_SCENARIOS).toHaveLength(8)
    expect(CROUPIER_MODELS.map((m) => m.id)).toEqual(['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'])
    for (const [agent, scenarios] of Object.entries(NEW_PRESETS)) {
      expect(scenarios).toHaveLength(3)
      expect(ROUND_PRESETS.find((p) => p.agent === agent).models.map((m) => m.id)).toEqual(['claude-haiku-5-5', 'claude-sonnet-5-5'])
    }
    expect(runs).toHaveLength(8 * 3 + 3 * 3 * 2)
  })

  it('each new scenario has 4 to 8 steps, its opening step expects a composite, and every expected type is in the catalog', () => {
    for (const [agent, scenarios] of Object.entries(NEW_PRESETS)) {
      const known = agent === 'concierge' ? [...DEFAULT_TYPES, ...CONCIERGE_TYPES] : DEFAULT_TYPES
      for (const s of scenarios) {
        expect(s.steps.length).toBeGreaterThanOrEqual(4)
        expect(s.steps.length).toBeLessThanOrEqual(8)
        expect(s.steps[0].expect?.length).toBeGreaterThan(0)
        for (const type of [...s.steps.flatMap((step) => step.expect ?? []), ...s.expectComponents]) expect(known).toContain(type)
      }
    }
  })

  it('the Concierge measures BookingForm, BookingConfirmation and ServiceCard; the games measure BoardGrid and ResultCard', () => {
    const turnTypes = (scenarios) => new Set(scenarios.flatMap((s) => s.steps.flatMap((step) => step.expect ?? [])))
    expect([...turnTypes(CONCIERGE_SCENARIOS)].sort()).toEqual(['BookingConfirmation', 'BookingForm', 'ServiceCard'])
    for (const scenarios of [LEXICOGRAPHER_SCENARIOS, ADMIRAL_SCENARIOS]) expect([...turnTypes(scenarios)].sort()).toEqual(['BoardGrid', 'ResultCard'])
  })

  it('names and output folders are unique and follow runs/<preset>-<scenario>-<model>-1', () => {
    const names = runs.map(({ argv }) => argv[argv.indexOf('--name') + 1])
    const outs = runs.map(({ argv }) => argv[argv.indexOf('--out') + 1])
    expect(new Set(names).size).toBe(runs.length)
    for (const { agent, scenario, model, argv } of runs) expect(argv[argv.indexOf('--out') + 1]).toBe(`.sdlc/live-round-2/runs/${agent}-${scenario.name}-${model.short}-1`)
    expect(new Set(outs).size).toBe(runs.length)
  })

  it('runs go Haiku, then Sonnet, then Opus', () => {
    const order = runs.map(({ model }) => MODEL_ORDER.indexOf(model.short))
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(order.every((i) => i >= 0)).toBe(true)
  })

  it('every model is in the admin picker', () => {
    const schema = read('packages/agent-ui/app/src/controls/agent-admin/agent-admin-schema.ts')
    for (const p of ROUND_PRESETS) for (const m of p.models) expect(schema).toContain(`{ id: '${m.id}',`)
  })

  it('every preset id is a shipped preset', () => {
    const presets = read('site/pages/agent-admin-presets.ts')
    for (const p of ROUND_PRESETS) expect(presets).toMatch(new RegExp(`^ {4}id: '${p.agent}',`, 'm'))
  })

  it('.sdlc/live-round-2/live-commands.sh is the generated script', () => {
    expect(read('.sdlc/live-round-2/live-commands.sh')).toBe(roundCommandsScript())
  })
})
