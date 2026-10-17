// scripts/e2e-admin/probe/ledger.ts: what `run-capped.ts` (which writes a round) and `signals.ts` (which reads it)
// both need: the price table, the cost of one usage block, and the scenario and sample a run name encodes (T-0342).
// A leaf module, so the two never import each other.

export const EVALS_ROUNDS = '.sdlc/evals/rounds'

export const PRICES_SOURCE = 'claude-api skill price table, 2026-10-06'
/** USD per million tokens, input and output (claude-api skill price table, 2026-10-06). */
export const PRICES: Readonly<Record<string, readonly [number, number]>> = {
  haiku: [0.1, 0.5],
  sonnet: [2, 10],
  opus: [4, 20],
}
export const FALLBACK = 'opus' // an unknown model is priced at the dearest family, never under-counted

export interface TraceUsage {
  inputTokens?: number
  outputTokens?: number
  cacheReadInputTokens?: number
  cacheCreationInputTokens?: number
}

/** The estimated USD of one usage block at the PRICES table; cache reads priced as input, cache writes at 1.25x. */
export function usageCost(model: unknown, u: TraceUsage = {}): number {
  const [inPrice, outPrice] = PRICES[modelFamily(String(model ?? ''))] ?? PRICES[FALLBACK]
  const input = (u.inputTokens ?? 0) + (u.cacheReadInputTokens ?? 0) + 1.25 * (u.cacheCreationInputTokens ?? 0)
  return (input * inPrice + (u.outputTokens ?? 0) * outPrice) / 1e6
}

/** The model family a model id names (`haiku`, `sonnet`, `opus`), else the id itself, else `default`. */
export function modelFamily(model: string): string {
  return Object.keys(PRICES).find((k) => model.includes(k)) ?? (model === '' ? 'default' : model)
}

/** The scenario and sample a probe run name encodes. `<scenario>-<model family>-<n>` (the round generators) always
 *  ends in its sample, and the family is matched first, so `spanish-21-haiku-1` keeps its `21`. A bare `-<n>` tail
 *  with no family before it is a sample only when another of `siblings` (the round's other run names) shares the
 *  stem with a different number: T-0329's `t0329-mix-1` to `-30`. A lone one is part of the scenario
 *  (`regress-croupier-spanish-21`), and a name with no numeric tail is its own scenario (`t0329-mix-pontoon`). */
export function runNameParts(name: string, siblings: readonly string[] = []): { scenario: string; sample: number } {
  const family = /^(.+)-(?:haiku|sonnet|opus)-(\d+)$/.exec(name)
  if (family !== null) return { scenario: family[1], sample: Number(family[2]) }
  const bare = /^(.+)-(\d+)$/.exec(name)
  if (bare !== null && siblings.some((s) => s !== name && /^(.+)-\d+$/.exec(s)?.[1] === bare[1])) return { scenario: bare[1], sample: Number(bare[2]) }
  return { scenario: name, sample: 1 }
}
