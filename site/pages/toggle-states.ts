// site/pages/toggle-states.ts — ui-toggle interaction-states showcase (GH #832). Stages the REAL <ui-toggle>
// in each interaction state (hover · :focus-visible · :active · keyboard activation · disabled · pressed)
// with instructions so a human can observe each one — the button-states.ts precedent. This page NEVER
// restyles the control: every state's appearance lives entirely in toggle.css; this module only lays the
// controls out, labels them, and wires a live activation log (a real `toggle` event sink) that proves both
// pointer AND keyboard (pressActivation trait) activation.
import { mountPage } from './_page.ts' // FIRST import — foundation CSS cascade + self-defining ui-* controls
import './states.css' // SHARED page scaffold (sections, captions, the activation log), reused by every {name}-states page
import { resolveIcon, type IconName } from '@agent-ui/icons'
import '@agent-ui/icons/phosphor' // registers + activates the Phosphor default pack (ADR-0066)
import type { UIToggleElement } from '@agent-ui/components/components'

const { content } = mountPage({
  title: 'Toggle — interaction states',
  intro:
    'The live <ui-toggle> below, staged in each interaction state. Every state here is authored by the ' +
    'control itself in toggle.css — this page only stages and labels, never restyling a toggle. Hover and ' +
    'active step the pressed/idle fill, :focus-visible draws the shared fleet focus ring, and a disabled ' +
    'toggle is fully inert — out of the tab order and pointer-dead.',
})

// ── small DOM helpers (page scaffold only) ───────────────────────────────────────────────────────────────
interface ToggleSpec {
  readonly label: string
  readonly icon?: IconName
  readonly pressed?: boolean
  readonly disabled?: boolean
}

function makeToggle(spec: ToggleSpec): UIToggleElement {
  const el = document.createElement('ui-toggle') as UIToggleElement
  if (spec.icon) {
    const icon = resolveIcon(spec.icon)
    icon.setAttribute('slot', 'icon')
    el.append(icon)
  }
  el.append(document.createTextNode(spec.label))
  if (spec.pressed) el.setAttribute('pressed', '')
  if (spec.disabled) el.setAttribute('disabled', '')
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

// ── the shared activation log — a real `toggle` sink for every wired control ─────────────────────────────
const log = document.createElement('ul')
log.className = 'activation-log'
log.setAttribute('aria-live', 'polite')
let activationCount = 0

function attachLog(el: UIToggleElement, label: string): void {
  el.addEventListener('click', (event) => {
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

// ── [1] hover — pressed/idle fill step ──────────────────────────────────────────────────────────────────
const hover = makeSection(
  'Hover — idle and pressed fill',
  'Move your pointer over each enabled toggle. The idle (unpressed) pill is a ghost-like transparent ' +
    'background with a hover wash; the pressed pill is a tonal <code>primary-container</code> fill that ' +
    'gains its own hover step. The cursor also becomes a pointer. The disabled toggle holds its muted ' +
    'colour: it is pointer-inert, so <code>:hover</code> never matches it.',
)
hover.append(
  makeRow(
    makeToggle({ label: 'Unpressed' }),
    makeToggle({ label: 'Pressed', pressed: true }),
    caption('hover each — the fill steps'),
    makeToggle({ label: 'Disabled', disabled: true }),
    caption('disabled — holds (pointer-inert, :hover never matches)'),
  ),
)

// ── [2] :focus-visible — the shared fleet focus ring ─────────────────────────────────────────────────────
const focus = makeSection(
  ':focus-visible — the shared focus ring',
  'Toggles are keyboard-focusable by default (the <code>tabbable</code> trait sets <code>tabindex=0</code> ' +
    '— this page adds nothing). Press <strong>Tab</strong> to move focus onto a toggle: the control draws ' +
    'the shared fleet focus ring (ADR-0009). Now click a toggle with the mouse instead — <strong>no</strong> ' +
    'ring appears, because <code>:focus-visible</code> matches keyboard focus, not a pointer click.',
)
focus.append(
  makeRow(
    makeToggle({ label: 'Unpressed' }),
    makeToggle({ label: 'Pressed', pressed: true }),
    caption('Tab → identical ring · mouse-click → no ring'),
  ),
)

// ── [3] :active — held down ─────────────────────────────────────────────────────────────────────────────
const active = makeSection(
  ':active — pressed down',
  'Press and <strong>hold</strong> the mouse button down on a toggle: while held, the fill steps to its ' +
    'deepest ladder step. Release to return to the hover/idle fill. With keyboard focus, holding ' +
    '<strong>Space</strong> holds it active until you release.',
)
active.append(makeRow(makeToggle({ label: 'Unpressed' }), makeToggle({ label: 'Pressed', pressed: true }), caption('mouse-down / Space-held → deepest step')))

// ── [4] keyboard activation — the press-activation trait + the live log ─────────────────────────────────
const keyboard = makeSection(
  'Keyboard activation — the press-activation trait',
  'Tab to a toggle below, then press <strong>Space</strong> or <strong>Enter</strong> — unlike the Indicator ' +
    'class (checkbox/switch/radio), <strong>both</strong> activate (role="button", not role="checkbox"). Every ' +
    'activation — keyboard or mouse — appends a line to the log below (it listens for the real ' +
    '<code>click</code> event). Trait clicks arrive with <code>detail: 0</code>, pointer clicks with ' +
    '<code>detail ≥ 1</code>, so the log tags the source.',
)
const chat = makeToggle({ label: 'Chat', icon: 'chats-circle' })
const settings = makeToggle({ label: 'Settings', icon: 'gear-six' })
attachLog(chat, 'Chat')
attachLog(settings, 'Settings')
keyboard.append(makeRow(chat, settings, caption('Tab to each, then Space or Enter')), log)

// ── [5] disabled — out of the tab order and pointer-inert ───────────────────────────────────────────────
const disabled = makeSection(
  'Disabled — out of the tab order and pointer-inert',
  'A <code>disabled</code> toggle is fully inert. <strong>Tab</strong> from the first enabled toggle below ' +
    '— focus jumps straight to the last one, <strong>skipping</strong> Unavailable: the <code>tabbable</code> ' +
    'trait removes the disabled host from the tab order, so keyboard focus never lands on it and Space/Enter ' +
    'can never reach it. toggle.css repoints it to muted neutral roles and sets <code>pointer-events: none</code>.',
)
const before = makeToggle({ label: 'Before' })
const unavailable = makeToggle({ label: 'Unavailable', disabled: true })
const after = makeToggle({ label: 'After' })
attachLog(unavailable, 'Unavailable (disabled)') // wired, yet inert: produces no log line, pointer or keyboard
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
