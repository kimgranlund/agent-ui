// site/pages/split-pane-demo.ts — the ui-split-pane interaction demo (the layout-tier pane child of ui-split,
// ADR-0120 cl.2 / app-surfaces-m4.lld.md LLD-C1; pairs with split-pane-doc.ts, the API page). A pane has no
// behaviour of its own — its four props are read by the OWNING ui-split — so this page proves each of them
// where it actually bites: `initial` seeds the ratio vector at connect; `min`/`max` clamp the divider (drag
// toward the wall and watch it stop); `collapsible` arms Enter-to-collapse on the divider the pane leads; and
// DYNAMIC panes — add/remove a workspace panel at runtime and the separator set + ratio vector re-derive (a
// removed pane's share redistributes to the survivors, an added one seeds from its own `initial` or takes an
// equal share). The panel log proves each step. The control owns the mechanics (split.ts / split-pane.ts /
// constrain.ts); this page only stages content, mutates the pane list, and logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + .demo-box + section spacing)
import { el, exampleSection, uiButton } from '../lib/specimens.ts'
import type { UISplitElement, UISplitPaneElement } from '@agent-ui/components/components'

const { content } = mountPage({
  title: 'ui-split-pane — demo',
  intro:
    'The pane child of ui-split, live inside its parent. Each pane declares its own initial share, min/max ' +
    'bounds and whether it is collapsible — drag a divider toward a wall and it stops at the bound; press Enter ' +
    'on a collapsible pane\'s divider to fold it. Add and remove workspace panels to watch the split re-derive. ' +
    'The API table is on the ui-split-pane API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])

// panel — a workspace panel's page content (NOT a ui-* control): a header line + a monospace spec of the pane's props.
function panel(title: string, spec: string, body: string): HTMLElement {
  return el('div', { style: 'display:flex; flex-direction:column; block-size:100%; min-inline-size:0;' }, [
    el(
      'div',
      { style: 'padding:0.4rem 0.75rem; font-size:0.75rem; font-weight:600; letter-spacing:0.02em; text-transform:uppercase; ' +
        'color: var(--md-sys-color-neutral-on-surface-variant); border-block-end:1px solid var(--md-sys-color-neutral-outline-variant); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;' },
      [text(title)],
    ),
    el('div', { style: 'padding:0.5rem 0.75rem; font-family: var(--md-sys-typeface-mono); font-size:0.75rem; color: var(--md-sys-color-neutral-on-surface-variant);' }, [text(spec)]),
    el('div', { style: 'padding:0 0.75rem 0.75rem; font-size:0.85rem; line-height:1.5; overflow:auto;' }, [text(body)]),
  ])
}

const frame = (split: HTMLElement, height: string): HTMLElement =>
  el('div', { style: `block-size:${height}; inline-size:100%; border:1px solid var(--md-sys-color-neutral-outline-variant); border-radius:0.5rem; overflow:hidden;` }, [split])

// ── the shared panel log ────────────────────────────────────────────────────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
function logLine(verb: string, detail: string): void {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${verb.padEnd(9)}${detail}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}
const pct = (ratios: readonly number[]): string => `[${ratios.map((r) => `${Math.round(r * 100)}%`).join(', ')}]`

// ── (1) initial / min / max — three panes with visibly different bounds ────────────────────────────────────
const bounded = el('ui-split', { 'data-role': 'bounded-split' }, [
  el('ui-split-pane', { initial: '0.2', min: '6rem', max: '14rem' }, [
    panel('Navigator', 'initial=0.2 · min=6rem · max=14rem', 'A rail that never grows past 14rem — drag its divider right and it stops there.'),
  ]),
  el('ui-split-pane', { initial: '0.55', min: '12rem' }, [
    panel('Canvas', 'initial=0.55 · min=12rem', 'The main surface — takes the largest initial share and floors at 12rem.'),
  ]),
  el('ui-split-pane', { initial: '0.25', min: '8rem' }, [
    panel('Inspector', 'initial=0.25 · min=8rem', 'Property inspector — floors at 8rem so its fields stay legible.'),
  ]),
]) as UISplitElement
bounded.addEventListener('change', (e) => logLine('change', `bounded  →  ${pct((e as CustomEvent<number[]>).detail)}`))

const boundedNote = el('p', {}, [
  code('initial'), text(' is a ratio SEED read once by the parent at connect (unset ⇒ equal fill; the vector renormalises to sum 1). '),
  code('min'), text(' / '), code('max'), text(' are CSS lengths the parent turns into per-drag clamps — resizing divider i only ever moves ' +
    'extent between panes i and i+1, and neither may cross its own bound, so the Navigator\'s divider hard-stops at 14rem going right ' +
    'and at 6rem going left. The '), code('aria-valuemin'), text('/'), code('-valuemax'), text(' on each divider report the same bounds.'),
])

// ── (2) collapsible — a side panel folded with Enter, restored with Enter ──────────────────────────────────
const collapsible = el('ui-split', { 'data-role': 'collapsible-split' }, [
  el('ui-split-pane', { initial: '0.3', min: '5rem', collapsible: '' }, [
    panel('Files (collapsible)', 'initial=0.3 · min=5rem · collapsible', 'Tab to the divider on my right and press Enter — I fold to my 5rem floor. Enter again brings me back to the size I had.'),
  ]),
  el('ui-split-pane', { min: '10rem' }, [
    panel('Document', 'min=10rem', 'The pane that takes the room a collapsed neighbour gives up (collapse-to-last: the extent moves to the pane after the divider).'),
  ]),
]) as UISplitElement
collapsible.addEventListener('change', (e) => logLine('change', `collapse →  ${pct((e as CustomEvent<number[]>).detail)}`))

const collapsibleNote = el('p', {}, [
  code('collapsible'), text(' arms the PARENT\'s Enter key on the divider this pane leads (the pane itself does nothing with it). ' +
    'The parent remembers the pre-collapse share, so a second Enter restores it exactly. Enter on a divider whose leading pane is not ' +
    'collapsible is a documented no-op.'),
])

// ── (3) dynamic panes — add / remove workspace panels at runtime ────────────────────────────────────────────
const workspace = el('ui-split', { 'data-role': 'dynamic-split' }, [
  el('ui-split-pane', { min: '6rem' }, [panel('Chat', 'min=6rem', 'The conversation with the agent.')]),
  el('ui-split-pane', { min: '6rem' }, [panel('Artifacts', 'min=6rem', 'Files the agent produced this session.')]),
]) as UISplitElement
workspace.addEventListener('change', (e) => logLine('change', `workspace →  ${pct((e as CustomEvent<number[]>).detail)}`))

const EXTRA_PANELS: readonly { title: string; body: string; initial?: string }[] = [
  { title: 'Terminal', body: 'A shell the agent runs commands in.', initial: '0.2' },
  { title: 'Preview', body: 'The rendered result of the current artifact.' },
  { title: 'Trace', body: 'The reasoning trace, step by step.', initial: '0.15' },
]
let added = 0

function separatorCount(): number {
  return workspace.querySelectorAll('[data-separator]').length
}

const addBtn = uiButton('Add a panel', 'soft')
addBtn.addEventListener('click', () => {
  const next = EXTRA_PANELS[added % EXTRA_PANELS.length]
  added += 1
  const attrs: Record<string, string> = { min: '6rem' }
  if (next.initial !== undefined) attrs.initial = next.initial
  const spec = next.initial !== undefined ? `min=6rem · initial=${next.initial}` : 'min=6rem (equal share)'
  workspace.append(el('ui-split-pane', attrs, [panel(next.title, spec, next.body)]))
  logLine('add', `${next.title.padEnd(10)} panes=${workspace.querySelectorAll('ui-split-pane').length}  separators=${separatorCount()}`)
})

const removeBtn = uiButton('Remove the last panel', 'soft')
removeBtn.addEventListener('click', () => {
  const panes = [...workspace.querySelectorAll('ui-split-pane')] as UISplitPaneElement[]
  if (panes.length <= 1) return
  const last = panes[panes.length - 1]
  const title = last.querySelector('div > div')?.textContent ?? 'panel'
  last.remove()
  logLine('remove', `${title.padEnd(10)} panes=${panes.length - 1}  separators=${separatorCount()}`)
})

// The separator set is re-derived by a MutationObserver inside the parent (the separators are themselves host
// children, so the parent's own re-render also mutates childList) — the `add`/`remove` lines above read the count
// synchronously, pre-derivation. This observer watches only PANE mutations and logs the settled truth one frame
// later, once the parent has re-rendered.
let pending = false
const settled = new MutationObserver((records) => {
  const isPane = (n: Node): boolean => n instanceof Element && n.localName === 'ui-split-pane'
  if (!records.some((r) => [...r.addedNodes, ...r.removedNodes].some(isPane))) return
  if (pending) return
  pending = true
  requestAnimationFrame(() => {
    pending = false
    logLine('derived', `panes=${workspace.querySelectorAll('ui-split-pane').length}  separators=${separatorCount()}`)
  })
})
settled.observe(workspace, { childList: true })

const dynamicControls = el('div', { style: 'display:flex; gap:0.75rem; flex-wrap:wrap; margin-block-end:0.75rem;' }, [addBtn, removeBtn])
const dynamicNote = el('p', {}, [
  text('Panes MAY be added or removed after connect. N panes ⇒ N−1 control-rendered separators, always — an added pane seeds from its own '),
  code('initial'), text(' (or takes an equal share proportionally from the others), a removed pane\'s share redistributes to the survivors, and a ' +
    'pane-count change mid-drag aborts that drag at the pre-mutation ratios. The '), strong('derived'),
  text(' log lines show the settled separator count after each mutation.'),
])

content.append(
  exampleSection('initial · min · max — three bounded panes', frame(bounded, '14rem'), boundedNote),
  exampleSection('collapsible — fold a side panel with Enter', frame(collapsible, '12rem'), collapsibleNote),
  exampleSection('Dynamic panes — add / remove at runtime', dynamicControls, frame(workspace, '14rem'), dynamicNote),
  exampleSection('panel log', log),
)
