// site/pages/confirm-receipt-doc.ts: the ui-confirm-receipt API doc page (tier=pattern => {doc, demo}, T-0195).
// Derived from `confirm-receipt.md` through the shared doc-page.ts renderer: the attribute and parts tables come
// from the parsed descriptor and the prose from its body, so neither can drift from the contract the trip-wire
// enforces (ADR-0004). The specimen data are hand-authored; a doc page has no source to derive them from.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadConfirmReceiptDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading } from '../lib/doc-page.ts'

const { descriptor, body } = loadConfirmReceiptDoc()

const { content } = mountPage({
  title: 'ui-confirm-receipt: API',
  intro:
    'The read-back, confirm and receipt record (T-0195): rows, line items and a total read from the bound data ' +
    'by path, Back and Confirm in a row under the card, and a settled receipt with a Confirmed mark. Generated ' +
    'from confirm-receipt.md: the attribute and parts tables are descriptor-derived; the specimens below are live.',
})

composeDocPage(content, descriptor, body, renderSpecimens())

function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'), heading(3, 'A booking read back, and the same booking settled'))
  const desc = document.createElement('p')
  desc.textContent =
    'The first record asks: its rows and total come from the bound data, and Back and Confirm sit under the ' +
    'card. The second is the same record with status confirmed: the actions row is gone, the Confirmed mark ' +
    'takes the header and the reference line shows.'
  const column = document.createElement('div')
  column.style.cssText = 'display:grid; gap:1rem; max-inline-size:30rem; margin:0.5rem 0 1.75rem;'

  const booking = {
    title: 'Your stay',
    rows: [
      { label: 'Arrival', path: 'checkIn' },
      { label: 'Departure', path: 'checkOut' },
      { label: 'Guests', path: 'guests' },
    ],
    total: { label: 'Total, 3 nights', path: 'total' },
    data: { checkIn: '2026-10-12', checkOut: '2026-10-15', guests: '2', total: '$1,140.00', ref: 'Booking HX-2214' },
    refPath: 'ref',
    confirmAction: { action: 'confirm_booking' },
    backAction: { action: 'edit_booking' },
  }
  const asking = document.createElement('ui-confirm-receipt')
  Object.assign(asking, booking)
  const settled = document.createElement('ui-confirm-receipt')
  Object.assign(settled, booking, { status: 'confirmed' })

  column.append(asking, settled)
  section.append(desc, column)
  return section
}
