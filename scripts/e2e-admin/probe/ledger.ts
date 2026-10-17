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
  const m = String(model ?? '')
  const [inPrice, outPrice] = PRICES[Object.keys(PRICES).find((k) => m.includes(k)) ?? FALLBACK]
  const input = (u.inputTokens ?? 0) + (u.cacheReadInputTokens ?? 0) + 1.25 * (u.cacheCreationInputTokens ?? 0)
  return (input * inPrice + (u.outputTokens ?? 0) * outPrice) / 1e6
}

/** The model family a model id names (`haiku`, `sonnet`, `opus`), else the id itself, else `default`. */
export function modelFamily(model: string): string {
  return Object.keys(PRICES).find((k) => model.includes(k)) ?? (model === '' ? 'default' : model)
}

/** The scenario and sample a probe run name encodes: `<scenario>-<model family>-<n>` (the round generators) or
 *  `<scenario>-<n>` (T-0329's samples, `t0329-mix-7`). A name with no numeric tail is its own scenario, sample 1
 *  (`t0329-mix-pontoon`). The family is matched first, so `spanish-21-haiku-1` keeps its `21`. */
export function runNameParts(name: string): { scenario: string; sample: number } {
  const m = /^(.+?)(?:-(?:haiku|sonnet|opus))?-(\d+)$/.exec(name)
  return m === null ? { scenario: name, sample: 1 } : { scenario: m[1], sample: Number(m[2]) }
}
