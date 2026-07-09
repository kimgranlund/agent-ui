// site/pages/toast-region-doc.ts — the ui-toast-region API doc page (tier=layout ⇒ {doc} only, ADR-0112 /
// feed-family.lld.md LLD-C12). DERIVED from `toast-region.md` via the shared doc-page.ts renderer: the
// properties[] table (show()) and the slots[] table (the default slot) are read straight from the parse — so
// neither can drift from the descriptor the contract trip-wire enforces (ADR-0004). `attributes: []` is the
// deliberate empty sequence (a pure coordination host — no Attributes table renders, composeDocPage's
// no-empty-table discipline). The specimen shows BOTH composition paths the descriptor documents: declarative
// markup and the sanctioned imperative show() entry point.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadToastRegionDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection, uiButton } from '../lib/specimens.ts'
import type { UIToastRegionElement } from '@agent-ui/components/components'

const { descriptor, body } = loadToastRegionDoc()

const { content } = mountPage({
  title: 'ui-toast-region — API',
  intro:
    'The top-layer host ui-toast instances stack inside (ADR-0112, feed family v1) — a manual Popover-API ' +
    'element, mounted per-instance (no static singleton). Not form-associated. Generated from ' +
    'toast-region.md: the show() method and slots tables are descriptor-derived. Deliberately NOT catalogued ' +
    "(ADR-0112 cl.6) — see ui-toast's API page for the app-surface consumption story. See the ui-toast demo " +
    'for the live pause-on-hover / actionable-toast interaction.',
})

const region = document.createElement('ui-toast-region') as UIToastRegionElement
const trigger = uiButton('region.show("File uploaded.")', 'soft')
trigger.addEventListener('click', () => region.show('File uploaded.'))

const note = el('p', {}, [
  document.createTextNode('The region composes either declaratively (author-authored '),
  el('code', {}, [document.createTextNode('<ui-toast>')]),
  document.createTextNode(' markup) or imperatively via '),
  el('code', {}, [document.createTextNode('show()')]),
  document.createTextNode(' — the sanctioned entry point, which sets the message text before appending (announcement-correct).'),
])

composeDocPage(content, descriptor, body, exampleSection('Example', note, trigger, region))
