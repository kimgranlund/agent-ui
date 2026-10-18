// T-0347: a natural settles the hand on the deal, so the scripted in-hand steps after the bet have no button (live
// round 10 cluster D: regress-croupier-blackjack-rounds-haiku-3 :80, regress-croupier-pontoon-haiku-1 :101 to :103).
// The agent was right; the probe skips those steps. Keyless: the committed round 10 fixtures are the replay. Each
// recorded turn answers the step at its index, so a pure walk over the scenario's steps (the skip rule, fed the
// recorded wire lines) shows which steps the probe would now play.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseProbeCli } from './cli.ts'
import { newestTablePhase, parseProbeFixture, stepArgv, stepSkip, TablePhase } from './model.ts'
import { CROUPIER_ROUND_SCENARIOS, CROUPIER_SCENARIOS, TWIST_TO_STICK } from './scenarios/croupier.ts'
import { round3Argv } from './scenarios/round3.ts'
import { roundArgv } from './scenarios/round.ts'
import { routingArgv } from './scenarios/routing.ts'

const R10 = new URL('../../../.sdlc/evals/rounds/2026-10-17-r10-targeted/runs/', import.meta.url)
const fixtureOf = (run) => parseProbeFixture(readFileSync(new URL(`${run}/fixture.json`, R10), 'utf8'))
const label = (step) => step.say ?? step.click
/** The newest table's phase after the first `n` recorded turns. */
const phaseAfter = (fixture, n) => newestTablePhase(fixture.turns.slice(0, n).flatMap((t) => t.lines))

/** The indexes of the scenario steps the rule skips when the recorded turns answer the steps that play. */
function walk(steps, fixture) {
  const table = new TablePhase()
  const skipped = []
  const played = []
  steps.forEach((step, i) => {
    if (stepSkip(step, table.phase())) return skipped.push(i)
    played.push(i)
    table.feed(fixture.turns[i]?.lines ?? [])
  })
  return { skipped, played }
}

describe('the live-round blackjack-family steps skip a hand a natural settled (T-0347)', () => {
  const stepsOf = (name) => CROUPIER_ROUND_SCENARIOS.find((s) => s.name === name).steps

  it('blackjack-rounds-haiku-3 (:80): the Stand after the natural on the third deal is skipped', () => {
    const fixture = fixtureOf('regress-croupier-blackjack-rounds-haiku-3')
    const steps = stepsOf('blackjack-rounds')
    expect(steps.map(label)).toEqual(fixture.steps.map(label)) // the recorded turns answer these steps
    expect(phaseAfter(fixture, 9)).toBe('settled') // anti-vacuity: the natural is in the data
    const { skipped } = walk(steps, fixture)
    expect(skipped).toContain(9)
    expect(skipped.every((i) => i === 6 || i === 9)).toBe(true) // 6: the Stand after the hand that busted on its Hit
  })

  it('pontoon-haiku-1 (:101 to :103): Buy a card and Stick after the natural are skipped', () => {
    const fixture = fixtureOf('regress-croupier-pontoon-haiku-1')
    // The third hand was never recorded; T-0370's follow-up step postdates this finished run, so it is not one of its steps.
    const steps = stepsOf('pontoon').filter((step) => step.say !== TWIST_TO_STICK).slice(0, fixture.steps.length)
    expect(steps.map(label)).toEqual(fixture.steps.map(label))
    expect(phaseAfter(fixture, 6)).toBe('settled')
    expect(walk(steps, fixture).skipped).toEqual([6, 7])
  })

  it('a table that is not settled skips nothing: the first two hands of :80 and the first hand of :101', () => {
    const blackjack = fixtureOf('regress-croupier-blackjack-rounds-haiku-3')
    expect(walk(stepsOf('blackjack-rounds').slice(0, 6), blackjack).skipped).toEqual([])
    const pontoon = fixtureOf('regress-croupier-pontoon-haiku-1')
    expect(walk(stepsOf('pontoon').slice(0, 5), pontoon).skipped).toEqual([])
  })

  it('the frozen T-0184 steps carry no skip', () => {
    for (const s of CROUPIER_SCENARIOS) expect(s.steps.some((step) => step.skipIfPhase !== undefined), s.name).toBe(false)
  })

  it('every skip is on an in-hand step of a blackjack-family scenario, never the opening, a bet, Deal again or the post-bust hit', () => {
    const marked = CROUPIER_ROUND_SCENARIOS.filter((s) => s.steps.some((step) => step.skipIfPhase !== undefined)).map((s) => s.name)
    expect(marked.sort()).toEqual(['blackjack-moves', 'blackjack-rounds', 'pontoon', 'spanish-21'])
    for (const s of CROUPIER_ROUND_SCENARIOS) {
      s.steps.forEach((step, i) => {
        if (i === 0 || step.click === 'Deal again' || /^\d+$/.test(step.click ?? '') || step.say === 'Hit me again.') expect(step.skipIfPhase, `${s.name}[${i}]`).toBeUndefined()
      })
    }
  })

  it('every builder of probe argv carries the flag, so a round built from these scenarios plays the skip', () => {
    const scenario = CROUPIER_ROUND_SCENARIOS.find((s) => s.name === 'pontoon')
    const model = { id: 'claude-haiku-5-5', short: 'haiku' }
    const flags = (argv) => argv.filter((a, i) => argv[i - 1] === '--skip-if-phase' || a === '--skip-if-phase')
    const expected = scenario.steps.filter((s) => s.skipIfPhase !== undefined).length * 2
    expect(expected).toBeGreaterThan(0)
    expect(flags(roundArgv('croupier', scenario, model))).toHaveLength(expected)
    expect(flags(round3Argv('croupier', scenario, model, 'x'))).toHaveLength(expected)
    expect(flags(routingArgv({ ...scenario, agent: 'croupier', name: 'x' }, model))).toHaveLength(expected)
    expect(stepArgv({ click: 'Stand', skipIfPhase: 'settled', expect: ['CardTable'] })).toEqual(['--click', 'Stand', '--expect-turn', 'CardTable', '--skip-if-phase', 'settled'])
  })
})

