---
name: admin-library-kinds
description: >-
  Use for "add an entry kind", "new library section in agent-admin", "single-select kind",
  "library pack", "capability kind roster", "what does builtin protect", or picking
  multi-enable vs single-select vs pattern-source semantics for a new kind — agent-admin's
  entry-kind / library-pack architecture (ADR-0132→0164→0170→0178): how a kind joins the
  roster with zero bespoke code, the frozen mountEntryList interface + options bag,
  SINGLE-select kinds, the id/label trio law, and built-in protection + the persona-patch
  verbs. NOT for A2UI catalogs on the renderer
  (a2ui-multi-catalog); NOT for integrations — tool registry, manifests, server keys
  (integration-standards).
disable-model-invocation: false
user-invocable: false
---

# agent-admin library kinds — the entry-kind architecture

The law of the family, ratified across three ADRs: **a capability surface grows by data, never by
new list/toggle/author code.** Every rule below cites its ratified source or shipped exemplar —
open the cited file before building on it; the code is the canon, this file is the map.

Path note: ADR-0164 (accepted) re-homed the machinery to `app/src/controls/entry-list/`
(`entry-list.ts` + a split-out `entry-data.ts`) — SHIPPED (GH #761 retired this note's earlier
"not yet built" claim and the `L` line-alias it carried). This map cites by SYMBOL, not line
number (the #757 cite-the-owner law): `entries.ts`'s domain exports, `entry-list.ts`'s core
`mountEntryList`/`EntryListOptions`, `persona-patch.ts`'s `updateTargetIndex`, and `agent-admin.ts`'s
named `#`-methods — the code is the canon, these names survive its edits, and the ADR-0164
frozen-interface + layering trip-wires are tests, so a red run after a change is a design regression,
not noise. ADR-0164 cl.2's split line decides where new code lands:
anything naming a kind constant, a seeded default, or a projection is DOMAIN (`entries.ts`);
anything parameterized by bare `kind: string` is CORE (`entry-list.ts`).

## Consult table — read the file that matches the job

| File | Read when |
|---|---|
| `references/roster-and-interface.md` | Adding a new entry kind (the five roster join points, ADR-0132), authoring or extending a library pack (live-derived, collision-rejecting), or touching the frozen `mountEntryList` interface + its additive `EntryListOptions` bag (ADR-0164) |
| `references/single-select-catalog.md` | Building or modifying a SINGLE-select kind — the catalog exemplar (ADR-0170): selection-truth-outside-the-store, switch-as-radio semantics, delete-active ordering, the special (non-uniform) mount — or scoping a future association/multi-select kind (ADR-0175, the fenced gap) |
| `references/trio-law-and-semantics.md` | Picking id/label/name semantics for a new kind or pack (ADR-0168's trio law), or choosing a new kind's shape among Multi-enable / Pattern-source / Single-select (ADR-0170) |
| `references/builtin-protection-and-patch-verbs.md` | Asking what `builtin: true` protects (non-deletable only, never immutable — ADR-0132 Fork 4), or which patch verbs the persona-patch gate admits per authorship class (ADR-0178 Amendment) |

## The roster law, in one line

No kind gets bespoke list/toggle/author code (ADR-0132 cl.1) — `Entry.kind` is a plain `string`,
never a closed enum; a kind joins by FIVE data points (`ENTRY_KINDS`, `initialEntryValues()`,
`CAPABILITY_KINDS`, the preset seed map, and an optional library pack — live-derived or
collision-rejecting). Built-ins are toggle-off-only, never deletable (ADR-0132 Fork 4) — and NOT
immutable: the persona-patch gate updates host-seeded builtin prompt sections in place while
user-authored entries stay append-protected (ADR-0178 Amendment;
`references/builtin-protection-and-patch-verbs.md`). Full mechanics + both shipped pack patterns:
`references/roster-and-interface.md`.

## The frozen interface, in one line

`mountEntryList(kind, addLabel, handlers, options?)` is FROZEN verbatim (ADR-0164 cl.3) —
capability grows ONLY through the additive `EntryListOptions` bag, every new member optional with
a byte-identical default for existing call sites. A new signature parameter, or a non-defaulting
option, reopens ADR-0164. Full contract: `references/roster-and-interface.md`.

## Single-select + association, in one line

The catalog kind (ADR-0170) proved the shape: selection truth lives in ONE persisted key outside
the entries store, never a second per-entry flag — switch-as-radio semantics, key-then-roster
delete ordering, and a special (non-uniform) mount. `ui-multi-select` (ADR-0175) is the realized
field for a bound to-many array, but the KIND-level association shape itself is still unruled —
its own future ADR. Full semantics: `references/single-select-catalog.md`.

## Trio law + shape picker, in one line

`id ≠ tool.name ≠ label` — three facts, three fields (ADR-0168 cl.2); a pack keying an external
vocabulary supplies an explicit `id` so the stable key survives a label edit. Three shapes cover a
new kind's selection semantics — Multi-enable, Pattern-source, Single-select — each with its own
truth table; a fourth shape is an ADR, not a code choice. Full law + the semantics table:
`references/trio-law-and-semantics.md`.
