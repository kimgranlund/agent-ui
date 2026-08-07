// site/pages/multi-select-demo.ts — the ui-multi-select interaction demo (the ratified pattern `demo`,
// M-F, multi-select-field.lld.md · ADR-0175). Mounts the REAL multi-select field inside a <form> and
// proves the form round-trip honestly: toggling options updates this.value AND MULTIPLE FormData entries
// keyed by `name`; a live readout reflects both. One option is disabled (skipped by roving + commit) and
// the field is `required` (empty → valueMissing). The select event log shows every toggle commit. The
// control owns all listbox / form participation (multi-select.ts); this page only stages the form and
// reads it back.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-multi-select — demo',
  intro: 'The multi-select form field, live inside a <form>. Toggle options — the value array round-trips ' +
    'into the form (MULTIPLE FormData entries under name, one per selection), shown in the readout. One ' +
    'option is disabled; the field is required (empty → valueMissing). The select log tracks every toggle ' +
    'commit. The API table is on the ui-multi-select API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── the select event log ─────────────────────────────────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logEvent(line: string): void {
  seq += 1
  const li = document.createElement('li')
  li.textContent = `#${String(seq).padStart(2, '0')}  ${line}`
  log.append(li)
  log.scrollTop = log.scrollHeight
}

// ── the live multi-select inside a real <form> — the [role=option] children stay direct light-DOM
// children (the host itself IS the listbox — no control-created panel to move into, unlike ui-select).
// One option is aria-disabled (skipped by roving + commit). `required` drives valueMissing when empty.
const multiSelect = el('ui-multi-select', { name: 'skills', label: 'Skills', required: '' }, [
  el('div', { role: 'option', value: 'js' }, [text('JavaScript')]),
  el('div', { role: 'option', value: 'css' }, [text('CSS')]),
  el('div', { role: 'option', value: 'html' }, [text('HTML')]),
  el('div', { role: 'option', value: 'wasm', 'aria-disabled': 'true' }, [text('WebAssembly (coming soon)')]),
])

const form = el('form', {}, [multiSelect])
form.style.display = 'flex'
form.style.flexDirection = 'column'
form.style.gap = '0.75rem'
form.style.alignItems = 'flex-start'

// A live readout of the form value — reads this.value and the FULL set of FormData entries keyed by
// `name`, proving the multiplicity round-trip. Updated on every select commit and on submit.
const readout = document.createElement('p')
readout.style.fontFamily = 'var(--md-sys-typeface-mono)'
readout.style.margin = '0'
function refreshReadout(): void {
  const value = (multiSelect as unknown as { value: string[] }).value
  const submitted = new FormData(form as HTMLFormElement).getAll('skills')
  readout.textContent = `this.value = ${JSON.stringify(value)}   ·   FormData.getAll('skills') = ${JSON.stringify(submitted)}`
}

multiSelect.addEventListener('select', (event) => {
  const keys = [...(event as CustomEvent<ReadonlySet<string>>).detail]
  logEvent(`select  value=${JSON.stringify(keys)}`)
  refreshReadout()
})

const submit = uiButton('Submit', 'solid')
submit.addEventListener('click', (event) => {
  event.preventDefault() // demo only — report the round-trip instead of navigating
  refreshReadout()
  const valid = (multiSelect as unknown as { checkValidity(): boolean }).checkValidity()
  logEvent(valid ? 'submit  (valid)' : 'submit  BLOCKED — valueMissing (required, nothing selected)')
})
form.append(submit)
refreshReadout()

const note = el('p', {}, [
  text('The host carries '), code('role="listbox"'), text(' + '), code('aria-multiselectable="true"'),
  text(' via '), code('ElementInternals'), text(' — no trigger, no overlay. Click, '), strong('Space'),
  text(', or '), strong('Enter'), text(" toggles an option's membership (no modifier keys, ever). Because " +
    'the control is form-associated, every selected value participates in the enclosing '), code('<form>'),
  text(' as its own '), code('FormData'), text(' entry — with no extra wiring.'),
])

content.append(
  exampleSection('Live multi-select in a form (Submit reports the round-trip)', form),
  exampleSection('Form value', readout),
  exampleSection('Behaviour', note),
  exampleSection('select event log', log),
)
