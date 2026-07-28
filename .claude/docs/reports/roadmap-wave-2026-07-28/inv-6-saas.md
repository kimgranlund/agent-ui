# SaaS UI Patterns — foundations vs gap

## 1. Foundations that exist

**(a) Admin dashboards (data-heavy + LLM summary)**
- Chart family shipped: `ui-bar-chart` (axis-free horizontal bars, display-tier) + `ui-sparkline` (inline series shape) — `packages/agent-ui/components/src/controls/{bar-chart,sparkline}/*.md`; ADR-0107 scoped v1 deliberately narrow (no line/pie/axis charts).
- `ui-stat` (label/value/delta/caption KPI tile, display-tier) — `.../controls/stat/stat.md`.
- `ui-status-stream` (live streaming work-log strip, ADR-0122) — the closest thing to an "activity feed."
- LLM-summarized content: `@agent-ui/a2ui/agent` producer toolkit (`buildSystemPrompt`/`produce`) + `ui-markdown` render agent-common markdown — proven path for agent-generated prose panels, not yet wired to a dashboard card.

**(b) Admin UI patterns (workspaces, settings, configs, tools/services/resources)**
- `ui-super-shell` + `ui-workspace-shell`/`ui-chat-shell` presets (ADR-0151/0154/0155/0156) — real shell archetype with nav-pane/section-nav/options-pane slots.
- `agent-admin` (`packages/agent-ui/app/src/controls/agent-admin/`) is a live proto-pattern for exactly this: a config+settings surface composed from `ui-settings` (generated form fields, SPEC-R11) + a generic **ordered-entry-list primitive** (`entries.ts`/`entry-list.ts`, ADR-0132) reused verbatim across 5 resource kinds (prompt sections, skills, workflows, resources, tools) — each entry: toggle + editable content (`ui-code-editor`), shared add-form with validation. This is a real "manage a list of named resources" pattern, generalizable beyond agent-admin.
- `ui-settings` exists as its own control (generated fields from a schema) — settings-page primitive.

**(c) Data UI patterns (tables, selection, search, filter, pagination)**
- `ui-table` (ADR-0004/LLD-C9) — real native `<table>`, typed columns+rows, scroll region, caption/aria — but explicitly **static/display-only**: "tier: display... no events, no keyboard contract... cells/rows never focusable" (`table.md`). No sort, no row-selection, no built-in filter/search, no pagination.
- `ui-combo-box` (form-associated, overlay-backed, ADR-0043) — nearest thing to a filterable-select/typeahead; not wired to a table.
- `ui-command-modal` — command-palette-style filtered list (search-as-you-type pattern) — closest existing "search + filter a list" mechanism, but modal-scoped, not an inline data-grid filter bar.
- No `pagination` control exists anywhere in `packages/agent-ui` (grep hits are `swiper-pagination` dots, unrelated) — pagination is 100% unbuilt.

**(d) Data CRUD (create/edit/associate records)**
- Form spine is solid: `ui-form-provider` (registry) + `ui-field` (labelling/errors) + full FACE control suite (text-field, select, combo-box, checkbox, radio, textarea, color-picker, calendar, slider, etc.) — ADR-0050/0051, documented in `agent-ui-composition-patterns` skill's routing table.
- `ui-settings`'s generate.ts derives a whole editable form from a schema (SPEC-R11) — a real schema→form CRUD pattern, currently scoped to agent-admin's config, not generalized as a public recipe.
- `entry-list.ts`'s add/edit/delete/toggle flow is a working micro-CRUD loop (create + soft-delete + edit-in-place) for one entity shape — proto-pattern for "associate/manage a set of typed records," not yet abstracted for arbitrary domain entities (accounts, datasets).
- No association/relationship UI (e.g., "assign dataset to account", multi-select linking) exists yet.

## 2. The gap

**(a) Admin dashboards**
- COMPONENT: no line/area/pie/donut chart, no axis/legend/tooltip chart (ADR-0107 deliberately deferred these); no "activity feed" / timeline-with-avatars display component beyond `ui-status-stream`.
- PATTERN: no documented "dashboard grid" composition (KPI row + chart + table layout recipe); no LLM-summary-card recipe (agent output → `ui-stat`/prose panel).
- PAGE: no site demo dashboard page combining stat+chart+table+agent summary.

