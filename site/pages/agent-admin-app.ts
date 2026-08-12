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
import '@agent-ui/app/conversation-dialog.css' // ADR-0180 (GH #688) — the adopted-or-created log's own scroll/layout CSS, promoted off conversation.css
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
import type { AgentRosterEntry, GenerateSeed, UIAgentAdminElement } from '@agent-ui/app/agent-admin'
import type { UIToastRegionElement } from '@agent-ui/components/controls/toast-region'
import { ACTIVE_PRESET_KEY, builderStore, personaRoster, personaStore, resetPersona, saveImportedPersona, type Persona } from './agent-admin-presets.ts'
import { exportPersonaFile, importedPersonaFrom, mintBlankPersona, personaFileName, personaFileText, readPersonaFile } from './agent-admin-persona-file.ts'
import { librariesForCategory, setLiveIntegrations, setLiveServices } from './agent-admin-libraries.ts'
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

let active: Persona = initialPreset

// Armed by the DEV overlay below once a live key probes available; re-invoked per persona switch so each
// persona's SURFACE session (TKT-0076 — the runner closure owns the a2ui transcript) starts clean.
let armSurfaceTurn: (() => void) | undefined

// GH #686's Amendment (admin-three-pane-ia.lld.md §16.3/§16.5, S7-d) — the canvas-header (title/tagline,
// the agentMenu switcher, the "…" overflow) is RETIRED entirely: this page renders NO header of its own
// any more — `ui-agent-admin`'s own S7-c unified header bar is the only header, and every prior overflow
// action now reaches its page-side handler through one of the component's six registration seams
// (admin-three-pane-ia.lld.md §16.3, frozen shapes) instead of a menu commit.

/** Push the current roster into the header's agent-select (setAgentRoster — data-in, re-callable). Called
 *  on every persona switch (so the select's own "current choice" reflects it, replacing the retired
 *  title/tagline zone + the agentMenu's own aria-checked loop) AND after every mint/import (a fresh row
 *  needs a fresh push — the seam's own re-callable contract, LLD §16.3). */
function pushRoster(activeId: string): void {
  const entries: AgentRosterEntry[] = roster.map((p) => ({ id: p.id, label: p.label }))
  admin.setAgentRoster(entries, activeId)
}
admin.onAgentSelect((id) => {
  const persona = roster.find((p) => p.id === id)
  if (persona) applyPersona(persona)
})

// LLD §16.3/§16.6 OQ-A — New Agent's ONE verb (this header carries a single button, not the retired
// menu's two-row choice) is GENERATE: the LLD's own recommendation, since RULED by Kim (2026-08-11,
// GH #686 comment 5246724206) — retire "New agent → Blank" entirely; Generate is the only "new agent"
// entry point through the unified header's single button. It is also the reading GH #681's own text
// already commits to ("creating a new agent is an action that belongs in the roster menu, not
// duplicated inside the card") — the roster menu's surviving item was "New agent → Generate", never
// "→ Blank". Called with NO seed, exactly as that menu item called `createGeneratedAgent` directly:
// this button sits outside any specific card, so it has no pre-arm Model/Effort pick to carry
// (`GenerateSeed`'s own doc comment states the identical reasoning for this exact call site).
//
// Blank's OWN dedicated front door (GH #637 S1's `createBlankAgent`, "New agent → Blank" — mint WITHOUT
// an interview) has NO seam of the six to route through and is RETIRED here — Kim's ruling above
// confirms the retirement this slice shipped provisionally: OQ-A's own text had named three candidate
// homes (the narrow "•••" menu; an ADR-0170-style pack action; retire) and ruled none of them at build
// time, so S7-d retired `createBlankAgent()`'s wiring pending exactly this ruling, rather than guess at
// the other two. No rework was needed. `mintBlankPersona` itself is untouched and still exercised by
// `createGeneratedAgent` below — only the interview-less, dedicated mint button is gone. See this
// slice's GH #686 Findings comment for the build-time trace; the ruling itself is GH #686 comment
// 5246724206.
admin.onNewAgentRequest(() => createGeneratedAgent())
admin.onImportRequest(() => fileInput.click())
admin.onExportRequest(() => exportActivePersona())
admin.onResetRequest(() => {
  resetPersona(active)
  applyPersona(active)
})

