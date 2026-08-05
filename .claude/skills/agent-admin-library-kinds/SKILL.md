---
name: agent-admin-library-kinds
description: >-
  Agent-admin's entry-kind / library-pack architecture (ADR-0132→0164→0170): how a new kind
  joins the roster with zero bespoke code, the frozen mountEntryList interface + additive
  options bag, SINGLE-select kinds whose selection truth lives outside the entries store, and
  the id/label trio law for packs. Use for "add an entry kind", "new library section in
  agent-admin", "single-select kind", "library pack", "capability kind roster", or picking
  multi-enable vs single-select vs pattern-source semantics for a new kind. NOT for A2UI
  catalogs on the renderer (a2ui-multi-catalog); NOT for integrations — tool registry,
  manifests, server keys (agent-ui-integration-standards).
disable-model-invocation: false
user-invocable: false
---

# agent-admin library kinds — the entry-kind architecture

The law of the family, ratified across three ADRs: **a capability surface grows by data, never by
new list/toggle/author code.** Every rule below cites its ratified source or shipped exemplar —
open the cited lines before building on them; the code is the canon, this file is the map.

Path note: ADR-0164 (accepted) re-homes the machinery to `app/src/controls/entry-list/`
(`entry-list.ts` + a split-out `entry-data.ts`) — not yet built. Paths below are the tree as it
stands (`packages/agent-ui/app/src/controls/agent-admin/`, `E` = `entries.ts`, `L` =
`entry-list.ts`, `A` = `agent-admin.ts`). ADR-0164 cl.2's split line decides where new code lands
either way: anything naming a kind constant, a seeded default, or a projection is DOMAIN
(stays in `agent-admin/entries.ts`); anything parameterized by bare `kind: string` is CORE.
The change that builds that extraction owes this file's path anchors a re-point in the same PR
(stale-context law).

## 1 · The roster law — how a kind joins

No kind gets bespoke list/toggle/author code (ADR-0132 cl.1, `docs/adr/0132:50-53`); `Entry.kind`
is a plain `string`, never a closed enum (Fork 2, `E:18-20`). A new kind is FIVE data join
points — a kind missing any of them ships a silent gap, not a build error:

| Join point | Where | What it buys |
|---|---|---|
| `ENTRY_KINDS.<kind>` | `E:21-42` | the named constant every other point keys on |
| `initialEntryValues()` | `E:104-117` | the store seed (`entries:<kind>`, usually `[]`) |
| `CAPABILITY_KINDS` row | `A:167` | the section itself — label, addLabel, liveHeading; array order IS DOM order |
| preset seed map | `site/pages/agent-admin-presets.ts:625-637` | seed-completeness: `presetSeed` enumerates EVERY kind's `entries:` key — a new kind owes a row here even when seeded `[]` (`:632-637` is the precedent comment) |
| library pack (optional) | `site/pages/agent-admin-libraries.ts` (`ADMIN_LIBRARIES`) | ready-to-add entries; pure data through the same `validateNewEntry` path (`E:283-289`) |

Built-ins are toggle-off-only, never deletable (ADR-0132 Fork 4, enforced by the UI: `L` renders
no delete affordance for `builtin: true`). Kind-specific field schemas stay Fork 3's explicitly
deferred extension — a kind that needs one owes its own intake, not a quiet widening.

## 2 · The frozen interface + the additive options bag

`mountEntryList(kind, addLabel, handlers, options?)` is FROZEN verbatim (ADR-0164 cl.3,
`docs/adr/0164:96-102`; the shipped signature `L:84`). Capability grows ONLY through the options
bag, additively: new members of `EntryListOptions` are optional with a default that renders
byte-identical for every existing call site. The precedent is ADR-0170 cl.8
(`docs/adr/0170:112-119`): `customAdd` (`L:77`) and `contentField` (`L:81`), both default `true`;
the catalog kind passes both `false` (`A:767`) because its entries key an external registry —
nothing to author or edit; adds come from the library menu alone. A suppressed `customAdd` is
also a named future seam (the deferred catalog-CREATE affordance lands there). A new parameter
in the signature, or a non-defaulting option, reopens ADR-0164 — it is not a local edit.

