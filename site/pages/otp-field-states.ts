// site/pages/otp-field-states.ts — the ui-otp-field interaction-states showcase (code-entry-control.lld.md,
// GH #490 S2-a). Stages the REAL <ui-otp-field> in each interaction state (digit entry/auto-advance,
// backspace/arrow navigation, paste, focus, validation, disabled) with instructions so a human can observe
// each one. This page NEVER restyles the control: every state's appearance lives in otp-field.css. This
// module only stages, labels, and wires a live event log — a real `input`/`change` sink proving the
// beforeinput-intercepted edit model + the completion commit are genuine, not faked.
import { mountPage } from './_page.ts' // FIRST import — foundation CSS cascade + self-defining ui-* controls
import './states.css' // SHARED page scaffold (sections, captions, the activity log) — not state styling

const { content } = mountPage({
  title: 'ui-otp-field — interaction states',
  intro:
    'The live <ui-otp-field> below, staged in each interaction state. Every state here is authored by the ' +
    'control itself in otp-field.css — this page only stages and labels, never restyling a field. The one ' +
    'focusable surface is invisible (opacity 0) and stretched over the whole cell grid; the cells you see are ' +
    'pure presentation, painted from the reducer\'s output. Try typing, Backspace, the arrow keys, and pasting ' +
    'a full code into any cell.',
})

// ── small DOM helpers (page scaffold only) ───────────────────────────────────────────────────────────────
interface FieldSpec {
  readonly label: string
  readonly value?: string
  readonly length?: string
  readonly required?: boolean
  readonly disabled?: boolean
}

