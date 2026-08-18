// document-budget.ts — hard size/token budgets for document ingestion (req-doc-ingestion R6, GH #1210).
// Three constants in ONE module (the ticket's own placement law) plus the head-truncate-with-marker
// helper every extractor — and later, the per-agent aggregate cap (#1211's composer wiring) — calls
// through, never duplicated per caller. Truncation is always VISIBLE (never silent, F5's context-rot
// grounding): the marker states exactly how much text survived vs. how much existed.

/** Per-file RAW input cap (bytes) — enforced BEFORE extraction runs (`extractDocumentText`), so an
 *  oversized file never even reaches an extractor. */
export const MAX_RAW_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

/** Per-document EXTRACTED-text cap (chars) — ~12k tokens at a ~4-chars/token estimate (R6). Applied
 *  once, after extraction, inside `extractDocumentText` itself. */
export const MAX_DOCUMENT_CHARS = 50_000

/** Per-agent aggregate KNOWLEDGE cap (chars), summed across every ENABLED resource entry's extracted
 *  text — R6's third budget. NOT enforced by this module (there is no "every entry" input here, only a
 *  single document's text); named here so the composer/prompt-composition side (#1211 and beyond) reads
 *  the SAME constant instead of a second hand-copied number drifting from this one. */
export const MAX_AGENT_KNOWLEDGE_CHARS = 200_000

export interface TruncationResult {
  /** The (possibly truncated) text — always `<= maxChars` in length. */
  text: string
  /** `true` iff `text` was cut short of `originalChars`. */
  truncated: boolean
  /** The original, pre-truncation character count. */
  originalChars: number
}

/**
 * Head-truncate `text` to `maxChars`, appending a VISIBLE marker naming exactly how much text survived
 * vs. the original total — `…[truncated: N of M chars]` (R6's own AC; F5's context-rot grounding: a
 * silent cut is worse than an honest one). The marker counts against the budget itself: the returned
 * `text`'s length never exceeds `maxChars`, so a caller composing this straight into a prompt never has
 * to re-check size after the fact.
 *
 * `text.length <= maxChars` is the no-op case: `text` is returned unchanged, `truncated: false`.
 * `maxChars <= 0` is treated as a zero budget (the marker alone, no kept text) rather than thrown — a
 * degenerate but well-defined result a caller can still render.
 */
export function truncateToBudget(text: string, maxChars: number): TruncationResult {
  const originalChars = text.length
  if (originalChars <= maxChars) return { text, truncated: false, originalChars }

  const budget = Math.max(0, maxChars)
  const markerFor = (kept: number): string => `…[truncated: ${kept} of ${originalChars} chars]`

  // Solve for `kept` directly (the marker's length depends only on `kept`'s and `originalChars`'s digit
  // counts), then re-check: growing `kept` by one can occasionally cross a power-of-ten boundary and
  // widen the marker by a digit, which the loop below corrects in at most a couple of passes — each pass
  // strictly shrinks `kept`, so it always terminates.
  let kept = Math.max(0, budget - markerFor(budget).length)
  let marker = markerFor(kept)
  let out = text.slice(0, kept) + marker
  while (out.length > budget && kept > 0) {
    kept -= 1
    marker = markerFor(kept)
    out = text.slice(0, kept) + marker
  }
  if (out.length > budget) {
    // Degenerate case no realistic MAX_DOCUMENT_CHARS/MAX_AGENT_KNOWLEDGE_CHARS budget ever triggers:
    // `budget` is smaller than even the empty-kept marker's own footprint. Hard-slice the marker text so
    // the "result never exceeds budget" invariant holds unconditionally, with no thrown error.
    out = marker.slice(0, budget)
  }
  return { text: out, truncated: true, originalChars }
}
