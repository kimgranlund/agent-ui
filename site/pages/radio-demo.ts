// site/pages/radio-demo.ts — the ui-radio interaction demo (the ratified pattern `demo`; pairs with
// radio-doc.html, the API page). Mounts REAL FACE radios where they belong — inside a ui-radio-group (a
// checkout shipping-method picker: exclusivity, Arrow roving, and the group's own change event are the group's;
// the radio's own input + change fire on the leaf that was just checked) — plus the standalone shape (a lone
// radio behaves like a boolean checkbox, per radio.md §Standalone use). A live event log proves both event
// surfaces. The controls own every mechanic (radio.ts / radio-group.ts); this page only stages and logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { captioned, el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-radio — demo',
  intro:
    'The FACE radio, live, inside a real ui-radio-group — a checkout shipping-method picker. Click a method or ' +
    'Arrow-rove the group: the radio that becomes checked fires input + change on itself, and the group ' +
    're-emits change with the new group value. Clicking the already-checked radio is guarded (radios never ' +
    'deselect themselves). The API table is on the ui-radio API page.',
})

const text = (s: string): Text => document.createTextNode(s)

// ── the shared event log ───────────────────────────────────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function record(source: string, kind: string, detail: string): void {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${source}  ${kind}  →  ${detail}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

// ── the shipping-method group: three radios, the second checked by default ─────────────────────────────────
type Method = { readonly value: string; readonly label: string; readonly eta: string; readonly price: string }
const METHODS: readonly Method[] = [
  { value: 'standard', label: 'Standard', eta: '3–5 business days', price: 'Free' },
  { value: 'express', label: 'Express', eta: '1–2 business days', price: '€7.90' },
  { value: 'pickup', label: 'Pickup point', eta: 'Ready tomorrow', price: '€2.50' },
]

function methodRadio(m: Method, checked: boolean): HTMLElement {
  const attrs: Record<string, string> = { value: m.value }
  if (checked) attrs.checked = ''
  const radio = el('ui-radio', attrs, [
    el('span', { style: 'display:inline-flex; flex-direction:column; gap:2px;' }, [
      el('span', {}, [text(`${m.label} — ${m.price}`)]),
      el('span', { style: 'font-size:0.85em; opacity:0.75;' }, [text(m.eta)]),
    ]),
  ])
  radio.addEventListener('input', () => record(`radio[${m.value}]`, 'input', `checked=${String(radio.hasAttribute('checked'))}`))
  radio.addEventListener('change', () => record(`radio[${m.value}]`, 'change', `checked=${String(radio.hasAttribute('checked'))}`))
  return radio
}

const group = el(
  'ui-radio-group',
  { name: 'shipping', orientation: 'vertical', required: '', 'aria-label': 'Shipping method' },
  METHODS.map((m, i) => methodRadio(m, i === 1)),
)
const groupValue = () => JSON.stringify((group as HTMLElement & { value?: string | null }).value ?? null)
group.addEventListener('change', () => record('group', 'change', `value=${groupValue()}`))

const summary = el('p', {}, [text('')])
function showSummary(): void {
  summary.textContent = `Group value: ${groupValue()} — the value the form submits under name="shipping".`
}
group.addEventListener('change', showSummary)
queueMicrotask(showSummary)

const groupNote = el('p', {}, [
  text('The group is '),
  el('code', {}, [text('orientation="vertical"')]),
  text(', so Arrow Up/Down move focus AND selection together (selection-follows-focus); Home/End jump to the ends. ' +
    'Exclusivity, roving, and the form value are the group’s; each radio owns only its own dot + label.'),
])

// ── the standalone shape: a lone radio toggles like a boolean checkbox ─────────────────────────────────────
const gift = el('ui-radio', { name: 'gift', value: 'yes' }, [text('This order is a gift')])
gift.addEventListener('change', () => record('standalone', 'change', `checked=${String(gift.hasAttribute('checked'))}`))
const giftNote = el('p', {}, [
  text('Outside a group a radio has no owner to guard it, so a click TOGGLES '),
  el('code', {}, [text('checked')]),
  text(' both ways — valid for a single “accept” pattern, but multi-choice forms want the group.'),
])

// ── size + state specimens ─────────────────────────────────────────────────────────────────────────────────
const specimenRow = (...figures: HTMLElement[]): HTMLElement =>
  el('div', { style: 'display:flex; flex-wrap:wrap; gap:var(--md-sys-space-lg); align-items:flex-end;' }, figures)

const sizes = specimenRow(
  captioned('size="sm"', el('ui-radio', { size: 'sm', checked: '' }, [text('Small')])),
  captioned('size="md" (default)', el('ui-radio', { checked: '' }, [text('Medium')])),
  captioned('size="lg"', el('ui-radio', { size: 'lg', checked: '' }, [text('Large')])),
)
const states = specimenRow(
  captioned('unchecked', el('ui-radio', {}, [text('Unchecked')])),
  captioned('checked', el('ui-radio', { checked: '' }, [text('Checked')])),
  captioned('disabled', el('ui-radio', { disabled: '' }, [text('Disabled')])),
  captioned('disabled checked', el('ui-radio', { disabled: '', checked: '' }, [text('Disabled, checked')])),
)

content.append(
  exampleSection('Shipping method (inside ui-radio-group)', group, summary, groupNote),
  exampleSection('Standalone radio', gift, giftNote),
  exampleSection('Sizes', sizes),
  exampleSection('States', states),
  exampleSection('input / change event log', log),
)
