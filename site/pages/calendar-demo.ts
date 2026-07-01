// site/pages/calendar-demo.ts — the ui-calendar interaction demo (Wave 5B-1, ADR-0048). Mounts the REAL
// form-associated date picker in a <form> and proves the round-trip: selecting a date updates el.value AND
// the FormData entry keyed by `name`. A live readout reflects both; a change/select event log tracks each
// commit. Also shows the min/max range constraint and the required field with valueMissing. The descriptor-
// derived API table is on the calendar-doc page.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-calendar — demo',
  intro: 'The standalone month-grid date picker, live inside a <form>. Click a day or use Arrow/Enter to select a date — ' +
    'the ISO value round-trips into the form (FormData keyed by name), shown in the readout. The second calendar shows ' +
    'min/max range constraints; the third is required (empty → valueMissing). The API table is on the ui-calendar API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── change / select event log ─────────────────────────────────────────────────────────────────

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

// ── demo 1: basic form round-trip ─────────────────────────────────────────────────────────────

const section1 = exampleSection('Form round-trip')

const form = document.createElement('form')
form.addEventListener('submit', (e) => e.preventDefault())

const cal = document.createElement('ui-calendar') as HTMLElement & { value: string }
cal.setAttribute('name', 'date')

const readout = document.createElement('p')
readout.className = 'readout'
readout.append(
  text('Selected: '),
  code('(none)'),
  text(' · '),
  text('FormData: '),
  code('(none)'),
)

cal.addEventListener('change', () => {
  const v  = (cal as unknown as { value: string }).value
  const fd = new FormData(form)
  const fd1 = fd.get('date')
  const codes = readout.querySelectorAll('code')
  if (codes[0]) codes[0].textContent = v || '(none)'
  if (codes[1]) codes[1].textContent = (fd1 as string | null) ?? '(none)'
})
cal.addEventListener('select', (e) => {
  logEvent(`select  detail="${(e as CustomEvent<string>).detail}"`)
})
cal.addEventListener('change', () => {
  logEvent(`change  value="${(cal as unknown as { value: string }).value}"`)
})

form.append(cal, readout)
section1.append(form)
content.append(section1)

// ── demo 2: min/max range constraint ─────────────────────────────────────────────────────────

const section2 = exampleSection('Range constraint (min · max)')

const cal2 = document.createElement('ui-calendar') as HTMLElement
cal2.setAttribute('value', '2026-07-10')
cal2.setAttribute('min', '2026-07-05')
cal2.setAttribute('max', '2026-07-20')
cal2.setAttribute('name', 'date-range')

section2.append(
  el('p', {}, [
    text('Days before July 5 and after July 20 are '),
    el('code', {}, [text('aria-disabled')]),
    text(' — clicking or pressing Enter on them is a no-op.'),
  ]),
  cal2,
)
content.append(section2)

// ── demo 3: required (valueMissing) ──────────────────────────────────────────────────────────

const section3 = exampleSection('Required field (valueMissing)')

const form3 = document.createElement('form')
form3.addEventListener('submit', (e) => e.preventDefault())

const cal3 = document.createElement('ui-calendar') as HTMLElement & { validity: ValidityState }
cal3.setAttribute('required', '')
cal3.setAttribute('name', 'date-required')

const validity3 = el('p', {}, [text('Validity: '), code('valueMissing')])
cal3.addEventListener('change', () => {
  const v = (cal3 as unknown as { validity: ValidityState }).validity
  validity3.replaceChildren(
    text('Validity: '),
    code(v.valid ? 'valid' : 'invalid'),
    v.valueMissing ? code(' · valueMissing') : text(''),
  )
})

form3.append(cal3, validity3)
section3.append(
  el('p', {}, [text('Select any date to clear the '), code('valueMissing'), text(' state.')]),
  form3,
)
content.append(section3)

// ── event log section ─────────────────────────────────────────────────────────────────────────

const logSection = exampleSection('Event log')
logSection.append(log)
content.append(logSection)
