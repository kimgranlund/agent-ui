// site/pages/status-stream-doc.ts — the ui-status-stream API doc page (ADR-0122, timeline-family.lld.md).
// DERIVED from status-stream.md via the shared doc-page.ts renderer: the attribute table (size/label), the
// action-only events[] table (GH #147/ADR-0153 — streamed text/state still rides role=log, never a
// synthetic event), and the properties[] table (appendEntry/update/finalize) are read straight from the
// parse. Deliberately NOT catalogued (ADR-0122 F5) — see the App-surface consumption note below. One
// representative specimen, seeded via the real imperative API. See the ui-status-stream demo for the live
// REAL-stream replay.
//
// GH #147/ADR-0153 additions live here as REAL, checked-in specimens (not just ad-hoc build/review
// scripts): the `g-progress`/`g-progress-1` pair carry a real `startedAt` so the in-progress card's
// elapsed timer genuinely ticks; `g-error-2` carries `action: { label: 'Retry' }` wired to a real listener
// that demonstrates the CONSUMER driving the retry (the component never re-runs anything itself); a new
// `g-planned` card shows the all-pending "Planned" group and its clock glyph (Fork 3); and `stream`'s
// `leaf-trailing` entry demonstrates the genuine `trailing`-slot consumer-content pattern (Fork 1's
// zero-contract-change half) on a NON-grouped entry, where no auto-fill preview effect competes for the
// cell — see status-stream.md's own "Step-count / score group-header summaries" section for why a GROUP
// header's step-count/score instead lands in `description` (a real DOM conflict with ADR-0143's
// collapsed-summary auto-fill, found while building this).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadStatusStreamDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { exampleSection, captioned } from '../lib/specimens.ts'
import type { UIStatusStreamElement, UITimelineItemElement, StatusEntry } from '@agent-ui/components/components'

const { descriptor, body } = loadStatusStreamDoc()

const { content } = mountPage({
  title: 'ui-status-stream — API',
  intro:
    'The timeline family’s live host (ADR-0122) — a "what the system is doing now" strip: entries appear ' +
    'imperatively and transition state in place. Deliberately NOT catalogued (an EXCLUSION_ALLOWLIST entry, ' +
    'F5) — a consumer-owned imperative streaming host, not one-shot emittable markup. Generated from ' +
    'status-stream.md. See the ui-status-stream demo for the live REAL recorded-match replay.',
})

const stream = document.createElement('ui-status-stream') as UIStatusStreamElement
stream.setAttribute('label', 'Agent activity')
stream.appendEntry({ key: 'search', status: 'done', label: 'Searching the codebase…', description: '42 files matched' })
stream.appendEntry({ key: 'patch', status: 'active', label: 'Generating the patch…' })
stream.update('patch', { text: 'Reasoning: the failure is in the reconcile step — patching value-drag.ts…' })
stream.appendEntry({ key: 'tests', status: 'pending', label: 'Running tests' })

// GH #147/ADR-0153 Fork 1 (the zero-contract-change half) — the genuine `trailing`-slot consumer-content
// pattern, on a NON-grouped entry: safe because no nested-group auto-fill effect competes for the cell.
const trailingLeaf = stream.appendEntry({ key: 'leaf-trailing', status: 'done', label: 'Rendered the diff view' })
trailingLeaf.querySelector('[data-role="trailing"]')!.textContent = 'v2'

// A grouped "reasoning-chain card" (ADR-0146 F5/F6) — a Task Group entry whose children nest under it via
// `parent`, in the three states the Figma "Claude Code Gateway" reasoning-chain card spec (node
// 21:1641/21:1642/21:1643) shows: a first attempt that failed, a still-working task, and a finished one.
// Kept as a PERMANENT, checked-in specimen (rather than only the ad-hoc scripts used to build/review it)
// so a future visual regression on the group-header restyle shows up here, not just in a screenshot diff.
//
// `appendEntry` for a GROUPED child calls `ensureNestedSlot()` (timeline-item.ts), which registers a
// scope-owned effect and THROWS outside the connected lifetime — so, unlike the plain `stream` above, each
// grouped stream is populated AFTER `composeDocPage` connects it to the live document (mirrors the
// stream-demo page's own real order: `content.append(...)` before the replay that calls `appendEntry`).
// An ISO instant ~32s in the past — so the error/done cards' groups (already resolved) tick ONCE on
// mount (freezing immediately, since ticking requires an `active` status) and read "32s" from real
// elapsed math, the SAME number the specimens used to hardcode as a plain string.
const thirtyTwoSecondsAgo = new Date(Date.now() - 32_000).toISOString()

