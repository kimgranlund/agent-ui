// site/pages/combo-box-demo.ts — the ui-combo-box interaction demo (the ratified pattern `demo`). Mounts the REAL
// form-associated combo-box and proves it honestly: typing filters the top-layer listbox, Arrow keys move the
// active-descendant WITHOUT moving DOM focus (focus stays in the editor — the key distinction from ui-select),
// and Enter/click commits. A change/select log shows both commit paths; a second field sets `strict` so only an
// option-match commits. The control owns the filter / active-descendant / form value (combo-box.ts); this page
// only stages the options and logs the commits.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-combo-box — demo',
  intro: 'The form-associated combo-box, live. Type to filter the options; ArrowUp/Down move a highlighted option ' +
    'WITHOUT moving focus (it stays in the editor — the active-descendant pattern), Enter or click commits. The ' +
    'first field allows free text (strict off); the second is strict (only an option-match commits). The API table ' +
    'is on the ui-combo-box API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

const FRUITS: readonly string[] = ['Apple', 'Apricot', 'Banana', 'Blueberry', 'Cherry', 'Grape', 'Mango', 'Orange']

// ── the change / select event log ────────────────────────────────────────────────────────────────────────────
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

// makeCombo — a real ui-combo-box whose [role=option] children (a value key + a label) move into the listbox at
// connect. `change` fires on any commit (option OR free text); `select` fires only on an option-commit, carrying
// the option key. The readout of this.value proves free text commits under strict=false but not under strict=true.
function makeCombo(label: string, attrs: Record<string, string>): HTMLElement {
  const options = FRUITS.map((f) => el('div', { role: 'option', value: f.toLowerCase() }, [text(f)]))
  const combo = el('ui-combo-box', attrs, options)
  combo.addEventListener('change', () => {
    const value = (combo as unknown as { value: string }).value
    logEvent(`${label}  change  value=${JSON.stringify(value)}`)
  })
  combo.addEventListener('select', (event) => {
    logEvent(`${label}  select  key=${JSON.stringify((event as CustomEvent<string>).detail)}`)
  })
  return combo
}

const freeCombo = makeCombo('free', { placeholder: 'Type or pick a fruit…' })
const strictCombo = makeCombo('strict', { strict: '', placeholder: 'Pick a fruit (strict)…' })

const grid = document.createElement('div')
grid.className = 'demo-grid'
grid.append(
  el('div', {}, [el('p', {}, [strong('strict off — free text allowed')]), freeCombo]),
  el('div', {}, [el('p', {}, [strong('strict on — must match an option')]), strictCombo]),
)

const note = el('p', {}, [
  text('The editor is '), code('role="combobox"'), text(' with '), code('aria-autocomplete="list"'),
  text('. Arrow keys set '), code('aria-activedescendant'), text(' on the editor to the highlighted option and '),
  code('[data-active]'), text(' paints it — '), strong('DOM focus never leaves the editor'),
  text('. In the free field, Enter with no highlight commits the typed text; in the strict field, only an ' +
    'option-commit is valid (a non-matching value raises '), code('typeMismatch'), text(').'),
])

content.append(
  exampleSection('Live combo-boxes (free vs strict)', grid),
  exampleSection('Active-descendant & strict mode', note),
  exampleSection('change / select event log', log),
)
