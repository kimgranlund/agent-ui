// site/pages/pie-chart-demo.ts — the ui-pie-chart demo (the Display-class part-of-whole chart, ADR-0219;
// pairs with pie-chart-doc.ts, the descriptor-derived API page). Mounts the REAL control over a realistic
// revenue-share dataset under both variants, a donut-center SIBLING composition (cl.6 — the control paints
// nothing there itself), the degenerate cases, and a live rewrite driven by real ui-buttons — never a mock.
// A display leaf emits nothing; the honesty proof is the mounted control's own ring + key-list re-deriving
// under real `data` writes.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.demo-figure/.demo-grid + section spacing)
import { applyDemoWidth, captioned, el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-pie-chart — demo',
  intro:
    'The part-of-whole ring (donut, default) or solid pie, live: a realistic revenue-share dataset under ' +
    'both variants, the donut center as a sibling composition, the degenerate cases, and a live data ' +
    'rewrite. The API table is on the ui-pie-chart API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── a realistic dataset (hand-authored — a believable SaaS revenue-by-region split) ──────────────────────
const REVENUE_BY_REGION = [
  { label: 'EMEA', value: 42 },
  { label: 'APAC', value: 31 },
  { label: 'Americas', value: 21 },
  { label: 'Other', value: 6 },
]
const BUDGET_ALLOCATION = [
  { label: 'Allocated', value: 1240 },
  { label: 'Unallocated', value: 260 },
]

const pieChart = (data: readonly { label: string; value: number }[], label: string, variant?: 'donut' | 'pie'): HTMLElement =>
  el('ui-pie-chart', { data: JSON.stringify(data), label, ...(variant ? { variant } : {}) })

// ── [1] the variant switch — the SAME data as a donut (default) vs. a solid pie ───────────────────────────
const donut = pieChart(REVENUE_BY_REGION, 'Revenue by region')
const pie = pieChart(REVENUE_BY_REGION, 'Revenue by region', 'pie')
const variants = el('div', { class: 'demo-grid' }, [
  captioned('variant="donut" (default) — leaves a center for the whole’s caption', donut),
  captioned('variant="pie" — a solid disc, no hole', pie),
])
const variantNote = el('p', {}, [
  text('Every slice prints its '), strong('percent'), text(' in the key list — the same '),
  strong('order + label + percent'), text(' identity carries the ring and the list together; fill steps ' +
    'down a single lightness ramp ('), code('--ui-pie-chart-slice-1-ink'), text(' … '),
  code('-6-ink'), text('), never hue alone.'),
])

// ── [2] the donut center — a SIBLING composition in the consumer's OWN layout (ADR-0219 cl.6) ─────────────
const centerDonut = pieChart(BUDGET_ALLOCATION, 'Budget allocation')
applyDemoWidth(centerDonut, '100%')
const centerWrap = el('div', {
  style: 'display:grid; grid-template-columns: 8em 1fr; align-items:center;',
}, [
  el('div', { style: 'grid-column:1; grid-row:1; display:grid; place-items:center; pointer-events:none;' }, [
    el('div', { style: 'display:flex; flex-direction:column; align-items:center; line-height:1.1;' }, [
      el('strong', { style: 'font-size:1.1em;' }, [text('83%')]),
      el('span', { style: 'font-size:0.7em; opacity:0.7;' }, [text('allocated')]),
    ]),
  ]),
  centerDonut,
])
const centerNote = el('p', {}, [
  text('This control paints '), strong('nothing'), text(' in the hole and accepts no children (SPEC §5.2: ' +
    'no children) — the caption above is a plain sibling `<div>` sharing the SAME grid cell via the ' +
    'consumer’s own CSS, not a slot this control renders into.'),
])

// ── [3] degenerate data — every case still paints the ring and still announces ────────────────────────────
const degenerate = el('div', { class: 'demo-grid' }, [
  captioned('data="[]" — an empty track ring, no key rows', pieChart([], 'Empty dataset')),
  captioned('one datum — a full ring at 100%', pieChart([{ label: 'Solo', value: 7 }], 'Single slice')),
  captioned('all-zero values — an empty track ring (not zero-length rows)', pieChart([{ label: 'a', value: 0 }, { label: 'b', value: 0 }], 'All zero')),
  captioned('a negative value is dropped, not clamped', el('ui-pie-chart', { data: '[{"label":"ok","value":10},{"label":"neg","value":-5}]', label: 'Hardened input' })),
])

// ── [4] a live rewrite — real prop writes; the ring + key list re-derive on every write ───────────────────
const live = pieChart(REVENUE_BY_REGION, 'Revenue by region, live')
applyDemoWidth(live, '28rem')
let current = REVENUE_BY_REGION.map((d) => ({ ...d }))
const readout = code(`${current.length} slices · total ${current.reduce((s, d) => s + d.value, 0)}`)
const write = (next: readonly { label: string; value: number }[]): void => {
  current = next.map((d) => ({ ...d }))
  ;(live as HTMLElement & { data: readonly { label: string; value: number }[] }).data = current // a real prop write — whole re-render
  readout.textContent = `${current.length} slices · total ${current.reduce((s, d) => s + d.value, 0)}`
}
const reshuffle = uiButton('Reshuffle shares')
reshuffle.addEventListener('click', () => {
  const shares = current.map(() => Math.max(1, Math.round(Math.random() * 40)))
  write(current.map((d, i) => ({ label: d.label, value: shares[i] })))
})
const addRegion = uiButton('Add a region')
addRegion.addEventListener('click', () => write([...current, { label: `Region ${current.length + 1}`, value: Math.round(Math.random() * 20) + 1 }]))
const reset = uiButton('Reset', 'ghost')
reset.addEventListener('click', () => write(REVENUE_BY_REGION))
const liveBlock = el('div', { style: 'display:flex; flex-direction:column; gap:0.75rem; align-items:flex-start;' }, [
  live,
  el('div', { style: 'display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;' }, [reshuffle, addRegion, reset, readout]),
])
const liveNote = el('p', {}, [
  text('Every click writes '), code('data'), text(' with a new array; the whole mark rebuilds (A2UI '),
  code('updateDataModel'), text(' semantics) — watch the ring angles and every printed percent shift together.'),
])

content.append(
  exampleSection('donut vs. pie', variants, variantNote),
  exampleSection('The donut center (a sibling composition)', centerWrap, centerNote),
  exampleSection('Degenerate data', degenerate),
  exampleSection('Live data rewrite', liveBlock, liveNote),
)
