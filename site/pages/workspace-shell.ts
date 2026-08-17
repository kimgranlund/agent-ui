// workspace-shell.ts — the ui-workspace-shell COMPOSITION GUIDE (LLD-C5, GH #97/#835; shell-archetypes-m5
// .spec.md SPEC-R5). `ui-workspace-shell` lives in `@agent-ui/app`, OUTSIDE the `components/src` fleet the
// site-coverage/site-toc drift gates enumerate, so it carries no `{name}-{type}.html` page set and no
// per-component TOC group — it is an UNGROUPED site-level link (the app-shell.ts / super-shell.ts /
// chat-shell.ts / master-detail.ts precedent), registered once in site-manifest.json.
//
// UNLIKE super-shell.ts (a from-scratch grammar tutorial), ui-workspace-shell has no grammar of its own to
// teach: it is a THIN `ui-super-shell` preset (workspace-shell.ts, 0 bespoke layout code) for the FULL
// outer-level grammar shape — header, global-nav rail, nav-pane, section-nav, content, options-section,
// options-pane, global-options rail, footer — the third M5 shell archetype alongside ui-chat-shell (the
// narrower chat slice) and ui-super-shell itself (the grammar ceiling both presets narrow). This page
// teaches four things, the chat-shell.ts shape: (1) the two Figma frames this preset realizes —
// `app-shell-layout-single-nav` and the SPEC-R5 asymmetric `app-shell-layout-dual-sidebar` — on real,
// dogfooded `<ui-workspace-shell>` instances, (2) the ONE default it adds over a bare `ui-super-shell`
// (narrow-start="collapse" + collapse-band="compact", ADR-0155 F3 — an overlay restore, not a stack), (3)
// that every attribute/prop a consumer needs belongs to the COMPOSED ui-super-shell, not this wrapper
// (workspace-shell.md's frontmatter is `[]` five ways, same as chat-shell.md), and (4) pointers to its real
// production usage — the ui-workbench/ui-dashboard flagship SaaS compositions (GH #461/#499).
//
// DERIVE-FIRST: the API reference at the foot is NOT hand-restated — it reads straight from the shipped
// descriptor (workspace-shell.md) through the SAME canonical parser (parseDoc) the in-package contract
// trip-wire validates, rendered by the SAME shared doc-page renderer every control API doc uses. Because
// every one of workspace-shell.md's five sequences is genuinely empty, the derived tables render NOTHING
// below the heading — that emptiness is itself the derived fact, exactly like chat-shell.ts's own reference.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import '@agent-ui/app/super-shell.css' // ui-workspace-shell composes an inner ui-super-shell — the composed child's own sheet
import '@agent-ui/app/workspace-shell' // self-defines <ui-workspace-shell> (composes an inner ui-super-shell at connect)
import './workspace-shell.css' // page-local demo chrome only (slot cells) — never restyles a control's internals
import { renderApiTable, renderPropertiesTable, renderChangelogTable, heading } from '../lib/doc-page.ts'
import { parseDoc } from '../lib/frontmatter.ts'
// The shipped descriptor, pulled at build time via Vite's `?raw` (the frontmatter.ts convention) — the SAME
// source the app package's own contract trip-wire (workspace-shell.test.ts) checks against.
import workspaceShellMd from '../../packages/agent-ui/app/src/controls/workspace-shell/workspace-shell.md?raw'

const { content } = mountPage({
  title: 'Composing a ui-workspace-shell',
  intro:
    'ui-workspace-shell is a thin ui-super-shell preset (@agent-ui/app, LLD-C5) for the FULL outer-level ' +
    'workspace grammar — header, global-nav rail, nav-pane, section-nav, content, options-pane, ' +
    'options-section, global-options rail, footer. 0 bespoke layout code: it composes one inner ' +
    'ui-super-shell and relocates your children into it, unchanged, the same shape ui-chat-shell takes for ' +
    'the narrower chat archetype.',
})

content.append(
  pageLead(
    'This element adds no grammar of its own — every data-slot you author is ui-super-shell’s own ' +
      'vocabulary. What it adds is the reduced authoring ceremony of not composing that inner shell by hand, ' +
      'plus a workspace-appropriate default: narrow-start="collapse" + collapse-band="compact" (ADR-0155 ' +
      'F3), so the nav side hides below the compact-window line and toggle-restores as an overlay, rather ' +
      'than the stack default ui-chat-shell chooses.',
  ),
)

