// site/pages/grid-doc.ts — the ui-grid API doc page (T4). DERIVED from `grid.md` via the shared doc-page.ts
// renderer; one representative LIVE specimen shows the auto-fit/minmax track grid (it reflows by its own width).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome (.demo-box); never restyles a ui-* control
import { loadGridDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { demoBox, el, exampleSection } from '../lib/specimens.ts'

const { descriptor, body } = loadGridDoc()

const { content } = mountPage({
  title: 'ui-grid — API',
  intro: 'A track-grid primitive — auto-fit / minmax columns that reflow by the grid\'s own width, no breakpoint ' +
    'prop. Generated from grid.md (descriptor-derived table). The full matrix is on the Layout primitives showcase.',
})

// Six boxes so the auto-fit reflow is visible when the page narrows; min="8rem" lowers the track floor.
const example = exampleSection(
  'Example',
  el('ui-grid', { gap: 'md', min: '8rem' }, [1, 2, 3, 4, 5, 6].map((n) => demoBox(`Cell ${n}`))),
)

composeDocPage(content, descriptor, body, example)
