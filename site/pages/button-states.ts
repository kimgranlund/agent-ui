// site/pages/button-states.ts — ui-button interaction-states showcase. Stages the REAL <ui-button> in each interaction state
// (hover · :focus-visible · :active · keyboard activation · disabled) with instructions so a human can observe
// each one. This page NEVER restyles the control: the state appearance lives entirely in the control's own
// button.css (ADR-0008 per-variant role-ladder states · ADR-0009 shared focus ring · ADR-0010 inert disabled).
// This module only lays the controls out, labels them, and wires a live activation log (a real `click` sink)
// that proves both pointer AND keyboard (press-activation trait) activation.
//
// The states are the CONTROL's, not the page's: hover/active step the background one role-ladder step per
// variant, :focus-visible draws the shared fleet ring, and the host is keyboard-focusable by default (the
// `tabbable` trait sets tabindex=0). So this page adds NO tabindex of its own — and the disabled buttons are
// left to leave the tab order on their own (native `<button disabled>` parity), which is the point being shown.

import { mountPage } from './_page.ts' // FIRST import — foundation CSS cascade + self-defining ui-* controls
import './states.css' // SHARED page scaffold (sections, captions, the activation log), reused by every {name}-states page — not state styling

const { content } = mountPage({
  title: 'Button — interaction states',
  intro:
    'The live <ui-button> below, staged in each interaction state. Every state here is authored by the control ' +
    'itself in button.css — this page only stages and labels, never restyling a button. Hover and active step ' +
    'the background along a per-variant role ladder, :focus-visible draws the shared fleet focus ring, and a ' +
    'disabled button is fully inert — out of the tab order and pointer-dead.',
})

// ── small DOM helpers (page scaffold only) ───────────────────────────────────────────────────────────────
interface ButtonSpec {
  readonly label: string
  readonly variant?: 'solid' | 'soft' | 'ghost'
  readonly size?: 'sm' | 'md' | 'lg'
  readonly disabled?: boolean
}

