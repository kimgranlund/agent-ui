// observe.ts: run ONE producer turn through the real `produce()` loop and record what happened (GH #1810).
//
// The provider is wrapped to count `stream()` calls and capture each round's raw text. `produce()` makes
// exactly one `deps.provider.stream` call per round, so repair accounting counts `produce()` rounds
// only; a provider-level retry lives inside one `stream()` call and is never counted (GH #1797).
//
// `rounds` and `failureCodes` come from the meta-line `TurnTrace` when one rides the turn (it rides only
// when the model emits a note). Without a trace, `rounds` is the wrapper's call count; on `ProduceHalt`,
// `failureCodes` is the halt's `failures[].code`; otherwise it is `null`, reported as not observed and
// never invented. `TurnTrace` is read here, never changed.

import { produce, ProduceHalt } from '../../src/agent/produce.ts'
import type { ProduceDeps } from '../../src/agent/produce.ts'
import type { AgentProvider } from '../../src/agent/agent-transport.ts'
import { readMetaLine } from '../../src/agent/meta-line.ts'
import type { Catalog } from '../../src/catalog/catalog.ts'
import { repairOutcome } from './score.ts'

export type RepairOutcome = 'first-pass' | 'eventual' | 'halt'

export interface TurnObservation {
  readonly outcome: RepairOutcome
  readonly rounds: number
  readonly failureCodes: string[] | null
  /** Component types of the validated A2UI lines the turn shipped. */
  readonly emittedTypes: string[]
  /** Per round: the component types the raw provider text attempted (unparseable lines skipped). */
  readonly attemptedTypes: string[][]
}

export interface ObserveDeps {
  provider: AgentProvider
  retrieve?: ProduceDeps['retrieve']
  model?: string
}

const MAX_ROUNDS = 3

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** The `updateComponents.components[].component` values in one line, or `[]`. */
function componentTypesOf(line: string): string[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return []
  }
  if (!isObject(parsed) || !isObject(parsed.updateComponents)) return []
  const components = parsed.updateComponents.components
  if (!Array.isArray(components)) return []
  return components.flatMap((c) => (isObject(c) && typeof c.component === 'string' ? [c.component] : []))
}

/** Every component type attempted in one round's raw text. A fenced or noisy line simply fails to parse. */
export function attemptedTypesOf(raw: string): string[] {
  const out: string[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.length > 0) out.push(...componentTypesOf(trimmed))
  }
  return out
}

/** Run one turn through `produce()` with `maxRounds: 3` and observe it. */
export async function observeTurn(input: { catalog: Catalog; prompt: string }, deps: ObserveDeps): Promise<TurnObservation> {
  const raws: string[] = []
  let calls = 0
  const provider: AgentProvider = {
    async *stream(req) {
      calls += 1
      const index = raws.length
      raws.push('')
      for await (const frag of deps.provider.stream(req)) {
        raws[index] += frag
        yield frag
      }
    },
  }
  const produceDeps: ProduceDeps = { provider, retrieve: deps.retrieve ?? (() => []), catalog: input.catalog }
  const lines: string[] = []
  let haltCodes: string[] | undefined
  try {
    for await (const line of produce(
      { kind: 'intent', text: input.prompt, session: { turns: [] } },
      produceDeps,
      { maxRounds: MAX_ROUNDS, ...(deps.model !== undefined ? { model: deps.model } : {}) },
    )) {
      lines.push(line)
    }
  } catch (err) {
    if (!(err instanceof ProduceHalt)) throw err
    haltCodes = err.failures.map((f) => f.code)
  }

  const attemptedTypes = raws.map(attemptedTypesOf)
  if (haltCodes !== undefined) {
    return { outcome: repairOutcome(true, calls), rounds: calls, failureCodes: haltCodes, emittedTypes: [], attemptedTypes }
  }

  let traceRounds: number | undefined
  let traceCodes: string[] | undefined
  const emitted: string[] = []
  for (const line of lines) {
    const meta = readMetaLine(line)
    if (meta !== undefined) {
      const trace = meta.a2uiMeta.trace
      if (trace !== undefined && typeof trace.rounds === 'number' && traceRounds === undefined) {
        traceRounds = trace.rounds
        traceCodes = Array.isArray(trace.failureCodes) ? [...trace.failureCodes] : undefined
      }
      continue
    }
    for (const type of componentTypesOf(line)) if (!emitted.includes(type)) emitted.push(type)
  }
  const rounds = traceRounds ?? calls
  return {
    outcome: repairOutcome(false, rounds),
    rounds,
    failureCodes: traceCodes ?? null,
    emittedTypes: emitted,
    attemptedTypes,
  }
}
