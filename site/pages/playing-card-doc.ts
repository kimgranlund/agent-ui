// site/pages/playing-card-doc.ts — the ui-playing-card API doc page (tier=display ⇒ {doc} only,
// ADR-0225, GH #1478). DERIVED from `playing-card.md` via the shared doc-page.ts renderer: the
// attribute table is built from the parsed `attributes[]`, the parts[] surface renders as the
// descriptor-derived Parts table (flipper/face/back/index/pips/pip/letter), and the prose from the body —
// so neither the tables nor the body can drift from the descriptor the contract trip-wire enforces
// (ADR-0004, one parser / two consumers). This control declares no properties/events/slots, so those
// tables are omitted. One page-local block is DERIVED: the rank strip iterates the PARSED `rank` enum.
// The specimen composition (a dealt hand incl. one face-down card) is HAND-AUTHORED — a doc page has no
// source to derive representative content from (the example-authoring law: representative, not a lorem
// stub — the pie-chart-doc.ts revenue-series precedent, applied here to a real dealt-hand gallery).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadPlayingCardDoc } from '../lib/frontmatter.ts'
import { composeDocPage, findAttr, heading } from '../lib/doc-page.ts'
import type { ParsedDescriptor } from '@agent-ui/components/descriptor'

const SHOWCASE_BOX = 'inline-size:8rem;'

const { descriptor, body } = loadPlayingCardDoc()

const { content } = mountPage({
  title: 'ui-playing-card — API',
  intro:
    'The Display-class true card-face/back leaf (ADR-0225) — real corner indices, a true suit-pip field ' +
    'or J/Q/K letter treatment, red/black pigment inks, and a CSS-painted back, on a fixed bridge-aspect ' +
    'box that flips on `faceDown` and deals in on insertion. Non-interactive, non-form-associated: no ' +
    'events, no keyboard contract. Generated from playing-card.md: the attribute and parts tables are ' +
    'descriptor-derived (they cannot drift); the specimens below are hand-composed (a doc page has no ' +
    'source to derive a representative dealt hand from).',
})

composeDocPage(content, descriptor, body, renderSpecimens(descriptor))

// renderSpecimens — the live-mark section: a dealt hand (every suit, incl. one face-down card), the
// rank strip (derived from the parsed enum), and the size ramp — under one "Examples" heading.
function renderSpecimens(d: ParsedDescriptor): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'), renderDealtHand(), renderRankStrip(d), renderSizeRamp())
  return section
}

// renderDealtHand — a real dealt hand: one card per suit plus one face-down card, the example-authoring
// law's "representative, not lorem" bar (and the decomposition's own accept condition for the site slice
// — a specimen including at least one face-down card).
function renderDealtHand(): HTMLElement {
  const wrap = document.createElement('div')
  const intro = document.createElement('p')
  intro.textContent =
    'A dealt hand — one card per suit (red/black inks as a redundant identity carrier alongside the shape-' +
    'distinct glyphs) plus a face-down hole card, its rank/suit concealed from both the paint and the ' +
    'accessible name.'
  wrap.append(heading(3, 'A dealt hand'), intro)

  const row = specimenFlexRow()
  row.append(
    labelled('rank="A" suit="spades"', playingCard({ rank: 'A', suit: 'spades' })),
    labelled('rank="K" suit="hearts"', playingCard({ rank: 'K', suit: 'hearts' })),
    labelled('rank="Q" suit="diamonds"', playingCard({ rank: 'Q', suit: 'diamonds' })),
    labelled('rank="10" suit="clubs"', playingCard({ rank: '10', suit: 'clubs' })),
    labelled('face-down', playingCard({ rank: 'A', suit: 'spades', faceDown: true })),
  )
  wrap.append(row)
  return wrap
}

// renderRankStrip — a live <ui-playing-card> per PARSED `rank` enum member (skipping the '' blank-face
// member, which the Degenerate note below covers), all one suit so the pip-count/letter-treatment ramp
// is directly comparable.
function renderRankStrip(d: ParsedDescriptor): HTMLElement {
  const wrap = document.createElement('div')
  const intro = document.createElement('p')
  intro.textContent =
    'Every `rank` — A through 10 render the rank\'s true pip count from the layout table; J/Q/K take the ' +
    'large center-letter treatment (illustrated court art is explicitly out of scope, ADR-0225).'
  wrap.append(heading(3, '`rank` — the full ladder'), intro)

  const row = specimenFlexRow()
  for (const rank of (findAttr(d, 'rank')?.values ?? []).filter((r) => r !== '')) {
    row.append(labelled(`rank="${rank}"`, playingCard({ rank, suit: 'clubs' })))
  }
  wrap.append(row)
  return wrap
}

// renderSizeRamp — the [size] em-box ramp (sm/md/lg), the bridge aspect held at every tier.
function renderSizeRamp(): HTMLElement {
  const wrap = document.createElement('div')
  const intro = document.createElement('p')
  intro.textContent = '`size` repoints the em-keyed box (ADR-0225 cl.5) — the 9/14 bridge aspect holds at every tier.'
  wrap.append(heading(3, '`size` — sm / md / lg'), intro)

  const row = specimenFlexRow()
  for (const size of ['sm', 'md', 'lg']) {
    row.append(labelled(`size="${size}"`, playingCard({ rank: 'A', suit: 'spades', size })))
  }
  wrap.append(row)
  return wrap
}

// playingCard — a live <ui-playing-card> in the showcase box.
function playingCard(opts: { rank?: string; suit?: string; faceDown?: boolean; size?: string }): HTMLElement {
  const el = document.createElement('ui-playing-card')
  if (opts.rank) el.setAttribute('rank', opts.rank)
  if (opts.suit) el.setAttribute('suit', opts.suit)
  if (opts.faceDown) el.setAttribute('face-down', '')
  if (opts.size) el.setAttribute('size', opts.size)
  el.setAttribute('style', SHOWCASE_BOX)
  return el
}

// labelled — a captioned figure wrapping one specimen (the code/caption below the mark).
function labelled(caption: string, specimen: HTMLElement): HTMLElement {
  const figure = document.createElement('figure')
  figure.style.cssText = 'display:flex; flex-direction:column; gap:0.4rem; align-items:flex-start; margin:0;'
  const cap = document.createElement('figcaption')
  cap.style.fontSize = '0.8rem'
  const code = document.createElement('code')
  code.textContent = caption
  cap.append(code)
  figure.append(specimen, cap)
  return figure
}

// specimenFlexRow — a wrapping row of specimen figures (a doc page ships no stylesheet of its own).
function specimenFlexRow(): HTMLElement {
  const row = document.createElement('div')
  row.style.cssText = 'display:flex; gap:1.5rem; align-items:flex-end; flex-wrap:wrap; margin:0.5rem 0 1.5rem;'
  return row
}
