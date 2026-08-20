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
// ADR-0198 (GH #1101) — the shared end-of-flow page-chrome affordance (the #1065 shared-seam lift).
import { createFlowChrome } from '../lib/flow-chrome.ts'
import type { AdminAgentSurfaceTurn, TeamDeclaration } from '@agent-ui/app/agent-admin-schema'
// GH #1196 (ADR-0203 clause 4) — the team record this page's team-shaped mint path persists; ADR-0227
// wave 2 (GH #1545): the records now reach this page as a DataSource — the read is ONE `resource()`
// and `handleTeamDeclared` writes through a `mutation()` (same keys, same validation-closed law).
import { AgentTeamValidationError, createAgentTeamSource, type AgentTeam } from '@agent-ui/app/agent-admin-team'
import type { UIToastRegionElement } from '@agent-ui/components/controls/toast-region'
// GH #845 (LLD-C15/§7) — the Edit Agents drawer's vehicle: `ui-drawer` (ADR-0188), COMPOSED byte-unmodified.
// Its content (the roster rows and every management verb on them) is page-owned by that control's own fence.
import type { UIDrawerElement } from '@agent-ui/components/controls/drawer'
import type { UIButtonElement } from '@agent-ui/components/controls/button'
import type { UITextFieldElement } from '@agent-ui/components/controls/text-field'
// GH #921 — the per-card (...) actions menu and the drawer's Reorganize mode toggle.
import type { UIMenuElement } from '@agent-ui/components/controls/menu'
import type { UIToggleElement } from '@agent-ui/components/controls/toggle'
// GH #952 — the pointer-drag reorder mechanics (formerly this page's own `wireDrag`) now live in the
// reusable `list-reorder` trait; this page dogfoods it exactly like `ui-nav-rail`/`ui-conversation-composer`
// dogfood `traits/overlay` (vitest.config.ts's own precedent comment for that subpath).
import { listReorder } from '@agent-ui/components/traits/list-reorder'
// ADR-0227 wave 1 (GH #1542) — the roster read path is ONE resource() and every roster write is a
// mutation() with invalidation over the PersonaRosterSource (@agent-ui/data's first real consumer).
// `effect` drives the one derivation that feeds the component's push seam; the optimistic commits keep
// every handler's same-tick reads honest (the source's own writes land in the calling tick too).
import { effect, signal } from '@agent-ui/components'
import { createStore, mutation, resource, type SourceContext, type Store } from '@agent-ui/data'
import { applyRosterOrder, type PersonaRosterView } from '@agent-ui/app/agent-admin-roster-source'
import {
  builderStore,
  loadModifiedAt,
  personaInstantiated,
  personaRoster,
  personaStore,
  resetPersona,
  rosterSource,
  type Persona,
} from './agent-admin-presets.ts'
import { duplicatePersonaFrom, exportPersonaFile, importedPersonaFrom, mintBlankPersona, personaFileName, personaFileText, readPersonaFile } from './agent-admin-persona-file.ts'
import { buildDebugBundle, debugBundleFileName } from './agent-admin-debug-export.ts'
import { buildZip } from '../lib/zip-writer.ts'
import { librariesForCategory, setLiveIntegrations, setLiveServices, type PresetCategory } from './agent-admin-libraries.ts'
// GH #637 S1 — the blank agent's seed: the EXACT shipped default `ui-agent-admin` itself falls back to
// when no store prop is ever set (agent-admin.ts connected()'s own `initial` object) — pure reuse, so a
// freshly-minted blank agent renders exactly what a bare, unconfigured `<ui-agent-admin>` would.
import { DEFAULT_MODEL_ID, defaultAgentConfigSchema, initialValuesFor } from '@agent-ui/app/agent-admin-schema'
// GH #921 — the card's Capabilities/Surface summaries read straight off the persona's OWN stored config.
import { ENTRY_KINDS, initialEntryValues } from '@agent-ui/app/agent-admin-entries'
import { entriesStoreKey, type Entry, type EntryLibraryPack } from '@agent-ui/app/entry-data'
// GH #1212 — the export path's own need: a routed resource entry's REAL text, materialized (never a
// placeholder) and stripped of its browser-local `idbRef` (`resource-idb-store.ts`'s own header).
import { resourceEntriesForExport } from '@agent-ui/app/agent-admin-resource-idb'
// ADR-0208 (GH #1340/#1349) — the imported skill-pack SHELF: `.skillpack.json` snapshots (the import
// CLI's D1 format) ingested via the user's own file picker into the shared StorageAdapter store
// (`skill-packs:<id>`, IndexedDB tier) and projected into the SAME `libraries` seam as the first-party
// packs (D4 — per-agent opt-in IS the existing add-from-library mechanism). The format, fail-closed
// validation, store, and projection live in @agent-ui/app's skill-pack-store.ts (pure, tested); this
// page owns only the browser I/O (the file picker in) and the shelf SURFACE (the drawer below —
// review-before-enable: full content + provenance + scan display, D5.2, plus remove).
import {
  createSkillPackSource,
  importedSkillPackLibrary,
  parseSkillPackText,
  skillPackAttribution,
  type SkillPackSnapshot,
} from '@agent-ui/app/agent-admin-skill-packs'

const root = document.querySelector('#app') ?? document.body

// ── the persona roster (TKT-0074 presets + the GH #406 imported library) ────────────────────────────────
// Each persona is a persona-scoped store (its own persistKey; edits persist per persona). Switching swaps
// `admin.store` — the component's reactive store effect re-pushes it into the settings pane, rewires every
// entry section, and — GH #145 fix — genuinely resets the conversation (chat log, open surfaces, the
// live-request history, and the Dialog Turns log) for a real store reassignment; the store-swap probe
// (agent-admin-app.test.ts) and the reset regression (agent-admin.test.ts) both pin it.

const admin = document.createElement('ui-agent-admin') as UIAgentAdminElement

// ── ADR-0227 clause 4 (GH #1542): the roster read path is ONE resource ───────────────────────────────────
// The view (ordered roster + persisted active id) is the ONE owner; the page var / component snapshot /
// raw storage-key triplication (the audit's F6/Q4) collapses into derivations of it. The store is seeded
// same-tick (ADR-0193's sync-read amendment) so the first paint renders synchronously, exactly as before;
// `live: true` rides the source's cross-tab subscribe seam — the staleness guard this wave adds.
const ROSTER_KEY = 'agent-admin/roster'
const rosterStore = createStore()
rosterStore.commit(ROSTER_KEY, rosterSource.readViewSync())
const rosterResource = resource<PersonaRosterView<Persona>>(ROSTER_KEY, rosterSource.view, {
  store: rosterStore,
  live: true,
})

/** The current roster — a derivation of the one resource (read at call time, never a copied array). */
function currentRoster(): readonly Persona[] {
  return rosterResource.data.peek()?.personas ?? []
}

/** The active persona — THE derivation of the one active-id owner (`view.activeId`), with the page's
 *  fallback rule (first roster entry — presets are undeletable, so it always exists) applied at read
 *  time. GH #143 — known BEFORE the first `admin.libraries` assignment below, same as ever. */
function activeAgent(): Persona {
  const view = rosterResource.data.peek()
  const personas = view?.personas ?? []
  return personas.find((p) => p.id === view?.activeId) ?? personas[0]!
}

/** Optimistic-view helper: every roster mutation commits the SAME transform its source write persists,
 *  so the view — and every derivation on it — updates in the calling tick (mutation() rolls the commit
 *  back per-key on error). The store is seeded at boot, so `prev` only falls back defensively. */
function optimisticView(store: Store, up: (prev: PersonaRosterView<Persona>) => PersonaRosterView<Persona>): void {
  store.commit(ROSTER_KEY, (prev: unknown) => up((prev as PersonaRosterView<Persona> | undefined) ?? rosterSource.readViewSync()))
}

/** ATOMIC read-back commit — each mutation fn's settle step: the post-write truth is read AND committed
 *  in ONE microtask job, so no other write can interleave between read and commit. This page mirrors
 *  deliberately instead of `invalidate`-refetching: an invalidation's read→commit pipeline spans jobs,
 *  and a rapid successive mutation's optimistic commit gets REGRESSED by the earlier action's in-flight
 *  refetch landing late (measured live — the drawer reorder round-trip caught it) — the exact clobber
 *  class resource.ts's own mirror law names ("an external commit … is MIRRORED, never re-fetched —
 *  re-fetching here would clobber the just-written value"). Cross-TAB freshness rides the resource's
 *  `live` subscription instead (the source's adapter seam), which also mirrors. */
function commitRosterView(): void {
  rosterStore.commit(ROSTER_KEY, rosterSource.readViewSync())
}

// ── the roster mutations (ADR-0227 clause 4: saves/renames/reorders/deletes + the active-id write) ──────
const saveAgentMutation = mutation(
  async (persona: Persona, ctx) => {
    const created = await rosterSource.create(persona, ctx)
    commitRosterView()
    return created
  },
  {
    store: rosterStore,
    optimistic: (persona, store) =>
      optimisticView(store, (prev) => ({
        ...prev,
        personas: [...prev.personas.filter((p) => p.id !== persona.id), { ...persona, imported: true }],
      })),
  },
)

