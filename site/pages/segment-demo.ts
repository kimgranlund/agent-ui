// site/pages/segment-demo.ts — the ui-segment interaction demo (the ratified pattern `demo`; pairs with the
// segment-doc.html API page). ui-segment is the CHILD LEAF of ui-segmented-control (ADR-0095) — it never
// stands alone, so the honest demo mounts it inside the REAL host as a view switcher (list / board /
// calendar) and shows the leaf's own contract from the inside: its `checked` state follows the host's
// exclusivity, its own `change` fires on the leaf (segment.md), the host CONSUMES that and re-emits ONE
// `change` of its own per committed pick (segmented-control.md) — never a `select` (radio-group.ts #commit).
// The control owns exclusivity/roving/selection (radio-group.ts via segmented-control.ts); this page only
// stages, swaps the view, and logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { captioned, el, exampleSection, inline, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-segment — demo',
  intro:
    'The segment leaf, live inside its host: a project view switcher. Click a segment (or Arrow-rove) — the ' +
    'view below swaps, the leaf fires its own change, and the control consumes it and re-emits one change of ' +
    'its own. A segment can be replaced, never toggled off. The API table is on the ui-segment API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── the view switcher — three ui-segment leaves inside a REAL ui-segmented-control ────────────────────────
const VIEWS = {
  list: 'List view — 14 issues, sorted by last update.',
  board: 'Board view — Backlog · In progress · Review · Done.',
  calendar: 'Calendar view — due dates across the next two weeks.',
} as const
type ViewKey = keyof typeof VIEWS

const segments: Record<ViewKey, HTMLElement> = {
  list: el('ui-segment', { value: 'list', checked: '' }, [text('List')]),
  board: el('ui-segment', { value: 'board' }, [text('Board')]),
  calendar: el('ui-segment', { value: 'calendar' }, [text('Calendar')]),
}
const switcher = el('ui-segmented-control', { name: 'view', 'aria-label': 'Project view' }, [
  segments.list, segments.board, segments.calendar,
])

const viewPane = el('div', { class: 'demo-box', 'aria-live': 'polite' }, [text(VIEWS.list)])
const showView = (key: ViewKey): void => { viewPane.textContent = VIEWS[key] }

// ── the event log — the leaf's own `change` + the host's re-emitted `change` (the one commit event) ──────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
const record = (source: string, kind: string, value: unknown): void => {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${source}  ${kind}  value=${JSON.stringify(value)}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}
// Each leaf's own `change` — listened ON THE LEAF (the host stops its propagation), so the log shows WHICH
// segment committed before the host speaks.
for (const seg of Object.values(segments)) {
  seg.addEventListener('change', () => record('ui-segment', 'change', seg.getAttribute('value')))
}
// The host's re-emitted `change` — the one commit event; the view swaps off the group's `value`.
switcher.addEventListener('change', () => {
  const value = (switcher as unknown as { value: string | null }).value
  record('ui-segmented-control', 'change', value)
  if (typeof value === 'string' && value in VIEWS) showView(value as ViewKey)
})

// ── model-driven selection — set a leaf's `checked` programmatically (an agent's two-way bind shape) ─────
// A programmatic write applies silently (no `change` on leaf or host) — the log proves the binding-hygiene
// contract by staying quiet while the highlight still moves and the view still swaps.
const jumpToBoard = inline(uiButton('Select "Board" (model-driven)', 'soft')) // ADR-0223: bare demo action — hugs
jumpToBoard.addEventListener('click', () => {
  // The group's ONE programmatic path — the host's `value` setter unchecks all others + moves the indicator;
  // a bare setAttribute('checked') on a leaf would bypass exclusivity entirely (radio-group.ts).
  ;(switcher as unknown as { value: string | null }).value = 'board'
  showView('board')
})
const modelNote = el('p', {}, [
  text('Writing the host\'s '), code('value'), text(' moves the highlight without emitting — only a USER ' +
    'gesture emits '), code('change'), text('. Re-clicking the already-checked ' +
    'segment is a no-op too: segments replace, they never toggle off.'),
])

// ── scale — the leaf's Control-height row is the HOST's (segment.md: sizing applied by ui-segmented-control's
// compound selector, not the leaf's own tier); an ancestor [scale] re-tables the whole row (ADR-0038). ─────
const scaledControl = (scale: string): HTMLElement =>
  el('div', { scale }, [
    el('ui-segmented-control', { name: `density-${scale}` }, [
      el('ui-segment', { value: 'compact' }, [text('Compact')]),
      el('ui-segment', { value: 'cozy', checked: '' }, [text('Cozy')]),
      el('ui-segment', { value: 'roomy' }, [text('Roomy')]),
    ]),
  ])
const scaleRow = el('div', { style: 'display:flex; gap:1rem; align-items:center; flex-wrap:wrap;' }, [
  captioned('[scale="ui-sm"]', scaledControl('ui-sm')),
  captioned('[scale="ui-md"]', scaledControl('ui-md')),
  captioned('[scale="ui-lg"]', scaledControl('ui-lg')),
])
const scaleNote = el('p', {}, [
  text('A segment has no size of its own — its height, padding and font come from the host\'s Control-height ' +
    'row; an ancestor '), code('[scale]'), text(' re-tables that row for the whole subtree.'),
])

// ── disabled leaf — one segment locked while the rest stay live ──────────────────────────────────────────
const disabledDemo = el('ui-segmented-control', { name: 'export' }, [
  el('ui-segment', { value: 'csv', checked: '' }, [text('CSV')]),
  el('ui-segment', { value: 'json' }, [text('JSON')]),
  el('ui-segment', { value: 'pdf', disabled: '' }, [text('PDF (Pro)')]),
])
const disabledNote = el('p', {}, [
  text('A '), code('disabled'), text(' leaf is skipped by Arrow roving and ignores clicks; its siblings keep ' +
    'the full contract.'),
])

content.append(
  exampleSection('View switcher', switcher, viewPane),
  exampleSection('Model-driven selection', jumpToBoard, modelNote),
  exampleSection('change event log', log),
  exampleSection('Scale', scaleRow, scaleNote),
  exampleSection('Disabled segment', disabledDemo, disabledNote),
)
