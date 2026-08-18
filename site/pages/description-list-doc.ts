// site/pages/description-list-doc.ts — the ui-description-list API doc page (tier=display ⇒ {doc} only,
// ADR-0201). DERIVED from `description-list.md` via the shared doc-page.ts renderer: the attribute table
// is built from the parsed `attributes[]`, the parts[] surface renders as the descriptor-derived Parts
// table (row/label/value), and the prose from the body — so neither can drift from the descriptor the
// contract trip-wire enforces (ADR-0004). The specimen DATA are hand-authored (a doc page has no source
// to derive representative data from) — a booking receipt (the canonical confirm-step job, GH #1174/#1185)
// plus an omission-law demonstration feeding valueless fields that never paint.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadDescriptionListDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading } from '../lib/doc-page.ts'

const { descriptor, body } = loadDescriptionListDoc()

const { content } = mountPage({
  title: 'ui-description-list — API',
  intro:
    'The Display-class key–value receipt primitive (ADR-0201) — per row a label on the secondary plane ' +
    'with its value adjacent, rows as hardened data, a valueless field omitted by construction. Not ' +
    'interactive, not form-associated: no events, no keyboard contract, no [size]/[scale] control ' +
    'geometry. Generated from description-list.md: the attribute and parts tables are descriptor-derived; ' +
    'the receipts below show the canonical confirm-step job and the omission law.',
})

composeDocPage(content, descriptor, body, renderSpecimens())

function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'), heading(3, 'A booking receipt'))

  const desc = document.createElement('p')
  desc.textContent =
    'The confirm-step receipt (the GH #1174 grammar pattern, now a primitive): humanized values arrive ' +
    'from the producer — the component renders strings verbatim and formats finite numbers via Intl.'
  const receipt = specimen([
    { label: 'Room', value: 'Deluxe King' },
    { label: 'Nights', value: 3 },
    { label: 'Guests', value: 2 },
    { label: 'Breakfast', value: 'Included' },
    { label: 'Total', value: '$412.00' },
  ])

  const omissionHeading = heading(3, 'The empty-value omission law')
  const omissionDesc = document.createElement('p')
  omissionDesc.textContent =
    'This specimen is fed SEVEN rows — three arrive valueless (empty string, null, absent) and never ' +
    'render: a field with no value is unrepresentable, not merely discouraged.'
  const omission = specimen([
    { label: 'Name', value: 'Ada Lovelace' },
    { label: 'Email', value: 'ada@example.com' },
    { label: 'Phone', value: '' }, // omitted — empty
    { label: 'Company', value: null }, // omitted — null
    { label: 'Seats', value: 12 },
    { label: 'Coupon' }, // omitted — absent
    { label: 'Plan', value: 'Team (annual)' },
  ])

  section.append(desc, box(receipt), omissionHeading, omissionDesc, box(omission))
  return section
}

function specimen(rows: readonly Record<string, unknown>[]): HTMLElement {
  const el = document.createElement('ui-description-list')
  el.setAttribute('rows', JSON.stringify(rows))
  return el
}

function box(el: HTMLElement): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'max-width: 26rem; margin: 0.5rem 0 1.75rem;'
  wrap.append(el)
  return wrap
}
