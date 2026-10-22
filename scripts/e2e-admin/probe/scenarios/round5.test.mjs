// T-0287: live round 5 is well-formed before any credit is spent. Keyless: the reruns are exactly round 4's failed
// runs on the same model, regenerated from the current generators; the long flows run on Haiku and Sonnet, with the
// T-0285 facility-hours flow added and no run twice; runs go Haiku then Sonnet then Opus; and `live-commands.sh` is
// exactly the generated script, which the capped runner describes.
import { readFileSync } from 'node:fs'
import { asArchivedBookingConfirmation } from './concierge.ts'
import { withoutSkipMarks } from './croupier.ts'
import { asArchivedConciergeDomain } from './routing.ts'
import { describe, expect, it } from 'vitest'
import { parseProbeCli } from '../cli.ts'
import { describeCommands } from '../run-capped.ts'
import { round4Runs } from './round4.ts'
import { R4_FAILED, ROUND5_DIR, ROUND5_FILE, ROUND5_LONG_FLOWS, round5CommandsScript, round5Runs } from './round5.ts'

const root = new URL('../../../../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, root), 'utf8')
const R4_LEDGER = '.sdlc/evals/rounds/2026-10-15-r4-fixes/ledger.jsonl'

describe('live round 5', () => {
  const runs = round5Runs()

  it('26 reruns and 3 long flows not already rerun', () => {
    expect(runs.filter((r) => r.part === 'rerun')).toHaveLength(26)
    expect(runs.filter((r) => r.part === 'long').map((r) => r.name)).toEqual([
      'long-concierge-facility-hours-haiku-1',
      'long-lexicographer-game-give-up-sonnet-1',
      'long-concierge-facility-hours-sonnet-1',
    ])
  })

  it('the reruns are exactly the round 4 ledger fails, same model, with the current round 4 argv', () => {
    const ledger = read(R4_LEDGER).trim().split('\n').map((l) => JSON.parse(l))
    const failed = ledger.filter((r) => r.verdict === 'fail')
    expect(R4_FAILED).toEqual(failed.map((r) => r.name))
    const r4 = new Map(round4Runs().map((r) => [r.name, r]))
    for (const run of runs.filter((r) => r.part === 'rerun')) {
      expect(run.model.id).toBe(failed.find((r) => r.name === run.name).model)
      const strip = (argv) => argv.filter((a, i) => a !== '--out' && argv[i - 1] !== '--out')
      expect(strip(run.argv)).toEqual(strip(r4.get(run.name).argv))
    }
  })

  it('every run parses as a live probe on its agent and model, out under the round folder', () => {
    for (const { agent, model, name, argv } of runs) {
      const cmd = parseProbeCli(argv)
      expect(cmd.mode).toBe('probe')
      expect(cmd.agent).toBe(agent)
      expect(cmd.model).toBe(model.id)
      expect(cmd.name).toBe(name)
      expect(argv[argv.indexOf('--out') + 1]).toBe(`${ROUND5_DIR}/runs/${name}`)
    }
    expect(new Set(runs.map((r) => r.name)).size).toBe(runs.length)
  })

  it('every long flow runs on Haiku and Sonnet, as a rerun or a long run', () => {
    for (const f of ROUND5_LONG_FLOWS) {
      expect(runs.filter((r) => r.name.startsWith(`long-${f.agent}-${f.scenario.name}-`)).map((r) => r.model.short).sort()).toEqual(['haiku', 'sonnet'])
    }
  })

  it('the facility-hours flow carries the T-0285 compact info card oracle, never ServiceCard', () => {
    const flow = ROUND5_LONG_FLOWS.find((f) => f.scenario.name === 'facility-hours').scenario
    expect(flow.steps[0].expect).toEqual(['DescriptionList'])
    expect(flow.steps[0].expectRouting.references).toEqual([{ name: 'property-knowledge-base', load: 'full' }])
    expect(JSON.stringify(flow)).not.toContain('ServiceCard')
  })

  it('runs go Haiku, then Sonnet, then Opus', () => {
    const order = ['haiku', 'sonnet', 'opus']
    const seen = runs.map((r) => order.indexOf(r.model.short))
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
  })

  it('live-commands.sh is the generated script, and the capped runner describes every run keyless', () => {
    const text = read(ROUND5_FILE)
    expect(text).toBe(withoutSkipMarks(asArchivedBookingConfirmation(asArchivedConciergeDomain(round5CommandsScript()))))
    expect(text).toContain('run-capped.ts .sdlc/evals/rounds/2026-10-15-r5-fixes/live-commands.sh --cap 15 --round r5-fixes')
    const described = describeCommands(text)
    expect(described).toHaveLength(29)
    expect(described.at(-1)).toBe('long-concierge-booking-opus-1: concierge on claude-opus-5-5, 5 steps, 4 --expect-turn, 1 --expect-routing')
  })

  it('every spa booking ask names one treatment, the Swedish massage', () => {
    const asks = round5CommandsScript().match(/Book a [^"]*massage[^"]*/g) ?? []
    expect(asks.length).toBeGreaterThan(0)
    for (const ask of asks) expect(ask).toContain('60-minute Swedish massage')
  })
})
