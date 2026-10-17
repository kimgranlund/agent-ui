// T-0341: live round 10 is well-formed before any credit is spent. Keyless. The generator derives the selection from
// the round 8 and 9 records; this test pins what it derives to the evidence read off round 9 by hand (the failed
// runs, each fix's runs with their trace lines, the unstable openings), checks every argv against round 9, and checks
// that the committed `live-commands.sh`, with its `# est` lines, is the generated script and stays under the cap.
import { readFileSync, statSync } from 'node:fs'
import { withoutSkipMarks } from './croupier.ts'
import { describe, expect, it } from 'vitest'
import { parseProbeCli } from '../cli.ts'
import { describeCommands, parseCommands, runCapped } from '../run-capped.ts'
import { round9Runs } from './round9.ts'
import { FIX_SIGNALS, R10_SAMPLES, R10_TARGET, ROUND10_CAP, ROUND10_DIR, ROUND10_FILE, round10CommandsScript, round10Plan, round10Runs, round9Lines } from './round10.ts'

const root = new URL('../../../../', import.meta.url)
const read = (rel) => readFileSync(new URL(rel, root), 'utf8')
const H = (s) => `${s}-haiku-1`
const S = (s) => `${s}-sonnet-1`
const O = (s) => `${s}-opus-1`
const base = (name) => name.replace(/-\d+$/, '-1')