// ADR-0179 OQ4 (admin-three-pane-ia.lld.md §2) — the Co-pilot place's empty state hosts the flow's OTHER
// front door, where the user already is. It reaches this page's mint path through the component's
// `onGenerateRequest` registration seam (a callback, never a CustomEvent — SPEC-R5), because the component
// cannot import site code without inverting the DAG. Two affordances converge on the SAME
// `createGeneratedAgent` mint path: the card's own composer FIRST MESSAGE (via the registered callback,
// carrying the GH #670 pre-arm seed), and the header's own New Agent button above (no seed — outside any
// specific card, the retired roster menu's own reasoning carried over). This call deliberately happens
// BEFORE `root.append(admin)` below — that ordering used to lose the reveal (GH #666 defect 1) and is now
// the probed case.
// GH #670 — the component hands over the Model pick the user made on the unarmed card, and it is passed
// straight through to the mint so the new interviewer store is SEEDED with it (never corrected afterwards).
admin.onGenerateRequest((seed) => createGeneratedAgent(seed))

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
  // GH #686's Amendment — the header's own agent-select now carries the "current choice" signal
  // (setAgentRoster's re-callable contract, LLD §16.3), replacing the retired title/tagline zone and the
  // agentMenu's own aria-checked loop.
  pushRoster(persona.id)
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
  applyPersona(persona) // pushRoster(persona.id) inside applyPersona stages the header's own roster row
  notify(`Imported “${persona.label}”.`)
}

// GH #637 S1's dedicated "New agent → Blank" mint path (`createBlankAgent`, an interview-less mint) is
// RETIRED by this slice, not silently: see `admin.onNewAgentRequest`'s own comment above for the full
// trace (OQ-A names three candidate homes for this action and rules none of them; this build ships
// "retire" PROVISIONALLY, flagged in the GH #686 Findings comment for a ruling). `mintBlankPersona` itself
// is untouched — `createGeneratedAgent` below still reuses it verbatim for its own seed.

/** ADR-0178 / GH #633 — "New agent → Generate": mint a fresh blank draft (S1's
 *  seed + `mintBlankPersona`, verbatim reuse — one mint path), activate it, then arm the Builder over it.
 *  Order matters: `applyPersona` clears `authoringStore` and reassigns `store` first, firing GH #145's
 *  reset, so the interview always opens on a clean thread.
 *
 *  GH #670 — `pick` is the Author card's PRE-ARM Model choice (absent from the roster-menu entry, which has
 *  no card to pick on). It is applied by SEEDING `builderStore`, never by writing the store afterwards: the
 *  interview's very first read of `model` is already the user's, so nothing can overwrite the pick. Absent
 *  ⇒ the Builder preset's own model wins, exactly as before. The DRAFT's seed below is untouched by it —
 *  the pick chooses the interviewer's model, never the agent-being-built's. */
function createGeneratedAgent(pick?: GenerateSeed): void {
  const seed = { model: DEFAULT_MODEL_ID, ...initialValuesFor(defaultAgentConfigSchema), ...initialEntryValues() }
  const persona = mintBlankPersona(seed, [...personaRoster(), ...roster])
  saveImportedPersona(persona)
  roster.push(persona)
  applyPersona(persona) // pushRoster(persona.id) inside applyPersona stages the header's own roster row
  admin.authoringStore = builderStore(pick?.model) // a FRESH interviewer per flow entry (no persistKey, no cache)
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

applyPersona(active) // also stages the header's own roster row (pushRoster, inside applyPersona)
root.append(admin, toasts, fileInput)

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
    // GH #783 S4 (LLD-C6/SPEC-R5, ADR-0185) — the sibling live-read for MCP SERVICES rides the SAME
    // DEV-only block: `GET /integrations` now carries a second `services` array (S2), read by
    // `fetchLiveServices` under the SAME degrade-to-`undefined` law. Both fetches BEFORE the one
    // `admin.libraries` reassignment, so a single identity-change re-render carries both live reads into
    // the add-from-library menu. `undefined` passes straight through `setLiveServices` (production/degrade
    // keeps the MCP-services pack absent, the getter's own law). Reassign when EITHER landed; both undefined
    // ⇒ nothing to re-render (the boot-time `librariesForCategory` getters already have it right).
    if (import.meta.env.DEV) {
      const trios = await overlay.fetchLiveIntegrations()
      const services = await overlay.fetchLiveServices()
      if (trios) setLiveIntegrations(trios)
      setLiveServices(services)
      if (trios || services) admin.libraries = librariesForCategory(active.category)
    }
  } catch {
    console.info('[agent-admin-app] stub preview — the live overlay is unavailable')
  }
})()
