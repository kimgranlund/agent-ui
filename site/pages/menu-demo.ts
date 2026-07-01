// site/pages/menu-demo.ts — the ui-menu interaction demo (the ratified pattern `demo`). Mounts the REAL menu
// (overlay controller + rovingFocus) and proves it honestly: a button trigger opens a top-layer panel of
// [role=menuitem] rows (one disabled, to show it is skipped); Arrow keys rove, type-ahead jumps by label prefix,
// and Enter/click commits → a live `select` event log carrying { value, index }. The control owns all ARIA /
// roving / type-ahead / commit (menu.ts); this page only stages the items and logs the commit.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-menu — demo',
  intro: 'The overlay menu, live. Open it and use the mouse or keyboard: ArrowUp/Down rove between enabled items ' +
    '(the disabled row is skipped), type a letter to jump by label prefix, and Enter or click commits. The select ' +
    'event log carries { value, index }. The API table is on the ui-menu API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── the select event log — the one commit event (fired on Enter/Space or click of an enabled item) ───────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0

// ── the live menu — first child = trigger (positional child-move); the rest become menuitems ─────────────────
// The disabled item carries `disabled` — roving focus + type-ahead + commit all skip it. Each item's data-value
// is the emitted `value`; without it, the item's textContent is used.
const menu = el('ui-menu', {}, [
  uiButton('Actions', 'solid'),
  el('div', { 'data-value': 'new' }, [text('New file')]),
  el('div', { 'data-value': 'open' }, [text('Open file')]),
  el('div', { 'data-value': 'duplicate' }, [text('Duplicate')]),
  el('div', { 'data-value': 'save', disabled: '' }, [text('Save (disabled)')]),
  el('div', { 'data-value': 'delete' }, [text('Delete')]),
])
menu.addEventListener('select', (event) => {
  const detail = (event as CustomEvent<{ value: string; index: number }>).detail
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  select  value=${JSON.stringify(detail.value)}  index=${detail.index}`
  log.append(line)
  log.scrollTop = log.scrollHeight
})

const keyboard = el('p', {}, [
  text('The panel wires a '), strong('roving tabindex'), text(' over the '), code('[role=menuitem]'),
  text(' rows: '), strong('ArrowDown / ArrowUp'), text(' move focus (wrapping, skipping disabled), '),
  strong('Home / End'), text(' jump to the first / last enabled item, and a '), strong('printable character'),
  text(' does type-ahead (200 ms burst). '), strong('Enter / Space'), text(' or a click commits — emitting '),
  code('select'), text(' and closing the menu; '), strong('Escape'),
  text(' closes without a commit and restores focus to the trigger.'),
])

content.append(
  exampleSection('Live menu (one disabled item is skipped)', menu),
  exampleSection('Keyboard, roving & type-ahead', keyboard),
  exampleSection('select event log', log),
)
