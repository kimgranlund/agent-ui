// T-0261: live round 3 is well-formed before any credit is spent. Keyless: every run parses as a live probe with
// its steps and oracles, the round 2 regressions rerun scenarios that failed on a model they failed on plus Haiku and
// cover every round 2 ticket, the long flows run on all three models, runs go Haiku then Sonnet then Opus, and
// `live-commands.sh` is exactly the generated script, which the capped runner describes.
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseProbeCli } from '../cli.ts'
import { describeCommands, describeRound } from '../run-capped.ts'
import { LONG_FLOWS, REGRESSIONS, ROUND2_TICKETS, ROUND3_DIR, ROUND3_FILE, ROUND3_MODELS, regressionScenario, round3CommandsScript, round3Runs } from './round3.ts'

const root = new URL('../../../../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, root), 'utf8')
const R2_RUNS = '.sdlc/evals/rounds/2026-10-15-r2-presets/runs'
const r2Verdict = (name) => {
  const file = new URL(`${R2_RUNS}/${name}/report.json`, root)
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).verdict : undefined
}

describe('live round 3', () => {
  const runs = round3Runs()

  it('12 routing pack runs, 26 regressions, 6 long flows', () => {
    expect(runs.filter((r) => r.part === 'routing')).toHaveLength(12)
    expect(runs.filter((r) => r.part === 'regress')).toHaveLength(26)
    expect(runs.filter((r) => r.part === 'long')).toHaveLength(6)
  })

  it('every run parses as a live probe on its agent and model, out under the round folder', () => {
    for (const { agent, model, name, argv } of runs) {
      const cmd = parseProbeCli(argv)
      expect(cmd.mode).toBe('probe')
      expect(cmd.agent).toBe(agent)
      expect(cmd.model).toBe(model.id)
      expect(cmd.name).toBe(name)
      expect(argv[argv.indexOf('--out') + 1]).toBe(`${ROUND3_DIR}/runs/${name}`)
    }
    expect(new Set(runs.map((r) => r.name)).size).toBe(runs.length)
  })

  it('each regression reruns a round 2 scenario on a model it failed on, plus Haiku', () => {
    for (const r of REGRESSIONS) {
      const verdicts = Object.fromEntries(r.models.map((m) => [m, r2Verdict(`${r.agent}-${r.scenario}-${m}-1`)]))
      expect(r.models).toContain('haiku')
      expect(Object.values(verdicts)).toContain('fail')
      for (const m of r.models) expect(m === 'haiku' || verdicts[m] === 'fail').toBe(true)
      for (const m of r.models) expect(verdicts[m]).toBeDefined()
    }
  })

  it('the regressions cover every round 2 ticket', () => {
    expect(new Set(REGRESSIONS.flatMap((r) => r.covers))).toEqual(new Set(ROUND2_TICKETS))
  })

  it('every regression opens with its own exemplar oracle; the Concierge asks carry theirs', () => {
    for (const r of REGRESSIONS) {
      const steps = regressionScenario(r).steps
      const at = r.agent === 'lexicographer' ? 1 : 0
      if (r.agent !== 'concierge') expect(steps[at].expectRouting?.exemplars?.include).toHaveLength(1)
      if (r.agent === 'lexicographer') expect(steps[at].say).toMatch(/^My guess: /)
    }
    const croupier = regressionScenario(REGRESSIONS[0]).steps[0].expectRouting
    expect(croupier.exemplars).toEqual({ include: ['domain-croupier-card-table-round'], exclude: ['domain-lexicographer-word-board', 'domain-admiral-battleship-board'] })
    const tour = regressionScenario(REGRESSIONS.find((r) => r.scenario === 'facilities-then-tour')).steps
    expect(tour.find((s) => /late check-out/.test(s.say ?? ''))?.expectRouting).toEqual({ domains: ['concierge'], references: [{ name: 'property-knowledge-base', load: 'full' }] })
    expect(tour.find((s) => /late check-out/.test(s.say ?? ''))?.say).not.toContain('property-knowledge-base')
    expect(tour.find((s) => /^Book /.test(s.say ?? ''))?.expectRouting?.exemplars).toEqual({ include: ['domain-concierge-booking-request'] })
  })

  it('the long flows play a full hand and a booking through confirmation on every model', () => {
    const hand = LONG_FLOWS.find((f) => f.agent === 'croupier').scenario.steps
    expect(hand.map((s) => s.say ?? s.click)).toEqual(["Let's play blackjack.", '100', 'Hit', 'Stand.', 'Deal again', '50', 'Stand.'])
    const booking = LONG_FLOWS.find((f) => f.agent === 'concierge').scenario.steps
    expect(booking.flatMap((s) => s.expect ?? [])).toEqual(['ProductCard', 'BookingForm', 'BookingForm', 'BookingConfirmation'])
    for (const f of LONG_FLOWS) expect(runs.filter((r) => r.part === 'long' && r.agent === f.agent).map((r) => r.model.short)).toEqual(['haiku', 'sonnet', 'opus'])
  })

  it('runs go Haiku, then Sonnet, then Opus', () => {
    const order = ROUND3_MODELS.map((m) => m.id)
    const seen = runs.map((r) => order.indexOf(r.model.id))
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
  })

  it('live-commands.sh is the generated script, and the capped runner describes every run keyless', () => {
    const text = read(ROUND3_FILE)
    expect(text).toBe(round3CommandsScript())
    const described = describeCommands(text)
    expect(described).toHaveLength(44)
    expect(described.at(-1)).toBe('long-concierge-booking-opus-1: concierge on claude-opus-5-5, 5 steps, 4 --expect-turn, 1 --expect-routing')
  })

  it('the round README names this generator for live-commands.sh', () => {
    expect(describeRound(new URL(ROUND3_DIR, root).pathname)).toContain('Generated by `node --experimental-strip-types scripts/e2e-admin/probe/scenarios/round3.ts` (pinned by `round3.test.mjs`)')
  })
})
