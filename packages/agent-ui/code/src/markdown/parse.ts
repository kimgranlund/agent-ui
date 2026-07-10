// parse.ts — the markdown subset parser (LLD-C8, SPEC-C6/C7). A small hand-rolled block+inline parser.
// Output is an AST of KNOWN node kinds ONLY — no raw-HTML node kind exists, so there is nothing an
// injection payload can smuggle through (sanitization by construction, SPEC-C7). Every `<…>` in the
// source is TEXT: the block pass never opens an HTML lane, so a `<script>` line is a paragraph whose
// inline run is one `text` node containing the literal string. Links keep their raw `href` string
// verbatim — the PARSER does no scheme logic; the renderer's `ui-text` gate is the one place that denies
// `javascript:`/etc. (one gate, not two, LLD-C9).
//
// Two passes: a BLOCK pass (line classification — ATX headings, fence open/close, list markers with
// indent depth, `>` blockquote prefix, `|`-delimited GFM table rows with a `---` separator, blank-line
// paragraph breaks) and an INLINE pass over each text run (`**`/`*` emphasis, `` ` `` inline-code spans,
// `[text](url)` links) — a single left-to-right scan with a small marker stack, O(n), no recursive regex
// (never the catastrophic-backtracking shape).

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'em'; inline: Inline[] }
  | { kind: 'strong'; inline: Inline[] }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string }

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; inline: Inline[] }
  | { kind: 'paragraph'; inline: Inline[] }
  | { kind: 'list'; ordered: boolean; items: Block[][] } // each item is a block sequence (nesting)
  | { kind: 'blockquote'; blocks: Block[] }
  | { kind: 'code'; language: string; text: string } // fenced
  | { kind: 'table'; header: string[]; rows: string[][] } // GFM; cells are plain strings (I-3)

/** Parse the markdown subset into a block sequence. Never throws — every malformed shape (an unterminated
 *  fence, a ragged table, unbalanced emphasis, a raw HTML block) degrades to a defined, safe fallback
 *  (LLD-C8's failure/edge table). */
export function parse(src: string): Block[] {
  const lines = src.split('\n')
  return parseBlockSequence(lines, 0, lines.length)
}

// ── block pass ──────────────────────────────────────────────────────────────────────────────────────────

const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/
const LIST_ITEM_RE = /^(\s*)([-*]|\d+\.)\s+(.*)$/
const FENCE_RE = /^```(.*)$/

const isBlankLine = (line: string): boolean => line.trim() === ''
const indentOf = (line: string): number => line.length - line.trimStart().length

function isTableRow(line: string): boolean {
  const t = line.trim()
  return t !== '' && t.includes('|')
}

function splitTableRow(line: string): string[] {
  let t = line.trim()
  if (t.startsWith('|')) t = t.slice(1)
  if (t.endsWith('|')) t = t.slice(0, -1)
  return t.split('|').map((c) => c.trim())
}

function isTableSeparatorRow(line: string): boolean {
  const cells = splitTableRow(line)
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c.trim()))
}

/** Pad or truncate `cells` to exactly `n` entries (a ragged GFM row, LLD-C8's malformed-table handling). */
function conformRow(cells: string[], n: number): string[] {
  const out = cells.slice(0, n)
  while (out.length < n) out.push('')
  return out
}

/** Whether `lines[j]` opens a NEW block (used to stop a paragraph's line-gather, or a list item's
 *  continuation-line gather, at the right boundary). Table detection needs one-line lookahead (a `|` row
 *  alone is not a table without its separator). */
function startsNewBlock(lines: string[], j: number, end: number): boolean {
  const line = lines[j]
  if (FENCE_RE.test(line.trim())) return true
  if (HEADING_RE.test(line)) return true
  if (/^\s*>/.test(line)) return true
  if (LIST_ITEM_RE.test(line)) return true
  if (isTableRow(line) && j + 1 < end && isTableSeparatorRow(lines[j + 1])) return true
  return false
}

/** Parse a contiguous run of lines (`[start, end)`) into a block sequence — the recursive core shared by
 *  the document root, blockquote contents, and each list item's contents. */
function parseBlockSequence(lines: string[], start: number, end: number): Block[] {
  const blocks: Block[] = []
  let i = start

  while (i < end) {
    if (isBlankLine(lines[i])) {
      i += 1
      continue
    }

    // fenced code — LLD-C8: an unterminated fence runs to end-of-input as a code block, never throws.
    const fence = FENCE_RE.exec(lines[i].trim())
    if (fence !== null) {
      const language = fence[1].trim()
      let j = i + 1
      const codeLines: string[] = []
      while (j < end && !/^```\s*$/.test(lines[j].trim())) {
        codeLines.push(lines[j])
        j += 1
      }
      blocks.push({ kind: 'code', language, text: codeLines.join('\n') })
      i = j < end ? j + 1 : end
      continue
    }

    // ATX heading
    const heading = HEADING_RE.exec(lines[i])
    if (heading !== null) {
      const level = heading[1].length as 1 | 2 | 3 | 4 | 5 | 6
      blocks.push({ kind: 'heading', level, inline: parseInline(heading[2]) })
      i += 1
      continue
    }

    // blockquote — every `>`-prefixed line (possibly indented) joins the SAME quote, recursively parsed.
    if (/^\s*>/.test(lines[i])) {
      let j = i
      const inner: string[] = []
      while (j < end && /^\s*>/.test(lines[j])) {
        inner.push(lines[j].replace(/^\s*>\s?/, ''))
        j += 1
      }
      blocks.push({ kind: 'blockquote', blocks: parseBlockSequence(inner, 0, inner.length) })
      i = j
      continue
    }

    // GFM table — a `|` row followed immediately by a valid `---` separator row.
    if (isTableRow(lines[i]) && i + 1 < end && isTableSeparatorRow(lines[i + 1])) {
      const header = splitTableRow(lines[i])
      let j = i + 2
      const rows: string[][] = []
      while (j < end && isTableRow(lines[j])) {
        rows.push(conformRow(splitTableRow(lines[j]), header.length))
        j += 1
      }
      blocks.push({ kind: 'table', header, rows })
      i = j
      continue
    }

    // list — ordered/unordered, nested (a deeper-indented continuation joins the CURRENT item's content).
    const listItem = LIST_ITEM_RE.exec(lines[i])
    if (listItem !== null) {
      const ordered = /^\d+\.$/.test(listItem[2])
      const baseIndent = listItem[1].length
      const items: Block[][] = []
      let j = i
      while (j < end) {
        const m = LIST_ITEM_RE.exec(lines[j])
        if (m === null || m[1].length !== baseIndent || /^\d+\.$/.test(m[2]) !== ordered) break
        const markerWidth = m[1].length + m[2].length + 1 // indent + marker + one space
        const itemLines: string[] = [m[3]]
        let k = j + 1
        while (k < end) {
          if (isBlankLine(lines[k])) {
            // a blank line continues the item only if MORE content at deeper indent follows it
            if (k + 1 < end && indentOf(lines[k + 1]) >= markerWidth && !isBlankLine(lines[k + 1])) {
              itemLines.push('')
              k += 1
              continue
            }
            break
          }
          if (indentOf(lines[k]) < markerWidth) break
          itemLines.push(lines[k].slice(Math.min(markerWidth, lines[k].length)))
          k += 1
        }
        items.push(parseBlockSequence(itemLines, 0, itemLines.length))
        j = k
      }
      blocks.push({ kind: 'list', ordered, items })
      i = j
      continue
    }

    // paragraph — consecutive non-blank lines that don't open a new block; a blank line or EOF ends it.
    const paraLines: string[] = []
    let j = i
    while (j < end && !isBlankLine(lines[j]) && !startsNewBlock(lines, j, end)) {
      paraLines.push(lines[j])
      j += 1
    }
    if (paraLines.length === 0) {
      i += 1 // safety valve — never loop forever on an unrecognized single line
      continue
    }
    blocks.push({ kind: 'paragraph', inline: parseInline(paraLines.join('\n')) })
    i = j
  }

  return blocks
}

