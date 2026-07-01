// site/pages/text-field-states.ts — the ui-text-field interaction-states showcase (T3). Stages the REAL
// <ui-text-field> in each interaction state (placeholder/empty · :focus-within · hover · filled · user-invalid ·
// disabled · readonly) with instructions so a human can observe each one. This page NEVER restyles the control:
// every state's appearance lives in text-field.css (ADR-0014 — the border-channel ladder, the shared focus ring,
// the disabled role-repoint). This module only stages, labels, and wires a live event log — a real `input` +
// `change` sink — that proves the surface→model + commit round-trip is genuine, not faked.
//
// The states are the CONTROL's, not the page's: hover steps the BORDER colour (a field has no pressed state);
// on :focus-within the border steps to TRANSPARENT and the shared fleet ring is the SOLE focus indicator, on ALL
// focus (native text-input parity, NOT :focus-visible — a coloured focus border would double with the ring into a
// visible double border, corrected per ADR-0014's amendment); user-invalid surfaces only AFTER the first
// blur/change (the trackUserInvalid controller), and disabled is a role-repoint (muted surface/ink/frame), never opacity.
//
// text-field carries a ~20ch min-inline-size floor (#74 / ADR-0021) but layout owns the width above it, so each
// specimen is given a display width by the page (an inline-size on the host) — layout context, not a restyle.
import { mountPage } from './_page.ts' // FIRST import — foundation CSS cascade + self-defining ui-* controls
import './states.css' // SHARED page scaffold (sections, captions, the activity log) — not state styling
import { applyDemoWidth, searchIcon } from '../lib/specimens.ts'

const SPECIMEN_WIDTH = '16rem' // the display width passed to applyDemoWidth (the ADR-0021 width rationale lives there)

const { content } = mountPage({
  title: 'ui-text-field — interaction states',
  intro:
    'The live <ui-text-field> below, staged in each interaction state. Every state here is authored by the ' +
    'control itself in text-field.css — this page only stages and labels, never restyling a field. Hover steps ' +
    'the BORDER colour (a text field has no pressed state); on :focus-within the border steps to transparent and ' +
    'the shared focus ring becomes the sole focus indicator, on all focus (native text-input parity); a required ' +
    'field shows its danger border only after the first interaction; a disabled field is muted and inert. The ' +
    'last two sections stage the numeric types (steppers, min/max, multi-currency, unit, percent) and the picker ' +
    'types (type=date opening the ui-calendar overlay, type=time typed).',
})

// ── small DOM helpers (page scaffold only) ───────────────────────────────────────────────────────────────
// type/currency/unit/step/min/max feed the numeric + picker types (Wave 5A/ADR-0047, Wave 5B/ADR-0048) so a
// specimen renders the real control-injected adornments (steppers, currency symbol, unit suffix, calendar button).
interface FieldSpec {
  readonly label: string
  readonly value?: string
  readonly placeholder?: string
  readonly size?: 'sm' | 'md' | 'lg'
  readonly required?: boolean
  readonly readonly?: boolean
  readonly disabled?: boolean
  readonly leading?: boolean
  readonly type?: string
  readonly currency?: string
  readonly unit?: string
  readonly step?: string
  readonly min?: string
  readonly max?: string
}