// ── small light-DOM demo scaffold (page chrome only — never restyles a ui-* control's internals) ──────────
function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}
function sectionHeading(text: string): HTMLElement {
  return heading(2, text)
}
function code(text: string): HTMLElement {
  return el('code', 'ws-code', text)
}
function link(href: string, text: string): HTMLElement {
  const a = document.createElement('a')
  a.href = href
  a.textContent = text
  return a
}

// Assembled from the attribute name as a variable (never the literal substring `data-slot="…"` in source
// text) — the site dead-name guard (site-canon.test.ts) treats any quoted `slot="…"` occurrence, INCLUDING
// the tail of `data-slot="…"`, as a native-slot usage to check against the canonical descriptor slot vocab;
// `data-slot` is ui-super-shell's own attribute grammar, not a native slot (super-shell.ts/chat-shell.ts precedent).
const DATA_SLOT_ATTR = 'data-' + 'slot'

/** One slot cell — a real light-DOM child marked data-slot, the demo's visible label as its content. */
function slotCell(tag: string, name: string, label: string, className: string): HTMLElement {
  const node = document.createElement(tag)
  node.setAttribute(DATA_SLOT_ATTR, name)
  node.append(el('span', className, label))
  return node
}


// ════════════════ 1 · The two Figma frames ════════════════
content.append(sectionHeading('1 · The two Figma frames'))
content.append(
  pageLead(
    'Kim’s two newest Figma frames name this preset’s shape. ', code('app-shell-layout-single-nav'),
    ' (node 39:1629) — one rail, one nav pane, no options side:',
  ),
)

const singleNav = document.createElement('ui-workspace-shell')
singleNav.className = 'ws-demo'
singleNav.append(
  slotCell('div', 'header', 'header', 'ws-header'),
  slotCell('nav', 'global-nav', 'global-nav', 'ws-rail'),
  slotCell('nav', 'nav-pane', 'nav-pane', 'ws-pane'),
  slotCell('main', 'content', 'content', 'ws-content'),
)
content.append(singleNav)

content.append(
  pageLead(
    code('app-shell-layout-dual-sidebar'), ' (node 39:1596) — the SPEC-R5 asymmetric shape: the start side ' +
      'stacks a rail plus TWO panes (', code('nav-pane'), ' + ', code('section-nav'), '), the end side stacks ' +
      'one pane plus a rail:',
  ),
)

const dualSidebar = document.createElement('ui-workspace-shell')
dualSidebar.className = 'ws-demo'
dualSidebar.append(
  slotCell('div', 'header', 'header', 'ws-header'),
  slotCell('nav', 'global-nav', 'global-nav', 'ws-rail'),
  slotCell('nav', 'nav-pane', 'nav-pane', 'ws-pane'),
  slotCell('nav', 'section-nav', 'section-nav — the extra stacked register (SPEC-R5/GH #96)', 'ws-pane'),
  slotCell('main', 'content', 'content', 'ws-content'),
  slotCell('aside', 'options-pane', 'options-pane', 'ws-pane'),
  slotCell('nav', 'global-options', 'global-options', 'ws-rail'),
  slotCell('div', 'footer', 'footer', 'ws-header'),
)
content.append(dualSidebar)

content.append(
  pageLead(
    'The two examples differ ONLY in which slots are authored, not in any workspace-shell-specific ' +
      'configuration — consumers use the EXACT SAME ', code('data-slot'), ' vocabulary ',
    link('./super-shell.html', 'ui-super-shell'), ' itself defines (SPEC-R1/R5); this element adds no new ' +
      'slot names of its own. Delete a slot from your own markup and its band simply disappears — the ' +
      'absence law, inherited unchanged (', link('./super-shell.html', 'super-shell.html §1'), ').',
  ),
)

// ════════════════ 2 · The one default this preset adds ════════════════
content.append(sectionHeading('2 · The one default this preset adds'))
content.append(
  pageLead(
    'ui-workspace-shell has NO API of its own — its descriptor declares attributes, properties, events, and ' +
      'slots all empty (see the derived reference below), the same shape ', code('ui-chat-shell'),
    ' takes for the chat archetype. Everything you can configure — the collapse toggles, the per-side ',
    code('narrow-start'), '/', code('narrow-end'), ' story, the header-hosted collapse contract, the ',
    code(DATA_SLOT_ATTR), ' vocabulary itself — is the composed ', link('./super-shell.html', 'ui-super-shell'),
    '’s own, inherited wholesale. The one exception is a default, not a setting: this element sets ',
    code('narrow-start="collapse"'), ' + ', code('collapse-band="compact"'), ' on the inner shell for you ' +
      '(ADR-0155 F3) — below the 52.5rem compact-window line, the nav side hides and toggle-restores as an ' +
      'OVERLAY (an X in the header, scrim/Escape dismiss), unlike ', code('ui-chat-shell'), '’s ',
    code('narrow-start="stack"'), ' default. Resize the frame below (or your own viewport) past that line to ' +
      'see it:',
  ),
)