const renameAgentMutation = mutation(
  async (input: { id: string; label: string }, ctx) => {
    const renamed = await rosterSource.update(input.id, { label: input.label }, ctx)
    commitRosterView()
    return renamed
  },
  {
    store: rosterStore,
    optimistic: ({ id, label }, store) =>
      optimisticView(store, (prev) => ({
        ...prev,
        personas: prev.personas.map((p) => (p.id === id ? { ...p, label: label.trim() } : p)),
      })),
  },
)

const deleteAgentMutation = mutation(
  async (persona: Persona, ctx) => {
    await rosterSource.remove(persona.id, ctx)
    commitRosterView()
  },
  {
    store: rosterStore,
    optimistic: (persona, store) =>
      optimisticView(store, (prev) => ({ ...prev, personas: prev.personas.filter((p) => p.id !== persona.id) })),
  },
)

const reorderAgentsMutation = mutation(
  async (ids: readonly string[]) => {
    rosterSource.saveOrderSync(ids)
    commitRosterView()
  },
  {
    store: rosterStore,
    optimistic: (ids, store) =>
      optimisticView(store, (prev) => ({ ...prev, personas: applyRosterOrder(prev.personas, ids) })),
  },
)

const setActiveAgentMutation = mutation(
  async (id: string) => {
    rosterSource.writeActiveIdSync(id)
    commitRosterView()
  },
  {
    store: rosterStore,
    optimistic: (id, store) => optimisticView(store, (prev) => ({ ...prev, activeId: id })),
  },
)
// ── ADR-0227 wave 2 (GH #1545): the imported skill-pack shelf is ONE resource ───────────────────────────
// The `skill-packs:` IDB store (ADR-0208 D3, keys unchanged) reads through a `DataSource`; the page's
// old `importedSkillPacks` module cache and its hand-called refresh sites become DERIVATIONS of this
// resource. No sync seed (the IDB tier is async by nature, ADR-0193) — boot renders the empty shelf
// exactly as before, and the libraries derivation effect below re-runs once the read lands. An
// unavailable IndexedDB (SSR, a locked-down embed) parks the resource in `error` with `data` undefined —
// the same empty-shelf degrade the old `.catch(() => {})` bought, never a crash.
const skillPackSource = createSkillPackSource()
const SKILL_PACKS_KEY = 'agent-admin/skill-packs'
const skillPacksStore = createStore()
const skillPacksResource = resource<readonly SkillPackSnapshot[]>(SKILL_PACKS_KEY, skillPackSource.shelf, {
  store: skillPacksStore,
})

/** The current shelf — a derivation of the one resource (read at call time, never a copied array). */
function currentSkillPacks(): readonly SkillPackSnapshot[] {
  return skillPacksResource.data.peek() ?? []
}

// The shelf mutations: import (create — D2's idempotent re-import IS the upsert) and remove, each
// settling with an ATOMIC read-back mirror commit — the SAME deviation the roster mutations above
// document (resource.ts's mirror doctrine): an `invalidate` refetch spans jobs, and a rapid successive
// import/remove's commit would be regressed by the earlier action's in-flight read landing late.
// The mirror READ-BACK is best-effort, deliberately isolated from the write's own success/failure
// (review finding): the create/remove already committed by the time this runs, so a read-back that
// throws (a transient IDB hiccup) must never turn an already-successful write into a reported failure
// — it only leaves the view stale until the NEXT successful read (boot, or another mutation's own
// read-back) refreshes it. Swallowed, never re-thrown.
async function mirrorSkillPackShelf(ctx: SourceContext): Promise<void> {
  await skillPackSource.shelf
    .read(SKILL_PACKS_KEY, ctx)
    .then((shelf) => skillPacksStore.commit(SKILL_PACKS_KEY, shelf))
    .catch(() => {})
}

const importSkillPackMutation = mutation(
  async (snapshot: SkillPackSnapshot, ctx) => {
    const created = await skillPackSource.create(snapshot, ctx)
    await mirrorSkillPackShelf(ctx)
    return created
  },
  { store: skillPacksStore },
)

// Returns `true` (never `undefined`) on success — review finding: `run()` resolves `undefined` on
// BOTH a genuine error and a void success, so a caller peeking the shared `.status` signal after the
// await can misclassify THIS call's outcome if a second remove races in and settles first. Returning a
// sentinel makes `run()`'s own resolved value the per-call truth, no shared-state peek needed.
const removeSkillPackMutation = mutation(
  async (packId: string, ctx): Promise<true> => {
    await skillPackSource.remove(packId, ctx)
    await mirrorSkillPackShelf(ctx)
    return true
  },
  { store: skillPacksStore },
)

/** The ONE libraries composition (now called from exactly ONE place, the derivation effect below): the
 *  first-party packs scoped to the persona's category (GH #143) PLUS the imported shelf appended under
 *  the skill kind (ADR-0208 D4 — the same reactive seam, no second pipeline). Fresh object every call —
 *  the `libraries` prop's identity-change law (agent-admin.ts), now also COMPILE-enforced (the prop is
 *  readonly-typed, the folded Q5): reassignment is the only write that even typechecks. */
function librariesWithShelf(category: PresetCategory | undefined, shelf: readonly SkillPackSnapshot[]): Record<string, EntryLibraryPack[]> {
  const libraries = librariesForCategory(category)
  if (shelf.length > 0) {
    libraries[ENTRY_KINDS.skill] = [...(libraries[ENTRY_KINDS.skill] ?? []), ...importedSkillPackLibrary(shelf)]
  }
  return libraries
}

// The one NON-signal input to the libraries composition: `setLiveIntegrations`/`setLiveServices`
// (agent-admin-libraries.ts) mutate module state the effect below cannot see — the DEV live-read
// overlay bumps this signal after landing them, which is the whole reason it exists.
const librariesRevision = signal(0)

// ── the ONE `admin.libraries` derivation (ADR-0227 clause 2 — replaces SIX hand-called assignment sites:
// boot, the async shelf-load re-push, applyPersona, pack import, pack remove, and the DEV live-read
// overlay). Runs synchronously once at creation (the reactive kernel's effect contract), so the FIRST
// assignment still lands before `root.append(admin)` connects the element — the compose-time capture law
// the `libraries` prop documents for the section SHELL is preserved. Re-runs (microtask-batched) whenever
// the active persona's CATEGORY, the shelf, or the live-read revision actually changes — the identity
// guard below keeps a mere rename/reorder (which commits a fresh roster view) from rebuilding the
// add-from-library menus for nothing.
const EMPTY_SHELF: readonly SkillPackSnapshot[] = [] // a stable reference — keeps the guard's identity check meaningful while the shelf read is still in flight (undefined every re-run otherwise)
let lastLibrariesInputs: { category: PresetCategory | undefined; shelf: readonly SkillPackSnapshot[]; revision: number } | undefined
effect(() => {
  const revision = librariesRevision.value
  const view = rosterResource.data.value
  const shelf = skillPacksResource.data.value ?? EMPTY_SHELF
  const active = view === undefined ? undefined : (view.personas.find((p) => p.id === view.activeId) ?? view.personas[0])
  const category = active?.category
  if (lastLibrariesInputs !== undefined && lastLibrariesInputs.category === category && lastLibrariesInputs.shelf === shelf && lastLibrariesInputs.revision === revision) return
  lastLibrariesInputs = { category, shelf, revision }
  admin.libraries = librariesWithShelf(category, shelf)
})

// ── ADR-0227 wave 2 (GH #1545): the AgentTeam records read through ONE resource ────────────────────────
// `createAgentTeamSource` wraps the SAME `agent-ui-agent-teams` localStorage records (keys unchanged);
// `handleTeamDeclared` writes through the mutation below. No `live` leg — the one page-side consumer is
// the mint path's collision scan, which refetches explicitly for cross-tab freshness at the moment it
// actually mints (the old fresh `loadAgentTeams()` read, now riding the resource's own read path).
const teamSource = createAgentTeamSource()
const TEAMS_KEY = 'agent-admin/teams'
const teamsStore = createStore()
const teamsResource = resource<readonly AgentTeam[]>(TEAMS_KEY, teamSource.view, { store: teamsStore })

// The team write: validation-closed create (the source THROWS AgentTeamValidationError — nothing lands
// on an invalid record) settling with the same atomic read-back mirror commit the roster and shelf
// mutations document (resource.ts's mirror doctrine, the wave-1 deviation precedent).
const saveTeamMutation = mutation(
  async (input: { team: AgentTeam; knownAgentIds: readonly string[] }, ctx) => {
    const created = await teamSource.create(input, ctx)
    teamsStore.commit(TEAMS_KEY, await teamSource.view.read(TEAMS_KEY, ctx))
    return created
  },
  { store: teamsStore },
)

// Armed by the DEV overlay below once a live key probes available; re-invoked per persona switch so each
// persona's SURFACE session (TKT-0076 — the runner closure owns the a2ui transcript) starts clean.
let armSurfaceTurn: (() => void) | undefined

// ── ADR-0198 (GH #1101) — the end-of-flow chrome on the TEST chat (the second consumer of the shared
// site/lib flow-chrome module, the #1065 lift). The runner peels the model's explicit `flowEnd` into a
// typed event; this PAGE wrapper consumes it — presents the done/start-over row after the closing note
// bubble in the test conversation's log — and FILTERS it, so the component never sees the kind (page
// chrome by contract, ADR-0198 cl.3). `Start over` routes to this page's EXISTING clean-slate pieces —
// `armSurfaceTurn?.()` (the same fresh-producer-session re-arm every persona switch already runs) plus
// clearing the test chat's light-DOM log — never a second reset implementation. (A same-persona re-apply
// is deliberately NOT used: `personaStore` caches per id, so `admin.store` would keep its identity and
// GH #145's component-side reset would not fire.)
const flowChrome = createFlowChrome({
  onStartOver: () => {
    armSurfaceTurn?.()
    testChatLog()?.replaceChildren()
  },
})

