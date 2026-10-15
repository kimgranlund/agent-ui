Manifest: .sdlc/0011-a2ui-test-kit/decompose/manifest-v1.json (technical-architecture · plan) · coverage_check: clean (exit 0, also clean under --strict)
Quadrant: load-bearing
Outside-in: 33 leaves under 8 grouping nodes and one root (core, doubles, mount, catalog, defects, legs, data, entry). Sliced by owning file: one writer per file. Two shared edits are pulled into serial slices: `n_seams` (prep: two additive exports in `src/renderer/validate.ts` and `src/agent/produce.ts`, plus the include line) and `n_package` (integration: `package.json` scripts). One explicit include line lands in `vitest.config.ts` (the node-environment `tools` project, for the two Node-only tests `kit.test.ts` and `load.test.ts`), inside the prep slice; `vitest.browser.config.ts` is not written. jsdom legs match the existing `packages` glob and browser legs match the existing `packages-rest` glob. No unjustified leaf; every grouping node carries `justify: grouping`.
Inside-out: 44 actions derived from the handoff's goal, acceptance outline and constraints before the tree was fixed. Three of them (`a_both_envs`, `a_parity`, `a_control_seam`) come from measured mechanics, not from the handoff text: scenario files must load without fs in a browser page, cross-turn validation must reuse the producer's own seeds, and control definition must sit behind one module for PR #1824. No unhosted action. Every leaf has an `accept` command with an exit-code or count predicate; each new gate's accept names its negative control.
Hand-off: /plan

## Build order the edges force
1. `n_seams` (serial prep), then `n_format` and `n_findings`.
2. Parallel: `n_judge`, `n_transport`, `n_provider`, `n_mcp`, `n_tools`, `n_catalogs`, `n_mutate`, `n_catalog_gates`, `n_leg_offline`, `n_load_vite`.
3. Parallel: `n_conformance`, `n_producer`, `n_minimal`, `n_mount`, `n_load_node`.
4. `n_loop`, `n_leg_integration`, `n_leg_matrix`, then `n_seeded_run`, `n_cli`.
5. Data: `n_scenarios`, `n_seeded_data` (one writer each), then `n_leg_scenarios`, `n_leg_seeded`, `n_leg_fuzz`.
6. Browser: `n_leg_browser`, `n_leg_matrix_browser` (one browser lane).
7. Serial integration: `n_package`, `n_readme`, `n_scrub`.

## Judgment step (decisions to actions)
- Fork 1 (three tiers, no new runner): `a_command`, `a_browser_budget`, `a_gate_hook`.
- Fork 2 (one scenario format): `a_describe`, `a_reject`, `a_align`, `a_conformance`.
- Fork 3 (generated per-type matrix): `a_enumerate`, `a_minimal`, `a_matrix`, `a_real_engine`.
- Fork 4 (seeded defects, Kim's pinned-hash ruling of 2026-10-05): `a_seed_store`, `a_seed_prove`, `a_pin`.
- Fork 5 (seeded mutator, no dependency): `a_mutate`, `a_fuzz`.
- Fork 6 (one import seam): `a_control_seam`.
- Constraint "keyless and offline by construction": `a_offline`. Constraint "validate-then-stream order (ADR-0206)": `a_order`, which covers both the SPEC-R5 order and ADR-0206's `target` arm (a named target must be mutated in that turn).
- Handoff gap "no behavioural test of wantResponse": `a_wantresponse`.
- Not an action by design: the live-model leg (non-goal) and a visual-baseline leg (only if Kim asks).

## Not written by this role
The handoff's Context still needs the line `Decomposition: decompose/report.md` (this role writes only under `decompose/`).
