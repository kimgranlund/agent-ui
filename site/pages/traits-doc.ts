// site/pages/traits-doc.ts — the @agent-ui/components TRAITS guide: the three public trait subpaths
// (./traits/overlay, ./traits/list-reorder, ./traits/scroll-spy) plus the ./dogfood-frame asset pair.
// Traits live in components/src/traits/ — NOT controls/ — so they carry no descriptor `.md` and sit
// OUTSIDE the site-coverage/site-toc/site-canon descriptor-driven gates (those walk controls/src/
// controls only, CLAUDE.md's Layout section): this is an ungrouped site-level GUIDE page, the SAME
// posture as router-doc.ts/data-doc.ts/highlight-doc.ts.
//
// DERIVE-FIRST: the subpath table is read from @agent-ui/components' own package.json `exports` map
// (Vite `?raw` + JSON.parse — the getting-started.ts precedent); every OptionsX interface, the
// OverlayPlacement union, the OverlayHandle interface, and every function signature below are sliced
// VERBATIM out of the real trait source via Vite `?raw` static imports + this page's own brace/blank-
// line-balanced extractors (extractInterface/extractBlock/extractSignature) — never hand-retyped, so a
// field rename/addition on a trait's own interface shows up here with zero edits to this page, and a
// genuine rename that breaks a marker throws at page-load (a real drift gate, not just a comment).
//
// What is hand-authored, flagged: the per-trait prose, the "which controls/pages consume this" lists
// (no build-time "who imports this trait" derivation exists for a page Vite bundles — grepped by hand,
// 2026-08-16), and the illustrative usage snippets (cited to their real call sites by file:line, the
// router-doc.ts/data-doc.ts convention — a reader can re-verify against the cited line).
//
// Live proof: overlay() is dogfooded directly on this page (a real <ui-tooltip>, which wires overlay()
// from its own connected() — tooltip.ts's own `overlay(this, {...})` call is what is running under the
// pointer/keyboard focus below). list-reorder and scroll-spy currently have ZERO components/src control
// consumers (their only two consumers, repo-wide, are the two site-level pages linked in their own
// sections) — stated plainly rather than staged, per the honest-labels discipline.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003) — already registers ui-tooltip
import { heading } from '../lib/doc-page.ts'
import { exampleSection } from '../lib/specimens.ts'
import { codeBlock } from '../lib/code-block.ts'
import componentsPkgRaw from '../../packages/agent-ui/components/package.json?raw'
import traitsIndexRaw from '../../packages/agent-ui/components/src/traits/index.ts?raw'
import overlaySrc from '../../packages/agent-ui/components/src/traits/overlay.ts?raw'
import listReorderSrc from '../../packages/agent-ui/components/src/traits/list-reorder.ts?raw'
import scrollSpySrc from '../../packages/agent-ui/components/src/traits/scroll-spy.ts?raw'

// ── local derivation helpers — used only on this page (no other page slices a trait's own source) ─────────────

/** Slice `export interface {name} { ... }` verbatim out of `source`, brace-balanced from the marker.
 *  Throws — a real build-time drift gate — if the interface has been renamed/removed. */
function extractInterface(source: string, name: string): string {
  const marker = `export interface ${name} {`
  const start = source.indexOf(marker)
  if (start === -1) throw new Error(`traits-doc: interface "${name}" not found — renamed or removed?`)
  let depth = 0
  let i = start
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) {
        i++
        break
      }
    }
  }
  return source.slice(start, i)
}

/** Slice a top-level statement starting at `marker` up to the next blank line (or EOF) verbatim out of
 *  `source` — for a `export type X = …` union that ends with no single balanced-bracket close. Throws
 *  if the marker is gone. */
function extractBlock(source: string, marker: string): string {
  const start = source.indexOf(marker)
  if (start === -1) throw new Error(`traits-doc: block starting "${marker}" not found — renamed or removed?`)
  const blank = source.indexOf('\n\n', start)
  return source.slice(start, blank === -1 ? source.length : blank).trimEnd()
}

/** Slice an `export function {name}(…): ReturnType` signature (through the char right before its body's
 *  opening `{`) verbatim out of `source`. Throws if the function has been renamed/removed. */