/** The TEST conversation's log element (document order — the first `ui-conversation` is the test chat,
 *  the shipped-anatomy law agent-admin.ts's own pane ordering preserves; light DOM, so the page can
 *  append its own chrome row). */
function testChatLog(): HTMLElement | undefined {
  return admin.querySelector('ui-conversation')?.querySelector<HTMLElement>('[data-part="log"]') ?? undefined
}

/** Wrap the surface-turn runner: pass every event through except `flowEnd`, which presents the shared
 *  end-of-flow affordance once the turn's stream has fully delivered (TEST session only — the Builder
 *  interview is not an ask-flow surface). Omitted `flowEnd` = today's behavior (the safe-degrade law). */
function withFlowChrome(inner: AdminAgentSurfaceTurn): AdminAgentSurfaceTurn {
  return async function* (req) {
    let flowEnded = false
    for await (const event of inner(req)) {
      if (event.kind === 'flowEnd') {
        if ((req.session ?? 'test') === 'test') flowEnded = true
        continue // page-chrome territory — the component never consumes this kind
      }
      yield event
    }
    if (flowEnded) {
      const log = testChatLog()
      // The synthetic envelope re-states the already-verified fact — `readMetaLine` enforced literal-true
      // upstream; `maybePresent`'s own guard keeps the one-row invariant.
      if (log && flowChrome.maybePresent({ a2uiMeta: { flowEnd: true } }, log)) log.scrollTop = log.scrollHeight
    }
  }
}

// GH #686's Amendment (admin-three-pane-ia.lld.md §16.3/§16.5, S7-d) — the canvas-header (title/tagline,
// the agentMenu switcher, the "…" overflow) is RETIRED entirely: this page renders NO header of its own
// any more — `ui-agent-admin`'s own S7-c unified header bar is the only header, and every prior overflow
// action now reaches its page-side handler through one of the component's six registration seams
// (admin-three-pane-ia.lld.md §16.3, frozen shapes) instead of a menu commit.

/** Push one roster snapshot into the header's agent-select (setAgentRoster — data-in, re-callable).
 *  ADR-0227 clause 2: the seam stays the component's public push API, and the page DERIVES what to push
 *  from the one resource — the roster derivation effect below re-runs this on every committed view, so
 *  a mint/import/rename/reorder/delete/switch all reach the select through one derivation instead of
 *  hand-threaded call sites (the seam's own re-callable contract, LLD §16.3). */
function pushRoster(view: PersonaRosterView<Persona> = rosterResource.data.peek() ?? rosterSource.readViewSync()): void {
  // GH #845 (LLD-C15) — `deletable` is the ONE new field, and its meaning is page-owned: a persona is
  // deletable exactly when it is a LIBRARY record (`imported === true` — an import, a mint, or a duplicate),
  // never when it is a shipped `AGENT_PRESETS` preset. The component reads it only as a visibility gate for
  // its two Delete affordances (the overflow item + the config-surface row); ABSENT reads protected, so this
  // one line is the whole reason a preset shows neither.
  const entries: AgentRosterEntry[] = view.personas.map((p) => ({ id: p.id, label: p.label, deletable: p.imported === true }))
  const activeId = (view.personas.find((p) => p.id === view.activeId) ?? view.personas[0])?.id ?? ''
  admin.setAgentRoster(entries, activeId)
}
// GH #1277 — the Team pane's 'From catalog' source: the shipped preset catalog (id/label/tagline/
// category), MINUS every preset already instantiated (`personaInstantiated` — the pane's dedup law:
// an instantiated preset appears only under 'Your agents'). `entries` is read at every option
// population, so the filter is live: the moment a pick instantiates a preset it leaves the catalog.
// `instantiate` is the SAME mint machinery the persona picker's own activation path uses —
// `personaStore(persona)` builds the persona-scoped store with the preset's seed applied (no new mint
// path) — followed by the standard `pushRoster` re-push (the seam's own re-callable contract), WITHOUT
// switching the active persona (adding a team member is not an activation — `applyPersona` would
// hijack the whole workbench mid-form).
export function instantiateCatalogPersona(id: string): { id: string; label: string } | undefined {
  const persona = currentRoster().find((p) => p.id === id)
  if (persona === undefined) return undefined
  personaStore(persona) // seed applied — the agent's store now exists (personaInstantiated flips true)
  pushRoster() // instantiated-ness is not view data, so the derivation effect has nothing to wake on — re-push explicitly
  return { id: persona.id, label: persona.label }
}
admin.setAgentCatalog({
  entries: () =>
    currentRoster()
      .filter((p) => p.imported !== true && !personaInstantiated(p.id))
      .map((p) => ({ id: p.id, label: p.label, tagline: p.tagline, ...(p.category === undefined ? {} : { category: p.category }) })),
  instantiate: async (id) => instantiateCatalogPersona(id),
})

