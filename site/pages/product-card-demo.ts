// site/pages/product-card-demo.ts: the ui-product-card demo (ADR-0243). Mounts the three approved mockup
// specimens: an offer (image, badge, rating, price, Book), a shop tile whose long title clamps at two lines,
// and an icon-header exhibit tile with no price and no action, so no price row renders at all. A live
// `action` event log shows the one event: the action button's click emits the bound `action` payload. The
// control owns every mechanic (product-card.ts); this page only stages and logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import type { UIProductCardElement } from '@agent-ui/components/controls/product-card'
import { specimenRow } from '../lib/doc-page.ts'
import { applyDemoWidth, captioned, el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-product-card: demo',
  intro:
    'Three specimens: an offer, a shop tile and an exhibit tile. Click "Book" or "Add to cart" to see the ' +
    '`action` event log. The API table is on the ui-product-card API page.',
})

// An inline SVG gradient as a data: URI, so the offer image needs no asset file and no network.
const GRADIENT_SRC =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#2f6fb0"/><stop offset="1" stop-color="#9fd3e6"/>' +
      '</linearGradient></defs><rect width="160" height="100" fill="url(#g)"/></svg>',
  )

// The shared event log: the ONE event this card emits.
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function record(source: string, detail: unknown): void {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${source}  action  ${JSON.stringify(detail)}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

/** productCard: a real <ui-product-card>, its `action` event logged. */
function productCard(attrs: Record<string, string>, action: UIProductCardElement['action']): UIProductCardElement {
  const c = el('ui-product-card', attrs, []) as UIProductCardElement
  c.action = action
  c.addEventListener('action', (event) => record(attrs['title'] ?? '', (event as CustomEvent).detail))
  applyDemoWidth(c, '18rem') // block-level fill by default (ADR-0223): a display width for the row
  return c
}

const offer = productCard({
  title: 'Harbour View Suite, king bed',
  subtitle: 'Sleeps 2, 42 m², free cancellation',
  image: GRADIENT_SRC,
  'image-alt': 'Suite with a harbour view',
  badge: 'Best rate',
  'badge-intent': 'info',
  rating: '4.8',
  price: '$312',
  'price-note': '/ night',
  'action-label': 'Book',
}, { action: 'book', context: { room: 'harbour' } })

const shop = productCard({
  title: 'Insulated stainless steel water bottle with leak-proof bamboo lid, 750 ml, brushed silver',
  price: '$89',
  'action-label': 'Add to cart',
}, { action: 'add-to-cart', context: { sku: 'bottle-750' } })

const exhibit = productCard({
  title: 'Brass astrolabe, 1640',
  subtitle: 'Gallery 3, navigation instruments',
  icon: 'palette',
}, null)

const specimens = specimenRow([
  captioned('offer: image, badge, rating, price, action', offer),
  captioned('shop: the long title clamps at two lines', shop),
  captioned('exhibit: icon header, no price, no action', exhibit),
])

content.append(
  exampleSection('Specimens', specimens),
  exampleSection('action event log', log),
)
