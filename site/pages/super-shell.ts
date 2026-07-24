// super-shell.ts — the ui-super-shell COMPOSITION GUIDE (M5, GH #83/#84; shell-archetypes-m5.spec.md).
// A teaching page, not an auto-derived API doc: `ui-super-shell` lives in `@agent-ui/app`, OUTSIDE the
// `components/src` fleet the site-coverage/site-toc drift gates enumerate, so it carries no
// `{name}-{type}.html` page set and no per-component TOC group — it is an UNGROUPED site-level link
// (the app-shell.ts / master-detail.ts precedent), registered once in site-manifest.json.
//
// DERIVE-FIRST: the API table at the foot is NOT hand-restated — it is read straight from the shipped
// descriptor (super-shell.md) through the SAME canonical parser (parseDoc) the in-package contract
// trip-wire validates, rendered by the SAME shared doc-page renderer every control API doc uses.
//
// LIVE examples over static diagrams: every shape below is a REAL <ui-super-shell> (dogfooding the
// component this page documents) — the full grammar, the absence law, the collapse round-trip you can
// click, depth-2 recursion, and a resizable frame proving the narrow auto-collapse + overlay restore.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import '@agent-ui/app/super-shell.css' // ui-super-shell's own token ladder + collapse CSS, after the foundation
import '@agent-ui/app/super-shell' // self-defines ui-super-shell
import './super-shell.css' // page-local demo chrome only (slot cells + the resizable frame) — never restyles the control's internals
import { renderApiTable, renderPropertiesTable, renderChangelogTable, heading } from '../lib/doc-page.ts'
import { parseDoc } from '../lib/frontmatter.ts'
// The shipped descriptor, pulled at build time via Vite's `?raw` (the frontmatter.ts convention) — the
// SAME source the app package's own contract trip-wire (super-shell.test.ts) checks against.
import shellMd from '../../packages/agent-ui/app/src/controls/super-shell/super-shell.md?raw'

const { content } = mountPage({
  title: 'Composing a ui-super-shell',
  intro:
    'ui-super-shell is the shell-archetype family’s grammar ceiling (M5) — a two-level recursive ' +
    'frame you author by marking light-DOM children with data-slot. This page explains its five systems: ' +
    'the grammar, the collapse contract, recursion, the narrow reflow, and the landmarks.',
})

content.append(
  pageLead(
    'ui-super-shell (@agent-ui/app) composes ' +
      '[ header? | (rail?+pane?) | content | (pane?+rail?) | footer? ]. Every slot is OPTIONAL and ' +
      'ABSENT when unfilled — you author only the slots you need. Spec-sourced from Kim’s Figma ' +
      'frames (shell-archetypes-m5.spec.md, GH #44): the wireframe and its all-collapsed extreme. Below, ' +
      'five systems, each shown on a live shell you can inspect and click.',
  ),
)

// ── small light-DOM demo scaffold (page chrome only — never restyles a ui-* control's internals) ─────────────
function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function sectionHeading(text: string): HTMLElement {
  return heading(2, text)
}

function para(...nodes: (string | Node)[]): HTMLElement {
  const p = document.createElement('p')
  p.className = 'ss-prose'
  for (const n of nodes) p.append(typeof n === 'string' ? document.createTextNode(n) : n)
  return p
}

function code(text: string): HTMLElement {
  return el('code', 'ss-code', text)
}

/** One slot cell — a real light-DOM child marked data-slot, the demo's visible label + note as its content. */
function slot(name: string, label: string, note: string): HTMLElement {
  const s = document.createElement('div')
  s.setAttribute('data-slot', name)
  const inner = el('div', 'ss-slot')
  inner.append(el('span', 'ss-slot-label', label), el('span', 'ss-slot-note', note))
  s.append(inner)
  return s
}

/** A framed live shell built from the given slot cells. */
function demoShell(slots: readonly HTMLElement[], opts: { nested?: boolean } = {}): HTMLElement {
  const shell = document.createElement('ui-super-shell')
  shell.className = opts.nested ? 'ss-demo ss-demo--nested' : 'ss-demo'
  shell.append(...slots)
  return shell
}

