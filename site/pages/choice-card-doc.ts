// site/pages/choice-card-doc.ts — the ui-choice-card API doc page (ADR-0220). DERIVED from
// `choice-card.md`: the API table is built row-by-row from the canonical parser's `attributes[]` — so
// it cannot drift from the descriptor the contract trip-wire enforces (ADR-0004, one parser / two
// consumers). A single card is shown here; its selection/roving is a GROUP behaviour — see the
// ui-choice-group page for the container that owns commit + keyboard roving.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadChoiceCardDoc } from '../lib/frontmatter.ts'
import { heading, renderApiTable, renderMarkdownBody, specimenRow } from '../lib/doc-page.ts'
import { el } from '../lib/specimens.ts'

const { descriptor, body } = loadChoiceCardDoc()

const { content } = mountPage({
  title: 'ui-choice-card — API',
  intro: 'The rich option unit of the choice family (ADR-0220) — the WHOLE card is the hit target and the ' +
    'a11y unit; role=option/aria-selected ride ElementInternals, never a host attribute. A card carries no ' +
    'selection commit of its own (the owning ui-choice-group commits). This page is generated from ' +
    'choice-card.md, so the API table cannot drift.',
})

content.append(renderApiTable(descriptor.attributes), renderExamples(), renderMarkdownBody(body))

// ── live specimens (standalone cards — no owning group, so no interactive commit; the states below are
// staged directly via attributes/setSelected to show the visual paint without needing a group) ─────────

function renderExamples(): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'States'))

  const idle = card('standard', 'Standard', false, false)
  const selected = card('deluxe', 'Deluxe', true, false)
  const disabled = card('suite', 'Suite', false, true)

  section.append(specimenRow([idle, selected, disabled]))
  return section
}

// card — a live specimen: a real <ui-choice-card>, with `selected` staged imperatively via setSelected()
// (the same seam the owning ui-choice-group drives — the file header's "no commit of its own" fact).
function card(value: string, title: string, selected: boolean, disabled: boolean): HTMLElement {
  const attrs: Record<string, string> = { value }
  if (disabled) attrs['disabled'] = ''
  const c = el('ui-choice-card', attrs, [document.createTextNode(title)])
  if (selected) {
    // setSelected() is public on UIChoiceCardElement (the ui-choice-group reflectSelected seam) — a
    // standalone specimen calls it directly to demonstrate the selected paint without a group.
    ;(c as unknown as { setSelected(v: boolean): void }).setSelected(true)
  }
  return c
}
