// site/pages/ramp-demo.ts — the ui-ramp demo (the ratified `demo` tier; pairs with ramp-doc.ts, the API page).
// A realistic BRAND-RAMP palette review: the primary family's full 050→950 tonal ramp as shipped in tokens.css,
// the four semantic families stacked for side-by-side comparison, a light/dark pinned pair of the same series,
// a candidate ramp authored in literal OKLCH (the "does our proposal read as one family?" check), and a
// MODEL-DRIVEN family switcher — buttons rewrite `steps` on one live strip, the shape an agent's bind would
// drive. ui-ramp is display-only (no events, SPEC-R5); the review log records the driven writes. The control
// owns cell rendering + color resolution (ramp.ts); this page only stages + logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { captioned, el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-ramp — demo',
  intro:
    'A brand-ramp review, live. Each strip is a real ui-ramp over tokens.css: the primary family end to end, ' +
    'the semantic families stacked for comparison, the same series pinned light and dark, and a candidate ' +
    'ramp in literal OKLCH. The family buttons rewrite steps on one live strip (the model-driven path); the ' +
    'review log records each write. The API table is on the ui-ramp API page.',
})

interface Step {
  readonly label: string
  readonly value: string
}

const text = (s: string): Text => document.createTextNode(s)

// The shipped tonal steps every family in tokens.css carries (050 … 950 — the coarse 100-step spine plus the
// 050 head and 950 tail; the finer 025-grain in-betweens are omitted so the strip reads at a glance).
const TONES = ['050', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const
type Family = 'primary' | 'secondary' | 'accent' | 'neutral' | 'success' | 'warning' | 'danger' | 'info'
function family(name: Family): readonly Step[] {
  return TONES.map((t) => ({ label: t, value: `--md-sys-color-${name}-${t}` }))
}

/** ramp — one live `<ui-ramp>` (the real control, never mocked); `steps` is the JSON-string attribute form. */
function ramp(steps: readonly Step[], label: string, scheme?: 'light' | 'dark'): HTMLElement {
  const attrs: Record<string, string> = { steps: JSON.stringify(steps), label }
  if (scheme) attrs.scheme = scheme
  return el('ui-ramp', attrs)
}

/** stack — a vertical column of captioned strips (page demo chrome, not a ui-* control). */
function stack(...nodes: readonly Node[]): HTMLElement {
  return el('div', { style: 'display:flex; flex-direction:column; gap:1rem;' }, nodes)
}

// ── 1. The brand ramp — primary, end to end ──────────────────────────────────────────────────────────────────
const brandRamp = ramp(family('primary'), 'Primary tonal ramp')

// ── 2. Semantic families — stacked so the eye can compare steps across families ──────────────────────────────
const semantic = stack(
  captioned('success', ramp(family('success'), 'Success tonal ramp')),
  captioned('warning', ramp(family('warning'), 'Warning tonal ramp')),
  captioned('danger', ramp(family('danger'), 'Danger tonal ramp')),
  captioned('info', ramp(family('info'), 'Info tonal ramp')),
)

// ── 3. Scheme pin — the SAME series resolved under light and under dark ─────────────────────────────────────
const schemePair = stack(
  captioned('scheme="light"', ramp(family('secondary'), 'Secondary tonal ramp (light)', 'light')),
  captioned('scheme="dark"', ramp(family('secondary'), 'Secondary tonal ramp (dark)', 'dark')),
)

// ── 4. A candidate ramp — literal OKLCH, the proposal a designer pastes in for review ────────────────────────
const CANDIDATE: readonly Step[] = [
  { label: '100', value: 'oklch(95% 0.03 255)' },
  { label: '300', value: 'oklch(82% 0.09 255)' },
  { label: '500', value: 'oklch(62% 0.16 255)' },
  { label: '700', value: 'oklch(45% 0.14 255)' },
  { label: '900', value: 'oklch(28% 0.08 255)' },
]
const candidate = stack(
  captioned('candidate brand blue — oklch(L C 255)', ramp(CANDIDATE, 'Candidate brand ramp')),
  captioned('current — --md-sys-color-primary-{100…900}', ramp(family('primary').filter((s) => ['100', '300', '500', '700', '900'].includes(s.label)), 'Current primary ramp')),
)

// ── 5. Model-driven family switcher + the review log ────────────────────────────────────────────────────────
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

const liveRamp = ramp(family('primary'), 'Live family ramp')
function pick(name: Family): void {
  const steps = family(name)
  liveRamp.setAttribute('steps', JSON.stringify(steps))
  liveRamp.setAttribute('label', `${name} tonal ramp`)
  logLine(`steps ← ${name}  (${steps.length} steps)`)
}
const FAMILIES: readonly Family[] = ['primary', 'secondary', 'accent', 'neutral']
const switcher = el('div', { style: 'display:flex; flex-wrap:wrap; gap:0.5rem;' }, FAMILIES.map((name) => {
  const b = uiButton(name, 'soft')
  b.addEventListener('click', () => pick(name))
  return b
}))

const switcherNote = el('p', {}, [
  text('One strip; the buttons rewrite '),
  el('code', {}, [text('steps')]),
  text(' (the JSON-string attribute form) and '),
  el('code', {}, [text('label')]),
  text('. ui-ramp emits no events — the log records the driven writes.'),
])

content.append(
  exampleSection('The brand ramp', brandRamp),
  exampleSection('Semantic families', semantic),
  exampleSection('Scheme pin', schemePair),
  exampleSection('Candidate vs current', candidate),
  exampleSection('Family switcher (model-driven)', switcher, liveRamp, switcherNote),
  exampleSection('Review log', log),
)