**(b) Admin UI patterns**
- COMPONENT: none obviously missing — shell+settings+entry-list cover the shape.
- PATTERN: agent-admin's schema→form and entry-list mechanisms are agent-admin-local, not published as a reusable composition-patterns row ("how to build a settings page," "how to build a resource-list manager").
- PAGE: no generic "workspace settings" site demo independent of agent-admin's specific domain.

**(c) Data UI patterns**
- COMPONENT: biggest real gap — no sortable/selectable table (ui-table is deliberately display-only), no pagination control, no filter/search bar component, no row-selection/checkbox-column pattern.
- PATTERN: no documented "data table + toolbar (search/filter/paginate)" recipe at all.
- PAGE: no site demo of a data-grid workflow.

**(d) Data CRUD**
- COMPONENT: none missing at the field level — form suite is complete.
- PATTERN: no documented generic "record CRUD" recipe (list → detail/edit → save, with validation) generalized beyond agent-admin's specific 5 entry-kinds; no association/multi-select-linking pattern.
- PAGE: no site demo of an account/dataset CRUD flow.

## 3. Candidate first slices (ordered by foundation reuse)

1. Generalize `entry-list.ts`'s toggle+edit+add/delete mechanism into a documented CRUD recipe (reuses form spine + entry-list, zero new components).
2. Ship a "dashboard page" site demo composing `ui-stat` + `ui-bar-chart`/`ui-sparkline` + `ui-table` + an agent-summarized text panel (exercises charts + a2ui agent + table + shell at once — the dogfood pick).
3. Add a data-table toolbar recipe: `ui-combo-box`/`ui-text-field` (search) + `ui-segmented-control` (filter chips) driving client-side row filtering over `ui-table`'s rows prop (pattern-tier, no new component).
4. Build `ui-pagination` (new component; smallest net-new primitive, unlocks table/list workflows fleet-wide).
5. Extend `ui-table` (or a new `ui-data-table`) with row-selection (checkbox column + selected state) — component-tier, since ADR-0004/LLD-C9 fixed the static contract.
6. Document a generic "settings page" composition-patterns row from agent-admin's `ui-settings` generate.ts pattern (pattern-tier only).
7. Add row-sort affordance to a data-table variant (click header → sort) — component-tier follow-on to #5.
8. Ship a CRUD site demo (accounts or datasets) using #1's recipe + #3/#4/#5 once they exist — proves the whole layer end to end.

## 4. Edges — as CONSUMER (asks on other layers)

- Charts (components): a line/area chart is the most commonly requested dashboard primitive and ADR-0107 explicitly deferred it — ask for scope expansion or a documented "no line chart yet" stance before dashboards get built.
- Table/data-grid (components): needs sort/select/pagination — ui-table's ADR-0004/LLD-C9 contract is display-only by design; extending it (or forking a new tier) is a design-intake decision, not a drive-by edit.
- Shells (app): workspace/admin pages need `ui-super-shell`/`ui-workspace-shell` slot conventions confirmed for a "content = data table + toolbar" region — untested combination.
- A2UI/GenUI: LLM-summarized dashboard content needs a settled "agent writes into a display card" contract (payload → ui-stat/ui-markdown) — currently ad hoc.
- agent-admin: entry-list/settings mechanisms are agent-admin-local files (`app/src/controls/agent-admin/`), not exported as reusable primitives — an ask to extract them into a shared location before other SaaS-layer surfaces can reuse them without copy-paste.

## 5. Edges — as PROVIDER (what agent-admin could re-host)

- The generic entry-list primitive (toggle/edit/add/delete over typed entries) is domain-agnostic already — agent-admin could re-host it FROM a shared SaaS-patterns location instead of owning the only instance.
- The `ui-settings` schema→form generator is reusable for any config surface — same re-hosting opportunity.
- agent-admin's `ui-chat-shell` + options-pane composition is a proven workspace-shell wiring agent-admin could point to as the canonical example once documented at the pattern layer.
