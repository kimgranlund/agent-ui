// site/pages/sparkline-doc.ts — the ui-sparkline API doc page (tier=display ⇒ {doc} only, ADR-0107 /
// chart-family.lld.md LLD-C9). DERIVED from `sparkline.md` via the shared doc-page.ts renderer: the attribute
// table is built from the parsed `attributes[]`, the parts[] surface renders as the descriptor-derived Parts table
// (composeDocPage's renderPartsTable — the two data-part nodes line/area), and the prose from the body — so neither
// the tables nor the body can drift from the descriptor the contract trip-wire enforces (ADR-0004, one parser / two
// consumers). This control declares no properties/events/slots, so those tables are omitted. One page-local block
// is DERIVED: the variant strip iterates the PARSED
// `variant` enum (line · area), so a new variant added to sparkline.md renders its specimen here for free. The
// specimen SERIES are hand-authored (a doc page has no source to derive representative data from) — a real
// revenue trend, not a lorem stub, so the mark demonstrates its actual "shape of a series" job (SPEC-R9 example bar).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadSparklineDoc } from '../lib/frontmatter.ts'
import { composeDocPage, findAttr, heading } from '../lib/doc-page.ts'
import type { ParsedDescriptor } from '@agent-ui/components/descriptor'

// A representative twelve-month revenue trend (indexed millions) — a real series with a genuine shape (dip,
// recovery, sustained climb), so the mark shows its actual job rather than a placeholder wiggle. HAND-AUTHORED:
// a doc page has no descriptor source for example content (SPEC-R9's example-content bar — never a lorem stub).
const REVENUE_TREND = [42, 45, 41, 48, 52, 49, 58, 61, 60, 67, 72, 78] as const

// A larger showcase box than the inline `8em × 1lh` default (sparkline.css) so the shape reads on the page; the
// inline-size/block-size pair is the documented author override (sparkline.md § Sizing). The RAW default box gets
// its own dedicated first specimen below (review-mandated: the inline-in-text mark is the control's headline
// feature and must be SHOWN, not only described); this box is the "size it to a layout" upgrade.
const SHOWCASE_BOX = 'inline-size:14rem; block-size:3.5rem;'

const { descriptor, body } = loadSparklineDoc()

const { content } = mountPage({
  title: 'ui-sparkline — API',
  intro:
    'The Display-class series-shape mark (ADR-0107, chart-family v1) — an inline, axis-free chart answering ' +
    '“what is the shape of this series?”. Non-interactive, non-form-associated: no ticks, no legend, no events. ' +
    'Generated from sparkline.md: the attribute and parts tables are descriptor-derived (they cannot drift), and ' +
    'the variant strip below iterates the parsed `variant` enum against a live revenue-trend series.',
})

composeDocPage(content, descriptor, body, renderSpecimens(descriptor))

// renderSpecimens — the live-mark section: the variant strip (derived from the parsed enum) + a degenerate strip
// (the SPEC-R3 edge cases as visual fixtures), under one "Examples" heading so composeDocPage's single specimens
// slot carries them together (the text-doc.ts precedent).
function renderSpecimens(d: ParsedDescriptor): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'), renderDefaultBoxSpecimen(), renderVariantStrip(d), renderDegenerateStrip())
  return section
}

// renderDefaultBoxSpecimen — the control at its RAW `8em × 1lh` default, set inline in running prose: the
// headline feature (an inline-in-text mark, the SPEC-R9 sizing ruling's whole point), shown live with zero
// style override. Everything below this upgrades the box; this is what a bare <ui-sparkline> IS.
function renderDefaultBoxSpecimen(): HTMLElement {
  const wrap = document.createElement('div')
  const prose = document.createElement('p')
  const box = document.createElement('code')
  box.textContent = '8em × 1lh'
  prose.append(
    'The default box — no sizing at all: revenue ran ',
    sparkline({ rawDefaultBox: true, label: 'Revenue trend' }),
    ' over the last twelve months — an ',
    box,
    ' mark sitting on the text baseline, sized by the type context alone.',
  )
  wrap.append(heading(3, 'The inline default'), prose)
  return wrap
}

// renderVariantStrip — one live <ui-sparkline> per PARSED `variant` enum member, each rendering the SAME
// representative revenue trend so the two variants (a bare stroke vs. the same stroke with a filled area) are
// directly comparable. Iterating the parsed enum means a future variant added to sparkline.md gets a specimen for
// free — the matrix the descriptor declares IS the matrix shown.
function renderVariantStrip(d: ParsedDescriptor): HTMLElement {
  const wrap = document.createElement('div')
  const intro = document.createElement('p')
  intro.textContent =
    'The same twelve-month revenue trend under each `variant` — the accessible name is a generated summary ' +
    '(count · endpoints · extrema), so the mark announces without a caption.'
  wrap.append(heading(3, '`variant` — line vs. area'), intro)

  const row = specimenFlexRow()
  for (const variant of findAttr(d, 'variant')?.values ?? []) {
    row.append(labelled(`variant="${variant}"`, sparkline({ variant, label: 'Revenue trend' })))
  }
  wrap.append(row)
  return wrap
}

// renderDegenerateStrip — the SPEC-R3 degenerate cases as live visual fixtures: a single point (a round dot at
// center), an all-equal series (a flat mid-height line), a negative-spanning series (normalized within [min,max]),
// and empty input (an empty box that still paints + still announces `no data`). HAND-AUTHORED fixtures — each is a
// named edge case from the descriptor's "Degenerate data" prose, made visible.
function renderDegenerateStrip(): HTMLElement {
  const wrap = document.createElement('div')
  const intro = document.createElement('p')
  intro.textContent = 'Every degenerate input still paints the box and still announces — it never throws (SPEC-R3).'
  wrap.append(heading(3, 'Degenerate data'), intro)

  const cases: readonly { caption: string; values: readonly number[] }[] = [
    { caption: 'one point → a centered dot', values: [7] },
    { caption: 'all-equal → a flat mid-line', values: [5, 5, 5, 5, 5] },
    { caption: 'negative span → normalized in [min, max]', values: [-8, -3, -5, 2, -1, 4] },
    { caption: 'empty → no data', values: [] },
  ]
  const row = specimenFlexRow()
  for (const c of cases) row.append(labelled(c.caption, sparkline({ values: [...c.values], label: c.caption })))
  wrap.append(row)
  return wrap
}

// sparkline — a live <ui-sparkline> in the showcase box, `values` defaulting to the shared revenue trend. `values`
// is the JSON-string attribute form (sparkline.md — the safe codec round-trips it); `variant`/`label` are plain
// string attributes.
function sparkline(opts: {
  values?: readonly number[]
  variant?: string
  label?: string
  /** Omit the SHOWCASE_BOX override — the control renders at its own `8em × 1lh` default. */
  rawDefaultBox?: boolean
}): HTMLElement {
  const el = document.createElement('ui-sparkline')
  el.setAttribute('values', JSON.stringify(opts.values ?? REVENUE_TREND))
  if (opts.variant) el.setAttribute('variant', opts.variant)
  if (opts.label) el.setAttribute('label', opts.label)
  if (!opts.rawDefaultBox) el.setAttribute('style', SHOWCASE_BOX)
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
