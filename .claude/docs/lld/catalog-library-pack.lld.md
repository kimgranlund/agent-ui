# LLD — the catalog LIBRARY-PACK arc (the `catalog` entry kind · derived single-select · select retirement · the registry-derived pack)

> Refines: [ADR-0170](../adr/0170-catalog-library-kind-single-select.md) (proposed — build starts
> only from the ratified text; the switch-as-radio interaction is a flagged Kim fork at
> ratification, §4). Decomposition:
> [`../decompositions/catalog-library-pack.decomp.md`](../decompositions/catalog-library-pack.decomp.md).
> · proposed · 2026-08-04 · planner (design seat) · Layer: LLD (implementation plan)
>
> **Composes on:** the SHIPPED entry-list machinery (ADR-0132 cl.1's one-primitive law;
> `agent-admin/entries.ts` + `entry-list.ts` + `agent-admin.ts`'s `#makeSection`/
> `#rewireAllSections`/`#applyMasterStates`), the catalog registry + fail-closed read
> (`agent-admin-schema.ts:206-224` — `A2UI_CATALOG_KEY` · `A2UI_CATALOG_OPTIONS` ·
> `DEFAULT_A2UI_CATALOG_ID` · `sanitizeCatalog`, ADR-0169 cl.3/6), the shipped `NewEntryInput.id`
> widening (ADR-0168 cl.2 / tool-enablement LLD-C7, `entries.ts:207-218`), and the library-pack
> seam (`EntryLibraryPack`, GH #47/#48/#143). The wire is a FENCE: `sanitizeCatalog`, the reads at
> `agent-admin.ts:1061/1321`, and the runner→produce threading change zero bytes.
>
> **Freeze discipline.** §2 is the fan-out contract; one writer per file per slice. A builder who
> finds a seam unworkable STOPS and escalates — a coordinated LLD/ADR repair, never a local
> workaround.

## 1 · Intent

Present the A2UI catalog selection the way every other per-persona capability presents — a
"Catalogs" library section with entries carrying label + description + switch — while
`A2UI_CATALOG_KEY` stays the ONE selection truth: every switch's checked state DERIVES from the
persisted key at render time (exactly one ON by construction, drift structurally impossible —
ADR-0170 cl.2), the bare Surface Options `<select>` retires in favor of a read-only label mirror
(cl.6), and the two registered catalogs project into the library menu LIVE from
`A2UI_CATALOG_OPTIONS` (cl.7). The CREATE affordance is a named non-goal — its future seam is
cl.8's suppressed `customAdd`.

## 2 · Components (build slices)

| ID | Component | File(s) | Traces |
|---|---|---|---|
| LLD-C1 | the `catalog` kind + roster projection — `ENTRY_KINDS.catalog = 'catalog'`; `entries:catalog` joins `initialEntryValues()` (seed `[]`); NEW pure `readCatalogEntries(store): Entry[]`: read the roster via `readEntries`, ENSURE the Default row (`id: DEFAULT_A2UI_CATALOG_ID`, label looked up in `A2UI_CATALOG_OPTIONS`, `builtin: true`, first by `order`) is present when the stored roster lacks it — a read-time guarantee, NO migration write — then project every entry with `enabled: entry.id === sanitizeCatalog(store?.get(A2UI_CATALOG_KEY))` (the per-entry stored `enabled` flag is IGNORED for this kind — never the selection truth). New import edge `entries.ts → agent-admin-schema.ts` (same-folder sibling; schema imports nothing back — no cycle; the domain layer stays put under ADR-0164's pending split, §4) | `packages/agent-ui/app/src/controls/agent-admin/entries.ts` + `entries.test.ts` | ADR-0170 cl.1, cl.2, cl.4 |
| LLD-C2 | presentation vocabulary — `EntryListOptions` gains `customAdd?: boolean` and `contentField?: boolean`, BOTH default `true` (absent ⇒ byte-identical render). `customAdd: false` ⇒ neither the add-toggle button nor the authoring form mounts (the library menu still does — it commits through `handlers.onAdd` directly, not through the form); `contentField: false` ⇒ rows mount no `ui-code-editor` (the mid-edit preservation path is inert by construction — nothing to preserve). `mountEntryList`'s signature is unchanged (the options bag widens — ADR-0164 cl.3 amended ADDITIVELY per ADR-0170 cl.8); every existing call site is byte-untouched | `packages/agent-ui/app/src/controls/agent-admin/entry-list.ts` (+ assertions in `entries.test.ts` / `agent-admin.test.ts`, §5 S1) | ADR-0170 cl.8; ADR-0164 cl.3 |
| LLD-C3 | the Catalogs section — one `CAPABILITY_KINDS` row `{kind: ENTRY_KINDS.catalog, label: 'Catalogs', addLabel: 'Add catalog' (dead text under C2's suppression, supplied for the row shape), liveHeading: unused (excluded, C4)}`, appended LAST (after Pattern sources — the appended-kind precedent). Row exceptions, each a single-line filter: (a) NO master switch minted — the `#compose()` loop skips the `kindSwitch` build for this kind (cl.5); (b) `#makeSection` passes `{libraries, customAdd: false, contentField: false}` for this kind; (c) catalog-specific HANDLERS replace the generic store-writers: `onToggle(id, checked)` → `checked && registered(id)` ⇒ `store.set(A2UI_CATALOG_KEY, id)`; `checked && !registered(id)` ⇒ NO write (the re-render snaps the switch back — the VISIBLE no-op, cl.3); `!checked && id === active` ⇒ `store.set(A2UI_CATALOG_KEY, DEFAULT_A2UI_CATALOG_ID)` (fail-closed surfaced — the flagged Kim fork, §4); `!checked && id !== active` ⇒ no write (already-derived OFF). `onDelete(id)` → the ordinary roster delete PLUS, iff `id === active`, the default-id write (cl.4); builtin rows keep the no-delete-affordance law. `onAdd` stays the generic `validateNewEntry` path (a duplicate add mints a dedup-suffixed id — an unregistered, never-selectable row, cl.3's own named case). `#rewireAllSections`: this kind renders from `readCatalogEntries(store)` (not bare `readEntries`) and its subscription fires on `entries:catalog` OR `A2UI_CATALOG_KEY`; the no-subscribe fallback in the catalog handlers calls the kind's render + `#applyMasterStates` directly (the `#updateEntries` fallback mirrored) | `packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts` + `agent-admin.test.ts` | ADR-0170 cl.1, cl.3, cl.4, cl.5 |
| LLD-C4 | masters, dim, prompt exclusion — `#applyMasterStates`' per-kind loop special-cases catalog: `data-kind-disabled` derives from `!isEnabledFlag(store?.get(SURFACE_A2UI_KEY))`, never `kindEnabledKey` (no master exists — cl.5, inheriting the retired select's own rationale, `agent-admin.ts:1258-1260`); `#capabilityGroups`' filter widens to exclude `ENTRY_KINDS.catalog` beside `patternSource` (`agent-admin.ts:1197-1198`) — `catalogId` threads as wire, never prompt prose; the Context: System per-kind item (`agent-admin.ts:1332-1338`) derives its `enabled` cell from the SAME `SURFACE_A2UI_KEY` read for this kind (an unwritten `kindEnabledKey('catalog')` would read as a phantom always-ON master) | `packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts` (same writer as C3 — same slice, §5 S2) | ADR-0170 cl.5 |
| LLD-C5 | select retirement + the read-only mirror — DELETE the `ui-select` build (`agent-admin.ts:577-594`, its `select` listener and the `#surfaceCatalogSelect` field with it; the `:577` "one option today" comment retires — the ADR's Repairs row); mount in its place a read-only trailing `<span data-part="surface-catalog">` on the a2ui row; `#applyMasterStates` (where the select's value-reflection lives today, `:1264-1267`) re-derives its `textContent` = the active catalog's LABEL (`A2UI_CATALOG_OPTIONS` lookup on the sanitized id — the same fail-closed read expression, now feeding a mirror instead of a select) and toggles its dim with `!a2uiOn`; one small `agent-admin.css` rule for the mirror text (muted trailing text, the row's existing vocabulary). The wire reads at `:1061`/`:1321` are byte-identical | `packages/agent-ui/app/src/controls/agent-admin/agent-admin.ts` + `agent-admin.css` + `agent-admin.test.ts` (same writer as C3/C4 — SERIAL slice, §5 S3) | ADR-0170 cl.6 |
| LLD-C6 | the registry-derived pack — the `@agent-ui/app` barrel gains `export { A2UI_CATALOG_OPTIONS }` (additive; the schema module is already the barrel's own source at `index.ts:35`); `A2UI_CATALOG_OPTIONS` rows gain an OPTIONAL `description?: string` (+ one line of copy per shipped row; `sanitizeCatalog` reads only `id` — untouched); `agent-admin-libraries.ts` maps the import to ONE generic "Registered catalogs" `EntryLibraryPack` under `ENTRY_KINDS.catalog` in `ADMIN_LIBRARIES` — `entries: A2UI_CATALOG_OPTIONS.map(o => ({id: o.id, label: o.label, description: o.description ?? '', content: ''}))` (the trio law: `id` = registry/wire key via `NewEntryInput.id`, label free — ADR-0168 cl.2). NOT in `FLAVORED_PACK_CATEGORY` (generic by construction — GH #143's map untouched); no hand-copied trio table, no parity test (the pack IS the registry, one import). A third catalog = one `A2UI_CATALOG_OPTIONS` row, zero pack edits | `packages/agent-ui/app/src/index.ts` · `packages/agent-ui/app/src/controls/agent-admin/agent-admin-schema.ts` (the optional `description` widening only) · `site/pages/agent-admin-libraries.ts` · site tests (`agent-admin-app.test.ts` render assertions, not parity) | ADR-0170 cl.7; ADR-0168 cl.2 |
| LLD-C7 | acceptance pins — (a) the produce POST body is BYTE-IDENTICAL across the refactor (a pinned request-body assertion through the runner seam, the ADR's own acceptance); (b) exactly-one-ON invariant probes: fresh store · foreign `enabled` flags in `entries:catalog` · a stale/unknown `A2UI_CATALOG_KEY` value (derives to Default); (c) the radio semantics of C3 (ON-inactive selects · ON-unregistered snaps back · OFF-active moves to Default · delete-active moves to Default); (d) select-gone probes (no `[data-part="surface-catalog"]` `ui-select`; the mirror text tracks the key); (e) prompt-projection exclusion + dim derivation; (f) the browser shard where admin page behavior is touched | `agent-admin.test.ts` · `entries.test.ts` · site suites · the browser shard (§5 S5) | ADR-0170 Consequences (acceptance) |

## 3 · Data & contracts

- **One selection truth.** `A2UI_CATALOG_KEY` (via `sanitizeCatalog`) is the only record of the
  selection. `entries:catalog` records MEMBERSHIP only (which catalogs are on this persona's
  shelf); its per-entry `enabled` booleans are dead weight for this kind — written by nothing,
  read by nothing (`readCatalogEntries` overrides them at projection time). A radio-normalized
  store (rewriting sibling flags on toggle) is REJECTED — the ADR's second-writer defect.
- **The roster row shape** is the ordinary `Entry` — no new fields, no kind-specific schema
  (ADR-0132 Fork 3 stays deferred). `id` = the registry short id (`agent-ui` · `a2ui-basic`),
  carried through the add path by `NewEntryInput.id`; `content` is `''` and never rendered
  (C2's `contentField: false`).
- **Registered = `A2UI_CATALOG_OPTIONS.some(o => o.id === id)`** — one helper expression shared by
  C3's handlers; NOT a second registry. `sanitizeCatalog` itself stays the read-side law.
- **Fail-closed surfacing, not fail-closed hiding:** every path that would leave the key pointing
  at a non-registered id (toggle-OFF the active row, delete the active row) WRITES
  `DEFAULT_A2UI_CATALOG_ID` explicitly, so the UI and the wire agree at the Default row rather
  than silently diverging until the next `sanitizeCatalog` coercion.
- **Store writes per interaction: at most one** (`A2UI_CATALOG_KEY` alone on select/deselect;
  `entries:catalog` alone on add; both ONLY on delete-active — the one two-key interaction,
  ordered roster-then-key so a subscriber never observes an active id absent from the roster).

## 4 · Risks & non-decisions

- **The flagged Kim fork (ratification gate, already in the ADR):** the switch doubling as a radio
  — an ON-only interaction on the ACTIVE row (toggle it OFF ⇒ selection snaps to the Default row,
  never a "none" state). This LLD designs that primary. Named fallback if Kim rules against the
  interaction-vocabulary stretch: a per-kind selection MARKER in `entry-list.ts` (a radio-shaped
  `data-part="entry-select"` control replacing `entry-toggle` for kinds that opt in) — a larger
  cl.8-style `EntryListOptions` widening; C1/C4/C5/C6 survive that fork unchanged, only C2/C3's
  toggle wiring re-shapes.
- **ADR-0164 sequencing (coordination risk, not a fork):** ADR-0164 (accepted) moves
  `entry-list.ts` to `app/src/controls/entry-list/` and splits `entries.ts` — NOT YET BUILT; this
  LLD names the paths as the tree holds them today. If the extraction lands mid-campaign: C2's
  file moves with it, C1's `readCatalogEntries` is DOMAIN by 0164's own split line (names kind
  constants + schema keys) and stays in `agent-admin/entries.ts` either way. Whoever builds second
  rebases paths; the contracts here are path-independent.
- **Non-decision (recorded, no ADR needed):** the Catalogs section sits LAST in
  `CAPABILITY_KINDS` (after Pattern sources) — array order is DOM order; adjacency to the A2UI
  Surface Options row is served by C5's mirror, not by section placement.
- **Non-decision:** `A2UI_CATALOG_OPTIONS`' optional `description` (C6) is presentation copy for
  the pack/menu row only — `sanitizeCatalog`, the select-era consumers, and the wire never read
  it; omitting it degrades to an empty description line, which `entry-list.ts` already skips.
- **Non-decision:** duplicate catalog adds are allowed and inert (the dedup-suffixed row is
  unregistered ⇒ never selectable, deletable at will — cl.3's named visible no-op). Rejecting
  them at `onAdd` would fork `validateNewEntry` per kind for no wire-level gain.
- **Two `A2UI_CATALOG_KEY` writers existed briefly in history (select + anything else) — after C5
  the Catalogs section is the ONE writer**; the mirror is read-only by construction. A future
  second writer reopens ADR-0170 cl.6, not a local fix.

## 5 · Build sequence (one-context slices; gates FOREGROUND, judged by exit codes)

1. **S-DOCS** (post-ratification, serial): execute the ADR's Repairs row — narrow
   `agent-admin-schema.ts:211-213`'s doc comment to the CREATE half; the dated REV forward pointer
   on ADR-0169 cl.6 (the ADR-0156 cl.5 shape). No Status cell touched by any agent seat.
2. **S1** = LLD-C1 + C2 (`entries.ts` + `entry-list.ts` + tests; two files, one writer each; no
   consumer changes — every existing call site byte-identical) → `check && test` green.
3. **S2** = LLD-C3 + C4 (the section, handlers, masters/dim/prompt-exclusion — the ONE
   `agent-admin.ts` writer this slice) → green.
4. **S3** = LLD-C5 (select retirement + mirror + css) — SERIAL after S2, same-file writer
   (`agent-admin.ts`; the tool-enablement S4/S5 lesson) → green.
5. **S4** = LLD-C6 (barrel export + `description` widening + the site pack) — needs S1
   (`ENTRY_KINDS.catalog`); parallel-safe beside S2/S3 (disjoint files: `index.ts`,
   `agent-admin-schema.ts`'s options rows, `site/pages/agent-admin-libraries.ts`) → green.
6. **S5** = LLD-C7 (the byte-identical POST-body pin, invariant/radio probes not already landed
   per-slice, the `agent-admin.md` doc row) → full `npm run check && npm test` green +
   `test:browser` for the admin shard.

Every slice: one writer per file, foreground gates, exit codes only. Reviewer of this doc set:
the doc-checker seat; ratifier of the ADR: Kim alone.
