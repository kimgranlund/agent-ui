// site/pages/ladder-demo.ts — the ui-ladder demo (the ratified `demo` tier; pairs with ladder-doc.ts, the API
// page). A realistic DIMENSIONAL-TOKEN review: the spacing scale as it ships in dimensions.css (`--var` tiers,
// resolved live by the browser — a ladder never does the math), the control-height and icon ladders side by
// side, a candidate spacing scale in literal px beside the current one, and a MODEL-DRIVEN density switch —
// buttons rewrite `tiers` on one live ladder (comfortable vs compact), the shape an agent's bind would drive.
// ui-ladder is display-only (no events, SPEC-R9); the review log records the driven writes. The control owns
// the literal-length bar rendering (ladder.ts); this page only stages + logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { captioned, el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-ladder — demo',
  intro:
    'A dimensional-token review, live. Each list is a real ui-ladder: the spacing scale straight from ' +
    'dimensions.css as --var tiers, the control-height and icon ladders, and a candidate spacing scale in ' +
    'literal px beside the current one. The density buttons rewrite tiers on one live ladder (the ' +
    'model-driven path); the review log records each write. The API table is on the ui-ladder API page.',
})

interface Tier {
  readonly label: string
  readonly value: string
}

const text = (s: string): Text => document.createTextNode(s)

/** ladder — one live `<ui-ladder>` (the real control, never mocked); `tiers` is the JSON-string attribute form. */
function ladder(tiers: readonly Tier[], label: string): HTMLElement {
  return el('ui-ladder', { tiers: JSON.stringify(tiers), label })
}

/** grid — a responsive two-up of captioned ladders (page demo chrome, not a ui-* control). */
function grid(...nodes: readonly Node[]): HTMLElement {
  return el('div', { style: 'display:grid; grid-template-columns:repeat(auto-fit, minmax(16rem, 1fr)); gap:1.5rem;' }, nodes)
}

// ── 1. The spacing scale — the shipped tokens, resolved by the browser ───────────────────────────────────────
const SPACE: readonly Tier[] = [
  { label: 'space-xs', value: '--md-sys-space-xs' },
  { label: 'space-sm', value: '--md-sys-space-sm' },
  { label: 'space-md', value: '--md-sys-space-md' },
  { label: 'space-lg', value: '--md-sys-space-lg' },
  { label: 'space-xl', value: '--md-sys-space-xl' },
]
const spacing = ladder(SPACE, 'Spacing scale')

// ── 2. Control heights + icon sizes — the two ladders a control's geometry row is read from ──────────────────
const HEIGHTS: readonly Tier[] = [
  { label: 'height-sm', value: '--md-sys-height-sm' },
  { label: 'height-md', value: '--md-sys-height-md' },
  { label: 'height-lg', value: '--md-sys-height-lg' },
]
const ICONS: readonly Tier[] = [
  { label: 'icon-sm', value: '--md-sys-icon-sm' },
  { label: 'icon-md', value: '--md-sys-icon-md' },
  { label: 'icon-lg', value: '--md-sys-icon-lg' },
]
const geometry = grid(
  captioned('--md-sys-height-{sm,md,lg}', ladder(HEIGHTS, 'Control heights')),
  captioned('--md-sys-icon-{sm,md,lg}', ladder(ICONS, 'Icon sizes')),
)

// ── 3. Candidate vs current — a proposed 4-pt spacing scale in literal px beside the shipped tokens ─────────
const CANDIDATE: readonly Tier[] = [
  { label: '1', value: '4px' },
  { label: '2', value: '8px' },
  { label: '3', value: '12px' },
  { label: '4', value: '16px' },
  { label: '6', value: '24px' },
  { label: '8', value: '32px' },
  { label: '12', value: '48px' },
]
const candidate = grid(
  captioned('candidate — a 4-pt scale, literal px', ladder(CANDIDATE, 'Candidate spacing scale')),
  captioned('current — --md-sys-space-*', ladder(SPACE, 'Current spacing scale')),
)

// ── 4. Model-driven density switch + the review log ─────────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logLine(message: string): void {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${message}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

const COMFORTABLE: readonly Tier[] = [
  { label: 'row', value: '48px' },
  { label: 'inset', value: '16px' },
  { label: 'gap', value: '12px' },
]
const COMPACT: readonly Tier[] = [
  { label: 'row', value: '32px' },
  { label: 'inset', value: '8px' },
  { label: 'gap', value: '6px' },
]
const liveLadder = ladder(COMFORTABLE, 'List density (comfortable)')
function setDensity(name: 'comfortable' | 'compact'): void {
  const tiers = name === 'compact' ? COMPACT : COMFORTABLE
  liveLadder.setAttribute('tiers', JSON.stringify(tiers))
  liveLadder.setAttribute('label', `List density (${name})`)
  logLine(`tiers ← ${name}  (${tiers.map((t) => `${t.label}=${t.value}`).join(', ')})`)
}
const comfortable = uiButton('comfortable', 'soft')
const compact = uiButton('compact', 'soft')
comfortable.addEventListener('click', () => setDensity('comfortable'))
compact.addEventListener('click', () => setDensity('compact'))
const switcher = el('div', { style: 'display:flex; flex-wrap:wrap; gap:0.5rem;' }, [comfortable, compact])

const switcherNote = el('p', {}, [
  text('One ladder; the buttons rewrite '),
  el('code', {}, [text('tiers')]),
  text(' (the JSON-string attribute form) and '),
  el('code', {}, [text('label')]),
  text('. Bars are literal lengths — no cross-tier normalization — so a compact set is visibly shorter, not rescaled. ui-ladder emits no events; the log records the driven writes.'),
])

content.append(
  exampleSection('The spacing scale', spacing),
  exampleSection('Control heights and icon sizes', geometry),
  exampleSection('Candidate vs current', candidate),
  exampleSection('Density switch (model-driven)', switcher, liveLadder, switcherNote),
  exampleSection('Review log', log),
)
