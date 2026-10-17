// T-0184: the Croupier closed-loop scenarios are well-formed before any credit is spent. Keyless: every
// command parses as a live probe, the ticket's live-commands.sh is exactly the generated script, every game
// in the game-rules pack has a scenario, and every model is one the admin picker offers.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
// T-0160: the game-rules pack is a pack.json of refs; read its entries through the agent-content registry.
import { AGENT_CONTENT } from '../../../../site/agent-content/registry.gen.ts'
import { parseProbeCli } from '../cli.ts'
import { CROUPIER_MODELS, CROUPIER_ROUND_SCENARIOS, CROUPIER_SCENARIOS, liveCommandsScript, probeArgv, SAMPLES, STUD_STREET } from './croupier.ts'

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
    expect(read('.sdlc/evals/rounds/2026-10-14-r1-croupier/live-commands.sh')).toBe(liveCommandsScript())
  })

  it('every game in the game-rules pack has a scenario, and the blackjack family expects CardTable', () => {
    const pack = AGENT_CONTENT.find((r) => r.kind === 'pack' && r.id === 'game-rules')
    const games = pack.frontmatter.entries.map((ref) => {
      const id = ref.split('@')[0]
      return AGENT_CONTENT.find((r) => r.kind === 'resource' && r.id === id && r.scope === undefined).frontmatter.label
    })
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

// T-0283: live round 4 (regress-croupier-seven-card-stud-opus-1, traces :206-:212). Opus settled the hand on the fourth
// check, read the spare sixth as "deal again" and opened round 2 in prose, so Deal again found no button.
describe('the live-round seven-card stud steps fit its five betting rounds (T-0283)', () => {
  const stud = CROUPIER_ROUND_SCENARIOS.find((s) => s.name === 'seven-card-stud').steps

  it('round 1 is the opening, one step per betting round, then Deal again', () => {
    const deal = stud.findIndex((step) => step.click === 'Deal again')
    expect(deal).toBe(6)
    expect(stud.slice(1, deal)).toEqual(Array.from({ length: 5 }, () => ({ say: STUD_STREET })))
  })

  it('each street step leaves a finished hand on the table, so a hand settled early still reaches Deal again', () => {
    expect(STUD_STREET).toMatch(/^Check, or call if there is a bet\./)
    expect(STUD_STREET).toMatch(/If the hand is already over, leave the table as it is\./)
  })
})

// T-0325: live round 8 (regress-croupier-texas-holdem-opus-1, :411-:412). The dealer folded to "Bet 50." and the hand
// ended; the scripted "Check, or call" then made Opus deal round 2, so the later Deal again found Check, Bet and Fold.
describe('the live-round texas-holdem steps assume no showdown (T-0325)', () => {
  const holdem = CROUPIER_ROUND_SCENARIOS.find((s) => s.name === 'texas-holdem').steps
  const ENDS_HAND = /^(?:bet|raise|fold)\b/i

  it('every step after a move that can end the hand is Deal again or a street harmless on a finished hand', () => {
    const after = holdem.flatMap((step, i) => (typeof step.say === 'string' && ENDS_HAND.test(step.say) && i + 1 < holdem.length ? [holdem[i + 1]] : []))
    expect(after.length).toBe(3) // anti-vacuity: Bet 50, Fold and Raise 100
    for (const step of after) expect(step.click === 'Deal again' || step.say === STUD_STREET, JSON.stringify(step)).toBe(true)
  })

  it('round 1 still plays four betting rounds before Deal again, and the frozen T-0184 script keeps its steps', () => {
    expect(holdem.findIndex((step) => step.click === 'Deal again')).toBe(5)
    expect(holdem.slice(1, 5).map((step) => step.say)).toEqual(['Check, or call if there is a bet.', 'Bet 50.', STUD_STREET, STUD_STREET])
    expect(CROUPIER_SCENARIOS.find((s) => s.name === 'texas-holdem').steps.map((step) => step.say ?? step.click)).toContain('Check, or call if there is a bet.')
  })
})
