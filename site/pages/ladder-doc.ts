// site/pages/ladder-doc.ts — the ui-ladder API doc page (tier=display ⇒ {doc} only, ADR-0118 /
// token-surfaces.lld.md LLD-C11). DERIVED from `ladder.md` via the shared doc-page.ts renderer: the
// attribute table is built from the parsed `attributes[]`, the parts[] surface renders as the
// descriptor-derived Parts table (composeDocPage's renderPartsTable — the label/track/bar/value data-part
// nodes), and the prose from the body — so neither the tables nor the body can drift from the descriptor
// the contract trip-wire enforces (ADR-0004, one parser / two consumers). The specimen DATA are
// hand-authored (a doc page has no source to derive representative data from) — a real dimensional set.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadLadderDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading } from '../lib/doc-page.ts'

interface Tier {
  readonly label: string
  readonly value: string
}

// A real dimensional set — the control-height ramp (the LITERAL-length job: sm/md/lg draw bars at their
// real px length, no normalization). HAND-AUTHORED: a doc page has no descriptor source for example content.
const CONTROL_HEIGHTS: readonly Tier[] = [
  { label: 'sm', value: '24px' },
  { label: 'md', value: '28px' },
  { label: 'lg', value: '36px' },
]

const MIXED_VALIDITY: readonly Tier[] = [
  { label: 'sm', value: '24px' },
  { label: 'invalid', value: 'red' },
  { label: 'lg', value: '36px' },
]

const { descriptor, body } = loadLadderDoc()

const { content } = mountPage({
  title: 'ui-ladder — API',
  intro:
    'The Display-class labeled-dimensional-tiers leaf (ADR-0118, token-surfaces v1) — a magnitude-bar list ' +
    'whose whole contract is "show these dimensional tiers at their real length, the printed value as the ' +
    'datum." Non-interactive, non-form-associated: no events, no cross-tier normalization math. Generated ' +
    'from ladder.md: the attribute and parts tables are descriptor-derived (they cannot drift); the live ' +
    'ladders below show a real dimensional set and the SPEC-R11 unified no-silent-state degenerate case.',
})

composeDocPage(content, descriptor, body, renderSpecimens())

function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(
    heading(2, 'Examples'),
    labelledLadder(
      'A literal-length ramp',
      'Control heights, in order — each bar draws its REAL px length (24/28/36), never a normalized ' +
        'proportion (SPEC-R10).',
      CONTROL_HEIGHTS,
      'Control heights',
    ),
    renderDegenerate(),
  )
  return section
}

// renderDegenerate — SPEC-R11's unified no-silent-state rule made a live visual fixture: a non-length tier
// value is KEPT (a zero-length bar, the printed malformed value carries the reading) — never silently
// dropped, matching swatch's invalid-color-keeps-the-datum.
function renderDegenerate(): HTMLElement {
  return labelledLadder(
    'Degenerate: a non-length value',
    'One tier\'s value ("red") is not a resolvable length — its row is KEPT with a zero-length bar, the ' +
      'printed "red" carrying the reading (SPEC-R11, the unified no-silent-state rule — never dropped).',
    MIXED_VALIDITY,
    'Mixed-validity tiers',
  )
}

// labelledLadder — a titled, described live <ui-ladder> specimen. `tiers` is the JSON-string attribute form
// (ladder.md — the safe LLD-C1 codec round-trips it); `label` is the accessible name.
function labelledLadder(title: string, description: string, tiers: readonly Tier[], label: string): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'margin:0.5rem 0 1.75rem;'
  const desc = document.createElement('p')
  desc.textContent = description

  const ladder = document.createElement('ui-ladder')
  ladder.setAttribute('tiers', JSON.stringify(tiers))
  ladder.setAttribute('label', label)
  ladder.setAttribute('style', 'max-inline-size:26rem;')

  wrap.append(heading(3, title), desc, ladder)
  return wrap
}