// ── inline pass ─────────────────────────────────────────────────────────────────────────────────────────

/** Parse one text run's inline markup: `` `code` `` spans, `[text](url)` links, `**strong**`/`*em*`
 *  emphasis (recursing into their content). A single left-to-right scan; an unmatched marker (no closing
 *  delimiter found) stays literal `text` — never opens a span. Never throws. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  let buf = ''
  const flush = (): void => {
    if (buf !== '') {
      out.push({ kind: 'text', text: buf })
      buf = ''
    }
  }

  let i = 0
  while (i < text.length) {
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1)
      if (end !== -1) {
        flush()
        out.push({ kind: 'code', text: text.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }

    if (text[i] === '[') {
      const closeBracket = text.indexOf(']', i + 1)
      if (closeBracket !== -1 && text[closeBracket + 1] === '(') {
        // balance nested parens in the URL itself (e.g. a `javascript:alert(1)` href) — the outer link
        // syntax's closing `)` is where the DEPTH returns to zero, not the first `)` encountered.
        let depth = 1
        let k = closeBracket + 2
        while (k < text.length && depth > 0) {
          if (text[k] === '(') depth += 1
          else if (text[k] === ')') depth -= 1
          if (depth > 0) k += 1
        }
        if (depth === 0) {
          flush()
          const linkText = text.slice(i + 1, closeBracket)
          const href = text.slice(closeBracket + 2, k)
          out.push({ kind: 'link', text: linkText, href })
          i = k + 1
          continue
        }
      }
    }

    // `**strong**` is tried BEFORE single `*em*` — and on failure (no closing `**`) it does NOT fall
    // through to the single-star branch at the SAME position (an `else if`): that would treat the second
    // `*` of an unmatched `**` as its own opener, searching from i+1 and trivially "finding" itself,
    // producing a spurious empty em span. An unmatched `**` degrades one character at a time instead —
    // both stars end up literal text (the LLD's "unbalanced emphasis stays literal" rule).
    if (text.startsWith('**', i)) {
      const end = text.indexOf('**', i + 2)
      if (end !== -1) {
        flush()
        out.push({ kind: 'strong', inline: parseInline(text.slice(i + 2, end)) })
        i = end + 2
        continue
      }
    } else if (text[i] === '*') {
      const end = text.indexOf('*', i + 1)
      if (end !== -1) {
        flush()
        out.push({ kind: 'em', inline: parseInline(text.slice(i + 1, end)) })
        i = end + 1
        continue
      }
    }

    buf += text[i]
    i += 1
  }
  flush()
  return out
}
