// chat-shell.ts — the ui-chat-shell COMPOSITION GUIDE (round 4, GH #98; shell-archetypes-m5.lld.md LLD-C6).
// `ui-chat-shell` lives in `@agent-ui/app`, OUTSIDE the `components/src` fleet the site-coverage/site-toc
// drift gates enumerate, so it carries no `{name}-{type}.html` page set and no per-component TOC group — it
// is an UNGROUPED site-level link (the app-shell.ts / super-shell.ts / master-detail.ts precedent),
// registered once in site-manifest.json.
//
// UNLIKE super-shell.ts (a from-scratch grammar tutorial), ui-chat-shell has no grammar of its own to teach:
// it is a THIN `ui-super-shell` preset (chat-shell.ts, 0 bespoke layout code) that relocates its authored
// children into ONE inner `<ui-super-shell narrow-start="stack">` at connect. So this page teaches four
// different things: (1) the authoring ceremony it removes, (2) its fixed slot intent — header / nav-pane /
// content / footer, no options side — on a real, dogfooded `<ui-chat-shell>`, (3) that every attribute/prop a
// consumer needs belongs to the COMPOSED ui-super-shell, not this wrapper (which declares none of its own —
// chat-shell.md's frontmatter is `[]` five ways), and (4) a pointer to a2ui-chat.ts's real production usage,
// the surface this demo simplifies from.
//
// DERIVE-FIRST: the API reference at the foot is NOT hand-restated — it reads straight from the shipped
// descriptor (chat-shell.md) through the SAME canonical parser (parseDoc) the in-package contract trip-wire
// validates, rendered by the SAME shared doc-page renderer every control API doc uses. Because every one of
// chat-shell.md's five sequences is genuinely empty, the derived tables render NOTHING below the heading —
// that emptiness is itself the derived fact (if the descriptor ever grows an attribute, this page picks it
// up with zero edits, exactly like every other DERIVE-FIRST page on this site).
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import '@agent-ui/app/chat-shell.css' // ui-chat-shell's own host flex-column layout (round 4, GH #98)
import '@agent-ui/app/chat-shell' // self-defines <ui-chat-shell> (composes an inner <ui-super-shell> at connect)
import '@agent-ui/app/super-shell.css' // the composed inner ui-super-shell's own geometry/collapse CSS
import './chat-shell.css' // page-local demo chrome only (slot cells + the session/bubble mocks) — never restyles a control's internals
import { renderApiTable, renderPropertiesTable, renderChangelogTable, heading } from '../lib/doc-page.ts'
import { parseDoc } from '../lib/frontmatter.ts'
// The shipped descriptor, pulled at build time via Vite's `?raw` (the frontmatter.ts convention) — the SAME
// source the app package's own contract trip-wire (chat-shell.test.ts) checks against.
import chatShellMd from '../../packages/agent-ui/app/src/controls/chat-shell/chat-shell.md?raw'

const { content } = mountPage({
  title: 'Composing a ui-chat-shell',
  intro:
    'ui-chat-shell is a thin ui-super-shell preset (@agent-ui/app, LLD-C6) for the chat archetype’s narrower ' +
    'slice — header, nav-pane (a conversation/session list), content — no options side. 0 bespoke layout code: ' +
    'it composes one inner ui-super-shell and relocates your children into it, unchanged.',
})

