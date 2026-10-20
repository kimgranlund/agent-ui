// site/pages/amount-picker-doc.ts: the ui-amount-picker API doc page (tier=pattern => {doc, demo}, T-0196).
// Derived from `amount-picker.md` through the shared doc-page.ts renderer: the attribute and parts tables come
// from the parsed descriptor and the prose from its body, so neither can drift from the contract the
// trip-wire enforces (ADR-0004). The specimen data are hand-authored; a doc page has no source to derive them from.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadAmountPickerDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading } from '../lib/doc-page.ts'

const { descriptor, body } = loadAmountPickerDoc()

const { content } = mountPage({
  title: 'ui-amount-picker: API',
  intro:
    'The bounded number picker (T-0196): minus and plus around a formatted spinbutton readout, optional ' +
    'preset chips and slider, and one commit action that carries the value. Generated from amount-picker.md: ' +
    'the attribute and parts tables are descriptor-derived; the specimens below are live.',
})

composeDocPage(content, descriptor, body, renderSpecimens())

function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'), heading(3, 'A quantity with chips and a currency amount with the slider'))
  const desc = document.createElement('p')
  desc.textContent =
    'The first picker carries chips and a commit; the second formats a USD amount, adds the slider and ' +
    'commits with its own button. Both sit on an A2UI canvas register (widget, scale md).'
  const column = document.createElement('div')
  column.setAttribute('data-tier', 'widget')
  column.setAttribute('data-scale', 'md')
  column.style.cssText = 'display:grid; gap:var(--md-sys-widget-gutter); max-inline-size:24rem; margin:0.5rem 0 1.75rem;'

  const quantity = document.createElement('ui-amount-picker')
  Object.assign(quantity, { label: 'Quantity', min: 1, max: 20, value: 4, presets: [1, 2, 4, 8], actionName: 'add_to_cart', actionLabel: 'Add to cart' })

  const offer = document.createElement('ui-amount-picker')
  Object.assign(offer, { label: 'Your offer', min: 200, max: 600, step: 10, value: 420, currency: 'USD', slider: true, actionName: 'send_offer', actionLabel: 'Send offer' })

  column.append(quantity, offer)
  section.append(desc, column)
  return section
}