const groupCards: Array<{ caption: string; group: StatusEntry; steps: StatusEntry[]; el: UIStatusStreamElement }> = [
  {
    caption: 'error — a group whose escalated status is `error`, with an inline retry action (Fork 2)',
    group: { key: 'g-error', status: 'error', label: 'Task Group', description: 'First attempt failed', startedAt: thirtyTwoSecondsAgo },
    steps: [
      { key: 'g-error-1', status: 'done', label: 'Task Step 01', timestamp: '8s' },
      // GH #147/ADR-0153 Fork 2 — `action` renders a real retry <ui-button>; the listener below (registered
      // per-card, AFTER connection) is the CONSUMER driving the actual retry — the component never re-runs
      // anything itself.
      { key: 'g-error-2', status: 'error', label: 'Task Step 02', description: 'What went wrong', timestamp: '6s', action: { label: 'Retry' } },
      { key: 'g-error-3', status: 'pending', label: 'Task Step 03', description: 'Planned' },
    ],
    el: document.createElement('ui-status-stream') as UIStatusStreamElement,
  },
  {
    caption: 'active — a group still working, worst-child escalation floors it at `active` — a REAL ticking elapsed timer (Fork 1)',
    group: { key: 'g-progress', status: 'active', label: 'Task Group', description: '3 Steps', startedAt: thirtyTwoSecondsAgo },
    steps: [
      { key: 'g-progress-1', status: 'active', label: 'Task Step 01', description: 'Writing', startedAt: new Date().toISOString() },
      { key: 'g-progress-2', status: 'pending', label: 'Task Step 02', description: 'Planned' },
    ],
    el: document.createElement('ui-status-stream') as UIStatusStreamElement,
  },
  {
    caption: 'done — a settled group, every child resolved, with a final score summary',
    group: { key: 'g-done', status: 'done', label: 'Task Group', description: '3 Steps · 94/100', startedAt: thirtyTwoSecondsAgo },
    steps: [
      { key: 'g-done-1', status: 'done', label: 'Task Step 01', timestamp: '8s' },
      { key: 'g-done-2', status: 'done', label: 'Task Step 02', timestamp: '6s' },
    ],
    el: document.createElement('ui-status-stream') as UIStatusStreamElement,
  },
  {
    // GH #147/ADR-0153 Fork 3 — an all-pending group: every child still "Planned", none started. Escalates
    // to `pending` the moment its children are appended (worst-child-wins over an all-pending set) and
    // paints the new distinct `clock` glyph (ui-timeline-item's GROUP_STATUS_GLYPH) — no `active`/`done`/
    // `error` glyph reused, the family's own shape-first law (ADR-0057).
    caption: 'pending — an all-pending group, not yet started ("Planned"), a real distinct clock glyph',
    group: { key: 'g-planned', label: 'Task Group', description: 'Planned' },
    steps: [
      { key: 'g-planned-1', status: 'pending', label: 'Task Step 01', description: 'Planned' },
      { key: 'g-planned-2', status: 'pending', label: 'Task Step 02', description: 'Planned' },
    ],
    el: document.createElement('ui-status-stream') as UIStatusStreamElement,
  },
]

const specimens = document.createElement('div')
specimens.append(
  exampleSection('A seeded strip (appendEntry + update)', stream),
  exampleSection('Grouped entries — a reasoning-chain card (ADR-0146 F5/F6, GH #147/ADR-0153)', ...groupCards.map((c) => captioned(c.caption, c.el))),
)

composeDocPage(content, descriptor, body, specimens) // connects every specimen above to the live document

// NOW populate the grouped streams — after connection, so ensureNestedSlot's effect registration succeeds.
for (const { group, steps, el } of groupCards) {
  el.appendEntry(group)
  for (const step of steps) el.appendEntry({ ...step, parent: group.key })
  ;(el.querySelector(`ui-timeline-item[data-key="${group.key}"]`) as UITimelineItemElement).toggleDetail(true)
}

// GH #147/ADR-0153 Fork 2 — the CONSUMER'S OWN retry handling: the component only emits `action`; this
// page decides what "retry" means (here: flip the failed step back to `active` and simulate it succeeding
// shortly after — a realistic, consumer-owned retry loop, never anything the component drives itself).
const errorCard = groupCards[0]!.el
errorCard.addEventListener('action', (e) => {
  const { key } = (e as CustomEvent<{ key: string }>).detail
  // The button hides on its own the instant status leaves `error` (#renderAction's own gate) — no
  // separate "clear the action" step needed.
  errorCard.update(key, { status: 'active', description: 'Retrying…' })
  setTimeout(() => errorCard.update(key, { status: 'done', description: 'Succeeded on retry' }), 1200)
})
