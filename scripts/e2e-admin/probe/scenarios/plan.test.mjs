// T-0343: a round planned from tags is well-formed before any credit is spent. Keyless: the smoke plan holds one run per
// roster preset (read from the persona files, not a count), every smoke step expects a type the preset's catalog holds,
// the run names carry their tag's prefix the way `signals.ts` reads it back, the regression, routing and long tags
// replan round 9's 87 runs, `--affected` keeps only the presets whose content changed since a baseline round, and a
// usage problem exits 2.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { nodeCatalogResolver } from '../../../../packages/agent-ui/a2ui/tools/testkit/load.node.ts'
import { parseProbeCli } from '../cli.ts'
import { describeCommands, parseCommands, shellWords } from '../run-capped.ts'
import { tagOf } from '../signals.ts'
import { affectedPresets, PlanCompileError, planMain, planRuns, parsePlanArgs, scenarioRegistry, SMOKE_PRESETS, TAG_PREFIX } from './plan.ts'
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
/** T-0197: a preset's effective catalog id from its frontmatter: its domains (`agent-ui--hospitality`), else its
 *  local pattern set (`agent-ui--croupier`), else the base. */
const presetCatalogId = (id) => {
  const fm = JSON.parse(/^---\n([\s\S]*?)\n---/.exec(readFileSync(new URL(`${id}/agent.md`, personasDir), 'utf8'))[1])
  if (fm.domains !== undefined) return `agent-ui--${[...fm.domains].sort().join('+')}`
  return fm.localPatterns !== undefined ? `agent-ui--${fm.localPatterns}` : 'agent-ui'
}

const run = (argv, compile) => {
  let out = ''
  let err = ''
  const code = planMain(argv, (t) => (out += t), (t) => (err += t), compile)
  return { code, out, err }
}

const entry = (kind, id, digest) => ({ kind, id, version: 1, digest, source: 'seed' })
/** A baseline round folder whose trace lines record quant, croupier (whose bankroll moves after its opening turn),
 *  admiral and lexicographer, each run on a model the seed does not name, plus a line torn mid-write. */
function baseline() {
  const dir = mkdtempSync(join(tmpdir(), 'plan-affected-'))
  mkdirSync(join(dir, 'traces'))
  const line = (resolution) => JSON.stringify({ at: '2026-10-18T00:00:00Z', bundle: { digest: 'sha256:x', resolution } })
  const lines = [
    line([entry('persona', 'quant', 'q1'), entry('skill', 'dashboard-kpi-grid', 's1'), entry('setting', 'model', 'haiku')]),
    line([entry('persona', 'croupier', 'c1'), entry('setting', 'bankroll', 'b1'), entry('setting', 'model', 'haiku')]),
    line([entry('persona', 'croupier', 'c1-after-bet'), entry('setting', 'bankroll', 'b2'), entry('setting', 'model', 'haiku')]),
    line([entry('persona', 'admiral', 'a1'), entry('setting', 'model', 'haiku')]),
    line([entry('persona', 'lexicographer', 'l1'), entry('setting', 'effort', 'high'), entry('setting', 'model', 'haiku')]),
    JSON.stringify({ at: '2026-10-18T00:00:01Z', outcome: 'error' }),
    '{"at":"2026-10-18T00:00:02Z","bundle":{"res',
  ]
  writeFileSync(join(dir, 'traces', '2026-10-18.jsonl'), `${lines.join('\n')}\n`)
  return dir
}
/** The current tree as the compiler would report it: quant and croupier unchanged (no model or bankroll setting, the
 *  seed's), the admiral's persona edited, the lexicographer's seeded effort moved. Each call is recorded. */
