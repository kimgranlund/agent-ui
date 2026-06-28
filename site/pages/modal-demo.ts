// site/pages/modal-demo.ts — the ui-modal interaction demo (the ratified container `demo`). Mounts the REAL
// native-<dialog> modal and proves its behaviour honestly: a dismissable modal (Escape / backdrop close) and a
// non-dismissable one (the agent owns the close), with a live close/toggle event log. The platform supplies the
// top layer + backdrop + focus trap + Escape; the control adds focus restore + the open↔platform sync. This
// page only stages the modals, opens them by setting the bindable `open` prop, and logs the user-dismissal events.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-modal — demo',
  intro: 'The modal dialog, live. Open each modal and dismiss it; the event log proves the close / toggle ' +
    'round-trip (fired only on a USER dismissal, never a programmatic close). The API table is on the ui-modal API page.',
})

const text = (s: string): Text => document.createTextNode(s)

// ── the shared close/toggle event log ───────────────────────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logEvent(label: string, name: string): void {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${label.padEnd(18)}${name}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

// modalDemo — a trigger button + a real ui-modal. `open()` sets the bindable `open` prop (as an agent's two-way
// bind would); the in-dialog Close button clears it programmatically (no close/toggle echo — only a user
// dismissal emits). The close/toggle listeners log the USER-driven dismissals (Escape / backdrop click).
function modalDemo(label: string, attrs: Record<string, string>, note: string): HTMLElement {
  const close = uiButton('Close', 'soft')
  const modal = el('ui-modal', attrs, [
    el('h2', {}, [text(label)]),
    el('p', {}, [text(note)]),
    el('ui-row', { gap: 'sm', justify: 'end' }, [close]),
  ])
  modal.addEventListener('close', () => logEvent(label, 'close'))
  modal.addEventListener('toggle', () => logEvent(label, 'toggle'))
  close.addEventListener('click', () => modal.removeAttribute('open')) // programmatic close — no event echoed

  const trigger = uiButton(`Open ${label.toLowerCase()}`, 'solid')
  trigger.addEventListener('click', () => modal.setAttribute('open', ''))

  return el('div', {}, [trigger, modal])
}

const dismissable = modalDemo(
  'Dismissable modal',
  { 'aria-label': 'Dismissable modal' },
  'Press Escape or click the backdrop to dismiss — both fire close + toggle. The in-dialog Close button sets open=false programmatically, which only restores focus (no event).',
)

const blocking = modalDemo(
  'Blocking modal',
  { dismissable: 'false', 'aria-label': 'Blocking modal' },
  'dismissable="false": Escape and a backdrop click are ignored — the agent owns the close. Use the Close button (it sets open=false). No close/toggle is emitted because the close is programmatic.',
)

const focusNote = document.createElement('p')
focusNote.innerHTML =
  'showModal() <strong>traps</strong> focus inside the dialog and the page behind it is inert. The platform does ' +
  'not restore focus to the opener on close, so the control records <code>document.activeElement</code> at open ' +
  'and <strong>restores</strong> it on close — open a modal, dismiss it, and focus returns to the trigger button.'

content.append(
  exampleSection('Dismissable (Escape / backdrop)', dismissable),
  exampleSection('Non-dismissable (agent owns the close)', blocking),
  exampleSection('Focus restore', focusNote),
  exampleSection('close / toggle event log', log),
)