function extractSignature(source: string, name: string): string {
  const marker = `export function ${name}(`
  const start = source.indexOf(marker)
  if (start === -1) throw new Error(`traits-doc: function "${name}" not found — renamed or removed?`)
  const bodyStart = source.indexOf('{', start)
  return source.slice(start, bodyStart).trim()
}

/** The first N lines of a source file's own banner comment, verbatim — the file's own stated purpose. */
function bannerLines(source: string, n: number): string {
  return source
    .split('\n')
    .slice(0, n)
    .map((l) => l.replace(/^\/\/ ?/, ''))
    .join('\n')
}

function para(...parts: (string | Node)[]): HTMLElement {
  const p = document.createElement('p')
  for (const part of parts) p.append(typeof part === 'string' ? document.createTextNode(part) : part)
  return p
}
function code(text: string): HTMLElement {
  const c = document.createElement('code')
  c.textContent = text
  return c
}
function link(href: string, text: string): HTMLAnchorElement {
  const a = document.createElement('a')
  a.href = href
  a.textContent = text
  return a
}
function listOf(items: readonly Node[]): HTMLElement {
  const ul = document.createElement('ul')
  for (const item of items) {
    const li = document.createElement('li')
    li.append(item)
    ul.append(li)
  }
  return ul
}

const { content } = mountPage({
  title: '@agent-ui/components — traits',
  intro:
    'Traits are the layer BELOW controls (CLAUDE.md’s Layout section: reactive ← dom ← traits ← controls) — ' +
    'stateless `(host, opts) => cleanup` behaviours (and a couple of stateful controllers) invoked directly ' +
    'from a control’s own `connected()`. Most traits live entirely inside `components/src/traits/` with no ' +
    'subpath export at all; exactly three are published as their own `@agent-ui/components/traits/*` ' +
    'entries for a consumer outside the fleet to reuse directly. This page documents those three, plus the ' +
    'unrelated `./dogfood-frame` asset pair.',
})

// ════════════════ 1 · What a trait is ════════════════
content.append(heading(2, 'What a trait is'))
content.append(
  para(
    'Verbatim from the traits barrel’s own banner comment (',
    code('packages/agent-ui/components/src/traits/index.ts'),
    '):',
  ),
)
content.append(codeBlock(bannerLines(traitsIndexRaw, 2)))
content.append(
  para(
    'There is no ',
    code('host.use()'),
    ' registration hook: a control imports the trait function and calls it itself, once, from its own ',
    code('connected()'),
    ' — the SAME lifecycle discipline every trait in the tree follows, published or not.',
  ),
)

