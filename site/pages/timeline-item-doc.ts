// site/pages/timeline-item-doc.ts — the ui-timeline-item API doc page (ADR-0122, timeline-family.lld.md;
// recursive nesting + the shared accordion + the collapsed-summary preview per ADR-0143). DERIVED from
// timeline-item.md via the shared doc-page.ts renderer: the attribute table (status/label/description/
// timestamp/icon/size), the events[] table (toggle), the slots[] table (marker/label/description/
// timestamp/trailing/detail/nested/text), and the customStates[] (truncated) are read straight from the
// parse — so none can drift from the contract the trip-wire enforces (ADR-0004). Representative
// specimens: every status marker shape, an icon-driven marker, a collapsible detail, and recursive nesting
// with the collapsed-summary preview.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadTimelineItemDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection } from '../lib/specimens.ts'

const { descriptor, body } = loadTimelineItemDoc()

const { content } = mountPage({
  title: 'ui-timeline-item — API',
  intro:
    'The timeline family’s shared, inert visual atom (ADR-0122) — one rail row: a marker (dot/ring/pulse ' +
    'via CSS, a built-in check/x glyph, or a consumer icon) + content (label/description/timestamp/trailing) ' +
    '+ an optional collapsible detail/nested pair, recursive to arbitrary depth (ADR-0143). Hosted by BOTH ' +
    'ui-timeline (durable) and ui-status-stream (live). Generated from timeline-item.md. See the ' +
    'ui-timeline-item demo for the live marker-shape gallery + the nested collapsed-summary preview.',
})

const statuses = el('ui-timeline', { label: 'Every status marker' }, [
  el('ui-timeline-item', { status: '', label: 'Neutral (no status)' }, []),
  el('ui-timeline-item', { status: 'pending', label: 'Pending — a hollow ring' }, []),
  el('ui-timeline-item', { status: 'active', label: 'Active — a filled dot, optional pulse' }, []),
  el('ui-timeline-item', { status: 'done', label: 'Done — a built-in check glyph' }, []),
  el('ui-timeline-item', { status: 'error', label: 'Error — a built-in cross glyph' }, []),
])

const withDetail = el('ui-timeline', { label: 'A collapsible detail' }, [
  (() => {
    const item = el('ui-timeline-item', { status: 'done', label: 'Deployed', timestamp: 'Apr 15, 2:30 PM' }, [
      el('span', { 'data-role': 'detail' }, [document.createTextNode('Build #4821 — 12 files changed, 3 services restarted.')]),
    ])
    return item
  })(),
])

// ADR-0143 — [data-role="nested"] composes a genuine <ui-timeline>, recursive to arbitrary depth; collapsed,
// the trailing cell auto-fills with the deepest LAST sub-step's label + a status-shape glyph.
const withNested = el('ui-timeline', { label: 'Recursive nesting + the collapsed-summary preview' }, [
  el('ui-timeline-item', { status: 'active', label: 'Fulfilling order #4821' }, [
    el('ui-timeline', { 'data-role': 'nested', label: 'Fulfillment sub-steps' }, [
      el('ui-timeline-item', { status: 'done', label: 'Picked' }),
      el('ui-timeline-item', { status: 'active', label: 'Packing' }),
    ]),
  ]),
])

composeDocPage(content, descriptor, body, exampleSection('Every status marker', statuses, withDetail, withNested))