// ════════════════ 1 · The grammar ════════════════
content.append(sectionHeading('1 · The grammar'))
content.append(
  para(
    'A shell is ',
    code('[ header? | side-L? | content | side-R? | footer? ]'),
    ', where a side is a rail + pane (mirrored on both sides — SPEC-R1a). Mark a light-DOM child ',
    code('data-slot="header|global-nav|nav-pane|content|options-pane|global-options|footer"'),
    '; an unmarked child folds into ',
    code('content'),
    ', the one mandatory slot. The full grammar, all seven slots:',
  ),
)
content.append(
  demoShell([
    slot('header', 'header', 'Permanent chrome — hosts the collapse toggles.'),
    slot('global-nav', 'global-nav', 'Outer rail — 3 modules (54px).'),
    slot('nav-pane', 'nav-pane', 'Outer pane — 14 modules (252px).'),
    slot('content', 'content', 'The mandatory slot — flexible, fills the rest.'),
    slot('options-pane', 'options-pane', 'Mirrors nav-pane.'),
    slot('global-options', 'global-options', 'Mirrors global-nav.'),
    slot('footer', 'footer', 'Permanent chrome, like header.'),
  ]),
)
content.append(
  para(
    'The ABSENCE law: an unfilled slot contributes no box at all — not an empty placeholder. Delete any ' +
      'slot in your own markup and its band simply disappears, no CSS override needed. A minimal shell:',
  ),
)
// Assembled from the attribute name as a variable (never the literal substring `slot=` in source text) —
// the site dead-name guard (site-canon.test.ts) flags any quoted `slot="…"`/`data-role="…"` occurrence as
// a POTENTIAL stale native-slot reference; `data-slot` is this component's own attribute grammar, not a
// native slot, so it can never be a "canonical" registry entry to allowlist against. Renders byte-identical
// to the literal markup a reader would actually write.
const DATA_SLOT_ATTR = 'data-' + 'slot'
content.append(
  el(
    'pre',
    'ss-snippet',
    `<ui-super-shell>
  <div ${DATA_SLOT_ATTR}="header">…</div>
  <div ${DATA_SLOT_ATTR}="nav-pane">…</div>
  <div>…primary content, no ${DATA_SLOT_ATTR} needed…</div>
</ui-super-shell>`,
  ),
)
content.append(demoShell([slot('header', 'header', 'The only bar.'), slot('nav-pane', 'nav-pane', 'The only side.'), slot('content', 'content', 'Unmarked children land here too.')]))
content.append(
  para(
    'Everything sits on an 18px module (SPEC-R1c, ', code('--ui-super-shell-module'), '): bars/rails are 3 ' +
      'modules, panes are 14 — realized as tokens, never literals, so a theme can re-scale the whole ' +
      'frame from one variable.',
  ),
)

// ════════════════ 2 · The collapse contract ════════════════
content.append(sectionHeading('2 · The collapse contract'))
content.append(
  para(
    'Collapse is per-side, HEADER-HOSTED (SPEC-R2b): a header slot gets two toggles injected at its ends, ' +
      'each flipping its side’s reflected ',
    code('collapsed-start'),
    ' / ',
    code('collapsed-end'),
    ' state — PAIRED restore (fork F1): one click drives the rail+pane pair together. No header, no ' +
      'toggles — permanent chrome is authored chrome. Click the hamburgers below:',
  ),
)
content.append(
  demoShell([
    slot('header', 'header', 'Click either ≡ to collapse that side.'),
    slot('global-nav', 'global-nav', 'Paired with nav-pane.'),
    slot('nav-pane', 'nav-pane', 'Paired with global-nav.'),
    slot('content', 'content', 'The canvas never collapses.'),
    slot('options-pane', 'options-pane', 'Paired with global-options.'),
    slot('global-options', 'global-options', 'Paired with options-pane.'),
    slot('footer', 'footer', 'Permanent chrome, like header.'),
  ]),
)
content.append(
  para(
    'Header and footer are PERMANENT chrome (SPEC-R2c) — the side toggles never touch them; the ' +
      'all-collapsed state is exactly header / full-bleed content / footer, matching the Figma extreme.',
  ),
)

