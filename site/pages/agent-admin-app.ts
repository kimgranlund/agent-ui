// site/pages/agent-admin-app.ts — the STANDALONE ui-agent-admin surface (agent-admin-app.html): the full
// live composition filling the viewport with NO docs container shell — no nav, no prose, no resize frame.
// Deliberately does NOT import './_page.ts' (that IS the docs shell): the foundation cascade is imported
// directly in the same [1]→[3b] order _page.ts documents. agent-admin.ts remains the docs COMPOSITION
// GUIDE and owns the teaching page (an embedded, prose-wrapped demo); this page is the real thing.
//
// DISCOVERABLE, NOT DOCS-SHELLED (Kim's 2026-07-25 overturn of the 2026-07-19 standalone opt-out): this
// page is now a real, listed destination — an entry in site-manifest.json/sitemap.json, an ungrouped NAV
// link in _page.ts (alongside agent-admin.html), and a landing card in main.ts, the SAME
// discoverability the a2ui-live.html/gen-ui-live.html standalone demos get. What did NOT change is the
// shell posture above: registering a page in the site's nav/landing only makes it a normal link target
// (a plain `<a href>`, a real MPA navigation) — it says nothing about what THIS page renders once you
// land on it. Every other listed page still imports `_page.ts` (even the "full-bleed" ones,
// `mountFullBleedPage`) and keeps at least the nav rail + context header/footer; this page is a
// deliberate exception, because its whole reason to exist is showing ui-agent-admin exactly as it would
// ship in production, not a docs-wrapped preview of it (agent-admin.html already owns that job) — the
// gallery.ts "ungrouped nav entry" precedent this file's header used to cite is about NAV grouping, not
// about the shell; gallery.ts itself uses `mountPage` and keeps the full docs shell. Forcing `_page.ts`
// onto this page would defeat the demo's own point, so it does not get one. GH #461/MA-3's workbench.ts
// is the SECOND instance of this same shell-less posture (its own header makes the identical case for
// ui-workspace-shell) — this is no longer a lone exception, it is the standing pattern for a page whose
// entire point is showing a real composition, not a docs-wrapped preview of one.
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
import type { UIToastRegionElement } from '@agent-ui/components/controls/toast-region'
import { ACTIVE_PRESET_KEY, builderStore, personaRoster, personaStore, resetPersona, saveImportedPersona, type Persona } from './agent-admin-presets.ts'
import { exportPersonaFile, importedPersonaFrom, mintBlankPersona, personaFileName, personaFileText, readPersonaFile } from './agent-admin-persona-file.ts'
import { librariesForCategory, setLiveIntegrations } from './agent-admin-libraries.ts'
// GH #637 S1 — the blank agent's seed: the EXACT shipped default `ui-agent-admin` itself falls back to
// when no store prop is ever set (agent-admin.ts connected()'s own `initial` object) — pure reuse, so a
// freshly-minted blank agent renders exactly what a bare, unconfigured `<ui-agent-admin>` would.
import { DEFAULT_MODEL_ID, defaultAgentConfigSchema, initialValuesFor } from '@agent-ui/app/agent-admin-schema'
import { initialEntryValues } from '@agent-ui/app'

const root = document.querySelector('#app') ?? document.body

// ── the persona roster (TKT-0074 presets + the GH #406 imported library) ────────────────────────────────
// Each persona is a persona-scoped store (its own persistKey; edits persist per persona). Switching swaps
// `admin.store` — the component's reactive store effect re-pushes it into the settings pane, rewires every
// entry section, and — GH #145 fix — genuinely resets the conversation (chat log, open surfaces, the
// live-request history, and the Dialog Turns log) for a real store reassignment; the store-swap probe
// (agent-admin-app.test.ts) and the reset regression (agent-admin.test.ts) both pin it.

const admin = document.createElement('ui-agent-admin') as UIAgentAdminElement

// GH #143 — which persona is active must be known BEFORE the first `admin.libraries` assignment (the
// add-from-library menu is scoped to the ACTIVE preset's category from the very first paint, not just on
// a later switch) — computed here, ahead of the header/menu wiring below that also reads it.
const roster: Persona[] = personaRoster()
const initialPreset: Persona =
  roster.find((p) => p.id === localStorage.getItem(ACTIVE_PRESET_KEY)) ?? roster[0]!
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

