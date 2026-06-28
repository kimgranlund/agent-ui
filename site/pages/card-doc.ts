// site/pages/card-doc.ts — the ui-card API doc page (T4). DERIVED from `card.md` via the shared doc-page.ts
// renderer (the attribute table is the surfaceProps spread — elevation/brightness). The region sub-elements
// (ui-card-header / -content / -footer) are documented in the descriptor prose body; one representative LIVE
// specimen composes them. The rich composition (regions × nested radius × elevation range × scroll) is the Card demo.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadCardDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { applyDemoWidth, el, exampleSection, uiButton } from '../lib/specimens.ts'

const { descriptor, body } = loadCardDoc()

const { content } = mountPage({
  title: 'ui-card — API',
  intro: 'The surface container of the layout family — a presence-driven grid of three region sub-elements. ' +
    'Generated from card.md (the elevation/brightness attribute table is descriptor-derived). See the Card demo ' +
    'for the regions, nested radius, and surface range.',
})

const text = (s: string): Text => document.createTextNode(s)

// A representative composed card: header (title) · content (body) · footer (an action). The regions are real
// ui-card-* sub-elements; applyDemoWidth gives it a display width so the grid reads.
const card = el('ui-card', {}, [
  el('ui-card-header', {}, [text('Account')]),
  el('ui-card-content', {}, [text('A card composes three region sub-elements as a presence-driven grid.')]),
  el('ui-card-footer', {}, [uiButton('Save', 'solid')]),
])
applyDemoWidth(card, '22rem')

composeDocPage(content, descriptor, body, exampleSection('Example', card))
