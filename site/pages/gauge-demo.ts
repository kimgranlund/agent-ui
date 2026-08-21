// site/pages/gauge-demo.ts — the ui-gauge demo (the Display-class multi-ring radial gauge, ADR-0229
// cl.4; pairs with gauge-doc.ts, the descriptor-derived API page). Mounts the REAL control over a
// realistic system-load dataset (CPU/Memory/Disk — the GH #1561 board shape): the outer→inner ring
// order, the two-layer inset composition in a zero-padding container, clamped out-of-range values, the
// degenerate cases, and a live rewrite driven by real ui-buttons — never a mock. A display leaf emits
// nothing; the honesty proof is the mounted control's own rings/legend re-deriving under real `data`
// writes.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.demo-figure/.demo-grid + section spacing)
import { applyDemoWidth, captioned, el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-gauge — demo',
  intro:
    'The multi-ring radial gauge, live: a realistic system-load (CPU/Memory/Disk) dataset, the ' +
    'outer→inner ring order, a zero-padding full-bleed composition, out-of-range values clamped rather ' +
    'than dropped, the degenerate cases, and a live data rewrite. The API table is on the ui-gauge API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

interface Datum {
  label: string
  value: number
}

// ── a realistic dataset (hand-authored — the GH #1561 board's own CPU/MEMORY/DISK shape) ──────────────
const SYSTEM_LOAD: Datum[] = [
  { label: 'CPU', value: 72 },
  { label: 'Memory', value: 54 },
  { label: 'Disk', value: 31 },
]

const gauge = (data: readonly Datum[], label: string): HTMLElement =>
  el('ui-gauge', { data: JSON.stringify(data), label })

// ── [1] the outer→inner ring order — ADR-0229 cl.4 ──────────────────────────────────────────────────────
const load = gauge(SYSTEM_LOAD, 'System load')
const orderNote = el('p', {}, [
  text('Rings render in '), strong('data order'), text(', outer to inner: '), code('CPU'), text(' is the ' +
    'outermost, largest-radius ring; each subsequent metric steps inward. Each ring is an '),
  strong('independent'), text(' 0-100 value — they never sum, unlike '), code('ui-pie-chart'), text('.'),
])

// ── [2] a zero-padding full-bleed composition — Kim's contract, realized ────────────────────────────────
const bleed = gauge(SYSTEM_LOAD, 'System load')
applyDemoWidth(bleed, '100%')
bleed.style.setProperty('--ui-gauge-min-block-size', '11em')
const bleedCard = el('div', {
  style: 'border-radius: var(--md-sys-shape-corner-base); overflow: hidden; background: var(--md-sys-color-neutral-container-low, var(--md-sys-color-neutral-container));',
}, [bleed])
const bleedNote = el('p', {}, [
  text('Dropped into a zero-padding card with NO consumer CSS — the rings layer bleeds edge-to-edge; the ' +
    'legend column floats '), strong('inside'), text(' the box via the ONE chrome-inset knob, never ' +
    'shrinking the rings. This is Kim\'s zero-padding-container contract (ADR-0228 cl.3), generalized to ' +
    'a radial mark.'),
])

// ── [3] out-of-range values clamp, never drop (ADR-0229 cl.4) ────────────────────────────────────────────
const clamped = gauge(
  [
    { label: 'Over-quota', value: 140 },
    { label: 'Under-run', value: -20 },
    { label: 'Normal', value: 65 },
  ],
  'Clamped readings',
)
const clampedNote = el('p', {}, [
  text('A value over 100 or below 0 is still '), strong('kept'), text(' and its ring clamps to '),
  code('100%'), text('/'), code('0%'), text(' — never dropped (a documented divergence from '),
  code('ui-pie-chart'), text(', whose part-of-whole math drops a negative share as meaningless).'),
])

// ── [4] degenerate data — every case still paints and still announces ────────────────────────────────────
const degenerate = el('div', { class: 'demo-grid' }, [
  captioned('data="[]" — an empty host, role=list with 0 items', gauge([], 'Empty dataset')),
  captioned('one ring → one row', gauge([{ label: 'Solo', value: 88 }], 'Single metric')),
  captioned('a missing/empty label drops that entry', gauge([{ label: '', value: 50 }, { label: 'ok', value: 20 }], 'Hardened input')),
])

// ── [5] a live rewrite — real prop writes; rings/legend re-derive on every write ────────────────────────
const live = gauge(SYSTEM_LOAD, 'System load, live')
applyDemoWidth(live, '24rem')
let current = SYSTEM_LOAD.map((d) => ({ ...d }))
const readout = code(`${current.length} metrics · avg ${Math.round(current.reduce((s, d) => s + d.value, 0) / current.length)}%`)
const write = (next: Datum[]): void => {
  current = next
  ;(live as HTMLElement & { data: Datum[] }).data = current // a real prop write — whole re-render
  readout.textContent = `${current.length} metrics · avg ${Math.round(current.reduce((s, d) => s + d.value, 0) / current.length)}%`
}
const reshuffle = uiButton('Reshuffle values')
reshuffle.addEventListener('click', () => {
  write(current.map((d) => ({ label: d.label, value: Math.round(Math.random() * 100) })))
})
const addMetric = uiButton('Add a metric')
addMetric.addEventListener('click', () => {
  const names = ['Network', 'GPU', 'Swap', 'Temp']
  const next = names[(current.length - 3) % names.length] ?? `Metric ${current.length + 1}`
  write([...current, { label: next, value: Math.round(Math.random() * 100) }])
})
const reset = uiButton('Reset', 'ghost')
reset.addEventListener('click', () => write(SYSTEM_LOAD.map((d) => ({ ...d }))))
const liveBlock = el('div', { style: 'display:flex; flex-direction:column; gap:0.75rem; align-items:flex-start;' }, [
  live,
  el('div', { style: 'display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;' }, [reshuffle, addMetric, reset, readout]),
])
const liveNote = el('p', {}, [
  text('Every click writes '), code('data'), text(' with a new array; the whole mark rebuilds (A2UI '),
  code('updateDataModel'), text(' semantics) — watch the rings and legend rows re-derive together.'),
])

content.append(
  exampleSection('Outer→inner ring order', load, orderNote),
  exampleSection('A zero-padding full-bleed composition', bleedCard, bleedNote),
  exampleSection('Out-of-range values clamp, never drop', clamped, clampedNote),
  exampleSection('Degenerate data', degenerate),
  exampleSection('Live data rewrite', liveBlock, liveNote),
)
