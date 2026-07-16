// app-shell.ts — the ui-app-shell COMPOSITION GUIDE (Kim's request: "a docs page where we explain how the
// role, region, slots, systems work"). A teaching page, not an auto-derived API doc: `ui-app-shell` lives in
// `@agent-ui/app`, OUTSIDE the `components/src` fleet the site-coverage/site-toc drift gates enumerate, so it
// carries no `{name}-{type}.html` page set and no per-component TOC group — it is an UNGROUPED site-level link
// (like the A2UI pages), added once to `_page.ts` NAV + `main.ts` CARD_GROUPS.
//
// DERIVE-FIRST: the API tables at the foot are NOT hand-restated. They are read straight from the two shipped
// descriptors (app-shell.md / app-shell-region.md) through the SAME canonical parser (parseDoc → parseDescriptor)
// the in-package contract trip-wire validates, rendered by the SAME shared doc-page renderer every control API
// doc uses — so a prop rename/default change in app-shell.ts (mirrored into the descriptor, which the trip-wire
// pins) flows here with no page edit, and a stale prop name cannot survive on this page. What is hand-authored is
// the TEACHING prose + the live examples — the part that genuinely has no source to derive from.
//
// LIVE examples over static code: every diagram is a REAL `<ui-app-shell>` rendered on the page (dogfooding the
// component this page documents), including a resizable frame whose own container-query reflow the reader can
// trigger by dragging, and a real `isolated` instance.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import '@agent-ui/app/app-shell.css' // ui-app-shell light-mode region grid (after the foundation), as a2ui-live does
import '@agent-ui/app/app-shell' // self-defines ui-app-shell / ui-app-shell-region
import './app-shell.css' // page-local demo chrome only (region cells + the resizable frame) — never restyles a control's internals
import { renderApiTable, renderPropertiesTable, renderChangelogTable, heading } from '../lib/doc-page.ts'
import { parseDoc } from '../lib/frontmatter.ts'
// The two shipped descriptors, pulled at build time via Vite's `?raw` (the frontmatter.ts convention). These ARE
// the single source of truth the app package's own contract trip-wire (app-shell.test.ts) checks against.
import shellMd from '../../packages/agent-ui/app/src/controls/app-shell/app-shell.md?raw'
import regionMd from '../../packages/agent-ui/app/src/controls/app-shell/app-shell-region.md?raw'

const { content } = mountPage({
  title: 'Composing a ui-app-shell',
  intro:
    'ui-app-shell is the application frame — a presence-driven grid of named landmark regions that reflows to ' +
    'its own width and can isolate its styles per instance. This page explains its four systems: regions, roles, ' +
    'narrow-reflow, and content composition.',
})

