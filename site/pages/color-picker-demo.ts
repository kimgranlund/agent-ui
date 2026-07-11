// site/pages/color-picker-demo.ts — the ui-color-picker interaction demo (ADR-0123, color-picker.lld.md).
// Mounts the REAL standalone control in a <form> and proves the round-trip: dragging the pad or a channel
// updates el.value AND the FormData entry keyed by `name`. A live readout reflects both; an input/change
// event log tracks every gesture tick + commit. Also shows a required field (valueMissing), an author-
// supplied `[slot=presets]` row of ui-swatch presets, and the `ui-text-field type=color` lazy-overlay leg.
// The descriptor-derived API table is on the color-picker-doc page.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-color-picker — demo',
  intro: 'The standalone color-input control, live inside a <form>. Drag the pad, drag/step a channel slider, ' +
    'or type a value into the readout — the color round-trips into the form (FormData keyed by name), shown ' +
    'in the readout below. The second picker is required (unset → valueMissing). The third shows an author-' +
    'supplied preset row. The fourth is the ui-text-field type=color lazy-overlay leg. The API table is on ' +
    'the ui-color-picker API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── input / change event log ──────────────────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logEvent(line: string): void {
  seq += 1
  const li = document.createElement('li')
  li.textContent = `#${String(seq).padStart(2, '0')}  ${line}`
  log.prepend(li)
}

// ── demo 1: form round-trip ───────────────────────────────────────────────────────────────────
const section1 = exampleSection('Form round-trip')

const form = document.createElement('form')
form.addEventListener('submit', (e) => e.preventDefault())

const picker = document.createElement('ui-color-picker') as HTMLElement & { value: string }
picker.setAttribute('name', 'favorite-color')
picker.setAttribute('value', '#3b82f6')

const readout = document.createElement('p')
readout.className = 'readout'
readout.append(text('value: '), code('#3b82f6'), text(' · FormData: '), code('#3b82f6'))

picker.addEventListener('change', () => {
  const v = picker.value
  const fd = new FormData(form)
  const codes = readout.querySelectorAll('code')
  if (codes[0]) codes[0].textContent = v || '(none)'
  if (codes[1]) codes[1].textContent = (fd.get('favorite-color') as string | null) ?? '(none)'
  logEvent(`change  value="${v}"`)
})
picker.addEventListener('input', () => logEvent(`input   value="${picker.value}"`))

form.append(picker, readout)
section1.append(form)
content.append(section1)

// ── demo 2: required (valueMissing) ───────────────────────────────────────────────────────────
const section2 = exampleSection('Required field (valueMissing)')

const form2 = document.createElement('form')
form2.addEventListener('submit', (e) => e.preventDefault())

const picker2 = document.createElement('ui-color-picker') as HTMLElement & { validity: ValidityState }
picker2.setAttribute('required', '')
picker2.setAttribute('name', 'required-color')

const validity2 = el('p', {}, [text('Validity: '), code('valueMissing')])
picker2.addEventListener('change', () => {
  const v = (picker2 as unknown as { validity: ValidityState }).validity
  validity2.replaceChildren(
    text('Validity: '),
    code(v.valid ? 'valid' : 'invalid'),
    v.valueMissing ? code(' · valueMissing') : text(''),
  )
})

form2.append(picker2, validity2)
section2.append(
  el('p', {}, [text('Pick any color to clear the '), code('valueMissing'), text(' state.')]),
  form2,
)
content.append(section2)

// ── demo 3: presets slot ──────────────────────────────────────────────────────────────────────
const section3 = exampleSection('Author-supplied presets ([slot=presets])')

const picker3 = document.createElement('ui-color-picker') as HTMLElement
picker3.setAttribute('value', '#3b82f6')

const presetColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6']
for (const c of presetColors) {
  const swatch = el('ui-swatch', { value: c, label: c, slot: 'presets' })
  swatch.style.cursor = 'pointer'
  swatch.addEventListener('click', () => {
    picker3.setAttribute('value', c)
    picker3.dispatchEvent(new Event('change', { bubbles: true }))
  })
  picker3.append(swatch)
}

section3.append(
  el('p', {}, [
    text('The control never generates a palette — the author drops content into '), code('[slot=presets]'),
    text(' (here, clickable '), code('ui-swatch'), text(' elements).'),
  ]),
  picker3,
)
content.append(section3)

// ── event log section ──────────────────────────────────────────────────────────────────────────
const logSection = exampleSection('Event log')
logSection.append(log)
content.append(logSection)
