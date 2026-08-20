# Follow-up queue — data-model review 2026-08-20

Proposed work items derived from FINDINGS.md.

**Rulings (Kim, 2026-08-20, in-session AskUserQuestion round):** Fork 1 = **unify** ·
Fork 2 = **planning lane** · Fork 3 = **fold the data-layer question into the Fork 2 lane**.

**Minted:** Q1 → GH #1537 (bug, build lane dispatched) · Q2+Q6 → GH #1538 (feature, planning
lane dispatched — the lane rules adopt-vs-shelve, which then decides Q3/Q4's fate per the
ordering note below). Q5/Q7 remain unminted proposals; Q8 stays a watch-item.

**Second ruling round (Kim, 2026-08-20, later the same day — after #1537/#1540, ADR-0227
ratification, and wave 1 #1543 all landed):** all four proposed sweeps approved. Minted:
ratchet gate + Q7 drain → GH #1544 · ADR-0227 wave 2 (skill-packs/teams/resources onto
DataSource, Q5 folded in as slice 1 — dissolves F7 structurally) → GH #1545 · grammar
reference doc (new scope, stale-context repair for the ratified ADR-0227) → GH #1546.
Every queue row is now minted, folded, executed, or an explicit watch-item (Q8/F9).

| # | Proposed item | Kind | Blocked on | Size |
|---|---|---|---|---|
| Q1 | Fix the agent-name identity split (F1) + the Team-pane instance (F2) + regression test (F10) — one wave, mechanism per the ruling (unify via `store.subscribe`→`renameImportedPersona`→`pushRoster`, or relabel the schema field) | bug | Fork 1 ruling | small |
| Q2 | Context/shared-state mechanism decision — planning lane per ADR-0050's own named trigger: evaluate community `context-request` vs. bless store-injection vs. ratify the three-point-solutions status quo (F3) | feature (planning → ADR) | Fork 2 ruling | big |
| Q3 | Migrate `agent-admin-presets.ts` roster bookkeeping (`IMPORTED_PERSONAS_KEY`, `ACTIVE_PRESET_KEY`, `ROSTER_ORDER_KEY`, `modifiedAt`/`seedVersion` markers) onto the StorageAdapter seam — closes the app-central half of F5; the same shape as the shipped GH #959/#1077 memory-store migration | task | — | small-medium |
| Q4 | Consolidate the triplicated active-agent-id (F6) — one owner, two derivations; natural rider on Q3 | task | — | small |
| Q5 | Harden the `admin.libraries` fresh-object law (F7) — a typed setter or readonly-typed prop making mutate-in-place a compile error instead of a silent no-op | task | — | small |
| Q6 | `@agent-ui/data` adoption-or-shelve decision (F4): either a first real consumer (agent-admin roster CRUD — would modernize Gen 2 wholesale and subsume Q3) or a dated deferral record so unadopted ≠ drift | feature (decision first) | Fork 3 ruling | big if adopt / small if shelve |
| Q7 | Site-page localStorage hygiene sweep (F8): theme-loader, provider-mode-selection, _page nav flag, gen-ui-live toggle → StorageAdapter localStorage tier | task | — | small |
| Q8 | Watch-item only (F9): if a third structural-sharing store copy appears, execute ADR-0192's own move-down ("to `components/reactive` or `shared`") — do not pre-build | task (watch) | third copy appearing | — |

Ordering note: Q6-adopt subsumes Q3+Q4 (a roster on `DataSource`/`resource()` gets persistence
and single-ownership as part of the grammar). If Fork 3 rules "adopt," mint Q6 and drop Q3/Q4;
if "shelve," mint Q3+Q4 as the standalone modernization.