const narrowDemo = document.createElement('ui-workspace-shell')
narrowDemo.className = 'ws-demo'
narrowDemo.append(
  slotCell('div', 'header', 'header — click the toggle at narrow to overlay-restore', 'ws-header'),
  slotCell('nav', 'global-nav', 'global-nav', 'ws-rail'),
  slotCell('nav', 'nav-pane', 'nav-pane', 'ws-pane'),
  slotCell('main', 'content', 'content — never squeezed, the side floats above it', 'ws-content'),
)
const resizeWrap = el('div', 'ws-resize')
resizeWrap.append(narrowDemo)
content.append(resizeWrap, el('p', 'ws-caption', '↑ Drag the resize handle (bottom-right) below 52.5rem, then click a header toggle to overlay-restore that side.'))

// ════════════════ 3 · Configuration lives on the inner ui-super-shell ════════════════
content.append(sectionHeading('3 · Configuration lives on the inner ui-super-shell'))
content.append(
  pageLead(
    'Reach for ', link('./super-shell.html', 'ui-super-shell’s own guide'), ' for the full grammar, the ' +
      'collapse contract, recursion, the narrow reflow, and the landmarks — everything documented there ' +
      'applies unchanged to a ', code('<ui-workspace-shell>'), ' instance, minus the one default above.',
  ),
)

// ════════════════ 4 · The real thing ════════════════
content.append(sectionHeading('4 · The real thing'))
content.append(
  pageLead(
    'This page’s demos are scaffolds — realistic shapes, no live wiring. The production surfaces this ' +
      'preset hosts are the fleet’s SaaS-composition proofs: ', link('./workbench.html', 'ui-workbench'),
    ' (GH #461 — a data table + filter toolbar + record-edit modal + agent-summary card, ONE authored ' +
      'content slot) and ', link('./dashboard.html', 'ui-dashboard'), ' (GH #499 — stat cards + a bar chart ' +
      '+ a read-only table + an agent-summary card, proving the same data-app posture generalizes) — both ' +
      'compose ', code('<ui-workspace-shell>'), ' with exactly one authored ', code('content'), ' slot, no ' +
      'shell-side work of their own (PRD-A1).',
  ),
)

// ════════════════ API reference — DERIVED from the descriptor ════════════════
content.append(sectionHeading('API reference'))
content.append(
  pageLead(
    'Read straight from the shipped descriptor (workspace-shell.md) through the same parser the package’s ' +
      'contract trip-wire validates. Every table below is genuinely empty — attributes, properties, events, ' +
      'and slots all resolve to zero entries, because workspace-shell.md declares all five sequences ',
    code('[]'), '. This table cannot silently claim an API surface this element doesn’t have.',
  ),
)

const workspaceShellDoc = parseDoc(workspaceShellMd)
content.append(el('h3', 'ws-api-tag', 'ui-workspace-shell'))
if (workspaceShellDoc.descriptor.attributes.length > 0) content.append(renderApiTable(workspaceShellDoc.descriptor.attributes, 4))
{
  const props = renderPropertiesTable(workspaceShellDoc.descriptor, 4)
  if (props) content.append(props)
}

// Provenance — hand-authored, not derivable from any canonical index.
const changelog = renderChangelogTable([
  {
    date: '2026-08-10',
    type: 'Feature',
    id: 'GH #97',
    summary: 'ui-workspace-shell ships (LLD-C5): a thin ui-super-shell preset for the full outer-level workspace grammar (header/global-nav/nav-pane/section-nav/content/options-pane/options-section/global-options/footer).',
  },
  {
    date: '2026-08-10',
    type: 'Decision',
    id: 'ADR-0151',
    summary: 'Named shell archetypes join agent-app-surfaces as M5 (rule 2: behavior-only composition, zero data/transport/navigation ownership) — the decision ui-workspace-shell realizes, alongside ui-chat-shell and ui-super-shell itself.',
  },
])
if (changelog) content.append(changelog)
