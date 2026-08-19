// site/pages/description-list-demo.ts — the ui-description-list demo (the ratified display-tier `demo`, GH #1279
// batch): the REAL key–value receipt primitive (ADR-0201) in the flow it was minted for — the CONFIRM STEP of a
// booking. Three receipts on realistic bookings (a hotel stay, a table reservation, a flight change), the
// heading composed OUTSIDE as a real ui-text (the #1174 sentence-case law lives with the producer), a LIVE
// omission specimen (a "gather more fields" simulation writes `rows` as a PROPERTY — the bound-data lane —
// where valueless fields (empty / null / absent / boolean / whitespace) never render, and filling them adds
// rows in place; a write log proves rows-in vs rows-rendered), Intl number formatting for finite numbers, and
// the opt-in aligned-values lever (`--ui-description-list-label-min-inline-size`). Pairs with the
// descriptor-derived API doc, site/pages/description-list-doc.ts. Emits no events (display leaf).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { whenFlushed } from '@agent-ui/components' // the kernel's microtask flush — the render effect settles before the log counts rows
import { applyDemoWidth, captioned, el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-description-list — demo',
  intro:
    'The confirm-step receipt, live: three bookings summarised before commit — label on the secondary plane, ' +
    'value adjacent, every line a decision. Then the omission law at work: a form that has not yet gathered ' +
    'every field renders only the fields it has, and grows in place as they arrive — a valueless row is ' +
    'unrepresentable, not merely hidden. The API table is on the ui-description-list API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const inline = (s: string): HTMLElement => el('code', {}, [text(s)])

type Row = { label: string; value?: unknown }
type ReceiptHost = HTMLElement & { rows: Row[] }

/** receipt — a real <ui-description-list rows> (attribute JSON form) with a real heading composed ABOVE it. */
function receipt(heading: string, rows: readonly Row[]): HTMLElement {
  const list = el('ui-description-list', { rows: JSON.stringify(rows) })
  return el('ui-column', { gap: 'sm', align: 'stretch' }, [
    el('ui-text', { variant: 'title', as: 'h3' }, [text(heading)]),
    list,
  ])
}

// ── three confirm-step receipts — believable bookings, verbatim strings, humanized upstream ────────────────
const receipts = el('div', { class: 'demo-grid' }, [
  receipt('Confirm your stay', [
    { label: 'Hotel', value: 'Hotel Aurora, Reykjavík' },
    { label: 'Room', value: 'Deluxe King' },
    { label: 'Check-in', value: 'Fri 4 Sep 2026' },
    { label: 'Check-out', value: 'Mon 7 Sep 2026' },
    { label: 'Nights', value: 3 },
    { label: 'Guests', value: '2 adults' },
    { label: 'Breakfast', value: 'Included' },
    { label: 'Total', value: '€ 1,140.00' },
  ]),
  receipt('Confirm your table', [
    { label: 'Restaurant', value: 'Osteria Ventidue' },
    { label: 'Date', value: 'Sat 22 Aug 2026' },
    { label: 'Time', value: '19:30' },
    { label: 'Party', value: 4 },
    { label: 'Seating', value: 'Terrace, if available' },
    { label: 'Dietary note', value: 'One vegetarian, one nut allergy' },
  ]),
  receipt('Confirm your flight change', [
    { label: 'Booking ref', value: 'K7PZQ2' },
    { label: 'Passenger', value: 'Priya Natarajan' },
    { label: 'Was', value: 'ARN → LHR, Mon 31 Aug 07:10' },
    { label: 'Now', value: 'ARN → LHR, Mon 31 Aug 16:45' },
    { label: 'Fare difference', value: '£ 42.00' },
    { label: 'Change fee', value: 'Waived (flex fare)' },
  ]),
])
receipts.style.cssText = 'grid-template-columns:repeat(auto-fit, minmax(18rem, 1fr));'

const receiptsNote = el('p', {}, [
  text('Each receipt’s heading is a real '), inline('ui-text as="h3"'), text(' composed OUTSIDE the list — the component imposes no child model and mints no ARIA; its whole meaning is real text in reading order (label → value, row by row). Strings render VERBATIM — "Deluxe King", "Waived (flex fare)" were humanized by the producer, never here.'),
])

// ── the omission law, live — a form that gathers fields over time ────────────────────────────────────────
const GATHERED: readonly Row[] = [
  { label: 'Room', value: 'Deluxe King' },
  { label: 'Nights', value: 3 },
  { label: 'Late checkout', value: '' }, // not yet asked — empty string ⇒ dropped
  { label: 'Promo code', value: null }, // declined ⇒ null ⇒ dropped
  { label: 'Dietary note', value: '   ' }, // whitespace-only ⇒ dropped
  { label: 'Airport pickup', value: false }, // a raw boolean is NOT repaired to "No" — dropped, by law
  { label: 'Breakfast' }, // absent value ⇒ dropped
]
const FILLED: readonly Row[] = [
  { label: 'Room', value: 'Deluxe King' },
  { label: 'Nights', value: 3 },
  { label: 'Late checkout', value: 'Until 14:00' },
  { label: 'Promo code', value: 'SUMMER26' },
  { label: 'Dietary note', value: 'Vegetarian breakfast' },
  { label: 'Airport pickup', value: 'Yes — 06:40 shuttle' }, // the PRODUCER humanized the boolean upstream
  { label: 'Breakfast', value: 'Included' },
]

const liveList = el('ui-description-list', { rows: JSON.stringify(GATHERED) }) as ReceiptHost
applyDemoWidth(liveList, 'min(100%, 28rem)')

const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
async function writeRows(name: string, rows: readonly Row[]): Promise<void> {
  liveList.rows = rows as Row[] // the PROPERTY path — the bound `DescriptionList.rows` lane; the render effect re-hardens
  await whenFlushed()
  seq += 1
  const rendered = liveList.querySelectorAll('[data-part="row"]').length
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  rows ← ${name} (${rows.length} entries)  →  rendered ${rendered} rows`
  log.append(line)
  log.scrollTop = log.scrollHeight
}
const gathered = uiButton('Gathered so far (7 entries, 5 valueless)', 'soft')
gathered.addEventListener('click', () => { void writeRows('gathered', GATHERED) })
const filled = uiButton('All fields answered (7 entries)', 'solid')
filled.addEventListener('click', () => { void writeRows('filled', FILLED) })
const garbage = uiButton('Malformed bind (a string, not an array)', 'ghost')
garbage.addEventListener('click', () => { void writeRows('garbage', 'not-json' as unknown as Row[]) })

const liveNote = el('p', {}, [
  text('Seven entries arrive; only two have values on first render — the five without ('), inline('""'), text(', '), inline('null'),
  text(', whitespace, '), inline('false'), text(', absent) never exist as row state, at the codec AND again in the render effect (ADR-0201 cl.3). Answering them adds rows IN PLACE, order preserved. A raw boolean is not repaired to "No" — humanization is the producer’s job. A malformed bind renders zero rows, never throws.'),
])

// ── numbers + the aligned-values lever ────────────────────────────────────────────────────────────────────
const numbers = el('ui-description-list', {
  rows: JSON.stringify([
    { label: 'Seats', value: 4 },
    { label: 'Loyalty points', value: 128450 },
    { label: 'Distance', value: 1487.5 },
    { label: 'Rating', value: 4.7 },
  ]),
})
numbers.style.setProperty('--ui-description-list-label-min-inline-size', '9em')
applyDemoWidth(numbers, 'min(100%, 28rem)')

const numbersNote = el('p', {}, [
  text('A finite number prints through the shared default-locale '), inline('Intl.NumberFormat'),
  text(' (grouping separators for free); a non-finite one drops the row. Setting '), inline('--ui-description-list-label-min-inline-size'),
  text(' (9em here) gives aligned values — an opt-in column EFFECT with no grid; the default is label → value adjacent at a fixed pair gap, never opposite-edge flushing (ADR-0201 cl.4).'),
])

content.append(
  exampleSection('Three confirm-step receipts', receipts, receiptsNote),
  exampleSection('The omission law, live', liveList, el('ui-row', { gap: 'sm', align: 'center', wrap: '' }, [gathered, filled, garbage]), liveNote),
  exampleSection('rows write log', log),
  exampleSection('Numbers + aligned values', captioned('--ui-description-list-label-min-inline-size: 9em', numbers), numbersNote),
)
