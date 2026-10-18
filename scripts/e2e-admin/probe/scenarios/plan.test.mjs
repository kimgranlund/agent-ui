// T-0343: a round planned from tags is well-formed before any credit is spent. Keyless: the smoke plan holds one run per
// roster preset (read from the persona files, not a count), every smoke step expects a type the preset's catalog holds,
// the run names carry their tag's prefix the way `signals.ts` reads it back, the regression, routing and long tags
// replan round 9's 87 runs, and a usage problem exits 2.
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { nodeCatalogResolver } from '../../../../packages/agent-ui/a2ui/tools/testkit/load.node.ts'
import { parseProbeCli } from '../cli.ts'
import { describeCommands } from '../run-capped.ts'
import { tagOf } from '../signals.ts'
import { planMain, planRuns, parsePlanArgs, scenarioRegistry, SMOKE_PRESETS, TAG_PREFIX } from './plan.ts'
import { SCENARIO_TAGS } from './round.ts'
import { round9Runs } from './round9.ts'

const root = new URL('../../../../', import.meta.url)
const personasDir = new URL('site/agent-content/personas/', root)
/** The roster presets: every persona folder whose frontmatter does not say `roster: false` (the builder). */
const roster = readdirSync(personasDir)
  .filter((id) => {
    const text = readFileSync(new URL(`${id}/agent.md`, personasDir), 'utf8')
    return JSON.parse(/^---\n([\s\S]*?)\n---/.exec(text)[1]).roster !== false
  })
  .sort()

const run = (argv) => {
  let out = ''
  let err = ''
  const code = planMain(argv, (t) => (out += t), (t) => (err += t))
  return { code, out, err }
}

describe('plan.ts', () => {
  it('plans one smoke run per roster preset on Haiku, named <scenario>-haiku-1, which the capped runner describes', () => {
    expect(roster.length).toBeGreaterThan(4)
    const { code, out } = run(['--tag', 'smoke', '--model', 'haiku', '--samples', '1'])
    expect(code).toBe(0)
    const runs = planRuns(parsePlanArgs(['--tag', 'smoke', '--model', 'haiku', '--samples', '1']))
    expect(runs.map((r) => r.agent).sort()).toEqual(roster)
    expect(out.split('\n').filter((l) => l.startsWith('npm run chat:probe'))).toHaveLength(roster.length)
    for (const r of runs) {
      expect(r.name).toMatch(new RegExp(`^smoke-${r.agent}-[a-z0-9-]+-haiku-1$`))
      const cmd = parseProbeCli(r.argv)
      expect([cmd.mode, cmd.agent, cmd.model, cmd.name, cmd.out]).toEqual(['probe', r.agent, 'claude-haiku-5-5', r.name, `runs/${r.name}`])
    }
    expect(describeCommands(out)).toHaveLength(roster.length)
  })

  it("the smoke round's live-commands.sh is the plan with every --out retargeted into the round, as run-capped writes it", () => {
    const argv = ['--tag', 'smoke', '--model', 'haiku', '--samples', '1', '--cap', '5', '--round', 'smoke']
    const home = '.sdlc/evals/rounds/2026-10-18-smoke'
    const want = run(argv).out.replaceAll('--out runs/', `--out ${home}/runs/`)
    expect(readFileSync(new URL(`${home}/live-commands.sh`, root), 'utf8')).toBe(want)
    const ledger = readFileSync(new URL(`${home}/ledger.jsonl`, root), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    expect(ledger.map((r) => r.name).sort()).toEqual(planRuns(parsePlanArgs(argv)).map((r) => r.name).sort())
    expect(ledger.reduce((sum, r) => sum + r.costUsd, 0)).toBeLessThan(5)
  })

  it('every smoke scenario is one or two turns, each expecting a type its preset catalog holds', () => {
    const resolve = nodeCatalogResolver(root.pathname)
    for (const { agent, scenarios } of SMOKE_PRESETS) {
      const catalog = resolve(`agent-ui--${agent}`) ?? resolve('agent-ui')
      for (const s of scenarios) {
        expect(s.tags, `${agent} ${s.name}`).toEqual(['smoke'])
        expect(s.steps.length, `${agent} ${s.name}`).toBeGreaterThanOrEqual(1)
        expect(s.steps.length, `${agent} ${s.name}`).toBeLessThanOrEqual(2)
        expect('say' in s.steps[0], `${agent} ${s.name} opens with a say`).toBe(true)
        for (const step of s.steps) expect(step.expect?.length ?? 0, `${agent} ${s.name} step expects a composite`).toBeGreaterThan(0)
        for (const type of [...s.steps.flatMap((st) => st.expect ?? []), ...s.expectComponents]) expect(Object.keys(catalog.components), `${agent} ${type}`).toContain(type)
      }
    }
  })

  it('every registry scenario is tagged, and its run name carries the prefix signals.ts reads the tag from', () => {
    const registry = scenarioRegistry()
    expect(new Set(registry.flatMap((s) => s.scenario.tags))).toEqual(new Set(SCENARIO_TAGS))
    expect(new Set(registry.map((s) => s.id)).size).toBe(registry.length)
    for (const s of registry) {
      expect(s.id.startsWith(`${TAG_PREFIX[s.scenario.tags[0]]}-`), s.id).toBe(true)
      expect(tagOf(s.id), s.id).toBe(s.scenario.tags[0])
    }
  })

  it("the regression, routing and long tags replan round 9's 87 runs: same names, order and probe arguments", () => {
    const runs = planRuns(parsePlanArgs(['--tag', 'regression', '--tag', 'routing', '--tag', 'long']))
    const r9 = round9Runs()
    expect(runs.map((r) => r.name)).toEqual(r9.map((r) => r.name))
    const withoutOut = (argv) => argv.filter((_, i) => argv[i - 1] !== '--out' && argv[i] !== '--out')
    runs.forEach((r, i) => expect(withoutOut(r.argv), r.name).toEqual(withoutOut(r9[i].argv)))
  })

  it('a second sample follows every first sample of the model, and --persona narrows the plan', () => {
    const runs = planRuns(parsePlanArgs(['--tag', 'smoke', '--persona', 'quant', '--persona', 'admiral', '--model', 'sonnet', '--samples', '2']))
    expect(runs.map((r) => r.name)).toEqual(['smoke-quant-kpi-dashboard-sonnet-1', 'smoke-admiral-first-shot-sonnet-1', 'smoke-quant-kpi-dashboard-sonnet-2', 'smoke-admiral-first-shot-sonnet-2'])
  })

  it('exits 2 on a usage problem, an empty selection and --affected (SPEC CL-R10)', () => {
    for (const argv of [[], ['--tag', 'nightly'], ['--tag', 'smoke', '--model', 'gpt'], ['--tag', 'smoke', '--persona', 'nobody'], ['--tag', 'smoke', '--samples', '0'], ['--tag', 'routing', '--persona', 'quant'], ['--tag', 'smoke', '--affected', '2026-10-17-r9-matrix']]) {
      const { code, out, err } = run(argv)
      expect([code, out], argv.join(' ')).toEqual([2, ''])
      expect(err, argv.join(' ')).toMatch(/^plan: .*\nusage: /)
    }
    expect(run(['--tag', 'smoke', '--affected', 'x']).err).toContain('CL-R10')
  })
})
