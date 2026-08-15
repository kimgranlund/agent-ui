---
name: admin-library-kinds
description: >-
  Agent-admin's entry-kind / library-pack architecture (ADR-0132→0164→0170): how a new kind
  joins the roster with zero bespoke code, the frozen mountEntryList interface + additive
  options bag, SINGLE-select kinds whose selection truth lives outside the entries store, and
  the id/label trio law for packs. Use for "add an entry kind", "new library section in
  agent-admin", "single-select kind", "library pack", "capability kind roster", or picking
  multi-enable vs single-select vs pattern-source semantics for a new kind. NOT for A2UI
  catalogs on the renderer (a2ui-multi-catalog); NOT for integrations — tool registry,
  manifests, server keys (integration-standards).
disable-model-invocation: false
user-invocable: false
---

# agent-admin library kinds — the entry-kind architecture

The law of the family, ratified across three ADRs: **a capability surface grows by data, never by
new list/toggle/author code.** Every rule below cites its ratified source or shipped exemplar —
open the cited lines before building on them; the code is the canon, this file is the map.

Path note: ADR-0164 (accepted) re-homed the machinery to `app/src/controls/entry-list/`
(`entry-list.ts` + a split-out `entry-data.ts`) — SHIPPED (GH #761 retired this note's earlier
"not yet built" claim and the `L` line-alias it carried). This map cites by SYMBOL, not line
number (the #757 cite-the-owner law): `entries.ts`'s domain exports, `entry-list.ts`'s core
`mountEntryList`/`EntryListOptions`, and `agent-admin.ts`'s named `#`-methods — the code is the
canon, these names survive its edits. ADR-0164 cl.2's split line decides where new code lands:
anything naming a kind constant, a seeded default, or a projection is DOMAIN (`entries.ts`);
anything parameterized by bare `kind: string` is CORE (`entry-list.ts`).

## 1 · The roster law — how a kind joins

No kind gets bespoke list/toggle/author code (ADR-0132 cl.1); `Entry.kind`
is a plain `string`, never a closed enum (Fork 2, `entries.ts` `Entry`). A new kind is FIVE data join
points — a kind missing any of them ships a silent gap, not a build error:

| Join point | Where | What it buys |
|---|---|---|
| `ENTRY_KINDS.<kind>` | `entries.ts` `ENTRY_KINDS` | the named constant every other point keys on |
| `initialEntryValues()` | `entries.ts` `initialEntryValues()` | the store seed (`entries:<kind>`, usually `[]`) |
| `CAPABILITY_KINDS` row | `agent-admin.ts` `CAPABILITY_KINDS` | the section itself — label, addLabel, liveHeading; array order IS DOM order |
| preset seed map | `site/pages/agent-admin-presets.ts` `presetSeed` | seed-completeness: `presetSeed` enumerates EVERY kind's `entries:` key — a new kind owes a row here even when seeded `[]` (its own precedent comment says so) |
| library pack (optional) | `site/pages/agent-admin-libraries.ts` (`ADMIN_LIBRARIES`) | ready-to-add entries; pure data through the same `entries.ts` `validateNewEntry` path |

A pack need not be a fixed authored array. Two shipped patterns, both on the `tool` kind:

- **Live-derived pack** — reads a runtime source through a setter, and is ABSENT (not empty, not
  errored) when that source degrades. The Integrations pack reads `setLiveIntegrations` (falling back to a
  static trio); the **MCP-services pack** (`MCP_SERVICES_PACK`, GH #783/ADR-0185) reads `setLiveServices`,
  fed by the dev proxy's `services` GET array (`fetchLiveServices`, `site/lib/admin-live-runner.ts`), and
  has NO static fallback — so `ADMIN_LIBRARIES`'s `tool` key is a GETTER that omits the pack entirely while
  `liveServiceEntries` is `undefined`. Each pack entry keys the external registry by an EXPLICIT
  `NewEntryInput.id` (the service ref `mcp:<server-id>:*`), never a slugged label (§4's trio law).
- **Per-pack collision rejection** — a pack keying an external registry sets its OWN
  `EntryLibraryPack.rejectOnCollision` (`entry-data.ts`, GH #783 S3/LLD-C5): re-adding an id already in the
  list is a DUPLICATE `validateNewEntry` rejects (`Already in the list.`), never a suffixed phantom row, and
  `entry-list.ts`'s picker-disable + render-refresh gate honor the KIND flag OR the PACK flag. This is what
  lets a foreign-key pack ride under an ORDINARY kind (`MCP_SERVICES_PACK`, `rejectOnCollision: true`, on the
  `tool` kind) — the same reject-on-commit + picker-disable the catalog KIND flag buys (§3), without the kind
  itself becoming registry-keyed.

Built-ins are toggle-off-only, never deletable (ADR-0132 Fork 4, enforced by the UI: `entry-list.ts` renders
no delete affordance for `builtin: true`). Kind-specific field schemas stay Fork 3's explicitly
deferred extension — a kind that needs one owes its own intake, not a quiet widening.

## 2 · The frozen interface + the additive options bag

`mountEntryList(kind, addLabel, handlers, options?)` is FROZEN verbatim (ADR-0164 cl.3; the shipped `mountEntryList` signature in `entry-list.ts`). Capability grows ONLY through the options
bag, additively: new members of `EntryListOptions` are optional with a default that renders
byte-identical for every existing call site. The precedent is ADR-0170 cl.8: `EntryListOptions`' `customAdd` and `contentField` (`entry-list.ts`), both default `true`;
the catalog kind passes both `false` (`agent-admin.ts`'s catalog `mountEntryList` call) because its entries key an external registry —
nothing to author or edit; adds come from the library menu alone. A suppressed `customAdd` is
also a named future seam (the deferred catalog-CREATE affordance lands there). A new parameter
in the signature, or a non-defaulting option, reopens ADR-0164 — it is not a local edit.

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

## 4 · The trio law + the semantics spectrum

**id ≠ tool.name ≠ label — three facts, three fields** (ADR-0168 cl.2).
A pack whose entries key an EXTERNAL vocabulary supplies `NewEntryInput.id` (`entries.ts`) so the
stable key survives a label edit; packs without explicit ids keep slugify-from-label. The same
law binds BOTH projections from pack to store: the library-add path (`validateNewEntry`) and the
preset seed path (`seedId`, `site/pages/agent-admin-presets.ts` — seeding by label where an
id exists mints an armed-but-silently-inert entry). A pack keying a live registry derives from an
IMPORT of it, never a hand-copied table (ADR-0170 cl.7; `agent-admin-libraries.ts`'s registry-import).

When a new kind picks its semantics, three shapes exist — pick by the kind's own truth table:

| Shape | Exemplar | When it fits |
|---|---|---|
| Multi-enable | skill/workflow/resource/tool | N independent on/offs; every enabled entry that is also **in-context** composes ambiently — as ONE INDEX LINE (label + description, NEVER its `content`) since GH #891/SPEC-R14 ruled the ambient shape, the full body arriving only on the user's own `@`/`/` invocation (`entries.ts`'s `composeLiveSystemPrompt` + its pinned teaching block; `resolveTurnReferences` is the whole-content load path). Since GH #850 these four kinds also carry a second, ORTHOGONAL per-entry axis (`Entry.availability`: `context` \| `invocable`, absent ⇒ `context` read-side), and an `invocable` entry is reachable only by an explicit per-turn invocation (`entry-data.ts`'s `isAmbient` is the one conjunct every ambient projection filters on). The composer's capabilities menu (GH #891/SPEC-R13) is a GLOBAL enable/disable over the same `enabled` axis, never a per-turn dial |
| Pattern-source (first-by-order) | `entries.ts` `pickedPatternSource` (SPEC-R11/D3) | single PICK with a legitimate none state; extra enabled entries a tolerated data-level no-op |
| Single-select (derived) | catalog, §3 | the wire carries exactly ONE id, no none state, fail-closed default — the D3 shape would make the UI lie (ADR-0170 Context) |

Illustrative, not a menu to extend casually: a fourth shape is an ADR, not a code choice —
ADR-0170's Consequences already cap the roster's annotated deviants at single-line filters. An
ASSOCIATION shape (a kind bound to another kind's roster as one array value) already has its
field-level building block minted (`ui-multi-select`, ADR-0175 — see "Association/multi-select
kinds" above) — but the KIND-level shape itself is not ruled; adding one is its own ADR, same as
any other fourth shape, not a local table addition.
