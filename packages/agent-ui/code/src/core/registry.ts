// registry.ts — the highlighter registry (LLD-C4, SPEC-C2): a pack-independent, SIGNAL-FREE holder of the
// active highlighter — one engine slot (not a Map of packs — last-wins registration, never a resolution
// chain). `tokenize` is the ONE place resolution precedence lives — `project.ts` reads it, never
// re-implements it (the icons `registry.body()` precedent). Deliberately signal-free (the ADR-0065 cl.4(b)
// reason, applied here): never invert the `components -> code` arrow — the no-kernel gate below is the
// standing proof.

import { roundTrips, type Highlighter, type Token } from './token.ts'

export interface HighlighterRegistry {
  /** Register the active highlighter. Last registration wins (SPEC-C2 AC2). */
  registerHighlighter(fn: Highlighter): void
  activeHighlighter(): Highlighter | null
  /** Tokenize `code` for `language` through the active highlighter. Verbatim (`[{plain, code}]`) when
   *  nothing is registered; the round-trip invariant is ENFORCED at this boundary (SPEC-C2 AC4). */
  tokenize(code: string, language: string): Token[]
}

export class Registry implements HighlighterRegistry {
  #active: Highlighter | null = null

  registerHighlighter(fn: Highlighter): void {
    this.#active = fn // last-wins (SPEC-C2 AC2) — no re-registration warning; this is expected traffic
  }

  activeHighlighter(): Highlighter | null {
    return this.#active
  }

  tokenize(code: string, language: string): Token[] {
    const fn = this.#active
    if (fn === null) return [{ kind: 'plain', text: code }] // verbatim-empty (SPEC-C2 AC1)
    let out: Token[] | null
    try {
      out = fn(code, language)
    } catch {
      out = null // a THROW always downgrades — never let a coincidental [] (e.g. for empty `code`) pass
    }
    if (out !== null && roundTrips(out, code)) return out // round-trips — accept
    // The fidelity floor — DOWNGRADE, logged not silent (SPEC-C2 AC4; the ADR-0113 plain-wins spirit).
    // The SAME branch fires whether the highlighter THREW or returned non-round-tripping output — the
    // user never sees corrupted code, and (review-driven, 2026-07-10) never sees a blank/failed render
    // either: a throw would otherwise propagate through projectHighlight -> renderBlocks -> ui-markdown's
    // connected() effect and blank the render, breaking the SPEC-C2/LLD §14 "the user never sees corrupted
    // code" promise for the throw case specifically.
    console.warn(
      `[@agent-ui/code] highlighter (${fn.name || 'anonymous'}) output did not round-trip for language "${language}" — falling back to verbatim`,
    )
    return [{ kind: 'plain', text: code }]
  }
}

/** The default singleton — what `tokenize`/`registerHighlighter`/`projectHighlight` read by default. */
export const highlighterRegistry: HighlighterRegistry = new Registry()

/** Sugar over the singleton. */
export const registerHighlighter = (fn: Highlighter): void => highlighterRegistry.registerHighlighter(fn)

/** Sugar over the singleton. */
export const tokenize = (code: string, language: string): Token[] => highlighterRegistry.tokenize(code, language)
