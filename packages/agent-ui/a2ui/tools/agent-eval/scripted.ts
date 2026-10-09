// scripted.ts: the keyless scripted provider the selftest and the vitest stubs drive (GH #1810).
//
// On call n it yields `rounds[min(n, len - 1)]`, the `stubProvider` shape in
// `src/live-agent/produce-loop.test.ts`. Every result it produces is labeled `scripted` by the CLI and
// is never presented as a model score.
//
// A tool round (`{ tool, input, then }`, T-0060) mirrors `tools/testkit/scripted-provider.ts`, re-implemented
// here because the kit imports from this dir: it calls the request's `executeTool(tool, input)` once when
// the request carries one, else records nothing, then yields `then`. A rejected call is swallowed, so a
// withheld or failing tool degrades the round and never breaks it.

import type { AgentProvider } from '../../src/agent/agent-transport.ts'

export interface ScriptedToolRound {
  tool: string
  input: Record<string, unknown>
  then: string
}

export type ScriptedRound = string | ScriptedToolRound

export function scriptedProvider(rounds: readonly ScriptedRound[]): AgentProvider {
  if (rounds.length === 0) throw new Error('agent-eval: a scripted provider needs at least one round')
  let n = 0
  return {
    async *stream(req) {
      const round = rounds[Math.min(n, rounds.length - 1)]!
      n += 1
      if (typeof round === 'string') {
        yield round
        return
      }
      if (req.executeTool !== undefined) {
        try {
          await req.executeTool(round.tool, round.input, req.signal)
        } catch {
          // a rejected call is the tool's answer to the model, never a broken round
        }
      }
      yield round.then
    },
  }
}
