// a2a-concepts.ts — the A2A CONCEPTS & DEMOS page (corpus LLD-C10, SPEC-R15). One card per record admitted
// to the committed A2A corpus shards (`packages/agent-ui/a2a/corpus/{concept,demo}/v0_3_0/a2a.jsonl`),
// DERIVED from the shard — never hand-listed, so a record the single-writer import tool admits appears
// here with zero page edits (pinned by ../lib/a2a-concepts.test.ts). Every inline wire artifact carries a
// REAL, in-page `validateA2a` verdict; demo records' transcript artifacts link to the arena page
// (./a2a-tic-tac-toe.html), which owns the full replay + isolation check (LLD §6 — never double-shipped
// here).
//
// Follows the page convention exactly: `_page.ts` FIRST (the load-bearing foundation CSS cascade +
// self-defining ui-* controls, ADR-0003), then the derivation lib. An MPA entry auto-discovered by
// vite.config.ts's site/**/*.html glob (matches the nav link ./a2a-concepts.html) — no config edit.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import './a2a-concepts.css'
import { buildConceptsSections } from '../lib/a2a-concepts.ts'

const { content } = mountPage({ title: 'A2A Concepts & Demos' })
content.append(
  pageLead(
    'The A2A corpus, made readable: one card per admitted record — the wire shape it teaches, the ' +
      'grounding citations behind it, and the exact JSON artifact it carries, verified LIVE right here ' +
      'through the same validator the corpus’s own standing gate runs (never a precomputed badge). ' +
      'Demo records replay a full recorded match on the arena page rather than re-shipping the transcript ' +
      'bytes a second time.',
  ),
)

const { concepts, demos, parseFailures } = buildConceptsSections()

if (parseFailures.length > 0) {
  // A broken/unreadable shard never renders a broken page (LLD §7, the arena page's "Match unavailable"
  // posture) — an honest error panel names every parse failure instead.
  const errorPanel = document.createElement('p')
  errorPanel.className = 'concepts-error'
  errorPanel.setAttribute('role', 'status')
  errorPanel.dataset.error = ''
  errorPanel.textContent = `Concepts unavailable — the committed corpus failed to parse: ${parseFailures
    .map((f) => `${f.code}@${f.path}: ${f.detail}`)
    .join('; ')}`
  content.append(errorPanel)
} else {
  const conceptsHeading = document.createElement('h2')
  conceptsHeading.className = 'concepts-section-heading'
  conceptsHeading.textContent = 'Concepts'
  const conceptsGrid = document.createElement('div')
  conceptsGrid.className = 'concepts-grid'
  conceptsGrid.dataset.section = 'concepts'
  for (const { card } of concepts) conceptsGrid.append(card)

  const demosHeading = document.createElement('h2')
  demosHeading.className = 'concepts-section-heading'
  demosHeading.textContent = 'Demos'
  const demosGrid = document.createElement('div')
  demosGrid.className = 'concepts-grid'
  demosGrid.dataset.section = 'demos'
  for (const { card } of demos) demosGrid.append(card)

  content.append(conceptsHeading, conceptsGrid, demosHeading, demosGrid)
}
