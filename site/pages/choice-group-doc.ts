// site/pages/choice-group-doc.ts — the ui-choice-group API doc page (ADR-0220). DERIVED from
// `choice-group.md`: the API table is built from the canonical parser's `attributes[]`, so it cannot
// drift from the descriptor the contract trip-wire enforces (ADR-0004, one parser / two consumers).
// The generic table + body renderers are the SHARED lib/doc-page.ts. ui-choice-group is the FACE
// container that composes rovingFocus + selectionCommit directly over its ui-choice-card children
// (ADR-0220 cl.1); a worked group specimen accompanies the table. See the ui-choice-card page for the
// option unit itself.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadChoiceGroupDoc } from '../lib/frontmatter.ts'
import { heading, renderApiTable, renderMarkdownBody, specimenRow } from '../lib/doc-page.ts'
import { el } from '../lib/specimens.ts'

const { descriptor, body } = loadChoiceGroupDoc()

const { content } = mountPage({
  title: 'ui-choice-group — API',
  intro: 'A committed choice over agent-composed ui-choice-card option cards, single or multi. Composes ' +
    'rovingFocus + selectionCommit directly on a FACE form-associated host (ADR-0220 cl.1) — the whole card is ' +
    'the hit target and the a11y unit. This page is generated from choice-group.md, so the API table cannot drift.',
})

content.append(renderApiTable(descriptor.attributes), renderExample(), renderMarkdownBody(body))

// ── a worked group specimen (markup SHAPE: a ui-choice-group owning three ui-choice-card members) ────────────

function renderExample(): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Example — a single-select card gallery'))

  const group = el('ui-choice-group', { name: 'room', value: 'deluxe' }, [
    card('standard', 'Standard', '$120 / night'),
    card('deluxe', 'Deluxe', '$185 / night'),
    card('suite', 'Suite', '$310 / night'),
  ])

  section.append(specimenRow([group]))
  return section
}

function card(value: string, title: string, price: string): HTMLElement {
  return el('ui-choice-card', { value }, [
    el('strong', {}, [document.createTextNode(title)]),
    document.createElement('br'),
    document.createTextNode(price),
  ])
}
