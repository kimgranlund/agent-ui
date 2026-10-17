// scripts/e2e-admin/probe/cli.ts: argument parsing for `npm run chat:probe` (T-0174). Pure: every usage
// problem is a `SetupError` raised before vite boots. `--say` and `--click` keep their command-line order.

import { SetupError } from '../setup-error.ts'
import { FixtureError, parseRoutingExpect, type ProbeStep } from './model.ts'

export type ProbeCommand =
  | {
      mode: 'probe'
      agent?: string
      model?: string
      effort?: string
      steps: ProbeStep[]
      expectComponents: string[]
      replay?: string
      out?: string
      name?: string
    }
  | { mode: 'from-trace'; spec: string; agent?: string; out?: string; name?: string }
  | { mode: 'selftest'; browser: boolean }

export const PROBE_USAGE = [
  'usage: npm run chat:probe -- --agent <preset id> [--model <id>] [--effort <level>] --say "<text>" [--click <label>] [--say ...]',
  '                            [--expect-turn <Type>]... [--expect-routing <json>]... [--expect-component <Type>]... [--skip-if-phase <phase>]... [--out <dir>] [--name <name>]     (live: spends API credit)',
  '       (--expect-turn: the step before it must update a surface holding <Type>; --expect-component: any turn ships <Type>;',
  '        --expect-routing: the step before it must get this routing, {domains, exemplars: {include, exclude}, sections, references};',
  '        --skip-if-phase: the step before it is not played when the hand\'s newest table is already in <phase>, a natural that settled on the deal)',
  '       npm run chat:probe -- --replay <fixture.json> [--expect-component <Type>]... [--out <dir>]   (keyless)',
  '       npm run chat:probe -- --from-trace <last | last:<k> | <day>.jsonl:<line>[,...]> [--agent <preset id>] [--out <dir>] [--name <name>]',
  '       npm run chat:probe -- selftest [--browser]',
].join('\n')

const VALUE_FLAGS = ['--agent', '--model', '--effort', '--say', '--click', '--expect-turn', '--expect-routing', '--expect-component', '--skip-if-phase', '--replay', '--out', '--name', '--from-trace'] as const
const REPEATABLE = ['--say', '--click', '--expect-turn', '--expect-routing', '--expect-component']

export function parseProbeCli(argv: readonly string[]): ProbeCommand {
  if (argv[0] === 'selftest') {
    const rest = argv.slice(1)
    if (rest.some((a) => a !== '--browser')) throw new SetupError(`selftest takes only --browser`)
    return { mode: 'selftest', browser: rest.includes('--browser') }
  }
  const single = new Map<string, string>()
  const steps: ProbeStep[] = []
  const expectComponents: string[] = []
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i]!
    if (!(VALUE_FLAGS as readonly string[]).includes(flag)) throw new SetupError(`unknown argument "${flag}"`)
    const value = argv[i + 1]
    if (value === undefined || value === '') throw new SetupError(`${flag} needs a value`)
    if (flag === '--say') steps.push({ say: value })
    else if (flag === '--click') steps.push({ click: value })
    else if (flag === '--expect-turn') {
      const step = steps.at(-1)
      if (step === undefined) throw new SetupError('--expect-turn follows the --say or --click it applies to')
      step.expect = [...(step.expect ?? []), value]
    } else if (flag === '--expect-routing') {
      // T-0260: one JSON oracle per step, checked against the turn's trace `routing` block (`routing-expect`).
      const step = steps.at(-1)
      if (step === undefined) throw new SetupError('--expect-routing follows the --say or --click it applies to')
      if (step.expectRouting !== undefined) throw new SetupError('--expect-routing given twice for one step')
      let raw: unknown
      try {
        raw = JSON.parse(value)
      } catch {
        throw new SetupError(`--expect-routing takes JSON, got ${value.slice(0, 60)}`)
      }
      try {
        step.expectRouting = parseRoutingExpect(raw, '--expect-routing')
      } catch (err) {
        throw err instanceof FixtureError ? new SetupError(err.message) : err
      }
    } else if (flag === '--skip-if-phase') {
      // T-0347: the step before it is skipped when the newest table is already in this phase on the deal (a natural).
      const step = steps.at(-1)
      if (step === undefined) throw new SetupError('--skip-if-phase follows the --say or --click it applies to')
      if (step.skipIfPhase !== undefined) throw new SetupError('--skip-if-phase given twice for one step')
      step.skipIfPhase = value
    } else if (flag === '--expect-component') expectComponents.push(value)
    else {
      if (single.has(flag) && !REPEATABLE.includes(flag)) throw new SetupError(`${flag} given twice`)
      single.set(flag, value)
    }
  }
  const out = single.get('--out')
  const name = single.get('--name')
  if (name !== undefined && !/^[a-z0-9][a-z0-9._-]*$/.test(name)) throw new SetupError('--name takes lowercase letters, digits, dot, dash and underscore')
  const spec = single.get('--from-trace')
  if (spec !== undefined) {
    const extra = [...single.keys()].filter((k) => !['--from-trace', '--agent', '--out', '--name'].includes(k))
    if (extra.length > 0 || steps.length > 0 || expectComponents.length > 0) throw new SetupError(`--from-trace takes only --agent, --out and --name`)
    const agent = single.get('--agent')
    return { mode: 'from-trace', spec, ...(agent !== undefined ? { agent } : {}), ...(out !== undefined ? { out } : {}), ...(name !== undefined ? { name } : {}) }
  }
  const replay = single.get('--replay')
  const agent = single.get('--agent')
  if (replay === undefined) {
    if (agent === undefined) throw new SetupError('a live probe needs --agent <preset id>')
    if (steps.length === 0) throw new SetupError('a live probe needs at least one --say')
    if (!('say' in steps[0]!)) throw new SetupError('the first step must be a --say')
  }
  const command: ProbeCommand = { mode: 'probe', steps, expectComponents }
  for (const [flag, key] of [['--agent', 'agent'], ['--model', 'model'], ['--effort', 'effort'], ['--replay', 'replay']] as const) {
    const v = single.get(flag)
    if (v !== undefined) command[key] = v
  }
  if (out !== undefined) command.out = out
  if (name !== undefined) command.name = name
  return command
}
