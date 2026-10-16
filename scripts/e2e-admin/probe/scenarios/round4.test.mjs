// T-0275: live round 4 is well-formed before any credit is spent. Keyless: the reruns are exactly round 3's failed
// runs on the same model, regenerated from the current generators; the long flows run on Haiku and Sonnet with the
// T-0266, T-0267, T-0268 and T-0274 oracles; runs go Haiku then Sonnet then Opus; and `live-commands.sh` is exactly
// the generated script, which the capped runner describes.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseProbeCli } from '../cli.ts'
import { describeCommands } from '../run-capped.ts'
import { round3Runs } from './round3.ts'
import { R3_FAILED, ROUND4_DIR, ROUND4_FILE, ROUND4_LONG_FLOWS, round4CommandsScript, round4Runs } from './round4.ts'

const root = new URL('../../../../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, root), 'utf8')
const R3_LEDGER = '.sdlc/evals/rounds/2026-10-15-r3-routing/ledger.jsonl'

describe('live round 4', () => {
  const runs = round4Runs()

  it('31 reruns and 6 long flows', () => {
    expect(runs.filter((r) => r.part === 'rerun')).toHaveLength(31)
    expect(runs.filter((r) => r.part === 'long')).toHaveLength(6)
  })

  it('the reruns are exactly the round 3 ledger fails, same model, with the current round 3 argv', () => {
    const ledger = read(R3_LEDGER).trim().split('\n').map((l) => JSON.parse(l))
    const failed = ledger.filter((r) => r.verdict === 'fail')
    expect(R3_FAILED).toEqual(failed.map((r) => r.name))
    const r3 = new Map(round3Runs().map((r) => [r.name, r]))
    for (const run of runs.filter((r) => r.part === 'rerun')) {
      expect(run.model.id).toBe(failed.find((r) => r.name === run.name).model)
      const strip = (argv) => argv.filter((a, i) => a !== '--out' && argv[i - 1] !== '--out')
      expect(strip(run.argv)).toEqual(strip(r3.get(run.name).argv))
    }
  })

  it('every run parses as a live probe on its agent and model, out under the round folder', () => {
    for (const { agent, model, name, argv } of runs) {
      const cmd = parseProbeCli(argv)
      expect(cmd.mode).toBe('probe')
      expect(cmd.agent).toBe(agent)
      expect(cmd.model).toBe(model.id)
      expect(cmd.name).toBe(name)
      expect(argv[argv.indexOf('--out') + 1]).toBe(`${ROUND4_DIR}/runs/${name}`)
    }
    expect(new Set(runs.map((r) => r.name)).size).toBe(runs.length)
  })

  it('the long flows carry the fix oracles on Haiku and Sonnet', () => {
    const flow = (name) => ROUND4_LONG_FLOWS.find((f) => f.scenario.name === name).scenario
    expect(flow('booking-confirm').steps.flatMap((s) => s.expect ?? [])).toEqual(['BookingForm', 'BookingConfirmation'])
    expect(flow('booking-confirm').steps[0].expectRouting.exemplars).toEqual({ include: ['domain-concierge-booking-request'] })
    expect(flow('spa-services').steps[0].expect).toEqual(['ServiceCard'])
    const game = flow('game-give-up').steps
    expect(game[0].expectRouting.exemplars).toEqual({ include: ['domain-lexicographer-word-board'] })
    expect(game.find((s) => s.say === 'I give up.').expectRouting.exemplars).toEqual({ include: ['domain-lexicographer-game-over'] })
    expect(game.find((s) => s.say === 'I give up.').expect).toEqual(['ResultCard'])
    for (const f of ROUND4_LONG_FLOWS) {
      expect(runs.filter((r) => r.part === 'long' && r.name.startsWith(`long-${f.agent}-${f.scenario.name}-`)).map((r) => r.model.short)).toEqual(['haiku', 'sonnet'])
    }
  })

  it('runs go Haiku, then Sonnet, then Opus', () => {
    const order = ['haiku', 'sonnet', 'opus']
    const seen = runs.map((r) => order.indexOf(r.model.short))
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
  })

  it('live-commands.sh is the generated script, and the capped runner describes every run keyless', () => {
    const text = read(ROUND4_FILE)
    expect(text).toBe(round4CommandsScript())
    expect(text).toContain('run-capped.ts .sdlc/evals/rounds/2026-10-15-r4-fixes/live-commands.sh --cap 15 --round r4-fixes')
    const described = describeCommands(text)
    expect(described).toHaveLength(37)
    expect(described.at(-1)).toBe('long-concierge-booking-opus-1: concierge on claude-opus-5-5, 5 steps, 4 --expect-turn, 1 --expect-routing')
  })
})
