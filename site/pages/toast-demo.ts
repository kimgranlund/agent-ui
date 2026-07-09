// site/pages/toast-demo.ts — the ui-toast + ui-toast-region interaction demo (the ratified pattern `demo`),
// the app-surface consumption story (ADR-0112 cl.6): a live region + region.show() buttons — plain, urgent,
// actionable — proving the real timing model. Hover any toast (or move focus inside it) to PAUSE its
// auto-dismiss countdown; the actionable toast NEVER auto-dismisses at all (SPEC-R16, WCAG 2.2.1). The
// select/close event log proves the round-trip. The control owns the timing/announcement mechanics
// (toast.ts + toast-region.ts); this page only stages the region and logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection, uiButton } from '../lib/specimens.ts'
import type { UIToastRegionElement, UIToastElement } from '@agent-ui/components/components'

const { content } = mountPage({
  title: 'ui-toast — demo',
  intro:
    'The transient notification card, live, region-hosted. Click a button below to raise a toast. Hover a ' +
    'toast (or Tab into it) to pause its auto-dismiss countdown — it resumes with the remaining time once you ' +
    'leave. The actionable toast never auto-dismisses at all. The API table is on the ui-toast API page.',
})

const region = document.createElement('ui-toast-region') as UIToastRegionElement

// ── the shared select/close event log ────────────────────────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logEvent(label: string, name: string): void {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${label.padEnd(12)}${name}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

function raise(label: string, options: Parameters<UIToastRegionElement['show']>[0]): void {
  const toast = region.show(options) as UIToastElement
  toast.addEventListener('select', () => logEvent(label, 'select'))
  toast.addEventListener('close', () => logEvent(label, 'close'))
}

const plainBtn = uiButton('Show plain toast', 'soft')
plainBtn.addEventListener('click', () => raise('Plain', { message: 'File uploaded.' }))

const urgentBtn = uiButton('Show urgent toast', 'soft')
urgentBtn.addEventListener('click', () => raise('Urgent', { message: 'Upload failed.', urgent: true }))

const actionableBtn = uiButton('Show actionable toast', 'soft')
actionableBtn.addEventListener('click', () => raise('Actionable', { message: 'Upload failed — retry?', action: 'Retry' }))

const buttons = el('div', { style: 'display:flex; gap:0.75rem; flex-wrap:wrap;' }, [plainBtn, urgentBtn, actionableBtn])

const note = el('p', {}, [
  document.createTextNode('The '),
  el('strong', {}, [document.createTextNode('plain')]),
  document.createTextNode(' and '),
  el('strong', {}, [document.createTextNode('urgent')]),
  document.createTextNode(' toasts auto-dismiss after 6s (paused while hovered/focused); the '),
  el('strong', {}, [document.createTextNode('actionable')]),
  document.createTextNode(' toast never does — dismiss it via its Retry or close affordance.'),
])

content.append(
  exampleSection('Raise a toast', buttons, note, region),
  exampleSection('select / close event log', log),
)
