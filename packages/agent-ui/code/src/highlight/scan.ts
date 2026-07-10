// scan.ts — the shared lexer core (LLD-C6, SPEC-C4). Line-oriented, coarse, single-level block-mode carry.
// Seven language grammars share this ONE core, each supplying only its opener table (BlockOpeners) — the
// primitives (string-literal spans with escape handling, line/block comments, number lexemes, a keyword
// matcher, a punctuation matcher) plus the ScanState threading live here, once.
//
// The walk: `scan` splits `code` on `\n`, threading a single `ScanState` across lines via `scanLine`. Each
// `\n` becomes its OWN plain boundary token (never absorbed into a carried tier's span) — a deliberate
// simplification (coarse on purpose, ADR-0119 cl.3) that keeps newline handling uniform and never breaks
// the round-trip invariant. `scanLine` FIRST resolves any carried block mode (consuming up to, and
// including, its closer — or the WHOLE line, unresolved, when no closer appears) and only once the mode is
// null does it fall to the ordinary single-line scan, which may itself OPEN a new block mode that the next
// line inherits (one non-nesting mode at a time — an opener inside an already-open mode never nests).

import type { Token, TokenKind } from '../core/token.ts'

/** What block-mode construct is carrying across a line boundary (SPEC-C4). `null` = no carry — the
 *  ordinary per-line scan applies. */
export type BlockMode = null | 'block-comment' | 'triple-string' | 'template'

/** The carried lexer state between lines: which mode (if any) is open, and the exact delimiter that will
 *  close it. */
export interface ScanState {
  readonly mode: BlockMode
  readonly closer: string
}

export const INITIAL_STATE: ScanState = { mode: null, closer: '' }

/** One language's opener table — the only per-language surface `scan`/`scanLine` read. Every field is
 *  optional; an absent construct simply never matches (e.g. JSON has no comments). */
export interface BlockOpeners {
  /** A line-comment opener (e.g. `//`, `#`) — consumes the rest of the line, no carry. */
  lineComment?: string
  /** A block-comment delimiter pair (e.g. C-style block comments, HTML comments) — carries across lines
   *  when unterminated. */
  blockComment?: { open: string; close: string }
  /** Multi-char, self-closing openers that carry across lines when unterminated (e.g. Python `'''`/`"""`,
   *  a markdown fence ```` ``` ````). Tier: `string`. */
  tripleStrings?: readonly string[]
  /** A single-char, self-closing delimiter that carries across lines when unterminated (JS/TS `` ` ``
   *  template literals). Tier: `string`. No interpolation recursion — coarse. */
  template?: string
  /** Single-char string delimiters that do NOT carry across lines — an unterminated one runs to end of
   *  line, best-effort, never opens a block mode (single-line strings are not a ⟂ construct). */
  strings?: readonly string[]
  /** A fixed keyword set, matched against a lexed WORD verbatim (case-sensitive). */
  keywords?: ReadonlySet<string>
  /** A `^`-anchored number-lexeme pattern, tested against the remaining line at the current position. */
  numberPattern?: RegExp
  /** The punctuation character set — each character its own one-char token. */
  punctuation?: ReadonlySet<string>
  /** Extra characters valid as the FIRST character of a word (default word-start: `[A-Za-z_$]`) — e.g.
   *  `@` for CSS at-rules, so `@media` lexes as one word and can hit the keyword set whole. */
  extraWordStartChars?: string
  /** Extra characters valid WITHIN a word (default word-continuation: `[A-Za-z0-9_$]`) — e.g. `-` for
   *  HTML tag/attribute names and CSS property names. */
  extraWordChars?: string
  /** HTML-only: classify the word immediately following `<` or `</` as `keyword` regardless of any fixed
   *  keyword set (tag names are not a closed set) — a small, named, context-sensitive exception; every
   *  other language classifies purely from the character stream. */
  tagNameAfterAngle?: boolean
}

// `$` is deliberately NOT a default word char — shell's `$VAR` needs `$` to fall through to its own
// punctuation set (SPEC-C4: "$VAR plain"); a language wanting `$`-prefixed identifiers (JS/TS) opts in via
// `extraWordStartChars`/`extraWordChars` instead.
const DEFAULT_WORD_START = /[A-Za-z_]/
const DEFAULT_WORD_CHAR = /[A-Za-z0-9_]/

function isWordStart(ch: string, open: BlockOpeners): boolean {
  return DEFAULT_WORD_START.test(ch) || (open.extraWordStartChars?.includes(ch) ?? false)
}
function isWordChar(ch: string, open: BlockOpeners): boolean {
  return DEFAULT_WORD_CHAR.test(ch) || (open.extraWordChars?.includes(ch) ?? false)
}
function findWordEnd(line: string, start: number, open: BlockOpeners): number {
  let j = start + 1
  while (j < line.length && isWordChar(line[j], open)) j += 1
  return j
}

/** Scan a single-line string starting at `start` (the opening `quote`), handling `\`-escapes. Returns the
 *  index AFTER the closing quote, or `line.length` when unterminated (best-effort — never a block mode,
 *  never throws). */
function findStringEnd(line: string, start: number, quote: string): number {
  let j = start + 1
  while (j < line.length) {
    const c = line[j]
    if (c === '\\') {
      j += 2
      continue
    }
    if (c === quote) return j + 1
    j += 1
  }
  return line.length
}

