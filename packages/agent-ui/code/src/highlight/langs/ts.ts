// ts.ts — the ts/js grammar (LLD-C6, SPEC-C4). One grammar serves both language keys ('ts' and 'js', wired
// in highlight/index.ts's dispatch table). Coarse on purpose: `//`/`/*…*/` comments (block-mode carries),
// `'`/`"` single-line strings, `` ` `` template literals (block-mode carries, no interpolation recursion),
// a fixed reserved-word set, int/float/hex numbers, a punctuation set.

import type { Token } from '../../core/token.ts'
import { scan, type BlockOpeners } from '../scan.ts'

// A single joined string, split on whitespace — NOT individually-quoted array elements. Kept this way
// deliberately: two of the reserved words below, sitting as their OWN separately-quoted array elements
// beside a third reserved word naming a module source, would be textually indistinguishable from a real
// module-loading statement to the repo's layering.test.ts trip-wire (a plain text scan, not a real parser
// — the same documented blind spot router/src/layering.test.ts carries). One long string sidesteps the
// collision entirely; case-locked, not smaller.
const KEYWORDS = new Set(
  ('const let var function return if else for while do switch case default break continue class extends ' +
    'super new this import export from as try catch finally throw typeof instanceof in of void delete ' +
    'yield async await true false null undefined interface type enum implements public private protected ' +
    'static readonly abstract namespace declare get set constructor satisfies'
  ).split(' '),
)

const NUMBER = /^0[xX][0-9a-fA-F]+|^\d+\.\d+(?:[eE][+-]?\d+)?|^\.\d+(?:[eE][+-]?\d+)?|^\d+(?:[eE][+-]?\d+)?/

const PUNCTUATION = new Set([
  '{', '}', '(', ')', '[', ']', ';', ',', '.', ':', '?', '!', '+', '-', '*', '/', '%', '=', '<', '>', '&',
  '|', '^', '~',
])

const OPEN: BlockOpeners = {
  lineComment: '//',
  blockComment: { open: '/*', close: '*/' },
  strings: ["'", '"'],
  template: '`',
  keywords: KEYWORDS,
  numberPattern: NUMBER,
  punctuation: PUNCTUATION,
  extraWordStartChars: '$', // JS/TS identifiers may start with `$` (jQuery-style, Angular locals, …)
  extraWordChars: '$',
}

export function tsjs(code: string): Token[] {
  return scan(code, OPEN)
}