let active: Persona = initialPreset

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
/** Stage one persona row. Pre-connect (page boot) the row goes on the HOST — ui-menu moves every
 *  non-trigger child into its panel at connect. AFTER connect (GH #406 — an import mints a persona while
 *  the page is live) the panel already exists, so the row must be appended THERE (a host child added late
 *  is never moved in) and must carry its own `tabindex="-1"`: the auto-stamp that gives connect-time
 *  children their roving-focus base state has already run. `#itemsIn` reads the panel live, so a row added
 *  this way joins roving focus/type-ahead/commit exactly like a boot-time one. */
function addPersonaRow(persona: Persona): void {
  const item = document.createElement('div')
  item.dataset.value = persona.id
  item.setAttribute('role', 'menuitemradio')
  item.setAttribute('aria-checked', String(persona.id === active.id))
  item.setAttribute('tabindex', '-1')
  item.textContent = persona.label
  item.title = persona.tagline
  agentItems.set(persona.id, item)
  ;(agentMenu.querySelector('[data-part="panel"]') ?? agentMenu).append(item)
}
for (const persona of roster) addPersonaRow(persona)
agentMenu.addEventListener('select', (event) => {
  const { value } = (event as CustomEvent<{ value: string; index: number }>).detail
  const persona = roster.find((p) => p.id === value)
  if (persona) applyPersona(persona)
})

// The "…" overflow — page actions: Reset persona (TKT-0074) + the GH #406 persona-library pair,
// Export/Import (future actions join them here).
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
function overflowItem(value: string, label: string, title: string): HTMLElement {
  const item = document.createElement('div')
  item.dataset.value = value
  item.textContent = label
  item.title = title
  return item
}
// GH #637 S1 — the "New agent" actions. Kept as an ARRAY of `{ value, label, title }` rows dispatched by
// `value`, not one bare item: S3 (GH #633 §3's "New agent → Generate" sibling) adds its own row to this
// same array and its own `value` branch below — the shape never needs restructuring for that second
// child to join, only extending (the decomp's S1 charter: "the entry shape extensible, e.g. the
// action's naming/anatomy shouldn't hard-code single-child"). S3-a owns the final IA (a submenu, say);
// this array is what that IA reshuffles, not what it invents from scratch.
const NEW_AGENT_ACTIONS = [
  { value: 'new-agent-blank', label: 'New agent → Blank', title: 'Mint a fresh, empty agent to configure from scratch' },
  // ADR-0178 / GH #633 (LLD-C8) — the guided path, EXTENDING S1's array rather than restructuring it:
  // the same blank mint, then the Builder interview armed over it. Both paths mint through the one
  // `mintBlankPersona` call, so a generated agent is an ordinary roster row from the first turn.
  { value: 'new-agent-generate', label: 'New agent → Generate', title: 'Describe the agent you want and let the Builder fill in the draft as you talk' },
] as const
const newAgentItems = NEW_AGENT_ACTIONS.map((a) => overflowItem(a.value, a.label, a.title))
const resetItem = overflowItem('reset-persona', 'Reset persona', 'Discard this persona’s edits and reseed it from the preset')
// GH #406 — the persona-library pair. Export writes the persona's whole store state as a versioned JSON
// file; import mints a NEW persona from one (never an overwrite — library semantics).
const exportItem = overflowItem('export-persona', 'Export persona', 'Download this persona as a shareable JSON file')
const importItem = overflowItem('import-persona', 'Import persona…', 'Add a persona from a persona JSON file')
overflowMenu.append(overflowTrigger, ...newAgentItems, resetItem, exportItem, importItem)
overflowMenu.addEventListener('select', (event) => {
  const { value } = (event as CustomEvent<{ value: string; index: number }>).detail
  if (value === 'new-agent-blank') {
    createBlankAgent()
  } else if (value === 'new-agent-generate') {
    createGeneratedAgent()
  } else if (value === 'reset-persona') {
    resetPersona(active)
    applyPersona(active)
  } else if (value === 'export-persona') {
    exportActivePersona()
  } else if (value === 'import-persona') {
    fileInput.click()
  }
})

