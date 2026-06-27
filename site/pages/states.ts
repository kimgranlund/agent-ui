// states.ts — A3 interaction-states showcase. Stages the REAL <ui-button> in each browser/CSS-driven
// interaction state (hover · :focus-visible · :active · keyboard activation · disabled) with instructions so
// a human can observe each one. This page NEVER restyles the control: the state appearance lives in the
// control's own button.css; this module only lays the controls out, labels them, and wires a live activation
// log (a real `click` sink) that proves both pointer AND keyboard (press-activation trait) activation.
//
// Honesty note (labels mirror the ACTUAL G5 control): button.css defines NO custom :hover/:active/:focus-visible
// styling — only `cursor: pointer`, plus the `disabled` muted-colour repoint + `pointer-events: none`. So the
// hover cue is the cursor, and the focus/active rings shown are the browser's DEFAULTS. The control also sets
// no `tabindex`, so this page adds `tabindex="0"` where keyboard focus/activation must be demonstrable.

import { mountPage } from './_page.ts' // FIRST import — foundation CSS cascade + self-defining ui-* controls
import './states.css' // page-local layout chrome only (sections, captions, the log) — not state styling

const { content } = mountPage({
  title: 'Button — interaction states',
  intro:
    'The live <ui-button> below, staged in each interaction state. These states are CSS/browser-driven on the ' +
    'real control — nothing here restyles it. Each section says what to do to observe the state and describes ' +
    'what the G5 control actually does (it styles cursor + disabled; the focus/active rings are browser defaults).',
})

// ── small DOM helpers (page scaffold only) ───────────────────────────────────────────────────────────────
interface ButtonSpec {
  readonly label: string
  readonly variant?: 'solid' | 'soft' | 'ghost'
  readonly size?: 'sm' | 'md' | 'lg'
  readonly disabled?: boolean
  /** Add `tabindex="0"` so the host is keyboard-focusable (the control sets none itself). */
  readonly focusable?: boolean
}

function makeButton(spec: ButtonSpec): HTMLElement {
  const el = document.createElement('ui-button')
  el.textContent = spec.label
  if (spec.variant) el.setAttribute('variant', spec.variant)
  if (spec.size) el.setAttribute('size', spec.size)
  if (spec.disabled) el.setAttribute('disabled', '')
  if (spec.focusable) el.setAttribute('tabindex', '0')
  return el
}

function makeSection(title: string, instructionHtml: string): HTMLElement {
  const section = document.createElement('section')
  section.className = 'state-section'
  const heading = document.createElement('h2')
  heading.textContent = title
  const instruction = document.createElement('p')
  instruction.className = 'state-instruction'
  instruction.innerHTML = instructionHtml // static page-authored strings (with <code>) — no user input
  section.append(heading, instruction)
  return section
}

function makeRow(...nodes: readonly Node[]): HTMLElement {
  const row = document.createElement('div')
  row.className = 'state-row'
  row.append(...nodes)
  return row
}

function caption(text: string): HTMLElement {
  const span = document.createElement('span')
  span.className = 'state-caption'
  span.textContent = text
  return span
}

// ── the shared activation log — a real `click` sink for every wired button ───────────────────────────────
// A native-parity click reaches here from BOTH a pointer click and the press-activation trait's host.click().
// The trait's synthetic click carries `detail: 0`; a pointer click carries `detail ≥ 1`, so we tag the source.
const log = document.createElement('ul')
log.className = 'activation-log'
log.setAttribute('aria-live', 'polite')
let activationCount = 0

function attachLog(button: HTMLElement, label: string): void {
  button.addEventListener('click', (event) => {
    const detail = (event as MouseEvent).detail
    const source = detail === 0 ? 'keyboard' : 'pointer'
    activationCount += 1
    const line = document.createElement('li')
    line.dataset.source = source
    line.textContent = `#${String(activationCount).padStart(2, '0')}  ${label.padEnd(20)}${source.padEnd(10)}(detail=${detail})`
    log.append(line)
    log.scrollTop = log.scrollHeight
  })
}

// ── [1] hover ────────────────────────────────────────────────────────────────────────────────────────────
const hover = makeSection(
  'Hover',
  'Move your pointer over the buttons. The control sets <code>cursor: pointer</code>, so the cursor changes ' +
    'to a pointer over the enabled button. Note: the G5 control defines <strong>no</strong> hover colour ' +
    'change — the cursor is the only hover cue. The disabled button sets <code>cursor: default</code> and ' +
    'does not respond.',
)
hover.append(
  makeRow(
    makeButton({ label: 'Hover me' }),
    caption('enabled — cursor becomes a pointer'),
    makeButton({ label: 'Disabled', disabled: true }),
    caption('disabled — cursor stays default'),
  ),
)

