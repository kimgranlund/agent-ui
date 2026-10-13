// site/pages/result-card-doc.ts: the ui-result-card API doc page (tier=pattern => {doc, demo}, ADR-0244).
// Derived from `result-card.md` through the shared doc-page.ts renderer: the attribute and parts tables come
// from the parsed descriptor and the prose from its body, so neither can drift from the contract the
// trip-wire enforces (ADR-0004). The specimen data are hand-authored; a doc page has no source to derive them from.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadResultCardDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading } from '../lib/doc-page.ts'

const { descriptor, body } = loadResultCardDoc()

const { content } = mountPage({
  title: 'ui-result-card: API',
  intro:
    'The settled outcome card (ADR-0244): an outcome pill (word plus glyph), a title, a summary, up to four ' +
    'stat tiles and the producer\'s own action buttons at the lg step. No events of its own. Generated from ' +
    'result-card.md: the attribute and parts tables are descriptor-derived; the specimens below are live.',
})

composeDocPage(content, descriptor, body, renderSpecimens())

function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'), heading(3, 'A full win card and an outcome-plus-summary card'))
  const desc = document.createElement('p')
  desc.textContent =
    'The first card carries every part: the outcome pill, title, summary, three stats and two action ' +
    'buttons. The second has no stats and no children, so it renders the header and summary only.'
  const column = document.createElement('div')
  column.style.cssText = 'display:grid; gap:1rem; max-inline-size:30rem; margin:0.5rem 0 1.75rem;'

  const full = document.createElement('ui-result-card')
  Object.assign(full, {
    outcome: 'win',
    title: 'Blackjack, hand 12',
    summary: 'You beat the dealer 20 to 18. Your stack is up for the night.',
    stats: [
      { label: 'Chips', value: 1290, delta: 50, intent: 'success' },
      { label: 'Hands', value: 12 },
      { label: 'Win rate', value: '58%' },
    ],
  })
  const again = document.createElement('ui-button')
  again.textContent = 'Play again'
  const bet = document.createElement('ui-button')
  bet.setAttribute('variant', 'soft')
  bet.textContent = 'Change bet'
  full.append(again, bet)

  const minimal = document.createElement('ui-result-card')
  Object.assign(minimal, { outcome: 'done', title: 'Quiz complete', summary: 'You answered 8 of 10 correctly.' })

  column.append(full, minimal)
  section.append(desc, column)
  return section
}
