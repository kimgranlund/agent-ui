// site/lib/composition-patterns.ts — the pure parser for the composition-patterns skill's four reference
// tables (`.claude/skills/composition-patterns/references/*.md`). Each file is a markdown table with the
// shape `| Assembly problem | The fleet's answer | Owner · exemplar |`; this parser reads the H1 (the group
// title) and, per row, the FIRST cell (the assembly problem — the routing question) and the THIRD cell (the
// owner ADR/exemplar citation) — deliberately DROPPING the middle "fleet's answer" cell, which is the skill's
// mechanism prose: the hub page routes to a pattern, it never copies the answer (docs-author's cardinal
// discipline — a page restates nothing it can derive, and a mechanism has exactly one owner: the skill file
// itself). One parser, two consumers: pages/composition.ts (the build-time glob lives THERE, not here) and
// this module's own co-located unit test — so the table grammar cannot drift between "what the hub reads" and
// "what the test proves it reads" (the site/lib/adr.ts precedent).

export interface PatternRow {
  /** The assembly problem — column 1, the routing question a consumer searches for. */
  readonly problem: string
  /** The owner ADR/exemplar citation — column 3, verbatim. Never the mechanism prose (column 2). */
  readonly owner: string
}

export interface PatternGroup {
  /** The reference file's own H1 heading (the group title). */
  readonly title: string
  /** The source path, relative to repo root, for the hub's citation line. */
  readonly path: string
  readonly rows: readonly PatternRow[]
}

const H1_RE = /^#\s+(.+?)\s*$/m
// A markdown table row: `| cell | cell | cell |`, excluding the `|---|---|---|` separator row (cells of only
// dashes/colons/spaces) and the header row itself (matched separately by position, not content, since the
// header cell text varies — "Assembly problem" is the convention, not a grammar guarantee).
const ROW_RE = /^\|(.+)\|\s*$/gm

function isSeparatorRow(cells: readonly string[]): boolean {
  return cells.every((c) => /^:?-+:?$/.test(c.trim()))
}

/** Split a `| a | b | c |` row into its trimmed cell strings. */
function splitCells(row: string): string[] {
  return row.split('|').map((c) => c.trim())
}

/**
 * parsePatternFile — one reference markdown file → its PatternGroup. Skips the header row (first table row
 * found) and the separator row, keeping every real data row's column 1 + column 3.
 */
export function parsePatternFile(path: string, source: string): PatternGroup {
  const h1 = H1_RE.exec(source)
  const title = h1 ? h1[1] : path
  const rows: PatternRow[] = []
  let headerSeen = false
  for (const m of source.matchAll(ROW_RE)) {
    const cells = splitCells(m[1])
    if (cells.length < 3) continue
    if (isSeparatorRow(cells)) continue
    if (!headerSeen) {
      headerSeen = true // the first non-separator table row is the header ("Assembly problem" / … / "Owner · exemplar")
      continue
    }
    rows.push({ problem: cells[0], owner: cells[2] })
  }
  return { title, path, rows }
}

/** Parse every {path, source} pair (a build-time glob's Object.entries) into ordered PatternGroups. */
export function parsePatternFiles(entries: readonly (readonly [string, string])[]): PatternGroup[] {
  return entries.map(([path, source]) => parsePatternFile(path, source))
}
