// producer-leg.ts: run one `rounds` turn through the REAL `produce()` with the kit's scripted provider and
// judge it (T-0011). Repair, halt and validate-then-stream are therefore the shipped code, never a copy.
//
// Accounting follows `tools/agent-eval/observe.ts`: `rounds` and `failureCodes` come from the meta-line
// `TurnTrace` when one rides the turn (only when the final round carries a note); otherwise `rounds` is the
// provider's call count and `failureCodes` is null (not observed), except on `ProduceHalt`, whose
// `failures[].code` are the codes. A halted turn streams one terminal error line, as the dev proxy does.
//
// With `opts.tools`, `buildToolDispatch` over `scriptedTools(opts.tools).manifests` supplies the producer's
// `tools` and `executeTool`; `toolCalls` are the calls that reached an executor (dispatch validates input
// first, so an invalid input never lands there).
//
// Node and jsdom only: produce.ts reads prompt files relative to the repo-root cwd at module load.

import { produce, ProduceHalt } from '../../src/agent/produce.ts'
import type { ProduceDeps, ProduceOptions } from '../../src/agent/produce.ts'
import type { AgentProvider, TurnInput } from '../../src/agent/agent-transport.ts'
import { formatErrorLine, readMetaLine } from '../../src/agent/meta-line.ts'
import type { Catalog } from '../../src/catalog/catalog.ts'
import { buildToolDispatch } from '../agent/integrations/tool-dispatch.ts'
import { repairOutcome } from '../agent-eval/score.ts'
import { kitFinding } from './findings.ts'
import type { KitFinding } from './findings.ts'
import { scriptedProvider } from './scripted-provider.ts'
import { scriptedTools } from './scripted-tools.ts'
import type { ScriptedToolCall } from './scripted-tools.ts'
import type { ProduceTurn } from './scripted-transport.ts'
import type { ScriptedToolRound, ScriptedToolSpec, TurnExpect } from './scenario.ts'

export const DEFAULT_MAX_ROUNDS = 3

export interface ProducerTurnResult {
  outcome: 'first-pass' | 'eventual' | 'halt'
  rounds: number
  /** Trace codes, halt codes, or null when neither was observed. */
  failureCodes: string[] | null
  /** Every line `produce()` streamed (meta-lines included), or the one error line of a halt. */
  lines: string[]
  toolCalls: ScriptedToolCall[]
}

export async function runProducerTurn(
  input: TurnInput,
  rounds: readonly (string | ScriptedToolRound)[],
  catalog: Catalog,
  opts: { tools?: readonly ScriptedToolSpec[]; maxRounds?: number } = {},
): Promise<ProducerTurnResult> {
  const provider = scriptedProvider(rounds)
  const scripted = scriptedTools(opts.tools ?? [])
  const dispatch = opts.tools !== undefined && opts.tools.length > 0 ? buildToolDispatch(scripted.manifests, {}) : {}
  const deps: ProduceDeps = { provider: provider as AgentProvider, retrieve: () => [], catalog }
  const produceOpts: ProduceOptions = { maxRounds: opts.maxRounds ?? DEFAULT_MAX_ROUNDS, ...dispatch }
  const lines: string[] = []
  try {
    for await (const line of produce(input, deps, produceOpts)) lines.push(line)
  } catch (err) {
    if (!(err instanceof ProduceHalt)) throw err
    const codes = err.failures.map((f) => f.code)
    return { outcome: 'halt', rounds: provider.calls, failureCodes: codes, lines: [formatErrorLine(err.message)], toolCalls: scripted.calls }
  }
  let traceRounds: number | undefined
  let traceCodes: string[] | undefined
  for (const line of lines) {
    const trace = readMetaLine(line)?.a2uiMeta.trace
    if (trace !== undefined && typeof trace.rounds === 'number' && traceRounds === undefined) {
      traceRounds = trace.rounds
      traceCodes = Array.isArray(trace.failureCodes) ? [...trace.failureCodes] : undefined
    }
  }
  const roundCount = traceRounds ?? provider.calls
  return { outcome: repairOutcome(false, roundCount), rounds: roundCount, failureCodes: traceCodes ?? null, lines, toolCalls: scripted.calls }
}

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  JSON.stringify([...new Set(a)].sort()) === JSON.stringify([...new Set(b)].sort())

const deepEqual = (a: unknown, b: unknown): boolean => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical)
  if (typeof v === 'object' && v !== null) return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical((v as Record<string, unknown>)[k])]))
  return v
}

/**
 * Judge one produced turn. With no `expect.produce`, a halt is `PRODUCE_HALT` (its detail carries the
 * validator codes). With it, `outcome` must be equal, `rounds` equal when given, and `failureCodes`
 * set-equal when given (an unobserved null never matches), else `PRODUCE_MISMATCH`. `expect.tools`
 * compares `toolCalls` in order (same count, equal tool name, deep-equal input), else `TOOLS_MISMATCH`.
 */
export function judgeProduce(result: ProducerTurnResult, expect: TurnExpect | undefined, path = '$'): KitFinding[] {
  const findings: KitFinding[] = []
  const want = expect?.produce
  if (want === undefined) {
    if (result.outcome === 'halt') findings.push(kitFinding('PRODUCE_HALT', { path, detail: (result.failureCodes ?? []).join(', ') }))
  } else {
    const problems: string[] = []
    if (want.outcome !== result.outcome) problems.push(`outcome: expected ${want.outcome}, got ${result.outcome}`)
    if (want.rounds !== undefined && want.rounds !== result.rounds) problems.push(`rounds: expected ${want.rounds}, got ${result.rounds}`)
    if (want.failureCodes !== undefined && (result.failureCodes === null || !sameSet(want.failureCodes, result.failureCodes))) {
      problems.push(`failureCodes: expected [${want.failureCodes.join(', ')}], got ${result.failureCodes === null ? 'not observed' : `[${result.failureCodes.join(', ')}]`}`)
    }
    if (problems.length > 0) findings.push(kitFinding('PRODUCE_MISMATCH', { path: `${path}.expect.produce`, detail: problems.join('; ') }))
  }
  const tools = expect?.tools
  if (tools !== undefined) {
    const got = result.toolCalls
    const same = tools.length === got.length && tools.every((t, i) => t.tool === got[i]!.tool && deepEqual(t.input, got[i]!.input))
    if (!same) findings.push(kitFinding('TOOLS_MISMATCH', { path: `${path}.expect.tools`, detail: `expected ${JSON.stringify(tools)}, got ${JSON.stringify(got)}` }))
  }
  return findings
}

/** The `ProduceTurn` the transport and `runScenario` take: run the turn through `produce()` and judge it. */
export const produceTurn: ProduceTurn = async (input, turn, ctx) => {
  const result = await runProducerTurn(input, turn.respond.rounds, ctx.catalog, {
    ...(turn.respond.tools !== undefined ? { tools: turn.respond.tools } : {}),
    ...(turn.respond.maxRounds !== undefined ? { maxRounds: turn.respond.maxRounds } : {}),
  })
  return { lines: result.lines, findings: judgeProduce(result, turn.expect, `$.turns[${ctx.turnIndex}]`) }
}
