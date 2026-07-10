// site/pages/swatch-doc.ts — the ui-swatch API doc page (tier=display ⇒ {doc} only, ADR-0118 /
// token-surfaces.lld.md LLD-C11). DERIVED from `swatch.md` via the shared doc-page.ts renderer: the
// attribute table is built from the parsed `attributes[]`, the parts[] surface renders as the
// descriptor-derived Parts table (composeDocPage's renderPartsTable — the box/value data-part nodes), and
// the prose from the body — so neither the tables nor the body can drift from the descriptor the contract
// trip-wire enforces (ADR-0004, one parser / two consumers). This control declares no properties/events/
// slots, so those tables are omitted. The specimens double as degenerate-input visual fixtures (LLD-C11).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadSwatchDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading, specimenRow } from '../lib/doc-page.ts'

const { descriptor, body } = loadSwatchDoc()

const { content } = mountPage({
  title: 'ui-swatch — API',
  intro:
    'The Display-class color-identity leaf (ADR-0118, token-surfaces v1) — a bordered color box whose whole ' +
    'contract is "show this one color value, resolved live," with the token name/caption as real, ' +
    'accessible text. Non-interactive, non-form-associated: no events, no scheme math (the browser resolves ' +
    'every color). Generated from swatch.md: the attribute and parts tables are descriptor-derived (they ' +
    'cannot drift); the live swatches below demonstrate a literal color, the `--var` lane, the scheme pin, ' +
    'and the degenerate cases.',
})

composeDocPage(content, descriptor, body, renderSpecimens())

function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(
    heading(2, 'Examples'),
    heading(3, 'A literal color value'),
    describe('A plain CSS color string — no token lookup, painted directly.'),
    specimenRow([swatch('oklch(0.6 0.03 225)', 'A literal color')]),

    heading(3, 'The --var lane'),
    describe(
      'A value beginning `--` routes through `var(<value>)`, resolved live in the element\'s context — ' +
        'what you see is the real token color, not a description of it.',
    ),
    specimenRow([swatch('--md-sys-color-primary', 'primary'), swatch('--md-sys-color-danger', 'danger')]),

    heading(3, 'The scheme pin'),
    describe(
      'The same `--var` token, pinned to `scheme="light"` and `scheme="dark"` — a light-dark()-valued role ' +
        'resolves differently under each pin (SPEC-R2 AC2).',
    ),
    specimenRow([
      swatch('--md-sys-color-neutral-surface', 'neutral-surface (light)', 'light'),
      swatch('--md-sys-color-neutral-surface', 'neutral-surface (dark)', 'dark'),
    ]),

    heading(3, 'Degenerate: no value, no label'),
    describe(
      'A bare `<ui-swatch>` still paints a visible, non-collapsed box (transparent, border only — the ' +
        'honest "no color" state) and still announces — the composed name falls back to `"swatch"`, never ' +
        'nameless (SPEC-R4).',
    ),
    specimenRow([swatch('', '')]),

    heading(3, 'Degenerate: an undefined --var'),
    describe(
      'An undefined custom property resolves transparent (`var()` with no fallback → invalid → ' +
        'transparent) — no throw, the border still carries the shape.',
    ),
    specimenRow([swatch('--ui-zz-never-defined', 'undefined token')]),
  )
  return section
}

function describe(text: string): HTMLElement {
  const p = document.createElement('p')
  p.textContent = text
  return p
}

/** A labelled live `<ui-swatch>` specimen. */
function swatch(value: string, label: string, scheme?: 'light' | 'dark'): HTMLElement {
  const el = document.createElement('ui-swatch')
  if (value) el.setAttribute('value', value)
  if (label) el.setAttribute('label', label)
  if (scheme) el.setAttribute('scheme', scheme)
  return el
}
