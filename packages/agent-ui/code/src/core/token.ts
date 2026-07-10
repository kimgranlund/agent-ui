// token.ts — the token stream types + the shared round-trip predicate (LLD-C3, SPEC-C2). Zero imports —
// the sole runtime export is `roundTrips`, a pure helper every tokenizer test and the registry boundary
// share (one definition, no drift). `TokenKind` is an `as const`-free literal union (erasableSyntaxOnly
// bans `enum`).

/** The five classed tiers a highlighter may assign, plus `plain` (unclassified, the default/fallback). */
export type TokenKind = 'plain' | 'comment' | 'string' | 'keyword' | 'number' | 'punctuation'

/** One span of a tokenized code string. The token STREAM (`Token[]`) is a contiguous, gap-free partition
 *  of the input — concatenating every `text` reproduces the input exactly (the round-trip invariant,
 *  SPEC-C2). */
export interface Token {
  readonly kind: TokenKind
  readonly text: string
}

/** An engine: consumer-supplied or the bundled `./highlight` one. The core owns only the registry + type,
 *  never an engine (SPEC-C2). */
export type Highlighter = (code: string, language: string) => Token[]

/** The SPEC-C2 round-trip invariant as a one-line predicate: `true` iff `tokens` is a contiguous,
 *  gap-free partition of `code` — concatenating every token's `text` reproduces `code` exactly. Shared by
 *  every tokenizer test and the registry's boundary enforcement (core/registry.ts) — one definition, no
 *  drift. Test-only in spirit (not re-exported from the package barrel, LLD-C11) but a real runtime
 *  function so the registry can reuse the exact check. */
export const roundTrips = (tokens: Token[], code: string): boolean =>
  tokens.map((t) => t.text).join('') === code
