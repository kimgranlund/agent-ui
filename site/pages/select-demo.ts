// site/pages/select-demo.ts — the ui-select interaction demo (the ratified pattern `demo`). Mounts the REAL
// single-select form control inside a <form> and proves the form round-trip honestly: choosing an option updates
// this.value AND the FormData entry keyed by `name`; a live readout reflects both. One option is disabled (skipped
// by roving + commit) and the field is `required` (empty → valueMissing). The select + toggle log shows the commit
// and the platform light-dismiss. The control owns all overlay / listbox / form participation (select.ts); this
// page only stages the form and reads it back.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-select — demo',
  intro: 'The single-select form control, live inside a <form>. Choose an option — the value round-trips into the ' +
    'form (FormData keyed by name), shown in the readout. One option is disabled; the field is required (empty → ' +
    'valueMissing). The select / toggle log tracks the commit + light-dismiss. The API table is on the ui-select API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── the select / toggle event log ────────────────────────────────────────────────────────────────────────────
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

// ── the live select inside a real <form> — the [role=option] children (grouped via [role=group]) move into the
// listbox at first connect. GROUPS (optgroup parity): each <div role="group" label="…"> renders a non-interactive
// header; roving + commit traverse groups (they operate on [role=option], never a header). One option is
// aria-disabled (skipped by roving + commit). `required` drives valueMissing when nothing selected.
const select = el('ui-select', { name: 'tier', placeholder: 'Choose a plan…', required: '' }, [
  el('div', { role: 'group', label: 'Personal' }, [
    el('div', { role: 'option', value: 'free' }, [text('Free')]),
    el('div', { role: 'option', value: 'pro' }, [text('Pro')]),
  ]),
  el('div', { role: 'group', label: 'Business' }, [
    el('div', { role: 'option', value: 'team' }, [text('Team')]),
    el('div', { role: 'option', value: 'enterprise', 'aria-disabled': 'true' }, [text('Enterprise (contact sales)')]),
  ]),
])

const form = el('form', {}, [select])
form.style.display = 'flex'
form.style.flexDirection = 'column'
form.style.gap = '0.75rem'
form.style.alignItems = 'flex-start'

// A live readout of the form value — reads this.value and the FormData entry keyed by `name`, proving the
// round-trip. Updated on every select commit (the value two-way source) and on submit.
const readout = document.createElement('p')
readout.style.fontFamily = 'var(--ui-mono)'
readout.style.margin = '0'
function refreshReadout(): void {
  const value = (select as unknown as { value: string }).value
  const submitted = new FormData(form as HTMLFormElement).get('tier')
  readout.textContent = `this.value = ${JSON.stringify(value)}   ·   FormData.get('tier') = ${JSON.stringify(submitted)}`
}

select.addEventListener('select', (event) => {
  const key = (event as CustomEvent<string>).detail
  logEvent(`select  value=${JSON.stringify(key)}`)
  refreshReadout()
})
select.addEventListener('toggle', () => {
  logEvent('toggle  (light-dismiss)')
})

const submit = uiButton('Submit', 'solid')
submit.addEventListener('click', (event) => {
  event.preventDefault() // demo only — report the round-trip instead of navigating
  refreshReadout()
  const valid = (select as unknown as { checkValidity(): boolean }).checkValidity()
  logEvent(valid ? 'submit  (valid)' : 'submit  BLOCKED — valueMissing (required, nothing selected)')
})
form.append(submit)
refreshReadout()

const note = el('p', {}, [
  text('The trigger carries '), code('aria-haspopup="listbox"'), text(' + '), code('aria-expanded'),
  text('; the panel is '), code('role="listbox"'), text('. Arrow keys rove the options, '), strong('Enter'),
  text(' commits, '), strong('Escape'), text(' light-dismisses. Because the control is form-associated, its ' +
    'value participates in the enclosing '), code('<form>'), text(' with no extra wiring.'),
])

content.append(
  exampleSection('Live select in a form (Submit reports the round-trip)', form),
  exampleSection('Form value', readout),
  exampleSection('Behaviour', note),
  exampleSection('select / toggle event log', log),
)
