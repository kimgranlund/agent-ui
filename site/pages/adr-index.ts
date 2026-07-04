// site/pages/adr-index.ts — the ADR index: every `.claude/docs/adr/NNNN-*.md`, newest-first, with a live
// full-text search box, each card expanding to the fully rendered decision. The ADR log itself is the source —
// a build-time glob pulls the raw markdown, lib/adr.ts's pure parser derives number/title/status/date/summary,
// and the SAME renderMarkdownBody every doc page uses renders the expanded body — so this page can never show a
// stale or hand-copied ADR; a new file under .claude/docs/adr/ appears here with zero page-code changes.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './adr-index.css'
import { appendInline, renderMarkdownBody } from '../lib/doc-page.ts'
import { type AdrRecord, isDecisionRecord, matchesQuery, parseAdr, sortAdrsDescending } from '../lib/adr.ts'

// Build-time glob of the ADR log — eager RAW text (the whole log is a few hundred KB, small enough to ship as
// static text like any other doc source on this site). `exhaustive: true` is LOAD-BEARING: Vite's import.meta.glob
// matcher (tinyglobby) excludes dot-directories by default (`dot: false`), and `.claude` is one — without this
// flag the glob silently resolves to `{}` and the page would ship with zero cards.
const ADR_MODULES = import.meta.glob('../../.claude/docs/adr/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
  exhaustive: true,
}) as Record<string, string>

const RECORDS: AdrRecord[] = sortAdrsDescending(
  Object.entries(ADR_MODULES)
    .map(([path, source]) => [path.slice(path.lastIndexOf('/') + 1), source] as const)
    .filter(([filename]) => isDecisionRecord(filename)) // excludes README.md + the 0000 template scaffold
    .map(([filename, source]) => parseAdr(filename, source)),
)

// Anti-vacuous: a silently-empty ADR list is a broken build, not a valid empty state (a dot-dir glob miss is
// exactly the failure mode this guards). Fail loudly here rather than shipping a page with nothing on it.
if (RECORDS.length === 0) {
  throw new Error('adr-index: the ADR glob resolved 0 records — .claude/docs/adr/*.md did not match')
}

const { content } = mountPage({ title: 'Decision Records' })
content.append(
  pageLead(`${RECORDS.length} ADRs, newest-first. Search matches the number, the title, and the full body of every record.`),
)

// ── the search box ────────────────────────────────────────────────────────────────────────────────────────
const search = document.createElement('input')
search.type = 'search'
search.className = 'adr-search'
search.placeholder = 'Search decision records…'
search.setAttribute('aria-label', 'Search decision records')
content.append(search)

// ── one card per record — number · title · status badge · date · summary, expanding to the full render ─────
function statusBadge(record: AdrRecord): HTMLElement {
  const badge = document.createElement('span')
  badge.className = 'adr-badge'
  badge.dataset.status = record.statusShort
  badge.textContent = record.statusShort
  return badge
}

function card(record: AdrRecord): HTMLDetailsElement {
  const details = document.createElement('details')
  details.className = 'adr-card'

  const summary = document.createElement('summary')
  summary.className = 'adr-summary'

  const head = document.createElement('div')
  head.className = 'adr-head'
  const number = document.createElement('span')
  number.className = 'adr-number'
  number.textContent = `ADR-${record.number}`
  const title = document.createElement('span')
  title.className = 'adr-title'
  appendInline(title, record.title) // the H1 may carry inline `` `code` `` spans
  head.append(number, title, statusBadge(record))

  const meta = document.createElement('div')
  meta.className = 'adr-meta'
  meta.textContent = record.dateShort

  const lead = document.createElement('p')
  lead.className = 'adr-lead'
  lead.textContent = record.summary

  summary.append(head, meta, lead)

  const body = document.createElement('div')
  body.className = 'adr-body'
  details.append(summary, body)

  // Defer the full markdown render to first expand — 78 ADRs' worth of full-body rendering up front is wasted
  // work on a page whose default view is the collapsed list; render once, then leave it mounted (no re-render
  // on re-collapse). The summary itself already carries the number/status/date chips (STRIP + surface-as-chips,
  // per the contract) so they read whether the card is open or closed — the body needs none of them repeated.
  let rendered = false
  details.addEventListener('toggle', () => {
    if (rendered || !details.open) return
    rendered = true
    body.append(renderMarkdownBody(record.body))
  })

  return details
}

// The filter status — an ARIA live region (`role="status"` implies `aria-live="polite"`, no extra attribute
// needed): visually-hidden by default (a quiet match-count announcement for assistive tech), and promoted to a
// real visible row (`.adr-status--empty`, adr-index.css) when a search leaves zero cards showing — the empty
// state a hidden-cards-only approach would otherwise show as nothing at all (the sticky intro's total up top
// would be the only, stale, signal).
const status = document.createElement('p')
status.className = 'adr-status'
status.setAttribute('role', 'status')
content.append(status)

const list = document.createElement('div')
list.className = 'adr-list'
const cards = RECORDS.map((record) => card(record))
list.append(...cards)
content.append(list)

// ── the live filter — case-insensitive, over number + title + full body (lib/adr.ts's matchesQuery) ─────────
search.addEventListener('input', () => {
  let visible = 0
  RECORDS.forEach((record, i) => {
    const match = matchesQuery(record, search.value)
    cards[i].hidden = !match
    if (match) visible++
  })

  const query = search.value.trim()
  status.classList.toggle('adr-status--empty', visible === 0)
  status.textContent =
    visible === 0
      ? `No decision records match "${query}".`
      : query === ''
        ? '' // the unfiltered list — no announcement needed, nothing is hidden
        : `${visible} of ${RECORDS.length} decision records match.`
})