const compiled = []
const compile = (agents) => {
  compiled.push([...agents])
  const now = {
    quant: [entry('skill', 'dashboard-kpi-grid', 's1'), entry('persona', 'quant', 'q1')],
    croupier: [entry('persona', 'croupier', 'c1')],
    admiral: [entry('persona', 'admiral', 'a2')],
    lexicographer: [entry('persona', 'lexicographer', 'l1'), entry('setting', 'effort', 'medium')],
  }
  return new Map(agents.map((a) => [a, now[a] ?? [entry('persona', a, 'new')]]))
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

  it("the smoke round's live-commands.sh runs the plan's names, agents and models, each out in the round", () => {
    // A finished run record is never rewritten, so the pin is the run list, not the bytes: a later edit to a smoke ask
    // changes the generator's steps and leaves this file as it ran.
    const argv = ['--tag', 'smoke', '--model', 'haiku', '--samples', '1', '--cap', '5', '--round', 'smoke']
    const home = '.sdlc/evals/rounds/2026-10-18-smoke'
    const text = readFileSync(new URL(`${home}/live-commands.sh`, root), 'utf8')
    expect(text).toContain('# Generated by `node --experimental-strip-types scripts/e2e-admin/probe/scenarios/plan.ts` (T-0343) with `--tag smoke --model haiku --samples 1 --cap 5 --round smoke`')
    const ran = parseCommands(text).map(({ cmd, out }) => {
      const words = shellWords(cmd)
      const c = parseProbeCli(words.slice(words.indexOf('--') + 1))
      return [c.name, c.agent, c.model, out]
    })
    expect(ran).toEqual(planRuns(parsePlanArgs(argv)).map((r) => [r.name, r.agent, r.model.id, `${home}/runs/${r.name}`]))
    const ledger = readFileSync(new URL(`${home}/ledger.jsonl`, root), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    expect(ledger.map((r) => r.name).sort()).toEqual(planRuns(parsePlanArgs(argv)).map((r) => r.name).sort())
    expect(ledger.reduce((sum, r) => sum + r.costUsd, 0)).toBeLessThan(5)
  })

  it('every smoke scenario is one or two turns, each expecting a type its preset catalog holds', () => {
    const resolve = nodeCatalogResolver(root.pathname)
    for (const { agent, scenarios } of SMOKE_PRESETS) {
      const catalog = resolve(presetCatalogId(agent))
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

  it('--affected compares each preset with its first recorded resolution, settings aside (SPEC CL-R10)', () => {
    const dir = baseline()
    try {
      compiled.length = 0
      const got = affectedPresets(['quant', 'croupier', 'admiral', 'lexicographer', 'curator'], dir, compile)
      expect(Object.fromEntries(got.presets)).toEqual({
        quant: { affected: false, why: 'unchanged' },
        croupier: { affected: false, why: 'unchanged' },
        admiral: { affected: true, why: 'content changed' },
        lexicographer: { affected: true, why: 'content changed' },
        curator: { affected: true, why: 'no recorded resolution' },
      })
      expect(got.malformed).toBe(1)
      expect(compiled).toEqual([['quant', 'croupier', 'admiral', 'lexicographer']])
      const plan = run(['--tag', 'smoke', '--model', 'haiku', '--persona', 'quant', '--persona', 'admiral', '--persona', 'curator', '--affected', dir], compile)
      expect(plan.code).toBe(0)
      expect(plan.out).toContain(`# Affected since ${dir} (SPEC CL-R10): quant unchanged, curator no recorded resolution, admiral content changed; 1 malformed trace line(s) skipped.`)
      expect(plan.out.split('\n').filter((l) => l.startsWith('npm run')).map((l) => /--name (\S+)/.exec(l)[1])).toEqual(['smoke-curator-collection-haiku-1', 'smoke-admiral-first-shot-haiku-1'])
      const none = run(['--tag', 'smoke', '--persona', 'quant', '--persona', 'croupier', '--affected', dir], compile)
      expect([none.code, none.out]).toEqual([2, ''])
      expect(none.err).toContain("no selected preset's agent content changed since")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('a compile failure exits 1 with its message, not the usage', () => {
    const dir = baseline()
    try {
      const failing = () => {
        throw new PlanCompileError('agent compile exited 1:\nno shipped persona quant')
      }
      const { code, out, err } = run(['--tag', 'smoke', '--persona', 'quant', '--affected', dir], failing)
      expect([code, out, err]).toEqual([1, '', 'plan: agent compile exited 1:\nno shipped persona quant\n'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('exits 2 on a usage problem, an empty selection and a baseline with no traces', () => {
    for (const argv of [[], ['--tag', 'nightly'], ['--tag', 'smoke', '--model', 'gpt'], ['--tag', 'smoke', '--persona', 'nobody'], ['--tag', 'smoke', '--samples', '0'], ['--tag', 'routing', '--persona', 'quant'], ['--tag', 'smoke', '--affected', 'no-such-round']]) {
      const { code, out, err } = run(argv, compile)
      expect([code, out], argv.join(' ')).toEqual([2, ''])
      expect(err, argv.join(' ')).toMatch(/^plan: .*\nusage: /)
    }
  })
})
