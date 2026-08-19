// site/pages/drawer-demo.ts — the ui-drawer interaction demo (the ratified container `demo`, ADR-0188). Mounts
// the REAL native-<dialog> drawer and proves its behaviour honestly across all three edges: a default
// (dismissable) drawer per edge, a `persistent` one (the agent owns the close), a long-list scroll specimen
// (scroll-fade visible), and an inline-field specimen (native Tab order — a ui-text-field types freely, the
// form-popover SPEC-R5 lesson) — with a live close/toggle event log. The platform supplies the top layer +
// backdrop + focus trap + Escape; the control adds focus restore + the docked geometry/motion + the
// open↔platform sync. This page only stages the drawers, opens them by setting the bindable `open` prop, and
// logs the user-dismissal events.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection, inline, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-drawer — demo',
  intro: 'The edge-docked modal container, live. Open each drawer and dismiss it; the event log proves the ' +
    'close / toggle round-trip (fired only on a USER dismissal, never a programmatic close). The API table is ' +
    'on the ui-drawer API page.',
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
  line.textContent = `#${String(seq).padStart(2, '0')}  ${label.padEnd(24)}${name}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

// drawerDemo — a trigger button + a real ui-drawer. `open()` sets the bindable `open` prop (as an agent's
// two-way bind would); the in-drawer Close button clears it programmatically (no close/toggle echo — only a
// user dismissal emits). The close/toggle listeners log the USER-driven dismissals (Escape / backdrop click).
function drawerDemo(label: string, attrs: Record<string, string>, bodyNodes: Node[]): HTMLElement {
  const close = uiButton('Close', 'soft')
  const drawer = el('ui-drawer', attrs, [
    el('header', {}, [el('h2', { style: 'margin:0' }, [text(label)])]),
    el('div', { 'data-region': 'content' }, bodyNodes),
    el('footer', { style: 'justify-content:flex-end' }, [close]),
  ])
  drawer.addEventListener('close', () => logEvent(label, 'close'))
  drawer.addEventListener('toggle', () => logEvent(label, 'toggle'))
  close.addEventListener('click', () => drawer.removeAttribute('open')) // programmatic close — no event echoed

  const trigger = inline(uiButton(`Open ${label.toLowerCase()}`, 'solid')) // ADR-0223: bare trigger in block flow — hugs
  trigger.addEventListener('click', () => drawer.setAttribute('open', ''))

  return el('div', {}, [trigger, drawer])
}

// ── the three edges (ADR-0188 cl.3) ─────────────────────────────────────────────────────────────────────────

const endEdge = drawerDemo(
  'End-docked drawer',
  { edge: 'end', 'aria-label': 'End-docked drawer' },
  [el('p', { style: 'margin:0' }, [text('The default edge — the options side. Full viewport height, docked to the inline-end.')])],
)

const startEdge = drawerDemo(
  'Start-docked drawer',
  { edge: 'start', 'aria-label': 'Start-docked drawer' },
  [el('p', { style: 'margin:0' }, [text('Docked to the inline-start — the mirror of `end`.')])],
)

const bottomEdge = drawerDemo(
  'Bottom-docked drawer',
  { edge: 'bottom', 'aria-label': 'Bottom-docked drawer' },
  [el('p', { style: 'margin:0' }, [text('Docked to the physical bottom — content-height, capped at the max-block-size token.')])],
)

// ── persistent (agent owns the close) ───────────────────────────────────────────────────────────────────────

const persistent = drawerDemo(
  'Persistent drawer',
  { edge: 'end', persistent: '', 'aria-label': 'Persistent drawer' },
  [el('p', { style: 'margin:0' }, [
    text('persistent (a presence attribute): Escape and a backdrop click are ignored — the agent owns the ' +
      'close. Use the Close button (it sets open=false). No close/toggle is emitted because the close is programmatic.'),
  ])],
)

// ── a long-list scroll specimen (scroll-fade visible over the dialog viewport) ─────────────────────────────

const listItems: HTMLElement[] = []
for (let i = 1; i <= 40; i++) {
  const row = document.createElement('div')
  row.className = 'demo-box'
  row.textContent = `Agent ${i}`
  listItems.push(row)
}
const longList = drawerDemo(
  'Long-list drawer',
  { edge: 'end', 'aria-label': 'Long-list drawer' },
  [el('div', { style: 'display:flex; flex-direction:column; gap:0.5rem' }, listItems)],
)

// ── an inline-field specimen — native Tab order, no roving focus (the form-popover SPEC-R5 lesson) ──────────

const nameField = document.createElement('ui-text-field')
nameField.setAttribute('label', 'Agent name')
nameField.setAttribute('placeholder', 'Ada Lovelace')
const inlineField = drawerDemo(
  'Inline-rename drawer',
  { edge: 'end', 'aria-label': 'Inline-rename drawer' },
  [
    el('p', { style: 'margin:0' }, [text('The embedded field types freely — the drawer imposes NO roving focus or type-ahead, native Tab order only.')]),
    nameField,
  ],
)

const focusNote = el('p', {}, [
  text('showModal() '),
  el('strong', {}, [text('traps')]),
  text(' focus inside the dialog and the page behind it is inert. The platform does not restore focus to the opener on close, so the control records '),
  el('code', {}, [text('document.activeElement')]),
  text(' at open and '),
  el('strong', {}, [text('restores')]),
  text(' it on close — open a drawer, dismiss it, and focus returns to the trigger button.'),
])

content.append(
  exampleSection('The three edges', endEdge, startEdge, bottomEdge),
  exampleSection('Non-dismissable (agent owns the close)', persistent),
  exampleSection('Long-list scroll (scroll-fade)', longList),
  exampleSection('Inline field (native Tab order)', inlineField),
  exampleSection('Focus restore', focusNote),
  exampleSection('close / toggle event log', log),
)