function makeField(spec: FieldSpec): HTMLElement {
  const el = document.createElement('ui-text-field')
  el.setAttribute('label', spec.label) // → the editor's aria-label (the labelling seam)
  if (spec.value !== undefined) el.setAttribute('value', spec.value)
  if (spec.placeholder !== undefined) el.setAttribute('placeholder', spec.placeholder)
  if (spec.size) el.setAttribute('size', spec.size)
  if (spec.required) el.setAttribute('required', '')
  if (spec.readonly) el.setAttribute('readonly', '')
  if (spec.disabled) el.setAttribute('disabled', '')
  if (spec.type) el.setAttribute('type', spec.type)
  if (spec.currency) el.setAttribute('currency', spec.currency)
  if (spec.unit) el.setAttribute('unit', spec.unit)
  if (spec.step) el.setAttribute('step', spec.step)
  if (spec.min) el.setAttribute('min', spec.min)
  if (spec.max) el.setAttribute('max', spec.max)
  if (spec.leading) el.append(searchIcon('leading'))
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
// input fires on every edit (surface→model); change fires on commit (blur-with-change or Enter). A wired field
// appends a line per event with its current value — the honest proof the demo runs the real control, not a mock.
const log = document.createElement('ul')
log.className = 'activation-log'
log.setAttribute('aria-live', 'polite')
let eventCount = 0

function attachLog(field: HTMLElement, label: string): void {
  const record = (kind: 'input' | 'change'): void => {
    eventCount += 1
    const value = (field as HTMLElement & { value: string }).value
    const line = document.createElement('li')
    line.dataset.kind = kind // the honest event kind (input|change); states.css tints `change` lines
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
    '(not <code>:empty</code> — a cleared contenteditable can hold a stray <code>&lt;br&gt;</code>; ADR-0014). ' +
    'Type into the field and the placeholder disappears and the value tracks your edit (surface→model) — each ' +
    'keystroke appends an <code>input</code> line to the log at the bottom.',
)
const typeMe = makeField({ label: 'Your name', placeholder: 'Start typing…' })
attachLog(typeMe, 'Name')
placeholder.append(makeRow(typeMe, caption('type here — placeholder clears, value tracks')))

// ── [2] focus — :focus-within: the border steps to TRANSPARENT, the shared ring is the sole indicator (ALL focus) ─
const focus = makeSection(
  'Focus — :focus-within (all focus, native parity)',
  'Click <em>or</em> Tab into a field. On <code>:focus-within</code> the field <strong>border steps to ' +
    'transparent</strong> and the shared fleet focus ring (ADR-0009) is the <strong>sole</strong> focus ' +
    'indicator — a coloured border step would double with the ring into a visible double border (corrected per ' +
    'ADR-0014’s amendment), and a transparent border preserves the box geometry (no layout shift). Because ' +
    'it keys on <code>:focus-within</code> — not a button’s keyboard-only <code>:focus-visible</code> — the ' +
    'ring shows on a <strong>mouse click too</strong>: a text field must visibly signal where typing will land. ' +
    'The ring is also the load-bearing <code>forced-colors</code> indicator (<code>--c-focus-ring → Highlight</code>).',
)
focus.append(
  makeRow(
    makeField({ label: 'Click me', placeholder: 'click or Tab in' }),
    makeField({ label: 'Or me', placeholder: 'ring shows on pointer focus too' }),
    caption('click OR Tab → focus ring (the border goes transparent)'),
  ),
)

// ── [3] hover — the border channel ───────────────────────────────────────────────────────────────────────
const hover = makeSection(
  'Hover — the border channel',
  'Move your pointer over an enabled field. The control steps its <strong>border-color</strong> up one role ' +
    'step (<code>--c-neutral → --c-neutral-high</code>) — a text field styles its states off the BORDER, not a ' +
    'background fill (it has no pressed/active state; ADR-0014 cl.2c). The disabled field holds its muted frame ' +
    '— it is pointer-inert, so <code>:hover</code> never matches it.',
)
hover.append(
  makeRow(
    makeField({ label: 'Hover me', value: 'Hover to step the border' }),
    caption('hover → border steps up one role step'),
    makeField({ label: 'Disabled', value: 'Inert', disabled: true }),
    caption('disabled — holds (pointer-inert)'),
  ),
)

// ── [4] validation — user-invalid, only AFTER the first interaction ──────────────────────────────────────
const invalid = makeSection(
  'Validation — user-invalid (after first interaction)',
  'The field below is <code>required</code>. Focus it and then blur (Tab away) or press <strong>Enter</strong> ' +
    'while it is empty: only NOW does the danger border + <code>aria-invalid</code> appear, with the validity ' +
    'message wired to the editor via <code>aria-describedby</code> (a non-colour WCAG 1.4.1 reinforcement). The ' +
    'treatment is suppressed until that first blur/change by the <code>trackUserInvalid</code> controller — a ' +
    'pristine required field is not yet "wrong". Type a value and it returns to valid; clear it and blur to see ' +
    'it return.',
)
const required = makeField({ label: 'Email (required)', placeholder: 'leave empty, then Tab away', required: true })
attachLog(required, 'Email')
invalid.append(makeRow(required, caption('empty + blur → danger border + message · type → valid')))

// ── [5] disabled — muted role-repoint, inert, out of the tab order ───────────────────────────────────────
const disabled = makeSection(
  'Disabled — muted role-repoint, fully inert',
  'A <code>disabled</code> field is muted by a role <strong>repoint</strong> (a low surface + variant ink + a ' +
    'faint frame), <strong>not</strong> opacity (tokens.md). Tab from the first enabled field — focus jumps ' +
    'straight past the disabled one: its editor is <code>contenteditable=false</code> with no <code>tabindex' +
    '</code>, so keyboard focus never lands on it, and the host is pointer-inert. The disabled+invalid case ' +
    'cannot occur — a disabled field does not validate, so the danger border is left untouched.',
)
disabled.append(
  makeRow(
    makeField({ label: 'Before', value: 'Tab reaches this' }),
    caption('enabled — Tab reaches this'),
    makeField({ label: 'Unavailable', value: 'skipped', disabled: true }),
    caption('disabled — Tab skips it; pointer-inert'),
    makeField({ label: 'After', value: 'focus jumps here' }),
    caption('enabled — focus jumps over the disabled one'),
  ),
)

// ── [6] readonly — focusable + selectable, not editable, still submits ───────────────────────────────────
const readonly = makeSection(
  'Read only — focusable but not editable',
  'A <code>readonly</code> field differs from disabled: its editor is <code>contenteditable=false</code> but ' +
    'still <strong>focusable</strong> (<code>tabindex=0</code>) and selectable, carries <code>aria-readonly' +
    '</code>, and <strong>still submits</strong> its value (ADR-0014 dev#b). Tab into it and you can focus and ' +
    'select the text — but not change it (no <code>input</code> lines appear in the log).',
)
const ro = makeField({ label: 'Read only', value: 'Select me, but you cannot edit' })
ro.setAttribute('readonly', '')
attachLog(ro, 'ReadOnly')
readonly.append(makeRow(ro, caption('Tab in → focus + select, but not edit; still submits')))

// ── [7] numeric types — steppers, min/max, multi-currency, unit, percent (Wave 5A / ADR-0047) ─────────────
const numeric = makeSection(
  'Numeric types — steppers, min/max, multi-currency, unit & percent',
  'These types resolve a numeric codec plus control-injected adornments. Use the <strong>▲▼ steppers</strong> ' +
    '(or <code>ArrowUp</code>/<code>ArrowDown</code> in the editor) to increment by <code>step</code>, clamped ' +
    'to <code>[min, max]</code> — each step fires <code>input</code> + <code>change</code> into the log. A ' +
    '<code>currency</code> field renders the per-currency symbol and fraction digits (USD 2 · JPY 0 · EUR 2); a ' +
    '<code>unit</code> / <code>percent</code> field renders a trailing suffix. A value outside <code>[min, max]' +
    '</code> raises <code>rangeUnderflow</code> / <code>rangeOverflow</code> after the first interaction.',
)
const usd = makeField({ label: 'Amount (USD)', type: 'currency', currency: 'USD', value: '1299.99', step: '10' })
const jpy = makeField({ label: 'Amount (JPY)', type: 'currency', currency: 'JPY', value: '150000', step: '1000' })
const eur = makeField({ label: 'Amount (EUR)', type: 'currency', currency: 'EUR', value: '1299.5', step: '10' })
attachLog(usd, 'USD')
numeric.append(
  makeRow(usd, jpy, eur, caption('same value, three currencies → symbol + fraction digits differ')),
)
const count = makeField({ label: 'Quantity', type: 'number', value: '10', step: '5', min: '0', max: '20' })
const mass = makeField({ label: 'Mass', type: 'unit', unit: 'kilogram', value: '72', step: '1' })
const pct = makeField({ label: 'Complete', type: 'percent', value: '65', step: '5', min: '0', max: '100' })
attachLog(count, 'Quantity')
attachLog(mass, 'Mass')
attachLog(pct, 'Percent')
numeric.append(
  makeRow(count, caption('number · step 5 · clamped to [0, 20]')),
  makeRow(mass, caption('unit=kilogram → “kg” suffix · steppers')),
  makeRow(pct, caption('percent → “%” suffix · step 5 · [0, 100]')),
)

// ── [8] picker types — type=date opens the calendar overlay, type=time is typed (Wave 5B / ADR-0048) ──────
const pickers = makeSection(
  'Picker types — type=date opens the calendar, type=time typed',
  'A <code>type=date</code> field shows a <strong>calendar button</strong> (<code>aria-haspopup="dialog"</code>) ' +
    'that opens a <code>&lt;ui-calendar&gt;</code> in a top-layer Popover overlay — pick a day (click or ' +
    'Arrow+Enter) and the field’s <code>value</code> becomes the ISO <code>YYYY-MM-DD</code> and fires exactly ' +
    'one <code>change</code> (the calendar’s own change is stopped at the field boundary, matching native ' +
    '<code>&lt;input type=date&gt;</code>). A <code>type=time</code> field is typed (<code>HH:MM</code>), its ' +
    'canonical value ISO while the display is locale-formatted.',
)
const date = makeField({ label: 'Date', type: 'date', value: '2026-07-15' })
const time = makeField({ label: 'Time', type: 'time', value: '14:30' })
attachLog(date, 'Date')
attachLog(time, 'Time')
pickers.append(
  makeRow(date, caption('click the calendar button → pick a day → one change')),
  makeRow(time, caption('typed HH:MM · canonical value stays ISO')),
)

// ── the live log (shared sink for the wired fields above) ────────────────────────────────────────────────
const logSection = makeSection(
  'Live event log — the real input / change round-trip',
  'Every <code>input</code> (each edit, surface→model) and <code>change</code> (commit on blur-with-change or ' +
    'Enter) from the wired fields above appends a line here with the field\'s current <code>value</code>. The ' +
    'log listens for the real DOM events the control emits — proof the demo runs the actual control, not a mock.',
)
logSection.append(log)

content.append(placeholder, focus, hover, invalid, disabled, readonly, numeric, pickers, logSection)
