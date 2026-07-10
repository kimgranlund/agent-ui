// html.ts — the HTML grammar (LLD-C6, SPEC-C4). `<!--…-->` block comments (carry across lines), attribute
// `"`/`'` values, tag names classified as `keyword` via a small context-sensitive rule (`tagNameAfterAngle`
// — the word immediately after `<` or `</`, since tag names are not a closed set), `<`/`>`/`=`/`/`
// punctuation. Entities (`&amp;`, `&#39;`) stay plain text — not a construct this grammar recognizes.

import type { Token } from '../../core/token.ts'
import { scan, type BlockOpeners } from '../scan.ts'

const PUNCTUATION = new Set(['<', '>', '=', '/'])

const OPEN: BlockOpeners = {
  blockComment: { open: '<!--', close: '-->' },
  strings: ['"', "'"],
  punctuation: PUNCTUATION,
  extraWordChars: '-', // tag/attribute names may contain hyphens (custom elements, data-* attrs)
  tagNameAfterAngle: true,
}

export function html(code: string): Token[] {
  return scan(code, OPEN)
}
