# Follow-up queue — data-model review 2026-08-20

Proposed work items derived from FINDINGS.md. **None minted** — items 1-2 are blocked on the
forks in FINDINGS.md §"The forks needing a ruling"; the rest await Kim's go-ahead on scope.

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
