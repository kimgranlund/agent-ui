# SINGLE-select kinds + the association fence

Moved verbatim from `admin-library-kinds/SKILL.md` §3 (GH #927) — the catalog exemplar for a
single-select kind, and the fenced (not-yet-shaped) association/multi-select gap.

## 3 · SINGLE-select kinds (ADR-0170 — the catalog exemplar)

The family's first single-select kind ruled one shape; a future exactly-one kind reuses it:

- **Selection truth lives OUTSIDE the entries store.** The entries store holds MEMBERSHIP (the
  roster); one persisted key holds the selection (ADR-0170 cl.2). Every
  switch DERIVES: `enabled := (entry.id === sanitize(store.get(KEY)))` at read time —
  `entries.ts` `readCatalogEntries`. Exactly one ON by construction; stored per-entry flags are
  dead weight, written by nothing, read by nothing.

  Bad (REJECTED — the second-writer defect): a radio-normalized store, where toggle-ON rewrites
  sibling `enabled` flags AND writes the key — two records of one fact that drift apart.
  Good (shipped): the key is the only record; the roster never encodes selection.

- **Switch-as-radio semantics** (cl.3; shipped `agent-admin.ts` `#selectCatalog`): ON + registered id ⇒ write the key (registered = one shared membership
  expression, `entries.ts` `isRegisteredCatalog` — never a second registry) · ON + unregistered
  (e.g. a dedup-suffixed duplicate row) ⇒ NO write, a VISIBLE no-op — the re-render snaps the
  switch back · OFF on the active row ⇒ write the DEFAULT id (fail-closed surfaced in the UI;
  no "none" state) · OFF on an inactive row ⇒ nothing.

- **Delete-active writes the default too, key-then-roster ordered** (cl.4; `agent-admin.ts` `#deleteCatalog`). The LLD's §3 invariant (`docs/lld/catalog-library-pack.lld.md`) is
  the contract: "a subscriber never observes an active id absent from the roster" — roster-first
  would flash zero switches ON between the writes; key-first stays consistent because the read
  projection guarantees the Default row exists the instant the key moves. Read the INVARIANT
  over any ordering label.

- **Same-value writes re-render directly** (the LLD's same §3; `agent-admin.ts` `#selectCatalog`): `SettingsStore` promises
  no notification for a `set` that changes nothing (Default-over-Default), and a refused toggle
  or a no-`subscribe` store notifies nobody — those arms call the section's direct re-render
  (`agent-admin.ts` `#refreshCatalogSection`) instead of trusting one store implementation's behavior.

- **The catalog kind mounts SPECIAL, not through the uniform loop (GH #488).** `agent-admin.ts`'s
  section loop special-cases `kind === ENTRY_KINDS.catalog`: it mounts that section's picker
  DIRECTLY ADJACENT to the row rather than via the generic `mountEntryList` path every other kind
  takes (`agent-admin.ts`'s catalog-mount branch) — the one roster kind whose UI shape diverges,
  recorded here so a future kind copying the catalog as its template knows this mount is bespoke,
  not the default.
- **No per-kind master switch** when exactly-one-active has no OFF meaning (cl.5; the master-switch skip in `agent-admin.ts`'s section builder); the modality gate (`SURFACE_A2UI_KEY`) drives the dim, and the kind is excluded
  from the prompt projection (`agent-admin.ts`'s prompt-projection builder) — a wire-threaded fact never doubles as prompt prose.

### Association/multi-select kinds (ADR-0175 — the realized field, the fenced gap)

No agent-admin kind has adopted this shape yet — recorded here as the law a future one builds to,
not a shipped exemplar (unlike the catalog kind above).

- **The realized building block.** `ui-multi-select`
  (`packages/agent-ui/components/src/controls/multi-select/`, ADR-0175) is a form-associated FACE
  field whose `value: string[]` is ONE bindable array riding the ORIGINAL single two-way slot
  (`{prop:'value', event:'select'}`) — never ADR-0161's multi-slot mechanism (ADR-0175 cl.2). This
  is the field a kind whose selection is a bound to-many array (not N independently-toggled
  entries) would realize its picker with.
- **Why this is NOT the Multi-enable shape (§4's table).** Multi-enable (skill/workflow/resource/
  tool) stores N independent per-entry `enabled` booleans across DIFFERENT roster rows — no single
  keyed aggregate value ever exists. Composing N such toggles gets native FormData multiplicity for
  free but never ONE round-tripped array — `ui-form-provider`'s own descriptor documents `values()`
  as *"a keyed convenience view of entries() — LAST entry wins on a duplicate name"*
  (`form-provider.md`'s `values()` note; ADR-0175 Fact 2/3, which also names why teaching the provider to
  aggregate is a rejected fix, ADR-0050). A kind that needs ONE array value read from a record,
  written to one path, and re-read on reload needs the minted field, not a stack of Multi-enable
  toggles.
- **The fence — what this does NOT close (ADR-0175 cl.3).** "Assign tags from these 12 tags" — a
  small, already-loaded, in-memory option set — is fully closed by the primitive above. A real
  relationship/association kind (e.g., "assign datasets to an account") needs strictly more: remote
  or paginated search over another kind's roster, inline creation of the related entry, and a
  distinct assigned/available split — none of which exists anywhere in the fleet today (ADR-0175
  Fact 7). That is its own future design intake, not a local widening of the roster law above —
  reaching for `ui-multi-select` alone does not close the relationship-editing problem.
