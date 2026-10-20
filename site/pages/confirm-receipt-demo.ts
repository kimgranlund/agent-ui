// site/pages/confirm-receipt-demo.ts: the ui-confirm-receipt demo (T-0195; pairs with confirm-receipt-doc.ts, the
// descriptor-derived API page). Mounts the real control over the approved Direction A mockup data: a Concierge
// booking and a Shopkeeper order, each read back for the user to confirm, plus a receipt rendered already
// confirmed. Each press is written to an event log, and a Reset button puts both records back to pending.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log/.demo-figure/.demo-grid + section spacing)
import { el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-confirm-receipt: demo',
  intro:
    'The read-back, confirm and receipt record, live: a booking and an order, each showing values read from ' +
    'the bound data, with Back and Confirm under the card. Confirm settles the record into its receipt. The ' +
    'API table is on the ui-confirm-receipt API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

const receipt = (props: Record<string, unknown>): HTMLElement & { status: string } => {
  const node = el('ui-confirm-receipt') as HTMLElement & { status: string }
  Object.assign(node, props)
  node.style.maxInlineSize = '30rem'
  return node
}

const log = el('ul', { class: 'event-log', 'aria-live': 'polite' })
const record = (event: Event): void => {
  const host = event.currentTarget as HTMLElement & { title: string }
  log.prepend(el('li', {}, [text(`${host.title}: ${event.type} ${JSON.stringify((event as CustomEvent).detail)}`)]))
}

// ── [1] Concierge: a booking read back ─────────────────────────────────────────────────────────────────
const booking = receipt({
  title: 'Your stay',
  rows: [
    { label: 'Arrival', path: 'checkIn' },
    { label: 'Departure', path: 'checkOut' },
    { label: 'Guests', path: 'guests' },
    { label: 'Room', path: 'room', options: [{ value: 'garden', label: 'Garden suite, king' }] },
    { label: 'Extras', path: 'extras' },
  ],
  total: { label: 'Total, 3 nights', path: 'total' },
  data: {
    checkIn: '2026-10-12', checkOut: '2026-10-15', guests: '2', room: 'garden',
    extras: 'Breakfast, late check-out', total: '$1,140.00', ref: 'Booking HX-2214',
  },
  refPath: 'ref',
  confirmAction: { action: 'confirm_booking' },
  backAction: { action: 'edit_booking' },
})

// ── [2] Shopkeeper: an order with line items ──────────────────────────────────────────────────────────
const order = receipt({
  title: 'Your order',
  items: [
    { label: 'Linen tea towel', quantity: 2, amount: '$24.00' },
    { label: 'Stoneware mug, sand', quantity: 1, amount: '$18.00' },
    { label: 'Beeswax candle', quantity: 3, amount: '$27.00' },
  ],
  rows: [
    { label: 'Subtotal', path: 'subtotal' },
    { label: 'Shipping', path: 'shipping' },
  ],
  total: { label: 'Total', path: 'total' },
  data: { subtotal: '$69.00', shipping: '$6.00', total: '$75.00', ref: 'Order #10482' },
  refPath: 'ref',
  confirmAction: { action: 'place_order' },
  backAction: { action: 'edit_cart' },
})

for (const node of [booking, order]) {
  node.addEventListener('change', record)
  node.addEventListener('action', record)
}
// T-0142: the column stretches; only the trigger hugs, as a flex item.
const reset = el('ui-button', { variant: 'soft', style: 'align-self:flex-start;' }, [text('Reset both to pending')])
reset.addEventListener('click', () => {
  booking.status = 'pending'
  order.status = 'pending'
})
const liveBlock = el('div', { style: 'display:flex; flex-direction:column; gap:var(--md-sys-widget-margin);' }, [booking, order, reset, log])
const liveNote = el('p', {}, [
  text('Confirm writes '), code('status'), text(' as confirmed, emits '), code('change'), text(', then emits '),
  code('action'), text(' with '), code('confirmAction'), text('. Back emits '), code('action'), text(' with '),
  code('backAction'), text(' and leaves the record asking.'),
])

// ── [3] A receipt rendered already confirmed ─────────────────────────────────────────────────────────
const settled = receipt({
  title: 'Your table',
  rows: [
    { label: 'Date', path: 'date' },
    { label: 'Time', path: 'time' },
    { label: 'Party', path: 'party' },
  ],
  data: { date: '2026-10-24', time: '19:30', party: '4 guests', ref: 'Reservation R-5521' },
  refPath: 'ref',
  status: 'confirmed',
  confirmAction: { action: 'confirm_table' },
})
const settledNote = el('p', {}, [
  text('With '), code('status'), text(' already confirmed there is no actions row to press, so a re-render on the ' +
    'same data never asks again. No items and no total: those parts render no box.'),
])

content.append(
  exampleSection('Booking and order, live', liveBlock, liveNote),
  exampleSection('A settled receipt', settled, settledNote),
)
