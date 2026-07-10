// site/pages/timeline-item-demo.ts — the ui-timeline-item interaction demo (ADR-0122). Proves the item's
// two live facts honestly: the collapsible detail (a real ui-disclosure composition — click OR a
// model-driven toggleDetail(), with a toggle event log) and a status transition cycling through every
// marker shape live (pending → active → done, on a button click) — the control owns the mechanics
// (timeline-item.ts + the composed ui-disclosure); this page only stages + logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection, uiButton } from '../lib/specimens.ts'
import type { UITimelineItemElement } from '@agent-ui/components/components'

const { content } = mountPage({
  title: 'ui-timeline-item — demo',
  intro:
    'The shared rail row, live. Toggle the detail below (click the disclosure summary, or the model-driven ' +
    'button) — both settle open and fire exactly one toggle. The status button cycles the SAME item through ' +
    'every marker shape (a distinct SHAPE per state — never hue alone, ADR-0057). The API table is on the ' +
    'ui-timeline-item API page.',
})

// ── the shared toggle event log ──────────────────────────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logEvent(name: string): void {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${name}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

const item = el('ui-timeline-item', { status: 'active', label: 'Deploying release v1.4.0', timestamp: 'moments ago' }, [
  el('span', { 'data-role': 'detail' }, [document.createTextNode('Build #4821 — 12 files changed, 3 services restarted.')]),
]) as UITimelineItemElement
item.addEventListener('toggle', () => logEvent(`toggle  →  detail open=${String(item.querySelector('[data-part="detail"]')?.hasAttribute('open'))}`))

const modelToggle = uiButton('Toggle detail (model-driven)', 'soft')
modelToggle.addEventListener('click', () => item.toggleDetail())

const STATUS_CYCLE = ['pending', 'active', 'done', 'error'] as const
let statusIdx = 0
const cycleButton = uiButton('Cycle status →', 'soft')
cycleButton.addEventListener('click', () => {
  statusIdx = (statusIdx + 1) % STATUS_CYCLE.length
  item.status = STATUS_CYCLE[statusIdx]!
  logEvent(`status  →  ${item.status}`)
})

content.append(
  exampleSection('Click (or model-driven) toggle', item, modelToggle),
  exampleSection('Cycle every marker shape', cycleButton),
  exampleSection('event log', log),
)
