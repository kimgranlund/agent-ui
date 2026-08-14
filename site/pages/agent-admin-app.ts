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
// GH #845 (LLD-C15/§7) — the Edit Agents drawer's vehicle: `ui-drawer` (ADR-0188), COMPOSED byte-unmodified.
// Its content (the roster rows and every management verb on them) is page-owned by that control's own fence.
import type { UIDrawerElement } from '@agent-ui/components/controls/drawer'
import type { UIButtonElement } from '@agent-ui/components/controls/button'
import type { UITextFieldElement } from '@agent-ui/components/controls/text-field'
import {
  ACTIVE_PRESET_KEY,
  builderStore,
  deleteImportedPersona,
  personaRoster,
  personaStore,
  renameImportedPersona,
  resetPersona,
  saveImportedPersona,
  saveRosterOrder,
  type Persona,
} from './agent-admin-presets.ts'
import { duplicatePersonaFrom, exportPersonaFile, importedPersonaFrom, mintBlankPersona, personaFileName, personaFileText, readPersonaFile } from './agent-admin-persona-file.ts'
import { buildDebugBundle, debugBundleFileName } from './agent-admin-debug-export.ts'
import { buildZip } from '../lib/zip-writer.ts'
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
  // GH #845 (LLD-C15) — `deletable` is the ONE new field, and its meaning is page-owned: a persona is
  // deletable exactly when it is a LIBRARY record (`imported === true` — an import, a mint, or a duplicate),
  // never when it is a shipped `AGENT_PRESETS` preset. The component reads it only as a visibility gate for
  // its two Delete affordances (the overflow item + the config-surface row); ABSENT reads protected, so this
  // one line is the whole reason a preset shows neither.
  const entries: AgentRosterEntry[] = roster.map((p) => ({ id: p.id, label: p.label, deletable: p.imported === true }))
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
admin.onExportDebugBundleRequest(() => exportDebugBundle())
admin.onResetRequest(() => {
  resetPersona(active)
  applyPersona(active)
})

// GH #845 (LLD-C4/C5, LLD-C15/§7) — the two ADDITIVE seams this ticket registers, beside the six above.
// `onEditAgentsRequest` opens this page's own roster-management drawer (the component neither builds nor
// knows that surface — it only offers the picker item while the seam is registered). `onDeleteAgentRequest`
// carries the ACTIVE entry's id from EITHER component-owned Delete home (the header's "•••" overflow item
// and the config surface's `delete-agent-row`) into the ONE page-side handler the drawer rows call directly
// as well — three affordances, one deletion path, so the persistence sweep can never diverge between them.
admin.onEditAgentsRequest(() => openRosterDrawer())
admin.onDeleteAgentRequest((id) => deleteAgent(id))

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

// ── the dev-debug bundle (GH #889) ────────────────────────────────────────────────────────────────────
// One zip: agent-settings for EVERY roster agent (each agent's own persisted store, the exportActivePersona
// idiom above run once per agent) + the ACTIVE agent's test-chat and Builder-interview transcripts (the
// only ones that exist — see agent-admin-debug-export.ts's header for why that is a scope FACT, not a
// narrowing). The zip mechanism itself (`buildZip`, STORE/uncompressed) lives in the zero-dep-adjacent
// `site/lib/zip-writer.ts`; this function is pure browser I/O, the `exportActivePersona` shape mirrored.

function exportDebugBundle(): void {
  const agents = roster.map((persona) => ({ persona, store: personaStore(persona) }))
  const { entries } = buildDebugBundle({
    agents,
    activeAgentId: active.id,
    testChatTranscript: admin.testChatTranscript(),
    builderInterviewTranscript: admin.builderInterviewTranscript(),
  })
  const zip = buildZip(entries)
  const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }))
  const link = document.createElement('a')
  link.href = url
  link.download = debugBundleFileName()
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
  notify(`Exported dev-debug bundle as ${link.download} (${agents.length} agent${agents.length === 1 ? '' : 's'}).`)
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

