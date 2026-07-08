// gen-ui-mode.ts — ADR-0090 §1/§4: the per-turn Gen-UI mode axis that SCALES the ADR-0089
// clarify/negotiate grammar between a directive `'specific'` disposition and an exploratory
// `'blue-sky'` disposition. `'default'` — and an ABSENT `mode` — reproduce today's ADR-0089 grammar
// byte-for-byte (Decision §1: "Absent `mode` ⇒ default ⇒ zero regression", the ADR-0088
// opt-out-default discipline). `buildSystemPrompt`/`ProduceOptions` therefore treat `undefined` and
// `'default'` identically — this module gives the SHARED literal for that neutral value so callers
// (a future demo selector included) never invent their own spelling of it.
//
// Structural is deliberately NOT a member of this union (Decision §3): it is the already-shipped
// recorded transport (`createRecordedTransport`), a transport choice at a different layer, never a
// live-grammar disposition `buildSystemPrompt` composes over.
//
// Zero-dep, pure (SPEC-N5): no imports.

// The runtime-checkable source of truth for the axis's closed 3-member set (this repo's
// `erasableSyntaxOnly` idiom — `as const` + a derived literal union — CLAUDE.md): every other module
// that needs to validate, enumerate, or render the set derives from THIS array rather than
// re-spelling its own copy (`dev-proxy-plugin.ts`'s membership check, `provider-switcher.ts`'s option
// list) — a single place to extend for a future 4th mode.
export const GEN_UI_MODES = ['default', 'specific', 'blue-sky'] as const

export type GenUiMode = (typeof GEN_UI_MODES)[number]

/** The zero-regression neutral value — equivalent to an absent `mode` everywhere this axis is read. */
export const DEFAULT_GEN_UI_MODE: GenUiMode = 'default'
