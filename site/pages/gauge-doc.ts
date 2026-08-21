// site/pages/gauge-doc.ts — the ui-gauge API doc page (tier=display ⇒ {doc} only, ADR-0229 cl.4).
// DERIVED from `gauge.md` via the shared doc-page.ts renderer: the attribute table is built from the
// parsed `attributes[]`, the parts[] surface renders as the descriptor-derived Parts table (rings/
// track/progress/legend/key-swatch/key-label/key-percent), and the prose from the body — so neither
// the tables nor the body can drift from the descriptor the contract trip-wire enforces (ADR-0004, one
// parser / two consumers). This control declares no properties/events/slots, so those tables are
// omitted. The specimen DATA is hand-authored (a doc page has no source to derive representative data
// from) — the GH #1561 board's own CPU/Memory/Disk system-load shape.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadGaugeDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading } from '../lib/doc-page.ts'

// A believable system-load reading across three metrics — a real dataset with a genuine shape, directly
// comparable across the strips below. HAND-AUTHORED: a doc page has no descriptor source for example content.
const SYSTEM_LOAD = [
  { label: 'CPU', value: 72 },
  { label: 'Memory', value: 54 },
  { label: 'Disk', value: 31 },
] as const

const SHOWCASE_BOX = 'inline-size:22rem; block-size:14rem;'

const { descriptor, body } = loadGaugeDoc()

const { content } = mountPage({
  title: 'ui-gauge — API',
  intro:
    'The Display-class multi-ring radial gauge (ADR-0229 cl.4) — concentric, INDEPENDENT 0-100 progress ' +
    'rings (never part-of-whole, never a ui-pie-chart extension) plus a real-DOM label/value legend ' +
    'column, outer→inner in data order. Non-interactive, non-form-associated: no hover, no keyboard ' +
    'contract, no events. Generated from gauge.md: the attribute and parts tables are descriptor-derived ' +
    '(they cannot drift).',
})

composeDocPage(content, descriptor, body, renderSpecimens())

// renderSpecimens — the live-mark section: the outer→inner strip, the clamped-values strip, and a
// degenerate strip, under one "Examples" heading.
function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(
    heading(2, 'Examples'),
    renderOrderStrip(),
    renderClampedStrip(),
    renderDegenerateStrip(),
  )
  return section
}

function renderOrderStrip(): HTMLElement {
  const wrap = document.createElement('div')
  const intro = document.createElement('p')
  intro.textContent =
    'Rings render outer→inner in data order — CPU (first datum) is the outermost, largest-radius ring; ' +
    'each subsequent metric steps inward. Each ring reads its OWN percent — they never sum.'
  wrap.append(heading(3, 'Outer→inner ring order'), intro)

  const row = specimenFlexRow()
  row.append(labelled('data order: CPU, Memory, Disk', gaugeEl({ data: [...SYSTEM_LOAD], label: 'System load' })))
  wrap.append(row)
  return wrap
}

function renderClampedStrip(): HTMLElement {
  const wrap = document.createElement('div')
  const intro = document.createElement('p')
  intro.textContent =
    'A value over 100 or below 0 is kept and clamped to its displayable end — never dropped (a documented ' +
    'divergence from ui-pie-chart\'s part-of-whole hardening, which drops a negative share as meaningless).'
  wrap.append(heading(3, 'Out-of-range values clamp, never drop'), intro)

  const row = specimenFlexRow()
  row.append(
    labelled('value=140 clamps to 100%', gaugeEl({ data: [{ label: 'Over-quota', value: 140 }], label: 'Clamped reading' })),
    labelled('value=-20 clamps to 0%', gaugeEl({ data: [{ label: 'Under-run', value: -20 }], label: 'Clamped reading' })),
  )
  wrap.append(row)
  return wrap
}

function renderDegenerateStrip(): HTMLElement {
  const wrap = document.createElement('div')
  const intro = document.createElement('p')
  intro.textContent = 'Every degenerate input still paints the box and still announces — it never throws.'
  wrap.append(heading(3, 'Degenerate data'), intro)

  const row = specimenFlexRow()
  row.append(
    labelled('empty → an empty host, role=list with 0 items', gaugeEl({ data: [], label: 'Empty dataset' })),
    labelled('one ring → one row', gaugeEl({ data: [{ label: 'Solo', value: 88 }], label: 'Single metric' })),
    labelled('a missing/empty label drops that entry', gaugeEl({ data: [{ label: '', value: 50 }, { label: 'ok', value: 20 }], label: 'Hardened input' })),
  )
  wrap.append(row)
  return wrap
}

// gaugeEl — a live <ui-gauge> in the showcase box. `data` is the JSON-string attribute form
// (gauge.md — the safe codec round-trips it).
function gaugeEl(opts: { data?: readonly { label: string; value: number }[]; label?: string }): HTMLElement {
  const el = document.createElement('ui-gauge')
  el.setAttribute('data', JSON.stringify(opts.data ?? SYSTEM_LOAD))
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