describe('stepSkip', () => {
  it('skips a marked step exactly while the newest table is in the marked phase, however it got there', () => {
    const marked = { click: 'Stand', skipIfPhase: 'settled' }
    expect(stepSkip(marked, 'settled')).toBe(true)
    expect(stepSkip(marked, 'playing')).toBe(false)
    expect(stepSkip(marked, undefined)).toBe(false)
    expect(stepSkip({ click: 'Deal again' }, 'settled')).toBe(false)
  })
})

describe('TablePhase', () => {
  const msg = (m) => JSON.stringify({ version: 'v1.0', ...m })
  const create = (id) => msg({ createSurface: { surfaceId: id, catalogId: 'c' } })
  const data = (id, value, path) => msg({ updateDataModel: { surfaceId: id, value, ...(path ? { path } : {}) } })
  const table = (id, phase, compId = 'root') => msg({ updateComponents: { surfaceId: id, components: [{ id: compId, component: 'CardTable', ...(phase === undefined ? {} : { phase }) }] } })
  const other = (id) => msg({ updateComponents: { surfaceId: id, components: [{ id: 'root', component: 'Card' }] } })

  it('reads a literal phase, a bound phase, and nested bound paths', () => {
    expect(newestTablePhase([])).toBeUndefined()
    expect(newestTablePhase([create('t'), table('t', 'settled')])).toBe('settled')
    expect(newestTablePhase([create('t'), table('t', { path: '/phase' }), data('t', { phase: 'betting' })])).toBe('betting')
    expect(newestTablePhase([create('t'), table('t', { path: '/table/phase' }), data('t', { table: { phase: 'settled' } })])).toBe('settled')
    expect(newestTablePhase([create('t'), table('t', { path: '/table/phase' }), data('t', { table: { phase: 'betting' } }), data('t', 'settled', '/table/phase')])).toBe('settled')
  })

  it('reads the newest surface that holds a CardTable, not the newest surface', () => {
    expect(newestTablePhase([create('t1'), table('t1', 'settled'), create('note'), other('note')])).toBe('settled')
    expect(newestTablePhase([create('t1'), table('t1', 'settled'), create('t2'), table('t2', 'betting')])).toBe('betting')
    expect(newestTablePhase([create('t1'), table('t1', 'settled'), create('t2')])).toBe('settled')
  })

  it('a later update that rebinds the phase clears the literal one, and one that drops it reads as playing', () => {
    expect(newestTablePhase([create('t'), table('t', 'settled'), table('t', { path: '/phase' }), data('t', { phase: 'betting' })])).toBe('betting')
    expect(newestTablePhase([create('t'), table('t', 'settled'), table('t', undefined)])).toBe('playing')
    expect(newestTablePhase([create('t'), table('t', { path: '/phase' }), data('t', { phase: 'settled' }), create('t'), table('t', { path: '/phase' })])).toBe('playing')
  })

  it('folds incrementally: feeding the lines in pieces reads what feeding them at once does, and meta-lines are ignored', () => {
    const lines = [JSON.stringify({ a2uiMeta: { progress: { stage: 'done' } } }), create('t'), table('t', { path: '/phase' }), data('t', { phase: 'settled' })]
    const piecewise = new TablePhase()
    for (const line of lines) piecewise.feed([line])
    expect(piecewise.phase()).toBe('settled')
    expect(newestTablePhase(lines)).toBe('settled')
  })
})

describe('--skip-if-phase', () => {
  it('attaches to the step before it, and fixtures round-trip the field', () => {
    const c = parseProbeCli(['--agent', 'croupier', '--say', 'deal', '--click', 'Stand', '--skip-if-phase', 'settled'])
    expect(c.mode === 'probe' && JSON.stringify(c.steps)).toBe('[{"say":"deal"},{"click":"Stand","skipIfPhase":"settled"}]')
    expect(() => parseProbeCli(['--agent', 'croupier', '--skip-if-phase', 'settled', '--say', 'deal'])).toThrow(/follows the --say or --click/)
    const fixture = JSON.stringify({ kind: 'agent-ui-chat-probe', version: 1, name: 'x', agent: 'croupier', steps: [{ say: 'a' }, { click: 'Stand', skipIfPhase: 'settled' }], turns: [{ lines: [] }, { lines: [] }] })
    expect(parseProbeFixture(fixture).steps[1].skipIfPhase).toBe('settled')
  })
})
