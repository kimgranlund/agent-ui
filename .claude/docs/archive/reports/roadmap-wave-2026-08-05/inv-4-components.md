# Inventory 4 — Component Framework & Pattern Library

Evidence: `.claude/docs/roadmap.md` §2 (2026-08-05 sweep), ADR-0163 (accepted), 61 `.md` descriptors
under `packages/agent-ui/components/src/controls/*` (58 folders, 3 internal `_base`/`_surface`/
`_token-surface` bases carry none by design), GH #455/#468/#457/#465/#454/#421/#438 (`gh issue view`,
2026-08-05), `node scripts/measure-size.mjs` (live run, 2026-08-05).

## 1 · SHIPPED

Foundation G0–G9 still closed and not actively growing (per roadmap.md §2: "Component
foundation — complete"). Since the 07-28 snapshot, the headline component-side event is **MA-1**,
now fully merged and closed out:

- **ADR-0163 (accepted, ratified 2026-07-29)** — `ui-table` widens IN PLACE on its ratified
  display-only contract: opt-in row **selection** (`single`/`multi`, native checkbox/radio column —
  the fleet's one sanctioned native-form-element exception, cl.3), per-column **sort**,
  **filter/search** state, and **pagination** composition, all default OFF. Landed across
  `controls/table/{table.ts,table.css,table.md,table-model.ts}` + new `controls/table/table-view.ts`.
  Git history: `6fa8a22` (widen ui-table) → `49ff69a` (mint ui-pagination) → `ce0530a`/`d8a2a25`
  (review fixes) → `09f2e4d` (size diet, GH #455).
- **`ui-pagination` — minted, new control** (`packages/agent-ui/components/src/controls/pagination/`:
  `pagination.ts`, `pagination-model.ts`, `pagination.css`, `pagination.md` + descriptor/model/css/
  browser test files). Tier `pattern` (no control-height row of its own — composes `ui-button` for
  every stop, ADR-0163 cl.6, "the novelty is zero"). `page`/`pages`/`label` props, one `change`
  event, `prev`/`next`/`page`/`ellipsis` parts, `role=navigation` via internals, no roving
  tabindex — N independent focusable buttons, not one composite widget.
  `pagination.md` and `table.md` both confirm the contract↔props trip-wire
  (`*-descriptor.test.ts`) is live for both controls.
- **Size checkpoint re-based and closed as a checkpoint, not a ratchet.** GH #455 ("ui-table size
  diet — shrink the interactive arm below the re-based 2.6k marginal") is **CLOSED**: the same-day
  shrink pass (`09f2e4d`) consolidated the three `<th scope="col">` builders into one helper, folded
  three array-hardening loops into one `hardenArray`, merged two delegated `change` listeners into
  one, and shared the two selection-toggle commits' write+emit path — table marginal went
  2558 → 2517 B gz against a 2624 B gz cap (verified live via `measure-size.mjs`, 2026-08-05:
  `table marginal 2517 B gz — within budget 2624 B`). GH #468 ("@agent-ui/app size diet... post-#454")
  is **OPEN** — that's the sibling app-level budget, not a components-fleet issue (see §4). GH #457
  (SPEC-R1 sortable-default prose bug) and GH #465 (ADR-0164 cl.3 misattribution) are both
  **CLOSED**, doc-only prose fixes, no component-code change.
- **Live size snapshot (2026-08-05, `node scripts/measure-size.mjs`):** components family barrel
  `51125 B gz` (within 51200 B gz cap); `table` marginal `2517 B gz` (within 2624 B gz checkpoint
  cap — "the cap is a checkpoint, not a ratchet... the next honest shrink continues from here");
  `pagination` marginal `23 B gz` (within 2048 B gz, essentially free — its bulk rides inside the
  already-budgeted `ui-button` it composes); `status-stream` `2129 B gz` (within a bumped 2192 B
  cap — override notes this bump traces to the *same* MA-1 family-bundle growth, source untouched).
- Everything else from the 07-28 snapshot still holds: ~56+2 `ui-*` controls (now 58 folders
  including `pagination`), theming consolidation (ADR-0140/0141/0148/0150), scoped `@agent-ui-kit/*`
  npm publishing, docs site auto-deploy.

## 2 · IN-FLIGHT

- **GH #315 (table-family, cosmetic)** — status not re-verified this pass; carried over from
  07-28 as `ui-calendar` range-mode notch rendering, unrelated to the table/pagination work.
  (Not re-confirmed via `gh issue view` this sweep — flag for re-check, not re-asserted as open.)
- **ADR-0161 (catalog multi-slot value marks)** — still the a2ui-side dependency table/pagination's
  sibling controls (Calendar/SliderMulti) wait on; not itself a components-family task.
- No open components-scoped GitHub issue remains from the MA-1 wave — #455/#457/#465/#454 are all
  CLOSED. The only open issues touching this family's neighborhood are #468 (app-level size diet,
  not components), #438 (MCP client, size:big, deferred by ADR-0168, lives in `tools/agent/` not
  `components`), and #421 (per-persona A2UI catalogs, size:big, a2ui/agent-admin scoped).

## 3 · CANDIDATE INCREMENTS (re-verified against today's tree)

Most of the 07-28 candidate list is **unchanged** — MA-1 filled the "table has no interaction
contract" gap (#1 on the old list) but did not touch the others:

1. ~~Table has no interaction contract~~ — **RESOLVED by ADR-0163/MA-1.** Selection, sort,
   filter/search, and pagination are now real, shipped, tested (`table-interactive.browser.test.ts`,
   `table-byte-identity.test.ts`) capabilities. This item drops off the candidate list.
2. **Chart family is still two controls deep.** `bar-chart` + `sparkline` only — confirmed still
   the full chart roster in `controls/`. No line/area/pie/donut/combo chart exists.
3. **Still no tree/hierarchy control.** No `ui-tree` in the 58-folder roster. `ui-disclosure`'s
   recursive nesting remains the closest analog (content accordion, not a selectable/
   keyboard-navigable tree).
4. **Still no first-class file upload.** `ui-attachment` remains display-only (filename/mimeType/
   size/href, no events). No drop-zone/progress/multi-file-queue control.
5. **Date-range is still Calendar-mode-only** — no lighter `ui-date-range-field` sibling to
   `ui-text-field`. ADR-0161 (the write-path fix for Calendar's `valueStart`/`valueEnd`) is still
   proposed, unmerged.
6. **Still no combo filter-bar/toolbar-with-facets composite.** `ui-toolbar` remains a layout/
   action-bar primitive; SaaS list screens (search + filter chips + sort + view toggle) still
   compose this by hand. Table's new column-level `filter`/`search` state (ADR-0163) is a first
   building block a fleet-level filter-bar pattern could sit on top of, but nothing does yet.
7. **Still no CRUD-form scaffolding beyond individual fields** (stepper/wizard, inline-edit-row).
8. **NEW candidate this pass — `ui-pagination` is currently table's only consumer.** It's a
   general-purpose standalone control (`tier: pattern`, zero table-specific coupling in its own
   API), but nothing in the fleet or site demos wires it to another paginated surface (a list,
   a card grid) yet — worth flagging as a "prove the general case" follow-up before calling the
   control's design validated beyond its one shipped use.
9. **Size-diet discipline is now a standing pattern worth generalizing.** GH #455's fix shape
   (shared helper extraction, one delegated listener, `hardenArray` consolidation) reads as a
   reusable playbook for the NEXT control that grows past its per-control 2048 B gz default cap —
   worth a short note in `agent-ui-component-standards` if this recurs a third time (it has now
   happened at least twice: `split`/`swiper` carry similar "gzip measurement-frame drift" override
   footnotes in the size report).

## 4 · EDGES — as CONSUMER

- **Shared package is still thin** — unchanged from 07-28: `packages/agent-ui/shared/src/` =
  `tokens/` + `settings-schema.ts` only. Table's new `hardenArray`/cell-resolution helpers
  (`table-model.ts`) are table-local; if chart/tree/upload land next and want similar array-
  hardening or id-generation utilities, there's still no shared home.
- **Size-budget process is now load-bearing and visibly active.** The MA-1 wave shows the pattern
  in practice: ship a widening → measure real bytes → open a same-day "shrink the checkpoint"
  issue (#455) rather than silently raising the cap → close it with a real diet pass. `@agent-ui/app`
  is mid-cycle on the identical pattern right now (#454 closed the re-base, #468 open as the
  standing diet) — this is a process this family should expect to repeat for every future
  interactive-capability widening, not a one-off.
- **Doc site / descriptor cost**: unchanged — `docs-author` + drift-gates still apply to any new
  control; `table.md`/`pagination.md` both show the current descriptor depth bar (60-line+ prose
  fences with inline SPEC/ADR citations) new controls are held to.

## 5 · EDGES — as PROVIDER

- **a2ui catalog** — `ADR-0163`'s own header lists the `Table` row's catalog marks changing
  (`catalog.json`/`factories.ts`) plus a **new `Pagination` row** and a `feed-catalog.ts`
  disposition decision — this already landed as part of the same ADR/PR wave, so the catalog is
  caught up with the widened table/new pagination control as of this snapshot (unlike the 07-28
  gap, which was still calling this future work).
- **ADR-0161** is still the loudest open a2ui-side waiter — Calendar/SliderMulti two-way binding
  is still dead until the catalog value-mark widens; unrelated to table/pagination specifically.
- **Shells/agent-admin** — no direct new components-side ask surfaced this pass.
- **SaaS/dashboard patterns** — table's interaction gap (the biggest single item on 07-28's
  candidate list) is now closed; the remaining candidates (chart depth, tree, upload, date-range
  field, filter-bar composite, CRUD scaffolding — §3 above) are unchanged and still the family's
  biggest external waiter with no ticket filed yet.
