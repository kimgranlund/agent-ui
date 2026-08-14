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
// GH #845 — the Edit Agents drawer's own container (ADR-0188). Consumed UNMODIFIED and TYPE-ONLY here:
// the tag self-defines through the `@agent-ui/components/components` barrel this page already imports at
// [3], and its sheet rides `component-styles.css` at [2] — nothing new to register or import for it.
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
  // GH #845 — one line wider: `deletable` is the component's VISIBILITY axis for its two Delete
  // affordances (the overflow item + the config-surface row), and this page decides what it means —
  // "a library record this page minted or imported", never a shipped preset. `AGENT_PRESETS` rows carry
  // no `imported` flag, so they map to `false` and the component hides Delete for them structurally.
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
admin.onResetRequest(() => {
  resetPersona(active)
  applyPersona(active)
})
// GH #845 — the two new seams (LLD §7). "Edit Agents" opens THIS page's management surface (the component
// never knows what it is); Delete routes both of the component's own affordances into the ONE page-side
// handler the drawer's own rows also call directly.
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

// ── GH #845 — the Edit Agents drawer (LLD §7, page-owned composition) ──────────────────────────────────
// ONE `ui-drawer`, consumed byte-unmodified (ADR-0188): the control owns docking, the top layer, the
// scrim, focus containment + restore, and Escape; EVERY row below is page markup it is opaque to — which
// is exactly the fence ADR-0188's intake §6 drew ("roster lists, danger rows, reorder/duplicate
// affordances all page-owned"). Content is REBUILT on every open and after every mutation: a row carries
// no state between rebuilds except an in-flight rename field, which a rebuild drops — acceptable by
// ruling (a rename is a short gesture; a lost draft is re-typed, never corrupted).

const drawer = document.createElement('ui-drawer') as UIDrawerElement
drawer.setAttribute('edge', 'end')
// Forwarded onto the control's own `<dialog>` part (ADR-0188 cl.5) — the host stays free of role/aria-*.
drawer.setAttribute('aria-label', 'Manage agents')
drawer.className = 'roster-drawer'

const drawerRows = document.createElement('div')
drawerRows.className = 'roster-rows'

/** Which row is currently being renamed in place (at most one) — the ONLY piece of drawer state that
 *  outlives a row node, held here rather than in the DOM so a rebuild reproduces it deterministically. */
let renamingId: string | undefined

{
  const head = document.createElement('header')
  head.className = 'roster-head'
  const title = document.createElement('h2')
  title.textContent = 'Manage agents'
  const hint = document.createElement('p')
  hint.className = 'roster-hint'
  hint.textContent = 'Reorder the picker, rename or duplicate an agent, or delete one you made.'
  head.append(title, hint)
  const foot = document.createElement('footer')
  foot.className = 'roster-foot'
  const close = document.createElement('ui-button') as UIButtonElement
  close.setAttribute('variant', 'soft')
  close.textContent = 'Done'
  close.addEventListener('click', () => {
    drawer.open = false
  })
  foot.append(close)
  drawer.append(head, drawerRows, foot)
}

/** An icon-only ghost row button — the fleet's `icon-only` opt-in plus a REAL accessible name that says
 *  WHICH agent it acts on ("Move “Fable” up"), since the glyph alone names neither the verb nor the row. */
function iconAction(glyph: string, label: string, action: string, onClick: () => void): UIButtonElement {
  const button = document.createElement('ui-button') as UIButtonElement
  button.setAttribute('variant', 'ghost')
  button.setAttribute('icon-only', '')
  button.setAttribute('aria-label', label)
  button.dataset['rowAction'] = action
  const icon = document.createElement('ui-icon')
  icon.setAttribute('slot', 'leading')
  icon.setAttribute('glyph', glyph)
  button.append(icon)
  button.addEventListener('click', onClick)
  return button
}

/** A LABELED ghost row button. Duplicate and Delete are worded, not glyphed: the shipped Phosphor pack
 *  carries no copy/duplicate glyph, and for Delete a verb is owed anyway — ADR-0057, intent never travels
 *  by colour alone, the `entry-delete` ("Remove") wordmark precedent. `aria-label` still names the agent. */
