// T-0184: the Croupier closed-loop scenarios are well-formed before any credit is spent. Keyless: every
// command parses as a live probe, the ticket's live-commands.sh is exactly the generated script, every game
// in the game-rules pack has a scenario, and every model is one the admin picker offers.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseProbeCli } from '../cli.ts'
import { CROUPIER_MODELS, CROUPIER_SCENARIOS, liveCommandsScript, probeArgv, SAMPLES } from './croupier.ts'

const read = (rel) => readFileSync(new URL(rel, new URL('../../../../', import.meta.url)), 'utf8')
const BLACKJACK_FAMILY = ['blackjack', 'spanish-21', 'pontoon']

describe('croupier closed-loop scenarios', () => {
  const runs = CROUPIER_MODELS.flatMap((m) => Array.from({ length: SAMPLES }, (_, i) => CROUPIER_SCENARIOS.map((s) => ({ s, m, argv: probeArgv(s, m, i + 1) }))).flat())

  it('every run parses as a live probe with its steps, model and expectations', () => {
    for (const { s, m, argv } of runs) {
      const cmd = parseProbeCli(argv)
      expect(cmd.mode).toBe('probe')
      expect(cmd.agent).toBe('croupier')
      expect(cmd.model).toBe(m.id)
      expect(cmd.steps).toEqual(s.steps)
      expect(cmd.expectComponents).toEqual(s.expectComponents)
    }
  })

  it('names and output folders are unique', () => {
    const names = runs.map(({ argv }) => argv[argv.indexOf('--name') + 1])
    const outs = runs.map(({ argv }) => argv[argv.indexOf('--out') + 1])
    expect(new Set(names).size).toBe(runs.length)
    expect(new Set(outs).size).toBe(runs.length)
  })

  it('live-commands.sh is the generated script', () => {
    expect(read('.sdlc/croupier-closed-loop/live-commands.sh')).toBe(liveCommandsScript())
  })

  it('every game in the game-rules pack has a scenario, and the blackjack family expects CardTable', () => {
    const pack = read('site/pages/agent-admin-libraries.ts').split('export const GAMES_RULES')[1].split('\n]\n')[0]
    const games = [...pack.matchAll(/^ {4}label: '([^']+)'/gm)].map((m) => m[1])
    expect(games.length).toBeGreaterThan(0)
    expect([...new Set(CROUPIER_SCENARIOS.map((s) => s.game))].sort()).toEqual([...games].sort())
    for (const s of CROUPIER_SCENARIOS) expect(s.expectComponents).toEqual(BLACKJACK_FAMILY.includes(s.game) ? ['CardTable'] : ['PlayingCard'])
  })

  it('the opening step and every Deal again expect the table component on their own turn (T-0222)', () => {
    for (const s of CROUPIER_SCENARIOS) {
      const deals = s.steps.filter((step, i) => i === 0 || ('click' in step && step.click === 'Deal again'))
      for (const step of deals) expect(step.expect).toEqual(s.expectComponents)
      for (const step of s.steps.filter((step) => !deals.includes(step))) expect(step.expect).toBeUndefined()
    }
  })

  it('every model is in the admin picker', () => {
    const schema = read('packages/agent-ui/app/src/controls/agent-admin/agent-admin-schema.ts')
    for (const m of CROUPIER_MODELS) expect(schema).toContain(`{ id: '${m.id}',`)
  })
})
