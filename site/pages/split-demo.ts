// site/pages/split-demo.ts — the ui-split interaction demo (the layout-tier resizable split container, ADR-0120
// cl.2 / app-surfaces-m4.lld.md LLD-C1; pairs with split-doc.ts, the API page). Mounts the REAL control three
// ways and proves its contract honestly: (1) an UNCONTROLLED editor/preview split — drag the divider (1:1
// pointer tracking) or Tab to it and use the arrow keys, with a live `input`/`change` resize log showing the
// proposed ratio vector each event carries; (2) a CONTROLLED list/detail split — `sizes` is the source of
// truth, preset buttons write it, and the consumer echoes the emitted `change` detail back (the
// prop-as-source-of-truth loop, SPEC-R2 AC3); (3) a VERTICAL three-pane console. The control owns the
// redistribution, clamping, ARIA and keyboard mechanics (split.ts + traits/pane-resize.ts); this page only
// stages content and logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + .demo-box + section spacing)
import { el, exampleSection, uiButton } from '../lib/specimens.ts'
import type { UISplitElement } from '@agent-ui/components/components'

const { content } = mountPage({
  title: 'ui-split — demo',
  intro:
    'The multi-pane resizable split, live. Drag a divider (it tracks the pointer 1:1) or Tab to it and press ' +
    'ArrowLeft/ArrowRight, Home/End — every live step fires input, every commit fires change, each carrying the ' +
    'full proposed ratio vector. The controlled specimen shows sizes as the source of truth. The API table is on ' +
    'the ui-split API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])

// pane — a filled, scrollable content block (page content, NOT a ui-* control): a small header + a body.
function pane(title: string, body: HTMLElement): HTMLElement {
  return el('div', { style: 'display:flex; flex-direction:column; block-size:100%; min-inline-size:0;' }, [
    el(
      'div',
      { style: 'padding:0.4rem 0.75rem; font-size:0.75rem; font-weight:600; letter-spacing:0.02em; text-transform:uppercase; ' +
        'color: var(--md-sys-color-neutral-on-surface-variant); border-block-end:1px solid var(--md-sys-color-neutral-outline-variant);' },
      [text(title)],
    ),
    body,
  ])
}

const pct = (ratios: readonly number[]): string => ratios.map((r) => `${Math.round(r * 100)}%`).join(' / ')

// ── (1) editor / preview — uncontrolled, the resize log ──────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logResize(name: string, kind: 'input' | 'change', ratios: number[]): void {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${name.padEnd(9)}${kind.padEnd(7)} →  [${ratios.map((r) => r.toFixed(3)).join(', ')}]  (${pct(ratios)})`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

const MARKDOWN_SOURCE = [
  '# Release notes — 1.4.0',
  '',
  'The report, content and feed families ship.',
  '',
  '- `ui-table` gains sticky headers',
  '- `ui-toast-region` hosts the new toast stack',
  '- `ui-split` — this control — lands in M4',
  '',
  'Drag the divider to give the preview more room.',
].join('\n')

const editorBody = el(
  'pre',
  { style: 'margin:0; padding:0.75rem; flex:1; overflow:auto; font-family: var(--md-sys-typeface-mono); font-size:0.8rem; line-height:1.5; white-space:pre-wrap;' },
  [text(MARKDOWN_SOURCE)],
)
const previewBody = el('div', { style: 'padding:0.75rem; flex:1; overflow:auto; font-size:0.9rem; line-height:1.5;' }, [
  el('h3', { style: 'margin:0 0 0.5rem; font-size:1.05rem;' }, [text('Release notes — 1.4.0')]),
  el('p', { style: 'margin:0 0 0.5rem;' }, [text('The report, content and feed families ship.')]),
  el('ul', { style: 'margin:0 0 0.5rem; padding-inline-start:1.2rem;' }, [
    el('li', {}, [code('ui-table'), text(' gains sticky headers')]),
    el('li', {}, [code('ui-toast-region'), text(' hosts the new toast stack')]),
    el('li', {}, [code('ui-split'), text(' — this control — lands in M4')]),
  ]),
  el('p', { style: 'margin:0;' }, [text('Drag the divider to give the preview more room.')]),
])

const editorSplit = el('ui-split', { 'data-role': 'editor-split' }, [
  el('ui-split-pane', { min: '10rem', initial: '0.45' }, [pane('Editor · notes.md', editorBody)]),
  el('ui-split-pane', { min: '10rem' }, [pane('Preview', previewBody)]),
]) as UISplitElement
editorSplit.addEventListener('input', (e) => logResize('editor', 'input', (e as unknown as CustomEvent<number[]>).detail))
editorSplit.addEventListener('change', (e) => logResize('editor', 'change', (e as CustomEvent<number[]>).detail))

// A ui-split has no intrinsic size — an ancestor block gives the flex distribution real space to divide.
const editorFrame = el(
  'div',
  { style: 'block-size: 16rem; inline-size: 100%; border:1px solid var(--md-sys-color-neutral-outline-variant); border-radius:0.5rem; overflow:hidden;' },
  [editorSplit],
)

const editorNote = el('p', {}, [
  text('Uncontrolled: '), code('sizes'), text(' is unset, so the control keeps its own ratio vector — seeded here from the editor pane\'s '),
  code('initial="0.45"'), text(' — and mutates it on every resize. Both panes floor at '), code('min="10rem"'),
  text(', so the divider stops before either collapses. Keyboard: Tab to the divider ('), code('role="separator"'),
  text(', its '), code('aria-valuenow'), text(' is the leading pane\'s share of the pair), then '),
  strong('ArrowLeft / ArrowRight'), text(' step 5%, '), strong('Home / End'), text(' snap to the pair\'s bounds — a key press is both the live '),
  code('input'), text(' and the '), code('change'), text(' commit in one action.'),
])

// ── (2) list / detail — CONTROLLED sizes, preset buttons + echo-back ────────────────────────────────────────
const inbox = el('ul', { style: 'margin:0; padding:0.25rem 0; list-style:none; flex:1; overflow:auto; font-size:0.85rem;' }, [
  ...['Design review — Thursday', 'Invoice #4821 paid', 'Q3 roadmap draft', 'New comment on PR #1042', 'Onboarding checklist'].map((s, i) =>
    el('li', { style: `padding:0.4rem 0.75rem; ${i === 2 ? 'background: var(--md-sys-color-neutral-surface-high);' : ''}` }, [text(s)]),
  ),
])
const detail = el('div', { style: 'padding:0.75rem; flex:1; overflow:auto; font-size:0.9rem; line-height:1.5;' }, [
  el('h3', { style: 'margin:0 0 0.5rem; font-size:1.05rem;' }, [text('Q3 roadmap draft')]),
  el('p', { style: 'margin:0;' }, [text('Ana shared a draft of the Q3 roadmap. Three themes: the composition guides, the devtools harness, and the persistence tiers. Comments due Friday.')]),
])

const listDetail = el('ui-split', { 'data-role': 'controlled-split' }, [
  el('ui-split-pane', { min: '8rem' }, [pane('Inbox', inbox)]),
  el('ui-split-pane', { min: '12rem' }, [pane('Message', detail)]),
]) as UISplitElement
listDetail.sizes = [0.35, 0.65] // CONTROLLED from the first render — a JS property, never an attribute
const sizesReadout = el('span', { 'data-demo': 'sizes-readout', style: 'font-family: var(--md-sys-typeface-mono); font-size:0.85rem;' }, [text('sizes = [0.35, 0.65]')])
function writeSizes(next: number[]): void {
  listDetail.sizes = next
  sizesReadout.textContent = `sizes = [${next.map((r) => r.toFixed(2)).join(', ')}]`
}
// The consumer's echo: the control NEVER self-mutates `sizes` in controlled mode — it emits the proposed vector
// on `change` (drag end / key step) and this page writes it back, which is what moves the rendered layout.
listDetail.addEventListener('input', (e) => logResize('list', 'input', (e as unknown as CustomEvent<number[]>).detail))
listDetail.addEventListener('change', (e) => {
  const next = (e as CustomEvent<number[]>).detail
  logResize('list', 'change', next)
  writeSizes(next)
})

const presetNarrow = uiButton('Narrow list  [0.25, 0.75]', 'soft')
presetNarrow.addEventListener('click', () => writeSizes([0.25, 0.75]))
const presetEven = uiButton('Even  [0.5, 0.5]', 'soft')
presetEven.addEventListener('click', () => writeSizes([0.5, 0.5]))
const presetWide = uiButton('Wide list  [0.6, 0.4]', 'soft')
presetWide.addEventListener('click', () => writeSizes([0.6, 0.4]))

const presets = el('div', { style: 'display:flex; gap:0.75rem; flex-wrap:wrap; align-items:center; margin-block-end:0.75rem;' }, [
  presetNarrow, presetEven, presetWide, sizesReadout,
])
const listFrame = el(
  'div',
  { style: 'block-size: 14rem; inline-size: 100%; border:1px solid var(--md-sys-color-neutral-outline-variant); border-radius:0.5rem; overflow:hidden;' },
  [listDetail],
)
const controlledNote = el('p', {}, [
  text('Controlled: '), code('sizes'), text(' is the source of truth. The preset buttons write it and the layout follows; a drag or key step ' +
    'only '), strong('proposes'), text(' a vector on '), code('change'), text(' — the control never self-mutates '), code('sizes'),
  text(' — and this page echoes the detail back (the readout tracks it). Comment out the echo and the divider snaps back on release: ' +
    'that is the contract, not a bug.'),
])

// ── (3) a vertical three-pane console — axis="vertical", a collapsible pane ─────────────────────────────────
const consoleOut = el('pre', { style: 'margin:0; padding:0.6rem 0.75rem; flex:1; overflow:auto; font-family: var(--md-sys-typeface-mono); font-size:0.78rem; line-height:1.5;' }, [
  text(['$ npm run check', '> tsc --noEmit', '> vitest run site/lib', '✓ 212 passed', '$ █'].join('\n')),
])
const problems = el('ul', { style: 'margin:0; padding:0.4rem 0.75rem; list-style:none; flex:1; overflow:auto; font-size:0.82rem;' }, [
  el('li', {}, [text('⚠ src/report/pct.ts:3 — prefer Intl.NumberFormat')]),
  el('li', {}, [text('ℹ 0 errors, 1 warning')]),
])
const source = el('pre', { style: 'margin:0; padding:0.6rem 0.75rem; flex:1; overflow:auto; font-family: var(--md-sys-typeface-mono); font-size:0.78rem; line-height:1.5;' }, [
  text(['export function pct(r: number[]) {', "  return r.map((x) => `${Math.round(x * 100)}%`).join(' / ')", '}'].join('\n')),
])

const vertical = el('ui-split', { axis: 'vertical', 'data-role': 'vertical-split' }, [
  el('ui-split-pane', { min: '4rem', initial: '0.5' }, [pane('Source', source)]),
  el('ui-split-pane', { min: '3rem', collapsible: '' }, [pane('Problems (collapsible — Enter on its divider)', problems)]),
  el('ui-split-pane', { min: '4rem' }, [pane('Terminal', consoleOut)]),
]) as UISplitElement
vertical.addEventListener('change', (e) => logResize('vertical', 'change', (e as CustomEvent<number[]>).detail))
const verticalFrame = el(
  'div',
  { style: 'block-size: 20rem; inline-size: 100%; border:1px solid var(--md-sys-color-neutral-outline-variant); border-radius:0.5rem; overflow:hidden;' },
  [vertical],
)
const verticalNote = el('p', {}, [
  code('axis="vertical"'), text(' stacks the panes and flips the keys to '), strong('ArrowUp / ArrowDown'),
  text('. Resizing divider i redistributes extent between panes i and i+1 only — the third pane is never touched (two-neighbor local ' +
    'redistribution). The middle pane is '), code('collapsible'), text(': each divider leads with the pane above it, so Tab to the divider ' +
    'between Problems and Terminal and press '), strong('Enter'), text(' — Problems collapses to its min floor and Terminal takes the ' +
    'room; Enter again restores the remembered size.'),
])

content.append(
  exampleSection('Editor / preview — uncontrolled, drag or keyboard', editorFrame, editorNote),
  exampleSection('List / detail — controlled sizes', presets, listFrame, controlledNote),
  exampleSection('Vertical console — three panes, one collapsible', verticalFrame, verticalNote),
  exampleSection('input / change resize log', log),
)
