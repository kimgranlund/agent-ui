// T-0294: live round 6 is well-formed before any credit is spent. Keyless: every preset round scenario, every routing
// pack scenario and every long flow runs once on each of Haiku, Sonnet and Opus; runs go Haiku then Sonnet then Opus,
// so the $20 cap drops Opus first; and `live-commands.sh` is exactly the generated script, which the capped runner
// describes.
import { readFileSync } from 'node:fs'
import { asArchivedBookingConfirmation } from './concierge.ts'
import { withoutSkipMarks } from './croupier.ts'
import { describe, expect, it } from 'vitest'
import { parseProbeCli } from '../cli.ts'
import { describeCommands } from '../run-capped.ts'
import { ROUND_PRESETS } from './round.ts'
import { ROUND6_DIR, ROUND6_FILE, ROUND6_LONG_FLOWS, round6CommandsScript, round6Runs } from './round6.ts'
import { ROUTING_SCENARIOS, asArchivedConciergeDomain, asArchivedGuidanceConflict } from './routing.ts'

const root = new URL('../../../../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, root), 'utf8')
const MODELS = ['haiku', 'sonnet', 'opus']

describe('live round 6', () => {
  const runs = round6Runs()
  const names = new Set(runs.map((r) => r.name))
  const shorts = (prefix) => MODELS.filter((m) => names.has(`${prefix}${m}-1`))

  it('29 scenarios on three models: 17 preset, 6 routing, 6 long', () => {
    expect(runs).toHaveLength(87)
    expect(runs.filter((r) => r.part === 'preset')).toHaveLength(51)
    expect(runs.filter((r) => r.part === 'routing')).toHaveLength(18)
    expect(runs.filter((r) => r.part === 'long')).toHaveLength(18)
    for (const m of MODELS) expect(runs.filter((r) => r.model.short === m)).toHaveLength(29)
  })

  it('every preset round scenario, routing scenario and long flow runs once on each model', () => {
    for (const p of ROUND_PRESETS) for (const s of p.scenarios) expect(shorts(`regress-${p.agent}-${s.name}-`)).toEqual(MODELS)
    for (const s of ROUTING_SCENARIOS) expect(shorts(`routing-${s.name}-`)).toEqual(MODELS)
    expect(ROUND6_LONG_FLOWS.map((f) => f.scenario.name)).toEqual(['blackjack-hand', 'booking', 'booking-confirm', 'spa-services', 'game-give-up', 'facility-hours'])
    for (const f of ROUND6_LONG_FLOWS) expect(shorts(`long-${f.agent}-${f.scenario.name}-`)).toEqual(MODELS)
  })

  it("every preset run carries round 3's routing oracle but dinner-at-vela, whose table ask is not a `Book ` ask", () => {
    const bare = runs.filter((x) => x.part === 'preset' && !x.argv.includes('--expect-routing')).map((r) => r.name)
    expect(bare).toEqual(MODELS.map((m) => `regress-concierge-dinner-at-vela-${m}-1`))
  })

  it('every run parses as a live probe on its agent and model, out under the round folder', () => {
    for (const { agent, model, name, argv } of runs) {
      const cmd = parseProbeCli(argv)
      expect(cmd.mode).toBe('probe')
      expect(cmd.agent).toBe(agent)
      expect(cmd.model).toBe(model.id)
      expect(cmd.name).toBe(name)
      expect(argv[argv.indexOf('--out') + 1]).toBe(`${ROUND6_DIR}/runs/${name}`)
    }
    expect(new Set(runs.map((r) => r.name)).size).toBe(runs.length)
  })

  it('runs go Haiku, then Sonnet, then Opus', () => {
    const seen = runs.map((r) => MODELS.indexOf(r.model.short))
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
  })

  it('live-commands.sh is the generated script, and the capped runner describes every run keyless', () => {
    const text = read(ROUND6_FILE)
    expect(text).toBe(withoutSkipMarks(asArchivedBookingConfirmation(asArchivedConciergeDomain(asArchivedGuidanceConflict(round6CommandsScript())))))
    expect(text).toContain('run-capped.ts .sdlc/evals/rounds/2026-10-15-r6-matrix/live-commands.sh --cap 20 --round r6-matrix')
    const described = describeCommands(text)
    expect(described).toHaveLength(87)
    expect(described.at(-1)).toMatch(/^long-concierge-facility-hours-opus-1: concierge on claude-opus-5-5, /)
  })

  it('every spa booking ask names one treatment, the Swedish massage', () => {
    const asks = round6CommandsScript().match(/Book a [^"]*massage[^"]*/g) ?? []
    expect(asks.length).toBeGreaterThan(0)
    for (const ask of asks) expect(ask).toContain('60-minute Swedish massage')
  })
})
