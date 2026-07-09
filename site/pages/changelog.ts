// site/pages/changelog.ts — the on-site changelog, derived from the repo root CHANGELOG.md exactly the way
// adr-index.ts derives from the ADR log: a build-time `?raw` import, a small pure parser, rendered through the
// SAME renderMarkdownBody every doc page uses. Anti-vacuous by construction (adr-index.ts's precedent) — a
// broken parse throws rather than shipping an empty page.
//
// ORDER NOTE (a judgment call, recorded rather than silently assumed): CHANGELOG.md's own entries run OLDEST →
// NEWEST top to bottom (verified: 2026-07-05, -06, -08 morning, -08 afternoon/evening, -09) — the opposite of
// what "newest-first is already the file's order" would suggest. This page reverses the parsed section order so
// the SITE reads newest-first (matching adr-index's convention), rather than trusting an unverified claim about
// the source file's order.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './changelog.css'
import { renderMarkdownBody } from '../lib/doc-page.ts'
import changelogRaw from '../../CHANGELOG.md?raw'

interface ChangelogEntry {
  readonly heading: string
  readonly body: string
}

/** Split the changelog body (everything after the H1 + its lead line) into one entry per `## ` section. */
function parseChangelog(raw: string): ChangelogEntry[] {
  const sections = raw.split(/\n(?=## )/) // split right before each H2, keeping the marker with its section
  const entries: ChangelogEntry[] = []
  for (const section of sections) {
    const m = /^## (.+)\n([\s\S]*)$/.exec(section.trim())
    if (!m) continue // the H1 title + lead paragraph before the first `## ` — not an entry
    entries.push({ heading: m[1].trim(), body: m[2].trim() })
  }
  return entries
}

const ENTRIES = parseChangelog(changelogRaw).reverse() // file is oldest-first; the site reads newest-first

if (ENTRIES.length === 0) {
  throw new Error('changelog.ts: parseChangelog resolved 0 entries — CHANGELOG.md did not match the expected "## " section shape')
}

const { content } = mountPage({ title: 'Changelog' })
content.append(
  pageLead(
    `${ENTRIES.length} milestones, newest-first — rendered straight from the repo root CHANGELOG.md. The ` +
      'canonical sources it summarizes are the milestone ledger, the plan, and the decision log ' +
      '(.claude/docs/{goals,plan,adr}); if this page and CHANGELOG.md ever disagree, this page is stale.',
  ),
)

for (const entry of ENTRIES) {
  const section = document.createElement('section')
  section.className = 'changelog-entry'
  const h2 = document.createElement('h2')
  h2.textContent = entry.heading
  section.append(h2, renderMarkdownBody(entry.body))
  content.append(section)
}
