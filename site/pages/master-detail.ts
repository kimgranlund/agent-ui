// site/pages/master-detail.ts — the ui-master-detail COMPOSITION GUIDE (the app-shell.ts site-page
// precedent, ported): `ui-master-detail` lives in `@agent-ui/app`, OUTSIDE the `components/src` fleet the
// site-coverage/site-toc drift gates enumerate, so it carries no `{name}-{type}.html` page set and no
// per-component TOC group — it is an UNGROUPED site-level link (added once to `_page.ts` NAV).
//
// DERIVE-FIRST: the API tables at the foot are read straight from the two shipped descriptors
// (master-detail.md / master-detail-pane.md) through the SAME canonical parser every control API doc uses —
// so a prop rename/default change flows here with no page edit. What is hand-authored is the teaching prose
// + the live examples (a real, resizable `<ui-master-detail>` the reader can narrow to see the drill-in).
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import '@agent-ui/components/component-styles.css' // ui-split/ui-split-pane's shipped CSS (composed by master-detail)
import '@agent-ui/app/master-detail-pane.css'
import '@agent-ui/app/master-detail.css'
import '@agent-ui/app/master-detail-pane' // self-defines ui-master-detail-pane
import '@agent-ui/app/master-detail' // self-defines ui-master-detail
import './master-detail.css' // page-local demo chrome only (the resizable frame) — never restyles a control's internals
import { renderApiTable, renderPropertiesTable, heading } from '../lib/doc-page.ts'
import { parseDoc } from '../lib/frontmatter.ts'
import masterDetailMd from '../../packages/agent-ui/app/src/controls/master-detail/master-detail.md?raw'
import masterDetailPaneMd from '../../packages/agent-ui/app/src/controls/master-detail/master-detail-pane.md?raw'
import type { UIMasterDetailElement } from '@agent-ui/app/master-detail'

const { content } = mountPage({
  title: 'Composing a ui-master-detail',
  intro:
    'ui-master-detail is a docked list | detail arrangement over the shipped ui-split, drilling into a single ' +
    'view below a narrow container width. 0 bespoke split/resize code — the composed ui-split carries its own ' +
    'resize/keyboard/ARIA contract unchanged.',
})

content.append(
  pageLead(
    'Dock content with two ui-master-detail-pane children (pane="list" / pane="detail"). At connect, ' +
      'ui-master-detail relocates each whole pane element into a real ui-split-pane inside a real ui-split. ' +
      'Selection is a plain reflected `selected` prop your OWN list content sets — this element owns no ' +
      'item-picking UI of its own.',
  ),
)

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}
function sectionHeading(text: string): HTMLElement {
  return heading(2, text)
}
function para(...nodes: (string | Node)[]): HTMLElement {
  const p = document.createElement('p')
  p.className = 'as-prose'
  for (const n of nodes) p.append(typeof n === 'string' ? document.createTextNode(n) : n)
  return p
}
function code(text: string): HTMLElement {
  return el('code', 'as-code', text)
}

const ITEMS = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']

/** A live, dogfooded ui-master-detail — a real list of clickable rows (the "3 lines of consumer wiring" the
 *  descriptor names: a click sets `.selected`) and a detail pane whose content the demo keeps in sync via
 *  the emitted `select` event — exactly the pattern a real consumer follows. */
function demo(): HTMLElement {
  const md = document.createElement('ui-master-detail') as UIMasterDetailElement
  md.className = 'md-demo'

  const list = document.createElement('ui-master-detail-pane')
  list.setAttribute('pane', 'list')
  const rows: HTMLElement[] = []
  for (const item of ITEMS) {
    const row = el('button', 'md-row', item)
    row.setAttribute('type', 'button')
    row.addEventListener('click', () => {
      md.selected = item // the whole wiring a consumer needs — ui-master-detail reacts to `selected`
    })
    rows.push(row)
    list.append(row)
  }

  const detail = document.createElement('ui-master-detail-pane')
  detail.setAttribute('pane', 'detail')
  const detailBody = el('div', 'md-detail-body', 'Select an item from the list.')
  detail.append(detailBody)

  // The consumer's own sync: on `select`, update the detail content AND the active-row highlight — neither
  // is ui-master-detail's job, it only tells you a selection happened.
  md.addEventListener('select', (event) => {
    const key = (event as CustomEvent<string>).detail
    detailBody.textContent = key ? `Detail for “${key}”.` : 'Select an item from the list.'
    for (const row of rows) row.classList.toggle('is-active', row.textContent === key)
  })

  md.append(list, detail)
  return md
}

content.append(sectionHeading('1 · Composition'))
content.append(
  para(
    'Two ', code('ui-master-detail-pane'), ' children dock the list and detail content — the ',
    code('ui-app-shell-region'), ' generic-region model, ported. Resize the frame below narrower than 40rem ' +
      '(the element\'s OWN container width, never the viewport) to see the drill-in.',
  ),
)
const resizeFrame = el('div', 'md-resize')
resizeFrame.append(demo())
content.append(resizeFrame, el('p', 'as-caption', '↑ Drag the resize handle (bottom-right) below 40rem to drill in.'))

content.append(sectionHeading('2 · Selection is consumer-owned'))
content.append(
  para(
    'ui-master-detail has no item-picking UI: the click handler above sets ', code('.selected'), ' directly — ' +
      'that write is what drives the narrow drill-in view AND fires ', code('select'), '/', code('change'), '. ' +
      'Going back (the affordance inside the detail pane, narrow only) never clears the selection — only the ' +
      'VIEW changes.',
  ),
)

content.append(el('pre', 'as-snippet', `<ui-master-detail>
  <ui-master-detail-pane pane="list">
    <button type="button" onclick="this.closest('ui-master-detail').selected = 'item-1'">Item 1</button>
    …
  </ui-master-detail-pane>
  <ui-master-detail-pane pane="detail">
    <!-- kept in sync with .selected by YOUR OWN 'select' listener -->
  </ui-master-detail-pane>
</ui-master-detail>`))

content.append(sectionHeading('API reference'))
content.append(
  para(
    'Read straight from the shipped descriptors (master-detail.md · master-detail-pane.md) through the same ' +
      "parser the package's contract trip-wire validates.",
  ),
)

const masterDetailDoc = parseDoc(masterDetailMd)
const paneDoc = parseDoc(masterDetailPaneMd)

content.append(el('h3', 'as-api-tag', 'ui-master-detail'))
if (masterDetailDoc.descriptor.attributes.length > 0) content.append(renderApiTable(masterDetailDoc.descriptor.attributes, 4))
{
  const props = renderPropertiesTable(masterDetailDoc.descriptor, 4)
  if (props) content.append(props)
}

content.append(el('h3', 'as-api-tag', 'ui-master-detail-pane'))
if (paneDoc.descriptor.attributes.length > 0) content.append(renderApiTable(paneDoc.descriptor.attributes, 4))
{
  const props = renderPropertiesTable(paneDoc.descriptor, 4)
  if (props) content.append(props)
}
