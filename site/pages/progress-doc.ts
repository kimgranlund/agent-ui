// site/pages/progress-doc.ts — the ui-progress API doc page (tier=display ⇒ {doc} only, ADR-0112 /
// feed-family.lld.md LLD-C12). DERIVED from `progress.md` via the shared doc-page.ts renderer: the attribute
// table (value, max, label) and the parts[] table (track, fill) are read straight from the parse — so neither
// can drift from the descriptor the contract trip-wire enforces (ADR-0004). The specimens are hand-authored
// (a doc page has no source to derive representative data from): a determinate bar, the indeterminate sweep,
// and a degenerate strip (negative + over-max clamping) as a live visual fixture (the bar-chart precedent).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadProgressDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading } from '../lib/doc-page.ts'

const { descriptor, body } = loadProgressDoc()

const { content } = mountPage({
  title: 'ui-progress — API',
  intro:
    'The Display-class thin-rail progress bar (ADR-0112, feed family v1) — bar-only task progress with a ' +
    'native-<progress>-shaped value model. Not interactive, not form-associated: no events, no keyboard ' +
    'contract. Generated from progress.md: the attribute and parts tables are descriptor-derived; the ' +
    'specimens below show the determinate/indeterminate models plus SPEC-R1 clamping as live fixtures.',
})

composeDocPage(content, descriptor, body, renderSpecimens())

function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(
    heading(2, 'Examples'),
    labelled('Determinate', 'value=42, max=100 (the default) — the fill grows from the inline-start edge.', bar({ value: '42', label: 'Indexing' })),
    labelled('Indeterminate', 'No value ⇒ a visibly-animated sweep — "working", not "0%".', bar({ label: 'Working' })),
    labelled('Degenerate: clamping', 'value=150 against max=100 clamps to 100%; value=-20 clamps to 0% — every input resolves to a paintable, announced state, never a throw.', row(bar({ value: '150', label: 'Over max' }), bar({ value: '-20', label: 'Negative' }))),
  )
  return section
}

function bar(attrs: Record<string, string>): HTMLElement {
  const el = document.createElement('ui-progress')
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  el.style.cssText = 'max-inline-size:20rem;'
  return el
}

function row(...children: readonly HTMLElement[]): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'display:flex; flex-direction:column; gap:0.75rem;'
  wrap.append(...children)
  return wrap
}

function labelled(title: string, description: string, node: HTMLElement): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'margin:0.5rem 0 1.5rem;'
  const desc = document.createElement('p')
  desc.textContent = description
  wrap.append(heading(3, title), desc, node)
  return wrap
}
