// generate-sitemap.mjs — derives site/public/sitemap.json (+ a byte-identical site/sitemap.json copy
// for _page.ts's static import — Vite forbids importing anything under publicDir from JS) + site/public/
// adr-index.json / changelog-index.json, the leveled index behind the docs site's ui-command-modal search palette
// (TKT-0018, site-command-search.lld.md LLD-C1/C2/C4). Follows generate-llms-full.mjs's exact shape: pure
// `fs`-based (no bundler, no TS execution), a `generateSitemap(repoRoot)` export the drift gate
// (site/lib/sitemap.test.ts) imports directly (no generator/gate drift pair), deterministic ordering,
// written only when run as a CLI (`node scripts/generate-sitemap.mjs`).
//
// L1 (component pages) derives from EVERY tree in L1_TREES, gated by a REAL 1:1-page-existence check
// (TKT-0095) — not from a fixed component/router split assumed once and never re-tested. The original
// single-tree design (packages/agent-ui/components/src/controls only) reached for the router package's own
// exclusion as precedent when @agent-ui/code's ui-code-editor shipped (618b43f) — router's two descriptors
// (ui-router-outlet / ui-router-link) DON'T have a 1:1 page (the site ships exactly ONE combined
// `router-doc.html` for the whole package), but that reasoning never actually applied to ui-code-editor,
// which has exactly one descriptor and one real page, same as every genuine L1 component; the resemblance to
// router was the wrong precedent, not a real structural match. Rather than re-hardcoding a SECOND fixed
// exception, the walk now covers every tree in L1_TREES and only emits an entry when `./{slug}-doc.html`
// ACTUALLY EXISTS under `site/` — so a descriptor with no matching page (today: ui-markdown, which has a real
// tagged descriptor but ships no doc page yet) is silently skipped rather than minting a dead nav link, and a
// FUTURE @agent-ui/code control with both a descriptor AND a shipped page is picked up automatically, no
// generator edit required. Router itself still resolves to its one combined page via site-manifest.json's L2
// row (site/pages/_page.ts's ungrouped site-level GUIDE posture) — unaffected by this change, since
// `packages/agent-ui/router/src/controls` was never added to L1_TREES.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { slug } from './slug.mjs'

const repoRootFromScript = () => fileURLToPath(new URL('..', import.meta.url))

const L1_TREES = ['packages/agent-ui/components/src/controls', 'packages/agent-ui/code/src']

/** Split a descriptor's `---`-fenced frontmatter from its prose body; null when no fence leads the file.
 *  (generate-llms-full.mjs precedent, duplicated rather than imported — that script has no export for it.) */
function splitFence(source) {
  if (!source.startsWith('---\n')) return null
  const end = source.indexOf('\n---\n', 4)
  if (end === -1) return null
  return { fence: source.slice(4, end), body: source.slice(end + 5) }
}

/** The `tag: ui-…` scalar out of a frontmatter fence; null when absent (a non-descriptor .md). */
function tagOf(fence) {
  const m = fence.match(/^tag:\s*(ui-[a-z-]+)\s*$/m)
  return m ? m[1] : null
}

/** The new, purely-additive `description:` scalar (SPEC-R2) out of a frontmatter fence; null when absent —
 *  the caller falls back to `deriveFallbackDescription`. A one-line value, same shape as `tagOf`. */
function descriptionOf(fence) {
  const m = fence.match(/^description:\s*(.+)$/m)
  return m ? m[1].trim() : null
}

/** A plain-text reduction of the corpus's small inline markdown grammar — links/backticks/bold/italic — so a
 *  derived description never leaks raw `**`/backtick/`_` characters (SPEC-R2 AC3, the anti-vacuous check). */
function stripEmphasis(text) {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
}

/** truncate — hard-cap `text` to `max` chars, `…`-suffixed ONLY when the cap actually bites (a string that
 *  already fits is returned verbatim — no truncation, no suffix). Shared by every description derivation
 *  below, so "a one-line summary" means the same 160-char ceiling everywhere in this generator. */
function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/**
 * deriveFallbackDescription — the first sentence of a descriptor's (or changelog entry's) prose body, when no
 * authored `description:` scalar exists (SPEC-R2 AC2/AC3): skip leading blank lines and heading lines, drop a
 * leading list-item marker (changelog entries commonly open straight into a `- **X**, NEW…` bullet, no lead
 * paragraph of their own), then take the first PARAGRAPH — up to the first truly blank line — and cut it at
 * the first ". " within that paragraph, truncating to 160 chars.
 *
 * DEVIATION from the LLD §3 literal wording ("split at the first '. ' or the first newline, whichever is
 * sooner"): a single '\n' is treated as a soft line-wrap WITHIN a paragraph (unwrapped to a space before the
 * sentence search), not a cut point — this repo's own prose (verified against command-modal.md's body and a
 * real CHANGELOG.md entry, e.g. the 2026-07-11 "ui-settings ships" milestone) hand-wraps flowing prose at
 * ~100–120 chars with single newlines; a literal every-'\n' cut severed real sentences mid-clause on that
 * corpus (measured: "…ADR-0120 cl.4 —" instead of the real first sentence, a source line-wrap artifact, not a
 * sentence boundary). The LLD's own "first newline" instruction was written for the single-paragraph
 * command-modal.md example where the real period happens to land before ANY newline (soft-wrapped or not) —
 * this fix generalizes the same intent (stop before drifting into a second sentence/thought) to a body whose
 * first period lands AFTER a soft wrap, which the changelog corpus exercises constantly and no L1 descriptor
 * happened to.
 */
