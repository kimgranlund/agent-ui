// json.ts — the JSON grammar (LLD-C6, SPEC-C4). Double-quoted strings (keys AND values — no distinction at
// the highlighter level), `true`/`false`/`null` literals, numbers (incl. a leading `-` sign), the
// structural punctuation set. No comments (JSON has none).

import type { Token } from '../../core/token.ts'
import { scan, type BlockOpeners } from '../scan.ts'

const KEYWORDS = new Set(['true', 'false', 'null'])

const NUMBER = /^-?\d+\.\d+(?:[eE][+-]?\d+)?|^-?\.\d+(?:[eE][+-]?\d+)?|^-?\d+(?:[eE][+-]?\d+)?/

const PUNCTUATION = new Set(['{', '}', '[', ']', ':', ','])

const OPEN: BlockOpeners = {
  strings: ['"'],
  keywords: KEYWORDS,
  numberPattern: NUMBER,
  punctuation: PUNCTUATION,
}

export function json(code: string): Token[] {
  return scan(code, OPEN)
}