// ── the Edit Agents drawer (GH #845, LLD-C15/§7) ───────────────────────────────────────────────────────
// `ui-drawer` (ADR-0188) is composed exactly as shipped — `edge="end"`, an author `aria-label` the control
// forwards onto its dialog part, dismissible (no `persistent`), everything else default. The control is
// OPAQUE to what is inside it (its intake §6 fence: "roster lists, danger rows, reorder/duplicate
// affordances all page-owned"), so every row below is page markup driving page functions.
//
// THE ONE STRUCTURAL RULE the vehicle imposes: `ui-drawer` MOVES its children into the `<dialog>` part at
// connect, once. So the shell (title · status · list · footer) is built and appended HERE, before
// `root.append` below connects it; afterwards only the LIST's own children are ever replaced. Appending a
// new child to the HOST after connect would land it beside the dialog, outside the top-layer surface.
//
// GH #918 — the drawer ADOPTS its own content layout system: `<header>` (title + hint + the in-drawer
// status line) and `<footer>` (the Done row) are the drawer's SHARED [data-box] sticky regions (they stay
// pinned while the roster scrolls); the roster list itself is the ONE scrolling `[data-region='content']`
// region between them. Previously all five were flat children of the dialog's own single scroll viewport,
// so the title/hint/status scrolled away WITH the list — the exact defect this ticket names.
const drawer = document.createElement('ui-drawer') as UIDrawerElement
drawer.setAttribute('edge', 'end')
drawer.setAttribute('aria-label', 'Manage agents')
drawer.className = 'roster-drawer'

const drawerHeader = document.createElement('header')
drawerHeader.className = 'roster-drawer-header'

const drawerTitle = document.createElement('h2')
drawerTitle.className = 'roster-drawer-title'
drawerTitle.textContent = 'Manage agents'

const drawerHint = document.createElement('p')
drawerHint.className = 'roster-drawer-hint'
drawerHint.textContent =
  'Reorder the picker, rename or delete agents you made, and duplicate any agent — a shipped one included — into an editable copy.'

// The drawer opens MODAL, in the platform top layer: a `ui-toast-region` living in the normal layer paints
// UNDER the ::backdrop while it is open, so a toast alone would be invisible feedback exactly when the user
// is acting. This line is the in-drawer twin — the same sentence, inside the surface that is on top.
// `role="status"` (an implicit aria-live="polite" region) announces it to AT without stealing focus. It
// lives in the STICKY header (not the scrolling content) — feedback for a list action must stay visible
// regardless of where the list itself is scrolled to.
const drawerStatus = document.createElement('p')
drawerStatus.className = 'roster-drawer-status'
drawerStatus.setAttribute('role', 'status')

drawerHeader.append(drawerTitle, drawerHint, drawerStatus)

// `rosterList` itself IS the drawer's one scrolling `[data-region='content']` region — no extra wrapper:
// the region's own inline/block padding (the drawer's --ui-drawer-pad-inline/-block rhythm) lands directly
// on the list, and the list's own flex/gap styling rides alongside it (a component's own @scope always wins
// over the region model's specificity-0 defaults, container-box.css's own documented escape hatch).
const rosterList = document.createElement('div')
rosterList.className = 'roster-list'
rosterList.setAttribute('data-region', 'content')

const drawerDone = document.createElement('ui-button') as UIButtonElement
drawerDone.setAttribute('variant', 'soft')
drawerDone.className = 'roster-drawer-done'
drawerDone.textContent = 'Done'
drawerDone.addEventListener('click', () => {
  drawer.open = false
})

const drawerFooter = document.createElement('footer')
drawerFooter.className = 'roster-drawer-footer'
drawerFooter.append(drawerDone)
drawer.append(drawerHeader, rosterList, drawerFooter)

/** Feedback for every drawer verb: the in-drawer status line FIRST (it is the one the user can actually see
 *  while a modal drawer holds the top layer), then the page's own toast — the record, and the only feedback
 *  when the SAME handler is reached from the header's overflow item or the config surface's Delete row with
 *  no drawer open at all. */
function announce(message: string, urgent = false): void {
  drawerStatus.textContent = message
  notify(message, urgent)
}

/** The ONE choke point after any roster mutation (LLD §7): re-read the ORDERED roster into the captured
 *  `roster` array (its CONTENTS are replaced — the binding is a `const` every closure on this page already
 *  holds), re-push it to the header (which is what makes reorder/rename/delete "drive picker order"), and
 *  rebuild the drawer list when it is open. */
function refreshRoster(): void {
  roster.splice(0, roster.length, ...personaRoster())
  pushRoster(active.id)
  if (drawer.open) renderRosterRows()
}

function openRosterDrawer(): void {
  drawerStatus.textContent = ''
  renderRosterRows()
  drawer.open = true
}

/** A ghost icon-only row button — a real `aria-label` NAMING THE AGENT is the whole accessible name here
 *  (button.md's `icon-only` opt-in idiom, the header's own `new-agent-narrow`/overflow-trigger precedent). */
function rowIconButton(glyph: string, label: string, disabled: boolean, onClick: () => void): UIButtonElement {
  const button = document.createElement('ui-button') as UIButtonElement
  button.setAttribute('variant', 'ghost')
  button.setAttribute('icon-only', '')
  button.setAttribute('aria-label', label)
  if (disabled) button.setAttribute('disabled', '')
  const icon = document.createElement('ui-icon')
  icon.setAttribute('slot', 'leading')
  icon.setAttribute('glyph', glyph)
  button.append(icon)
  button.addEventListener('click', onClick)
  return button
}

