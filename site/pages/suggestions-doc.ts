// site/pages/suggestions-doc.ts — the ui-suggestions API doc page (tier=pattern ⇒ {doc, demo}, ADR-0213 /
// GH #1393). DERIVED from `suggestions.md` via the shared doc-page.ts renderer: the attribute table
// (suggestions, selected), the events[] table (select), and the parts[] table (chip) are read straight
// from the parse — so none can drift from the descriptor the contract trip-wire enforces (ADR-0004). Two
// static specimens show the one-shot law's two states: LIVE (no chip taken yet) and SPENT (one taken,
// every chip inert) — the rich click-to-commit interaction + event log live on the Demo page.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadSuggestionsDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading } from '../lib/doc-page.ts'
import { el } from '../lib/specimens.ts'

const { descriptor, body } = loadSuggestionsDoc()

const { content } = mountPage({
  title: 'ui-suggestions — API',
  intro:
    'The one-shot follow-up/next-prompt chip set (ADR-0213) — `suggestions` (a bindable array of ' +
    '{label, value?}) renders as tappable chips; a tap commits its value into `selected` and the WHOLE ' +
    'set then renders spent, the taken chip visibly marked. Not form-associated: no name/value pair, no ' +
    'validity/reset semantics. Generated from suggestions.md: the attribute/events/parts tables are ' +
    'descriptor-derived. See the ui-suggestions demo for the live click-to-commit interaction with an ' +
    'event log.',
})

composeDocPage(content, descriptor, body, renderSpecimens())

function renderSpecimens(): HTMLElement {
  const SET = [
    { label: 'Book the Deluxe King' },
    { label: 'See more photos', value: 'more-photos' },
    { label: 'Compare rooms', value: 'compare' },
  ]

  const section = document.createElement('section')
  section.append(heading(2, 'Examples'), heading(3, 'Live — no chip taken yet'))

  const liveDesc = document.createElement('p')
  liveDesc.textContent = 'Every chip is a real, enabled, tabbable button. Tapping one commits its value.'
  const live = el('ui-suggestions', { suggestions: JSON.stringify(SET) })

  const spentHeading = heading(3, 'Spent — one chip taken')
  const spentDesc = document.createElement('p')
  spentDesc.textContent =
    'Once `selected` is non-empty the WHOLE set renders spent: every chip carries a real `disabled`, and ' +
    'the taken chip stays visible and marked (`[data-taken]`, aria-pressed="true").'
  const spent = el('ui-suggestions', { suggestions: JSON.stringify(SET), selected: 'more-photos' })

  section.append(liveDesc, box(live), spentHeading, spentDesc, box(spent))
  return section
}

function box(el: HTMLElement): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'max-width: 26rem; margin: 0.5rem 0 1.75rem;'
  wrap.append(el)
  return wrap
}
