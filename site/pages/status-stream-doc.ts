// site/pages/status-stream-doc.ts — the ui-status-stream API doc page (ADR-0122, timeline-family.lld.md).
// DERIVED from status-stream.md via the shared doc-page.ts renderer: the attribute table (size/label), the
// empty events[] table (streamed state rides role=log, never a synthetic event), and the properties[]
// table (appendEntry/update/finalize) are read straight from the parse. Deliberately NOT catalogued
// (ADR-0122 F5) — see the App-surface consumption note below. One representative specimen, seeded via the
// real imperative API. See the ui-status-stream demo for the live REAL-stream replay.
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
const groupCards: Array<{ caption: string; group: StatusEntry; steps: StatusEntry[]; el: UIStatusStreamElement }> = [
  {
    caption: 'error — a group whose escalated status is `error`',
    group: { key: 'g-error', status: 'error', label: 'Task Group', description: 'First attempt failed', timestamp: '32s' },
    steps: [
      { key: 'g-error-1', status: 'done', label: 'Task Step 01', timestamp: '8s' },
      { key: 'g-error-2', status: 'error', label: 'Task Step 02', description: 'What went wrong', timestamp: '6s' },
      { key: 'g-error-3', status: 'pending', label: 'Task Step 03', description: 'Planned' },
    ],
    el: document.createElement('ui-status-stream') as UIStatusStreamElement,
  },
  {
    caption: 'active — a group still working, worst-child escalation floors it at `active`',
    group: { key: 'g-progress', status: 'active', label: 'Task Group', description: '3 Steps', timestamp: '32s' },
    steps: [
      { key: 'g-progress-1', status: 'active', label: 'Task Step 01', description: 'Writing' },
      { key: 'g-progress-2', status: 'pending', label: 'Task Step 02', description: 'Planned' },
    ],
    el: document.createElement('ui-status-stream') as UIStatusStreamElement,
  },
  {
    caption: 'done — a settled group, every child resolved',
    group: { key: 'g-done', status: 'done', label: 'Task Group', description: '3 Steps · 94/100', timestamp: '32s' },
    steps: [
      { key: 'g-done-1', status: 'done', label: 'Task Step 01', timestamp: '8s' },
      { key: 'g-done-2', status: 'done', label: 'Task Step 02', timestamp: '6s' },
    ],
    el: document.createElement('ui-status-stream') as UIStatusStreamElement,
  },
]

const specimens = document.createElement('div')
specimens.append(
  exampleSection('A seeded strip (appendEntry + update)', stream),
  exampleSection('Grouped entries — a reasoning-chain card (ADR-0146 F5/F6)', ...groupCards.map((c) => captioned(c.caption, c.el))),
)

composeDocPage(content, descriptor, body, specimens) // connects every specimen above to the live document

// NOW populate the grouped streams — after connection, so ensureNestedSlot's effect registration succeeds.
for (const { group, steps, el } of groupCards) {
  el.appendEntry(group)
  for (const step of steps) el.appendEntry({ ...step, parent: group.key })
  ;(el.querySelector(`ui-timeline-item[data-key="${group.key}"]`) as UITimelineItemElement).toggleDetail(true)
}
