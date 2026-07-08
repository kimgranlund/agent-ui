// site/pages/popover-demo.ts — the ui-popover interaction demo (the ratified pattern `demo`). Mounts the REAL
// overlay-controller popover and proves its behaviour honestly: click the trigger to reveal a top-layer panel,
// then dismiss it — with Escape/outside-click (platform) OR the in-panel "Done" button (programmatic) — the
// live close/toggle event log shows EVERY real transition round-tripping the bindable `open` (ADR-0101: the
// trait announces platform-, component-, and model-driven closes alike, not only platform light-dismiss). The
// control owns the Popover API top layer + light-dismiss + focus move/restore (popover.ts + the overlay
// controller); this page only stages it and logs the host events.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-popover — demo',
  intro: 'The disclosure popover, live. Click the trigger to open the panel; dismiss it with Escape, an ' +
    'outside click, or the in-panel "Done" button. The event log proves EVERY real close fires close + ' +
    'toggle (the two-way open signal, ADR-0101) — platform light-dismiss and a programmatic close alike. ' +
    'The API table is on the ui-popover API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── the shared close/toggle event log ────────────────────────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logEvent(name: string, openState: boolean): void {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${name.padEnd(8)}open=${String(openState)}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

// ── the live popover — first child = trigger (positional child-move), the rest is the top-layer panel ─────────
// The in-panel "Done" button closes programmatically (open=false) — this ALSO logs a close+toggle pair now
// (ADR-0101: the trait announces every real hide, not only a platform dismissal); held as a named const so
// the listener binds the panel button, not the trigger.
const doneBtn = uiButton('Done', 'soft')
const popover = el('ui-popover', {}, [
  uiButton('Open settings', 'solid'),
  el('section', {}, [
    el('h3', {}, [text('Settings')]),
    el('p', {}, [text('This panel is in the Popover API top layer — above any overflow/transform ancestor.')]),
    el('ui-row', { gap: 'sm', justify: 'end' }, [doneBtn]),
  ]),
])
// close/toggle fire on every real close — a platform light-dismiss (Escape / outside-click) or the "Done"
// button's programmatic open=false alike (ADR-0101).
popover.addEventListener('close', () => logEvent('close', (popover as unknown as { open: boolean }).open))
popover.addEventListener('toggle', () => logEvent('toggle', (popover as unknown as { open: boolean }).open))
doneBtn.addEventListener('click', () => popover.removeAttribute('open'))

const placementNote = el('p', {}, [
  text('The panel opens at its '), code('placement'), text(' (default '), code('bottom-start'),
  text('). The JS positioning controller '), strong('flips'), text(' to the opposite side when the preferred ' +
    'side lacks space and '), strong('shifts'), text(' within the viewport. Focus moves into the panel on open ' +
    'and is '), strong('restored'), text(' to the trigger on close.'),
])

content.append(
  exampleSection('Live popover (Escape / outside-click to dismiss)', popover),
  exampleSection('Placement & focus', placementNote),
  exampleSection('close / toggle event log', log),
)
