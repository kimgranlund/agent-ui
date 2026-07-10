// markdown.ts — the markdown-FENCES grammar (LLD-C6, SPEC-C4). This is the `./highlight` pack's tokenizer
// for a code string whose declared language is "markdown/md" (e.g. a `ui-code language="md"` block) — NOT
// the document parser (`../../markdown/parse.ts`, a wholly separate concern, LLD-C8). Fence-oriented only:
// a fenced ```` ``` ```` block (carries across lines, tier `string`) and an inline `` ` `` code span
// classify; everything else — headings, emphasis markers, list bullets, links — stays `plain` (ADR-0119
// cl.3's "markdown fences" scope).

import type { Token } from '../../core/token.ts'
import { scan, type BlockOpeners } from '../scan.ts'

const OPEN: BlockOpeners = {
  tripleStrings: ['```'],
  strings: ['`'],
}

export function markdown(code: string): Token[] {
  return scan(code, OPEN)
}
