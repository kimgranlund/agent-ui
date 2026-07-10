// python.ts — the Python grammar (LLD-C6, SPEC-C4). `#` line comments, `'`/`"` single-line strings PLUS
// `'''…'''`/`"""…"""` triple-quoted strings (block-mode carries across lines), a fixed keyword set,
// numbers, a punctuation set. Indentation stays plain (no significant-whitespace lane — this is a
// scanning aid, not a parser).

import type { Token } from '../../core/token.ts'
import { scan, type BlockOpeners } from '../scan.ts'

// A single joined string, split on whitespace — see ts.ts's identical comment: avoids two reserved words
// below reading as a real module-loading statement to the layering.test.ts text scan.
const KEYWORDS = new Set(
  ('def return if elif else for while in not and or is class import from as try except finally raise ' +
    'with lambda yield pass break continue global nonlocal del assert True False None self async await'
  ).split(' '),
)

const NUMBER = /^\d+\.\d+(?:[eE][+-]?\d+)?|^\.\d+(?:[eE][+-]?\d+)?|^\d+(?:[eE][+-]?\d+)?/

const PUNCTUATION = new Set([
  '{', '}', '[', ']', '(', ')', ':', ',', '.', '+', '-', '*', '/', '%', '=', '<', '>', '!', '&', '|', '^', '~',
])

const OPEN: BlockOpeners = {
  lineComment: '#',
  strings: ["'", '"'],
  tripleStrings: ["'''", '"""'],
  keywords: KEYWORDS,
  numberPattern: NUMBER,
  punctuation: PUNCTUATION,
}

export function python(code: string): Token[] {
  return scan(code, OPEN)
}
