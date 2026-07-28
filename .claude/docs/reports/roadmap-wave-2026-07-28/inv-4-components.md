# Inventory 4 — Component Framework & Pattern Library

Evidence: `.claude/docs/roadmap.md` §2 (2026-07-26 synthesis), 59 `.md` descriptors under
`packages/agent-ui/components/src/controls/*`, `table.md`/`attachment.md` frontmatter, ADR-0161/0162,
GH #315.

## 1 · SHIPPED

Foundation G0–G9 closed, ~56 `ui-*` controls (59 descriptor files incl. compound families:
radio/radio-group, split/split-pane, swiper's 5 parts, toast/toast-region) across
Indicator/Range/Input/Overlay/Container/report/content/feed/chart families. Notable recent adds:
`ui-sandbox-frame` (GenUI containment host), `ui-status-stream`'s receipt pattern (ADR-0159,
proposed), `ui-tabs` `fill` posture (ADR-0144). Theming: `--md-sys-*` consolidation (ADR-0140),
10 live theme packs (ADR-0141), scheme-boundary ink re-root (ADR-0148), one responsive token
(compact-body breakpoint, ADR-0150). Publishing: scoped `@agent-ui-kit/*` on live npm registry,
per-package READMEs, install-from-registry CI smoke, docs site auto-deploys to ui.nonoun.io.
Shared surface today = tokens (`packages/agent-ui/shared/src/tokens/`) + `settings-schema.ts`
only — no other cross-cutting utility layer yet.

## 2 · IN-FLIGHT

- **GH #315 (open, cosmetic)** — `ui-calendar` range mode: adjacent-day endpoints paint as two
  disconnected notches instead of one continuous band at fluid track widths
  (`calendar.css:376-404`, unconfirmed live). Found during #314's binding investigation.
- **ADR-0161 (proposed)** — catalog `value` mark widens to one-or-more slots so `Calendar`
  range (`valueStart`/`valueEnd`) and `SliderMulti` (`valueLo`/`valueHi`) can two-way bind at
  all — today they're read-only via `bindable`, write path is dead. Component-side blast radius
  is near-zero (catalog/renderer contract, not control CSS/DOM) but the two rows' factories move.
- **ADR-0162 (proposed, GH #316)** — GenUI dogfood mode: inline-delivers the docs-page CSS +
  self-defining component bundle into the sandboxed frame (byte-identical off-state) so
  model-authored GenUI markup can use real `ui-*` controls. Demands from `components`: a new
  `dogfood/` sibling under `sandbox-frame/` carrying a committed generated asset module + a
  freshness gate against the real fleet CSS/JS build — a new build-artifact contract this family
  hasn't carried before.

## 3 · CANDIDATE INCREMENTS (grounded in descriptors vs. Kim's SaaS pattern needs)

1. **Table has no interaction contract.** `table.md`: `tier: display`, `extends: UIElement`
   (non-interactive, non-form leaf), `events: []` — literally "no events, no keyboard contract"
   by its own SPEC-R1 comment. Zero selection, sort, filter, or pagination primitives. A
   data-heavy SaaS dashboard's #1 need (context selection/search/filter/pagination on rows) has
   no fleet home today; every consumer hand-rolls it around a static table.
2. **Chart family is two controls deep.** Only `bar-chart` + `sparkline` exist — no line/area
   chart, no pie/donut, no combo/multi-series. Dashboard-shaped SaaS work will hit this ceiling
   immediately outside the two shapes shipped.
3. **No tree/hierarchy control.** No `ui-tree` anywhere in the 59 descriptors; nested nav or
   hierarchical data (org charts, file trees, category drill-down) has no primitive —
   `ui-disclosure`'s recursive nesting (ADR-0143) is the closest analog but is a content
   accordion, not a selectable/keyboard-navigable tree.
4. **No first-class file upload.** `ui-attachment` is a **display-only** card (filename/
   mimeType/size/href, no events) — it renders an already-attached file, it does not accept one.
   No drop-zone, no progress, no multi-file queue control exists.
5. **Date-range is Calendar-mode-only, and its two-way binding is currently broken** (ADR-0161
   above) — no lighter-weight `ui-date-range-field` sibling to `ui-text-field` for a filter bar
   that doesn't want a full calendar popover.
6. **No combo filter-bar/toolbar-with-facets pattern.** `ui-toolbar` exists but per its family
   placement is a layout/action-bar primitive, not a faceted-filter composite; SaaS list screens
   (search + filter chips + sort + view toggle) currently compose this by hand every time.
7. **No CRUD-form scaffolding beyond individual fields.** `ui-form-provider`/`ui-form-popover`
   exist (context + popover-hosted form), but there's no stepper/wizard or inline-edit-row
   pattern — repeated CRUD table-row-edit and multi-step-form needs recur without a shared shape.

## 4 · EDGES — as CONSUMER

- **Shared package is thin.** `packages/agent-ui/shared/src/` = `tokens/` + `settings-schema.ts`
  only; any cross-cutting utility (formatters, id generators, a11y helpers) that multiple
  families would want has no shared home yet and risks per-control duplication as the table/chart
  gaps above get filled.
- **Doc site**: `docs-author` skill + drift-gates exist and are load-bearing (pages derive from
  descriptors) — any new control in §3 inherits that authoring cost, not a free addition.

## 5 · EDGES — as PROVIDER

- **a2ui catalog** is the loudest current waiter: ADR-0161 exists *because* the catalog needs a
  second two-way slot on components this family already ships (Calendar, SliderMulti) — the
  catalog can't move until the component-side factories/rows move with it.
- **GenUI (ADR-0162)** needs a new committed-artifact discipline from this family: an inline CSS
  + JS bundle asset, freshness-gated against the real build, living under `sandbox-frame/`.
- **Shells/agent-admin**: no direct open ask this pass; `ui-tabs` `fill` and `slot="summary"`
  extensions already absorbed their recent needs.
- **SaaS/dashboard patterns** (the "candidate increments" above) are the family's biggest
  external waiter with no ticket yet — table interaction, chart depth, tree, upload, date-range
  field, filter-bar composite are all things a data-heavy SaaS consumer will ask for and find
  absent.
