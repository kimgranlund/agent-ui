Manifest: .sdlc/catalog-notfor-intents/decompose/manifest-v1.json (technical-architecture · plan) · coverage_check: clean
Quadrant: load-bearing
Outside-in: four subsystems (sidecar data · Node-only loader+renderer · gates+pins · decision record+docs); 20 leaves, every leaf hosts an action except n_descriptor_note (justify: affordance, the explicit "descriptor unchanged" record). MECE gap found and closed while crossing: the app marginal bundle budget (scripts/measure-size.mjs APP_MARGINAL_BUDGET, zero headroom, ADR-0197 cl.5 exception marked FINAL) had no node until a_zero_bundle forced n_size and moved the data out of catalog.json.
Inside-out: 23 actions; two were unhosted on the first pass (a_worker: the Cloudflare Worker has no fs, so a sidecar needs fs-shim-content.ts registration; a_no_rebase: the bundle gate must be proven, not assumed). No action names a solution. Every leaf carries an accept predicate that is an exit code or a byte-level diff.
Hand-off: /plan

## Notes for the planner
- Serial prep slice first: n_loader fixes the sidecar schema before any authoring or gate work (edges in the manifest).
- Authoring fans out: n_sel_default (80 types), n_sel_basic (14), n_sel_personas (3 fragments) are independent writers on separate files.
- Serial integration slice: n_inventory + n_gate_budget + n_baseline + n_shim (shared files: system-prompt.ts, prompt-drift.test.ts, baseline json, fs-shim-content.ts), one writer each.
- Docs slice after n_adr (ADR number 0232 verified at build: main is at 0231, no worktree or branch claims 0232 as of 2026-10-04).