function tierForMode(mode: Exclude<BlockMode, null>): TokenKind {
  return mode === 'block-comment' ? 'comment' : 'string' // triple-string & template both map to 'string'
}

/** Scan one line (no `\n`) against the carried `state`, returning its tokens and the state to carry into
 *  the next line. Coalesces adjacent `plain` runs (the SPEC-C4 partition contiguity, at the per-line
 *  granularity). */
export function scanLine(line: string, state: ScanState, open: BlockOpeners): { tokens: Token[]; state: ScanState } {
  const tokens: Token[] = []
  const push = (kind: TokenKind, text: string): void => {
    if (text === '') return
    const last = tokens[tokens.length - 1]
    if (last !== undefined && last.kind === kind && kind === 'plain') {
      tokens[tokens.length - 1] = { kind, text: last.text + text }
    } else {
      tokens.push({ kind, text })
    }
  }

  let i = 0
  let mode = state.mode
  let closer = state.closer

  // The carried block mode resolves FIRST — up to (and incl.) the closer, or the whole line if absent.
  if (mode !== null) {
    const idx = line.indexOf(closer, i)
    const tier = tierForMode(mode)
    if (idx === -1) {
      push(tier, line.slice(i)) // the middle-of-block line — the WHOLE line, not plain (SPEC-C4 AC4)
      return { tokens, state: { mode, closer } }
    }
    push(tier, line.slice(i, idx + closer.length))
    i = idx + closer.length
    mode = null
    closer = ''
  }

  let expectTagName = false // HTML-only context flag (tagNameAfterAngle) — see the punctuation/word branches
  while (i < line.length) {
    const rest = line.slice(i)
    const ch = line[i]
    const wasExpectingTag = expectTagName
    expectTagName = false // default for this iteration; a branch below may re-assert it

    if (open.lineComment !== undefined && rest.startsWith(open.lineComment)) {
      push('comment', rest)
      i = line.length
      break
    }

    if (open.blockComment !== undefined && rest.startsWith(open.blockComment.open)) {
      const idx = line.indexOf(open.blockComment.close, i + open.blockComment.open.length)
      if (idx === -1) {
        push('comment', line.slice(i))
        mode = 'block-comment'
        closer = open.blockComment.close
        i = line.length
        break
      }
      push('comment', line.slice(i, idx + open.blockComment.close.length))
      i = idx + open.blockComment.close.length
      continue
    }

    const tripleOpener = open.tripleStrings?.find((t) => rest.startsWith(t))
    if (tripleOpener !== undefined) {
      const idx = line.indexOf(tripleOpener, i + tripleOpener.length)
      if (idx === -1) {
        push('string', line.slice(i))
        mode = 'triple-string'
        closer = tripleOpener
        i = line.length
        break
      }
      push('string', line.slice(i, idx + tripleOpener.length))
      i = idx + tripleOpener.length
      continue
    }

    if (open.template !== undefined && rest.startsWith(open.template)) {
      const idx = line.indexOf(open.template, i + open.template.length)
      if (idx === -1) {
        push('string', line.slice(i))
        mode = 'template'
        closer = open.template
        i = line.length
        break
      }
      push('string', line.slice(i, idx + open.template.length))
      i = idx + open.template.length
      continue
    }

    if (open.strings?.includes(ch) === true) {
      const end = findStringEnd(line, i, ch)
      push('string', line.slice(i, end))
      i = end
      continue
    }

    if (open.numberPattern !== undefined) {
      const m = open.numberPattern.exec(rest)
      if (m !== null && m[0].length > 0) {
        push('number', m[0])
        i += m[0].length
        continue
      }
    }

    if (isWordStart(ch, open)) {
      const end = findWordEnd(line, i, open)
      const word = line.slice(i, end)
      const isKw = (open.tagNameAfterAngle === true && wasExpectingTag) || (open.keywords?.has(word) ?? false)
      push(isKw ? 'keyword' : 'plain', word)
      i = end
      continue
    }

    if (open.punctuation?.has(ch) === true) {
      push('punctuation', ch)
      if (open.tagNameAfterAngle === true) {
        if (ch === '<') expectTagName = true
        else if (ch === '/' && wasExpectingTag) expectTagName = true
      }
      i += 1
      continue
    }

    push('plain', ch)
    i += 1
  }

  return { tokens, state: { mode, closer } }
}

/** Tokenize the whole `code` string against `open` — one language's whole grammar, unconditionally
 *  round-tripping (SPEC-C4). Threads `ScanState` across every line boundary; each `\n` is its own plain
 *  boundary token. */
export function scan(code: string, open: BlockOpeners): Token[] {
  const lines = code.split('\n')
  const tokens: Token[] = []
  const pushMerged = (t: Token): void => {
    const last = tokens[tokens.length - 1]
    if (last !== undefined && last.kind === t.kind && t.kind === 'plain') {
      tokens[tokens.length - 1] = { kind: 'plain', text: last.text + t.text }
    } else {
      tokens.push(t)
    }
  }

  let state: ScanState = INITIAL_STATE
  for (let li = 0; li < lines.length; li++) {
    const { tokens: lineTokens, state: nextState } = scanLine(lines[li], state, open)
    for (const t of lineTokens) pushMerged(t)
    state = nextState
    if (li < lines.length - 1) pushMerged({ kind: 'plain', text: '\n' })
  }
  return tokens
}
