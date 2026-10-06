// scripted-provider.ts: the kit's keyless `AgentProvider` (T-0011). Round n yields
// `rounds[min(n, len - 1)]`, the `tools/agent-eval/scripted.ts` precedent.
//
// A tool round (`{ tool, input, then }`) mirrors what a real adapter's tool loop does from produce()'s side:
// it reports the `tool` provider event, calls the request's `executeTool(tool, input)` exactly once, records
// the result text (or the rejection message) in `toolCalls`, then yields `then` verbatim as the round's
// model text. The tool result itself is never appended to the yielded stream: a real adapter feeds it back
// to the model and yields only the model's text (the `AgentProvider.stream` contract). A rejected tool call
// is recorded as text, never thrown, so a failing integration degrades the turn and never breaks it. With no
// `executeTool` on the request, the call is recorded as `unavailable` and `then` still yields.

import type { AgentProvider } from '../../src/agent/agent-transport.ts'
import type { ScriptedToolRound } from './scenario.ts'

export interface ProviderToolCall {
  tool: string
  input: Record<string, unknown>
  /** The tool's result text, or `error: <message>` for a rejection, or `unavailable`. */
  result: string
}

export interface ScriptedProvider extends AgentProvider {
  /** How many `stream()` calls (producer rounds) ran. */
  readonly calls: number
  readonly toolCalls: ProviderToolCall[]
}

export function scriptedProvider(rounds: readonly (string | ScriptedToolRound)[]): ScriptedProvider {
  if (rounds.length === 0) throw new Error('testkit: a scripted provider needs at least one round')
  let n = 0
  const toolCalls: ProviderToolCall[] = []
  return {
    get calls() {
      return n
    },
    toolCalls,
    async *stream(req) {
      const round = rounds[Math.min(n, rounds.length - 1)]!
      n += 1
      if (typeof round === 'string') {
        yield round
        return
      }
      req.onEvent?.({ kind: 'tool', text: round.tool })
      let result: string
      if (req.executeTool === undefined) result = 'unavailable'
      else {
        try {
          result = await req.executeTool(round.tool, round.input, req.signal)
        } catch (err) {
          result = `error: ${err instanceof Error ? err.message : String(err)}`
        }
      }
      toolCalls.push({ tool: round.tool, input: round.input, result })
      yield round.then
    },
  }
}
