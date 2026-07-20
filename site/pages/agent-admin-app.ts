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
// GH #52/ADR-0154 — the re-host onto the shell-archetype grammar: ui-agent-admin now composes
// ui-chat-shell (which itself composes ui-super-shell), so both siblings' own CSS needs importing
// here too, matching every OTHER composed child above.
import '@agent-ui/app/super-shell.css'
import '@agent-ui/app/chat-shell.css'
import '@agent-ui/app/agent-admin.css'
import '@agent-ui/app/master-detail-pane' // self-defines ui-master-detail-pane (composed by ui-settings)
import '@agent-ui/app/master-detail' // self-defines ui-master-detail (composed by ui-settings)
import '@agent-ui/app/nav-rail' // self-defines ui-nav-rail(-group|-item) (composed by ui-settings)
import '@agent-ui/app/settings' // self-defines ui-settings
import '@agent-ui/app/surface-host' // self-defines ui-surface-host (composed by ui-conversation)
import '@agent-ui/app/conversation' // self-defines ui-conversation
import '@agent-ui/app/super-shell' // self-defines ui-super-shell (composed by ui-chat-shell)
import '@agent-ui/app/chat-shell' // self-defines ui-chat-shell (composed by ui-agent-admin)
import '@agent-ui/app/agent-admin' // self-defines ui-agent-admin
import './agent-admin-app.css' // page-local: full-viewport layout + the preset strip chrome
import type { UIAgentAdminElement } from '@agent-ui/app/agent-admin'
import type { UIButtonElement } from '@agent-ui/components/controls/button'
import { AGENT_PRESETS, ACTIVE_PRESET_KEY, presetStore, resetPreset, type AgentPreset } from './agent-admin-presets.ts'
import { librariesForCategory } from './agent-admin-libraries.ts'

const root = document.querySelector('#app') ?? document.body

// ── the six A2UI-showcase personas (TKT-0074) ─────────────────────────────────────────────────────────────
// Each preset is a persona-scoped store (its own persistKey; edits persist per persona). Switching swaps
// `admin.store` — the component's reactive store effect re-pushes it into the settings pane, rewires every
// entry section, and — GH #145 fix — genuinely resets the conversation (chat log, open surfaces, the
// live-request history, and the Dialog Turns log) for a real store reassignment; the store-swap probe
// (agent-admin-app.test.ts) and the reset regression (agent-admin.test.ts) both pin it.

const admin = document.createElement('ui-agent-admin') as UIAgentAdminElement

// GH #143 — which persona is active must be known BEFORE the first `admin.libraries` assignment (the
// add-from-library menu is scoped to the ACTIVE preset's category from the very first paint, not just on
// a later switch) — computed here, ahead of the header/menu wiring below that also reads it.
const initialPreset: AgentPreset =
  AGENT_PRESETS.find((p) => p.id === localStorage.getItem(ACTIVE_PRESET_KEY)) ?? AGENT_PRESETS[0]!
// GH #47/#48/#143 — the library packs, scoped to the active preset's category and set BEFORE the element
// ever connects (the compose-time capture law the `libraries` prop documents for the section SHELL;
// `applyPreset` below reassigns this — a fresh, re-filtered object — on every persona switch, which the
// `libraries` prop's now-reactive add-from-library MENU picks up, agent-admin.ts's GH #143 update).
admin.libraries = librariesForCategory(initialPreset.category)

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

let active: AgentPreset = initialPreset

// Armed by the DEV overlay below once a live key probes available; re-invoked per persona switch so each
// persona's SURFACE session (TKT-0076 — the runner closure owns the a2ui transcript) starts clean.
let armSurfaceTurn: (() => void) | undefined