// ── [2] :focus-visible (keyboard focus ring) ─────────────────────────────────────────────────────────────
const focus = makeSection(
  ':focus-visible — keyboard focus ring',
  'Press <strong>Tab</strong> to move keyboard focus onto the button (do not click it) — the browser shows ' +
    'its <code>:focus-visible</code> outline. Now click elsewhere, then click the button with the mouse: ' +
    '<strong>no</strong> ring appears, because <code>:focus-visible</code> shows only for keyboard focus. The ' +
    'G5 control adds no custom focus-visible styling, so the ring is the browser default. The control sets no ' +
    '<code>tabindex</code>, so this page adds <code>tabindex="0"</code> to make the host keyboard-focusable.',
)
focus.append(
  makeRow(
    makeButton({ label: 'Tab to me', focusable: true }),
    caption('Tab → ring · mouse-click → no ring'),
  ),
)

// ── [3] :active (pressed) ────────────────────────────────────────────────────────────────────────────────
const active = makeSection(
  ':active — pressed',
  'Press and <strong>hold</strong> the mouse button down on the control — it is in the <code>:active</code> ' +
    'state while held. (With keyboard focus, holding <strong>Space</strong> also holds it active until you ' +
    'release.) The G5 control defines no custom <code>:active</code> styling, so any visual change is the ' +
    'browser default.',
)
active.append(
  makeRow(makeButton({ label: 'Hold me', focusable: true }), caption('mouse-down / Space-held → :active')),
)

// ── [4] keyboard activation — the press-activation trait + the live log ──────────────────────────────────
const keyboard = makeSection(
  'Keyboard activation — the press-activation trait',
  'Tab to a button below, then press <strong>Space</strong> or <strong>Enter</strong>. The press-activation ' +
    'trait fires a native-parity <code>click</code>: <strong>Space</strong> activates on key-UP (key-DOWN ' +
    'calls <code>preventDefault</code> to stop the page scrolling); <strong>Enter</strong> activates on ' +
    'key-DOWN. Every activation — keyboard or mouse — appends a line to the log below (it listens for the ' +
    'real <code>click</code> event). Trait clicks arrive with <code>detail: 0</code>, pointer clicks with ' +
    '<code>detail ≥ 1</code>, so the log tags the source.',
)
const save = makeButton({ label: 'Save', variant: 'solid', focusable: true })
const cont = makeButton({ label: 'Continue', variant: 'soft', focusable: true })
const cancel = makeButton({ label: 'Cancel', variant: 'ghost', focusable: true })
attachLog(save, 'Save (solid)')
attachLog(cont, 'Continue (soft)')
attachLog(cancel, 'Cancel (ghost)')
keyboard.append(makeRow(save, cont, cancel, caption('Tab to each, then Space or Enter')), log)

// ── [5] disabled — fully inert (pointer AND keyboard) ────────────────────────────────────────────────────
const disabled = makeSection(
  'Disabled — inert to pointer and keyboard',
  'A <code>disabled</code> button is fully inert: button.css repoints it to muted neutral colours and sets ' +
    '<code>pointer-events: none</code> (no pointer cursor, no mouse click), and the trait’s <code>disabled' +
    '</code> guard blocks Space/Enter. Both buttons below are wired to the same log — neither produces a line. ' +
    'The first is given <code>tabindex="0"</code> only so you can Tab to it and confirm Space/Enter do nothing ' +
    '(the trait guard); the second carries no tabindex, showing the pointer is inert (the cursor stays default ' +
    'and clicking logs nothing).',
)
const disabledFocusable = makeButton({ label: 'Unavailable', disabled: true, focusable: true })
const disabledInert = makeButton({ label: 'Unavailable', disabled: true })
attachLog(disabledFocusable, 'Unavailable (kbd)')
attachLog(disabledInert, 'Unavailable (ptr)')
disabled.append(
  makeRow(
    disabledFocusable,
    caption('focusable — Tab + Space/Enter → nothing (trait guard)'),
    disabledInert,
    caption('pointer-events: none → click → nothing'),
  ),
)

content.append(hover, focus, active, keyboard, disabled)
