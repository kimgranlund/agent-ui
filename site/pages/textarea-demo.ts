// site/pages/textarea-demo.ts — the ui-textarea interaction demo (the control-tier `demo`, pairing
// textarea-doc.html — the API page). Mounts the REAL multi-line FACE entry control (ADR-0134 — a sibling of
// ui-text-field, not a mode) in one believable product situation — a support-ticket form: a required
// "What happened?" description with a growable `rows` minimum and a live character budget, an optional
// "Steps to reproduce" area seeded through the `selectToEnd()` migration seam, and a readonly agent-notes
// transcript — and proves the event contract honestly: `input` on every edit, `change` on blur-with-change ONLY
// (Enter inserts a newline here, it never commits — the one deliberate divergence from ui-text-field). Submit
// runs reportValidity() so valueMissing paints as the control paints it. The control owns the editor part,
// validity, and geometry (textarea.ts) — this page only stages, wires the log, and asks for validation.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { applyDemoWidth, captioned, el, exampleSection, inline, uiButton } from '../lib/specimens.ts'
import type { UITextareaElement } from '@agent-ui/components/components'

const { content } = mountPage({
  title: 'ui-textarea — demo',
  intro:
    'The multi-line entry control, live in a support-ticket form. Type into the description — Enter inserts a ' +
    'newline (it never commits), the box grows past its rows minimum, and the character budget counts down; Tab ' +
    'away to commit. The event log records every input and every change. Submit runs reportValidity() so the ' +
    'required state paints exactly as the control paints it. The API table is on the ui-textarea API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])

// ── the shared input/change event log ───────────────────────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logLine(line: string): void {
  seq += 1
  const li = document.createElement('li')
  li.textContent = `#${String(seq).padStart(2, '0')}  ${line}`
  log.append(li)
  log.scrollTop = log.scrollHeight
}

/** area — a REAL ui-textarea with the given attributes, wired to the log by its label. */
function area(attrs: Record<string, string>): UITextareaElement {
  const a = el('ui-textarea', attrs) as UITextareaElement
  const name = attrs.label ?? attrs.name ?? 'textarea'
  const record = (kind: string): void => {
    const lines = a.value === '' ? 0 : a.value.split('\n').length
    logLine(`${kind.padEnd(7)} ${name.padEnd(20)} chars=${String(a.value.length).padStart(3)}  lines=${lines}  valid=${String(a.validity.valid)}`)
  }
  a.addEventListener('input', () => record('input'))
  a.addEventListener('change', () => record('change'))
  applyDemoWidth(a, '100%')
  return a
}

// ── [1] the ticket description — required, rows=4 growable minimum, a live character budget ─────────────────
const BUDGET = 280
const description = area({ label: 'What happened?', name: 'description', rows: '4', required: '', placeholder: 'Describe the problem — what you expected, what you saw instead.' })
const budget = el('p', { style: 'margin:0.35rem 0 0; font-size:0.8rem; color:var(--md-sys-color-neutral-on-surface-variant);' }, [text(`${BUDGET} characters left`)])
const refreshBudget = (): void => {
  const left = BUDGET - description.value.length
  budget.textContent = left >= 0 ? `${left} characters left` : `${-left} characters over the ${BUDGET} budget`
  budget.style.color = left < 0 ? 'var(--md-sys-color-danger)' : 'var(--md-sys-color-neutral-on-surface-variant)'
}
description.addEventListener('input', refreshBudget)

const descriptionNote = el('p', {}, [
  strong('Enter inserts a newline'), text(' — the multi-line control never commits on Enter (ui-text-field does). '),
  code('rows="4"'), text(' is a growable MINIMUM: the box grows with content and the corner grip resizes it ' +
    'vertically (native '), code('<textarea>'), text(' parity). '), code('change'),
  text(' fires only on blur-with-change against the value at focus — Tab away to see it.'),
])

// ── [2] steps to reproduce — optional, seeded by a template button through the selectToEnd() seam ───────────
const steps = area({ label: 'Steps to reproduce', name: 'steps', rows: '3', placeholder: '1. …' })
const template = inline(uiButton('Insert numbered template', 'soft')) // ADR-0223: bare demo action — hugs
template.addEventListener('click', () => {
  steps.value = '1. Open the vendor record\n2. Click Save without a billing email\n3. '
  steps.selectToEnd() // focus + caret at the end — the contenteditable equivalent of setSelectionRange(len, len)
  logLine('model   Steps to reproduce  template written + selectToEnd() (programmatic: NO input/change)')
})
const stepsNote = el('p', {}, [
  text('A programmatic '), code('value'), text(' write fires no '), code('input'), text('/'), code('change'),
  text(' (user commits only); '), code('selectToEnd()'), text(' then focuses the editor with the caret after the ' +
    'seeded text so the reporter continues typing step 3.'),
])

// ── [3] agent notes — a readonly transcript (focusable, selectable, not editable) ───────────────────────────
const notes = area({ label: 'Agent notes', name: 'notes', rows: '2', readonly: '', value: 'Ticket auto-triaged to Billing.\nSLA: first response within 4h.' })

// ── [4] Submit — reportValidity() over the record ───────────────────────────────────────────────────────────
const verdict = el('p', { style: 'margin:0.5rem 0 0;' }, [text('Not submitted yet.')])
const submit = uiButton('Submit ticket', 'solid')
submit.addEventListener('click', () => {
  const ok = description.reportValidity() && description.value.length <= BUDGET
  verdict.textContent = ok
    ? `Submitted — ${description.value.length} characters, ${description.value.split('\n').length} lines.`
    : description.value === '' ? 'Blocked — the description is required.' : `Blocked — over the ${BUDGET}-character budget.`
  logLine(`submit  ${ok ? 'ok' : 'blocked'}`)
})
const clear = uiButton('Clear', 'ghost')
clear.addEventListener('click', () => {
  description.value = ''
  steps.value = ''
  refreshBudget()
  verdict.textContent = 'Not submitted yet.'
  logLine('reset   description + steps cleared (programmatic writes: NO input/change)')
})
const form = el('ui-column', { gap: 'md' }, [
  el('div', {}, [description, budget]),
  steps,
  notes,
  el('ui-row', { gap: 'sm', justify: 'end' }, [clear, submit]),
  verdict,
])
applyDemoWidth(form, '30rem')

// ── [5] the axis specimens — size × state ────────────────────────────────────────────────────────────────────
const sizes = el('ui-row', { gap: 'sm', align: 'start', wrap: '' }, [
  captioned('size="sm" rows="2"', el('ui-textarea', { size: 'sm', rows: '2', label: 'Small', placeholder: 'sm' })),
  captioned('size="md" (default)', el('ui-textarea', { label: 'Medium', placeholder: 'md' })),
  captioned('size="lg" rows="2"', el('ui-textarea', { size: 'lg', rows: '2', label: 'Large', placeholder: 'lg' })),
  captioned('disabled', el('ui-textarea', { disabled: '', rows: '2', label: 'Locked', value: 'Closed by the requester.' })),
])

content.append(
  exampleSection('Support ticket', form, descriptionNote),
  exampleSection('Template + selectToEnd()', template, stepsNote),
  exampleSection('input / change event log', log),
  exampleSection('Sizes and states', sizes),
)