function applyPersona(persona: Persona): void {
  active = persona
  localStorage.setItem(ACTIVE_PRESET_KEY, persona.id)
  // ADR-0178 cl.5 (LLD-C8) — the ONE choke point that exits the guided-authoring flow: clearing it here,
  // BEFORE the store swap, makes the ordering deterministic (exit the flow → GH #145's reset → optionally
  // re-enter), so switching personas can never leave a previous draft's interview armed over a new one.
  admin.authoringStore = undefined
  admin.store = personaStore(persona)
  // GH #143 — re-scope the add-from-library menu to the NEW persona's category. A fresh object every call
  // (never a reused reference) is load-bearing: `libraries`' reactive effect (agent-admin.ts) rebuilds the
  // menu on an identity change, the same law `store`'s reassignment above relies on — handing back a
  // reference-equal object would be a silent no-op.
  admin.libraries = librariesForCategory(persona.category)
  armSurfaceTurn?.()
  titleName.textContent = persona.label
  titleTagline.textContent = persona.tagline
  // GH #168 — the visible label stays plain text; the dropdown affordance is a real trailing
  // <ui-icon> caret, not a glued '▾' character (the TKT-0048 anti-pattern). The composer's
  // #appendCaret (conversation-composer.ts) is the precedent, including its re-append law: the
  // `textContent =` write wipes ALL children (any prior caret included), so the caret is appended
  // fresh on every label rewrite.
  agentTrigger.textContent = persona.label
  const caret = document.createElement('ui-icon')
  caret.setAttribute('slot', 'trailing')
  caret.setAttribute('data-role', 'caret')
  caret.setAttribute('glyph', 'caret-down')
  agentTrigger.append(caret)
  agentTrigger.title = 'Switch agent'
  // ui-menu's own commit path (menu.ts's #commitRadio, GH #55) already sets aria-checked correctly
  // for a row the user CLICKED — but applyPersona() also runs on paths that never go through a menu
  // commit (initial load from a persisted localStorage id, the "Reset persona" overflow action, an
  // import): this loop is the single source of truth for those, simplified to just WRITING the real
  // aria-checked state per id (no more hand-rolled ✓-text prefix or a parallel data-active
  // attribute — the control's own checkmark indicator + real ARIA state carry the "current choice"
  // signal now; agent-admin-app.css reads [aria-checked='true'] directly for the font-weight).
  for (const [id, item] of agentItems) {
    item.setAttribute('aria-checked', String(id === persona.id))
  }
}

// ── the persona library: export / import (GH #406, M-B DoD box 3) ──────────────────────────────────────
// The FORMAT and every decision about it live in agent-admin-persona-file.ts (pure, tested); this page
// owns only the browser I/O around it — a Blob download out, a file picker in — plus the roster
// registration an import needs to survive a reload.

/** Transient feedback for both actions (fleet-native — the standalone page has no prose chrome to write
 *  a status line into, and a silent import is indistinguishable from a broken one). */
const toasts = document.createElement('ui-toast-region') as UIToastRegionElement
function notify(message: string, urgent = false): void {
  if (toasts.isConnected) toasts.show({ message, urgent })
  else console.info(`[agent-admin-app] ${message}`)
}

function exportActivePersona(): void {
  const text = personaFileText(exportPersonaFile(active, personaStore(active)))
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = personaFileName(active)
  // In the document for the click: a detached anchor's download is ignored by some engines.
  document.body.append(link)
  link.click()
  link.remove()
  // Revoke on the next task — revoking synchronously can cancel the download the click just started.
  setTimeout(() => URL.revokeObjectURL(url), 0)
  notify(`Exported “${active.label}” as ${link.download}.`)
}

/** Import one persona file's TEXT: validate → mint a NEW persona (collision-safe id) → register it in
 *  the persisted library → stage its roster row → make it active. Every rejection is a visible message,
 *  never a silent no-op. */
function importPersonaText(text: string): void {
  const parsed = readPersonaFile(text)
  if (!parsed.ok) {
    notify(`Import failed — ${parsed.error}`, true)
    return
  }
  // Mint against a FRESH roster read, not this page's boot-time snapshot: a second tab that imported
  // since boot already wrote its persona into the shared library record, and an id minted blind to it
  // would silently SHARE that persona's persisted store (`saveImportedPersona` re-reads before it
  // appends, so the record itself survives — only the id needs the fresh view).
  const persona = importedPersonaFrom(parsed.file, [...personaRoster(), ...roster])
  saveImportedPersona(persona) // survives reload: personaRoster() reads this record at boot
  roster.push(persona)
  addPersonaRow(persona)
  applyPersona(persona)
  notify(`Imported “${persona.label}”.`)
}

