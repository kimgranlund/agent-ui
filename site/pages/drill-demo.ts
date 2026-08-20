// site/pages/drill-demo.ts — the ui-drill interaction demo (ADR-0195 + its Amendment, GH #1510, slices
// S1-S3). Mounts THREE real drills proving every shipped presentation live: `layout="stack"` (default,
// `chrome="backbar"`) — a 3-level Settings tree drilled via a declarative data-role="drill-trigger", Back
// (click + Escape), a bindable `path` in CONTROLLED mode, and focus moving to the incoming panel's heading;
// `chrome="crumbs"` — a Library catalog already two levels deep on load, its breadcrumb trail clickable back
// to any ancestor; and `layout="columns"` (Miller columns) — a Categories browser with every path-level
// column fully interactive side by side, inside a user-resizable `.reflow-frame` so the reader can drag it
// below ADR-0150's 52.5rem/840px compact-body line and watch the REAL `@container` query auto-degrade it
// back to stack live (ADR-0195 Amendment cl.A8). One shared change-event log records every commit across all
// three specimens. The API table is on the ui-drill API page.
import { mountPage } from './_page.ts'
import './containers.css'
import { el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-drill — demo',
  intro: 'The N-level drill-down panel container, live, in all three shipped presentations: stack (default), ' +
    'chrome="crumbs", and layout="columns" (Miller columns) with its narrow-host auto-degrade back to stack. ' +
    'Watch the shared change-event log below each specimen. The API table is on the ui-drill API page.',
})

type DrillEl = HTMLElement & { path: string[] | undefined }

const text = (s: string): Text => document.createTextNode(s)

// ── the shared change-event log ─────────────────────────────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logEvent(source: string, path: string[]): void {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${source}  change  [${path.join(' → ')}]`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

// ── layout="stack" (default), chrome="backbar" (default) — a 3-level Settings tree, CONTROLLED ────────────────
const stackDrill = el('ui-drill', { 'aria-label': 'Settings (stack, controlled demo)' }, [
  el('ui-drill-panel', { key: 'root', heading: 'Settings' }, [
    el('ul', { style: 'margin:0; padding-inline-start:1.25rem' }, [
      el('li', {}, [el('button', { 'data-role': 'drill-trigger', 'data-drill-key': 'appearance' }, [text('Appearance')])]),
      el('li', {}, [el('button', { 'data-role': 'drill-trigger', 'data-drill-key': 'notifications' }, [text('Notifications')])]),
    ]),
  ]),
  el('ui-drill-panel', { key: 'appearance', parent: 'root', heading: 'Appearance' }, [
    el('ul', { style: 'margin:0; padding-inline-start:1.25rem' }, [
      el('li', {}, [el('button', { 'data-role': 'drill-trigger', 'data-drill-key': 'font-size' }, [text('Font size')])]),
    ]),
  ]),
  el('ui-drill-panel', { key: 'notifications', parent: 'root', heading: 'Notifications' }, [
    el('p', { style: 'margin:0' }, [text('Email, push, and in-app notification-channel toggles would live here.')]),
  ]),
  el('ui-drill-panel', { key: 'font-size', parent: 'appearance', heading: 'Font size' }, [
    el('p', { style: 'margin:0' }, [text('A 3rd level — the same path-array API, zero new mechanism (ADR-0195\'s N-level-from-day-one requirement).')]),
  ]),
]) as DrillEl

stackDrill.path = ['root']
stackDrill.addEventListener('change', (event) => {
  const next = (event as CustomEvent<string[]>).detail
  stackDrill.path = next
  logEvent('stack', next)
})

const stackNote = el('p', {}, [
  text('Default presentation: the active panel slides in over its dimmed, '), el('code', {}, [text('inert')]),
  text(' ancestor (visible pixels, no interaction surface). This instance sets '), el('code', {}, [text('path')]),
  text(' explicitly (CONTROLLED, ADR-0102 — the ui-split.sizes precedent): the control only EMITS the ' +
    'proposed path on change, and this page writes it back. Focus moves to the incoming level\'s heading on ' +
    'every non-initial change.'),
])

// ── chrome="crumbs" — a Library catalog, already 2 levels deep on load, CONTROLLED ─────────────────────────────
const crumbsDrill = el('ui-drill', { 'aria-label': 'Library catalog (crumbs demo)', chrome: 'crumbs' }, [
  el('ui-drill-panel', { key: 'library', heading: 'Library' }, [
    el('ul', { style: 'margin:0; padding-inline-start:1.25rem' }, [
      el('li', {}, [el('button', { 'data-role': 'drill-trigger', 'data-drill-key': 'fiction' }, [text('Fiction')])]),
      el('li', {}, [el('button', { 'data-role': 'drill-trigger', 'data-drill-key': 'nonfiction' }, [text('Non-fiction')])]),
    ]),
  ]),
  el('ui-drill-panel', { key: 'fiction', parent: 'library', heading: 'Fiction' }, [
    el('ul', { style: 'margin:0; padding-inline-start:1.25rem' }, [
      el('li', {}, [el('button', { 'data-role': 'drill-trigger', 'data-drill-key': 'mystery' }, [text('Mystery')])]),
      el('li', {}, [el('button', { 'data-role': 'drill-trigger', 'data-drill-key': 'scifi' }, [text('Science fiction')])]),
    ]),
  ]),
  el('ui-drill-panel', { key: 'nonfiction', parent: 'library', heading: 'Non-fiction' }, [
    el('p', { style: 'margin:0' }, [text('Biography, history, and science shelves would live here.')]),
  ]),
  el('ui-drill-panel', { key: 'mystery', parent: 'fiction', heading: 'Mystery' }, [
    el('p', { style: 'margin:0' }, [text('Agatha Christie, Arthur Conan Doyle, and Dorothy L. Sayers would be shelved here.')]),
  ]),
  el('ui-drill-panel', { key: 'scifi', parent: 'fiction', heading: 'Science fiction' }, [
    el('p', { style: 'margin:0' }, [text('Ursula K. Le Guin, Isaac Asimov, and Octavia Butler would be shelved here.')]),
  ]),
]) as DrillEl
crumbsDrill.id = 'drill-crumbs-demo' // the page-level browser test's stable hook

