// site/pages/split-pane-doc.ts — the ui-split-pane API doc page (tier=layout ⇒ {doc} only, folded into the
// shared Layout primitives showcase). DERIVED from split-pane.md via the shared doc-page.ts renderer. A
// structural, non-form, non-interactive pane — the specimen shows it inside its real parent (ui-split),
// since a bare pane outside a split has nothing to demonstrate (its geometry is entirely parent-driven).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome (.demo-box); never restyles a ui-* control
import { loadSplitPaneDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, demoBox, exampleSection } from '../lib/specimens.ts'

const { descriptor, body } = loadSplitPaneDoc()

const { content } = mountPage({
  title: 'ui-split-pane — API',
  intro:
    'The generic pane child of ui-split (ADR-0120 cl.2) — a structural, non-interactive content region ' +
    '(the ui-card-header/-content/-footer regions precedent). This page is generated from split-pane.md. ' +
    'See the ui-split API page for the interactive split container this pane is always used inside.',
})

const wrapper = el('div', { style: 'block-size: 10rem; inline-size: 100%;' }, [
  el('ui-split', {}, [
    el('ui-split-pane', { min: '6rem', collapsible: '' }, [demoBox('a collapsible pane')]),
    el('ui-split-pane', {}, [demoBox('a plain pane')]),
  ]),
])

composeDocPage(content, descriptor, body, exampleSection('Example', wrapper))
