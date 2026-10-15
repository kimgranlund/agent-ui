# Inventory: SaaS Consumer Patterns + the Workbench (`packages/agent-ui/{components,app}`, `site/`)

## 1 · SHIPPED

- **M-A "SaaS Data Workbench" — 🟢 DONE 2026-08-05**, the whole 2026-07-28 three-milestone arc's
  last leg (`.claude/docs/roadmap.md` §2/§3). Full contract chain: intakes frozen
  ([ADR-0163](../../adr/0163-ui-table-interactive-widening.md) the `ui-table` widening,
  [ADR-0164](../../adr/0164-entry-list-extraction-home.md) the entry-list extraction home, both
  accepted) → PRD accepted (`.claude/docs/prd/saas-data-workbench.prd.md` v0.2, Kim 2026-07-31) →
  SPEC accepted (`.claude/docs/spec/saas-data-workbench.spec.md` v0.1, Kim 2026-08-05, ruling
  PRD-D4/D5/D6) → **MA-1** ui-table widened + `ui-pagination` minted + catalog expression (PR
  #456) → **MA-2** entry-list extraction (PR #459) → **MA-3** the workbench page (PR #463) →
  **MA-4** the pattern-tier rows (PR #464). All four PRs verified `MERGED` via `gh issue/pr view`.
- **MA-1 — `ui-table` widened in place** (ADR-0163's ruled direction, no separate interactive
  tier): selection (native-checkbox semantics, `table` role kept, cl.3), sort (focus preserved
  across commits), one-way-in filter/search, pagination via the new `ui-pagination` control — the
  view pipeline in cl.7's literal order (filter → search → sort → page window); byte-identity
  probe proves the display-only default surface unchanged (cl.10). Catalog: `Table`'s 3-slot
  multi-slot value mark (`selected/select` · `sort/change` · `page/change`), a new `Pagination`
  row, `FEED_EXCLUDED` dispositions (ADR-0163 cl.9, reusing the ratified
  [ADR-0161](../../adr/0161-catalog-multi-slot-two-way-value-marks.md) mechanism — no new
  catalog-mechanism work owed). Files exist and were confirmed on disk:
  `packages/agent-ui/components/src/controls/{table,pagination}/`.
- **MA-2 — the entry-list machinery is consumable AND styled outside `ui-agent-admin`**
  (ADR-0164). New `packages/agent-ui/app/src/controls/entry-list/` (`entry-list.ts` verbatim move,
  `entry-data.ts` the generic core split out, `entry-list.css`, plus a standalone browser smoke
  asserting real computed style with zero `ui-agent-admin` in the tree) — confirmed present on
  disk. Three new subpaths (`./entry-list`, `./entry-list.css`, `./entry-data`); agent-admin's own
  27 pre-existing test cases repointed, not duplicated; the `@scope` proximity risk (ADR-0164 cl.4,
  the R1 cascade risk) triggered for real during the build and was fixed (shared
  `--ui-agent-admin-*` tokens reverted to direct `--md-sys-*` expressions + an `@import` bridge) —
  the agent-admin visual/computed-style suites are what caught it, run to green.
- **MA-3 — the workbench page, composed entirely from published fleet primitives** inside
  `ui-workspace-shell`: the widened `ui-table` + `ui-pagination`, a `ui-form-popover` facet toolbar
  (PRD-D3's ratified vehicle — `ui-menu` was disqualified on mechanics: it closes on every commit,
  `menu.ts:318`), a `ui-modal` record-edit flow (PRD-D6's ruling over `ui-master-detail`, argued
  from both controls' real `.md` descriptors), and a **recorded** agent summary via
  `ui-surface-host` (PRD-D4/D5: validator-passing A2UI JSONL fixtures keyed to view state, a probe
  driving between 2 keys and asserting the current-key match). Every PRD §4 fence was
  probe-proven, not merely asserted: a real fetch/XHR spy for the zero-network non-goal, a seeded
  scalar fixture + in-session `createMemoryStore` persistence stated on the page, the page's own
  sheet declaring no shell-frame rules and joining the AC19 spacing-drift gate (PRD-D7's one
  reviewed append). Site page confirmed at `site/pages/workbench.ts` (+ `workbench-data.ts`).
- **MA-4 — the pattern tier**: two new `agent-ui-composition-patterns` SKILL.md rows (the
  data-table-toolbar pattern, the record-CRUD-loop pattern), each citing real `site/pages/
  workbench.ts` symbols at real lines (grep-confirmed at `.claude/skills/
  agent-ui-composition-patterns/SKILL.md:36-37`) — the **S9 exemplar-path gate**
  (`site/lib/docs-grammar.test.ts`, minted this wave per SPEC-R11 because the pre-existing S3
  sweep structurally cannot fire on backticked bare paths, GH #321) sweeps them, proven RED on a
  planted bogus path and GREEN on revert. ADR-0164 cl.5's two rows (the schema-driven settings
  page, the resource-list manager) verified pre-existing from MA-2, not re-minted.
- **A same-day citation self-correction, already landed.** MA-4's own skill-checker caught row 37
  citing ADR-0164 cl.3 (the frozen `mountEntryList` interface) as owner of the workbench's
  store/validation mechanism, when `workbench.ts` never imports `mountEntryList` — the real
  mechanism is `createMemoryStore` (ADR-0120/0158). GH #465 tracked the same misattribution
  surviving in two spots the campaign correctly didn't touch un-sanctioned: the **ratified** SPEC
  prose (`saas-data-workbench.spec.md:245-246`) and a `workbench-data.ts` code comment. Both are
  now fixed — PR #467 ("Fixes #457, Fixes #465"), confirmed `MERGED` — so the SPEC text read at
  authoring time already carries the re-home ("citation re-homed 2026-08-05 per GH #465"). GH #457
  (a SPEC-R1 prose ambiguity on `sortable`/`searchable` defaults — code was already correct,
  ratified-doc wording wasn't) closed in the same PR.
- **Size discipline held, argued not absorbed** (PRD-G6/SPEC-R13). MA-1's re-base was ruled by Kim
  as "checkpoint not ratchet" (GH #445 findings) — a follow-up diet issue (GH #455) and a
  pre-existing/unrelated `@agent-ui/app` budget breach (GH #454) were both spawned as
  follow-up-sized, non-blocking tracking issues and are **now closed** (verified via `gh issue view
  --json state`) — closed after `roadmap.md`'s own 2026-08-05 synthesis-pass prose still listed
  them as open, i.e., the roadmap's issue list went stale within the same day it was written (the
  doc's own §1 law: "this doc never enumerates issues by number, because that list goes stale the
  moment an issue closes" — proven true within hours here).
- **Composition-inventory non-gaps, checked and recorded** (PRD §5) — worth carrying forward
  because a later seat should not re-derive them: the record-edit vehicle choice was a composition
  decision, not a missing primitive (`ui-master-detail` and `ui-modal` both shipped pre-M-A); the
  A2UI expressibility of a widened table needed no new catalog mechanism (ADR-0161's multi-slot
  mark already existed); minting `ui-entry-list` as an element was explicitly out of scope
  (ADR-0164 cl.3 froze the mount-function shape).

## 2 · IN-FLIGHT / OPEN

- **No next milestone is ruled.** `roadmap.md` §2 (2026-08-05 sweep): "the lane is open for the
  next intake, which is Kim's call — the parked scope intakes (§3 foot) and the deferred items
  (§4) are the standing candidates." M-A closing does not by itself commit to a next SaaS-shaped
  wave.
- **Per-control catalog intake — ruled "now" but not yet this inventory's concern to verify done**:
  five newer controls (`ui-status-stream`, `ui-toast`, `ui-command-modal`, `ui-textarea`,
  `ui-theme-provider`) landed after the A2UI catalog's 56 types with no recorded in/out decision;
  Kim ruled 2026-07-28 to close the drift with one small pass. Not workbench-specific, but touches
  the same catalog surface MA-1 widened.
- **AC19's sheet set — an explicitly open, per-sheet, never-automatic decision** (`roadmap.md`
  §3). The workbench page's sheet and `entry-list.css` both joined this wave (PRD-D7, ADR-0164
  cl.4) — that is now settled for those two sheets specifically — but the general question of
  extending AC19 to the remaining components-package/site sheets stays open, exactly as it was at
  the 2026-07-28 shell inventory.
- **Bespoke per-persona A2UI catalogs (GH #421, still OPEN)** and **MCP client adoption (GH #438,
  still OPEN, deferred by ADR-0168)** — both verified open via `gh issue view`, neither
  workbench-specific but both live in the same "what's next" pool `roadmap.md` §4 names.

## 3 · STILL MISSING — SaaS-consumer patterns after M-A

The PRD's own §4 non-goals and §5 composition inventory are the authoritative fence list; this
section restates what a *real* consumer app (not the proof page) would still lack, each cited to
where the fence lives so a future intake doesn't have to re-derive it:

1. **Multi-select / association fields — the recurring, twice-fenced gap.** The FACE control suite
   has **no multi-select field**: every shipped picker binds one scalar value (PRD §5, "Checked and
   found NOT to be gaps"). This is named as literally the same missing primitive from two angles —
   PRD-D3's filter-facet gap (no fleet control emits a multi-VALUE facet set as one value) and the
   record-edit side (no "assign dataset to account", no to-many linking field). The 2026-07-28
   inv-6-saas.md inventory flagged it independently twice too (§1d, §2d: "no association/
   relationship UI," "no association/multi-select-linking pattern") — so this is the fourth
   independent citation of the same hole across two inventory waves. **There is no separate GitHub
   Issue or PRD filed for it as its own re-entry intake as of this sweep** (`gh issue list --search
   "association"/"multi-select"` returned no matching open item) — the PRD/SPEC instead fence it
   out explicitly: PRD §4 "No new multi-select control... a new primitive earns its own ADR, not a
   rider on a demo" / §9 "If that fence is ever overturned and a multi-select primitive is minted,
   **that** earns its own intake and its own ADR; it does not ride this wave." The mechanism that
   *would* re-open it is named (SPEC-N3/PRD-D3's honest residual: "closing it for the CSS-less
   consumer is its own future intake"), but as of 2026-08-05 that intake has not been filed.
2. **The page-side facet-aggregation glue is not CSS-less-consumer-safe** (PRD-D3's honest
   residual, SPEC-N3). `ui-form-popover` + a checkbox group narrows the gap but doesn't close it:
   the N-commits→one-`{key,values[]}`-entry aggregation happens in page JS, so an A2UI-only
   (CSS-less) agent consumer can *emit* a facet filter but cannot hand a user a facet picker that
   composes one on its own. This is the same fence as #1, named from the ADR-0102 CSS-less-consumer
   angle.
3. **Zero-result filter silence — a recorded, not-yet-fixed residual** (ADR-0163 cl.2, carried by
   PRD §5/SPEC-R7). A zero-result filter renders an honest empty `<tbody>` and announces nothing
   (v1 fence). The workbench toolbar's mitigation is a **visible results count** only — no
   `aria-live` region — named explicitly as "the named foreseen extension, not this wave's work."
4. **No bulk-action bar** (PRD §4/SPEC-N8). Selection is read-out only (`selected`/`select` event,
   optionally described by the summary card) — never acted on. No delete-selected, batch edit, or
   contextual action bar on selection. Explicitly fenced as "a destructive-affordance design
   problem... a product decision, not a demo rider."
5. **No data-fetching/transport/backend layer, no persistence beyond the session**
   (PRD-D2/SPEC-N1/N2, ratified, deliberate). A real consumer app needs both; M-A's fixture +
   `createMemoryStore` are explicitly a proof vehicle, "the honest cost — a reload discards edits —
   is stated on the page rather than hidden behind fake durability."
6. **Filter operators beyond the facet shape stay fenced** (ADR-0163 cl.1, carried by SPEC-N7):
   ranges, comparisons, per-cell expressions, an in-table query input, column resizing, cell
   renderers, interactive chips, editable cells. "The fence moved once, deliberately and by exactly
   four admissions; a workbench build is precisely the pressure that erodes it by drive-by."
7. **No dashboard/chart-composition surface** — carried unchanged from the 2026-07-28 inv-6
   finding and explicitly out of M-A's scope (PRD §4: "a fifth [part] is a rider," ADR-0107 line/
   area/pie/axis charts still deferred). The stat+chart+table+agent-summary dashboard shape named
   in inv-6 §2a/candidate #2 was **not** what M-A built — M-A built the table+toolbar+edit+summary
   shape instead, so the dashboard-page gap from the prior wave is unchanged, not retired.
8. **No virtualization / no row-cap change** (ADR-0163 cl.10, report-family SPEC's posture, carried
   verbatim). Pagination is the wave's whole answer to scale.
9. **No router-integrated multi-page SaaS shape.** SPEC-N9/PRD §4: the workbench is one page,
   section switching is local state, `app` never imports `router` (ADR-0115). A real SaaS consumer
   with multiple routed data-views (list page, detail page, settings page as separate routes) still
   gets zero help from a shell+router integration — this is the same edge the 2026-07-28
   inv-5-shells.md inventory already named at its §3.7/§4 ("tab-strip content ROUTING... currently
   structurally absent").
10. **The workbench frame stays host-authored, not agent-emittable** (SPEC-N5). An agent can only
    write into the one `ui-surface-host` summary region; a "let an agent lay out its own SaaS
    workspace" pattern is explicitly fenced as a security inversion, unchanged from
    `agent-app-surfaces.prd.md`'s PRD-D2 boundary.

## 4 · CANDIDATE INCREMENTS (grounded)

1. **File the association/multi-select re-entry intake.** Named as its own future intake by both
   the PRD (§9) and the SPEC (SPEC-N3) but not yet filed as a GitHub Issue or PRD as of this sweep
   — the single most-cited recurring gap (§3.1 above, four independent citations across two
   inventory waves). Filing it does not commit to building it; it converts a fence-with-a-named-
   trigger into a tracked, re-discoverable item instead of prose buried in two ratified documents.
2. **Close the zero-result `aria-live` gap** (§3.3) — small, additive, doesn't touch the ratified
   fence line, and the workbench is now the first real surface where the silence is user-visible
   (PRD §5's own framing).
3. **A dashboard-page composition** (§3.7) — the 2026-07-28 inv-6 candidate-slice #2 that M-A did
   not build. All the primitives it needs already ship (`ui-stat`, `ui-bar-chart`/`ui-sparkline`,
   `ui-table`, the A2UI agent-summary seam M-A just proved) — this would be a composition-tier
   effort in the same shape as MA-3, not a new component build.
4. **A router-integrated multi-view SaaS shell demo** (§3.9) — the first time `app` would need
   `router`, which both inventories (this one and the prior shells inventory) flag as a deliberate,
   not-yet-crossed layering line, not a bug.
5. **Widen AC19's sheet set beyond the shell family + the two just-added sheets** — an explicitly
   open, per-sheet decision (`roadmap.md` §3), unchanged in status by M-A.
6. **A CSS-less-consumer-safe facet picker** (§3.2) — closing PRD-D3's own named residual would let
   an A2UI-only agent hand a user a working multi-value filter, not just emit one; PRD-D3's own text
   names this as "a new intake and its own ADR" if it becomes a real ask.

## 5 · CROSS-SYSTEM DEPENDENCIES

- **`app` ← `components`**: MA-3's workbench page depends on MA-1's widened `ui-table` +
  `ui-pagination` and MA-2's extracted entry-list machinery landing first — the PRD's own
  decomposition manifest (`ma-data-workbench.decomp.json`) gates MA-3 on both plus the SPEC (the
  t19→t12 edge); MA-1 and MA-2 themselves were fully independent, disjoint file sets, and dispatched
  concurrently.
- **`app` → `a2ui`**: the agent-summary part (PRD-D4/SPEC-R9) depends on `ui-surface-host`'s
  published mount/stream seam (ADR-0129 cl.1) and the `@agent-ui/a2ui/agent` recorded-transport
  precedent (ADR-0137) — the same producer toolkit the shell/agent-admin work already exercises
  live; the workbench uses only the recorded half (PRD-D5).
- **`a2ui` catalog ← `components`**: the widened `Table`'s 3-slot value mark reuses
  [ADR-0161](../../adr/0161-catalog-multi-slot-two-way-value-marks.md)'s mechanism, already
  ratified from a prior wave — no new catalog primitive was needed, only a new consumer of an
  existing one.
- **`app` never imports `router`** (ADR-0115) — explicitly held through this wave (SPEC-N9); any
  future routed multi-view SaaS shape (§3.9/§4.4 above) would be the first time this layering line
  is tested for `app`, same as the prior shells inventory flagged for the shell family generally.
- **`agent-ui-composition-patterns` skill ← the workbench page**: MA-4's two new rows and ADR-0164
  cl.5's two rows all cite `site/pages/workbench.ts` or agent-admin as their exemplar — the skill
  is now load-bearing documentation-as-contract for the S9 gate (`site/lib/docs-grammar.test.ts`),
  meaning any future refactor of `workbench.ts` that moves the cited symbols/lines would need a
  coordinated skill-row update or S9 goes red.
- **`ui-agent-admin` ← MA-2's extraction**: agent-admin is now a **consumer** of the extracted
  entry-list subpaths rather than the sole owner — its own 27 pre-existing tests are the
  regression backstop for the `@scope` proximity risk (ADR-0164 cl.4); any future change to
  `entry-list.css`'s scope root re-triggers that same risk.

## 6 · RISKS

- **The association/multi-select gap is now cited four times across two inventory waves without a
  tracked intake** (§3.1/§4.1). Each citation adds confidence it's real demand, but confidence
  buried in ratified-doc prose is not the same as a re-discoverable backlog item; the risk is a
  fifth wave re-deriving the same finding from scratch.
- **The roadmap's own issue-number prose goes stale fast, proven again this sweep.** `roadmap.md`
  §2's 2026-08-05 synthesis line still names #457/#455/#454 as "open... none blocking" — all three
  were independently verified `CLOSED` via `gh issue view` at the time of this inventory, hours
  after the roadmap prose was written. Not a defect in the doc (its own §1 states issues are
  deliberately not tracked by number here), but a trap for any reader treating the roadmap's issue
  list as current without re-checking `gh`.
- **The facet-aggregation glue (§3.2) is a standing CSS-less-consumer debt.** ADR-0102's law says a
  capability needing consumer glue "effectively doesn't exist" for the primary (agent) consumer;
  PRD-D3 narrows this without closing it. Any future GenUI/A2UI surface that tries to reuse the
  workbench's toolbar pattern verbatim inherits this same debt silently unless the pattern-tier row
  states it (it currently does, in SKILL.md's own residual note — worth re-verifying it stays
  stated if that row is ever edited).
- **Size re-base discipline depends on the diet follow-up actually landing.** GH #455 (the
  post-MA-1 size-diet checkpoint) is closed, but this inventory did not verify *what* it shipped
  (only that the issue is closed) — worth a `gh pr list --search 455` check before assuming the
  table marginal actually trended down rather than the issue being closed as won't-fix.
