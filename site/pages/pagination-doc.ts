// site/pages/pagination-doc.ts — the ui-pagination API doc page (ADR-0163 cl.6, SPEC-R3). DERIVED from
// pagination.md via the shared doc-page.ts renderer (the attribute table is page/pages/label). One
// representative LIVE specimen mounts the real element, populated (not a lorem stub — the representative-
// specimen law); the interaction walkthrough is the Pagination demo.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { loadPaginationDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, exampleSection } from '../lib/specimens.ts'

const { descriptor, body } = loadPaginationDoc()

const { content } = mountPage({
  title: 'ui-pagination — API',
  intro: 'A Pattern-class standalone page navigator — previous/next plus a fixed-window page-number list ' +
    'with ellipsis, composing ui-button for every stop. Generated from pagination.md (descriptor-derived ' +
    'tables). See the Pagination demo for the interaction + composing with ui-table.',
})

// A representative live ui-pagination — mid-range so both ellipsis markers and the active-page state paint.
const pagination = el('ui-pagination', { label: 'Search results', page: '5', pages: '12' })

composeDocPage(content, descriptor, body, exampleSection('Example', pagination))
