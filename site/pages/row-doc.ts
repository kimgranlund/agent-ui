// site/pages/row-doc.ts — the ui-row API doc page (T4). DERIVED from `row.md`: the attribute table is built
// from the canonical parser's `attributes[]` (the shared doc-page.ts renderer, same as every control doc), and
// the body is the descriptor prose. One representative LIVE specimen shows the real container laying out
// content; the full surface×layout matrix lives on the shared Layout primitives showcase (layout-permutations).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome (.demo-box); never restyles a ui-* control
import { loadRowDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { demoBox, el, exampleSection, uiButton } from '../lib/specimens.ts'

const { descriptor, body } = loadRowDoc()

const { content } = mountPage({
  title: 'ui-row — API',
  intro: 'The canonical horizontal layout primitive. This page is generated from row.md — the attribute table ' +
    'is derived from the same frontmatter the contract trip-wire validates, so it cannot drift. The full ' +
    'surface × layout matrix is on the Layout primitives showcase.',
})

// One representative live ui-row: a real container arranging a button cluster (align=center, gap=md).
const example = exampleSection(
  'Example',
  el('ui-row', { gap: 'md', align: 'center' }, [
    uiButton('Save', 'solid'),
    uiButton('Cancel', 'soft'),
    demoBox('any child'),
  ]),
)

composeDocPage(content, descriptor, body, example)