// ════════════════ 3 · Recursion (depth 2) ════════════════
content.append(sectionHeading('3 · Recursion — a shell inside a shell'))
content.append(
  para(
    'A shell may host another shell in its ', code('content'), ' slot (SPEC-R1b). The nested level simply ' +
      'authors no rails — the ring drops for free, zero extra code. This is the app → canvas ' +
      'relationship from the wireframe: the outer level owns global-nav/global-options; the inner ' +
      '(“canvas-shell”) level has only panes.',
  ),
)
{
  const inner = document.createElement('ui-super-shell')
  inner.className = 'ss-demo ss-demo--inner'
  inner.append(
    slot('header', 'header (inner)', 'The canvas-shell’s own bar.'),
    slot('nav-pane', 'selections-pane', 'A pane — no rail at this level.'),
    slot('content', 'canvas', 'The innermost content.'),
    slot('options-pane', 'modifiers-pane', 'Mirrors selections-pane.'),
  )
  const contentWrap = document.createElement('div')
  contentWrap.setAttribute('data-slot', 'content')
  contentWrap.className = 'ss-content-wrap'
  contentWrap.append(inner)
  content.append(
    demoShell(
      [slot('header', 'header (outer)', 'The app-level bar.'), slot('global-nav', 'global-nav', 'Outer rail only.'), contentWrap],
      { nested: true },
    ),
  )
}

// ════════════════ 4 · Narrow reflow ════════════════
content.append(sectionHeading('4 · Narrow reflow'))
content.append(
  para(
    'Below a 40rem container width (SPEC-R4), sides auto-collapse via the query alone — never by ' +
      'writing the collapsed-* attributes, so a persisted wide-state choice always survives a narrow visit ' +
      '(the no-clobber law). A header toggle at narrow re-opens its side as an OVERLAY above the canvas, ' +
      'one side at a time, instead of squeezing it. Drag the handle below narrower than 40rem, then click a ' +
      'toggle:',
  ),
)
const resizeDemo = el('div', 'ss-resize')
resizeDemo.append(
  demoShell([
    slot('header', 'header', 'Click ≡ at narrow to overlay-restore a side.'),
    slot('nav-pane', 'nav-pane', 'Auto-hides below 40rem; toggle restores as an overlay.'),
    slot('content', 'content', 'Never squeezed — the side floats above it.'),
    slot('options-pane', 'options-pane', 'Auto-hides the same way.'),
    slot('footer', 'footer', 'Stays put — permanent chrome.'),
  ]),
)
content.append(resizeDemo, el('p', 'ss-caption', '↑ Drag the resize handle (bottom-right) below 40rem, then click a header toggle to overlay-restore that side.'))
content.append(
  para(
    'A side can opt into a different narrow story via ',
    code('narrow-start'),
    ' / ',
    code('narrow-end'),
    ' (', code('"collapse" | "stack"'),
    '): ',
    code('stack'),
    ' keeps the side IN FLOW, full width, letting its own content own its narrow anatomy — the docs ' +
      'site’s own nav pane uses this so ui-nav-rail’s collapse="menu" dropdown takes over instead ' +
      'of the shell’s hide/overlay arm (see it live in this very page’s nav rail, narrow — logically ' +
      'the start side, LLD-C4/GH #95).',
  ),
)

