// site/pages/column-doc.ts — the ui-column API doc page (T4). DERIVED from `column.md` via the shared
// doc-page.ts renderer; one representative LIVE specimen shows the vertical stack. The surface × layout matrix
// lives on the shared Layout primitives showcase.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome (.demo-box); never restyles a ui-* control
import { loadColumnDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { demoBox, el, exampleSection } from '../lib/specimens.ts'

const { descriptor, body } = loadColumnDoc()

const { content } = mountPage({
  title: 'ui-column — API',
  intro: 'The vertical layout primitive — ui-row with the main axis flipped. Generated from column.md (the ' +
    'attribute table is descriptor-derived, so it cannot drift). The full matrix is on the Layout primitives showcase.',
})

const example = exampleSection(
  'Example',
  el('ui-column', { gap: 'sm' }, [demoBox('Item one'), demoBox('Item two'), demoBox('Item three')]),
)

composeDocPage(content, descriptor, body, example)
