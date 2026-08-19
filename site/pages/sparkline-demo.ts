// site/pages/sparkline-demo.ts — the ui-sparkline demo (the Display-class series-shape mark, ADR-0107;
// pairs with sparkline-doc.ts, the descriptor-derived API page). Mounts the REAL control over realistic report
// series — a KPI strip (MRR, sign-ups, p95 latency, error rate), line vs area, page-sized marks, degenerate
// data, and a live re-render driven by a real ui-button — never a mock. A display leaf emits nothing (no event
// log); the honesty proof here is the mounted control's own SVG re-rendering under real prop writes.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.demo-figure/.demo-grid + section spacing)
import { applyDemoWidth, captioned, el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-sparkline — demo',
  intro:
    'The inline series-shape mark, live: a KPI strip over real report series, the line and area variants, ' +
    'sizing through the two tokens, the degenerate cases, and a re-render under a live values write. ' +
    'The API table is on the ui-sparkline API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── realistic report series (hand-authored — a believable SaaS month) ────────────────────────────────────────
const MRR_12M = [41200, 42800, 43100, 44900, 46200, 45800, 47600, 49100, 50400, 52300, 53900, 55700] // 12 months, USD
const SIGNUPS_30D = [18, 22, 19, 25, 31, 12, 9, 27, 30, 28, 33, 35, 14, 11, 29, 32, 38, 36, 40, 17, 13, 37, 41, 39, 44, 42, 19, 15, 46, 48]
const P95_LATENCY_24H = [212, 208, 205, 199, 201, 240, 318, 402, 388, 361, 344, 352, 349, 371, 366, 340, 322, 310, 298, 287, 275, 251, 230, 219] // ms, hourly
const ERROR_RATE_24H = [0.4, 0.3, 0.3, 0.5, 0.4, 0.6, 1.9, 2.4, 1.1, 0.8, 0.7, 0.6, 0.6, 0.5, 0.5, 0.4, 0.4, 0.5, 0.3, 0.3, 0.4, 0.2, 0.3, 0.3] // %

const sparkline = (values: readonly number[], label: string, variant?: 'line' | 'area'): HTMLElement =>
  el('ui-sparkline', { values: JSON.stringify(values), label, ...(variant ? { variant } : {}) })

// ── [1] the KPI strip — a sparkline beside a headline figure, the canonical dashboard job ─────────────────────
const kpi = (label: string, figure: string, spark: HTMLElement): HTMLElement =>
  el('div', { class: 'demo-figure' }, [
    el('div', { style: 'display:flex; justify-content:space-between; gap:1rem; align-items:baseline;' }, [
      strong(label),
      el('span', { style: 'font-variant-numeric: tabular-nums;' }, [text(figure)]),
    ]),
    spark,
  ])
const strip = el('div', { class: 'demo-grid' }, [
  kpi('MRR, 12 months', '$55,700', sparkline(MRR_12M, 'MRR, 12 months', 'area')),
  kpi('Sign-ups, 30 days', '48 today', sparkline(SIGNUPS_30D, 'Sign-ups, 30 days')),
  kpi('p95 latency, 24 h', '219 ms', sparkline(P95_LATENCY_24H, 'p95 latency, 24 hours')),
  kpi('Error rate, 24 h', '0.3 %', sparkline(ERROR_RATE_24H, 'Error rate, 24 hours', 'area')),
])
for (const spark of strip.querySelectorAll('ui-sparkline')) applyDemoWidth(spark as HTMLElement, '100%')
const stripNote = el('p', {}, [
  text('Each mark is a real '), code('ui-sparkline'), text(' with its '), code('values'),
  text(' bound to a JSON array; the headline figure beside it is page content. Every mark carries '),
  code('role="img"'), text(' and a generated accessible name (count · endpoints · extrema) — never a silent state.'),
])

// ── [2] line vs area — the same series under both variants ─────────────────────────────────────────────────
const variants = el('div', { class: 'demo-grid' }, [
  captioned('variant="line" (default)', sparkline(MRR_12M, 'MRR', 'line')),
  captioned('variant="area"', sparkline(MRR_12M, 'MRR', 'area')),
])

// ── [3] sizing — the two tokens; the default box is 8em × 1lh so an inline mark rides the line box ───────────
const inline = el('p', {}, [
  text('Revenue trended '), sparkline(MRR_12M, 'MRR'), text(' over the year while p95 latency '),
  sparkline(P95_LATENCY_24H, 'p95 latency'), text(' spiked at the 07:00 deploy — the default 8em × 1lh box rides the ambient line box.'),
])
const wide = sparkline(SIGNUPS_30D, 'Sign-ups, 30 days', 'area')
wide.style.setProperty('--ui-sparkline-inline-size', '100%')
wide.style.setProperty('--ui-sparkline-block-size', '4rem')
const sizing = el('div', {}, [
  inline,
  captioned('--ui-sparkline-inline-size: 100%; --ui-sparkline-block-size: 4rem', wide),
])

// ── [4] degenerate data — every case still paints and still announces ───────────────────────────────────────
const degenerate = el('div', { class: 'demo-grid' }, [
  captioned('values="[]" — no data (empty box, "no data" name)', sparkline([], 'Empty series')),
  captioned('values="[7]" — one point (a centered dot)', sparkline([7], 'Single point')),
  captioned('values="[5,5,5,5,5]" — all equal (a flat line)', sparkline([5, 5, 5, 5, 5], 'Flat series')),
  captioned('values="[-3,-1,2,-4,1]" — negatives normalize', sparkline([-3, -1, 2, -4, 1], 'Mixed-sign series')),
])

// ── [5] a live re-render — pushing a new sample writes `values`; the whole mark re-renders (no append API) ───
const live = sparkline(P95_LATENCY_24H, 'p95 latency, rolling 24 h')
applyDemoWidth(live, '20rem')
live.style.setProperty('--ui-sparkline-block-size', '3rem')
let rolling = [...P95_LATENCY_24H]
const readout = code(`${rolling.length} points, last ${rolling[rolling.length - 1]} ms`)
const push = uiButton('Push a new sample')
push.addEventListener('click', () => {
  const last = rolling[rolling.length - 1]
  const next = Math.max(150, Math.round(last + (Math.random() - 0.5) * 60))
  rolling = [...rolling.slice(1), next] // a rolling window: drop the oldest, append the newest
  ;(live as HTMLElement & { values: readonly number[] }).values = rolling // a real prop write — whole re-render
  readout.textContent = `${rolling.length} points, last ${next} ms`
})
const liveBlock = el('div', { style: 'display:flex; flex-direction:column; gap:0.75rem; align-items:flex-start;' }, [
  live,
  el('div', { style: 'display:flex; gap:1rem; align-items:center;' }, [push, readout]),
])
const liveNote = el('p', {}, [
  text('Each click writes the '), code('values'), text(' property with a rolled window (oldest dropped, newest appended); ' +
    'the mark rebuilds as a whole — A2UI '), code('updateDataModel'), text(' semantics, no incremental-append API.'),
])

content.append(
  exampleSection('KPI strip', strip, stripNote),
  exampleSection('Line vs area', variants),
  exampleSection('Sizing', sizing),
  exampleSection('Degenerate data', degenerate),
  exampleSection('Live re-render', liveBlock, liveNote),
)
