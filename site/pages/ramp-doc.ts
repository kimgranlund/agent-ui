// site/pages/ramp-doc.ts — the ui-ramp API doc page (tier=display ⇒ {doc} only, ADR-0118 /
// token-surfaces.lld.md LLD-C11). DERIVED from `ramp.md` via the shared doc-page.ts renderer: the attribute
// table is built from the parsed `attributes[]`, the parts[] surface renders as the descriptor-derived
// Parts table (composeDocPage's renderPartsTable — the cell/box/step-label/value data-part nodes), and the
// prose from the body — so neither the tables nor the body can drift from the descriptor the contract
// trip-wire enforces (ADR-0004, one parser / two consumers). The specimen DATA are hand-authored (a doc
// page has no source to derive representative data from) — a real tonal series, not lorem stubs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadRampDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading } from '../lib/doc-page.ts'

interface Step {
  readonly label: string
  readonly value: string
}

// A real tonal series — the canonical ordered-progression job. HAND-AUTHORED: a doc page has no descriptor
// source for example content (the ui-bar-chart doc precedent — never a lorem stub).
const PRIMARY_TONES: readonly Step[] = [
  { label: '100', value: '--md-sys-color-primary-100' },
  { label: '300', value: '--md-sys-color-primary-300' },
  { label: '500', value: '--md-sys-color-primary-500' },
  { label: '700', value: '--md-sys-color-primary-700' },
  { label: '900', value: '--md-sys-color-primary-900' },
]

const MIXED_VALIDITY: readonly Step[] = [
  { label: 'ok', value: '--md-sys-color-primary-500' },
  { label: 'invalid', value: 'not-a-color' },
  { label: 'ok2', value: '--md-sys-color-primary-700' },
]

const { descriptor, body } = loadRampDoc()

const { content } = mountPage({
  title: 'ui-ramp — API',
  intro:
    'The Display-class ordered-color-series leaf (ADR-0118, token-surfaces v1) — a wrapping strip of color ' +
    'cells whose whole contract is "show this color series in order." Order IS the content: a tonal ramp, a ' +
    'palette range. Non-interactive, non-form-associated: no events. Generated from ramp.md: the attribute ' +
    'and parts tables are descriptor-derived (they cannot drift); the live strips below show a real tonal ' +
    'progression, a scheme pin, and the degenerate cases.',
})

composeDocPage(content, descriptor, body, renderSpecimens())

function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(
    heading(2, 'Examples'),
    labelledRamp(
      'A tonal progression',
      'The numbered primary-family steps, in order — the genuinely ordered series a ramp exists to show.',
      PRIMARY_TONES,
      'Primary tonal range',
    ),
    labelledRamp(
      'The scheme pin',
      'The same series pinned to scheme="dark" — every cell resolves under the pinned scheme.',
      PRIMARY_TONES,
      'Primary tonal range (dark)',
      'dark',
    ),
    renderDegenerate(),
  )
  return section
}

// renderDegenerate — a SPEC-R7 edge case made a live visual fixture: a mixed-validity series keeps every
// cell (an invalid color renders transparent + border, its label still prints — never silently dropped).
function renderDegenerate(): HTMLElement {
  return labelledRamp(
    'Degenerate: mixed validity',
    'One step has an invalid color value — its cell renders transparent + border (the swatch honesty), its ' +
      'label still prints; the remaining cells render normally (SPEC-R7).',
    MIXED_VALIDITY,
    'Mixed-validity series',
  )
}

// labelledRamp — a titled, described live <ui-ramp> specimen. `steps` is the JSON-string attribute form
// (ramp.md — the safe LLD-C1 codec round-trips it); `label` is the accessible name.
function labelledRamp(title: string, description: string, steps: readonly Step[], label: string, scheme?: 'light' | 'dark'): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'margin:0.5rem 0 1.75rem;'
  const desc = document.createElement('p')
  desc.textContent = description

  const ramp = document.createElement('ui-ramp')
  ramp.setAttribute('steps', JSON.stringify(steps))
  ramp.setAttribute('label', label)
  if (scheme) ramp.setAttribute('scheme', scheme)
  ramp.setAttribute('style', 'max-inline-size:26rem;')

  wrap.append(heading(3, title), desc, ramp)
  return wrap
}
