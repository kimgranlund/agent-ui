// shell.ts — the shell grammar (LLD-C6, SPEC-C4). `#` line comments, `'`/`"` strings, a small
// builtin/keyword set, `|`/`>`/`&`/`;` punctuation. `$VAR` stays plain — no variable-interpolation lane
// (the `$` sigil is punctuation; the following name is an ordinary, unclassified word).

import type { Token } from '../../core/token.ts'
import { scan, type BlockOpeners } from '../scan.ts'

const KEYWORDS = new Set([
  'if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case', 'esac', 'function', 'in',
  'return', 'exit', 'export', 'local', 'readonly', 'set', 'unset', 'echo', 'break', 'continue',
])

const NUMBER = /^\d+/

const PUNCTUATION = new Set(['|', '>', '<', '&', ';', '(', ')', '{', '}', '$'])

const OPEN: BlockOpeners = {
  lineComment: '#',
  strings: ["'", '"'],
  keywords: KEYWORDS,
  numberPattern: NUMBER,
  punctuation: PUNCTUATION,
  extraWordChars: '-', // flag/command names, e.g. "--verbose"
}

export function shell(code: string): Token[] {
  return scan(code, OPEN)
}
