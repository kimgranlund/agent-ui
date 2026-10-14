// scripts/e2e-admin/probe/cli.ts: argument parsing for `npm run chat:probe` (T-0174). Pure: every usage
// problem is a `SetupError` raised before vite boots. `--say` and `--click` keep their command-line order.

import { SetupError } from '../runner.ts'
import type { ProbeStep } from './model.ts'

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
  | { mode: 'from-trace'; spec: string; out?: string; name?: string }
  | { mode: 'selftest'; browser: boolean }

export const PROBE_USAGE = [
  'usage: npm run chat:probe -- --agent <preset id> [--model <id>] [--effort <level>] --say "<text>" [--click <label>] [--say ...]',
  '                            [--expect-component <Type>]... [--out <dir>] [--name <name>]     (live: spends API credit)',
  '       npm run chat:probe -- --replay <fixture.json> [--expect-component <Type>]... [--out <dir>]   (keyless)',
  '       npm run chat:probe -- --from-trace <last | last:<k> | <day>.jsonl:<line>[,...]> [--out <dir>] [--name <name>]',
  '       npm run chat:probe -- selftest [--browser]',
].join('\n')

const VALUE_FLAGS = ['--agent', '--model', '--effort', '--say', '--click', '--expect-component', '--replay', '--out', '--name', '--from-trace'] as const
const REPEATABLE = ['--say', '--click', '--expect-component']

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
    else if (flag === '--expect-component') expectComponents.push(value)
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
    const extra = [...single.keys()].filter((k) => !['--from-trace', '--out', '--name'].includes(k))
    if (extra.length > 0 || steps.length > 0 || expectComponents.length > 0) throw new SetupError(`--from-trace takes only --out and --name`)
    return { mode: 'from-trace', spec, ...(out !== undefined ? { out } : {}), ...(name !== undefined ? { name } : {}) }
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
