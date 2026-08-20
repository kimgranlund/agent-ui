# FINDINGS index — data-model review 2026-08-20

> Kim's charter: "review our underlying data model/store, data workflows, context providing,
> signals, etc. there seems to be a mix of implementations now, and it is evident in how
> agent-admin-app is implemented." Motivating symptom: the header agent-select stuck on
> "New agent 48" while the Settings panel's Name field says "Wrench".
>
> Method: four parallel read-only investigations — framework kernel idioms, data+persistence
> seams, the agent-admin-app audit, and the concrete bug trace. Slice reports in this directory;
> every claim carries file:line citations verified against main at read time.

## Verdict

**Kim's read is correct, and it has a precise shape.** The kernel and per-component layers are
clean and coherent (signals, props-as-signals, scoped effects — no bypass violations found).
The mix lives one level up, and it is not random drift — it is two structural causes:

1. **The framework never sanctioned a general context/shared-state mechanism.** ADR-0050 built
   the first provider primitive (forms) and named its own re-evaluation trigger — "a second
   context consumer appears → re-evaluate the community `context-request` protocol" — and that
   trigger was never pulled. Every app-tier feature since has rolled its own propagation
   pattern, because there was never a second sanctioned option to converge on.
2. **agent-admin-app is four stacked generations of state pattern**, each added for a feature
   without retrofitting the ones underneath (Gen 1 reactive SettingsStore → Gen 2 hand-rolled
   Persona roster on raw localStorage → Gen 3 imperative-DOM + push-snapshot roster seam →
   Gen 4 StorageAdapter tier). The name bug is exactly a Gen 1 fact and a Gen 2/3 fact both
   called "name," never wired to each other — with a second live instance of the same defect
   class already present (Team pane GM line).

Meanwhile the layer that WAS built to be the answer — `@agent-ui/data` (ADR-0192) — has zero
real consumers, and `StorageAdapter` (ADR-0193), which IS genuinely adopted, still has six
site-level bypasses including the app's most central state (the persona roster).

## Findings

| # | Finding | Severity | Where |
|---|---|---|---|
| F1 | Two never-synchronized "agent name" identities: `Persona.label` (roster) vs `store.get('name')` (config). Zero code path writes both; they seed from different defaults at mint and never converge. THE reported bug. | HIGH (live, user-visible) | select-menu-name-bug.md · agent-admin-app-state-audit.md §sync-1 |
| F2 | Second live instance of the F1 class: Team pane `nameFor()` reads the same stale `#pendingRoster` label snapshot — rename via Settings shows the old name in "GM: …" lines | HIGH (live, user-visible) | agent-admin-app-state-audit.md §sync-2 |
| F3 | No general context-providing protocol in the framework; three unrelated point solutions (ADR-0050 event-registry / ADR-0051 direct signal push / ADR-0117 CSS cascade). ADR-0050's own named re-evaluation trigger never pulled when the second provider shipped. | SYSTEMIC (root cause of the mix) | framework-state-idioms.md §context-verdict, §gap-1 |
| F4 | `@agent-ui/data` (ADR-0192) built-but-unadopted: zero real consumers of `DataSource`/`resource()`/`mutation()`/`paginated()`/gateway anywhere; only the `./stream` NDJSON hoist has real users | SYSTEMIC (dead weight or unrealized plan) | data-persistence-layers.md §adoption-verdict |
| F5 | The persona roster — the app's most central state — still on raw pre-ADR-0193 localStorage (`agent-admin-presets.ts`), sitting beside three sibling stores that use the sanctioned StorageAdapter seam | MEDIUM (drift, migration debt) | data-persistence-layers.md §bypass · agent-admin-app-state-audit.md §sync-5 |
| F6 | Triplicated "active agent id" (page var / component field / raw localStorage key), in sync only because one function touches all three; no structural guarantee | MEDIUM (latent bug factory) | agent-admin-app-state-audit.md §sync-4 |
| F7 | `admin.libraries` fresh-object reassignment law enforced only by call-site discipline at five sites; a mutate-in-place silently no-ops with no type error | MEDIUM (latent bug factory) | agent-admin-app-state-audit.md §sync-3 |
| F8 | Five further site-level localStorage bypasses (theme, nav state, provider selection, dogfood flag, active-preset) outside StorageAdapter — page-level concerns, lower stakes than F5 | LOW (hygiene) | data-persistence-layers.md §bypass |
| F9 | Structural-sharing store duplicated across `a2ui` and `data` with ADR-0192's own named move-down condition ("a third copy → moves to `components/reactive` or `shared`") — watch-item, not yet tripped | LOW (named watch-item) | framework-state-idioms.md §gap-4 |
| F10 | No test anywhere edits the Settings Name field and asserts the select-menu label — genuine coverage gap for the F1 class | LOW (coverage; rides the F1 fix) | select-menu-name-bug.md §3 |

## The forks needing a ruling

1. **F1/F2 product call — one name or two?** Unify (Settings Name drives roster label via the
   existing `store.subscribe` seam + the drawer-rename path) or keep distinct (relabel the
   schema field so "Name" stops promising what it doesn't do). The bug fix is blocked on this
   ruling; both fixes are small once ruled.
2. **F3 architecture call** — pull ADR-0050's own trigger: run a planning lane on a sanctioned
   context/shared-state mechanism (evaluate the community `context-request` protocol vs.
   blessing the store-injection pattern), or ratify the status quo ("three point solutions, no
   general protocol — by design") in an ADR so the next feature stops guessing.
3. **F4 adoption call** — give `@agent-ui/data` a first real consumer (the agent-admin roster
   CRUD is the obvious candidate, which would also resolve F5 en passant), or record it as
   deliberately-shelved so its unadopted state stops reading as drift.

## Corpus contents

| File | Slice |
|---|---|
| `FINDINGS.md` | This index + verdict + forks |
| `framework-state-idioms.md` | Kernel/dom/traits idiom inventory, context-providing verdict, gaps |
| `data-persistence-layers.md` | ADR-0192/0193 contract-vs-adoption, bypass inventory |
| `agent-admin-app-state-audit.md` | Mechanism inventory, sync-point map, four-generations verdict |
| `select-menu-name-bug.md` | The concrete bug trace (never wired; two name domains) |
| `follow-up-queue.md` | Proposed tickets, none minted — awaiting rulings on the forks above |