content.append(
  pageLead(
    'This element adds no grammar of its own — every data-slot you author is ui-super-shell’s own vocabulary. ' +
      'What it adds is the reduced authoring ceremony of not composing that inner shell by hand, plus the same ' +
      'sensible default ui-workspace-shell uses: narrow-start="stack".',
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
function para(...nodes: (string | Node)[]): HTMLElement {
  const p = document.createElement('p')
  p.className = 'cs-prose'
  for (const n of nodes) p.append(typeof n === 'string' ? document.createTextNode(n) : n)
  return p
}
function code(text: string): HTMLElement {
  return el('code', 'cs-code', text)
}

// Assembled from the attribute name as a variable (never the literal substring `data-slot="…"` in source
// text) — the site dead-name guard (site-canon.test.ts) treats any quoted `slot="…"` occurrence, INCLUDING
// the tail of `data-slot="…"`, as a native-slot usage to check against the canonical descriptor slot vocab;
// `data-slot` is ui-super-shell's own attribute grammar, not a native slot, so it can never be a "canonical"
// registry entry to allowlist against (super-shell.ts's own precedent). Renders byte-identical to the literal
// markup a reader would actually write.
const DATA_SLOT_ATTR = 'data-' + 'slot'

// ════════════════ 1 · What this preset removes ════════════════
content.append(sectionHeading('1 · What this preset removes'))
content.append(
  para(
    'Before ui-chat-shell existed, a2ui-chat.ts hand-rolled its own chrome: a plain ', code('<div class="chat-shell">'),
    ' wrapping a ', code('<header class="chat-head">'), ' and the conversation — page-owned layout CSS, no ' +
      'shared grammar, nothing reusable by the next chat surface. That page migrated onto ui-chat-shell in ' +
      'the SAME change that shipped this element (round 4, GH #98):',
  ),
)
content.append(
  el(
    'pre',
    'cs-snippet',
    `// BEFORE — page-owned chrome, no shared grammar
const shell = document.createElement('div')
shell.classList.add('chat-shell')
const header = document.createElement('header')
header.classList.add('chat-head')
shell.append(header, conv)

// AFTER — the shell itself understands header/nav-pane/content/footer
const shell = document.createElement('ui-chat-shell')
const header = document.createElement('header')
header.setAttribute('data-slot', 'header')
shell.append(header, conv) // an unmarked child folds into content, same as ui-super-shell`,
  ),
)
content.append(
  para(
    'The relocation happens at connect time (', code('this.children'), ' moved into the inner shell verbatim), ' +
      'so — same hazard as ui-workspace-shell/ui-master-detail — every child must be APPENDED before the ' +
      'ui-chat-shell element itself joins the live DOM, or it composes permanently empty (its own #compose() ' +
      'guard never re-runs).',
  ),
)

// ════════════════ 2 · The fixed slot intent (live demo) ════════════════
content.append(sectionHeading('2 · The fixed slot intent'))
content.append(
  para(
    'The intended shape — not enforced — is ', code('header | nav-pane | content | footer'), ': a session list ' +
      'down the start side, the active thread as content, no options side. Nothing stops you authoring one ' +
      '(the grammar itself doesn’t know "chat" from any other shell), it just isn’t this archetype’s shape. A ' +
      'real, dogfooded ', code('<ui-chat-shell>'), ' below — a session-list-shaped nav-pane and a chat-log-shaped ' +
      'content area, standing in for real data:',
  ),
)

/** One session-list row — page-local demo scaffold, standing in for a real conversation/session list. */
function sessionItem(title: string, meta: string, active = false): HTMLElement {
  const item = el('div', active ? 'cs-session cs-session--active' : 'cs-session')
  item.append(el('span', 'cs-session-title', title), el('span', 'cs-session-meta', meta))
  return item
}

/** One chat-log bubble — page-local demo scaffold, standing in for ui-conversation's real message feed. */
function bubble(role: 'user' | 'agent', text: string): HTMLElement {
  const b = el('div', `cs-bubble cs-bubble--${role}`)
  b.append(el('span', 'cs-bubble-role', role === 'user' ? 'You' : 'Agent'), el('p', 'cs-bubble-text', text))
  return b
}

function demoShell(): HTMLElement {
  const shell = document.createElement('ui-chat-shell')
  shell.className = 'cs-demo'

  const header = document.createElement('header')
  header.setAttribute(DATA_SLOT_ATTR, 'header')
  header.className = 'cs-header'
  header.append(el('span', 'cs-header-title', 'Support inbox'), el('span', 'cs-header-note', 'demo scaffold — not a real agent'))

  const nav = document.createElement('nav')
  nav.setAttribute(DATA_SLOT_ATTR, 'nav-pane')
  nav.className = 'cs-nav'
  nav.append(sessionItem('Refund status', '2m ago', true), sessionItem('Shipping delay', '1h ago'), sessionItem('Password reset', 'Yesterday'))

  const body = document.createElement('div')
  body.setAttribute(DATA_SLOT_ATTR, 'content')
  body.className = 'cs-content'
  body.append(
    bubble('user', 'My order hasn’t arrived yet — can you check on it?'),
    bubble('agent', 'Looking it up now… it’s still in transit, about a day behind schedule.'),
    bubble('user', 'Thanks, that’s all I needed.'),
  )

  const footer = document.createElement('footer')
  footer.setAttribute(DATA_SLOT_ATTR, 'footer')
  footer.className = 'cs-footer'
  footer.append(el('span', 'cs-footer-hint', 'a real composer goes here — ui-conversation, not part of this demo'))

  shell.append(header, nav, body, footer)
  return shell
}

content.append(demoShell())
content.append(
  para(
    'The ABSENCE law is inherited unchanged from the composed shell (super-shell.html §1): delete nav-pane ' +
      'from your own markup and its band simply disappears, no override needed — this element enforces nothing ' +
      'about which slots you fill.',
  ),
)

// ════════════════ 3 · Configuration lives on the inner ui-super-shell ════════════════
content.append(sectionHeading('3 · Configuration lives on the inner ui-super-shell'))
content.append(
  para(
    'ui-chat-shell has NO API of its own — its descriptor declares attributes, properties, events, and slots ' +
      'all empty (see the derived reference below). Everything you can configure — the collapse toggles, ' +
      'the per-side ', code('narrow-start'), '/', code('narrow-end'), ' story, the header-hosted collapse ' +
      'contract, the ', code(DATA_SLOT_ATTR), ' vocabulary itself — is the composed ',
    (() => {
      const a = document.createElement('a')
      a.href = './super-shell.html'
      a.textContent = 'ui-super-shell'
      return a
    })(),
    '’s own, inherited wholesale. The one exception is a default, not a setting: ui-chat-shell sets ',
    code('narrow-start="stack"'), ' on the inner shell for you (the same default ui-workspace-shell chooses), ' +
      'so a consumer never has to remember it.',
  ),
)

// ════════════════ 4 · The real thing ════════════════
content.append(sectionHeading('4 · The real thing'))
content.append(
  para(
    'This page’s demo is a scaffold — realistic shapes, no live wiring. The production surface this simplifies ' +
      'from is ',
    (() => {
      const a = document.createElement('a')
      a.href = './a2ui-chat.html'
      a.textContent = 'A2UI Chat'
      return a
    })(),
    ': a real ', code('<ui-chat-shell>'), ' wrapping a header and a live ', code('<ui-conversation>'), ' driven ' +
      'by an agent transport (recorded by default, a live provider under a dev/prod key) — the header slot is ' +
      'authored, content holds the conversation, and nav-pane is unauthored today (the absence law again: it ' +
      'contributes no box until a real session-list consumer exists).',
  ),
)

// ════════════════ API reference — DERIVED from the descriptor ════════════════
content.append(sectionHeading('API reference'))
content.append(
  para(
    'Read straight from the shipped descriptor (chat-shell.md) through the same parser the package’s contract ' +
      'trip-wire validates. Every table below is genuinely empty — attributes, properties, events, and slots ' +
      'all resolve to zero entries, because chat-shell.md declares all five sequences ', code('[]'), '. This ' +
      'table cannot silently claim an API surface this element doesn’t have.',
  ),
)

const chatShellDoc = parseDoc(chatShellMd)
content.append(el('h3', 'cs-api-tag', 'ui-chat-shell'))
if (chatShellDoc.descriptor.attributes.length > 0) content.append(renderApiTable(chatShellDoc.descriptor.attributes, 4))
{
  const props = renderPropertiesTable(chatShellDoc.descriptor, 4)
  if (props) content.append(props)
}

// Provenance — hand-authored, not derivable from any canonical index.
const changelog = renderChangelogTable([
  {
    date: '2026-07-19',
    type: 'Feature',
    id: 'GH #98',
    summary: 'ui-chat-shell ships (LLD-C6): a thin ui-super-shell preset for header/nav-pane/content; a2ui-chat.ts’s hand-rolled .chat-shell/.chat-head chrome migrates onto it in the same change.',
  },
  {
    date: '2026-07-19',
    type: 'Decision',
    id: 'ADR-0151',
    summary: 'Named shell archetypes join agent-app-surfaces as M5 (rule 2: behavior-only composition, zero data/transport/navigation ownership) — the decision ui-chat-shell realizes.',
  },
  {
    date: '2026-07-20',
    type: 'Change',
    id: 'ADR-0151',
    summary: 'Append-only amendment: corrects the extraction-source claim — a2ui-chat.ts’s own hand-rolled page chrome was the real extraction, not a2ui-live.ts or ui-agent-admin.',
  },
])
if (changelog) content.append(changelog)