export function deriveFallbackDescription(body) {
  const lines = body.split('\n')
  let i = 0
  while (i < lines.length && (lines[i].trim() === '' || /^#{1,6}\s/.test(lines[i]))) i++
  const rest = lines.slice(i).join('\n').replace(/^[-*]\s+/, '')
  const paragraphBreak = rest.search(/\n[ \t]*\n/) // the first BLANK line = a real paragraph boundary
  const firstParagraph = paragraphBreak === -1 ? rest : rest.slice(0, paragraphBreak)
  const unwrapped = firstParagraph.replace(/\n/g, ' ').replace(/\s+/g, ' ')
  const stripped = stripEmphasis(unwrapped).trim()
  const periodIdx = stripped.indexOf('. ')
  const sentence = periodIdx !== -1 ? stripped.slice(0, periodIdx + 1) : stripped
  return truncate(sentence.trim(), 160)
}

/** titleCaseFromTag — `ui-swiper-paddles` -> `Swiper Paddles` (SPEC-R1 AC2's own example format). */
export function titleCaseFromTag(tag) {
  return tag
    .slice('ui-'.length)
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** generateL1 — one entry per tagged descriptor across every L1_TREES root, name/tag/url derived,
 *  description from the authored scalar or the fallback derivation — but ONLY when a real `{slug}-doc.html`
 *  page exists under `site/` (the 1:1-page-existence gate, TKT-0095): a descriptor with no matching page
 *  (e.g. ui-markdown today) is skipped, never minting a dead nav link. Alphabetical by tag (the
 *  generate-llms-full.mjs precedent). */
function generateL1(repoRoot) {
  const entries = []
  for (const tree of L1_TREES) {
    const controlsDir = join(repoRoot, tree)
    for (const folder of readdirSync(controlsDir, { withFileTypes: true })) {
      if (!folder.isDirectory()) continue
      for (const file of readdirSync(join(controlsDir, folder.name))) {
        if (!file.endsWith('.md')) continue
        const source = readFileSync(join(controlsDir, folder.name, file), 'utf8')
        const split = splitFence(source)
        if (split === null) continue
        const tag = tagOf(split.fence)
        if (tag === null) continue // a .md without a tag: scalar is not a component descriptor
        const slugName = tag.slice('ui-'.length)
        const url = `./${slugName}-doc.html`
        if (!existsSync(join(repoRoot, 'site', url.slice(2)))) continue // no real page yet — skip, never a dead link
        const authored = descriptionOf(split.fence)
        const description = authored !== null ? authored : deriveFallbackDescription(split.body)
        entries.push({ name: titleCaseFromTag(tag), tag, url, description, level: 'L1', section: 'Components' })
      }
    }
  }
  if (entries.length === 0) throw new Error('generate-sitemap: zero L1 descriptors found — the controls glob is broken')
  entries.sort((a, b) => (a.tag < b.tag ? -1 : 1))
  return entries
}

/** generateL2AndStubs — L2 + the two L3 loader-stub rows, read straight from the single-owner manifest
 *  (SPEC-R3/R4) and mapped through unchanged (it is already SitemapEntry-shaped minus `tag`). */
function generateL2AndStubs(repoRoot) {
  const rows = JSON.parse(readFileSync(join(repoRoot, 'site/lib/site-manifest.json'), 'utf8'))
  return rows.map((row) => ({
    name: row.label,
    url: row.href,
    description: row.description,
    level: row.level,
    section: row.section,
    ...(row.index ? { index: row.index } : {}),
  }))
}

/** generateSitemap — the whole sitemap.json {entries} shape: L1 (descriptor-derived) + L2/L3-stubs (manifest-
 *  derived), pure and deterministic (the drift gate calls this too — no generator/gate drift pair). */
export function generateSitemap(repoRoot = repoRootFromScript()) {
  return { entries: [...generateL1(repoRoot), ...generateL2AndStubs(repoRoot)] }
}

// ── L3 index files (LLD-C4) ──────────────────────────────────────────────────────────────────────────────

// One ADR README Index table row: `| [NNNN](./NNNN-slug.md) | Title | Status | Repairs |` (.claude/docs/adr/
// README.md §Index). Anchored on one of the 4 known status keywords (optionally `**bold**`-wrapped, e.g. a
// superseded row's `**superseded by ADR-0038**`) rather than a generic `\w+`+trailing-pipe shape — the Index
// table's Status cell is NOT held to the same bare-keyword discipline as the per-ADR blockquote frontmatter
// (README.md's own machine-readable rule targets that OTHER table); several rows carry trailing annotation
// prose after the keyword (`accepted *(amended by 0014: …)*`). Anchoring on the keyword itself is what forces
// the lazy title capture to backtrack to the CORRECT closing pipe (verified against all 126 real rows).
const ADR_ROW_RE = /^\|\s*\[(\d{4})\]\(\.\/[^)]+\)\s*\|\s*(.+?)\s*\|\s*\*{0,2}(accepted|proposed|superseded|deprecated)\b/gm

/**
 * generateAdrIndex — one entry per ADR (SPEC-R4/AC2), derived from the ADR log's own README Index table (never
 * a second directory glob — one source of row-truth). `url` carries the SAME `adr-{number}` fragment
 * adr-index.ts stamps as each card's DOM id (LLD-C11) — not the bare `#{number}` SPEC-R4 AC2's illustrative
 * example shows, a deliberate, named deviation: an all-numeric id (`id="0125"`) is technically legal HTML but
 * an unescaped CSS/`querySelector` footgun, and the LLD's own §6 on-load handler reads
 * `document.getElementById(location.hash.slice(1))` with ZERO translation — that only resolves if the hash
 * fragment and the DOM id are the same literal string. Matching them (`#adr-0125` both places) is what makes
 * the LLD's own snippet correct; a bare numeric hash would require translation logic the LLD never specifies.
 */
export function generateAdrIndex(repoRoot) {
  const readme = readFileSync(join(repoRoot, '.claude/docs/adr/README.md'), 'utf8')
  const rows = [...readme.matchAll(ADR_ROW_RE)]
  if (rows.length === 0) throw new Error('generate-sitemap: zero ADR index rows found — README.md table shape changed')
  return rows.map(([, number, rawTitle]) => ({
    name: `ADR-${number}`,
    url: `./adr-index.html#adr-${number}`,
    description: truncate(stripEmphasis(rawTitle), 160),
    level: 'L3',
    section: 'Records',
  }))
}

/** generateChangelogIndex — one entry per `## ` milestone heading in CHANGELOG.md (SPEC-R4 AC3), reusing
 *  changelog.ts's own section-splitting shape (duplicated as a small pure function here — the Node script
 *  cannot import a Vite-transformed TS module, the SAME constraint generate-llms-full.mjs's own comment names
 *  for why it re-derives from raw text). `url`'s `#{slug}` uses the ONE shared `slug()` helper (scripts/
 *  slug.mjs) that changelog.ts ALSO imports for its per-`<section>` id — so the id-producer and the
 *  id-consumer cannot drift apart. Reversed to newest-first, matching changelog.ts's own display order. */
export function generateChangelogIndex(repoRoot) {
  const raw = readFileSync(join(repoRoot, 'CHANGELOG.md'), 'utf8')
  const sections = raw.split(/\n(?=## )/)
  const entries = []
  for (const section of sections) {
    const m = /^## (.+)\n([\s\S]*)$/.exec(section.trim())
    if (!m) continue // the H1 title + lead paragraph before the first `## ` — not an entry
    const heading = m[1].trim()
    const body = m[2].trim()
    entries.push({
      name: heading,
      url: `./changelog.html#${slug(heading)}`,
      description: deriveFallbackDescription(body),
      level: 'L3',
      section: 'Records',
    })
  }
  if (entries.length === 0) throw new Error('generate-sitemap: zero changelog entries found — CHANGELOG.md shape changed')
  return entries.reverse() // file is oldest-first; the site (and this index) read newest-first
}

/** formatJson — the ONE serialization both the CLI writer and the drift gate's "fresh" value use, so the two
 *  can never independently drift on formatting alone. */
export function formatJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

// Written only when run directly (`node scripts/generate-sitemap.mjs`) — the drift gate imports the three
// generator functions above and never writes.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const root = repoRootFromScript()
  const sitemap = generateSitemap(root)
  const adrIndex = generateAdrIndex(root)
  const changelogIndex = generateChangelogIndex(root)
  writeFileSync(join(root, 'site/public/sitemap.json'), formatJson(sitemap))
  // A second, byte-identical copy INSIDE the src tree (not site/public/) — Vite hard-errors on a static
  // JS `import` of anything under publicDir ("Assets in public directory cannot be imported from
  // JavaScript"), which _page.ts's `import sitemapData from '../sitemap.json'` needs; the public copy
  // stays for command-palette.ts's own runtime `fetch('./sitemap.json')` (a genuinely different
  // consumption mode — static-import-at-module-load vs. fetch-on-demand — neither can serve the other).
  // Both copies are generated from the SAME `sitemap` value in the SAME run, so they cannot independently
  // drift; sitemap.test.ts's freshness gate checks both.
  writeFileSync(join(root, 'site/sitemap.json'), formatJson(sitemap))
  writeFileSync(join(root, 'site/public/adr-index.json'), formatJson(adrIndex))
  writeFileSync(join(root, 'site/public/changelog-index.json'), formatJson(changelogIndex))
  console.log(
    `sitemap: wrote ${sitemap.entries.length} entries, ${adrIndex.length} ADR records, ${changelogIndex.length} changelog records`,
  )
}
