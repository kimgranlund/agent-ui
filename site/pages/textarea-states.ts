// site/pages/textarea-states.ts — the ui-textarea interaction-states showcase (ADR-0134). Stages the REAL
// <ui-textarea> in each interaction state (placeholder/empty · Enter-inserts-newline · focus · hover ·
// user-invalid · disabled · readonly · resize) with instructions so a human can observe each one. This page
// NEVER restyles the control: every state's appearance lives in textarea.css. This module only stages,
// labels, and wires a live event log — a real `input` + `change` sink — that proves the surface→model +
// blur-with-change commit round-trip is genuine, not faked.
//
// The states are mostly the ui-text-field precedent REUSED (border-channel hover/focus, user-invalid timing,
// the disabled role-repoint) — see text-field-states.ts for the shared rationale. What is NEW here is the
// ADR-0134 inversion: Enter inserts a newline and never commits (commit is blur-with-change only), and the
// growable rows/resize geometry.
import { mountPage } from './_page.ts' // FIRST import — foundation CSS cascade + self-defining ui-* controls
import './states.css' // SHARED page scaffold (sections, captions, the activity log) — not state styling
import { applyDemoWidth } from '../lib/specimens.ts'

const SPECIMEN_WIDTH = '18rem'

const { content } = mountPage({
  title: 'ui-textarea — interaction states',
  intro:
    'The live <ui-textarea> below, staged in each interaction state. Every state here is authored by the ' +
    'control itself in textarea.css — this page only stages and labels, never restyling a field. The defining ' +
    'ADR-0134 inversion from ui-text-field: press Enter and it inserts a newline instead of committing — commit ' +
    'is blur-with-change only. Hover/focus/user-invalid/disabled reuse the ui-text-field border-channel pattern ' +
    'verbatim; the growable rows minimum and resize:vertical are this control\'s own geometry law.',
})

// ── small DOM helpers (page scaffold only) ───────────────────────────────────────────────────────────────
interface FieldSpec {
  readonly label: string
  readonly value?: string
  readonly placeholder?: string
  readonly size?: 'sm' | 'md' | 'lg'
  readonly rows?: string
  readonly required?: boolean
  readonly readonly?: boolean
  readonly disabled?: boolean
}

