// site/pages/agent-admin-app.ts — the STANDALONE ui-agent-admin surface (agent-admin-app.html): the full
// live composition filling the viewport with NO docs container shell — no nav, no prose, no resize frame
// (the gallery.ts ungrouped-entry precedent; agent-admin.ts remains the docs COMPOSITION GUIDE and owns
// the teaching page). Deliberately does NOT import './_page.ts' (that IS the docs shell): the foundation
// cascade is imported directly in the same [1]→[3b] order _page.ts documents.
import '@agent-ui/components/foundation-styles.css' // [1] foundation: tokens.css → dimensions.css (FIRST)
import '@agent-ui/components/base-styles.css' // [1b] the DOCUMENT BASE layer: typeface/leading/ink/rendering (shell-less pages need this or they render in the UA serif)
import '@agent-ui/components/component-styles.css' // [2] per-control CSS, after the foundation
import '@agent-ui/code/editor.css' // [2b] ADR-0139 — ui-code-editor's own sheet (the entry editors' frame + CM highlight tokens)
import '@agent-ui/components/components' // [3] self-defining ui-* controls
import '@agent-ui/icons/phosphor' // [3b] the Phosphor default pack — composer/entry-list glyphs render real SVGs
import '@agent-ui/app/master-detail-pane.css'
import '@agent-ui/app/master-detail.css'
import '@agent-ui/app/nav-rail.css'
import '@agent-ui/app/settings.css'
import '@agent-ui/app/conversation.css'
import '@agent-ui/app/conversation-composer.css'
import '@agent-ui/app/surface-host.css'
import '@agent-ui/app/agent-admin.css'
import '@agent-ui/app/master-detail-pane' // self-defines ui-master-detail-pane (composed by ui-settings)
import '@agent-ui/app/master-detail' // self-defines ui-master-detail (composed by ui-settings)
import '@agent-ui/app/nav-rail' // self-defines ui-nav-rail(-group|-item) (composed by ui-settings)
import '@agent-ui/app/settings' // self-defines ui-settings
import '@agent-ui/app/surface-host' // self-defines ui-surface-host (composed by ui-conversation)
import '@agent-ui/app/conversation' // self-defines ui-conversation
import '@agent-ui/app/agent-admin' // self-defines ui-agent-admin
import './agent-admin-app.css' // page-local: full-viewport layout + the preset strip chrome
import type { UIAgentAdminElement } from '@agent-ui/app/agent-admin'
import type { UIButtonElement } from '@agent-ui/components/controls/button'
import { AGENT_PRESETS, ACTIVE_PRESET_KEY, presetStore, resetPreset, type AgentPreset } from './agent-admin-presets.ts'
import { ADMIN_LIBRARIES } from './agent-admin-libraries.ts'

const root = document.querySelector('#app') ?? document.body

// ── the six A2UI-showcase personas (TKT-0074) ─────────────────────────────────────────────────────────────
// Each preset is a persona-scoped store (its own persistKey; edits persist per persona). Switching swaps
// `admin.store` — the component's reactive store effect re-pushes it into the settings pane, rewires every
// entry section, and re-syncs the conversation (agent-admin.ts:162; the store-swap probe pins it).

const admin = document.createElement('ui-agent-admin') as UIAgentAdminElement
// GH #47/#48 — the library packs, set BEFORE the element ever connects (the compose-time capture law
// the `libraries` prop documents).
admin.libraries = ADMIN_LIBRARIES

// ── the canvas-header (GH #51): `[ title | … | agent-menu ]` — replaces the TKT-0074 truncating chip
// row. The active agent NAMES the surface (the title zone); switching moves into a ui-menu (one row per
// preset, never truncated); page actions (Reset persona today) live in the "…" overflow menu. Page-local
// by design — a shared canvas-header COMPONENT is #44/M5's call, not this page's (GH #51 scope note).
const header = document.createElement('header')
header.className = 'canvas-header'
header.setAttribute('aria-label', 'Active agent')

const title = document.createElement('div')
title.className = 'canvas-header-title'
const titleName = document.createElement('span')
titleName.className = 'canvas-header-name'
const titleTagline = document.createElement('span')
titleTagline.className = 'canvas-header-tagline'
title.append(titleName, titleTagline)

let active: AgentPreset =
  AGENT_PRESETS.find((p) => p.id === localStorage.getItem(ACTIVE_PRESET_KEY)) ?? AGENT_PRESETS[0]!

// Armed by the DEV overlay below once a live key probes available; re-invoked per persona switch so each
// persona's SURFACE session (TKT-0076 — the runner closure owns the a2ui transcript) starts clean.
let armSurfaceTurn: (() => void) | undefined

