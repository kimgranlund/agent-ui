// site/pages/agent-admin-app.ts — the STANDALONE ui-agent-admin surface (agent-admin-app.html): the full
// live composition filling the viewport with NO docs container shell — no nav, no prose, no resize frame
// (the gallery.ts ungrouped-entry precedent; agent-admin.ts remains the docs COMPOSITION GUIDE and owns
// the teaching page). Deliberately does NOT import './_page.ts' (that IS the docs shell): the foundation
// cascade is imported directly in the same [1]→[3b] order _page.ts documents.
import '@agent-ui/components/foundation-styles.css' // [1] foundation: tokens.css → dimensions.css (FIRST)
import '@agent-ui/components/base-styles.css' // [1b] the DOCUMENT BASE layer: typeface/leading/ink/rendering (shell-less pages need this or they render in the UA serif)
import '@agent-ui/components/component-styles.css' // [2] per-control CSS, after the foundation
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

const root = document.querySelector('#app') ?? document.body

// ── the six A2UI-showcase personas (TKT-0074) ─────────────────────────────────────────────────────────────
// Each preset is a persona-scoped store (its own persistKey; edits persist per persona). Switching swaps
// `admin.store` — the component's reactive store effect re-pushes it into the settings pane, rewires every
// entry section, and re-syncs the conversation (agent-admin.ts:162; the store-swap probe pins it).

const admin = document.createElement('ui-agent-admin') as UIAgentAdminElement

const strip = document.createElement('nav')
strip.className = 'preset-strip'
strip.setAttribute('aria-label', 'Agent presets')

const presetButtons = new Map<string, UIButtonElement>()
let active: AgentPreset =
  AGENT_PRESETS.find((p) => p.id === localStorage.getItem(ACTIVE_PRESET_KEY)) ?? AGENT_PRESETS[0]!

// Armed by the DEV overlay below once a live key probes available; re-invoked per persona switch so each
// persona's SURFACE session (TKT-0076 — the runner closure owns the a2ui transcript) starts clean.
let armSurfaceTurn: (() => void) | undefined

function applyPreset(preset: AgentPreset): void {
  active = preset
  localStorage.setItem(ACTIVE_PRESET_KEY, preset.id)
  admin.store = presetStore(preset)
  armSurfaceTurn?.()
  for (const [id, btn] of presetButtons) btn.variant = id === preset.id ? 'solid' : 'ghost'
}

for (const preset of AGENT_PRESETS) {
  const btn = document.createElement('ui-button') as UIButtonElement
  btn.variant = 'ghost'
  btn.size = 'sm'
  btn.textContent = preset.label
  btn.title = preset.tagline
  btn.addEventListener('click', () => applyPreset(preset))
  presetButtons.set(preset.id, btn)
  strip.append(btn)
}

// Reset the ACTIVE persona to its seed (clears its persisted edits; the other five untouched).
const reset = document.createElement('ui-button') as UIButtonElement
reset.variant = 'ghost'
reset.size = 'sm'
reset.className = 'preset-reset'
reset.textContent = 'Reset persona'
reset.title = 'Discard this persona’s edits and reseed it from the preset'
reset.addEventListener('click', () => {
  resetPreset(active)
  applyPreset(active)
})
strip.append(reset)

applyPreset(active)
root.append(strip, admin)

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
