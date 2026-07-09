// avatar-initials.ts — the pure, DOM-free initials derivation for ui-avatar (LLD-C2, feed-family.lld.md
// §3; SPEC-R5). A plain function over a string — no DOM, no signals, unit-testable without a browser
// (the stat-model.ts / attachment-meta.ts pure-core precedent).
//
// SPEC-R5: first grapheme of the first word + first grapheme of the last word (a single word yields one
// grapheme), locale-uppercased. Grapheme-safe via `Intl.Segmenter('grapheme')` with an `Array.from`
// code-point fallback for environments where Segmenter is unavailable (failure mode #4, the LLD ledger).
// '' / whitespace-only ⇒ '' — the caller (avatar.ts) falls through to the person-glyph link of the chain.

const segmenter: Intl.Segmenter | null =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null

/** The first grapheme cluster of a non-empty string (code-point-safe fallback when Segmenter is absent). */
function firstGrapheme(word: string): string {
  if (segmenter) {
    const first = segmenter.segment(word)[Symbol.iterator]().next()
    return first.done ? '' : first.value.segment
  }
  return Array.from(word)[0] ?? ''
}

/** SPEC-R5: first grapheme of first word + first grapheme of last word (single word ⇒ one grapheme),
 *  locale-uppercased. Grapheme-safe via Intl.Segmenter('grapheme') with an Array.from code-point
 *  fallback (ledger §10.4). '' / whitespace-only ⇒ '' (the caller falls through to the glyph). */
export function initialsFrom(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''

  const first = firstGrapheme(words[0] as string)
  const initials = words.length === 1 ? first : first + firstGrapheme(words[words.length - 1] as string)
  return initials.toLocaleUpperCase()
}