describe('live round 10', () => {
  const plan = round10Plan()
  const runs = round10Runs(plan)
  const names = runs.map((r) => r.name)

  it("derives round 9's 10 failed runs from its ledger", () => {
    expect(plan.failed).toEqual([
      H('regress-croupier-blackjack-rounds'),
      H('regress-concierge-facilities-then-tour'),
      H('routing-domain-switch'),
      H('routing-long-session'),
      H('routing-guidance-conflict'),
      H('long-croupier-blackjack-hand'),
      H('long-concierge-spa-services'),
      S('regress-croupier-blackjack-moves'),
      O('regress-croupier-omaha'),
      O('regress-croupier-five-card-draw'),
    ])
  })

  it('derives the runs each fix touches from the round 9 trace lines that carry its signal', () => {
    expect(Object.keys(FIX_SIGNALS).sort()).toEqual(['T-0328', 'T-0330', 'T-0331', 'T-0332', 'T-0333', 'T-0334', 'T-0335'])
    expect(plan.evidence).toEqual({
      'T-0328': {
        [H('regress-croupier-blackjack-rounds')]: [1],
        [H('regress-concierge-facilities-then-tour')]: [84],
        [H('routing-domain-switch')]: [120],
        [H('routing-long-session')]: [128],
        [H('routing-guidance-conflict')]: [143],
        [H('long-croupier-blackjack-hand')]: [147],
        [H('long-concierge-spa-services')]: [157],
      },
      'T-0330': { [H('routing-long-session')]: [128], [H('long-concierge-spa-services')]: [157] },
      'T-0331': { [H('regress-concierge-facilities-then-tour')]: [84], [H('long-concierge-spa-services')]: [157] },
      'T-0332': {
        [H('regress-croupier-blackjack-moves')]: [8],
        [H('regress-croupier-spanish-21')]: [20],
        [H('regress-croupier-pontoon')]: [28, 29],
        [H('regress-croupier-texas-holdem')]: [42],
        [H('regress-croupier-omaha')]: [49],
        [H('regress-croupier-seven-card-stud')]: [70],
        [H('regress-admiral-opening-salvo')]: [105],
        [S('regress-croupier-blackjack-moves')]: [182],
        [S('regress-croupier-spanish-21')]: [190],
        [S('regress-croupier-texas-holdem')]: [207],
        [S('regress-croupier-seven-card-stud')]: [240],
        [S('routing-domain-switch')]: [294],
        [O('regress-croupier-texas-holdem')]: [391],
      },
      'T-0333': { [H('regress-concierge-facilities-then-tour')]: [85], [S('regress-concierge-facilities-then-tour')]: [257], [O('routing-long-session')]: [491] },
      'T-0334': { [H('regress-croupier-spanish-21')]: [14, 19], [H('regress-croupier-pontoon')]: [27], [S('regress-croupier-spanish-21')]: [189] },
      'T-0335': {
        [H('regress-concierge-facilities-then-tour')]: [85],
        [H('routing-long-session')]: [138],
        [S('regress-concierge-facilities-then-tour')]: [256],
        [S('routing-long-session')]: [312],
        [O('regress-concierge-facilities-then-tour')]: [442],
        [O('routing-long-session')]: [498],
      },
    })
  })

  it('each listed trace line is in its run and carries the signal; a line of another run does not', () => {
    const lines = new Map(round9Lines().map((l) => [l.n, l]))
    for (const [fix, byRun] of Object.entries(plan.evidence)) {
      for (const [run, ns] of Object.entries(byRun)) {
        for (const n of ns) {
          expect(lines.get(n).run, `${fix} :${n}`).toBe(run)
          expect(FIX_SIGNALS[fix].test(lines.get(n).line), `${fix} :${n}`).toBe(true)
        }
      }
    }
    // Negative controls: a clean Haiku blackjack turn and a Concierge spa-services ask carry no signal.
    for (const n of [3, 148]) for (const [fix, { test }] of Object.entries(FIX_SIGNALS)) expect(test(lines.get(n).line), `${fix} :${n}`).toBe(false)
  })

  it('the unstable runs are the Haiku blackjack openings that failed BET_TABLE_MISSING on round 1, 3 samples each', () => {
    expect(plan.unstable).toEqual([H('regress-croupier-blackjack-rounds'), H('regress-croupier-blackjack-moves'), H('routing-domain-switch'), H('routing-guidance-conflict'), H('long-croupier-blackjack-hand')])
    const lines = new Map(round9Lines().map((l) => [l.n, l.line]))
    for (const n of [1, 2, 120, 143, 147]) {
      const l = lines.get(n)
      expect(l.model).toBe('claude-haiku-5-5')
      expect(l.retries.find((r) => r.round === 2).failures.map((f) => f.code)).toContain('BET_TABLE_MISSING')
    }
    expect(R10_SAMPLES).toBe(3)
    const count = (b) => names.filter((n) => base(n) === b).length
    for (const b of new Set(names.map(base))) expect(count(b), b).toBe(plan.unstable.includes(b) ? 3 : 1)
  })

  it('selects the failed, touched and unstable runs minus the exclusions, whose reasons carry computed numbers', () => {
    const candidates = new Set([...plan.failed, ...Object.values(plan.evidence).flatMap((e) => Object.keys(e)), ...plan.unstable])
    expect([...new Set(names.map(base))].sort()).toEqual([...candidates].filter((n) => !(n in plan.excluded)).sort())
    expect(Object.keys(plan.excluded)).toEqual([O('regress-croupier-omaha'), O('regress-croupier-five-card-draw'), O('routing-long-session')])
    expect(plan.excluded[O('regress-croupier-omaha')]).toBe('failed in round 9 with no fix signal on its trace lines, so no round 9 fix can move it ($1.42)')
    expect(plan.excluded[O('routing-long-session')]).toBe('estimate $10.24 over the $8.00 target; T-0333 keeps 2 selected runs, T-0335 keeps 5 selected runs ($2.44)')
    for (const fix of Object.keys(plan.evidence)) expect(Object.keys(plan.evidence[fix]).filter((r) => !(r in plan.excluded)).length, fix).toBeGreaterThanOrEqual(2)
    expect(new Set(names).size).toBe(runs.length)
  })

  it("each run is round 9's argv for the same scenario and model, with only --out and --name changed", () => {
    const prior = new Map(round9Runs().map((r) => [r.name, r]))
    for (const { agent, model, name, argv } of runs) {
      const p = prior.get(base(name))
      expect([agent, model.id]).toEqual([p.agent, p.model.id])
      expect(argv[argv.indexOf('--out') + 1]).toBe(`${ROUND10_DIR}/runs/${name}`)
      expect(argv[argv.indexOf('--name') + 1]).toBe(name)
      const keep = (a) => a.filter((_, j) => j !== a.indexOf('--out') + 1 && j !== a.indexOf('--name') + 1)
      expect(keep(argv)).toEqual(keep(p.argv))
      const cmd = parseProbeCli(argv)
      expect([cmd.mode, cmd.agent, cmd.model, cmd.name]).toEqual(['probe', agent, model.id, name])
    }
  })

  it('costs are the larger of the round 8 and 9 ledger costs, runs go cheapest first, the estimate meets the target', () => {
    expect(plan.cost[H('regress-croupier-blackjack-rounds')]).toBe(0.03305) // round 8; round 9 halted on turn 0 at 0.009683
    expect(plan.cost[S('regress-croupier-spanish-21')]).toBe(0.913908) // round 9; round 8 was 0.676054
    const est = runs.map((r) => r.est)
    expect(est).toEqual(runs.map((r) => plan.cost[r.of]))
    expect(est).toEqual([...est].sort((a, b) => a - b))
    expect(ROUND10_CAP).toBe(10)
    expect(plan.expectedUsd).toBeCloseTo(est.reduce((s, c) => s + c, 0), 9)
    expect(plan.expectedUsd).toBeLessThanOrEqual(R10_TARGET)
  })

  it('live-commands.sh is the generated, executable script; every run has its estimate and none is a cap skip at the estimates', () => {
    const text = read(ROUND10_FILE)
    expect(text).toBe(withoutSkipMarks(round10CommandsScript()))
    expect(statSync(new URL(ROUND10_FILE, root)).mode & 0o111).not.toBe(0)
    expect(text).toContain(`run-capped.ts ${ROUND10_FILE} --cap 10 --round r10-targeted`)
    const cmds = parseCommands(text)
    expect(cmds.map((c) => c.est)).toEqual(runs.map((r) => r.est))
    expect(describeCommands(text).map((d) => d.split(':')[0])).toEqual(names)
    let spend = 0
    const result = runCapped({ commands: cmds, cap: ROUND10_CAP, spend: () => spend, exec: (cmd) => ((spend += cmds.find((c) => c.cmd === cmd).est), 0), done: () => false })
    expect(result).toMatchObject({ ran: runs.length, capped: false, capSkipped: [] })
  })
})
