// site/lib/adr.ts — the pure parser for the ADR log's markdown shape: a `# ADR-NNNN — <title>` H1, then a
// blockquote MARKDOWN TABLE frontmatter (`> | **Status** | accepted |`, `> | **Date** | 2026-07-04 |`, …), then
// prose (`## Context`, `## Decision`, …). Deliberately DOM-free and import.meta-free — the same module is the
// build-time source for pages/adr-index.ts (the glob lives THERE, not here) and the packages-tree unit test
// (site-adr-index.test.ts, vitest's include is packages-only — see site-nav.browser.test.ts for the precedent
// of a packages test importing a site/ module by relative path). One parser, two consumers, so the frontmatter
// grammar can never drift between "what the index page reads" and "what the test proves it reads."
//
// Frontmatter here is a markdown TABLE, not YAML (see .claude/docs/adr/README.md) — hence the row regex below,
// not a YAML parser.

export interface AdrRecord {
  /** The zero-padded number, e.g. '0076' (read from the filename, the log's own numbering authority). */
  readonly number: string
  readonly filename: string
  /** The H1 text after 'ADR-NNNN — ' (may carry inline `` `code` `` spans). */
  readonly title: string
  /** The raw Status cell — one of the 4 canonical keywords, verbatim (the lint gate enforces this corpus-wide). */
  readonly status: string
  /** `status` narrowed to `StatusKey` — see `deriveStatusShort`. Identical to `status` for every real ADR. */
  readonly statusShort: StatusKey
  /** The raw Date cell — may carry more than one date (authored/amended/ratified). */
  readonly date: string
  /** The first ISO `yyyy-mm-dd` found in `date` — the sortable/displayable value. */
  readonly dateShort: string
  /** The first prose paragraph (post-frontmatter), inline markdown reduced to plain text — the card teaser. */
  readonly summary: string
  /** The source with the H1 + the blockquote frontmatter table removed — renderMarkdownBody's input. */
  readonly body: string
}

const FILENAME_RE = /^(\d{4})-/
const H1_RE = /^#\s*ADR-\d{4}\s*—\s*(.+?)\s*$/m
const ISO_DATE_RE = /\d{4}-\d{2}-\d{2}/

/** The 4 lifecycle states the badge (adr-index.css `[data-status=…]`) has a colour for — README.md's ladder. */
export const STATUS_KEYS = ['accepted', 'proposed', 'superseded', 'deprecated'] as const
export type StatusKey = (typeof STATUS_KEYS)[number]
const isStatusKey = (s: string | undefined): s is StatusKey => (STATUS_KEYS as readonly string[]).includes(s ?? '')

/**
 * deriveStatusShort — the badge key for a raw Status cell. The corpus's lint gate (site-adr-index.test.ts)
 * guarantees every real ADR's Status cell IS one of the 4 keys, verbatim, no trailing prose — so this is a
 * literal membership check, not a heuristic. `'proposed'` is the fallback for an unparsed/malformed cell (the
 * README lifecycle's own starting state) — it never over-claims an unstyled cell as `accepted`. GUARANTEES a
 * value in STATUS_KEYS (never an arbitrary word), so a future non-canonical cell degrades to a safe badge
 * instead of an unstyled one, while the lint gate is what actually catches the drift.
 */
export function deriveStatusShort(status: string): StatusKey {
  const trimmed = status.trim()
  return isStatusKey(trimmed) ? trimmed : 'proposed'
}

/** adrNumber — the zero-padded number prefix off an ADR filename (`'0076-…md'` → `'0076'`). */
export function adrNumber(filename: string): string {
  const m = FILENAME_RE.exec(filename)
  if (!m) throw new Error(`not an ADR filename (expected NNNN-*.md): ${filename}`)
  return m[1]
}

/**
 * isDecisionRecord — a glob hit that is a REAL decision, not the log's own scaffolding: excludes `README.md`
 * (the index/lifecycle doc, no `NNNN-` prefix) and `0000-template.md` (README.md: "`NNNN` is a zero-padded
 * sequential integer, never reused. `0000-template.md` is the template" — `0000` is reserved, its H1 is the
 * literal placeholder `ADR-NNNN`, not a real number). The one predicate both the page glob and this test filter
 * through, so a future non-decision file added to the directory has one place to teach the exclusion.
 */
export function isDecisionRecord(filename: string): boolean {
  return /^\d{4}-.+\.md$/.test(filename) && !filename.startsWith('0000-')
}