function makeField(spec: FieldSpec): HTMLElement {
  const el = document.createElement('ui-otp-field')
  el.setAttribute('label', spec.label)
  if (spec.value !== undefined) el.setAttribute('value', spec.value)
  if (spec.length) el.setAttribute('length', spec.length)
  if (spec.required) el.setAttribute('required', '')
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

// ── the shared activity log — a real `input` + `change` sink proving the reducer round-trip ─────────────
const log = document.createElement('ul')
log.className = 'activation-log'
log.setAttribute('aria-live', 'polite')
let eventCount = 0

function attachLog(field: HTMLElement, label: string): void {
  const record = (kind: 'input' | 'change'): void => {
    eventCount += 1
    const value = (field as HTMLElement & { value: string }).value
    const line = document.createElement('li')
    line.dataset.kind = kind
    line.textContent = `#${String(eventCount).padStart(2, '0')}  ${label.padEnd(16)}${kind.padEnd(8)}value=${JSON.stringify(value)}`
    log.append(line)
    log.scrollTop = log.scrollHeight
  }
  field.addEventListener('input', () => record('input'))
  field.addEventListener('change', () => record('change'))
}

// ── [1] digit entry & auto-advance ───────────────────────────────────────────────────────────────────────
const entry = makeSection(
  'Digit entry & auto-advance',
  'Click the field below (focus lands on the first empty cell) and type digits: each one overwrites the ' +
    'active cell and auto-advances to the next empty one. A non-digit keystroke is filtered — nothing happens. ' +
    'Watch the log below for one <code>input</code> line per digit.',
)
const typeMe = makeField({ label: 'Six-digit code' })
attachLog(typeMe, 'Entry')
entry.append(makeRow(typeMe, caption('type digits — cells fill left to right')))

// ── [2] backspace / arrow navigation ─────────────────────────────────────────────────────────────────────
const nav = makeSection(
  'Backspace & arrow navigation',
  '<strong>Backspace</strong> on a filled cell removes it (later digits shift left, no gap); at the end it ' +
    'walks back one cell first. <strong>ArrowLeft/ArrowRight</strong> move the active cell without editing; ' +
    '<strong>Home</strong>/<strong>End</strong> jump to the first/last-empty cell. Traversal never creates a gap.',
)
const navField = makeField({ label: 'Try navigating', value: '123' })
attachLog(navField, 'Nav')
nav.append(makeRow(navField, caption('Backspace / arrows / Home / End')))

// ── [3] paste-split — a full or partial code ─────────────────────────────────────────────────────────────
const paste = makeSection(
  'Paste-split — full or partial codes',
  'Copy a 6-digit number (e.g. <code>424242</code>) and paste it into <em>any</em> cell of the field below — ' +
    'a full code REPLACES the whole value and fires one completion <code>change</code>. A shorter paste ' +
    'writes forward from wherever you pasted, overwriting. Non-digit separators (spaces, dashes) are stripped.',
)
const pasteField = makeField({ label: 'Paste a code here' })
attachLog(pasteField, 'Paste')
paste.append(makeRow(pasteField, caption('paste a full or partial digit string')))

// ── [4] focus — the active-cell indicator (no separate host ring) ───────────────────────────────────────
const focus = makeSection(
  'Focus — the active-cell indicator',
  'Click <em>or</em> Tab into a field. The invisible editor overlay is the ONE focusable surface (one Tab ' +
    'stop); the currently active CELL carries the focus indicator directly (<code>[data-active]</code>) — ' +
    'there is no separate whole-host ring, because the cell IS the caret position.',
)
focus.append(
  makeRow(
    makeField({ label: 'Click me' }),
    makeField({ label: 'Or Tab to me' }),
    caption('click OR Tab → the first-empty cell gets the active ring'),
  ),
)

// ── [5] validation — user-invalid, only AFTER the first interaction ─────────────────────────────────────
const invalid = makeSection(
  'Validation — user-invalid (after first interaction), and a partial code',
  'The first field below is <code>required</code>. Focus it and then blur (Tab away) while it is empty: only ' +
    'NOW does the danger border appear on every cell. The second field starts <code>tooShort</code> (a ' +
    'partial code) — blur it to see the same danger treatment for an under-length code.',
)
const required = makeField({ label: 'Required code', required: true })
attachLog(required, 'Required')
const partial = makeField({ label: 'Partial code', value: '42', required: true })
attachLog(partial, 'Partial')
invalid.append(
  makeRow(required, caption('empty + blur → danger border'), partial, caption('under-length + blur → danger border')),
)

// ── [6] disabled — muted role-repoint, inert, out of the tab order ───────────────────────────────────────
const disabled = makeSection(
  'Disabled — muted role-repoint, fully inert',
  'A <code>disabled</code> field mutes every cell (a role repoint, never opacity) and removes the editor from ' +
    'the tab order. Tab from the first enabled field — focus jumps straight past the disabled one.',
)
disabled.append(
  makeRow(
    makeField({ label: 'Before', value: '123' }),
    caption('enabled — Tab reaches this'),
    makeField({ label: 'Unavailable', value: '123456', disabled: true }),
    caption('disabled — Tab skips it'),
    makeField({ label: 'After', value: '456' }),
    caption('enabled — focus jumps over the disabled one'),
  ),
)

// ── [7] length — a shorter/longer code (the N-cell geometry) ────────────────────────────────────────────
const lengthSection = makeSection(
  'length — a shorter or longer code',
  '<code>length</code> sets the cell count (clamped internally to [1, 12]). A 4-digit PIN and an 8-digit code ' +
    'side by side — the grid\'s own intrinsic width is the floor (§7: no separate min-inline-size token).',
)
lengthSection.append(
  makeRow(
    makeField({ label: '4-digit PIN', length: '4' }),
    makeField({ label: '8-digit code', length: '8' }),
  ),
)

// ── the live log (shared sink for the wired fields above) ────────────────────────────────────────────────
const logSection = makeSection(
  'Live event log — the real input / change round-trip',
  'Every <code>input</code> (each mutation) and <code>change</code> (the completion commit, or blur-with-' +
    'change) from the wired fields above appends a line here with the field\'s current <code>value</code>. ' +
    'A screen reader hears a shorter, separate polite announcement for the same transitions — the log here ' +
    'is the public-event proof, not a substitute for the audible announcement.',
)
logSection.append(log)

content.append(entry, nav, paste, focus, invalid, disabled, lengthSection, logSection)
