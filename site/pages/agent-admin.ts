// site/pages/agent-admin.ts — the ui-agent-admin COMPOSITION GUIDE (the master-detail.ts/settings.ts
// site-page precedent, ported): `ui-agent-admin` lives in `@agent-ui/app`, OUTSIDE the `components/src`
// fleet the site-coverage/site-toc drift gates enumerate, so it carries no `{name}-{type}.html` page set
// and no per-component TOC group — it is an UNGROUPED site-level link (added once to `_page.ts` NAV).
//
// DERIVE-FIRST: the API table at the foot is read straight from the shipped descriptor (agent-admin.md)
// through the SAME canonical parser every control API doc uses. What is hand-authored is the teaching
// prose + the live example (a real `<ui-agent-admin>`, its own default schema + a real localStorage-
// backed store, dogfooded so the reader can edit a setting/prompt, submit, and see the stub reply cite it).
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls
import '@agent-ui/components/component-styles.css' // ui-split/ui-text-field/ui-switch/etc.'s shipped CSS (composed transitively)
import '@agent-ui/code/editor.css' // ADR-0139 — ui-code-editor's own sheet (the entry editors' frame + CM highlight tokens)
import '@agent-ui/app/master-detail-pane.css'
import '@agent-ui/app/master-detail.css'
import '@agent-ui/app/nav-rail.css'
import '@agent-ui/app/settings.css'
import '@agent-ui/app/conversation.css'
import '@agent-ui/app/conversation-composer.css' // TKT-0056 — the composed ui-conversation-composer's own layout/parts CSS
import '@agent-ui/app/surface-host.css'
import '@agent-ui/app/agent-admin.css'
import '@agent-ui/app/master-detail-pane' // self-defines ui-master-detail-pane (composed by ui-settings)
import '@agent-ui/app/master-detail' // self-defines ui-master-detail (composed by ui-settings)
import '@agent-ui/app/nav-rail' // self-defines ui-nav-rail(-group|-item) (composed by ui-settings)
import '@agent-ui/app/settings' // self-defines ui-settings
import '@agent-ui/app/surface-host' // self-defines ui-surface-host (composed by ui-conversation)
import '@agent-ui/app/conversation' // self-defines ui-conversation
import '@agent-ui/app/agent-admin' // self-defines ui-agent-admin
import './agent-admin.css' // page-local demo chrome only (the resizable frame) — never restyles a control's internals
import { renderApiTable, renderPropertiesTable, renderChangelogTable, heading } from '../lib/doc-page.ts'
import { parseDoc } from '../lib/frontmatter.ts'
import agentAdminMd from '../../packages/agent-ui/app/src/controls/agent-admin/agent-admin.md?raw'
import { createMemoryStore } from '@agent-ui/app/settings-memory-store'
import type { UIAgentAdminElement } from '@agent-ui/app/agent-admin'

const { content } = mountPage({
  title: 'Composing a ui-agent-admin surface',
  intro:
    'ui-agent-admin is a live-editable agent config + instructions with a working chat preview — a ' +
    'three-pane ui-split composing ui-settings, ui-conversation, and a generic ordered-entry-list ' +
    'primitive instantiated five times. No new protocol dependency.',
})

content.append(
  pageLead(
    'One shared SettingsStore — every pane reads/writes through it. Editing a setting, a prompt section, ' +
      'or a capability commits immediately; the chat canvas reads the store fresh at the moment each turn ' +
      'begins, so an edit applies to the very next message with no manual reload.',
  ),
)

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

/** A live, dogfooded ui-agent-admin — the default schema + a real localStorage-backed store (reload the
 *  page to see the round-trip: values you change persist under the `docs-agent-admin-demo` key). */
function demo(): UIAgentAdminElement {
  const admin = document.createElement('ui-agent-admin') as UIAgentAdminElement
  admin.className = 'agent-admin-demo'
  admin.store = createMemoryStore({ persistKey: 'docs-agent-admin-demo' })
  return admin
}