// ════════════════ 2 · The three public subpaths ════════════════
content.append(heading(2, 'The three public subpaths'))
content.append(
  para(
    'Read straight from ',
    code('@agent-ui/components'),
    '’s own ',
    code('package.json'),
    ' `exports` map — a subpath added or removed there shows up here with zero edits to this page.',
  ),
)
{
  const pkg = JSON.parse(componentsPkgRaw) as { exports: Record<string, string> }
  const traitEntries = Object.entries(pkg.exports).filter(([k]) => k.startsWith('./traits/'))
  const DESCRIPTIONS: Record<string, string> = {
    './traits/overlay': 'Top-layer, light-dismissable anchored popup positioning — the non-modal overlay controller.',
    './traits/list-reorder': 'Pointer-drag + keyboard-fallback list reordering (WCAG 2.2 SC 2.5.7).',
    './traits/scroll-spy': 'IntersectionObserver-based heading-activation for a sticky TOC nav.',
  }
  const table = document.createElement('table')
  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')
  for (const label of ['Subpath', 'Source', 'What it does']) {
    const th = document.createElement('th')
    th.textContent = label
    headRow.append(th)
  }
  thead.append(headRow)
  table.append(thead)
  const tbody = document.createElement('tbody')
  for (const [subpath, source] of traitEntries) {
    const tr = document.createElement('tr')
    const c1 = document.createElement('td')
    c1.append(code(subpath))
    const c2 = document.createElement('td')
    c2.append(code(source.replace(/^\.\//, '')))
    const c3 = document.createElement('td')
    c3.textContent = DESCRIPTIONS[subpath] ?? ''
    tr.append(c1, c2, c3)
    tbody.append(tr)
  }
  table.append(tbody)
  content.append(table)
}

// ════════════════ 3 · overlay ════════════════
content.append(heading(2, '@agent-ui/components/traits/overlay'))
content.append(
  para(
    'The non-modal, top-layer positioning controller behind every anchored popup in the fleet — select/' +
      'combo-box listboxes, menu, popover, form-popover, tooltip, and text-field’s own suggestions panel. ' +
      'A true focus-trapped MODAL stays on ',
    code('ui-modal'),
    '’s own ',
    code('<dialog>'),
    ' (',
    code('showModal()'),
    '); this trait is strictly the non-modal path (overlay-controller.lld.md LLD-C1..C4).',
  ),
)
content.append(heading(3, 'OverlayPlacement / OverlayOptions / OverlayHandle — derived from source'))
content.append(codeBlock(extractBlock(overlaySrc, 'export type OverlayPlacement ='), 'ts'))
content.append(codeBlock(extractInterface(overlaySrc, 'OverlayOptions'), 'ts'))
content.append(codeBlock(extractInterface(overlaySrc, 'OverlayHandle'), 'ts'))
content.append(codeBlock(extractSignature(overlaySrc, 'overlay'), 'ts'))
content.append(
  para(
    'Consumed by: ',
    link('./combo-box-doc.html', 'ui-combo-box'),
    ' · ',
    link('./form-popover-doc.html', 'ui-form-popover'),
    ' · ',
    link('./menu-doc.html', 'ui-menu'),
    ' · ',
    link('./popover-doc.html', 'ui-popover'),
    ' · ',
    link('./select-doc.html', 'ui-select'),
    ' · ',
    link('./text-field-doc.html', 'ui-text-field'),
    ' · ',
    link('./tooltip-doc.html', 'ui-tooltip'),
    ' — seven controls, every one wiring it the same way: one ',
    code('overlay(this, opts)'),
    ' call in ',
    code('connected()'),
    ', held as ',
    code('this._overlayHandle'),
    '.',
  ),
)
content.append(
  para(
    'Usage (illustrative — mirrors the real call at ',
    code('packages/agent-ui/components/src/controls/popover/popover.ts:92'),
    '):',
  ),
)
content.append(
  codeBlock(
    [
      "import { overlay } from '@agent-ui/components/traits/overlay'",
      '',
      'protected connected(): void {',
      '  const handle = overlay(this, {',
      '    popup: this.#panel,',
      '    anchor: this.#trigger,',
      "    placement: 'bottom-start',",
      '    auto: true,        // popover=auto — Escape + outside-click light-dismiss',
      '    focusOnOpen: true, // move focus into the panel on open',
      '  })',
      '  this.listen(this.#trigger, \'click\', () => handle.toggle())',
      '}',
    ].join('\n'),
    'ts',
  ),
)
content.append(para('Live — this ', code('<ui-tooltip>'), ' wires the exact same trait call above (tooltip.ts’s own ', code('overlay(this, { …, auto: false, focusOnOpen: false })'), '):'))
{
  const tip = document.createElement('ui-tooltip')
  tip.setAttribute('placement', 'top-start')
  const anchor = document.createElement('button')
  anchor.type = 'button'
  anchor.textContent = 'Hover or focus me'
  tip.append(anchor, document.createTextNode('Positioned + light-dismissed by the overlay trait.'))
  content.append(exampleSection('overlay() — live, via ui-tooltip', tip))
}

// ════════════════ 4 · list-reorder ════════════════
content.append(heading(2, '@agent-ui/components/traits/list-reorder'))
content.append(
  para(
    'Pointer-capture drag with sibling hit-testing plus a keyboard Up/Down fallback (WCAG 2.2 SC 2.5.7 ' +
      'Dragging Movements), both converging on one ',
    code('onCommit(from, to)'),
    ' call. No HTML5 Drag-and-Drop API. GH #952, extracted from GH #921’s agent-admin roster mechanics.',
  ),
)
content.append(heading(3, 'ListReorderOptions — derived from source'))
content.append(codeBlock(extractBlock(listReorderSrc, 'export type ListReorderOrientation ='), 'ts'))
content.append(codeBlock(extractInterface(listReorderSrc, 'ListReorderOptions'), 'ts'))
content.append(codeBlock(extractSignature(listReorderSrc, 'listReorder'), 'ts'))
content.append(
  para(
    'Not re-exported from the components root barrel (a standing 312 B size-budget exception, ',
    code('traits/index.ts'),
    ') — reach it via the subpath. ',
    'Zero components/src controls consume it today: its one live consumer, repo-wide, is the roster-drag ' +
      'mechanics on ',
    link('./agent-admin-app.html', 'the Agent Admin App page'),
    ' (',
    code('site/pages/agent-admin-app.ts:830'),
    ') — an app-tier page, not a fleet component. Stated plainly rather than staged: this is the trait’s ' +
      'documented first-slice status, not a gap in this page.',
  ),
)

// ════════════════ 5 · scroll-spy ════════════════
content.append(heading(2, '@agent-ui/components/traits/scroll-spy'))
content.append(
  para(
    'IntersectionObserver-based heading-activation for a sticky TOC nav (GH #964, SaaS UX brief §5): ' +
      'watches a fixed list of heading elements and reports which one is “active” (the last heading whose ' +
      'entry currently intersects a narrow activation band near the top of the viewport, falling back to ' +
      'the nearest heading already scrolled past — never blanking mid-article).',
  ),
)
content.append(heading(3, 'ScrollSpyOptions — derived from source'))
content.append(codeBlock(extractInterface(scrollSpySrc, 'ScrollSpyOptions'), 'ts'))
content.append(codeBlock(extractSignature(scrollSpySrc, 'scrollSpy'), 'ts'))
content.append(
  para(
    'Zero components/src controls consume it today either — its one live consumer, repo-wide, is the sticky-' +
      'TOC composition recipe on ',
    link('./toc-content.html', 'the Sticky TOC content layout page'),
    ' (',
    code('site/pages/toc-content.ts:258'),
    '), which wires a real ',
    code('ui-nav-rail'),
    '/',
    code('ui-select'),
    ' pair to it — the GH #964 mint-last proof that no dedicated ',
    code('ui-toc'),
    ' control is needed.',
  ),
)

// ════════════════ 6 · @agent-ui/components/dogfood-frame ════════════════
content.append(heading(2, '@agent-ui/components/dogfood-frame'))
content.append(
  para(
    'Unrelated to the traits above — a GENERATED asset pair (',
    code('scripts/build-dogfood-assets.mjs'),
    '), not a trait: the whole load-bearing docs-page CSS+JS cascade (foundation → component styles → ' +
      'self-defining controls → the Phosphor icon pack), pre-built as one minified IIFE bundle, for ',
    code('ui-sandbox-frame'),
    '’s opt-in "dogfood mode" (SPEC-R12, GH #316/ADR-0162) — a sandboxed iframe that wants the SAME fleet ' +
      'CSS/JS the parent page runs, without re-deriving the cascade inside the frame itself.',
  ),
)
content.append(
  para(
    'The real generated module — regenerate with ',
    code('node scripts/build-dogfood-assets.mjs'),
    ' (its own freshness gate, ',
    code('dogfood-assets-freshness.test.ts'),
    ', rebuilds and byte-compares on every test run) — exports three constants, deliberately NOT imported ' +
      'onto this page (that would pull the multi-hundred-kB CSS/JS text into this page’s own bundle):',
  ),
)
{
  const noteText =
    "import { DOGFOOD_CSS, DOGFOOD_JS, DOGFOOD_TAGS } from '@agent-ui/components/dogfood-frame' — the CSS " +
    'text, the JS text, and DOGFOOD_TAGS (the list of tags the JS bundle self-defines, used by the ' +
    'freshness gate to compare against a fresh rebuild).'
  content.append(codeBlock(noteText, 'ts'))
}
content.append(
  para(
    'Consumed by: ',
    code('ui-sandbox-frame'),
    '’s own bootstrap (',
    code('packages/agent-ui/components/src/controls/sandbox-frame/bootstrap.ts'),
    ') and ',
    code('ui-agent-admin'),
    '’s lazy dogfood-mode loader (',
    code('packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts'),
    ').',
  ),
)
content.append(listOf([para('See it live: the ', link('./gen-ui-live.html', 'GenUI Chat Demo')), para('and the ', link('./agent-admin.html', 'Agent Admin'), ' guide’s live-apply surfaces.')]))
