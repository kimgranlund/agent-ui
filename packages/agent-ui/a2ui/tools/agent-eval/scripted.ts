// scripted.ts: the keyless scripted provider the selftest and the vitest stubs drive (GH #1810).
//
// On call n it yields `rounds[min(n, len - 1)]`, the `stubProvider` shape in
// `src/live-agent/produce-loop.test.ts`. Every result it produces is labeled `scripted` by the CLI and
// is never presented as a model score.

import type { AgentProvider } from '../../src/agent/agent-transport.ts'

export function scriptedProvider(rounds: readonly string[]): AgentProvider {
  if (rounds.length === 0) throw new Error('agent-eval: a scripted provider needs at least one round')
  let n = 0
  return {
    async *stream() {
      const out = rounds[Math.min(n, rounds.length - 1)]!
      n += 1
      yield out
    },
  }
}