function makeField(spec: FieldSpec): HTMLElement {
  const el = document.createElement('ui-textarea')
  el.setAttribute('label', spec.label)
  if (spec.value !== undefined) el.setAttribute('value', spec.value)
  if (spec.placeholder !== undefined) el.setAttribute('placeholder', spec.placeholder)
  if (spec.size) el.setAttribute('size', spec.size)
  if (spec.rows) el.setAttribute('rows', spec.rows)
  if (spec.required) el.setAttribute('required', '')
  if (spec.readonly) el.setAttribute('readonly', '')
  if (spec.disabled) el.setAttribute('disabled', '')
  applyDemoWidth(el, SPECIMEN_WIDTH)
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

// ── the shared activity log — a real `input` + `change` sink proving the surface→model round-trip ────────────
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

// ── [1] placeholder & empty — the data-empty placeholder ─────────────────────────────────────────────────
const placeholder = makeSection(
  'Placeholder & empty — the data-empty cue',
  'An empty field shows its <code>placeholder</code> via a control-toggled <code>data-empty</code> attribute ' +
    '(the ui-text-field pattern reused verbatim). Type into the field and the placeholder disappears and the ' +
    'value tracks your edit (surface→model) — each keystroke appends an <code>input</code> line to the log.',
)
const typeMe = makeField({ label: 'Your notes', placeholder: 'Start typing…' })
attachLog(typeMe, 'Notes')
placeholder.append(makeRow(typeMe, caption('type here — placeholder clears, value tracks')))

// ── [2] Enter inserts a newline — the ADR-0134 inversion ─────────────────────────────────────────────────
const enterKey = makeSection(
  'Enter inserts a newline — the ADR-0134 inversion',
  'Press <strong>Enter</strong> inside the field below: it inserts a literal newline, exactly like a native ' +
    '<code>&lt;textarea&gt;</code> — it does <strong>not</strong> commit (the opposite of ui-text-field, whose ' +
    'Enter <code>preventDefault</code>s and commits). Commit only happens on <strong>blur-with-change</strong> ' +
    '(Tab or click away after an edit) — watch the log: typing + Enter appends only <code>input</code> lines; ' +
    'blurring afterward appends the one <code>change</code> line.',
)
const multiline = makeField({ label: 'Multi-line', placeholder: 'Type, press Enter, keep typing…' })
attachLog(multiline, 'Multiline')
enterKey.append(makeRow(multiline, caption('Enter → newline (input only) · blur → change')))

// ── [3] focus — :focus-within: the border steps to TRANSPARENT, the shared ring is the sole indicator ─────
const focus = makeSection(
  'Focus — :focus-within (all focus, native parity)',
  'Click <em>or</em> Tab into a field. On <code>:focus-within</code> the field <strong>border steps to ' +
    'transparent</strong> and the shared fleet focus ring (ADR-0009) is the <strong>sole</strong> focus ' +
    'indicator — the ui-text-field ADR-0014 dev#1 pattern reused verbatim, including the mouse-focus parity ' +
    '(not a button\'s keyboard-only <code>:focus-visible</code>).',
)
focus.append(
  makeRow(
    makeField({ label: 'Click me', placeholder: 'click or Tab in' }),
    makeField({ label: 'Or me', placeholder: 'ring shows on pointer focus too' }),
    caption('click OR Tab → focus ring (the border goes transparent)'),
  ),
)

// ── [4] hover — the border channel ───────────────────────────────────────────────────────────────────────
const hover = makeSection(
  'Hover — the border channel',
  'Move your pointer over an enabled field. The control steps its <strong>border-color</strong> up one role ' +
    'step — a multi-line field has no pressed/active state, the same as ui-text-field (ADR-0014 cl.2c, reused). ' +
    'The disabled field holds its muted frame — it is pointer-inert.',
)
hover.append(
  makeRow(
    makeField({ label: 'Hover me', value: 'Hover to step the border' }),
    caption('hover → border steps up one role step'),
    makeField({ label: 'Disabled', value: 'Inert', disabled: true }),
    caption('disabled — holds (pointer-inert)'),
  ),
)

// ── [5] validation — user-invalid, only AFTER the first interaction ──────────────────────────────────────
const invalid = makeSection(
  'Validation — user-invalid (after first interaction)',
  'The field below is <code>required</code>. Focus it and then blur (Tab away) while it is empty: only NOW ' +
    'does the danger border + <code>aria-invalid</code> appear, with the validity message wired via ' +
    '<code>aria-describedby</code> (WCAG 1.4.1) — the <code>trackUserInvalid</code> timing controller, reused ' +
    'from ui-text-field. Note Enter never commits here, so only a real blur arms the check.',
)
const required = makeField({ label: 'Bio (required)', placeholder: 'leave empty, then Tab away', required: true })
attachLog(required, 'Bio')
invalid.append(makeRow(required, caption('empty + blur → danger border + message · type → valid')))

// ── [6] disabled — muted role-repoint, inert, out of the tab order ───────────────────────────────────────
const disabled = makeSection(
  'Disabled — muted role-repoint, fully inert',
  'A <code>disabled</code> field is muted by a role <strong>repoint</strong> (not opacity), inert, and also ' +
    'loses <code>resize</code> (a disabled surface is not user-resizable — new to this control, no ' +
    'ui-text-field equivalent). Tab from the first enabled field — focus jumps straight past the disabled one.',
)
disabled.append(
  makeRow(
    makeField({ label: 'Before', value: 'Tab reaches this' }),
    caption('enabled — Tab reaches this'),
    makeField({ label: 'Unavailable', value: 'skipped', disabled: true }),
    caption('disabled — Tab skips it; not resizable'),
    makeField({ label: 'After', value: 'focus jumps here' }),
    caption('enabled — focus jumps over the disabled one'),
  ),
)

// ── [7] readonly — focusable + selectable, not editable, still submits ───────────────────────────────────
const readonly = makeSection(
  'Read only — focusable but not editable',
  'A <code>readonly</code> field is <code>contenteditable=false</code> but still <strong>focusable</strong> ' +
    '(<code>tabindex=0</code>) and selectable, carries <code>aria-readonly</code>, and <strong>still ' +
    'submits</strong> its value (the ui-text-field ADR-0014 dev#b pattern, reused).',
)
const ro = makeField({ label: 'Read only', value: 'Select me, but you cannot edit' })
ro.setAttribute('readonly', '')
attachLog(ro, 'ReadOnly')
readonly.append(makeRow(ro, caption('Tab in → focus + select, but not edit; still submits')))

// ── [8] rows & resize — the growable-minimum geometry (ADR-0134's own law) ───────────────────────────────
const grow = makeSection(
  'Rows & resize — the growable-minimum geometry',
  '<code>rows</code> sets a <strong>minimum</strong> height (<code>rows × line-box + 2·block-padding</code>), ' +
    'never a fixed one — unlike ui-text-field\'s single-line <code>(scale × size) → §1-row</code> lookup. Type ' +
    'enough lines to push past the minimum: the box scrolls (<code>overflow-y: auto</code>) instead of growing ' +
    'unbounded. Drag the bottom-right corner to resize it taller — <code>resize: vertical</code>, native ' +
    '<code>&lt;textarea&gt;</code> parity.',
)
const growable = makeField({ label: 'Try me', rows: '2', placeholder: 'Type several lines, then drag the corner…' })
attachLog(growable, 'Growable')
grow.append(makeRow(growable, caption('type past rows=2 → scrolls · drag corner → resizes')))

// ── the live log (shared sink for the wired fields above) ────────────────────────────────────────────────
const logSection = makeSection(
  'Live event log — the real input / change round-trip',
  'Every <code>input</code> (each edit, surface→model) and <code>change</code> (commit on blur-with-change — ' +
    'Enter never commits here) from the wired fields above appends a line here with the field\'s current ' +
    '<code>value</code>. The log listens for the real DOM events the control emits.',
)
logSection.append(log)

content.append(placeholder, enterKey, focus, hover, invalid, disabled, readonly, grow, logSection)
