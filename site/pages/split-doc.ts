// site/pages/split-doc.ts — the ui-split API doc page (tier=layout ⇒ {doc} only, folded into the shared
// Layout primitives showcase — the ui-toast-region precedent). DERIVED from split.md via the shared
// doc-page.ts renderer (composeDocPage threads attributes/events/parts/keyboard/geometry through for
// free — the Parts section renders because split.md declares `parts: [{ name: separator }]`). The live
// specimen is a real 3-pane resizable ui-split: drag a divider or Tab to it and use the arrow keys.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome (.demo-box); never restyles a ui-* control
import { loadSplitDoc } from '../lib/frontmatter.ts'
import { composeDocPage } from '../lib/doc-page.ts'
import { el, demoBox, exampleSection } from '../lib/specimens.ts'

const { descriptor, body } = loadSplitDoc()

const { content } = mountPage({
  title: 'ui-split — API',
  intro:
    'The M4 multi-pane (N-slot) resizable split container (ADR-0120 cl.2) — control-rendered, draggable + ' +
    'keyboard-resizable ARIA separators between each adjacent ui-split-pane pair. This page is generated ' +
    'from split.md — the attribute/event/parts/keyboard tables are derived from the same frontmatter the ' +
    'contract trip-wire validates. Try it: drag a divider, or Tab to one and press the Arrow keys.',
})

// A real 3-pane horizontal split, one pane pre-floored via `min`. Sized by an ancestor block so the flex
// distribution has real space to divide (a ui-split has no intrinsic width of its own).
const wrapper = el('div', { style: 'block-size: 12rem; inline-size: 100%;' }, [
  el('ui-split', {}, [
    el('ui-split-pane', { min: '8rem' }, [demoBox('pane 1 (min 8rem)')]),
    el('ui-split-pane', {}, [demoBox('pane 2')]),
    el('ui-split-pane', {}, [demoBox('pane 3')]),
  ]),
])

composeDocPage(content, descriptor, body, exampleSection('Example', wrapper))
