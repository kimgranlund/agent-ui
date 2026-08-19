// site/pages/text-field-demo.ts — the ui-text-field interaction demo (the control-tier `demo`, pairing
// text-field-doc.html — the API page). Mounts the REAL 13-type FACE entry control in one believable product
// situation — a "new vendor" record form: contact fields (required name, email, tel, url), commercial fields
// (currency amount, a stepped quantity, a percent discount, a contract-start date), and a masked account
// password with the reveal button — and proves the event contract honestly: `input` on every edit, `change` on
// commit (blur-with-change / Enter / clear button / steppers / a picked date), `toggle` from the password reveal.
// A Save button runs reportValidity() over every field so the validation states (valueMissing · typeMismatch ·
// range) show as the control paints them. The control owns codecs, validity, and affordances (text-field.ts) —
// this page only stages, wires the log, and asks for validation.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { applyDemoWidth, captioned, el, exampleSection, searchIcon, uiButton } from '../lib/specimens.ts'
import type { UITextFieldElement } from '@agent-ui/components/components'

const { content } = mountPage({
  title: 'ui-text-field — demo',
  intro:
    'The typed entry control, live in a "new vendor" form. Type into any field — the event log records every ' +
    'input, every change commit (Tab away, press Enter, use the clear button or a stepper, pick a date), and the ' +
    'password reveal toggle. Save runs reportValidity() over the whole form, so the required, email, url, and ' +
    'range validation states show exactly as the control paints them. The API table is on the ui-text-field ' +
    'API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])

// ── the shared input/change/toggle event log ────────────────────────────────────────────────────────────────
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

/** field — a REAL ui-text-field with the given attributes, wired to the log by its label. */
function field(attrs: Record<string, string>, ...adornments: Node[]): UITextFieldElement {
  const f = el('ui-text-field', attrs, adornments) as UITextFieldElement
  const name = attrs.label ?? attrs.name ?? attrs.type ?? 'field'
  const record = (kind: string): void =>
    logLine(`${kind.padEnd(7)} ${name.padEnd(16)} value=${JSON.stringify(f.value)}  valid=${String(f.validity.valid)}`)
  f.addEventListener('input', () => record('input'))
  f.addEventListener('change', () => record('change'))
  f.addEventListener('toggle', () => logLine(`toggle  ${name.padEnd(16)} password reveal ${f.matches(':state(revealed)') ? 'ON' : 'OFF'}`))
  applyDemoWidth(f, '100%')
  return f
}

// ── [1] contact — the required/format-validated group ──────────────────────────────────────────────────────
const vendorName = field({ label: 'Vendor name', name: 'vendor', required: '', placeholder: 'Acme Fasteners Ltd' })
const email = field({ label: 'Billing email', name: 'email', type: 'email', required: '', placeholder: 'accounts@acme.example' })
const phone = field({ label: 'Phone', name: 'phone', type: 'tel', placeholder: '+1 555 0100' })
const website = field({ label: 'Website', name: 'website', type: 'url', placeholder: 'https://acme.example' })
const contact = el('ui-column', { gap: 'sm' }, [vendorName, email, phone, website])
applyDemoWidth(contact, '26rem')

// ── [2] commercial — the typed codecs: currency · number stepper · percent · date ────────────────────────────
const amount = field({ label: 'Contract value', name: 'amount', type: 'currency', currency: 'EUR', min: '0', placeholder: '0.00' })
const seats = field({ label: 'Seats', name: 'seats', type: 'number', step: '5', min: '5', max: '500', value: '25' })
const discount = field({ label: 'Discount', name: 'discount', type: 'percent', min: '0', max: '40', placeholder: '0' })
const starts = field({ label: 'Contract start', name: 'starts', type: 'date' })
const commercial = el('ui-column', { gap: 'sm' }, [
  el('ui-row', { gap: 'sm', wrap: '' }, [amount, seats]),
  el('ui-row', { gap: 'sm', wrap: '' }, [discount, starts]),
])
applyDemoWidth(commercial, '26rem')

const commercialNote = el('p', {}, [
  text('Typed fields carry a '), strong('codec'), text(': what you type is the display, '), code('value'),
  text(' is the canonical string (a currency amount as a plain decimal, a date as YYYY-MM-DD). The steppers and ' +
    'the calendar pick commit through the same '), code('change'), text(' path as a blur. Out-of-range numbers set '),
  code('rangeUnderflow'), text('/'), code('rangeOverflow'), text(' — try 900 seats, then Tab away.'),
])

// ── [3] account — masked password with the reveal button (the `toggle` emitter) + a leading-icon search ─────
const password = field({ label: 'Portal password', name: 'password', type: 'password', required: '', placeholder: 'at least 12 characters' })
const search = field({ label: 'Find a vendor', type: 'search', placeholder: 'Search vendors' }, searchIcon('leading'))
const account = el('ui-column', { gap: 'sm' }, [password, search])
applyDemoWidth(account, '26rem')

// ── [4] Save — reportValidity() over the whole record, so every invalid state paints at once ─────────────────
const all: UITextFieldElement[] = [vendorName, email, phone, website, amount, seats, discount, starts, password]
const verdict = el('p', { style: 'margin:0.5rem 0 0;' }, [text('Not saved yet.')])
const save = uiButton('Save vendor', 'solid')
save.addEventListener('click', () => {
  const invalid = all.filter((f) => !f.reportValidity())
  verdict.textContent = invalid.length === 0
    ? `Saved — ${all.length} fields valid.`
    : `Blocked — ${invalid.length} invalid: ${invalid.map((f) => f.getAttribute('label')).join(', ')}.`
  logLine(`save    ${invalid.length === 0 ? 'ok' : `blocked (${invalid.length} invalid)`}`)
})
const reset = uiButton('Reset', 'ghost')
reset.addEventListener('click', () => {
  for (const f of all) f.value = f === seats ? '25' : ''
  verdict.textContent = 'Not saved yet.'
  logLine('reset   all fields cleared (programmatic writes: NO input/change events)')
})
const actions = el('ui-row', { gap: 'sm', justify: 'end' }, [reset, save])
applyDemoWidth(actions, '26rem')

const validationNote = el('p', {}, [
  text('A pristine required field is not yet "wrong" — it turns invalid on blur, on Enter, or when '),
  code('reportValidity()'), text(' asks. Email and URL formats set '), code('typeMismatch'),
  text('; an empty required field sets '), code('valueMissing'), text('. Programmatic writes (Reset) fire no '),
  code('input'), text('/'), code('change'), text(' — those are user commits only.'),
])

// ── [5] the axis specimens — size × state ────────────────────────────────────────────────────────────────────
const sizes = el('ui-row', { gap: 'sm', align: 'end', wrap: '' }, [
  captioned('size="sm"', el('ui-text-field', { size: 'sm', label: 'Small', placeholder: 'sm' })),
  captioned('size="md" (default)', el('ui-text-field', { label: 'Medium', placeholder: 'md' })),
  captioned('size="lg"', el('ui-text-field', { size: 'lg', label: 'Large', placeholder: 'lg' })),
  captioned('readonly', el('ui-text-field', { readonly: '', label: 'Reference', value: 'VND-00421' })),
  captioned('disabled', el('ui-text-field', { disabled: '', label: 'Locked', value: 'Managed by finance' })),
])

content.append(
  exampleSection('New vendor — contact', contact),
  exampleSection('New vendor — commercial terms', commercial, commercialNote),
  exampleSection('New vendor — portal account', account),
  exampleSection('Save with validation', actions, verdict, validationNote),
  exampleSection('input / change / toggle event log', log),
  exampleSection('Sizes and states', sizes),
)