admin.onAgentSelect((id) => {
  const persona = currentRoster().find((p) => p.id === id)
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
  const persona = activeAgent()
  resetPersona(persona)
  applyPersona(persona)
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

// GH #1196 (ADR-0203 clause 4) — the Builder's team-shaped generation path's own registration seam.
// Fires from INSIDE the authoring turn loop's fenced `team` consumption arm (agent-admin.ts); this
// page owns everything it fans out to (persona minting, roster registration, `AgentTeam` validation +
// persistence) — the component itself never mints anything (the DAG this file's own imports honor).
admin.onTeamDeclared((team) =>
  void handleTeamDeclared(team).catch(() => notify('The team could not be created — something went wrong saving it.', true)),
)

// ── GH #1537 — ONE agent name everywhere (Kim's 2026-08-20 unify ruling) ────────────────────────────────
// Two "agent name" identities used to never synchronize: `Persona.label` (the roster identity the header
// select, the drawer rows, and the Team pane's GM/member lines all read) and the store's `'name'` key (the
// turn-time identity the Settings pane's Name field writes and `AgentConfigSnapshot.name` reads). The unify
// mechanism is this page-level subscription: the ACTIVE persona's store notifies every write
// (`SettingsStore.subscribe`, agent-admin-presets.ts's `personaStore` seam), and a real `'name'` change
// drives the SAME `renameAgentMutation` path the drawer's pencil rename already uses (ADR-0227: the
// rename is a mutation on the one roster resource; the derivation effect repaints every surface) — so
// the select trigger, the option rows, the drawer, and the Team pane (which reads the
// same `#pendingRoster` snapshot at invoke time) all follow in one motion. The reverse direction (drawer
// rename → store `'name'`) lives in `beginRename`'s commit below; BOTH directions guard on value equality,
// so subscribe→rename→subscribe can never loop. The Settings pane's Name field is not the only intended
// writer: the Builder's personaPatch applies `name` through the SAME active store (`applyPersonaPatch` →
// `store.set`, agent-admin.ts), so an interview that names the draft renames its roster row live — the
// feature working, not a side effect.
let unsubscribeActiveName: (() => void) | undefined

/** Drive the roster label from a committed store `'name'` write (GH #1537). `personaId` is captured at
 *  subscribe time — the subscription is torn down and re-armed on every `applyPersona`, so a rename on
 *  persona A can never rename persona B. The persona is re-resolved from the LIVE view by id (never a
 *  captured object): the roster derivation reads fresh objects on every committed view, so a captured
 *  reference's label goes stale after any rename/reorder. */
function syncRosterLabelFromName(personaId: string, value: unknown): void {
  if (typeof value !== 'string') return
  const next = value.trim()
  const persona = currentRoster().find((p) => p.id === personaId)
  // A blank commit is skipped SILENTLY: the schema marks `name` required (agent-admin-schema.ts), so the
  // field's own validation is the visible feedback — and the drawer's own "an agent needs a name" law
  // already keeps a blank label out of the roster.
  if (persona === undefined || next.length === 0 || next === persona.label) return
  if (persona.imported !== true) {
    // A shipped preset is structurally rename-fenced (the source's imported-only rename law +
    // the drawer's affordance gate — GH #848's rename law), so for a preset the Name field edits ONLY the
    // turn-time identity (`AgentConfigSnapshot.name` — how the agent refers to itself in generation); the
    // picker keeps the shipped label. Stated visibly, never a silent divergence.
    notify(`“${persona.label}” is a shipped agent — the picker keeps its shipped name. The new name applies only to the agent's own replies.`)
    return
  }
  if (currentRoster().some((p) => p.id !== persona.id && p.label === next)) {
    // The drawer rename's own collision law, mirrored — the store keeps what the user typed (their
    // turn-time name), but the roster label refuses the duplicate, and says so.
    notify(`Another agent is already called “${next}” — the picker still shows “${persona.label}”.`, true)
    return
  }
  // The rename rides the roster mutation (ADR-0227 cl.4): its optimistic commit updates the view's label
  // in THIS tick — so the `next === persona.label` guard above holds against the re-notification below —
  // the source persists the record, and the derivation effect re-pushes the select + drawer rows.
  void (async () => {
    const renamed = await renameAgentMutation.run({ id: persona.id, label: next })
    // The label took the TRIMMED form, so the store keeps it byte-equal too — an untrimmed commit
    // ("  Wrench  ") must not leave a residual two-identity divergence inside the unify feature itself.
    // Loop-safe: the re-notification this write fires lands on the `next === persona.label` guard above
    // (the optimistic commit already updated the label).
    if (renamed !== undefined && value !== next) personaStore(persona).set('name', next)
  })()
}

function applyPersona(persona: Persona): void {
  // ADR-0227 (F6/Q4) — the ONE active-id write path: the mutation persists through the roster source and
  // its optimistic commit updates the view in this same tick, so every derivation (`activeAgent()`, the
  // roster effect's re-push, the drawer rows) follows from one owner instead of three hand-threaded copies.
  void setActiveAgentMutation.run(persona.id)
  // ADR-0178 cl.5 (LLD-C8) — the ONE choke point that exits the guided-authoring flow: clearing it here,
  // BEFORE the store swap, makes the ordering deterministic (exit the flow → GH #145's reset → optionally
  // re-enter), so switching personas can never leave a previous draft's interview armed over a new one.
  admin.authoringStore = undefined
  admin.store = personaStore(persona)
  // GH #1537 — the name-unify subscription FOLLOWS the active persona: tear down the previous persona's
  // listener before arming this one (a rename on persona A must never rename persona B), and re-arm even
  // for a same-persona re-apply — `resetPersona` (the onResetRequest path) drops the cached store, so the
  // instance under `personaStore(persona)` here can be a fresh one the old listener never knew.
  unsubscribeActiveName?.()
  unsubscribeActiveName = personaStore(persona).subscribe?.((key, value) => {
    if (key === 'name') syncRosterLabelFromName(persona.id, value)
  })
  // GH #143 — the add-from-library menu re-scopes to the NEW persona's category via the ONE libraries
  // derivation effect (ADR-0227 wave 2): the setActive commit above already changed the view's activeId,
  // which is exactly the input that effect derives the category from — no hand-placed assignment here.
  armSurfaceTurn?.()
  flowChrome.dismiss() // ADR-0198 — a persona switch clears the conversation; no stale affordance survives it
  // GH #686's Amendment — the header's own agent-select "current choice" signal now rides the roster
  // derivation effect (the setActive commit above woke it), replacing the retired hand-placed re-push.
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

// GH #1212 — a `PersonaStateReader`-shaped wrapper over a live store: every OTHER key reads through
// unchanged, but `entries:resource` answers the MATERIALIZED, export-ready projection (real content
// inlined, `idbRef`/`contentLength` stripped — `resource-idb-store.ts`'s own `resourceEntriesForExport`).
// `exportPersonaFile`/`buildDebugBundle` stay pure, synchronous functions unchanged — only this page's
// own export glue awaits the one async step (a user-triggered click can afford it) before calling them.
async function materializedReaderFor(store: ReturnType<typeof personaStore>): Promise<{ get(key: string): unknown }> {
  const resourceKey = entriesStoreKey(ENTRY_KINDS.resource)
  const rawResources = store.get(resourceKey)
  const materialized = Array.isArray(rawResources) ? await resourceEntriesForExport(rawResources as Entry[]) : rawResources
  return {
    get(key: string): unknown {
      return key === resourceKey ? materialized : store.get(key)
    },
  }
}

async function exportActivePersona(): Promise<void> {
  const active = activeAgent()
  const reader = await materializedReaderFor(personaStore(active))
  const text = personaFileText(exportPersonaFile(active, reader))
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

async function exportDebugBundle(): Promise<void> {
  // GH #1212 — every roster agent's own resource entries materialize (real content, refs stripped)
  // before `buildDebugBundle` ever sees them, the SAME `materializedReaderFor` wrapper
  // `exportActivePersona` uses — a persona whose store carries no `entries:resource` key at all costs
  // nothing extra (the wrapper's own `Array.isArray` guard skips straight to the raw `store.get`).
  const agents = await Promise.all(
    currentRoster().map(async (persona) => ({ persona, store: await materializedReaderFor(personaStore(persona)) })),
  )
  let built: ReturnType<typeof buildDebugBundle>
  try {
    built = buildDebugBundle({
      agents,
      activeAgentId: activeAgent().id,
      testChatTranscript: admin.testChatTranscript(),
      builderInterviewTranscript: admin.builderInterviewTranscript(),
      // GH #1154 — the trip-wire: turns ran but both transcripts read empty ⇒ buildDebugBundle throws
      // (a silently-[] transcript export is the defect this guards), surfaced as an URGENT toast below.
      liveTurnCount: admin.liveTurnCount(),
    })
  } catch (err) {
    notify(`Debug export failed — ${err instanceof Error ? err.message : String(err)}`, true)
    return
  }
  const { entries } = built
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
  // Mint against a FRESH roster read, not just the in-memory view: a second tab that imported since
  // boot already wrote its persona into the shared library record, and an id minted blind to it would
  // silently SHARE that persona's persisted store (the source's upsert re-reads before it appends, so
  // the record itself survives — only the id needs the fresh view).
  const persona = importedPersonaFrom(parsed.file, [...personaRoster(), ...currentRoster()])
  void saveAgentMutation.run(persona) // the record persists in this tick (survives reload) and the view gains the row
  applyPersona(persona) // the setActive commit stages the header's own roster row via the derivation effect
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
  const persona = mintBlankPersona(seed, [...personaRoster(), ...currentRoster()])
  void saveAgentMutation.run(persona) // persists the library record in this tick; the view gains the row
  applyPersona(persona) // the setActive commit stages the header's own roster row via the derivation effect
  admin.authoringStore = builderStore(pick?.model) // a FRESH interviewer per flow entry (no persistKey, no cache)
  notify(`Created “${persona.label}” — describe what you want and the Builder will fill it in.`)
}

// GH #1196 (ADR-0203 clause 4) — the Builder's team-shaped generation path: mint N member personas +
// one validated `AgentTeam` record from a single interview arc, additive to `createGeneratedAgent`
// above (the single-agent flow is byte-unaffected — nothing here runs unless the model actually
// declares a `team`).

/** A kebab id for a freshly-minted `AgentTeam` — the SAME base-slug + numeric-suffix-on-collision
 *  shape `agent-admin-persona-file.ts`'s own `mintIdentity` uses for personas, kept as its own small
 *  copy here rather than widening that persona-shaped helper's export surface for this one caller.
 *
 *  Exported (unlike this page's other mint helpers, e.g. `createGeneratedAgent`): this function and
 *  `handleTeamDeclared` below carry real branching logic (structural pre-validation, multi-persona
 *  mint, collision-safe id minting, validate-before-save) that earns a direct jsdom unit test — the
 *  browser-click proof this page's OTHER handlers get would only re-prove DOM wiring already covered
 *  by the `onTeamDeclared` registration presence check, never the logic itself. */
export function mintTeamId(label: string, takenIds: ReadonlySet<string>): string {
  const base =
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'team'
  let id = base
  let n = 1
  while (takenIds.has(id)) {
    n += 1
    id = `${base}-${n}`
  }
  return id
}

/** Mint + validate + save one team-shaped generation path's own output, registered on
 *  `admin.onTeamDeclared`, fired from inside the authoring turn loop's fenced `team` consumption arm.
 *
 *  Mints one blank persona PER MEMBER, name-seeded from the declaration ONLY — no patch applied, no
 *  interview of its own (a member's own settings are the EXISTING single-agent Builder flow's job,
 *  reachable after the team lands, per R4's smallest-honest scope). Designates the CURRENTLY ACTIVE
 *  persona (the one already being authored when the team-shaped ask was recognized) as the GM.
 *
 *  VALIDATED BEFORE SAVE, and before any mint at all: `readMetaLine`'s own wire guard only checks
 *  field TYPES, never non-emptiness, so a structurally malformed declaration (a blank label, or any
 *  member's name/role/routingDescription blank) is caught HERE, before a single persona is minted —
 *  nothing lands, notified as a failure, never a partial roster. `saveAgentTeam` itself re-validates
 *  (ADR-0203 clause 1's closed-validation law, never second-guessed here) as defense in depth against
 *  a shape this pre-check cannot anticipate. */
export async function handleTeamDeclared(team: TeamDeclaration): Promise<void> {
  const label = team.label.trim()
  const structurallyValid =
    label.length > 0 &&
    team.members.length > 0 &&
    team.members.every((m) => m.name.trim().length > 0 && m.role.trim().length > 0 && m.routingDescription.trim().length > 0)
  if (!structurallyValid) {
    notify('The Builder proposed a team, but its roster was incomplete (a blank name, role, or routing description) — nothing was created.', true)
    return
  }

  const minted = team.members.map((member) => {
    const seed = { model: DEFAULT_MODEL_ID, ...initialValuesFor(defaultAgentConfigSchema), ...initialEntryValues() }
    const persona = mintBlankPersona(seed, [...personaRoster(), ...currentRoster()], member.name)
    void saveAgentMutation.run(persona) // persists in this tick — the next loop turn's collision scan sees it
    return { persona, member }
  })
  // The header's roster row list gains the new members via the derivation effect; ACTIVE stays the GM, unchanged.

  const gm = activeAgent()
  const knownAgentIds = currentRoster().map((p) => p.id)
  // The collision scan reads the one teams resource — refetched HERE (not trusted from boot) so a team
  // another tab minted since is seen, the exact freshness the retired direct `loadAgentTeams()` bought.
  // FAIL-CLOSED on the refetch itself (review finding): `resource()`'s own contract swallows a failed
  // read into `error`, keeping `data` whatever it was before (SWR) — undefined at first call, since this
  // resource is never seeded. Reading `data.peek() ?? []` on a failed refetch would silently treat "the
  // read failed" as "no teams exist", letting `mintTeamId` hand back a COLLIDING id that `create`'s
  // last-write-wins upsert (agent-team.ts) then silently overwrites. The retired direct `loadAgentTeams()`
  // call THREW on failure; this mirrors that by checking status explicitly rather than trusting `data`.
  await teamsResource.refetch()
  if (teamsResource.status.peek() === 'error') {
    notify(`Team “${label}” could not be created — the existing team list could not be read.`, true)
    return
  }
  const existingTeams = teamsResource.data.peek() ?? []
  const agentTeam: AgentTeam = {
    id: mintTeamId(label, new Set(existingTeams.map((t) => t.id))),
    label,
    ...(team.tagline !== undefined && team.tagline.trim().length > 0 ? { tagline: team.tagline.trim() } : {}),
    gmAgentId: gm.id,
    members: minted.map(({ persona, member }) => ({ agentId: persona.id, role: member.role, routingDescription: member.routingDescription })),
  }

  // ADR-0227 wave 2: the write rides the mutation; a validation refusal surfaces as the mutation's
  // error whose CAUSE is the source's typed AgentTeamValidationError — the same issue set
  // `saveAgentTeam`'s result shape used to hand back directly.
  const saved = await saveTeamMutation.run({ team: agentTeam, knownAgentIds })
  if (saved === undefined) {
    const cause = saveTeamMutation.error.peek()?.cause
    const detail = cause instanceof AgentTeamValidationError ? cause.issues.map((i) => i.message).join(' ') : 'something went wrong saving it.'
    notify(`Team “${label}” could not be saved — ${detail}`, true)
    return
  }
  notify(`Created team “${label}” — ${minted.length} member${minted.length === 1 ? '' : 's'} + “${gm.label}” as GM.`)
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

// GH #921 ruling 5 — the sticky header's own X close icon button, TRAILING position, alongside the title.
const drawerTitleRow = document.createElement('div')
drawerTitleRow.className = 'roster-drawer-title-row'

const drawerTitle = document.createElement('h2')
drawerTitle.className = 'roster-drawer-title'
drawerTitle.textContent = 'Manage agents'

const drawerClose = document.createElement('ui-button') as UIButtonElement
drawerClose.setAttribute('variant', 'ghost')
drawerClose.setAttribute('icon-only', '')
drawerClose.setAttribute('aria-label', 'Close')
drawerClose.className = 'roster-drawer-close'
const drawerCloseIcon = document.createElement('ui-icon')
drawerCloseIcon.setAttribute('slot', 'leading')
drawerCloseIcon.setAttribute('glyph', 'x')
drawerClose.append(drawerCloseIcon)
drawerClose.addEventListener('click', () => {
  drawer.open = false
})

drawerTitleRow.append(drawerTitle, drawerClose)

const drawerHint = document.createElement('p')
drawerHint.className = 'roster-drawer-hint'
drawerHint.textContent =
  'Reorganize, rename or delete agents you made, and duplicate any agent — a shipped one included — into an editable copy.'

// GH #921 ruling 4 — Re-organize is an explicit MODE, toggled here (a `ui-toggle` pressed-pill, the
// fleet's own toggle-button primitive — ADR-0179 GH #686 Amendment S7-a); the always-on ^/v reorder
// buttons are RETIRED (see `rosterRow` below) in favour of drag, with the SAME ^/v buttons surviving as
// the keyboard fallback ONLY while this mode is active.
const reorderToggle = document.createElement('ui-toggle') as UIToggleElement
reorderToggle.className = 'roster-drawer-reorder-toggle'
const reorderToggleIcon = document.createElement('ui-icon')
reorderToggleIcon.setAttribute('slot', 'icon')
reorderToggleIcon.setAttribute('glyph', 'list')
reorderToggle.append(reorderToggleIcon, document.createTextNode('Reorganize'))
reorderToggle.addEventListener('toggle', () => {
  // `toggle` fires BEFORE `pressed` commits (ui-toggle's own cancelable-before-commit contract): the
  // control's OWN listener (toggle.ts) computes its post-emit `this.pressed = !this.pressed` AFTER this
  // handler returns, in the SAME synchronous call — writing `.pressed` ourselves in here (even reading the
  // "opposite of current") would race that commit and get overwritten by it. Defer one microtask so
  // `pressed` has already settled to its real new value by the time we read it — `applyReorderMode` never
  // touches `.pressed` itself for exactly this reason (see its own comment).
  queueMicrotask(() => applyReorderMode(reorderToggle.pressed))
})

const drawerToolbar = document.createElement('div')
drawerToolbar.className = 'roster-drawer-toolbar'
drawerToolbar.append(reorderToggle)

// The drawer opens MODAL, in the platform top layer: a `ui-toast-region` living in the normal layer paints
// UNDER the ::backdrop while it is open, so a toast alone would be invisible feedback exactly when the user
// is acting. This line is the in-drawer twin — the same sentence, inside the surface that is on top.
// `role="status"` (an implicit aria-live="polite" region) announces it to AT without stealing focus. It
// lives in the STICKY header (not the scrolling content) — feedback for a list action must stay visible
// regardless of where the list itself is scrolled to.
const drawerStatus = document.createElement('p')
drawerStatus.className = 'roster-drawer-status'
drawerStatus.setAttribute('role', 'status')

drawerHeader.append(drawerTitleRow, drawerHint, drawerToolbar, drawerStatus)

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

// ── the ONE roster derivation (ADR-0227 clause 4) — replaces the retired hand-threaded `refreshRoster` ──
// Every roster mutation's optimistic commit (and its post-settle refetch) wakes this effect, which
// re-derives BOTH render surfaces from the one view: the header select re-push (what makes
// reorder/rename/delete "drive picker order" — LLD §7) and the open drawer's rows. The Team pane's
// GM/member `nameFor` reads the same `#pendingRoster` snapshot this push feeds, so it follows too.
effect(() => {
  const view = rosterResource.data.value
  if (view === undefined) return
  pushRoster(view)
  if (drawer.open) renderRosterRows()
})

// GH #921 ruling 4 — Re-organize as an explicit MODE (never always-on): a page-level flag read by every
// row build, so entering/leaving the mode is one re-render, not a per-row toggle to track separately.
let reorderMode = false

/** Apply the mode WITHOUT touching the toggle's own `pressed` — the toggle's own post-`toggle`-event
 *  commit already owns that write on a real user press (see the `toggle` listener above); this is what a
 *  press-driven mode change calls, one microtask after `pressed` has genuinely settled. */
function applyReorderMode(next: boolean): void {
  reorderMode = next
  rosterList.toggleAttribute('data-reorder-mode', next) // CSS hook: agent-admin-app.css keys the drag-cursor affordance off this
  if (drawer.open) {
    renderRosterRows()
    scrollActiveRosterRowIntoView() // the mode swap rebuilds every row — keep the active row on-screen (GH #1219)
  }
}

/** GH #1219 — center the CURRENT agent's roster row in the drawer's scrollport. The drawer always opened
 *  at default scroll position, so a mid-/late-roster active agent sat out of view. Same jsdom guard +
 *  `prefers-reduced-motion` handling as `agent-admin.ts`'s `#scrollFoldIntoView` (scrollIntoView is absent
 *  in jsdom; a real browser always has it), `block:'center'` because the row is the drawer's SUBJECT, not
 *  a nearest-edge nudge. Runs one frame after `drawer.open = true` — `ui-drawer` MOVES its children into
 *  the `<dialog>` part and `showModal()` runs via the open-effect, so layout is only trustworthy next frame. */
function scrollActiveRosterRowIntoView(): void {
  requestAnimationFrame(() => {
    // Matched via dataset (not an attribute-selector interpolation): no escaping concern, and jsdom has
    // no `CSS.escape` to lean on.
    const row = [...rosterList.querySelectorAll<HTMLElement>('.roster-row')].find((r) => r.dataset.agent === activeAgent().id)
    if (row === undefined || typeof row.scrollIntoView !== 'function') return
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    row.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
  })
}

/** Set the mode PROGRAMMATICALLY (the drawer's own open/close) — also drives the toggle's own `pressed`,
 *  since there is no real user press here to commit it (directly setting `pressed` is never subject to
 *  refusal, toggle.md's own law). */
function setReorderMode(next: boolean): void {
  reorderToggle.pressed = next
  applyReorderMode(next)
}

function openRosterDrawer(): void {
  drawerStatus.textContent = ''
  setReorderMode(false) // always open on the default (non-reorder) view — a no-op render (drawer isn't open yet)
  renderRosterRows()
  drawer.open = true
  scrollActiveRosterRowIntoView() // GH #1219 — the drawer opens centered on the CURRENT agent's row
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

/** A ghost row VERB button — the word is always present (ADR-0057: intent never travels by colour alone).
 *  `glyph` is optional because the shipped Phosphor pack (icons.gen.ts) carries no copy/duplicate glyph.
 *  The rename Save button is this function's one remaining call site (GH #921 moved Rename/Duplicate/
 *  Delete off this shape — see `rosterRow` below — but Save, inside the still-active inline editor, keeps
 *  it). */
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

/** GH #921 — "Capabilities": a short summary of the persona's OWN stored capability entries (skills/
 *  workflows/resources/tools), read live off its STORE — never the static preset seed alone, since a
 *  custom edit adds/removes real entries the seed never had. Counts ENABLED entries only (a disabled entry
 *  contributes nothing to what the agent can actually do); a kind with zero enabled entries is omitted. */
function capabilitiesSummary(persona: Persona): string {
  const store = personaStore(persona)
  const kinds: ReadonlyArray<readonly [string, string]> = [
    [ENTRY_KINDS.skill, 'skill'],
    [ENTRY_KINDS.workflow, 'workflow'],
    [ENTRY_KINDS.resource, 'resource'],
    [ENTRY_KINDS.tool, 'tool'],
  ]
  const parts = kinds
    .map(([kind, word]) => {
      const list = (store.get(entriesStoreKey(kind)) as Entry[] | undefined) ?? []
      const count = list.filter((entry) => entry.enabled).length
      return count > 0 ? `${count} ${word}${count === 1 ? '' : 's'}` : ''
    })
    .filter((part) => part.length > 0)
  return parts.length > 0 ? `Capabilities: ${parts.join(' · ')}` : 'Capabilities: none configured'
}

/** GH #921 — "Surface": a short excerpt of the persona's OWN "Surface style" prompt section (the custom
 *  section every preset seeds — `presetSeed`'s own composition, states WHEN a surface earns its place over
 *  prose) — read live off the store, so a custom edit shows here too. Absent (the one section a user may
 *  delete, `presetSeed`'s own comment) falls back to a plain statement rather than an empty line. */
function surfaceSummary(persona: Persona): string {
  const store = personaStore(persona)
  const sections = (store.get(entriesStoreKey(ENTRY_KINDS.promptSection)) as Entry[] | undefined) ?? []
  const surfaceStyle = sections.find((section) => section.id === 'surface-style')
  const text = surfaceStyle?.content.trim() ?? ''
  if (text.length === 0) return 'Surface: no custom surface style'
  return `Surface: ${text.length > 96 ? `${text.slice(0, 96).trimEnd()}…` : text}`
}

/** GH #921 — "Status": the one dynamic state a roster card can show today — whether this IS the agent
 *  currently loaded onto the canvas. The shipped/custom distinction stays its OWN "Shipped" tag (unchanged
 *  — a structural protection marker, never a lifecycle state). */
function statusLabel(persona: Persona): string {
  return persona.id === activeAgent().id ? 'Status: Active' : 'Status: Idle'
}

/** GH #921 — "Date" (Scope/Open ruling): created — stamped at mint/import/duplicate time
 *  (`agent-admin-persona-file.ts`) — for a custom persona; absent that (every shipped preset, which ships
 *  with the build and was never "created" by this user), the persistence layer's own last-write marker
 *  (`loadModifiedAt`, agent-admin-presets.ts, bumped on every real store write). A preset NEVER touched by
 *  the user has neither and reads as an em dash — the fallback the ticket's own Scope/Open section names. */
function dateLabel(persona: Persona): string {
  if (persona.createdAt !== undefined) return `Created ${new Date(persona.createdAt).toLocaleDateString()}`
  const modified = loadModifiedAt(persona.id)
  if (modified !== undefined) return `Modified ${new Date(modified).toLocaleDateString()}`
  return '—'
}

/** Rebuild the whole list from the CURRENT roster — rows are stateless between rebuilds (the one exception
 *  is an in-flight rename field, which a rebuild drops; a short gesture re-typed, never state corrupted). */
function renderRosterRows(): void {
  const rows = currentRoster().map((persona, index) => rosterRow(persona, index))
  rosterList.replaceChildren(...rows)
}

/**
 * One roster card (GH #921 redesign): a title row (label · hover-rename icon or the "Shipped" tag), a meta
 * line (Status · Date), a Capabilities line, and a Surface line — the five owner-ruled fields. Actions
 * collapse into a per-card `ui-menu` (Duplicate always, Delete only for a custom row — the SAME preset
 * protection the row always had). While `reorderMode` is active, a pointer-drag handle (leading) and the
 * ^/v keyboard fallback (trailing) both appear; outside that mode neither renders at all.
 *
 * PRESET PROTECTION IS STRUCTURAL, not disabled-with-a-tooltip (the `entry-delete`/TKT-0048 precedent —
 * "present ONLY for a non-built-in entry"): a shipped preset's card never builds a Rename affordance or a
 * Delete menu item at all, so there is no destructive affordance to mis-fire, and the "Shipped" tag STATES
 * the protection so the absence reads as a rule rather than as a missing feature. Duplicate is on every
 * card — that is the escape hatch that makes the protection free: copy the preset, then edit/rename/delete
 * the copy.
 */
function rosterRow(persona: Persona, index: number): HTMLElement {
  const custom = persona.imported === true
  const row = document.createElement('div')
  row.className = 'roster-row'
  row.dataset.agent = persona.id
  if (persona.id === activeAgent().id) row.setAttribute('data-active', '')

  if (reorderMode) {
    const handle = document.createElement('div')
    handle.className = 'roster-row-drag-handle'
    handle.setAttribute('aria-hidden', 'true') // pointer-only — the ^/v buttons below are the real keyboard/AT path
    const handleIcon = document.createElement('ui-icon')
    handleIcon.setAttribute('glyph', 'list')
    handle.append(handleIcon)
    row.append(handle)
    // GH #952 — the drag GESTURE itself is wired once, globally, by the `listReorder` call below (it
    // re-queries `.roster-row-drag-handle` live on every press); no per-row wiring call is owed here.
  }

  const main = document.createElement('div')
  main.className = 'roster-row-main'

  const titleRow = document.createElement('div')
  titleRow.className = 'roster-row-title-row'
  const label = document.createElement('span')
  label.className = 'roster-row-label'
  label.textContent = persona.label
  titleRow.append(label)
  if (custom) {
    // GH #921 ruling 3 — rename is a HOVER-REVEALED icon at the end of the title (CSS-gated visibility,
    // agent-admin-app.css); the row's own existing rename validation (`beginRename`) is untouched.
    const renameIcon = rowIconButton('pencil-simple', `Rename ${persona.label}`, false, () => beginRename(row, persona))
    renameIcon.classList.add('roster-row-rename')
    titleRow.append(renameIcon)
  } else {
    const tag = document.createElement('span')
    tag.className = 'roster-row-tag'
    tag.textContent = 'Shipped'
    tag.title = 'A shipped agent — it can be duplicated, but never renamed or deleted.'
    titleRow.append(tag)
  }

  const meta = document.createElement('div')
  meta.className = 'roster-row-meta'
  const status = document.createElement('span')
  status.className = 'roster-row-status'
  status.textContent = statusLabel(persona)
  const date = document.createElement('span')
  date.className = 'roster-row-date'
  date.textContent = dateLabel(persona)
  meta.append(status, date)

  const capabilities = document.createElement('p')
  capabilities.className = 'roster-row-capabilities'
  capabilities.textContent = capabilitiesSummary(persona)

  const surface = document.createElement('p')
  surface.className = 'roster-row-surface'
  surface.textContent = surfaceSummary(persona)

  main.append(titleRow, meta, capabilities, surface)

  // GH #921 ruling 2 — inline actions collapse into a per-card (...) menu.
  const menu = document.createElement('ui-menu') as UIMenuElement
  menu.className = 'roster-row-menu'
  menu.setAttribute('placement', 'bottom-end')
  const menuTrigger = rowIconButton('dots-three-vertical', `Actions for ${persona.label}`, false, () => {}) // ui-menu itself wires the trigger's click to open/close (menu.md) — no handler owed here
  const duplicateItem = document.createElement('div')
  duplicateItem.className = 'roster-row-duplicate'
  duplicateItem.setAttribute('data-value', 'duplicate')
  duplicateItem.textContent = 'Duplicate'
  menu.append(menuTrigger, duplicateItem)
  if (custom) {
    const deleteItem = document.createElement('div')
    deleteItem.className = 'roster-row-delete'
    deleteItem.setAttribute('data-value', 'delete')
    deleteItem.textContent = 'Delete'
    menu.append(deleteItem)
  }
  menu.addEventListener('select', (event) => {
    const { value } = (event as CustomEvent<{ value: string; index: number }>).detail
    if (value === 'duplicate') duplicateAgent(persona)
    else if (value === 'delete') deleteAgent(persona.id)
  })

  row.append(main, menu)

  if (reorderMode) {
    const reorderControls = document.createElement('div')
    reorderControls.className = 'roster-row-reorder-controls'
    reorderControls.append(
      rowIconButton('caret-up', `Move ${persona.label} up`, index === 0, () => moveAgent(persona.id, -1)),
      rowIconButton('caret-down', `Move ${persona.label} down`, index === currentRoster().length - 1, () => moveAgent(persona.id, 1)),
    )
    row.append(reorderControls)
  }

  return row
}

/** Reorder — the WHOLE id list is persisted, not just the swapped pair, so the stored order pins every
 *  entry from then on (both the drag commit above and the reorder-mode keyboard fallback below share this
 *  one function). */
function moveAgent(id: string, delta: -1 | 1): void {
  const ids = currentRoster().map((p) => p.id)
  const from = ids.indexOf(id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= ids.length) return
  const moved = ids[from]!
  ids[from] = ids[to]!
  ids[to] = moved
  void reorderAgentsMutation.run(ids) // the row visibly moves (optimistic view + the derivation effect) — no toast owed
}

/** Duplicate ANY agent (a preset included) into a fresh editable copy of its CURRENT state — never the
 *  pristine seed, and never a mutation of the source (LLD §8d). Lands at the roster's end. */
function duplicateAgent(persona: Persona): void {
  const copy = duplicatePersonaFrom(persona, personaStore(persona), [...personaRoster(), ...currentRoster()])
  void saveAgentMutation.run(copy) // stamps imported:true ⇒ the copy is deletable/renamable by construction
  announce(`Duplicated “${persona.label}” as “${copy.label}”.`)
}

/** The ONE deletion path all three affordances share (the drawer row calls it directly; the header's
 *  overflow item and the config surface's row reach it through `onDeleteAgentRequest`).
 *
 *  Order is load-bearing: the delete mutation FIRST (the source sweeps the records and its optimistic
 *  commit drops the row from the view in this same tick), then the fallback read — so the fallback is
 *  the fresh roster's first entry (in the default order, the first shipped preset), which can never be
 *  the deleted agent because presets are undeletable. Deleting a NON-active agent leaves the active
 *  store and the conversation completely untouched; the select/drawer re-render via the derivation
 *  effect either way. */
function deleteAgent(id: string): void {
  const persona = currentRoster().find((p) => p.id === id)
  if (persona === undefined) return
  if (persona.imported !== true) {
    // Defense in depth — no affordance for a preset is ever rendered, so this is a caller bug, not a path.
    announce(`“${persona.label}” is a shipped agent and can’t be deleted. Duplicate it instead.`, true)
    return
  }
  const label = persona.label
  const wasActive = activeAgent().id === persona.id
  // The record + keys + order slot sweep lands in this tick (the source's remove is same-tick under its
  // async facade), and the optimistic commit drops the row now — but the ANNOUNCEMENT waits for the
  // settle (the beginRename shape, review finding on this wave): a raced remove (a second tab deleted
  // the record first) throws, mutation() rolls the view back, and the status line must then report the
  // failure — never a "Deleted" toast over a row the rollback just restored.
  void deleteAgentMutation.run(persona).then(() => {
    if (deleteAgentMutation.status.peek() === 'error') {
      announce(`“${label}” could not be deleted — it changed in another tab, and the roster was restored.`, true)
      return
    }
    announce(`Deleted “${label}”.`)
  })
  const fallback = currentRoster()[0]
  if (wasActive && fallback !== undefined) applyPersona(fallback) // the setActive mutation rewrites the persisted active id
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
    if (currentRoster().some((p) => p.id !== persona.id && p.label === next)) {
      announce(`Another agent is already called “${next}”.`, true)
      return
    }
    settled = true
    if (next !== persona.label) {
      void (async () => {
        // The rename rides the roster mutation (ADR-0227 cl.4): the optimistic commit renames the view's
        // row in this tick (the derivation effect repaints select + drawer), the source rewrites the record.
        const renamed = await renameAgentMutation.run({ id: persona.id, label: next })
        if (renamed === undefined) {
          renderRosterRows() // the record vanished under us — the rollback restored the view; put the row back
          return
        }
        // GH #1537 — the pencil rename round-trips into the persona's own store `'name'` key, so the
        // Settings pane's Name field shows the new name too (generate.ts's subscribeExternalSync reflects
        // an external write into the control). Value-equality guarded on both directions — here, and in
        // syncRosterLabelFromName's own label check (the optimistic commit already updated the label, so
        // the subscription this write fires sees `next === persona.label` and no-ops) — so the two writers
        // can never chase each other.
        const store = personaStore(persona)
        if (store.get('name') !== next) store.set('name', next)
        announce(`Renamed “${persona.label}” to “${next}”.`)
      })()
      return
    }
    renderRosterRows() // unchanged — just put the row back
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

// ── the imported skill-pack shelf (ADR-0208 D3/D5.2/D7, GH #1340/#1349) ────────────────────────────────
// The page-owned shelf SURFACE, the Edit Agents drawer's composition idiom verbatim (`ui-drawer`
// composed byte-unmodified; shell built before `root.append` connects it; only the LIST's children are
// ever replaced). This drawer IS the pack library's review-before-enable step (D5.2): each imported
// entry's FULL content, the provenance stamp (D7's attribution — source URL, short sha, import date,
// license file name or "no license file found"), and the directive-scan report render HERE, before any
// per-agent add. "Import pack…" (D3's affordance) reads a .skillpack.json via the user's own file
// picker — the ADR-0202 trust shape: bytes arrive only by the user's explicit local-file choice, zero
// egress. Remove deletes the `skill-packs:` record ONLY — a persona's opted-in entries are copies and
// stay untouched (D4's no-background-mutation law; the hint below states it to the user).

const skillPackInput = document.createElement('input')
skillPackInput.type = 'file'
skillPackInput.accept = 'application/json,.json'
skillPackInput.hidden = true
skillPackInput.addEventListener('change', () => {
  const picked = skillPackInput.files?.[0]
  if (!picked) return
  void picked
    .text()
    .then((text) => importSkillPackText(text))
    .catch(() => packsFeedback('Import failed — that file could not be read.', true))
    .finally(() => {
      skillPackInput.value = '' // same-file re-pick law (the persona input's own comment above)
    })
})

const packsDrawer = document.createElement('ui-drawer') as UIDrawerElement
packsDrawer.setAttribute('edge', 'end')
packsDrawer.setAttribute('aria-label', 'Skill packs')
packsDrawer.className = 'packs-drawer'

const packsHeader = document.createElement('header')
packsHeader.className = 'roster-drawer-header'

const packsTitleRow = document.createElement('div')
packsTitleRow.className = 'roster-drawer-title-row'
const packsTitle = document.createElement('h2')
packsTitle.className = 'roster-drawer-title'
packsTitle.textContent = 'Skill packs'
const packsClose = document.createElement('ui-button') as UIButtonElement
packsClose.setAttribute('variant', 'ghost')
packsClose.setAttribute('icon-only', '')
packsClose.setAttribute('aria-label', 'Close')
const packsCloseIcon = document.createElement('ui-icon')
packsCloseIcon.setAttribute('slot', 'leading')
packsCloseIcon.setAttribute('glyph', 'x')
packsClose.append(packsCloseIcon)
packsClose.addEventListener('click', () => {
  packsDrawer.open = false
})
packsTitleRow.append(packsTitle, packsClose)

const packsHint = document.createElement('p')
packsHint.className = 'roster-drawer-hint'
packsHint.textContent =
  'Snapshots imported from external skill repos — one app-level shelf, browsable by every agent. ' +
  'Review each entry’s full text and the scan report below, then enable per agent via the Skills ' +
  'section’s “From library” menu. Removing a pack never touches entries an agent already added — ' +
  'those are copies, and a re-import updates only this shelf, never an added copy.'

// The "Import pack…" affordance (D3) — inside the shelf surface itself, where the review happens.
const importPackButton = document.createElement('ui-button') as UIButtonElement
importPackButton.setAttribute('variant', 'soft')
const importPackIcon = document.createElement('ui-icon')
importPackIcon.setAttribute('slot', 'leading')
importPackIcon.setAttribute('glyph', 'plus')
importPackButton.append(importPackIcon, document.createTextNode('Import pack…'))
importPackButton.addEventListener('click', () => skillPackInput.click())
const packsToolbar = document.createElement('div')
packsToolbar.className = 'roster-drawer-toolbar'
packsToolbar.append(importPackButton)

// In-drawer status line (the roster drawer's own reasoning: a toast paints UNDER the modal drawer's
// ::backdrop, so feedback for an action taken inside the surface must live inside it too).
const packsStatus = document.createElement('p')
packsStatus.className = 'roster-drawer-status'
packsStatus.setAttribute('role', 'status')

packsHeader.append(packsTitleRow, packsHint, packsToolbar, packsStatus)

const packList = document.createElement('div')
packList.className = 'pack-list'
packList.setAttribute('data-region', 'content')

const packsDone = document.createElement('ui-button') as UIButtonElement
packsDone.setAttribute('variant', 'soft')
packsDone.textContent = 'Done'
packsDone.addEventListener('click', () => {
  packsDrawer.open = false
})
const packsFooter = document.createElement('footer')
packsFooter.className = 'roster-drawer-footer'
packsFooter.append(packsDone)
packsDrawer.append(packsHeader, packList, packsFooter)

function packsFeedback(message: string, urgent = false): void {
  packsStatus.textContent = message
  notify(message, urgent) // the toast twin covers feedback landing while the drawer is closed
}

/** One pack's card in the shelf list — attribution (D7), the provenance report (skipped + dropped keys,
 *  counted never silent), the scan findings (D5.4 — rendered WITH the entries they flag, the review
 *  aid), and each entry's FULL content behind its own fold (D5.2's review-before-enable). */
function renderSkillPackRow(snapshot: SkillPackSnapshot): HTMLElement {
  const row = document.createElement('div')
  row.className = 'pack-row'

  const titleRow = document.createElement('div')
  titleRow.className = 'roster-drawer-title-row'
  const label = document.createElement('span')
  label.className = 'pack-label'
  label.textContent = snapshot.pack.label
  const remove = document.createElement('ui-button') as UIButtonElement
  remove.setAttribute('variant', 'ghost')
  remove.className = 'pack-remove'
  remove.textContent = 'Remove'
  remove.addEventListener('click', () => {
    // The remove rides the shelf mutation (ADR-0227 wave 2): its read-back commit updates the one
    // resource, the libraries derivation effect re-scopes the add-from-library menu — this handler
    // only re-renders the drawer list (its own surface) and reports.
    void removeSkillPackMutation.run(snapshot.pack.id).then((ok) => {
      renderSkillPackShelf()
      if (ok === undefined) {
        packsFeedback(`“${snapshot.pack.label}” could not be removed — the shelf store refused the delete.`, true)
        return
      }
      packsFeedback(`Removed “${snapshot.pack.label}” from the shelf — entries agents already added stay in place.`)
    })
  })
  titleRow.append(label, remove)
  row.append(titleRow)

  const attribution = document.createElement('p')
  attribution.className = 'pack-attribution'
  attribution.textContent = skillPackAttribution(snapshot)
  row.append(attribution)

  const { skipped, droppedFrontmatterKeys, scan } = snapshot.provenance
  if (skipped.length > 0 || droppedFrontmatterKeys.length > 0) {
    const report = document.createElement('p')
    report.className = 'pack-report'
    const parts: string[] = []
    if (skipped.length > 0) parts.push(`skipped at import: ${skipped.join(', ')}`)
    if (droppedFrontmatterKeys.length > 0) parts.push(`dropped frontmatter keys: ${droppedFrontmatterKeys.join(', ')}`)
    report.textContent = parts.join(' · ')
    row.append(report)
  }
  if (scan.flagged.length > 0) {
    const warning = document.createElement('p')
    warning.className = 'pack-scan-warning'
    warning.textContent = `Scan flagged ${scan.flagged.length} line(s) — review before enabling (the scan strips nothing; the verdict is yours).`
    row.append(warning)
  }

  for (const entry of snapshot.pack.entries) {
    const flags = scan.flagged.filter((f) => f.entryId === entry.id)
    const fold = document.createElement('ui-disclosure') as HTMLElement & { summary: string }
    fold.className = 'pack-entry'
    fold.summary = flags.length > 0 ? `${entry.label} — ⚠ ${flags.length} flagged line(s)` : entry.label
    if (entry.description.length > 0) {
      const description = document.createElement('p')
      description.className = 'pack-entry-description'
      description.textContent = entry.description
      fold.append(description)
    }
    for (const flag of flags) {
      const note = document.createElement('p')
      note.className = 'pack-scan-warning'
      note.textContent = `line ${flag.line}: ${flag.reason}`
      fold.append(note)
    }
    const content = document.createElement('pre')
    content.className = 'pack-entry-content'
    content.textContent = entry.content // FULL text, verbatim — the D5.2 review surface
    fold.append(content)
    row.append(fold)
  }

  return row
}

function renderSkillPackShelf(): void {
  const shelf = currentSkillPacks()
  packList.replaceChildren()
  if (shelf.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'roster-drawer-hint'
    empty.textContent = 'Nothing imported yet. Run `node scripts/import-skill-pack.mjs <repo-url>` to snapshot a skills repo, then pick the .skillpack.json here.'
    packList.append(empty)
    return
  }
  for (const snapshot of shelf) packList.append(renderSkillPackRow(snapshot))
}

/** The picker's ingest leg: fail-closed parse (named refusal, D3) → the import MUTATION (persist whole
 *  + read-back commit onto the one shelf resource; the libraries derivation effect re-scopes the menu)
 *  → re-render the review surface from the resource. */
async function importSkillPackText(text: string): Promise<void> {
  const parsed = parseSkillPackText(text)
  if (!parsed.ok) {
    packsFeedback(`Import refused — ${parsed.error}`, true)
    return
  }
  const snapshot = parsed.snapshot
  const replacing = currentSkillPacks().some((s) => s.pack.id === snapshot.pack.id)
  const saved = await importSkillPackMutation.run(snapshot)
  if (saved === undefined) {
    // The store refused the write (quota, an unavailable IDB) — named here rather than riding the
    // picker's own generic could-not-read catch, which this rejection previously fell through to.
    packsFeedback(`Import failed — “${snapshot.pack.label}” could not be persisted to the shelf store.`, true)
    return
  }
  renderSkillPackShelf()
  const flaggedCount = snapshot.provenance.scan.flagged.length
  packsFeedback(
    `${replacing ? 'Refreshed' : 'Imported'} “${snapshot.pack.label}” (${snapshot.pack.entries.length} skill(s)) — ${skillPackAttribution(snapshot)}.` +
      (replacing ? ' Entries agents already added are unchanged — remove and re-add one to take the refreshed text.' : '') +
      (flaggedCount > 0 ? ` ⚠ ${flaggedCount} scan-flagged line(s) — review before enabling.` : ''),
    flaggedCount > 0,
  )
}

// The component's overflow "Skill packs…" item (registration-gated, agent-admin.ts's ADR-0208 seam)
// opens the shelf — rendered fresh on every open so a boot-time async shelf load is never stale here.
admin.onSkillPacksRequest(() => {
  renderSkillPackShelf()
  packsStatus.textContent = ''
  packsDrawer.open = true
})

applyPersona(activeAgent()) // also stages the header's own roster row (the derivation effect's push)
// `fileInput` FIRST (GH #1233): since #1211 the Test-chat composer inside `admin` carries its own hidden
// `<input type="file">` (`[data-part="attach-input"]`, the paperclip picker). The persona import's input
// must stay the page's FIRST file input in document order so "the hidden file input" stays unambiguous —
// appending it after `admin` routed persona-import .json picks into the composer's attach ingest path
// (the "Can't attach — unsupported file type" toast) instead of `importPersonaText`'s own handling.
// `skillPackInput` rides SECOND — after the persona import's own input (which must stay the page's
// FIRST file input, the GH #1233 law above) and still before `admin`'s composer attach-input.
root.append(fileInput, skillPackInput, admin, toasts, drawer, packsDrawer)

// GH #952 — the pointer-drag reorder gesture (formerly this page's own `wireDrag`), now the `list-reorder`
// trait. `drawer` (a real `UIElement`) is the host — `rosterList` lives in its light DOM, so a `pointerdown`
// on any row's drag handle bubbles up to it — wired ONCE here (after `drawer` connects via `root.append`
// above, since `host.listen`/`host.effect` both require a live connection scope), not per-row: `items()`/
// `handle()` both re-query the LIVE DOM on every gesture, so a `renderRosterRows()` rebuild between drags
// needs no re-wiring. `onCommit` ignores its own `(from, to)` — this drawer already derives the persisted
// order from DOM traversal post-move (`moveAgent`'s "persist the WHOLE list" law, reused verbatim), the
// exact same one-liner `wireDrag`'s own `onUp` used to run.
listReorder(drawer, {
  items: () => [...rosterList.querySelectorAll<HTMLElement>('.roster-row')],
  armed: () => reorderMode,
  handle: (item) => item.querySelector<HTMLElement>('.roster-row-drag-handle'),
  container: () => rosterList,
  onCommit: () => {
    const ids = [...rosterList.querySelectorAll('.roster-row')]
      .map((r) => (r as HTMLElement).dataset.agent)
      .filter((id): id is string => id !== undefined)
    void reorderAgentsMutation.run(ids)
  },
})

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
        // ADR-0198 — every armed runner rides the page's flow-chrome wrapper (flowEnd → the shared
        // end-of-flow affordance; the event is filtered before the component sees it).
        admin.agentSurfaceTurn = withFlowChrome(overlay.createAdminSurfaceTurn())
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
    // discovered `mcp:*` trio joins the Integrations pack without a page reload via `setLiveIntegrations`
    // (module state the libraries derivation effect cannot observe on its own — the revision bump below
    // is what wakes it, ADR-0227 wave 2's `librariesRevision` signal).
    // GH #783 S4 (LLD-C6/SPEC-R5, ADR-0185) — the sibling live-read for MCP SERVICES rides the SAME
    // DEV-only block: `GET /integrations` now carries a second `services` array (S2), read by
    // `fetchLiveServices` under the SAME degrade-to-`undefined` law. Both fetches BEFORE the one revision
    // bump, so a single derivation re-run carries both live reads into the add-from-library menu.
    // `undefined` passes straight through `setLiveServices` (production/degrade keeps the MCP-services
    // pack absent, the getter's own law). Bump when EITHER landed; both undefined ⇒ nothing to re-render
    // (the boot-time `librariesForCategory` getters already have it right).
    if (import.meta.env.DEV) {
      const trios = await overlay.fetchLiveIntegrations()
      const services = await overlay.fetchLiveServices()
      if (trios) setLiveIntegrations(trios)
      setLiveServices(services)
      // ADR-0227 wave 2: the live rows are module state the libraries derivation effect cannot observe —
      // the revision bump is the ONE signal-shaped input standing in for them; the effect recomposes and
      // reassigns (`librariesForCategory`'s getters read the freshly-set live rows at that point).
      if (trios || services) librariesRevision.value += 1
    }
  } catch {
    console.info('[agent-admin-app] stub preview — the live overlay is unavailable')
  }
})()
