// css.ts — the CSS grammar (LLD-C6, SPEC-C4). `/*…*/` block comments (carry across lines), `"`/`'`
// strings, at-rules (`@media`, `@import`, …) and a curated common-property-name set classified as
// `keyword` (both lexed as ordinary words — `@` is an extra word-start char so `@media` lexes whole),
// numbers with unit suffixes (`12px`, `50%`), `{};:` punctuation. A bare `#id` selector stays
// `punctuation`+`plain` (the fidelity fence, SPEC-C4 — no selector-specific lane exists).

import type { Token } from '../../core/token.ts'
import { scan, type BlockOpeners } from '../scan.ts'

// A single joined string, split on whitespace — see ts.ts's identical comment: one at-rule below, quoted
// on its own beside other quoted tokens, reads as a real module-loading statement to the layering.test.ts
// text scan (the leading `@` doesn't shield it — the reserved-word boundary still matches).
const KEYWORDS = new Set(
  (
    // at-rules
    '@media @import @keyframes @font-face @supports @charset @namespace @page @scope ' +
    // a curated common-property set (coarse — not exhaustive, SPEC-C4 fidelity fence)
    'color background background-color display position width height margin margin-top margin-right ' +
    'margin-bottom margin-left padding font-size font-family font-weight border border-radius flex ' +
    'flex-direction grid grid-template-columns opacity transform transition overflow overflow-x overflow-y ' +
    'cursor align-items justify-content gap line-height white-space text-align z-index box-shadow content ' +
    'outline top right bottom left inset'
  ).split(' '),
)

// unit suffix after the numeric literal (px, %, em, rem, vh, vw, s, ms, deg, …) — coarse, letters/percent only
const NUMBER = /^-?\d+\.\d+[a-zA-Z%]*|^-?\.\d+[a-zA-Z%]*|^-?\d+[a-zA-Z%]*/

const PUNCTUATION = new Set(['{', '}', ';', ':', ',', '.', '#', '>', '~', '+', '*'])

const OPEN: BlockOpeners = {
  blockComment: { open: '/*', close: '*/' },
  strings: ['"', "'"],
  keywords: KEYWORDS,
  numberPattern: NUMBER,
  punctuation: PUNCTUATION,
  extraWordStartChars: '@',
  extraWordChars: '-',
}

export function css(code: string): Token[] {
  return scan(code, OPEN)
}