function wordAction(text: string, label: string, action: string, onClick: () => void): UIButtonElement {
  const button = document.createElement('ui-button') as UIButtonElement
  button.setAttribute('variant', 'ghost')
  button.setAttribute('aria-label', label)
  button.dataset['rowAction'] = action
  button.textContent = text
  button.addEventListener('click', onClick)
  return button
}

/** One roster row: `[ up · down | label — or the inline rename field | spacer | rename? · duplicate · delete? ]`.
 *  A PRESET's rename and delete affordances are STRUCTURALLY ABSENT (never present-and-disabled) — the
 *  `entry-delete`/TKT-0048 precedent, "present ONLY for a non-built-in entry", applied one tier up. */
function rosterRow(persona: Persona, index: number, total: number): HTMLElement {
  const row = document.createElement('div')
  row.className = 'roster-row'
  row.dataset['rosterRow'] = persona.id
  if (persona.imported === true) row.dataset['custom'] = ''

  const up = iconAction('caret-up', `Move “${persona.label}” up`, 'up', () => moveAgent(persona.id, -1))
  const down = iconAction('caret-down', `Move “${persona.label}” down`, 'down', () => moveAgent(persona.id, 1))
  // First row's up and last row's down have nowhere to go — disabled, never absent (their column must
  // keep its box, or every row below would shift by a button width).
  if (index === 0) up.setAttribute('disabled', '')
  if (index === total - 1) down.setAttribute('disabled', '')
  row.append(up, down)

  if (renamingId === persona.id) {
    const field = document.createElement('ui-text-field') as UITextFieldElement
    field.className = 'roster-rename'
    field.dataset['rowField'] = 'rename'
    field.setAttribute('aria-label', `Rename “${persona.label}”`)
    field.value = persona.label
    const commit = (): void => {
      if (commitRename(persona, field.value)) renamingId = undefined
      renderDrawerRows()
    }
    field.addEventListener('keydown', (event) => {
      const key = (event as KeyboardEvent).key
      if (key === 'Enter') {
        event.preventDefault()
        commit()
      } else if (key === 'Escape') {
        // Reverts, and never reaches the drawer's own dialog — Escape here means "stop renaming", not
        // "close the surface" (the platform's cancel would otherwise dismiss the whole drawer).
        event.preventDefault()
        event.stopPropagation()
        renamingId = undefined
        renderDrawerRows()
      }
    })
    row.append(field, spacer(), wordAction('Save', `Save the new name for “${persona.label}”`, 'confirm', commit))
    return row
  }

  const label = document.createElement('span')
  label.className = 'roster-label'
  label.textContent = persona.label
  row.append(label, spacer())

  if (persona.imported === true) {
    row.append(
      iconAction('pencil-simple', `Rename “${persona.label}”`, 'rename', () => {
        renamingId = persona.id
        renderDrawerRows()
      }),
    )
  }
  row.append(wordAction('Duplicate', `Duplicate “${persona.label}”`, 'duplicate', () => duplicateAgent(persona.id)))
  if (persona.imported === true) {
    const remove = wordAction('Delete', `Delete “${persona.label}”`, 'delete', () => deleteAgent(persona.id))
    remove.classList.add('roster-danger') // the page-side danger repoint (agent-admin-app.css)
    row.append(remove)
  }
  return row
}

function spacer(): HTMLElement {
  const el = document.createElement('span')
  el.className = 'roster-spacer'
  return el
}

/** Rebuild the whole list from `roster` — the SAME array `pushRoster` reads, so the drawer's order and
 *  the picker's order are one fact, never two reads that could disagree. */
function renderDrawerRows(): void {
  drawerRows.replaceChildren(...roster.map((persona, index) => rosterRow(persona, index, roster.length)))
}

/** Open the management surface. The list is built from a FRESH ordered `personaRoster()` read (LLD §7's
 *  own words) by going through `refreshRoster` first — so an open can never paint a stale roster, whatever
 *  wrote to the library since the last mutation (a second tab, for one). `refreshRoster` skips the row
 *  rebuild while the drawer is closed, hence the explicit render on the next line. */