crumbsDrill.path = ['library', 'fiction', 'mystery']
crumbsDrill.addEventListener('change', (event) => {
  const next = (event as CustomEvent<string[]>).detail
  crumbsDrill.path = next
  logEvent('crumbs', next)
})

const crumbsNote = el('p', {}, [
  text('Loads already 2 levels deep so the trail — '), el('code', {}, [text('Library')]), text(' → '),
  el('code', {}, [text('Fiction')]), text(' → the '), el('code', {}, [text('Mystery')]),
  text(' heading itself, non-interactive and last — is visible without a click. Each ancestor crumb is a ' +
    'real button; clicking one truncates the path to that level (direction back) through the SAME ' +
    'change-emitting commit the Back button uses.'),
])

// ── layout="columns" — a Categories browser, side-by-side, CONTROLLED, inside a resizable frame ───────────────
const columnsDrill = el('ui-drill', { 'aria-label': 'Product categories (columns demo)', layout: 'columns' }, [
  el('ui-drill-panel', { key: 'categories', heading: 'Categories' }, [
    el('ul', { style: 'margin:0; padding-inline-start:1.25rem' }, [
      el('li', {}, [el('button', { 'data-role': 'drill-trigger', 'data-drill-key': 'electronics' }, [text('Electronics')])]),
      el('li', {}, [el('button', { 'data-role': 'drill-trigger', 'data-drill-key': 'books' }, [text('Books')])]),
      el('li', {}, [el('button', { 'data-role': 'drill-trigger', 'data-drill-key': 'apparel' }, [text('Apparel')])]),
    ]),
  ]),
  el('ui-drill-panel', { key: 'electronics', parent: 'categories', heading: 'Electronics' }, [
    el('ul', { style: 'margin:0; padding-inline-start:1.25rem' }, [
      el('li', {}, [el('button', { 'data-role': 'drill-trigger', 'data-drill-key': 'laptops' }, [text('Laptops')])]),
      el('li', {}, [el('button', { 'data-role': 'drill-trigger', 'data-drill-key': 'phones' }, [text('Phones')])]),
      el('li', {}, [el('button', { 'data-role': 'drill-trigger', 'data-drill-key': 'cameras' }, [text('Cameras')])]),
    ]),
  ]),
  el('ui-drill-panel', { key: 'books', parent: 'categories', heading: 'Books' }, [
    el('p', { style: 'margin:0' }, [text('Fiction, non-fiction, and reference titles would be listed here.')]),
  ]),
  el('ui-drill-panel', { key: 'apparel', parent: 'categories', heading: 'Apparel' }, [
    el('p', { style: 'margin:0' }, [text('Outerwear, footwear, and accessories would be listed here.')]),
  ]),
  el('ui-drill-panel', { key: 'laptops', parent: 'electronics', heading: 'Laptops' }, [
    el('p', { style: 'margin:0' }, [text('A 3rd, rightmost column: laptop listings would render here.')]),
  ]),
  el('ui-drill-panel', { key: 'phones', parent: 'electronics', heading: 'Phones' }, [
    el('p', { style: 'margin:0' }, [text('Phone listings would render here.')]),
  ]),
  el('ui-drill-panel', { key: 'cameras', parent: 'electronics', heading: 'Cameras' }, [
    el('p', { style: 'margin:0' }, [text('Camera listings would render here.')]),
  ]),
]) as DrillEl
columnsDrill.id = 'drill-columns-demo' // the page-level browser test's stable hook

columnsDrill.path = ['categories', 'electronics']
columnsDrill.addEventListener('change', (event) => {
  const next = (event as CustomEvent<string[]>).detail
  columnsDrill.path = next
  logEvent('columns', next)
})

const columnsFrame = el('div', { class: 'reflow-frame' }, [columnsDrill])

const columnsNote = el('p', {}, [
  text('Loads 2 columns deep — '), el('code', {}, [text('Categories')]), text(' | '),
  el('code', {}, [text('Electronics')]), text(' — every column fully interactive (no dimming, no '),
  el('code', {}, [text('inert')]), text('): a trigger inside '), el('code', {}, [text('Categories')]),
  text(' truncates-then-appends rather than always appending. '),
  el('strong', {}, [text('Resize the frame below ~840px (52.5rem)')]),
  text(' — a real '), el('code', {}, [text('@container (inline-size < 52.5rem)')]),
  text(' query scoped to the drill\'s own box, ADR-0150\'s compact-body line — and watch columns silently ' +
    'degrade back to stack: the '),
  el('code', {}, [text('layout')]), text(' attribute itself never changes, only which render mapping it ' +
    'resolves to (ADR-0195 Amendment cl.A8, Kim-ruled).'),
])

content.append(
  exampleSection('layout="stack" (default) — a 3-level Settings tree', stackDrill, stackNote),
  exampleSection('chrome="crumbs" — a Library catalog, breadcrumb trail', crumbsDrill, crumbsNote),
  exampleSection('layout="columns" — Miller columns, resizable to prove the narrow auto-degrade', columnsFrame, columnsNote),
  exampleSection('change event log (all three specimens)', log),
)
