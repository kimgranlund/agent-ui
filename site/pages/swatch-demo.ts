// site/pages/swatch-demo.ts — the ui-swatch demo (the ratified `demo` tier; pairs with swatch-doc.ts, the API
// page). A realistic design-token PALETTE REVIEW: the brand key colors as they resolve live from tokens.css,
// the semantic role row, contrast pairs (a surface beside the text role that sits on it), a candidate-vs-
// current brand comparison mixing literal hex with `--var` lanes, and a MODEL-DRIVEN scheme flip — an
// external button re-pins `scheme` on a live row, the shape an agent's bind would drive. ui-swatch is
// display-only (no events, SPEC-R1); the review log below records the driven writes so the page still proves
// the prop round-trips. The control owns the color resolution (swatch.ts); this page only stages + logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { captioned, el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-swatch — demo',
  intro:
    'A palette review, live. Every box below is a real ui-swatch resolving its color in the browser — the ' +
    'brand key colors, the semantic roles, contrast pairs, and a candidate-vs-current brand comparison ' +
    'mixing literal hex with --var lanes. The scheme buttons re-pin a whole row (the model-driven path); the ' +
    'review log records each write. The API table is on the ui-swatch API page.',
})

const text = (s: string): Text => document.createTextNode(s)

/** swatch — one live `<ui-swatch>` (the real control, never mocked). */
function swatch(color: string, label: string, scheme?: 'light' | 'dark'): HTMLElement {
  const attrs: Record<string, string> = { color, label }
  if (scheme) attrs.scheme = scheme
  return el('ui-swatch', attrs)
}

/** row — a wrapping flex row of swatches (page demo chrome, not a ui-* control). */
function row(...nodes: readonly Node[]): HTMLElement {
  return el('div', { style: 'display:flex; flex-wrap:wrap; gap:1rem; align-items:flex-start;' }, nodes)
}

// ── 1. Brand key colors — the token names a designer reads off the sheet ──────────────────────────────────────
const brand = row(
  swatch('--md-sys-color-primary', 'primary'),
  swatch('--md-sys-color-primary-container', 'primary-container'),
  swatch('--md-sys-color-secondary', 'secondary'),
  swatch('--md-sys-color-secondary-container', 'secondary-container'),
  swatch('--md-sys-color-accent-500', 'accent-500'),
  swatch('--md-sys-color-neutral-500', 'neutral-500'),
)

// ── 2. Semantic roles — the four status families at their key step ───────────────────────────────────────────
const semantic = row(
  swatch('--md-sys-color-success-500', 'success-500'),
  swatch('--md-sys-color-warning-500', 'warning-500'),
  swatch('--md-sys-color-danger-500', 'danger-500'),
  swatch('--md-sys-color-info-500', 'info-500'),
)

// ── 3. Contrast pairs — a surface beside the text role that must read on it ──────────────────────────────────
function pair(caption: string, surface: string, onSurface: string): HTMLElement {
  return captioned(
    caption,
    row(swatch(surface, surface.replace('--md-sys-color-', '')), swatch(onSurface, onSurface.replace('--md-sys-color-', ''))),
  )
}
const pairs = row(
  pair('primary / on-primary', '--md-sys-color-primary', '--md-sys-color-primary-on-primary'),
  pair('primary-surface / on-surface', '--md-sys-color-primary-surface', '--md-sys-color-primary-on-surface'),
  pair('secondary / on-secondary', '--md-sys-color-secondary', '--md-sys-color-secondary-on-secondary'),
)

// ── 4. Candidate vs current — a brand-refresh proposal in literal hex beside the shipped --var token ─────────
const candidates = row(
  captioned('current: --md-sys-color-primary', swatch('--md-sys-color-primary', 'primary (current)')),
  captioned('candidate A: #1E5AA8', swatch('#1E5AA8', 'primary (candidate A)')),
  captioned('candidate B: oklch(52% 0.17 255)', swatch('oklch(52% 0.17 255)', 'primary (candidate B)')),
  captioned('typo — invalid, renders honest', swatch('#1E5AA', 'primary (typo)')),
)

// ── 5. Model-driven scheme pin + the review log ─────────────────────────────────────────────────────────────
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

const pinnedTokens = ['--md-sys-color-primary', '--md-sys-color-primary-container', '--md-sys-color-primary-surface', '--md-sys-color-primary-on-surface']
const pinnedRow = row(...pinnedTokens.map((t) => swatch(t, t.replace('--md-sys-color-', ''))))
const pinnedSwatches = [...pinnedRow.querySelectorAll('ui-swatch')]

function pinScheme(scheme: 'auto' | 'light' | 'dark'): void {
  for (const s of pinnedSwatches) {
    if (scheme === 'auto') s.removeAttribute('scheme')
    else s.setAttribute('scheme', scheme)
  }
  logLine(`scheme=${scheme}  →  ${pinnedSwatches.length} swatches re-pinned`)
}
const pinAuto = uiButton('scheme=auto', 'soft')
const pinLight = uiButton('scheme=light', 'soft')
const pinDark = uiButton('scheme=dark', 'soft')
pinAuto.addEventListener('click', () => pinScheme('auto'))
pinLight.addEventListener('click', () => pinScheme('light'))
pinDark.addEventListener('click', () => pinScheme('dark'))
const pinControls = row(pinAuto, pinLight, pinDark)

const pinNote = el('p', {}, [
  text('The same four tokens; the buttons rewrite '),
  el('code', {}, [text('scheme')]),
  text(' on every swatch in the row so the review can compare a role under both schemes without flipping the whole page. '),
  text('ui-swatch emits no events — the log records the driven writes.'),
])

content.append(
  exampleSection('Brand key colors', brand),
  exampleSection('Semantic roles', semantic),
  exampleSection('Contrast pairs', pairs),
  exampleSection('Candidate vs current', candidates),
  exampleSection('Scheme pin (model-driven)', pinControls, pinnedRow, pinNote),
  exampleSection('Review log', log),
)