// The agent switcher — ui-menu owns the overlay/roving-focus/type-ahead; this page stages one
// `div[role=menuitemradio]` row per preset (the ui-menu selectable-item variant, GH #55 — the
// fleet-level fix that replaces the PR #54 ✓-text/data-active fallback) and applies the committed
// selection. Pre-marking `role="menuitemradio"` opts each row into the SAME roving-focus/
// type-ahead/commit machinery as a plain menuitem, with the control itself managing `aria-checked`
// on commit (one-true across the ungrouped default radio group — exactly the "exactly one active
// agent" semantics this switcher needs). The initial `aria-checked` is seeded here (declaring the
// already-active preset) since ui-menu only DEFAULTS a missing aria-checked to false at connect —
// it never guesses which row should start checked.
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
  item.setAttribute('role', 'menuitemradio')
  item.setAttribute('aria-checked', String(preset.id === active.id))
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
// GH #168 — a real <ui-icon> in the leading adornment cell instead of a glued '…' text node (the
// TKT-0048 anti-pattern, same fix as entry-list.ts's Remove button). No label at all → the explicit
// `icon-only` square anatomy (button.md "icon-only (no label) → square").
overflowTrigger.setAttribute('icon-only', '')
const overflowIcon = document.createElement('ui-icon')
overflowIcon.setAttribute('slot', 'leading')
overflowIcon.setAttribute('data-role', 'icon')
overflowIcon.setAttribute('glyph', 'dots-three')
overflowTrigger.append(overflowIcon)
overflowTrigger.title = 'Page actions'
// The icon-only trigger needs a REAL accessible name — title never reaches the accessible name
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
  // GH #143 — re-scope the add-from-library menu to the NEW preset's category. A fresh object every call
  // (never a reused reference) is load-bearing: `libraries`' reactive effect (agent-admin.ts) rebuilds the
  // menu on an identity change, the same law `store`'s reassignment above relies on — handing back a
  // reference-equal object would be a silent no-op.
  admin.libraries = librariesForCategory(preset.category)
  armSurfaceTurn?.()
  titleName.textContent = preset.label
  titleTagline.textContent = preset.tagline
  // GH #168 — the visible label stays plain text; the dropdown affordance is a real trailing
  // <ui-icon> caret, not a glued '▾' character (the TKT-0048 anti-pattern). The composer's
  // #appendCaret (conversation-composer.ts) is the precedent, including its re-append law: the
  // `textContent =` write wipes ALL children (any prior caret included), so the caret is appended
  // fresh on every label rewrite.
  agentTrigger.textContent = preset.label
  const caret = document.createElement('ui-icon')
  caret.setAttribute('slot', 'trailing')
  caret.setAttribute('data-role', 'caret')
  caret.setAttribute('glyph', 'caret-down')
  agentTrigger.append(caret)
  agentTrigger.title = 'Switch agent'
  // ui-menu's own commit path (menu.ts's #commitRadio, GH #55) already sets aria-checked correctly
  // for a row the user CLICKED — but applyPreset() also runs on paths that never go through a menu
  // commit (initial load from a persisted localStorage id, the "Reset persona" overflow action):
  // this loop is the single source of truth for those, simplified to just WRITING the real
  // aria-checked state per id (no more hand-rolled ✓-text prefix or a parallel data-active
  // attribute — the control's own checkmark indicator + real ARIA state carry the "current choice"
  // signal now; agent-admin-app.css reads [aria-checked='true'] directly for the font-weight).
  for (const [id, item] of agentItems) {
    item.setAttribute('aria-checked', String(id === preset.id))
  }
}

header.append(title, overflowMenu, agentMenu)
applyPreset(active)
root.append(header, admin)

// GH #114 (review finding): this page uses the SAME site/lib/admin-live-runner.ts backend as
// agent-admin.ts (identical /__a2ui/agent/chat + /__a2ui/agent endpoints), but was missed when that
// page's DEV-only gate was removed to go live in production (worker/index.ts, mounted at /__a2ui/agent
// on this same site — a deliberate SPEC-N2/ADR-0131 cl.4/7 supersession, see agent-admin.ts's header for
// the full rationale). This page has no prose chrome, so the stub-vs-live status goes to the console
// instead of a caption; DEV is still read for wording only, same as agent-admin.ts's pattern.
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
    } else if (import.meta.env.DEV) {
      console.info('[agent-admin-app] stub preview — set a provider key in .env and restart `npm run dev` for a live model')
    } else {
      console.info('[agent-admin-app] stub preview — the shipped build makes no live model call')
    }
  } catch {
    console.info('[agent-admin-app] stub preview — the live overlay is unavailable')
  }
})()
