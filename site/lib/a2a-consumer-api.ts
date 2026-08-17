// site/lib/a2a-consumer-api.ts — the @agent-ui/a2a CONSUMER API surface (GH #1049): a2a-concepts.ts shows
// the corpus (WHAT the protocol teaches), never what a host app actually IMPORTS to build one. This module
// derives that section from the package's own barrel (index.ts, LLD-C11, S8-owned single writer) rather
// than hand-listing it — the barrel's own section comments (`// group/ (LLD…) — description.`, one per
// re-export block, blank-line-separated) ARE the grouping, so a group added/renamed/removed there flows
// here with zero page edits.
//
// Pure parsing (no fs, no bundler) — testable with synthetic strings, the site-coverage.test.ts
// `undocumentedFolders` precedent: a negative control can drive it with an input that must NOT parse into
// a group, proving the parser doesn't fabricate one from a comment-only block.

/** One re-export group, as authored in the barrel: its own leading comment (verbatim, joined) and the
 *  relative source paths its `export * from '…'` lines name, in file order. */
export interface A2aBarrelGroup {
  /** The comment block's own leading name token — e.g. "protocol/", "rpc/", "channel/" — sliced off the
   *  FIRST comment line up to the first " (" or " —", whichever comes first. Empty when the block's first
   *  line doesn't start with the `// name/ ...` shape (the package header block, deliberately excluded by
   *  the caller below rather than by this function, so a header-shaped block still PARSES — just carries
   *  no export lines, and the caller's own filter drops it). */
  name: string
  /** The comment lines, `// ` stripped, joined with a space — the group's own stated purpose. */
  note: string
  /** The `export * from '…'` targets, relative to the barrel's own directory, in file order. */
  sources: readonly string[]
}

/** Split `raw` (a `?raw`-imported barrel's full text) into blank-line-separated blocks, parse each into a
 *  group, and return only the blocks that carry at least one `export * from` line — a comment-only block
 *  (the package header) or a malformed block parses to nothing rather than an empty phantom group. Pure. */
export function parseA2aBarrelGroups(raw: string): A2aBarrelGroup[] {
  const blocks = raw.split(/\n\s*\n/)
  const groups: A2aBarrelGroup[] = []
  for (const block of blocks) {
    const lines = block.split('\n')
    const commentLines = lines.filter((l) => l.trimStart().startsWith('//')).map((l) => l.trimStart().replace(/^\/\/\s?/, ''))
    const sources = [...block.matchAll(/^export \* from '([^']+)'/gm)].map((m) => m[1] as string)
    if (sources.length === 0) continue // no export line ⇒ not a real group (the header block, or a synthetic non-match)
    const first = commentLines[0] ?? ''
    const nameMatch = first.match(/^(\S+)\s+[(—]/)
    groups.push({ name: nameMatch ? (nameMatch[1] as string) : '', note: commentLines.join(' '), sources })
  }
  return groups
}

/** Every group's declared source paths that DON'T resolve against `exists` — the trip-wire a stale/typo'd
 *  re-export path would fail (a re-export line naming a file that no longer exists still PARSES here; this
 *  is what actually catches it). Pure — injectable `exists`, so the negative control below can drive it
 *  with a synthetic always-false predicate without touching the filesystem. */
export function missingBarrelSources(groups: readonly A2aBarrelGroup[], exists: (path: string) => boolean): string[] {
  const missing: string[] = []
  for (const group of groups) {
    for (const source of group.sources) {
      if (!exists(source)) missing.push(source)
    }
  }
  return missing
}
