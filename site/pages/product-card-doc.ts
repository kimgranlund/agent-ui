// site/pages/product-card-doc.ts: the ui-product-card API doc page (tier=pattern, so {doc, demo}; ADR-0243).
// DERIVED from `product-card.md` via the shared doc-page.ts renderer: the attribute, events, slots and parts
// tables are read straight from the parse, so none can drift from the descriptor the contract trip-wire
// enforces (ADR-0004). Two live specimens (an offer and an exhibit tile) show the presence law; the three
// mockup specimens and the action event log live on the ui-product-card demo page.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import type { UIProductCardElement } from '@agent-ui/components/controls/product-card'
import { loadProductCardDoc } from '../lib/frontmatter.ts'
import { composeDocPage, specimenRow } from '../lib/doc-page.ts'
import { applyDemoWidth, el, exampleSection } from '../lib/specimens.ts'

const { descriptor, body } = loadProductCardDoc()

const { content } = mountPage({
  title: 'ui-product-card: API',
  intro:
    'One product, room or offer to buy or book (ADR-0243): an optional image or icon header, rating, badge, ' +
    'price and a single action. An empty value renders no box, so a card with no price and no action is an ' +
    'exhibit tile with no price row. Generated from product-card.md: the attribute/events/slots/parts tables ' +
    'are descriptor-derived. See the ui-product-card demo for the three mockup specimens and an `action` event log.',
})

const offer = el('ui-product-card', {
  title: 'Harbour View Suite, king bed',
  subtitle: 'Sleeps 2, 42 m², free cancellation',
  rating: '4.8',
  badge: 'Best rate',
  'badge-intent': 'info',
  price: '$312',
  'price-note': '/ night',
  'action-label': 'Book',
}, []) as UIProductCardElement
offer.action = { action: 'book' }

const exhibit = el('ui-product-card', {
  title: 'Brass astrolabe, 1640',
  subtitle: 'Gallery 3, navigation instruments',
  icon: 'palette',
}, [])

// Block-level fill by default (ADR-0223), no intrinsic width: applyDemoWidth gives each specimen a display
// width so the two cards read side by side.
applyDemoWidth(offer, '18rem')
applyDemoWidth(exhibit, '18rem')

composeDocPage(content, descriptor, body, exampleSection('Example', specimenRow([offer, exhibit])))
