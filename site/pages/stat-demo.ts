// site/pages/stat-demo.ts — the ui-stat demo (the Display-class metric tile, ADR-0111; pairs with stat-doc.ts,
// the descriptor-derived API page). Mounts the REAL control as a dashboard KPI header over realistic figures —
// the delta's three directions (up/down/flat — direction, never valence), string vs number figures, captions,
// the ring variant (GH #1208), the stat + sparkline composition (pure composition, ADR-0111 fork F2), and a live
// period switcher (a real ui-segmented-control whose `change` commit rewrites figure/delta/caption) — never a
// mock. A display leaf emits nothing; the switcher's change log is the honesty proof of real prop writes.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log/.demo-figure/.demo-grid + section spacing)
import { applyDemoWidth, captioned, el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-stat — demo',
  intro:
    'The metric tile, live: a dashboard KPI header with up/down/flat deltas, string and number figures, ' +
    'captions, the ring variant, a stat + sparkline composition, and a period switcher rewriting figure and ' +
    'delta. The API table is on the ui-stat API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

interface StatSpec {
  readonly label: string
  readonly figure: string | number
  readonly delta?: number
  readonly caption?: string
  readonly variant?: 'tile' | 'ring'
  readonly percent?: number
}
const stat = (spec: StatSpec): HTMLElement => {
  const attrs: Record<string, string> = { label: spec.label, figure: String(spec.figure) }
  if (spec.delta !== undefined) attrs.delta = String(spec.delta)
  if (spec.caption) attrs.caption = spec.caption
  if (spec.variant) attrs.variant = spec.variant
  if (spec.percent !== undefined) attrs.percent = String(spec.percent)
  return el('ui-stat', attrs)
}
const row = (...tiles: readonly HTMLElement[]): HTMLElement =>
  el('div', { style: 'display:flex; gap:1.25rem; flex-wrap:wrap; align-items:flex-start;' }, tiles)

// ── [1] the KPI header — the canonical dashboard job (hand-authored, a believable SaaS month) ────────────────
const header = row(
  stat({ label: 'MRR', figure: '$55.7k', delta: 3.3, caption: 'vs last month, %' }),
  stat({ label: 'Active accounts', figure: 1284, delta: 46, caption: 'net new this month' }),
  stat({ label: 'Churn', figure: '2.1%', delta: -0.4, caption: 'vs last month, pts' }),
  stat({ label: 'Uptime, 30 d', figure: '99.98%', delta: 0, caption: 'unchanged' }),
)
const headerNote = el('p', {}, [
  text('Four real tiles in a page-authored flex row. A finite numeric '), code('figure'), text(' formats through '),
  code('Intl.NumberFormat'), text(' (1284 → 1,284); a string passes through verbatim ($55.7k, 2.1%). The delta renders a ' +
    'direction glyph plus the signed number as real text — and '), strong('direction is not valence'), text(': churn ' +
    'falling is good news, yet up/down/flat share one ink; the announced reading is "up +3.3", "down -0.4", "0".'),
])

// ── [2] the delta's three directions + the optional regions ────────────────────────────────────────────────
const deltas = el('div', { class: 'demo-grid' }, [
  captioned('delta="12" — up (▲ + "+12")', stat({ label: 'Sign-ups today', figure: 48, delta: 12, caption: 'vs yesterday' })),
  captioned('delta="-3" — down (▼ + "-3")', stat({ label: 'Open incidents', figure: 2, delta: -3, caption: 'vs last week' })),
  captioned('delta="0" — flat (no glyph, "0")', stat({ label: 'Regions', figure: 5, delta: 0 })),
  captioned('no delta, no caption — label + figure only', stat({ label: 'p95 latency', figure: '219 ms' })),
  captioned('figure = NaN (a non-finite NUMBER property) — the "—" placeholder', nanStat()),
])
// A non-finite NUMBER renders the `—` placeholder; note an attribute string "NaN" would pass through VERBATIM
// (the codec only upgrades a string that parses to a FINITE number), so this case needs a real property write.
function nanStat(): HTMLElement {
  const tile = stat({ label: 'Forecast', figure: '', caption: 'model not yet run' })
  ;(tile as HTMLElement & { figure: string | number }).figure = Number.NaN
  return tile
}

// ── [3] the ring variant (GH #1208) — percent drives the donut, figure/caption print the meaning ─────────────
const rings = el('div', { class: 'demo-grid' }, [
  captioned('variant="ring" percent="72"', stat({ label: 'Storage used', figure: '72%', variant: 'ring', percent: 72, caption: '3.6 of 5 TB' })),
  captioned('variant="ring" percent="94"', stat({ label: 'Seats assigned', figure: '47 / 50', variant: 'ring', percent: 94 })),
  captioned('variant="ring" percent="18"', stat({ label: 'Rollout', figure: '18%', variant: 'ring', percent: 18, caption: 'canary cohort' })),
  captioned('variant="ring", no percent — an empty (0%) track', stat({ label: 'Migration', figure: 'pending', variant: 'ring' })),
])
const ringNote = el('p', {}, [
  text('Two decoupled props: '), code('variant="ring"'), text(' swaps the layout to a centered CSS conic-gradient donut, and '),
  code('percent'), text(' (0–100, clamped) fills it — the ring is decorative ('), code('aria-hidden'),
  text('); the printed figure/caption already state the percent as real text. The component never derives one from the other.'),
])

// ── [4] the stat + sparkline composition — pure composition in a row, never a slot (ADR-0111 fork F2) ────────
const MRR_12M = [41200, 42800, 43100, 44900, 46200, 45800, 47600, 49100, 50400, 52300, 53900, 55700]
const trendSpark = el('ui-sparkline', { values: JSON.stringify(MRR_12M), label: 'MRR trend, 12 months', variant: 'area' })
applyDemoWidth(trendSpark, '12rem')
trendSpark.style.setProperty('--ui-sparkline-block-size', '3rem')
const composition = el('div', { class: 'demo-figure', style: 'flex-direction:row; align-items:center; gap:1.5rem; inline-size:max-content;' }, [
  stat({ label: 'MRR', figure: '$55.7k', delta: 3.3, caption: 'vs last month, %' }),
  trendSpark,
])
const compositionNote = el('p', {}, [
  code('ui-stat'), text(' takes no children and has no slot — the "trend" idiom is a stat beside a '), code('ui-sparkline'),
  text(' in a page-authored row (here inside a demo figure). A stat without a sparkline is a complete tile.'),
])

// ── [5] a live period switcher — real prop writes on the mounted tiles ──────────────────────────────────────
interface Period { readonly mrr: string; readonly mrrDelta: number; readonly accounts: number; readonly accountsDelta: number; readonly caption: string }
const PERIODS: Readonly<Record<string, Period>> = {
  '7d': { mrr: '$55.7k', mrrDelta: 0.8, accounts: 1284, accountsDelta: 11, caption: 'vs previous 7 days' },
  '30d': { mrr: '$55.7k', mrrDelta: 3.3, accounts: 1284, accountsDelta: 46, caption: 'vs previous 30 days' },
  '12m': { mrr: '$55.7k', mrrDelta: 35.2, accounts: 1284, accountsDelta: 517, caption: 'vs 12 months ago' },
}
const liveMrr = stat({ label: 'MRR', figure: PERIODS['30d'].mrr, delta: PERIODS['30d'].mrrDelta, caption: PERIODS['30d'].caption })
const liveAccounts = stat({ label: 'Active accounts', figure: PERIODS['30d'].accounts, delta: PERIODS['30d'].accountsDelta, caption: PERIODS['30d'].caption })
const switcher = el('ui-segmented-control', { name: 'period' }, [
  el('ui-segment', { value: '7d' }, [text('7 days')]),
  el('ui-segment', { value: '30d', checked: '' }, [text('30 days')]),
  el('ui-segment', { value: '12m' }, [text('12 months')]),
])
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
type Writable = HTMLElement & { figure: string | number; delta: number | null; caption: string }
switcher.addEventListener('change', () => {
  const key = String((switcher as HTMLElement & { value: string | null }).value ?? '')
  const period = PERIODS[key]
  if (!period) return
  const mrr = liveMrr as Writable
  mrr.delta = period.mrrDelta
  mrr.caption = period.caption
  const accounts = liveAccounts as Writable
  accounts.delta = period.accountsDelta
  accounts.caption = period.caption
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  change  period=${JSON.stringify(key)}  → delta/caption rewritten on 2 tiles`
  log.append(line)
  log.scrollTop = log.scrollHeight
})
const liveBlock = el('div', { style: 'display:flex; flex-direction:column; gap:1rem; align-items:flex-start;' }, [
  switcher,
  row(liveMrr, liveAccounts),
])
const liveNote = el('p', {}, [
  text('Picking a period writes '), code('delta'), text(' and '), code('caption'), text(' on the two mounted tiles from the ' +
    'switcher’s '), code('change'), text(' commit; each tile rebuilds as a whole (a four-span tile has no interior state worth preserving).'),
])

content.append(
  exampleSection('KPI header', header, headerNote),
  exampleSection('Delta directions & optional regions', deltas),
  exampleSection('Ring variant', rings, ringNote),
  exampleSection('Stat + sparkline composition', composition, compositionNote),
  exampleSection('Live period switcher', liveBlock, liveNote),
  exampleSection('change event log (the period switcher)', log),
)