## 3 · SINGLE-select kinds (ADR-0170 — the catalog exemplar)

The family's first single-select kind ruled one shape; a future exactly-one kind reuses it:

- **Selection truth lives OUTSIDE the entries store.** The entries store holds MEMBERSHIP (the
  roster); one persisted key holds the selection (ADR-0170 cl.2, `docs/adr/0170:58-68`). Every
  switch DERIVES: `enabled := (entry.id === sanitize(store.get(KEY)))` at read time —
  `readCatalogEntries`, `E:172-177`. Exactly one ON by construction; stored per-entry flags are
  dead weight, written by nothing, read by nothing.

  Bad (REJECTED — the second-writer defect): a radio-normalized store, where toggle-ON rewrites
  sibling `enabled` flags AND writes the key — two records of one fact that drift apart.
  Good (shipped): the key is the only record; the roster never encodes selection.

- **Switch-as-radio semantics** (cl.3, `docs/adr/0170:70-78`; shipped `#selectCatalog`,
  `A:805-822`): ON + registered id ⇒ write the key (registered = one shared membership
  expression, `isRegisteredCatalog` `E:183-185` — never a second registry) · ON + unregistered
  (e.g. a dedup-suffixed duplicate row) ⇒ NO write, a VISIBLE no-op — the re-render snaps the
  switch back · OFF on the active row ⇒ write the DEFAULT id (fail-closed surfaced in the UI;
  no "none" state) · OFF on an inactive row ⇒ nothing.

- **Delete-active writes the default too, key-then-roster ordered** (cl.4; `#deleteCatalog`
  `A:834-838`). The LLD's repaired §3 line (`docs/lld/catalog-library-pack.lld.md:62-70`) is
  the contract: "a subscriber never observes an active id absent from the roster" — roster-first
  would flash zero switches ON between the writes; key-first stays consistent because the read
  projection guarantees the Default row exists the instant the key moves. Read the INVARIANT
  over any ordering label.

- **Same-value writes re-render directly** (`lld:71-76`; `A:815-821`): `SettingsStore` promises
  no notification for a `set` that changes nothing (Default-over-Default), and a refused toggle
  or a no-`subscribe` store notifies nobody — those arms call the section's direct re-render
  (`#refreshCatalogSection`, `A:844`) instead of trusting one store implementation's behavior.

- **No per-kind master switch** when exactly-one-active has no OFF meaning (cl.5; the skip at
  `A:661`); the modality gate (`SURFACE_A2UI_KEY`) drives the dim, and the kind is excluded
  from the prompt projection (`A:1293`) — a wire-threaded fact never doubles as prompt prose.

## 4 · The trio law + the semantics spectrum

**id ≠ tool.name ≠ label — three facts, three fields** (ADR-0168 cl.2, `docs/adr/0168:60-65`).
A pack whose entries key an EXTERNAL vocabulary supplies `NewEntryInput.id` (`E:270-281`) so the
stable key survives a label edit; packs without explicit ids keep slugify-from-label. The same
law binds BOTH projections from pack to store: the library-add path (`validateNewEntry`) and the
preset seed path (`seedId`, `site/pages/agent-admin-presets.ts:94-96` — seeding by label where an
id exists mints an armed-but-silently-inert entry). A pack keying a live registry derives from an
IMPORT of it, never a hand-copied table (ADR-0170 cl.7; `agent-admin-libraries.ts:399-414`).

When a new kind picks its semantics, three shapes exist — pick by the kind's own truth table:

| Shape | Exemplar | When it fits |
|---|---|---|
| Multi-enable | skill/workflow/resource/tool | N independent on/offs, all enabled compose |
| Pattern-source (first-by-order) | `pickedPatternSource`, `E:124-128` (SPEC-R11/D3) | single PICK with a legitimate none state; extra enabled entries a tolerated data-level no-op |
| Single-select (derived) | catalog, §3 | the wire carries exactly ONE id, no none state, fail-closed default — the D3 shape would make the UI lie (`docs/adr/0170:26-34`) |

Illustrative, not a menu to extend casually: a fourth shape is an ADR, not a code choice —
ADR-0170's Consequences already cap the roster's annotated deviants at single-line filters.