content.append(
  pageLead(
    'ui-app-shell (@agent-ui/app) composes the shipped layout family into a persistent frame. You dock a surface ' +
      'into a named region by composing a ui-app-shell-region child and setting its region prop — docking is ' +
      'composition, not a native <slot> mechanism. Below, four systems, each shown on a live shell you can inspect.',
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
  p.className = 'as-prose'
  for (const n of nodes) p.append(typeof n === 'string' ? document.createTextNode(n) : n)
  return p
}

function code(text: string): HTMLElement {
  return el('code', 'as-code', text)
}

/** One region cell — a real ui-app-shell-region with the demo's visible label + note (its own content). */
function region(
  regionName: string,
  label: string,
  note: string,
  opts: { landmark?: string; collapse?: string } = {},
): HTMLElement {
  const r = document.createElement('ui-app-shell-region')
  r.setAttribute('region', regionName)
  if (opts.landmark) r.setAttribute('landmark', opts.landmark)
  if (opts.collapse) r.setAttribute('collapse', opts.collapse)
  r.className = 'as-region'
  r.append(el('span', 'as-region-label', label), el('p', 'as-region-note', note))
  return r
}

/** A framed live shell built from the given region cells. `resizable` wraps it in a drag-to-narrow frame. */
function demoShell(regions: readonly HTMLElement[], opts: { isolated?: boolean } = {}): HTMLElement {
  const shell = document.createElement('ui-app-shell')
  if (opts.isolated) shell.setAttribute('isolated', '')
  shell.className = 'as-demo'
  shell.append(...regions)
  return shell
}

// ════════════════ 1 · The region system ════════════════
content.append(sectionHeading('1 · The region system'))
content.append(
  para(
    'A ui-app-shell is a CSS grid of five named areas: ',
    code('banner'),
    ' (top, full width), ',
    code('navigation'),
    ' (left column), ',
    code('main'),
    ' (center, the flexible 1fr track), ',
    code('complementary'),
    ' (right column), and ',
    code('contentinfo'),
    ' (bottom, full width). Each ui-app-shell-region child names its target area through its own ',
    code('region'),
    ' prop; the shell reads that reflected attribute to place it.',
  ),
)
content.append(
  para(
    'The layout is presence-driven — no :has(). An area with no region placed in it collapses to zero via ' +
      'ordinary CSS Grid auto-track sizing, so you compose only the regions you need. The live shell below carries ' +
      'all five; delete any one in your own markup and its band simply disappears.',
  ),
)
content.append(
  demoShell([
    region('banner', 'banner', 'Top bar — spans the full width above the columns.'),
    region('navigation', 'navigation', 'Left column — sized to its content (auto track).'),
    region('main', 'main', 'The mandatory region: the flexible center (1fr).'),
    region('complementary', 'complementary', 'Right column — auto track, mirrors navigation.'),
    region('contentinfo', 'contentinfo', 'Footer — spans the full width below the columns.'),
  ]),
)
content.append(
  para(
    code('main'),
    ' is the one mandatory region — a content contract, not an auto-injected empty band. A shell with no main ' +
      'region logs a developer-facing console.warn at connect (it does not throw). Its placement rule is an ' +
      'EXCLUSIONARY catch-all: anything that is not one of the other four named values lands in main, so a typo ' +
      "(region=\"mian\") still renders in main rather than vanishing. Duplicate regions are allowed — two children " +
      'with the same region both land in that area and stack.',
  ),
)

// ════════════════ 2 · Content composition ("slots") ════════════════
content.append(sectionHeading('2 · Content composition — the region-child model ("slots")'))
content.append(
  para(
    'This is the composition model people mean by "slots" — but ui-app-shell uses NO native <slot>. Both ' +
      'descriptors declare slots: [] on purpose. A region is a real element, and its content is simply its ' +
      'light-DOM children — you append whatever you like into it (headings, a ui-button, a whole ui-form-provider). ' +
      'There is no attribute-on-arbitrary-child mechanism: a child "docks" by BEING a ui-app-shell-region and ' +
      'naming its area.',
  ),
)
content.append(
  para(
    'Because a region is generic, one element type covers all five areas (Kim ratified the generic element over ' +
      'five named ui-app-shell-{region} tags). You dock content like this — the region children are the content:',
  ),
)
content.append(
  el(
    'pre',
    'as-snippet',
    `<ui-app-shell>
  <ui-app-shell-region region="banner">…top bar…</ui-app-shell-region>
  <ui-app-shell-region region="navigation">…nav…</ui-app-shell-region>
  <ui-app-shell-region region="main">…primary content…</ui-app-shell-region>
</ui-app-shell>`,
  ),
)
content.append(
  para(
    'One nuance ties into isolation (section 5): in the default light-DOM shell the region children stay in the ' +
      'light DOM. When a shell opts into isolated, those same children are RELOCATED into the shadow tree at ' +
      'connect — never <slot>-projected. Either way the composition you author is identical; only where the nodes ' +
      'live differs.',
  ),
)

// ════════════════ 3 · The role system + the decouple ════════════════
content.append(sectionHeading('3 · The role system — and decoupling it from the column'))
content.append(
  para(
    'By default, region drives TWO things at once: the grid column AND the ARIA landmark. A region sets its ' +
      'landmark role through ElementInternals (never a host role attribute), reactively — the region name is the ' +
      'landmark name, 1:1 (navigation → role="navigation", complementary → role="complementary", and so on).',
  ),
)
content.append(
  para(
    'That fusion breaks down when the right COLUMN for a surface is the wrong LANDMARK for it. The canonical case ' +
      'is a chat composer: it belongs in the left column (region="navigation") but reads correctly to assistive ' +
      'tech as complementary, not navigation. The optional ',
    code('landmark'),
    ' prop overrides the role INDEPENDENTLY of the column. The resolution is ',
    code('internals.role = landmark || REGION_ROLE[region]'),
    ' — the || (not ??) is load-bearing, because the unset value is the falsy empty string, which must fall ' +
      'through to the region default.',
  ),
)
content.append(
  demoShell([
    region('navigation', 'navigation column', 'region="navigation" + landmark="complementary" — LEFT column, but role="complementary".', {
      landmark: 'complementary',
    }),
    region('main', 'main', 'The primary content the composer sits beside.'),
  ]),
)
content.append(
  para(
    'Reach for landmark whenever the layout column you want and the landmark semantics you want diverge — a chat ' +
      'composer, a filters rail that is really a form, a table of contents that reads as navigation from the ' +
      'complementary column. Absent (the default empty string) leaves every existing region-only usage unchanged: ' +
      'no migration. Author responsibility: exactly one main landmark per document — the generic element cannot ' +
      'enforce that cross-instance. This is the exact pattern the ',
    (() => {
      const a = document.createElement('a')
      a.href = './a2ui-live.html'
      a.textContent = 'A2UI live-agent page'
      return a
    })(),
    " uses for its chat pane.",
  ),
)

// ════════════════ 4 · The narrow-reflow (collapse) system ════════════════
content.append(sectionHeading('4 · The narrow-reflow system'))
content.append(
  para(
    'ui-app-shell establishes its own query container (container-type: inline-size) and reflows on ITS OWN width, ' +
      'never the viewport — there are no breakpoint props. Below a 40rem inline-size threshold the grid collapses ' +
      'to a single column (banner / main / footer stacked), and the two side regions resolve their fate through ' +
      'their own reflected ',
    code('collapse'),
    ' prop.',
  ),
)
content.append(
  para(
    code('collapse="hide"'),
    ' (the default, today\'s back-compat behaviour) sets display:none narrow — right for a secondary rail. ',
    code('collapse="stack"'),
    ' opts a region OUT of hiding: it stays visible and spans the full single column, in DOM order — so a region ' +
      'carrying essential, interactive content (a chat composer) never becomes unreachable when narrow. Drag the ' +
      'handle at the bottom-right of the frame below narrower than 40rem to watch it reflow live:',
  ),
)
const collapseDemo = el('div', 'as-resize')
collapseDemo.append(
  demoShell([
    region('banner', 'banner', 'Full-width top bar — kept in the single column.'),
    region('navigation', 'navigation · collapse="hide"', 'The default: this side region hides below 40rem.'),
    region('main', 'main', 'The primary content — always kept.'),
    region('complementary', 'complementary · collapse="stack"', 'Opts out of hiding: stays visible and spans the full width narrow.', {
      collapse: 'stack',
    }),
    region('contentinfo', 'contentinfo', 'Full-width footer — kept in the single column.'),
  ]),
)
content.append(collapseDemo, el('p', 'as-caption', '↑ Drag the resize handle (bottom-right) below 40rem. navigation vanishes; the stacked complementary region stays, full width.'))
content.append(
  para(
    'The full-width guarantee is HARDENED: the stack rule also sets inline-size:auto and margin-inline:0, so a ' +
      "consumer's own fixed width on a docked region (e.g. a wide-layout sidebar sized off its region, unrelated " +
      'to collapse) cannot fight the span. The shell neutralizes it itself — out-specifying a bare page-CSS class ' +
      'rule, and reaching a region even when it has been relocated under isolation (where a page stylesheet cannot ' +
      'reach at all).',
  ),
)
content.append(
  para(
    'Residual limit worth knowing: the hardening neutralizes inline-size and inline margins, but NOT a ',
    code('min-inline-size'),
    ' / ',
    code('max-inline-size'),
    ' cap. If you put such a cap on a stacked region, you still need your own narrow override to release it below ' +
      '40rem. And ',
    code('collapse="toggle"'),
    ' is a RESERVED future value (a collapse-behind-an-affordance) — not built today; writing it now falls back to ' +
      'hide via the ordinary out-of-set coercion.',
  ),
)

// ════════════════ 5 · Isolation (opt-in, per instance) ════════════════
content.append(sectionHeading('5 · Isolation — opt-in style encapsulation'))
content.append(
  para(
    'The advanced, opt-in mechanism. ',
    code('isolated'),
    ' (a reflected boolean, default false) puts one shell instance behind a shadow boundary. Default (off) is ' +
      "exactly today's light-DOM composition, byte-identical to a shell built with no isolation code path. When " +
      'true, the shell attaches a shadow root at connect, injects the fleet stylesheets (foundation + component ' +
      'styles) and the shell grid INSIDE the boundary, and relocates the authored regions into the shadow tree.',
  ),
)
content.append(
  demoShell(
    [
      region('banner', 'banner (isolated)', 'This instance carries isolated — its regions live in a shadow root.'),
      region('main', 'main', 'The mandatory region, placed by the injected :host grid mirror.'),
      region('complementary', 'complementary', 'Placed by the same in-shadow grid.'),
    ],
    { isolated: true },
  ),
)
content.append(
  para(
    "Notice this demo shell looks plainer than the ones above: this page's own .as-region demo styling is a " +
      'document stylesheet, and it CANNOT reach across the shadow boundary — that is the encapsulation working. ' +
      'What DOES pierce it is the fleet: the injected foundation tokens/roles and component styles re-match the ' +
      'shadow content, so any ui-* control you compose inside still renders correctly. The trade-off is exactly ' +
      "that: per-instance style isolation from the host page, at the cost of the host page's own CSS not reaching " +
      'in.',
  ),
)
content.append(
  para(
    'Two constraints: isolation is CONNECT-TIME only — a shadow root cannot be detached, so toggling isolated after ' +
      'connect logs a warning and takes effect only on the next re-connect; and at M1 composition is STATIC — only ' +
      'children present at connect are relocated (a region appended to an isolated shell afterward stays in the ' +
      'light DOM).',
  ),
)

// ════════════════ API reference — DERIVED from the two descriptors ════════════════
content.append(sectionHeading('API reference'))
content.append(
  para(
    'Read straight from the shipped descriptors (app-shell.md · app-shell-region.md) through the same parser the ' +
      "package's contract trip-wire validates — these tables cannot drift from the components.",
  ),
)

const shellDoc = parseDoc(shellMd)
const regionDoc = parseDoc(regionMd)

// Each element's derived tables render at heading level 4, so they nest under the h3 tag label above — keeping
// the outline monotonic (h2 API reference → h3 ui-app-shell → h4 Attributes/Properties → h3 … → h4 …). The
// shared renderers default to level 2, so every composeDocPage control doc page is unchanged (F1 fix).
content.append(el('h3', 'as-api-tag', 'ui-app-shell'))
if (shellDoc.descriptor.attributes.length > 0) content.append(renderApiTable(shellDoc.descriptor.attributes, 4))
{
  const props = renderPropertiesTable(shellDoc.descriptor, 4)
  if (props) content.append(props)
}

content.append(el('h3', 'as-api-tag', 'ui-app-shell-region'))
if (regionDoc.descriptor.attributes.length > 0) content.append(renderApiTable(regionDoc.descriptor.attributes, 4))
{
  const props = renderPropertiesTable(regionDoc.descriptor, 4)
  if (props) content.append(props)
}

// Provenance (TKT-0053): the decisions behind sections 3–5, previously cited inline in their own headings,
// now live here only — HAND-AUTHORED, not derivable from any canonical index.
const changelog = renderChangelogTable([
  { date: '2026-07-05', type: 'Decision', id: 'ADR-0082', summary: 'Per-instance style isolation: shadow root at connect, fleet CSS injected inside the boundary.' },
  { date: '2026-07-06', type: 'Decision', id: 'ADR-0083', summary: "Decoupled a region's grid column from its ARIA landmark via the optional landmark prop." },
  { date: '2026-07-06', type: 'Decision', id: 'ADR-0084', summary: 'Established the narrow-reflow strategy: per-region collapse (hide | stack) below a 40rem threshold.' },
])
if (changelog) content.append(changelog)
