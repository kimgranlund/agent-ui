# Decomposition — the catalog LIBRARY-PACK arc (the `catalog` entry kind · single-select semantics · the bare select retires)

> Status: proposed · v0.1 · 2026-08-04 · Contract: [ADR-0170](../adr/0170-catalog-library-kind-single-select.md)
> (proposed — build starts only from the ratified text; the switch-as-radio interaction is a flagged
> Kim fork at ratification, see the ADR's Consequences). Build plan:
> [`../lld/catalog-library-pack.lld.md`](../lld/catalog-library-pack.lld.md).
> One writer per file per slice; every slice ends `npm run check && npm test` green (exit codes,
> never grep).

## Plane 1 — outside-in (the whole, broken into parts)

The domain: how the agent-admin PRESENTS and WRITES the one persisted catalog selection
(`A2UI_CATALOG_KEY`). Everything downstream of that key — `sanitizeCatalog`'s fail-closed read, the
`agent-admin.ts:1061/1321` wire reads, the runner→produce threading (ADR-0169 cl.4/5) — is
byte-untouched, a non-goal fence, not a part.

1. **Kind + roster projection** (`agent-admin/entries.ts` — the domain layer that STAYS put under
   ADR-0164's pending split) — `ENTRY_KINDS.catalog`; `entries:catalog` joins `initialEntryValues()`;
   the pure read-time projection `readCatalogEntries(store)`: ensure the Default builtin roster row
   (no migration write), then DERIVE every entry's `enabled` from the one persisted key
   (ADR-0170 cl.1/cl.2/cl.4).
2. **Presentation vocabulary** (`agent-admin/entry-list.ts`) — `EntryListOptions` gains optional,
   default-true `customAdd` + `contentField`; suppressed ⇒ no authoring form / no per-entry content
   editor; `mountEntryList`'s signature unchanged (ADR-0170 cl.8, amending ADR-0164 cl.3 additively).
3. **Section wiring + single-select semantics** (`agent-admin.ts`) — the "Catalogs"
   `CAPABILITY_KINDS` row (no master switch — the A2UI surface toggle is the gate, cl.5); catalog-
   specific handlers: toggle-ON writes the key iff registered (unregistered = visible snap-back),
   toggle-OFF-on-active writes the default, delete-active writes the default (cl.3/cl.4);
   re-render subscribed to BOTH `entries:catalog` and `A2UI_CATALOG_KEY`; `data-kind-disabled`
   derives from `SURFACE_A2UI_KEY`; the kind is excluded from `#capabilityGroups`' prompt
   projection (cl.5).
4. **The select retires; the row keeps a mirror** (`agent-admin.ts` + `agent-admin.css`) — the
   Surface Options row's `ui-select` (`agent-admin.ts:577-594`) is removed; a read-only label
   mirror re-derives in `#applyMasterStates` (cl.6). The Catalogs section becomes the ONE writer.
5. **The library pack** (`site/pages/agent-admin-libraries.ts` + the `@agent-ui/app` barrel) — a
   "Registered catalogs" `EntryLibraryPack` mapped LIVE from an import of `A2UI_CATALOG_OPTIONS`
   (browser-importable — no hand-copied trio table, no parity test); generic, never flavored
   (cl.7); the trio law rides `NewEntryInput.id` (ADR-0168 cl.2 / LLD-C7, already shipped).

## Plane 2 — inside-out (the actions each part must support)

| Action | Part |
|---|---|
| read the roster with the Default row guaranteed, no store write | 1 |
| derive every switch's checked state from the ONE persisted key (exactly one ON) | 1 |
| select a registered catalog: toggle ON writes `A2UI_CATALOG_KEY` | 3 |
| refuse an unregistered id VISIBLY: re-render snaps the switch back, key unchanged | 1, 3 |
| toggle the ACTIVE row OFF → selection moves to the Default row (fail-closed surfaced) | 1, 3 |
| delete a non-builtin row; if it was active, the default id is written | 3 |
| render a catalog row as label + description + switch — no content editor | 2, 3 |
| suppress the custom-add form (adds come from the library menu alone) | 2, 3 |
| dim the section while A2UI is off (`SURFACE_A2UI_KEY`, not a per-kind master) | 3 |
| keep catalog OUT of the composed system prompt (`catalogId` is wire, not prose) | 3 |
| show the active catalog's label beside the A2UI toggle, read-only | 4 |
| retire the bare `<select>` — one writer into the key | 4 |
| offer the registered catalogs as library entries, id = registry id, label free | 5 |
| pick up a THIRD registered catalog with zero pack edits (one registry row) | 5 |
| keep every existing wire read byte-identical (`1061/1321` → runner → produce) | non-goal fence (no part — deliberately) |

**Coverage check (both directions):** every Plane-2 action names at least one Plane-1 part (the one
fence row names the ADR's Non-goals, not a gap); every Plane-1 part carries at least one action
(1: roster/derive/snap-back-truth · 2: row-shape/suppression · 3: select/refuse/off-to-default/
delete/dim/prompt-exclusion · 4: mirror/retire · 5: pack/third-catalog). No orphan part, no unhomed
action. Out-of-scope actions (CREATE/authoring affordance, a third catalog, `sanitizeCatalog`/
threading changes, pattern-source D3 changes) are ADR-0170's named Non-goals, not silent gaps.

## Slices (each executable from its enumerated inputs alone; ordering + accept criteria in the LLD §5)

- **S-DOCS** — post-ratification Repairs-row execution (schema doc-comment narrows to the create
  half; ADR-0169 cl.6 REV forward pointer — the ADR-0156 cl.5 shape). Serial, first.
- **S1** — Part 1 + Part 2 (`entries.ts` + `entry-list.ts` + their tests; no consumer change).
- **S2** — Part 3 (`agent-admin.ts`: the row, handlers, masters/dim, prompt exclusion + tests).
- **S3** — Part 4 (`agent-admin.ts` + css: select retirement + label mirror + tests).
- **S4** — Part 5 (barrel export + the site pack + site tests).
- **S5** — integration sweep: the produce-POST-body byte-identical pin, the browser shard, the
  `agent-admin.md` doc row.

Dependencies: S1 → S2 → S3 (SERIAL — S2 and S3 both write `agent-admin.ts`; the one-writer freeze,
the tool-enablement S4/S5 lesson) → S5. S4 needs S1 (imports `ENTRY_KINDS.catalog`) and is
parallel-safe beside S2/S3 (disjoint files: site page + barrel only). Every edge is a real
file/type dependency, not a convention.
