# ADR-0170 — The A2UI catalog picker becomes a library-pack entry kind with SINGLE-select semantics: the persisted key stays the one selection truth, switches derive from it, and the bare `<select>` retires

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-08-04
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-04 |
> | **Proposed by** | planner (design seat — the "Catalog library pack" intake; Kim's 2026-08-04 AskUserQuestion ruling scopes this campaign to the PICK-from-library half of the 2026-07-19 pick/create ruling; CREATE is a named non-goal) |
> | **Ratified by** | — |
> | **Repairs** | **On ratification+build:** `packages/agent-ui/app/src/controls/agent-admin/agent-admin-schema.ts:211-213` (the `A2UI_CATALOG_OPTIONS` doc comment's "create/pick-from-library affordances … still land separately" — pick-from-library lands HERE; the comment narrows to the create half) · `agent-admin.ts:577`'s "one option today" picker-build comment (the select it annotates retires, cl.6) · [ADR-0169](./0169-a2ui-basic-catalog-upstream-interop.md) cl.6's picker-build sentence (the VEHICLE changes — the options table, sanitize law, and threading it names are byte-untouched; a dated REV forward pointer at ratification, the ADR-0156 cl.5 shape) |
> | **Supersedes / Superseded by** | **Amends** [ADR-0132](./0132-agent-admin-instructions-capabilities-architecture.md) (the entry-kind roster gains `catalog` — the family's first SINGLE-select kind, whose selection truth lives OUTSIDE the entries store) · [ADR-0169](./0169-a2ui-basic-catalog-upstream-interop.md) cl.6 (the picker's UI vehicle: library section, not bare select) · [ADR-0164](./0164-entry-list-extraction-home.md) cl.3 (ADDITIVE only: `EntryListOptions` gains two optional booleans; `mountEntryList`'s signature is unchanged) · **Relates** [ADR-0168](./0168-integration-manifest-registry-validated-dispatch-server-keys.md) (cl.2's trio law — the catalog entry's `id` is the registry/wire key, its `label` free display text, carried via `NewEntryInput.id`, LLD-C7's widening) · genui-surface.spec.md SPEC-R11/D3 (the pattern-source single-pick precedent this record deliberately DIVERGES from — Context §1) |

## Context

ADR-0169 shipped the second registered catalog and threaded `catalogId` end-to-end: the admin's
Surface Options row carries a bare `ui-select` built from `A2UI_CATALOG_OPTIONS`
(`agent-admin.ts:577-594`), the selection persists under `A2UI_CATALOG_KEY`, and every read is the
fail-closed `sanitizeCatalog(store?.get(A2UI_CATALOG_KEY))` (`agent-admin.ts:1061/1265/1321` →
`admin-live-runner.ts`'s produce POST body). That wiring is correct and stays byte-identical.
What Kim ruled on 2026-07-19 — and re-scoped on 2026-08-04 to the pick half only — is that
catalogs should present like the other things a persona is equipped with: a library section, the
same shape as Skills/Tools/Workflows, entries carrying label + description, per-persona. Three
facts make this a decision record rather than a config edit.

1. **A new entry kind with semantics the family has never carried.** Every existing capability
   kind is multi-enable: N entries, each independently on/off, all enabled ones compose.
   `pattern-source` (genui SPEC-R11/D3) bent this once — single PICK, but expressed as "first
   enabled by `order` wins, extra enabled entries are a silent no-op, zero enabled degrades to
   none picked". A catalog cannot reuse that shape honestly: the wire stamps EXACTLY ONE
   `catalogId` on every surface (ADR-0169 cl.4's authority stamp), there is no "none" state
   (`sanitizeCatalog` fail-closes to the default), and two switches showing ON while one id
   ships would be the UI lying about the one fact this section exists to state.

2. **A second-writer problem.** The entries store persists per-entry `enabled` flags. If those
   flags BECOME the selection, `A2UI_CATALOG_KEY` and the flags are two records of one
   fact — drift (foreign localStorage, a missed normalize) makes the section disagree with what
   the runner actually threads. The intake's own constraint — the UI "presents/writes the same
   persisted key" — names the resolution.

3. **The CREATE half is explicitly deferred, but its seam must be drop-in.** The entry-list's
   custom-add form is exactly where a future "author a catalog" affordance lives — but shipping
   it NOW would mint entries whose ids `sanitizeCatalog` rejects: a form that looks like
   create-a-catalog and silently selects the default instead. It must be suppressible per kind.

## Decision

Eight clauses. `sanitizeCatalog`'s fail-closed contract, `A2UI_CATALOG_KEY`, `A2UI_CATALOG_OPTIONS`
as the registered-catalog registry, and the runner→produce threading (ADR-0169 cl.4/5) are
byte-untouched — this record changes only how the admin PRESENTS and WRITES that same key.

1. **`catalog` joins the entry-kind roster.** `ENTRY_KINDS.catalog = 'catalog'`; a "Catalogs"
   section rides the SAME `mountEntryList` machinery (ADR-0132 cl.1's no-new-list/toggle/author-
   code law) via a `CAPABILITY_KINDS` row, and `entries:catalog` joins `initialEntryValues()`.
   A bespoke picker component is REJECTED — the family's shape is the point of the ask.

2. **The entries store holds the ROSTER; the persisted key holds the SELECTION.** A catalog
   entry records membership (which registered catalogs this persona has on its shelf): `id` =
   the registry short id, `label`/`description` display text — the ADR-0168 cl.2 trio law,
   carried through the add path by `NewEntryInput.id` (LLD-C7's widening, built for exactly
   this). The per-entry `enabled` flags are NEVER the selection truth: at render time every
   switch's checked state DERIVES from the one persisted key —
   `checked := (entry.id === sanitizeCatalog(store.get(A2UI_CATALOG_KEY)))`. Exactly one switch
   is ON by construction, drift is structurally impossible, and every existing read site keeps
   its exact current expression. The alternative — a radio-normalized entries store (toggle ON
   rewrites siblings' flags AND writes the key: two records of one fact) — is REJECTED as the
   second-writer defect Context §2 names.

3. **Single-select expresses as derived radio behavior — a deliberate divergence from D3.**
   Toggling an entry ON writes `store.set(A2UI_CATALOG_KEY, id)` iff the id is registered in
   `A2UI_CATALOG_OPTIONS`; an unregistered id (e.g. a dedup-suffixed duplicate row) is a VISIBLE
   no-op — the re-render snaps the switch back, selection unchanged — never a silent write of
   the default. Toggling the ACTIVE entry OFF writes the DEFAULT id: the fail-closed law
   surfacing in the UI, so the selection moves to the Default row rather than pretending a
   "none" state exists. Pattern-source's "first enabled wins" degrade (SPEC-R11/D3) is NOT
   reused: that kind has a legitimate none-picked state and its extra-enabled tolerance is a
   data-level degrade; catalog has neither property (Context §1). D3 itself is untouched.

4. **The default catalog is an ensured builtin roster row.** A pure read-time projection
   (`readCatalogEntries`) guarantees the Default (`DEFAULT_A2UI_CATALOG_ID`) entry is always
   present, `builtin: true` (toggleable, never deletable — ADR-0132 Fork 4), covering fresh
   stores AND pre-existing personas whose localStorage never seeded `entries:catalog` — no
   migration write. Other registered catalogs join the roster per persona via the library pack
   (cl.7). Deleting a non-builtin row whose id is ACTIVE also writes the default id (the same
   fail-closed surfacing as cl.3); deleting an inactive row is the ordinary delete.

5. **No per-kind master switch; the A2UI surface toggle is the gate.** The Catalogs section is
   the ONE `CAPABILITY_KINDS` row without a fold-heading master switch: a catalog is always
   exactly-one-active (a master-OFF "no catalogs" state has no wire meaning), and the modality
   gate already exists — `SURFACE_A2UI_KEY`. The section dims (`data-kind-disabled`) while A2UI
   is off, inheriting the bare select's own rationale ("choosing a catalog for a surface that
   can't run is noise, not configuration", `agent-admin.ts:1258-1260`). The kind is likewise
   EXCLUDED from `#capabilityGroups`' prompt projection (joining `pattern-source` in that
   filter) — catalog selection threads as `catalogId` on the wire, never as prompt prose.

6. **The bare `<select>` retires; the a2ui row keeps a read-only mirror.** The Surface Options
   row's `ui-select` (`agent-admin.ts:577-594`) is REMOVED — the Catalogs section is the one
   writer. In its place the row shows the active catalog's LABEL as read-only trailing text,
   re-derived in `#applyMasterStates` (where the select's value-reflection lives today), so the
   at-a-glance context beside the A2UI toggle survives. Keeping the select as a second writer
   is REJECTED: two write paths into one key, each obliged to reconcile the other's surface.

7. **The pack derives LIVE from the registry.** `agent-admin-libraries.ts` gains a "Registered
   catalogs" `EntryLibraryPack` under `ENTRY_KINDS.catalog`, mapped directly from an IMPORT of
   `A2UI_CATALOG_OPTIONS` (browser-importable, unlike the node-fenced integrations registry —
   so no INTEGRATION_TOOLS-style hand-copied trio table and no parity test to forget). A third
   registered catalog is ONE `A2UI_CATALOG_OPTIONS` row: sanitize, threading (ADR-0169's
   standing promise) AND the library pack all pick it up with zero further edits. The pack is
   generic, never flavored (GH #143's category map untouched).

8. **`EntryListOptions` gains two optional, default-true booleans** — `customAdd` (render the
   custom-entry authoring form) and `contentField` (render the per-entry content editor) — and
   the catalog kind sets both `false`: its entries key an external registry (nothing meaningful
   to author or edit — Context §3), so adds come from the library menu alone and rows render as
   label + description + switch. Additive: every existing call site is byte-untouched, and
   `mountEntryList`'s signature does not change (amending ADR-0164 cl.3's interface freeze
   additively). Un-suppressing `customAdd` for this kind is the named seam where the deferred
   CREATE affordance later lands.

## Non-goals

- **The CREATE/authoring affordance** (Kim's 2026-07-19 ruling; re-confirmed DEFERRED
  2026-08-04): no catalog authoring UI, no source-registry design. Its future home is cl.8's
  suppressed custom-add seam plus a registry write path that does not exist yet.
- **No change to `sanitizeCatalog`, `A2UI_CATALOG_KEY`'s value vocabulary, or the runner→produce
  threading** (ADR-0169 cl.3/4/5) — the reads at `agent-admin.ts:1061/1321` and the POST-body
  spread stay byte-identical.
- **No third catalog and no registry/renderer work** (ADR-0169's own territory).
- **No change to pattern-source's D3 semantics** — cl.3's divergence is scoped to the catalog
  kind only.

## Consequences

- The admin presents catalogs exactly like every other per-persona capability, while the wire
  contract (one sanitized id, fail-closed, threaded unchanged) is provably unmoved — the LLD's
  acceptance pins the produce POST body byte-identical across the refactor.
- "Exactly one selected" is a render-time derivation, not a stored invariant — no store state
  can make the section lie about what the runner threads.
- The family gains a per-kind presentation vocabulary (cl.8's two booleans) any future
  external-registry kind reuses; the freeze on `mountEntryList`'s signature holds.
- One more `CAPABILITY_KINDS` row carries exceptions (no master switch, prompt-projection
  exclusion) — the roster's "one array entry, never new code" law now has two annotated
  deviants (`pattern-source`, `catalog`). Accepted: each deviation is a single-line filter, and
  the alternative (a parallel bespoke section) forks the machinery itself.
- The switch control doubles as a radio (an ON-only interaction on the active row snaps back) —
  an interaction-vocabulary stretch flagged to Kim at ratification; if ruled against, the
  fallback is a per-kind selection marker in `entry-list`, a larger cl.8-style widening.
- Build plan: [`../lld/catalog-library-pack.lld.md`](../lld/catalog-library-pack.lld.md).