/** A ghost row VERB button — the word is always present (ADR-0057: intent never travels by colour alone,
 *  which is what lets the Delete button below be danger-styled by token repoint and still read correctly).
 *  `glyph` is optional because the shipped Phosphor pack (icons.gen.ts) carries no copy/duplicate glyph —
 *  Duplicate ships wordmark-only rather than borrowing a misleading one. */
function rowVerbButton(text: string, className: string, ariaLabel: string, glyph: string | undefined, onClick: () => void): UIButtonElement {
  const button = document.createElement('ui-button') as UIButtonElement
  button.setAttribute('variant', 'ghost')
  button.setAttribute('aria-label', ariaLabel)
  button.className = className
  if (glyph !== undefined) {
    const icon = document.createElement('ui-icon')
    icon.setAttribute('slot', 'leading')
    icon.setAttribute('glyph', glyph)
    button.append(icon)
  }
  button.append(document.createTextNode(text))
  button.addEventListener('click', onClick)
  return button
}

/** Rebuild the whole list from the CURRENT roster — rows are stateless between rebuilds (the one exception
 *  is an in-flight rename field, which a rebuild drops; a short gesture re-typed, never state corrupted). */
function renderRosterRows(): void {
  const rows = roster.map((persona, index) => rosterRow(persona, index))
  rosterList.replaceChildren(...rows)
}

/**
 * One roster row, two lines: `[ ↑ ↓ · label (or the inline rename field) · Shipped? ]` over
 * `[ Rename? · Duplicate · Delete? ]`. Two lines rather than one, because the drawer is
 * `min(92vw, 26rem)` wide (drawer.css's own inline-size token) and four verbs plus a long persona label do
 * not fit one line at that width without truncating the one thing the row exists to identify. The label
 * takes the free space (`flex: 1 1 auto`) instead of a spacer element.
 *
 * PRESET PROTECTION IS STRUCTURAL, not disabled-with-a-tooltip (the `entry-delete`/TKT-0048 precedent —
 * "present ONLY for a non-built-in entry"): a shipped preset's row never builds a Rename or a Delete button
 * at all, so there is no destructive affordance to mis-fire, and a "Shipped" tag STATES the protection so
 * the absence reads as a rule rather than as a missing feature. Duplicate is on every row — that is the
 * escape hatch that makes the protection free: copy the preset, then edit/rename/delete the copy.
 */
function rosterRow(persona: Persona, index: number): HTMLElement {
  const custom = persona.imported === true
  const row = document.createElement('div')
  row.className = 'roster-row'
  row.dataset.agent = persona.id
  if (persona.id === active.id) row.setAttribute('data-active', '')

  const head = document.createElement('div')
  head.className = 'roster-row-head'
  head.append(
    rowIconButton('caret-up', `Move ${persona.label} up`, index === 0, () => moveAgent(persona.id, -1)),
    rowIconButton('caret-down', `Move ${persona.label} down`, index === roster.length - 1, () => moveAgent(persona.id, 1)),
  )
  const label = document.createElement('span')
  label.className = 'roster-row-label'
  label.textContent = persona.label
  head.append(label)
  if (!custom) {
    const tag = document.createElement('span')
    tag.className = 'roster-row-tag'
    tag.textContent = 'Shipped'
    tag.title = 'A shipped agent — it can be duplicated, but never renamed or deleted.'
    head.append(tag)
  }

  const actions = document.createElement('div')
  actions.className = 'roster-row-actions'
  if (custom) {
    actions.append(
      rowVerbButton('Rename', 'roster-row-rename', `Rename ${persona.label}`, 'pencil-simple', () => beginRename(row, persona)),
    )
  }
  actions.append(rowVerbButton('Duplicate', 'roster-row-duplicate', `Duplicate ${persona.label}`, undefined, () => duplicateAgent(persona)))
  if (custom) {
    actions.append(rowVerbButton('Delete', 'roster-row-delete', `Delete ${persona.label}`, 'trash', () => deleteAgent(persona.id)))
  }

  row.append(head, actions)
  return row
}

/** Reorder — up/down buttons, ruled over drag-and-drop (LLD §7): keyboard-reachable with zero new
 *  primitives (the fleet has no DnD trait, and inventing one is out of this ticket's scope). The WHOLE id
 *  list is persisted, not just the swapped pair, so the stored order pins every entry from then on. */
function moveAgent(id: string, delta: -1 | 1): void {
  const ids = roster.map((p) => p.id)
  const from = ids.indexOf(id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= ids.length) return
  const moved = ids[from]!
  ids[from] = ids[to]!
  ids[to] = moved
  saveRosterOrder(ids)
  refreshRoster() // the row visibly moves — no toast owed for a reorder
}