// ════════════════ the live-model overlay, probed at runtime in both dev and prod (the a2ui-live.ts
// construction-site precedent: the swap lives HERE in the site page, never in the packaged component). In
// dev it rides `dev-proxy-plugin.ts`'s trust boundary; in production it's the Cloudflare Worker port
// (worker/index.ts, mounted at `/__a2ui/agent` on this same site) — a deliberate SPEC-N2/ADR-0131 cl.4/7
// supersession (those described a build-time DEV-only tree-shake; the boundary they protected — no
// browser-held key — still holds, just enforced by the runtime `/status` probe's graceful degrade to the
// stub instead of a compile-time exclusion). ════════════════════════════════════════════════════════════
function wireLiveOverlay(admin: UIAgentAdminElement, status: HTMLElement): void {
  void (async () => {
    try {
      const overlay = await import('../lib/admin-live-runner.ts')
      const probe = await overlay.probeLive()
      if (probe.available) {
        admin.agentTurn = overlay.createAdminAgentTurn()
        status.textContent = `Live model connected (${probe.providers} provider(s)) — replies are real model output. Edit a setting, prompt, or capability and send: it applies to the next turn.`
      } else if (import.meta.env.DEV) {
        status.textContent = 'Stub preview — set a provider key in .env and restart `npm run dev` for a real live model.'
      } else {
        status.textContent = 'Stub preview — the shipped build makes no live model call.'
      }
    } catch {
      status.textContent = 'Stub preview — the live overlay is unavailable.'
    }
  })()
}

content.append(sectionHeading('1 · One primitive, five instantiations'))
content.append(
  para(
    'Left to right: the chat canvas (', code('ui-conversation'), ') and the tabbed config region ' +
      '(vision rev.5) — the Settings tab stacks the Agent config (', code('ui-settings'),
    ') with its ACTIVE master switch, the model grid, a generic ordered-entry-list seeded with three ' +
      'built-in prompt sections (Foundation/Personality/Critical Items, each toggleable, none ' +
      'deletable), and four MORE instances of that same entry-list primitive — Skills, Workflows, ' +
      'Resources, Tools — each unseeded, custom-authorable, and master-switchable; the Context tab is ' +
      'the read-only introspection surface (the compiled Agent System JSON + the Dialog Turns payload ' +
      'log). Toggle a section off, ' +
      'add a custom skill, then send a message — the reply is a deterministic stub that visibly cites ' +
      'the composed prompt AND every enabled capability, proving the wiring without a live model call: ' +
      'the shipped build makes no external network dependency.',
  ),
)
const resizeFrame = el('div', 'agent-admin-resize')
const adminEl = demo()
resizeFrame.append(adminEl)
const liveStatus = el('p', 'as-caption', 'Stub preview — the shipped build makes no live model call.')
content.append(resizeFrame, el('p', 'as-caption', '↑ Reload the page after changing a value — it persists via the store.'), liveStatus)
wireLiveOverlay(adminEl, liveStatus)

content.append(sectionHeading('2 · Live-apply is a fresh read, not a push'))
content.append(
  para(
    'No propagation channel exists because none is needed: every commit lands in the shared store ' +
      'immediately (per-field-on-change), and the stub turn loop reads every entry list fresh at the ' +
      'moment each turn begins — composing the enabled prompt sections into one string and gathering ' +
      'each capability kind\'s enabled labels — always the current values, never a cached snapshot.',
  ),
)

content.append(el('pre', 'as-snippet', `const el = document.querySelector('ui-agent-admin')
el.store = createMemoryStore({ persistKey: 'my-app-agent-admin' })
// or supply your own schema:
el.schema = {
  version: 1,
  sections: [{ id: 'agent', label: 'Agent', fields: [
    { key: 'name', type: 'text', label: 'Name', default: 'My agent' },
  ] }],
}`))

content.append(sectionHeading('API reference'))
content.append(
  para(
    'Read straight from the shipped descriptor (agent-admin.md) through the same parser the package’s ' +
      'contract trip-wire validates.',
  ),
)

const agentAdminDoc = parseDoc(agentAdminMd)
if (agentAdminDoc.descriptor.attributes.length > 0) content.append(renderApiTable(agentAdminDoc.descriptor.attributes, 4))
{
  const props = renderPropertiesTable(agentAdminDoc.descriptor, 4)
  if (props) content.append(props)
}

// Provenance (TKT-0053): the build/decision records this page previously cited inline now live here only —
// HAND-AUTHORED, not derivable from any canonical index (no ADR/TKT index cross-links to the pages it built).
const changelog = renderChangelogTable([
  { date: '2026-07-13', type: 'Feature', id: 'TKT-0039', summary: 'Shipped ui-agent-admin: a three-pane composition over ui-settings + ui-conversation, with real persistence.' },
  { date: '2026-07-14', type: 'Decision', id: 'ADR-0131', summary: 'Ratified the scope: a generic self-contained config, three panes, no new protocol dependency.' },
  { date: '2026-07-14', type: 'Decision', id: 'ADR-0132', summary: 'Instructions/settings became one shared ordered-entry-list primitive, instantiated five times across the prompts and settings panes.' },
])
if (changelog) content.append(changelog)