/**
 * frontmatterField — one blockquote-table cell (`> | **Status** | value |`) by field name, or '' if absent. The
 * lazy `(.+?)` is deliberate and already correct for a value with an embedded literal `|`: a lazy quantifier
 * backtracks/expands until the WHOLE pattern matches, so it only stops at the row's true trailing `|` (the one
 * followed by nothing but the end of line) — verified against `'a | b'`, `'a |'`, and a trailing-`|`-in-prose
 * value, all captured whole, not truncated at the first embedded pipe. A greedy first-pipe stop (`[^|]*`) would
 * instead FAIL to match at all on those same inputs (the trailing `\|\s*$` has nothing left to anchor to) —
 * verified empirically before ruling it out, not assumed.
 */
function frontmatterField(source: string, field: string): string {
  const re = new RegExp(`^>\\s*\\|\\s*\\*\\*${field}\\*\\*\\s*\\|\\s*(.+?)\\s*\\|\\s*$`, 'm')
  return re.exec(source)?.[1]?.trim() ?? ''
}

/**
 * stripFrontmatter — `source` with the H1 line and the following blockquote frontmatter block (every contiguous
 * `>`-prefixed line right after it) removed. What remains starts at the first real heading (`## Context`) — the
 * input renderMarkdownBody and extractSummary both want, so the mini markdown renderer (no table support) never
 * sees the table and the expanded view instead surfaces status/date/number as header chips (adr-index.ts).
 */
export function stripFrontmatter(source: string): string {
  const lines = source.split('\n')
  let i = 0
  while (i < lines.length && !lines[i].startsWith('# ADR-')) i++
  if (i < lines.length) i++ // past the H1
  while (i < lines.length && lines[i].trim() === '') i++
  while (i < lines.length && lines[i].trimStart().startsWith('>')) i++
  return lines.slice(i).join('\n').trim()
}

/** stripInlineMarkdown — a plain-text reduction of the corpus's small inline grammar, for a one-line teaser. */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // [text](url) -> text
    .replace(/`([^`]+)`/g, '$1') // `code` -> code
    .replace(/\*\*([^*]+)\*\*/g, '$1') // **bold** -> bold
}

/**
 * extractSummary — the first prose paragraph of `body` (post-stripFrontmatter): skip leading headings/blank
 * lines, then collect contiguous plain lines up to the next blank line, heading, fence, or bullet. Plain text
 * (inline markdown stripped) — a card teaser, not a second markdown render.
 */
export function extractSummary(body: string): string {
  const lines = body.split('\n')
  let i = 0
  while (i < lines.length && (lines[i].trim() === '' || /^#{1,6}\s/.test(lines[i]))) i++
  const paragraph: string[] = []
  while (
    i < lines.length &&
    lines[i].trim() !== '' &&
    !/^#{1,6}\s/.test(lines[i]) &&
    !lines[i].startsWith('```') &&
    !/^[-*]\s/.test(lines[i])
  ) {
    paragraph.push(lines[i].trim())
    i++
  }
  return stripInlineMarkdown(paragraph.join(' '))
}

/** parseAdr — one ADR record: number (filename) · title/status/date (frontmatter table) · summary/body (prose). */
export function parseAdr(filename: string, source: string): AdrRecord {
  const number = adrNumber(filename)
  const title = H1_RE.exec(source)?.[1] ?? filename
  const status = frontmatterField(source, 'Status')
  const date = frontmatterField(source, 'Date')
  const body = stripFrontmatter(source)
  return {
    number,
    filename,
    title,
    status,
    statusShort: deriveStatusShort(status),
    date,
    dateShort: ISO_DATE_RE.exec(date)?.[0] ?? date,
    summary: extractSummary(body),
    body,
  }
}

/** sortAdrsDescending — newest-first by NUMBER (zero-padded, so lexicographic order IS numeric order). */
export function sortAdrsDescending(records: readonly AdrRecord[]): AdrRecord[] {
  return [...records].sort((a, b) => (a.number < b.number ? 1 : a.number > b.number ? -1 : 0))
}

/** matchesQuery — the live-search predicate: case-insensitive substring over number + title + the full body. */
export function matchesQuery(record: AdrRecord, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  return record.number.includes(q) || record.title.toLowerCase().includes(q) || record.body.toLowerCase().includes(q)
}