function openRosterDrawer(): void {
  refreshRoster()
  renderDrawerRows()
  drawer.open = true
}

/** The ONE page choke point after ANY roster mutation (LLD §7): refresh the in-memory view from the fresh
 *  ORDERED read, re-push the picker, and rebuild the drawer if it is open. `roster` is a captured `const`
 *  every closure on this page shares — its CONTENTS are replaced, never the binding. */
function refreshRoster(): void {
  roster.splice(0, roster.length, ...personaRoster())
  pushRoster(active.id)
  if (drawer.open) renderDrawerRows()
}

/** Reorder: swap two ids in the persisted order array (materialized from the CURRENT picker order, so the
 *  very first reorder pins today's order before changing it) and refresh. No toast — the row visibly moves. */
function moveAgent(id: string, delta: -1 | 1): void {
  const ids = roster.map((p) => p.id)
  const from = ids.indexOf(id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= ids.length) return
  const moved = ids[from]!
  ids[from] = ids[to]!
  ids[to] = moved
  saveRosterOrder(ids)
  refreshRoster()
}

/** Duplicate ANY agent (a preset included) into a fresh editable custom copy, from its CURRENT edited
 *  state — the export snapshot, never the seed. The source is never mutated; `saveImportedPersona` stamps
 *  `imported: true`, so a duplicated preset becomes an ordinary custom agent by construction. */
function duplicateAgent(id: string): void {
  const persona = roster.find((p) => p.id === id)
  if (persona === undefined) return
  const copy = duplicatePersonaFrom(persona, personaStore(persona), [...personaRoster(), ...roster])
  saveImportedPersona(copy)
  refreshRoster()
  notify(`Duplicated “${persona.label}” as “${copy.label}”.`)
}

/** Commit an inline rename, page-side validation first (trimmed non-empty, no collision with another
 *  entry's label). A rejection is announced and the field STAYS — never a silent no-op. */
function commitRename(persona: Persona, next: string): boolean {
  const label = next.trim()
  if (label.length === 0) {
    notify('An agent needs a name.', true)
    return false
  }
  if (roster.some((p) => p.id !== persona.id && p.label === label)) {
    notify(`Another agent is already called “${label}”.`, true)
    return false
  }
  if (!renameImportedPersona(persona, label)) {
    notify(`“${persona.label}” is a shipped agent — it cannot be renamed.`, true)
    return false
  }
  const before = persona.label
  refreshRoster()
  notify(`Renamed “${before}” to “${label}”.`)
  return true
}

/** The ONE delete handler every affordance shares — the component's overflow item and config-surface row
 *  (through `onDeleteAgentRequest`) and the drawer's own rows (directly, page-owned content).
 *
 *  An ACTIVE agent that vanishes falls back sanely: the fresh ordered roster's FIRST entry, which can
 *  never be empty because presets are undeletable. `applyPersona` is what rewrites `ACTIVE_PRESET_KEY` and
 *  swaps the store — this function does not touch either, and neither does the persistence layer. */
function deleteAgent(id: string): void {
  const persona = roster.find((p) => p.id === id)
  if (persona === undefined) return
  const label = persona.label
  if (!deleteImportedPersona(persona)) {
    // Defense in depth, three independent layers deep: the component hides the affordance for a protected
    // entry, the drawer omits the row's button structurally, and the persistence guard still refuses.
    notify(`“${label}” is a shipped agent — it cannot be deleted.`, true)
    return
  }
  // Catch the in-memory view up BEFORE any push, so no re-push can ever name the record just removed.
  roster.splice(0, roster.length, ...personaRoster())
  if (active.id === id) {
    const fallback = roster[0]
    if (fallback !== undefined) applyPersona(fallback)
  }
  refreshRoster()
  notify(`Deleted “${label}”.`)
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
// GH #845 — the drawer mounts at boot beside the toast region (its own children move into the control's
// `<dialog>` part at connect); it renders nothing until `open` is set, so an unopened drawer costs one
// `display: contents` host and no layout.
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