/** Duplicate ANY agent (a preset included) into a fresh editable copy of its CURRENT state — never the
 *  pristine seed, and never a mutation of the source (LLD §8d). Lands at the roster's end. */
function duplicateAgent(persona: Persona): void {
  const copy = duplicatePersonaFrom(persona, personaStore(persona), [...personaRoster(), ...roster])
  saveImportedPersona(copy) // stamps imported:true ⇒ the copy is deletable/renamable by construction
  refreshRoster()
  announce(`Duplicated “${persona.label}” as “${copy.label}”.`)
}

/** The ONE deletion path all three affordances share (the drawer row calls it directly; the header's
 *  overflow item and the config surface's row reach it through `onDeleteAgentRequest`).
 *
 *  Order is load-bearing: sweep the records FIRST, then re-read the roster, and only then fall back — so
 *  `applyPersona`'s own `pushRoster` reads a roster the deleted agent has already left. The fallback is the
 *  fresh `personaRoster()[0]` (in the default order, the first shipped preset), which can never be the
 *  deleted agent because presets are undeletable. Deleting a NON-active agent leaves the active store and
 *  the conversation completely untouched. */
function deleteAgent(id: string): void {
  const persona = roster.find((p) => p.id === id)
  if (persona === undefined) return
  if (!deleteImportedPersona(persona)) {
    // Defense in depth — no affordance for a preset is ever rendered, so this is a caller bug, not a path.
    announce(`“${persona.label}” is a shipped agent and can’t be deleted. Duplicate it instead.`, true)
    return
  }
  const label = persona.label
  const wasActive = active.id === persona.id
  roster.splice(0, roster.length, ...personaRoster())
  const fallback = roster[0]
  if (wasActive && fallback !== undefined) applyPersona(fallback) // rewrites ACTIVE_PRESET_KEY + re-pushes
  else pushRoster(active.id)
  if (drawer.open) renderRosterRows()
  announce(`Deleted “${label}”.`)
}

/** Inline rename (custom rows only) — the label swaps for a `ui-text-field` seeded with the current label.
 *  Enter (the field's own `change` on commit) or the Save button commits; Escape reverts. Native Tab order
 *  inside a `ui-drawer` is exactly why an embedded field types freely here (drawer.md's Focus note).
 *
 *  DISPLAY-ONLY, ids stable (GH #848's shipped rename law): the persisted store keys are keyed on the id,
 *  so a rename can never orphan an edit. Page-side validation rejects a blank or a colliding label VISIBLY
 *  and leaves the field open — never a silent no-op. */
function beginRename(row: HTMLElement, persona: Persona): void {
  const label = row.querySelector('.roster-row-label')
  if (label === null) return // already renaming this row

  const field = document.createElement('ui-text-field') as UITextFieldElement
  field.className = 'roster-row-field'
  field.setAttribute('size', 'sm')
  field.setAttribute('label', `Rename ${persona.label}`) // → the editor's aria-label (text-field's labelling seam)
  field.value = persona.label

  // `change` fires on Enter AND on blur-with-change, and the Save button's own click blurs the field first —
  // so BOTH paths land here and `settled` is what keeps one gesture from committing (and toasting) twice.
  let settled = false
  const commit = (): void => {
    if (settled) return
    const next = field.value.trim()
    if (next.length === 0) {
      announce('An agent needs a name.', true)
      return
    }
    if (roster.some((p) => p.id !== persona.id && p.label === next)) {
      announce(`Another agent is already called “${next}”.`, true)
      return
    }
    settled = true
    if (next !== persona.label && renameImportedPersona(persona, next)) {
      refreshRoster()
      announce(`Renamed “${persona.label}” to “${next}”.`)
      return
    }
    renderRosterRows() // unchanged (or a record that vanished under us) — just put the row back
  }
  const revert = (): void => {
    if (settled) return
    settled = true
    renderRosterRows()
  }

  field.addEventListener('change', () => commit())
  field.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key !== 'Escape') return
    // Escape inside a modal `<dialog>` is ALSO the platform's dismiss request: stop it here so the first
    // Escape cancels the rename rather than closing the whole drawer out from under it.
    event.preventDefault()
    event.stopPropagation()
    revert()
  })

  const editor = document.createElement('div')
  editor.className = 'roster-row-edit'
  const save = rowVerbButton('Save', 'roster-row-save', `Save the new name for ${persona.label}`, 'check', () => commit())
  editor.append(field, save)
  label.replaceWith(editor)
  field.focus()
}

applyPersona(active) // also stages the header's own roster row (pushRoster, inside applyPersona)
root.append(admin, toasts, fileInput, drawer)

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
