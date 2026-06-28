// site/pages/list-doc.ts — the ui-list API doc page (T4). DERIVED from `list.md` via the shared doc-page.ts
// renderer; one representative LIVE specimen shows the semantic vertical stack (role="list" via internals).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome (.demo-box); never restyles a ui-* control
import { loadListDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { demoBox, el, exampleSection } from '../lib/specimens.ts'

const { descriptor, body } = loadListDoc()

const { content } = mountPage({
  title: 'ui-list — API',
  intro: 'A semantic vertical stack — a ui-column that sets role="list" through ElementInternals. Generated ' +
    'from list.md (descriptor-derived table). The full layout matrix is on the Layout primitives showcase.',
})

const example = exampleSection(
  'Example',
  el('ui-list', { gap: 'sm' }, [demoBox('First item'), demoBox('Second item'), demoBox('Third item')]),
)

composeDocPage(content, descriptor, body, example)