// The agent switcher — ui-menu owns the overlay/roving-focus/type-ahead; this page stages one
// `div[data-value]` row per preset (the menu-demo idiom) and applies the committed selection.
const agentMenu = document.createElement('ui-menu')
agentMenu.className = 'agent-menu'
const agentTrigger = document.createElement('ui-button') as UIButtonElement
agentTrigger.variant = 'soft'
agentTrigger.size = 'sm'
agentMenu.append(agentTrigger)
const agentItems = new Map<string, HTMLElement>()
for (const preset of AGENT_PRESETS) {
  const item = document.createElement('div')
  item.dataset.value = preset.id
  item.textContent = preset.label
  item.title = preset.tagline
  agentItems.set(preset.id, item)
  agentMenu.append(item)
}
agentMenu.addEventListener('select', (event) => {
  const { value } = (event as CustomEvent<{ value: string; index: number }>).detail
  const preset = AGENT_PRESETS.find((p) => p.id === value)
  if (preset) applyPreset(preset)
})

// The "…" overflow — page actions; Reset persona is its one row today (future actions join it here).
const overflowMenu = document.createElement('ui-menu')
overflowMenu.className = 'overflow-menu'
overflowMenu.setAttribute('placement', 'bottom-end')
const overflowTrigger = document.createElement('ui-button') as UIButtonElement
overflowTrigger.variant = 'ghost'
overflowTrigger.size = 'sm'
overflowTrigger.textContent = '…'
overflowTrigger.title = 'Page actions'
// The glyph-only trigger needs a REAL accessible name — title never reaches the accessible name
// (PR #54 review finding; the button.ts glyph-trigger convention).
overflowTrigger.setAttribute('aria-label', 'Page actions')
const resetItem = document.createElement('div')
resetItem.dataset.value = 'reset-persona'
resetItem.textContent = 'Reset persona'
resetItem.title = 'Discard this persona’s edits and reseed it from the preset'
overflowMenu.append(overflowTrigger, resetItem)
overflowMenu.addEventListener('select', (event) => {
  const { value } = (event as CustomEvent<{ value: string; index: number }>).detail
  if (value === 'reset-persona') {
    resetPreset(active)
    applyPreset(active)
  }
})

function applyPreset(preset: AgentPreset): void {
  active = preset
  localStorage.setItem(ACTIVE_PRESET_KEY, preset.id)
  admin.store = presetStore(preset)
  armSurfaceTurn?.()
  titleName.textContent = preset.label
  titleTagline.textContent = preset.tagline
  agentTrigger.textContent = `${preset.label} ▾`
  agentTrigger.title = 'Switch agent'
  for (const [id, item] of agentItems) {
    // The active marker is REAL TEXT (a leading ✓, the platform menu convention) + a data attribute for
    // the CSS weight — NOT aria-checked: these rows are role=menuitem (ui-menu roves over exactly that
    // role, menu.ts:5), and aria-checked is invalid on menuitem (menu.ts:149 documents the same law for
    // aria-selected). Real text is announced by AT for free; a menuitemradio variant is a ui-menu fleet
    // follow-up (filed at #51 close-out), not a page-level hack.
    const isActive = id === preset.id
    const label = AGENT_PRESETS.find((p) => p.id === id)?.label ?? id
    item.textContent = isActive ? `✓ ${label}` : label
    item.toggleAttribute('data-active', isActive)
  }
}

header.append(title, overflowMenu, agentMenu)
applyPreset(active)
root.append(header, admin)

// The DEV-only live-model overlay (the agent-admin.ts/a2ui-live.ts construction-site precedent): the
// `import.meta.env.DEV` guard lives HERE in the site page, never in the packaged component — the static
// build never reaches the dynamic import (ADR-0131 cl.4/7). This page has no prose chrome, so the
// stub-vs-live status goes to the console instead of a caption.
if (import.meta.env.DEV) {
  void (async () => {
    try {
      const overlay = await import('../lib/admin-live-runner.ts')
      const probe = await overlay.probeLive()
      if (probe.available) {
        admin.agentTurn = overlay.createAdminAgentTurn()
        // The SURFACE arm (TKT-0076/ADR-0138) — takes precedence over the text runner above: turns run
        // through the a2ui producer (persona riding the ADR-0138 seam) and stream REAL surfaces into the
        // conversation. A fresh runner per persona switch = a fresh producer session per persona.
        armSurfaceTurn = () => {
          admin.agentSurfaceTurn = overlay.createAdminSurfaceTurn()
        }
        armSurfaceTurn()
        console.info(`[agent-admin-app] live model connected (${probe.providers} provider(s)) — surface turns armed`)
      } else {
        console.info('[agent-admin-app] stub preview — set a provider key in .env and restart `npm run dev` for a live model')
      }
    } catch {
      console.info('[agent-admin-app] stub preview — the live overlay is unavailable')
    }
  })()
}