function makeButton(spec: ButtonSpec): HTMLElement {
  const el = document.createElement('ui-button')
  el.textContent = spec.label
  if (spec.variant) el.setAttribute('variant', spec.variant)
  if (spec.size) el.setAttribute('size', spec.size)
  if (spec.disabled) el.setAttribute('disabled', '')
  // No `tabindex` — the control's `tabbable` trait owns tab participation (tabindex=0 enabled, removed disabled).
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

// ── [1] hover — per-variant background step ──────────────────────────────────────────────────────────────
const hover = makeSection(
  'Hover — per-variant background step',
  'Move your pointer over each enabled button. The control steps its background up one role-ladder step on ' +
    'hover, per variant: <strong>solid</strong> darkens (<code>--md-sys-color-primary → --md-sys-color-primary-dim</code>), ' +
    '<strong>soft</strong> deepens its container tint (<code>--md-sys-color-primary-container-low → --md-sys-color-primary-container' +
    '</code>), and <strong>ghost</strong> — transparent at idle — gains a low container wash. The cursor also ' +
    'becomes a pointer. The disabled button holds its muted colour: it is pointer-inert, so <code>:hover</code> ' +
    'never matches it.',
)
hover.append(
  makeRow(
    makeButton({ label: 'Solid', variant: 'solid' }),
    makeButton({ label: 'Soft', variant: 'soft' }),
    makeButton({ label: 'Ghost', variant: 'ghost' }),
    caption('hover each — background steps up one ladder step'),
    makeButton({ label: 'Disabled', disabled: true }),
    caption('disabled — holds (pointer-inert, :hover never matches)'),
  ),
)

// ── [2] :focus-visible — the shared fleet focus ring ─────────────────────────────────────────────────────
const focus = makeSection(
  ':focus-visible — the shared focus ring',
  'Buttons are keyboard-focusable by default (the <code>tabbable</code> trait sets <code>tabindex=0</code> — ' +
    'this page adds nothing). Press <strong>Tab</strong> to move focus onto a button: the control draws the ' +
    'shared fleet focus ring (ADR-0009) — one identical, layout-neutral <code>outline</code> every control ' +
    'uses, shown for keyboard focus only. Now click a button with the mouse instead — <strong>no</strong> ring ' +
    'appears, because <code>:focus-visible</code> matches keyboard focus, not a pointer click. The ring is the ' +
    'same across all three variants below.',
)
focus.append(
  makeRow(
    makeButton({ label: 'Solid', variant: 'solid' }),
    makeButton({ label: 'Soft', variant: 'soft' }),
    makeButton({ label: 'Ghost', variant: 'ghost' }),
    caption('Tab → identical ring · mouse-click → no ring'),
  ),
)

// ── [3] :active — pressed ────────────────────────────────────────────────────────────────────────────────
const active = makeSection(
  ':active — pressed',
  'Press and <strong>hold</strong> the mouse button down on a control: while held, its background steps to the ' +
    'deepest ladder step — <strong>solid</strong> → <code>--md-sys-color-primary-high</code>, <strong>soft</strong> → ' +
    '<code>--md-sys-color-primary-container-high</code>, <strong>ghost</strong> → <code>--md-sys-color-primary-container</code>. ' +
    'Release to return to the hover/idle fill. With keyboard focus, holding <strong>Space</strong> holds it ' +
    'active until you release.',
)
active.append(
  makeRow(
    makeButton({ label: 'Solid', variant: 'solid' }),
    makeButton({ label: 'Soft', variant: 'soft' }),
    makeButton({ label: 'Ghost', variant: 'ghost' }),
    caption('mouse-down / Space-held → deepest ladder step'),
  ),
)

// ── [4] keyboard activation — the press-activation trait + the live log ──────────────────────────────────
const keyboard = makeSection(
  'Keyboard activation — the press-activation trait',
  'Tab to a button below, then press <strong>Space</strong> or <strong>Enter</strong>. Buttons are ' +
    'keyboard-focusable by default, and the press-activation trait fires a native-parity <code>click</code>: ' +
    '<strong>Space</strong> activates on key-UP (key-DOWN calls <code>preventDefault</code> to stop the page ' +
    'scrolling); <strong>Enter</strong> activates on key-DOWN. Every activation — keyboard or mouse — appends a ' +
    'line to the log below (it listens for the real <code>click</code> event). Trait clicks arrive with ' +
    '<code>detail: 0</code>, pointer clicks with <code>detail ≥ 1</code>, so the log tags the source.',
)
const save = makeButton({ label: 'Save', variant: 'solid' })
const cont = makeButton({ label: 'Continue', variant: 'soft' })
const cancel = makeButton({ label: 'Cancel', variant: 'ghost' })
attachLog(save, 'Save (solid)')
attachLog(cont, 'Continue (soft)')
attachLog(cancel, 'Cancel (ghost)')
keyboard.append(makeRow(save, cont, cancel, caption('Tab to each, then Space or Enter')), log)

// ── [5] disabled — out of the tab order and pointer-inert ────────────────────────────────────────────────
const disabled = makeSection(
  'Disabled — out of the tab order and pointer-inert',
  'A <code>disabled</code> button is fully inert, native-button style. <strong>Tab</strong> from the first ' +
    'enabled button below — focus jumps straight to the last one, <strong>skipping</strong> Unavailable: the ' +
    '<code>tabbable</code> trait removes the disabled host from the tab order (it carries no <code>tabindex' +
    '</code>), so keyboard focus never lands on it and Space/Enter can never reach it. button.css repoints it ' +
    'to muted neutral and sets <code>pointer-events: none</code>, so the cursor stays default and clicking does ' +
    'nothing — the shared activation log above stays unchanged. The control also announces the state to ' +
    'assistive tech via <code>internals.ariaDisabled</code>.',
)
const before = makeButton({ label: 'Before', variant: 'solid' })
const unavailable = makeButton({ label: 'Unavailable', disabled: true })
const after = makeButton({ label: 'After', variant: 'solid' })
attachLog(unavailable, 'Unavailable (disabled)') // wired, yet inert: it produces no log line, pointer or keyboard
disabled.append(
  makeRow(
    before,
    caption('enabled — Tab reaches this'),
    unavailable,
    caption('disabled — Tab skips it; cursor + click inert'),
    after,
    caption('enabled — focus jumps here, over Unavailable'),
  ),
)

content.append(hover, focus, active, keyboard, disabled)
