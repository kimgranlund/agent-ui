// site/pages/option-compare-doc.ts: the ui-option-compare API doc page (tier=pattern => {doc, demo}, T-0393).
// Derived from `option-compare.md` through the shared doc-page.ts renderer: the attribute and parts tables come
// from the parsed descriptor and the prose from its body, so neither can drift from the contract the
// trip-wire enforces (ADR-0004). The specimen data are hand-authored; a doc page has no source to derive them from.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadOptionCompareDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading } from '../lib/doc-page.ts'

const { descriptor, body } = loadOptionCompareDoc()

const { content } = mountPage({
  title: 'ui-option-compare: API',
  intro:
    'The option compare (T-0393): two to four options side by side as columns over aligned attribute rows, with a ' +
    'best mark, where the whole column is the pick. A pick fires select with the value and, with actionName set, ' +
    'one action. Generated from option-compare.md: the attribute and parts tables are descriptor-derived; the ' +
    'specimen below is live.',
})

composeDocPage(content, descriptor, body, renderSpecimens())

function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'), heading(3, 'Lisbon to Porto, the train marked best, the bus picked'))
  const desc = document.createElement('p')
  desc.textContent =
    'Three option columns beside the pinned label column. The best column carries the Best pill and a ring; ' +
    'the picked column carries the Your pick pill, a fill and a ring. Every column stays pressable.'
  const surface = document.createElement('div')
  surface.dataset.tier = 'widget'
  surface.dataset.scale = 'md'
  surface.style.cssText = 'max-inline-size:32rem; margin:0.5rem 0 1.75rem;'

  const compare = document.createElement('ui-option-compare')
  Object.assign(compare, {
    heading: 'Lisbon to Porto',
    best: 'train',
    value: 'bus',
    rows: [
      { key: 'duration', label: 'Duration' },
      { key: 'price', label: 'Price' },
      { key: 'departs', label: 'Departs' },
      { key: 'changes', label: 'Changes' },
    ],
    options: [
      { value: 'train', title: 'Train', subtitle: 'Alfa Pendular', values: { duration: '2h 50m', price: 'EUR 32', departs: '09:09', changes: 'None' } },
      { value: 'bus', title: 'Bus', subtitle: 'Rede Expressos', values: { duration: '3h 30m', price: 'EUR 19', departs: '08:30', changes: 'None' } },
      { value: 'flight', title: 'Flight', subtitle: 'TP 1940', values: { duration: '55m', price: 'EUR 89', departs: '11:15', changes: 'None' } },
    ],
  })
  surface.append(compare)
  section.append(desc, surface)
  return section
}