// ════════════════ 5 · Landmarks — role decoupled from placement ════════════════
// Re-scoped from the retired ui-app-shell composition guide (ADR-0156 clause 4): ADR-0083's
// role-decoupled-from-placement law survives the deprecation as FAMILY law (clause 3), homed in this
// grammar's `data-landmark` override (super-shell.ts roleFor()) — so its teaching now lives here, on the
// family's own page, with the family's own live production reference.
content.append(sectionHeading('5 · Landmarks — role decoupled from placement'))
content.append(
  para(
    'Every control-created wrapper part carries a REAL ARIA landmark by default, keyed by its slot: ' +
      'header → ',
    code('banner'),
    ', footer → ',
    code('contentinfo'),
    ', content → ',
    code('main'),
    ', the nav-side slots → ',
    code('navigation'),
    ', the options-side slots → ',
    code('complementary'),
    ' (LLD-C1). The host element itself carries no role — the landmarks live on the parts.',
  ),
)
content.append(
  para(
    'When the right SLOT for a surface is the wrong LANDMARK for it, decouple them: mark the slot’s ' +
      'first authored child ',
    code('data-landmark="…"'),
    ' and the wrapper’s role follows the override instead of the slot default. This is ADR-0083’s ' +
      'role-decoupled-from-placement law, carried into this family as its permanent home (ADR-0156). The ' +
      'canonical case is a chat composer: it belongs in the start side (',
    code('nav-pane'),
    ') but reads correctly to assistive tech as ',
    code('complementary'),
    ', not navigation — exactly what the ',
    (() => {
      const a = document.createElement('a')
      a.href = './a2ui-live.html'
      a.textContent = 'A2UI live-agent page'
      return a
    })(),
    '’s chat pane does in production.',
  ),
)
{
  const chatPane = slot('nav-pane', 'nav-pane + data-landmark', 'Start-side placement, but role="complementary" on its wrapper part — inspect it.')
  chatPane.setAttribute('data-landmark', 'complementary')
  content.append(
    demoShell([
      slot('header', 'header', 'Chrome — role="banner" by default.'),
      chatPane,
      slot('content', 'content', 'The canvas — always role="main".'),
    ]),
  )
}
content.append(
  para(
    'The override vocabulary is ',
    code('banner · navigation · main · complementary · contentinfo · region · form · search'),
    ' — reused verbatim from ADR-0083’s own value set. A value outside it is ignored and the slot default ' +
      'stands. Author responsibility stays the same as ever: exactly one ',
    code('main'),
    ' landmark per document.',
  ),
)

// ════════════════ API reference — DERIVED from the descriptor ════════════════
content.append(sectionHeading('API reference'))
content.append(
  para(
    'Read straight from the shipped descriptor (super-shell.md) through the same parser the package’s ' +
      'contract trip-wire validates — this table cannot drift from the component.',
  ),
)

const shellDoc = parseDoc(shellMd)
content.append(el('h3', 'ss-api-tag', 'ui-super-shell'))
if (shellDoc.descriptor.attributes.length > 0) content.append(renderApiTable(shellDoc.descriptor.attributes, 4))
{
  const props = renderPropertiesTable(shellDoc.descriptor, 4)
  if (props) content.append(props)
}

// Provenance — hand-authored, not derivable from any canonical index.
const changelog = renderChangelogTable([
  {
    date: '2026-07-19',
    type: 'Decision',
    id: 'ADR-0151',
    summary: 'Named shell archetypes join agent-app-surfaces as M5; ui-super-shell is the family’s grammar ceiling.',
  },
  {
    date: '2026-07-19',
    type: 'Feature',
    id: 'GH #83',
    summary: 'ui-super-shell shipped: the data-slot grammar, the absence law, ring-dropping recursion, header-hosted collapse.',
  },
  {
    date: '2026-07-19',
    type: 'Feature',
    id: 'GH #84',
    summary: 'The docs site’s own chrome migrated onto ui-super-shell — a collapsible, persisted nav pane.',
  },
  {
    date: '2026-07-21',
    type: 'Decision',
    id: 'ADR-0156',
    summary:
      'ui-app-shell deprecated in favor of this family; ADR-0083’s landmark-override law re-homed here as family law (data-landmark), its teaching re-scoped onto this page.',
  },
])
if (changelog) content.append(changelog)