// ── the blank-agent path (GH #637 S1) ───────────────────────────────────────────────────────────────────
// PURE REUSE of the GH #406 mint-on-import machinery above: mint a collision-safe identity → register it
// in the SAME persisted library an import writes to → stage its roster row → activate it, the identical
// four-step shape `importPersonaText` runs, differing only in WHERE the seed comes from (the component's
// own shipped defaults, not a parsed file's state) and WHICH mint function mints it
// (`mintBlankPersona`, not `importedPersonaFrom`) — no second mint/seed/activate path.
function createBlankAgent(): void {
  const seed = { model: DEFAULT_MODEL_ID, ...initialValuesFor(defaultAgentConfigSchema), ...initialEntryValues() }
  // Mint against a FRESH roster read (importPersonaText's own comment: a second tab may have minted
  // since boot) — the same collision-safety an import gets.
  const persona = mintBlankPersona(seed, [...personaRoster(), ...roster])
  saveImportedPersona(persona) // survives reload: personaRoster() reads this record at boot
  roster.push(persona)
  addPersonaRow(persona)
  applyPersona(persona)
  notify(`Created “${persona.label}”.`)
}

/** ADR-0178 / GH #633 — "New agent → Generate": mint the SAME blank draft the Blank path mints (S1's
 *  seed + `mintBlankPersona`, verbatim reuse — one mint path), activate it, then arm the Builder over it.
 *  Order matters: `applyPersona` clears `authoringStore` and reassigns `store` first, firing GH #145's
 *  reset, so the interview always opens on a clean thread. */
function createGeneratedAgent(): void {
  const seed = { model: DEFAULT_MODEL_ID, ...initialValuesFor(defaultAgentConfigSchema), ...initialEntryValues() }
  const persona = mintBlankPersona(seed, [...personaRoster(), ...roster])
  saveImportedPersona(persona)
  roster.push(persona)
  addPersonaRow(persona)
  applyPersona(persona)
  admin.authoringStore = builderStore() // a FRESH interviewer per flow entry (no persistKey, no cache)
  notify(`Created “${persona.label}” — describe what you want and the Builder will fill it in.`)
}

// The ONE native form element on this page, and a deliberate exception to the fleet's "no native form
// elements" law (CLAUDE.md): opening the OS file picker is a privileged gesture only a real
// `<input type="file">` click can make — there is no `ui-*` file control in the fleet (ui-attachment is
// a display-tier card for an already-chosen file, never a picker), and the modern alternative
// (`showOpenFilePicker`) is Chromium-only. It stays hidden and unstyled: the visible affordance is the
// overflow menu row, so the exception buys a capability without putting a native control on screen.
const fileInput = document.createElement('input')
fileInput.type = 'file'
fileInput.accept = 'application/json,.json'
fileInput.hidden = true
fileInput.addEventListener('change', () => {
  const picked = fileInput.files?.[0]
  if (!picked) return
  void picked
    .text()
    .then((text) => importPersonaText(text))
    .catch(() => notify('Import failed — that file could not be read.', true))
    // Clearing the input is what lets the SAME file be picked again (no `change` fires otherwise).
    .finally(() => {
      fileInput.value = ''
    })
})

header.append(title, overflowMenu, agentMenu)
applyPersona(active)
root.append(header, admin, toasts, fileInput)

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
    // GH #567 S6 (LLD-C6/SPEC-R28, Kim's F1 ruling) — DEV only: the dev proxy's `GET /integrations`
    // exists only under `vite dev` (worker/index.ts stays frozen, no production twin — ADR-0177
    // §0/Non-goals); production keeps the hand-authored INTEGRATION_TOOLS pack, untouched. A
    // discovered `mcp:*` trio joins the Integrations pack without a page reload: `setLiveIntegrations`
    // plus a fresh `admin.libraries` assignment — the SAME identity-change law `applyPersona`'s own
    // reassignment above relies on (agent-admin-libraries.ts's `librariesForCategory` doc comment).
    if (import.meta.env.DEV) {
      const trios = await overlay.fetchLiveIntegrations()
      if (trios) {
        setLiveIntegrations(trios)
        admin.libraries = librariesForCategory(active.category)
      }
    }
  } catch {
    console.info('[agent-admin-app] stub preview — the live overlay is unavailable')
  }
})()
