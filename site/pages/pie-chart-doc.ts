// site/pages/pie-chart-doc.ts — the ui-pie-chart API doc page (tier=display ⇒ {doc} only, ADR-0219).
// DERIVED from `pie-chart.md` via the shared doc-page.ts renderer: the attribute table is built from the
// parsed `attributes[]`, the parts[] surface renders as the descriptor-derived Parts table (the six
// data-part nodes: ring/track/slice/key-swatch/key-label/key-percent), and the prose from the body — so
// neither the tables nor the body can drift from the descriptor the contract trip-wire enforces (ADR-0004,
// one parser / two consumers). This control declares no properties/events/slots, so those tables are
// omitted. One page-local block is DERIVED: the variant strip iterates the PARSED `variant` enum (donut ·
// pie). The specimen DATA is hand-authored (a doc page has no source to derive representative data from) —
// the line-chart-doc.ts precedent's report series, reused in shape here so the chart docs are comparable.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadPieChartDoc } from '../lib/frontmatter.ts'
import { composeDocPage, findAttr, heading } from '../lib/doc-page.ts'
import type { ParsedDescriptor } from '@agent-ui/components/descriptor'

// A believable revenue-by-region split — a real dataset with a genuine shape (an uneven four-way split),
// directly comparable across variant/degenerate strips. HAND-AUTHORED: a doc page has no descriptor source
// for example content.
const REVENUE_BY_REGION = [
  { label: 'EMEA', value: 42 },
  { label: 'APAC', value: 31 },
  { label: 'Americas', value: 21 },
  { label: 'Other', value: 6 },
] as const

const SHOWCASE_BOX = 'inline-size:16rem;'

const { descriptor, body } = loadPieChartDoc()

const { content } = mountPage({
  title: 'ui-pie-chart — API',
  intro:
    'The Display-class part-of-whole chart (ADR-0219) — a ring (donut, default) or solid pie mark with a ' +
    'printed-percent key list, identity carried by order + label + percent, never hue alone. ' +
    'Non-interactive, non-form-associated: no hover, no exploded slices, no events. Generated from ' +
    'pie-chart.md: the attribute and parts tables are descriptor-derived (they cannot drift), and the ' +
    'variant strip below iterates the parsed `variant` enum against the same revenue-share dataset.',
})

composeDocPage(content, descriptor, body, renderSpecimens(descriptor))

// renderSpecimens — the live-mark section: the variant strip (derived from the parsed enum) + a degenerate
// strip, under one "Examples" heading.
function renderSpecimens(d: ParsedDescriptor): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'), renderVariantStrip(d), renderDegenerateStrip())
  return section
}

// renderVariantStrip — one live <ui-pie-chart> per PARSED `variant` enum member, the SAME revenue-share
// dataset so the two variants (a ring with a center hole vs. a solid disc) are directly comparable.
function renderVariantStrip(d: ParsedDescriptor): HTMLElement {
  const wrap = document.createElement('div')
  const intro = document.createElement('p')
  intro.textContent =
    'The same four-region revenue split under each `variant` — every slice prints its percent in the key ' +
    'list (the angle-is-weak condition’s accuracy carrier), and identity never rides hue alone.'
  wrap.append(heading(3, '`variant` — donut vs. pie'), intro)

  const row = specimenFlexRow()
  for (const variant of findAttr(d, 'variant')?.values ?? []) {
    row.append(labelled(`variant="${variant}"`, pieChart({ variant, label: 'Revenue by region' })))
  }
  wrap.append(row)
  return wrap
}

// renderDegenerateStrip — the degenerate cases as live visual fixtures: empty data, a single slice, an
// all-zero set, and a negative value being dropped rather than clamped.
function renderDegenerateStrip(): HTMLElement {
  const wrap = document.createElement('div')
  const intro = document.createElement('p')
  intro.textContent = 'Every degenerate input still paints the ring and still announces — it never throws.'
  wrap.append(heading(3, 'Degenerate data'), intro)

  const row = specimenFlexRow()
  row.append(
    labelled('empty → an empty track ring, no key rows', pieChart({ data: [], label: 'Empty dataset' })),
    labelled('one datum → a full ring at 100%', pieChart({ data: [{ label: 'Solo', value: 7 }], label: 'Single slice' })),
    labelled('all-zero → an empty track ring (not zero-length rows)', pieChart({ data: [{ label: 'a', value: 0 }, { label: 'b', value: 0 }], label: 'All zero' })),
    labelled('a negative value is DROPPED, not clamped', pieChart({ data: [{ label: 'ok', value: 10 }, { label: 'neg', value: -5 }], label: 'Hardened input' })),
  )
  wrap.append(row)
  return wrap
}

// pieChart — a live <ui-pie-chart> in the showcase box, `data` defaulting to the shared revenue split.
// `data` is the JSON-string attribute form (pie-chart.md — the safe codec round-trips it); `variant`/
// `label` are plain string attributes.
function pieChart(opts: { data?: readonly { label: string; value: number }[]; variant?: string; label?: string }): HTMLElement {
  const el = document.createElement('ui-pie-chart')
  el.setAttribute('data', JSON.stringify(opts.data ?? REVENUE_BY_REGION))
  if (opts.variant) el.setAttribute('variant', opts.variant)
  if (opts.label) el.setAttribute('label', opts.label)
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
